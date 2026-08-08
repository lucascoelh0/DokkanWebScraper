import { equal } from "assert";
import { mkdtempSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { auditCaptureManifest } from "./capture-h0-audit";
import { CaptureInputManifest } from "./capture-h0-contract";
import { buildCaptureH3, validateCaptureH3 } from "./capture-h3-schedules";

describe("capture H3 schedules", () => {
    let root = "";
    afterEach(() => { if (root) rmSync(root, { recursive: true, force: true }); });
    it("projects only allowlisted schedule fields and discards progress", () => {
        root = mkdtempSync(join(tmpdir(), "dokkan-capture-h3-"));
        const body = { events: [{ id: 7, start_at: "synthetic-personal-value", end_at: 20, wday: ["mon"], quests: [{ id: 70, user_quest: { visited_count: 999, next_reset_at: "synthetic-secret" }, name: "not-identity" }] }], z_battle_stages: [] };
        const har = { log: { entries: [{ startedDateTime: "2026-08-07T20:00:00.000Z", request: { method: "GET", url: "https://ishin-global.aktsk.com/events", headers: [] }, response: { status: 200, headers: [], content: { mimeType: "application/json", text: JSON.stringify(body) } } }] } };
        writeFileSync(join(root, "one.har"), JSON.stringify(har));
        const manifest: CaptureInputManifest = { schemaVersion: 1, inputRoot: "test", captures: [{ captureId: "one", path: "one.har" }] };
        const h0 = auditCaptureManifest(manifest, { test: root });
        const first = buildCaptureH3(manifest, { test: root }, h0), second = buildCaptureH3(manifest, { test: root }, h0);
        equal(JSON.stringify(first), JSON.stringify(second));
        const output = JSON.stringify(first);
        equal(output.includes("synthetic-secret"), false);
        equal(output.includes("not-identity"), false);
        equal(output.includes("synthetic-personal-value"), false);
        const validation = validateCaptureH3(first);
        equal(validation.valid, true);
        equal(validation.supportedCount, 0);
        equal(validation.userDerivedAuthorityCount, 0);
        first.entities[0].facts[0].value = "tampered";
        equal(validateCaptureH3(first).valid, false);
    });
});
