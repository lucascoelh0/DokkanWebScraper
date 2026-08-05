"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateDatabaseTeamAnalysisDb15Goldens = void 0;
const fs_1 = require("fs");
const promises_1 = require("fs/promises");
const path_1 = require("path");
async function validateDatabaseTeamAnalysisDb15Goldens(dataset, coverage) {
    const path = (0, fs_1.existsSync)((0, path_1.resolve)(__dirname, "team-analysis-db15-golden-fixtures.json")) ? (0, path_1.resolve)(__dirname, "team-analysis-db15-golden-fixtures.json") : (0, path_1.resolve)(__dirname, "..", "..", "database-experiment", "team-analysis-db15-golden-fixtures.json");
    const fixtures = JSON.parse(await (0, promises_1.readFile)(path, "utf8"));
    if (fixtures.schemaVersion !== 1)
        throw new Error("Unsupported DB15 golden contract");
    const failures = [];
    const check = (fixture, valid, issue) => { if (!valid)
        failures.push({ fixture, issue }); };
    const find = (fixture) => dataset.ruleConditionParity.find(value => value.stateKey === fixture.stateKey && value.databaseRuleKey === fixture.databaseRuleKey && value.currentRuleKey === fixture.currentRuleKey);
    const exact = find(fixtures.exactPair);
    const residual = find(fixtures.residualPair);
    check("alias count", coverage.appliedCompatibilityAliasCount === fixtures.expectedAppliedAliasCount, `expected ${fixtures.expectedAppliedAliasCount}, got ${coverage.appliedCompatibilityAliasCount}`);
    check("resolved native signatures", coverage.resolvedNativeSignatureOccurrenceCount === fixtures.expectedResolvedNativeSignatureCount, `expected ${fixtures.expectedResolvedNativeSignatureCount}, got ${coverage.resolvedNativeSignatureOccurrenceCount}`);
    check("exact pair", Boolean(exact), "exact Catopesra pair missing");
    check("exact pair aliases", exact?.appliedCompatibilityAliases.length === fixtures.exactPair.expectedAliasCount, "exact Catopesra alias count differs");
    check("exact pair status", exact?.withCompatibilityAliases.status === fixtures.exactPair.expectedStatus, `expected ${fixtures.exactPair.expectedStatus}, got ${exact?.withCompatibilityAliases.status}`);
    check("residual pair", Boolean(residual), "residual Catopesra pair missing");
    check("residual pair aliases", residual?.appliedCompatibilityAliases.length === fixtures.residualPair.expectedAliasCount, "residual Catopesra alias count differs");
    check("residual pair counts", residual?.withCompatibilityAliases.databaseOnlySignatures.length === fixtures.residualPair.expectedDatabaseOnlyCount && residual?.withCompatibilityAliases.currentOnlySignatures.length === fixtures.residualPair.expectedCurrentOnlyCount, "residual Catopesra divergence counts differ");
    check("no semantic promotion", dataset.semanticPromotionCount === 0 && coverage.semanticPromotionCount === 0, "DB15 must remain diagnostic");
    const fixtureCount = 9;
    return { fixtureCount, passed: fixtureCount - failures.length, failures };
}
exports.validateDatabaseTeamAnalysisDb15Goldens = validateDatabaseTeamAnalysisDb15Goldens;
//# sourceMappingURL=team-analysis-db15-golden.js.map