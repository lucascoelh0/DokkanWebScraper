"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateDatabaseTeamAnalysisDb17Goldens = void 0;
const fs_1 = require("fs");
const promises_1 = require("fs/promises");
const path_1 = require("path");
async function validateDatabaseTeamAnalysisDb17Goldens(dataset, coverage) { const path = (0, fs_1.existsSync)((0, path_1.resolve)(__dirname, "team-analysis-db17-golden-fixtures.json")) ? (0, path_1.resolve)(__dirname, "team-analysis-db17-golden-fixtures.json") : (0, path_1.resolve)(__dirname, "..", "..", "database-experiment", "team-analysis-db17-golden-fixtures.json"); const f = JSON.parse(await (0, promises_1.readFile)(path, "utf8")); const failures = []; const check = (fixture, valid) => { if (!valid)
    failures.push({ fixture, issue: "value differs" }); }; check("symbols", coverage.verifiedSymbolCount === f.expectedVerifiedSymbols); check("conclusions", coverage.conclusionCount === f.expectedConclusions); check("exact boundary", coverage.affectedTurnOneExactBoundaryAttributionCount === f.expectedExactBoundaryAttributions); check("lower bound", coverage.affectedCurrentLowerBoundAttributionCount === f.expectedLowerBoundAttributions); check("pairs", coverage.affectedRulePairCount === f.expectedAffectedPairs); check("promotion", dataset.semanticPromotionCount === 3); check("preconditions", dataset.conclusions.every(value => value.precondition === "appearance_gate_true_and_normal_runtime_lifecycle")); check("limitation", dataset.conclusions.every(value => value.limitation.length > 0)); return { fixtureCount: 8, passed: 8 - failures.length, failures }; }
exports.validateDatabaseTeamAnalysisDb17Goldens = validateDatabaseTeamAnalysisDb17Goldens;
//# sourceMappingURL=team-analysis-db17-golden.js.map