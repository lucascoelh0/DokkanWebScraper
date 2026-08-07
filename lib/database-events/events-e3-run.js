"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runEventsE3 = void 0;
const crypto_1 = require("crypto");
const fs_1 = require("fs");
const promises_1 = require("fs/promises");
const path_1 = require("path");
const events_e3_builder_1 = require("./events-e3-builder");
const events_e3_validator_1 = require("./events-e3-validator");
const events_sqlite_adapter_1 = require("./events-sqlite-adapter");
const DEFAULT_DATABASE = "D:/Dokkan/database/decrypted/dokkan-global-current.db", DEFAULT_OUTPUT = (0, path_1.resolve)(process.cwd(), "data", "database-events"), MEMORY_LIMIT = 1024 * 1024 * 1024;
let peakWorkingSetBytes = 0;
function memory() { peakWorkingSetBytes = Math.max(peakWorkingSetBytes, process.memoryUsage().rss, process.resourceUsage().maxRSS * 1024); if (peakWorkingSetBytes > MEMORY_LIMIT)
    throw Error(`E3 memory limit exceeded ${peakWorkingSetBytes}`); }
const sha = (value) => (0, crypto_1.createHash)("sha256").update(value).digest("hex");
async function fingerprint(path) { const metadata = await (0, promises_1.stat)(path), hash = (0, crypto_1.createHash)("sha256"); await new Promise((done, reject) => { const stream = (0, fs_1.createReadStream)(path); stream.on("data", chunk => { hash.update(chunk); memory(); }); stream.on("error", reject); stream.on("end", done); }); return { sha256: hash.digest("hex"), sizeBytes: metadata.size, modifiedAtMs: metadata.mtimeMs }; }
function sourcePath(name) { const adjacent = (0, path_1.resolve)(__dirname, name); return (0, fs_1.existsSync)(adjacent) ? adjacent : (0, path_1.resolve)(__dirname, "..", "..", "database-events", name); }
async function runEventsE3(options = {}) {
    peakWorkingSetBytes = 0;
    const databasePath = (0, path_1.resolve)(options.databasePath ?? DEFAULT_DATABASE), outputDir = (0, path_1.resolve)(options.outputDir ?? DEFAULT_OUTPUT), e2Dir = (0, path_1.resolve)(options.e2Dir ?? DEFAULT_OUTPUT);
    const baseline = JSON.parse(await (0, promises_1.readFile)(sourcePath("events-e0-baseline.json"), "utf8")), e3Baseline = JSON.parse(await (0, promises_1.readFile)(sourcePath("events-e3-baseline.json"), "utf8")), e2Manifest = JSON.parse(await (0, promises_1.readFile)((0, path_1.resolve)(e2Dir, "events-e2-manifest.json"), "utf8"));
    const [e2Bytes, coverageBytes, validationBytes] = await Promise.all([(0, promises_1.readFile)((0, path_1.resolve)(e2Dir, e2Manifest.fileName)), (0, promises_1.readFile)((0, path_1.resolve)(e2Dir, e2Manifest.coverage.fileName)), (0, promises_1.readFile)((0, path_1.resolve)(e2Dir, e2Manifest.validation.fileName))]);
    memory();
    const e2 = JSON.parse(e2Bytes.toString("utf8")), e2Coverage = JSON.parse(coverageBytes.toString("utf8")), e2Validation = JSON.parse(validationBytes.toString("utf8"));
    if (e3Baseline.snapshotVersion !== baseline.snapshotVersion || e3Baseline.sourceE2Sha256 !== e2Manifest.sha256 || e2Manifest.contractVersion !== "0.3.0" || e2Manifest.generatedAtPolicy !== "pinned_to_source_snapshot_for_reproducible_bytes" || e2Manifest.generatedAt !== baseline.generatedAt || e2Manifest.sourceSnapshotVersion !== baseline.snapshotVersion || e2Manifest.sourceDatabaseSha256 !== baseline.sourceDatabase.sha256 || e2Bytes.byteLength !== e2Manifest.sizeBytes || sha(e2Bytes) !== e2Manifest.sha256 || coverageBytes.byteLength !== e2Manifest.coverage.sizeBytes || sha(coverageBytes) !== e2Manifest.coverage.sha256 || validationBytes.byteLength !== e2Manifest.validation.sizeBytes || sha(validationBytes) !== e2Manifest.validation.sha256 || e2.contract !== "dokkan-events-database-first-topology" || e2.contractVersion !== "0.3.0" || e2.generatedAt !== baseline.generatedAt || e2.generatedAtPolicy !== "pinned_to_source_snapshot_for_reproducible_bytes" || e2.sourceSnapshotVersion !== baseline.snapshotVersion || e2.sourceDatabaseSha256 !== baseline.sourceDatabase.sha256 || e2Coverage.danglingIdCount !== 0 || !e2Validation.valid || !e2Validation.exactProjection)
        throw Error("E3 E2 lineage");
    const before = await fingerprint(databasePath);
    if (before.sha256 !== baseline.sourceDatabase.sha256 || before.sizeBytes !== baseline.sourceDatabase.sizeBytes)
        throw Error("E3 pinned database identity");
    const observation = await (0, events_sqlite_adapter_1.runEventsSqliteBridge)("encounters", databasePath, memory);
    memory();
    const dataset = (0, events_e3_builder_1.buildEventsE3Dataset)({ observation, generatedAt: baseline.generatedAt, sourceSnapshotVersion: baseline.snapshotVersion, sourceDatabaseSha256: before.sha256, sourceE2Sha256: e2Manifest.sha256 }), coverage = (0, events_e3_builder_1.buildEventsE3Coverage)(dataset, e2), goldens = (0, events_e3_builder_1.buildEventsE3Goldens)(dataset), validation = (0, events_e3_validator_1.validateEventsE3Dataset)(dataset, observation, e2, goldens, e3Baseline.goldens, { generatedAt: baseline.generatedAt, sourceSnapshotVersion: baseline.snapshotVersion, sourceDatabaseSha256: before.sha256, sourceE2Sha256: e2Manifest.sha256 });
    if (!validation.valid || coverage.danglingIdCount !== 0)
        throw Error(`E3 validation ${JSON.stringify(validation.failures)} dangling=${coverage.danglingIdCount}`);
    const after = await fingerprint(databasePath);
    if (JSON.stringify(before) !== JSON.stringify(after))
        throw Error("E3 read-only source guarantee");
    const payloadText = `${JSON.stringify(dataset, null, 2)}\n`, coverageText = `${JSON.stringify(coverage, null, 2)}\n`, validationText = `${JSON.stringify(validation, null, 2)}\n`, goldensText = `${JSON.stringify(goldens, null, 2)}\n`;
    const manifest = { schemaVersion: 1, contractVersion: "0.4.0", generatedAt: dataset.generatedAt, generatedAtPolicy: dataset.generatedAtPolicy, sourceSnapshotVersion: dataset.sourceSnapshotVersion, fileName: "events-e3-encounters.json", compression: "none", sha256: sha(payloadText), sizeBytes: Buffer.byteLength(payloadText), sourceDatabaseSha256: dataset.sourceDatabaseSha256, sourceE2Sha256: dataset.sourceE2.sha256, coverage: { fileName: "events-e3-coverage.json", sha256: sha(coverageText), sizeBytes: Buffer.byteLength(coverageText) }, validation: { fileName: "events-e3-validation.json", sha256: sha(validationText), sizeBytes: Buffer.byteLength(validationText) }, goldens: { fileName: "events-e3-goldens.json", sha256: sha(goldensText), sizeBytes: Buffer.byteLength(goldensText) } };
    await (0, promises_1.mkdir)(outputDir, { recursive: true });
    await Promise.all([(0, promises_1.writeFile)((0, path_1.resolve)(outputDir, manifest.fileName), payloadText), (0, promises_1.writeFile)((0, path_1.resolve)(outputDir, manifest.coverage.fileName), coverageText), (0, promises_1.writeFile)((0, path_1.resolve)(outputDir, manifest.validation.fileName), validationText), (0, promises_1.writeFile)((0, path_1.resolve)(outputDir, manifest.goldens.fileName), goldensText), (0, promises_1.writeFile)((0, path_1.resolve)(outputDir, "events-e3-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`)]);
    memory();
    return { dataset, coverage, validation, goldens, manifest, peakWorkingSetBytes };
}
exports.runEventsE3 = runEventsE3;
if (require.main === module)
    runEventsE3().then(value => console.log(JSON.stringify({ coverage: value.coverage, validation: value.validation, goldens: value.goldens.representatives.map(item => ({ kind: item.kind, sourceId: item.sourceId })), manifest: value.manifest, peakWorkingSetBytes: value.peakWorkingSetBytes }, null, 2))).catch(error => { console.error(error); process.exitCode = 1; });
//# sourceMappingURL=events-e3-run.js.map