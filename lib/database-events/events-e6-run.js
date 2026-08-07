"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runEventsE6 = void 0;
const crypto_1 = require("crypto");
const fs_1 = require("fs");
const promises_1 = require("fs/promises");
const path_1 = require("path");
const events_apk_adapter_1 = require("./events-apk-adapter");
const events_e6_builder_1 = require("./events-e6-builder");
const events_e6_validator_1 = require("./events-e6-validator");
const events_sqlite_adapter_1 = require("./events-sqlite-adapter");
const DEFAULT_DATABASE = "D:/Dokkan/database/decrypted/dokkan-global-current.db", DEFAULT_APK = "D:/Dokkan/database/apk/dokkan-global-base.apk", DEFAULT_OUTPUT = (0, path_1.resolve)(process.cwd(), "data", "database-events"), MEMORY_LIMIT = 1024 * 1024 * 1024;
let peakWorkingSetBytes = 0;
function memory() { peakWorkingSetBytes = Math.max(peakWorkingSetBytes, process.memoryUsage().rss, process.resourceUsage().maxRSS * 1024); if (peakWorkingSetBytes > MEMORY_LIMIT)
    throw Error(`E6 memory limit exceeded ${peakWorkingSetBytes}`); }
const sha = (value) => (0, crypto_1.createHash)("sha256").update(value).digest("hex");
async function fingerprint(path) { const metadata = await (0, promises_1.stat)(path), hash = (0, crypto_1.createHash)("sha256"); await new Promise((done, reject) => { const stream = (0, fs_1.createReadStream)(path); stream.on("data", chunk => { hash.update(chunk); memory(); }); stream.on("error", reject); stream.on("end", done); }); return { sha256: hash.digest("hex"), sizeBytes: metadata.size, modifiedAtMs: metadata.mtimeMs }; }
function sourcePath(name) { const adjacent = (0, path_1.resolve)(__dirname, name); return (0, fs_1.existsSync)(adjacent) ? adjacent : (0, path_1.resolve)(__dirname, "..", "..", "database-events", name); }
function verifyBytes(bytes, expected, label) { if (bytes.byteLength !== expected.sizeBytes || sha(bytes) !== expected.sha256)
    throw Error(`E6 ${label} artifact identity`); }
async function runEventsE6(options = {}) {
    peakWorkingSetBytes = 0;
    const databasePath = (0, path_1.resolve)(options.databasePath ?? DEFAULT_DATABASE), apkPath = (0, path_1.resolve)(options.apkPath ?? DEFAULT_APK), outputDir = (0, path_1.resolve)(options.outputDir ?? DEFAULT_OUTPUT), e5Dir = (0, path_1.resolve)(options.e5Dir ?? DEFAULT_OUTPUT);
    const baseline = JSON.parse(await (0, promises_1.readFile)(sourcePath("events-e0-baseline.json"), "utf8")), apkBaselineBytes = await (0, promises_1.readFile)(sourcePath("events-e6-apk-baseline.json")), apkBaseline = JSON.parse(apkBaselineBytes.toString("utf8")), apkBaselineSha256 = sha(apkBaselineBytes);
    const e5Manifest = JSON.parse(await (0, promises_1.readFile)((0, path_1.resolve)(e5Dir, "events-e5-manifest.json"), "utf8"));
    const [e5Fingerprint, e5CoverageBytes, e5ValidationBytes] = await Promise.all([fingerprint((0, path_1.resolve)(e5Dir, e5Manifest.fileName)), (0, promises_1.readFile)((0, path_1.resolve)(e5Dir, e5Manifest.coverage.fileName)), (0, promises_1.readFile)((0, path_1.resolve)(e5Dir, e5Manifest.validation.fileName))]);
    memory();
    verifyBytes(e5CoverageBytes, e5Manifest.coverage, "E5 coverage");
    verifyBytes(e5ValidationBytes, e5Manifest.validation, "E5 validation");
    const e5Coverage = JSON.parse(e5CoverageBytes.toString("utf8")), e5Validation = JSON.parse(e5ValidationBytes.toString("utf8"));
    if (e5Manifest.contractVersion !== "0.6.0" || e5Manifest.generatedAtPolicy !== "pinned_to_source_snapshot_for_reproducible_bytes" || e5Manifest.generatedAt !== baseline.generatedAt || e5Manifest.sourceSnapshotVersion !== baseline.snapshotVersion || e5Manifest.sourceDatabaseSha256 !== baseline.sourceDatabase.sha256 || e5Fingerprint.sha256 !== e5Manifest.sha256 || e5Fingerprint.sizeBytes !== e5Manifest.sizeBytes || e5Coverage.danglingIdCount !== 0 || !e5Validation.valid || !e5Validation.exactProjection)
        throw Error("E6 E5 lineage");
    const databaseBefore = await fingerprint(databasePath), apkBefore = await fingerprint(apkPath);
    if (databaseBefore.sha256 !== baseline.sourceDatabase.sha256 || databaseBefore.sizeBytes !== baseline.sourceDatabase.sizeBytes || apkBefore.sha256 !== apkBaseline.sourceApk.sha256 || apkBefore.sizeBytes !== apkBaseline.sourceApk.sizeBytes)
        throw Error("E6 pinned source identity");
    const observation = await (0, events_sqlite_adapter_1.runEventsSqliteBridge)("assets", databasePath, memory), apk = await (0, events_apk_adapter_1.runEventsApkBridge)(apkPath, memory);
    memory();
    const apkBaselineValid = (0, events_e6_validator_1.validateEventsE6ApkBaseline)(apkBaseline, apk, apkBefore.sha256, apkBefore.sizeBytes);
    if (!apkBaselineValid)
        throw Error("E6 APK baseline");
    const lineage = { generatedAt: baseline.generatedAt, sourceSnapshotVersion: baseline.snapshotVersion, sourceDatabaseSha256: databaseBefore.sha256, sourceE5Sha256: e5Manifest.sha256, sourceApkSha256: apkBefore.sha256, sourceApkSizeBytes: apkBefore.sizeBytes };
    const dataset = (0, events_e6_builder_1.buildEventsE6Dataset)({ observation, apk, ...lineage }), coverage = (0, events_e6_builder_1.buildEventsE6Coverage)(dataset, observation), validation = (0, events_e6_validator_1.validateEventsE6Dataset)(dataset, observation, apk, apkBaseline, apkBaselineValid, lineage);
    if (!validation.valid || coverage.danglingIdCount !== 0)
        throw Error(`E6 validation ${JSON.stringify(validation.failures)} dangling=${coverage.danglingIdCount}`);
    const databaseAfter = await fingerprint(databasePath), apkAfter = await fingerprint(apkPath);
    if (JSON.stringify(databaseBefore) !== JSON.stringify(databaseAfter) || JSON.stringify(apkBefore) !== JSON.stringify(apkAfter))
        throw Error("E6 read-only source guarantee");
    const payloadText = `${JSON.stringify(dataset, null, 2)}\n`, coverageText = `${JSON.stringify(coverage, null, 2)}\n`, validationText = `${JSON.stringify(validation, null, 2)}\n`;
    const manifest = { schemaVersion: 1, contractVersion: "0.7.0", generatedAt: dataset.generatedAt, generatedAtPolicy: dataset.generatedAtPolicy, sourceSnapshotVersion: dataset.sourceSnapshotVersion, fileName: "events-e6-assets.json", compression: "none", sha256: sha(payloadText), sizeBytes: Buffer.byteLength(payloadText), sourceDatabaseSha256: dataset.sourceDatabaseSha256, sourceE5Sha256: dataset.sourceE5.sha256, sourceApkSha256: dataset.sourceApk.sha256, sourceApkSizeBytes: dataset.sourceApk.sizeBytes, apkBaselineSha256, coverage: { fileName: "events-e6-coverage.json", sha256: sha(coverageText), sizeBytes: Buffer.byteLength(coverageText) }, validation: { fileName: "events-e6-validation.json", sha256: sha(validationText), sizeBytes: Buffer.byteLength(validationText) } };
    await (0, promises_1.mkdir)(outputDir, { recursive: true });
    await Promise.all([(0, promises_1.writeFile)((0, path_1.resolve)(outputDir, manifest.fileName), payloadText), (0, promises_1.writeFile)((0, path_1.resolve)(outputDir, manifest.coverage.fileName), coverageText), (0, promises_1.writeFile)((0, path_1.resolve)(outputDir, manifest.validation.fileName), validationText), (0, promises_1.writeFile)((0, path_1.resolve)(outputDir, "events-e6-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`)]);
    memory();
    return { dataset, coverage, validation, manifest, peakWorkingSetBytes };
}
exports.runEventsE6 = runEventsE6;
if (require.main === module)
    runEventsE6().then(value => console.log(JSON.stringify({ coverage: value.coverage, validation: value.validation, manifest: value.manifest, peakWorkingSetBytes: value.peakWorkingSetBytes }, null, 2))).catch(error => { console.error(error); process.exitCode = 1; });
//# sourceMappingURL=events-e6-run.js.map