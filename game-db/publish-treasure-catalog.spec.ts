import { strict as assert } from "assert";
import { gzipSync } from "zlib";
import { createHash } from "crypto";
import { planTreasurePublication } from "./publish-treasure-catalog";

describe("staging treasure publication", () => {
    const root = { schemaVersion: 1, contract: "dokkan-treasure-catalog", contractVersion: "1.2.0",
        datasetVersion: "test", sourceSnapshotVersion: "123", sourceDatabaseSha256: "a".repeat(64) };
    const expanded = Buffer.from(JSON.stringify(root));
    const payload = gzipSync(expanded);
    const manifest = { ...root, sizeBytes: payload.length, expandedSizeBytes: expanded.length,
        sha256: createHash("sha256").update(payload).digest("hex") };
    it("binds immutable payload and staging-only manifest", () => {
        const plan = planTreasurePublication(Buffer.from(JSON.stringify(manifest)), payload);
        assert.equal(plan.payloadKey, `staging/v2/treasure-catalog/catalog-${manifest.sha256}.payload`);
        assert.equal(plan.uploadBytes, payload.length + plan.manifest.length);
    });
    it("rejects corrupted bytes", () => assert.throws(() => planTreasurePublication(Buffer.from(JSON.stringify(manifest)), Buffer.from("bad"))));
    it("rejects mismatched provenance", () => assert.throws(() => planTreasurePublication(Buffer.from(JSON.stringify({ ...manifest, sourceSnapshotVersion: "456" })), payload)));
    it("rejects oversized manifests", () => assert.throws(() => planTreasurePublication(Buffer.alloc(65537), payload)));
});
