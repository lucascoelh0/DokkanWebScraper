"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = require("assert");
const crypto_1 = require("crypto");
const mocha_1 = require("mocha");
const game_db_stage_assets_1 = require("./game-db-stage-assets");
(0, mocha_1.describe)("Stage asset mirror", () => {
    (0, mocha_1.it)("collects event, reward, enemy, Quest and Frontier assets under stable paths", () => {
        const dataset = {
            schemaVersion: 2,
            generatedAt: "2026-09-03T00:00:00.000Z",
            source: "dokkan-game-db",
            sourceSnapshotVersion: "1788329250",
            sourceDatabaseSha256: "a".repeat(64),
            count: 1,
            entries: [{
                    id: "1010",
                    difficulty: "NORMAL",
                    stamina: 8,
                    requiredKeys: 0,
                    rankExp: 1,
                    zeni: 1,
                    linkSkillLevelUpRate: 0.4,
                    questId: "101",
                    questName: "Quest",
                    areaId: "1",
                    areaName: "Area",
                    areaType: "Area::MainArea",
                    chapter: { id: "1", name: "Chapter 1" },
                    images: { button: { sourcePath: "banners/en/event/eve_listbutton/event.png" } },
                    enemies: [{
                            id: "1",
                            battle: 1,
                            tile: 1,
                            characterId: "1",
                            cardId: "1011961",
                            thumbnailId: "1011961",
                            name: "Enemy",
                            rarityRaw: 3,
                            elementRaw: 20,
                            skills: [],
                        }],
                    bossDrops: [{
                            sourceRowId: "1",
                            itemType: "AwakeningItem",
                            itemId: "9",
                            dropTypeRaw: "boss",
                            quantityStatus: "unknown",
                            chanceStatus: "unknown",
                        }, {
                            sourceRowId: "2",
                            itemType: "EquipmentSkillItem",
                            itemId: "88",
                            dropTypeRaw: "boss",
                            quantityStatus: "unknown",
                            chanceStatus: "unknown",
                            iconAssetPath: "item/equipment/equ_item_00010.png",
                            backgroundAssetPath: "layout/en/image/item/equipment/equipment_thumb_bg/equ_base_gold.png",
                            equipmentSkill: {
                                grade: "gold",
                                isEternal: true,
                                levelAssetPath: "derived/equipment/levels/lv-7.png",
                                infinityAssetPath: "layout/en/image/charamenu/potential/equ_infinite_icon_gold.png",
                                skills: [{ sourceRowId: "8800", potentialSkillId: "2", level: 7 }],
                                restriction: {
                                    setId: "90",
                                    combination: "any",
                                    isUnrestricted: false,
                                    conditions: [{
                                            sourceRowId: "900",
                                            kind: "element",
                                            rawType: "EquipmentSkillLimitation::ElementLimitation",
                                            rawConditions: { element_bitpattern: 32768 },
                                            isUnrestricted: false,
                                            elementBitPattern: 32768,
                                            elementCodes: ["SUPER_STR"],
                                            presentation: {
                                                badgeLabel: "SUPER_STR",
                                                detailLabel: "SUPER STR",
                                                badgeAssetPath: "layout/en/image/character/cha_type_icon_13.png",
                                                badgeAssetPaths: ["layout/en/image/character/cha_type_icon_13.png"],
                                            },
                                        }],
                                    presentation: {
                                        badgeLabel: "SUPER_STR",
                                        detailLabel: "SUPER STR",
                                        badgeAssetPath: "layout/en/image/character/cha_type_icon_13.png",
                                        badgeAssetPaths: ["layout/en/image/character/cha_type_icon_13.png"],
                                    },
                                },
                            },
                        }],
                }],
        };
        const itemCatalog = {
            categories: [{
                    items: [{
                            key: "AwakeningItem:9",
                            icon: { remoteUrl: "https://dokkaninfo.com/assets/global/en/item/awaken/en/thumb/thumb_awaken_items_00009/thumb_awaken_items_00009.png" },
                            background: { remoteUrl: "https://dokkaninfo.com/assets/global/en/layout/en/image/item/awaken/awaken_thumb_bg/thumb_awaken_rainbow.png" },
                        }],
                }],
        };
        const frontier = {
            series: [{
                    bannerImageUrl: "https://dokkaninfo.com/assets/global/en/origin/series_banner/origin_sr_seriesbanner_02.png",
                    portraitSpec: { iconId: 1023770, frameColorId: 0, rarity: "UR", elementCode: "20" },
                    step: 1,
                }],
        };
        const requests = (0, game_db_stage_assets_1.collectStageAssetRequests)(dataset, itemCatalog, frontier);
        const paths = requests.map(request => request.path);
        (0, assert_1.equal)(paths.includes("banners/en/event/eve_listbutton/event.png"), true);
        (0, assert_1.equal)(paths.includes("outgame/extension/adventure/chapter/1/1001.png"), true);
        (0, assert_1.equal)(paths.includes("character/thumb/card_1011961_thumb/card_1011961_thumb.png"), true);
        (0, assert_1.equal)(paths.includes("character/thumb/card_1023770_thumb/card_1023770_thumb.png"), true);
        (0, assert_1.equal)(paths.includes("origin/series_banner/origin_sr_seriesbanner_02.png"), true);
        (0, assert_1.equal)(paths.includes("item/awaken/en/thumb/thumb_awaken_items_00009/thumb_awaken_items_00009.png"), true);
        (0, assert_1.equal)(paths.includes("layout/en/image/item/awaken/awaken_thumb_bg/thumb_awaken_rainbow.png"), true);
        (0, assert_1.equal)(paths.includes("item/equipment/equ_item_00010.png"), true);
        (0, assert_1.equal)(paths.includes("layout/en/image/item/equipment/equipment_thumb_bg/equ_base_gold.png"), true);
        (0, assert_1.equal)(paths.includes("layout/en/image/character/cha_type_icon_13.png"), true);
        (0, assert_1.equal)(paths.includes("derived/equipment/levels/lv-7.png"), true);
        (0, assert_1.equal)(paths.includes("layout/en/image/charamenu/potential/equ_infinite_icon_gold.png"), true);
        const missingVariant = requests.find(request => request.path.includes("card_1011961_thumb"));
        (0, assert_1.equal)(missingVariant.sourceUrls.includes("https://assets.dokkanstats.com/assets/global/en/character/thumb/card_1011960_thumb/card_1011960_thumb.png"), true);
        const unsafeRequests = (0, game_db_stage_assets_1.collectStageAssetRequests)(dataset, {
            categories: [{
                    items: [{
                            key: "AwakeningItem:9",
                            icon: {
                                remoteUrl: "https://user:secret@dokkaninfo.com/assets/global/en/item/unsafe.png",
                            },
                        }],
                }],
        }, {});
        (0, assert_1.equal)(unsafeRequests.some(request => request.path === "item/unsafe.png"), false);
    });
    (0, mocha_1.it)("collects an enemy portrait by card id when resource id is absent", () => {
        const dataset = {
            schemaVersion: 2,
            generatedAt: "2026-09-03T00:00:00.000Z",
            source: "dokkan-game-db",
            sourceSnapshotVersion: "1788329250",
            sourceDatabaseSha256: "b".repeat(64),
            count: 1,
            entries: [{
                    id: "1", difficulty: "NORMAL", stamina: 1, requiredKeys: 0, rankExp: 1, zeni: 1,
                    linkSkillLevelUpRate: 0, questId: "1", questName: "Quest", areaId: "1", areaName: "Area",
                    areaType: "Area::EventArea", images: {},
                    enemies: [{ id: "1", battle: 1, tile: 1, characterId: "1003300", cardId: "1003300",
                            name: "Perfect Cell", rarityRaw: 3, elementRaw: 1, skills: [] }],
                }],
        };
        const paths = (0, game_db_stage_assets_1.collectStageAssetRequests)(dataset, {}).map(request => request.path);
        (0, assert_1.equal)(paths.includes("character/thumb/card_1003300_thumb/card_1003300_thumb.png"), true);
    });
    (0, mocha_1.it)("requires an exact snapshot-bound acceptance for source gaps", () => {
        const missingAssets = [{ path: "banners/en/event/missing.png" }];
        (0, assert_1.throws)(() => (0, game_db_stage_assets_1.validateStageAssetMissingAcceptance)("123", missingAssets, undefined), /unaccepted missing assets/);
        (0, game_db_stage_assets_1.validateStageAssetMissingAcceptance)("123", missingAssets, {
            schemaVersion: 1,
            sourceSnapshotVersion: "123",
            missingAssetCount: 1,
            missingPathsSha256: (0, crypto_1.createHash)("sha256").update(missingAssets[0].path).digest("hex"),
            reason: "Reviewed historical banner gap with no available source bytes.",
        });
    });
});
//# sourceMappingURL=game-db-stage-assets.spec.js.map