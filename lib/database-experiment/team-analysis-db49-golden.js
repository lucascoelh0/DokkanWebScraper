"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateDatabaseTeamAnalysisDb49Goldens = void 0;
const fs_1 = require("fs");
const promises_1 = require("fs/promises");
const path_1 = require("path");
const team_analysis_db49_builder_1 = require("./team-analysis-db49-builder");
async function validateDatabaseTeamAnalysisDb49Goldens(dataset, coverage) {
    const path = (0, fs_1.existsSync)((0, path_1.resolve)(__dirname, "team-analysis-db49-golden-fixtures.json")) ? (0, path_1.resolve)(__dirname, "team-analysis-db49-golden-fixtures.json") : (0, path_1.resolve)(__dirname, "..", "..", "database-experiment", "team-analysis-db49-golden-fixtures.json"), fixtures = JSON.parse(await (0, promises_1.readFile)(path, "utf8")), failures = [];
    const decide = (overrides) => (0, team_analysis_db49_builder_1.evaluateDb49GuardDecision)({ elementAffinityResultEq1: false, defenderHasEfficacy24: false, independentRawAttackerOverride: false, defenderHasEfficacy78: false, independentPlayerModeOverride: false, ...overrides });
    const synthetic = [
        ["forced positive", decide({ defenderHasEfficacy78: true, defenderHasEfficacy24: true, independentRawAttackerOverride: true, independentPlayerModeOverride: true }) === true],
        ["normal positive", decide({ elementAffinityResultEq1: true }) === true],
        ["guard disabled", decide({ elementAffinityResultEq1: true, defenderHasEfficacy24: true }) === false],
        ["negative", decide({}) === false],
        ["zero damage", (0, team_analysis_db49_builder_1.applyDb49GuardCoefficient)(0, true) === 0],
        ["positive truncation", (0, team_analysis_db49_builder_1.applyDb49GuardCoefficient)(3, true) === 1],
        ["negative truncation", (0, team_analysis_db49_builder_1.applyDb49GuardCoefficient)(-3, true) === -1],
        ["guard false", (0, team_analysis_db49_builder_1.applyDb49GuardCoefficient)(3, false) === 3]
    ];
    for (const [name, ok] of synthetic)
        if (!ok)
            failures.push({ fixture: name, issue: "native guard formula differs" });
    for (const fixture of fixtures) {
        const rule = dataset.ruleProjections.find(value => value.stateKey === fixture.stateKey && value.ruleKey === fixture.ruleKey);
        if (!rule) {
            failures.push({ fixture: fixture.name, issue: "rule missing" });
            continue;
        }
        const actual = [rule.passiveSkillId, rule.effect.kind, rule.effect.guardCoefficient, rule.target.candidate.scope, rule.executionTiming.status === "supported" ? rule.executionTiming.event : "unknown", rule.effect.handlerParameters.rawCalculationOption, rule.legacyProjectorComparison.status], expected = [fixture.passiveSkillId, "force_guard", 0.5, fixture.target, fixture.timing, fixture.calcOption, "representation_matches_native_projection"];
        if (JSON.stringify(actual) !== JSON.stringify(expected))
            failures.push({ fixture: fixture.name, issue: "projection tuple differs" });
    }
    const expected = { sqliteRowCount: 485, projectedUniqueSqliteRowCount: 296, unprojectedSqliteRowCount: 189, ruleCount: 305, sourceEffectCount: 305, passiveSkillCount: 296, affectedStateCount: 267, supportedEffectCount: 305, supportedTargetCount: 305, supportedTimingCount: 281, unknownTimingCount: 24, onceOnlyEnabledCount: 62, legacyRepresentationMatchCount: 305, legacyRepresentationConflictCount: 0, simulationPartialCount: 305 };
    for (const [k, v] of Object.entries(expected))
        if (coverage[k] !== v)
            failures.push({ fixture: "coverage", issue: `${k} differs` });
    if (dataset.ruleProjections.some(value => value.consumers.independentType78ElementCoefficientInput.status !== "unknown" || value.consumers.attackKind.status !== "unknown" || value.consumers.finalHpApplication.status !== "unknown" || value.lifecycle.probabilityApplication !== "unknown"))
        failures.push({ fixture: "conservative boundaries", issue: "independent unknown promoted" });
    const fixtureCount = synthetic.length + fixtures.length + 2;
    return { schemaVersion: 1, fixtureCount, passed: fixtureCount - failures.length, failures };
}
exports.validateDatabaseTeamAnalysisDb49Goldens = validateDatabaseTeamAnalysisDb49Goldens;
//# sourceMappingURL=team-analysis-db49-golden.js.map