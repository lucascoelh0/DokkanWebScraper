import { equal } from "assert";
import { foldDb38IncrementalHistory, projectDb38Incremental } from "./team-analysis-db38-builder";

describe("database Team Analysis DB38 incremental status", () => {
    it("maps all six native output selectors", () => {
        const expected = ["modifier_attack", "modifier_defense", "critical_probability", "dodge_probability", "resist_damage_rate", "modifier_battle_gauge"];
        expected.forEach((field, selector) => {
            const projection = projectDb38Incremental(5, 30, selector);
            equal(projection.status, "supported");
            equal(projection.outputField, field);
        });
    });

    it("preserves zero and negative increments", () => {
        equal(projectDb38Incremental(0, 0, 0).truncatedIncrement, 0);
        equal(projectDb38Incremental(-5, -30, 3).truncatedIncrement, -5);
    });

    it("keeps selector and payload failures unknown", () => {
        const invalidPayloads: Array<[unknown, unknown, unknown]> = [
            [1, 2, 6],
            ["bad", 2, 0],
            [1, null, 0],
            [2147483648, 2, 0],
            [1, 2, 1.5],
        ];
        for (const [increment, cap, selector] of invalidPayloads) {
            equal(projectDb38Incremental(increment, cap, selector).status, "unknown");
        }
    });

    it("keeps recurrence and reset partial", () => {
        const projection = projectDb38Incremental(5, 30, 0);
        equal(projection.accumulation.status, "supported");
        equal(projection.recurrence.status, "partial");
        equal(projection.recurrence.appendCondition, "local_gate_bit0_clear");
        equal(projection.recurrence.appendTriggerSemantics, "unknown");
        equal(projection.recurrence.reset, "unknown");
    });

    it("folds stored entries in vector order with native signed int32 wrap", () => {
        equal(foldDb38IncrementalHistory([2147483647, 1], 2147483647), -2147483648);
        equal(foldDb38IncrementalHistory([-2147483648, -1], -2147483648), 2147483647);
        equal(foldDb38IncrementalHistory([-2147483648, -2147483647, 1], -2147483648), -2147483648);
        equal(foldDb38IncrementalHistory([1, -2147483647, -2147483648], -2147483648), -2147483647);
    });

    it("uses the distinct resist-damage transformation only for selector 4", () => {
        equal(projectDb38Incremental(8, 40, 4).emittedValue, "positive_aggregate_to_max_100_minus_aggregate_0_negative_aggregate_to_negated");
        equal(projectDb38Incremental(8, 40, 5).emittedValue, "aggregate");
    });
});
