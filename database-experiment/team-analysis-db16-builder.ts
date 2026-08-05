import { DatabaseTeamAnalysisDb15Dataset, Db15RuleConditionParity } from "./team-analysis-db15-contract";
import { DatabaseTeamAnalysisDb16Coverage, DatabaseTeamAnalysisDb16Dataset, Db16ResidualAttribution, Db16ResidualReason, Db16ResidualSide } from "./team-analysis-db16-contract";

type Atom = Record<string, unknown>;
const REASONS: Db16ResidualReason[] = ["logical_context_mismatch", "polarity_mismatch", "turn_one_exact_boundary_candidate_unproven", "comparator_mismatch", "threshold_mismatch", "current_turn_one_lower_bound_without_database_atom_unproven", "absent_in_other"];
function parse(value: string): Atom { const parsed = JSON.parse(value); if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("DB16 invalid structural signature"); return parsed; }
function same(left: Atom, right: Atom, keys: string[]): boolean { return keys.every(key => left[key] === right[key]); }
function core(left: Atom, right: Atom): boolean { return same(left, right, ["kind", "scope", "eventMode"]); }
function classify(side: Db16ResidualSide, signature: string, others: string[]): { reason: Db16ResidualReason, candidates: string[] } {
    const atom = parse(signature); const comparable = others.map(value => ({ signature: value, atom: parse(value) })).filter(value => core(atom, value.atom)); const candidates = (filter: (value: Atom) => boolean) => comparable.filter(value => filter(value.atom)).map(value => value.signature).sort();
    let found = candidates(value => same(atom, value, ["kind", "scope", "eventMode", "comparator", "value", "negated"])); if (found.length) return { reason: "logical_context_mismatch", candidates: found };
    found = candidates(value => same(atom, value, ["kind", "scope", "eventMode", "comparator", "value", "logicalContext"])); if (found.length) return { reason: "polarity_mismatch", candidates: found };
    found = candidates(value => atom.kind === "turn_from_entry" && atom.value === 1 && value.value === 1 && same(atom, value, ["scope", "logicalContext", "negated"]) && new Set([atom.comparator, value.comparator]).has("lte") && new Set([atom.comparator, value.comparator]).has("eq")); if (found.length) return { reason: "turn_one_exact_boundary_candidate_unproven", candidates: found };
    found = candidates(value => same(atom, value, ["kind", "scope", "eventMode", "value", "logicalContext", "negated"])); if (found.length) return { reason: "comparator_mismatch", candidates: found };
    found = candidates(value => same(atom, value, ["kind", "scope", "eventMode", "comparator", "logicalContext", "negated"])); if (found.length) return { reason: "threshold_mismatch", candidates: found };
    if (side === "current" && atom.kind === "turn_from_entry" && atom.comparator === "gte" && atom.value === 1 && comparable.length === 0) return { reason: "current_turn_one_lower_bound_without_database_atom_unproven", candidates: [] };
    return { reason: "absent_in_other", candidates: comparable.map(value => value.signature).sort() };
}
function attributions(record: Db15RuleConditionParity, side: Db16ResidualSide): Db16ResidualAttribution[] {
    const own = side === "database" ? record.withCompatibilityAliases.databaseOnlySignatures : record.withCompatibilityAliases.currentOnlySignatures; const others = side === "database" ? record.withCompatibilityAliases.currentOnlySignatures : record.withCompatibilityAliases.databaseOnlySignatures;
    return own.map(structuralSignature => { const result = classify(side, structuralSignature, others); return { stateKey: record.stateKey, databaseRuleKey: record.databaseRuleKey, currentRuleKey: record.currentRuleKey, side, structuralSignature, reason: result.reason, candidateSignatures: result.candidates }; });
}

export function buildDatabaseTeamAnalysisDb16Dataset(options: { db15: DatabaseTeamAnalysisDb15Dataset, db15Sha256: string }): DatabaseTeamAnalysisDb16Dataset {
    if (options.db15.contractVersion !== "0.14.0" || options.db15.semanticPromotionCount !== 0) throw new Error("DB16 source contract mismatch");
    const residualAttributions = options.db15.ruleConditionParity.flatMap(record => [...attributions(record, "database"), ...attributions(record, "current")]).sort((left, right) => left.stateKey.localeCompare(right.stateKey, "en", { numeric: true }) || left.databaseRuleKey.localeCompare(right.databaseRuleKey, "en", { numeric: true }) || left.currentRuleKey.localeCompare(right.currentRuleKey, "en", { numeric: true }) || left.side.localeCompare(right.side) || left.structuralSignature.localeCompare(right.structuralSignature));
    return { schemaVersion: 1, contract: "dokkan-team-analysis-rule-residual-attribution-experiment", contractVersion: "0.15.0", generatedAt: options.db15.generatedAt,
        sourceDb15: { fileName: "team-analysis-db15-rule-condition-parity.json.gz", sha256: options.db15Sha256, contractVersion: "0.14.0" }, sourceSnapshotVersion: options.db15.sourceSnapshotVersion, sourceDatabaseSha256: options.db15.sourceDatabaseSha256, sourceCurrentTeamAnalysis: options.db15.sourceCurrentTeamAnalysis, comparisonUniverse: options.db15.comparisonUniverse, semanticPromotionCount: 0, residualAttributions };
}

export function buildDatabaseTeamAnalysisDb16Coverage(dataset: DatabaseTeamAnalysisDb16Dataset): DatabaseTeamAnalysisDb16Coverage {
    const bySide = (side: Db16ResidualSide) => Object.fromEntries(REASONS.map(reason => [reason, dataset.residualAttributions.filter(value => value.side === side && value.reason === reason).length])) as Record<Db16ResidualReason, number>; const pairKey = (value: Db16ResidualAttribution) => `${value.stateKey}|${value.databaseRuleKey}|${value.currentRuleKey}`;
    const unproven = dataset.residualAttributions.filter(value => value.reason.endsWith("_unproven")); return { schemaVersion: 1, residualRulePairCount: new Set(dataset.residualAttributions.map(pairKey)).size, residualAttributionCount: dataset.residualAttributions.length, databaseResidualCount: dataset.residualAttributions.filter(value => value.side === "database").length, currentResidualCount: dataset.residualAttributions.filter(value => value.side === "current").length,
        countsBySideAndReason: { database: bySide("database"), current: bySide("current") }, turnOneExactBoundaryCandidateRulePairCount: new Set(dataset.residualAttributions.filter(value => value.reason === "turn_one_exact_boundary_candidate_unproven").map(pairKey)).size, currentTurnOneLowerBoundCandidateRulePairCount: new Set(dataset.residualAttributions.filter(value => value.reason === "current_turn_one_lower_bound_without_database_atom_unproven").map(pairKey)).size, unprovenCandidateAttributionCount: unproven.length, semanticPromotionCount: 0 };
}
