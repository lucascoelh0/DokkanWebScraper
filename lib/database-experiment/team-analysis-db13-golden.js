"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateDatabaseTeamAnalysisDb13Goldens = void 0;
const fs_1 = require("fs");
const promises_1 = require("fs/promises");
const path_1 = require("path");
async function validateDatabaseTeamAnalysisDb13Goldens(dataset, coverage) {
    const path = (0, fs_1.existsSync)((0, path_1.resolve)(__dirname, "team-analysis-db13-golden-fixtures.json")) ? (0, path_1.resolve)(__dirname, "team-analysis-db13-golden-fixtures.json") : (0, path_1.resolve)(__dirname, "..", "..", "database-experiment", "team-analysis-db13-golden-fixtures.json");
    const fixtures = JSON.parse(await (0, promises_1.readFile)(path, "utf8"));
    if (fixtures.schemaVersion !== 1)
        throw new Error("Unsupported DB13 golden contract");
    const failures = [];
    const check = (fixture, valid, issue) => { if (!valid)
        failures.push({ fixture, issue }); };
    check("rule alignment count", coverage.ruleAlignmentCount === fixtures.expectedCounts.ruleAlignments, `expected ${fixtures.expectedCounts.ruleAlignments}, got ${coverage.ruleAlignmentCount}`);
    check("exact effect sets", coverage.ruleAlignmentCountsByKind.exact_effect_set_unique === fixtures.expectedCounts.exactEffectSets, `expected ${fixtures.expectedCounts.exactEffectSets}, got ${coverage.ruleAlignmentCountsByKind.exact_effect_set_unique}`);
    check("unique effect anchors", coverage.ruleAlignmentCountsByKind.unique_effect_signature_anchor === fixtures.expectedCounts.uniqueEffectAnchors, `expected ${fixtures.expectedCounts.uniqueEffectAnchors}, got ${coverage.ruleAlignmentCountsByKind.unique_effect_signature_anchor}`);
    check("aligned exact turns", coverage.exactTurnRuleAlignedCount === fixtures.expectedCounts.alignedExactTurnCandidates, `expected ${fixtures.expectedCounts.alignedExactTurnCandidates}, got ${coverage.exactTurnRuleAlignedCount}`);
    check("unaligned exact turns", coverage.exactTurnRuleUnalignedCount === fixtures.expectedCounts.unalignedExactTurnCandidates, `expected ${fixtures.expectedCounts.unalignedExactTurnCandidates}, got ${coverage.exactTurnRuleUnalignedCount}`);
    const find = (fixture) => dataset.exactTurnRuleAssessments.find(value => value.stateKey === fixture.stateKey && value.value === fixture.value && value.databaseRuleKey === fixture.databaseRuleKey);
    check("aligned example", find(fixtures.aligned)?.status === "rule_aligned_unique_effect_shape", "aligned Catopesra candidate missing");
    check("unaligned example", find(fixtures.unaligned)?.status === "rule_unaligned", "unaligned Catopesra candidate missing");
    check("no semantic promotion", dataset.semanticPromotionCount === 0 && coverage.semanticPromotionCount === 0, "DB13 must remain diagnostic-only");
    const fixtureCount = 8;
    return { fixtureCount, passed: fixtureCount - failures.length, failures };
}
exports.validateDatabaseTeamAnalysisDb13Goldens = validateDatabaseTeamAnalysisDb13Goldens;
//# sourceMappingURL=team-analysis-db13-golden.js.map