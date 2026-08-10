import { strict as assert } from "assert";
import { specialM6CaptureFlows, specialM6Decisions } from "./special-m6-readiness";

describe("special modes M6 readiness", () => {
    it("allows only disabled infrastructure and synthetic fixtures", () => { const allowed = new Set(["merge_disabled_infrastructure", "tracked_synthetic_fixtures"]); for (const row of specialM6Decisions()) assert.equal(row.status, allowed.has(row.id) ? "GO" : "NO_GO"); });
    it("keeps future-window flows optional and requires no start or finish capture", () => { const flows = specialM6CaptureFlows(), text = JSON.stringify(flows); assert.equal(flows.length, 5); assert(flows.every(flow => flow.requiredForCurrentCampaign === false && flow.steps.every(step => step.stopBoundary.length > 0))); assert.match(text, /dictionary ID 315060143 alone is never identity proof/); assert(!flows.some(flow => /start|finish/i.test(flow.id))); assert(!text.includes('"method":"POST"')); assert(!text.includes('"method":"PUT"')); });
});
