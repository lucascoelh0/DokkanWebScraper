"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = require("assert");
const fyi_awakening_paths_1 = require("./fyi-awakening-paths");
describe("mapAwakeningPathStepFromFyi", () => {
    it("maps awakening path steps with medal requirements", () => {
        const mapped = (0, fyi_awakening_paths_1.mapAwakeningPathStepFromFyi)({
            id: 6859,
            character_id: 1029450,
            character: {
                id: 1029450,
                canonical_id: 97,
                base_character_id: 1029450,
                character_id: 1420,
                name: "Super Saiyan Gohan (Teen)",
                rarity: 3,
                rarity_text: "SSR",
                type: 3,
                type_text: "STR",
                awakening_type: 1,
                awakening_type_text: "Super",
                thumbnail_id: 1029450,
                has_eza: false,
                has_seza: false,
                is_reversibly_exchanged: false,
                is_freely_obtainable: false,
                release_dates: { latest_type: "initial" },
            },
            awakened_character_id: 1029451,
            awakened_character: {
                id: 1029451,
                canonical_id: 97,
                base_character_id: 1029451,
                character_id: 1420,
                name: "Super Saiyan Gohan (Teen)",
                rarity: 4,
                rarity_text: "UR",
                type: 3,
                type_text: "STR",
                awakening_type: 1,
                awakening_type_text: "Super",
                thumbnail_id: 1029450,
                has_eza: false,
                has_seza: false,
                is_reversibly_exchanged: false,
                is_freely_obtainable: false,
                release_dates: { latest_type: "initial" },
            },
            type: "Z",
            eza_type: 0,
            requirements: [
                {
                    id: 11,
                    quantity: 50,
                    order: 1,
                    awakening_medal_id: 1,
                    awakening_medal: {
                        id: 1,
                        name: "Gregory",
                        description: "A common, easily obtained Awakening Medal.",
                        rarity: 0,
                        zeni: 500,
                        trade_points: 1,
                    },
                },
            ],
        });
        (0, assert_1.equal)(mapped.id, "6859");
        (0, assert_1.equal)(mapped.type, "Z");
        (0, assert_1.equal)(mapped.character?.name, "Super Saiyan Gohan (Teen)");
        (0, assert_1.equal)(mapped.awakenedCharacterId, "1029451");
        (0, assert_1.equal)(mapped.requirements[0].awakeningMedalId, "1");
        (0, assert_1.equal)(mapped.requirements[0].quantity, 50);
        (0, assert_1.equal)(mapped.requirements[0].awakeningMedal?.name, "Gregory");
    });
});
describe("mapCharacterAwakeningPathFromFyi", () => {
    it("wraps a character summary around the mapped step list", () => {
        const mapped = (0, fyi_awakening_paths_1.mapCharacterAwakeningPathFromFyi)({
            id: 1029471,
            canonical_id: 97,
            base_character_id: 1029471,
            character_id: 1420,
            name: "Super Saiyan Gohan (Teen)",
            rarity: 5,
            rarity_text: "LR",
            type: 3,
            type_text: "STR",
            awakening_type: 1,
            awakening_type_text: "Super",
            thumbnail_id: 1029470,
            has_eza: false,
            has_seza: false,
            is_reversibly_exchanged: false,
            is_freely_obtainable: false,
            release_dates: { latest_type: "initial" },
        }, [
            {
                id: 6861,
                type: "Dokkan",
                requirements: [],
            },
        ]);
        (0, assert_1.equal)(mapped.characterId, "1029471");
        (0, assert_1.equal)(mapped.name, "Super Saiyan Gohan (Teen)");
        (0, assert_1.equal)(mapped.steps.length, 1);
        (0, assert_1.equal)(mapped.steps[0].type, "Dokkan");
    });
});
describe("mapAwakeningMedalFromFyi", () => {
    it("maps medal sources and usages into a stable auxiliary contract", () => {
        const mapped = (0, fyi_awakening_paths_1.mapAwakeningMedalFromFyi)({
            id: 100874,
            name: "Super Saiyan Trunks (Teen) [Rainbow]",
            description: "Special Extreme Z-Battle medal.",
            rarity: 4,
            zeni: 500000,
            trade_points: 0,
            z_battle: {
                id: 67,
                name: null,
                type: "ZBattleStage::Normal",
                chapter: null,
                images: {
                    header: null,
                    banner: "banners/en/event/eve_banner/zbattle_list_banner_67.png",
                    button: "banners/en/event/eve_listbutton/myp_banner_event_zbattle_067.png",
                },
            },
            stages: [],
            baba_shop_sales: [],
            world_tournaments: [],
            awakenings_awakening_items: [
                {
                    id: 999,
                    item_id: 100874,
                    quantity: 15,
                    order: 1,
                    awakenings: [
                        {
                            id: 123,
                            character_id: 1008741,
                            character: {
                                id: 1008741,
                                canonical_id: 500,
                                base_character_id: 1008741,
                                character_id: 500,
                                name: "Super Saiyan Trunks (Teen)",
                                rarity: 4,
                                rarity_text: "UR",
                                type: 0,
                                type_text: "AGL",
                                awakening_type: 1,
                                awakening_type_text: "Super",
                                thumbnail_id: 1008740,
                                has_eza: true,
                                has_seza: false,
                                is_reversibly_exchanged: false,
                                is_freely_obtainable: false,
                                release_dates: { latest_type: "eza" },
                            },
                            awakened_character_id: 1008741,
                            type: "Extreme Z",
                            eza_type: 1,
                            eza_step: 1,
                        },
                    ],
                },
            ],
        });
        (0, assert_1.equal)(mapped.id, "100874");
        (0, assert_1.equal)(mapped.name, "Super Saiyan Trunks (Teen) [Rainbow]");
        (0, assert_1.equal)(mapped.zBattle?.id, "67");
        (0, assert_1.equal)(mapped.zBattle?.type, "ZBattleStage::Normal");
        (0, assert_1.equal)(mapped.usages[0].quantity, 15);
        (0, assert_1.equal)(mapped.usages[0].awakenings[0].type, "Extreme Z");
        (0, assert_1.equal)(mapped.usages[0].awakenings[0].character?.latestReleaseType, "eza");
    });
});
describe("awakening dataset builders", () => {
    it("wraps path and medal collections with top-level counts", () => {
        const paths = (0, fyi_awakening_paths_1.buildAwakeningPathDataset)([
            {
                characterId: "1029471",
                canonicalId: "97",
                baseCharacterId: "1029471",
                name: "Super Saiyan Gohan (Teen)",
                steps: [],
            },
        ]);
        const medals = (0, fyi_awakening_paths_1.buildAwakeningMedalDataset)([
            {
                id: "1",
                name: "Gregory",
                usages: [],
                stages: [],
                babaShopSales: [],
                worldTournaments: [],
            },
        ]);
        (0, assert_1.deepEqual)({
            pathCount: paths.count,
            medalCount: medals.count,
            firstPath: paths.paths[0].characterId,
            firstMedal: medals.medals[0].id,
        }, {
            pathCount: 1,
            medalCount: 1,
            firstPath: "1029471",
            firstMedal: "1",
        });
    });
});
//# sourceMappingURL=fyi-awakening-paths.spec.js.map