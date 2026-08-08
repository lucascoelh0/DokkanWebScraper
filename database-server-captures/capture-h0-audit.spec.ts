import { deepEqual, equal, match, throws } from "assert";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { auditCaptureManifest, classifyEndpoint } from "./capture-h0-audit";
import { CaptureInputManifest } from "./capture-h0-contract";

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

function manifest(path: string): CaptureInputManifest {
    return { schemaVersion: 1, inputRoot: "test", captures: [{ captureId: "one", path }] };
}

describe("capture H0 audit", () => {
    let root = "";
    beforeEach(() => { root = mkdtempSync(join(tmpdir(), "dokkan-capture-h0-")); });
    afterEach(() => { rmSync(root, { recursive: true, force: true }); });

    it("builds a deterministic value-free structural fingerprint", () => {
        writeFileSync(join(root, "one.har"), JSON.stringify(har()));
        const first = auditCaptureManifest(manifest("one.har"), { test: root });
        const second = auditCaptureManifest(manifest("one.har"), { test: root });
        deepEqual(first, second);
        const output = JSON.stringify(first);
        for (const secret of secretValues) equal(output.includes(secret), false);
        equal(first.captures[0].endpoints[0].queryKeys.includes("access_token"), true);
        match(first.captures[0].structuralFingerprint, /^[a-f0-9]{64}$/);
        match(first.captures[0].schemaFingerprint, /^[a-f0-9]{64}$/);
    });

    it("detects byte-different structural duplicates", () => {
        writeFileSync(join(root, "one.har"), JSON.stringify(har()));
        const second = har();
        second.log.entries[0].response.content.text = JSON.stringify({ user_account: "different-secret", events: [{ id: 999, title: "different", extra_public_field: true }] });
        writeFileSync(join(root, "two.har"), JSON.stringify(second, null, 2));
        const value = auditCaptureManifest({ schemaVersion: 1, inputRoot: "test", captures: [{ captureId: "one", path: "one.har" }, { captureId: "two", path: "two.har" }] }, { test: root });
        deepEqual(value.duplicateGroups, [["one", "two"]]);
        equal(value.captures.find(item => item.captureId === "two")!.duplicateOf, "one");
        equal(value.captures[0].schemaFingerprint === value.captures[1].schemaFingerprint, false);
    });

    it("does not fingerprint unallowlisted dynamic body keys", () => {
        const firstHar = har();
        firstHar.log.entries[0].response.content.text = JSON.stringify({ "dynamic-user-value-one": { id: 1 } });
        writeFileSync(join(root, "one.har"), JSON.stringify(firstHar));
        const secondHar = har();
        secondHar.log.entries[0].response.content.text = JSON.stringify({ "dynamic-user-value-two": { id: 2 } });
        writeFileSync(join(root, "two.har"), JSON.stringify(secondHar));
        const value = auditCaptureManifest({ schemaVersion: 1, inputRoot: "test", captures: [{ captureId: "one", path: "one.har" }, { captureId: "two", path: "two.har" }] }, { test: root });
        equal(value.captures[0].schemaFingerprint, value.captures[1].schemaFingerprint);
    });

    it("rejects absolute paths and traversal from manifests", () => {
        throws(() => auditCaptureManifest(manifest(join(root, "one.har")), { test: root }), /direct relative/);
        throws(() => auditCaptureManifest(manifest("..\\one.har"), { test: root }), /direct relative/);
    });

    it("rejects junction input roots", function () {
        const outside = mkdtempSync(join(tmpdir(), "dokkan-capture-outside-"));
        try {
            writeFileSync(join(outside, "outside.har"), JSON.stringify(har()));
            const junction = join(root, "junction");
            try { symlinkSync(outside, junction, "junction"); } catch { this.skip(); return; }
            throws(() => auditCaptureManifest(manifest("outside.har"), { test: junction }), /link or junction/);
        } finally { rmSync(outside, { recursive: true, force: true }); }
    });

    it("fails closed for unknown API GETs", () => {
        equal(classifyEndpoint("official_api", "GET", "/unknown_product"), "user_state");
        equal(classifyEndpoint("official_api", "POST", "/events"), "mutation");
        equal(classifyEndpoint("official_api", "GET", "/auth/sign_in"), "auth");
        equal(classifyEndpoint("official_cdn", "GET", "/anything"), "asset_delivery");
        equal(classifyEndpoint("official_cdn", "POST", "/anything"), "mutation");
    });

    it("does not expose unknown CDN suffixes", () => {
        const valueHar = har("2026-08-07T20:06:00.000Z", "/events");
        valueHar.log.entries[0].request.url = "https://cf.ishin-global.aktsk.com/file.a1b2c3d4";
        writeFileSync(join(root, "one.har"), JSON.stringify(valueHar));
        const value = auditCaptureManifest(manifest("one.har"), { test: root });
        equal(JSON.stringify(value).includes("a1b2c3d4"), false);
        equal(value.captures[0].endpoints[0].normalizedEndpoint, "/asset/unknown");
    });
});
