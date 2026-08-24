"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const crypto_1 = require("crypto");
const assert_1 = require("assert");
const mocha_1 = require("mocha");
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
});
(0, mocha_1.describe)("assertExpectedRemoteBaselineSha256", function () {
    (0, mocha_1.it)("fails closed when a release candidate was built over a different public baseline", () => {
        const expected = "a".repeat(64);
        (0, publish_r2_1.assertExpectedRemoteBaselineSha256)(expected, { sha256: expected });
        (0, assert_1.throws)(() => (0, publish_r2_1.assertExpectedRemoteBaselineSha256)(expected, { sha256: "b".repeat(64) }), /Remote Character baseline changed/);
        (0, assert_1.throws)(() => (0, publish_r2_1.assertExpectedRemoteBaselineSha256)(expected, undefined), /Cannot prove the expected remote baseline/);
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
    });
    (0, mocha_1.it)("requires isolated portrait handling and state for staging", () => {
        (0, assert_1.throws)(() => (0, publish_r2_1.parsePublishArgs)(["--bucket", "test", "--contract-lane", "v2", "--channel", "staging"]), /requires --skip-portraits/);
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
});
//# sourceMappingURL=publish-r2.spec.js.map