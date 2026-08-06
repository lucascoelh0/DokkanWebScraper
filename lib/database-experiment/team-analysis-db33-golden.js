"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateDatabaseTeamAnalysisDb33Goldens = void 0;
const promises_1 = require("fs/promises");
const path_1 = require("path");
const team_analysis_db33_builder_1 = require("./team-analysis-db33-builder");
async function validateDatabaseTeamAnalysisDb33Goldens(dataset, coverage) {
    const fixtures = JSON.parse(await (0, promises_1.readFile)((0, path_1.resolve)(__dirname, "team-analysis-db33-golden-fixtures.json"), "utf8"));
    const failures = [];
    for (const fixture of fixtures) {
        const projected = (0, team_analysis_db33_builder_1.projectDb33AttackSetupTiming)(fixture.raw);
        const actual = projected.status === "supported" ? projected.event : fixture.raw === 1 ? "not_newly_promoted" : "unknown";
        if (actual !== fixture.expected)
            failures.push(`${fixture.id}: ${actual}`);
    }
    if (coverage.newlySupportedRuleCount !== 1830 || coverage.newlySupportedEffectCount !== 2497 || coverage.newlySupportedPassiveSkillCount !== 1787 || coverage.newlySupportedStateCount !== 827)
        failures.push("snapshot attack-setup coverage");
    if (coverage.supportedRuleCount !== 10891 || coverage.unknownRuleCount !== 3410)
        failures.push("combined support coverage");
    if (dataset.ruleTimings.some(rule => rule.executionTiming.status === "supported" && rule.executionTiming.event === "player_attack_setup" && Object.values(rule.independentDimensions).some(value => value !== "unknown")))
        failures.push("independent dimensions");
    return { schemaVersion: 1, fixtureCount: fixtures.length + 3, passed: fixtures.length + 3 - failures.length, failures };
}
exports.validateDatabaseTeamAnalysisDb33Goldens = validateDatabaseTeamAnalysisDb33Goldens;
//# sourceMappingURL=team-analysis-db33-golden.js.map