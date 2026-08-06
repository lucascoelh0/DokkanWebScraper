"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = require("assert");
const team_analysis_db35_builder_1 = require("./team-analysis-db35-builder");
describe("database Team Analysis DB35 passive target dispatch", () => {
    it("maps every target value present in projected passive rules", () => { (0, assert_1.deepStrictEqual)([1, 2, 3, 4, 12, 13, 14, 15, 16].map(x => (0, team_analysis_db35_builder_1.projectDb35Target)(x).status), Array(9).fill("supported")); });
    it("preserves values outside the proved current domain", () => { for (const x of [0, 5, 6, 7, 8, 9, 10, 11, 17, -1, "bad", null])
        (0, assert_1.deepStrictEqual)((0, team_analysis_db35_builder_1.projectDb35Target)(x), { status: "unknown", value: "unknown" }); });
    it("pins owner inclusion independently of scope", () => { const self = (0, team_analysis_db35_builder_1.projectDb35Target)(1), exceptSelf = (0, team_analysis_db35_builder_1.projectDb35Target)(16); (0, assert_1.equal)(self.status === "supported" && self.value.selfInclusion, "included"); (0, assert_1.equal)(exceptSelf.status === "supported" && exceptSelf.value.selfInclusion, "excluded"); });
    it("pins native class predicates including dual-class raw value 3", () => { const a = (0, team_analysis_db35_builder_1.projectDb35Target)(12), b = (0, team_analysis_db35_builder_1.projectDb35Target)(13); (0, assert_1.deepStrictEqual)(a.status === "supported" && a.value.classPredicateRaw, [1, 3]); (0, assert_1.deepStrictEqual)(b.status === "supported" && b.value.classPredicateRaw, [2, 3]); });
});
//# sourceMappingURL=team-analysis-db35-builder.spec.js.map