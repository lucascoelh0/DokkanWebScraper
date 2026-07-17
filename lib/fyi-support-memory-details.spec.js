"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = require("assert");
const mocha_1 = require("mocha");
const fyi_support_memory_details_1 = require("./fyi-support-memory-details");
(0, mocha_1.describe)("buildSupportMemoryDetailsDataset", function () {
    (0, mocha_1.it)("joins support memories with category applicability and acquisition sources", () => {
        const dataset = (0, fyi_support_memory_details_1.buildSupportMemoryDetailsDataset)({
            supportMemories: {
                generatedAt: "2026-01-01T00:00:00.000Z",
                source: "dokkan.fyi",
                count: 1,
                films: [
                    {
                        id: "1",
                        name: "Film (Red)",
                        description: "Required to use Support Memory (Red).",
                    },
                ],
                supportMemories: [
                    {
                        id: "10001",
                        name: "Oolong's Wish",
                        description: "Chance of obtaining bonus rewards.",
                        filmId: "1",
                        film: {
                            id: "1",
                            name: "Film (Red)",
                            description: "Required to use Support Memory (Red).",
                        },
                        cost: 70,
                        unlockQuantity: 100,
                        lastsEntireBattle: false,
                        maxLevel: 3,
                        enhancementChain: [],
                        effects: [],
                    },
                ],
            },
            categoryContext: {
                generatedAt: "2026-01-01T00:00:00.000Z",
                source: "dokkan.fyi",
                categoryCount: 1,
                supportMemoryCount: 1,
                characterCount: 2,
                categories: [],
                supportMemories: [
                    {
                        id: "10001",
                        name: "Oolong's Wish",
                        categoryIds: ["21"],
                        categoryNames: ["Androids"],
                        applicableCharacterIds: ["102", "101"],
                    },
                ],
                characters: [],
            },
            missionCatalog: {
                generatedAt: "2026-01-01T00:00:00.000Z",
                source: "dokkan.fyi",
                groupCount: 1,
                missionCount: 1,
                rewardCount: 0,
                characterRefCount: 0,
                groups: [
                    {
                        key: "event-category:924",
                        kind: "event-category",
                        id: "924",
                        title: "MissionCategory::ExtraMissionCategory",
                    },
                ],
                missions: [],
            },
            stageCatalog: {
                generatedAt: "2026-01-01T00:00:00.000Z",
                source: "dokkan.fyi",
                groupCount: 0,
                entryCount: 0,
                groups: [],
                entries: [],
            },
            acquisition: {
                generatedAt: "2026-01-01T00:00:00.000Z",
                source: "dokkan.fyi",
                itemCount: 2,
                sourceCount: 2,
                items: [
                    {
                        key: "SupportMemory:10001",
                        itemType: "SupportMemory",
                        itemId: "10001",
                        name: "Oolong's Wish",
                        description: "Chance of obtaining bonus rewards.",
                        sources: [
                            {
                                key: "event-mission:unlock",
                                kind: "event-mission",
                                title: "Complete the specified Support Memory.",
                                missionCategoryId: "924",
                                missionId: "21146",
                                quantity: 1,
                                sourcePath: "https://dokkan.fyi/missions/924",
                            },
                        ],
                    },
                    {
                        key: "SupportFilm:1",
                        itemType: "SupportFilm",
                        itemId: "1",
                        name: "Film (Red)",
                        description: "Required to use Support Memory (Red).",
                        sources: [
                            {
                                key: "event-mission:film",
                                kind: "event-mission",
                                title: "Clear a stage from Quest or Event once.",
                                missionCategoryId: "10109",
                                missionId: "20752",
                                quantity: 100,
                                sourcePath: "https://dokkan.fyi/missions/10109",
                            },
                        ],
                    },
                ],
            },
            sourceIndex: {
                generatedAt: "2026-01-01T00:00:00.000Z",
                source: "dokkan.fyi",
                sourceCount: 2,
                rewardCount: 2,
                sources: [
                    {
                        key: "event-mission:unlock",
                        kind: "event-mission",
                        groupKey: "event-mission-category:924",
                        groupKind: "event-mission-category",
                        title: "Complete the specified Support Memory.",
                        missionCategoryId: "924",
                        missionId: "21146",
                        rewardCount: 1,
                        rewards: [],
                    },
                    {
                        key: "event-mission:film",
                        kind: "event-mission",
                        groupKey: "event-mission-category:10109",
                        groupKind: "event-mission-category",
                        title: "Clear a stage from Quest or Event once.",
                        missionCategoryId: "10109",
                        missionId: "20752",
                        rewardCount: 1,
                        rewards: [],
                    },
                ],
            },
            navigation: {
                generatedAt: "2026-01-01T00:00:00.000Z",
                source: "dokkan.fyi",
                sourceCount: 2,
                entries: [
                    {
                        sourceKey: "event-mission:unlock",
                        sourceKind: "event-mission",
                        title: "Complete the specified Support Memory.",
                        target: {
                            kind: "mission-catalog-mission",
                            missionKey: "event:21146",
                            missionGroupKey: "event-category:924",
                        },
                    },
                    {
                        sourceKey: "event-mission:film",
                        sourceKind: "event-mission",
                        title: "Clear a stage from Quest or Event once.",
                        target: {
                            kind: "mission-catalog-mission",
                            missionKey: "event:20752",
                            missionGroupKey: "event-category:10109",
                        },
                    },
                ],
            },
            dokkanInfoEnrichment: {
                generatedAt: "2026-01-01T00:00:00.000Z",
                source: "dokkaninfo",
                count: 1,
                entries: [
                    {
                        id: "10001",
                        name: "Oolong's Wish",
                        detailUrl: "https://dokkaninfo.com/items/supportmemories/10001",
                        levelDescriptions: [
                            {
                                level: 1,
                                description: "Chance of obtaining bonus rewards +50%",
                            },
                        ],
                        largeAsset: {
                            remoteUrl: "https://dokkaninfo.com/assets/large.png",
                            localPath: "data/support-memories/assets/dokkaninfo/10001/large.png",
                        },
                        completeAsset: {
                            remoteUrl: "https://dokkaninfo.com/assets/complete.png",
                            quantity: 100,
                            localPath: "data/support-memories/assets/dokkaninfo/10001/complete.png",
                        },
                        requiredFilm: {
                            remoteUrl: "https://dokkaninfo.com/assets/film.png",
                            quantity: 70,
                            filmCode: "original",
                            localPath: "data/support-memories/assets/dokkaninfo/10001/film.png",
                        },
                        enhancementItems: [
                            {
                                itemType: "SupportMemoryEnhancementItem",
                                itemKey: "SupportMemoryEnhancementItem:100011",
                                id: "100011",
                                quantity: 15,
                                asset: {
                                    remoteUrl: "https://dokkaninfo.com/assets/100011.png",
                                    localPath: "data/support-memories/assets/dokkaninfo/10001/enhancements/100011.png",
                                },
                            },
                        ],
                        animation: {
                            sourceType: "lwf",
                            status: "mirrored",
                            remoteBaseUrl: "https://glben.dokkaninfo.com/assets/global/en/ingame/battle/effect/support_memory_10001/en/",
                            localDirectory: "data/support-memories/assets/dokkaninfo/10001/animation",
                            lwf: {
                                remoteUrl: "https://glben.dokkaninfo.com/assets/global/en/ingame/battle/effect/support_memory_10001/en/support_memory_10001.lwf",
                                localPath: "data/support-memories/assets/dokkaninfo/10001/animation/support_memory_10001.lwf",
                            },
                            textures: [
                                {
                                    remoteUrl: "https://glben.dokkaninfo.com/assets/global/en/ingame/battle/effect/support_memory_10001/en/support_memory_10001_a_0.png",
                                    localPath: "data/support-memories/assets/dokkaninfo/10001/animation/support_memory_10001_a_0.png",
                                },
                            ],
                        },
                    },
                ],
            },
        });
        (0, assert_1.equal)(dataset.count, 1);
        const memory = dataset.entries[0];
        (0, assert_1.equal)(memory.id, "10001");
        (0, assert_1.equal)(memory.filmName, "Film (Red)");
        (0, assert_1.deepEqual)(memory.categoryIds, ["21"]);
        (0, assert_1.deepEqual)(memory.categoryNames, ["Androids"]);
        (0, assert_1.deepEqual)(memory.applicableCharacterIds, ["101", "102"]);
        (0, assert_1.equal)(memory.unlockMethod, "direct-item");
        (0, assert_1.equal)(memory.unlockAcquisition?.itemKey, "SupportMemory:10001");
        (0, assert_1.equal)(memory.unlockAcquisition?.sourceModel, "acquisition-item");
        (0, assert_1.equal)(memory.unlockAcquisition?.groupCount, 1);
        (0, assert_1.equal)(memory.unlockAcquisition?.groups[0].groupKey, "event-mission-category:924");
        (0, assert_1.equal)(memory.unlockAcquisition?.groups[0].title, "Complete the specified Support Memory.");
        (0, assert_1.equal)(memory.unlockAcquisition?.groups[0].totalQuantity, 1);
        (0, assert_1.equal)(memory.unlockAcquisition?.groups[0].satisfiesRequiredQuantity, true);
        (0, assert_1.equal)(memory.unlockAcquisition?.requiredQuantity, 1);
        (0, assert_1.equal)(memory.unlockAcquisition?.sources[0].navigationTarget?.missionKey, "event:21146");
        (0, assert_1.equal)(memory.filmAcquisition?.itemKey, "SupportFilm:1");
        (0, assert_1.equal)(memory.filmAcquisition?.sourceModel, "acquisition-item");
        (0, assert_1.equal)(memory.filmAcquisition?.groupCount, 1);
        (0, assert_1.equal)(memory.filmAcquisition?.groups[0].title, "Clear a stage from Quest or Event once.");
        (0, assert_1.equal)(memory.filmAcquisition?.requiredQuantity, 100);
        (0, assert_1.equal)(memory.filmAcquisition?.sources[0].quantity, 100);
        (0, assert_1.equal)(memory.filmAcquisition?.sources[0].navigationTarget?.missionGroupKey, "event-category:10109");
        (0, assert_1.equal)(memory.dokkanInfo?.detailUrl, "https://dokkaninfo.com/items/supportmemories/10001");
        (0, assert_1.equal)(memory.dokkanInfo?.largeAsset?.localPath, "data/support-memories/assets/dokkaninfo/10001/large.png");
        (0, assert_1.equal)(memory.dokkanInfo?.requiredFilm?.filmCode, "original");
        (0, assert_1.equal)(memory.dokkanInfo?.enhancementItems[0].id, "100011");
        (0, assert_1.equal)(memory.dokkanInfo?.animation?.status, "mirrored");
    });
    (0, mocha_1.it)("falls back to mission-catalog unlock missions when the acquisition item is absent", () => {
        const dataset = (0, fyi_support_memory_details_1.buildSupportMemoryDetailsDataset)({
            supportMemories: {
                generatedAt: "2026-01-01T00:00:00.000Z",
                source: "dokkan.fyi",
                count: 1,
                films: [],
                supportMemories: [
                    {
                        id: "10004",
                        name: "Martial Artist's Mettle",
                        description: "ATK boost.",
                        filmId: "1",
                        maxLevel: 1,
                        enhancementChain: [],
                        effects: [],
                    },
                ],
            },
            categoryContext: {
                generatedAt: "2026-01-01T00:00:00.000Z",
                source: "dokkan.fyi",
                categoryCount: 0,
                supportMemoryCount: 0,
                characterCount: 0,
                categories: [],
                supportMemories: [],
                characters: [],
            },
            missionCatalog: {
                generatedAt: "2026-01-01T00:00:00.000Z",
                source: "dokkan.fyi",
                groupCount: 1,
                missionCount: 1,
                rewardCount: 0,
                characterRefCount: 0,
                groups: [
                    {
                        key: "event-category:1302",
                        kind: "event-category",
                        id: "1302",
                        title: "MissionCategory::ExtraMissionCategory",
                    },
                ],
                missions: [
                    {
                        key: "event:19774",
                        kind: "event",
                        id: "19774",
                        groupKey: "event-category:1302",
                        type: "Mission::SupportMemoryGetMission::CompleteSupportMemoryMission",
                        title: "Complete the specified Support Memory.",
                        description: "Complete the Support Memory \"Martial Artist's Mettle\", which can be obtained in the Story Event \"Super Warrior Memorial [Goku and Rivals]\"!",
                        categoryId: "1302",
                        rewards: [],
                        characters: [],
                    },
                ],
            },
            stageCatalog: {
                generatedAt: "2026-01-01T00:00:00.000Z",
                source: "dokkan.fyi",
                groupCount: 0,
                entryCount: 0,
                groups: [],
                entries: [],
            },
            acquisition: {
                generatedAt: "2026-01-01T00:00:00.000Z",
                source: "dokkan.fyi",
                itemCount: 0,
                sourceCount: 0,
                items: [],
            },
            sourceIndex: {
                generatedAt: "2026-01-01T00:00:00.000Z",
                source: "dokkan.fyi",
                sourceCount: 0,
                rewardCount: 0,
                sources: [],
            },
            navigation: {
                generatedAt: "2026-01-01T00:00:00.000Z",
                source: "dokkan.fyi",
                sourceCount: 0,
                entries: [],
            },
        });
        (0, assert_1.equal)(dataset.entries[0].unlockMethod, "mission-fallback");
        (0, assert_1.equal)(dataset.entries[0].unlockAcquisition?.sourceModel, "mission-fallback");
        (0, assert_1.equal)(dataset.entries[0].unlockAcquisition?.itemKey, "SupportMemory:10004");
        (0, assert_1.equal)(dataset.entries[0].unlockAcquisition?.groups[0].title, "Complete the specified Support Memory.");
        (0, assert_1.equal)(dataset.entries[0].unlockAcquisition?.sources[0].sourceKey, "mission-fallback:event:19774");
        (0, assert_1.equal)(dataset.entries[0].unlockAcquisition?.sources[0].navigationTarget?.missionGroupKey, "event-category:1302");
    });
    (0, mocha_1.it)("marks memories as film-only when no direct unlock reward is exposed but films are obtainable", () => {
        const dataset = (0, fyi_support_memory_details_1.buildSupportMemoryDetailsDataset)({
            supportMemories: {
                generatedAt: "2026-01-01T00:00:00.000Z",
                source: "dokkan.fyi",
                count: 1,
                films: [],
                supportMemories: [
                    {
                        id: "10003",
                        name: "Training Complete!",
                        description: "ATK boost.",
                        filmId: "1",
                        unlockQuantity: 100,
                        maxLevel: 1,
                        enhancementChain: [],
                        effects: [],
                    },
                ],
            },
            categoryContext: {
                generatedAt: "2026-01-01T00:00:00.000Z",
                source: "dokkan.fyi",
                categoryCount: 0,
                supportMemoryCount: 0,
                characterCount: 0,
                categories: [],
                supportMemories: [],
                characters: [],
            },
            missionCatalog: {
                generatedAt: "2026-01-01T00:00:00.000Z",
                source: "dokkan.fyi",
                groupCount: 0,
                missionCount: 0,
                rewardCount: 0,
                characterRefCount: 0,
                groups: [],
                missions: [],
            },
            stageCatalog: {
                generatedAt: "2026-01-01T00:00:00.000Z",
                source: "dokkan.fyi",
                groupCount: 0,
                entryCount: 0,
                groups: [],
                entries: [],
            },
            acquisition: {
                generatedAt: "2026-01-01T00:00:00.000Z",
                source: "dokkan.fyi",
                itemCount: 1,
                sourceCount: 1,
                items: [
                    {
                        key: "SupportFilm:1",
                        itemType: "SupportFilm",
                        itemId: "1",
                        name: "Film (Red)",
                        description: "Required to use Support Memory (Red).",
                        sources: [
                            {
                                key: "event-mission:film",
                                kind: "event-mission",
                                title: "Clear a stage from Quest or Event once.",
                                missionCategoryId: "10109",
                                missionId: "20752",
                                quantity: 100,
                                sourcePath: "https://dokkan.fyi/missions/10109",
                            },
                        ],
                    },
                ],
            },
            sourceIndex: {
                generatedAt: "2026-01-01T00:00:00.000Z",
                source: "dokkan.fyi",
                sourceCount: 1,
                rewardCount: 1,
                sources: [
                    {
                        key: "event-mission:film",
                        kind: "event-mission",
                        groupKey: "event-mission-category:10109",
                        groupKind: "event-mission-category",
                        title: "Clear a stage from Quest or Event once.",
                        missionCategoryId: "10109",
                        missionId: "20752",
                        rewardCount: 1,
                        rewards: [],
                    },
                ],
            },
            navigation: {
                generatedAt: "2026-01-01T00:00:00.000Z",
                source: "dokkan.fyi",
                sourceCount: 1,
                entries: [
                    {
                        sourceKey: "event-mission:film",
                        sourceKind: "event-mission",
                        title: "Clear a stage from Quest or Event once.",
                        target: {
                            kind: "mission-catalog-mission",
                            missionKey: "event:20752",
                            missionGroupKey: "event-category:10109",
                        },
                    },
                ],
            },
        });
        (0, assert_1.equal)(dataset.entries[0].unlockMethod, "film-only");
        (0, assert_1.equal)(dataset.entries[0].unlockAcquisition, undefined);
        (0, assert_1.equal)(dataset.entries[0].filmAcquisition?.sourceModel, "acquisition-item");
        (0, assert_1.equal)(dataset.entries[0].filmAcquisition?.groups[0].totalQuantity, 100);
        (0, assert_1.equal)(dataset.entries[0].filmAcquisition?.groups[0].satisfiesRequiredQuantity, true);
    });
});
//# sourceMappingURL=fyi-support-memory-details.spec.js.map