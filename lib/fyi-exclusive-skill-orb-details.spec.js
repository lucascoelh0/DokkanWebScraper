"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = require("assert");
const mocha_1 = require("mocha");
const character_1 = require("./character");
const fyi_exclusive_skill_orb_details_1 = require("./fyi-exclusive-skill-orb-details");
(0, mocha_1.describe)("buildExclusiveSkillOrbDetailsDataset", function () {
    (0, mocha_1.it)("prefers normalized acquisition-item sources when available", () => {
        const dataset = (0, fyi_exclusive_skill_orb_details_1.buildExclusiveSkillOrbDetailsDataset)({
            scannedCharacterCount: 1,
            carriers: [
                {
                    owner: {
                        id: "1029471",
                        name: "Super Saiyan Gohan (Teen)",
                        rarity: character_1.Rarities.LR,
                        type: character_1.Types.STR,
                        characterClass: character_1.Classes.Super,
                    },
                    orbs: [
                        {
                            id: "4409",
                            name: "[Character-Exclusive] EX Skill Orb DEF + Lv. 8",
                            description: "DEF +800",
                            grade: "bronze",
                            reusable: true,
                            iconURL: "https://cdn.dokkan.fyi/assets/en/item/equ_item_00008.png",
                            backgroundURL: "https://cdn.dokkan.fyi/assets/en/layout/en/image/equipment/equipment_thumb_bg/equ_base_bronze.png",
                            skills: [
                                {
                                    id: "440900",
                                    attribute: "defense",
                                    level: 8,
                                },
                            ],
                            acquisition: [
                                {
                                    sourceType: "mission-reward",
                                    sourceName: "Mission Reward",
                                    missionId: "25160",
                                    missionCategoryId: "796",
                                    quantity: 1,
                                },
                            ],
                        },
                    ],
                },
            ],
            acquisition: {
                generatedAt: "2026-06-30T00:00:00.000Z",
                source: "dokkan.fyi",
                itemCount: 1,
                sourceCount: 1,
                items: [
                    {
                        key: "EquipmentSkillItem:4409",
                        itemType: "EquipmentSkillItem",
                        itemId: "4409",
                        name: "[Character-Exclusive] EX Skill Orb DEF + Lv. 8",
                        sources: [
                            {
                                key: "event-mission:796:25160:43392:4409",
                                kind: "event-mission",
                                title: "Clear Stage 7.",
                                subtitle: "MissionCategory::ExtraMissionCategory",
                                description: "Clear Stage 7 once.",
                                quantity: 1,
                                imageUrl: "https://cdn.dokkan.fyi/assets/en/mission/banner.png",
                                sourcePath: "https://dokkan.fyi/missions/796",
                                missionCategoryId: "796",
                                missionId: "25160",
                                missionType: "Mission::QuestAndZBattleClearMission::CountMission",
                            },
                        ],
                    },
                ],
            },
            sourceIndex: {
                generatedAt: "2026-06-30T00:00:00.000Z",
                source: "dokkan.fyi",
                sourceCount: 1,
                rewardCount: 1,
                sources: [
                    {
                        key: "event-mission:796:25160:43392:4409",
                        kind: "event-mission",
                        groupKey: "event-mission-category:796",
                        groupKind: "event-mission-category",
                        title: "Clear Stage 7.",
                        subtitle: "MissionCategory::ExtraMissionCategory",
                        description: "Clear Stage 7 once.",
                        imageUrl: "https://cdn.dokkan.fyi/assets/en/mission/banner.png",
                        sourcePath: "https://dokkan.fyi/missions/796",
                        missionCategoryId: "796",
                        missionId: "25160",
                        missionType: "Mission::QuestAndZBattleClearMission::CountMission",
                        rewardCount: 1,
                        rewards: [
                            {
                                key: "EquipmentSkillItem:4409",
                                itemType: "EquipmentSkillItem",
                                itemId: "4409",
                                quantity: 1,
                            },
                        ],
                    },
                ],
            },
            navigation: {
                generatedAt: "2026-06-30T00:00:00.000Z",
                source: "dokkan.fyi",
                sourceCount: 1,
                entries: [
                    {
                        sourceKey: "event-mission:796:25160:43392:4409",
                        sourceKind: "event-mission",
                        title: "Clear Stage 7.",
                        target: {
                            kind: "mission-catalog-group",
                            sourcePath: "https://dokkan.fyi/missions/796",
                            missionGroupKey: "event-mission-category:796",
                        },
                    },
                ],
            },
            missionCatalog: {
                generatedAt: "2026-06-30T00:00:00.000Z",
                source: "dokkan.fyi",
                count: 0,
                groups: [
                    {
                        key: "event-mission-category:796",
                        kind: "event-category",
                        id: "796",
                        title: "Dragon Ball Z: Memorable Battles [Movie Edition]",
                        imageUrl: "https://cdn.dokkan.fyi/assets/en/mission/banner.png",
                    },
                ],
                missions: [],
            },
            stageCatalog: {
                generatedAt: "2026-06-30T00:00:00.000Z",
                source: "dokkan.fyi",
                count: 0,
                groups: [],
                entries: [],
            },
            dokkanInfoEquipment: [
                {
                    id: "4409",
                    officialId: 4409,
                    name: "[Character-Exclusive] EX Skill Orb DEF + Lv. 8",
                    description: "Can be equipped to Super Saiyan Gohan (Teen).",
                    grade: "bronze",
                    attack: 0,
                    defence: 800,
                    sellingExchangePoint: 0,
                    count: 1,
                    equipmentSkillLimitationSetId: 123,
                    isEternal: true,
                    restrictions: [
                        {
                            type: "card",
                            cardIds: ["1029471"],
                            cardNames: ["Super Saiyan Gohan (Teen)"],
                        },
                    ],
                    sourcePages: [
                        {
                            type: "card",
                            id: "1029471",
                            name: "Super Saiyan Gohan (Teen)",
                            url: "https://dokkaninfo.com/items/equipment/cards/1029471",
                        },
                    ],
                },
            ],
        });
        (0, assert_1.equal)(dataset.count, 1);
        (0, assert_1.equal)(dataset.entries[0].acquisitionModel, "acquisition-item");
        (0, assert_1.equal)(dataset.entries[0].acquisitionSummary?.groupCount, 1);
        (0, assert_1.equal)(dataset.entries[0].acquisitionSummary?.groups[0].title, "Dragon Ball Z: Memorable Battles [Movie Edition]");
        (0, assert_1.equal)(dataset.entries[0].acquisitionSummary?.sources[0].missionId, "25160");
        (0, assert_1.equal)(dataset.entries[0].owners[0].id, "1029471");
        (0, assert_1.equal)(dataset.entries[0].presentationAssets?.icon?.remoteUrl, "https://cdn.dokkan.fyi/assets/en/item/equ_item_00008.png");
        (0, assert_1.equal)(dataset.entries[0].presentationAssets?.background?.remoteUrl, "https://cdn.dokkan.fyi/assets/en/layout/en/image/equipment/equipment_thumb_bg/equ_base_bronze.png");
        (0, assert_1.equal)(dataset.entries[0].dokkanInfo?.officialId, 4409);
        (0, assert_1.equal)(dataset.entries[0].dokkanInfo?.isEternal, true);
        (0, assert_1.deepEqual)(dataset.entries[0].dokkanInfo?.restrictions?.[0].cardIds, ["1029471"]);
    });
    (0, mocha_1.it)("falls back to character-hint shop sources when no normalized acquisition item exists", () => {
        const dataset = (0, fyi_exclusive_skill_orb_details_1.buildExclusiveSkillOrbDetailsDataset)({
            scannedCharacterCount: 1,
            carriers: [
                {
                    owner: {
                        id: "1025591",
                        name: "Piccolo (Power Awakening)",
                    },
                    orbs: [
                        {
                            id: "3085",
                            name: "[Character-Exclusive] EX Skill Orb HP + Lv. 8",
                            description: "HP +800",
                            grade: "bronze",
                            reusable: true,
                            skills: [],
                            acquisition: [
                                {
                                    sourceType: "shop-item",
                                    sourceName: "Shop Item",
                                    shopItemId: "26903020",
                                    price: 2,
                                    discountedPrice: 2,
                                    treasureItemId: "32",
                                    treasureItemName: "Super Mineral Water",
                                    treasureItemDescription: "Can be used at Baba's Shop.",
                                    treasureItemImageSuffix: 47,
                                    startsAt: "2025-12-29 01:00:00",
                                    endsAt: "2026-01-29 14:59:59",
                                    isIndefinite: false,
                                },
                            ],
                        },
                    ],
                },
            ],
            acquisition: {
                generatedAt: "2026-06-30T00:00:00.000Z",
                source: "dokkan.fyi",
                itemCount: 0,
                sourceCount: 0,
                items: [],
            },
            sourceIndex: {
                generatedAt: "2026-06-30T00:00:00.000Z",
                source: "dokkan.fyi",
                sourceCount: 0,
                rewardCount: 0,
                sources: [],
            },
            navigation: {
                generatedAt: "2026-06-30T00:00:00.000Z",
                source: "dokkan.fyi",
                sourceCount: 0,
                entries: [],
            },
            missionCatalog: {
                generatedAt: "2026-06-30T00:00:00.000Z",
                source: "dokkan.fyi",
                count: 0,
                groups: [],
                missions: [],
            },
            stageCatalog: {
                generatedAt: "2026-06-30T00:00:00.000Z",
                source: "dokkan.fyi",
                count: 0,
                groups: [],
                entries: [],
            },
        });
        (0, assert_1.equal)(dataset.entries[0].acquisitionModel, "character-hint");
        (0, assert_1.equal)(dataset.entries[0].acquisitionSummary?.groups[0].groupKind, "character-shop");
        (0, assert_1.equal)(dataset.entries[0].acquisitionSummary?.groups[0].treasureItemName, "Super Mineral Water");
        (0, assert_1.equal)(dataset.entries[0].acquisitionSummary?.groups[0].priceMin, 2);
        (0, assert_1.equal)(dataset.entries[0].acquisitionSummary?.sources[0].shopItemId, "26903020");
    });
    (0, mocha_1.it)("merges owners when the same orb id appears more than once", () => {
        const dataset = (0, fyi_exclusive_skill_orb_details_1.buildExclusiveSkillOrbDetailsDataset)({
            scannedCharacterCount: 2,
            failedCharacterIds: [2, 1, 2],
            carriers: [
                {
                    owner: {
                        id: "1",
                        name: "Owner A",
                    },
                    orbs: [
                        {
                            id: "9000",
                            name: "Shared Orb",
                            description: "",
                            skills: [],
                            acquisition: [],
                        },
                    ],
                },
                {
                    owner: {
                        id: "2",
                        name: "Owner B",
                    },
                    orbs: [
                        {
                            id: "9000",
                            name: "Shared Orb",
                            description: "",
                            skills: [],
                            acquisition: [],
                        },
                    ],
                },
            ],
            acquisition: {
                generatedAt: "2026-06-30T00:00:00.000Z",
                source: "dokkan.fyi",
                itemCount: 0,
                sourceCount: 0,
                items: [],
            },
            sourceIndex: {
                generatedAt: "2026-06-30T00:00:00.000Z",
                source: "dokkan.fyi",
                sourceCount: 0,
                rewardCount: 0,
                sources: [],
            },
            navigation: {
                generatedAt: "2026-06-30T00:00:00.000Z",
                source: "dokkan.fyi",
                sourceCount: 0,
                entries: [],
            },
            missionCatalog: {
                generatedAt: "2026-06-30T00:00:00.000Z",
                source: "dokkan.fyi",
                count: 0,
                groups: [],
                missions: [],
            },
            stageCatalog: {
                generatedAt: "2026-06-30T00:00:00.000Z",
                source: "dokkan.fyi",
                count: 0,
                groups: [],
                entries: [],
            },
        });
        (0, assert_1.equal)(dataset.count, 1);
        (0, assert_1.equal)(dataset.entries[0].ownerCount, 2);
        (0, assert_1.deepEqual)(dataset.entries[0].owners.map(owner => owner.id), ["1", "2"]);
        (0, assert_1.equal)(dataset.entries[0].acquisitionModel, "unknown");
        (0, assert_1.deepEqual)(dataset.failedCharacterIds, [1, 2]);
    });
});
//# sourceMappingURL=fyi-exclusive-skill-orb-details.spec.js.map