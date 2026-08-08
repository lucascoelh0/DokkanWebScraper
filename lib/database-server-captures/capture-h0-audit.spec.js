"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = require("assert");
const fs_1 = require("fs");
const os_1 = require("os");
const path_1 = require("path");
const capture_h0_audit_1 = require("./capture-h0-audit");
const secretValues = ["synthetic-access-token-value", "synthetic-cookie-value", "synthetic-device-token-value", "synthetic-account-value"];
function har(startedDateTime = "2026-08-07T20:06:00.000Z", path = "/events?access_token=synthetic-access-token-value") {
    return {
        log: {
            entries: [{
                    startedDateTime,
                    request: {
                        method: "GET",
                        url: `https://ishin-global.aktsk.com${path}`,
                        headers: [{ name: "Authorization", value: secretValues[0] }, { name: "Cookie", value: secretValues[1] }],
                        postData: { mimeType: "application/json", text: JSON.stringify({ device_token: secretValues[2], public_id: 7 }) },
                    },
                    response: {
                        status: 200,
                        headers: [{ name: "Set-Cookie", value: secretValues[1] }],
                        content: { mimeType: "application/json", text: JSON.stringify({ user_account: secretValues[3], events: [{ id: 1, title: "public" }] }) },
                    },
                }],
        },
    };
}
function manifest(path) {
    return { schemaVersion: 1, inputRoot: "test", captures: [{ captureId: "one", path }] };
}
describe("capture H0 audit", () => {
    let root = "";
    beforeEach(() => { root = (0, fs_1.mkdtempSync)((0, path_1.join)((0, os_1.tmpdir)(), "dokkan-capture-h0-")); });
    afterEach(() => { (0, fs_1.rmSync)(root, { recursive: true, force: true }); });
    it("builds a deterministic value-free structural fingerprint", () => {
        (0, fs_1.writeFileSync)((0, path_1.join)(root, "one.har"), JSON.stringify(har()));
        const first = (0, capture_h0_audit_1.auditCaptureManifest)(manifest("one.har"), { test: root });
        const second = (0, capture_h0_audit_1.auditCaptureManifest)(manifest("one.har"), { test: root });
        (0, assert_1.deepEqual)(first, second);
        const output = JSON.stringify(first);
        for (const secret of secretValues)
            (0, assert_1.equal)(output.includes(secret), false);
        (0, assert_1.equal)(first.captures[0].endpoints[0].queryKeys.includes("access_token"), true);
        (0, assert_1.match)(first.captures[0].structuralFingerprint, /^[a-f0-9]{64}$/);
        (0, assert_1.match)(first.captures[0].schemaFingerprint, /^[a-f0-9]{64}$/);
    });
    it("detects byte-different structural duplicates", () => {
        (0, fs_1.writeFileSync)((0, path_1.join)(root, "one.har"), JSON.stringify(har()));
        const second = har();
        second.log.entries[0].response.content.text = JSON.stringify({ user_account: "different-secret", events: [{ id: 999, title: "different", extra_public_field: true }] });
        (0, fs_1.writeFileSync)((0, path_1.join)(root, "two.har"), JSON.stringify(second, null, 2));
        const value = (0, capture_h0_audit_1.auditCaptureManifest)({ schemaVersion: 1, inputRoot: "test", captures: [{ captureId: "one", path: "one.har" }, { captureId: "two", path: "two.har" }] }, { test: root });
        (0, assert_1.deepEqual)(value.duplicateGroups, [["one", "two"]]);
        (0, assert_1.equal)(value.captures.find(item => item.captureId === "two").duplicateOf, "one");
        (0, assert_1.equal)(value.captures[0].schemaFingerprint === value.captures[1].schemaFingerprint, false);
    });
    it("does not fingerprint unallowlisted dynamic body keys", () => {
        const firstHar = har();
        firstHar.log.entries[0].response.content.text = JSON.stringify({ "dynamic-user-value-one": { id: 1 } });
        (0, fs_1.writeFileSync)((0, path_1.join)(root, "one.har"), JSON.stringify(firstHar));
        const secondHar = har();
        secondHar.log.entries[0].response.content.text = JSON.stringify({ "dynamic-user-value-two": { id: 2 } });
        (0, fs_1.writeFileSync)((0, path_1.join)(root, "two.har"), JSON.stringify(secondHar));
        const value = (0, capture_h0_audit_1.auditCaptureManifest)({ schemaVersion: 1, inputRoot: "test", captures: [{ captureId: "one", path: "one.har" }, { captureId: "two", path: "two.har" }] }, { test: root });
        (0, assert_1.equal)(value.captures[0].schemaFingerprint, value.captures[1].schemaFingerprint);
    });
    it("rejects absolute paths and traversal from manifests", () => {
        (0, assert_1.throws)(() => (0, capture_h0_audit_1.auditCaptureManifest)(manifest((0, path_1.join)(root, "one.har")), { test: root }), /direct relative/);
        (0, assert_1.throws)(() => (0, capture_h0_audit_1.auditCaptureManifest)(manifest("..\\one.har"), { test: root }), /direct relative/);
    });
    it("rejects junction input roots", function () {
        const outside = (0, fs_1.mkdtempSync)((0, path_1.join)((0, os_1.tmpdir)(), "dokkan-capture-outside-"));
        try {
            (0, fs_1.writeFileSync)((0, path_1.join)(outside, "outside.har"), JSON.stringify(har()));
            const junction = (0, path_1.join)(root, "junction");
            try {
                (0, fs_1.symlinkSync)(outside, junction, "junction");
            }
            catch {
                this.skip();
                return;
            }
            (0, assert_1.throws)(() => (0, capture_h0_audit_1.auditCaptureManifest)(manifest("outside.har"), { test: junction }), /link or junction/);
        }
        finally {
            (0, fs_1.rmSync)(outside, { recursive: true, force: true });
        }
    });
    it("fails closed for unknown API GETs", () => {
        (0, assert_1.equal)((0, capture_h0_audit_1.classifyEndpoint)("official_api", "GET", "/unknown_product"), "user_state");
        (0, assert_1.equal)((0, capture_h0_audit_1.classifyEndpoint)("official_api", "POST", "/events"), "mutation");
        (0, assert_1.equal)((0, capture_h0_audit_1.classifyEndpoint)("official_api", "GET", "/auth/sign_in"), "auth");
        (0, assert_1.equal)((0, capture_h0_audit_1.classifyEndpoint)("official_cdn", "GET", "/anything"), "asset_delivery");
        (0, assert_1.equal)((0, capture_h0_audit_1.classifyEndpoint)("official_cdn", "POST", "/anything"), "mutation");
    });
    it("does not expose unknown CDN suffixes", () => {
        const valueHar = har("2026-08-07T20:06:00.000Z", "/events");
        valueHar.log.entries[0].request.url = "https://cf.ishin-global.aktsk.com/file.a1b2c3d4";
        (0, fs_1.writeFileSync)((0, path_1.join)(root, "one.har"), JSON.stringify(valueHar));
        const value = (0, capture_h0_audit_1.auditCaptureManifest)(manifest("one.har"), { test: root });
        (0, assert_1.equal)(JSON.stringify(value).includes("a1b2c3d4"), false);
        (0, assert_1.equal)(value.captures[0].endpoints[0].normalizedEndpoint, "/asset/unknown");
    });
});
//# sourceMappingURL=capture-h0-audit.spec.js.map