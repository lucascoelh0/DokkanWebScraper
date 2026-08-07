"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runEventsE8 = void 0;
const crypto_1 = require("crypto");
const fs_1 = require("fs");
const promises_1 = require("fs/promises");
const path_1 = require("path");
const events_e8_builder_1 = require("./events-e8-builder");
const events_e8_validator_1 = require("./events-e8-validator");
const DEFAULT_DIRECTORY = (0, path_1.resolve)(process.cwd(), "data", "database-events"), MEMORY_LIMIT = 1024 * 1024 * 1024;
let peakWorkingSetBytes = 0;
function memory() { peakWorkingSetBytes = Math.max(peakWorkingSetBytes, process.memoryUsage().rss, process.resourceUsage().maxRSS * 1024); if (peakWorkingSetBytes > MEMORY_LIMIT)
    throw Error(`E8 memory limit exceeded ${peakWorkingSetBytes}`); }
const sha = (value) => (0, crypto_1.createHash)("sha256").update(value).digest("hex");
async function fingerprint(path) { const metadata = await (0, promises_1.stat)(path), hash = (0, crypto_1.createHash)("sha256"); await new Promise((done, reject) => { const stream = (0, fs_1.createReadStream)(path); stream.on("data", chunk => { hash.update(chunk); memory(); }); stream.on("error", reject); stream.on("end", done); }); return { sha256: hash.digest("hex"), sizeBytes: metadata.size, modifiedAtMs: metadata.mtimeMs }; }
function sourcePath(name) { const adjacent = (0, path_1.resolve)(__dirname, name); return (0, fs_1.existsSync)(adjacent) ? adjacent : (0, path_1.resolve)(__dirname, "..", "..", "database-events", name); }
const definitions = [
    { gate: 1, key: "event_catalog", role: "static_event_catalog_and_hierarchy", version: "0.2.0" }, { gate: 2, key: "stage_topology", role: "stage_level_cost_requirement_topology", version: "0.3.0" }, { gate: 3, key: "encounters", role: "ordered_encounters_enemies_and_raw_stats", version: "0.4.0" }, { gate: 4, key: "boss_mechanics", role: "structured_and_raw_boss_stage_mechanics", version: "0.5.0" }, { gate: 5, key: "rewards", role: "rewards_costs_and_requirements", version: "0.6.0" }, { gate: 6, key: "asset_references", role: "asset_keys_bindings_and_binary_boundaries", version: "0.7.0" },
];
async function runEventsE8(options = {}) {
    peakWorkingSetBytes = 0;
    const inputDir = (0, path_1.resolve)(options.inputDir ?? DEFAULT_DIRECTORY), outputDir = (0, path_1.resolve)(options.outputDir ?? inputDir), profilePath = (0, path_1.resolve)(options.refreshProfilePath ?? sourcePath("events-e8-refresh-profile.json")), profileBytes = await (0, promises_1.readFile)(profilePath), refreshProfileSha256 = sha(profileBytes), refreshProfile = JSON.parse(profileBytes.toString("utf8")), profileDirectory = (0, path_1.dirname)(profilePath);
    const roles = new Set(refreshProfile.baselineFiles.map(value => value.role));
    if (refreshProfile.schemaVersion !== 1 || refreshProfile.contract !== "dokkan-events-database-first-refresh-profile" || refreshProfile.contractVersion !== "0.9.0" || refreshProfile.baselineFiles.length !== 4 || roles.size !== 4 || !["e0_inventory", "e3_goldens", "e4_native_evidence", "e6_apk"].every(value => roles.has(value)))
        throw Error("E8 refresh profile contract");
    const baselineValues = new Map();
    for (const baseline of refreshProfile.baselineFiles) {
        const path = (0, path_1.resolve)(profileDirectory, baseline.fileName), bytes = await (0, promises_1.readFile)(path);
        if (sha(bytes) !== baseline.sha256)
            throw Error(`E8 baseline identity ${baseline.role}`);
        baselineValues.set(baseline.role, JSON.parse(bytes.toString("utf8")));
    }
    const e0 = baselineValues.get("e0_inventory"), e3 = baselineValues.get("e3_goldens"), e4 = baselineValues.get("e4_native_evidence"), e6 = baselineValues.get("e6_apk");
    if (e0.snapshotVersion !== refreshProfile.profileId || e0.sourceDatabase.sha256 !== refreshProfile.requiredSources.database.sha256 || e0.sourceDatabase.sizeBytes !== refreshProfile.requiredSources.database.sizeBytes || e3.snapshotVersion !== e0.snapshotVersion || e4.sourceElfSha256 !== refreshProfile.requiredSources.elf.sha256 || e4.sourceElfSizeBytes !== refreshProfile.requiredSources.elf.sizeBytes || e6.sourceApk.sha256 !== refreshProfile.requiredSources.apk.sha256 || e6.sourceApk.sizeBytes !== refreshProfile.requiredSources.apk.sizeBytes)
        throw Error("E8 incompatible refresh profile sources");
    const e0Manifest = JSON.parse(await (0, promises_1.readFile)((0, path_1.resolve)(inputDir, "events-e0-manifest.json"), "utf8")), e0Payload = await fingerprint((0, path_1.resolve)(inputDir, e0Manifest.fileName)), e0CoverageBytes = await (0, promises_1.readFile)((0, path_1.resolve)(inputDir, e0Manifest.coverage.fileName)), e0ValidationBytes = await (0, promises_1.readFile)((0, path_1.resolve)(inputDir, e0Manifest.validation.fileName)), e0Validation = JSON.parse(e0ValidationBytes.toString("utf8"));
    if (e0Manifest.contractVersion !== "0.1.0" || e0Manifest.sourceSnapshotVersion !== e0.snapshotVersion || e0Manifest.sourceDatabaseSha256 !== e0.sourceDatabase.sha256 || e0Payload.sha256 !== e0Manifest.sha256 || e0Payload.sizeBytes !== e0Manifest.sizeBytes || sha(e0CoverageBytes) !== e0Manifest.coverage.sha256 || sha(e0ValidationBytes) !== e0Manifest.validation.sha256 || e0Validation.valid !== true)
        throw Error("E8 incompatible E0 inventory anchor");
    const nativeEvidenceSha256 = sha(`${JSON.stringify(e4, null, 2)}\n`), e6BaselineEntry = refreshProfile.baselineFiles.find(value => value.role === "e6_apk");
    const sourceAnchors = { inventory: { contractVersion: "0.1.0", fileName: e0Manifest.fileName, sha256: e0Payload.sha256, sizeBytes: e0Payload.sizeBytes }, elf: { sha256: refreshProfile.requiredSources.elf.sha256, sizeBytes: refreshProfile.requiredSources.elf.sizeBytes, nativeEvidenceSha256 }, apk: { sha256: refreshProfile.requiredSources.apk.sha256, sizeBytes: refreshProfile.requiredSources.apk.sizeBytes, apkBaselineSha256: e6BaselineEntry.sha256 } };
    const sidecars = [], sourceManifests = new Map();
    let payloadHashesValid = true, coverageHashesValid = true, validationHashesValid = true;
    for (const definition of definitions) {
        const manifestFileName = `events-e${definition.gate}-manifest.json`, manifest = JSON.parse(await (0, promises_1.readFile)((0, path_1.resolve)(inputDir, manifestFileName), "utf8"));
        if (manifest.contractVersion !== definition.version || manifest.generatedAt !== e0.generatedAt || manifest.sourceSnapshotVersion !== e0.snapshotVersion || manifest.sourceDatabaseSha256 !== e0.sourceDatabase.sha256)
            throw Error(`E8 incompatible E${definition.gate} manifest`);
        sourceManifests.set(definition.gate, manifest);
        const payload = await fingerprint((0, path_1.resolve)(inputDir, manifest.fileName)), coverageBytes = await (0, promises_1.readFile)((0, path_1.resolve)(inputDir, manifest.coverage.fileName)), validationBytes = await (0, promises_1.readFile)((0, path_1.resolve)(inputDir, manifest.validation.fileName));
        memory();
        payloadHashesValid &&= payload.sha256 === manifest.sha256 && payload.sizeBytes === manifest.sizeBytes;
        coverageHashesValid &&= sha(coverageBytes) === manifest.coverage.sha256 && coverageBytes.byteLength === manifest.coverage.sizeBytes;
        validationHashesValid &&= sha(validationBytes) === manifest.validation.sha256 && validationBytes.byteLength === manifest.validation.sizeBytes;
        const lineage = Object.fromEntries(Object.entries(manifest).filter(([key, value]) => (key.startsWith("source") || key === "nativeEvidenceSha256" || key === "apkBaselineSha256") && (typeof value === "string" || typeof value === "number")));
        sidecars.push({ key: definition.key, role: definition.role, gate: definition.gate, contractVersion: definition.version, manifestFileName, payload: { fileName: manifest.fileName, sha256: payload.sha256, sizeBytes: payload.sizeBytes }, coverage: { fileName: manifest.coverage.fileName, sha256: sha(coverageBytes), sizeBytes: coverageBytes.byteLength, counts: JSON.parse(coverageBytes.toString("utf8")) }, validation: { fileName: manifest.validation.fileName, sha256: sha(validationBytes), sizeBytes: validationBytes.byteLength, value: JSON.parse(validationBytes.toString("utf8")) }, lineage });
    }
    const e4Manifest = sourceManifests.get(4), e6Manifest = sourceManifests.get(6);
    if (e4Manifest.sourceElfSha256 !== sourceAnchors.elf.sha256 || e4Manifest.nativeEvidenceSha256 !== sourceAnchors.elf.nativeEvidenceSha256 || e6Manifest.sourceApkSha256 !== sourceAnchors.apk.sha256 || e6Manifest.sourceApkSizeBytes !== sourceAnchors.apk.sizeBytes || e6Manifest.apkBaselineSha256 !== sourceAnchors.apk.apkBaselineSha256)
        throw Error("E8 external source anchor lineage");
    const registry = (0, events_e8_builder_1.buildEventsE8Registry)({ sidecars, sourceAnchors, generatedAt: e0.generatedAt, sourceSnapshotVersion: e0.snapshotVersion, sourceDatabaseSha256: e0.sourceDatabase.sha256, refreshProfile, refreshProfileSha256 }), coverage = (0, events_e8_builder_1.buildEventsE8Coverage)(registry), validation = (0, events_e8_validator_1.validateEventsE8Registry)(registry, { sidecars, sourceAnchors, refreshProfile, refreshProfileSha256, payloadHashesValid, coverageHashesValid, validationHashesValid }), refreshReceipt = (0, events_e8_builder_1.buildEventsE8RefreshReceipt)(registry);
    if (!validation.valid || coverage.invalidValidationCount !== 0 || coverage.danglingIdCount !== 0)
        throw Error(`E8 validation ${JSON.stringify(validation.failures)} invalid=${coverage.invalidValidationCount} dangling=${coverage.danglingIdCount}`);
    const registryText = `${JSON.stringify(registry, null, 2)}\n`, coverageText = `${JSON.stringify(coverage, null, 2)}\n`, validationText = `${JSON.stringify(validation, null, 2)}\n`, receiptText = `${JSON.stringify(refreshReceipt, null, 2)}\n`;
    const manifest = { schemaVersion: 1, contractVersion: "0.9.0", generatedAt: registry.generatedAt, generatedAtPolicy: registry.generatedAtPolicy, sourceSnapshotVersion: registry.sourceSnapshotVersion, fileName: "events-sidecars.json", compression: "none", sha256: sha(registryText), sizeBytes: Buffer.byteLength(registryText), sourceDatabaseSha256: registry.sourceDatabaseSha256, refreshProfileSha256, coverage: { fileName: "events-e8-coverage.json", sha256: sha(coverageText), sizeBytes: Buffer.byteLength(coverageText) }, validation: { fileName: "events-e8-validation.json", sha256: sha(validationText), sizeBytes: Buffer.byteLength(validationText) }, refreshReceipt: { fileName: "events-e8-refresh-receipt.json", sha256: sha(receiptText), sizeBytes: Buffer.byteLength(receiptText) } };
    await (0, promises_1.mkdir)(outputDir, { recursive: true });
    await Promise.all([(0, promises_1.writeFile)((0, path_1.resolve)(outputDir, manifest.fileName), registryText), (0, promises_1.writeFile)((0, path_1.resolve)(outputDir, manifest.coverage.fileName), coverageText), (0, promises_1.writeFile)((0, path_1.resolve)(outputDir, manifest.validation.fileName), validationText), (0, promises_1.writeFile)((0, path_1.resolve)(outputDir, manifest.refreshReceipt.fileName), receiptText), (0, promises_1.writeFile)((0, path_1.resolve)(outputDir, "events-e8-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`)]);
    memory();
    return { registry, coverage, validation, refreshReceipt, manifest, peakWorkingSetBytes };
}
exports.runEventsE8 = runEventsE8;
if (require.main === module)
    runEventsE8().then(value => console.log(JSON.stringify({ coverage: value.coverage, validation: value.validation, manifest: value.manifest, peakWorkingSetBytes: value.peakWorkingSetBytes }, null, 2))).catch(error => { console.error(error); process.exitCode = 1; });
//# sourceMappingURL=events-e8-run.js.map