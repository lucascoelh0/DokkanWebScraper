"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const promises_1 = require("fs/promises");
const path_1 = require("path");
const zlib_1 = require("zlib");
const artifact_1 = require("./artifact");
const compact_builder_1 = require("./compact-builder");
const compact_contract_1 = require("./compact-contract");
const compact_source_1 = require("./compact-source");
const compact_validator_1 = require("./compact-validator");
const value = (name) => { const index = process.argv.indexOf(name); return index < 0 ? undefined : process.argv[index + 1]; };
const jsonBytes = (input) => Buffer.from(`${JSON.stringify(input, null, 2)}\n`, "utf8");
async function generate(source) {
    const builder = new compact_builder_1.CharacterCompactProjectionBuilder(source.lineage, source.generatedAt, source.datasetVersion);
    await source.streamFields(field => builder.accept(field));
    const { projection, coverage } = builder.finish(true);
    const raw = jsonBytes(projection);
    if (raw.length > compact_contract_1.CHARACTER_COMPACT_RAW_BUDGET_BYTES)
        throw new Error(`K15 raw budget exceeded: ${raw.length} > ${compact_contract_1.CHARACTER_COMPACT_RAW_BUDGET_BYTES}`);
    const gzip = (0, zlib_1.gzipSync)(raw, { level: 9 });
    if (gzip.length > compact_contract_1.CHARACTER_COMPACT_GZIP_BUDGET_BYTES)
        throw new Error(`K15 gzip budget exceeded: ${gzip.length} > ${compact_contract_1.CHARACTER_COMPACT_GZIP_BUDGET_BYTES}`);
    const validation = (0, compact_validator_1.validateCharacterCompactProjection)(projection, coverage, { gzipSizeBytes: gzip.length, rawSizeBytes: raw.length }, true);
    if (!validation.valid)
        throw new Error(`K15 validation failed: ${validation.failures.join("; ")}`);
    return {
        projection,
        coverage,
        validation,
        readiness: (0, compact_validator_1.buildCharacterCompactReadiness)(source.generatedAt),
        raw,
        gzip,
        sha256: (0, artifact_1.sha256Bytes)(gzip),
        rawSha256: (0, artifact_1.sha256Bytes)(raw),
    };
}
async function run() {
    const shadowRoot = (0, path_1.resolve)(value("--shadow-root") ?? "D:/Dokkan/DokkanWebScraper-character-shadow/data/database-characters/shadow");
    const outputDir = (0, path_1.resolve)(value("--output-dir") ?? "data/database-characters/compact");
    let peakRssBytes = process.memoryUsage().rss;
    const monitor = setInterval(() => { peakRssBytes = Math.max(peakRssBytes, process.memoryUsage().rss); }, 25);
    try {
        const source = await (0, compact_source_1.loadCharacterCompactGenerationSource)(shadowRoot);
        const first = await generate(source);
        global.gc?.();
        const second = await generate(source);
        peakRssBytes = Math.max(peakRssBytes, process.memoryUsage().rss);
        for (const [label, left, right] of [
            ["payload", first.gzip, second.gzip],
            ["raw payload", first.raw, second.raw],
            ["coverage", jsonBytes(first.coverage), jsonBytes(second.coverage)],
            ["validation", jsonBytes(first.validation), jsonBytes(second.validation)],
            ["readiness", jsonBytes(first.readiness), jsonBytes(second.readiness)],
        ])
            if (!left.equals(right))
                throw new Error(`K15 two-generation byte identity failed for ${label}`);
        if (peakRssBytes >= 1073741824)
            throw new Error(`K15 memory limit exceeded: ${peakRssBytes}`);
        const fileName = `database-characters-k15-compact-supported.${first.sha256}.json.gz`;
        const coverageBytes = jsonBytes(first.coverage);
        const validationBytes = jsonBytes(first.validation);
        const readinessBytes = jsonBytes(first.readiness);
        const manifest = {
            schemaVersion: 1,
            contract: "dokkan-database-character-compact-shadow-manifest",
            contractVersion: "1.0.0",
            generatedAt: source.generatedAt,
            datasetVersion: source.datasetVersion,
            fileName,
            compression: "gzip",
            sha256: first.sha256,
            sizeBytes: first.gzip.length,
            uncompressedSha256: first.rawSha256,
            uncompressedSizeBytes: first.raw.length,
            recordCount: first.projection.records.length,
            lineage: source.lineage,
            coverageFile: "database-characters-k15-coverage.json",
            coverageSha256: (0, artifact_1.sha256Bytes)(coverageBytes),
            coverageSizeBytes: coverageBytes.length,
            validationFile: "database-characters-k15-validation.json",
            validationSha256: (0, artifact_1.sha256Bytes)(validationBytes),
            validationSizeBytes: validationBytes.length,
            readinessFile: "database-characters-k15-readiness.json",
            readinessSha256: (0, artifact_1.sha256Bytes)(readinessBytes),
            readinessSizeBytes: readinessBytes.length,
        };
        await (0, promises_1.mkdir)(outputDir, { recursive: true });
        await Promise.all([
            (0, promises_1.writeFile)((0, path_1.resolve)(outputDir, fileName), first.gzip),
            (0, promises_1.writeFile)((0, path_1.resolve)(outputDir, "database-characters-k15-manifest.json"), jsonBytes(manifest)),
            (0, promises_1.writeFile)((0, path_1.resolve)(outputDir, manifest.coverageFile), coverageBytes),
            (0, promises_1.writeFile)((0, path_1.resolve)(outputDir, manifest.validationFile), validationBytes),
            (0, promises_1.writeFile)((0, path_1.resolve)(outputDir, manifest.readinessFile), readinessBytes),
        ]);
        await (0, compact_validator_1.validateCharacterCompactArtifact)(outputDir);
        const report = {
            outputDir,
            manifest,
            manifestSha256: (0, artifact_1.sha256Bytes)(jsonBytes(manifest)),
            manifestSizeBytes: jsonBytes(manifest).length,
            coverage: first.coverage,
            twoGenerationByteIdentical: true,
            peakRssBytes,
            budgets: { gzipMaximumBytes: compact_contract_1.CHARACTER_COMPACT_GZIP_BUDGET_BYTES, rawMaximumBytes: compact_contract_1.CHARACTER_COMPACT_RAW_BUDGET_BYTES },
            readiness: first.readiness,
        };
        await (0, promises_1.writeFile)((0, path_1.resolve)(outputDir, "database-characters-k15-run-report.json"), jsonBytes(report));
        console.log(JSON.stringify(report, null, 2));
    }
    finally {
        clearInterval(monitor);
    }
}
if (require.main === module)
    run().catch(error => { console.error(error); process.exitCode = 1; });
//# sourceMappingURL=compact-run.js.map