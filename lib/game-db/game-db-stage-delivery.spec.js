"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = require("assert");
const mocha_1 = require("mocha");
const zlib_1 = require("zlib");
const game_db_stage_delivery_1 = require("./game-db-stage-delivery");
(0, mocha_1.describe)("first-party Stage delivery", () => {
    (0, mocha_1.it)("builds deterministic bounded shards and resolvable typed routes", () => {
        const dataset = fixtureDataset();
        const first = (0, game_db_stage_delivery_1.buildStageDelivery)(dataset, 32 * 1024);
        const second = (0, game_db_stage_delivery_1.buildStageDelivery)(dataset, 32 * 1024);
        (0, assert_1.deepEqual)(second.manifest, first.manifest);
        (0, assert_1.equal)(second.catalogGzip.equals(first.catalogGzip), true);
        (0, assert_1.equal)(first.catalog.entries.length, 4);
        (0, assert_1.equal)(first.audit.questLevelRoutes, 3);
        (0, assert_1.equal)(first.audit.zBattleRoutes, 1);
        (0, assert_1.equal)(first.audit.supportMemoryRelations, 3);
        (0, assert_1.equal)(first.audit.eventMissions, 1);
        (0, assert_1.equal)(first.audit.awakeningMedalSources, 3);
        (0, assert_1.equal)(first.audit.maximumShardExpandedBytes <= 32 * 1024, true);
        (0, assert_1.equal)(first.shards.length >= 2, true);
        (0, assert_1.equal)(first.manifest.catalog.objectKey.startsWith("stage-details/objects/"), true);
        (0, assert_1.equal)(first.manifest.fileName, first.manifest.catalog.objectKey);
        (0, assert_1.equal)(first.manifest.sha256, first.manifest.catalog.sha256);
        (0, assert_1.equal)(first.manifest.sizeBytes, first.manifest.catalog.sizeBytes);
        (0, assert_1.equal)(first.manifest.stageCount, first.manifest.questLevelCount);
        (0, assert_1.equal)(first.manifest.characterDropCount, first.catalog.characterDrops?.length);
        (0, assert_1.equal)(first.catalog.assetBaseUrl, "https://assets.dokkanstats.com/assets/global/en");
        (0, assert_1.equal)(first.catalog.eventMissionsComplete, true);
        (0, assert_1.deepEqual)(first.catalog.eventMissions[0], {
            id: "7001",
            areaId: "7",
            categoryId: "7",
            type: "Mission::QuestClearMission::CountMission",
            name: "Clear Stage 1",
            priority: 1,
            ordererId: 1,
            stageIds: ["101"],
            rewards: [
                { itemId: "11", itemType: "Point::Stone", quantity: 1 },
                { itemId: "700", itemType: "AwakeningItem", quantity: 7 },
            ],
        });
        (0, assert_1.deepEqual)(first.catalog.awakeningMedalSources, [
            {
                kind: "stage-drop",
                medalId: "700",
                targetKind: "quest-level",
                targetId: "101",
                areaId: "7",
                questId: "71",
                stageIds: ["101", "102"],
            },
            {
                kind: "z-battle-clear-reward",
                medalId: "700",
                targetKind: "z-battle",
                targetId: "9001",
                rewardEntries: [{ quantity: 1, levels: [10] }],
            },
            {
                kind: "z-battle-first-reward",
                medalId: "700",
                targetKind: "z-battle",
                targetId: "9001",
                rewardEntries: [{ quantity: 3, levels: [1, 2] }],
            },
        ]);
        for (const shard of first.shards) {
            (0, assert_1.equal)(shard.manifest.sizeBytes, shard.gzip.byteLength);
            (0, assert_1.equal)(shard.manifest.expandedSizeBytes, shard.bytes.byteLength);
            (0, assert_1.match)(shard.manifest.sha256, /^[a-f0-9]{64}$/);
        }
        const quest = first.catalog.entries.find(entry => entry.key === "quest-level:101");
        (0, assert_1.equal)(quest.areaName, "Area 7");
        (0, assert_1.equal)(quest.areaType, "Area::MainArea");
        (0, assert_1.equal)(quest.areaCategoryRaw, 7);
        (0, assert_1.equal)(quest.browseCategory, "quests");
        (0, assert_1.equal)(quest.chapterId, "1");
        (0, assert_1.equal)(quest.chapterName, "Chapter 1");
        (0, assert_1.equal)(quest.chapterImagePath, "outgame/extension/adventure/chapter/1/1001.png");
        (0, assert_1.equal)(quest.eventImagePath, "banners/en/event/eve_listbutton/myp_banner_event_7.png");
        (0, assert_1.deepEqual)(quest.enemyNames, ["Goku", "Vegeta"]);
        (0, assert_1.deepEqual)(quest.supportMemoryIds, ["20001"]);
        (0, assert_1.equal)(quest.hasGimmicks, true);
        const deliveredQuest = first.shards.flatMap(shard => shard.payload.questLevels)
            .find(entry => entry.id === "101");
        (0, assert_1.equal)(deliveredQuest.enemies[0].thumbnailId, "1000");
        (0, assert_1.equal)(deliveredQuest.enemies[0].superAttacks?.[0].name, "Kamehameha");
        (0, assert_1.equal)(first.catalog.entries.find(entry => entry.key === "quest-level:201")?.browseCategory, "story");
        const zBattle = first.catalog.entries.find(entry => entry.key === "z-battle:9001");
        (0, assert_1.equal)(zBattle.browseCategory, "z-battles");
        (0, assert_1.equal)(zBattle.eventImagePath, "banners/en/event/eve_listbutton/myp_banner_event_zbattle_9001.png");
        (0, assert_1.deepEqual)(zBattle.supportMemoryIds, ["20003"]);
        const zShard = first.manifest.shards.find(shard => shard.id === zBattle.detailShardId);
        (0, assert_1.equal)(zShard.zBattleIds.includes("9001"), true);
        const deliveredZBattle = first.shards.flatMap(shard => shard.payload.zBattles)
            .find(entry => entry.id === "9001");
        (0, assert_1.equal)(deliveredZBattle.banner?.sourcePath, "banners/en/event/eve_banner/zbattle_list_banner_9001.png");
    });
    (0, mocha_1.it)("fails closed when a normal quest enemy claims unavailable stats", () => {
        const dataset = fixtureDataset();
        dataset.entries[0].enemies[0].stats = {
            status: "unavailable-in-game-db",
            source: "game-db",
            hp: 1,
        };
        (0, assert_1.throws)(() => (0, game_db_stage_delivery_1.buildStageDelivery)(dataset), /invents unavailable HP\/ATK\/DEF/);
    });
    (0, mocha_1.it)("can rotate immutable object hashes without changing expanded payloads", () => {
        const dataset = fixtureDataset();
        const defaultCompression = (0, game_db_stage_delivery_1.buildStageDelivery)(dataset, 32 * 1024);
        const rotatedCompression = (0, game_db_stage_delivery_1.buildStageDelivery)(dataset, 32 * 1024, 8);
        (0, assert_1.equal)(rotatedCompression.manifest.catalog.sha256 === defaultCompression.manifest.catalog.sha256, false);
        (0, assert_1.equal)((0, zlib_1.gunzipSync)(rotatedCompression.catalogGzip).equals(defaultCompression.catalogBytes), true);
        (0, assert_1.throws)(() => (0, game_db_stage_delivery_1.buildStageDelivery)(dataset, 32 * 1024, 0), /compression level/);
    });
    (0, mocha_1.it)("binds the catalog to an explicit owned HTTPS asset root", () => {
        const delivery = (0, game_db_stage_delivery_1.buildStageDelivery)(fixtureDataset(), 32 * 1024, 9, "https://assets.dkbcompanion.com/staging/v2/game-assets/");
        (0, assert_1.equal)(delivery.catalog.assetBaseUrl, "https://assets.dkbcompanion.com/staging/v2/game-assets");
        (0, assert_1.throws)(() => (0, game_db_stage_delivery_1.buildStageDelivery)(fixtureDataset(), 32 * 1024, 9, "http://assets.example.test"), /safe HTTPS URL/);
    });
    (0, mocha_1.it)("rejects a Stage-drop source that crosses its exact area and quest", () => {
        const build = (0, game_db_stage_delivery_1.buildStageDelivery)(fixtureDataset(), 32 * 1024);
        const stageDropIndex = build.catalog.awakeningMedalSources.findIndex(source => source.kind === "stage-drop");
        const malformedCatalog = {
            ...build.catalog,
            awakeningMedalSources: build.catalog.awakeningMedalSources.map((source, index) => index === stageDropIndex
                ? { ...source, stageIds: [source.targetId, "201"] }
                : source),
        };
        (0, assert_1.throws)(() => (0, game_db_stage_delivery_1.validateStageDeliveryRoutes)(malformedCatalog, build.manifest), /invalid exact target/);
    });
    (0, mocha_1.it)("fails closed when a Support Memory target is absent", () => {
        const dataset = fixtureDataset();
        dataset.supportMemoryRelations.push({
            memoryId: "20004",
            missionIds: ["44"],
            relation: "mission-owner",
            targetKind: "area",
            targetId: "999",
        });
        (0, assert_1.throws)(() => (0, game_db_stage_delivery_1.buildStageDelivery)(dataset), /has no catalog target/);
    });
    (0, mocha_1.it)("indexes exact first-party character drops by Stage and reward presentation", () => {
        const dataset = characterDropFixtureDataset();
        const build = (0, game_db_stage_delivery_1.buildStageDelivery)(dataset, 32 * 1024);
        (0, assert_1.equal)(build.manifest.characterDropCount, 6);
        (0, assert_1.deepEqual)(build.catalog.characterDrops, [
            { stageId: "101", reward: cardReward() },
            { stageId: "101", reward: { ...cardReward(), quantity: 2 } },
            { stageId: "101", reward: { ...cardReward(), quantity: 3 } },
            { stageId: "102", reward: cardReward() },
            { stageId: "102", reward: { ...cardReward(), quantity: 2 } },
            { stageId: "102", reward: { ...cardReward(), quantity: 3 } },
        ]);
        (0, assert_1.equal)(Object.prototype.hasOwnProperty.call(build.catalog.characterDrops[0].reward, "quantity"), false);
        (0, assert_1.equal)(Object.prototype.hasOwnProperty.call(build.catalog.characterDrops[0].reward, "sourceRowId"), false);
        (0, assert_1.equal)(Object.prototype.hasOwnProperty.call(build.catalog.characterDrops[0].reward, "dropTypeRaw"), false);
        (0, assert_1.equal)(build.catalog.characterDrops?.some(drop => drop.reward.itemType !== "Card"), false);
    });
    (0, mocha_1.it)("rejects malformed character drop indexes", () => {
        const build = (0, game_db_stage_delivery_1.buildStageDelivery)(characterDropFixtureDataset(), 32 * 1024);
        const firstDrop = build.catalog.characterDrops[0];
        (0, assert_1.throws)(() => (0, game_db_stage_delivery_1.validateStageDeliveryRoutes)(build.catalog, { ...build.manifest, characterDropCount: 0 }), /Character drop count mismatch/);
        (0, assert_1.throws)(() => (0, game_db_stage_delivery_1.validateStageDeliveryRoutes)({ ...build.catalog, characterDrops: [{ ...firstDrop, stageId: "999" }] }, { ...build.manifest, characterDropCount: 1 }), /no catalog Stage target/);
        (0, assert_1.throws)(() => (0, game_db_stage_delivery_1.validateStageDeliveryRoutes)({ ...build.catalog, characterDrops: [{ ...firstDrop, reward: { ...firstDrop.reward, itemId: "bad" } }] }, { ...build.manifest, characterDropCount: 1 }), /invalid Card ID/);
        (0, assert_1.throws)(() => (0, game_db_stage_delivery_1.validateStageDeliveryRoutes)({ ...build.catalog, characterDrops: [{
                    ...firstDrop,
                    reward: { ...firstDrop.reward, itemType: "AwakeningItem" },
                }] }, { ...build.manifest, characterDropCount: 1 }), /invalid Card ID/);
        (0, assert_1.throws)(() => (0, game_db_stage_delivery_1.validateStageDeliveryRoutes)({ ...build.catalog, characterDrops: [firstDrop, firstDrop] }, { ...build.manifest, characterDropCount: 2 }), /Duplicate Character drop/);
    });
});
function characterDropFixtureDataset() {
    const dataset = fixtureDataset();
    dataset.entries[0].bossDrops.push({
        sourceRowId: "6001",
        ...cardReward(),
        dropTypeRaw: "boss",
        quantityStatus: "unknown",
        chanceStatus: "unknown",
    }, {
        sourceRowId: "6002",
        ...cardReward(),
        dropTypeRaw: "boss",
        quantityStatus: "unknown",
        chanceStatus: "unknown",
    });
    dataset.entries[0].dropPreviews[0].items.push(cardReward(), cardReward(), { ...cardReward(), quantity: 2 }, { ...cardReward(), quantity: 3 }, { itemId: "11", itemType: "Point::Stone", quantity: 1 });
    return dataset;
}
function cardReward() {
    return {
        itemId: "1001",
        itemType: "Card",
        name: "Goku",
        thumbnailId: "1000",
        rarityRaw: 3,
        elementRaw: 0,
        detailCharacterId: "1001",
    };
}
function fixtureDataset() {
    const entries = [
        quest("101", "71", "7", "Goku", "x".repeat(18000), "20001"),
        quest("102", "71", "7", "Vegeta", "y".repeat(18000)),
        quest("201", "81", "8", "Piccolo", "z".repeat(18000)),
    ];
    entries[0].areaType = "Area::MainArea";
    entries[0].areaCategoryRaw = 7;
    entries[0].chapter = { id: "1", name: "Chapter 1" };
    entries[0].bossDrops = [{
            sourceRowId: "5001",
            itemType: "AwakeningItem",
            itemId: "700",
            dropTypeRaw: "boss",
            quantityStatus: "unknown",
            chanceStatus: "unknown",
        }];
    entries[0].dropPreviews = [{
            sourceRowId: "5002",
            difficultyValues: [3, 4],
            items: [{ itemId: "700", itemType: "AwakeningItem" }],
        }];
    entries[1].areaType = "Area::MainArea";
    entries[1].difficultyRaw = 4;
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
                        repeatRewards: [{ itemId: "700", itemType: "AwakeningItem", quantity: 1 }],
                    }],
                firstRewards: [
                    {
                        id: "2",
                        level: 2,
                        rewardSetId: "2",
                        rewards: [{ itemId: "700", itemType: "AwakeningItem", quantity: 3 }],
                    },
                    {
                        id: "1",
                        level: 1,
                        rewardSetId: "1",
                        rewards: [{ itemId: "700", itemType: "AwakeningItem", quantity: 3 }],
                    },
                ],
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
        eventMissions: [{
                id: "7001",
                areaId: "7",
                categoryId: "7",
                type: "Mission::QuestClearMission::CountMission",
                name: "Clear Stage 1",
                priority: 1,
                ordererId: 1,
                stageIds: ["101"],
                rewards: [
                    { itemId: "11", itemType: "Point::Stone", quantity: 1 },
                    { itemId: "700", itemType: "AwakeningItem", quantity: 7 },
                ],
            }],
    };
}
function quest(id, questId, areaId, enemyName, description, memoryId) {
    return {
        id,
        stageKind: "quest-level",
        difficultyRaw: 3,
        difficulty: "Raw 3",
        stamina: 25,
        requiredKeys: 0,
        rankExp: 10000,
        zeni: 5000,
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
//# sourceMappingURL=game-db-stage-delivery.spec.js.map