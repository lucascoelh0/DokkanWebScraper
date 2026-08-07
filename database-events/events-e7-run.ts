import { createHash } from "crypto";
import { createReadStream, existsSync } from "fs";
import { mkdir, readFile, readdir, stat, writeFile } from "fs/promises";
import { basename, resolve } from "path";
import { resolveEventsInputFile, resolveEventsOutputFiles } from "./events-artifact-path";
import { EventsE0Baseline } from "./events-e0-contract";
import { buildEventsE7Coverage, buildEventsE7Dataset } from "./events-e7-builder";
import { EventsE6Coverage, EventsE6Manifest, EventsE6Validation } from "./events-e6-contract";
import { EventsE7ImplementationBaseline, EventsE7Manifest, EventsE7Observation, EventsE7SourceLineage } from "./events-e7-contract";
import { runEventsParityBridge } from "./events-parity-adapter";
import { validateEventsE7Dataset } from "./events-e7-validator";

const DEFAULT_DATABASE = "D:/Dokkan/database/decrypted/dokkan-global-current.db", DEFAULT_OUTPUT = resolve(process.cwd(), "data", "database-events"), MEMORY_LIMIT = 1024 * 1024 * 1024;
let peakWorkingSetBytes = 0;
function memory() { peakWorkingSetBytes = Math.max(peakWorkingSetBytes, process.memoryUsage().rss, process.resourceUsage().maxRSS * 1024); if (peakWorkingSetBytes > MEMORY_LIMIT) throw Error(`E7 memory limit exceeded ${peakWorkingSetBytes}`); }
const sha = (value: Buffer | string) => createHash("sha256").update(value).digest("hex");
async function fingerprint(path: string) { const metadata = await stat(path), hash = createHash("sha256"); await new Promise<void>((done, reject) => { const stream = createReadStream(path); stream.on("data", chunk => { hash.update(chunk); memory(); }); stream.on("error", reject); stream.on("end", done); }); return { sha256: hash.digest("hex"), sizeBytes: metadata.size, modifiedAtMs: metadata.mtimeMs }; }
async function directoryFingerprint(path: string) { const names = (await readdir(path)).filter(value => value.endsWith(".json")).sort(), hash = createHash("sha256"); let sizeBytes = 0; for (const name of names) { const value = await fingerprint(resolve(path, name)); hash.update(`${name}\0${value.sizeBytes}\0${value.sha256}\n`); sizeBytes += value.sizeBytes; memory(); } return { sha256: hash.digest("hex"), sizeBytes, fileCount: names.length }; }
function sourcePath(name: string) { const adjacent = resolve(__dirname, name); return existsSync(adjacent) ? adjacent : resolve(__dirname, "..", "..", "database-events", name); }
function verifyBytes(bytes: Buffer, expected: { sha256: string; sizeBytes: number }, label: string) { if (bytes.byteLength !== expected.sizeBytes || sha(bytes) !== expected.sha256) throw Error(`E7 ${label} artifact identity`); }

export async function runEventsE7(options: { databasePath?: string; outputDir?: string; e6Dir?: string; rootDir?: string } = {}) {
    peakWorkingSetBytes = 0;
    const rootDir = resolve(options.rootDir ?? process.cwd()), databasePath = resolve(options.databasePath ?? DEFAULT_DATABASE), outputDir = resolve(options.outputDir ?? DEFAULT_OUTPUT), e6Dir = resolve(options.e6Dir ?? DEFAULT_OUTPUT);
    const baseline = JSON.parse(await readFile(sourcePath("events-e0-baseline.json"), "utf8")) as EventsE0Baseline;
    const implementationBaselineBytes = await readFile(sourcePath("events-e7-scraper-baseline.json")), implementationBaselineSha256 = sha(implementationBaselineBytes), implementationBaseline = JSON.parse(implementationBaselineBytes.toString("utf8")) as EventsE7ImplementationBaseline;
    if (implementationBaseline.schemaVersion !== 1 || new Set(implementationBaseline.files.map(value => value.fileName)).size !== implementationBaseline.files.length) throw Error("E7 implementation baseline contract");
    const e6Manifest = JSON.parse(await readFile(await resolveEventsInputFile(e6Dir, "events-e6-manifest.json", "events-e6-manifest.json"), "utf8")) as EventsE6Manifest;
    const [e6Path, e6CoveragePath, e6ValidationPath] = await Promise.all([resolveEventsInputFile(e6Dir, e6Manifest.fileName, "events-e6-assets.json"), resolveEventsInputFile(e6Dir, e6Manifest.coverage?.fileName, "events-e6-coverage.json"), resolveEventsInputFile(e6Dir, e6Manifest.validation?.fileName, "events-e6-validation.json")]);
    const [e6Fingerprint, e6CoverageBytes, e6ValidationBytes] = await Promise.all([fingerprint(e6Path), readFile(e6CoveragePath), readFile(e6ValidationPath)]); memory();
    verifyBytes(e6CoverageBytes, e6Manifest.coverage, "E6 coverage"); verifyBytes(e6ValidationBytes, e6Manifest.validation, "E6 validation");
    const e6Coverage = JSON.parse(e6CoverageBytes.toString("utf8")) as EventsE6Coverage, e6Validation = JSON.parse(e6ValidationBytes.toString("utf8")) as EventsE6Validation;
    if (e6Manifest.contractVersion !== "0.7.0" || e6Manifest.generatedAt !== baseline.generatedAt || e6Manifest.sourceSnapshotVersion !== baseline.snapshotVersion || e6Manifest.sourceDatabaseSha256 !== baseline.sourceDatabase.sha256 || e6Fingerprint.sha256 !== e6Manifest.sha256 || e6Fingerprint.sizeBytes !== e6Manifest.sizeBytes || e6Coverage.danglingIdCount !== 0 || !e6Validation.valid || !e6Validation.exactProjection) throw Error("E7 E6 lineage");
    const paths = {
        database: databasePath,
        questStory: resolve(rootDir, "data/stages/latest/quest-story-stages.json"), eventStages: resolve(rootDir, "data/stages/latest/event-stages.json"), stageCatalog: resolve(rootDir, "data/stage-catalog/latest/stage-catalog.json"), stageDetails: resolve(rootDir, "data/stage-details/latest/stage-details.json"), zBattles: resolve(rootDir, "data/z-battles/latest/z-battles.json"), frontierSeries: resolve(rootDir, "data/dokkan-frontier/latest/dokkan-frontier-series.json"), frontierChapters: resolve(rootDir, "data/dokkan-frontier/latest/dokkan-frontier-chapters.json"), eventRewards: resolve(rootDir, "data/dokkaninfo-events/latest/event-rewards.json"), eventMissions: resolve(rootDir, "data/event-missions/latest/event-missions.json"), eventCache: resolve(rootDir, "data/dokkaninfo-events/cache"),
    };
    const sourceEntries = [
        ["quest-story-stages", paths.questStory], ["event-stages", paths.eventStages], ["stage-catalog", paths.stageCatalog], ["stage-details", paths.stageDetails], ["z-battles", paths.zBattles], ["dokkan-frontier-series", paths.frontierSeries], ["dokkan-frontier-chapters", paths.frontierChapters], ["event-rewards", paths.eventRewards], ["event-missions", paths.eventMissions],
    ] as const;
    const implementationPaths = ["fyi-stages.ts", "fyi-z-battles.ts", "fyi-dokkan-frontier.ts", "fyi-event-missions.ts", "dokkaninfo-event-rewards.ts"];
    const databaseBefore = await fingerprint(databasePath); if (databaseBefore.sha256 !== baseline.sourceDatabase.sha256 || databaseBefore.sizeBytes !== baseline.sourceDatabase.sizeBytes) throw Error("E7 pinned database identity");
    const sourceBefore = await Promise.all(sourceEntries.map(async ([name, path]) => ({ name, path, ...(await fingerprint(path)) }))), cacheBefore = await directoryFingerprint(paths.eventCache), implementationBefore = await Promise.all(implementationPaths.map(async fileName => ({ fileName, ...(await fingerprint(resolve(rootDir, fileName))) }))); memory();
    const expectedImplementations = new Map(implementationBaseline.files.map(value => [value.fileName, value]));
    if (implementationBefore.length !== implementationBaseline.files.length || implementationBefore.some(value => expectedImplementations.get(value.fileName)?.sha256 !== value.sha256)) throw Error("E7 scraper implementation evidence changed; pagination claims require re-audit");
    const observation = await runEventsParityBridge<EventsE7Observation>(paths, memory); memory();
    const summaries = new Map(observation.sources.map(value => [value.name, value]));
    const legacySources: EventsE7SourceLineage[] = sourceBefore.map(value => { const summary = summaries.get(value.name); if (!summary) throw Error(`E7 missing source summary ${value.name}`); return { name: value.name, fileName: basename(value.path), sha256: value.sha256, sizeBytes: value.sizeBytes, generatedAt: summary.generatedAt, source: summary.source, declaredCounts: summary.declaredCounts }; });
    legacySources.push({ name: "event-rewards-cache", fileName: "cache/", sha256: cacheBefore.sha256, sizeBytes: cacheBefore.sizeBytes, generatedAt: summaries.get("event-rewards")!.generatedAt, source: "dokkaninfo", declaredCounts: { fileCount: cacheBefore.fileCount } });
    const implementationEvidence = implementationBefore.map(({ fileName, sha256, sizeBytes }) => ({ fileName, sha256, sizeBytes }));
    const lineage = { generatedAt: baseline.generatedAt, sourceSnapshotVersion: baseline.snapshotVersion, sourceDatabaseSha256: databaseBefore.sha256, sourceE6Sha256: e6Manifest.sha256 };
    const dataset = buildEventsE7Dataset({ observation, legacySources, implementationEvidence, implementationBaselineSha256, ...lineage }), coverage = buildEventsE7Coverage(dataset, observation), validation = validateEventsE7Dataset(dataset, observation, legacySources, implementationEvidence, implementationBaselineSha256, lineage);
    if (!validation.valid) throw Error(`E7 validation ${JSON.stringify(validation.failures)}`);
    const databaseAfter = await fingerprint(databasePath), sourceAfter = await Promise.all(sourceEntries.map(async ([name, path]) => ({ name, path, ...(await fingerprint(path)) }))), cacheAfter = await directoryFingerprint(paths.eventCache), implementationAfter = await Promise.all(implementationPaths.map(async fileName => ({ fileName, ...(await fingerprint(resolve(rootDir, fileName))) }))), implementationBaselineAfter = await readFile(sourcePath("events-e7-scraper-baseline.json")); memory();
    if (JSON.stringify(databaseBefore) !== JSON.stringify(databaseAfter) || JSON.stringify(sourceBefore) !== JSON.stringify(sourceAfter) || JSON.stringify(cacheBefore) !== JSON.stringify(cacheAfter) || JSON.stringify(implementationBefore) !== JSON.stringify(implementationAfter) || !implementationBaselineBytes.equals(implementationBaselineAfter)) throw Error("E7 read-only source guarantee");
    const payloadText = `${JSON.stringify(dataset, null, 2)}\n`, coverageText = `${JSON.stringify(coverage, null, 2)}\n`, validationText = `${JSON.stringify(validation, null, 2)}\n`;
    const legacySourceAggregateSha256 = sha(JSON.stringify(legacySources.map(value => [value.name, value.sha256, value.sizeBytes])));
    const manifest: EventsE7Manifest = { schemaVersion: 1, contractVersion: "0.8.0", generatedAt: dataset.generatedAt, generatedAtPolicy: dataset.generatedAtPolicy, sourceSnapshotVersion: dataset.sourceSnapshotVersion, fileName: "events-e7-shadow-parity.json", compression: "none", sha256: sha(payloadText), sizeBytes: Buffer.byteLength(payloadText), sourceDatabaseSha256: dataset.sourceDatabaseSha256, sourceE6Sha256: dataset.sourceE6.sha256, legacySourceAggregateSha256, implementationBaselineSha256, coverage: { fileName: "events-e7-coverage.json", sha256: sha(coverageText), sizeBytes: Buffer.byteLength(coverageText) }, validation: { fileName: "events-e7-validation.json", sha256: sha(validationText), sizeBytes: Buffer.byteLength(validationText) } };
    await mkdir(outputDir, { recursive: true }); const outputs = await resolveEventsOutputFiles(outputDir, [manifest.fileName, manifest.coverage.fileName, manifest.validation.fileName, "events-e7-manifest.json"]); await Promise.all([writeFile(outputs.get(manifest.fileName)!, payloadText), writeFile(outputs.get(manifest.coverage.fileName)!, coverageText), writeFile(outputs.get(manifest.validation.fileName)!, validationText), writeFile(outputs.get("events-e7-manifest.json")!, `${JSON.stringify(manifest, null, 2)}\n`)]); memory();
    return { dataset, coverage, validation, manifest, peakWorkingSetBytes };
}

if (require.main === module) runEventsE7().then(value => console.log(JSON.stringify({ coverage: value.coverage, validation: value.validation, manifest: value.manifest, peakWorkingSetBytes: value.peakWorkingSetBytes }, null, 2))).catch(error => { console.error(error); process.exitCode = 1; });
