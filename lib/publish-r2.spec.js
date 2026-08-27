"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const crypto_1 = require("crypto");
const assert_1 = require("assert");
const promises_1 = require("fs/promises");
const mocha_1 = require("mocha");
const os_1 = require("os");
const path_1 = require("path");
const zlib_1 = require("zlib");
const publish_r2_1 = require("./publish-r2");
const dataset_publication_channel_1 = require("./dataset-publication-channel");
const V1_PROJECTION_REPORT = "projection-report.json";
(0, mocha_1.describe)("parseWranglerBucketSize", function () {
    (0, mocha_1.it)("uses a conservative upper bound for rounded Wrangler sizes", () => {
        (0, assert_1.deepEqual)((0, publish_r2_1.parseWranglerBucketSize)("383.9 MB"), {
            reported: "383.9 MB",
            conservativeUpperBoundBytes: 384000000,
        });
        (0, assert_1.deepEqual)((0, publish_r2_1.parseWranglerBucketSize)("10 B"), {
            reported: "10 B",
            conservativeUpperBoundBytes: 11,
        });
        (0, assert_1.throws)(() => (0, publish_r2_1.parseWranglerBucketSize)("unknown"), /Unsupported Wrangler bucket size/);
    });
});
(0, mocha_1.describe)("dataset publication channel authorization", function () {
    (0, mocha_1.it)("requires an explicit production promotion while allowing dry-runs and staging", () => {
        (0, assert_1.throws)(() => (0, dataset_publication_channel_1.assertDatasetPublicationWriteAuthorized)({
            channel: "production",
            target: "remote",
            dryRun: false,
            promoteProduction: false,
        }), /explicit --promote-production/);
        (0, dataset_publication_channel_1.assertDatasetPublicationWriteAuthorized)({
            channel: "production",
            target: "remote",
            dryRun: true,
            promoteProduction: false,
        });
        (0, dataset_publication_channel_1.assertDatasetPublicationWriteAuthorized)({
            channel: "staging",
            target: "remote",
            dryRun: false,
            promoteProduction: false,
        });
        (0, assert_1.throws)(() => (0, dataset_publication_channel_1.assertDatasetPublicationWriteAuthorized)({
            channel: "staging",
            target: "remote",
            dryRun: false,
            promoteProduction: true,
        }), /cannot be combined/);
    });
});
(0, mocha_1.describe)("buildRemoteDatasetObjectKey", function () {
    (0, mocha_1.it)("uses a content-addressed immutable Character payload key", () => {
        (0, assert_1.equal)((0, publish_r2_1.buildRemoteDatasetObjectKey)({
            datasetVersion: "2026-08-22T21:14:10.019Z",
            fileName: "characters.json.gz",
            sha256: "A".repeat(64),
        }), `releases/2026-08-22T21-14-10.019Z/${"a".repeat(64)}/characters.json.gz`);
    });
    (0, mocha_1.it)("keeps staging manifests and immutable payloads outside production keys", () => {
        const manifest = {
            datasetVersion: "2026-08-22T21:14:10.019Z",
            fileName: "characters.json.gz",
            sha256: "A".repeat(64),
        };
        (0, assert_1.equal)((0, publish_r2_1.buildCharacterManifestObjectKey)("staging", "v1"), "staging/v1/characters-manifest.json");
        (0, assert_1.equal)((0, publish_r2_1.buildRemoteDatasetObjectKey)(manifest, "staging", "v1"), `staging/v1/releases/2026-08-22T21-14-10.019Z/${"a".repeat(64)}/characters.json.gz`);
        (0, assert_1.equal)((0, publish_r2_1.buildCharacterManifestObjectKey)("production", "v2"), "v2/characters-manifest.json");
        (0, assert_1.equal)((0, publish_r2_1.buildCharacterManifestObjectKey)("staging", "v2"), "staging/v2/characters-manifest.json");
    });
    (0, mocha_1.it)("accepts an already-scoped local candidate payload key only for its exact channel and lane", () => {
        const manifest = {
            datasetVersion: "2026-08-26T20:58:47.619Z",
            sha256: "a".repeat(64),
            fileName: `staging/v2/releases/2026-08-26T20-58-47.619Z/${"a".repeat(64)}/characters.json.gz`,
        };
        (0, assert_1.equal)((0, publish_r2_1.buildRemoteDatasetObjectKey)(manifest, "staging", "v2"), manifest.fileName);
        (0, assert_1.throws)(() => (0, publish_r2_1.buildRemoteDatasetObjectKey)(manifest, "staging", "v1"), /filename is invalid/);
        (0, assert_1.throws)(() => (0, publish_r2_1.buildRemoteDatasetObjectKey)(manifest, "production", "v2"), /filename is invalid/);
    });
});
(0, mocha_1.describe)("assertExpectedRemoteBaselineSha256", function () {
    (0, mocha_1.it)("fails closed when a release candidate was built over a different public baseline", () => {
        const expected = "a".repeat(64);
        (0, publish_r2_1.assertExpectedRemoteBaselineSha256)(expected, { sha256: expected });
        (0, assert_1.throws)(() => (0, publish_r2_1.assertExpectedRemoteBaselineSha256)(expected, { sha256: "b".repeat(64) }), /Remote Character baseline changed/);
        (0, assert_1.throws)(() => (0, publish_r2_1.assertExpectedRemoteBaselineSha256)(expected, undefined), /Cannot prove the expected remote baseline/);
    });
    (0, mocha_1.it)("pins an absent manifest for a first publication", () => {
        (0, publish_r2_1.assertExpectedRemoteManifestBaseline)(undefined, true, undefined);
        (0, assert_1.throws)(() => (0, publish_r2_1.assertExpectedRemoteManifestBaseline)(undefined, true, { sha256: "b".repeat(64) }), /expected to be absent/);
    });
});
(0, mocha_1.describe)("remote object read classification", function () {
    (0, mocha_1.it)("treats only an explicit missing-object result as absent", () => {
        (0, assert_1.equal)((0, publish_r2_1.isMissingR2ObjectError)(new Error("R2 object not found (404)")), true);
        (0, assert_1.equal)((0, publish_r2_1.isMissingR2ObjectError)(new Error("The specified key does not exist")), true);
        (0, assert_1.equal)((0, publish_r2_1.isMissingR2ObjectError)(new Error("authentication failed")), false);
        (0, assert_1.equal)((0, publish_r2_1.isMissingR2ObjectError)(new Error("Wrangler entrypoint was not found")), false);
        (0, assert_1.equal)((0, publish_r2_1.isMissingR2ObjectError)(new Error("malformed JSON")), false);
    });
    (0, mocha_1.it)("retries only bounded transient R2 read failures", () => {
        (0, assert_1.equal)((0, publish_r2_1.isRetryableR2ReadError)(new Error("429: Too Many Requests")), true);
        (0, assert_1.equal)((0, publish_r2_1.isRetryableR2ReadError)(new Error("503 Service Unavailable")), true);
        (0, assert_1.equal)((0, publish_r2_1.isRetryableR2ReadError)(new Error("ECONNRESET")), true);
        (0, assert_1.equal)((0, publish_r2_1.isRetryableR2ReadError)(new Error("authentication failed")), false);
        (0, assert_1.equal)((0, publish_r2_1.isRetryableR2ReadError)(new Error("malformed JSON")), false);
    });
    (0, mocha_1.it)("reuses a remote object only after exact size and SHA-256 verification", () => {
        const bytes = Buffer.from("immutable payload");
        const expectedSha256 = (0, crypto_1.createHash)("sha256").update(bytes).digest("hex");
        (0, assert_1.equal)((0, publish_r2_1.remoteObjectBytesMatch)(bytes, expectedSha256, bytes.byteLength), true);
        (0, assert_1.equal)((0, publish_r2_1.remoteObjectBytesMatch)(undefined, expectedSha256, bytes.byteLength), false);
        (0, assert_1.equal)((0, publish_r2_1.remoteObjectBytesMatch)(Buffer.from("corrupt payload"), expectedSha256, bytes.byteLength), false);
        (0, assert_1.equal)((0, publish_r2_1.remoteObjectBytesMatch)(bytes, expectedSha256, bytes.byteLength + 1), false);
    });
});
(0, mocha_1.describe)("parsePublishArgs", function () {
    (0, mocha_1.it)("requires and validates the expected remote baseline SHA", () => {
        (0, assert_1.throws)(() => (0, publish_r2_1.parsePublishArgs)(["--bucket", "test", "--contract-lane", "v2", "--expected-remote-baseline-sha256", "--remote"]), /requires a value/);
        (0, assert_1.throws)(() => (0, publish_r2_1.parsePublishArgs)(["--bucket", "test", "--contract-lane", "v2", "--expected-remote-baseline-sha256="]), /requires a value/);
        (0, assert_1.throws)(() => (0, publish_r2_1.parsePublishArgs)(["--bucket", "test", "--contract-lane", "v2", "--expected-remote-baseline-sha256", "not-a-sha"]), /Invalid --expected-remote-baseline-sha256/);
        (0, assert_1.throws)(() => (0, publish_r2_1.parsePublishArgs)([
            "--bucket", "test",
            "--contract-lane", "v2",
            "--expected-remote-baseline-sha256", "a".repeat(64),
            "--skip-remote-manifest-check",
        ]), /cannot be combined/);
        (0, assert_1.equal)((0, publish_r2_1.parsePublishArgs)([
            "--bucket", "test",
            "--contract-lane", "v2",
            "--expected-remote-baseline-sha256", "A".repeat(64),
        ]).expectedRemoteBaselineSha256, "a".repeat(64));
        (0, assert_1.equal)((0, publish_r2_1.parsePublishArgs)([
            "--bucket", "test",
            "--contract-lane", "v2",
            "--expect-remote-manifest-absent",
        ]).expectRemoteManifestAbsent, true);
        (0, assert_1.throws)(() => (0, publish_r2_1.parsePublishArgs)([
            "--bucket", "test",
            "--contract-lane", "v2",
            "--expect-remote-manifest-absent",
            "--expected-remote-baseline-sha256", "a".repeat(64),
        ]), /cannot be combined/);
    });
    (0, mocha_1.it)("uses isolated portrait state for staging without requiring portraits to be skipped", () => {
        const stagedWithPortraits = (0, publish_r2_1.parsePublishArgs)([
            "--bucket", "test",
            "--contract-lane", "v2",
            "--channel", "staging",
        ]);
        (0, assert_1.equal)(stagedWithPortraits.skipPortraits, false);
        (0, assert_1.equal)(stagedWithPortraits.statePath.endsWith("r2-publish-state-staging-v2.json"), true);
        const staging = (0, publish_r2_1.parsePublishArgs)([
            "--bucket", "test",
            "--channel", "staging",
            "--contract-lane", "v1",
            "--v1-projection-report", V1_PROJECTION_REPORT,
            "--skip-portraits",
        ]);
        (0, assert_1.equal)(staging.channel, "staging");
        (0, assert_1.equal)(staging.contractLane, "v1");
        (0, assert_1.equal)(staging.manifestObjectKey, "staging/v1/characters-manifest.json");
        (0, assert_1.equal)(staging.statePath.endsWith("r2-publish-state-staging-v1.json"), true);
        (0, assert_1.throws)(() => (0, publish_r2_1.parsePublishArgs)(["--bucket", "test", "--contract-lane", "v2", "--channel", "preview", "--skip-portraits"]), /Invalid dataset publication channel/);
    });
    (0, mocha_1.it)("requires an explicit lane and v1 projection provenance", () => {
        (0, assert_1.throws)(() => (0, publish_r2_1.parsePublishArgs)(["--bucket", "test"]), /Missing dataset contract lane/);
        (0, assert_1.throws)(() => (0, publish_r2_1.parsePublishArgs)(["--bucket", "test", "--contract-lane", "v1"]), /requires --v1-projection-report/);
        (0, assert_1.throws)(() => (0, publish_r2_1.parsePublishArgs)([
            "--bucket", "test",
            "--contract-lane", "v2",
            "--v1-projection-report", V1_PROJECTION_REPORT,
        ]), /only be used with --contract-lane v1/);
    });
});
(0, mocha_1.describe)("validateLocalCharacterBundle", function () {
    function fixture() {
        const characters = [{ id: "100" }];
        const raw = Buffer.from(`${JSON.stringify(characters)}\n`, "utf8");
        const gzip = (0, zlib_1.gzipSync)(raw);
        const manifest = {
            schemaVersion: 1,
            datasetVersion: "2026-08-22T21:14:10.019Z",
            generatedAt: "2026-08-22T21:14:10.019Z",
            fileName: "characters.json.gz",
            compression: "gzip",
            sha256: (0, crypto_1.createHash)("sha256").update(gzip).digest("hex"),
            sizeBytes: gzip.byteLength,
            uncompressedSizeBytes: raw.byteLength,
            characterCount: characters.length,
        };
        return { characters, gzip, manifest };
    }
    (0, mocha_1.it)("accepts a bundle only when its manifest matches the exact bytes", () => {
        const { characters, gzip, manifest } = fixture();
        (0, assert_1.deepEqual)((0, publish_r2_1.validateLocalCharacterBundle)(manifest, gzip), characters);
    });
    (0, mocha_1.it)("rejects mismatched bytes, counts and unsafe local filenames", () => {
        const { gzip, manifest } = fixture();
        (0, assert_1.throws)(() => (0, publish_r2_1.validateLocalCharacterBundle)({ ...manifest, sha256: "b".repeat(64) }, gzip), /SHA-256 mismatch/);
        (0, assert_1.throws)(() => (0, publish_r2_1.validateLocalCharacterBundle)({ ...manifest, characterCount: 2 }, gzip), /count mismatch/);
        (0, assert_1.throws)(() => (0, publish_r2_1.validateLocalCharacterBundle)({ ...manifest, fileName: "..\/characters.json.gz" }, gzip), /filename is invalid/);
    });
});
(0, mocha_1.describe)("collectReferencedPortraitKeys", function () {
    (0, mocha_1.it)("collects unique portrait keys from base cards, transformations and awakening references", () => {
        const portraitKeys = (0, publish_r2_1.collectReferencedPortraitKeys)([
            {
                portraitURL: "images/portrait_100.png",
                transformations: [
                    { portraitURL: "images/portrait_101.png" },
                    { portraitURL: "images/portrait_101.png" },
                ],
                awakeningCards: [
                    { portraitURL: "images/portrait_102.png" },
                ],
                previousAwakenings: [
                    { portraitURL: "/images/portrait_103.png" },
                ],
                nextAwakenings: [
                    { portraitURL: ".\\images\\portrait_104.png" },
                ],
            },
        ]);
        (0, assert_1.deepEqual)(portraitKeys, [
            "images/portrait_100.png",
            "images/portrait_101.png",
            "images/portrait_102.png",
            "images/portrait_103.png",
            "images/portrait_104.png",
        ]);
    });
    (0, mocha_1.it)("collects typed layers from base cards, transformations and every awakening direction", () => {
        const references = (0, publish_r2_1.collectReferencedPortraitReferences)([{
                portraitURL: "staging/v2/images/v4/portrait_100." + "1".repeat(64) + ".png",
                portraitLayers: {
                    backgroundURL: "staging/v2/images/v5/layers/background." + "2".repeat(64) + ".png",
                    thumbURL: "staging/v2/images/v5/layers/thumb." + "3".repeat(64) + ".png",
                    overlayURL: "staging/v2/images/v5/layers/overlay." + "4".repeat(64) + ".png",
                },
                transformations: [{
                        portraitURL: "images/portrait_transformation.png",
                        portraitLayers: {
                            backgroundURL: "staging/v2/images/v5/layers/background." + "5".repeat(64) + ".png",
                            thumbURL: "staging/v2/images/v5/layers/thumb." + "6".repeat(64) + ".png",
                            overlayURL: "staging/v2/images/v5/layers/overlay." + "7".repeat(64) + ".png",
                        },
                    }],
                awakeningCards: [{
                        portraitURL: "images/portrait_awakening.png",
                        portraitLayers: {
                            backgroundURL: "staging/v2/images/v5/layers/background." + "8".repeat(64) + ".png",
                            thumbURL: "staging/v2/images/v5/layers/thumb." + "9".repeat(64) + ".png",
                            overlayURL: "staging/v2/images/v5/layers/overlay." + "a".repeat(64) + ".png",
                        },
                    }],
                previousAwakenings: [{
                        portraitURL: "images/portrait_previous.png",
                        portraitLayers: {
                            backgroundURL: "staging/v2/images/v5/layers/background." + "b".repeat(64) + ".png",
                            thumbURL: "staging/v2/images/v5/layers/thumb." + "c".repeat(64) + ".png",
                            overlayURL: "staging/v2/images/v5/layers/overlay." + "d".repeat(64) + ".png",
                        },
                    }],
                nextAwakenings: [{
                        portraitURL: "images/portrait_next.png",
                        portraitLayers: {
                            backgroundURL: "staging/v2/images/v5/layers/background." + "e".repeat(64) + ".png",
                            thumbURL: "staging/v2/images/v5/layers/thumb." + "f".repeat(64) + ".png",
                            overlayURL: "staging/v2/images/v5/layers/overlay." + "0".repeat(64) + ".png",
                        },
                    }],
            }]);
        (0, assert_1.equal)(references.length, 20);
        (0, assert_1.equal)(references.filter(reference => reference.layerKind).length, 15);
        (0, assert_1.equal)(references.some(reference => reference.layerKind === "background"), true);
        (0, assert_1.equal)(references.some(reference => reference.layerKind === "thumb"), true);
        (0, assert_1.equal)(references.some(reference => reference.layerKind === "overlay"), true);
    });
    (0, mocha_1.it)("fails closed when typed layers would be skipped", () => {
        (0, publish_r2_1.assertPortraitPublicationMode)([{ portraitURL: "images/portrait.png" }], true);
        (0, assert_1.throws)(() => (0, publish_r2_1.assertPortraitPublicationMode)([{
                portraitURL: "images/portrait.png",
                portraitLayers: {
                    backgroundURL: "background.png",
                    thumbURL: "thumb.png",
                    overlayURL: "overlay.png",
                },
            }], true), /cannot be used.*portraitLayers/);
    });
    (0, mocha_1.it)("rejects incomplete typed layer contracts and conflicting static/layer reuse", () => {
        (0, assert_1.throws)(() => (0, publish_r2_1.collectReferencedPortraitReferences)([{
                portraitURL: "images/portrait.png",
                portraitLayers: { backgroundURL: "background.png", thumbURL: "thumb.png" },
            }]), /must provide non-empty backgroundURL, thumbURL, and overlayURL/);
        (0, assert_1.throws)(() => (0, publish_r2_1.collectReferencedPortraitReferences)([{
                portraitURL: "same.png",
                portraitLayers: {
                    backgroundURL: "same.png",
                    thumbURL: "thumb.png",
                    overlayURL: "overlay.png",
                },
            }]), /conflicting static\/layer kinds/);
    });
});
(0, mocha_1.describe)("buildPortraitEntries", function () {
    async function withTempRoot(task) {
        const root = await (0, promises_1.mkdtemp)((0, path_1.resolve)((0, os_1.tmpdir)(), "dokkan-portrait-publish-test-"));
        try {
            await task(root);
        }
        finally {
            await (0, promises_1.rm)(root, { recursive: true, force: true });
        }
    }
    (0, mocha_1.it)("validates channel-scoped static and typed layer objects against their embedded hashes", async () => {
        await withTempRoot(async (root) => {
            const staticBytes = Buffer.from("static portrait");
            const layerBytes = Buffer.from("transparent layer");
            const staticHash = (0, crypto_1.createHash)("sha256").update(staticBytes).digest("hex");
            const layerHash = (0, crypto_1.createHash)("sha256").update(layerBytes).digest("hex");
            const staticKey = `staging/v2/images/v4/portrait_100.${staticHash}.png`;
            const layerKey = `staging/v2/images/v5/layers/thumb.${layerHash}.png`;
            for (const [key, bytes] of [[staticKey, staticBytes], [layerKey, layerBytes]]) {
                const path = (0, path_1.resolve)(root, ...key.split("/"));
                await (0, promises_1.mkdir)((0, path_1.dirname)(path), { recursive: true });
                await (0, promises_1.writeFile)(path, bytes);
            }
            const entries = await (0, publish_r2_1.buildPortraitEntries)([
                { objectKey: staticKey },
                { objectKey: layerKey, layerKind: "thumb" },
            ], root, { channel: "staging", contractLane: "v2" });
            (0, assert_1.deepEqual)(entries.map(entry => entry.objectKey), [staticKey, layerKey]);
            (0, assert_1.deepEqual)(entries.map(entry => entry.sha256), [staticHash, layerHash]);
        });
    });
    (0, mocha_1.it)("rejects cross-channel, cross-lane, malformed, missing, mismatched and traversing objects", async () => {
        await withTempRoot(async (root) => {
            const bytes = Buffer.from("portrait");
            const hash = (0, crypto_1.createHash)("sha256").update(bytes).digest("hex");
            const wrongLane = `staging/v1/images/v5/layers/thumb.${hash}.png`;
            const wrongChannel = `v2/images/v5/layers/thumb.${hash}.png`;
            const wrongKind = `staging/v2/images/v5/layers/background.${hash}.png`;
            const wrongHash = `staging/v2/images/v5/layers/thumb.${"0".repeat(64)}.png`;
            const wrongHashPath = (0, path_1.resolve)(root, ...wrongHash.split("/"));
            await (0, promises_1.mkdir)((0, path_1.dirname)(wrongHashPath), { recursive: true });
            await (0, promises_1.writeFile)(wrongHashPath, bytes);
            for (const objectKey of [wrongLane, wrongChannel]) {
                await (0, assert_1.rejects)((0, publish_r2_1.buildPortraitEntries)([{ objectKey, layerKind: "thumb" }], root, {
                    channel: "staging",
                    contractLane: "v2",
                }), /does not belong/);
            }
            await (0, assert_1.rejects)((0, publish_r2_1.buildPortraitEntries)([{ objectKey: wrongKind, layerKind: "thumb" }], root, {
                channel: "staging",
                contractLane: "v2",
            }), /Malformed thumb portrait layer key/);
            await (0, assert_1.rejects)((0, publish_r2_1.buildPortraitEntries)([{ objectKey: wrongHash, layerKind: "thumb" }], root, {
                channel: "staging",
                contractLane: "v2",
            }), /SHA-256 mismatch/);
            await (0, assert_1.rejects)((0, publish_r2_1.buildPortraitEntries)([{
                    objectKey: `staging/v2/images/v5/layers/thumb.${hash}.png`,
                    layerKind: "thumb",
                }], root, { channel: "staging", contractLane: "v2" }), /Missing portrait file/);
            await (0, assert_1.rejects)((0, publish_r2_1.buildPortraitEntries)(["images/portrait_legacy.png"], root, {
                channel: "staging",
                contractLane: "v2",
            }), /not channel\/lane scoped/);
            await (0, assert_1.rejects)((0, publish_r2_1.buildPortraitEntries)(["../outside.png"], root), /Unsafe portrait object key/);
        });
    });
});
(0, mocha_1.describe)("buildPortraitPublishPlan", function () {
    (0, mocha_1.it)("uploads only new or changed portraits and retains removed ones for historical releases", () => {
        const currentPortraits = [
            {
                objectKey: "images/portrait_100.png",
                filePath: "D:/Dokkan/DokkanWebScraper/data/images/portrait_100.png",
                sha256: "same-hash",
            },
            {
                objectKey: "images/portrait_101.png",
                filePath: "D:/Dokkan/DokkanWebScraper/data/images/portrait_101.png",
                sha256: "new-hash",
            },
        ];
        const previousState = {
            schemaVersion: 1,
            bucket: "dokkanpanion-data",
            target: "remote",
            datasetVersion: "2026-06-24T00:00:00.000Z",
            datasetObjectKey: "releases/2026-06-24T00-00-00.000Z/characters.json.gz",
            manifestSha256: "manifest-hash",
            publishedAt: "2026-06-24T00:00:00.000Z",
            portraits: {
                "images/portrait_100.png": "same-hash",
                "images/portrait_101.png": "old-hash",
                "images/portrait_099.png": "removed-hash",
            },
        };
        const plan = (0, publish_r2_1.buildPortraitPublishPlan)(currentPortraits, previousState);
        (0, assert_1.deepEqual)(plan.toUpload.map(entry => entry.objectKey), ["images/portrait_101.png"]);
        (0, assert_1.deepEqual)(plan.toDelete, []);
    });
    (0, mocha_1.it)("forces all current portraits when requested", () => {
        const currentPortraits = [
            {
                objectKey: "images/portrait_100.png",
                filePath: "D:/Dokkan/DokkanWebScraper/data/images/portrait_100.png",
                sha256: "same-hash",
            },
            {
                objectKey: "images/portrait_101.png",
                filePath: "D:/Dokkan/DokkanWebScraper/data/images/portrait_101.png",
                sha256: "new-hash",
            },
        ];
        const previousState = {
            schemaVersion: 1,
            bucket: "dokkanpanion-data",
            target: "remote",
            datasetVersion: "2026-06-24T00:00:00.000Z",
            datasetObjectKey: "releases/2026-06-24T00-00-00.000Z/characters.json.gz",
            manifestSha256: "manifest-hash",
            publishedAt: "2026-06-24T00:00:00.000Z",
            portraits: {
                "images/portrait_100.png": "same-hash",
                "images/portrait_101.png": "new-hash",
            },
        };
        const plan = (0, publish_r2_1.buildPortraitPublishPlan)(currentPortraits, previousState, { forcePortraits: true });
        (0, assert_1.equal)(plan.toUpload.length, 2);
        (0, assert_1.deepEqual)(plan.toDelete, []);
    });
    (0, mocha_1.it)("reuses state entries only after exact remote size and SHA verification", async () => {
        const root = await (0, promises_1.mkdtemp)((0, path_1.resolve)((0, os_1.tmpdir)(), "dokkan-portrait-reuse-test-"));
        try {
            const exactBytes = Buffer.from("exact");
            const corruptBytes = Buffer.from("wrong");
            const exactPath = (0, path_1.resolve)(root, "exact.png");
            const missingPath = (0, path_1.resolve)(root, "missing.png");
            const corruptPath = (0, path_1.resolve)(root, "corrupt.png");
            await (0, promises_1.writeFile)(exactPath, exactBytes);
            await (0, promises_1.writeFile)(missingPath, exactBytes);
            await (0, promises_1.writeFile)(corruptPath, exactBytes);
            const exactHash = (0, crypto_1.createHash)("sha256").update(exactBytes).digest("hex");
            const entries = [
                { objectKey: "exact", filePath: exactPath, sha256: exactHash },
                { objectKey: "missing", filePath: missingPath, sha256: exactHash },
                { objectKey: "corrupt", filePath: corruptPath, sha256: exactHash },
            ];
            const state = {
                schemaVersion: 1,
                bucket: "test",
                target: "remote",
                datasetVersion: "test",
                datasetObjectKey: "test",
                manifestSha256: exactHash,
                publishedAt: "2026-08-26T00:00:00.000Z",
                portraits: { exact: exactHash, missing: exactHash, corrupt: exactHash },
            };
            const reusable = await (0, publish_r2_1.verifyReusablePortraitEntries)(entries, state, async (entry) => {
                if (entry.objectKey === "missing")
                    return undefined;
                if (entry.objectKey === "corrupt")
                    return corruptBytes;
                return exactBytes;
            }, 2);
            (0, assert_1.deepEqual)(reusable, { exact: exactHash });
            (0, assert_1.deepEqual)((0, publish_r2_1.buildPortraitPublishPlan)(entries, { ...state, portraits: reusable }).toUpload.map(entry => entry.objectKey), ["corrupt", "missing"]);
        }
        finally {
            await (0, promises_1.rm)(root, { recursive: true, force: true });
        }
    });
});
//# sourceMappingURL=publish-r2.spec.js.map