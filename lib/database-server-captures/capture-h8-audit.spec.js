"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert = require("assert");
const capture_h8_audit_1 = require("./capture-h8-audit");
describe("capture H8 inventory", () => {
    it("keeps 304 distinct from an empty 200 body", () => {
        const dataset = { schemaVersion: 1, contract: "dokkan-official-capture-extension-inventory", contractVersion: "0.9.0", generatedAt: "2026-08-10T00:00:00.000Z", generatedAtPolicy: "latest_capture_timestamp_for_deterministic_bytes", collectionMode: "offline_local_har_no_requests", productionMutation: false, defaultEnabled: false, authority: "structural_observation_only_no_account_or_product_authority", exactDuplicatePolicy: "raw_bytes_compared_in_memory_digest_not_persisted", inputManifestSha256: "b".repeat(64), captures: [{ captureId: "synthetic", fileName: "synthetic.har", sizeBytes: 1, entryCount: 1, capturedAtStart: "2026-08-10T00:00:00.000Z", capturedAtEnd: "2026-08-10T00:00:00.000Z", structuralSha256: "", sourceIdentityFingerprint: "c".repeat(64), exactDuplicateOf: null, entries: [{ entryIndex: 0, hostClass: "official_cdn", method: "GET", normalizedPath: "/asset/png", trafficClass: "cdn", status: 304, requestMimeType: "unknown", responseMimeType: "application/octet-stream", requestBodyBytes: 0, responseBodyBytes: 0, capturedAt: "2026-08-10T00:00:00.000Z", sensitiveRequestHeaderNames: ["authorization"], sensitiveResponseHeaderNames: [], representation: "not_modified_body_omitted" }] }], exactDuplicateGroups: [], overlaps: [] };
        const crypto = require("crypto");
        const { entryIndex, capturedAt, ...rest } = dataset.captures[0].entries[0];
        dataset.captures[0].structuralSha256 = crypto.createHash("sha256").update(JSON.stringify(rest)).digest("hex");
        assert.equal((0, capture_h8_audit_1.validateCaptureH8)(dataset).valid, true);
        dataset.captures[0].entries[0].representation = "body_absent";
        assert.equal((0, capture_h8_audit_1.validateCaptureH8)(dataset).valid, false);
    });
    it("forces 304 response bytes to zero", () => {
        const value = (0, capture_h8_audit_1.sanitizeCaptureH8Entry)({ startedDateTime: "2026-08-10T00:00:00Z", request: { method: "GET", url: "https://cf.ishin-global.aktsk.com/example.png", headers: [] }, response: { status: 304, headers: [], content: { mimeType: "image/png", text: "must-not-count" } } }, 0);
        assert.equal(value.responseBodyBytes, 0);
        assert.equal(value.representation, "not_modified_body_omitted");
        const unknown = (0, capture_h8_audit_1.sanitizeCaptureH8Entry)({ request: { method: "GET", url: "not-a-url" }, response: { status: 304, content: { text: "must-not-count" } } }, 0);
        assert.equal(unknown.responseBodyBytes, 0);
        assert.equal(unknown.representation, "not_modified_body_omitted");
    });
});
//# sourceMappingURL=capture-h8-audit.spec.js.map