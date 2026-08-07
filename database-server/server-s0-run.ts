import { createHash } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import { resolve } from "path";
import { buildServerS0Catalog, buildServerS0Coverage, validateServerS0Catalog } from "./server-s0-builder";
import { ServerS0Manifest } from "./server-s0-contract";

function text(value: unknown): string { return `${JSON.stringify(value, null, 2)}\n`; }
function sha256(value: string): string { return createHash("sha256").update(value).digest("hex"); }

export async function runServerS0(outputDir = resolve(process.cwd(), "data", "database-server", "s0")) {
    const dataset = buildServerS0Catalog(), coverage = buildServerS0Coverage(dataset), validation = validateServerS0Catalog(dataset);
    if (!validation.valid) throw new Error(`S0 validation failed: ${validation.failures.join(", ")}`);
    const datasetText = text(dataset), coverageText = text(coverage), validationText = text(validation);
    const manifest: ServerS0Manifest = {
        schemaVersion: 1,
        contractVersion: "0.1.0",
        generatedAt: dataset.generatedAt,
        generatedAtPolicy: dataset.generatedAtPolicy,
        fileName: "server-s0-catalog.json",
        compression: "none",
        sha256: sha256(datasetText),
        sizeBytes: Buffer.byteLength(datasetText),
        sourceSnapshotVersion: dataset.sourceSnapshotVersion,
        baselineCommit: dataset.baselineCommit,
        coverage: { fileName: "server-s0-coverage.json", sha256: sha256(coverageText), sizeBytes: Buffer.byteLength(coverageText) },
        validation: { fileName: "server-s0-validation.json", sha256: sha256(validationText), sizeBytes: Buffer.byteLength(validationText) },
    };
    await mkdir(outputDir, { recursive: true });
    await Promise.all([
        writeFile(resolve(outputDir, manifest.fileName), datasetText),
        writeFile(resolve(outputDir, manifest.coverage.fileName), coverageText),
        writeFile(resolve(outputDir, manifest.validation.fileName), validationText),
        writeFile(resolve(outputDir, "server-s0-manifest.json"), text(manifest)),
    ]);
    return { dataset, coverage, validation, manifest, peakWorkingSetBytes: process.memoryUsage().rss };
}

if (require.main === module) runServerS0().then(value => console.log(JSON.stringify({ coverage: value.coverage, validation: value.validation, manifest: value.manifest, peakWorkingSetBytes: value.peakWorkingSetBytes }, null, 2))).catch(error => { console.error(error); process.exitCode = 1; });
