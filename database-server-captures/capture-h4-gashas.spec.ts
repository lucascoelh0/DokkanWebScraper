import { equal } from "assert";
import { mkdtempSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { auditCaptureManifest } from "./capture-h0-audit";
import { CaptureInputManifest } from "./capture-h0-contract";
import { buildCaptureH4, validateCaptureH4 } from "./capture-h4-gashas";

describe("capture H4 gashas", () => {
    let root = "";
    afterEach(() => { if (root) rmSync(root, { recursive: true, force: true }); });
    it("keeps structural gasha data while excluding text and user step state", () => {
        root = mkdtempSync(join(tmpdir(), "dokkan-capture-h4-"));
        const entries = [
            { startedDateTime: "2026-08-07T20:00:00.000Z", request: { method: "GET", url: "https://ishin-global.aktsk.com/gashas", headers: [] }, response: { status: 200, headers: [], content: { mimeType: "application/json", text: JSON.stringify({ gasha_categories: [{ id: 2, priority: 1, is_default: true, name: "private-name" }], gashas: [{ id: 10, gasha_category_id: 2, open_at: 1, end_at: 2, current_step: 999, name: "private-name", courses: [{ no: 1, currency_id: 5, price: 50, items_count: 10, drawable_count: 10 }] }] }) } } },
            { startedDateTime: "2026-08-07T20:00:01.000Z", request: { method: "GET", url: "https://ishin-global.aktsk.com/gashas/10/featured_cards", headers: [] }, response: { status: 200, headers: [], content: { mimeType: "application/json", text: JSON.stringify({ gasha_items: [{ card_id: 100 }, { card_id: 101 }], scouter_description: "synthetic-secret" }) } } },
            { startedDateTime: "2026-08-07T20:00:02.000Z", request: { method: "GET", url: "https://ishin-global.aktsk.com/gashas/10/rates", headers: [] }, response: { status: 200, headers: [], content: { mimeType: "application/json", text: JSON.stringify({ steps: [{ step: 1, gasha_rates: { id: 20, featured_card_ids: [100], normal_card_ids: [101], rarities: [{ rarity: "SSR", featured_rate: 5, normal_rate: 5, total_rate: 10, featured_cards_num: 1, normal_cards_num: 1, total_cards_num: 2 }] }, special_gashas: [] }] }) } } },
        ];
        writeFileSync(join(root, "one.har"), JSON.stringify({ log: { entries } }));
        const manifest: CaptureInputManifest = { schemaVersion: 1, inputRoot: "test", captures: [{ captureId: "one", path: "one.har" }] };
        const h0 = auditCaptureManifest(manifest, { test: root });
        const first = buildCaptureH4(manifest, { test: root }, h0), second = buildCaptureH4(manifest, { test: root }, h0);
        equal(JSON.stringify(first), JSON.stringify(second));
        const output = JSON.stringify(first);
        equal(output.includes("private-name"), false);
        equal(output.includes("synthetic-secret"), false);
        equal(output.includes("current_step"), true);
        const validation = validateCaptureH4(first, h0);
        equal(validation.valid, true);
        equal(validation.supportedCount, 0);
        first.entities.find(value => value.entityType === "gasha")!.facts[0].value = "tampered";
        equal(validateCaptureH4(first, h0).valid, false);
        const unsafeCaptureId = buildCaptureH4(manifest, { test: root }, h0);
        unsafeCaptureId.entities[0].facts[0].provenance.captureId = "private capture name";
        equal(validateCaptureH4(unsafeCaptureId, h0).valid, false);
        const nonIntegerStatus = buildCaptureH4(manifest, { test: root }, h0);
        nonIntegerStatus.entities[0].facts[0].provenance.httpStatus = 200.5;
        equal(validateCaptureH4(nonIntegerStatus, h0).valid, false);
    });
});
