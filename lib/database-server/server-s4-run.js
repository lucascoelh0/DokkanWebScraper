"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runServerS4 = void 0;
const crypto_1 = require("crypto");
const fs_1 = require("fs");
const promises_1 = require("fs/promises");
const path_1 = require("path");
const server_s4_builder_1 = require("./server-s4-builder");
const MEMORY_LIMIT = 1024 * 1024 * 1024;
let peakWorkingSetBytes = 0;
function memory() { peakWorkingSetBytes = Math.max(peakWorkingSetBytes, process.memoryUsage().rss, process.resourceUsage().maxRSS * 1024); if (peakWorkingSetBytes > MEMORY_LIMIT)
    throw new Error(`S4 memory limit exceeded ${peakWorkingSetBytes}`); }
function sha256(value) { return (0, crypto_1.createHash)("sha256").update(value).digest("hex"); }
function text(value) { return `${JSON.stringify(value, null, 2)}\n`; }
async function fingerprint(path) {
    const info = await (0, promises_1.stat)(path), hash = (0, crypto_1.createHash)("sha256");
    await new Promise((done, reject) => { const stream = (0, fs_1.createReadStream)(path); stream.on("data", chunk => { hash.update(chunk); memory(); }); stream.on("error", reject); stream.on("end", done); });
    return { sha256: hash.digest("hex"), sizeBytes: info.size };
}
async function readVerified(dir, manifestName, contractVersion, generatedAtPolicy) {
    const manifest = JSON.parse(await (0, promises_1.readFile)((0, path_1.resolve)(dir, manifestName), "utf8"));
    if (manifest.schemaVersion !== 1 || manifest.contractVersion !== contractVersion || manifest.generatedAtPolicy !== generatedAtPolicy || manifest.compression !== "none")
        throw new Error(`S4 source contract ${manifestName}`);
    const path = (0, path_1.resolve)(dir, manifest.fileName), bytes = await (0, promises_1.readFile)(path);
    memory();
    if (bytes.byteLength !== manifest.sizeBytes || sha256(bytes) !== manifest.sha256)
        throw new Error(`S4 source payload ${manifestName}`);
    if (!manifest.validation?.fileName || !manifest.validation?.sha256 || !manifest.validation?.sizeBytes)
        throw new Error(`S4 missing source validation ${manifestName}`);
    const validationBytes = await (0, promises_1.readFile)((0, path_1.resolve)(dir, manifest.validation.fileName));
    if (validationBytes.byteLength !== manifest.validation.sizeBytes || sha256(validationBytes) !== manifest.validation.sha256 || JSON.parse(validationBytes.toString("utf8")).valid !== true)
        throw new Error(`S4 source validation ${manifestName}`);
    return { manifest, path, bytes };
}
function extractNativeEvidence(bytes) {
    const containers = new Set();
    let start = -1, splitManifest = false;
    for (let index = 0; index <= bytes.length; index++) {
        const code = index < bytes.length ? bytes[index] : 0;
        if (code >= 32 && code <= 126) {
            if (start < 0)
                start = index;
            continue;
        }
        if (start >= 0 && index - start >= 4 && index - start <= 240) {
            const value = bytes.subarray(start, index).toString("ascii");
            if (value === "client_assets_splited.json")
                splitManifest = true;
            if (/^[A-Za-z0-9_./%-]+\.cpk$/.test(value))
                containers.add(value);
        }
        start = -1;
        if ((index & 0xfffff) === 0)
            memory();
    }
    return { containers: [...containers].sort(), splitManifest };
}
async function runServerS4(options = {}) {
    peakWorkingSetBytes = 0;
    const serverDir = (0, path_1.resolve)(options.serverDir ?? (0, path_1.resolve)(process.cwd(), "data", "database-server", "s0")), eventsDir = (0, path_1.resolve)(options.eventsDir ?? (0, path_1.resolve)(process.cwd(), "data", "database-events"));
    const elfPath = (0, path_1.resolve)(options.elfPath ?? "D:/Dokkan/database/apk/extracted/lib/arm64-v8a/libcocos2dcpp.so");
    const metadataPath = (0, path_1.resolve)(options.metadataPath ?? (0, path_1.resolve)(process.cwd(), "game-db", "data", "game-db-acquisition", "first-party", "latest", "metadata.json"));
    const outputDir = (0, path_1.resolve)(options.outputDir ?? (0, path_1.resolve)(process.cwd(), "data", "database-server", "s4"));
    const [s0, e6, elfBytes, metadataBytes] = await Promise.all([
        readVerified(serverDir, "server-s0-manifest.json", "0.1.0", "pinned_to_static_evidence_checkpoint"),
        readVerified(eventsDir, "events-e6-manifest.json", "0.7.0", "pinned_to_source_snapshot_for_reproducible_bytes"),
        (0, promises_1.readFile)(elfPath), (0, promises_1.readFile)(metadataPath),
    ]);
    memory();
    const elfInfo = await (0, promises_1.stat)(elfPath), elfFingerprint = { sha256: sha256(elfBytes), sizeBytes: elfBytes.byteLength };
    if (elfInfo.size !== elfBytes.byteLength)
        throw new Error("S4 ELF changed during initial read");
    const s0Data = JSON.parse(s0.bytes.toString("utf8")), e6Data = JSON.parse(e6.bytes.toString("utf8")), historicalMetadata = JSON.parse(metadataBytes.toString("utf8"));
    memory();
    const elfEvidence = s0Data.evidence.find((value) => value.id === "global-elf-6.4.0-v338");
    if (!elfEvidence || elfEvidence.sha256 !== elfFingerprint.sha256 || elfEvidence.sizeBytes !== elfFingerprint.sizeBytes || e6.manifest.sourceSnapshotVersion !== s0.manifest.sourceSnapshotVersion || e6.manifest.sourceApkSha256 !== s0Data.evidence.find((value) => value.id === "global-apk-6.4.0-v338")?.sha256)
        throw new Error("S4 S0/E6/ELF lineage");
    if (historicalMetadata.source !== "first-party-export" || historicalMetadata.region !== "global" || !historicalMetadata.exportedAt || !historicalMetadata.dbVersion || !historicalMetadata.assetVersion || !historicalMetadata.apkVersion)
        throw new Error("S4 historical metadata contract");
    const native = extractNativeEvidence(elfBytes);
    memory();
    if (native.containers.length !== 94 || !native.splitManifest)
        throw new Error("S4 pinned native delivery evidence changed");
    const elfAfter = await fingerprint(elfPath);
    if (elfAfter.sha256 !== elfFingerprint.sha256 || elfAfter.sizeBytes !== elfFingerprint.sizeBytes)
        throw new Error("S4 ELF changed during scan");
    const metadataFingerprint = { sha256: sha256(metadataBytes), sizeBytes: metadataBytes.byteLength };
    const sourceLineage = [
        { key: "server_s0", path: `data/database-server/s0/${(0, path_1.basename)(s0.path)}`, sha256: s0.manifest.sha256, sizeBytes: s0.manifest.sizeBytes, authority: "official_static" },
        { key: "events_e6", path: `data/database-events/${(0, path_1.basename)(e6.path)}`, sha256: e6.manifest.sha256, sizeBytes: e6.manifest.sizeBytes, authority: "sqlite_first_party" },
        { key: "native_elf", path: elfPath.replace(/\\/g, "/"), sha256: elfFingerprint.sha256, sizeBytes: elfFingerprint.sizeBytes, authority: "official_static" },
        { key: "historical_acquisition_metadata", path: "game-db/data/game-db-acquisition/first-party/latest/metadata.json", sha256: metadataFingerprint.sha256, sizeBytes: metadataFingerprint.sizeBytes, authority: "historical_first_party_export" },
    ];
    const observation = {
        sourceSnapshotVersion: e6.manifest.sourceSnapshotVersion, sourceLineage, currentApkVersion: "6.4.0-v338", historicalMetadata, nativeContainerKeys: native.containers, hasSplitManifestLiteral: native.splitManifest,
        e6: { pathAssetCount: e6Data.pathAssets.length, numericAssetCount: e6Data.numericAssets.length, bindingCount: e6Data.bindings.length, directBaseApkPathCount: e6Data.downloadBoundary.directDatabasePathPresentInBaseApkCount, bundledCandidateCount: e6Data.numericAssets.reduce((sum, value) => sum + value.bundledCandidates.length, 0) + e6Data.pathAssets.filter((value) => value.baseApkPrefixedCandidate !== null).length, assetEntryCount: e6Data.sourceApk.assetEntryCount, cpkContainerCount: e6Data.downloadBoundary.cpkContainerCount, samples: e6Data.apkAssetInventory.representativeSamples },
    };
    const dataset = (0, server_s4_builder_1.buildServerS4Dataset)(observation), coverage = (0, server_s4_builder_1.buildServerS4Coverage)(dataset), validation = (0, server_s4_builder_1.validateServerS4Dataset)(dataset);
    if (!validation.valid)
        throw new Error(`S4 validation failed: ${validation.failures.join(", ")}`);
    const datasetText = text(dataset), coverageText = text(coverage), validationText = text(validation);
    const manifest = { schemaVersion: 1, contractVersion: "0.5.0", generatedAt: dataset.generatedAt, generatedAtPolicy: dataset.generatedAtPolicy, fileName: "server-s4-asset-delivery.json", compression: "none", sha256: sha256(datasetText), sizeBytes: Buffer.byteLength(datasetText), sourceSnapshotVersion: dataset.sourceSnapshotVersion, sourceLineageAggregateSha256: sha256(JSON.stringify(sourceLineage.map(value => [value.key, value.sha256, value.sizeBytes]))), coverage: { fileName: "server-s4-coverage.json", sha256: sha256(coverageText), sizeBytes: Buffer.byteLength(coverageText) }, validation: { fileName: "server-s4-validation.json", sha256: sha256(validationText), sizeBytes: Buffer.byteLength(validationText) } };
    await (0, promises_1.mkdir)(outputDir, { recursive: true });
    await Promise.all([(0, promises_1.writeFile)((0, path_1.resolve)(outputDir, manifest.fileName), datasetText), (0, promises_1.writeFile)((0, path_1.resolve)(outputDir, manifest.coverage.fileName), coverageText), (0, promises_1.writeFile)((0, path_1.resolve)(outputDir, manifest.validation.fileName), validationText), (0, promises_1.writeFile)((0, path_1.resolve)(outputDir, "server-s4-manifest.json"), text(manifest))]);
    memory();
    return { dataset, coverage, validation, manifest, peakWorkingSetBytes };
}
exports.runServerS4 = runServerS4;
if (require.main === module)
    runServerS4().then(value => console.log(JSON.stringify({ coverage: value.coverage, validation: value.validation, manifest: value.manifest, peakWorkingSetBytes: value.peakWorkingSetBytes }, null, 2))).catch(error => { console.error(error); process.exitCode = 1; });
//# sourceMappingURL=server-s4-run.js.map