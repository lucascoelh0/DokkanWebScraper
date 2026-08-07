"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateDatabaseTeamAnalysisDb48Goldens = void 0;
const fs_1 = require("fs");
const promises_1 = require("fs/promises");
const path_1 = require("path");
const team_analysis_db48_builder_1 = require("./team-analysis-db48-builder");
async function validateDatabaseTeamAnalysisDb48Goldens(dataset, coverage) {
    const path = (0, fs_1.existsSync)((0, path_1.resolve)(__dirname, "team-analysis-db48-golden-fixtures.json")) ? (0, path_1.resolve)(__dirname, "team-analysis-db48-golden-fixtures.json") : (0, path_1.resolve)(__dirname, "..", "..", "database-experiment", "team-analysis-db48-golden-fixtures.json"), fixtures = JSON.parse(await (0, promises_1.readFile)(path, "utf8")), failures = [];
    const synthetic = [
        ["positive", JSON.stringify((0, team_analysis_db48_builder_1.projectDb48DamageRate)(70)) === JSON.stringify({ status: "supported", sourceColumn: "eff_value1", rawRemainingDamageRatePercentPoints: 70, runtimeRemainingDamageRateFloat32: 70, reductionContributionPercentPoints: 30, conversion: "double_to_float32_then_widened_to_double" })],
        ["zero", (0, team_analysis_db48_builder_1.projectDb48DamageRate)(0).reductionContributionPercentPoints === 100],
        ["negative", (0, team_analysis_db48_builder_1.projectDb48DamageRate)(-5).reductionContributionPercentPoints === 105],
        ["float32", (0, team_analysis_db48_builder_1.projectDb48DamageRate)(33.3).runtimeRemainingDamageRateFloat32 === Math.fround(33.3)],
        ["invalid", (0, team_analysis_db48_builder_1.projectDb48DamageRate)("bad").status === "unknown" && (0, team_analysis_db48_builder_1.projectDb48DamageRate)(null).status === "unknown"],
        ["aggregate", (0, team_analysis_db48_builder_1.aggregateDb48RemainingRate)([70, 80]) === 50 && (0, team_analysis_db48_builder_1.aggregateDb48RemainingRate)([5, 5]) === 0 && (0, team_analysis_db48_builder_1.aggregateDb48RemainingRate)([110]) === 100 && (0, team_analysis_db48_builder_1.aggregateDb48RemainingRate)([70, "bad"]) === null],
        ["rounding", (0, team_analysis_db48_builder_1.applyDb48PlayerSourceRate)(1, 50) === 0 && (0, team_analysis_db48_builder_1.applyDb48EnemySourceRate)(1, 50) === 1],
    ];
    for (const [name, ok] of synthetic)
        if (!ok)
            failures.push({ fixture: name, issue: "synthetic native arithmetic differs" });
    for (const fixture of fixtures) {
        const rule = dataset.ruleProjections.find(value => value.stateKey === fixture.stateKey && value.ruleKey === fixture.ruleKey);
        if (!rule) {
            failures.push({ fixture: fixture.name, issue: "rule missing" });
            continue;
        }
        const actual = [rule.passiveSkillId, rule.damageRateInput.runtimeRemainingDamageRateFloat32, rule.damageRateInput.reductionContributionPercentPoints, rule.target.candidate.scope, rule.rawExecutionTimingType, rule.ignoredHandlerParameters.rawCalculationOption, rule.legacyProjectorComparison.status], expected = [fixture.passiveSkillId, fixture.remainingRate, fixture.reduction, fixture.target, fixture.timing, fixture.calcOption, "representation_matches_native_projection"];
        if (JSON.stringify(actual) !== JSON.stringify(expected))
            failures.push({ fixture: fixture.name, issue: "projection tuple differs" });
    }
    const expected = { sqliteRowCount: 1538, projectedUniqueSqliteRowCount: 951, unprojectedSqliteRowCount: 587, ruleCount: 995, sourceEffectCount: 995, passiveSkillCount: 951, affectedStateCount: 432, supportedInputRuleCount: 995, supportedTargetRuleCount: 995, supportedTimingRuleCount: 946, unknownTimingRuleCount: 49, onceOnlyEnabledRuleCount: 194, legacyRepresentationMatchCount: 995, legacyRepresentationConflictCount: 0, simulationPartialRuleCount: 995, simulationUnknownRuleCount: 0 };
    for (const [k, v] of Object.entries(expected))
        if (coverage[k] !== v)
            failures.push({ fixture: "coverage", issue: `${k} differs` });
    if (dataset.ruleProjections.some(value => value.consumers.attackKind.status !== "unknown" || value.consumers.finalHpApplication.status !== "unknown" || value.lifecycle.probabilityApplication !== "unknown" || value.ignoredHandlerParameters.status !== "preserved_not_read_by_type_13_handler"))
        failures.push({ fixture: "conservative boundaries", issue: "independent unknown promoted" });
    const fixtureCount = synthetic.length + fixtures.length + 2;
    return { schemaVersion: 1, fixtureCount, passed: fixtureCount - failures.length, failures };
}
exports.validateDatabaseTeamAnalysisDb48Goldens = validateDatabaseTeamAnalysisDb48Goldens;
//# sourceMappingURL=team-analysis-db48-golden.js.map