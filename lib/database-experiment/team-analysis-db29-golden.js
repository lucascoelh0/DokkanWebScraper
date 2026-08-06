"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateDatabaseTeamAnalysisDb29Goldens = void 0;
const fs_1 = require("fs");
const promises_1 = require("fs/promises");
const path_1 = require("path");
async function validateDatabaseTeamAnalysisDb29Goldens(dataset, coverage) {
    const path = (0, fs_1.existsSync)((0, path_1.resolve)(__dirname, "team-analysis-db29-golden-fixtures.json")) ? (0, path_1.resolve)(__dirname, "team-analysis-db29-golden-fixtures.json") : (0, path_1.resolve)(__dirname, "..", "..", "database-experiment", "team-analysis-db29-golden-fixtures.json");
    const fixtures = JSON.parse(await (0, promises_1.readFile)(path, "utf8")), failures = [];
    for (const fixture of fixtures) {
        const value = dataset.resolutions.find(row => row.stateKey === fixture.stateKey && row.ruleKey === fixture.ruleKey), issues = [];
        if (!value)
            issues.push("resolution missing");
        else {
            if (value.passiveSkillId !== fixture.passiveSkillId)
                issues.push("passive skill differs");
            const actual = [value.activation.conditionStatus, value.activation.executionTimingType, value.effect.target.structuredTargetType.raw, value.activation.calculationOption, value.activation.isOnce, value.activation.probability];
            const expected = [fixture.conditionStatus, fixture.executionTimingType, fixture.targetType, fixture.calculationOption, fixture.isOnce, fixture.probability];
            if (JSON.stringify(actual) !== JSON.stringify(expected))
                issues.push("raw activation tuple differs");
            if (value.operation !== "attack_break_marker" || value.effect.status !== "supported" || value.effect.behavioralParameters.kind !== "none" || value.effect.target.structuredTargetType.status !== "unknown")
                issues.push("semantic projection differs");
            if (JSON.stringify([value.semanticStatus, value.activation.timingStatus, value.activation.calculationBucket, value.lifecycle.duration, value.lifecycle.recurrence]) !== JSON.stringify(["partial", "unknown", "unknown", "unknown", "unknown"]))
                issues.push("uncertainty boundary differs");
        }
        if (issues.length > 0)
            failures.push({ fixture: fixture.name, issue: issues.join(", ") });
    }
    const expectedCoverage = { sourceGapRuleCount: 36, resolutionCount: 36, affectedStateCount: 29, uniquePassiveSkillCount: 35, supportedEffectCount: 36, partialResolutionCount: 36, zeroRawValueRuleCount: 36 };
    for (const [key, expected] of Object.entries(expectedCoverage))
        if (coverage[key] !== expected)
            failures.push({ fixture: "coverage", issue: `${key} differs` });
    return { schemaVersion: 1, fixtureCount: fixtures.length + 1, passed: fixtures.length + 1 - failures.length, failures };
}
exports.validateDatabaseTeamAnalysisDb29Goldens = validateDatabaseTeamAnalysisDb29Goldens;
//# sourceMappingURL=team-analysis-db29-golden.js.map