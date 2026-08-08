"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = require("assert");
const fs_1 = require("fs");
const os_1 = require("os");
const path_1 = require("path");
const capture_h0_audit_1 = require("./capture-h0-audit");
const capture_h5_missions_1 = require("./capture-h5-missions");
describe("capture H5 mission boards", () => {
    let root = "";
    afterEach(() => { if (root)
        (0, fs_1.rmSync)(root, { recursive: true, force: true }); });
    it("keeps board definitions and references while excluding progress and text", () => {
        root = (0, fs_1.mkdtempSync)((0, path_1.join)((0, os_1.tmpdir)(), "dokkan-capture-h5-"));
        const body = { processed_at: "synthetic-secret", mission_board_campaigns: [{ id: 7, start_at: 1, end_at: 2, end_at_hidden: false, announcement_id: 8, campaign_complete_mission_id: 9, priority: 0, name: "private-name", complete_message: "private-message", mission_boards: [{ id: 70, complete_mission_id: 71, contents_lv: 0, display_reward_id: 72, mission_category_id: 73, number: 1, background_image_path: "private-path" }] }], missions: [{ id: 999, mission_id: 71, current_value: 5, completed_at: 2, accepted_reward_at: null }] };
        const har = { log: { entries: [{ startedDateTime: "2026-08-07T20:00:00.000Z", request: { method: "GET", url: "https://ishin-global.aktsk.com/missions/mission_board_campaigns", headers: [] }, response: { status: 200, headers: [], content: { mimeType: "application/json", text: JSON.stringify(body) } } }] } };
        (0, fs_1.writeFileSync)((0, path_1.join)(root, "one.har"), JSON.stringify(har));
        const manifest = { schemaVersion: 1, inputRoot: "test", captures: [{ captureId: "one", path: "one.har" }] };
        const h0 = (0, capture_h0_audit_1.auditCaptureManifest)(manifest, { test: root });
        const first = (0, capture_h5_missions_1.buildCaptureH5)(manifest, { test: root }, h0), second = (0, capture_h5_missions_1.buildCaptureH5)(manifest, { test: root }, h0);
        (0, assert_1.equal)(JSON.stringify(first), JSON.stringify(second));
        const output = JSON.stringify(first);
        (0, assert_1.equal)(output.includes("synthetic-secret"), false);
        (0, assert_1.equal)(output.includes("private-name"), false);
        (0, assert_1.equal)(output.includes("private-message"), false);
        (0, assert_1.equal)(output.includes("private-path"), false);
        (0, assert_1.equal)(first.entities.some(entity => entity.entityType === "mission_board_campaign"), true);
        (0, assert_1.equal)(first.entities.some(entity => entity.entityType === "mission_board"), true);
        (0, assert_1.equal)(first.entities.some(entity => entity.entityType === "mission"), false);
        (0, assert_1.equal)((0, capture_h5_missions_1.validateCaptureH5)(first, h0).valid, true);
        first.entities[0].facts[0].provenance.captureId = "not in h0";
        (0, assert_1.equal)((0, capture_h5_missions_1.validateCaptureH5)(first, h0).valid, false);
    });
});
//# sourceMappingURL=capture-h5-missions.spec.js.map