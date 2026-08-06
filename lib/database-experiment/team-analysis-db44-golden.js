"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateDatabaseTeamAnalysisDb44Goldens = void 0;
const fs_1 = require("fs");
const promises_1 = require("fs/promises");
const path_1 = require("path");
const team_analysis_db44_builder_1 = require("./team-analysis-db44-builder");
const team_analysis_db44_validator_1 = require("./team-analysis-db44-validator");
async function validateDatabaseTeamAnalysisDb44Goldens(dataset, coverage) {
    const path = (0, fs_1.existsSync)((0, path_1.resolve)(__dirname, "team-analysis-db44-golden-fixtures.json")) ? (0, path_1.resolve)(__dirname, "team-analysis-db44-golden-fixtures.json") : (0, path_1.resolve)(__dirname, "..", "..", "database-experiment", "team-analysis-db44-golden-fixtures.json"), fixtures = JSON.parse(await (0, promises_1.readFile)(path, "utf8")), failures = [];
    for (const fixture of fixtures) {
        if (fixture.kind === "modifier") {
            const projected = (0, team_analysis_db44_builder_1.projectDb44Modifier)(fixture.efficacyType, fixture.value);
            if (JSON.stringify([projected.status, projected.stat, projected.runtimeModifierFloat32, projected.sourceColumn]) !== JSON.stringify([fixture.status, fixture.stat, fixture.float32, "eff_value1"]))
                failures.push({ fixture: fixture.name, issue: "synthetic modifier differs" });
            continue;
        }
        const projected = dataset.ruleProjections.find(value => value.stateKey === fixture.stateKey && value.ruleKey === fixture.ruleKey);
        if (!projected) {
            failures.push({ fixture: fixture.name, issue: "rule missing" });
            continue;
        }
        const actual = [projected.passiveSkillId, projected.efficacyType, projected.statModifier.stat, projected.statModifier.runtimeModifierFloat32, projected.calculationOperation.value, projected.calculationBucket.value], expected = [fixture.passiveSkillId, fixture.efficacyType, fixture.stat, fixture.modifier, fixture.operation, fixture.bucket];
        if (JSON.stringify(actual) !== JSON.stringify(expected))
            failures.push({ fixture: fixture.name, issue: "projection tuple differs" });
        if (projected.statModifier.sourceColumn !== "eff_value1" || projected.ignoredBehavioralParameters.status !== "not_read_by_handler" || !(0, team_analysis_db44_validator_1.hasDb44ConservativeBoundaries)(projected) || projected.operandUnit.status !== "partial")
            failures.push({ fixture: fixture.name, issue: "conservative boundary differs" });
    }
    const expected = { ruleCount: 33, sourceEffectCount: 33, statApplicationCount: 33, affectedStateCount: 25, passiveSkillCount: 31, supportedModifierRuleCount: 33, supportedBucketRuleCount: 33, supportedTargetRuleCount: 33, emptySubTargetIdentityRuleCount: 33, zeroIgnoredBehavioralParameterRuleCount: 33, countSemanticPartialRuleCount: 33, simulationPartialRuleCount: 33, simulationUnknownRuleCount: 0, legacyRepresentationGainRuleCount: 33, confirmedLegacyConflictCount: 0 };
    for (const [key, value] of Object.entries(expected))
        if (coverage[key] !== value)
            failures.push({ fixture: "coverage", issue: `${key} differs` });
    const distributions = { ruleCountsByEfficacyType: { "59": 22, "60": 11 }, ruleCountsByStat: { attack: 22, defense: 11 }, ruleCountsByTiming: { "1": 32, "4": 1 }, ruleCountsByCalculationOption: { "0": 4, "2": 28, "3": 1 }, ruleCountsByTurn: { "1": 28, "3": 1, "1000": 2, "2000": 2 }, ruleCountsByOnceOnly: { "0": 28, "1": 5 }, statApplicationsByStatAndBucket: { "attack|former_passive_stat": 21, "attack|latter_passive_stat": 1, "defense|former_passive_stat": 11 } };
    for (const [key, value] of Object.entries(distributions))
        if (JSON.stringify(coverage[key]) !== JSON.stringify(value))
            failures.push({ fixture: "coverage distributions", issue: `${key} differs` });
    if (dataset.ruleProjections.some(value => value.target.candidate.scope !== "self" || value.target.subTarget.filters.length !== 0 || !(0, team_analysis_db44_validator_1.hasDb44ConservativeBoundaries)(value)))
        failures.push({ fixture: "semantic boundaries", issue: "independent dimension was over-promoted" });
    return { schemaVersion: 1, fixtureCount: fixtures.length + 3, passed: fixtures.length + 3 - failures.length, failures };
}
exports.validateDatabaseTeamAnalysisDb44Goldens = validateDatabaseTeamAnalysisDb44Goldens;
//# sourceMappingURL=team-analysis-db44-golden.js.map