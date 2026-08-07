"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const promises_1 = require("fs/promises");
const path_1 = require("path");
const artifact_1 = require("./artifact");
const skills_builder_1 = require("./skills-builder");
const skills_validator_1 = require("./skills-validator");
const source_1 = require("./source");
const C1 = { fileName: "team-analysis-database-first-sidecar-c1.json.gz", sha256: "973650e1a61de30f6262d19b8d437ef1caa0583a07119365d506865c3cb29cc4", sizeBytes: 175107, uncompressedSizeBytes: 4798370 };
const C2 = { fileName: "team-analysis-database-first-supported-c2.json.gz", sha256: "e2d1ab66d1bbcd122b208c8a42d41525986ceb5f3fd665ea7f6698e3ec1c9bfb", sizeBytes: 50280, uncompressedSizeBytes: 1712635 };
function arg(name) { const index = process.argv.indexOf(name); return index < 0 ? undefined : process.argv[index + 1]; }
async function run() {
    const inputDir = arg("--input-dir"), integrationDir = arg("--integration-dir"), database = arg("--database");
    if (!inputDir || !integrationDir || !database)
        throw new Error("--input-dir, --integration-dir and --database are required");
    const outputDir = (0, path_1.resolve)(arg("--output-dir") ?? "data/database-characters/k3");
    let peakRssBytes = process.memoryUsage().rss;
    const timer = setInterval(() => peakRssBytes = Math.max(peakRssBytes, process.memoryUsage().rss), 25);
    try {
        const source = await (0, source_1.readCharacterSourceInput)(inputDir);
        const c1 = await (0, source_1.readPinnedGzipJson)((0, path_1.resolve)(integrationDir, C1.fileName), C1);
        const c2 = await (0, source_1.readPinnedGzipJson)((0, path_1.resolve)(integrationDir, C2.fileName), C2);
        await (0, source_1.assertPinnedDatabaseFile)(database);
        const generate = async () => {
            const dataset = await (0, skills_builder_1.buildDatabaseCharacterSkillsDataset)({ source, c1, c2, c1Artifact: C1, c2Artifact: C2 });
            const coverage = (0, skills_builder_1.buildDatabaseCharacterSkillsCoverage)(dataset), validation = (0, skills_validator_1.validateDatabaseCharacterSkillsDataset)(dataset, coverage, c1, c2);
            if (!validation.valid)
                throw new Error(validation.failures.join("; "));
            return { artifact: (0, artifact_1.buildDeterministicJsonGzipArtifact)(dataset), coverage, validation };
        };
        const first = await generate();
        const second = await generate();
        if (!first.artifact.gzip.equals(second.artifact.gzip))
            throw new Error("K3 two-generation byte identity failed");
        await (0, source_1.assertPinnedArtifactFile)(source.artifactPath, { sha256: source.artifactSha256, sizeBytes: source.artifactSizeBytes });
        await (0, source_1.assertPinnedDatabaseFile)(database);
        const coverageBytes = `${JSON.stringify(first.coverage, null, 2)}\n`, validationBytes = `${JSON.stringify(first.validation, null, 2)}\n`;
        const manifest = { schemaVersion: 1, contractVersion: "1.0.0", generatedAt: source.generatedAt, fileName: "database-characters-k3-skills.json.gz", compression: "gzip", sha256: first.artifact.sha256, sizeBytes: first.artifact.gzip.length, uncompressedSizeBytes: first.artifact.json.length,
            sourceSnapshotVersion: source.snapshotVersion, sourceDatabaseSha256: source.databaseSha256, sourceDb1ArtifactSha256: source.artifactSha256, sourceC1AuditSha256: C1.sha256, sourceC2SupportedSha256: C2.sha256,
            coverageFile: "database-characters-k3-coverage.json", coverageSha256: (0, artifact_1.sha256Bytes)(coverageBytes), coverageSizeBytes: Buffer.byteLength(coverageBytes), validationFile: "database-characters-k3-validation.json", validationSha256: (0, artifact_1.sha256Bytes)(validationBytes), validationSizeBytes: Buffer.byteLength(validationBytes) };
        peakRssBytes = Math.max(peakRssBytes, process.memoryUsage().rss);
        if (peakRssBytes >= 1073741824)
            throw new Error(`K3 exceeded 1 GiB RSS ceiling: ${peakRssBytes}`);
        await (0, promises_1.mkdir)(outputDir, { recursive: true });
        await Promise.all([(0, promises_1.writeFile)((0, path_1.resolve)(outputDir, manifest.fileName), first.artifact.gzip), (0, promises_1.writeFile)((0, path_1.resolve)(outputDir, "database-characters-k3-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`), (0, promises_1.writeFile)((0, path_1.resolve)(outputDir, manifest.coverageFile), coverageBytes), (0, promises_1.writeFile)((0, path_1.resolve)(outputDir, manifest.validationFile), validationBytes)]);
        console.log(JSON.stringify({ outputDir, manifest, coverage: first.coverage, twoGenerationByteIdentical: true, peakRssBytes }, null, 2));
    }
    finally {
        clearInterval(timer);
    }
}
if (require.main === module)
    run().catch(error => { console.error(error); process.exitCode = 1; });
//# sourceMappingURL=k3-run.js.map