"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert = require("assert");
const dokkanstats_support_memories_1 = require("./dokkanstats-support-memories");
const catalogHtml = `<!doctype html><html><body><script>(function(){
const items = [{"id":10001,"name":"Oolong's Wish","description":"Bonus +50%\\n(once only)","max_exec_count":1,"priority":0,"support_film_id":1,"cost":70,"unlock_quantity":100,"script_name":"sm10001","open_at":"2020-01-01 00:00:00","close_at":"2038-01-01 00:00:00","is_base":true,"enhanced_versions":[{"level":2,"id":100012,"name":"Oolong's Wish","description":"Bonus +60%","cost":70}]},{"id":100012,"name":"Oolong's Wish","description":"Bonus +60%","is_base":false,"enhanced_versions":[]}];
const category = "support-memories";
const skinCardMap = {};
window.__ITEMS_DATA__ = items;
})();</script></body></html>`;
function detailHtml(sources) {
    return `<!doctype html><html><body><script>(function(){
const item = {"id":10001,"name":"Oolong's Wish","description":"Bonus +50%\\n(once only)","max_exec_count":1,"priority":0,"support_film_id":1,"cost":70,"unlock_quantity":100,"script_name":"sm10001","open_at":"2020-01-01 00:00:00","close_at":"2038-01-01 00:00:00","is_base":true,"enhanced_versions":[{"level":2,"id":100012,"name":"Oolong's Wish","description":"Bonus +60%","cost":70}]};
const category = "support-memories";
const sources = ${sources};
const usage = null;
window.__ITEM__ = item;
})();</script></body></html>`;
}
describe("DokkanStats Support Memory enrichment", () => {
    it("extracts roots and validates exact enhanced-level coverage", () => {
        const entries = (0, dokkanstats_support_memories_1.parseDokkanStatsSupportMemoryCatalog)(catalogHtml);
        const entry = entries.get("10001");
        assert.equal(entries.size, 1);
        assert.equal(entry.maxLevel, 2);
        assert.deepEqual(entry.levels.map(value => [value.level, value.memoryId]), [[1, "10001"], [2, "100012"]]);
        assert.equal(entry.description, "Bonus +50%\n(once only)");
        assert.equal(entry.supportFilmId, "1");
    });
    it("extracts mission and stage-drop evidence with stable keys", () => {
        const entry = (0, dokkanstats_support_memories_1.parseDokkanStatsSupportMemoryCatalog)(catalogHtml).get("10001");
        const detail = (0, dokkanstats_support_memories_1.parseDokkanStatsSupportMemoryDetail)(detailHtml(JSON.stringify([
            {
                kind: "mission", mission_id: 21146, mission: "Clear a stage once.", category: null,
                image: "images/en/mission/banner.png", category_id: 10109, category_type: "Extra",
                sort_at: "2023-06-20 00:00:00", end_at: "2038-01-01 00:00:00",
                area_id: null, z_battle_stage_id: null, quantity: 100, url: "/missions/10109/",
            },
            {
                kind: "stage_drop", area_id: 1302, area: "Super Warrior Memorial", quest_id: 1302001,
                quest: "Piccolo Saga", difficulty: 0, smap_id: 13020010, drop_type: 1, route: "story",
                image: "banners/en/event/banner.png", sort_at: "2023-07-07 00:00:00",
                end_at: "2000-01-01 00:00:00", url: "/events/story/1302/13020010",
            },
        ])), entry);
        assert.equal(detail.acquisitionSources.length, 2);
        assert.equal(detail.acquisitionSources[0].key, "mission:21146");
        assert.equal(detail.acquisitionSources[0].sourceUrl, "https://dokkanstats.com/missions/10109/");
        assert.equal(detail.acquisitionSources[0].imageUrl, "https://assets.dokkanstats.com/assets/global/en/images/en/mission/banner.png");
        assert.equal(detail.acquisitionSources[1].key, "stage-drop:13020010:1");
        assert.equal(detail.acquisitionSources[1].kind, "stage-drop");
    });
    it("treats a null source payload as explicit no-evidence", () => {
        const entry = (0, dokkanstats_support_memories_1.parseDokkanStatsSupportMemoryCatalog)(catalogHtml).get("10001");
        const detail = (0, dokkanstats_support_memories_1.parseDokkanStatsSupportMemoryDetail)(detailHtml("null"), entry);
        assert.deepEqual(detail.acquisitionSources, []);
    });
    it("fails closed on an unknown acquisition kind", () => {
        const entry = (0, dokkanstats_support_memories_1.parseDokkanStatsSupportMemoryCatalog)(catalogHtml).get("10001");
        assert.throws(() => (0, dokkanstats_support_memories_1.parseDokkanStatsSupportMemoryDetail)(detailHtml('[{"kind":"shop"}]'), entry), /unsupported acquisition source kind: shop/);
    });
    it("builds deterministic counts", () => {
        const entry = (0, dokkanstats_support_memories_1.parseDokkanStatsSupportMemoryCatalog)(catalogHtml).get("10001");
        const detail = (0, dokkanstats_support_memories_1.parseDokkanStatsSupportMemoryDetail)(detailHtml(JSON.stringify([{
                kind: "mission", mission_id: 21146, mission: "Clear a stage once.", category: null,
                category_id: 10109, category_type: "Extra", quantity: 100, url: "/missions/10109/",
            }])), entry);
        const dataset = (0, dokkanstats_support_memories_1.buildDokkanStatsSupportMemoryDataset)([detail], "2026-09-02T00:00:00.000Z");
        assert.equal(dataset.rootMemoryCount, 1);
        assert.equal(dataset.memoryLevelCount, 2);
        assert.equal(dataset.acquisitionMemoryCount, 1);
        assert.equal(dataset.missionSourceCount, 1);
        assert.equal(dataset.stageDropSourceCount, 0);
    });
    it("rejects catalog/detail drift", () => {
        const entry = (0, dokkanstats_support_memories_1.parseDokkanStatsSupportMemoryCatalog)(catalogHtml).get("10001");
        const changed = detailHtml("null").replace("Bonus +50%", "Bonus +55%");
        assert.throws(() => (0, dokkanstats_support_memories_1.parseDokkanStatsSupportMemoryDetail)(changed, entry), /does not match the catalog/);
    });
});
//# sourceMappingURL=dokkanstats-support-memories.spec.js.map