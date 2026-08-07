"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runIntegrationC1 = void 0;
const crypto_1 = require("crypto");
const promises_1 = require("fs/promises");
const path_1 = require("path");
const zlib_1 = require("zlib");
const integration_c1_builder_1 = require("./integration-c1-builder");
const integration_c1_validator_1 = require("./integration-c1-validator");
const DEFAULT_INPUT = (0, path_1.resolve)(process.cwd(), "data", "database-experiment");
const DEFAULT_OUTPUT = (0, path_1.resolve)(process.cwd(), "data", "database-experiment");
const sha256 = (value) => (0, crypto_1.createHash)("sha256").update(value).digest("hex");
async function readSource(root, gate) {
    const manifest = JSON.parse(await (0, promises_1.readFile)((0, path_1.resolve)(root, `team-analysis-${gate}-manifest.json`), "utf8")), gzip = await (0, promises_1.readFile)((0, path_1.resolve)(root, manifest.fileName));
    if (manifest.schemaVersion !== 1 || manifest.compression !== "gzip" || manifest.sha256 !== sha256(gzip) || manifest.sizeBytes !== gzip.byteLength)
        throw Error(`C1 invalid ${gate.toUpperCase()} artifact`);
    const json = (0, zlib_1.gunzipSync)(gzip);
    if (manifest.uncompressedSizeBytes !== json.byteLength)
        throw Error(`C1 invalid ${gate.toUpperCase()} uncompressed size`);
    return { dataset: JSON.parse(json.toString("utf8")), gzip, sha256: sha256(gzip), manifest };
}
async function runIntegrationC1(options = {}) {
    const inputDir = options.inputDir ?? DEFAULT_INPUT, outputDir = options.outputDir ?? DEFAULT_OUTPUT;
    const db48 = await readSource(inputDir, "db48"), db49 = await readSource(inputDir, "db49"), db50 = await readSource(inputDir, "db50");
    const sources = { db48: db48.dataset, db48Sha256: db48.sha256, db49: db49.dataset, db49Sha256: db49.sha256, db50: db50.dataset, db50Sha256: db50.sha256 };
    const build = () => (0, integration_c1_builder_1.buildIntegrationC1Dataset)(sources), dataset = build(), firstJson = `${JSON.stringify(dataset)}\n`, secondJson = `${JSON.stringify(build())}\n`, firstGzip = (0, zlib_1.gzipSync)(Buffer.from(firstJson), { level: 9 }), secondGzip = (0, zlib_1.gzipSync)(Buffer.from(secondJson), { level: 9 });
    if (sha256(firstJson) !== sha256(secondJson) || !firstGzip.equals(secondGzip))
        throw Error("C1 deterministic rebuild failed");
    const validation = (0, integration_c1_validator_1.validateIntegrationC1Dataset)(dataset, sources);
    if (!validation.valid)
        throw Error(`C1 validation failed: ${JSON.stringify(validation.failures.slice(0, 10))}`);
    const coverage = (0, integration_c1_builder_1.buildIntegrationC1Coverage)(dataset);
    if (coverage.duplicateIdentityCount !== 0 || coverage.ruleCount !== validation.losslessRawTupleCount)
        throw Error("C1 coverage integrity failed");
    const manifest = { schemaVersion: 1, contractVersion: "1.0.0", generatedAt: dataset.generatedAt, fileName: "team-analysis-database-first-sidecar-c1.json.gz", compression: "gzip", sha256: sha256(firstGzip), sizeBytes: firstGzip.byteLength, uncompressedSizeBytes: Buffer.byteLength(firstJson), ruleCount: coverage.ruleCount, stateCount: coverage.stateCount, sourceSnapshotVersion: dataset.sourceSnapshotVersion, sourceDatabaseSha256: dataset.sourceDatabaseSha256, nativeRuntimeSha256: dataset.nativeRuntimeSha256, sourceArtifacts: dataset.sources.map(value => ({ gate: value.gate, sha256: value.sha256 })), coverageFile: "team-analysis-database-first-sidecar-c1-coverage.json", validationFile: "team-analysis-database-first-sidecar-c1-validation.json" };
    await (0, promises_1.mkdir)(outputDir, { recursive: true });
    await Promise.all([(0, promises_1.writeFile)((0, path_1.resolve)(outputDir, manifest.fileName), firstGzip), (0, promises_1.writeFile)((0, path_1.resolve)(outputDir, "team-analysis-database-first-sidecar-c1-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`), (0, promises_1.writeFile)((0, path_1.resolve)(outputDir, manifest.coverageFile), `${JSON.stringify(coverage, null, 2)}\n`), (0, promises_1.writeFile)((0, path_1.resolve)(outputDir, manifest.validationFile), `${JSON.stringify(validation, null, 2)}\n`)]);
    return { manifest, coverage, validation, deterministicJsonSha256: sha256(secondJson) };
}
exports.runIntegrationC1 = runIntegrationC1;
if (require.main === module)
    runIntegrationC1().then(value => console.log(JSON.stringify(value, null, 2))).catch(error => { console.error(error); process.exitCode = 1; });
//# sourceMappingURL=integration-c1-run.js.map