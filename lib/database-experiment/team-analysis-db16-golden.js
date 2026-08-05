"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateDatabaseTeamAnalysisDb16Goldens = void 0;
const fs_1 = require("fs");
const promises_1 = require("fs/promises");
const path_1 = require("path");
async function validateDatabaseTeamAnalysisDb16Goldens(dataset, coverage) {
    const path = (0, fs_1.existsSync)((0, path_1.resolve)(__dirname, "team-analysis-db16-golden-fixtures.json")) ? (0, path_1.resolve)(__dirname, "team-analysis-db16-golden-fixtures.json") : (0, path_1.resolve)(__dirname, "..", "..", "database-experiment", "team-analysis-db16-golden-fixtures.json");
    const fixtures = JSON.parse(await (0, promises_1.readFile)(path, "utf8"));
    if (fixtures.schemaVersion !== 1)
        throw new Error("Unsupported DB16 golden contract");
    const failures = [];
    const check = (fixture, valid, issue) => { if (!valid)
        failures.push({ fixture, issue }); };
    const pair = dataset.residualAttributions.filter(value => value.stateKey === fixtures.turnOnePair.stateKey && value.databaseRuleKey === fixtures.turnOnePair.databaseRuleKey && value.currentRuleKey === fixtures.turnOnePair.currentRuleKey && JSON.parse(value.structuralSignature).value === fixtures.turnOnePair.value);
    check("residual count", coverage.residualAttributionCount === fixtures.expectedResidualAttributionCount, `expected ${fixtures.expectedResidualAttributionCount}, got ${coverage.residualAttributionCount}`);
    check("source reconciliation", coverage.databaseResidualCount + coverage.currentResidualCount === coverage.residualAttributionCount, "side counts do not reconcile");
    check("turn-one database", pair.some(value => value.side === "database" && JSON.parse(value.structuralSignature).comparator === fixtures.turnOnePair.databaseComparator && value.reason === "turn_one_exact_boundary_candidate_unproven"), "turn-one database candidate missing");
    check("turn-one current", pair.some(value => value.side === "current" && JSON.parse(value.structuralSignature).comparator === fixtures.turnOnePair.currentComparator && value.reason === "turn_one_exact_boundary_candidate_unproven"), "turn-one current candidate missing");
    check("turn-one pair coverage", coverage.turnOneExactBoundaryCandidateRulePairCount > 0, "turn-one candidate pair not counted");
    check("lower-bound candidates", coverage.currentTurnOneLowerBoundCandidateRulePairCount > 0, "current gte 1 candidate pattern missing");
    check("unproven candidates", coverage.unprovenCandidateAttributionCount > 0, "unproven candidate count missing");
    check("no semantic promotion", dataset.semanticPromotionCount === 0 && coverage.semanticPromotionCount === 0, "DB16 must remain diagnostic");
    const fixtureCount = 8;
    return { fixtureCount, passed: fixtureCount - failures.length, failures };
}
exports.validateDatabaseTeamAnalysisDb16Goldens = validateDatabaseTeamAnalysisDb16Goldens;
//# sourceMappingURL=team-analysis-db16-golden.js.map