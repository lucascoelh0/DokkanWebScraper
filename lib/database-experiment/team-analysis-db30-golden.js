"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateDatabaseTeamAnalysisDb30Goldens = void 0;
const fs_1 = require("fs");
const promises_1 = require("fs/promises");
const path_1 = require("path");
async function validateDatabaseTeamAnalysisDb30Goldens(d, c) {
    const path = (0, fs_1.existsSync)((0, path_1.resolve)(__dirname, "team-analysis-db30-golden-fixtures.json")) ? (0, path_1.resolve)(__dirname, "team-analysis-db30-golden-fixtures.json") : (0, path_1.resolve)(__dirname, "..", "..", "database-experiment", "team-analysis-db30-golden-fixtures.json");
    const fixtures = JSON.parse(await (0, promises_1.readFile)(path, "utf8")), failures = [];
    for (const f of fixtures) {
        const v = d.resolutions.find(x => x.stateKey === f.stateKey && x.ruleKey === f.ruleKey), issues = [];
        if (!v)
            issues.push("missing");
        else {
            if (v.passiveSkillId !== f.passiveSkillId || v.selector.skillType.runtimeUnsignedInteger !== f.skillType || v.selector.skillId.runtimeSignedInteger !== f.skillId || v.selector.removalCategory.runtimeUnsignedInteger !== f.category || v.targetJoin.status !== f.targetJoinStatus)
                issues.push("selector/join differs");
            if (v.semanticStatus !== "partial" || v.statusMutation.enumNameStatus !== "unknown" || v.activation.timingStatus !== "unknown")
                issues.push("boundary differs");
        }
        if (issues.length)
            failures.push({ fixture: f.name, issue: issues.join(", ") });
    }
    const expected = { sourceGapRuleCount: 367, resolutionCount: 367, affectedStateCount: 172, uniquePassiveSkillCount: 353, candidatePassiveTargetJoinCount: 353, unknownTargetJoinCount: 14, partialResolutionCount: 367 };
    for (const [k, v] of Object.entries(expected))
        if (c[k] !== v)
            failures.push({ fixture: "coverage", issue: `${k} differs` });
    return { schemaVersion: 1, fixtureCount: fixtures.length + 1, passed: fixtures.length + 1 - failures.length, failures };
}
exports.validateDatabaseTeamAnalysisDb30Goldens = validateDatabaseTeamAnalysisDb30Goldens;
//# sourceMappingURL=team-analysis-db30-golden.js.map