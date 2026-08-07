import { mkdir, writeFile } from "fs/promises";
import { resolve } from "path";
import { buildDeterministicJsonGzipArtifact, sha256Bytes } from "./artifact";
import { buildDatabaseCharacterIdentityCoverage, buildDatabaseCharacterIdentityDataset } from "./identity-builder";
import { DatabaseCharacterIdentityManifest } from "./identity-contract";
import { validateDatabaseCharacterIdentityDataset } from "./identity-validator";
import { readCharacterSourceInput } from "./source";

interface Options { inputDir: string; outputDir: string }

function parseArgs(argv: string[]): Options {
    const values = new Map<string, string>();
    for (let index = 0; index < argv.length; index += 1) {
        const token = argv[index];
        if (!token.startsWith("--")) throw new Error(`Unexpected argument: ${token}`);
        const value = argv[++index];
        if (!value) throw new Error(`Missing value for ${token}`);
        values.set(token, value);
    }
    const inputDir = values.get("--input-dir");
    if (!inputDir) throw new Error("--input-dir is required");
    return { inputDir: resolve(inputDir), outputDir: resolve(values.get("--output-dir") ?? "data/database-characters/k0") };
}

export async function runK0(options: Options) {
    let peakRssBytes = process.memoryUsage().rss;
    const memoryTimer = setInterval(() => { peakRssBytes = Math.max(peakRssBytes, process.memoryUsage().rss); }, 25);
    try {
        const source = await readCharacterSourceInput(options.inputDir);
        const firstDataset = await buildDatabaseCharacterIdentityDataset(source);
        const coverage = buildDatabaseCharacterIdentityCoverage(firstDataset);
        const validation = validateDatabaseCharacterIdentityDataset(firstDataset, coverage);
        if (!validation.valid) throw new Error(`K0 validation failed: ${validation.failures.join("; ")}`);
        const firstArtifact = buildDeterministicJsonGzipArtifact(firstDataset);
        const secondDataset = await buildDatabaseCharacterIdentityDataset(source);
        const secondArtifact = buildDeterministicJsonGzipArtifact(secondDataset);
        if (!firstArtifact.gzip.equals(secondArtifact.gzip)) throw new Error("K0 two-generation byte identity failed");
        const coverageBytes = `${JSON.stringify(coverage, null, 2)}\n`;
        const validationBytes = `${JSON.stringify(validation, null, 2)}\n`;
        const manifest: DatabaseCharacterIdentityManifest = {
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
            coverageSha256: sha256Bytes(coverageBytes),
            coverageSizeBytes: Buffer.byteLength(coverageBytes),
            validationFile: "database-characters-k0-validation.json",
            validationSha256: sha256Bytes(validationBytes),
            validationSizeBytes: Buffer.byteLength(validationBytes),
        };
        await mkdir(options.outputDir, { recursive: true });
        await Promise.all([
            writeFile(resolve(options.outputDir, manifest.fileName), firstArtifact.gzip),
            writeFile(resolve(options.outputDir, "database-characters-k0-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8"),
            writeFile(resolve(options.outputDir, manifest.coverageFile), coverageBytes, "utf8"),
            writeFile(resolve(options.outputDir, manifest.validationFile), validationBytes, "utf8"),
        ]);
        peakRssBytes = Math.max(peakRssBytes, process.memoryUsage().rss);
        return {
            outputDir: options.outputDir,
            manifest,
            coverageSha256: sha256Bytes(coverageBytes),
            validationSha256: sha256Bytes(validationBytes),
            twoGenerationByteIdentical: true,
            peakRssBytes,
        };
    } finally {
        clearInterval(memoryTimer);
    }
}

if (require.main === module) {
    runK0(parseArgs(process.argv.slice(2))).then(result => console.log(JSON.stringify(result, null, 2))).catch(error => {
        console.error(error);
        process.exitCode = 1;
    });
}
