"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = require("assert");
const team_analysis_db37_builder_1 = require("./team-analysis-db37-builder");
describe("database Team Analysis DB37 passive lifecycle", () => {
    it("normalizes SQLite is_once by the proved nonzero test", () => {
        (0, assert_1.equal)((0, team_analysis_db37_builder_1.projectDb37OnceOnly)(0).enabled, false);
        for (const value of [1, 2, -1]) {
            const result = (0, team_analysis_db37_builder_1.projectDb37OnceOnly)(value);
            (0, assert_1.equal)(result.status, "supported");
            (0, assert_1.equal)(result.enabled, true);
            (0, assert_1.equal)(result.viabilityPredicate, "exec_count_less_than_1");
        }
    });
    it("keeps invalid once payloads unknown", () => { for (const value of [null, "bad", 1.5])
        (0, assert_1.equal)((0, team_analysis_db37_builder_1.projectDb37OnceOnly)(value).status, "unknown"); });
    it("rejects integers that do not fit the native int32 field", () => { for (const value of [2147483648, -2147483649, 4294967296]) {
        (0, assert_1.equal)((0, team_analysis_db37_builder_1.projectDb37OnceOnly)(value).status, "unknown");
        (0, assert_1.equal)((0, team_analysis_db37_builder_1.projectDb37Duration)(value).status, "unknown");
    } (0, assert_1.equal)((0, team_analysis_db37_builder_1.projectDb37OnceOnly)(2147483647).enabled, true); (0, assert_1.equal)((0, team_analysis_db37_builder_1.projectDb37OnceOnly)(-2147483648).enabled, true); });
    it("models nonnegative duration counters and the minus-one sentinel separately", () => {
        for (const value of [0, 1, 99, 4000])
            (0, assert_1.equal)((0, team_analysis_db37_builder_1.projectDb37Duration)(value).status, "supported");
        const sentinel = (0, team_analysis_db37_builder_1.projectDb37Duration)(-1);
        (0, assert_1.equal)(sentinel.status, "partial");
        (0, assert_1.equal)(sentinel.endTurnMutation, "sentinel_minus_one_not_decremented_when_update_eligible");
    });
    it("preserves unsupported duration payloads as unknown", () => { for (const value of [-2, null, "bad", 1.5])
        (0, assert_1.equal)((0, team_analysis_db37_builder_1.projectDb37Duration)(value).status, "unknown"); });
    it("does not infer timing, target, bucket or reset from lifecycle fields", () => { const once = (0, team_analysis_db37_builder_1.projectDb37OnceOnly)(1); (0, assert_1.equal)(once.execCountReset.trigger, "unknown"); });
});
//# sourceMappingURL=team-analysis-db37-builder.spec.js.map