import { deepStrictEqual, equal } from "assert";
import { db34OperandUnit, projectDb34BasicStatShape, projectDb34CalculationBucket } from "./team-analysis-db34-builder";

describe("database Team Analysis DB34 basic stat buckets", () => {
    it("maps only the two native timing groups", () => {
        for (const raw of [1, 3, 11, 15, 18]) deepStrictEqual(projectDb34CalculationBucket(raw), { status: "supported", value: "former_passive_stat" });
        for (const raw of [4, 5, 6, 7, 9, 14]) deepStrictEqual(projectDb34CalculationBucket(raw), { status: "supported", value: "latter_passive_stat" });
        for (const raw of [12, 0, -1, "bad", null]) deepStrictEqual(projectDb34CalculationBucket(raw), { status: "unknown", value: "unknown" });
    });
    it("maps efficacy 1, 2 and 3 to their consumed SQLite modifiers", () => {
        deepStrictEqual(projectDb34BasicStatShape(1), [{ stat: "attack", sourceColumn: "eff_value1" }]);
        deepStrictEqual(projectDb34BasicStatShape(2), [{ stat: "defense", sourceColumn: "eff_value1" }]);
        deepStrictEqual(projectDb34BasicStatShape(3), [{ stat: "attack", sourceColumn: "eff_value1" }, { stat: "defense", sourceColumn: "eff_value2" }]);
        deepStrictEqual(projectDb34BasicStatShape(4), []);
    });
    it("derives operand units from the independently proved stat consumer", () => {
        equal(db34OperandUnit({ status: "supported", value: "add", formula: "x", parametersRead: [], parametersIgnored: [], clamp: "none" }).value, "stat_points");
        equal(db34OperandUnit({ status: "supported", value: "subtract_floor_zero", formula: "x", parametersRead: [], parametersIgnored: [], clamp: "floor_zero" }).value, "stat_points");
        equal(db34OperandUnit({ status: "supported", value: "add_percent_of_lhs", formula: "x", parametersRead: [], parametersIgnored: [], clamp: "none" }).value, "percent_points_of_current_stat");
        equal(db34OperandUnit({ status: "supported", value: "subtract_percent_of_lhs_floor_zero", formula: "x", parametersRead: [], parametersIgnored: [], clamp: "floor_zero" }).value, "percent_points_of_current_stat");
        equal(db34OperandUnit({ status: "supported", value: "assign_rhs", formula: "x", parametersRead: ["rhs"], parametersIgnored: ["lhs"], clamp: "none" }).value, "stat_points");
        equal(db34OperandUnit({ status: "unknown", value: "unknown" }).status, "unknown");
    });
    it("preserves the runtime float32 materialization boundary", () => equal(Math.fround(16_777_217), 16_777_216));
});
