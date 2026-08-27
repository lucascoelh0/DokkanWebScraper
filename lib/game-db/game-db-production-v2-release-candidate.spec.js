"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = require("assert");
const crypto_1 = require("crypto");
const promises_1 = require("fs/promises");
const os_1 = require("os");
const path_1 = require("path");
const zlib_1 = require("zlib");
const dataset_artifacts_1 = require("../dataset-artifacts");
const game_db_production_v2_release_candidate_1 = require("./game-db-production-v2-release-candidate");
const sha256 = (value) => (0, crypto_1.createHash)("sha256").update(value).digest("hex");
describe("production v2 release candidate", () => {
    it("changes only staging portrait delivery keys and preserves content-addressed bytes", async () => {
        const root = await (0, promises_1.mkdtemp)((0, path_1.resolve)((0, os_1.tmpdir)(), "dokkan-production-v2-candidate-"));
        try {
            const sourceDataRoot = (0, path_1.resolve)(root, "source-objects");
            const sourceBundleRoot = (0, path_1.resolve)(root, "source-bundle");
            const outputDir = (0, path_1.resolve)(root, "output", "candidate");
            const portraitBytes = Buffer.from("portrait-bytes");
            const backgroundBytes = Buffer.from("background-bytes");
            const thumbBytes = Buffer.from("thumb-bytes");
            const overlayBytes = Buffer.from("overlay-bytes");
            const portrait = `staging/v2/images/v4/portrait_100.${sha256(portraitBytes)}.png`;
            const background = `staging/v2/images/v5/layers/background.${sha256(backgroundBytes)}.png`;
            const thumb = `staging/v2/images/v5/layers/thumb.${sha256(thumbBytes)}.png`;
            const overlay = `staging/v2/images/v5/layers/overlay.${sha256(overlayBytes)}.png`;
            for (const [key, bytes] of [
                [portrait, portraitBytes],
                [background, backgroundBytes],
                [thumb, thumbBytes],
                [overlay, overlayBytes],
            ]) {
                const path = (0, path_1.resolve)(sourceDataRoot, ...key.split("/"));
                await (0, promises_1.mkdir)((0, path_1.dirname)(path), { recursive: true });
                await (0, promises_1.writeFile)(path, bytes);
            }
            const character = {
                id: "100",
                name: "Test",
                portraitURL: portrait,
                portraitLayers: { backgroundURL: background, thumbURL: thumb, overlayURL: overlay },
                transformations: [{ id: "101", name: "Form", portraitURL: portrait }],
            };
            const artifact = (0, dataset_artifacts_1.buildCharacterDatasetArtifact)([character], {
                datasetVersion: "2026-08-27T05:25:00.000Z",
                generatedAt: "2026-08-27T05:25:00.000Z",
            });
            await (0, promises_1.mkdir)(sourceBundleRoot, { recursive: true });
            await (0, promises_1.writeFile)((0, path_1.resolve)(sourceBundleRoot, "characters.json.gz"), artifact.gzipBuffer);
            await (0, promises_1.writeFile)((0, path_1.resolve)(sourceBundleRoot, "characters-manifest.json"), `${JSON.stringify(artifact.manifest, null, 2)}\n`);
            const report = await (0, game_db_production_v2_release_candidate_1.buildProductionV2ReleaseCandidate)({
                sourceDatasetPath: (0, path_1.resolve)(sourceBundleRoot, "characters.json.gz"),
                sourceManifestPath: (0, path_1.resolve)(sourceBundleRoot, "characters-manifest.json"),
                sourceDataRoot,
                outputDir,
            });
            assert_1.strict.equal(report.source.payloadSha256, artifact.manifest.sha256);
            assert_1.strict.equal(report.changedReferenceCount, 4);
            assert_1.strict.equal(report.target.referenceCount, 4);
            assert_1.strict.equal(report.target.objectBytes, 54);
            assert_1.strict.equal(report.gates.publisherDryRun, "NO-GO");
            const projected = JSON.parse((0, zlib_1.gunzipSync)(await (0, promises_1.readFile)((0, path_1.resolve)(outputDir, "characters.json.gz"))).toString("utf8"));
            assert_1.strict.equal(projected[0].portraitURL, portrait.replace("staging/v2/", "v2/"));
            assert_1.strict.equal(projected[0].portraitLayers?.thumbURL, thumb.replace("staging/v2/", "v2/"));
            assert_1.strict.equal(projected[0].name, character.name);
            assert_1.strict.deepEqual(await (0, promises_1.readFile)((0, path_1.resolve)(outputDir, "objects", ...portrait.replace("staging/v2/", "v2/").split("/"))), portraitBytes);
        }
        finally {
            await (0, promises_1.rm)(root, { recursive: true, force: true });
        }
    });
    it("rejects non-staging portrait references", async () => {
        const root = await (0, promises_1.mkdtemp)((0, path_1.resolve)((0, os_1.tmpdir)(), "dokkan-production-v2-candidate-invalid-"));
        try {
            const artifact = (0, dataset_artifacts_1.buildCharacterDatasetArtifact)([{
                    id: "100",
                    name: "Test",
                    portraitURL: "images/v2/portrait_100.png",
                }], {
                datasetVersion: "2026-08-27T05:25:00.000Z",
                generatedAt: "2026-08-27T05:25:00.000Z",
            });
            await (0, promises_1.writeFile)((0, path_1.resolve)(root, "characters.json.gz"), artifact.gzipBuffer);
            await (0, promises_1.writeFile)((0, path_1.resolve)(root, "characters-manifest.json"), `${JSON.stringify(artifact.manifest)}\n`);
            await assert_1.strict.rejects((0, game_db_production_v2_release_candidate_1.buildProductionV2ReleaseCandidate)({
                sourceDatasetPath: (0, path_1.resolve)(root, "characters.json.gz"),
                sourceManifestPath: (0, path_1.resolve)(root, "characters-manifest.json"),
                sourceDataRoot: root,
                outputDir: (0, path_1.resolve)(root, "output", "candidate"),
            }), /not staging\/v2 scoped/);
        }
        finally {
            await (0, promises_1.rm)(root, { recursive: true, force: true });
        }
    });
});
//# sourceMappingURL=game-db-production-v2-release-candidate.spec.js.map