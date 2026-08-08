"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = require("assert");
const fs_1 = require("fs");
const os_1 = require("os");
const path_1 = require("path");
const capture_h0_audit_1 = require("./capture-h0-audit");
const capture_h6_assets_1 = require("./capture-h6-assets");
describe("capture H6 asset evidence", () => {
    let root = "";
    afterEach(() => { if (root)
        (0, fs_1.rmSync)(root, { recursive: true, force: true }); });
    it("keeps sanitized paths and descriptors without query values or asset bytes", () => {
        root = (0, fs_1.mkdtempSync)((0, path_1.join)((0, os_1.tmpdir)(), "dokkan-capture-h6-"));
        const entries = [
            { startedDateTime: "2026-08-07T20:00:00.000Z", request: { method: "GET", url: "https://ishin-global.aktsk.com/events", headers: [] }, response: { status: 200, headers: [], content: { mimeType: "application/json", text: JSON.stringify({ events: [{ id: 1, banner_image: "https://cf.ishin-global.aktsk.com/banners/en/event/one.png?access_token=synthetic-secret", name: "private-name", event_image: "https://cf.ishin-global.aktsk.com/banners/en/event/nested/../private.png", listbutton_image: "https://cf.ishin-global.aktsk.com/banners/en/event/%2e%2e/private.png" }] }) } } },
            { startedDateTime: "2026-08-07T20:00:01.000Z", request: { method: "GET", url: "https://ishin-global.aktsk.com/client_assets/database", headers: [] }, response: { status: 200, headers: [], content: { mimeType: "application/json", text: JSON.stringify({ version: 3, algorithm: "fixture", hash: "opaqueHash1", url: "https://cf.ishin-global.aktsk.com/sqlite/current/en/data.db?access_token=synthetic-db-secret" }) } } },
            { startedDateTime: "2026-08-07T20:00:02.000Z", request: { method: "GET", url: "https://cf.ishin-global.aktsk.com/banners/en/event/one.png?access_token=synthetic-cdn-secret", headers: [] }, response: { status: 200, headers: [], content: { mimeType: "image/png", text: "synthetic-asset-bytes" } } },
            { startedDateTime: "2026-08-07T20:00:03.000Z", request: { method: "GET", url: "https://cf.ishin-global.aktsk.com/sqlite/current/en/data.db?access_token=synthetic-cdn-secret", headers: [] }, response: { status: 304, headers: [], content: { mimeType: "application/octet-stream", text: "synthetic-db-bytes" } } },
            { startedDateTime: "2026-08-07T20:00:04.000Z", request: { method: "GET", url: "https://cf.ishin-global.aktsk.com/banners/en/event/nested/../cdn-private.png", headers: [] }, response: { status: 200, headers: [], content: { mimeType: "image/png", text: "synthetic-private-bytes" } } },
            { startedDateTime: "2026-08-07T20:00:05.000Z", request: { method: "GET", url: "https://cf.ishin-global.aktsk.com/banners/en/event/%2e%2e/cdn-private.png", headers: [] }, response: { status: 200, headers: [], content: { mimeType: "image/png", text: "synthetic-private-bytes" } } },
        ];
        (0, fs_1.writeFileSync)((0, path_1.join)(root, "one.har"), JSON.stringify({ log: { entries } }));
        const manifest = { schemaVersion: 1, inputRoot: "test", captures: [{ captureId: "one", path: "one.har" }] }, h0 = (0, capture_h0_audit_1.auditCaptureManifest)(manifest, { test: root });
        const first = (0, capture_h6_assets_1.buildCaptureH6)(manifest, { test: root }, h0), second = (0, capture_h6_assets_1.buildCaptureH6)(manifest, { test: root }, h0), output = JSON.stringify(first);
        (0, assert_1.equal)(JSON.stringify(first), JSON.stringify(second));
        (0, assert_1.equal)(output.includes("synthetic-secret"), false);
        (0, assert_1.equal)(output.includes("private-name"), false);
        (0, assert_1.equal)(output.includes("synthetic-asset-bytes"), false);
        (0, assert_1.equal)(output.includes("synthetic-db-bytes"), false);
        (0, assert_1.equal)(output.includes("?"), false);
        (0, assert_1.equal)(first.observations.some(value => value.deliveryEvidence === "http_2xx_response_observed"), true);
        (0, assert_1.equal)(first.observations.some(value => value.deliveryEvidence === "http_304_revalidation_observed"), true);
        (0, assert_1.equal)(first.observations.filter(value => value.referenceKind === "product_json_reference").length, 1);
        (0, assert_1.equal)(first.observations.filter(value => value.referenceKind === "captured_cdn_request").length, 2);
        (0, assert_1.equal)(first.databaseDescriptors.length, 1);
        (0, assert_1.equal)((0, capture_h6_assets_1.validateCaptureH6)(first, h0).valid, true);
        first.observations[0].assetPath = "/images/en/event/../private.png";
        (0, assert_1.equal)((0, capture_h6_assets_1.validateCaptureH6)(first, h0).valid, false);
        const invalidEnum = (0, capture_h6_assets_1.buildCaptureH6)(manifest, { test: root }, h0);
        invalidEnum.observations[0].referenceKind = "unknown";
        invalidEnum.observations[0].deliveryEvidence = "unknown";
        (0, assert_1.equal)((0, capture_h6_assets_1.validateCaptureH6)(invalidEnum, h0).valid, false);
        const invalidStatus = (0, capture_h6_assets_1.buildCaptureH6)(manifest, { test: root }, h0);
        const cdn = invalidStatus.observations.find(value => value.referenceKind === "captured_cdn_request");
        cdn.provenance.httpStatus = 418;
        (0, assert_1.equal)((0, capture_h6_assets_1.validateCaptureH6)(invalidStatus, h0).valid, false);
    });
});
//# sourceMappingURL=capture-h6-assets.spec.js.map