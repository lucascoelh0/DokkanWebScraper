"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateDatabaseTeamAnalysisDb14Goldens = void 0;
const fs_1 = require("fs");
const promises_1 = require("fs/promises");
const path_1 = require("path");
async function validateDatabaseTeamAnalysisDb14Goldens(dataset, coverage) {
    const path = (0, fs_1.existsSync)((0, path_1.resolve)(__dirname, "team-analysis-db14-golden-fixtures.json")) ? (0, path_1.resolve)(__dirname, "team-analysis-db14-golden-fixtures.json") : (0, path_1.resolve)(__dirname, "..", "..", "database-experiment", "team-analysis-db14-golden-fixtures.json");
    const fixtures = JSON.parse(await (0, promises_1.readFile)(path, "utf8"));
    if (fixtures.schemaVersion !== 1)
        throw new Error("Unsupported DB14 golden contract");
    const failures = [];
    const check = (fixture, valid, issue) => { if (!valid)
        failures.push({ fixture, issue }); };
    check("alias count", coverage.compatibilityAliasCount === fixtures.expectedAliasCount, `expected ${fixtures.expectedAliasCount}, got ${coverage.compatibilityAliasCount}`);
    check("alias values", JSON.stringify(coverage.compatibilityAliasValues) === JSON.stringify(fixtures.expectedValues), `expected ${fixtures.expectedValues}, got ${coverage.compatibilityAliasValues}`);
    const sample = dataset.exactTurnCompatibilityAliases.find(value => value.stateKey === fixtures.sample.stateKey && value.value === fixtures.sample.value && value.databaseRuleKey === fixtures.sample.databaseRuleKey && value.currentRuleKey === fixtures.sample.currentRuleKey);
    check("sample alias", Boolean(sample), "sample alias missing");
    check("sample native bounds", sample?.nativeBounds.lower.causalityId === fixtures.sample.lowerCausalityId && sample?.nativeBounds.upper.causalityId === fixtures.sample.upperCausalityId, "sample native bound IDs differ");
    check("current signature matches", coverage.currentExactSignatureMatchCount === coverage.compatibilityAliasCount, "not every alias matches a current exact signature");
    check("unaligned skipped", coverage.skippedUnalignedCount === 9, `expected 9, got ${coverage.skippedUnalignedCount}`);
    check("ambiguous skipped", coverage.skippedAmbiguousCount === 0, `expected 0, got ${coverage.skippedAmbiguousCount}`);
    check("no semantic promotion", dataset.semanticPromotionCount === 0 && coverage.semanticPromotionCount === 0, "DB14 must remain compatibility-only");
    const fixtureCount = 8;
    return { fixtureCount, passed: fixtureCount - failures.length, failures };
}
exports.validateDatabaseTeamAnalysisDb14Goldens = validateDatabaseTeamAnalysisDb14Goldens;
//# sourceMappingURL=team-analysis-db14-golden.js.map