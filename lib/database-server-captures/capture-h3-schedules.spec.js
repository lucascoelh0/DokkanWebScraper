"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = require("assert");
const fs_1 = require("fs");
const os_1 = require("os");
const path_1 = require("path");
const capture_h0_audit_1 = require("./capture-h0-audit");
const capture_h3_schedules_1 = require("./capture-h3-schedules");
describe("capture H3 schedules", () => {
    let root = "";
    afterEach(() => { if (root)
        (0, fs_1.rmSync)(root, { recursive: true, force: true }); });
    it("projects only allowlisted schedule fields and discards progress", () => {
        root = (0, fs_1.mkdtempSync)((0, path_1.join)((0, os_1.tmpdir)(), "dokkan-capture-h3-"));
        const body = { events: [{ id: 7, start_at: "synthetic-personal-value", end_at: 20, wday: ["mon"], quests: [{ id: 70, user_quest: { visited_count: 999, next_reset_at: "synthetic-secret" }, name: "not-identity" }] }], z_battle_stages: [] };
        const har = { log: { entries: [{ startedDateTime: "2026-08-07T20:00:00.000Z", request: { method: "GET", url: "https://ishin-global.aktsk.com/events", headers: [] }, response: { status: 200, headers: [], content: { mimeType: "application/json", text: JSON.stringify(body) } } }] } };
        (0, fs_1.writeFileSync)((0, path_1.join)(root, "one.har"), JSON.stringify(har));
        const manifest = { schemaVersion: 1, inputRoot: "test", captures: [{ captureId: "one", path: "one.har" }] };
        const h0 = (0, capture_h0_audit_1.auditCaptureManifest)(manifest, { test: root });
        const first = (0, capture_h3_schedules_1.buildCaptureH3)(manifest, { test: root }, h0), second = (0, capture_h3_schedules_1.buildCaptureH3)(manifest, { test: root }, h0);
        (0, assert_1.equal)(JSON.stringify(first), JSON.stringify(second));
        const output = JSON.stringify(first);
        (0, assert_1.equal)(output.includes("synthetic-secret"), false);
        (0, assert_1.equal)(output.includes("not-identity"), false);
        (0, assert_1.equal)(output.includes("synthetic-personal-value"), false);
        const validation = (0, capture_h3_schedules_1.validateCaptureH3)(first);
        (0, assert_1.equal)(validation.valid, true);
        (0, assert_1.equal)(validation.supportedCount, 0);
        (0, assert_1.equal)(validation.userDerivedAuthorityCount, 0);
        first.entities[0].facts[0].value = "tampered";
        (0, assert_1.equal)((0, capture_h3_schedules_1.validateCaptureH3)(first).valid, false);
    });
});
//# sourceMappingURL=capture-h3-schedules.spec.js.map