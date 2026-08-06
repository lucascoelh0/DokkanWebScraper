"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateDatabaseTeamAnalysisDb24Goldens = void 0;
const fs_1 = require("fs");
const promises_1 = require("fs/promises");
const path_1 = require("path");
async function validateDatabaseTeamAnalysisDb24Goldens(dataset, coverage) {
    const path = (0, fs_1.existsSync)((0, path_1.resolve)(__dirname, "team-analysis-db24-golden-fixtures.json")) ? (0, path_1.resolve)(__dirname, "team-analysis-db24-golden-fixtures.json") : (0, path_1.resolve)(__dirname, "..", "..", "database-experiment", "team-analysis-db24-golden-fixtures.json");
    const fixtures = JSON.parse(await (0, promises_1.readFile)(path, "utf8"));
    const failures = [];
    for (const fixture of fixtures) {
        const value = dataset.counterBehaviorResolutions.find(row => row.stateKey === fixture.stateKey && row.ruleKey === fixture.ruleKey);
        const issues = [];
        if (!value)
            issues.push("resolution missing");
        else {
            if (value.passiveSkillId !== fixture.passiveSkillId)
                issues.push("passive skill differs");
            if (JSON.stringify([value.payload.resistDamageRate.runtimeInteger, value.payload.increaseDamagePercent.runtimeInteger, value.payload.battleScriptNo.runtimeInteger]) !== JSON.stringify([fixture.resistDamageRate, fixture.increaseDamagePercent, fixture.battleScriptNo]))
                issues.push("payload differs");
            if (value.activation.probability !== fixture.probability)
                issues.push("probability differs");
            if (JSON.stringify([value.semanticStatus, value.activation.timingStatus, value.activation.calculationBucket, value.activation.duration, value.activation.recurrence]) !== JSON.stringify(["partial", "unknown", "unknown", "unknown", "unknown"]))
                issues.push("boundary differs");
        }
        if (issues.length > 0)
            failures.push({ fixture: fixture.name, issue: issues.join(", ") });
    }
    if (coverage.resolutionCount !== coverage.sourceGapRuleCount || coverage.unknownPayloadFieldCount !== 0)
        failures.push({ fixture: "coverage", issue: "source accounting or payload coverage differs" });
    return { schemaVersion: 1, fixtureCount: fixtures.length + 1, passed: fixtures.length + 1 - failures.length, failures };
}
exports.validateDatabaseTeamAnalysisDb24Goldens = validateDatabaseTeamAnalysisDb24Goldens;
//# sourceMappingURL=team-analysis-db24-golden.js.map