"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runEventsE5 = void 0;
const crypto_1 = require("crypto");
const fs_1 = require("fs");
const promises_1 = require("fs/promises");
const path_1 = require("path");
const events_artifact_path_1 = require("./events-artifact-path");
const events_e5_builder_1 = require("./events-e5-builder");
const events_e5_validator_1 = require("./events-e5-validator");
const events_sqlite_adapter_1 = require("./events-sqlite-adapter");
const DEFAULT_DATABASE = "D:/Dokkan/database/decrypted/dokkan-global-current.db", DEFAULT_OUTPUT = (0, path_1.resolve)(process.cwd(), "data", "database-events"), MEMORY_LIMIT = 1024 * 1024 * 1024;
let peakWorkingSetBytes = 0;
function memory() { peakWorkingSetBytes = Math.max(peakWorkingSetBytes, process.memoryUsage().rss, process.resourceUsage().maxRSS * 1024); if (peakWorkingSetBytes > MEMORY_LIMIT)
    throw Error(`E5 memory limit exceeded ${peakWorkingSetBytes}`); }
const sha = (value) => (0, crypto_1.createHash)("sha256").update(value).digest("hex");
async function fingerprint(path) { const metadata = await (0, promises_1.stat)(path), hash = (0, crypto_1.createHash)("sha256"); await new Promise((done, reject) => { const stream = (0, fs_1.createReadStream)(path); stream.on("data", chunk => { hash.update(chunk); memory(); }); stream.on("error", reject); stream.on("end", done); }); return { sha256: hash.digest("hex"), sizeBytes: metadata.size, modifiedAtMs: metadata.mtimeMs }; }
function sourcePath(name) { const adjacent = (0, path_1.resolve)(__dirname, name); return (0, fs_1.existsSync)(adjacent) ? adjacent : (0, path_1.resolve)(__dirname, "..", "..", "database-events", name); }
function verifyArtifact(bytes, expected, label) { if (bytes.byteLength !== expected.sizeBytes || sha(bytes) !== expected.sha256)
    throw Error(`E5 ${label} artifact identity`); }
async function runEventsE5(options = {}) {
    peakWorkingSetBytes = 0;
    const databasePath = (0, path_1.resolve)(options.databasePath ?? DEFAULT_DATABASE), outputDir = (0, path_1.resolve)(options.outputDir ?? DEFAULT_OUTPUT), e4Dir = (0, path_1.resolve)(options.e4Dir ?? DEFAULT_OUTPUT), e2Dir = (0, path_1.resolve)(options.e2Dir ?? DEFAULT_OUTPUT), e1Dir = (0, path_1.resolve)(options.e1Dir ?? DEFAULT_OUTPUT);
    const baseline = JSON.parse(await (0, promises_1.readFile)(options.baselinePath ? (0, path_1.resolve)(options.baselinePath) : sourcePath("events-e0-baseline.json"), "utf8"));
    const [e4Manifest, e2Manifest, e1Manifest] = await Promise.all([(0, promises_1.readFile)(await (0, events_artifact_path_1.resolveEventsInputFile)(e4Dir, "events-e4-manifest.json", "events-e4-manifest.json"), "utf8").then(value => JSON.parse(value)), (0, promises_1.readFile)(await (0, events_artifact_path_1.resolveEventsInputFile)(e2Dir, "events-e2-manifest.json", "events-e2-manifest.json"), "utf8").then(value => JSON.parse(value)), (0, promises_1.readFile)(await (0, events_artifact_path_1.resolveEventsInputFile)(e1Dir, "events-e1-manifest.json", "events-e1-manifest.json"), "utf8").then(value => JSON.parse(value))]);
    const [e4Path, e4CoveragePath, e4ValidationPath, e2Path, e1Path] = await Promise.all([(0, events_artifact_path_1.resolveEventsInputFile)(e4Dir, e4Manifest.fileName, "events-e4-mechanics.json"), (0, events_artifact_path_1.resolveEventsInputFile)(e4Dir, e4Manifest.coverage?.fileName, "events-e4-coverage.json"), (0, events_artifact_path_1.resolveEventsInputFile)(e4Dir, e4Manifest.validation?.fileName, "events-e4-validation.json"), (0, events_artifact_path_1.resolveEventsInputFile)(e2Dir, e2Manifest.fileName, "events-e2-topology.json"), (0, events_artifact_path_1.resolveEventsInputFile)(e1Dir, e1Manifest.fileName, "events-e1-catalog.json")]);
    const [e4Bytes, e4CoverageBytes, e4ValidationBytes, e2Bytes, e1Bytes] = await Promise.all([(0, promises_1.readFile)(e4Path), (0, promises_1.readFile)(e4CoveragePath), (0, promises_1.readFile)(e4ValidationPath), (0, promises_1.readFile)(e2Path), (0, promises_1.readFile)(e1Path)]);
    memory();
    verifyArtifact(e4Bytes, e4Manifest, "E4 payload");
    verifyArtifact(e4CoverageBytes, e4Manifest.coverage, "E4 coverage");
    verifyArtifact(e4ValidationBytes, e4Manifest.validation, "E4 validation");
    verifyArtifact(e2Bytes, e2Manifest, "E2 payload");
    verifyArtifact(e1Bytes, e1Manifest, "E1 payload");
    const e4 = JSON.parse(e4Bytes.toString("utf8")), e4Coverage = JSON.parse(e4CoverageBytes.toString("utf8")), e4Validation = JSON.parse(e4ValidationBytes.toString("utf8")), e2 = JSON.parse(e2Bytes.toString("utf8")), e1 = JSON.parse(e1Bytes.toString("utf8"));
    if (e4Manifest.contractVersion !== "0.5.0" || e4Manifest.generatedAtPolicy !== "pinned_to_source_snapshot_for_reproducible_bytes" || e4Manifest.generatedAt !== baseline.generatedAt || e4Manifest.sourceSnapshotVersion !== baseline.snapshotVersion || e4Manifest.sourceDatabaseSha256 !== baseline.sourceDatabase.sha256 || e4.contract !== "dokkan-events-database-first-mechanics" || e4.contractVersion !== "0.5.0" || e4.sourceE2.sha256 !== e2Manifest.sha256 || e4Coverage.danglingIdCount !== 0 || !e4Validation.valid || !e4Validation.exactProjection)
        throw Error("E5 E4 lineage");
    if (e2Manifest.contractVersion !== "0.3.0" || e2Manifest.sha256 !== e4Manifest.sourceE2Sha256 || e2Manifest.sourceE1Sha256 !== e1Manifest.sha256 || e2.contract !== "dokkan-events-database-first-topology" || e2.contractVersion !== "0.3.0" || e2.sourceE1.sha256 !== e1Manifest.sha256 || e2.sourceSnapshotVersion !== baseline.snapshotVersion || e2.sourceDatabaseSha256 !== baseline.sourceDatabase.sha256)
        throw Error("E5 E2 lineage");
    if (e1Manifest.contractVersion !== "0.2.0" || e1.contract !== "dokkan-events-database-first-catalog" || e1.contractVersion !== "0.2.0" || e1.sourceSnapshotVersion !== baseline.snapshotVersion || e1.sourceDatabaseSha256 !== baseline.sourceDatabase.sha256)
        throw Error("E5 E1 lineage");
    const databaseBefore = await fingerprint(databasePath);
    if (databaseBefore.sha256 !== baseline.sourceDatabase.sha256 || databaseBefore.sizeBytes !== baseline.sourceDatabase.sizeBytes)
        throw Error("E5 pinned source identity");
    const observation = await (0, events_sqlite_adapter_1.runEventsSqliteBridge)("rewards", databasePath, memory);
    memory();
    const lineage = { generatedAt: baseline.generatedAt, sourceSnapshotVersion: baseline.snapshotVersion, sourceDatabaseSha256: databaseBefore.sha256, sourceE4Sha256: e4Manifest.sha256, sourceE2Sha256: e2Manifest.sha256, sourceE1Sha256: e1Manifest.sha256 };
    const dataset = (0, events_e5_builder_1.buildEventsE5Dataset)({ observation, e2, e1, ...lineage }), coverage = (0, events_e5_builder_1.buildEventsE5Coverage)(dataset, e2, e1, observation), validation = (0, events_e5_validator_1.validateEventsE5Dataset)(dataset, observation, e2, e1, lineage);
    if (!validation.valid || coverage.danglingIdCount !== 0)
        throw Error(`E5 validation ${JSON.stringify(validation.failures)} dangling=${coverage.danglingIdCount}`);
    const databaseAfter = await fingerprint(databasePath);
    if (JSON.stringify(databaseBefore) !== JSON.stringify(databaseAfter))
        throw Error("E5 read-only source guarantee");
    const payloadText = `${JSON.stringify(dataset, null, 2)}\n`, coverageText = `${JSON.stringify(coverage, null, 2)}\n`, validationText = `${JSON.stringify(validation, null, 2)}\n`;
    const manifest = { schemaVersion: 1, contractVersion: "0.6.0", generatedAt: dataset.generatedAt, generatedAtPolicy: dataset.generatedAtPolicy, sourceSnapshotVersion: dataset.sourceSnapshotVersion, fileName: "events-e5-rewards.json", compression: "none", sha256: sha(payloadText), sizeBytes: Buffer.byteLength(payloadText), sourceDatabaseSha256: dataset.sourceDatabaseSha256, sourceE4Sha256: dataset.sourceE4.sha256, sourceE2Sha256: dataset.sourceE2.sha256, sourceE1Sha256: dataset.sourceE1.sha256, coverage: { fileName: "events-e5-coverage.json", sha256: sha(coverageText), sizeBytes: Buffer.byteLength(coverageText) }, validation: { fileName: "events-e5-validation.json", sha256: sha(validationText), sizeBytes: Buffer.byteLength(validationText) } };
    await (0, promises_1.mkdir)(outputDir, { recursive: true });
    const outputs = await (0, events_artifact_path_1.resolveEventsOutputFiles)(outputDir, [manifest.fileName, manifest.coverage.fileName, manifest.validation.fileName, "events-e5-manifest.json"]);
    await Promise.all([(0, promises_1.writeFile)(outputs.get(manifest.fileName), payloadText), (0, promises_1.writeFile)(outputs.get(manifest.coverage.fileName), coverageText), (0, promises_1.writeFile)(outputs.get(manifest.validation.fileName), validationText), (0, promises_1.writeFile)(outputs.get("events-e5-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`)]);
    memory();
    return { dataset, coverage, validation, manifest, peakWorkingSetBytes };
}
exports.runEventsE5 = runEventsE5;
if (require.main === module)
    runEventsE5().then(value => console.log(JSON.stringify({ coverage: value.coverage, validation: value.validation, manifest: value.manifest, peakWorkingSetBytes: value.peakWorkingSetBytes }, null, 2))).catch(error => { console.error(error); process.exitCode = 1; });
//# sourceMappingURL=events-e5-run.js.map