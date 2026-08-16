import {
    CHARACTER_LEADER_CAUSALITY_PIN,
    CHARACTER_LEADER_CAUSALITY_SEMANTICS_CONTRACT_VERSION,
    CHARACTER_LEADER_CAUSALITY_SEMANTICS_REPORT_LIMIT_BYTES,
    CHARACTER_LEADER_CAUSALITY_SEMANTICS_RSS_LIMIT_BYTES,
    CharacterLeaderCausalityDatabaseSource,
    CharacterLeaderCausalityEvaluation,
    CharacterLeaderCausalityK3Source,
    CharacterLeaderCausalityNativeProof,
    CharacterLeaderCausalitySemanticsReport,
} from "./leader-causality-semantics-contract";
import type { CharacterLeaderValueK48Source } from "./leader-value-scope-contract";

function sortedRecord(values: Map<string, number>): Record<string, number> {
    return Object.fromEntries([...values].sort((left, right) => Number(left[0]) - Number(right[0])));
}
export function evaluateCharacterLeaderCausalitySemantics(
    k48: CharacterLeaderValueK48Source,
    k3: CharacterLeaderCausalityK3Source,
    database: CharacterLeaderCausalityDatabaseSource,
): CharacterLeaderCausalityEvaluation {
    const effectIds = new Set(k3.effects.map(effect => effect.rowId));
    const referencedEffectIds = new Set<string>();
    let k48References = 0;
    for (const state of k48.states) for (const effect of state.effects) if (effectIds.has(effect.effectRowId)) {
        k48References++;
        referencedEffectIds.add(effect.effectRowId);
    }
    const occurrences = new Map<string, number>();
    let scalarExpressions = 0, conjunctionExpressions = 0, leafOccurrences = 0;
    for (const effect of k3.effects) {
        const ids = typeof effect.expression === "number"
            ? (scalarExpressions++, [effect.expression])
            : (conjunctionExpressions++, [effect.expression[1], effect.expression[2]]);
        leafOccurrences += ids.length;
        for (const id of ids) occurrences.set(String(id), (occurrences.get(String(id)) ?? 0) + 1);
    }
    const rows = new Map(database.rows.map(row => [row.id, row]));
    const masks = new Map<string, number>();
    let missingDatabaseRows = 0, causalityTypeMismatches = 0, unusedValueMismatches = 0;
    for (const id of [...occurrences.keys()].sort((left, right) => Number(left) - Number(right))) {
        const row = rows.get(id);
        if (!row) { missingDatabaseRows++; continue; }
        if (row.causalityType !== 35) causalityTypeMismatches++;
        if (row.cauVal2 !== 0 || row.cauVal3 !== 0) unusedValueMismatches++;
        if (row.causalityType === 35 && row.cauVal2 === 0 && row.cauVal3 === 0) masks.set(id, row.cauVal1);
    }
    return {
        type82NonNullRows: k3.effects.length,
        k48References,
        scalarExpressions,
        conjunctionExpressions,
        leafOccurrences,
        referencedIds: [...occurrences.keys()].sort((left, right) => Number(left) - Number(right)),
        idOccurrences: sortedRecord(occurrences),
        masks: sortedRecord(masks),
        k3MissingReferencedRows: [...k3.missingReferencedRowIds],
        separatelyBoundDatabaseRows: database.rows.length,
        missingK48EffectRows: k3.effects.length - referencedEffectIds.size,
        missingDatabaseRows,
        unsupportedExpressions: 0,
        causalityTypeMismatches,
        unusedValueMismatches,
    };
}
export function assertPinnedCharacterLeaderCausalitySemantics(
    scope: CharacterLeaderCausalityEvaluation,
    k3: CharacterLeaderCausalityK3Source,
    database: CharacterLeaderCausalityDatabaseSource,
    native: CharacterLeaderCausalityNativeProof,
): void {
    const pin = CHARACTER_LEADER_CAUSALITY_PIN;
    if (scope.type82NonNullRows !== pin.type82NonNullRows || scope.k48References !== pin.k48References
        || scope.scalarExpressions !== pin.scalarExpressions || scope.conjunctionExpressions !== pin.conjunctionExpressions
        || scope.leafOccurrences !== pin.leafOccurrences || scope.separatelyBoundDatabaseRows !== pin.referencedIds.length
        || scope.missingK48EffectRows !== 0 || scope.missingDatabaseRows !== 0 || scope.unsupportedExpressions !== 0
        || scope.causalityTypeMismatches !== 0 || scope.unusedValueMismatches !== 0) throw new Error("K52 corpus counts changed");
    if (JSON.stringify(scope.referencedIds) !== JSON.stringify(pin.referencedIds)
        || JSON.stringify(scope.k3MissingReferencedRows) !== JSON.stringify(pin.referencedIds)
        || JSON.stringify(scope.idOccurrences) !== JSON.stringify(pin.idOccurrences)
        || JSON.stringify(scope.masks) !== JSON.stringify(pin.masks)) throw new Error("K52 causality pins changed");
    if (k3.identity.causalityInputFingerprintSha256 !== pin.k3CausalityInputFingerprintSha256
        || database.identity.sha256 !== pin.databaseSha256 || database.identity.sizeBytes !== pin.databaseSizeBytes
        || database.identity.rowsFingerprintSha256 !== pin.databaseRowsFingerprintSha256 || !database.identity.descriptorBoundReadOnly) throw new Error("K52 source pins changed");
    if (native.elfSha256 !== pin.nativeSha256 || native.elfSizeBytes !== pin.nativeSizeBytes
        || native.evidenceSha256 !== pin.nativeEvidenceSha256 || native.evidenceSizeBytes !== pin.nativeEvidenceSizeBytes
        || native.codeRegionCount !== pin.nativeCodeRegions || native.exactCallCount !== pin.nativeExactCalls
        || !native.executionChainBound || !native.type35DispatchBound || !native.onlyCauVal1Read
        || native.humanBitNamesBound || native.partySelectionContextBound || native.lifecycleBound || native.stackingBound) throw new Error("K52 native proof changed");
}
export function buildCharacterLeaderCausalitySemanticsReport(
    k48: CharacterLeaderValueK48Source["identity"],
    k3: CharacterLeaderCausalityK3Source["identity"],
    database: CharacterLeaderCausalityDatabaseSource["identity"],
    native: CharacterLeaderCausalityNativeProof,
    scope: CharacterLeaderCausalityEvaluation,
): CharacterLeaderCausalitySemanticsReport {
    const report: CharacterLeaderCausalitySemanticsReport = {
        schemaVersion: 1,
        contract: "dokkan-database-character-leader-causality-semantics-audit",
        contractVersion: CHARACTER_LEADER_CAUSALITY_SEMANTICS_CONTRACT_VERSION,
        mode: "offline_local_explicit_opt_in_stdout_only",
        sources: { k48, k3, database, native },
        scope,
        semantics: {
            compiledScalar: "single_predicate",
            compiledAmpersand: "both_predicates_required",
            type35: "each_requested_bit_witnessed_by_an_eligible_card",
        },
        policy: {
            structuralConditionEvidenceOnly: true, k3OmissionDisclosed: true, sqliteSeparatelyBoundToExactFirstPartySnapshot: true,
            sourceTextReadForIdentityOrJoin: false, sourceTextIncluded: false, humanBitNamesDerived: false,
            partySelectionContextDerived: false, lifecycleDerived: false, stackingDerived: false, payloadWritten: false,
            authoritySelected: false, productionModified: false, networkEnabled: false, r2Enabled: false, androidImplemented: false,
        },
        inputIntegrity: {
            k48SourceBoundBefore: "NOT_EXECUTED", k48SourceBoundAfter: "NOT_EXECUTED", k48K3DatabaseAndNativeStable: false,
            databaseDescriptorBoundReadOnly: database.descriptorBoundReadOnly, reportTimestampIncluded: false,
            reportMaximumBytesExclusive: CHARACTER_LEADER_CAUSALITY_SEMANTICS_REPORT_LIMIT_BYTES,
            rssMaximumBytesExclusive: CHARACTER_LEADER_CAUSALITY_SEMANTICS_RSS_LIMIT_BYTES, rssStayedBelowExclusiveLimit: false,
        },
        readiness: {
            leaderCausalityStructuralSemantics: "NOT_EXECUTED", type35StructuralCondition: "NOT_EXECUTED",
            humanBitNames: "NO-GO", partySelectionContext: "NO-GO", lifecycle: "NO-GO", stacking: "NO-GO",
            productProjection: "NO-GO", authority: "NO-GO", production: "NO-GO", writer: "NO-GO", publisher: "NO-GO",
            network: "NO-GO", r2: "NO-GO", android: "NO-GO",
        },
    };
    if (Buffer.byteLength(`${JSON.stringify(report)}\n`) >= CHARACTER_LEADER_CAUSALITY_SEMANTICS_REPORT_LIMIT_BYTES) throw new Error("K52 report byte limit reached");
    return report;
}
