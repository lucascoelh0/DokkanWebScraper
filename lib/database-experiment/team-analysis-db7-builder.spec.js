"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = require("assert");
const mocha_1 = require("mocha");
const team_analysis_db7_builder_1 = require("./team-analysis-db7-builder");
function dataset(type, selector) {
    const condition = { op: "unknown", causalityId: "9", causalityType: type, raw: { id: 9, causality_type: type, cau_val1: 0, cau_val2: selector, cau_val3: 2 } };
    const rule = { ruleKey: "1:r:1", condition, conditionStatus: "unknown", effects: [], effectStatus: "supported", status: "partial", combatHistoryTriggers: [], source: { causalityIds: ["9"], causalities: [{ id: "9", type, mappingStatus: "unknown" }] }, unknowns: ["condition_semantics_incomplete"] };
    return (0, team_analysis_db7_builder_1.buildDatabaseTeamAnalysisDb7Dataset)({ generatedAt: "2026-08-05T00:00:00.000Z", sourceSnapshotVersion: "fixture", sourceSha256: "a".repeat(64), states: [{ stateKey: "1:1:initial", characterId: "1", formId: "1", releaseState: "initial", passive: { rules: [rule], status: "partial" } }] });
}
(0, mocha_1.describe)("database Team Analysis DB7 selector projector", function () {
    (0, mocha_1.it)("maps only the five independently confirmed type-46 bits", () => {
        for (const [mask, value] of [[4, "INT"], [8, "STR"], [16, "PHY"], [32, "Super"], [64, "Extreme"]]) {
            const rule = dataset(46, mask).states[0].passive.rules[0];
            const selector = rule.selectorConditions[0];
            (0, assert_1.equal)(selector.status, "supported");
            (0, assert_1.equal)(rule.condition.op, "predicate");
            const actual = selector.selector.kind === "class" ? selector.selector.classes[0] : selector.selector.kind === "type" ? selector.selector.types[0] : undefined;
            (0, assert_1.equal)(actual, value);
            (0, assert_1.equal)(rule.source.causalities[0].mappingStatus, "supported");
        }
    });
    (0, mocha_1.it)("keeps type-41 tokens partial without localized names", () => {
        const rule = dataset(41, 13).states[0].passive.rules[0];
        const selector = rule.selectorConditions[0];
        (0, assert_1.equal)(selector.status, "partial");
        (0, assert_1.equal)(selector.selector.kind, "name_token");
        if (selector.selector.kind === "name_token")
            (0, assert_1.equal)(selector.selector.localizedName, null);
        (0, assert_1.equal)(rule.conditionStatus, "partial");
        (0, assert_1.equal)(rule.source.causalities[0].mappingStatus, "partial");
    });
    (0, mocha_1.it)("keeps malformed type-41 tokens unknown", () => {
        for (const token of [null, "", 1.5]) {
            const rule = dataset(41, token).states[0].passive.rules[0];
            (0, assert_1.equal)(rule.condition.op, "unknown");
            (0, assert_1.equal)(rule.conditionStatus, "unknown");
            (0, assert_1.equal)(rule.selectorConditions[0].status, "unknown");
            (0, assert_1.equal)(rule.selectorConditions[0].selector.kind, "unknown_name_token");
            (0, assert_1.equal)(rule.source.causalities[0].mappingStatus, "unknown");
            (0, assert_1.equal)(rule.unknowns.includes("name_token_invalid"), true);
        }
    });
    (0, mocha_1.it)("does not assign bits 1/2 or high Extreme-Type bits", () => {
        for (const mask of [1, 2, 131072, 2097152]) {
            const rule = dataset(46, mask).states[0].passive.rules[0];
            (0, assert_1.equal)(rule.condition.op, "unknown");
            (0, assert_1.equal)(rule.selectorConditions[0].status, "unknown");
            (0, assert_1.equal)(rule.source.causalities[0].mappingStatus, "unknown");
        }
    });
});
//# sourceMappingURL=team-analysis-db7-builder.spec.js.map