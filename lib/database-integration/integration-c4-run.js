"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runIntegrationC4 = void 0;
const crypto_1 = require("crypto");
const fs_1 = require("fs");
const promises_1 = require("fs/promises");
const path_1 = require("path");
const zlib_1 = require("zlib");
const sqlite_readonly_adapter_1 = require("../database-experiment/sqlite-readonly-adapter");
const integration_c1_run_1 = require("./integration-c1-run");
const integration_c2_run_1 = require("./integration-c2-run");
const integration_c3_run_1 = require("./integration-c3-run");
const integration_c4_builder_1 = require("./integration-c4-builder");
const integration_c4_validator_1 = require("./integration-c4-validator");
const DEFAULT_DATABASE = "D:/Dokkan/database/decrypted/dokkan-global-current.db", DEFAULT_ELF = "D:/Dokkan/database/apk/extracted/lib/arm64-v8a/libcocos2dcpp.so", DEFAULT_EXPERIMENT = (0, path_1.resolve)(process.cwd(), "data", "database-experiment"), DEFAULT_PRODUCTION = "D:/Dokkan/DokkanWebScraper/data/fyi-characters/latest", MEMORY_LIMIT = 1024 * 1024 * 1024;
const sha256 = (value) => (0, crypto_1.createHash)("sha256").update(value).digest("hex");
let peakWorkingSetBytes = 0;
function observeMemory() { peakWorkingSetBytes = Math.max(peakWorkingSetBytes, process.memoryUsage().rss, process.resourceUsage().maxRSS * 1024); if (peakWorkingSetBytes > MEMORY_LIMIT)
    throw Error(`C4 memory limit exceeded: ${peakWorkingSetBytes}`); }
async function fingerprint(path) { const metadata = await (0, promises_1.stat)(path), hash = (0, crypto_1.createHash)("sha256"); await new Promise((done, reject) => { const stream = (0, fs_1.createReadStream)(path); stream.on("data", chunk => { hash.update(chunk); observeMemory(); }); stream.on("error", reject); stream.on("end", done); }); return { sha256: hash.digest("hex"), sizeBytes: metadata.size, modifiedAtMs: metadata.mtimeMs }; }
function baselinePath() { const adjacent = (0, path_1.resolve)(__dirname, "integration-c4-baseline.json"); return (0, fs_1.existsSync)(adjacent) ? adjacent : (0, path_1.resolve)(__dirname, "..", "..", "database-integration", "integration-c4-baseline.json"); }
async function elfFormat(path) { const handle = await (0, promises_1.open)(path, "r"); try {
    const bytes = Buffer.alloc(20);
    await handle.read(bytes, 0, bytes.length, 0);
    return { elfClass: bytes.subarray(0, 4).toString("hex") === "7f454c46" && bytes[4] === 2 ? 64 : 0, endian: bytes[5] === 1 ? "little" : "unknown", machine: bytes.readUInt16LE(18) };
}
finally {
    await handle.close();
} }
async function readSemanticInputs(inputDir) {
    const result = {};
    for (const gate of ["DB48", "DB49", "DB50"]) {
        const manifest = JSON.parse(await (0, promises_1.readFile)((0, path_1.resolve)(inputDir, `team-analysis-${gate.toLowerCase()}-manifest.json`), "utf8")), bytes = await (0, promises_1.readFile)((0, path_1.resolve)(inputDir, manifest.fileName));
        if (bytes.byteLength !== manifest.sizeBytes || sha256(bytes) !== manifest.sha256)
            throw Error(`C4 ${gate} artifact identity`);
        const json = (0, zlib_1.gunzipSync)(bytes);
        if (json.byteLength !== manifest.uncompressedSizeBytes)
            throw Error(`C4 ${gate} artifact uncompressed size`);
        const payload = JSON.parse(json.toString("utf8"));
        if (payload.schemaVersion !== 1 || payload.contractVersion !== manifest.contractVersion || payload.sourceDatabaseSha256 !== manifest.sourceDatabaseSha256 || payload.nativeRuntime?.sha256 !== manifest.nativeRuntimeSha256)
            throw Error(`C4 ${gate} payload lineage`);
        result[gate] = { contractVersion: payload.contractVersion, sha256: manifest.sha256, sourceDatabaseSha256: payload.sourceDatabaseSha256, nativeRuntimeSha256: payload.nativeRuntime.sha256 };
    }
    return result;
}
async function observe(databasePath, nativeRuntimePath, inputDir) {
    const [sourceDatabase, nativeRuntime, inspection, format, semanticInputs] = await Promise.all([fingerprint(databasePath), fingerprint(nativeRuntimePath), new sqlite_readonly_adapter_1.ReadOnlySqliteAdapter(databasePath).inspect(), elfFormat(nativeRuntimePath), readSemanticInputs(inputDir)]);
    observeMemory();
    return { sourceDatabase: { ...sourceDatabase, tableCount: inspection.tableCount, schemaSha256: (0, integration_c4_builder_1.integrationC4SchemaSha256)(inspection), inspection }, nativeRuntime: { ...nativeRuntime, ...format }, semanticInputs };
}
async function runIntegrationC4(options = {}) {
    peakWorkingSetBytes = 0;
    const databasePath = options.databasePath ?? DEFAULT_DATABASE, nativeRuntimePath = options.nativeRuntimePath ?? DEFAULT_ELF, inputDir = options.inputDir ?? DEFAULT_EXPERIMENT, outputDir = options.outputDir ?? DEFAULT_EXPERIMENT, productionDir = options.productionDir ?? DEFAULT_PRODUCTION;
    const baseline = JSON.parse(await (0, promises_1.readFile)(options.baselineFile ?? baselinePath(), "utf8"));
    if (baseline.schemaVersion !== 1 || baseline.contractVersion !== "1.0.0")
        throw Error("C4 baseline contract");
    const before = await observe(databasePath, nativeRuntimePath, inputDir), expectedReport = (0, integration_c4_builder_1.evaluateIntegrationC4Compatibility)(baseline, before), compatibilityText = `${JSON.stringify(expectedReport, null, 2)}\n`;
    await (0, promises_1.mkdir)(outputDir, { recursive: true });
    await (0, promises_1.writeFile)((0, path_1.resolve)(outputDir, "database-first-update-c4-compatibility.json"), compatibilityText);
    if (expectedReport.status === "incompatible") {
        const validation = (0, integration_c4_validator_1.validateIntegrationC4Artifacts)(expectedReport, (0, integration_c4_builder_1.evaluateIntegrationC4Compatibility)(baseline, before));
        if (!validation.valid)
            throw Error("C4 incompatibility validation");
        await (0, promises_1.writeFile)((0, path_1.resolve)(outputDir, "database-first-update-c4-validation.json"), `${JSON.stringify(validation, null, 2)}\n`);
        return { status: "incompatible", compatibility: expectedReport, validation, peakWorkingSetBytes };
    }
    const c1 = await (0, integration_c1_run_1.runIntegrationC1)({ inputDir, outputDir });
    observeMemory();
    const c2 = await (0, integration_c2_run_1.runIntegrationC2)({ inputDir: outputDir, outputDir });
    observeMemory();
    const c3 = await (0, integration_c3_run_1.runIntegrationC3)({ inputDir: outputDir, outputDir, productionDir });
    observeMemory();
    const afterDatabase = await fingerprint(databasePath), afterNative = await fingerprint(nativeRuntimePath);
    if (JSON.stringify(afterDatabase) !== JSON.stringify({ sha256: before.sourceDatabase.sha256, sizeBytes: before.sourceDatabase.sizeBytes, modifiedAtMs: before.sourceDatabase.modifiedAtMs }) || JSON.stringify(afterNative) !== JSON.stringify({ sha256: before.nativeRuntime.sha256, sizeBytes: before.nativeRuntime.sizeBytes, modifiedAtMs: before.nativeRuntime.modifiedAtMs }))
        throw Error("C4 read-only source guarantee");
    const compatibilityReportSha256 = sha256(compatibilityText), receipt = { schemaVersion: 1, contract: "dokkan-database-first-focused-refresh", contractVersion: "1.0.0", generatedAt: c1.manifest.generatedAt, snapshotVersion: baseline.snapshotVersion, mode: "focused_c1_c2_c3_no_db0_db50_replay", compatibilityReportSha256, inputs: { sourceDatabaseSha256: before.sourceDatabase.sha256, nativeRuntimeSha256: before.nativeRuntime.sha256, schemaSha256: before.sourceDatabase.schemaSha256, semanticArtifacts: { DB48: before.semanticInputs.DB48.sha256, DB49: before.semanticInputs.DB49.sha256, DB50: before.semanticInputs.DB50.sha256 } }, outputs: { c1Sha256: c1.manifest.sha256, c2Sha256: c2.manifest.sha256, c3Sha256: c3.manifest.sha256 }, readOnlySourceGuarantee: true };
    const expectation = { generatedAt: c1.manifest.generatedAt, snapshotVersion: baseline.snapshotVersion, compatibilityReportSha256, sourceDatabaseSha256: before.sourceDatabase.sha256, nativeRuntimeSha256: before.nativeRuntime.sha256, schemaSha256: before.sourceDatabase.schemaSha256, semanticArtifacts: { DB48: before.semanticInputs.DB48.sha256, DB49: before.semanticInputs.DB49.sha256, DB50: before.semanticInputs.DB50.sha256 }, c1Sha256: c1.manifest.sha256, c2Sha256: c2.manifest.sha256, c3Sha256: c3.manifest.sha256 };
    const validation = (0, integration_c4_validator_1.validateIntegrationC4Artifacts)(expectedReport, (0, integration_c4_builder_1.evaluateIntegrationC4Compatibility)(baseline, before), receipt, expectation), reportMutation = JSON.parse(JSON.stringify(expectedReport)), inputMutation = JSON.parse(JSON.stringify(receipt)), outputMutation = JSON.parse(JSON.stringify(receipt)), snapshotMutation = JSON.parse(JSON.stringify(receipt));
    reportMutation.status = "incompatible";
    inputMutation.inputs.sourceDatabaseSha256 = "0".repeat(64);
    outputMutation.outputs.c3Sha256 = "0".repeat(64);
    snapshotMutation.snapshotVersion = "changed";
    validation.mutationRejectionCount = [reportMutation, inputMutation, outputMutation, snapshotMutation].filter((value, index) => index === 0 ? !(0, integration_c4_validator_1.validateIntegrationC4Artifacts)(value, expectedReport, receipt, expectation).valid : !(0, integration_c4_validator_1.validateIntegrationC4Artifacts)(expectedReport, expectedReport, value, expectation).valid).length;
    if (!validation.valid || validation.mutationRejectionCount !== 4)
        throw Error(`C4 validation ${JSON.stringify(validation.failures)}`);
    const receiptText = `${JSON.stringify(receipt, null, 2)}\n`;
    const manifest = { schemaVersion: 1, contractVersion: "1.0.0", generatedAt: receipt.generatedAt, fileName: "database-first-update-c4-receipt.json", sha256: sha256(receiptText), sizeBytes: Buffer.byteLength(receiptText), compatibilityFile: "database-first-update-c4-compatibility.json" };
    await Promise.all([(0, promises_1.writeFile)((0, path_1.resolve)(outputDir, manifest.fileName), receiptText), (0, promises_1.writeFile)((0, path_1.resolve)(outputDir, "database-first-update-c4-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`), (0, promises_1.writeFile)((0, path_1.resolve)(outputDir, "database-first-update-c4-validation.json"), `${JSON.stringify(validation, null, 2)}\n`)]);
    observeMemory();
    return { status: "compatible", manifest, compatibility: expectedReport, validation, outputs: receipt.outputs, peakWorkingSetBytes };
}
exports.runIntegrationC4 = runIntegrationC4;
if (require.main === module)
    runIntegrationC4().then(value => console.log(JSON.stringify(value, null, 2))).catch(error => { console.error(error); process.exitCode = 1; });
//# sourceMappingURL=integration-c4-run.js.map