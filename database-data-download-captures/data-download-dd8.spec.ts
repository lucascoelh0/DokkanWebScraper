import { strict as assert } from "assert";
import { buildDd7 } from "./data-download-dd7";
import { buildDd8, validateDd8 } from "./data-download-dd8";

describe("data download DD8", () => {
    it("keeps independent readiness decisions and no current capture request", () => {
        const dd7 = buildDd7("2026-08-13T00:00:00.000Z", "dd6");
        const value = buildDd8(dd7.generatedAt, "dd6", `${JSON.stringify(dd7)}\n`);
        assert.equal(validateDd8(value).valid, true);
        assert.equal(value.campaignClosure.additionalCaptureRequiredForCampaign, false);
        assert.equal(value.decisions.find(item => item.id === "authenticated_refresh")?.status, "NO_GO");
        assert.equal(value.futureCaptureDependencies.some(item => item.id === "ondemand_manifest_bodies"), false);
    });
});
