import { equal } from "assert";
import { buildEventsE2Coverage, buildEventsE2Dataset } from "./events-e2-builder";
import { EventsE1Dataset } from "./events-e1-contract";
import { EventsE2Observation } from "./events-e2-contract";
import { validateEventsE2Dataset } from "./events-e2-validator";

const e1 = { catalog: [{ identity: { kind: "area", id: "1" } }, { identity: { kind: "z_battle_stage", id: "8" } }, { identity: { kind: "sd_map", id: "9" } }], opaqueRootFamilies: [{ family: "rmbattle", identities: ["1"] }] } as EventsE1Dataset;
const observation: EventsE2Observation = { quests: [{ id: 2, area_id: 1, name: "stage", prev_quest_id: null, any_clear_bonus_stones: 1, all_clear_bonus_stones: 1, visit_count_max: null, interval_reset_visited_days: null, can_ignore_difficulty_order: 0, limitation_announcement_id: null, boostable: 1, start_at: null, enable_sugoroku_auto: 1, enable_battle_auto: 1, enemy_info_display_type: "raw" }], maps: [{ id: 3, quest_id: 2, difficulty: 4, act: 5, eventkagi_num: 0, user_exp: 6, zeni: 7, is_cpu_only: 0, link_skill_lv_up_prob_rate: 8, sugoroku_map_reward_group_id: null, cpu_friend_list_id: null }], areaConditions: [], zBattleStages: [{ id: 8, unlock_conditions: "{}" }], zBattleEnemyRanges: [], zBattleCheckPoints: [], zBattleRewardLevelAnchors: [], originBattles: [], sdMaps: [{ id: 9 }], sdArenas: [], sdStages: [] };
const build = () => buildEventsE2Dataset({ observation, generatedAt: "time", sourceSnapshotVersion: "snapshot", sourceDatabaseSha256: "db", sourceE1Sha256: "e1", budokaiRootCount: 0, rmbattleRootCount: 1 });
describe("events E2 topology", () => {
    it("builds structural deep links and costs without labeling difficulty", () => { const dataset = build(); equal(dataset.questStages[0].levels[0].deepLinkKey, "quest:2/map:3"); equal(dataset.questStages[0].levels[0].rawDifficulty, 4); equal(validateEventsE2Dataset(dataset, observation, e1).valid, true); });
    it("rejects and counts a dangling area", () => { const dataset = build(); dataset.questStages[0].areaId = "99"; equal(validateEventsE2Dataset(dataset, observation, e1).valid, false); equal(buildEventsE2Coverage(dataset, e1).danglingIdCount, 1); });
    it("rejects an omitted map", () => { const dataset = build(); dataset.questStages[0].levels = []; equal(validateEventsE2Dataset(dataset, observation, e1).valid, false); });
});
