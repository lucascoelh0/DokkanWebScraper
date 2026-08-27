import { strict as assert } from "assert";
import { createHash } from "crypto";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { dirname, resolve } from "path";
import { gunzipSync } from "zlib";
import type { Character } from "../character";
import { buildCharacterDatasetArtifact } from "../dataset-artifacts";
import { buildProductionV2ReleaseCandidate } from "./game-db-production-v2-release-candidate";

const sha256 = (value: Buffer) => createHash("sha256").update(value).digest("hex");

describe("production v2 release candidate", () => {
    it("changes only staging portrait delivery keys and preserves content-addressed bytes", async () => {
        const root = await mkdtemp(resolve(tmpdir(), "dokkan-production-v2-candidate-"));
        try {
            const sourceDataRoot = resolve(root, "source-objects");
            const sourceBundleRoot = resolve(root, "source-bundle");
            const outputDir = resolve(root, "output", "candidate");
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
            ] as const) {
                const path = resolve(sourceDataRoot, ...key.split("/"));
                await mkdir(dirname(path), { recursive: true });
                await writeFile(path, bytes);
            }
            const character = {
                id: "100",
                name: "Test",
                portraitURL: portrait,
                portraitLayers: { backgroundURL: background, thumbURL: thumb, overlayURL: overlay },
                transformations: [{ id: "101", name: "Form", portraitURL: portrait }],
            } as Character;
            const artifact = buildCharacterDatasetArtifact([character], {
                datasetVersion: "2026-08-27T05:25:00.000Z",
                generatedAt: "2026-08-27T05:25:00.000Z",
            });
            await mkdir(sourceBundleRoot, { recursive: true });
            await writeFile(resolve(sourceBundleRoot, "characters.json.gz"), artifact.gzipBuffer);
            await writeFile(
                resolve(sourceBundleRoot, "characters-manifest.json"),
                `${JSON.stringify(artifact.manifest, null, 2)}\n`,
            );

            const report = await buildProductionV2ReleaseCandidate({
                sourceDatasetPath: resolve(sourceBundleRoot, "characters.json.gz"),
                sourceManifestPath: resolve(sourceBundleRoot, "characters-manifest.json"),
                sourceDataRoot,
                outputDir,
            });
            assert.equal(report.source.payloadSha256, artifact.manifest.sha256);
            assert.equal(report.changedReferenceCount, 4);
            assert.equal(report.target.referenceCount, 4);
            assert.equal(report.target.objectBytes, 54);
            assert.equal(report.gates.publisherDryRun, "NO-GO");

            const projected = JSON.parse(gunzipSync(
                await readFile(resolve(outputDir, "characters.json.gz")),
            ).toString("utf8")) as Character[];
            assert.equal(projected[0].portraitURL, portrait.replace("staging/v2/", "v2/"));
            assert.equal(projected[0].portraitLayers?.thumbURL, thumb.replace("staging/v2/", "v2/"));
            assert.equal(projected[0].name, character.name);
            assert.deepEqual(
                await readFile(resolve(outputDir, "objects", ...portrait.replace("staging/v2/", "v2/").split("/"))),
                portraitBytes,
            );
        } finally {
            await rm(root, { recursive: true, force: true });
        }
    });

    it("rejects non-staging portrait references", async () => {
        const root = await mkdtemp(resolve(tmpdir(), "dokkan-production-v2-candidate-invalid-"));
        try {
            const artifact = buildCharacterDatasetArtifact([{
                id: "100",
                name: "Test",
                portraitURL: "images/v2/portrait_100.png",
            } as Character], {
                datasetVersion: "2026-08-27T05:25:00.000Z",
                generatedAt: "2026-08-27T05:25:00.000Z",
            });
            await writeFile(resolve(root, "characters.json.gz"), artifact.gzipBuffer);
            await writeFile(resolve(root, "characters-manifest.json"), `${JSON.stringify(artifact.manifest)}\n`);
            await assert.rejects(
                buildProductionV2ReleaseCandidate({
                    sourceDatasetPath: resolve(root, "characters.json.gz"),
                    sourceManifestPath: resolve(root, "characters-manifest.json"),
                    sourceDataRoot: root,
                    outputDir: resolve(root, "output", "candidate"),
                }),
                /not staging\/v2 scoped/,
            );
        } finally {
            await rm(root, { recursive: true, force: true });
        }
    });
});
