import { createHash } from "crypto";
import { DatabaseExperimentTables } from "./builder";
import { SourcedRow, SqliteScalar } from "./contract";
import { NativeRuntimeElfInspection } from "./native-runtime-elf-adapter";
import { Db11ConditionExpression, DatabaseTeamAnalysisDb11Dataset } from "./team-analysis-db11-contract";
import { DatabaseTeamAnalysisDb8Dataset } from "./team-analysis-db8-contract";
import { DatabaseTeamAnalysisDb9Dataset } from "./team-analysis-db9-contract";
import { DatabaseTeamAnalysisDb25Coverage, DatabaseTeamAnalysisDb25Dataset, Db25AttackContextResolution, Db25NativeAttackContextEvidence } from "./team-analysis-db25-contract";

const EXPECTED_CONCLUSIONS = ["type_40_tests_additional_param_byte_1_bit_0", "type_56_tests_additional_param_byte_1_equals_zero", "skill_causality_payload_is_zero_for_all_current_type_40_and_56_rows", "localized_or_symbol_names_are_not_semantic_proof"];
const COLUMNS = ["causality_type", "cau_val1", "cau_val2", "cau_val3"] as const;
function sha256(value: Buffer): string { return createHash("sha256").update(value).digest("hex"); }
function integer(value: unknown): number | undefined { const parsed = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : NaN; return Number.isSafeInteger(parsed) ? parsed : undefined; }
function rowValue(row: SourcedRow, column: string): SqliteScalar { return Object.prototype.hasOwnProperty.call(row.values, column) ? row.values[column] : null; }

function validateEvidence(inspection: NativeRuntimeElfInspection, evidence: Db25NativeAttackContextEvidence, nativeSha256: string): void {
    if (evidence.schemaVersion !== 1 || evidence.sourceSha256 !== nativeSha256 || evidence.auditScope !== "causality-types-40-and-56-attack-context-predicates" || JSON.stringify(evidence.conclusions) !== JSON.stringify(EXPECTED_CONCLUSIONS)) throw new Error("DB25 native evidence identity mismatch");
    const copy = evidence.additionalParam; const copySymbol = inspection.symbols.find(value => value.name === copy.copySymbol);
    if (!copySymbol || copySymbol.value !== copy.copyVma || copySymbol.size !== copy.copySizeBytes || sha256(inspection.readVirtualBytes(copy.copyVma, copy.copySizeBytes)) !== copy.copyCodeSha256 || copy.observedByteOffset !== 1 || copy.observation !== "caller_supplied_additional_param_is_copied_into_ability_status_causality") throw new Error("DB25 AdditionalParam copy evidence mismatch");
    if (evidence.handlers.length !== 2 || new Set(evidence.handlers.map(value => value.causalityType)).size !== 2) throw new Error("DB25 handler evidence cardinality mismatch");
    for (const handler of evidence.handlers) {
        const expectedPredicate = handler.causalityType === 40 ? "additional_param_byte_1_bit_0_set" : "additional_param_byte_1_equals_zero";
        const symbol = inspection.symbols.find(value => value.name === handler.symbol);
        if (handler.predicate !== expectedPredicate || handler.snapshotPayloadPath !== "all_current_rows_have_zero_cau_val1_2_3" || !symbol || symbol.value !== handler.vma || symbol.size !== handler.sizeBytes || sha256(inspection.readVirtualBytes(handler.vma, handler.sizeBytes)) !== handler.codeSha256) throw new Error(`DB25 handler evidence mismatch for ${handler.causalityType}`);
        if (handler.causalityType === 56 && JSON.stringify(handler.ignoredParameters) !== JSON.stringify(["cau_val1", "cau_val2", "cau_val3"])) throw new Error("DB25 type 56 parameter boundary mismatch");
    }
    if (!evidence.dynamicExperiment.required || evidence.dynamicExperiment.successCriterion !== "reproducible_mapping_of_byte_values_to_attack_kind_and_direction") throw new Error("DB25 dynamic experiment boundary mismatch");
}

function collect(expression: Db11ConditionExpression): Array<{ id: string, type: 40 | 56, previous: Db25AttackContextResolution["previousProjection"] }> {
    if (expression.op === "predicate" && expression.predicate.sourceCausalityType === 40) {
        const predicate = expression.predicate as unknown as Record<string, unknown>;
        if (predicate.kind !== "super_attacks_performed" || predicate.scope !== "self" || predicate.eventMode !== "current_event" || predicate.evidence !== "first-party-row-join") throw new Error("DB25 type 40 legacy projection shape mismatch");
        return [{ id: String(expression.predicate.sourceCausalityId), type: 40, previous: { status: "overclaimed", kind: "super_attacks_performed", evidence: "first-party-row-join" } }];
    }
    if (expression.op === "unknown" && integer(expression.causalityType ?? (typeof expression.raw === "object" && expression.raw !== null ? (expression.raw as Record<string, unknown>).causality_type : undefined)) === 56) return [{ id: String(expression.causalityId), type: 56, previous: { status: "unknown", kind: "unknown", evidence: "unknown" } }];
    if (expression.op === "not") return collect(expression.child);
    if (expression.op === "all" || expression.op === "any") return expression.children.flatMap(collect);
    return [];
}

export function buildDatabaseTeamAnalysisDb25Dataset(options: { db8: DatabaseTeamAnalysisDb8Dataset, db8Sha256: string, db9: DatabaseTeamAnalysisDb9Dataset, db9Sha256: string, db11: DatabaseTeamAnalysisDb11Dataset, db11Sha256: string, tables: DatabaseExperimentTables, inspection: NativeRuntimeElfInspection, nativeSha256: string, nativeSizeBytes: number, evidence: Db25NativeAttackContextEvidence, evidenceSha256: string }): DatabaseTeamAnalysisDb25Dataset {
    if (options.db8.contractVersion !== "0.7.0" || options.db9.contractVersion !== "0.8.0" || options.db11.contractVersion !== "0.10.0" || options.db8.sourceSha256 !== options.db9.sourceDatabaseSha256 || options.db8.sourceSha256 !== options.db11.sourceSha256 || options.db8.sourceSnapshotVersion !== options.db9.sourceSnapshotVersion || options.db8.sourceSnapshotVersion !== options.db11.sourceSnapshotVersion || options.db9.sourceDb8.sha256 !== options.db8Sha256 || options.db9.nativeRuntime.sha256 !== options.nativeSha256 || options.db9.nativeRuntime.sizeBytes !== options.nativeSizeBytes) throw new Error("DB25 source lineage mismatch");
    validateEvidence(options.inspection, options.evidence, options.nativeSha256);
    const gap56 = options.db8.causalityGaps.filter(value => integer(value.causalityType) === 56); const runtime56 = options.db9.causalityGapEvidence.filter(value => value.enumValue === 56);
    if (gap56.length !== 1 || runtime56.length !== 1) throw new Error("DB25 type 56 gap evidence cardinality mismatch");
    const handlers = new Map(options.evidence.handlers.map(value => [value.causalityType, value]));
    for (const type of [40, 56] as const) { const slots = options.db9.causalityDispatchSlots.filter(value => value.enumValue === type); const handler = handlers.get(type)!; if (slots.length !== 1 || slots[0].status !== "identified" || slots[0].symbol !== handler.symbol || slots[0].symbolAddress !== handler.vma) throw new Error(`DB25 dispatch evidence mismatch for ${type}`); }
    if (runtime56[0].identityStatus !== "runtime_identified" || runtime56[0].occurrenceCount !== gap56[0].occurrenceCount || runtime56[0].affectedStateCount !== gap56[0].affectedStateCount) throw new Error("DB25 type 56 runtime evidence mismatch");
    const rows = new Map<string, SourcedRow>(); for (const row of options.tables.skill_causalities ?? []) { const id = String(row.id); if (rows.has(id)) throw new Error(`DB25 duplicate skill_causalities row ${id}`); rows.set(id, { values: row, provenance: { table: "skill_causalities", rowId: id, columns: Object.keys(row) } }); }
    for (const row of rows.values()) if (integer(rowValue(row, "causality_type")) === 40 || integer(rowValue(row, "causality_type")) === 56) {
        if (COLUMNS.some(column => !Object.prototype.hasOwnProperty.call(row.values, column))) throw new Error(`DB25 incomplete skill_causalities row ${row.provenance.rowId}`);
        if ([rowValue(row, "cau_val1"), rowValue(row, "cau_val2"), rowValue(row, "cau_val3")].some(value => integer(value) !== 0)) throw new Error(`DB25 nonzero payload outside audited snapshot path ${row.provenance.rowId}`);
    }
    const resolutions: Db25AttackContextResolution[] = []; const occurrenceKeys = new Set<string>();
    for (const state of options.db11.states) for (const rule of state.passive?.rules ?? []) for (const found of collect(rule.condition)) {
        const occurrenceKey = `${state.stateKey}|${rule.ruleKey}|${found.id}|${found.type}`; if (occurrenceKeys.has(occurrenceKey)) throw new Error(`DB25 duplicate occurrence ${occurrenceKey}`); occurrenceKeys.add(occurrenceKey);
        const row = rows.get(found.id); const handler = handlers.get(found.type)!; if (!row || integer(rowValue(row, "causality_type")) !== found.type) throw new Error(`DB25 causality row mismatch ${found.id}`);
        const raw = { cauVal1: rowValue(row, "cau_val1"), cauVal2: rowValue(row, "cau_val2"), cauVal3: rowValue(row, "cau_val3") }; if ([raw.cauVal1, raw.cauVal2, raw.cauVal3].some(value => integer(value) !== 0)) throw new Error(`DB25 nonzero payload outside audited snapshot path ${found.id}`);
        resolutions.push({ stateKey: state.stateKey, ruleKey: rule.ruleKey, passiveSkillId: rule.source.passiveSkillId, causalityId: found.id, causalityType: found.type, semanticStatus: "partial", semanticPromotion: false, previousProjection: found.previous, canonicalProjection: { kind: "native_attack_context_predicate", scope: "current_causality_evaluation", test: handler.predicate, attackKind: "unknown", eventDirection: "unknown", eventScope: "unknown" }, raw, provenance: { database: { table: "skill_causalities", rowId: found.id, columns: [...COLUMNS] }, runtime: { fileName: "libcocos2dcpp.so", sha256: options.nativeSha256, evidenceFile: "native-attack-context-semantics.json", evidenceSha256: options.evidenceSha256, handlerSymbol: handler.symbol, handlerVma: handler.vma, handlerSizeBytes: handler.sizeBytes, handlerCodeSha256: handler.codeSha256 } } });
    }
    resolutions.sort((a, b) => a.stateKey.localeCompare(b.stateKey, "en", { numeric: true }) || a.ruleKey.localeCompare(b.ruleKey, "en", { numeric: true }) || a.causalityType - b.causalityType);
    const type56 = resolutions.filter(value => value.causalityType === 56); if (type56.length !== gap56[0].occurrenceCount || new Set(type56.map(value => value.stateKey)).size !== gap56[0].affectedStateCount) throw new Error("DB25 type 56 occurrence accounting mismatch");
    return { schemaVersion: 1, contract: "dokkan-team-analysis-native-attack-context-correction-experiment", contractVersion: "0.24.0", generatedAt: options.db11.generatedAt, sourceSnapshotVersion: options.db8.sourceSnapshotVersion, sourceDatabaseSha256: options.db8.sourceSha256, sourceDb8: { fileName: "team-analysis-db8-evidence-experiment.json.gz", sha256: options.db8Sha256, contractVersion: "0.7.0" }, sourceDb9: { fileName: "team-analysis-db9-runtime-evidence.json.gz", sha256: options.db9Sha256, contractVersion: "0.8.0" }, sourceDb11: { fileName: "team-analysis-db11-experiment.json.gz", sha256: options.db11Sha256, contractVersion: "0.10.0" }, nativeRuntime: { fileName: "libcocos2dcpp.so", sha256: options.nativeSha256, sizeBytes: options.nativeSizeBytes }, nativeEvidence: { fileName: "native-attack-context-semantics.json", sha256: options.evidenceSha256 }, inheritedSemanticPromotionCount: 3, semanticPromotionCount: 0, resolutions };
}

export function buildDatabaseTeamAnalysisDb25Coverage(dataset: DatabaseTeamAnalysisDb25Dataset): DatabaseTeamAnalysisDb25Coverage {
    const values = (type: 40 | 56) => dataset.resolutions.filter(value => value.causalityType === type);
    const type40 = values(40), type56 = values(56);
    return { schemaVersion: 1, resolutionCount: dataset.resolutions.length, affectedStateCount: new Set(dataset.resolutions.map(value => value.stateKey)).size, occurrenceCountsByType: { "40": type40.length, "56": type56.length }, affectedStateCountsByType: { "40": new Set(type40.map(value => value.stateKey)).size, "56": new Set(type56.map(value => value.stateKey)).size }, overclaimCorrectionCount: type40.length, newPartialNativePredicateCount: type56.length, rawZeroPayloadCount: dataset.resolutions.filter(value => [value.raw.cauVal1, value.raw.cauVal2, value.raw.cauVal3].every(raw => integer(raw) === 0)).length, semanticPromotionCount: 0, dynamicExperimentRequired: true };
}
