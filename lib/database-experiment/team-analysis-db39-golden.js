"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateDatabaseTeamAnalysisDb39Goldens = void 0;
const promises_1 = require("fs/promises");
const path_1 = require("path");
const team_analysis_db39_builder_1 = require("./team-analysis-db39-builder");
async function validateDatabaseTeamAnalysisDb39Goldens(dataset, coverage) {
    const fixtures = JSON.parse(await (0, promises_1.readFile)((0, path_1.resolve)(__dirname, "team-analysis-db39-golden-fixtures.json"), "utf8")), failures = [];
    for (const fixture of fixtures) {
        if (fixture.kind === "scale" && (0, team_analysis_db39_builder_1.scaleDb39Modifier)(fixture.modifier, fixture.count) !== fixture.result)
            failures.push(fixture.id);
        if (fixture.kind === "modifier") {
            const projected = (0, team_analysis_db39_builder_1.projectDb39Modifier)(fixture.stat, fixture.value);
            if (projected.status !== fixture.status || projected.runtimeModifierFloat32 !== fixture.float32)
                failures.push(fixture.id);
        }
        if (fixture.kind === "bucket" && JSON.stringify((0, team_analysis_db39_builder_1.projectDb39Bucket)(fixture.timing)) !== JSON.stringify(fixture.result))
            failures.push(fixture.id);
        if (fixture.kind === "unit") {
            const projected = (0, team_analysis_db39_builder_1.db39OperandUnit)(fixture.operation);
            if (projected.value !== fixture.value || projected.status !== "partial")
                failures.push(fixture.id);
        }
    }
    if (coverage.ruleCount !== 89 || coverage.sourceEffectCount !== 89 || coverage.statApplicationCount !== 178 || coverage.affectedStateCount !== 56 || coverage.passiveSkillCount !== 87 || coverage.supportedModifierRuleCount !== 89 || coverage.supportedBucketRuleCount !== 89 || coverage.countSemanticPartialRuleCount !== 89 || coverage.simulationPartialRuleCount !== 89 || coverage.simulationUnknownRuleCount !== 0 || coverage.legacyRepresentationGainRuleCount !== 89 || coverage.confirmedLegacyConflictCount !== 0)
        failures.push("snapshot population");
    if (JSON.stringify(coverage.ruleCountsByTiming) !== JSON.stringify({ "1": 87, "4": 2 }) || JSON.stringify(coverage.ruleCountsByCalculationOption) !== JSON.stringify({ "0": 2, "2": 87 }) || JSON.stringify(coverage.ruleCountsByTarget) !== JSON.stringify({ "1": 88, "2": 1 }) || JSON.stringify(coverage.statApplicationsByStatAndBucket) !== JSON.stringify({ "attack|former_passive_stat": 87, "attack|latter_passive_stat": 2, "defense|former_passive_stat": 87, "defense|latter_passive_stat": 2 }))
        failures.push("snapshot distributions");
    if (dataset.ruleProjections.some(rule => rule.countInput.semanticName !== "unknown" || rule.operandUnit.status !== "partial" || rule.independentDimensions.timing !== "independent" || rule.independentDimensions.recurrence !== "partial" || rule.independentDimensions.reset !== "unknown"))
        failures.push("conservative boundary");
    return { schemaVersion: 1, fixtureCount: fixtures.length + 3, passed: fixtures.length + 3 - failures.length, failures };
}
exports.validateDatabaseTeamAnalysisDb39Goldens = validateDatabaseTeamAnalysisDb39Goldens;
//# sourceMappingURL=team-analysis-db39-golden.js.map