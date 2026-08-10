"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = require("assert");
const special_m6_readiness_1 = require("./special-m6-readiness");
describe("special modes M6 readiness", () => {
    it("allows only disabled infrastructure and synthetic fixtures", () => { const allowed = new Set(["merge_disabled_infrastructure", "tracked_synthetic_fixtures"]); for (const row of (0, special_m6_readiness_1.specialM6Decisions)())
        assert_1.strict.equal(row.status, allowed.has(row.id) ? "GO" : "NO_GO"); });
    it("makes every future capture passive and bounded", () => { const flows = (0, special_m6_readiness_1.specialM6CaptureFlows)(), text = JSON.stringify(flows); assert_1.strict.equal(flows.length, 7); (0, assert_1.strict)(flows.every(flow => flow.steps.every(step => step.stopBoundary.length > 0))); assert_1.strict.match(text, /dictionary ID 315060143 alone is never identity proof/); assert_1.strict.match(text, /no automation, no replay/); (0, assert_1.strict)(!text.includes('"method":"POST"')); (0, assert_1.strict)(!text.includes('"method":"PUT"')); });
});
//# sourceMappingURL=special-m6-readiness.spec.js.map