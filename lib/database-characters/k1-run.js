"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const promises_1 = require("fs/promises");
const path_1 = require("path");
const artifact_1 = require("./artifact");
const state_graph_builder_1 = require("./state-graph-builder");
const state_graph_validator_1 = require("./state-graph-validator");
const source_1 = require("./source");
function value(argv, name) { const index = argv.indexOf(name); return index < 0 ? undefined : argv[index + 1]; }
async function run() {
    const inputDir = value(process.argv.slice(2), "--input-dir");
    if (!inputDir)
        throw new Error("--input-dir is required");
    const outputDir = (0, path_1.resolve)(value(process.argv.slice(2), "--output-dir") ?? "data/database-characters/k1");
    let peakRssBytes = process.memoryUsage().rss;
    const timer = setInterval(() => peakRssBytes = Math.max(peakRssBytes, process.memoryUsage().rss), 25);
    try {
        const source = await (0, source_1.readCharacterSourceInput)(inputDir);
        const dataset = await (0, state_graph_builder_1.buildDatabaseCharacterStateGraphDataset)(source);
        const coverage = (0, state_graph_builder_1.buildDatabaseCharacterStateGraphCoverage)(dataset);
        const validation = (0, state_graph_validator_1.validateDatabaseCharacterStateGraphDataset)(dataset, coverage);
        if (!validation.valid)
            throw new Error(validation.failures.join("; "));
        const artifact = (0, artifact_1.buildDeterministicJsonGzipArtifact)(dataset);
        const second = (0, artifact_1.buildDeterministicJsonGzipArtifact)(await (0, state_graph_builder_1.buildDatabaseCharacterStateGraphDataset)(source));
        if (!artifact.gzip.equals(second.gzip))
            throw new Error("K1 two-generation byte identity failed");
        const coverageBytes = `${JSON.stringify(coverage, null, 2)}\n`;
        const validationBytes = `${JSON.stringify(validation, null, 2)}\n`;
        const manifest = {
            schemaVersion: 1, contractVersion: "1.0.0", generatedAt: source.generatedAt,
            fileName: "database-characters-k1-state-graph.json.gz", compression: "gzip",
            sha256: artifact.sha256, sizeBytes: artifact.gzip.length, uncompressedSizeBytes: artifact.json.length,
            stateCount: coverage.stateCount, transitionCount: validation.transitionCount,
            sourceSnapshotVersion: source.snapshotVersion, sourceDatabaseSha256: source.databaseSha256, sourceDb1ArtifactSha256: source.artifactSha256,
            coverageFile: "database-characters-k1-coverage.json", coverageSha256: (0, artifact_1.sha256Bytes)(coverageBytes), coverageSizeBytes: Buffer.byteLength(coverageBytes),
            validationFile: "database-characters-k1-validation.json", validationSha256: (0, artifact_1.sha256Bytes)(validationBytes), validationSizeBytes: Buffer.byteLength(validationBytes),
        };
        await (0, promises_1.mkdir)(outputDir, { recursive: true });
        await Promise.all([
            (0, promises_1.writeFile)((0, path_1.resolve)(outputDir, manifest.fileName), artifact.gzip),
            (0, promises_1.writeFile)((0, path_1.resolve)(outputDir, "database-characters-k1-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`),
            (0, promises_1.writeFile)((0, path_1.resolve)(outputDir, manifest.coverageFile), coverageBytes),
            (0, promises_1.writeFile)((0, path_1.resolve)(outputDir, manifest.validationFile), validationBytes),
        ]);
        peakRssBytes = Math.max(peakRssBytes, process.memoryUsage().rss);
        console.log(JSON.stringify({ outputDir, manifest, twoGenerationByteIdentical: true, peakRssBytes }, null, 2));
    }
    finally {
        clearInterval(timer);
    }
}
if (require.main === module)
    run().catch(error => { console.error(error); process.exitCode = 1; });
//# sourceMappingURL=k1-run.js.map