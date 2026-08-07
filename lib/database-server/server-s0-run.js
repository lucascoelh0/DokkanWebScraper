"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runServerS0 = void 0;
const crypto_1 = require("crypto");
const promises_1 = require("fs/promises");
const path_1 = require("path");
const server_s0_builder_1 = require("./server-s0-builder");
function text(value) { return `${JSON.stringify(value, null, 2)}\n`; }
function sha256(value) { return (0, crypto_1.createHash)("sha256").update(value).digest("hex"); }
async function runServerS0(outputDir = (0, path_1.resolve)(process.cwd(), "data", "database-server", "s0")) {
    const dataset = (0, server_s0_builder_1.buildServerS0Catalog)(), coverage = (0, server_s0_builder_1.buildServerS0Coverage)(dataset), validation = (0, server_s0_builder_1.validateServerS0Catalog)(dataset);
    if (!validation.valid)
        throw new Error(`S0 validation failed: ${validation.failures.join(", ")}`);
    const datasetText = text(dataset), coverageText = text(coverage), validationText = text(validation);
    const manifest = {
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
    await (0, promises_1.mkdir)(outputDir, { recursive: true });
    await Promise.all([
        (0, promises_1.writeFile)((0, path_1.resolve)(outputDir, manifest.fileName), datasetText),
        (0, promises_1.writeFile)((0, path_1.resolve)(outputDir, manifest.coverage.fileName), coverageText),
        (0, promises_1.writeFile)((0, path_1.resolve)(outputDir, manifest.validation.fileName), validationText),
        (0, promises_1.writeFile)((0, path_1.resolve)(outputDir, "server-s0-manifest.json"), text(manifest)),
    ]);
    return { dataset, coverage, validation, manifest, peakWorkingSetBytes: process.memoryUsage().rss };
}
exports.runServerS0 = runServerS0;
if (require.main === module)
    runServerS0().then(value => console.log(JSON.stringify({ coverage: value.coverage, validation: value.validation, manifest: value.manifest, peakWorkingSetBytes: value.peakWorkingSetBytes }, null, 2))).catch(error => { console.error(error); process.exitCode = 1; });
//# sourceMappingURL=server-s0-run.js.map