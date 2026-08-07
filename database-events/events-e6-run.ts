import { createHash } from "crypto";
import { createReadStream, existsSync } from "fs";
import { mkdir, readFile, stat, writeFile } from "fs/promises";
import { resolve } from "path";
import { EventsE0Baseline } from "./events-e0-contract";
import { EventsE5Coverage, EventsE5Manifest, EventsE5Validation } from "./events-e5-contract";
import { runEventsApkBridge } from "./events-apk-adapter";
import { buildEventsE6Coverage, buildEventsE6Dataset } from "./events-e6-builder";
import { EventsE6ApkBaseline, EventsE6ApkObservation, EventsE6Manifest, EventsE6Observation } from "./events-e6-contract";
import { validateEventsE6ApkBaseline, validateEventsE6Dataset } from "./events-e6-validator";
import { runEventsSqliteBridge } from "./events-sqlite-adapter";

const DEFAULT_DATABASE = "D:/Dokkan/database/decrypted/dokkan-global-current.db", DEFAULT_APK = "D:/Dokkan/database/apk/dokkan-global-base.apk", DEFAULT_OUTPUT = resolve(process.cwd(), "data", "database-events"), MEMORY_LIMIT = 1024 * 1024 * 1024;
let peakWorkingSetBytes = 0;
function memory() { peakWorkingSetBytes = Math.max(peakWorkingSetBytes, process.memoryUsage().rss, process.resourceUsage().maxRSS * 1024); if (peakWorkingSetBytes > MEMORY_LIMIT) throw Error(`E6 memory limit exceeded ${peakWorkingSetBytes}`); }
const sha = (value: Buffer | string) => createHash("sha256").update(value).digest("hex");
async function fingerprint(path: string) { const metadata = await stat(path), hash = createHash("sha256"); await new Promise<void>((done, reject) => { const stream = createReadStream(path); stream.on("data", chunk => { hash.update(chunk); memory(); }); stream.on("error", reject); stream.on("end", done); }); return { sha256: hash.digest("hex"), sizeBytes: metadata.size, modifiedAtMs: metadata.mtimeMs }; }
function sourcePath(name: string) { const adjacent = resolve(__dirname, name); return existsSync(adjacent) ? adjacent : resolve(__dirname, "..", "..", "database-events", name); }
function verifyBytes(bytes: Buffer, expected: { sha256: string; sizeBytes: number }, label: string) { if (bytes.byteLength !== expected.sizeBytes || sha(bytes) !== expected.sha256) throw Error(`E6 ${label} artifact identity`); }

export async function runEventsE6(options: { databasePath?: string; apkPath?: string; outputDir?: string; e5Dir?: string } = {}) {
    peakWorkingSetBytes = 0;
    const databasePath = resolve(options.databasePath ?? DEFAULT_DATABASE), apkPath = resolve(options.apkPath ?? DEFAULT_APK), outputDir = resolve(options.outputDir ?? DEFAULT_OUTPUT), e5Dir = resolve(options.e5Dir ?? DEFAULT_OUTPUT);
    const baseline = JSON.parse(await readFile(sourcePath("events-e0-baseline.json"), "utf8")) as EventsE0Baseline, apkBaselineBytes = await readFile(sourcePath("events-e6-apk-baseline.json")), apkBaseline = JSON.parse(apkBaselineBytes.toString("utf8")) as EventsE6ApkBaseline, apkBaselineSha256 = sha(apkBaselineBytes);
    const e5Manifest = JSON.parse(await readFile(resolve(e5Dir, "events-e5-manifest.json"), "utf8")) as EventsE5Manifest;
    const [e5Fingerprint, e5CoverageBytes, e5ValidationBytes] = await Promise.all([fingerprint(resolve(e5Dir, e5Manifest.fileName)), readFile(resolve(e5Dir, e5Manifest.coverage.fileName)), readFile(resolve(e5Dir, e5Manifest.validation.fileName))]); memory();
    verifyBytes(e5CoverageBytes, e5Manifest.coverage, "E5 coverage"); verifyBytes(e5ValidationBytes, e5Manifest.validation, "E5 validation");
    const e5Coverage = JSON.parse(e5CoverageBytes.toString("utf8")) as EventsE5Coverage, e5Validation = JSON.parse(e5ValidationBytes.toString("utf8")) as EventsE5Validation;
    if (e5Manifest.contractVersion !== "0.6.0" || e5Manifest.generatedAtPolicy !== "pinned_to_source_snapshot_for_reproducible_bytes" || e5Manifest.generatedAt !== baseline.generatedAt || e5Manifest.sourceSnapshotVersion !== baseline.snapshotVersion || e5Manifest.sourceDatabaseSha256 !== baseline.sourceDatabase.sha256 || e5Fingerprint.sha256 !== e5Manifest.sha256 || e5Fingerprint.sizeBytes !== e5Manifest.sizeBytes || e5Coverage.danglingIdCount !== 0 || !e5Validation.valid || !e5Validation.exactProjection) throw Error("E6 E5 lineage");
    const databaseBefore = await fingerprint(databasePath), apkBefore = await fingerprint(apkPath); if (databaseBefore.sha256 !== baseline.sourceDatabase.sha256 || databaseBefore.sizeBytes !== baseline.sourceDatabase.sizeBytes || apkBefore.sha256 !== apkBaseline.sourceApk.sha256 || apkBefore.sizeBytes !== apkBaseline.sourceApk.sizeBytes) throw Error("E6 pinned source identity");
    const observation = await runEventsSqliteBridge<EventsE6Observation>("assets", databasePath, memory), apk = await runEventsApkBridge<EventsE6ApkObservation>(apkPath, memory); memory();
    const apkBaselineValid = validateEventsE6ApkBaseline(apkBaseline, apk, apkBefore.sha256, apkBefore.sizeBytes); if (!apkBaselineValid) throw Error("E6 APK baseline");
    const lineage = { generatedAt: baseline.generatedAt, sourceSnapshotVersion: baseline.snapshotVersion, sourceDatabaseSha256: databaseBefore.sha256, sourceE5Sha256: e5Manifest.sha256, sourceApkSha256: apkBefore.sha256, sourceApkSizeBytes: apkBefore.sizeBytes };
    const dataset = buildEventsE6Dataset({ observation, apk, ...lineage }), coverage = buildEventsE6Coverage(dataset, observation), validation = validateEventsE6Dataset(dataset, observation, apk, apkBaseline, apkBaselineValid, lineage);
    if (!validation.valid || coverage.danglingIdCount !== 0) throw Error(`E6 validation ${JSON.stringify(validation.failures)} dangling=${coverage.danglingIdCount}`);
    const databaseAfter = await fingerprint(databasePath), apkAfter = await fingerprint(apkPath); if (JSON.stringify(databaseBefore) !== JSON.stringify(databaseAfter) || JSON.stringify(apkBefore) !== JSON.stringify(apkAfter)) throw Error("E6 read-only source guarantee");
    const payloadText = `${JSON.stringify(dataset, null, 2)}\n`, coverageText = `${JSON.stringify(coverage, null, 2)}\n`, validationText = `${JSON.stringify(validation, null, 2)}\n`;
    const manifest: EventsE6Manifest = { schemaVersion: 1, contractVersion: "0.7.0", generatedAt: dataset.generatedAt, generatedAtPolicy: dataset.generatedAtPolicy, sourceSnapshotVersion: dataset.sourceSnapshotVersion, fileName: "events-e6-assets.json", compression: "none", sha256: sha(payloadText), sizeBytes: Buffer.byteLength(payloadText), sourceDatabaseSha256: dataset.sourceDatabaseSha256, sourceE5Sha256: dataset.sourceE5.sha256, sourceApkSha256: dataset.sourceApk.sha256, sourceApkSizeBytes: dataset.sourceApk.sizeBytes, apkBaselineSha256, coverage: { fileName: "events-e6-coverage.json", sha256: sha(coverageText), sizeBytes: Buffer.byteLength(coverageText) }, validation: { fileName: "events-e6-validation.json", sha256: sha(validationText), sizeBytes: Buffer.byteLength(validationText) } };
    await mkdir(outputDir, { recursive: true }); await Promise.all([writeFile(resolve(outputDir, manifest.fileName), payloadText), writeFile(resolve(outputDir, manifest.coverage.fileName), coverageText), writeFile(resolve(outputDir, manifest.validation.fileName), validationText), writeFile(resolve(outputDir, "events-e6-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`)]); memory();
    return { dataset, coverage, validation, manifest, peakWorkingSetBytes };
}

if (require.main === module) runEventsE6().then(value => console.log(JSON.stringify({ coverage: value.coverage, validation: value.validation, manifest: value.manifest, peakWorkingSetBytes: value.peakWorkingSetBytes }, null, 2))).catch(error => { console.error(error); process.exitCode = 1; });
