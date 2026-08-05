"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = require("assert");
const mocha_1 = require("mocha");
const team_analysis_db16_builder_1 = require("./team-analysis-db16-builder");
const sig = (comparator, value) => JSON.stringify({ comparator, kind: "turn_from_entry", logicalContext: "any", negated: false, scope: "self", value });
function fixture() {
    return { contractVersion: "0.14.0", generatedAt: "x", sourceSnapshotVersion: "snapshot", sourceDatabaseSha256: "database", sourceCurrentTeamAnalysis: { sha256: "current", parserVersion: "parser" }, comparisonUniverse: "runtime-types-43-51-55-plus-current-exact-turn", semanticPromotionCount: 0, ruleConditionParity: [
            { stateKey: "1", databaseRuleKey: "db-1", currentRuleKey: "current-1", withCompatibilityAliases: { databaseOnlySignatures: [sig("lte", 1)], currentOnlySignatures: [sig("eq", 1)] } },
            { stateKey: "2", databaseRuleKey: "db-2", currentRuleKey: "current-2", withCompatibilityAliases: { databaseOnlySignatures: [], currentOnlySignatures: [sig("gte", 1)] } },
        ] };
}
(0, mocha_1.describe)("database Team Analysis DB16 residual attribution", function () {
    (0, mocha_1.it)("keeps turn-one boundary patterns explicitly unproven", () => { const dataset = (0, team_analysis_db16_builder_1.buildDatabaseTeamAnalysisDb16Dataset)({ db15: fixture(), db15Sha256: "db15" }); const coverage = (0, team_analysis_db16_builder_1.buildDatabaseTeamAnalysisDb16Coverage)(dataset); (0, assert_1.equal)(dataset.residualAttributions.length, 3); (0, assert_1.equal)(dataset.residualAttributions.filter(value => value.reason === "turn_one_exact_boundary_candidate_unproven").length, 2); (0, assert_1.equal)(coverage.currentTurnOneLowerBoundCandidateRulePairCount, 1); (0, assert_1.equal)(coverage.semanticPromotionCount, 0); });
    (0, mocha_1.it)("rejects a promoted DB15 input", () => { const db15 = fixture(); db15.semanticPromotionCount = 1; (0, assert_1.throws)(() => (0, team_analysis_db16_builder_1.buildDatabaseTeamAnalysisDb16Dataset)({ db15, db15Sha256: "db15" }), /source contract mismatch/); });
});
//# sourceMappingURL=team-analysis-db16-builder.spec.js.map