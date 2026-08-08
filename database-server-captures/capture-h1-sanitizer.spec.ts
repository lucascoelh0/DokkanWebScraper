import { deepEqual, equal, throws } from "assert";
import { mkdtempSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { auditCaptureManifest } from "./capture-h0-audit";
import { CaptureInputManifest } from "./capture-h0-contract";
import { buildCaptureH1 } from "./capture-h1-sanitizer";
import { scanTextsForSecrets } from "./capture-secret-scan";

describe("capture H1 sanitizer", () => {
    let root = "";
    const manifest: CaptureInputManifest = { schemaVersion: 1, inputRoot: "test", captures: [{ captureId: "one", path: "one.har" }] };
    afterEach(() => { if (root) rmSync(root, { recursive: true, force: true }); });

    it("emits deterministic schema only and omits classified request bodies", () => {
        root = mkdtempSync(join(tmpdir(), "dokkan-capture-h1-"));
        const secret = "synthetic-private-token";
        const value = { log: { entries: [
            { startedDateTime: "2026-08-07T20:00:00.000Z", request: { method: "POST", url: "https://ishin-global.aktsk.com/auth/sign_in?access_token=synthetic-query-value", headers: [{ name: "Authorization", value: secret }], postData: { mimeType: "application/json", text: JSON.stringify({ access_token: secret }) } }, response: { status: 200, headers: [], content: { mimeType: "application/json", text: JSON.stringify({ user_account: secret, data: { id: 9 } }) } } },
            { startedDateTime: "2026-08-07T20:01:00.000Z", request: { method: "GET", url: "https://ishin-global.aktsk.com/bonus_schedules", headers: [] }, response: { status: 200, headers: [], content: { mimeType: "application/json", text: JSON.stringify({ bonus_schedules: [{ id: 7, start_at: "public-time" }] }) } } },
        ] } };
        writeFileSync(join(root, "one.har"), JSON.stringify(value));
        const h0 = auditCaptureManifest(manifest, { test: root });
        const first = buildCaptureH1(manifest, { test: root }, h0);
        const second = buildCaptureH1(manifest, { test: root }, h0);
        deepEqual(first, second);
        const output = JSON.stringify(first);
        equal(output.includes(secret), false);
        equal(output.includes("public-time"), false);
        equal(output.includes("synthetic-query-value"), false);
        equal(first.valueFixtureCount, 0);
        const auth = first.captures[0].observations.find(item => item.classification === "auth")!;
        equal(auth.requestBodyDisposition, "omitted_by_classification");
        deepEqual(auth.requestSchema, []);
        equal(auth.queryKeys.includes("access_token"), true);
    });

    it("detects captured and generic synthetic leaks without echoing them", () => {
        const result = scanTextsForSecrets(new Set(["synthetic-captured-secret"]), [{ name: "bad", text: "synthetic-captured-secret" }]);
        equal(result.valid, false);
        equal(result.exactCapturedSecretMatches, 1);
        deepEqual(result.failingTargets, ["bad"]);
        equal(JSON.stringify(result).includes("synthetic-captured-secret"), false);
        equal(scanTextsForSecrets(new Set(["1234"]), [{ name: "short", text: JSON.stringify({ value: "1234" }) }]).valid, false);
    });

    it("rejects same-size capture drift against H0 fingerprints", () => {
        root = mkdtempSync(join(tmpdir(), "dokkan-capture-h1-drift-"));
        const original = JSON.stringify({ log: { entries: [{ startedDateTime: "2026-08-07T20:00:00.000Z", request: { method: "GET", url: "https://ishin-global.aktsk.com/bonus_schedules", headers: [] }, response: { status: 200, headers: [], content: { mimeType: "application/json", text: JSON.stringify({ data: [{ id: 1 }] }) } } }] } });
        writeFileSync(join(root, "one.har"), original);
        const h0 = auditCaptureManifest(manifest, { test: root });
        writeFileSync(join(root, "one.har"), original.replace("bonus_schedules", "bonus_schedulEx"));
        throws(() => buildCaptureH1(manifest, { test: root }, h0), /capture drift/);
    });
});
