import { deepEqual, equal, throws } from "assert";
import { resolve } from "path";
import {
    buildSupportMemoryR2PublishPlan,
    parseSupportMemoryR2PublishArgs,
    scopedObjectKey,
    SupportMemoryR2PublishState,
} from "./publish-support-memory-r2";
import { collectSupportMemoryAssetRefs } from "./support-memory-dataset-artifacts";

describe("support-memory R2 publisher", () => {
    it("defaults to the production bucket, remote target, and 1 GB budget", () => {
        const options = parseSupportMemoryR2PublishArgs([]);

        equal(options.bucket, "dokkanpanion-data");
        equal(options.objectPrefix, "");
        equal(options.target, "remote");
        equal(options.dryRun, false);
        equal(options.maxUploadBytes, 1024 * 1024 * 1024);
        equal(options.keepStaleAssets, false);
        equal(options.adoptUnboundState, false);
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
            "--object-prefix=/staging/v2/",
            "--keep-stale-assets",
            "--adopt-unbound-state",
            "--max-upload-bytes",
            "1024",
        ]);

        deepEqual(options, {
            bucket: "dokkanpanion-data",
            objectPrefix: "staging/v2",
            detailsPath: resolve("details.json"),
            manifestPath: resolve("manifest.json"),
            statePath: resolve("state.json"),
            dryRun: true,
            target: "local",
            keepStaleAssets: true,
            adoptUnboundState: true,
            maxUploadBytes: 1024,
        });
    });

    it("scopes every mutable and immutable object under the selected channel", () => {
        equal(scopedObjectKey("staging/v2", "support-memory-manifest.json"), "staging/v2/support-memory-manifest.json");
        equal(scopedObjectKey("", "support-memory-manifest.json"), "support-memory-manifest.json");
        throws(
            () => parseSupportMemoryR2PublishArgs(["--object-prefix", "../production"]),
            /Invalid R2 object prefix/,
        );
        throws(() => parseSupportMemoryR2PublishArgs(["--dry-run=true"]), /does not accept a value/);
        throws(() => parseSupportMemoryR2PublishArgs(["--unknown"]), /Unexpected support memory publisher argument/);
        throws(() => parseSupportMemoryR2PublishArgs(["--state", "a", "--state", "b"]), /duplicate/);
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
            sha256: "d".repeat(64),
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
            schemaVersion: 2 as const,
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

        throws(
            () => buildSupportMemoryR2PublishPlan(options, manifest, [asset], 100, previousState),
            /immutable asset changed bytes/,
        );

        previousState.assets[asset.objectKey] = { sha256: asset.sha256, sizeBytes: asset.sizeBytes };
        const plan = buildSupportMemoryR2PublishPlan(options, manifest, [asset], 100, previousState);

        deepEqual(plan.staleAssetKeys, ["support-memories/assets/old.png"]);
        equal(plan.uploadAssetCount, 0);
        equal(plan.detailsObjectKey, `support-memory-details.${"d".repeat(64)}.json`);
        equal(plan.totalDatasetBytes, 100 + 25 + plan.manifestBytes);

        throws(
            () => buildSupportMemoryR2PublishPlan(
                { ...options, objectPrefix: "staging/v2" },
                manifest,
                [asset],
                100,
                previousState,
            ),
            /different destination/,
        );
    });

    it("rejects a dataset above the configured storage budget", () => {
        const options = parseSupportMemoryR2PublishArgs(["--max-upload-bytes", "100"]);
        const manifest = {
            schemaVersion: 1 as const,
            datasetVersion: "2026-07-17T00:00:00.000Z",
            generatedAt: "2026-07-17T00:00:00.000Z",
            fileName: "support-memory-details.json" as const,
            sha256: "d".repeat(64),
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

        throws(() => buildSupportMemoryR2PublishPlan(options, manifest, [asset], 100), /above the configured limit/);
    });
});
