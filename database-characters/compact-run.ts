import { mkdir, writeFile } from "fs/promises";
import { resolve } from "path";
import { gzipSync } from "zlib";
import { sha256Bytes } from "./artifact";
import { CharacterCompactProjectionBuilder } from "./compact-builder";
import {
    CHARACTER_COMPACT_GZIP_BUDGET_BYTES,
    CHARACTER_COMPACT_RAW_BUDGET_BYTES,
    CharacterCompactManifest,
} from "./compact-contract";
import { loadCharacterCompactGenerationSource } from "./compact-source";
import { buildCharacterCompactReadiness, validateCharacterCompactArtifact, validateCharacterCompactProjection } from "./compact-validator";

const value = (name: string): string | undefined => { const index = process.argv.indexOf(name); return index < 0 ? undefined : process.argv[index + 1]; };
const jsonBytes = (input: unknown) => Buffer.from(`${JSON.stringify(input, null, 2)}\n`, "utf8");

async function generate(source: Awaited<ReturnType<typeof loadCharacterCompactGenerationSource>>) {
    const builder = new CharacterCompactProjectionBuilder(source.lineage, source.generatedAt, source.datasetVersion);
    await source.streamFields(field => builder.accept(field));
    const { projection, coverage } = builder.finish(true);
    const raw = jsonBytes(projection);
    if (raw.length > CHARACTER_COMPACT_RAW_BUDGET_BYTES) throw new Error(`K15 raw budget exceeded: ${raw.length} > ${CHARACTER_COMPACT_RAW_BUDGET_BYTES}`);
    const gzip = gzipSync(raw, { level: 9 });
    if (gzip.length > CHARACTER_COMPACT_GZIP_BUDGET_BYTES) throw new Error(`K15 gzip budget exceeded: ${gzip.length} > ${CHARACTER_COMPACT_GZIP_BUDGET_BYTES}`);
    const validation = validateCharacterCompactProjection(projection, coverage, { gzipSizeBytes: gzip.length, rawSizeBytes: raw.length }, true);
    if (!validation.valid) throw new Error(`K15 validation failed: ${validation.failures.join("; ")}`);
    return {
        projection,
        coverage,
        validation,
        readiness: buildCharacterCompactReadiness(source.generatedAt),
        raw,
        gzip,
        sha256: sha256Bytes(gzip),
        rawSha256: sha256Bytes(raw),
    };
}

async function run(): Promise<void> {
    const shadowRoot = resolve(value("--shadow-root") ?? "D:/Dokkan/DokkanWebScraper-character-shadow/data/database-characters/shadow");
    const outputDir = resolve(value("--output-dir") ?? "data/database-characters/compact");
    let peakRssBytes = process.memoryUsage().rss;
    const monitor = setInterval(() => { peakRssBytes = Math.max(peakRssBytes, process.memoryUsage().rss); }, 25);
    try {
        const source = await loadCharacterCompactGenerationSource(shadowRoot);
        const first = await generate(source);
        (global as any).gc?.();
        const second = await generate(source);
        peakRssBytes = Math.max(peakRssBytes, process.memoryUsage().rss);
        for (const [label, left, right] of [
            ["payload", first.gzip, second.gzip],
            ["raw payload", first.raw, second.raw],
            ["coverage", jsonBytes(first.coverage), jsonBytes(second.coverage)],
            ["validation", jsonBytes(first.validation), jsonBytes(second.validation)],
            ["readiness", jsonBytes(first.readiness), jsonBytes(second.readiness)],
        ] as const) if (!left.equals(right)) throw new Error(`K15 two-generation byte identity failed for ${label}`);
        if (peakRssBytes >= 1_073_741_824) throw new Error(`K15 memory limit exceeded: ${peakRssBytes}`);

        const fileName = `database-characters-k15-compact-supported.${first.sha256}.json.gz`;
        const coverageBytes = jsonBytes(first.coverage);
        const validationBytes = jsonBytes(first.validation);
        const readinessBytes = jsonBytes(first.readiness);
        const manifest: CharacterCompactManifest = {
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
            coverageSha256: sha256Bytes(coverageBytes),
            coverageSizeBytes: coverageBytes.length,
            validationFile: "database-characters-k15-validation.json",
            validationSha256: sha256Bytes(validationBytes),
            validationSizeBytes: validationBytes.length,
            readinessFile: "database-characters-k15-readiness.json",
            readinessSha256: sha256Bytes(readinessBytes),
            readinessSizeBytes: readinessBytes.length,
        };
        await mkdir(outputDir, { recursive: true });
        await Promise.all([
            writeFile(resolve(outputDir, fileName), first.gzip),
            writeFile(resolve(outputDir, "database-characters-k15-manifest.json"), jsonBytes(manifest)),
            writeFile(resolve(outputDir, manifest.coverageFile), coverageBytes),
            writeFile(resolve(outputDir, manifest.validationFile), validationBytes),
            writeFile(resolve(outputDir, manifest.readinessFile), readinessBytes),
        ]);
        await validateCharacterCompactArtifact(outputDir);
        const report = {
            outputDir,
            manifest,
            manifestSha256: sha256Bytes(jsonBytes(manifest)),
            manifestSizeBytes: jsonBytes(manifest).length,
            coverage: first.coverage,
            twoGenerationByteIdentical: true,
            peakRssBytes,
            budgets: { gzipMaximumBytes: CHARACTER_COMPACT_GZIP_BUDGET_BYTES, rawMaximumBytes: CHARACTER_COMPACT_RAW_BUDGET_BYTES },
            readiness: first.readiness,
        };
        await writeFile(resolve(outputDir, "database-characters-k15-run-report.json"), jsonBytes(report));
        console.log(JSON.stringify(report, null, 2));
    } finally {
        clearInterval(monitor);
    }
}

if (require.main === module) run().catch(error => { console.error(error); process.exitCode = 1; });
