"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = require("assert");
const zlib_1 = require("zlib");
const game_db_treasure_catalog_1 = require("./game-db-treasure-catalog");
const fixture = () => ({
    treasure_items: [{ id: "1", name: "Stone", description: "Official\ndescription", image_suffix_number: "1" }],
    missions: [{ id: "2", name: "Clear stages", description: "Clear seven stages", area_id: "", start_at: "2026-01-01 00:00:00", end_at: "2026-01-08 00:00:00" }],
    mission_rewards: [{ id: "3", mission_id: "2", item_type: "TreasureItem", item_id: "1", quantity: "2" }],
    areas: [{ id: "4", name: "Story" }], quests: [{ id: "5", area_id: "4", name: "Stage", start_at: "" }],
    sugoroku_maps: [{ id: "6", quest_id: "5", difficulty: "3" }],
    sugoroku_map_boss_drop_items: [{ item_type: "TreasureItem", item_id: "1", sugoroku_map_id: "6", quest_id: "5" }],
    quest_drop_item_views: [{ quest_id: "5", difficulties: "[3]", item1_type: "TreasureItem", item1_id: "1" }],
});
const build = (t = fixture()) => (0, game_db_treasure_catalog_1.buildTreasureCatalog)(t, "1788329250", "a".repeat(64));
describe("treasure catalog", () => {
    it("keeps generic missions without invented destinations and preserves dates/quantity", () => {
        const mission = build().catalog.sources.find(s => s.kind === "mission");
        assert_1.strict.equal(mission.areaId, null);
        assert_1.strict.equal(mission.stageId, null);
        assert_1.strict.equal(mission.quantity, 2);
        assert_1.strict.equal(mission.endsAt, "2026-01-08T00:00:00.000Z");
    });
    it("deduplicates displayed/boss drops without inventing quantities or rates", () => {
        const drops = build().catalog.sources.filter(s => s.kind === "stage-drop");
        assert_1.strict.equal(drops.length, 1);
        assert_1.strict.equal(drops[0].quantity, null);
        assert_1.strict.equal("probability" in drops[0], false);
    });
    it("produces deterministic, measured compressed data", () => {
        const first = build(), second = build();
        assert_1.strict.deepEqual(first.compressed, second.compressed);
        assert_1.strict.equal((0, zlib_1.gunzipSync)(first.compressed).length, first.manifest.expandedSizeBytes);
        assert_1.strict.equal(first.compressed.length, first.manifest.sizeBytes);
        assert_1.strict.equal(first.catalog.treasures[0].description, "Official description");
    });
    it("rejects broken identity, join, quantity and time contracts", () => {
        for (const mutate of [
            (t) => t.mission_rewards[0].item_id = "99",
            (t) => t.mission_rewards[0].quantity = "-1",
            (t) => t.missions[0].end_at = "2026-02-30 00:00:00",
            (t) => t.sugoroku_maps[0].quest_id = "7",
        ]) {
            const t = fixture();
            mutate(t);
            assert_1.strict.throws(() => build(t));
        }
    });
    it("does not match a different reward type with the same numeric ID", () => {
        const t = fixture();
        t.mission_rewards[0].item_type = "Card";
        assert_1.strict.equal(build(t).catalog.sources.some(s => s.kind === "mission"), false);
    });
});
//# sourceMappingURL=game-db-treasure-catalog.spec.js.map