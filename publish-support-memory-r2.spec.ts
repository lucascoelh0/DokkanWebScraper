import { deepEqual, equal, throws } from "assert";
import { resolve } from "path";
import {
    buildSupportMemoryR2PublishPlan,
    parseSupportMemoryR2PublishArgs,
    SupportMemoryR2PublishState,
} from "./publish-support-memory-r2";
import { collectSupportMemoryAssetRefs } from "./support-memory-dataset-artifacts";

describe("support-memory R2 publisher", () => {
    it("defaults to the production bucket, remote target, and 1 GB budget", () => {
        const options = parseSupportMemoryR2PublishArgs([]);

        equal(options.bucket, "dokkanpanion-data");
        equal(options.target, "remote");
        equal(options.dryRun, false);
        equal(options.maxUploadBytes, 1024 * 1024 * 1024);
        equal(options.keepStaleAssets, false);
    });

    it("supports dry-run, local target, and explicit paths", () => {
        const options = parseSupportMemoryR2PublishArgs([
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

        deepEqual(options, {
            bucket: "dokkanpanion-data",
            detailsPath: resolve("details.json"),
            manifestPath: resolve("manifest.json"),
            statePath: resolve("state.json"),
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
        } as any;

        const refs = collectSupportMemoryAssetRefs(dataset);

        deepEqual([...refs.keys()], [
            "support-memories/assets/10001/large.png",
            "support-memories/assets/10001/animation/effect.lwf",
        ]);
        equal(refs.get("support-memories/assets/10001/large.png")?.objectKey, "support-memories/assets/10001/large.png");
    });

    it("counts stale keys only from the publisher's previous state", () => {
        const options = parseSupportMemoryR2PublishArgs([]);
        const manifest = {
            schemaVersion: 1 as const,
            datasetVersion: "2026-07-17T00:00:00.000Z",
            generatedAt: "2026-07-17T00:00:00.000Z",
            fileName: "support-memory-details.json" as const,
            sha256: "details-hash",
            sizeBytes: 100,
            supportMemoryCount: 1,
            assetCount: 1,
            assetBytes: 25,
            assetsIncluded: true as const,
            assetPrefix: "support-memories/assets/" as const,
        };
        const asset = {
            objectKey: "support-memories/assets/10001/large.png",
            localPath: "data/support-memories/assets/dokkaninfo/10001/large.png",
            absolutePath: "D:/assets/large.png",
            sizeBytes: 25,
            sha256: "new-hash",
            contentType: "image/png",
        };
        const previousState: SupportMemoryR2PublishState = {
            schemaVersion: 1 as const,
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

        const plan = buildSupportMemoryR2PublishPlan(options, manifest, [asset], 100, 50, previousState);

        deepEqual(plan.staleAssetKeys, ["support-memories/assets/old.png"]);
        equal(plan.uploadAssetCount, 1);
        equal(plan.totalDatasetBytes, 175);
    });

    it("rejects a dataset above the configured storage budget", () => {
        const options = parseSupportMemoryR2PublishArgs(["--max-upload-bytes", "100"]);
        const manifest = {
            schemaVersion: 1 as const,
            datasetVersion: "2026-07-17T00:00:00.000Z",
            generatedAt: "2026-07-17T00:00:00.000Z",
            fileName: "support-memory-details.json" as const,
            sha256: "details-hash",
            sizeBytes: 100,
            supportMemoryCount: 1,
            assetCount: 1,
            assetBytes: 25,
            assetsIncluded: true as const,
            assetPrefix: "support-memories/assets/" as const,
        };
        const asset = {
            objectKey: "support-memories/assets/10001/large.png",
            localPath: "data/support-memories/assets/dokkaninfo/10001/large.png",
            absolutePath: "D:/assets/large.png",
            sizeBytes: 25,
            sha256: "hash",
            contentType: "image/png",
        };

        throws(() => buildSupportMemoryR2PublishPlan(options, manifest, [asset], 100, 50), /above the configured limit/);
    });
});
