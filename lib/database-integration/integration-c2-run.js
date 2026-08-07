"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runIntegrationC2 = void 0;
const crypto_1 = require("crypto");
const promises_1 = require("fs/promises");
const path_1 = require("path");
const zlib_1 = require("zlib");
const integration_c2_builder_1 = require("./integration-c2-builder");
const integration_c2_validator_1 = require("./integration-c2-validator");
const DEFAULT_ROOT = (0, path_1.resolve)(process.cwd(), "data", "database-experiment"), sha256 = (value) => (0, crypto_1.createHash)("sha256").update(value).digest("hex");
async function runIntegrationC2(options = {}) {
    const inputDir = options.inputDir ?? DEFAULT_ROOT, outputDir = options.outputDir ?? DEFAULT_ROOT, manifest = JSON.parse(await (0, promises_1.readFile)((0, path_1.resolve)(inputDir, "team-analysis-database-first-sidecar-c1-manifest.json"), "utf8")), gzip = await (0, promises_1.readFile)((0, path_1.resolve)(inputDir, manifest.fileName));
    if (manifest.schemaVersion !== 1 || manifest.contractVersion !== "1.0.0" || manifest.sha256 !== sha256(gzip) || manifest.sizeBytes !== gzip.byteLength)
        throw Error("C2 invalid C1 artifact");
    const json = (0, zlib_1.gunzipSync)(gzip);
    if (manifest.uncompressedSizeBytes !== json.byteLength)
        throw Error("C2 invalid C1 uncompressed size");
    const source = JSON.parse(json.toString("utf8")), sourceSha256 = sha256(gzip);
    const build = () => (0, integration_c2_builder_1.buildIntegrationC2Dataset)(source, sourceSha256), dataset = build(), firstJson = `${JSON.stringify(dataset)}\n`, secondJson = `${JSON.stringify(build())}\n`, firstGzip = (0, zlib_1.gzipSync)(Buffer.from(firstJson), { level: 9 }), secondGzip = (0, zlib_1.gzipSync)(Buffer.from(secondJson), { level: 9 });
    if (sha256(firstJson) !== sha256(secondJson) || !firstGzip.equals(secondGzip))
        throw Error("C2 deterministic rebuild failed");
    const validation = (0, integration_c2_validator_1.validateIntegrationC2Dataset)(dataset, source, sourceSha256);
    if (!validation.valid)
        throw Error(`C2 validation failed: ${JSON.stringify(validation.failures.slice(0, 10))}`);
    const coverage = (0, integration_c2_builder_1.buildIntegrationC2Coverage)(dataset, source);
    if (coverage.forbiddenFieldCount !== 0 || coverage.omittedRuleCount !== 0)
        throw Error("C2 supported-only coverage failed");
    const outputManifest = { schemaVersion: 1, contractVersion: "1.0.0", generatedAt: dataset.generatedAt, fileName: "team-analysis-database-first-supported-c2.json.gz", compression: "gzip", sha256: sha256(firstGzip), sizeBytes: firstGzip.byteLength, uncompressedSizeBytes: Buffer.byteLength(firstJson), ruleCount: dataset.rules.length, stateCount: coverage.stateCount, sourceSnapshotVersion: dataset.sourceSnapshotVersion, sourceAuditSidecarSha256: sourceSha256, coverageFile: "team-analysis-database-first-supported-c2-coverage.json", validationFile: "team-analysis-database-first-supported-c2-validation.json" };
    await (0, promises_1.mkdir)(outputDir, { recursive: true });
    await Promise.all([(0, promises_1.writeFile)((0, path_1.resolve)(outputDir, outputManifest.fileName), firstGzip), (0, promises_1.writeFile)((0, path_1.resolve)(outputDir, "team-analysis-database-first-supported-c2-manifest.json"), `${JSON.stringify(outputManifest, null, 2)}\n`), (0, promises_1.writeFile)((0, path_1.resolve)(outputDir, outputManifest.coverageFile), `${JSON.stringify(coverage, null, 2)}\n`), (0, promises_1.writeFile)((0, path_1.resolve)(outputDir, outputManifest.validationFile), `${JSON.stringify(validation, null, 2)}\n`)]);
    return { manifest: outputManifest, coverage, validation, deterministicJsonSha256: sha256(secondJson) };
}
exports.runIntegrationC2 = runIntegrationC2;
if (require.main === module)
    runIntegrationC2().then(value => console.log(JSON.stringify(value, null, 2))).catch(error => { console.error(error); process.exitCode = 1; });
//# sourceMappingURL=integration-c2-run.js.map