import { deepEqual, equal, throws } from "assert";
import { describe, it } from "mocha";
import { DokkanStatsSupportMemoryDataset } from "./dokkanstats-support-memories";
import { StageDetail, StageDetailsDataset } from "./stage-detail";
import { SupportMemoryDetailsDataset } from "./support-memory-details";
import { buildSupportMemoryHowToGet } from "./support-memory-how-to-get";

function supportMemories(): SupportMemoryDetailsDataset {
    return {
        generatedAt: "2026-08-31T00:00:00.000Z",
        source: "dokkan-game-db",
        count: 1,
        entries: [{
            id: "10004",
            name: "Martial Artist's Mettle",
            description: "Effect",
            maxLevel: 1,
            enhancementChain: [],
            effects: [],
            categoryIds: [],
            categoryNames: [],
            applicableCharacterIds: [],
            unlockMethod: "direct-item",
            unlockAcquisition: {
                itemKey: "SupportMemory:10004",
                itemType: "SupportMemory",
                itemId: "10004",
                sourceModel: "acquisition-item",
                requiredQuantity: 1,
                groupCount: 1,
                sourceCount: 1,
                groups: [{
                    groupKey: "event-mission-category:1302",
                    groupKind: "event-mission-category",
                    title: "Japanese category",
                    sourceCount: 1,
                    sourceKeys: ["event-mission:1302:19775:32306:10004"],
                }],
                sources: [{
                    sourceKey: "event-mission:1302:19775:32306:10004",
                    sourceKind: "event-mission",
                    groupKey: "event-mission-category:1302",
                    groupKind: "event-mission-category",
                    title: "Clear the stage.",
                    quantity: 1,
                    endsAt: "2038-01-01T00:00:00Z",
                    officialStageRelations: [{ targetKind: "quest-level", targetId: "13020010", relation: "direct-stage-condition" }],
                }],
            },
        }],
    };
}

function stages(): StageDetailsDataset {
    const normal: StageDetail = {
        id: "13020010",
        difficulty: "Raw 0",
        stamina: 8,
        requiredKeys: 1,
        rankExp: 1600,
        zeni: 2500,
        linkSkillLevelUpRate: 0.4,
        questId: "1302001",
        questName: "Piccolo Saga",
        areaId: "1302",
        areaName: "Super Warrior Memorial [Goku and Rivals]",
        areaType: "Area::EventArea",
        startDate: "2023-07-07T00:00:00.000Z",
        images: { button: { sourcePath: "banners/en/event/button.png" } },
        enemies: [],
        bossDrops: [{
            sourceRowId: "14364",
            itemType: "SupportMemory",
            itemId: "10004",
            dropTypeRaw: "1",
            cardExpInitial: 0,
            quantityStatus: "unknown",
            chanceStatus: "unknown",
        }],
        supportMemories: [],
        rules: {
            boostable: true,
            sugorokuAuto: true,
            battleAuto: true,
            cpuOnly: false,
            canIgnoreDifficultyOrder: false,
            areaListButtonVisible: true,
            questEnemyInfoDisplayTypeRaw: 0,
        },
    };
    return {
        generatedAt: "2026-08-31T00:00:00.000Z",
        source: "dokkan-game-db",
        count: 2,
        entries: [
            normal,
            {
                ...normal,
                id: "13020012",
                difficulty: "Raw 2",
                stamina: 15,
                bossDrops: [{
                    ...normal.bossDrops![0],
                    sourceRowId: "14365",
                }],
            },
        ],
    };
}

function dokkanStats(includeDrop = true): DokkanStatsSupportMemoryDataset {
    const acquisitionSources: DokkanStatsSupportMemoryDataset["entries"][number]["acquisitionSources"] = [{
        key: "mission:19775",
        kind: "mission",
        missionId: "19775",
        title: "Clear the stage.",
        categoryId: "1302",
        categoryType: "Story",
        quantity: 1,
        imageUrl: "https://dokkanstats.com/images/en/mission/banner.png",
        areaId: "1302",
        endsAt: "2038-01-01 00:00:00",
        sourceUrl: "https://dokkanstats.com/missions/1302/",
    }];
    if (includeDrop) acquisitionSources.push(
        {
            key: "stage-drop:13020010:1",
            kind: "stage-drop",
            areaId: "1302",
            areaTitle: "Super Warrior Memorial [Goku and Rivals]",
            questId: "1302001",
            questTitle: "Piccolo Saga",
            difficulty: 0,
            mapId: "13020010",
            dropType: 1,
            route: "story",
            imageUrl: "https://dokkanstats.com/banners/en/event/button.png",
            endsAt: "2038-01-01 00:00:00",
            sourceUrl: "https://dokkanstats.com/events/story/1302/13020010",
        },
        {
            key: "stage-drop:13020012:1",
            kind: "stage-drop",
            areaId: "1302",
            areaTitle: "Super Warrior Memorial [Goku and Rivals]",
            questId: "1302001",
            questTitle: "Piccolo Saga",
            difficulty: 2,
            mapId: "13020012",
            dropType: 1,
            route: "story",
            imageUrl: "https://dokkanstats.com/banners/en/event/button.png",
            endsAt: "2038-01-01 00:00:00",
            sourceUrl: "https://dokkanstats.com/events/story/1302/13020012",
        },
    );
    return {
        schemaVersion: 1,
        contract: "dokkanstats-support-memory-enrichment",
        contractVersion: "1.0.0",
        generatedAt: "2026-09-02T00:00:00.000Z",
        source: "dokkanstats.com",
        rootMemoryCount: 1,
        memoryLevelCount: 1,
        acquisitionMemoryCount: 1,
        acquisitionSourceCount: acquisitionSources.length,
        missionSourceCount: 1,
        stageDropSourceCount: includeDrop ? 2 : 0,
        entries: [{
            id: "10004",
            name: "Martial Artist's Mettle",
            maxLevel: 1,
            levels: [{ level: 1, memoryId: "10004", name: "Martial Artist's Mettle" }],
            acquisitionSources,
            sourceUrl: "https://dokkanstats.com/en/items/support-memories/10004/",
        }],
    };
}

describe("Support Memory How to Get enrichment", () => {
    it("adds official stage drops and groups compact presentation metadata", () => {
        const result = buildSupportMemoryHowToGet({
            supportMemories: supportMemories(),
            stages: stages(),
            dokkanStats: dokkanStats(),
            generatedAt: "2026-09-02T12:00:00.000Z",
        });
        const acquisition = result.dataset.entries[0].unlockAcquisition!;

        equal(acquisition.sourceCount, 3);
        equal(acquisition.groupCount, 2);
        equal(acquisition.groups[0].groupTitle, "Super Warrior Memorial [Goku and Rivals]");
        equal(acquisition.groups[0].sourceCategoryType, "Story");
        equal(acquisition.groups[0].imageUrl, "https://dokkanstats.com/images/en/mission/banner.png");
        equal(acquisition.groups[0].isAlwaysAvailable, true);
        equal(acquisition.groups[1].groupKind, "support-memory-stage-drop");
        equal(acquisition.groups[1].groupTitle, "Super Warrior Memorial [Goku and Rivals]");
        equal(acquisition.groups[1].subtitle, "Piccolo Saga");
        equal(acquisition.groups[1].sourceCount, 2);
        equal(acquisition.groups[1].isAlwaysAvailable, true);
        deepEqual(acquisition.sources[1].officialStageRelations, [
            { targetKind: "quest-level", targetId: "13020010", relation: "stage-drop" },
            { targetKind: "area", targetId: "1302", relation: "stage-drop" },
        ]);
        equal(acquisition.sources[1].subtitle, "NORMAL");
        equal(acquisition.sources[2].subtitle, "Z-HARD");
        equal(result.audit.counts.dokkanStatsMissionMatches, 1);
        equal(result.audit.counts.dokkanStatsStageDropMatches, 2);
        equal(result.audit.counts.groupsWithImages, 2);
    });

    it("fails closed when DokkanStats omits a first-party stage drop", () => {
        throws(() => buildSupportMemoryHowToGet({
            supportMemories: supportMemories(),
            stages: stages(),
            dokkanStats: dokkanStats(false),
        }), /stage drops do not match exactly/);
    });

    it("fails closed when root identity differs", () => {
        const evidence = dokkanStats();
        evidence.entries[0].name = "Wrong";
        throws(() => buildSupportMemoryHowToGet({
            supportMemories: supportMemories(),
            stages: stages(),
            dokkanStats: evidence,
        }), /identity does not match/);
    });
});
