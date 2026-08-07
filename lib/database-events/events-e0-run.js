"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runEventsE0 = void 0;
const child_process_1 = require("child_process");
const crypto_1 = require("crypto");
const fs_1 = require("fs");
const promises_1 = require("fs/promises");
const path_1 = require("path");
const events_artifact_path_1 = require("./events-artifact-path");
const events_e0_builder_1 = require("./events-e0-builder");
const events_e0_validator_1 = require("./events-e0-validator");
const DEFAULT_DATABASE = "D:/Dokkan/database/decrypted/dokkan-global-current.db";
const DEFAULT_OUTPUT = (0, path_1.resolve)(process.cwd(), "data", "database-events");
const MEMORY_LIMIT = 1024 * 1024 * 1024;
let peakWorkingSetBytes = 0;
function observeMemory() {
    peakWorkingSetBytes = Math.max(peakWorkingSetBytes, process.memoryUsage().rss, process.resourceUsage().maxRSS * 1024);
    if (peakWorkingSetBytes > MEMORY_LIMIT)
        throw new Error(`E0 memory limit exceeded: ${peakWorkingSetBytes}`);
}
async function fingerprint(path) {
    const metadata = await (0, promises_1.stat)(path), hash = (0, crypto_1.createHash)("sha256");
    await new Promise((done, reject) => {
        const stream = (0, fs_1.createReadStream)(path);
        stream.on("data", chunk => { hash.update(chunk); observeMemory(); });
        stream.on("error", reject);
        stream.on("end", done);
    });
    return { sha256: hash.digest("hex"), sizeBytes: metadata.size, modifiedAtMs: metadata.mtimeMs };
}
async function observeDatabase(databasePath) {
    const bridge = (0, path_1.resolve)(__dirname, "events-sqlite-readonly-bridge.py");
    const sourceBridge = (0, path_1.resolve)(__dirname, "..", "..", "database-events", "events-sqlite-readonly-bridge.py");
    const bridgePath = require("fs").existsSync(bridge) ? bridge : sourceBridge;
    return new Promise((done, reject) => {
        const child = (0, child_process_1.spawn)(process.platform === "win32" ? "python" : "python3", [bridgePath, "inventory", "--database", databasePath], { shell: false, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
        const stdout = [], stderr = [];
        child.stdout.on("data", chunk => { stdout.push(Buffer.from(chunk)); observeMemory(); });
        child.stderr.on("data", chunk => stderr.push(Buffer.from(chunk)));
        child.on("error", reject);
        child.on("close", code => code === 0 ? done(JSON.parse(Buffer.concat(stdout).toString("utf8"))) : reject(new Error(`E0 bridge failed (${code}): ${Buffer.concat(stderr).toString("utf8")}`)));
    });
}
async function runEventsE0(options = {}) {
    peakWorkingSetBytes = 0;
    const databasePath = (0, path_1.resolve)(options.databasePath ?? DEFAULT_DATABASE), outputDir = (0, path_1.resolve)(options.outputDir ?? DEFAULT_OUTPUT);
    const baselinePath = options.baselinePath ? (0, path_1.resolve)(options.baselinePath) : (0, path_1.resolve)(__dirname, "events-e0-baseline.json");
    const sourceBaselinePath = (0, path_1.resolve)(__dirname, "..", "..", "database-events", "events-e0-baseline.json");
    const resolvedBaselinePath = options.baselinePath ? baselinePath : require("fs").existsSync(baselinePath) ? baselinePath : sourceBaselinePath;
    const baseline = JSON.parse(await (0, promises_1.readFile)(resolvedBaselinePath, "utf8"));
    const before = await fingerprint(databasePath), observation = await observeDatabase(databasePath);
    observeMemory();
    const dataset = (0, events_e0_builder_1.buildEventsE0Dataset)({ observation, generatedAt: baseline.generatedAt, sourceSnapshotVersion: baseline.snapshotVersion, sourceDatabase: { fileName: (0, path_1.basename)(databasePath), sha256: before.sha256, sizeBytes: before.sizeBytes } });
    const coverage = (0, events_e0_builder_1.buildEventsE0Coverage)(dataset), validation = (0, events_e0_validator_1.validateEventsE0Dataset)(dataset, observation, baseline);
    if (!validation.valid)
        throw new Error(`E0 validation failed: ${JSON.stringify(validation.failures)}`);
    const after = await fingerprint(databasePath);
    if (JSON.stringify(before) !== JSON.stringify(after))
        throw new Error("E0 read-only source guarantee");
    const inventoryText = `${JSON.stringify(dataset, null, 2)}\n`, coverageText = `${JSON.stringify(coverage, null, 2)}\n`, validationText = `${JSON.stringify(validation, null, 2)}\n`;
    const sha256 = (value) => (0, crypto_1.createHash)("sha256").update(value).digest("hex");
    const manifest = {
        schemaVersion: 1,
        contractVersion: "0.1.0",
        generatedAt: dataset.generatedAt,
        generatedAtPolicy: dataset.generatedAtPolicy,
        fileName: "events-e0-inventory.json",
        compression: "none",
        sha256: sha256(inventoryText),
        sizeBytes: Buffer.byteLength(inventoryText),
        tableCount: dataset.tables.length,
        sourceSnapshotVersion: dataset.sourceSnapshotVersion,
        sourceDatabaseSha256: dataset.sourceDatabase.sha256,
        coverage: { fileName: "events-e0-coverage.json", sha256: sha256(coverageText), sizeBytes: Buffer.byteLength(coverageText) },
        validation: { fileName: "events-e0-validation.json", sha256: sha256(validationText), sizeBytes: Buffer.byteLength(validationText) },
    };
    await (0, promises_1.mkdir)(outputDir, { recursive: true });
    const outputs = await (0, events_artifact_path_1.resolveEventsOutputFiles)(outputDir, [manifest.fileName, manifest.coverage.fileName, manifest.validation.fileName, "events-e0-manifest.json"]);
    await Promise.all([
        (0, promises_1.writeFile)(outputs.get(manifest.fileName), inventoryText),
        (0, promises_1.writeFile)(outputs.get(manifest.coverage.fileName), coverageText),
        (0, promises_1.writeFile)(outputs.get(manifest.validation.fileName), validationText),
        (0, promises_1.writeFile)(outputs.get("events-e0-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`),
    ]);
    observeMemory();
    return { dataset, coverage, validation, manifest, peakWorkingSetBytes };
}
exports.runEventsE0 = runEventsE0;
if (require.main === module)
    runEventsE0().then(value => console.log(JSON.stringify({ coverage: value.coverage, validation: value.validation, peakWorkingSetBytes: value.peakWorkingSetBytes }, null, 2))).catch(error => { console.error(error); process.exitCode = 1; });
//# sourceMappingURL=events-e0-run.js.map