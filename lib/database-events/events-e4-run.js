"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runEventsE4 = void 0;
const crypto_1 = require("crypto");
const fs_1 = require("fs");
const promises_1 = require("fs/promises");
const path_1 = require("path");
const native_runtime_elf_adapter_1 = require("../database-experiment/native-runtime-elf-adapter");
const events_e4_builder_1 = require("./events-e4-builder");
const events_e4_validator_1 = require("./events-e4-validator");
const events_sqlite_adapter_1 = require("./events-sqlite-adapter");
const DEFAULT_DATABASE = "D:/Dokkan/database/decrypted/dokkan-global-current.db", DEFAULT_ELF = "D:/Dokkan/database/apk/extracted/lib/arm64-v8a/libcocos2dcpp.so", DEFAULT_OUTPUT = (0, path_1.resolve)(process.cwd(), "data", "database-events"), MEMORY_LIMIT = 1024 * 1024 * 1024;
let peakWorkingSetBytes = 0;
function memory() { peakWorkingSetBytes = Math.max(peakWorkingSetBytes, process.memoryUsage().rss, process.resourceUsage().maxRSS * 1024); if (peakWorkingSetBytes > MEMORY_LIMIT)
    throw Error(`E4 memory limit exceeded ${peakWorkingSetBytes}`); }
const sha = (value) => (0, crypto_1.createHash)("sha256").update(value).digest("hex");
async function fingerprint(path) { const metadata = await (0, promises_1.stat)(path), hash = (0, crypto_1.createHash)("sha256"); await new Promise((done, reject) => { const stream = (0, fs_1.createReadStream)(path); stream.on("data", chunk => { hash.update(chunk); memory(); }); stream.on("error", reject); stream.on("end", done); }); return { sha256: hash.digest("hex"), sizeBytes: metadata.size, modifiedAtMs: metadata.mtimeMs }; }
function sourcePath(name) { const adjacent = (0, path_1.resolve)(__dirname, name); return (0, fs_1.existsSync)(adjacent) ? adjacent : (0, path_1.resolve)(__dirname, "..", "..", "database-events", name); }
async function runEventsE4(options = {}) {
    peakWorkingSetBytes = 0;
    const databasePath = (0, path_1.resolve)(options.databasePath ?? DEFAULT_DATABASE), elfPath = (0, path_1.resolve)(options.elfPath ?? DEFAULT_ELF), outputDir = (0, path_1.resolve)(options.outputDir ?? DEFAULT_OUTPUT), e3Dir = (0, path_1.resolve)(options.e3Dir ?? DEFAULT_OUTPUT), e2Dir = (0, path_1.resolve)(options.e2Dir ?? DEFAULT_OUTPUT);
    const baseline = JSON.parse(await (0, promises_1.readFile)(options.baselinePath ? (0, path_1.resolve)(options.baselinePath) : sourcePath("events-e0-baseline.json"), "utf8")), e3Baseline = JSON.parse(await (0, promises_1.readFile)(options.e3BaselinePath ? (0, path_1.resolve)(options.e3BaselinePath) : sourcePath("events-e3-baseline.json"), "utf8")), nativeEvidenceBytes = await (0, promises_1.readFile)(options.nativeEvidencePath ? (0, path_1.resolve)(options.nativeEvidencePath) : sourcePath("events-e4-native-enemy-efficacy-map.json")), nativeEvidence = JSON.parse(nativeEvidenceBytes.toString("utf8")), nativeEvidenceSha256 = sha(`${JSON.stringify(nativeEvidence, null, 2)}\n`);
    const e3Manifest = JSON.parse(await (0, promises_1.readFile)((0, path_1.resolve)(e3Dir, "events-e3-manifest.json"), "utf8")), e2Manifest = JSON.parse(await (0, promises_1.readFile)((0, path_1.resolve)(e2Dir, "events-e2-manifest.json"), "utf8"));
    const [e3Bytes, e3CoverageBytes, e3ValidationBytes, e3GoldensBytes, e2Bytes] = await Promise.all([(0, promises_1.readFile)((0, path_1.resolve)(e3Dir, e3Manifest.fileName)), (0, promises_1.readFile)((0, path_1.resolve)(e3Dir, e3Manifest.coverage.fileName)), (0, promises_1.readFile)((0, path_1.resolve)(e3Dir, e3Manifest.validation.fileName)), (0, promises_1.readFile)((0, path_1.resolve)(e3Dir, e3Manifest.goldens.fileName)), (0, promises_1.readFile)((0, path_1.resolve)(e2Dir, e2Manifest.fileName))]);
    memory();
    const e3 = JSON.parse(e3Bytes.toString("utf8")), e3Coverage = JSON.parse(e3CoverageBytes.toString("utf8")), e3Validation = JSON.parse(e3ValidationBytes.toString("utf8")), e3Goldens = JSON.parse(e3GoldensBytes.toString("utf8")), e2 = JSON.parse(e2Bytes.toString("utf8"));
    if (e3Baseline.snapshotVersion !== baseline.snapshotVersion || e3Baseline.sourceE2Sha256 !== e3Manifest.sourceE2Sha256 || JSON.stringify(e3Goldens) !== JSON.stringify(e3Baseline.goldens) || e3Manifest.contractVersion !== "0.4.0" || e3Manifest.generatedAtPolicy !== "pinned_to_source_snapshot_for_reproducible_bytes" || e3Manifest.generatedAt !== baseline.generatedAt || e3Manifest.sourceSnapshotVersion !== baseline.snapshotVersion || e3Manifest.sourceDatabaseSha256 !== baseline.sourceDatabase.sha256 || e3Bytes.byteLength !== e3Manifest.sizeBytes || sha(e3Bytes) !== e3Manifest.sha256 || e3CoverageBytes.byteLength !== e3Manifest.coverage.sizeBytes || sha(e3CoverageBytes) !== e3Manifest.coverage.sha256 || e3ValidationBytes.byteLength !== e3Manifest.validation.sizeBytes || sha(e3ValidationBytes) !== e3Manifest.validation.sha256 || e3GoldensBytes.byteLength !== e3Manifest.goldens.sizeBytes || sha(e3GoldensBytes) !== e3Manifest.goldens.sha256 || e3.contract !== "dokkan-events-database-first-encounters" || e3.contractVersion !== "0.4.0" || e3.generatedAt !== baseline.generatedAt || e3.generatedAtPolicy !== "pinned_to_source_snapshot_for_reproducible_bytes" || e3.sourceSnapshotVersion !== baseline.snapshotVersion || e3.sourceDatabaseSha256 !== baseline.sourceDatabase.sha256 || e3.sourceE2.sha256 !== e3Manifest.sourceE2Sha256 || e3Coverage.danglingIdCount !== 0 || !e3Validation.valid || !e3Validation.exactProjection)
        throw Error("E4 E3 lineage");
    if (e2Manifest.sha256 !== e3Manifest.sourceE2Sha256 || e2Bytes.byteLength !== e2Manifest.sizeBytes || sha(e2Bytes) !== e2Manifest.sha256 || e2.contract !== "dokkan-events-database-first-topology" || e2.contractVersion !== "0.3.0" || e2.generatedAtPolicy !== "pinned_to_source_snapshot_for_reproducible_bytes" || e2.sourceSnapshotVersion !== baseline.snapshotVersion || e2.sourceDatabaseSha256 !== baseline.sourceDatabase.sha256)
        throw Error("E4 E2 lineage");
    const databaseBefore = await fingerprint(databasePath), elfBefore = await fingerprint(elfPath);
    if (databaseBefore.sha256 !== baseline.sourceDatabase.sha256 || databaseBefore.sizeBytes !== baseline.sourceDatabase.sizeBytes || elfBefore.sha256 !== nativeEvidence.sourceElfSha256 || elfBefore.sizeBytes !== nativeEvidence.sourceElfSizeBytes)
        throw Error("E4 pinned source identity");
    const inspection = await (0, native_runtime_elf_adapter_1.inspectNativeRuntimeElf)(elfPath);
    memory();
    const nativeEvidenceValid = (0, events_e4_validator_1.validateEventsE4NativeEvidence)(nativeEvidence, nativeEvidenceSha256, inspection);
    if (!nativeEvidenceValid)
        throw Error("E4 native evidence");
    const observation = await (0, events_sqlite_adapter_1.runEventsSqliteBridge)("mechanics", databasePath, memory), dataset = (0, events_e4_builder_1.buildEventsE4Dataset)({ observation, e3, e2, nativeEvidence, nativeEvidenceSha256, generatedAt: baseline.generatedAt, sourceSnapshotVersion: baseline.snapshotVersion, sourceDatabaseSha256: databaseBefore.sha256, sourceE3Sha256: e3Manifest.sha256, sourceE2Sha256: e2Manifest.sha256 }), coverage = (0, events_e4_builder_1.buildEventsE4Coverage)(dataset, e3, e2, observation), validation = (0, events_e4_validator_1.validateEventsE4Dataset)(dataset, observation, e3, e2, nativeEvidence, nativeEvidenceSha256, nativeEvidenceValid, { generatedAt: baseline.generatedAt, sourceSnapshotVersion: baseline.snapshotVersion, sourceDatabaseSha256: databaseBefore.sha256, sourceE3Sha256: e3Manifest.sha256, sourceE2Sha256: e2Manifest.sha256 });
    if (!validation.valid || coverage.danglingIdCount !== 0)
        throw Error(`E4 validation ${JSON.stringify(validation.failures)} dangling=${coverage.danglingIdCount}`);
    const databaseAfter = await fingerprint(databasePath), elfAfter = await fingerprint(elfPath);
    if (JSON.stringify(databaseBefore) !== JSON.stringify(databaseAfter) || JSON.stringify(elfBefore) !== JSON.stringify(elfAfter))
        throw Error("E4 read-only source guarantee");
    const payloadText = `${JSON.stringify(dataset, null, 2)}\n`, coverageText = `${JSON.stringify(coverage, null, 2)}\n`, validationText = `${JSON.stringify(validation, null, 2)}\n`;
    const manifest = { schemaVersion: 1, contractVersion: "0.5.0", generatedAt: dataset.generatedAt, generatedAtPolicy: dataset.generatedAtPolicy, sourceSnapshotVersion: dataset.sourceSnapshotVersion, fileName: "events-e4-mechanics.json", compression: "none", sha256: sha(payloadText), sizeBytes: Buffer.byteLength(payloadText), sourceDatabaseSha256: dataset.sourceDatabaseSha256, sourceE3Sha256: dataset.sourceE3.sha256, sourceE2Sha256: dataset.sourceE2.sha256, sourceElfSha256: nativeEvidence.sourceElfSha256, nativeEvidenceSha256, coverage: { fileName: "events-e4-coverage.json", sha256: sha(coverageText), sizeBytes: Buffer.byteLength(coverageText) }, validation: { fileName: "events-e4-validation.json", sha256: sha(validationText), sizeBytes: Buffer.byteLength(validationText) } };
    await (0, promises_1.mkdir)(outputDir, { recursive: true });
    await Promise.all([(0, promises_1.writeFile)((0, path_1.resolve)(outputDir, manifest.fileName), payloadText), (0, promises_1.writeFile)((0, path_1.resolve)(outputDir, manifest.coverage.fileName), coverageText), (0, promises_1.writeFile)((0, path_1.resolve)(outputDir, manifest.validation.fileName), validationText), (0, promises_1.writeFile)((0, path_1.resolve)(outputDir, "events-e4-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`)]);
    memory();
    return { dataset, coverage, validation, manifest, peakWorkingSetBytes };
}
exports.runEventsE4 = runEventsE4;
if (require.main === module)
    runEventsE4().then(value => console.log(JSON.stringify({ coverage: value.coverage, validation: value.validation, manifest: value.manifest, peakWorkingSetBytes: value.peakWorkingSetBytes }, null, 2))).catch(error => { console.error(error); process.exitCode = 1; });
//# sourceMappingURL=events-e4-run.js.map