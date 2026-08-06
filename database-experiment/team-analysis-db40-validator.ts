import { DatabaseExperimentTables } from "./builder";
import { Db11ConditionExpression, DatabaseTeamAnalysisDb11Dataset } from "./team-analysis-db11-contract";
import { DatabaseTeamAnalysisDb40Dataset, Db40NativeEvidence, Db40Resolution } from "./team-analysis-db40-contract";

const TYPES = [3, 4] as const;
const integer = (value: unknown) => { const parsed = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : NaN; return Number.isSafeInteger(parsed) ? parsed : undefined; };
function collect(expression: Db11ConditionExpression): Array<{ id: string, type: 3 | 4 }> {
    const rawType = integer(expression.op === "unknown" ? expression.causalityType ?? (typeof expression.raw === "object" && expression.raw !== null ? (expression.raw as Record<string, unknown>).causality_type : undefined) : undefined);
    if (expression.op === "unknown" && TYPES.includes(rawType as 3 | 4)) return [{ id: String(expression.causalityId), type: rawType as 3 | 4 }];
    if (expression.op === "not") return collect(expression.child);
    if (expression.op === "all" || expression.op === "any") return [...new Map(expression.children.flatMap(collect).map(value => [`${value.type}|${value.id}`, value])).values()];
    return [];
}
function expectedPredicate(type: 3 | 4, threshold: number): Db40Resolution["predicate"] {
    return { metric: "battle_gauge_value_over_cap100_percent_truncated_float32", comparator: type === 3 ? "gte" : "lt", threshold, thresholdUnit: "percent_points_of_battle_gauge_cap100", categoryGate: { rawCategory: 0, nonzeroCategoryMetric: 0, semanticName: "unknown" }, characterSelection: "current_character_by_ability_status_deck_index", calculation: { numerator: "battle_gauge_value_include_expectation_false", denominator: "battle_gauge_cap100", arithmetic: "signed_int32_to_float32_divide_multiply_100_truncate_toward_zero", zeroDenominatorBehavior: "unknown" } };
}

export function validateDatabaseTeamAnalysisDb40Dataset(dataset: DatabaseTeamAnalysisDb40Dataset, db11: DatabaseTeamAnalysisDb11Dataset, tables: DatabaseExperimentTables, expected: { db8Sha256: string, db9Sha256: string, db10Sha256: string, db11Sha256: string, nativeSha256: string, nativeSizeBytes: number, evidence: Db40NativeEvidence, evidenceSha256: string }) {
    const failures: string[] = [];
    if (dataset.schemaVersion !== 1 || dataset.contract !== "dokkan-team-analysis-battle-gauge-threshold-native-semantics-experiment" || dataset.contractVersion !== "0.39.0" || dataset.inheritedSemanticPromotionCount !== 45 || dataset.semanticPromotionCount !== 2) failures.push("contract identity");
    if (dataset.generatedAt !== db11.generatedAt || dataset.sourceSnapshotVersion !== db11.sourceSnapshotVersion || dataset.sourceDatabaseSha256 !== db11.sourceSha256) failures.push("snapshot lineage");
    if (dataset.sourceDb8.sha256 !== expected.db8Sha256 || dataset.sourceDb9.sha256 !== expected.db9Sha256 || dataset.sourceDb10.sha256 !== expected.db10Sha256 || dataset.sourceDb11.sha256 !== expected.db11Sha256 || JSON.stringify(dataset.nativeRuntime) !== JSON.stringify({ fileName: "libcocos2dcpp.so", sha256: expected.nativeSha256, sizeBytes: expected.nativeSizeBytes }) || JSON.stringify(dataset.nativeEvidence) !== JSON.stringify({ fileName: "native-battle-gauge-threshold-semantics.json", sha256: expected.evidenceSha256 })) failures.push("artifact lineage");
    const rows = new Map((tables.skill_causalities ?? []).map(row => [String(row.id), row]));
    const source = new Map<string, { passiveSkillId: string, type: 3 | 4 }>();
    for (const state of db11.states) for (const rule of state.passive?.rules ?? []) for (const found of collect(rule.condition)) source.set(`${state.stateKey}|${rule.ruleKey}|${found.id}`, { passiveSkillId: rule.source.passiveSkillId, type: found.type });
    const handlers = new Map(expected.evidence.handlers.map(handler => [handler.causalityType, handler])), proofRoles = expected.evidence.codeRegions.map(region => region.role), seen = new Set<string>(); let losslessReconstructionCount = 0;
    for (const resolution of dataset.resolutions) {
        const key = `${resolution.stateKey}|${resolution.ruleKey}|${resolution.causalityId}`, association = source.get(key), row = rows.get(resolution.causalityId), handler = handlers.get(resolution.causalityType);
        if (seen.has(key)) failures.push(`duplicate ${key}`); seen.add(key);
        if (!association || !row || !handler || association.type !== resolution.causalityType || association.passiveSkillId !== resolution.passiveSkillId || integer(row.causality_type) !== resolution.causalityType) { failures.push(`association ${key}`); continue; }
        const threshold = integer(row.cau_val1); if (threshold === undefined || integer(row.cau_val2) !== 0 || integer(row.cau_val3) !== 0) { failures.push(`row ${key}`); continue; }
        losslessReconstructionCount++;
        if (JSON.stringify(resolution.raw) !== JSON.stringify({ cauVal1: row.cau_val1, cauVal2: row.cau_val2, cauVal3: row.cau_val3 }) || JSON.stringify(resolution.predicate) !== JSON.stringify(expectedPredicate(resolution.causalityType, threshold)) || resolution.semanticStatus !== "partial" || JSON.stringify(resolution.activation) !== JSON.stringify({ timing: "unknown", recurrence: "unknown", calculationBucket: "unknown", gaugePopulationAndReset: "unknown" })) failures.push(`projection ${key}`);
        const runtime = { fileName: "libcocos2dcpp.so", sha256: expected.nativeSha256, evidenceFile: "native-battle-gauge-threshold-semantics.json", evidenceSha256: expected.evidenceSha256, handlerSymbol: handler.symbol, handlerVma: handler.vma, handlerSizeBytes: handler.sizeBytes, handlerCodeSha256: handler.codeSha256, proofRoles };
        const inherited = { db8Sha256: expected.db8Sha256, db9Sha256: expected.db9Sha256, db10Sha256: expected.db10Sha256, db11RuleKey: resolution.ruleKey, db11Sha256: expected.db11Sha256 };
        if (JSON.stringify(resolution.provenance.database) !== JSON.stringify({ table: "skill_causalities", rowId: resolution.causalityId, columns: ["causality_type", "cau_val1", "cau_val2", "cau_val3"] }) || JSON.stringify(resolution.provenance.runtime) !== JSON.stringify(runtime) || JSON.stringify(resolution.provenance.inherited) !== JSON.stringify(inherited)) failures.push(`provenance ${key}`);
    }
    if (source.size !== 1267 || seen.size !== source.size || dataset.resolutions.length !== source.size || [...source.keys()].some(key => !seen.has(key))) failures.push(`cardinality ${seen.size}/${source.size}`);
    return { schemaVersion: 1 as const, valid: failures.length === 0, resolutionCount: dataset.resolutions.length, losslessReconstructionCount, failures };
}
