"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.run = exports.writeCandidate = exports.readRoster = exports.readPayload = exports.bounded = exports.parseArgs = exports.sha256 = exports.PRIMARY_SHA = exports.RUNTIME_SHA = exports.DB_SHA = exports.HIPO_ROOT = void 0;
const crypto_1 = require("crypto");
const child_process_1 = require("child_process");
const promises_1 = require("fs/promises");
const path_1 = require("path");
const zlib_1 = require("zlib");
const game_db_hidden_potential_core_1 = require("./game-db-hidden-potential-core");
// Fixed to the repository containing this module, independent of process cwd or lib output.
const REPO = (0, path_1.resolve)(__dirname, (0, path_1.basename)((0, path_1.dirname)(__dirname)) === "lib" ? "../.." : "..");
exports.HIPO_ROOT = (0, path_1.resolve)(REPO, "game-db/data/hidden-potential");
exports.DB_SHA = "7a6ca01808aea355ef28f9c0190e2c072f43a7c08be41d363f5b052824922495";
exports.RUNTIME_SHA = "a1592e635bad24ef270fa3a28383a3032effd5f4709c17dd2acde1f7fd7e38f7";
exports.PRIMARY_SHA = "57d02c518634574311b471fb77e0c084996f1a32cb3d341d9a25a262da02c9c3";
const MAX_MANIFEST = 2 * 1024 * 1024;
const sha256 = (b) => (0, crypto_1.createHash)("sha256").update(b).digest("hex");
exports.sha256 = sha256;
const FLAGS = {
    "--db": "db", "--elf": "elf", "--layout20": "layout20", "--layout201": "layout201", "--python": "python",
    "--primary-manifest": "primaryManifest", "--primary-payload": "primaryPayload",
    "--enrichment-manifest": "enrichmentManifest", "--enrichment-dir": "enrichmentDir",
    "--output-dir": "outputDir", "--generated-at": "generatedAt",
};
function parseArgs(args) {
    (0, game_db_hidden_potential_core_1.check)(args[0] === "--opt-in-offline", "Explicit --opt-in-offline must be first");
    const values = {};
    for (let i = 1; i < args.length; i++) {
        const split = args[i].indexOf("=");
        const flag = split < 0 ? args[i] : args[i].slice(0, split);
        (0, game_db_hidden_potential_core_1.check)(Object.prototype.hasOwnProperty.call(FLAGS, flag), `Unknown argument: ${flag}`);
        const value = split < 0 ? args[++i] : args[i].slice(split + 1);
        const key = FLAGS[flag];
        (0, game_db_hidden_potential_core_1.check)(value && !value.startsWith("--") && values[key] === undefined, `Missing/duplicate ${flag}`);
        if (key !== "generatedAt")
            (0, game_db_hidden_potential_core_1.check)(!/^(?:[a-z]+:\/\/|[\\/]{2})/i.test(value), "Only local filesystem paths are allowed");
        values[key] = key === "generatedAt" ? value : (0, path_1.resolve)(value);
    }
    for (const key of Object.values(FLAGS))
        (0, game_db_hidden_potential_core_1.check)(values[key], `Missing ${key}`);
    const at = Date.parse(values.generatedAt);
    (0, game_db_hidden_potential_core_1.check)(Number.isFinite(at) && new Date(at).toISOString() === values.generatedAt, "Invalid generatedAt");
    return values;
}
exports.parseArgs = parseArgs;
function inside(root, file) { const r = (0, path_1.relative)(root, file); return r !== "" && r !== ".." && !r.startsWith(`..${path_1.sep}`) && !(0, path_1.isAbsolute)(r); }
async function exists(path) {
    return (0, promises_1.lstat)(path).catch(e => { if (e.code !== "ENOENT")
        throw e; return null; });
}
async function bounded(file, max) {
    const s = await (0, promises_1.lstat)(file);
    (0, game_db_hidden_potential_core_1.check)(s.isFile() && !s.isSymbolicLink() && s.size > 0 && s.size <= max, "Invalid input file/size");
    const b = await (0, promises_1.readFile)(file);
    (0, game_db_hidden_potential_core_1.check)(b.length === s.size && b.length <= max, "Input changed while reading");
    return b;
}
exports.bounded = bounded;
async function readPayload(file, d) {
    (0, game_db_hidden_potential_core_1.check)(d && /^[a-f0-9]{64}$/.test(d.sha256), "Invalid payload digest");
    (0, game_db_hidden_potential_core_1.int)(d.sizeBytes, "compressed size", 1, 32 * 1024 * 1024);
    (0, game_db_hidden_potential_core_1.int)(d.expandedSizeBytes, "expanded size", 1, 128 * 1024 * 1024);
    const bytes = await bounded(file, d.sizeBytes);
    (0, game_db_hidden_potential_core_1.check)(bytes.length === d.sizeBytes && (0, exports.sha256)(bytes) === d.sha256, "Payload hash/size mismatch");
    const raw = (0, zlib_1.gunzipSync)(bytes, { maxOutputLength: d.expandedSizeBytes });
    (0, game_db_hidden_potential_core_1.check)(raw.length === d.expandedSizeBytes, "Expanded size mismatch");
    return JSON.parse(raw.toString("utf8"));
}
exports.readPayload = readPayload;
function cardId(id) { (0, game_db_hidden_potential_core_1.check)(typeof id === "string" && /^[1-9]\d{0,9}$/.test(id), "Invalid exact card ID"); return (0, game_db_hidden_potential_core_1.int)(Number(id), "card ID", 1); }
async function readRoster(o) {
    const inventory = [];
    const manifest = async (file, role) => { const b = await bounded(file, MAX_MANIFEST); inventory.push({ role, sha256: (0, exports.sha256)(b), sizeBytes: b.length }); return JSON.parse(b.toString("utf8")); };
    const p = await manifest(o.primaryManifest, "primary-manifest");
    const e = await manifest(o.enrichmentManifest, "enrichment-manifest");
    (0, game_db_hidden_potential_core_1.check)(p.schemaVersion === 1 && p.compression === "gzip" && typeof p.datasetVersion === "string" && p.datasetVersion.length > 0, "Unsupported primary manifest");
    const pd = { sha256: p.sha256, sizeBytes: p.sizeBytes, expandedSizeBytes: p.uncompressedSizeBytes };
    const primary = await readPayload(o.primaryPayload, pd);
    inventory.push({ role: "primary-payload", sha256: pd.sha256, sizeBytes: pd.sizeBytes });
    (0, game_db_hidden_potential_core_1.check)(Array.isArray(primary) && primary.length === (0, game_db_hidden_potential_core_1.int)(p.characterCount, "primary count", 1, 10000), "Primary roster mismatch");
    const ids = new Set();
    for (const c of primary) {
        const id = cardId(c?.id);
        (0, game_db_hidden_potential_core_1.check)(!ids.has(id), "Duplicate primary card");
        ids.add(id);
    }
    (0, game_db_hidden_potential_core_1.check)(e.schemaVersion === 1 && e.contract === "dokkan-character-detail-enrichment" && e.contractVersion === "1.0.0"
        && e.source === "dokkan-game-db" && e.sourceSnapshotVersion === "1788329250" && e.sourceDatabaseSha256 === exports.DB_SHA
        && typeof e.datasetVersion === "string" && e.datasetVersion.length > 0, "Unsupported enrichment source");
    const binding = e.sourceBindings?.primaryCharacters;
    (0, game_db_hidden_potential_core_1.check)(binding?.payloadSha256 === p.sha256 && binding?.datasetVersion === p.datasetVersion && binding?.characterCount === p.characterCount, "Roster binding mismatch");
    (0, game_db_hidden_potential_core_1.check)(Array.isArray(e.shards) && e.shards.length === (0, game_db_hidden_potential_core_1.int)(e.shardCount, "shard count", 1, 200), "Shard count mismatch");
    const root = await (0, promises_1.realpath)(o.enrichmentDir);
    const objects = new Set();
    const payload = async (d, role) => {
        (0, game_db_hidden_potential_core_1.check)(d?.contentEncoding === "gzip" && d.contentType === "application/json" && /^character-details\/objects\/[a-f0-9]{64}\.json\.gz$/.test(d.objectKey || ""), "Invalid enrichment descriptor");
        (0, game_db_hidden_potential_core_1.check)(d.objectKey === `character-details/objects/${d.sha256}.json.gz` && !objects.has(d.objectKey), "Duplicate/mismatched object");
        objects.add(d.objectKey);
        const path = await (0, promises_1.realpath)((0, path_1.resolve)(root, d.objectKey));
        (0, game_db_hidden_potential_core_1.check)(inside(root, path), "Enrichment path escaped root");
        const value = await readPayload(path, d);
        inventory.push({ role, sha256: d.sha256, sizeBytes: d.sizeBytes });
        (0, game_db_hidden_potential_core_1.check)(value.schemaVersion === 1 && value.contract === e.contract && value.contractVersion === e.contractVersion && value.datasetVersion === e.datasetVersion, "Enrichment payload identity mismatch");
        return value;
    };
    const catalog = await payload(e.catalog, "enrichment-catalog");
    (0, game_db_hidden_potential_core_1.check)(catalog.sourceDatabaseSha256 === exports.DB_SHA && catalog.sourceSnapshotVersion === e.sourceSnapshotVersion && catalog.source === e.source
        && JSON.stringify(catalog.sourceBindings) === JSON.stringify(e.sourceBindings), "Catalog source mismatch");
    (0, game_db_hidden_potential_core_1.check)(Array.isArray(catalog.entries) && catalog.entries.length === e.cardCount && catalog.count === e.cardCount, "Catalog count mismatch");
    const entries = new Map();
    for (const entry of catalog.entries) {
        const id = cardId(entry?.identity?.cardId);
        (0, game_db_hidden_potential_core_1.check)(!ids.has(id) && !entries.has(id), "Overlapping/duplicate detail ID");
        entries.set(id, entry);
    }
    const seen = new Set();
    const shardIds = new Set();
    for (const s of e.shards) {
        (0, game_db_hidden_potential_core_1.check)(typeof s.id === "string" && /^\d{4}$/.test(s.id) && !shardIds.has(s.id), "Invalid shard ID");
        shardIds.add(s.id);
        (0, game_db_hidden_potential_core_1.check)(Array.isArray(s.cardIds) && s.cardIds.length > 0, "Missing shard IDs");
        const declared = new Set(s.cardIds.map(cardId));
        (0, game_db_hidden_potential_core_1.check)(declared.size === s.cardIds.length, "Duplicate shard declared ID");
        const shard = await payload(s, `enrichment-shard-${s.id}`);
        (0, game_db_hidden_potential_core_1.check)(shard.shardId === s.id && Array.isArray(shard.records) && shard.records.length === declared.size, "Shard identity/count mismatch");
        for (const r of shard.records) {
            const id = cardId(r?.identity?.cardId);
            const entry = entries.get(id);
            (0, game_db_hidden_potential_core_1.check)(declared.has(id) && entry?.detailShardId === s.id && !seen.has(id) && cardId(r.detail?.id) === id, "Detail join mismatch");
            (0, game_db_hidden_potential_core_1.check)(r.form?.kind === "awakening-card" && r.canonicalNavigation?.cardId === String(id) && r.canonicalNavigation?.releaseState === "base", "Unsupported detail identity/form");
            (0, game_db_hidden_potential_core_1.check)(JSON.stringify(r.identity) === JSON.stringify(entry.identity), "Catalog identity mismatch");
            seen.add(id);
        }
    }
    (0, game_db_hidden_potential_core_1.check)(seen.size === (0, game_db_hidden_potential_core_1.int)(e.cardCount, "enrichment count", 1, 10000) && seen.size === entries.size, "Incomplete enrichment scope");
    return { ids: [...ids, ...seen].sort((a, b) => a - b), inventory,
        primaryCount: ids.size, enrichmentCount: seen.size, primarySha256: p.sha256,
        datasets: { primary: p.datasetVersion, enrichment: e.datasetVersion } };
}
exports.readRoster = readRoster;
/** No output exists before all inputs/calculations succeed. Manifest is the completion marker. */
async function writeCandidate(outputDir, index, coverage, inventory) {
    const root = (0, path_1.resolve)(exports.HIPO_ROOT);
    const target = (0, path_1.resolve)(outputDir);
    (0, game_db_hidden_potential_core_1.check)((0, path_1.dirname)(target) === root && /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,100}$/.test((0, path_1.basename)(target)), "Output must be a direct new HIPO child");
    // Reject junctions/symlinks at every ancestor, including a replaced data/root directory.
    const chain = [];
    for (let p = root;; p = (0, path_1.dirname)(p)) {
        chain.unshift(p);
        if ((0, path_1.dirname)(p) === p)
            break;
    }
    for (const p of chain) {
        const info = await exists(p);
        if (info) {
            (0, game_db_hidden_potential_core_1.check)(info.isDirectory() && !info.isSymbolicLink(), "Output ancestor is a link/non-directory");
            (0, game_db_hidden_potential_core_1.check)((await (0, promises_1.realpath)(p)).toLowerCase() === p.toLowerCase(), "Output ancestor resolves elsewhere");
        }
        else
            await (0, promises_1.mkdir)(p);
    }
    (0, game_db_hidden_potential_core_1.check)(!(await exists(target)), "Output directory already exists");
    const raw = Buffer.from(JSON.stringify(index) + "\n");
    const gzip = (0, zlib_1.gzipSync)(raw, { level: 9 });
    const digest = (0, exports.sha256)(gzip);
    const fileName = `${digest}.json.gz`;
    const manifest = { schemaVersion: 1, contract: "dokkan-hidden-potential", contractVersion: game_db_hidden_potential_core_1.HIPO_VERSION,
        producerVersion: game_db_hidden_potential_core_1.HIPO_VERSION, generatedAt: index.generatedAt, localOnly: true, source: index.source,
        sourceArtifacts: inventory, coverage,
        catalog: { objectKey: fileName, sha256: digest, sizeBytes: gzip.length, expandedSizeBytes: raw.length, contentEncoding: "gzip", contentType: "application/json" } };
    const report = { ...coverage, sourceArtifacts: inventory, localOnly: true, publicationPerformed: false, legacyUnchanged: true,
        delivery: { indexGzipBytes: gzip.length, indexExpandedBytes: raw.length, lookup: "byCardId[exactId] -> states[state] + boards[boardId].presets[preset]" } };
    // mkdir is the exclusive no-clobber reservation. A failed write leaves no valid manifest.
    await (0, promises_1.mkdir)(target);
    await (0, promises_1.writeFile)((0, path_1.resolve)(target, fileName), gzip, { flag: "wx" });
    await readPayload((0, path_1.resolve)(target, fileName), manifest.catalog);
    await (0, promises_1.writeFile)((0, path_1.resolve)(target, "hidden-potential-audit.json"), JSON.stringify(report, null, 2) + "\n", { flag: "wx" });
    await (0, promises_1.writeFile)((0, path_1.resolve)(target, "hidden-potential-manifest.json"), JSON.stringify(manifest) + "\n", { flag: "wx" });
    return { outputDir: target, manifest, manifestSha256: (0, exports.sha256)(Buffer.from(JSON.stringify(manifest) + "\n")), coverage };
}
exports.writeCandidate = writeCandidate;
async function run(o) {
    for (const key of Object.values(FLAGS))
        if (key !== "generatedAt") {
            (0, game_db_hidden_potential_core_1.check)(typeof o[key] === "string" && (0, path_1.isAbsolute)(o[key]) && !/^[\\/]{2}/.test(o[key]), "Expected absolute local input/output paths");
        }
    const roster = await readRoster(o);
    (0, game_db_hidden_potential_core_1.check)(roster.primaryCount === 1442 && roster.enrichmentCount === 2768 && roster.primarySha256 === exports.PRIMARY_SHA, "Unknown scoped roster snapshot");
    const python = await (0, promises_1.realpath)(o.python);
    (0, game_db_hidden_potential_core_1.check)((await (0, promises_1.lstat)(python)).isFile(), "Invalid Python executable");
    const bridge = (0, path_1.resolve)(REPO, "game-db/game-db-hidden-potential-sqlite.py");
    const child = (0, child_process_1.spawnSync)(python, [bridge, "--db", o.db, "--elf", o.elf, "--layout20", o.layout20, "--layout201", o.layout201], { input: JSON.stringify(roster.ids), encoding: "utf8", maxBuffer: 16 * 1024 * 1024, timeout: 120000, windowsHide: true, shell: false });
    (0, game_db_hidden_potential_core_1.check)(!child.error && child.status === 0, `HIPO bridge failed: ${child.error?.message || child.stderr?.slice(0, 1500)}`);
    const source = JSON.parse(child.stdout);
    (0, game_db_hidden_potential_core_1.check)(source.provenance.databaseSha256 === exports.DB_SHA && source.provenance.runtimeSha256 === exports.RUNTIME_SHA, "Bridge provenance mismatch");
    const built = (0, game_db_hidden_potential_core_1.buildIndex)(source, roster.ids, o.generatedAt);
    const producers = [];
    for (const name of ["core.ts", "run.ts", "sqlite.py"]) {
        const b = await bounded((0, path_1.resolve)(REPO, `game-db/game-db-hidden-potential-${name}`), 1024 * 1024);
        producers.push({ role: `producer-${name}`, sha256: (0, exports.sha256)(b), sizeBytes: b.length });
    }
    return writeCandidate(o.outputDir, built.index, { ...built.coverage, primaryCount: roster.primaryCount, enrichmentCount: roster.enrichmentCount, datasets: roster.datasets }, [...roster.inventory, ...producers]);
}
exports.run = run;
if (require.main === module)
    run(parseArgs(process.argv.slice(2))).then(r => console.log(JSON.stringify(r))).catch(e => { console.error(e.message); process.exitCode = 1; });
//# sourceMappingURL=game-db-hidden-potential-run.js.map