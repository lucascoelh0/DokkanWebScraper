import { createHash } from "crypto";
import { createReadStream } from "fs";
import { mkdir, readFile, stat, writeFile } from "fs/promises";
import { basename, resolve } from "path";
import { buildServerS4Coverage, buildServerS4Dataset, validateServerS4Dataset } from "./server-s4-builder";
import { ServerS4Manifest, ServerS4Observation, ServerS4SourceLineage } from "./server-s4-contract";

const MEMORY_LIMIT = 1024 * 1024 * 1024;
let peakWorkingSetBytes = 0;
function memory(): void { peakWorkingSetBytes = Math.max(peakWorkingSetBytes, process.memoryUsage().rss, process.resourceUsage().maxRSS * 1024); if (peakWorkingSetBytes > MEMORY_LIMIT) throw new Error(`S4 memory limit exceeded ${peakWorkingSetBytes}`); }
function sha256(value: Buffer | string): string { return createHash("sha256").update(value).digest("hex"); }
function text(value: unknown): string { return `${JSON.stringify(value, null, 2)}\n`; }
async function fingerprint(path: string): Promise<{ sha256: string; sizeBytes: number }> {
    const info = await stat(path), hash = createHash("sha256");
    await new Promise<void>((done, reject) => { const stream = createReadStream(path); stream.on("data", chunk => { hash.update(chunk); memory(); }); stream.on("error", reject); stream.on("end", done); });
    return { sha256: hash.digest("hex"), sizeBytes: info.size };
}
async function readVerified(dir: string, manifestName: string, contractVersion: string, generatedAtPolicy: string) {
    const manifest = JSON.parse(await readFile(resolve(dir, manifestName), "utf8"));
    if (manifest.schemaVersion !== 1 || manifest.contractVersion !== contractVersion || manifest.generatedAtPolicy !== generatedAtPolicy || manifest.compression !== "none") throw new Error(`S4 source contract ${manifestName}`);
    const path = resolve(dir, manifest.fileName), bytes = await readFile(path); memory();
    if (bytes.byteLength !== manifest.sizeBytes || sha256(bytes) !== manifest.sha256) throw new Error(`S4 source payload ${manifestName}`);
    if (!manifest.validation?.fileName || !manifest.validation?.sha256 || !manifest.validation?.sizeBytes) throw new Error(`S4 missing source validation ${manifestName}`);
    const validationBytes = await readFile(resolve(dir, manifest.validation.fileName));
    if (validationBytes.byteLength !== manifest.validation.sizeBytes || sha256(validationBytes) !== manifest.validation.sha256 || JSON.parse(validationBytes.toString("utf8")).valid !== true) throw new Error(`S4 source validation ${manifestName}`);
    return { manifest, path, bytes };
}
function extractNativeEvidence(bytes: Buffer): { containers: string[]; splitManifest: boolean } {
    const containers = new Set<string>(); let start = -1, splitManifest = false;
    for (let index = 0; index <= bytes.length; index++) {
        const code = index < bytes.length ? bytes[index] : 0;
        if (code >= 32 && code <= 126) { if (start < 0) start = index; continue; }
        if (start >= 0 && index - start >= 4 && index - start <= 240) {
            const value = bytes.subarray(start, index).toString("ascii");
            if (value === "client_assets_splited.json") splitManifest = true;
            if (/^[A-Za-z0-9_./%-]+\.cpk$/.test(value)) containers.add(value);
        }
        start = -1;
        if ((index & 0xfffff) === 0) memory();
    }
    return { containers: [...containers].sort(), splitManifest };
}

export async function runServerS4(options: { serverDir?: string; eventsDir?: string; elfPath?: string; metadataPath?: string; outputDir?: string } = {}) {
    peakWorkingSetBytes = 0;
    const serverDir = resolve(options.serverDir ?? resolve(process.cwd(), "data", "database-server", "s0")), eventsDir = resolve(options.eventsDir ?? resolve(process.cwd(), "data", "database-events"));
    const elfPath = resolve(options.elfPath ?? "D:/Dokkan/database/apk/extracted/lib/arm64-v8a/libcocos2dcpp.so");
    const metadataPath = resolve(options.metadataPath ?? resolve(process.cwd(), "game-db", "data", "game-db-acquisition", "first-party", "latest", "metadata.json"));
    const outputDir = resolve(options.outputDir ?? resolve(process.cwd(), "data", "database-server", "s4"));
    const [s0, e6, elfBytes, metadataBytes] = await Promise.all([
        readVerified(serverDir, "server-s0-manifest.json", "0.1.0", "pinned_to_static_evidence_checkpoint"),
        readVerified(eventsDir, "events-e6-manifest.json", "0.7.0", "pinned_to_source_snapshot_for_reproducible_bytes"),
        readFile(elfPath), readFile(metadataPath),
    ]); memory();
    const elfInfo = await stat(elfPath), elfFingerprint = { sha256: sha256(elfBytes), sizeBytes: elfBytes.byteLength };
    if (elfInfo.size !== elfBytes.byteLength) throw new Error("S4 ELF changed during initial read");
    const s0Data = JSON.parse(s0.bytes.toString("utf8")), e6Data = JSON.parse(e6.bytes.toString("utf8")), historicalMetadata = JSON.parse(metadataBytes.toString("utf8")); memory();
    const elfEvidence = s0Data.evidence.find((value: any) => value.id === "global-elf-6.4.0-v338");
    if (!elfEvidence || elfEvidence.sha256 !== elfFingerprint.sha256 || elfEvidence.sizeBytes !== elfFingerprint.sizeBytes || e6.manifest.sourceSnapshotVersion !== s0.manifest.sourceSnapshotVersion || e6.manifest.sourceApkSha256 !== s0Data.evidence.find((value: any) => value.id === "global-apk-6.4.0-v338")?.sha256) throw new Error("S4 S0/E6/ELF lineage");
    if (historicalMetadata.source !== "first-party-export" || historicalMetadata.region !== "global" || !historicalMetadata.exportedAt || !historicalMetadata.dbVersion || !historicalMetadata.assetVersion || !historicalMetadata.apkVersion) throw new Error("S4 historical metadata contract");
    const native = extractNativeEvidence(elfBytes); memory();
    if (native.containers.length !== 94 || !native.splitManifest) throw new Error("S4 pinned native delivery evidence changed");
    const elfAfter = await fingerprint(elfPath);
    if (elfAfter.sha256 !== elfFingerprint.sha256 || elfAfter.sizeBytes !== elfFingerprint.sizeBytes) throw new Error("S4 ELF changed during scan");
    const metadataFingerprint = { sha256: sha256(metadataBytes), sizeBytes: metadataBytes.byteLength };
    const sourceLineage: ServerS4SourceLineage[] = [
        { key: "server_s0", path: `data/database-server/s0/${basename(s0.path)}`, sha256: s0.manifest.sha256, sizeBytes: s0.manifest.sizeBytes, authority: "official_static" },
        { key: "events_e6", path: `data/database-events/${basename(e6.path)}`, sha256: e6.manifest.sha256, sizeBytes: e6.manifest.sizeBytes, authority: "sqlite_first_party" },
        { key: "native_elf", path: elfPath.replace(/\\/g, "/"), sha256: elfFingerprint.sha256, sizeBytes: elfFingerprint.sizeBytes, authority: "official_static" },
        { key: "historical_acquisition_metadata", path: "game-db/data/game-db-acquisition/first-party/latest/metadata.json", sha256: metadataFingerprint.sha256, sizeBytes: metadataFingerprint.sizeBytes, authority: "historical_first_party_export" },
    ];
    const observation: ServerS4Observation = {
        sourceSnapshotVersion: e6.manifest.sourceSnapshotVersion, sourceLineage, currentApkVersion: "6.4.0-v338", historicalMetadata, nativeContainerKeys: native.containers, hasSplitManifestLiteral: native.splitManifest,
        e6: { pathAssetCount: e6Data.pathAssets.length, numericAssetCount: e6Data.numericAssets.length, bindingCount: e6Data.bindings.length, directBaseApkPathCount: e6Data.downloadBoundary.directDatabasePathPresentInBaseApkCount, bundledCandidateCount: e6Data.numericAssets.reduce((sum: number, value: any) => sum + value.bundledCandidates.length, 0) + e6Data.pathAssets.filter((value: any) => value.baseApkPrefixedCandidate !== null).length, assetEntryCount: e6Data.sourceApk.assetEntryCount, cpkContainerCount: e6Data.downloadBoundary.cpkContainerCount, samples: e6Data.apkAssetInventory.representativeSamples },
    };
    const dataset = buildServerS4Dataset(observation), coverage = buildServerS4Coverage(dataset), validation = validateServerS4Dataset(dataset);
    if (!validation.valid) throw new Error(`S4 validation failed: ${validation.failures.join(", ")}`);
    const datasetText = text(dataset), coverageText = text(coverage), validationText = text(validation);
    const manifest: ServerS4Manifest = { schemaVersion: 1, contractVersion: "0.5.0", generatedAt: dataset.generatedAt, generatedAtPolicy: dataset.generatedAtPolicy, fileName: "server-s4-asset-delivery.json", compression: "none", sha256: sha256(datasetText), sizeBytes: Buffer.byteLength(datasetText), sourceSnapshotVersion: dataset.sourceSnapshotVersion, sourceLineageAggregateSha256: sha256(JSON.stringify(sourceLineage.map(value => [value.key, value.sha256, value.sizeBytes]))), coverage: { fileName: "server-s4-coverage.json", sha256: sha256(coverageText), sizeBytes: Buffer.byteLength(coverageText) }, validation: { fileName: "server-s4-validation.json", sha256: sha256(validationText), sizeBytes: Buffer.byteLength(validationText) } };
    await mkdir(outputDir, { recursive: true });
    await Promise.all([writeFile(resolve(outputDir, manifest.fileName), datasetText), writeFile(resolve(outputDir, manifest.coverage.fileName), coverageText), writeFile(resolve(outputDir, manifest.validation.fileName), validationText), writeFile(resolve(outputDir, "server-s4-manifest.json"), text(manifest))]); memory();
    return { dataset, coverage, validation, manifest, peakWorkingSetBytes };
}

if (require.main === module) runServerS4().then(value => console.log(JSON.stringify({ coverage: value.coverage, validation: value.validation, manifest: value.manifest, peakWorkingSetBytes: value.peakWorkingSetBytes }, null, 2))).catch(error => { console.error(error); process.exitCode = 1; });
