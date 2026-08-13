"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = require("assert");
const data_download_dd7_1 = require("./data-download-dd7");
describe("data download DD7", () => {
    it("keeps the future architecture design-only", () => {
        const value = (0, data_download_dd7_1.buildDd7)("2026-08-13T00:00:00.000Z", "dd6");
        assert_1.strict.equal((0, data_download_dd7_1.validateDd7)(value).valid, true);
        assert_1.strict.equal(value.authenticatedClientImplemented, false);
        assert_1.strict.equal(value.stages.length, 10);
        assert_1.strict.equal(value.retention.neverStore.includes("complete_22349705433_byte_asset_inventory"), true);
    });
});
//# sourceMappingURL=data-download-dd7.spec.js.map