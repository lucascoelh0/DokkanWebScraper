import { strict as assert } from "assert";
import { buildTreasureModeSources, TREASURE_MODE_TABLES, TreasureModeTables } from "./game-db-treasure-mode-sources";

function fixture(): TreasureModeTables {
    const t = Object.fromEntries(TREASURE_MODE_TABLES.map(key => [key, []])) as TreasureModeTables;
    t.budokais = [{ id: "5", name: "Official edition name", start_at: "2026-01-01 00:00:00", end_at: "2026-01-04 00:00:00" }];
    t.budokai_missions = [{ id: "1", budokai_id: "5", name: "Win five times" }];
    t.budokai_mission_rewards = [{ id: "2", budokai_mission_id: "1", item_type: "TreasureItem", item_id: "25", quantity: "5" }];
    t.budokai_box_rankings = [{ id: "3", budokai_id: "5" }];
    t.budokai_box_ranking_reward_ranges = [{ id: "4", budokai_box_ranking_id: "3", start_value: "2", end_value: "3" }];
    t.budokai_box_ranking_rewards = [{ id: "6", budokai_box_ranking_reward_range_id: "4", item_type: "TreasureItem", item_id: "25", quantity: "90" }];
    t.budokai_ranking_gift_sets = [{ id: "7", budokai_id: "5", ranking: "1 - 100th place" }];
    t.budokai_ranking_gifts = [{ id: "8", budokai_ranking_gift_set_id: "7", item_type: "TreasureItem", item_id: "25", quantity: "10" }];
    t.rmbattle_missions = [{ id: "9", rmbattle_id: "42", name: "[Weekly] Clear 3 stages.", created_at: "2026-09-01 00:00:00" }];
    t.rmbattle_mission_rewards = [{ id: "10", rmbattle_mission_id: "9", item_type: "TreasureItem", item_id: "2000", quantity: "5000" }];
    return t;
}
describe("treasure special-mode sources", () => {
    it("retains official edition dates and exact local/global ranking requirements", () => {
        const result = buildTreasureModeSources(fixture());
        assert.equal(result.length, 4);
        assert.equal(result[1].title, "Local ranking: 2–3");
        assert.equal(result[2].title, "Ranking: 1 - 100th place");
        assert.equal(result[0].editionName, "Official edition name");
        assert.equal(result[0].endsAt, "2026-01-04T00:00:00.000Z");
    });
    it("does not invent dates or edition names from Clash IDs and DB timestamps", () => {
        const source = buildTreasureModeSources(fixture())[3];
        assert.equal(source.editionId, "42"); assert.equal(source.editionName, null);
        assert.equal(source.startsAt, null); assert.equal(source.endsAt, null);
        assert.equal(source.areaId, null); assert.equal(source.stageId, null);
        assert.equal(source.quantity, 5000);
    });
    it("keeps a real mission with unresolved edition as unknown metadata", () => {
        const t = fixture(); t.budokai_missions[0].budokai_id = "99";
        const source = buildTreasureModeSources(t)[0];
        assert.equal(source.editionName, null); assert.equal(source.endsAt, null);
    });
    it("rejects missing reward parents, inverted ranking and invalid quantities", () => {
        for (const mutate of [
            (t: TreasureModeTables) => t.rmbattle_missions = [],
            (t: TreasureModeTables) => t.budokai_box_ranking_reward_ranges[0].end_value = "1",
            (t: TreasureModeTables) => t.budokai_mission_rewards[0].quantity = "0",
        ]) { const t = fixture(); mutate(t); assert.throws(() => buildTreasureModeSources(t)); }
    });
});
