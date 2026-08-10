import { open, mkdir, readFile, stat, writeFile } from "fs/promises";
import { resolve } from "path";
import { buildDeterministicJsonGzipArtifact, sha256Bytes } from "./artifact";
import { resolveCharacterInputDirectory, resolveCharacterInputFile } from "./artifact-path";
import { buildDatabaseCharacterRefreshCoverage, buildDatabaseCharacterRefreshReceipt } from "./refresh-builder";
import { CHARACTER_REFRESH_PROFILE, CharacterSidecarProfile, PinnedFileIdentity } from "./refresh-contract";
import { validateDatabaseCharacterRefreshReceipt } from "./refresh-validator";
import { assertPinnedArtifactFile, assertPinnedDatabaseFile, readCharacterSourceInput } from "./source";

function arg(name: string): string | undefined {
    const index = process.argv.indexOf(name);
    return index < 0 ? undefined : process.argv[index + 1];
}

async function assertExactFile(path: string, identity: Pick<PinnedFileIdentity, "sha256" | "sizeBytes">): Promise<void> {
    await assertPinnedArtifactFile(path, identity);
}

async function assertElf(path: string): Promise<void> {
    await assertExactFile(path, CHARACTER_REFRESH_PROFILE.elf);
    const handle = await open(path, "r");
    try {
        const header = Buffer.alloc(20);
        const { bytesRead } = await handle.read(header, 0, header.length, 0);
        if (bytesRead !== header.length || header[0] !== 0x7f || header.toString("ascii", 1, 4) !== "ELF" || header[4] !== 2 || header[5] !== 1 || header.readUInt16LE(18) !== 183) throw new Error("Native runtime is not ELF64 little-endian AArch64");
    } finally {
        await handle.close();
    }
}

async function verifySidecar(root: string, profile: CharacterSidecarProfile): Promise<void> {
    const directory = await resolveCharacterInputDirectory(root, profile.gate, profile.gate);
    const [artifactPath, manifestPath, coveragePath, validationPath] = await Promise.all([
        resolveCharacterInputFile(directory, profile.artifact.fileName, profile.artifact.fileName),
        resolveCharacterInputFile(directory, profile.manifest.fileName, profile.manifest.fileName),
        resolveCharacterInputFile(directory, profile.coverage.fileName, profile.coverage.fileName),
        resolveCharacterInputFile(directory, profile.validation.fileName, profile.validation.fileName),
    ]);
    await Promise.all([
        assertExactFile(artifactPath, profile.artifact),
        assertExactFile(manifestPath, profile.manifest),
        assertExactFile(coveragePath, profile.coverage),
        assertExactFile(validationPath, profile.validation),
    ]);
    const [manifest, validation] = await Promise.all([
        readFile(manifestPath, "utf8").then(JSON.parse),
        readFile(validationPath, "utf8").then(JSON.parse),
    ]);
    if (manifest.schemaVersion !== 1 || manifest.contractVersion !== profile.contractVersion || manifest.compression !== "gzip" || manifest.fileName !== profile.artifact.fileName || manifest.sha256 !== profile.artifact.sha256 || manifest.sizeBytes !== profile.artifact.sizeBytes || manifest.uncompressedSizeBytes !== profile.artifact.uncompressedSizeBytes || manifest.coverageFile !== profile.coverage.fileName || manifest.coverageSha256 !== profile.coverage.sha256 || manifest.coverageSizeBytes !== profile.coverage.sizeBytes || manifest.validationFile !== profile.validation.fileName || manifest.validationSha256 !== profile.validation.sha256 || manifest.validationSizeBytes !== profile.validation.sizeBytes || manifest.sourceDb1ArtifactSha256 !== CHARACTER_REFRESH_PROFILE.db1.sha256) throw new Error(`${profile.gate.toUpperCase()} manifest contract changed`);
    if (validation.valid !== true || !Array.isArray(validation.failures) || validation.failures.length !== 0) throw new Error(`${profile.gate.toUpperCase()} validation is not green`);
}

async function preflight(options: { databasePath: string; elfPath: string; inputDir: string; semanticDir: string; sidecarRoot: string }): Promise<void> {
    await assertPinnedDatabaseFile(options.databasePath);
    const databaseMetadata = await stat(options.databasePath);
    if (databaseMetadata.size !== CHARACTER_REFRESH_PROFILE.sqlite.sizeBytes) throw new Error("SQLite size changed");
    const db1 = await readCharacterSourceInput(options.inputDir);
    if (db1.snapshotVersion !== CHARACTER_REFRESH_PROFILE.snapshotVersion || db1.artifactSha256 !== CHARACTER_REFRESH_PROFILE.db1.sha256 || db1.artifactSizeBytes !== CHARACTER_REFRESH_PROFILE.db1.sizeBytes || db1.uncompressedSizeBytes !== CHARACTER_REFRESH_PROFILE.db1.uncompressedSizeBytes || db1.cardCount !== CHARACTER_REFRESH_PROFILE.db1.cardCount) throw new Error("DB1 refresh identity changed");
    await assertElf(options.elfPath);
    for (const identity of CHARACTER_REFRESH_PROFILE.semanticFiles) {
        const semanticPath = await resolveCharacterInputFile(options.semanticDir, identity.fileName, identity.fileName);
        await assertExactFile(semanticPath, identity);
    }
    for (const sidecar of CHARACTER_REFRESH_PROFILE.sidecars) await verifySidecar(options.sidecarRoot, sidecar);
}

async function run() {
    const inputDir = resolve(arg("--input-dir") ?? "D:/Dokkan/DokkanWebScraper-db-source/data/database-experiment");
    const options = {
        databasePath: resolve(arg("--database") ?? "D:/Dokkan/database/decrypted/dokkan-global-current.db"),
        elfPath: resolve(arg("--elf") ?? "D:/Dokkan/database/apk/extracted/lib/arm64-v8a/libcocos2dcpp.so"),
        inputDir,
        semanticDir: resolve(arg("--semantic-dir") ?? inputDir),
        sidecarRoot: resolve(arg("--sidecar-root") ?? "data/database-characters"),
    };
    const outputDir = resolve(arg("--output-dir") ?? "data/database-characters/k8");
    let peakRssBytes = process.memoryUsage().rss;
    const timer = setInterval(() => peakRssBytes = Math.max(peakRssBytes, process.memoryUsage().rss), 25);
    try {
        await preflight(options);
        const firstReceipt = buildDatabaseCharacterRefreshReceipt();
        const firstCoverage = buildDatabaseCharacterRefreshCoverage(firstReceipt);
        const validation = validateDatabaseCharacterRefreshReceipt(firstReceipt, firstCoverage);
        if (!validation.valid) throw new Error(validation.failures.join("; "));
        const first = buildDeterministicJsonGzipArtifact(firstReceipt);
        const second = buildDeterministicJsonGzipArtifact(buildDatabaseCharacterRefreshReceipt());
        if (!first.gzip.equals(second.gzip)) throw new Error("K8 two-generation byte identity failed");
        await preflight(options);

        const coverageBytes = `${JSON.stringify(firstCoverage, null, 2)}\n`;
        const validationBytes = `${JSON.stringify(validation, null, 2)}\n`;
        const manifest = {
            schemaVersion: 1,
            contractVersion: "1.0.0",
            generatedAt: CHARACTER_REFRESH_PROFILE.generatedAt,
            profileId: CHARACTER_REFRESH_PROFILE.profileId,
            fileName: "database-characters-k8-refresh-receipt.json.gz",
            compression: "gzip",
            sha256: first.sha256,
            sizeBytes: first.gzip.length,
            uncompressedSizeBytes: first.json.length,
            sourceDatabaseSha256: CHARACTER_REFRESH_PROFILE.sqlite.sha256,
            sourceDb1ArtifactSha256: CHARACTER_REFRESH_PROFILE.db1.sha256,
            sourceNativeRuntimeSha256: CHARACTER_REFRESH_PROFILE.elf.sha256,
            sidecarCount: firstReceipt.sidecars.length,
            projectedSidecarBytes: firstReceipt.totals.compressedBytes,
            coverageFile: "database-characters-k8-coverage.json",
            coverageSha256: sha256Bytes(coverageBytes),
            coverageSizeBytes: Buffer.byteLength(coverageBytes),
            validationFile: "database-characters-k8-validation.json",
            validationSha256: sha256Bytes(validationBytes),
            validationSizeBytes: Buffer.byteLength(validationBytes),
        };
        peakRssBytes = Math.max(peakRssBytes, process.memoryUsage().rss);
        if (peakRssBytes >= 1_073_741_824) throw new Error(`K8 exceeded 1 GiB RSS ceiling: ${peakRssBytes}`);
        await mkdir(outputDir, { recursive: true });
        await Promise.all([
            writeFile(resolve(outputDir, manifest.fileName), first.gzip),
            writeFile(resolve(outputDir, "database-characters-k8-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`),
            writeFile(resolve(outputDir, manifest.coverageFile), coverageBytes),
            writeFile(resolve(outputDir, manifest.validationFile), validationBytes),
        ]);
        console.log(JSON.stringify({ outputDir, manifest, coverage: firstCoverage, twoGenerationByteIdentical: true, compatibilityCheckedBeforeWrite: true, peakRssBytes }, null, 2));
    } finally {
        clearInterval(timer);
    }
}

if (require.main === module) run().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
