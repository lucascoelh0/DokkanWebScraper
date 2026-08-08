import { equal } from "assert";
import { mkdtempSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { auditCaptureManifest } from "./capture-h0-audit";
import { CaptureInputManifest } from "./capture-h0-contract";
import { buildCaptureH6, validateCaptureH6 } from "./capture-h6-assets";

describe("capture H6 asset evidence", () => {
    let root = "";
    afterEach(() => { if (root) rmSync(root, { recursive: true, force: true }); });
    it("keeps sanitized paths and descriptors without query values or asset bytes", () => {
        root = mkdtempSync(join(tmpdir(), "dokkan-capture-h6-"));
        const entries = [
            { startedDateTime: "2026-08-07T20:00:00.000Z", request: { method: "GET", url: "https://ishin-global.aktsk.com/events", headers: [] }, response: { status: 200, headers: [], content: { mimeType: "application/json", text: JSON.stringify({ events: [{ id: 1, banner_image: "https://cf.ishin-global.aktsk.com/banners/en/event/one.png?access_token=synthetic-secret", name: "private-name", event_image: "https://cf.ishin-global.aktsk.com/banners/en/event/nested/../private.png", listbutton_image: "https://cf.ishin-global.aktsk.com/banners/en/event/%2e%2e/private.png" }] }) } } },
            { startedDateTime: "2026-08-07T20:00:01.000Z", request: { method: "GET", url: "https://ishin-global.aktsk.com/client_assets/database", headers: [] }, response: { status: 200, headers: [], content: { mimeType: "application/json", text: JSON.stringify({ version: 3, algorithm: "fixture", hash: "opaqueHash1", url: "https://cf.ishin-global.aktsk.com/sqlite/current/en/data.db?access_token=synthetic-db-secret" }) } } },
            { startedDateTime: "2026-08-07T20:00:02.000Z", request: { method: "GET", url: "https://cf.ishin-global.aktsk.com/banners/en/event/one.png?access_token=synthetic-cdn-secret", headers: [] }, response: { status: 200, headers: [], content: { mimeType: "image/png", text: "synthetic-asset-bytes" } } },
            { startedDateTime: "2026-08-07T20:00:03.000Z", request: { method: "GET", url: "https://cf.ishin-global.aktsk.com/sqlite/current/en/data.db?access_token=synthetic-cdn-secret", headers: [] }, response: { status: 304, headers: [], content: { mimeType: "application/octet-stream", text: "synthetic-db-bytes" } } },
            { startedDateTime: "2026-08-07T20:00:04.000Z", request: { method: "GET", url: "https://cf.ishin-global.aktsk.com/banners/en/event/nested/../cdn-private.png", headers: [] }, response: { status: 200, headers: [], content: { mimeType: "image/png", text: "synthetic-private-bytes" } } },
            { startedDateTime: "2026-08-07T20:00:05.000Z", request: { method: "GET", url: "https://cf.ishin-global.aktsk.com/banners/en/event/%2e%2e/cdn-private.png", headers: [] }, response: { status: 200, headers: [], content: { mimeType: "image/png", text: "synthetic-private-bytes" } } },
        ];
        writeFileSync(join(root, "one.har"), JSON.stringify({ log: { entries } }));
        const manifest: CaptureInputManifest = { schemaVersion: 1, inputRoot: "test", captures: [{ captureId: "one", path: "one.har" }] }, h0 = auditCaptureManifest(manifest, { test: root });
        const first = buildCaptureH6(manifest, { test: root }, h0), second = buildCaptureH6(manifest, { test: root }, h0), output = JSON.stringify(first);
        equal(JSON.stringify(first), JSON.stringify(second));
        equal(output.includes("synthetic-secret"), false); equal(output.includes("private-name"), false); equal(output.includes("synthetic-asset-bytes"), false); equal(output.includes("synthetic-db-bytes"), false); equal(output.includes("?"), false);
        equal(first.observations.some(value => value.deliveryEvidence === "http_2xx_response_observed"), true);
        equal(first.observations.some(value => value.deliveryEvidence === "http_304_revalidation_observed"), true);
        equal(first.observations.filter(value => value.referenceKind === "product_json_reference").length, 1);
        equal(first.observations.filter(value => value.referenceKind === "captured_cdn_request").length, 2);
        equal(first.databaseDescriptors.length, 1); equal(validateCaptureH6(first, h0).valid, true);
        first.observations[0].assetPath = "/images/en/event/../private.png";
        equal(validateCaptureH6(first, h0).valid, false);
        const invalidEnum = buildCaptureH6(manifest, { test: root }, h0);
        (invalidEnum.observations[0] as any).referenceKind = "unknown";
        (invalidEnum.observations[0] as any).deliveryEvidence = "unknown";
        equal(validateCaptureH6(invalidEnum, h0).valid, false);
        const invalidStatus = buildCaptureH6(manifest, { test: root }, h0);
        const cdn = invalidStatus.observations.find(value => value.referenceKind === "captured_cdn_request")!;
        cdn.provenance.httpStatus = 418;
        equal(validateCaptureH6(invalidStatus, h0).valid, false);
    });
});
