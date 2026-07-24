"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = require("assert");
const fyi_stage_details_1 = require("./fyi-stage-details");
describe("dokkan.fyi stage details", () => {
    it("merges stage ids from events, quest story, and support-memory acquisitions", () => {
        (0, assert_1.deepEqual)((0, fyi_stage_details_1.collectStageDetailIds)({
            eventStageIds: ["17380223", "17380223"],
            questStageIds: [10000, "10001"],
            supportMemoryStageIds: ["17380223", "9230012", "invalid"],
        }), ["17380223", "10000", "10001", "9230012"]);
    });
    it("keeps stage ids from support-memory navigation targets", () => {
        (0, assert_1.deepEqual)((0, fyi_stage_details_1.collectStageDetailIds)({
            supportMemoryStageIds: ["3710090", "3710092"],
        }), ["3710090", "3710092"]);
    });
    it("normalizes stage metadata, enemies, skills, and image sources", () => {
        const stage = (0, fyi_stage_details_1.mapStageDetailFromFyi)({
            id: 17380223,
            difficulty: "SUPER",
            stamina: 0,
            required_keys: 2,
            rank_exp: 0,
            zeni: 0,
            link_skill_level_up_rate: 0,
            quest_id: 1738022,
            quest: {
                id: 1738022,
                name: "Gathering of Super Warriors Edition Stage 1",
                start_date: "2026-06-11 05:00:00",
                area_id: 1738,
                area: {
                    id: 1738,
                    name: "Supreme Magnificent Battle",
                    type: "Event",
                    images: {
                        header: "banners/en/event/eve_header/quest_top_banner_1738.png",
                        banner: "banners/en/event/eve_banner/quest_list_banner_1738.png",
                        button: "banners/en/event/eve_listbutton/myp_banner_event_1738.png",
                    },
                },
            },
            enemies: [
                {
                    id: 7101,
                    battle: 0,
                    tile: 2,
                    character_id: 9126981,
                    character: {
                        name: "Goku (Youth)",
                        rarity_text: "UR",
                        type_text: "TEQ",
                        thumbnail_id: 1026980,
                    },
                    hp: 10000000,
                    atk: 230000,
                    def: 195000,
                    skills: [
                        {
                            type: 7,
                            values: [55, null, null],
                            name: "Damage Reduction",
                            description: "Reduces damage received",
                        },
                    ],
                    turn_attacks: 6,
                },
            ],
        });
        (0, assert_1.equal)(stage.id, "17380223");
        (0, assert_1.equal)(stage.areaName, "Supreme Magnificent Battle");
        (0, assert_1.equal)(stage.questName, "Gathering of Super Warriors Edition Stage 1");
        (0, assert_1.equal)(stage.enemies[0].name, "Goku (Youth)");
        (0, assert_1.equal)(stage.enemies[0].portrait?.remoteUrl, "https://cdn.dokkan.fyi/assets/en/character/thumb/card_1026980_thumb/card_1026980_thumb.png");
        (0, assert_1.deepEqual)(stage.enemies[0].skills[0].values, [55, null, null]);
        (0, assert_1.equal)(stage.images.banner?.remoteUrl, "https://cdn.dokkan.fyi/assets/banners/en/event/eve_banner/quest_list_banner_1738.png");
    });
    it("assigns stable local asset keys without duplicating shared portraits", () => {
        const localized = (0, fyi_stage_details_1.localizeStageDetailAssets)({
            generatedAt: "2026-07-24T00:00:00.000Z",
            source: "dokkan.fyi",
            count: 2,
            entries: [
                {
                    id: "1",
                    difficulty: "SUPER",
                    stamina: 0,
                    requiredKeys: 0,
                    rankExp: 0,
                    zeni: 0,
                    linkSkillLevelUpRate: 0,
                    questId: "10",
                    questName: "Stage 1",
                    areaId: "20",
                    areaName: "Event",
                    areaType: "Event",
                    images: {
                        banner: { remoteUrl: "https://cdn.example/banner.png" },
                    },
                    enemies: [{
                            id: "1",
                            battle: 0,
                            tile: 0,
                            characterId: "2",
                            name: "Enemy",
                            thumbnailId: "2",
                            portrait: { remoteUrl: "https://cdn.example/portrait.png" },
                            hp: 1,
                            atk: 1,
                            def: 1,
                            skills: [],
                        }],
                },
                {
                    id: "2",
                    difficulty: "SUPER",
                    stamina: 0,
                    requiredKeys: 0,
                    rankExp: 0,
                    zeni: 0,
                    linkSkillLevelUpRate: 0,
                    questId: "10",
                    questName: "Stage 2",
                    areaId: "20",
                    areaName: "Event",
                    areaType: "Event",
                    images: {},
                    enemies: [{
                            id: "2",
                            battle: 0,
                            tile: 0,
                            characterId: "2",
                            name: "Enemy",
                            thumbnailId: "2",
                            portrait: { remoteUrl: "https://cdn.example/portrait.png" },
                            hp: 1,
                            atk: 1,
                            def: 1,
                            skills: [],
                        }],
                },
            ],
        });
        (0, assert_1.equal)(localized.entries[0].images.banner?.objectKey, "stage-details/assets/areas/20/banner.png");
        (0, assert_1.equal)(localized.entries[0].enemies[0].portrait?.objectKey, "stage-details/assets/portraits/2.png");
        (0, assert_1.equal)((0, fyi_stage_details_1.collectStageDetailAssets)(localized).length, 2);
    });
    it("removes failed optional assets from the publish manifest while keeping their source urls", () => {
        const localized = (0, fyi_stage_details_1.localizeStageDetailAssets)({
            generatedAt: "2026-07-24T00:00:00.000Z",
            source: "dokkan.fyi",
            count: 1,
            entries: [{
                    id: "1",
                    difficulty: "SUPER",
                    stamina: 0,
                    requiredKeys: 0,
                    rankExp: 0,
                    zeni: 0,
                    linkSkillLevelUpRate: 0,
                    questId: "10",
                    questName: "Stage 1",
                    areaId: "20",
                    areaName: "Event",
                    areaType: "Event",
                    images: {
                        banner: { remoteUrl: "https://cdn.example/banner.png" },
                    },
                    enemies: [],
                }],
        });
        const publishable = (0, fyi_stage_details_1.removeUnmirroredStageDetailAssets)(localized, ["https://cdn.example/banner.png"]);
        (0, assert_1.equal)(publishable.entries[0].images.banner?.remoteUrl, "https://cdn.example/banner.png");
        (0, assert_1.equal)(publishable.entries[0].images.banner?.localPath, undefined);
        (0, assert_1.equal)(publishable.entries[0].images.banner?.objectKey, undefined);
        (0, assert_1.equal)((0, fyi_stage_details_1.collectStageDetailAssets)(publishable, true).length, 0);
    });
});
//# sourceMappingURL=fyi-stage-details.spec.js.map