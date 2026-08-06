import { DatabaseExperimentTables } from "./builder";
import { SqliteRow } from "./sqlite-readonly-adapter";
import { DatabaseTeamAnalysisDb11Dataset, Db11PassiveRule } from "./team-analysis-db11-contract";
import { DatabaseTeamAnalysisDb19Dataset, Db19ResidualAttribution } from "./team-analysis-db19-contract";
import { DatabaseTeamAnalysisDb20Coverage, DatabaseTeamAnalysisDb20Dataset, Db20CorrelationStatus, Db20PassiveTurnCorrelation } from "./team-analysis-db20-contract";

const STATUSES: Db20CorrelationStatus[] = ["exact_numeric_match", "numeric_mismatch", "non_numeric_turn", "passive_skill_missing", "database_rule_missing"];
const COLUMNS = ["turn", "is_once", "exec_timing_type", "efficacy_type"] as const;
type Candidate = Db19ResidualAttribution & { upperBound: number };

function numeric(value: unknown): number | null {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Number(value);
    return null;
}

function rowId(row: SqliteRow | undefined): string | null {
    return row?.id === undefined || row.id === null || row.id === "" ? null : String(row.id);
}

function parseCandidate(value: Db19ResidualAttribution): Candidate | null {
    if (value.side !== "current" || value.reason !== "absent_in_other") return null;
    let atom: Record<string, unknown>;
    try { atom = JSON.parse(value.structuralSignature); } catch { throw new Error("DB20 invalid DB19 structural signature"); }
    if (!atom || Array.isArray(atom) || atom.kind !== "turn_from_entry" || atom.comparator !== "lte" || atom.logicalContext !== "all" || atom.negated !== false || atom.scope !== "self") return null;
    const upperBound = numeric(atom.value);
    if (upperBound === null) throw new Error("DB20 candidate has a non-numeric upper bound");
    return { ...value, upperBound };
}

function key(stateKey: string, ruleKey: string): string { return `${stateKey}|${ruleKey}`; }

function distribution(values: Db20PassiveTurnCorrelation[], get: (value: Db20PassiveTurnCorrelation) => unknown): Record<string, number> {
    const result: Record<string, number> = {};
    for (const value of values) { const raw = get(value); const label = raw === null || raw === undefined ? "null" : String(raw); result[label] = (result[label] ?? 0) + 1; }
    return Object.fromEntries(Object.entries(result).sort(([left], [right]) => left.localeCompare(right, "en", { numeric: true })));
}

export function buildDatabaseTeamAnalysisDb20Dataset(options: { db11: DatabaseTeamAnalysisDb11Dataset, db11Sha256: string, db19: DatabaseTeamAnalysisDb19Dataset, db19Sha256: string, tables: DatabaseExperimentTables }): DatabaseTeamAnalysisDb20Dataset {
    if (options.db11.contractVersion !== "0.10.0" || options.db19.contractVersion !== "0.18.0" || options.db11.sourceSha256 !== options.db19.sourceDatabaseSha256 || options.db11.sourceSnapshotVersion !== options.db19.sourceSnapshotVersion || options.db19.inheritedSemanticPromotionCount !== 3 || options.db19.semanticPromotionCount !== 0) throw new Error("DB20 source lineage mismatch");
    const rules = new Map<string, Db11PassiveRule>();
    for (const state of options.db11.states) for (const rule of state.passive?.rules ?? []) { const ruleKey = key(state.stateKey, rule.ruleKey); if (rules.has(ruleKey)) throw new Error("DB20 duplicate DB11 rule key"); rules.set(ruleKey, rule); }
    const passiveSkills = new Map<string, SqliteRow>();
    for (const row of options.tables.passive_skills ?? []) { const id = rowId(row); if (!id) continue; if (passiveSkills.has(id)) throw new Error("DB20 duplicate passive_skills id"); passiveSkills.set(id, row); }
    const candidates = options.db19.residualAttributions.map(parseCandidate).filter((value): value is Candidate => value !== null);
    const correlations = candidates.map(candidate => {
        const rule = rules.get(key(candidate.stateKey, candidate.databaseRuleKey));
        const passiveSkillId = rule?.source.passiveSkillId ?? null;
        const row = passiveSkillId === null ? undefined : passiveSkills.get(passiveSkillId);
        const rawTurn = row?.turn ?? null;
        const turn = numeric(rawTurn);
        const correlationStatus: Db20CorrelationStatus = !rule ? "database_rule_missing" : !row ? "passive_skill_missing" : turn === null ? "non_numeric_turn" : turn === candidate.upperBound ? "exact_numeric_match" : "numeric_mismatch";
        return { stateKey: candidate.stateKey, databaseRuleKey: candidate.databaseRuleKey, currentRuleKey: candidate.currentRuleKey, currentStructuralSignature: candidate.structuralSignature, currentTurnFromEntryUpperBound: candidate.upperBound, passiveSkillId, raw: { turn: rawTurn, isOnce: row?.is_once ?? null, executionTimingType: row?.exec_timing_type ?? null, efficacyType: row?.efficacy_type ?? null }, correlationStatus, semanticStatus: "unknown" as const, provenance: { table: "passive_skills" as const, rowId: rowId(row), columns: [...COLUMNS] as ["turn", "is_once", "exec_timing_type", "efficacy_type"] } };
    }).sort((left, right) => left.stateKey.localeCompare(right.stateKey, "en", { numeric: true }) || left.databaseRuleKey.localeCompare(right.databaseRuleKey, "en", { numeric: true }) || left.currentRuleKey.localeCompare(right.currentRuleKey, "en", { numeric: true }));
    return { schemaVersion: 1, contract: "dokkan-team-analysis-passive-turn-correlation", contractVersion: "0.19.0", generatedAt: options.db19.generatedAt, sourceDb11: { fileName: "team-analysis-db11-experiment.json.gz", sha256: options.db11Sha256, contractVersion: "0.10.0" }, sourceDb19: { fileName: "team-analysis-db19-post-lifecycle-residuals.json.gz", sha256: options.db19Sha256, contractVersion: "0.18.0" }, sourceSnapshotVersion: options.db19.sourceSnapshotVersion, sourceDatabaseSha256: options.db19.sourceDatabaseSha256, sourceCurrentTeamAnalysis: options.db19.sourceCurrentTeamAnalysis, candidateDefinition: "current-only-absent-turn-from-entry-lte-all", inheritedSemanticPromotionCount: 3, semanticPromotionCount: 0, passiveTurnSemanticStatus: "unknown", correlations };
}

export function buildDatabaseTeamAnalysisDb20Coverage(dataset: DatabaseTeamAnalysisDb20Dataset): DatabaseTeamAnalysisDb20Coverage {
    const counts = Object.fromEntries(STATUSES.map(status => [status, dataset.correlations.filter(value => value.correlationStatus === status).length])) as Record<Db20CorrelationStatus, number>;
    const exact = counts.exact_numeric_match;
    return { schemaVersion: 1, candidateCount: dataset.correlations.length, candidateRulePairCount: new Set(dataset.correlations.map(value => `${value.stateKey}|${value.databaseRuleKey}|${value.currentRuleKey}`)).size, correlationCounts: counts, exactNumericMatchCount: exact, exactNumericMatchRate: dataset.correlations.length ? exact / dataset.correlations.length : 0, uniquePassiveSkillCount: new Set(dataset.correlations.flatMap(value => value.passiveSkillId ? [value.passiveSkillId] : [])).size, rawValueDistributions: { turn: distribution(dataset.correlations, value => value.raw.turn), isOnce: distribution(dataset.correlations, value => value.raw.isOnce), executionTimingType: distribution(dataset.correlations, value => value.raw.executionTimingType), efficacyType: distribution(dataset.correlations, value => value.raw.efficacyType) }, inheritedSemanticPromotionCount: 3, semanticPromotionCount: 0, passiveTurnSemanticStatus: "unknown" };
}
