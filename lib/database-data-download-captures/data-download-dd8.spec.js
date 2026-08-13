"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = require("assert");
const data_download_dd7_1 = require("./data-download-dd7");
const data_download_dd8_1 = require("./data-download-dd8");
describe("data download DD8", () => {
    it("keeps independent readiness decisions and no current capture request", () => {
        const dd7 = (0, data_download_dd7_1.buildDd7)("2026-08-13T00:00:00.000Z", "dd6");
        const value = (0, data_download_dd8_1.buildDd8)(dd7.generatedAt, "dd6", `${JSON.stringify(dd7)}\n`);
        assert_1.strict.equal((0, data_download_dd8_1.validateDd8)(value).valid, true);
        assert_1.strict.equal(value.campaignClosure.additionalCaptureRequiredForCampaign, false);
        assert_1.strict.equal(value.decisions.find(item => item.id === "authenticated_refresh")?.status, "NO_GO");
        assert_1.strict.equal(value.futureCaptureDependencies.some(item => item.id === "ondemand_manifest_bodies"), false);
    });
});
//# sourceMappingURL=data-download-dd8.spec.js.map