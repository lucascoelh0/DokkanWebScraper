"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = require("fs");
const promises_1 = require("fs/promises");
const events_1 = require("events");
const path_1 = require("path");
const zlib_1 = require("zlib");
const shadow_builder_1 = require("./shadow-builder");
const artifact_1 = require("./artifact");
const shadow_parity_builder_1 = require("./shadow-parity-builder");
const shadow_readiness_builder_1 = require("./shadow-readiness-builder");
const shadow_source_1 = require("./shadow-source");
const source_1 = require("./source");
const shadow_validator_1 = require("./shadow-validator");
const value = (name) => { const index = process.argv.indexOf(name); return index < 0 ? undefined : process.argv[index + 1]; };
const jsonBytes = (input) => Buffer.from(`${JSON.stringify(input, null, 2)}\n`, "utf8");
async function writeChunk(stream, chunk) {
    if (!stream.write(chunk, "utf8"))
        await (0, events_1.once)(stream, "drain");
}
async function writeProjection(path, projection) {
    const gzip = (0, zlib_1.createGzip)({ level: 9 });
    const output = (0, fs_1.createWriteStream)(path, { flags: "w" });
    gzip.pipe(output);
    let rawBytes = 0;
    const write = async (chunk) => { rawBytes += Buffer.byteLength(chunk); await writeChunk(gzip, chunk); };
    const { fields, ...header } = projection;
    const prefix = `${JSON.stringify(header).slice(0, -1)},\"fields\":[`;
    await write(prefix);
    for (let index = 0; index < fields.length; index++)
        await write(`${index ? "," : ""}${JSON.stringify(fields[index])}`);
    await write("]}\n");
    gzip.end();
    await (0, events_1.once)(output, "close");
    const metadata = await (0, promises_1.stat)(path);
    return { sha256: await (0, source_1.sha256File)(path), sizeBytes: metadata.size, uncompressedSizeBytes: rawBytes };
}
async function generate(options) {
    const inputs = await (0, shadow_source_1.loadCharacterShadowInputs)(options);
    const projection = (0, shadow_builder_1.buildCharacterShadowProjection)(inputs);
    const coverage = (0, shadow_parity_builder_1.buildCharacterShadowCoverage)(projection, inputs.k7);
    const validation = (0, shadow_validator_1.validateCharacterShadowProjection)(projection, coverage);
    if (!validation.valid)
        throw new Error(`K13 validation failed: ${validation.failures.join("; ")}`);
    const readiness = (0, shadow_readiness_builder_1.buildCharacterShadowReadiness)(projection, coverage, validation);
    const artifact = await writeProjection(options.artifactPath, projection);
    return { artifact, coverageBytes: jsonBytes(coverage), validationBytes: jsonBytes(validation), readinessBytes: jsonBytes(readiness), fieldProjectionCount: projection.fields.length, productionPatchableCardCount: new Set(projection.fields.filter(item => item.characterField && item.authority === "database_candidate").map(item => item.cardId)).size };
}
async function run() {
    const sidecarRoot = (0, path_1.resolve)(value("--sidecar-root") ?? "D:/Dokkan/DokkanWebScraper-character-current/data/database-characters");
    const productionRoot = (0, path_1.resolve)(value("--production-root") ?? "D:/Dokkan/DokkanWebScraper/data");
    const fyiRoot = (0, path_1.resolve)(value("--fyi-root") ?? "D:/Dokkan/DokkanWebScraper/data/fyi-characters/latest");
    const outputDir = (0, path_1.resolve)(value("--output-dir") ?? "data/database-characters/shadow");
    await (0, promises_1.mkdir)(outputDir, { recursive: true });
    const firstPath = (0, path_1.resolve)(outputDir, "database-characters-k11-shadow-projection.first.tmp.gz");
    const secondPath = (0, path_1.resolve)(outputDir, "database-characters-k11-shadow-projection.second.tmp.gz");
    let peakRssBytes = process.memoryUsage().rss;
    const monitor = setInterval(() => { peakRssBytes = Math.max(peakRssBytes, process.memoryUsage().rss); }, 25);
    try {
        const first = await generate({ sidecarRoot, productionRoot, fyiRoot, artifactPath: firstPath });
        global.gc?.();
        const second = await generate({ sidecarRoot, productionRoot, fyiRoot, artifactPath: secondPath });
        peakRssBytes = Math.max(peakRssBytes, process.memoryUsage().rss);
        if (JSON.stringify(first.artifact) !== JSON.stringify(second.artifact)
            || !first.coverageBytes.equals(second.coverageBytes) || !first.validationBytes.equals(second.validationBytes) || !first.readinessBytes.equals(second.readinessBytes)
            || first.fieldProjectionCount !== second.fieldProjectionCount || first.productionPatchableCardCount !== second.productionPatchableCardCount)
            throw new Error("K10-K14 two-generation byte identity failed");
        if (peakRssBytes >= 1073741824)
            throw new Error(`K10-K14 memory limit exceeded: ${peakRssBytes}`);
        const finalPath = (0, path_1.resolve)(outputDir, "database-characters-k11-shadow-projection.json.gz");
        await (0, promises_1.copyFile)(firstPath, finalPath);
        const manifest = {
            schemaVersion: 1, contractVersion: "1.0.0", generatedAt: "2026-08-05T00:00:00.000Z", fileName: "database-characters-k11-shadow-projection.json.gz", compression: "gzip",
            sha256: first.artifact.sha256, sizeBytes: first.artifact.sizeBytes, uncompressedSizeBytes: first.artifact.uncompressedSizeBytes,
            fieldProjectionCount: first.fieldProjectionCount, productionPatchableCardCount: first.productionPatchableCardCount,
            coverageFile: "database-characters-k12-shadow-coverage.json", coverageSha256: (0, artifact_1.sha256Bytes)(first.coverageBytes), coverageSizeBytes: first.coverageBytes.length,
            validationFile: "database-characters-k13-shadow-validation.json", validationSha256: (0, artifact_1.sha256Bytes)(first.validationBytes), validationSizeBytes: first.validationBytes.length,
            readinessFile: "database-characters-k14-readiness.json", readinessSha256: (0, artifact_1.sha256Bytes)(first.readinessBytes), readinessSizeBytes: first.readinessBytes.length,
        };
        const manifestBytes = jsonBytes(manifest);
        await Promise.all([
            (0, promises_1.writeFile)((0, path_1.resolve)(outputDir, "database-characters-k10-k14-manifest.json"), manifestBytes),
            (0, promises_1.writeFile)((0, path_1.resolve)(outputDir, manifest.coverageFile), first.coverageBytes),
            (0, promises_1.writeFile)((0, path_1.resolve)(outputDir, manifest.validationFile), first.validationBytes),
            (0, promises_1.writeFile)((0, path_1.resolve)(outputDir, manifest.readinessFile), first.readinessBytes),
        ]);
        const [finalMetadata, finalHash] = await Promise.all([(0, promises_1.stat)(finalPath), (0, source_1.sha256File)(finalPath)]);
        if (finalMetadata.size !== manifest.sizeBytes || finalHash !== manifest.sha256)
            throw new Error("final shadow payload does not match its manifest");
        for (const [file, expectedHash, expectedSize] of [[manifest.coverageFile, manifest.coverageSha256, manifest.coverageSizeBytes], [manifest.validationFile, manifest.validationSha256, manifest.validationSizeBytes], [manifest.readinessFile, manifest.readinessSha256, manifest.readinessSizeBytes]]) {
            const bytes = await (0, promises_1.readFile)((0, path_1.resolve)(outputDir, file));
            if (bytes.length !== expectedSize || (0, artifact_1.sha256Bytes)(bytes) !== expectedHash)
                throw new Error(`${file} does not match its manifest`);
        }
        const report = { outputDir, manifest, manifestSha256: (0, artifact_1.sha256Bytes)(manifestBytes), manifestSizeBytes: manifestBytes.length, twoGenerationByteIdentical: true, peakRssBytes, productionModified: false, publisherEnabled: false, r2Enabled: false, androidEnabled: false };
        await (0, promises_1.writeFile)((0, path_1.resolve)(outputDir, "database-characters-k10-k14-run-report.json"), jsonBytes(report));
        console.log(JSON.stringify(report, null, 2));
    }
    finally {
        clearInterval(monitor);
    }
}
if (require.main === module)
    run().catch(error => { console.error(error); process.exitCode = 1; });
//# sourceMappingURL=shadow-run.js.map