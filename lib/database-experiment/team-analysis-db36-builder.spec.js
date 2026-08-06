"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = require("assert");
const team_analysis_db36_builder_1 = require("./team-analysis-db36-builder");
describe("database Team Analysis DB36 sub-target semantics", () => {
    it("maps category include and exclude", () => { (0, assert_1.equal)((0, team_analysis_db36_builder_1.projectDb36Filter)({ id: 1, sub_target_type_set_id: 1, target_value_type: 1, target_value: 10 }).inclusion, "include"); (0, assert_1.equal)((0, team_analysis_db36_builder_1.projectDb36Filter)({ id: 2, sub_target_type_set_id: 1, target_value_type: 2, target_value: 10 }).inclusion, "exclude"); });
    it("maps unique-info-set include and exclude without losing members", () => { const a = (0, team_analysis_db36_builder_1.projectDb36Filter)({ id: 1, target_value_type: 4, target_value: 30 }, undefined, ["1", "2"]), b = (0, team_analysis_db36_builder_1.projectDb36Filter)({ id: 2, target_value_type: 5, target_value: 30 }); (0, assert_1.deepStrictEqual)(a.memberCardUniqueInfoIds, ["1", "2"]); (0, assert_1.equal)(a.inclusion, "include"); (0, assert_1.equal)(b.inclusion, "exclude"); });
    it("keeps metamorphic type partial", () => { const x = (0, team_analysis_db36_builder_1.projectDb36Filter)({ id: 1, target_value_type: 3, target_value: 2 }); (0, assert_1.equal)(x.status, "partial"); (0, assert_1.equal)(x.selector, "metamorphic_type_raw"); (0, assert_1.equal)(x.inclusion, "unknown"); });
    it("keeps invalid and out-of-domain types unknown", () => { for (const value of [0, 6, -1, 1.5, "bad", null])
        (0, assert_1.equal)((0, team_analysis_db36_builder_1.projectDb36Filter)({ id: 1, target_value_type: value, target_value: 2 }).status, "unknown"); });
});
//# sourceMappingURL=team-analysis-db36-builder.spec.js.map