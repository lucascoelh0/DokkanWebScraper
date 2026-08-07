"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runEventsE2 = void 0;
const crypto_1 = require("crypto");
const fs_1 = require("fs");
const promises_1 = require("fs/promises");
const path_1 = require("path");
const events_e2_builder_1 = require("./events-e2-builder");
const events_sqlite_adapter_1 = require("./events-sqlite-adapter");
const events_e2_validator_1 = require("./events-e2-validator");
const DEFAULT_DATABASE = "D:/Dokkan/database/decrypted/dokkan-global-current.db", DEFAULT_OUTPUT = (0, path_1.resolve)(process.cwd(), "data", "database-events"), MEMORY_LIMIT = 1024 * 1024 * 1024;
let peakWorkingSetBytes = 0;
function memory() { peakWorkingSetBytes = Math.max(peakWorkingSetBytes, process.memoryUsage().rss, process.resourceUsage().maxRSS * 1024); if (peakWorkingSetBytes > MEMORY_LIMIT)
    throw Error(`E2 memory limit exceeded ${peakWorkingSetBytes}`); }
async function fingerprint(path) { const metadata = await (0, promises_1.stat)(path), hash = (0, crypto_1.createHash)("sha256"); await new Promise((done, reject) => { const stream = (0, fs_1.createReadStream)(path); stream.on("data", chunk => { hash.update(chunk); memory(); }); stream.on("error", reject); stream.on("end", done); }); return { sha256: hash.digest("hex"), sizeBytes: metadata.size, modifiedAtMs: metadata.mtimeMs }; }
function sourcePath(name) { const adjacent = (0, path_1.resolve)(__dirname, name); return require("fs").existsSync(adjacent) ? adjacent : (0, path_1.resolve)(__dirname, "..", "..", "database-events", name); }
async function runEventsE2(options = {}) {
    peakWorkingSetBytes = 0;
    const databasePath = (0, path_1.resolve)(options.databasePath ?? DEFAULT_DATABASE), outputDir = (0, path_1.resolve)(options.outputDir ?? DEFAULT_OUTPUT), e1Dir = (0, path_1.resolve)(options.e1Dir ?? DEFAULT_OUTPUT), sha = (value) => (0, crypto_1.createHash)("sha256").update(value).digest("hex");
    const baseline = JSON.parse(await (0, promises_1.readFile)(options.baselinePath ? (0, path_1.resolve)(options.baselinePath) : sourcePath("events-e0-baseline.json"), "utf8")), e1Manifest = JSON.parse(await (0, promises_1.readFile)((0, path_1.resolve)(e1Dir, "events-e1-manifest.json"), "utf8"));
    const [e1Bytes, coverageBytes, validationBytes] = await Promise.all([(0, promises_1.readFile)((0, path_1.resolve)(e1Dir, e1Manifest.fileName)), (0, promises_1.readFile)((0, path_1.resolve)(e1Dir, e1Manifest.coverage.fileName)), (0, promises_1.readFile)((0, path_1.resolve)(e1Dir, e1Manifest.validation.fileName))]), e1 = JSON.parse(e1Bytes.toString("utf8")), e1Coverage = JSON.parse(coverageBytes.toString("utf8")), e1Validation = JSON.parse(validationBytes.toString("utf8"));
    if (e1Manifest.contractVersion !== "0.2.0" || e1Manifest.generatedAtPolicy !== "pinned_to_source_snapshot_for_reproducible_bytes" || e1Manifest.generatedAt !== baseline.generatedAt || e1Manifest.sourceSnapshotVersion !== baseline.snapshotVersion || e1Manifest.sourceDatabaseSha256 !== baseline.sourceDatabase.sha256 || e1Bytes.byteLength !== e1Manifest.sizeBytes || sha(e1Bytes) !== e1Manifest.sha256 || coverageBytes.byteLength !== e1Manifest.coverage.sizeBytes || sha(coverageBytes) !== e1Manifest.coverage.sha256 || validationBytes.byteLength !== e1Manifest.validation.sizeBytes || sha(validationBytes) !== e1Manifest.validation.sha256 || e1.contract !== "dokkan-events-database-first-catalog" || e1.contractVersion !== "0.2.0" || e1.generatedAt !== baseline.generatedAt || e1.generatedAtPolicy !== "pinned_to_source_snapshot_for_reproducible_bytes" || e1.sourceSnapshotVersion !== baseline.snapshotVersion || e1.sourceDatabaseSha256 !== baseline.sourceDatabase.sha256 || e1.sourceE0.sha256 !== e1Manifest.sourceE0Sha256 || e1Coverage.entityCount !== e1.catalog.length || !e1Validation.valid || e1Validation.losslessIdentityCount !== e1.catalog.length)
        throw Error("E2 E1 lineage");
    const before = await fingerprint(databasePath);
    if (before.sha256 !== baseline.sourceDatabase.sha256 || before.sizeBytes !== baseline.sourceDatabase.sizeBytes)
        throw Error("E2 pinned database identity");
    const observation = await (0, events_sqlite_adapter_1.runEventsSqliteBridge)("topology", databasePath, memory), budokaiRootCount = e1.catalog.filter(value => value.identity.kind === "budokai").length, rmbattleRootCount = e1.opaqueRootFamilies.find(value => value.family === "rmbattle")?.identities.length ?? 0;
    const dataset = (0, events_e2_builder_1.buildEventsE2Dataset)({ observation, generatedAt: baseline.generatedAt, sourceSnapshotVersion: baseline.snapshotVersion, sourceDatabaseSha256: before.sha256, sourceE1Sha256: e1Manifest.sha256, budokaiRootCount, rmbattleRootCount }), coverage = (0, events_e2_builder_1.buildEventsE2Coverage)(dataset, e1), validation = (0, events_e2_validator_1.validateEventsE2Dataset)(dataset, observation, e1, { generatedAt: baseline.generatedAt, sourceSnapshotVersion: baseline.snapshotVersion, sourceDatabaseSha256: before.sha256, sourceE1Sha256: e1Manifest.sha256 });
    if (!validation.valid || coverage.danglingIdCount !== 0)
        throw Error(`E2 validation ${JSON.stringify(validation.failures)} dangling=${coverage.danglingIdCount}`);
    const after = await fingerprint(databasePath);
    if (JSON.stringify(before) !== JSON.stringify(after))
        throw Error("E2 read-only source guarantee");
    const payloadText = `${JSON.stringify(dataset, null, 2)}\n`, coverageText = `${JSON.stringify(coverage, null, 2)}\n`, validationText = `${JSON.stringify(validation, null, 2)}\n`, manifest = { schemaVersion: 1, contractVersion: "0.3.0", generatedAt: dataset.generatedAt, generatedAtPolicy: dataset.generatedAtPolicy, sourceSnapshotVersion: dataset.sourceSnapshotVersion, fileName: "events-e2-topology.json", compression: "none", sha256: sha(payloadText), sizeBytes: Buffer.byteLength(payloadText), sourceDatabaseSha256: dataset.sourceDatabaseSha256, sourceE1Sha256: dataset.sourceE1.sha256, coverage: { fileName: "events-e2-coverage.json", sha256: sha(coverageText), sizeBytes: Buffer.byteLength(coverageText) }, validation: { fileName: "events-e2-validation.json", sha256: sha(validationText), sizeBytes: Buffer.byteLength(validationText) } };
    await (0, promises_1.mkdir)(outputDir, { recursive: true });
    await Promise.all([(0, promises_1.writeFile)((0, path_1.resolve)(outputDir, manifest.fileName), payloadText), (0, promises_1.writeFile)((0, path_1.resolve)(outputDir, manifest.coverage.fileName), coverageText), (0, promises_1.writeFile)((0, path_1.resolve)(outputDir, manifest.validation.fileName), validationText), (0, promises_1.writeFile)((0, path_1.resolve)(outputDir, "events-e2-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`)]);
    memory();
    return { dataset, coverage, validation, manifest, peakWorkingSetBytes };
}
exports.runEventsE2 = runEventsE2;
if (require.main === module)
    runEventsE2().then(value => console.log(JSON.stringify({ coverage: value.coverage, validation: value.validation, manifest: value.manifest, peakWorkingSetBytes: value.peakWorkingSetBytes }, null, 2))).catch(error => { console.error(error); process.exitCode = 1; });
//# sourceMappingURL=events-e2-run.js.map