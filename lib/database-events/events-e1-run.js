"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runEventsE1 = void 0;
const crypto_1 = require("crypto");
const fs_1 = require("fs");
const promises_1 = require("fs/promises");
const path_1 = require("path");
const events_e1_builder_1 = require("./events-e1-builder");
const events_sqlite_adapter_1 = require("./events-sqlite-adapter");
const events_e1_validator_1 = require("./events-e1-validator");
const DEFAULT_DATABASE = "D:/Dokkan/database/decrypted/dokkan-global-current.db", DEFAULT_OUTPUT = (0, path_1.resolve)(process.cwd(), "data", "database-events"), MEMORY_LIMIT = 1024 * 1024 * 1024;
let peakWorkingSetBytes = 0;
function memory() { peakWorkingSetBytes = Math.max(peakWorkingSetBytes, process.memoryUsage().rss, process.resourceUsage().maxRSS * 1024); if (peakWorkingSetBytes > MEMORY_LIMIT)
    throw Error(`E1 memory limit exceeded ${peakWorkingSetBytes}`); }
async function fingerprint(path) { const metadata = await (0, promises_1.stat)(path), hash = (0, crypto_1.createHash)("sha256"); await new Promise((done, reject) => { const stream = (0, fs_1.createReadStream)(path); stream.on("data", chunk => { hash.update(chunk); memory(); }); stream.on("error", reject); stream.on("end", done); }); return { sha256: hash.digest("hex"), sizeBytes: metadata.size, modifiedAtMs: metadata.mtimeMs }; }
function sourcePath(name) { const adjacent = (0, path_1.resolve)(__dirname, name); return require("fs").existsSync(adjacent) ? adjacent : (0, path_1.resolve)(__dirname, "..", "..", "database-events", name); }
async function runEventsE1(options = {}) {
    peakWorkingSetBytes = 0;
    const databasePath = (0, path_1.resolve)(options.databasePath ?? DEFAULT_DATABASE), outputDir = (0, path_1.resolve)(options.outputDir ?? DEFAULT_OUTPUT), e0Dir = (0, path_1.resolve)(options.e0Dir ?? DEFAULT_OUTPUT);
    const baseline = JSON.parse(await (0, promises_1.readFile)(sourcePath("events-e0-baseline.json"), "utf8")), e0Manifest = JSON.parse(await (0, promises_1.readFile)((0, path_1.resolve)(e0Dir, "events-e0-manifest.json"), "utf8"));
    const [e0Bytes, e0CoverageBytes, e0ValidationBytes] = await Promise.all([(0, promises_1.readFile)((0, path_1.resolve)(e0Dir, e0Manifest.fileName)), (0, promises_1.readFile)((0, path_1.resolve)(e0Dir, e0Manifest.coverage.fileName)), (0, promises_1.readFile)((0, path_1.resolve)(e0Dir, e0Manifest.validation.fileName))]);
    const sha = (value) => (0, crypto_1.createHash)("sha256").update(value).digest("hex");
    const e0 = JSON.parse(e0Bytes.toString("utf8")), e0Coverage = JSON.parse(e0CoverageBytes.toString("utf8")), e0Validation = JSON.parse(e0ValidationBytes.toString("utf8"));
    if (e0Manifest.contractVersion !== "0.1.0" || e0Manifest.generatedAtPolicy !== "pinned_to_source_snapshot_for_reproducible_bytes" || e0Manifest.generatedAt !== baseline.generatedAt || e0Manifest.sourceSnapshotVersion !== baseline.snapshotVersion || e0Bytes.byteLength !== e0Manifest.sizeBytes || sha(e0Bytes) !== e0Manifest.sha256 || e0CoverageBytes.byteLength !== e0Manifest.coverage.sizeBytes || sha(e0CoverageBytes) !== e0Manifest.coverage.sha256 || e0ValidationBytes.byteLength !== e0Manifest.validation.sizeBytes || sha(e0ValidationBytes) !== e0Manifest.validation.sha256 || e0.contract !== "dokkan-events-database-first-inventory" || e0.contractVersion !== "0.1.0" || e0.sourceSnapshotVersion !== baseline.snapshotVersion || e0.sourceDatabase.sha256 !== baseline.sourceDatabase.sha256 || e0.sourceDatabase.schemaSha256 !== baseline.sourceDatabase.schemaSha256 || e0.tables.length !== baseline.sourceDatabase.tableCount || e0Coverage.tableCount !== e0.tables.length || !e0Validation.valid || e0Validation.losslessTableCount !== e0.tables.length)
        throw Error("E1 E0 lineage");
    const before = await fingerprint(databasePath);
    if (before.sha256 !== baseline.sourceDatabase.sha256 || before.sizeBytes !== baseline.sourceDatabase.sizeBytes)
        throw Error("E1 pinned database identity");
    const observation = await (0, events_sqlite_adapter_1.runEventsSqliteBridge)("catalog", databasePath, memory);
    memory();
    const dataset = (0, events_e1_builder_1.buildEventsE1Dataset)({ observation, generatedAt: baseline.generatedAt, sourceSnapshotVersion: baseline.snapshotVersion, sourceDatabaseSha256: before.sha256, sourceE0Sha256: e0Manifest.sha256 }), coverage = (0, events_e1_builder_1.buildEventsE1Coverage)(dataset), validation = (0, events_e1_validator_1.validateEventsE1Dataset)(dataset, observation, { generatedAt: baseline.generatedAt, sourceSnapshotVersion: baseline.snapshotVersion, sourceDatabaseSha256: before.sha256, sourceE0Sha256: e0Manifest.sha256 });
    if (!validation.valid)
        throw Error(`E1 validation ${JSON.stringify(validation.failures)}`);
    const after = await fingerprint(databasePath);
    if (JSON.stringify(before) !== JSON.stringify(after))
        throw Error("E1 read-only source guarantee");
    const payloadText = `${JSON.stringify(dataset, null, 2)}\n`, coverageText = `${JSON.stringify(coverage, null, 2)}\n`, validationText = `${JSON.stringify(validation, null, 2)}\n`, manifest = { schemaVersion: 1, contractVersion: "0.2.0", generatedAt: dataset.generatedAt, generatedAtPolicy: dataset.generatedAtPolicy, sourceSnapshotVersion: dataset.sourceSnapshotVersion, fileName: "events-e1-catalog.json", compression: "none", sha256: sha(payloadText), sizeBytes: Buffer.byteLength(payloadText), entityCount: dataset.catalog.length, sourceDatabaseSha256: dataset.sourceDatabaseSha256, sourceE0Sha256: dataset.sourceE0.sha256, coverage: { fileName: "events-e1-coverage.json", sha256: sha(coverageText), sizeBytes: Buffer.byteLength(coverageText) }, validation: { fileName: "events-e1-validation.json", sha256: sha(validationText), sizeBytes: Buffer.byteLength(validationText) } };
    await (0, promises_1.mkdir)(outputDir, { recursive: true });
    await Promise.all([(0, promises_1.writeFile)((0, path_1.resolve)(outputDir, manifest.fileName), payloadText), (0, promises_1.writeFile)((0, path_1.resolve)(outputDir, manifest.coverage.fileName), coverageText), (0, promises_1.writeFile)((0, path_1.resolve)(outputDir, manifest.validation.fileName), validationText), (0, promises_1.writeFile)((0, path_1.resolve)(outputDir, "events-e1-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`)]);
    memory();
    return { dataset, coverage, validation, manifest, peakWorkingSetBytes };
}
exports.runEventsE1 = runEventsE1;
if (require.main === module)
    runEventsE1().then(value => console.log(JSON.stringify({ coverage: value.coverage, validation: value.validation, manifest: value.manifest, peakWorkingSetBytes: value.peakWorkingSetBytes }, null, 2))).catch(error => { console.error(error); process.exitCode = 1; });
//# sourceMappingURL=events-e1-run.js.map