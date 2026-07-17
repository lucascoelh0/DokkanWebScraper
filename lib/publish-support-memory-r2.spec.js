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
        (0, assert_1.equal)(options.target, "remote");
        (0, assert_1.equal)(options.dryRun, false);
        (0, assert_1.equal)(options.maxUploadBytes, 1024 * 1024 * 1024);
        (0, assert_1.equal)(options.keepStaleAssets, false);
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
            "--keep-stale-assets",
            "--max-upload-bytes",
            "1024",
        ]);
        (0, assert_1.deepEqual)(options, {
            bucket: "dokkanpanion-data",
            detailsPath: (0, path_1.resolve)("details.json"),
            manifestPath: (0, path_1.resolve)("manifest.json"),
            statePath: (0, path_1.resolve)("state.json"),
            dryRun: true,
            target: "local",
            keepStaleAssets: true,
            maxUploadBytes: 1024,
        });
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
            sha256: "details-hash",
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
            schemaVersion: 1,
            datasetVersion: "2026-07-16T00:00:00.000Z",
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
        const plan = (0, publish_support_memory_r2_1.buildSupportMemoryR2PublishPlan)(options, manifest, [asset], 100, 50, previousState);
        (0, assert_1.deepEqual)(plan.staleAssetKeys, ["support-memories/assets/old.png"]);
        (0, assert_1.equal)(plan.uploadAssetCount, 1);
        (0, assert_1.equal)(plan.totalDatasetBytes, 175);
    });
    it("rejects a dataset above the configured storage budget", () => {
        const options = (0, publish_support_memory_r2_1.parseSupportMemoryR2PublishArgs)(["--max-upload-bytes", "100"]);
        const manifest = {
            schemaVersion: 1,
            datasetVersion: "2026-07-17T00:00:00.000Z",
            generatedAt: "2026-07-17T00:00:00.000Z",
            fileName: "support-memory-details.json",
            sha256: "details-hash",
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
        (0, assert_1.throws)(() => (0, publish_support_memory_r2_1.buildSupportMemoryR2PublishPlan)(options, manifest, [asset], 100, 50), /above the configured limit/);
    });
});
//# sourceMappingURL=publish-support-memory-r2.spec.js.map