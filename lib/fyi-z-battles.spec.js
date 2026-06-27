"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = require("assert");
const mocha_1 = require("mocha");
const fyi_z_battles_1 = require("./fyi-z-battles");
(0, mocha_1.describe)("mapRewardFromFyi", function () {
    (0, mocha_1.it)("maps reward payloads into a flat contract shape", () => {
        const reward = (0, fyi_z_battles_1.mapRewardFromFyi)({
            id: 205000,
            item_type: "AwakeningItem",
            quantity: 3,
            item: {
                id: 100715,
                name: "Cooler (Final Form) [SUPER]",
                description: "Character-specific Medal required for Awakening.",
                rarity: 4,
                zeni: 1300000,
            },
        });
        (0, assert_1.equal)(reward.itemType, "AwakeningItem");
        (0, assert_1.equal)(reward.itemId, "100715");
        (0, assert_1.equal)(reward.quantity, 3);
        (0, assert_1.equal)(reward.name, "Cooler (Final Form) [SUPER]");
        (0, assert_1.equal)(reward.rarity, 4);
    });
});
(0, mocha_1.describe)("mapMissionCategoryFromFyi", function () {
    (0, mocha_1.it)("flattens mission reward slots into a reward list", () => {
        const missionCategory = (0, fyi_z_battles_1.mapMissionCategoryFromFyi)({
            id: 3728,
            type: "MissionCategory::ExtraMissionCategory",
            ends_at: "2038-01-01 00:00:00",
            is_indefinite: 1,
            reward: {
                item1_type: "Point::Stone",
                item1: {
                    id: 11,
                    type: "Dragon Stone",
                    amount: 1,
                },
                item2_type: "AwakeningItem",
                item2: {
                    id: 100715,
                    name: "Cooler (Final Form) [SUPER]",
                    description: "Character-specific Medal required for Awakening.",
                    rarity: 4,
                    zeni: 1300000,
                },
            },
            priority: 10728,
            missions_count: 3,
        });
        (0, assert_1.equal)(missionCategory.id, "3728");
        (0, assert_1.equal)(missionCategory.endsAt, "2038-01-01T00:00:00.000Z");
        (0, assert_1.equal)(missionCategory.isIndefinite, true);
        (0, assert_1.equal)(missionCategory.rewards.length, 2);
        (0, assert_1.equal)(missionCategory.rewards[0].itemType, "Point::Stone");
        (0, assert_1.equal)(missionCategory.rewards[1].name, "Cooler (Final Form) [SUPER]");
    });
});
(0, mocha_1.describe)("mapZBattlePhaseFromFyi", function () {
    (0, mocha_1.it)("maps phase payloads into level, reward, and character structures", () => {
        const phase = (0, fyi_z_battles_1.mapZBattlePhaseFromFyi)({
            kind: "normal",
            phase: {
                id: 205,
                type: "ZBattleStage::Normal",
                images: {
                    banner: "banners/en/event/eve_banner/zbattle_list_banner_205.png",
                    button: "banners/en/event/eve_listbutton/myp_banner_event_zbattle_205.png",
                },
                beneficial_items: [
                    {
                        efficacy_type: 3,
                        label: "Effective When Attacking",
                        categories: [{ id: 46, name: "Final Trump Card" }],
                        link_skills: [],
                    },
                ],
                eza_characters: [
                    {
                        id: 1009091,
                        canonical_id: 142,
                        base_character_id: 1009091,
                        name: "Cooler (Final Form)",
                        rarity_text: "UR",
                        type_text: "PHY",
                        awakening_type_text: "Extreme",
                        thumbnail_id: 1009090,
                    },
                ],
                enemies: [],
                check_points: [
                    {
                        id: 205000,
                        level: 5,
                        normal_reward_tables: [
                            {
                                normal_rewards: [
                                    {
                                        id: 205000,
                                        item_type: "AwakeningItem",
                                        quantity: 1,
                                        item: {
                                            id: 103001,
                                            name: "Turles [Bronze]",
                                        },
                                    },
                                ],
                            },
                        ],
                    },
                ],
            },
            levels: [
                {
                    level: 1,
                    enemy_card: {
                        id: 1032521,
                        canonical_id: 752,
                        base_character_id: 1032521,
                        name: "Goku",
                        rarity_text: "LR",
                        type_text: "STR",
                        awakening_type: 1,
                        thumbnail_id: 1032520,
                        has_seza: true,
                        leader_skill: {
                            name: "Thousandfold Plea",
                        },
                    },
                    hp: 100,
                    atk: 200,
                    def: 300,
                    skills: [
                        {
                            id: 205000,
                            type: 7,
                            values: [35, null, null],
                            target: 0,
                            calculation: 0,
                            turns: 0,
                            chance: 0,
                            transformation: {
                                description: null,
                            },
                            script_name: null,
                            name: "Damage Reduction (All)",
                            description: "Reduces damage received by 35%",
                        },
                    ],
                    first_rewards: [
                        {
                            item_type: "Point::Stone",
                            quantity: 1,
                            item: {
                                id: 11,
                                type: "Dragon Stone",
                                amount: 1,
                            },
                        },
                    ],
                },
            ],
            beneficialCharacters: [
                {
                    id: 1032521,
                    canonical_id: 752,
                    base_character_id: 1032521,
                    name: "Goku",
                    rarity_text: "LR",
                    type_text: "STR",
                    awakening_type: 1,
                    thumbnail_id: 1032520,
                    has_seza: true,
                    leader_skill: {
                        name: "Thousandfold Plea",
                    },
                },
            ],
            missionCategories: [
                {
                    id: 3728,
                    type: "MissionCategory::ExtraMissionCategory",
                    is_indefinite: 1,
                    reward: {
                        item1_type: "Point::Stone",
                        item1: {
                            id: 11,
                            type: "Dragon Stone",
                            amount: 1,
                        },
                    },
                },
            ],
        });
        (0, assert_1.equal)(phase.id, "205");
        (0, assert_1.equal)(phase.kind, "normal");
        (0, assert_1.equal)(phase.images.bannerUrl, "https://cdn.dokkan.fyi/assets/banners/en/event/eve_banner/zbattle_list_banner_205.png");
        (0, assert_1.equal)(phase.beneficialItems[0].categories[0].name, "Final Trump Card");
        (0, assert_1.equal)(phase.ezaCharacters[0].name, "Cooler (Final Form)");
        (0, assert_1.equal)(phase.beneficialCharacters[0].leaderSkillName, "Thousandfold Plea");
        (0, assert_1.equal)(phase.levels[0].enemyCard?.rarity, "LR");
        (0, assert_1.equal)(phase.levels[0].firstRewards[0].rewardType, "Dragon Stone");
        (0, assert_1.equal)(phase.rewardCheckpoints[0].rewards[0].name, "Turles [Bronze]");
        (0, assert_1.equal)(phase.missionCategories[0].rewards[0].itemType, "Point::Stone");
    });
});
(0, mocha_1.describe)("mapZBattleFromFyi", function () {
    (0, mocha_1.it)("keeps super stage data even when has_super is false on the base stage", () => {
        const battle = (0, fyi_z_battles_1.mapZBattleFromFyi)({
            props: {
                stage: {
                    id: 55,
                    name: "Cooler (Final Form)",
                    nickname: "Open the Gates of Hell",
                    has_super: false,
                    type: "ZBattleStage::Normal",
                    images: {},
                    enemies: [],
                    check_points: [],
                    beneficial_items: [],
                    eza_characters: [],
                },
                levels: [],
                beneficialCharacters: {
                    data: [],
                },
                superStage: {
                    id: 728,
                    name: "Cooler (Final Form)",
                    nickname: "Open the Gates of Hell",
                    has_super: false,
                    type: "ZBattleStage::Super",
                    images: {},
                    enemies: [],
                    check_points: [],
                    beneficial_items: [],
                    eza_characters: [],
                },
                superLevels: [],
                superBeneficialCharacters: {
                    data: [],
                },
                missionCategories: [],
                superMissionCategories: [],
            },
        }, 55);
        (0, assert_1.equal)(battle.id, "55");
        (0, assert_1.equal)(battle.hasSuperStage, true);
        (0, assert_1.deepEqual)(battle.phases.map(phase => phase.kind), ["normal", "super"]);
    });
});
(0, mocha_1.describe)("buildZBattleDataset", function () {
    (0, mocha_1.it)("wraps battles with dataset metadata and sorts by id descending", () => {
        const dataset = (0, fyi_z_battles_1.buildZBattleDataset)([
            {
                id: "55",
                name: "Older Battle",
                nickname: "",
                sourceUrl: "https://dokkan.fyi/z-battles/55",
                hasSuperStage: false,
                phases: [],
            },
            {
                id: "205",
                name: "Newer Battle",
                nickname: "",
                sourceUrl: "https://dokkan.fyi/z-battles/205",
                hasSuperStage: false,
                phases: [],
            },
        ]);
        (0, assert_1.equal)(dataset.count, 2);
        (0, assert_1.deepEqual)(dataset.battles.map(battle => battle.id), ["205", "55"]);
    });
});
//# sourceMappingURL=fyi-z-battles.spec.js.map