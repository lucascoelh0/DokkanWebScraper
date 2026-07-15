import { deepEqual, equal } from "assert";
import { describe, it } from "mocha";
import { buildSupportMemoryDetailsDataset } from "./fyi-support-memory-details";

describe("buildSupportMemoryDetailsDataset", function () {
    it("joins support memories with category applicability and acquisition sources", () => {
        const dataset = buildSupportMemoryDetailsDataset({
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

        equal(dataset.count, 1);

        const memory = dataset.entries[0];
        equal(memory.id, "10001");
        equal(memory.filmName, "Film (Red)");
        deepEqual(memory.categoryIds, ["21"]);
        deepEqual(memory.categoryNames, ["Androids"]);
        deepEqual(memory.applicableCharacterIds, ["101", "102"]);
        equal(memory.unlockMethod, "direct-item");
        equal(memory.unlockAcquisition?.itemKey, "SupportMemory:10001");
        equal(memory.unlockAcquisition?.sourceModel, "acquisition-item");
        equal(memory.unlockAcquisition?.groupCount, 1);
        equal(memory.unlockAcquisition?.groups[0].groupKey, "event-mission-category:924");
        equal(memory.unlockAcquisition?.groups[0].title, "Complete the specified Support Memory.");
        equal(memory.unlockAcquisition?.groups[0].totalQuantity, 1);
        equal(memory.unlockAcquisition?.groups[0].satisfiesRequiredQuantity, true);
        equal(memory.unlockAcquisition?.requiredQuantity, 1);
        equal(memory.unlockAcquisition?.sources[0].navigationTarget?.missionKey, "event:21146");
        equal(memory.filmAcquisition?.itemKey, "SupportFilm:1");
        equal(memory.filmAcquisition?.sourceModel, "acquisition-item");
        equal(memory.filmAcquisition?.groupCount, 1);
        equal(memory.filmAcquisition?.groups[0].title, "Clear a stage from Quest or Event once.");
        equal(memory.filmAcquisition?.requiredQuantity, 100);
        equal(memory.filmAcquisition?.sources[0].quantity, 100);
        equal(memory.filmAcquisition?.sources[0].navigationTarget?.missionGroupKey, "event-category:10109");
        equal(memory.dokkanInfo?.detailUrl, "https://dokkaninfo.com/items/supportmemories/10001");
        equal(memory.dokkanInfo?.largeAsset?.localPath, "data/support-memories/assets/dokkaninfo/10001/large.png");
        equal(memory.dokkanInfo?.requiredFilm?.filmCode, "original");
        equal(memory.dokkanInfo?.enhancementItems[0].id, "100011");
        equal(memory.dokkanInfo?.animation?.status, "mirrored");
    });

    it("falls back to mission-catalog unlock missions when the acquisition item is absent", () => {
        const dataset = buildSupportMemoryDetailsDataset({
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

        equal(dataset.entries[0].unlockMethod, "mission-fallback");
        equal(dataset.entries[0].unlockAcquisition?.sourceModel, "mission-fallback");
        equal(dataset.entries[0].unlockAcquisition?.itemKey, "SupportMemory:10004");
        equal(dataset.entries[0].unlockAcquisition?.groups[0].title, "Complete the specified Support Memory.");
        equal(dataset.entries[0].unlockAcquisition?.sources[0].sourceKey, "mission-fallback:event:19774");
        equal(dataset.entries[0].unlockAcquisition?.sources[0].navigationTarget?.missionGroupKey, "event-category:1302");
    });

    it("marks memories as film-only when no direct unlock reward is exposed but films are obtainable", () => {
        const dataset = buildSupportMemoryDetailsDataset({
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

        equal(dataset.entries[0].unlockMethod, "film-only");
        equal(dataset.entries[0].unlockAcquisition, undefined);
        equal(dataset.entries[0].filmAcquisition?.sourceModel, "acquisition-item");
        equal(dataset.entries[0].filmAcquisition?.groups[0].totalQuantity, 100);
        equal(dataset.entries[0].filmAcquisition?.groups[0].satisfiesRequiredQuantity, true);
    });
});
