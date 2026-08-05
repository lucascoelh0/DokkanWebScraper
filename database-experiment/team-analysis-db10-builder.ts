import { createHash } from "crypto";
import { NativeRuntimeElfInspection } from "./native-runtime-elf-adapter";
import { DatabaseTeamAnalysisDb8Dataset, Db8CausalityGap } from "./team-analysis-db8-contract";
import { DatabaseTeamAnalysisDb9Dataset } from "./team-analysis-db9-contract";
import { DatabaseTeamAnalysisDb10Coverage, DatabaseTeamAnalysisDb10Dataset, Db10CausalityResolution, Db10NativeSemanticHandler, Db10NativeSemanticsLayout } from "./team-analysis-db10-contract";

function sha256(value: Buffer): string { return createHash("sha256").update(value).digest("hex"); }

function gapType(value: Db8CausalityGap): number | undefined {
    const parsed = typeof value.causalityType === "number" ? value.causalityType : typeof value.causalityType === "string" && value.causalityType.trim() ? Number(value.causalityType) : NaN;
    return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : undefined;
}

function validateSymbol(inspection: NativeRuntimeElfInspection, symbolName: string, expectedVma: number, expectedSize: number, expectedHash: string) {
    const symbol = inspection.symbols.find(value => value.name === symbolName);
    if (!symbol) throw new Error(`DB10 native symbol missing: ${symbolName}`);
    if (symbol.value !== expectedVma || symbol.size !== expectedSize) throw new Error(`DB10 native symbol layout mismatch: ${symbolName}`);
    const actualHash = sha256(inspection.readVirtualBytes(symbol.value, symbol.size));
    if (actualHash !== expectedHash) throw new Error(`DB10 native symbol code hash mismatch: ${symbolName}`);
}

function resolution(handler: Db10NativeSemanticHandler, gap: Db8CausalityGap): Db10CausalityResolution {
    return {
        causalityType: handler.causalityType, status: handler.status, operation: handler.operation, comparator: handler.comparator,
        thresholdSource: handler.parameterReads.includes("cau_val1") ? "cau_val1" : undefined,
        valueExpression: handler.valueExpression, gate: handler.gate, parameterReads: handler.parameterReads, ignoredParameters: handler.ignoredParameters,
        unknowns: handler.unknowns, occurrenceCount: gap.occurrenceCount, affectedStateCount: gap.affectedStateCount,
        affectedStateKeys: gap.affectedStateKeys, causalityIds: gap.causalityIds, rawValueDomains: gap.rawValueDomains, samples: gap.samples,
        provenance: {
            database: { table: "skill_causalities", columns: ["causality_type", "cau_val1", "cau_val2", "cau_val3"] },
            runtime: { fileName: "libcocos2dcpp.so", symbol: handler.symbol, vma: handler.vma, sizeBytes: handler.sizeBytes, codeSha256: handler.codeSha256 },
        },
    };
}

export function buildDatabaseTeamAnalysisDb10Dataset(options: {
    db8: DatabaseTeamAnalysisDb8Dataset,
    db8Sha256: string,
    db9: DatabaseTeamAnalysisDb9Dataset,
    db9Sha256: string,
    inspection: NativeRuntimeElfInspection,
    layout: Db10NativeSemanticsLayout,
    layoutSha256: string,
    nativeSha256: string,
}): DatabaseTeamAnalysisDb10Dataset {
    if (options.db8.contractVersion !== "0.7.0" || options.db9.contractVersion !== "0.8.0" || options.db9.sourceDb8ContractVersion !== "0.7.0" ||
        options.db8.sourceSnapshotVersion !== options.db9.sourceSnapshotVersion || options.db8.sourceSha256 !== options.db9.sourceDatabaseSha256 || options.db9.sourceDb8.sha256 !== options.db8Sha256) throw new Error("DB10 DB8/DB9 source lineage mismatch");
    if (options.layout.schemaVersion !== 1 || options.layout.sourceSha256 !== options.nativeSha256 || options.db9.nativeRuntime.sha256 !== options.nativeSha256) throw new Error("DB10 native source lineage mismatch");
    const constructor = options.layout.payloadLayout;
    if (constructor.containerOffset !== 8 || constructor.elementSizeBytes !== 4 || JSON.stringify(constructor.indexColumns) !== JSON.stringify(["cau_val1", "cau_val2", "cau_val3"])) throw new Error("DB10 SkillCausality payload layout mismatch");
    validateSymbol(options.inspection, constructor.constructorSymbol, constructor.constructorVma, constructor.constructorSizeBytes, constructor.constructorCodeSha256);
    validateSymbol(options.inspection, constructor.rowConstructorSymbol, constructor.rowConstructorVma, constructor.rowConstructorSizeBytes, constructor.rowConstructorCodeSha256);
    const types = new Set<number>();
    for (const handler of options.layout.handlers) {
        if (types.has(handler.causalityType)) throw new Error(`DB10 duplicate causality semantic ${handler.causalityType}`); types.add(handler.causalityType);
        validateSymbol(options.inspection, handler.symbol, handler.vma, handler.sizeBytes, handler.codeSha256);
        const slot = options.db9.causalityDispatchSlots[handler.causalityType];
        if (!slot || slot.status !== "identified" || slot.symbol !== handler.symbol || slot.symbolAddress !== handler.vma) throw new Error(`DB10 DB9 dispatch identity mismatch for causality ${handler.causalityType}`);
        const allParameters = [...handler.parameterReads, ...handler.ignoredParameters];
        if (allParameters.length !== 3 || new Set(allParameters).size !== 3 || !["cau_val1", "cau_val2", "cau_val3"].every(value => allParameters.includes(value as any))) throw new Error(`DB10 incomplete parameter audit for causality ${handler.causalityType}`);
        if (handler.status === "supported" && handler.unknowns.length > 0 || handler.status === "partial" && handler.unknowns.length === 0) throw new Error(`DB10 semantic status/unknown mismatch for causality ${handler.causalityType}`);
    }
    const byType = new Map<number, Db8CausalityGap>();
    for (const gap of options.db8.causalityGaps) {
        const type = gapType(gap); if (type === undefined) continue;
        if (byType.has(type)) throw new Error(`DB10 duplicate source gap type ${type}`); byType.set(type, gap);
    }
    const causalityResolutions = options.layout.handlers.map(handler => {
        const gap = byType.get(handler.causalityType); if (!gap) throw new Error(`DB10 source gap missing for causality ${handler.causalityType}`); return resolution(handler, gap);
    }).sort((left, right) => left.causalityType - right.causalityType);
    const supported = causalityResolutions.filter(value => value.status === "supported"); const partial = causalityResolutions.filter(value => value.status === "partial");
    if (supported.length !== 3 || partial.length !== 1) throw new Error("DB10 audited promotion set must contain three supported and one partial causality types");
    return {
        schemaVersion: 1, contract: "dokkan-team-analysis-native-semantic-evidence-experiment", contractVersion: "0.9.0", generatedAt: options.db9.generatedAt,
        sourceSnapshotVersion: options.db9.sourceSnapshotVersion, sourceDatabaseSha256: options.db9.sourceDatabaseSha256,
        sourceDb8: { fileName: "team-analysis-db8-evidence-experiment.json.gz", sha256: options.db8Sha256, contractVersion: "0.7.0" },
        sourceDb9: { fileName: "team-analysis-db9-runtime-evidence.json.gz", sha256: options.db9Sha256, contractVersion: "0.8.0" },
        nativeRuntime: { fileName: "libcocos2dcpp.so", sha256: options.nativeSha256 }, nativeSemanticsLayout: { fileName: "native-runtime-semantics.json", sha256: options.layoutSha256 },
        semanticPromotionCount: 3, promotedOccurrenceCount: supported.reduce((sum, value) => sum + value.occurrenceCount, 0), partialResolutionCount: 1,
        partialResolutionOccurrenceCount: partial.reduce((sum, value) => sum + value.occurrenceCount, 0), causalityResolutions,
    };
}

export function buildDatabaseTeamAnalysisDb10Coverage(dataset: DatabaseTeamAnalysisDb10Dataset, db8: DatabaseTeamAnalysisDb8Dataset): DatabaseTeamAnalysisDb10Coverage {
    const supported = dataset.causalityResolutions.filter(value => value.status === "supported"); const partial = dataset.causalityResolutions.filter(value => value.status === "partial");
    const sourceOccurrences = db8.causalityGaps.reduce((sum, value) => sum + value.occurrenceCount, 0);
    return {
        schemaVersion: 1, sourceGapTypeCount: db8.causalityGaps.length, sourceGapOccurrenceCount: sourceOccurrences,
        auditedTypeCount: dataset.causalityResolutions.length, supportedTypeCount: supported.length, partialTypeCount: partial.length,
        promotedOccurrenceCount: dataset.promotedOccurrenceCount, partialResolutionOccurrenceCount: dataset.partialResolutionOccurrenceCount,
        remainingUnresolvedTypeCount: db8.causalityGaps.length - supported.length, remainingUnresolvedOccurrenceCount: sourceOccurrences - dataset.promotedOccurrenceCount,
        promotedAffectedStateCount: new Set(supported.flatMap(value => value.affectedStateKeys)).size, semanticPromotionCount: 3, efficacyPromotionCount: 0,
    };
}
