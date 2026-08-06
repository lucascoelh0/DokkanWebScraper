import { equal } from "assert";
import { projectDb37Duration, projectDb37OnceOnly } from "./team-analysis-db37-builder";

describe("database Team Analysis DB37 passive lifecycle", () => {
    it("normalizes SQLite is_once by the proved nonzero test", () => {
        equal(projectDb37OnceOnly(0).enabled, false);
        for (const value of [1, 2, -1]) { const result = projectDb37OnceOnly(value); equal(result.status, "supported"); equal(result.enabled, true); equal(result.viabilityPredicate, "exec_count_less_than_1"); }
    });
    it("keeps invalid once payloads unknown", () => { for (const value of [null, "bad", 1.5]) equal(projectDb37OnceOnly(value).status, "unknown"); });
    it("rejects integers that do not fit the native int32 field", () => { for (const value of [2147483648, -2147483649, 4294967296]) { equal(projectDb37OnceOnly(value).status, "unknown"); equal(projectDb37Duration(value).status, "unknown"); } equal(projectDb37OnceOnly(2147483647).enabled, true); equal(projectDb37OnceOnly(-2147483648).enabled, true); });
    it("models nonnegative duration counters and the minus-one sentinel separately", () => {
        for (const value of [0, 1, 99, 4000]) equal(projectDb37Duration(value).status, "supported");
        const sentinel = projectDb37Duration(-1); equal(sentinel.status, "partial"); equal(sentinel.endTurnMutation, "sentinel_minus_one_not_decremented_when_update_eligible");
    });
    it("preserves unsupported duration payloads as unknown", () => { for (const value of [-2, null, "bad", 1.5]) equal(projectDb37Duration(value).status, "unknown"); });
    it("does not infer timing, target, bucket or reset from lifecycle fields", () => { const once = projectDb37OnceOnly(1); equal(once.execCountReset.trigger, "unknown"); });
});
