"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = require("assert");
const zlib_1 = require("zlib");
const crypto_1 = require("crypto");
const publish_treasure_catalog_1 = require("./publish-treasure-catalog");
describe("staging treasure publication", () => {
    const root = { schemaVersion: 1, contract: "dokkan-treasure-catalog", contractVersion: "1.2.0",
        datasetVersion: "test", sourceSnapshotVersion: "123", sourceDatabaseSha256: "a".repeat(64) };
    const expanded = Buffer.from(JSON.stringify(root));
    const payload = (0, zlib_1.gzipSync)(expanded);
    const manifest = { ...root, sizeBytes: payload.length, expandedSizeBytes: expanded.length,
        sha256: (0, crypto_1.createHash)("sha256").update(payload).digest("hex") };
    it("binds immutable payload and staging-only manifest", () => {
        const plan = (0, publish_treasure_catalog_1.planTreasurePublication)(Buffer.from(JSON.stringify(manifest)), payload);
        assert_1.strict.equal(plan.payloadKey, `staging/v2/treasure-catalog/catalog-${manifest.sha256}.payload`);
        assert_1.strict.equal(plan.uploadBytes, payload.length + plan.manifest.length);
    });
    it("rejects corrupted bytes", () => assert_1.strict.throws(() => (0, publish_treasure_catalog_1.planTreasurePublication)(Buffer.from(JSON.stringify(manifest)), Buffer.from("bad"))));
    it("rejects mismatched provenance", () => assert_1.strict.throws(() => (0, publish_treasure_catalog_1.planTreasurePublication)(Buffer.from(JSON.stringify({ ...manifest, sourceSnapshotVersion: "456" })), payload)));
    it("rejects oversized manifests", () => assert_1.strict.throws(() => (0, publish_treasure_catalog_1.planTreasurePublication)(Buffer.alloc(65537), payload)));
});
//# sourceMappingURL=publish-treasure-catalog.spec.js.map