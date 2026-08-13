import { strict as assert } from "assert";
import { buildDd7, validateDd7 } from "./data-download-dd7";

describe("data download DD7", () => {
    it("keeps the future architecture design-only", () => {
        const value = buildDd7("2026-08-13T00:00:00.000Z", "dd6");
        assert.equal(validateDd7(value).valid, true);
        assert.equal(value.authenticatedClientImplemented, false);
        assert.equal(value.stages.length, 10);
        assert.equal(value.retention.neverStore.includes("complete_22349705433_byte_asset_inventory"), true);
    });
});
