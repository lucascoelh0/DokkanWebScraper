import { createHash } from "crypto";
import { spawnSync } from "child_process";
import { lstat, mkdir, readFile, realpath, writeFile } from "fs/promises";
import { dirname, isAbsolute, relative, resolve, sep, basename } from "path";
import { gunzipSync, gzipSync } from "zlib";
import { buildIndex, check, HIPO_VERSION, int, Source } from "./game-db-hidden-potential-core";

// Fixed to the repository containing this module, independent of process cwd or lib output.
const REPO = resolve(__dirname, basename(dirname(__dirname)) === "lib" ? "../.." : "..");
export const HIPO_ROOT = resolve(REPO, "game-db/data/hidden-potential");
export const DB_SHA = "7a6ca01808aea355ef28f9c0190e2c072f43a7c08be41d363f5b052824922495";
export const RUNTIME_SHA = "a1592e635bad24ef270fa3a28383a3032effd5f4709c17dd2acde1f7fd7e38f7";
export const PRIMARY_SHA = "57d02c518634574311b471fb77e0c084996f1a32cb3d341d9a25a262da02c9c3";
const MAX_MANIFEST = 2 * 1024 * 1024;
export const sha256 = (b: Buffer) => createHash("sha256").update(b).digest("hex");
export interface Options {
    db: string; elf: string; layout20: string; layout201: string; python: string;
    primaryManifest: string; primaryPayload: string; enrichmentManifest: string; enrichmentDir: string;
    outputDir: string; generatedAt: string;
}
const FLAGS: Record<string, keyof Options> = {
    "--db": "db", "--elf": "elf", "--layout20": "layout20", "--layout201": "layout201", "--python": "python",
    "--primary-manifest": "primaryManifest", "--primary-payload": "primaryPayload",
    "--enrichment-manifest": "enrichmentManifest", "--enrichment-dir": "enrichmentDir",
    "--output-dir": "outputDir", "--generated-at": "generatedAt",
};
export function parseArgs(args: string[]): Options {
    check(args[0] === "--opt-in-offline", "Explicit --opt-in-offline must be first");
    const values: Partial<Options> = {};
    for (let i = 1; i < args.length; i++) {
        const split = args[i].indexOf("="); const flag = split < 0 ? args[i] : args[i].slice(0, split);
        check(Object.prototype.hasOwnProperty.call(FLAGS, flag), `Unknown argument: ${flag}`);
        const value = split < 0 ? args[++i] : args[i].slice(split + 1); const key = FLAGS[flag];
        check(value && !value.startsWith("--") && values[key] === undefined, `Missing/duplicate ${flag}`);
        if (key !== "generatedAt") check(!/^(?:[a-z]+:\/\/|[\\/]{2})/i.test(value), "Only local filesystem paths are allowed");
        values[key] = key === "generatedAt" ? value : resolve(value);
    }
    for (const key of Object.values(FLAGS)) check(values[key], `Missing ${key}`);
    const at = Date.parse(values.generatedAt!); check(Number.isFinite(at) && new Date(at).toISOString() === values.generatedAt, "Invalid generatedAt");
    return values as Options;
}
function inside(root: string, file: string) { const r = relative(root, file); return r !== "" && r !== ".." && !r.startsWith(`..${sep}`) && !isAbsolute(r); }
async function exists(path: string) {
    return lstat(path).catch(e => { if (e.code !== "ENOENT") throw e; return null; });
}
export async function bounded(file: string, max: number): Promise<Buffer> {
    const s = await lstat(file); check(s.isFile() && !s.isSymbolicLink() && s.size > 0 && s.size <= max, "Invalid input file/size");
    const b = await readFile(file); check(b.length === s.size && b.length <= max, "Input changed while reading"); return b;
}
export interface Descriptor { sha256: string; sizeBytes: number; expandedSizeBytes: number; objectKey?: string; contentEncoding?: string; contentType?: string }
export async function readPayload(file: string, d: Descriptor) {
    check(d && /^[a-f0-9]{64}$/.test(d.sha256), "Invalid payload digest");
    int(d.sizeBytes, "compressed size", 1, 32 * 1024 * 1024); int(d.expandedSizeBytes, "expanded size", 1, 128 * 1024 * 1024);
    const bytes = await bounded(file, d.sizeBytes); check(bytes.length === d.sizeBytes && sha256(bytes) === d.sha256, "Payload hash/size mismatch");
    const raw = gunzipSync(bytes, { maxOutputLength: d.expandedSizeBytes }); check(raw.length === d.expandedSizeBytes, "Expanded size mismatch");
    return JSON.parse(raw.toString("utf8"));
}
function cardId(id: unknown): number { check(typeof id === "string" && /^[1-9]\d{0,9}$/.test(id), "Invalid exact card ID"); return int(Number(id), "card ID", 1); }
export async function readRoster(o: Pick<Options, "primaryManifest" | "primaryPayload" | "enrichmentManifest" | "enrichmentDir">) {
    const inventory: { role: string; sha256: string; sizeBytes: number }[] = [];
    const manifest = async (file: string, role: string) => { const b = await bounded(file, MAX_MANIFEST); inventory.push({ role, sha256: sha256(b), sizeBytes: b.length }); return JSON.parse(b.toString("utf8")); };
    const p = await manifest(o.primaryManifest, "primary-manifest"); const e = await manifest(o.enrichmentManifest, "enrichment-manifest");
    check(p.schemaVersion === 1 && p.compression === "gzip" && typeof p.datasetVersion === "string" && p.datasetVersion.length > 0, "Unsupported primary manifest");
    const pd = { sha256: p.sha256, sizeBytes: p.sizeBytes, expandedSizeBytes: p.uncompressedSizeBytes };
    const primary = await readPayload(o.primaryPayload, pd); inventory.push({ role: "primary-payload", sha256: pd.sha256, sizeBytes: pd.sizeBytes });
    check(Array.isArray(primary) && primary.length === int(p.characterCount, "primary count", 1, 10000), "Primary roster mismatch");
    const ids = new Set<number>(); for (const c of primary) { const id = cardId(c?.id); check(!ids.has(id), "Duplicate primary card"); ids.add(id); }
    check(e.schemaVersion === 1 && e.contract === "dokkan-character-detail-enrichment" && e.contractVersion === "1.0.0"
        && e.source === "dokkan-game-db" && e.sourceSnapshotVersion === "1788329250" && e.sourceDatabaseSha256 === DB_SHA
        && typeof e.datasetVersion === "string" && e.datasetVersion.length > 0, "Unsupported enrichment source");
    const binding = e.sourceBindings?.primaryCharacters;
    check(binding?.payloadSha256 === p.sha256 && binding?.datasetVersion === p.datasetVersion && binding?.characterCount === p.characterCount, "Roster binding mismatch");
    check(Array.isArray(e.shards) && e.shards.length === int(e.shardCount, "shard count", 1, 200), "Shard count mismatch");
    const root = await realpath(o.enrichmentDir); const objects = new Set<string>();
    const payload = async (d: Descriptor, role: string) => {
        check(d?.contentEncoding === "gzip" && d.contentType === "application/json" && /^character-details\/objects\/[a-f0-9]{64}\.json\.gz$/.test(d.objectKey || ""), "Invalid enrichment descriptor");
        check(d.objectKey === `character-details/objects/${d.sha256}.json.gz` && !objects.has(d.objectKey), "Duplicate/mismatched object"); objects.add(d.objectKey);
        const path = await realpath(resolve(root, d.objectKey)); check(inside(root, path), "Enrichment path escaped root");
        const value = await readPayload(path, d); inventory.push({ role, sha256: d.sha256, sizeBytes: d.sizeBytes });
        check(value.schemaVersion === 1 && value.contract === e.contract && value.contractVersion === e.contractVersion && value.datasetVersion === e.datasetVersion, "Enrichment payload identity mismatch"); return value;
    };
    const catalog = await payload(e.catalog, "enrichment-catalog");
    check(catalog.sourceDatabaseSha256 === DB_SHA && catalog.sourceSnapshotVersion === e.sourceSnapshotVersion && catalog.source === e.source
        && JSON.stringify(catalog.sourceBindings) === JSON.stringify(e.sourceBindings), "Catalog source mismatch");
    check(Array.isArray(catalog.entries) && catalog.entries.length === e.cardCount && catalog.count === e.cardCount, "Catalog count mismatch");
    const entries = new Map<number, any>();
    for (const entry of catalog.entries) { const id = cardId(entry?.identity?.cardId); check(!ids.has(id) && !entries.has(id), "Overlapping/duplicate detail ID"); entries.set(id, entry); }
    const seen = new Set<number>(); const shardIds = new Set<string>();
    for (const s of e.shards) {
        check(typeof s.id === "string" && /^\d{4}$/.test(s.id) && !shardIds.has(s.id), "Invalid shard ID"); shardIds.add(s.id);
        check(Array.isArray(s.cardIds) && s.cardIds.length > 0, "Missing shard IDs");
        const declared = new Set<number>(s.cardIds.map(cardId)); check(declared.size === s.cardIds.length, "Duplicate shard declared ID");
        const shard = await payload(s, `enrichment-shard-${s.id}`);
        check(shard.shardId === s.id && Array.isArray(shard.records) && shard.records.length === declared.size, "Shard identity/count mismatch");
        for (const r of shard.records) {
            const id = cardId(r?.identity?.cardId); const entry = entries.get(id);
            check(declared.has(id) && entry?.detailShardId === s.id && !seen.has(id) && cardId(r.detail?.id) === id, "Detail join mismatch");
            check(r.form?.kind === "awakening-card" && r.canonicalNavigation?.cardId === String(id) && r.canonicalNavigation?.releaseState === "base", "Unsupported detail identity/form");
            check(JSON.stringify(r.identity) === JSON.stringify(entry.identity), "Catalog identity mismatch");
            seen.add(id);
        }
    }
    check(seen.size === int(e.cardCount, "enrichment count", 1, 10000) && seen.size === entries.size, "Incomplete enrichment scope");
    return { ids: [...ids, ...seen].sort((a, b) => a - b), inventory,
        primaryCount: ids.size, enrichmentCount: seen.size, primarySha256: p.sha256,
        datasets: { primary: p.datasetVersion, enrichment: e.datasetVersion } };
}

/** No output exists before all inputs/calculations succeed. Manifest is the completion marker. */
export async function writeCandidate(outputDir: string, index: any, coverage: any, inventory: any[]) {
    const root = resolve(HIPO_ROOT); const target = resolve(outputDir);
    check(dirname(target) === root && /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,100}$/.test(basename(target)), "Output must be a direct new HIPO child");
    // Reject junctions/symlinks at every ancestor, including a replaced data/root directory.
    const chain: string[] = []; for (let p = root; ; p = dirname(p)) { chain.unshift(p); if (dirname(p) === p) break; }
    for (const p of chain) {
        const info = await exists(p);
        if (info) { check(info.isDirectory() && !info.isSymbolicLink(), "Output ancestor is a link/non-directory"); check((await realpath(p)).toLowerCase() === p.toLowerCase(), "Output ancestor resolves elsewhere"); }
        else await mkdir(p);
    }
    check(!(await exists(target)), "Output directory already exists");
    const raw = Buffer.from(JSON.stringify(index) + "\n"); const gzip = gzipSync(raw, { level: 9 });
    const digest = sha256(gzip); const fileName = `${digest}.json.gz`;
    const manifest = { schemaVersion: 1, contract: "dokkan-hidden-potential", contractVersion: HIPO_VERSION,
        producerVersion: HIPO_VERSION, generatedAt: index.generatedAt, localOnly: true, source: index.source,
        sourceArtifacts: inventory, coverage,
        catalog: { objectKey: fileName, sha256: digest, sizeBytes: gzip.length, expandedSizeBytes: raw.length, contentEncoding: "gzip", contentType: "application/json" } };
    const report = { ...coverage, sourceArtifacts: inventory, localOnly: true, publicationPerformed: false, legacyUnchanged: true,
        delivery: { indexGzipBytes: gzip.length, indexExpandedBytes: raw.length, lookup: "byCardId[exactId] -> states[state] + boards[boardId].presets[preset]" } };
    // mkdir is the exclusive no-clobber reservation. A failed write leaves no valid manifest.
    await mkdir(target);
    await writeFile(resolve(target, fileName), gzip, { flag: "wx" });
    await readPayload(resolve(target, fileName), manifest.catalog);
    await writeFile(resolve(target, "hidden-potential-audit.json"), JSON.stringify(report, null, 2) + "\n", { flag: "wx" });
    await writeFile(resolve(target, "hidden-potential-manifest.json"), JSON.stringify(manifest) + "\n", { flag: "wx" });
    return { outputDir: target, manifest, manifestSha256: sha256(Buffer.from(JSON.stringify(manifest) + "\n")), coverage };
}
export async function run(o: Options) {
    for (const key of Object.values(FLAGS)) if (key !== "generatedAt") {
        check(typeof o[key] === "string" && isAbsolute(o[key]) && !/^[\\/]{2}/.test(o[key]), "Expected absolute local input/output paths");
    }
    const roster = await readRoster(o);
    check(roster.primaryCount === 1442 && roster.enrichmentCount === 2768 && roster.primarySha256 === PRIMARY_SHA, "Unknown scoped roster snapshot");
    const python = await realpath(o.python); check((await lstat(python)).isFile(), "Invalid Python executable");
    const bridge = resolve(REPO, "game-db/game-db-hidden-potential-sqlite.py");
    const child = spawnSync(python, [bridge, "--db", o.db, "--elf", o.elf, "--layout20", o.layout20, "--layout201", o.layout201],
        { input: JSON.stringify(roster.ids), encoding: "utf8", maxBuffer: 16 * 1024 * 1024, timeout: 120000, windowsHide: true, shell: false });
    check(!child.error && child.status === 0, `HIPO bridge failed: ${child.error?.message || child.stderr?.slice(0, 1500)}`);
    const source: Source = JSON.parse(child.stdout);
    check(source.provenance.databaseSha256 === DB_SHA && source.provenance.runtimeSha256 === RUNTIME_SHA, "Bridge provenance mismatch");
    const built = buildIndex(source, roster.ids, o.generatedAt);
    const producers = [];
    for (const name of ["core.ts", "run.ts", "sqlite.py"]) {
        const b = await bounded(resolve(REPO, `game-db/game-db-hidden-potential-${name}`), 1024 * 1024);
        producers.push({ role: `producer-${name}`, sha256: sha256(b), sizeBytes: b.length });
    }
    return writeCandidate(o.outputDir, built.index, { ...built.coverage, primaryCount: roster.primaryCount, enrichmentCount: roster.enrichmentCount, datasets: roster.datasets }, [...roster.inventory, ...producers]);
}
if (require.main === module) run(parseArgs(process.argv.slice(2))).then(r => console.log(JSON.stringify(r))).catch(e => { console.error(e.message); process.exitCode = 1; });
