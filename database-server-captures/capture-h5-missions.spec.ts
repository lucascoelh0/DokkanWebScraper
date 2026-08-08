import { equal } from "assert";
import { mkdtempSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { auditCaptureManifest } from "./capture-h0-audit";
import { CaptureInputManifest } from "./capture-h0-contract";
import { buildCaptureH5, validateCaptureH5 } from "./capture-h5-missions";

describe("capture H5 mission boards", () => {
    let root = "";
    afterEach(() => { if (root) rmSync(root, { recursive: true, force: true }); });
    it("keeps board definitions and references while excluding progress and text", () => {
        root = mkdtempSync(join(tmpdir(), "dokkan-capture-h5-"));
        const body = { processed_at: "synthetic-secret", mission_board_campaigns: [{ id: 7, start_at: 1, end_at: 2, end_at_hidden: false, announcement_id: 8, campaign_complete_mission_id: 9, priority: 0, name: "private-name", complete_message: "private-message", mission_boards: [{ id: 70, complete_mission_id: 71, contents_lv: 0, display_reward_id: 72, mission_category_id: 73, number: 1, background_image_path: "private-path" }] }], missions: [{ id: 999, mission_id: 71, current_value: 5, completed_at: 2, accepted_reward_at: null }] };
        const har = { log: { entries: [{ startedDateTime: "2026-08-07T20:00:00.000Z", request: { method: "GET", url: "https://ishin-global.aktsk.com/missions/mission_board_campaigns", headers: [] }, response: { status: 200, headers: [], content: { mimeType: "application/json", text: JSON.stringify(body) } } }] } };
        writeFileSync(join(root, "one.har"), JSON.stringify(har));
        const manifest: CaptureInputManifest = { schemaVersion: 1, inputRoot: "test", captures: [{ captureId: "one", path: "one.har" }] };
        const h0 = auditCaptureManifest(manifest, { test: root });
        const first = buildCaptureH5(manifest, { test: root }, h0), second = buildCaptureH5(manifest, { test: root }, h0);
        equal(JSON.stringify(first), JSON.stringify(second));
        const output = JSON.stringify(first);
        equal(output.includes("synthetic-secret"), false);
        equal(output.includes("private-name"), false);
        equal(output.includes("private-message"), false);
        equal(output.includes("private-path"), false);
        equal(first.entities.some(entity => entity.entityType === "mission_board_campaign"), true);
        equal(first.entities.some(entity => entity.entityType === "mission_board"), true);
        equal(first.entities.some(entity => entity.entityType === "mission"), false);
        equal(validateCaptureH5(first, h0).valid, true);
        first.entities[0].facts[0].provenance.captureId = "not in h0";
        equal(validateCaptureH5(first, h0).valid, false);
    });
});
