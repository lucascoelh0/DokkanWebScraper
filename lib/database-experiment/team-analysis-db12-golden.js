"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateDatabaseTeamAnalysisDb12Goldens = void 0;
const fs_1 = require("fs");
const promises_1 = require("fs/promises");
const path_1 = require("path");
async function validateDatabaseTeamAnalysisDb12Goldens(dataset, coverage) {
    const path = (0, fs_1.existsSync)((0, path_1.resolve)(__dirname, "team-analysis-db12-golden-fixtures.json")) ? (0, path_1.resolve)(__dirname, "team-analysis-db12-golden-fixtures.json") : (0, path_1.resolve)(__dirname, "..", "..", "database-experiment", "team-analysis-db12-golden-fixtures.json");
    const fixtures = JSON.parse(await (0, promises_1.readFile)(path, "utf8"));
    if (fixtures.schemaVersion !== 1)
        throw new Error("Unsupported DB12 golden contract");
    const failures = [];
    const check = (fixture, valid, issue) => { if (!valid)
        failures.push({ fixture, issue }); };
    check("database-only signature count", coverage.databaseOnlySignatureCount === fixtures.expectedCounts.databaseOnlySignatures, `expected ${fixtures.expectedCounts.databaseOnlySignatures}, got ${coverage.databaseOnlySignatureCount}`);
    check("current-only signature count", coverage.currentOnlySignatureCount === fixtures.expectedCounts.currentOnlySignatures, `expected ${fixtures.expectedCounts.currentOnlySignatures}, got ${coverage.currentOnlySignatureCount}`);
    check("exact structural match count", coverage.exactStructuralMatchCount === fixtures.expectedCounts.exactStructuralMatches, `expected ${fixtures.expectedCounts.exactStructuralMatches}, got ${coverage.exactStructuralMatchCount}`);
    check("exact-turn candidate", dataset.exactTurnEncodingCandidates.some(value => value.stateKey === fixtures.exactTurnCandidate.stateKey && value.value === fixtures.exactTurnCandidate.value && value.status === "candidate_not_rule_aligned" && value.databaseLowerSignature.includes('"comparator":"gte"') && value.databaseUpperSignature.includes('"comparator":"lte"') && value.currentExactSignatures.some(signature => signature.includes('"comparator":"eq"'))), "bounded conjunction or current exact atom missing");
    check("exact-turn candidate count", coverage.exactTurnEncodingCandidateCount === fixtures.expectedCounts.exactTurnEncodingCandidates, `expected ${fixtures.expectedCounts.exactTurnEncodingCandidates}, got ${coverage.exactTurnEncodingCandidateCount}`);
    check("database-only state", dataset.databaseOnlyStateKeys.includes(fixtures.databaseOnlyStateKey), `${fixtures.databaseOnlyStateKey} missing`);
    check("current-only state", dataset.currentOnlyStateKeys.includes(fixtures.currentOnlyStateKey), `${fixtures.currentOnlyStateKey} missing`);
    check("no semantic promotion", dataset.semanticPromotionCount === 0 && coverage.semanticPromotionCount === 0, "DB12 must remain diagnostic-only");
    const fixtureCount = 8;
    return { fixtureCount, passed: fixtureCount - failures.length, failures };
}
exports.validateDatabaseTeamAnalysisDb12Goldens = validateDatabaseTeamAnalysisDb12Goldens;
//# sourceMappingURL=team-analysis-db12-golden.js.map