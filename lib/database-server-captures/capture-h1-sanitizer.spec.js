"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = require("assert");
const fs_1 = require("fs");
const os_1 = require("os");
const path_1 = require("path");
const capture_h0_audit_1 = require("./capture-h0-audit");
const capture_h1_sanitizer_1 = require("./capture-h1-sanitizer");
const capture_secret_scan_1 = require("./capture-secret-scan");
describe("capture H1 sanitizer", () => {
    let root = "";
    const manifest = { schemaVersion: 1, inputRoot: "test", captures: [{ captureId: "one", path: "one.har" }] };
    afterEach(() => { if (root)
        (0, fs_1.rmSync)(root, { recursive: true, force: true }); });
    it("emits deterministic schema only and omits classified request bodies", () => {
        root = (0, fs_1.mkdtempSync)((0, path_1.join)((0, os_1.tmpdir)(), "dokkan-capture-h1-"));
        const secret = "synthetic-private-token";
        const value = { log: { entries: [
                    { startedDateTime: "2026-08-07T20:00:00.000Z", request: { method: "POST", url: "https://ishin-global.aktsk.com/auth/sign_in?access_token=synthetic-query-value", headers: [{ name: "Authorization", value: secret }], postData: { mimeType: "application/json", text: JSON.stringify({ access_token: secret }) } }, response: { status: 200, headers: [], content: { mimeType: "application/json", text: JSON.stringify({ user_account: secret, data: { id: 9 } }) } } },
                    { startedDateTime: "2026-08-07T20:01:00.000Z", request: { method: "GET", url: "https://ishin-global.aktsk.com/bonus_schedules", headers: [] }, response: { status: 200, headers: [], content: { mimeType: "application/json", text: JSON.stringify({ bonus_schedules: [{ id: 7, start_at: "public-time" }] }) } } },
                ] } };
        (0, fs_1.writeFileSync)((0, path_1.join)(root, "one.har"), JSON.stringify(value));
        const h0 = (0, capture_h0_audit_1.auditCaptureManifest)(manifest, { test: root });
        const first = (0, capture_h1_sanitizer_1.buildCaptureH1)(manifest, { test: root }, h0);
        const second = (0, capture_h1_sanitizer_1.buildCaptureH1)(manifest, { test: root }, h0);
        (0, assert_1.deepEqual)(first, second);
        const output = JSON.stringify(first);
        (0, assert_1.equal)(output.includes(secret), false);
        (0, assert_1.equal)(output.includes("public-time"), false);
        (0, assert_1.equal)(output.includes("synthetic-query-value"), false);
        (0, assert_1.equal)(first.valueFixtureCount, 0);
        const auth = first.captures[0].observations.find(item => item.classification === "auth");
        (0, assert_1.equal)(auth.requestBodyDisposition, "omitted_by_classification");
        (0, assert_1.deepEqual)(auth.requestSchema, []);
        (0, assert_1.equal)(auth.queryKeys.includes("access_token"), true);
    });
    it("detects captured and generic synthetic leaks without echoing them", () => {
        const result = (0, capture_secret_scan_1.scanTextsForSecrets)(new Set(["synthetic-captured-secret"]), [{ name: "bad", text: "synthetic-captured-secret" }]);
        (0, assert_1.equal)(result.valid, false);
        (0, assert_1.equal)(result.exactCapturedSecretMatches, 1);
        (0, assert_1.deepEqual)(result.failingTargets, ["bad"]);
        (0, assert_1.equal)(JSON.stringify(result).includes("synthetic-captured-secret"), false);
        (0, assert_1.equal)((0, capture_secret_scan_1.scanTextsForSecrets)(new Set(["1234"]), [{ name: "short", text: JSON.stringify({ value: "1234" }) }]).valid, false);
    });
    it("rejects same-size capture drift against H0 fingerprints", () => {
        root = (0, fs_1.mkdtempSync)((0, path_1.join)((0, os_1.tmpdir)(), "dokkan-capture-h1-drift-"));
        const original = JSON.stringify({ log: { entries: [{ startedDateTime: "2026-08-07T20:00:00.000Z", request: { method: "GET", url: "https://ishin-global.aktsk.com/bonus_schedules", headers: [] }, response: { status: 200, headers: [], content: { mimeType: "application/json", text: JSON.stringify({ data: [{ id: 1 }] }) } } }] } });
        (0, fs_1.writeFileSync)((0, path_1.join)(root, "one.har"), original);
        const h0 = (0, capture_h0_audit_1.auditCaptureManifest)(manifest, { test: root });
        (0, fs_1.writeFileSync)((0, path_1.join)(root, "one.har"), original.replace("bonus_schedules", "bonus_schedulEx"));
        (0, assert_1.throws)(() => (0, capture_h1_sanitizer_1.buildCaptureH1)(manifest, { test: root }, h0), /capture drift/);
    });
});
//# sourceMappingURL=capture-h1-sanitizer.spec.js.map