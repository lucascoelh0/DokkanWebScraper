"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = require("assert");
const mocha_1 = require("mocha");
const game_db_reward_item_audit_1 = require("./game-db-reward-item-audit");
const SNAPSHOT = "1788329250";
const DATABASE_SHA256 = "7a6ca01808aea355ef28f9c0190e2c072f43a7c08be41d363f5b052824922495";
function emptyTables() {
    return Object.fromEntries(game_db_reward_item_audit_1.REWARD_ITEM_AUDIT_TABLES.map(table => [table, []]));
}
function wallpaper(itemId) {
    const paddedId = itemId.padStart(4, "0");
    return {
        rewardThumbnailAssetPath: `item/wallpaper/${paddedId}/icon_${paddedId}.png`,
        thumbnailAssetPath: `item/wallpaper/${paddedId}/thumb_${paddedId}.png`,
        fullImageAssetPath: `item/wallpaper/${paddedId}/full_${paddedId}.png`,
    };
}
function wallpaperReward(itemId, quantity = 1) {
    return { itemId, itemType: "WallpaperItem", quantity, wallpaper: wallpaper(itemId) };
}
function dataset(rewards = []) {
    return {
        schemaVersion: 2,
        generatedAt: "2026-09-04T12:00:00.000Z",
        source: "dokkan-game-db",
        sourceSnapshotVersion: SNAPSHOT,
        sourceDatabaseSha256: DATABASE_SHA256,
        count: 0,
        entries: [],
        zBattles: [],
        supportMemoryRelations: [],
        eventMissions: rewards.length ? [{
                id: "10", areaId: "1", categoryId: "1", type: "event", name: "Stage-bound mission",
                priority: 0, ordererId: 0, stageIds: ["100"], rewards,
            }] : [],
    };
}
function bossDropDataset(includeWallpaper = true) {
    const result = dataset();
    result.count = 1;
    result.entries = [{
            id: "1000", stageKind: "quest-level", difficulty: "Raw 1", stamina: 0, requiredKeys: 0,
            rankExp: 0, zeni: 0, linkSkillLevelUpRate: 0, questId: "100", questName: "Future Quest",
            areaId: "1", areaName: "Future Area", areaType: "Area::Event", images: {}, enemies: [],
            bossDrops: includeWallpaper ? [{
                    sourceRowId: "80", itemType: "WallpaperItem", itemId: "76", dropTypeRaw: "boss",
                    quantityStatus: "unknown", chanceStatus: "unknown", wallpaper: wallpaper("76"),
                }] : [],
        }];
    return result;
}
function previewTables(difficulties = "[5]") {
    const tables = emptyTables();
    tables.sugoroku_maps = [
        { id: "1000", quest_id: "100", difficulty: "5" },
        { id: "1001", quest_id: "100", difficulty: "7" },
    ];
    tables.quest_drop_item_views = [{
            id: "62", quest_id: "100", ...(difficulties !== null ? { difficulties } : {}),
            item1_id: "76", item1_type: "WallpaperItem",
        }];
    tables.wallpaper_items = [{ id: "76", name: "Companions on Planet Vampa", description: "Official" }];
    return tables;
}
function previewDataset(mapIds) {
    const result = dataset();
    result.count = 2;
    result.entries = [
        { id: "1000", difficultyRaw: 5 },
        { id: "1001", difficultyRaw: 7 },
    ].map(({ id, difficultyRaw }) => ({
        id, stageKind: "quest-level", difficulty: `Raw ${difficultyRaw}`, stamina: 0, requiredKeys: 0,
        rankExp: 0, zeni: 0, linkSkillLevelUpRate: 0, questId: "100", questName: "Future Quest",
        areaId: "1", areaName: "Future Area", areaType: "Area::Event", images: {}, enemies: [],
        dropPreviews: mapIds.includes(id) ? [{
                sourceRowId: "62", difficultyValues: [5],
                items: [{ itemId: "76", itemType: "WallpaperItem", wallpaper: wallpaper("76") }],
            }] : [],
    }));
    return result;
}
(0, mocha_1.describe)("reward item audit", function () {
    (0, mocha_1.it)("classifies enriched Treasure rewards as complete inside the bounded Stage contract", function () {
        const tables = emptyTables();
        tables.areas = [{ id: "1" }];
        tables.missions = [{ id: "10", area_id: "1" }];
        tables.mission_rewards = [{
                id: "1", mission_id: "10", item_type: "TreasureItem", item_id: "8", quantity: "25",
            }];
        tables.treasure_items = [{
                id: "8", name: "Kachi Katchin", description: "Official description", rarity: "2",
                selling_exchange_point: "1", image_suffix_number: "13", will_expire: "0",
            }];
        const audit = (0, game_db_reward_item_audit_1.buildRewardItemAudit)({
            generatedAt: "2026-09-05T12:00:00.000Z",
            sourceSnapshotVersion: SNAPSHOT,
            sourceDatabaseSha256: DATABASE_SHA256,
            tables,
            stageDataset: dataset([{
                    itemId: "8",
                    itemType: "TreasureItem",
                    quantity: 25,
                    name: "Kachi Katchin",
                    description: "Official description",
                    thumbnailId: "13",
                    rarityRaw: 2,
                    iconAssetPath: "item/other/en/thumb/thumb_trade_jewel_00013/thumb_trade_jewel_00013.png",
                    treasure: { sellingExchangePointRaw: 1, willExpire: false },
                }]),
            wallpaperAssetPresentationIds: [],
        });
        const treasure = audit.matrix.find(item => item.itemType === "TreasureItem");
        (0, assert_1.equal)(treasure.classification, "partial");
        (0, assert_1.equal)(treasure.dimensions.stageProjection.status, "complete");
        (0, assert_1.equal)(treasure.dimensions.renderer.status, "complete");
        (0, assert_1.equal)(treasure.dimensions.detailNavigation.status, "complete");
    });
    (0, mocha_1.it)("separates global, Stage-deliverable, delivered, and out-of-contract wallpaper coverage", function () {
        const tables = emptyTables();
        tables.areas = [{ id: "1" }];
        tables.missions = [{ id: "10", area_id: "1" }, { id: "11", area_id: "" }];
        tables.mission_rewards = [
            { id: "1", mission_id: "10", item_type: "WallpaperItem", item_id: "76", quantity: "1" },
            { id: "2", mission_id: "11", item_type: "WallpaperItem", item_id: "39", quantity: "1" },
            { id: "3", mission_id: "10", item_type: "Point::Stone", item_id: "1", quantity: "5" },
            { id: "4", mission_id: "10", item_type: "AwakeningItem", item_id: "9", quantity: "1" },
            { id: "5", mission_id: "10", item_type: "SupportMemory", item_id: "20009", quantity: "1" },
        ];
        tables.mission_category_rewards = [{ id: "20", item1_type: "WallpaperItem", item1_id: "45" }];
        tables.rmbattle_mission_rewards = [{ id: "30", item_type: "WallpaperItem", item_id: "68", quantity: "1" }];
        tables.wallpaper_items = [
            { id: "39", name: "Wallpaper 39", description: "Official" },
            { id: "45", name: "Wallpaper 45", description: "Official" },
            { id: "68", name: "Wallpaper 68", description: "Official" },
            { id: "76", name: "Companions on Planet Vampa", description: "Official description" },
        ];
        tables.awakening_items = [{ id: "9" }];
        tables.support_memories = [{ id: "20009" }];
        const audit = (0, game_db_reward_item_audit_1.buildRewardItemAudit)({
            generatedAt: "2026-09-04T12:00:00.000Z",
            sourceSnapshotVersion: SNAPSHOT,
            sourceDatabaseSha256: DATABASE_SHA256,
            tables,
            stageDataset: dataset([wallpaperReward("76")]),
            wallpaperAssetPresentationIds: ["39", "45", "68", "76"],
        });
        (0, assert_1.equal)(audit.wallpaper.globalAuditedCoverage.occurrenceCount, 4);
        (0, assert_1.equal)(audit.wallpaper.stageDeliverableCoverage.occurrenceCount, 1);
        (0, assert_1.equal)(audit.wallpaper.stageDeliveredCoverage.occurrenceCount, 1);
        (0, assert_1.equal)(audit.wallpaper.outsideCurrentConsumerContract.occurrenceCount, 3);
        (0, assert_1.deepEqual)(audit.wallpaper.outsideCurrentConsumerContract.classifications.map(item => item.occurrenceCount), [1, 1, 1]);
        (0, assert_1.equal)(audit.wallpaper.catalogAndAssets.completeCount, 4);
        const wallpaper = audit.matrix.find(item => item.itemType === "WallpaperItem");
        (0, assert_1.equal)(wallpaper.classification, "partial");
        (0, assert_1.equal)(wallpaper.dimensions.renderer.status, "complete");
        (0, assert_1.equal)(wallpaper.dimensions.surfaceCoverage.status, "partial");
        const awakening = audit.matrix.find(item => item.itemType === "AwakeningItem");
        (0, assert_1.equal)(awakening.classification, "detail-missing");
        (0, assert_1.equal)(awakening.dimensions.renderer.status, "complete");
        const supportMemory = audit.matrix.find(item => item.itemType === "SupportMemory");
        (0, assert_1.equal)(supportMemory.classification, "partial");
        (0, assert_1.equal)(supportMemory.dimensions.detailNavigation.status, "complete");
        const stone = audit.matrix.find(item => item.itemType === "Point::Stone");
        (0, assert_1.equal)(stone.classification, "metadata-missing");
        (0, assert_1.equal)(stone.dimensions.asset.status, "complete");
        (0, assert_1.equal)(stone.currentFallback, "Dragon Stone label and official icon; no visible placeholder");
    });
    (0, mocha_1.it)("fails closed for a missing referenced catalog row", function asyncTest() {
        const tables = emptyTables();
        tables.areas = [{ id: "1" }];
        tables.missions = [{ id: "10", area_id: "1" }];
        tables.mission_rewards = [{ id: "1", mission_id: "10", item_type: "WallpaperItem", item_id: "76", quantity: "1" }];
        return (0, assert_1.rejects)(Promise.resolve().then(() => (0, game_db_reward_item_audit_1.buildRewardItemAudit)({
            generatedAt: "2026-09-04T12:00:00.000Z",
            sourceSnapshotVersion: SNAPSHOT,
            sourceDatabaseSha256: DATABASE_SHA256,
            tables,
            stageDataset: dataset([wallpaperReward("76")]),
            wallpaperAssetPresentationIds: [],
        })), /missing wallpaper_items IDs/);
    });
    (0, mocha_1.it)("fails closed when Stage delivery does not match the Stage-deliverable source set", function asyncTest() {
        const tables = emptyTables();
        tables.areas = [{ id: "1" }];
        tables.missions = [{ id: "10", area_id: "1" }];
        tables.mission_rewards = [{ id: "1", mission_id: "10", item_type: "WallpaperItem", item_id: "76", quantity: "1" }];
        tables.wallpaper_items = [{ id: "76", name: "Companions on Planet Vampa", description: "Official" }];
        return (0, assert_1.rejects)(Promise.resolve().then(() => (0, game_db_reward_item_audit_1.buildRewardItemAudit)({
            generatedAt: "2026-09-04T12:00:00.000Z",
            sourceSnapshotVersion: SNAPSHOT,
            sourceDatabaseSha256: DATABASE_SHA256,
            tables,
            stageDataset: dataset(),
            wallpaperAssetPresentationIds: ["76"],
        })), /eventMissions wallpaper delivery does not match mission_rewards/);
    });
    (0, mocha_1.it)("reconciles a future Stage boss-drop wallpaper without requiring a mission id", function () {
        const tables = emptyTables();
        tables.sugoroku_maps = [{ id: "1000", quest_id: "100" }];
        tables.sugoroku_map_boss_drop_items = [{
                id: "80", sugoroku_map_id: "1000", quest_id: "100", drop_type: "boss",
                item_id: "76", item_type: "WallpaperItem",
            }];
        tables.wallpaper_items = [{ id: "76", name: "Companions on Planet Vampa", description: "Official" }];
        const audit = (0, game_db_reward_item_audit_1.buildRewardItemAudit)({
            generatedAt: "2026-09-04T12:00:00.000Z",
            sourceSnapshotVersion: SNAPSHOT,
            sourceDatabaseSha256: DATABASE_SHA256,
            tables,
            stageDataset: bossDropDataset(),
            wallpaperAssetPresentationIds: ["76"],
        });
        (0, assert_1.equal)(audit.wallpaper.globalAuditedCoverage.occurrenceCount, 1);
        (0, assert_1.equal)(audit.wallpaper.stageDeliverableCoverage.occurrenceCount, 1);
        (0, assert_1.equal)(audit.wallpaper.stageDeliveredCoverage.occurrenceCount, 1);
        (0, assert_1.equal)(audit.wallpaper.outsideCurrentConsumerContract.occurrenceCount, 0);
        const boss = audit.wallpaper.stageSurfaceCoverage.find(item => item.deliverySurface === "questLevelBossDrops");
        (0, assert_1.equal)(boss.sourceOccurrenceCount, 1);
        (0, assert_1.equal)(boss.deliverableOccurrenceCount, 1);
        (0, assert_1.equal)(boss.deliveredOccurrenceCount, 1);
        (0, assert_1.equal)(boss.identityCoverage, "exact-source-row-owner-item");
        (0, assert_1.equal)(boss.reconciliation, "exact");
    });
    (0, mocha_1.it)("fails closed when a source boss-drop wallpaper is absent from Stage delivery", function asyncTest() {
        const tables = emptyTables();
        tables.sugoroku_maps = [{ id: "1000", quest_id: "100" }];
        tables.sugoroku_map_boss_drop_items = [{
                id: "80", sugoroku_map_id: "1000", quest_id: "100", drop_type: "boss",
                item_id: "76", item_type: "WallpaperItem",
            }];
        tables.wallpaper_items = [{ id: "76", name: "Companions on Planet Vampa", description: "Official" }];
        return (0, assert_1.rejects)(Promise.resolve().then(() => (0, game_db_reward_item_audit_1.buildRewardItemAudit)({
            generatedAt: "2026-09-04T12:00:00.000Z",
            sourceSnapshotVersion: SNAPSHOT,
            sourceDatabaseSha256: DATABASE_SHA256,
            tables,
            stageDataset: bossDropDataset(false),
            wallpaperAssetPresentationIds: ["76"],
        })), /questLevelBossDrops wallpaper delivery does not match sugoroku_map_boss_drop_items/);
    });
    (0, mocha_1.it)("reconciles a drop-preview wallpaper only for maps allowed by difficulties", function () {
        const audit = (0, game_db_reward_item_audit_1.buildRewardItemAudit)({
            generatedAt: "2026-09-04T12:00:00.000Z",
            sourceSnapshotVersion: SNAPSHOT,
            sourceDatabaseSha256: DATABASE_SHA256,
            tables: previewTables(),
            stageDataset: previewDataset(["1000"]),
            wallpaperAssetPresentationIds: ["76"],
        });
        (0, assert_1.equal)(audit.wallpaper.stageDeliverableCoverage.occurrenceCount, 1);
        (0, assert_1.equal)(audit.wallpaper.stageDeliveredCoverage.occurrenceCount, 1);
        (0, assert_1.equal)(audit.wallpaper.outsideCurrentConsumerContract.occurrenceCount, 0);
        const preview = audit.wallpaper.stageSurfaceCoverage.find(item => item.deliverySurface === "questLevelDropPreviews");
        (0, assert_1.equal)(preview.sourceOccurrenceCount, 1);
        (0, assert_1.equal)(preview.deliverableOccurrenceCount, 1);
        (0, assert_1.equal)(preview.expectedDeliveryCount, 1);
        (0, assert_1.equal)(preview.deliveredOccurrenceCount, 1);
        (0, assert_1.equal)(preview.identityCoverage, "owner-row-item-multiset-slot-not-preserved");
    });
    (0, mocha_1.it)("fails when the allowed map omits its drop-preview wallpaper", function asyncTest() {
        return (0, assert_1.rejects)(Promise.resolve().then(() => (0, game_db_reward_item_audit_1.buildRewardItemAudit)({
            generatedAt: "2026-09-04T12:00:00.000Z",
            sourceSnapshotVersion: SNAPSHOT,
            sourceDatabaseSha256: DATABASE_SHA256,
            tables: previewTables(),
            stageDataset: previewDataset([]),
            wallpaperAssetPresentationIds: ["76"],
        })), /questLevelDropPreviews wallpaper delivery does not match quest_drop_item_views/);
    });
    (0, mocha_1.it)("fails when a forbidden map contains the drop-preview wallpaper", function asyncTest() {
        return (0, assert_1.rejects)(Promise.resolve().then(() => (0, game_db_reward_item_audit_1.buildRewardItemAudit)({
            generatedAt: "2026-09-04T12:00:00.000Z",
            sourceSnapshotVersion: SNAPSHOT,
            sourceDatabaseSha256: DATABASE_SHA256,
            tables: previewTables(),
            stageDataset: previewDataset(["1000", "1001"]),
            wallpaperAssetPresentationIds: ["76"],
        })), /questLevelDropPreviews wallpaper delivery does not match quest_drop_item_views/);
    });
    for (const [label, difficulties, error] of [
        ["missing", null, /Stage drop view 62 difficulties must be an array/],
        ["blank", "", /Stage drop view 62 difficulties must be an array/],
        ["malformed JSON", "not-json", /Stage drop view 62 difficulties contains invalid JSON/],
        ["invalid ID", "[\"not-an-id\"]", /Stage drop view 62 difficulties contains an invalid ID/],
    ]) {
        (0, mocha_1.it)(`fails closed for ${label} drop-preview difficulties`, function asyncTest() {
            return (0, assert_1.rejects)(Promise.resolve().then(() => (0, game_db_reward_item_audit_1.buildRewardItemAudit)({
                generatedAt: "2026-09-04T12:00:00.000Z",
                sourceSnapshotVersion: SNAPSHOT,
                sourceDatabaseSha256: DATABASE_SHA256,
                tables: previewTables(difficulties),
                stageDataset: previewDataset([]),
                wallpaperAssetPresentationIds: ["76"],
            })), error);
        });
    }
    (0, mocha_1.it)("treats an empty difficulties array as valid and projects no preview", function () {
        const audit = (0, game_db_reward_item_audit_1.buildRewardItemAudit)({
            generatedAt: "2026-09-04T12:00:00.000Z",
            sourceSnapshotVersion: SNAPSHOT,
            sourceDatabaseSha256: DATABASE_SHA256,
            tables: previewTables("[]"),
            stageDataset: previewDataset([]),
            wallpaperAssetPresentationIds: ["76"],
        });
        const preview = audit.wallpaper.stageSurfaceCoverage.find(item => item.deliverySurface === "questLevelDropPreviews");
        (0, assert_1.equal)(preview.sourceOccurrenceCount, 1);
        (0, assert_1.equal)(preview.deliverableOccurrenceCount, 0);
        (0, assert_1.equal)(preview.expectedDeliveryCount, 0);
        (0, assert_1.equal)(preview.deliveredOccurrenceCount, 0);
    });
});
//# sourceMappingURL=game-db-reward-item-audit.spec.js.map