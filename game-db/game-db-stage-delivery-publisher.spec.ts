import { deepEqual, equal, throws } from "assert";
import { resolve } from "path";
import {
    buildStageDeliveryPublishPlan,
    parseStageDeliveryPublishArgs,
    scopedObjectKey,
    STAGE_DELIVERY_HTTP_CONTENT_TYPE,
    StageDeliveryPublishState,
    validateStageDeliveryCatalogPayload,
} from "./game-db-stage-delivery-publisher";
import { StageCatalogPayload, StageDeliveryManifest } from "./game-db-stage-delivery";

describe("game DB Stage delivery publisher", () => {
    it("parses a channel-scoped dry run", () => {
        const options = parseStageDeliveryPublishArgs([
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
        deepEqual(options, {
            bucket: "dokkanpanion-data",
            objectPrefix: "staging/v2",
            releaseDir: resolve("release"),
            manifestPath: resolve("release", "stage-details-manifest.json"),
            statePath: resolve("state.json"),
            target: "local",
            dryRun: true,
            adoptUnboundState: true,
            maxUploadBytes: 4096,
        });
        equal(scopedObjectKey(options.objectPrefix, "stage-details/objects/a.json.gz"), "staging/v2/stage-details/objects/a.json.gz");
        equal(STAGE_DELIVERY_HTTP_CONTENT_TYPE, "application/gzip");
        throws(() => parseStageDeliveryPublishArgs(["--object-prefix", "../production"]), /Invalid R2 object prefix/);
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
        } as StageDeliveryManifest;
        const options = parseStageDeliveryPublishArgs(["--max-upload-bytes", "4096"]);
        const previous: StageDeliveryPublishState = {
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
        const plan = buildStageDeliveryPublishPlan(
            options,
            manifest,
            20,
            "new-manifest",
            [
                { object: catalog, absolutePath: "catalog" },
                { object: shard, absolutePath: "shard" },
            ],
            previous,
        );
        equal(plan.changedFiles.length, 1);
        equal(plan.changedFiles[0].object.objectKey, shard.objectKey);
        equal(plan.uploadManifest, true);
        equal(plan.totalDatasetBytes, 200);
        equal(plan.uploadBytes, 100);

        throws(
            () => buildStageDeliveryPublishPlan(
                { ...options, objectPrefix: "staging/v2" },
                manifest,
                20,
                "new-manifest",
                plan.files,
                previous,
            ),
            /different destination/,
        );
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
        } as StageDeliveryManifest;
        const options = parseStageDeliveryPublishArgs(["--max-upload-bytes", "100"]);
        throws(
            () => buildStageDeliveryPublishPlan(options, manifest, 20, "manifest", [{ object: catalog, absolutePath: "catalog" }]),
            /above the configured limit/,
        );

        const mismatchedCount = { ...manifest, stageCount: 0 };
        throws(
            () => buildStageDeliveryPublishPlan(
                parseStageDeliveryPublishArgs(["--max-upload-bytes", "4096"]),
                mismatchedCount,
                20,
                "manifest",
                [{ object: catalog, absolutePath: "catalog" }],
            ),
            /stage count/,
        );
    });

    it("rejects exact-target drift and duplicate Z-Battle reward entries before publish", () => {
        const { catalog, manifest } = validationFixture();
        const crossedStageSource = {
            ...catalog,
            awakeningMedalSources: catalog.awakeningMedalSources.map(source => source.kind === "stage-drop"
                ? { ...source, stageIds: ["1", "2"] }
                : source),
        };
        throws(
            () => validateStageDeliveryCatalogPayload(crossedStageSource, manifest),
            /malformed Awakening Medal Stage-drop/,
        );

        const duplicateRewardSource = {
            ...catalog,
            awakeningMedalSources: catalog.awakeningMedalSources.map(source => source.kind === "z-battle-first-reward"
                ? { ...source, rewardEntries: [source.rewardEntries![0], source.rewardEntries![0]] }
                : source),
        };
        throws(
            () => validateStageDeliveryCatalogPayload(duplicateRewardSource, manifest),
            /malformed Awakening Medal Z-Battle/,
        );
    });
});

function validationFixture(): { catalog: StageCatalogPayload, manifest: StageDeliveryManifest } {
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
    } as StageDeliveryManifest;
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
    } as StageCatalogPayload;
    return { catalog, manifest };
}

function object(hashCharacter: string, sizeBytes: number, expandedSizeBytes: number) {
    const hash = hashCharacter.repeat(64);
    return {
        objectKey: `stage-details/objects/${hash}.json.gz`,
        sha256: hash,
        sizeBytes,
        expandedSizeBytes,
        contentType: "application/json" as const,
        contentEncoding: "gzip" as const,
    };
}
