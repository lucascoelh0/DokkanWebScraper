"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateDatabaseTeamAnalysisDb42Goldens = void 0;
const promises_1 = require("fs/promises");
const path_1 = require("path");
const team_analysis_db42_builder_1 = require("./team-analysis-db42-builder");
async function validateDatabaseTeamAnalysisDb42Goldens(d, c) {
    const f = JSON.parse(await (0, promises_1.readFile)((0, path_1.resolve)(__dirname, "team-analysis-db42-golden-fixtures.json"), "utf8")), failures = [];
    for (const x of f) {
        const r = d.resolutions.find(v => v.stateKey === x.stateKey && v.ruleKey === x.ruleKey && v.causalityId === x.causalityId), s = r?.predicate.selector;
        if (!r || !s || s.rawConditionMode !== x.mode || (s.kind === "card_category_id" ? s.categoryId !== x.categoryId : s.rawMask !== x.mask || s.class !== x.class))
            failures.push(x.id);
    }
    if (c.resolutionCount !== 63 || c.affectedStateCount !== 21 || c.affectedRuleCount !== 46 || c.affectedPassiveSkillCount !== 46 || c.uniqueCausalityCount !== 14 || c.rawConditionModeCounts["0"] !== 31 || c.rawConditionModeCounts["2"] !== 32 || c.classCounts.super !== 8 || c.classCounts.extreme !== 24 || c.partialResolutionCount !== 63 || c.legacyUnknownResolutionCount !== 63 || c.confirmedLegacyConflictCount !== 0)
        failures.push("snapshot population");
    const mechanics = [
        ["none", (0, team_analysis_db42_builder_1.evaluateDb42AllPartyMatch)(0), false], ["six", (0, team_analysis_db42_builder_1.evaluateDb42AllPartyMatch)(6), false], ["seven", (0, team_analysis_db42_builder_1.evaluateDb42AllPartyMatch)(7), true], ["impossible-eight", (0, team_analysis_db42_builder_1.evaluateDb42AllPartyMatch)(8), null], ["invalid-count", (0, team_analysis_db42_builder_1.evaluateDb42AllPartyMatch)("bad"), null],
        ["super-1", (0, team_analysis_db42_builder_1.evaluateDb42AwakeningClassMask)(32, 1), true], ["super-dual", (0, team_analysis_db42_builder_1.evaluateDb42AwakeningClassMask)(32, 3), true], ["super-reject-2", (0, team_analysis_db42_builder_1.evaluateDb42AwakeningClassMask)(32, 2), false], ["extreme-2", (0, team_analysis_db42_builder_1.evaluateDb42AwakeningClassMask)(64, 2), true], ["extreme-dual", (0, team_analysis_db42_builder_1.evaluateDb42AwakeningClassMask)(64, 3), true], ["extreme-reject-1", (0, team_analysis_db42_builder_1.evaluateDb42AwakeningClassMask)(64, 1), false], ["unknown-mask", (0, team_analysis_db42_builder_1.evaluateDb42AwakeningClassMask)(16, 1), null], ["invalid-awakening", (0, team_analysis_db42_builder_1.evaluateDb42AwakeningClassMask)(32, "bad"), null]
    ];
    for (const [x, a, e] of mechanics)
        if (a !== e)
            failures.push(x);
    if (d.resolutions.some(r => r.predicate.requiredCount !== 7 || r.raw.ignoredColumns[0] !== "cau_val3" || r.activation.timing !== "unknown" || r.activation.duration !== "unknown" || r.activation.recurrence !== "unknown" || r.activation.resetAndExpiry !== "unknown" || r.activation.calculationBucket !== "unknown"))
        failures.push("conservative boundary");
    return { schemaVersion: 1, fixtureCount: f.length + mechanics.length + 2, passed: f.length + mechanics.length + 2 - failures.length, failures };
}
exports.validateDatabaseTeamAnalysisDb42Goldens = validateDatabaseTeamAnalysisDb42Goldens;
//# sourceMappingURL=team-analysis-db42-golden.js.map