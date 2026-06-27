import { deepEqual, equal } from "assert";
import { describe, it } from "mocha";
import {
    buildZBattleDataset,
    mapMissionCategoryFromFyi,
    mapRewardFromFyi,
    mapZBattleFromFyi,
    mapZBattlePhaseFromFyi,
} from "./fyi-z-battles";

describe("mapRewardFromFyi", function () {
    it("maps reward payloads into a flat contract shape", () => {
        const reward = mapRewardFromFyi({
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
        } as any);

        equal(reward.itemType, "AwakeningItem");
        equal(reward.itemId, "100715");
        equal(reward.quantity, 3);
        equal(reward.name, "Cooler (Final Form) [SUPER]");
        equal(reward.rarity, 4);
    });
});

describe("mapMissionCategoryFromFyi", function () {
    it("flattens mission reward slots into a reward list", () => {
        const missionCategory = mapMissionCategoryFromFyi({
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
        } as any);

        equal(missionCategory.id, "3728");
        equal(missionCategory.endsAt, "2038-01-01T00:00:00.000Z");
        equal(missionCategory.isIndefinite, true);
        equal(missionCategory.rewards.length, 2);
        equal(missionCategory.rewards[0].itemType, "Point::Stone");
        equal(missionCategory.rewards[1].name, "Cooler (Final Form) [SUPER]");
    });
});

describe("mapZBattlePhaseFromFyi", function () {
    it("maps phase payloads into level, reward, and character structures", () => {
        const phase = mapZBattlePhaseFromFyi({
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
            } as any,
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
            ] as any,
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
            ] as any,
        });

        equal(phase.id, "205");
        equal(phase.kind, "normal");
        equal(phase.images.bannerUrl, "https://cdn.dokkan.fyi/assets/banners/en/event/eve_banner/zbattle_list_banner_205.png");
        equal(phase.beneficialItems[0].categories[0].name, "Final Trump Card");
        equal(phase.ezaCharacters[0].name, "Cooler (Final Form)");
        equal(phase.beneficialCharacters[0].leaderSkillName, "Thousandfold Plea");
        equal(phase.levels[0].enemyCard?.rarity, "LR");
        equal(phase.levels[0].firstRewards[0].rewardType, "Dragon Stone");
        equal(phase.rewardCheckpoints[0].rewards[0].name, "Turles [Bronze]");
        equal(phase.missionCategories[0].rewards[0].itemType, "Point::Stone");
    });
});

describe("mapZBattleFromFyi", function () {
    it("keeps super stage data even when has_super is false on the base stage", () => {
        const battle = mapZBattleFromFyi({
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
        } as any, 55);

        equal(battle.id, "55");
        equal(battle.hasSuperStage, true);
        deepEqual(battle.phases.map(phase => phase.kind), ["normal", "super"]);
    });
});

describe("buildZBattleDataset", function () {
    it("wraps battles with dataset metadata and sorts by id descending", () => {
        const dataset = buildZBattleDataset([
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
        ] as any);

        equal(dataset.count, 2);
        deepEqual(dataset.battles.map(battle => battle.id), ["205", "55"]);
    });
});
