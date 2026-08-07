import { mkdir, writeFile } from "fs/promises";
import { resolve } from "path";
import { buildDeterministicJsonGzipArtifact, sha256Bytes } from "./artifact";
import { buildDatabaseCharacterStateGraphCoverage, buildDatabaseCharacterStateGraphDataset } from "./state-graph-builder";
import { validateDatabaseCharacterStateGraphDataset } from "./state-graph-validator";
import { readCharacterSourceInput } from "./source";

function value(argv: string[], name: string): string | undefined { const index = argv.indexOf(name); return index < 0 ? undefined : argv[index + 1]; }

async function run() {
    const inputDir = value(process.argv.slice(2), "--input-dir");
    if (!inputDir) throw new Error("--input-dir is required");
    const outputDir = resolve(value(process.argv.slice(2), "--output-dir") ?? "data/database-characters/k1");
    let peakRssBytes = process.memoryUsage().rss;
    const timer = setInterval(() => peakRssBytes = Math.max(peakRssBytes, process.memoryUsage().rss), 25);
    try {
        const source = await readCharacterSourceInput(inputDir);
        const dataset = await buildDatabaseCharacterStateGraphDataset(source);
        const coverage = buildDatabaseCharacterStateGraphCoverage(dataset);
        const validation = validateDatabaseCharacterStateGraphDataset(dataset, coverage);
        if (!validation.valid) throw new Error(validation.failures.join("; "));
        const artifact = buildDeterministicJsonGzipArtifact(dataset);
        const second = buildDeterministicJsonGzipArtifact(await buildDatabaseCharacterStateGraphDataset(source));
        if (!artifact.gzip.equals(second.gzip)) throw new Error("K1 two-generation byte identity failed");
        const coverageBytes = `${JSON.stringify(coverage, null, 2)}\n`;
        const validationBytes = `${JSON.stringify(validation, null, 2)}\n`;
        const manifest = {
            schemaVersion: 1, contractVersion: "1.0.0", generatedAt: source.generatedAt,
            fileName: "database-characters-k1-state-graph.json.gz", compression: "gzip",
            sha256: artifact.sha256, sizeBytes: artifact.gzip.length, uncompressedSizeBytes: artifact.json.length,
            stateCount: coverage.stateCount, transitionCount: validation.transitionCount,
            sourceSnapshotVersion: source.snapshotVersion, sourceDatabaseSha256: source.databaseSha256, sourceDb1ArtifactSha256: source.artifactSha256,
            coverageFile: "database-characters-k1-coverage.json", coverageSha256: sha256Bytes(coverageBytes), coverageSizeBytes: Buffer.byteLength(coverageBytes),
            validationFile: "database-characters-k1-validation.json", validationSha256: sha256Bytes(validationBytes), validationSizeBytes: Buffer.byteLength(validationBytes),
        };
        await mkdir(outputDir, { recursive: true });
        await Promise.all([
            writeFile(resolve(outputDir, manifest.fileName), artifact.gzip),
            writeFile(resolve(outputDir, "database-characters-k1-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`),
            writeFile(resolve(outputDir, manifest.coverageFile), coverageBytes),
            writeFile(resolve(outputDir, manifest.validationFile), validationBytes),
        ]);
        peakRssBytes = Math.max(peakRssBytes, process.memoryUsage().rss);
        console.log(JSON.stringify({ outputDir, manifest, twoGenerationByteIdentical: true, peakRssBytes }, null, 2));
    } finally { clearInterval(timer); }
}

if (require.main === module) run().catch(error => { console.error(error); process.exitCode = 1; });
