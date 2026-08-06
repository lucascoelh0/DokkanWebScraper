import { equal, throws } from "assert";
import { describe, it } from "mocha";
import { buildDatabaseTeamAnalysisDb18Coverage, buildDatabaseTeamAnalysisDb18Dataset } from "./team-analysis-db18-builder";

const sig = (comparator: string, logicalContext = "any") => JSON.stringify({ comparator, kind: "turn_from_entry", logicalContext, negated: false, scope: "self", value: 1 });
function parity(database: string[], current: string[], status: string) { return { databaseSignatures: database, currentSignatures: current, matchedSignatures: [], databaseOnlySignatures: database, currentOnlySignatures: current, status }; }
function fixture() {
    const lte = sig("lte"); const eq = sig("eq"); const gte = sig("gte", "all");
    const db15 = { contractVersion: "0.14.0", generatedAt: "x", sourceDatabaseSha256: "database", sourceCurrentTeamAnalysis: { sha256: "current", parserVersion: "parser" }, sourceSnapshotVersion: "snapshot", comparisonUniverse: "runtime-types-43-51-55-plus-current-exact-turn", semanticPromotionCount: 0, ruleConditionParity: [
        { stateKey: "1", databaseRuleKey: "d1", currentRuleKey: "c1", withCompatibilityAliases: parity([lte], [eq], "divergent") },
        { stateKey: "2", databaseRuleKey: "d2", currentRuleKey: "c2", withCompatibilityAliases: parity([], [gte], "divergent") },
    ] } as any;
    const boundary = (side: string, structuralSignature: string, candidate: string) => ({ stateKey: "1", databaseRuleKey: "d1", currentRuleKey: "c1", side, structuralSignature, reason: "turn_one_exact_boundary_candidate_unproven", candidateSignatures: [candidate] });
    const db16 = { contractVersion: "0.15.0", sourceDb15: { sha256: "db15" }, sourceDatabaseSha256: "database", sourceCurrentTeamAnalysis: { sha256: "current" }, semanticPromotionCount: 0, residualAttributions: [boundary("database", lte, eq), boundary("current", eq, lte), { stateKey: "2", databaseRuleKey: "d2", currentRuleKey: "c2", side: "current", structuralSignature: gte, reason: "current_turn_one_lower_bound_without_database_atom_unproven", candidateSignatures: [] }] } as any;
    const conclusions = ["appearance_turn_minimum_one", "gte_one_tautology", "lte_one_equals_eq_one"].map(kind => ({ kind, status: "confirmed_normal_lifecycle", precondition: "appearance_gate_true_and_normal_runtime_lifecycle" }));
    const db17 = { contractVersion: "0.16.0", generatedAt: "x", sourceDb16: { sha256: "db16" }, sourceDatabaseSha256: "database", sourceCurrentTeamAnalysis: { sha256: "current" }, semanticPromotionCount: 3, affectedRulePairCount: 2, affectedUnprovenAttributionCount: 3, conclusions } as any;
    return { db15, db16, db17 };
}

describe("database Team Analysis DB18 lifecycle compatibility", function () {
    it("resolves reciprocal lte/eq and current gte-one occurrences", () => { const { db15, db16, db17 } = fixture(); const dataset = buildDatabaseTeamAnalysisDb18Dataset({ db15, db15Sha256: "db15", db16, db16Sha256: "db16", db17, db17Sha256: "db17" }); equal(dataset.affectedRuleParity.length, 2); equal(dataset.affectedRuleParity.every(value => value.withLifecycleCompatibility.status === "exact"), true); const coverage = buildDatabaseTeamAnalysisDb18Coverage(dataset, db15); equal(coverage.exactPairDelta, 2); equal(coverage.resolvedDb16AttributionCount, 3); });
    it("rejects a DB17 artifact from another DB16 hash", () => { const { db15, db16, db17 } = fixture(); db17.sourceDb16.sha256 = "other"; throws(() => buildDatabaseTeamAnalysisDb18Dataset({ db15, db15Sha256: "db15", db16, db16Sha256: "db16", db17, db17Sha256: "db17" }), /source lineage mismatch/); });
    it("rejects an attributed occurrence absent from the residual multiset", () => { const { db15, db16, db17 } = fixture(); db15.ruleConditionParity[1].withCompatibilityAliases.currentOnlySignatures = []; throws(() => buildDatabaseTeamAnalysisDb18Dataset({ db15, db15Sha256: "db15", db16, db16Sha256: "db16", db17, db17Sha256: "db17" }), /current-only tautology attribution/); });
    it("rejects a gte-one occurrence outside a conjunctive branch", () => { const { db15, db16, db17 } = fixture(); const unsafe = sig("gte", "any"); db15.ruleConditionParity[1].withCompatibilityAliases.currentSignatures = [unsafe]; db15.ruleConditionParity[1].withCompatibilityAliases.currentOnlySignatures = [unsafe]; db16.residualAttributions[2].structuralSignature = unsafe; throws(() => buildDatabaseTeamAnalysisDb18Dataset({ db15, db15Sha256: "db15", db16, db16Sha256: "db16", db17, db17Sha256: "db17" }), /tautology signature shape mismatch/); });
});
