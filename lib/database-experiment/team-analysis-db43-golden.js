"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateDatabaseTeamAnalysisDb43Goldens = void 0;
const promises_1 = require("fs/promises");
const fs_1 = require("fs");
const path_1 = require("path");
const team_analysis_db43_builder_1 = require("./team-analysis-db43-builder");
async function validateDatabaseTeamAnalysisDb43Goldens(dataset, coverage) {
    const path = (0, fs_1.existsSync)((0, path_1.resolve)(__dirname, "team-analysis-db43-golden-fixtures.json")) ? (0, path_1.resolve)(__dirname, "team-analysis-db43-golden-fixtures.json") : (0, path_1.resolve)(__dirname, "..", "..", "database-experiment", "team-analysis-db43-golden-fixtures.json"), fixtures = JSON.parse(await (0, promises_1.readFile)(path, "utf8")), failures = [];
    for (const fixture of fixtures) {
        const value = dataset.resolutions.find(row => row.stateKey === fixture.stateKey && row.ruleKey === fixture.ruleKey), issues = [];
        if (!value)
            issues.push("resolution missing");
        else {
            const actual = [value.passiveSkillId, value.effect.declaredCalculationOperation, value.executionTiming.value.status, value.executionTiming.value.event, value.lifecycle.duration.rawTurn, value.lifecycle.onceOnly.rawIsOnce, value.legacyComparison.currentState], expected = [fixture.passiveSkillId, fixture.operation, fixture.timingStatus, fixture.timingEvent, fixture.turn, fixture.isOnce, fixture.currentState];
            if (JSON.stringify(actual) !== JSON.stringify(expected))
                issues.push("projection tuple differs");
            if (value.effect.kind !== "disable_normal_element_affinity_guard" || value.effect.behavioralParameters.status !== "not_read_by_guard_decision" || value.effect.nativeFormula !== "defender_has_efficacy_78 || (!defender_has_efficacy_24 && !independent_raw_attacker_override && !independent_player_mode_override && element_affinity_result_eq_1)" || value.effect.normalAffinityGuardWhenPresent !== "disabled_unless_independent_efficacy_78_override" || value.calculation.consumerPhase !== "guard_resolution_before_element_coefficient" || value.calculation.calculationBucket !== "unknown")
                issues.push("semantic boundary differs");
        }
        if (issues.length > 0)
            failures.push({ fixture: fixture.name, issue: issues.join(", ") });
    }
    if (!(0, team_analysis_db43_builder_1.evaluateDb43GuardDecision)({ elementAffinityResultEq1: false, defenderHasEfficacy24: true, independentRawAttackerOverride: false, defenderHasEfficacy78: true, independentPlayerModeOverride: false }))
        failures.push({ fixture: "efficacy-78 override", issue: "independent override must force guard" });
    const expectedCoverage = { sourceGapRuleCount: 34, resolutionCount: 34, affectedStateCount: 34, affectedPassiveSkillCount: 34, supportedEffectCount: 34, partialResolutionCount: 34, zeroBehavioralValueRuleCount: 34, supportedTargetCount: 34, emptySubTargetIdentityCount: 34, supportedTimingCount: 33, unknownTimingCount: 1, currentStatePresentCount: 33, currentStateMissingCount: 1, directlyComparableRuleCount: 0, confirmedLegacyConflictCount: 0, representationGainRuleCount: 34 };
    for (const [key, expected] of Object.entries(expectedCoverage))
        if (coverage[key] !== expected)
            failures.push({ fixture: "coverage", issue: `${key} differs` });
    return { schemaVersion: 1, fixtureCount: fixtures.length + 2, passed: fixtures.length + 2 - failures.length, failures };
}
exports.validateDatabaseTeamAnalysisDb43Goldens = validateDatabaseTeamAnalysisDb43Goldens;
//# sourceMappingURL=team-analysis-db43-golden.js.map