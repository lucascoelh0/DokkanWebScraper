import { deepEqual, equal, match, throws } from "assert";
import { describe, it } from "mocha";
import { gunzipSync } from "zlib";
import { StageDetail, StageDetailsDataset } from "../stage-detail";
import { buildStageDelivery } from "./game-db-stage-delivery";

describe("first-party Stage delivery", () => {
    it("builds deterministic bounded shards and resolvable typed routes", () => {
        const dataset = fixtureDataset();
        const first = buildStageDelivery(dataset, 32 * 1024);
        const second = buildStageDelivery(dataset, 32 * 1024);

        deepEqual(second.manifest, first.manifest);
        equal(second.catalogGzip.equals(first.catalogGzip), true);
        equal(first.catalog.entries.length, 4);
        equal(first.audit.questLevelRoutes, 3);
        equal(first.audit.zBattleRoutes, 1);
        equal(first.audit.supportMemoryRelations, 3);
        equal(first.audit.maximumShardExpandedBytes <= 32 * 1024, true);
        equal(first.shards.length >= 2, true);
        equal(first.manifest.catalog.objectKey.startsWith("stage-details/objects/"), true);
        equal(first.manifest.fileName, first.manifest.catalog.objectKey);
        equal(first.manifest.sha256, first.manifest.catalog.sha256);
        equal(first.manifest.sizeBytes, first.manifest.catalog.sizeBytes);
        equal(first.manifest.stageCount, first.manifest.questLevelCount);
        equal(first.catalog.assetBaseUrl, "https://assets.dokkanstats.com/assets/global/en");
        for (const shard of first.shards) {
            equal(shard.manifest.sizeBytes, shard.gzip.byteLength);
            equal(shard.manifest.expandedSizeBytes, shard.bytes.byteLength);
            match(shard.manifest.sha256, /^[a-f0-9]{64}$/);
        }

        const quest = first.catalog.entries.find(entry => entry.key === "quest-level:101")!;
        equal(quest.areaName, "Area 7");
        equal(quest.areaType, "Area::MainArea");
        equal(quest.areaCategoryRaw, 7);
        equal(quest.browseCategory, "quests");
        equal(quest.chapterId, "1");
        equal(quest.chapterName, "Chapter 1");
        equal(quest.chapterImagePath, "outgame/extension/adventure/chapter/1/1001.png");
        equal(quest.eventImagePath, "banners/en/event/eve_listbutton/myp_banner_event_7.png");
        deepEqual(quest.enemyNames, ["Goku", "Vegeta"]);
        deepEqual(quest.supportMemoryIds, ["20001"]);
        equal(quest.hasGimmicks, true);
        const deliveredQuest = first.shards.flatMap(shard => shard.payload.questLevels)
            .find(entry => entry.id === "101")!;
        equal(deliveredQuest.enemies[0].thumbnailId, "1000");
        equal(deliveredQuest.enemies[0].superAttacks?.[0].name, "Kamehameha");
        equal(first.catalog.entries.find(entry => entry.key === "quest-level:201")?.browseCategory, "story");
        const zBattle = first.catalog.entries.find(entry => entry.key === "z-battle:9001")!;
        equal(zBattle.browseCategory, "z-battles");
        equal(zBattle.eventImagePath, "banners/en/event/eve_listbutton/myp_banner_event_zbattle_9001.png");
        deepEqual(zBattle.supportMemoryIds, ["20003"]);
        const zShard = first.manifest.shards.find(shard => shard.id === zBattle.detailShardId)!;
        equal(zShard.zBattleIds.includes("9001"), true);
        const deliveredZBattle = first.shards.flatMap(shard => shard.payload.zBattles)
            .find(entry => entry.id === "9001")!;
        equal(deliveredZBattle.banner?.sourcePath, "banners/en/event/eve_banner/zbattle_list_banner_9001.png");
    });

    it("fails closed when a normal quest enemy claims unavailable stats", () => {
        const dataset = fixtureDataset();
        dataset.entries[0].enemies[0].stats = {
            status: "unavailable-in-game-db",
            source: "game-db",
            hp: 1,
        };
        throws(() => buildStageDelivery(dataset), /invents unavailable HP\/ATK\/DEF/);
    });

    it("can rotate immutable object hashes without changing expanded payloads", () => {
        const dataset = fixtureDataset();
        const defaultCompression = buildStageDelivery(dataset, 32 * 1024);
        const rotatedCompression = buildStageDelivery(dataset, 32 * 1024, 8);

        equal(rotatedCompression.manifest.catalog.sha256 === defaultCompression.manifest.catalog.sha256, false);
        equal(gunzipSync(rotatedCompression.catalogGzip).equals(defaultCompression.catalogBytes), true);
        throws(() => buildStageDelivery(dataset, 32 * 1024, 0), /compression level/);
    });

    it("fails closed when a Support Memory target is absent", () => {
        const dataset = fixtureDataset();
        dataset.supportMemoryRelations!.push({
            memoryId: "20004",
            missionIds: ["44"],
            relation: "mission-owner",
            targetKind: "area",
            targetId: "999",
        });
        throws(() => buildStageDelivery(dataset), /has no catalog target/);
    });
});

function fixtureDataset(): StageDetailsDataset {
    const entries = [
        quest("101", "71", "7", "Goku", "x".repeat(18_000), "20001"),
        quest("102", "71", "7", "Vegeta", "y".repeat(18_000)),
        quest("201", "81", "8", "Piccolo", "z".repeat(18_000)),
    ];
    entries[0].areaType = "Area::MainArea";
    entries[0].areaCategoryRaw = 7;
    entries[0].chapter = { id: "1", name: "Chapter 1" };
    entries[1].areaType = "Area::MainArea";
    entries[1].chapter = { id: "1", name: "Chapter 1" };
    entries[2].areaType = "Area::EventArea";
    entries[2].areaCategoryRaw = 2;
    return {
        schemaVersion: 2,
        generatedAt: "2026-08-31T20:00:00.000Z",
        source: "dokkan-game-db",
        sourceSnapshotVersion: "1787900894",
        sourceDatabaseSha256: "a".repeat(64),
        count: entries.length,
        entries,
        zBattles: [{
            id: "9001",
            typeRaw: "1",
            title: "Omega Shenron",
            subtitle: "Extreme Z-Battle",
            startDate: "2026-08-20T00:00:00.000Z",
            enableBattleAuto: true,
            effectEscalationTypeId: "1",
            priority: 5,
            banner: { sourcePath: "banners/en/event/eve_banner/zbattle_list_banner_9001.png" },
            listButton: { sourcePath: "banners/en/event/eve_listbutton/myp_banner_event_zbattle_9001.png" },
            enemyRanges: [{
                id: "1",
                ordinal: 1,
                startLevel: 1,
                endLevel: 30,
                stats: {
                    status: "raw-z-battle-base",
                    source: "game-db-z-battle",
                    hp: 100,
                    atk: 20,
                    def: 10,
                    unknowns: ["application_formula"],
                },
                escalationTypeIds: {
                    hp: "1",
                    atk: "1",
                    def: "1",
                    specialAttack: "1",
                    card: "1",
                    performance: "1",
                    skill: "1",
                },
            }],
            statusCurves: [{ escalationTypeId: "1", points: [{ level: 1, value: 100 }] }],
            cardEscalations: [],
            skillEscalations: [],
            checkpoints: [{
                id: "1",
                level: 10,
                stamina: 0,
                requiredKeys: 0,
                normalRewardTableGroupId: "1",
                repeatRewards: [{ itemId: "1", itemType: "AwakeningItem", quantity: 1 }],
            }],
            firstRewards: [],
        }],
        supportMemoryRelations: [
            {
                memoryId: "20001",
                missionIds: ["11"],
                relation: "direct-stage-condition",
                targetKind: "quest-level",
                targetId: "101",
            },
            {
                memoryId: "20002",
                missionIds: ["22"],
                relation: "mission-owner",
                targetKind: "area",
                targetId: "8",
            },
            {
                memoryId: "20003",
                missionIds: ["33"],
                relation: "mission-owner",
                targetKind: "z-battle",
                targetId: "9001",
            },
        ],
    };
}

function quest(
    id: string,
    questId: string,
    areaId: string,
    enemyName: string,
    description: string,
    memoryId?: string,
): StageDetail {
    return {
        id,
        stageKind: "quest-level",
        difficultyRaw: 3,
        difficulty: "Raw 3",
        stamina: 25,
        requiredKeys: 0,
        rankExp: 10_000,
        zeni: 5_000,
        linkSkillLevelUpRate: 1.25,
        questId,
        questName: `Quest ${questId}`,
        areaId,
        areaName: `Area ${areaId}`,
        areaType: "event",
        areaCategoryRaw: 2,
        startDate: "2026-08-01T00:00:00.000Z",
        images: {
            header: { sourcePath: `banners/en/event/eve_header/quest_top_banner_${areaId}.png` },
            button: { sourcePath: `banners/en/event/eve_listbutton/myp_banner_event_${areaId}.png` },
        },
        enemies: [
            {
                id: `${id}:1:1:1`,
                battle: 1,
                tile: 1,
                characterId: "1",
                thumbnailId: "1000",
                name: enemyName,
                stats: {
                    status: "unavailable-in-game-db",
                    source: "game-db",
                    unknowns: ["hp", "atk", "def"],
                },
                superAttacks: [{
                    id: "10",
                    specialSetId: "20",
                    name: "Kamehameha",
                    description: "Causes immense damage",
                    style: "Normal",
                    ki: 12,
                }],
                skills: [{ values: [], name: "Guard", description }],
            },
            {
                id: `${id}:1:1:2`,
                battle: 1,
                tile: 1,
                characterId: "2",
                name: id === "101" ? "Vegeta" : enemyName,
                stats: {
                    status: "unavailable-in-game-db",
                    source: "game-db",
                    unknowns: ["hp", "atk", "def"],
                },
                skills: [],
            },
        ],
        supportMemories: memoryId ? [{
            memoryId,
            missionIds: ["11"],
            relation: "direct-stage-condition",
        }] : [],
    };
}
