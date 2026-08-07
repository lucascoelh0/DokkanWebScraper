"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runK0 = void 0;
const promises_1 = require("fs/promises");
const path_1 = require("path");
const artifact_1 = require("./artifact");
const identity_builder_1 = require("./identity-builder");
const identity_validator_1 = require("./identity-validator");
const source_1 = require("./source");
function parseArgs(argv) {
    const values = new Map();
    for (let index = 0; index < argv.length; index += 1) {
        const token = argv[index];
        if (!token.startsWith("--"))
            throw new Error(`Unexpected argument: ${token}`);
        const value = argv[++index];
        if (!value)
            throw new Error(`Missing value for ${token}`);
        values.set(token, value);
    }
    const inputDir = values.get("--input-dir");
    if (!inputDir)
        throw new Error("--input-dir is required");
    return { inputDir: (0, path_1.resolve)(inputDir), outputDir: (0, path_1.resolve)(values.get("--output-dir") ?? "data/database-characters/k0") };
}
async function runK0(options) {
    let peakRssBytes = process.memoryUsage().rss;
    const memoryTimer = setInterval(() => { peakRssBytes = Math.max(peakRssBytes, process.memoryUsage().rss); }, 25);
    try {
        const source = await (0, source_1.readCharacterSourceInput)(options.inputDir);
        const firstDataset = await (0, identity_builder_1.buildDatabaseCharacterIdentityDataset)(source);
        const coverage = (0, identity_builder_1.buildDatabaseCharacterIdentityCoverage)(firstDataset);
        const validation = (0, identity_validator_1.validateDatabaseCharacterIdentityDataset)(firstDataset, coverage);
        if (!validation.valid)
            throw new Error(`K0 validation failed: ${validation.failures.join("; ")}`);
        const firstArtifact = (0, artifact_1.buildDeterministicJsonGzipArtifact)(firstDataset);
        const secondDataset = await (0, identity_builder_1.buildDatabaseCharacterIdentityDataset)(source);
        const secondArtifact = (0, artifact_1.buildDeterministicJsonGzipArtifact)(secondDataset);
        if (!firstArtifact.gzip.equals(secondArtifact.gzip))
            throw new Error("K0 two-generation byte identity failed");
        const coverageBytes = `${JSON.stringify(coverage, null, 2)}\n`;
        const validationBytes = `${JSON.stringify(validation, null, 2)}\n`;
        const manifest = {
            schemaVersion: 1,
            contractVersion: "1.0.0",
            generatedAt: source.generatedAt,
            fileName: "database-characters-k0-identity.json.gz",
            compression: "gzip",
            sha256: firstArtifact.sha256,
            sizeBytes: firstArtifact.gzip.length,
            uncompressedSizeBytes: firstArtifact.json.length,
            characterCount: coverage.characterCount,
            cardCount: coverage.cardCount,
            stateCount: coverage.stateCount,
            sourceSnapshotVersion: source.snapshotVersion,
            sourceDatabaseSha256: source.databaseSha256,
            sourceDb1ArtifactSha256: source.artifactSha256,
            coverageFile: "database-characters-k0-coverage.json",
            coverageSha256: (0, artifact_1.sha256Bytes)(coverageBytes),
            coverageSizeBytes: Buffer.byteLength(coverageBytes),
            validationFile: "database-characters-k0-validation.json",
            validationSha256: (0, artifact_1.sha256Bytes)(validationBytes),
            validationSizeBytes: Buffer.byteLength(validationBytes),
        };
        await (0, promises_1.mkdir)(options.outputDir, { recursive: true });
        await Promise.all([
            (0, promises_1.writeFile)((0, path_1.resolve)(options.outputDir, manifest.fileName), firstArtifact.gzip),
            (0, promises_1.writeFile)((0, path_1.resolve)(options.outputDir, "database-characters-k0-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8"),
            (0, promises_1.writeFile)((0, path_1.resolve)(options.outputDir, manifest.coverageFile), coverageBytes, "utf8"),
            (0, promises_1.writeFile)((0, path_1.resolve)(options.outputDir, manifest.validationFile), validationBytes, "utf8"),
        ]);
        peakRssBytes = Math.max(peakRssBytes, process.memoryUsage().rss);
        return {
            outputDir: options.outputDir,
            manifest,
            coverageSha256: (0, artifact_1.sha256Bytes)(coverageBytes),
            validationSha256: (0, artifact_1.sha256Bytes)(validationBytes),
            twoGenerationByteIdentical: true,
            peakRssBytes,
        };
    }
    finally {
        clearInterval(memoryTimer);
    }
}
exports.runK0 = runK0;
if (require.main === module) {
    runK0(parseArgs(process.argv.slice(2))).then(result => console.log(JSON.stringify(result, null, 2))).catch(error => {
        console.error(error);
        process.exitCode = 1;
    });
}
//# sourceMappingURL=k0-run.js.map