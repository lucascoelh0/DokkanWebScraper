"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = require("assert");
const fyi_dokkan_frontier_1 = require("./fyi-dokkan-frontier");
describe("mapFrontierSeriesSummaryFromFyi", () => {
    it("maps chapter summaries under a frontier series", () => {
        const mapped = (0, fyi_dokkan_frontier_1.mapFrontierSeriesSummaryFromFyi)({
            id: 2,
            name: "Dragon Ball Z",
            banner_image_path: "origin/series_banner_02.png",
            priority: 10,
            chapters: [
                {
                    id: 2001,
                    name: "Planet Namek Saga",
                    banner_image_path: "origin/chapter_2001.png",
                    priority: 10,
                },
            ],
        });
        (0, assert_1.deepEqual)(mapped, {
            id: "2",
            name: "Dragon Ball Z",
            bannerImagePath: "origin/series_banner_02.png",
            priority: 10,
            chapterCount: 1,
            chapters: [
                {
                    id: "2001",
                    name: "Planet Namek Saga",
                    bannerImagePath: "origin/chapter_2001.png",
                    priority: 10,
                },
            ],
        });
    });
});
describe("mapFrontierRewardFromFyi", () => {
    it("keeps frontier-specific reward fields like card skin scene links", () => {
        const mapped = (0, fyi_dokkan_frontier_1.mapFrontierRewardFromFyi)({
            id: 55289,
            item_id: 1,
            item_type: "CardSkinItem",
            quantity: 1,
            mission_id: 32185,
            item: {
                id: 1,
                card_id: 1029571,
                step: 1,
                name: "Vegeta Skin",
                description: "Unlock from Node 2.",
                link_to: "internal:OriginMapScene?episode=2001&battle=20010102",
                bgm_id: 17,
            },
        });
        (0, assert_1.deepEqual)(mapped, {
            id: "55289",
            missionId: "32185",
            itemId: "1",
            itemType: "CardSkinItem",
            quantity: 1,
            name: "Vegeta Skin",
            description: "Unlock from Node 2.",
            rarity: undefined,
            zeni: undefined,
            tradePoints: undefined,
            rewardType: undefined,
            amount: undefined,
            cardId: "1029571",
            step: 1,
            linkTo: "internal:OriginMapScene?episode=2001&battle=20010102",
            bgmId: "17",
        });
    });
});
describe("mapFrontierMissionFromFyi", () => {
    it("normalizes mission copy and rewards", () => {
        const mapped = (0, fyi_dokkan_frontier_1.mapFrontierMissionFromFyi)({
            id: 32176,
            type: "Mission::OriginBattleClearMission::ClearAllOriginBattlesMission",
            name: "Clear Nodes 1 to 11 of \n\"Planet Namek Saga\".",
            description: "Clear Nodes 1 to 11!<br /><br />Rewards go to your Gift Box.",
            priority: 10,
            starts_at: "2026-03-17T08:00:00.000000Z",
            ends_at: "2038-01-01T00:00:00.000000Z",
            category_id: 200101,
            rewards: [
                {
                    id: 55284,
                    item_id: 11,
                    item_type: "Point::Stone",
                    quantity: 5,
                    mission_id: 32176,
                    item: {
                        id: 11,
                        type: "Dragon Stone",
                        amount: 1,
                    },
                },
            ],
            characters: [],
        });
        (0, assert_1.equal)(mapped.id, "32176");
        (0, assert_1.equal)(mapped.name, "Clear Nodes 1 to 11 of\n\"Planet Namek Saga\".");
        (0, assert_1.equal)(mapped.description, "Clear Nodes 1 to 11!\nRewards go to your Gift Box.");
        (0, assert_1.equal)(mapped.categoryId, "200101");
        (0, assert_1.equal)(mapped.rewards[0].itemType, "Point::Stone");
        (0, assert_1.equal)(mapped.rewards[0].amount, 1);
    });
});
describe("mapFrontierNodeFromFyi", () => {
    it("maps node restrictions, rounds and local missions", () => {
        const mapped = (0, fyi_dokkan_frontier_1.mapFrontierNodeFromFyi)({
            id: 20010102,
            stamina: 12,
            user_exp: 9000,
            zeni: 50000,
            auto_enabled: true,
            link_skill_level_up_rate: 0.5,
            is_special_node: false,
            unlock_missions: [
                {
                    id: 32181,
                    description: "Deliver the final blow with Vegeta's Active Skill.",
                },
            ],
            required_characters: [
                {
                    id: 1022941,
                    canonical_id: 634,
                    base_character_id: 1022941,
                    character_id: 1201,
                    name: "Krillin & Gohan (Kid)",
                    rarity: 5,
                    rarity_text: "LR",
                    type: 0,
                    type_text: "AGL",
                    awakening_type: 1,
                    awakening_type_text: "Super",
                    thumbnail_id: 1022940,
                    has_eza: true,
                    has_seza: false,
                    is_reversibly_exchanged: false,
                    is_freely_obtainable: false,
                    release_dates: { latest_type: "eza" },
                },
            ],
            intensity_effects: [
                {
                    level: 1,
                    skill: {
                        id: 1,
                        name: "Ki Disruption",
                        description: "Ki obtained -1",
                        efficacy_type: 1000,
                        eff_value1: 1,
                    },
                },
            ],
            enemy_information: {
                rounds: [
                    {
                        round_no: 1,
                        enemies: [
                            {
                                card: {
                                    id: 1000791,
                                    canonical_id: 53,
                                    base_character_id: 1000791,
                                    character_id: 53,
                                    name: "Frieza Soldier",
                                    rarity: 1,
                                    rarity_text: "R",
                                    type: 1,
                                    type_text: "TEQ",
                                    awakening_type: 2,
                                    awakening_type_text: "Extreme",
                                    thumbnail_id: 1000790,
                                    has_eza: false,
                                    has_seza: false,
                                    is_reversibly_exchanged: false,
                                    is_freely_obtainable: true,
                                    release_dates: { latest_type: "initial" },
                                },
                                skills: [
                                    {
                                        id: 600040,
                                        name: "Damage Reduction",
                                        description: "Reduces damage received",
                                    },
                                ],
                            },
                        ],
                    },
                ],
            },
            missions: [
                {
                    id: 32185,
                    type: "Mission::QuestAndZBattleClearMission::CountMission",
                    name: "Activate Vegeta's Active Skill and clear Node 2.",
                    description: "Activate it and clear Node 2!",
                    rewards: [],
                    characters: [],
                    priority: 10,
                    starts_at: "2026-03-17T08:00:00.000000Z",
                    ends_at: "2038-01-01T00:00:00.000000Z",
                    category_id: 200101,
                },
            ],
        });
        (0, assert_1.equal)(mapped.id, "20010102");
        (0, assert_1.equal)(mapped.unlockMissions[0].id, "32181");
        (0, assert_1.equal)(mapped.requiredCharacters[0].name, "Krillin & Gohan (Kid)");
        (0, assert_1.equal)(mapped.requiredCharacters[0].latestReleaseType, "eza");
        (0, assert_1.equal)(mapped.intensityEffects[0].skill?.name, "Ki Disruption");
        (0, assert_1.equal)(mapped.rounds[0].enemies[0].character?.name, "Frieza Soldier");
        (0, assert_1.equal)(mapped.rounds[0].enemies[0].skills[0].name, "Damage Reduction");
        (0, assert_1.equal)(mapped.missions[0].id, "32185");
    });
});
describe("mapFrontierChapterFromFyi", () => {
    it("keeps pages, group exchange steps and chapter missions together", () => {
        const mapped = (0, fyi_dokkan_frontier_1.mapFrontierChapterFromFyi)({
            component: "DokkanFrontier/ChapterShow",
            props: {
                series: {
                    id: 2,
                    name: "Dragon Ball Z",
                    banner_image_path: "origin/series_banner_02.png",
                    priority: 10,
                    chapters: [],
                },
                chapter: {
                    id: 2001,
                    name: "Planet Namek Saga",
                    banner_image_path: "origin/chapter_2001.png",
                    priority: 10,
                    pages: [
                        {
                            id: 200101,
                            page_number: 1,
                            background_image_path: "origin/bg_1.png",
                            nodes: [],
                        },
                    ],
                },
                group_exchange: [
                    {
                        charge: 1,
                        description: "Performs a Group Exchange",
                    },
                ],
                chapter_missions: [
                    {
                        id: 32176,
                        type: "Mission::OriginBattleClearMission::ClearAllOriginBattlesMission",
                        name: "Clear Nodes 1 to 11.",
                        description: "Clear them all!",
                        rewards: [],
                        characters: [],
                        priority: 10,
                        starts_at: "2026-03-17T08:00:00.000000Z",
                        ends_at: "2038-01-01T00:00:00.000000Z",
                        category_id: 200101,
                    },
                ],
            },
        });
        (0, assert_1.equal)(mapped.seriesId, "2");
        (0, assert_1.equal)(mapped.seriesName, "Dragon Ball Z");
        (0, assert_1.equal)(mapped.pages[0].id, "200101");
        (0, assert_1.equal)(mapped.groupExchange[0].charge, 1);
        (0, assert_1.equal)(mapped.chapterMissions[0].id, "32176");
    });
});
describe("frontier dataset builders", () => {
    it("wraps series and chapter metadata with counts", () => {
        const seriesDataset = (0, fyi_dokkan_frontier_1.buildDokkanFrontierSeriesDataset)([
            {
                id: "2",
                name: "Dragon Ball Z",
                bannerImagePath: "origin/series_banner_02.png",
                priority: 10,
                chapterCount: 1,
                chapters: [
                    {
                        id: "2001",
                        name: "Planet Namek Saga",
                        bannerImagePath: "origin/chapter_2001.png",
                        priority: 10,
                    },
                ],
            },
        ]);
        const chaptersDataset = (0, fyi_dokkan_frontier_1.buildDokkanFrontierChaptersDataset)([
            {
                id: "2001",
                seriesId: "2",
                seriesName: "Dragon Ball Z",
                name: "Planet Namek Saga",
                bannerImagePath: "origin/chapter_2001.png",
                priority: 10,
                pages: [
                    {
                        id: "200101",
                        pageNumber: 1,
                        backgroundImagePath: "origin/bg_1.png",
                        nodes: [
                            {
                                id: "20010101",
                                unlockMissions: [],
                                requiredCharacters: [],
                                intensityEffects: [],
                                rounds: [],
                                missions: [
                                    {
                                        id: "32185",
                                        name: "Mission",
                                        description: "Description",
                                        rewards: [],
                                        characters: [],
                                    },
                                ],
                            },
                        ],
                    },
                ],
                groupExchange: [],
                chapterMissions: [
                    {
                        id: "32176",
                        name: "Chapter Mission",
                        description: "Description",
                        rewards: [],
                        characters: [],
                    },
                ],
            },
        ]);
        (0, assert_1.equal)(seriesDataset.count, 1);
        (0, assert_1.equal)(chaptersDataset.chapterCount, 1);
        (0, assert_1.equal)(chaptersDataset.pageCount, 1);
        (0, assert_1.equal)(chaptersDataset.nodeCount, 1);
        (0, assert_1.equal)(chaptersDataset.missionCount, 2);
    });
});
//# sourceMappingURL=fyi-dokkan-frontier.spec.js.map