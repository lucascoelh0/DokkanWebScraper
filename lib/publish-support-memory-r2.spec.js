"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = require("assert");
const path_1 = require("path");
const publish_support_memory_r2_1 = require("./publish-support-memory-r2");
const support_memory_dataset_artifacts_1 = require("./support-memory-dataset-artifacts");
describe("support-memory R2 publisher", () => {
    it("defaults to the production bucket, remote target, and 1 GB budget", () => {
        const options = (0, publish_support_memory_r2_1.parseSupportMemoryR2PublishArgs)([]);
        (0, assert_1.equal)(options.bucket, "dokkanpanion-data");
        (0, assert_1.equal)(options.objectPrefix, "");
        (0, assert_1.equal)(options.target, "remote");
        (0, assert_1.equal)(options.dryRun, false);
        (0, assert_1.equal)(options.maxUploadBytes, 1024 * 1024 * 1024);
        (0, assert_1.equal)(options.keepStaleAssets, false);
        (0, assert_1.equal)(options.adoptUnboundState, false);
    });
    it("supports dry-run, local target, and explicit paths", () => {
        const options = (0, publish_support_memory_r2_1.parseSupportMemoryR2PublishArgs)([
            "--dry-run",
            "--local",
            "--details",
            "details.json",
            "--manifest=manifest.json",
            "--state",
            "state.json",
            "--object-prefix=/staging/v2/",
            "--keep-stale-assets",
            "--adopt-unbound-state",
            "--max-upload-bytes",
            "1024",
        ]);
        (0, assert_1.deepEqual)(options, {
            bucket: "dokkanpanion-data",
            objectPrefix: "staging/v2",
            detailsPath: (0, path_1.resolve)("details.json"),
            manifestPath: (0, path_1.resolve)("manifest.json"),
            statePath: (0, path_1.resolve)("state.json"),
            dryRun: true,
            target: "local",
            keepStaleAssets: true,
            adoptUnboundState: true,
            maxUploadBytes: 1024,
        });
    });
    it("scopes every mutable and immutable object under the selected channel", () => {
        (0, assert_1.equal)((0, publish_support_memory_r2_1.scopedObjectKey)("staging/v2", "support-memory-manifest.json"), "staging/v2/support-memory-manifest.json");
        (0, assert_1.equal)((0, publish_support_memory_r2_1.scopedObjectKey)("", "support-memory-manifest.json"), "support-memory-manifest.json");
        (0, assert_1.throws)(() => (0, publish_support_memory_r2_1.parseSupportMemoryR2PublishArgs)(["--object-prefix", "../production"]), /Invalid R2 object prefix/);
        (0, assert_1.throws)(() => (0, publish_support_memory_r2_1.parseSupportMemoryR2PublishArgs)(["--dry-run=true"]), /does not accept a value/);
        (0, assert_1.throws)(() => (0, publish_support_memory_r2_1.parseSupportMemoryR2PublishArgs)(["--unknown"]), /Unexpected support memory publisher argument/);
        (0, assert_1.throws)(() => (0, publish_support_memory_r2_1.parseSupportMemoryR2PublishArgs)(["--state", "a", "--state", "b"]), /duplicate/);
    });
    it("collects all local support-memory asset references without duplicates", () => {
        const dataset = {
            entries: [{
                    dokkanInfo: {
                        largeAsset: {
                            remoteUrl: "https://example.test/large.png",
                            localPath: "data/support-memories/assets/dokkaninfo/10001/large.png",
                        },
                        completeAsset: undefined,
                        requiredFilm: undefined,
                        enhancementItems: [],
                        animation: {
                            lwf: {
                                remoteUrl: "https://example.test/effect.lwf",
                                localPath: "data/support-memories/assets/dokkaninfo/10001/animation/effect.lwf",
                            },
                            textures: [],
                        },
                    },
                }],
        };
        const refs = (0, support_memory_dataset_artifacts_1.collectSupportMemoryAssetRefs)(dataset);
        (0, assert_1.deepEqual)([...refs.keys()], [
            "support-memories/assets/10001/large.png",
            "support-memories/assets/10001/animation/effect.lwf",
        ]);
        (0, assert_1.equal)(refs.get("support-memories/assets/10001/large.png")?.objectKey, "support-memories/assets/10001/large.png");
    });
    it("counts stale keys only from the publisher's previous state", () => {
        const options = (0, publish_support_memory_r2_1.parseSupportMemoryR2PublishArgs)([]);
        const manifest = {
            schemaVersion: 1,
            datasetVersion: "2026-07-17T00:00:00.000Z",
            generatedAt: "2026-07-17T00:00:00.000Z",
            fileName: "support-memory-details.json",
            sha256: "d".repeat(64),
            sizeBytes: 100,
            supportMemoryCount: 1,
            assetCount: 1,
            assetBytes: 25,
            assetsIncluded: true,
            assetPrefix: "support-memories/assets/",
        };
        const asset = {
            objectKey: "support-memories/assets/10001/large.png",
            localPath: "data/support-memories/assets/dokkaninfo/10001/large.png",
            absolutePath: "D:/assets/large.png",
            sizeBytes: 25,
            sha256: "new-hash",
            contentType: "image/png",
        };
        const previousState = {
            schemaVersion: 2,
            destination: {
                bucket: options.bucket,
                objectPrefix: options.objectPrefix,
                target: options.target,
                manifestObjectKey: "support-memory-manifest.json",
            },
            datasetVersion: "2026-07-16T00:00:00.000Z",
            detailsObjectKey: `support-memory-details.${"c".repeat(64)}.json`,
            detailsSha256: "old-details-hash",
            manifestSha256: "old-manifest-hash",
            assets: {
                "support-memories/assets/10001/large.png": {
                    sha256: "old-hash",
                    sizeBytes: 25,
                },
                "support-memories/assets/old.png": {
                    sha256: "old-hash",
                    sizeBytes: 10,
                },
            },
        };
        (0, assert_1.throws)(() => (0, publish_support_memory_r2_1.buildSupportMemoryR2PublishPlan)(options, manifest, [asset], 100, previousState), /immutable asset changed bytes/);
        previousState.assets[asset.objectKey] = { sha256: asset.sha256, sizeBytes: asset.sizeBytes };
        const plan = (0, publish_support_memory_r2_1.buildSupportMemoryR2PublishPlan)(options, manifest, [asset], 100, previousState);
        (0, assert_1.deepEqual)(plan.staleAssetKeys, ["support-memories/assets/old.png"]);
        (0, assert_1.equal)(plan.uploadAssetCount, 0);
        (0, assert_1.equal)(plan.detailsObjectKey, `support-memory-details.${"d".repeat(64)}.json`);
        (0, assert_1.equal)(plan.totalDatasetBytes, 100 + 25 + plan.manifestBytes);
        (0, assert_1.throws)(() => (0, publish_support_memory_r2_1.buildSupportMemoryR2PublishPlan)({ ...options, objectPrefix: "staging/v2" }, manifest, [asset], 100, previousState), /different destination/);
    });
    it("rejects a dataset above the configured storage budget", () => {
        const options = (0, publish_support_memory_r2_1.parseSupportMemoryR2PublishArgs)(["--max-upload-bytes", "100"]);
        const manifest = {
            schemaVersion: 1,
            datasetVersion: "2026-07-17T00:00:00.000Z",
            generatedAt: "2026-07-17T00:00:00.000Z",
            fileName: "support-memory-details.json",
            sha256: "d".repeat(64),
            sizeBytes: 100,
            supportMemoryCount: 1,
            assetCount: 1,
            assetBytes: 25,
            assetsIncluded: true,
            assetPrefix: "support-memories/assets/",
        };
        const asset = {
            objectKey: "support-memories/assets/10001/large.png",
            localPath: "data/support-memories/assets/dokkaninfo/10001/large.png",
            absolutePath: "D:/assets/large.png",
            sizeBytes: 25,
            sha256: "hash",
            contentType: "image/png",
        };
        (0, assert_1.throws)(() => (0, publish_support_memory_r2_1.buildSupportMemoryR2PublishPlan)(options, manifest, [asset], 100), /above the configured limit/);
    });
});
//# sourceMappingURL=publish-support-memory-r2.spec.js.map