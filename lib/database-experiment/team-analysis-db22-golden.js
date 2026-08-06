"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateDatabaseTeamAnalysisDb22Goldens = void 0;
const fs_1 = require("fs");
const promises_1 = require("fs/promises");
const path_1 = require("path");
async function validateDatabaseTeamAnalysisDb22Goldens(dataset, coverage) {
    const path = (0, fs_1.existsSync)((0, path_1.resolve)(__dirname, "team-analysis-db22-golden-fixtures.json")) ? (0, path_1.resolve)(__dirname, "team-analysis-db22-golden-fixtures.json") : (0, path_1.resolve)(__dirname, "..", "..", "database-experiment", "team-analysis-db22-golden-fixtures.json");
    const f = JSON.parse(await (0, promises_1.readFile)(path, "utf8"));
    const failures = [];
    const check = (fixture, valid) => { if (!valid)
        failures.push({ fixture, issue: "value differs" }); };
    check("pairs", coverage.comparableRulePairCount === f.expectedComparablePairs && coverage.affectedRulePairCount === f.expectedAffectedPairs && coverage.parityChangedRulePairCount === f.expectedParityChangedPairs);
    check("raw projection", coverage.rawCurrentProjectionValidatedRulePairCount === f.expectedComparablePairs);
    check("tautologies", coverage.removedTurnOneTautologyOccurrenceCount === f.expectedRemovedTautologies && coverage.additionalRemovedTautologyOccurrenceCountOverDb18 === f.expectedAdditionalRemovedOverDb18);
    check("before counts", JSON.stringify(coverage.beforePairCounts) === JSON.stringify(f.expectedBeforeCounts));
    check("after counts", JSON.stringify(coverage.normalizedPairCounts) === JSON.stringify(f.expectedAfterCounts));
    check("residuals", coverage.normalizedDatabaseOnlySignatureOccurrenceCount === f.expectedDatabaseResiduals && coverage.normalizedCurrentOnlySignatureOccurrenceCount === f.expectedCurrentResiduals);
    check("applications", dataset.affectedRuleParity.every(value => value.removedTurnOneTautologyCount > 0 && value.structuralNormalization === "recursive_boolean_identity_after_confirmed_tautology" && value.provenance.currentTeamAnalysisRuleId === value.currentRuleKey));
    check("no promotion", dataset.inheritedSemanticPromotionCount === 3 && dataset.semanticPromotionCount === 0);
    return { fixtureCount: 8, passed: 8 - failures.length, failures };
}
exports.validateDatabaseTeamAnalysisDb22Goldens = validateDatabaseTeamAnalysisDb22Goldens;
//# sourceMappingURL=team-analysis-db22-golden.js.map