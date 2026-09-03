import { deepEqual, equal, throws } from "assert";
import { describe, it } from "mocha";
import { buildStageFirstPartyCandidate, StageFirstPartyTables } from "./game-db-stage";

function tables(): StageFirstPartyTables {
    return {
        areas: [{ id: "1", name: "Official Area", type: "Area::EventArea", category: "7", chapter_id: "2", db_story_id: "3", first_released_at: "2026-07-01 00:00:00", all_clear_bonus_stones: "2", is_listbutton_visible: "1", event_image_path: "banners/header.png", banner_image_path: "", listbutton_image_path: "banners/button.png" }],
        card_awakening_routes: [{ id: "1", card_id: "100", awaked_card_id: "101" }],
        cards: [
            { id: "100", name: "Enemy", character_id: "50", resource_id: "1000", rarity: "4", element: "3" },
            { id: "101", name: "Awakened Enemy", character_id: "50", resource_id: "1001", rarity: "4", element: "3" },
        ],
        card_specials: [{ id: "90", card_id: "100", special_set_id: "91", priority: "0", style: "Normal", eball_num_start: "12", view_id: "92" }],
        card_categories: [{ id: "9" }],
        chapters: [{ id: "2", name: "Official Chapter", open_at: "2026-06-01 00:00:00" }],
        db_stories: [{ id: "3", name: "Official Story", banner_image_path: "stories/3.png", priority: "4" }],
        enemy_round_skill_set_relations: [{ id: "1", enemy_round_skill_set_id: "300", enemy_round_skill_id: "301" }],
        enemy_round_skill_sets: [{ id: "300", effect_description: "Round gimmick", cancel_description: "Cancel with Domain" }],
        enemy_round_skills: [{ id: "301", name: "Round Skill", description: "Reduces damage", exec_timing_type: "1", calc_option: "2", turn: "1", probability: "100", causality_conditions: "{}", target_type: "4", eff_value1: "55", efficacy_type: "24" }],
        enemy_skill_cutin_extensions: [{ id: "201", enemy_skill_id: "200", phrase: "You cannot win!", voice_asset_id: "900" }],
        enemy_skills: [{ id: "200", name: "Enemy Skill", description: "Seals Super Attack", exec_timing_type: "1", turn: "2", is_once: "1", probability: "100", causality_conditions: "{}", target_type: "4", efficacy_type: "10", eff_value1: "1", eff_value2: "0", eff_value3: "0", efficacy_values: "{}", calc_option: "0" }],
        link_skills: [{ id: "8" }],
        mission_rewards: [
            { id: "1000", mission_id: "10", item_id: "500", item_type: "SupportMemory", quantity: "1" },
            { id: "1001", mission_id: "11", item_id: "501", item_type: "SupportMemory", quantity: "1" },
            { id: "1002", mission_id: "12", item_id: "502", item_type: "SupportMemory", quantity: "1" },
        ],
        missions: [
            {
                id: "10",
                type: "Mission::QuestClearMission::CountMission",
                mission_category_id: "1",
                name: "Clear the event",
                description: "Clear Stage 1.",
                priority: "10",
                orderer_id: "3",
                start_at: "2026-08-01 00:00:00",
                end_at: "2038-01-01 00:00:00",
                conditions: "{\"sugoroku_map_ids\":[1000]}",
                area_id: "1",
                z_battle_stage_id: "400",
            },
            { id: "11", conditions: "{\"mission_ids\":[10]}", area_id: "", z_battle_stage_id: "" },
            { id: "12", conditions: "{}", area_id: "", z_battle_stage_id: "" },
        ],
        passive_skill_sets: [{ id: "7" }],
        quest_category_bonus_groups: [{ id: "59", quest_category_bonus_type: "QuestCategoryBonus::Drop", name: "Bonus drops", description: "Official bonus description" }],
        quest_category_bonus_rarity_tables: [{ id: "60", rarity_n: "1", rarity_r: "2", rarity_sr: "3", rarity_ssr: "4", rarity_ur: "5", rarity_lr: "6" }],
        quest_category_bonuses: [{ id: "61", quest_id: "100", type: "QuestCategoryBonus::Drop", card_category_id: "9", quest_category_bonus_rarity_table_id: "60" }],
        quest_drop_item_views: [{ id: "62", quest_id: "100", difficulties: "[5]", item1_id: "77", item1_type: "TreasureItem", item2_id: "", item2_type: "", item3_id: "", item3_type: "", item4_id: "", item4_type: "", item5_id: "", item5_type: "", item6_id: "", item6_type: "" }],
        quests: [{ id: "100", area_id: "1", name: "Official Quest", start_at: "2026-08-01 00:00:00", boostable: "1", enable_sugoroku_auto: "1", enable_battle_auto: "0", can_ignore_difficulty_order: "1", enemy_info_display_type: "2", any_clear_bonus_stones: "1", all_clear_bonus_stones: "3", visit_count_max: "3", interval_reset_visited_days: "1" }],
        related_card_categories: [{ id: "70", enemy_skill_id: "200", card_category_id: "9" }],
        related_link_skills: [{ id: "71", enemy_skill_id: "200", link_skill_id: "8" }],
        related_optimal_awakenings: [],
        related_passive_skill_sets: [{ id: "72", enemy_skill_id: "200", passive_skill_set_id: "7" }],
        sugoroku_map_boss_drop_items: [{ id: "80", sugoroku_map_id: "1000", quest_id: "100", drop_type: "boss", item_id: "100", item_type: "Card", card_exp_init: "0" }],
        sugoroku_map_enemy_informations: [{ sugoroku_map_id: "1000", enemy_info: JSON.stringify({ display_type: "normal", battles: [{ rounds: [{ round_no: 1, comment: null, enemies: [{ card_id: 100, enemy_skill_ids: [200], enemy_round_skill_set_id: 300 }] }] }] }) }],
        sugoroku_map_puzzle_colors: [{ id: "6", weight_blue: "1", weight_green: "2", weight_purple: "3", weight_red: "4", weight_yellow: "5", weight_rainbow: "6" }],
        sugoroku_maps: [{ id: "1000", quest_id: "100", difficulty: "5", act: "25", eventkagi_num: "0", user_exp: "1234", zeni: "5678", link_skill_lv_up_prob_rate: "0.95", is_cpu_only: "0", sugoroku_bgm_id: "11", battle_bgm_id: "12", boss_bgm_id: "13", battle_background_id: "14", start_script_id: "15", finish_script_id: "16", dice_id: "17", sugoroku_map_puzzle_color_id: "6" }],
        treasure_items: [{ id: "77", name: "Official Treasure", image_suffix_number: "13" }],
        special_sets: [{ id: "91", name: "Official Super Attack", description: "Raises ATK and causes immense damage" }],
        special_views: [{ id: "92", special_category_id: "93" }],
        special_categories: [{ id: "93", raw_attribute: "1", name: "Ki Blast" }],
        z_battle_check_points: [{ id: "410", z_battle_stage_id: "400", level: "5", act: "3", eventkagi_num: "1", z_battle_normal_reward_table_group_id: "420", main_reward_id: "430" }],
        z_battle_enemies: [{ id: "401", z_battle_stage_id: "400", ordinal_num: "1", start_level: "1", end_level: "", base_hp: "1000000", base_attack: "50000", base_defence: "1000", hp_escalation_type: "1", attack_escalation_type: "1", defence_escalation_type: "1", special_attack_escalation_type: "1", card_escalation_type: "2", performance_escalation_type: "1", skill_escalation_type: "3" }],
        z_battle_enemy_card_escalations: [{ id: "402", escalation_type: "2", level: "1", card_id: "100" }],
        z_battle_enemy_skill_escalations: [{ id: "403", escalation_type: "3", level: "1", enemy_skill_id: "200" }],
        z_battle_enemy_status_escalations: [{ id: "404", escalation_type: "1", level: "1", escalation_value: "100" }],
        z_battle_first_reward_level_ranges: [{ id: "430", z_battle_stage_id: "400", level: "1", z_battle_first_reward_set_id: "440", main_reward_id: "450" }],
        z_battle_first_rewards: [{ id: "431", z_battle_first_reward_set_id: "440", item_id: "1", item_type: "Point::Stone", quantity: "1", card_exp_init: "0" }],
        z_battle_normal_reward_tables: [{ id: "421", z_battle_normal_reward_table_group_id: "420" }],
        z_battle_normal_rewards: [{ id: "422", z_battle_normal_reward_table_id: "421", item_id: "2", item_type: "AwakeningItem", quantity: "2", card_exp_init: "0" }],
        z_battle_powerup_thresholds: [{ id: "405", z_battle_stage_id: "400", hp: "10", atk: "20", def: "30", special_atk: "40" }],
        z_battle_stage_views: [{ id: "406", z_battle_stage_id: "400", enemy_name: "Z Enemy", enemy_nickname: "Nickname", enemy_resource_id: "1000" }],
        z_battle_stages: [{ id: "400", type: "ZBattleStage::Normal", z_battle_stage_effect_escalation_type: "8", priority: "9", banner_image_path: "z/banner.png", listbutton_image_path: "z/button.png", start_at: "2026-08-01 00:00:00", end_at: "", eventkagi_start_at: "2026-08-02 00:00:00", eventkagi_end_at: "", enable_battle_auto: "1", related_z_battle_stage_id: "", unlock_conditions: "{\"level\":30}" }],
    };
}

describe("Stage first-party candidate", () => {
    it("projects official topology, enemies, raw gimmicks, link rate and Support Memory stage links", () => {
        const candidate = buildStageFirstPartyCandidate({
            generatedAt: "2026-08-31T00:00:00.000Z",
            sourceSnapshotVersion: "1787900894",
            sourceDatabaseSha256: "a".repeat(64),
            tables: tables(),
        });

        equal(candidate.dataset.source, "dokkan-game-db");
        equal(candidate.dataset.count, 1);
        const stage = candidate.dataset.entries[0];
        equal(stage.linkSkillLevelUpRate, 0.95);
        equal(stage.enemies[0].stats?.status, "unavailable-in-game-db");
        equal(stage.enemies[0].hp, undefined);
        equal(stage.enemies[0].atk, undefined);
        equal(stage.enemies[0].def, undefined);
        equal(stage.enemies[0].thumbnailId, "1000");
        deepEqual(stage.enemies[0].superAttacks, [{
            id: "90",
            specialSetId: "91",
            name: "Official Super Attack",
            description: "Raises ATK and causes immense damage",
            style: "Normal",
            ki: 12,
            attackType: "Ki Blast",
        }]);
        equal(stage.enemies[0].skills[0].name, "Enemy Skill");
        equal(stage.enemies[0].skills[0].cutInPhrase, "You cannot win!");
        deepEqual(stage.enemies[0].skills[0].relatedCardCategoryIds, ["9"]);
        equal(stage.enemies[0].roundSkillSet?.effectDescription, "Round gimmick");
        deepEqual(stage.supportMemories, [
            { memoryId: "500", missionIds: ["10"], relation: "direct-stage-condition" },
            { memoryId: "501", missionIds: ["11"], relation: "transitive-mission-condition" },
        ]);
        deepEqual(candidate.dataset.supportMemoryRelations, [
            { memoryId: "500", targetKind: "area", targetId: "1", missionIds: ["10"], relation: "mission-owner" },
            { memoryId: "500", targetKind: "quest-level", targetId: "1000", missionIds: ["10"], relation: "direct-stage-condition" },
            { memoryId: "500", targetKind: "z-battle", targetId: "400", missionIds: ["10"], relation: "mission-owner" },
            { memoryId: "501", targetKind: "area", targetId: "1", missionIds: ["11"], relation: "transitive-mission-condition" },
            { memoryId: "501", targetKind: "quest-level", targetId: "1000", missionIds: ["11"], relation: "transitive-mission-condition" },
            { memoryId: "501", targetKind: "z-battle", targetId: "400", missionIds: ["11"], relation: "transitive-mission-condition" },
        ]);
        deepEqual(candidate.dataset.eventMissions, [{
            id: "10",
            areaId: "1",
            categoryId: "1",
            type: "Mission::QuestClearMission::CountMission",
            name: "Clear the event",
            description: "Clear Stage 1.",
            priority: 10,
            ordererId: 3,
            startsAt: "2026-08-01T00:00:00.000Z",
            endsAt: "2038-01-01T00:00:00.000Z",
            stageIds: ["1000"],
            rewards: [{ itemId: "500", itemType: "SupportMemory", quantity: 1 }],
        }]);
        equal(stage.bossDrops?.[0].chanceStatus, "unknown");
        equal(stage.bossDrops?.[0].name, "Enemy");
        equal(stage.bossDrops?.[0].thumbnailId, "1000");
        equal(stage.bossDrops?.[0].rarityRaw, 4);
        equal(stage.bossDrops?.[0].elementRaw, 3);
        equal(stage.bossDrops?.[0].detailCharacterId, "101");
        deepEqual(stage.dropPreviews, [{
            sourceRowId: "62",
            difficultyValues: [5],
            items: [{ itemId: "77", itemType: "TreasureItem", name: "Official Treasure", thumbnailId: "13" }],
        }]);
        equal(stage.chapter?.name, "Official Chapter");
        equal(stage.story?.name, "Official Story");
        equal(stage.mapPresentation?.puzzleColorWeights?.rainbow, 6);
        equal(candidate.audit.counts.supportMemoryRelations, 6);
        equal(candidate.audit.counts.eventMissions, 1);
        equal(candidate.audit.counts.enemySuperAttacks, 1);
        equal(candidate.audit.counts.supportMemoryQuestLevelLinks, 2);
        equal(candidate.audit.counts.supportMemoryAreaLinks, 2);
        equal(candidate.audit.counts.supportMemoryZBattleLinks, 2);
        equal(candidate.audit.counts.supportMemoryLinkedIds, 2);
        deepEqual(candidate.audit.unresolved.supportMemoryIdsWithoutStageLink, ["502"]);
    });

    it("preserves Z-Battle bases and curves without claiming the final formula", () => {
        const candidate = buildStageFirstPartyCandidate({
            generatedAt: "2026-08-31T00:00:00.000Z",
            sourceSnapshotVersion: "1787900894",
            sourceDatabaseSha256: "b".repeat(64),
            tables: tables(),
        });
        const zBattle = candidate.dataset.zBattles?.[0];
        equal(zBattle?.enemyRanges[0].stats.hp, 1000000);
        deepEqual(zBattle?.enemyRanges[0].stats.unknowns, ["application_formula", "curve_precedence", "runtime_modifiers"]);
        deepEqual(zBattle?.statusCurves, [{ escalationTypeId: "1", points: [{ level: 1, value: 100 }] }]);
        equal(zBattle?.cardEscalations[0].cardName, "Enemy");
        equal(zBattle?.skillEscalations[0].name, "Enemy Skill");
        equal(zBattle?.skillEscalations[0].description, "Seals Super Attack");
        equal(zBattle?.skillEscalations[0].effectTypeRaw, 10);
        deepEqual(zBattle?.skillEscalations[0].effectValues, [1, 0, 0]);
        deepEqual(zBattle?.checkpoints?.[0].repeatRewards, [{ itemId: "2", itemType: "AwakeningItem", quantity: 2, cardExpInitial: 0 }]);
        deepEqual(zBattle?.firstRewards?.[0].rewards, [{ itemId: "1", itemType: "Point::Stone", quantity: 1, cardExpInitial: 0 }]);
    });

    it("inherits presentation assets through the official related Z-Battle relation", () => {
        const linked = tables();
        linked.z_battle_stages.push({
            id: "700",
            type: "ZBattleStage::Super",
            z_battle_stage_effect_escalation_type: "700",
            priority: "10",
            banner_image_path: "",
            listbutton_image_path: "",
            start_at: "2026-09-01 00:00:00",
            end_at: "",
            eventkagi_start_at: "",
            eventkagi_end_at: "",
            enable_battle_auto: "1",
            related_z_battle_stage_id: "400",
            unlock_conditions: "{}",
        });

        const candidate = buildStageFirstPartyCandidate({
            generatedAt: "2026-09-02T00:00:00.000Z",
            sourceSnapshotVersion: "1787900894",
            sourceDatabaseSha256: "c".repeat(64),
            tables: linked,
        });
        const inherited = candidate.dataset.zBattles?.find(stage => stage.id === "700");

        equal(inherited?.banner?.sourcePath, "z/banner.png");
        equal(inherited?.listButton?.sourcePath, "z/button.png");
        equal(inherited?.relatedZBattleStageId, "400");
    });

    it("projects official treasure identity for boss drops", () => {
        const source = tables();
        source.sugoroku_map_boss_drop_items = [{
            id: "80",
            sugoroku_map_id: "1000",
            quest_id: "100",
            drop_type: "boss",
            item_id: "77",
            item_type: "TreasureItem",
            card_exp_init: "0",
        }];

        const candidate = buildStageFirstPartyCandidate({
            generatedAt: "2026-09-02T00:00:00.000Z",
            sourceSnapshotVersion: "1787900894",
            sourceDatabaseSha256: "d".repeat(64),
            tables: source,
        });

        equal(candidate.dataset.entries[0].bossDrops?.[0].name, "Official Treasure");
        equal(candidate.dataset.entries[0].bossDrops?.[0].thumbnailId, "13");
    });

    it("fails closed when a Stage reward references a missing official treasure", () => {
        const broken = tables();
        broken.treasure_items = [];
        throws(
            () => buildStageFirstPartyCandidate({
                generatedAt: "2026-09-02T00:00:00.000Z",
                sourceSnapshotVersion: "1787900894",
                sourceDatabaseSha256: "e".repeat(64),
                tables: broken,
            }),
            /missing treasure item 77/,
        );
    });

    it("fails closed when a related Z-Battle stage is missing", () => {
        const broken = tables();
        broken.z_battle_stages.push({
            id: "700",
            type: "ZBattleStage::Super",
            z_battle_stage_effect_escalation_type: "700",
            priority: "10",
            banner_image_path: "",
            listbutton_image_path: "",
            start_at: "2026-09-01 00:00:00",
            end_at: "",
            eventkagi_start_at: "",
            eventkagi_end_at: "",
            enable_battle_auto: "1",
            related_z_battle_stage_id: "999",
            unlock_conditions: "{}",
        });
        throws(
            () => buildStageFirstPartyCandidate({
                generatedAt: "2026-09-02T00:00:00.000Z",
                sourceSnapshotVersion: "1787900894",
                sourceDatabaseSha256: "f".repeat(64),
                tables: broken,
            }),
            /references missing related stage 999/,
        );
    });

    it("fails closed when an encounter references a missing official card", () => {
        const broken = tables();
        broken.cards = [];
        throws(() => buildStageFirstPartyCandidate({
            generatedAt: "2026-08-31T00:00:00.000Z",
            sourceSnapshotVersion: "1787900894",
            sourceDatabaseSha256: "c".repeat(64),
            tables: broken,
        }), /missing enemy card 100/);
    });

    it("accepts the official no-battle encounter shape without inventing enemies", () => {
        const noBattle = tables();
        noBattle.sugoroku_map_enemy_informations[0].enemy_info = '{"battles":null,"display_type":"none"}';
        const candidate = buildStageFirstPartyCandidate({
            generatedAt: "2026-08-31T00:00:00.000Z",
            sourceSnapshotVersion: "1787900894",
            sourceDatabaseSha256: "d".repeat(64),
            tables: noBattle,
        });
        deepEqual(candidate.dataset.entries[0].enemies, []);
    });

    it("fails closed for missing Z-Battle reward joins and cyclic mission dependencies", () => {
        const missingReward = tables();
        missingReward.z_battle_normal_rewards = [];
        throws(() => buildStageFirstPartyCandidate({
            generatedAt: "2026-08-31T00:00:00.000Z",
            sourceSnapshotVersion: "1787900894",
            sourceDatabaseSha256: "e".repeat(64),
            tables: missingReward,
        }), /normal reward table 421 has no rewards/);

        const cyclic = tables();
        cyclic.missions[0].conditions = '{"mission_ids":[11]}';
        throws(() => buildStageFirstPartyCandidate({
            generatedAt: "2026-08-31T00:00:00.000Z",
            sourceSnapshotVersion: "1787900894",
            sourceDatabaseSha256: "f".repeat(64),
            tables: cyclic,
        }), /Mission dependency cycle/);
    });
});
