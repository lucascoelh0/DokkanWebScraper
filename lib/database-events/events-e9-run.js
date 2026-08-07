"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runEventsE9 = void 0;
const crypto_1 = require("crypto");
const fs_1 = require("fs");
const promises_1 = require("fs/promises");
const path_1 = require("path");
const events_e9_builder_1 = require("./events-e9-builder");
const events_e9_validator_1 = require("./events-e9-validator");
const DEFAULT_DIRECTORY = (0, path_1.resolve)(process.cwd(), "data", "database-events"), MEMORY_LIMIT = 1024 * 1024 * 1024;
let peakWorkingSetBytes = 0;
function memory() { peakWorkingSetBytes = Math.max(peakWorkingSetBytes, process.memoryUsage().rss, process.resourceUsage().maxRSS * 1024); if (peakWorkingSetBytes > MEMORY_LIMIT)
    throw Error(`E9 memory limit exceeded ${peakWorkingSetBytes}`); }
const sha = (value) => (0, crypto_1.createHash)("sha256").update(value).digest("hex");
async function fingerprint(path) { const metadata = await (0, promises_1.stat)(path), hash = (0, crypto_1.createHash)("sha256"); await new Promise((done, reject) => { const stream = (0, fs_1.createReadStream)(path); stream.on("data", chunk => { hash.update(chunk); memory(); }); stream.on("error", reject); stream.on("end", done); }); return { sha256: hash.digest("hex"), sizeBytes: metadata.size, modifiedAtMs: metadata.mtimeMs }; }
function verify(bytes, expected, label) { if (bytes.byteLength !== expected.sizeBytes || sha(bytes) !== expected.sha256)
    throw Error(`E9 ${label} identity`); }
function sourcePath(name) { const adjacent = (0, path_1.resolve)(__dirname, name); return (0, fs_1.existsSync)(adjacent) ? adjacent : (0, path_1.resolve)(__dirname, "..", "..", "database-events", name); }
async function runEventsE9(options = {}) {
    peakWorkingSetBytes = 0;
    const inputDir = (0, path_1.resolve)(options.inputDir ?? DEFAULT_DIRECTORY), outputDir = (0, path_1.resolve)(options.outputDir ?? inputDir), e7Manifest = JSON.parse(await (0, promises_1.readFile)((0, path_1.resolve)(inputDir, "events-e7-manifest.json"), "utf8")), e8ManifestBytes = await (0, promises_1.readFile)((0, path_1.resolve)(inputDir, "events-e8-manifest.json")), e8Manifest = JSON.parse(e8ManifestBytes.toString("utf8")), refreshEvidenceBytes = await (0, promises_1.readFile)(sourcePath("events-e9-refresh-evidence.json")), refreshEvidenceSha256 = sha(refreshEvidenceBytes), refreshEvidence = JSON.parse(refreshEvidenceBytes.toString("utf8"));
    const [e7Before, e7CoverageBytes, e7ValidationBytes, e8Before, e8CoverageBytes, e8ValidationBytes, e8ReceiptBytes] = await Promise.all([fingerprint((0, path_1.resolve)(inputDir, e7Manifest.fileName)), (0, promises_1.readFile)((0, path_1.resolve)(inputDir, e7Manifest.coverage.fileName)), (0, promises_1.readFile)((0, path_1.resolve)(inputDir, e7Manifest.validation.fileName)), fingerprint((0, path_1.resolve)(inputDir, e8Manifest.fileName)), (0, promises_1.readFile)((0, path_1.resolve)(inputDir, e8Manifest.coverage.fileName)), (0, promises_1.readFile)((0, path_1.resolve)(inputDir, e8Manifest.validation.fileName)), (0, promises_1.readFile)((0, path_1.resolve)(inputDir, e8Manifest.refreshReceipt.fileName))]);
    memory();
    if (e7Before.sha256 !== e7Manifest.sha256 || e7Before.sizeBytes !== e7Manifest.sizeBytes || e8Before.sha256 !== e8Manifest.sha256 || e8Before.sizeBytes !== e8Manifest.sizeBytes)
        throw Error("E9 payload identity");
    verify(e7CoverageBytes, e7Manifest.coverage, "E7 coverage");
    verify(e7ValidationBytes, e7Manifest.validation, "E7 validation");
    verify(e8CoverageBytes, e8Manifest.coverage, "E8 coverage");
    verify(e8ValidationBytes, e8Manifest.validation, "E8 validation");
    verify(e8ReceiptBytes, e8Manifest.refreshReceipt, "E8 receipt");
    const e7 = JSON.parse(await (0, promises_1.readFile)((0, path_1.resolve)(inputDir, e7Manifest.fileName), "utf8")), e7Coverage = JSON.parse(e7CoverageBytes.toString("utf8")), e7Validation = JSON.parse(e7ValidationBytes.toString("utf8")), e8 = JSON.parse(await (0, promises_1.readFile)((0, path_1.resolve)(inputDir, e8Manifest.fileName), "utf8")), e8Coverage = JSON.parse(e8CoverageBytes.toString("utf8")), e8Validation = JSON.parse(e8ValidationBytes.toString("utf8"));
    if (e7Manifest.contractVersion !== "0.8.0" || e8Manifest.contractVersion !== "0.9.0" || !e7Validation.valid || !e7Validation.exactProjection || !e8Validation.valid || !e8Validation.exactProjection || e8Manifest.refreshProfileSha256 !== e8.refreshProfile.sha256)
        throw Error("E9 upstream validation");
    const e8Artifacts = { coverageSha256: sha(e8CoverageBytes), validationSha256: sha(e8ValidationBytes), receiptSha256: sha(e8ReceiptBytes), manifestSha256: sha(e8ManifestBytes) }, sources = { e7, e7Coverage, e7Sha256: e7Manifest.sha256, e8, e8Coverage, e8Sha256: e8Manifest.sha256, e8Artifacts, refreshEvidence, refreshEvidenceSha256 }, dataset = (0, events_e9_builder_1.buildEventsE9Dataset)(sources), coverage = (0, events_e9_builder_1.buildEventsE9Coverage)(dataset), validation = (0, events_e9_validator_1.validateEventsE9Dataset)(dataset, sources);
    if (!validation.valid)
        throw Error(`E9 validation ${JSON.stringify(validation.failures)}`);
    const e7After = await fingerprint((0, path_1.resolve)(inputDir, e7Manifest.fileName)), e8After = await fingerprint((0, path_1.resolve)(inputDir, e8Manifest.fileName));
    if (JSON.stringify(e7Before) !== JSON.stringify(e7After) || JSON.stringify(e8Before) !== JSON.stringify(e8After))
        throw Error("E9 read-only source guarantee");
    const payloadText = `${JSON.stringify(dataset, null, 2)}\n`, coverageText = `${JSON.stringify(coverage, null, 2)}\n`, validationText = `${JSON.stringify(validation, null, 2)}\n`;
    const manifest = { schemaVersion: 1, contractVersion: "1.0.0", generatedAt: dataset.generatedAt, generatedAtPolicy: dataset.generatedAtPolicy, sourceSnapshotVersion: dataset.sourceSnapshotVersion, fileName: "events-e9-readiness.json", compression: "none", sha256: sha(payloadText), sizeBytes: Buffer.byteLength(payloadText), sourceDatabaseSha256: dataset.sourceDatabaseSha256, sourceE7Sha256: dataset.sourceE7.sha256, sourceE8Sha256: dataset.sourceE8.sha256, refreshEvidenceSha256, coverage: { fileName: "events-e9-coverage.json", sha256: sha(coverageText), sizeBytes: Buffer.byteLength(coverageText) }, validation: { fileName: "events-e9-validation.json", sha256: sha(validationText), sizeBytes: Buffer.byteLength(validationText) } };
    await (0, promises_1.mkdir)(outputDir, { recursive: true });
    await Promise.all([(0, promises_1.writeFile)((0, path_1.resolve)(outputDir, manifest.fileName), payloadText), (0, promises_1.writeFile)((0, path_1.resolve)(outputDir, manifest.coverage.fileName), coverageText), (0, promises_1.writeFile)((0, path_1.resolve)(outputDir, manifest.validation.fileName), validationText), (0, promises_1.writeFile)((0, path_1.resolve)(outputDir, "events-e9-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`)]);
    memory();
    return { dataset, coverage, validation, manifest, peakWorkingSetBytes };
}
exports.runEventsE9 = runEventsE9;
if (require.main === module)
    runEventsE9().then(value => console.log(JSON.stringify({ coverage: value.coverage, validation: value.validation, manifest: value.manifest, peakWorkingSetBytes: value.peakWorkingSetBytes }, null, 2))).catch(error => { console.error(error); process.exitCode = 1; });
//# sourceMappingURL=events-e9-run.js.map