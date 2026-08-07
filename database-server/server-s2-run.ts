import { createHash } from "crypto";
import { readdir, readFile, writeFile, mkdir } from "fs/promises";
import { basename, resolve } from "path";
import { buildServerS2Coverage, buildServerS2Dataset, validateServerS2Dataset } from "./server-s2-builder";
import { ServerS2Manifest, ServerS2Observation, ServerS2SourceLineage } from "./server-s2-contract";

const MEMORY_LIMIT = 1024 * 1024 * 1024;
let peakWorkingSetBytes = 0;
function memory(): void { peakWorkingSetBytes = Math.max(peakWorkingSetBytes, process.memoryUsage().rss, process.resourceUsage().maxRSS * 1024); if (peakWorkingSetBytes > MEMORY_LIMIT) throw new Error(`S2 memory limit exceeded ${peakWorkingSetBytes}`); }
function sha256(value: Buffer | string): string { return createHash("sha256").update(value).digest("hex"); }
function text(value: unknown): string { return `${JSON.stringify(value, null, 2)}\n`; }
async function readVerified(dir: string, manifestName: string, expectedContractVersion: string): Promise<{ manifest: any; bytes: Buffer; path: string }> {
    const manifest = JSON.parse(await readFile(resolve(dir, manifestName), "utf8"));
    if (manifest.schemaVersion !== 1 || manifest.contractVersion !== expectedContractVersion || manifest.generatedAtPolicy !== "pinned_to_source_snapshot_for_reproducible_bytes" || manifest.compression !== "none") throw new Error(`S2 unsupported source contract ${manifestName}`);
    const path = resolve(dir, manifest.fileName), bytes = await readFile(path); memory();
    if (bytes.byteLength !== manifest.sizeBytes || sha256(bytes) !== manifest.sha256) throw new Error(`S2 source identity ${manifestName}`);
    const validationBytes = await readFile(resolve(dir, manifest.validation.fileName));
    if (validationBytes.byteLength !== manifest.validation.sizeBytes || sha256(validationBytes) !== manifest.validation.sha256 || JSON.parse(validationBytes.toString("utf8")).valid !== true) throw new Error(`S2 source validation ${manifestName}`);
    return { manifest, bytes, path };
}
async function cacheFingerprint(cacheDir: string, retainedNames: Set<string>): Promise<{ sha256: string; sizeBytes: number; fileCount: number; retained: Map<string, Buffer> }> {
    const names = (await readdir(cacheDir)).filter(name => name.endsWith(".json")).sort();
    const hash = createHash("sha256"); let sizeBytes = 0;
    const retained = new Map<string, Buffer>();
    for (const name of names) { const bytes = await readFile(resolve(cacheDir, name)); hash.update(`${name}\0${bytes.byteLength}\0${sha256(bytes)}\n`); sizeBytes += bytes.byteLength; if (retainedNames.has(name)) retained.set(name, bytes); memory(); }
    return { sha256: hash.digest("hex"), sizeBytes, fileCount: names.length, retained };
}

export async function runServerS2(options: { eventsDir?: string; cacheDir?: string; outputDir?: string } = {}) {
    peakWorkingSetBytes = 0;
    const eventsDir = resolve(options.eventsDir ?? resolve(process.cwd(), "data", "database-events"));
    const cacheDir = resolve(options.cacheDir ?? resolve(process.cwd(), "data", "dokkaninfo-events", "cache"));
    const outputDir = resolve(options.outputDir ?? resolve(process.cwd(), "data", "database-server", "s2"));
    const [e1, e2, e7] = await Promise.all([
        readVerified(eventsDir, "events-e1-manifest.json", "0.2.0"),
        readVerified(eventsDir, "events-e2-manifest.json", "0.3.0"),
        readVerified(eventsDir, "events-e7-manifest.json", "0.8.0"),
    ]);
    if (e1.manifest.sourceSnapshotVersion !== e2.manifest.sourceSnapshotVersion || e1.manifest.sourceSnapshotVersion !== e7.manifest.sourceSnapshotVersion || e2.manifest.sourceE1Sha256 !== e1.manifest.sha256 || e1.manifest.sourceDatabaseSha256 !== e2.manifest.sourceDatabaseSha256 || e1.manifest.sourceDatabaseSha256 !== e7.manifest.sourceDatabaseSha256) throw new Error("S2 source lineage mismatch");
    const e1Data = JSON.parse(e1.bytes.toString("utf8")), e2Data = JSON.parse(e2.bytes.toString("utf8")), e7Data = JSON.parse(e7.bytes.toString("utf8")); memory();
    const cacheNames = (await readdir(cacheDir)).filter(name => /^sdbattle-\d+\.json$/.test(name)).sort((left, right) => Number(left.match(/\d+/)![0]) - Number(right.match(/\d+/)![0]));
    const requiredCacheNames = [...cacheNames, "challenge-710.json", "challenge-720.json"];
    if (cacheNames.length !== 25 || cacheNames[0] !== "sdbattle-1.json" || cacheNames[24] !== "sdbattle-25.json") throw new Error("S2 Pettan cache identity set");
    const fullCacheBefore = await cacheFingerprint(cacheDir, new Set(requiredCacheNames));
    const e7CacheLineage = e7Data.legacySources?.find((value: any) => value.name === "event-rewards-cache");
    if (!e7CacheLineage || fullCacheBefore.sha256 !== e7CacheLineage.sha256 || fullCacheBefore.sizeBytes !== e7CacheLineage.sizeBytes || fullCacheBefore.fileCount !== e7CacheLineage.declaredCounts?.fileCount || fullCacheBefore.retained.size !== requiredCacheNames.length) throw new Error("S2 cache lineage mismatch with E7");
    const cacheValues = requiredCacheNames.map(name => ({ name, value: JSON.parse(fullCacheBefore.retained.get(name)!.toString("utf8")) })); memory();
    const cacheByName = new Map(cacheValues.map(value => [value.name, value.value]));
    const challengeRoots = ["710", "720"].map(id => {
        const event = cacheByName.get(`challenge-${id}.json`)?.event;
        if (!event || String(event.id) !== id || event.type !== "challenge") throw new Error(`S2 challenge cache ${id}`);
        return { id, type: String(event.type), stageIds: (event.stages ?? []).map((stage: any) => String(stage.id)), presentationName: String(event.name ?? "") };
    });
    const sdbattleRootIds = cacheNames.map(name => {
        const event = cacheByName.get(name)?.event, expected = name.match(/\d+/)![0];
        if (!event || String(event.id) !== expected || event.type !== "sdbattle") throw new Error(`S2 sdbattle cache ${name}`);
        return expected;
    });
    const subsetHash = createHash("sha256"); let subsetSizeBytes = 0;
    for (const name of [...requiredCacheNames].sort()) { const bytes = fullCacheBefore.retained.get(name)!; subsetHash.update(`${name}\0${bytes.byteLength}\0${sha256(bytes)}\n`); subsetSizeBytes += bytes.byteLength; }
    const fullCacheAfter = await cacheFingerprint(cacheDir, new Set());
    if (fullCacheAfter.sha256 !== fullCacheBefore.sha256 || fullCacheAfter.sizeBytes !== fullCacheBefore.sizeBytes || fullCacheAfter.fileCount !== fullCacheBefore.fileCount) throw new Error("S2 cache changed during read");
    const sourceLineage: ServerS2SourceLineage[] = [
        { key: "events_e1", path: `data/database-events/${basename(e1.path)}`, sha256: e1.manifest.sha256, sizeBytes: e1.manifest.sizeBytes, authority: "sqlite_first_party" },
        { key: "events_e2", path: `data/database-events/${basename(e2.path)}`, sha256: e2.manifest.sha256, sizeBytes: e2.manifest.sizeBytes, authority: "sqlite_first_party" },
        { key: "events_e7", path: `data/database-events/${basename(e7.path)}`, sha256: e7.manifest.sha256, sizeBytes: e7.manifest.sizeBytes, authority: "community_shadow" },
        { key: "dokkaninfo_family_cache", path: "data/dokkaninfo-events/cache/{challenge-710,challenge-720,sdbattle-1..25}.json", sha256: subsetHash.digest("hex"), sizeBytes: subsetSizeBytes, authority: "community_shadow" },
    ];
    const observation: ServerS2Observation = {
        sourceSnapshotVersion: e1.manifest.sourceSnapshotVersion,
        sourceLineage,
        areaIds: e1Data.catalog.filter((value: any) => value.identity.kind === "area").map((value: any) => String(value.identity.id)),
        budokaiIds: e1Data.catalog.filter((value: any) => value.identity.kind === "budokai").map((value: any) => String(value.identity.id)),
        rmbattleCandidateIds: (e1Data.opaqueRootFamilies ?? []).find((value: any) => value.family === "rmbattle")?.identities ?? [],
        questLevelsByArea: Object.fromEntries(["710", "720"].map(areaId => [areaId, e2Data.questStages.filter((value: any) => String(value.areaId) === areaId).flatMap((value: any) => value.levels.map((level: any) => String(level.identity.id)))])),
        sdMapIds: e2Data.sdTopologies.map((value: any) => String(value.identity.mapId)),
        sdbattleRootIds,
        challengeRoots,
        e7Families: e7Data.eventFamilies,
        unrootedTables: e1Data.unrootedCandidateTables,
    };
    const dataset = buildServerS2Dataset(observation), coverage = buildServerS2Coverage(dataset), validation = validateServerS2Dataset(dataset);
    if (!validation.valid) throw new Error(`S2 validation failed: ${validation.failures.join(", ")}`);
    const datasetText = text(dataset), coverageText = text(coverage), validationText = text(validation);
    const manifest: ServerS2Manifest = {
        schemaVersion: 1, contractVersion: "0.3.0", generatedAt: dataset.generatedAt, generatedAtPolicy: dataset.generatedAtPolicy,
        fileName: "server-s2-roots.json", compression: "none", sha256: sha256(datasetText), sizeBytes: Buffer.byteLength(datasetText), sourceSnapshotVersion: dataset.sourceSnapshotVersion,
        sourceLineageAggregateSha256: sha256(JSON.stringify(sourceLineage.map(value => [value.key, value.sha256, value.sizeBytes]))),
        coverage: { fileName: "server-s2-coverage.json", sha256: sha256(coverageText), sizeBytes: Buffer.byteLength(coverageText) },
        validation: { fileName: "server-s2-validation.json", sha256: sha256(validationText), sizeBytes: Buffer.byteLength(validationText) },
    };
    await mkdir(outputDir, { recursive: true });
    await Promise.all([
        writeFile(resolve(outputDir, manifest.fileName), datasetText),
        writeFile(resolve(outputDir, manifest.coverage.fileName), coverageText),
        writeFile(resolve(outputDir, manifest.validation.fileName), validationText),
        writeFile(resolve(outputDir, "server-s2-manifest.json"), text(manifest)),
    ]);
    memory();
    return { dataset, coverage, validation, manifest, peakWorkingSetBytes };
}

if (require.main === module) runServerS2().then(value => console.log(JSON.stringify({ coverage: value.coverage, validation: value.validation, manifest: value.manifest, peakWorkingSetBytes: value.peakWorkingSetBytes }, null, 2))).catch(error => { console.error(error); process.exitCode = 1; });
