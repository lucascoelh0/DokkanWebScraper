"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = require("assert");
const path_1 = require("path");
const game_db_stage_delivery_publisher_1 = require("./game-db-stage-delivery-publisher");
describe("game DB Stage delivery publisher", () => {
    it("parses a channel-scoped dry run", () => {
        const options = (0, game_db_stage_delivery_publisher_1.parseStageDeliveryPublishArgs)([
            "--dry-run",
            "--local",
            "--object-prefix=/staging/v2/",
            "--release-dir",
            "release",
            "--state=state.json",
            "--max-upload-bytes",
            "4096",
            "--adopt-unbound-state",
        ]);
        (0, assert_1.deepEqual)(options, {
            bucket: "dokkanpanion-data",
            objectPrefix: "staging/v2",
            releaseDir: (0, path_1.resolve)("release"),
            manifestPath: (0, path_1.resolve)("release", "stage-details-manifest.json"),
            statePath: (0, path_1.resolve)("state.json"),
            target: "local",
            dryRun: true,
            adoptUnboundState: true,
            maxUploadBytes: 4096,
        });
        (0, assert_1.equal)((0, game_db_stage_delivery_publisher_1.scopedObjectKey)(options.objectPrefix, "stage-details/objects/a.json.gz"), "staging/v2/stage-details/objects/a.json.gz");
        (0, assert_1.equal)(game_db_stage_delivery_publisher_1.STAGE_DELIVERY_HTTP_CONTENT_TYPE, "application/gzip");
        (0, assert_1.throws)(() => (0, game_db_stage_delivery_publisher_1.parseStageDeliveryPublishArgs)(["--object-prefix", "../production"]), /Invalid R2 object prefix/);
    });
    it("plans only changed immutable objects and promotes the manifest last", () => {
        const catalog = object("a", 100, 500);
        const shard = object("b", 80, 400);
        const manifest = {
            schemaVersion: 2,
            contract: "dokkan-stage-delivery",
            contractVersion: "1.1.0",
            datasetVersion: "2026-09-02T20:00:00.000Z",
            generatedAt: "2026-09-02T20:00:00.000Z",
            source: "dokkan-game-db",
            sourceSnapshotVersion: "1787900894",
            sourceDatabaseSha256: "c".repeat(64),
            questLevelCount: 1,
            zBattleCount: 1,
            supportMemoryRelationCount: 1,
            eventMissionCount: 0,
            awakeningMedalSourceCount: 0,
            fileName: catalog.objectKey,
            sha256: catalog.sha256,
            sizeBytes: catalog.sizeBytes,
            stageCount: 1,
            catalog,
            shards: [{ ...shard, id: "0001", questLevelIds: ["1"], zBattleIds: ["2"], areaIds: ["3"] }],
        };
        const options = (0, game_db_stage_delivery_publisher_1.parseStageDeliveryPublishArgs)(["--max-upload-bytes", "4096"]);
        const previous = {
            schemaVersion: 2,
            status: "complete",
            destination: {
                bucket: options.bucket,
                objectPrefix: options.objectPrefix,
                target: options.target,
                manifestObjectKey: "stage-details-manifest.json",
            },
            datasetVersion: "old",
            manifestSha256: "old-manifest",
            objects: { [catalog.objectKey]: { sha256: catalog.sha256, sizeBytes: catalog.sizeBytes } },
        };
        const plan = (0, game_db_stage_delivery_publisher_1.buildStageDeliveryPublishPlan)(options, manifest, 20, "new-manifest", [
            { object: catalog, absolutePath: "catalog" },
            { object: shard, absolutePath: "shard" },
        ], previous);
        (0, assert_1.equal)(plan.changedFiles.length, 1);
        (0, assert_1.equal)(plan.changedFiles[0].object.objectKey, shard.objectKey);
        (0, assert_1.equal)(plan.uploadManifest, true);
        (0, assert_1.equal)(plan.totalDatasetBytes, 200);
        (0, assert_1.equal)(plan.uploadBytes, 100);
        (0, assert_1.throws)(() => (0, game_db_stage_delivery_publisher_1.buildStageDeliveryPublishPlan)({ ...options, objectPrefix: "staging/v2" }, manifest, 20, "new-manifest", plan.files, previous), /different destination/);
    });
    it("rejects duplicate object keys and budgets below the release size", () => {
        const catalog = object("a", 100, 500);
        const manifest = {
            schemaVersion: 2,
            contract: "dokkan-stage-delivery",
            contractVersion: "1.1.0",
            datasetVersion: "2026-09-02T20:00:00.000Z",
            generatedAt: "2026-09-02T20:00:00.000Z",
            source: "dokkan-game-db",
            sourceSnapshotVersion: "1787900894",
            sourceDatabaseSha256: "c".repeat(64),
            questLevelCount: 1,
            zBattleCount: 0,
            supportMemoryRelationCount: 0,
            eventMissionCount: 0,
            awakeningMedalSourceCount: 0,
            fileName: catalog.objectKey,
            sha256: catalog.sha256,
            sizeBytes: catalog.sizeBytes,
            stageCount: 1,
            catalog,
            shards: [],
        };
        const options = (0, game_db_stage_delivery_publisher_1.parseStageDeliveryPublishArgs)(["--max-upload-bytes", "100"]);
        (0, assert_1.throws)(() => (0, game_db_stage_delivery_publisher_1.buildStageDeliveryPublishPlan)(options, manifest, 20, "manifest", [{ object: catalog, absolutePath: "catalog" }]), /above the configured limit/);
        const mismatchedCount = { ...manifest, stageCount: 0 };
        (0, assert_1.throws)(() => (0, game_db_stage_delivery_publisher_1.buildStageDeliveryPublishPlan)((0, game_db_stage_delivery_publisher_1.parseStageDeliveryPublishArgs)(["--max-upload-bytes", "4096"]), mismatchedCount, 20, "manifest", [{ object: catalog, absolutePath: "catalog" }]), /stage count/);
    });
    it("rejects exact-target drift and duplicate Z-Battle reward entries before publish", () => {
        const { catalog, manifest } = validationFixture();
        const crossedStageSource = {
            ...catalog,
            awakeningMedalSources: catalog.awakeningMedalSources.map(source => source.kind === "stage-drop"
                ? { ...source, stageIds: ["1", "2"] }
                : source),
        };
        (0, assert_1.throws)(() => (0, game_db_stage_delivery_publisher_1.validateStageDeliveryCatalogPayload)(crossedStageSource, manifest), /malformed Awakening Medal Stage-drop/);
        const duplicateRewardSource = {
            ...catalog,
            awakeningMedalSources: catalog.awakeningMedalSources.map(source => source.kind === "z-battle-first-reward"
                ? { ...source, rewardEntries: [source.rewardEntries[0], source.rewardEntries[0]] }
                : source),
        };
        (0, assert_1.throws)(() => (0, game_db_stage_delivery_publisher_1.validateStageDeliveryCatalogPayload)(duplicateRewardSource, manifest), /malformed Awakening Medal Z-Battle/);
    });
});
function validationFixture() {
    const catalogObject = object("a", 100, 500);
    const shard = { ...object("b", 80, 400), id: "0001", questLevelIds: ["1", "2"], zBattleIds: ["3"], areaIds: ["10", "20"] };
    const manifest = {
        schemaVersion: 2,
        contract: "dokkan-stage-delivery",
        contractVersion: "1.1.0",
        datasetVersion: "2026-09-02T20:00:00.000Z",
        generatedAt: "2026-09-02T20:00:00.000Z",
        source: "dokkan-game-db",
        sourceSnapshotVersion: "1787900894",
        sourceDatabaseSha256: "c".repeat(64),
        questLevelCount: 2,
        zBattleCount: 1,
        supportMemoryRelationCount: 0,
        eventMissionCount: 0,
        awakeningMedalSourceCount: 2,
        fileName: catalogObject.objectKey,
        sha256: catalogObject.sha256,
        sizeBytes: catalogObject.sizeBytes,
        stageCount: 2,
        catalog: catalogObject,
        shards: [shard],
    };
    const catalog = {
        schemaVersion: 1,
        contract: "dokkan-stage-delivery",
        contractVersion: "1.1.0",
        datasetVersion: manifest.datasetVersion,
        generatedAt: manifest.generatedAt,
        source: "dokkan-game-db",
        sourceSnapshotVersion: manifest.sourceSnapshotVersion,
        sourceDatabaseSha256: manifest.sourceDatabaseSha256,
        assetBaseUrl: "https://example.test/assets",
        count: 3,
        questLevelCount: 2,
        zBattleCount: 1,
        entries: [
            {
                key: "quest-level:1", kind: "quest-level", id: "1", title: "Stage 1",
                areaId: "10", questId: "100", enemyNames: [], supportMemoryIds: [],
                hasRewards: true, hasGimmicks: false, detailShardId: "0001",
            },
            {
                key: "quest-level:2", kind: "quest-level", id: "2", title: "Stage 2",
                areaId: "20", questId: "200", enemyNames: [], supportMemoryIds: [],
                hasRewards: true, hasGimmicks: false, detailShardId: "0001",
            },
            {
                key: "z-battle:3", kind: "z-battle", id: "3", title: "Z-Battle",
                enemyNames: [], supportMemoryIds: [], hasRewards: true, hasGimmicks: false,
                detailShardId: "0001",
            },
        ],
        supportMemoryRelations: [],
        eventMissionsComplete: true,
        eventMissions: [],
        awakeningMedalSources: [
            {
                kind: "stage-drop",
                medalId: "700",
                targetKind: "quest-level",
                targetId: "1",
                areaId: "10",
                questId: "100",
                stageIds: ["1"],
            },
            {
                kind: "z-battle-first-reward",
                medalId: "700",
                targetKind: "z-battle",
                targetId: "3",
                rewardEntries: [{ quantity: 3, levels: [1, 2] }],
            },
        ],
    };
    return { catalog, manifest };
}
function object(hashCharacter, sizeBytes, expandedSizeBytes) {
    const hash = hashCharacter.repeat(64);
    return {
        objectKey: `stage-details/objects/${hash}.json.gz`,
        sha256: hash,
        sizeBytes,
        expandedSizeBytes,
        contentType: "application/json",
        contentEncoding: "gzip",
    };
}
//# sourceMappingURL=game-db-stage-delivery-publisher.spec.js.map