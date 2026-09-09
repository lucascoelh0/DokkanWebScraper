import { strict as assert } from "assert";
import { mkdtemp, mkdir, writeFile, readFile, lstat, rm, symlink } from "fs/promises";
import { resolve, relative, sep } from "path";
import { gzipSync } from "zlib";
import { it as test } from "mocha";
import { assertSupportedRoster, DB_SHA, HIPO_ROOT, KI_PRIMARY_SHA, PRIMARY_SHA, parseArgs, readPayload, readRoster, sha256, writeCandidate } from "./game-db-hidden-potential-run";

test("only audited primary payloads and the exact scoped counts are accepted", () => {
    for (const primarySha256 of [PRIMARY_SHA, KI_PRIMARY_SHA]) {
        const roster = { primaryCount: 1442, enrichmentCount: 2768, primarySha256 };
        assert.doesNotThrow(() => assertSupportedRoster(roster));
        assert.throws(() => assertSupportedRoster({ ...roster, primaryCount: 1441 }));
        assert.throws(() => assertSupportedRoster({ ...roster, enrichmentCount: 2767 }));
    }
    assert.throws(() => assertSupportedRoster({ primaryCount: 1442, enrichmentCount: 2768, primarySha256: "0".repeat(64) }));
});

const LOGS = resolve(".agent-logs");
async function sourceFixture() {
    await mkdir(LOGS, { recursive: true }); const root = await mkdtemp(resolve(LOGS, "hipo-run-test-"));
    const p = [{ id: "100" }];
    const compressed = gzipSync(Buffer.from(JSON.stringify(p))); const primaryPayload = resolve(root, "primary.json.gz");
    await writeFile(primaryPayload, compressed);
    const primaryManifest = resolve(root, "primary-manifest.json");
    const pm = { schemaVersion: 1, datasetVersion: "test", compression: "gzip", sha256: sha256(compressed), sizeBytes: compressed.length, uncompressedSizeBytes: Buffer.byteLength(JSON.stringify(p)), characterCount: 1 };
    await writeFile(primaryManifest, JSON.stringify(pm));
    const binding = { primaryCharacters: { datasetVersion: "test", payloadSha256: pm.sha256, characterCount: 1 } };
    const identity = { cardId: "200", characterId: "1" };
    const record = { identity, form: { kind: "awakening-card" }, canonicalNavigation: { cardId: "200", releaseState: "base" }, detail: { id: "200" } };
    const head = { schemaVersion: 1, contract: "dokkan-character-detail-enrichment", contractVersion: "1.0.0", datasetVersion: "test-detail" };
    const meta = { source: "dokkan-game-db", sourceSnapshotVersion: "1788329250", sourceDatabaseSha256: DB_SHA, sourceBindings: binding };
    const object = async (value: any) => {
        const raw = Buffer.from(JSON.stringify(value)); const gzip = gzipSync(raw); const digest = sha256(gzip); const objectKey = `character-details/objects/${digest}.json.gz`;
        await mkdir(resolve(root, "character-details/objects"), { recursive: true }); await writeFile(resolve(root, objectKey), gzip);
        return { objectKey, sha256: digest, sizeBytes: gzip.length, expandedSizeBytes: raw.length, contentEncoding: "gzip", contentType: "application/json" };
    };
    const catalog = await object({ ...head, ...meta, count: 1, entries: [{ identity, detailShardId: "0001" }] });
    const shard = await object({ ...head, shardId: "0001", records: [record] });
    const em = { ...head, ...meta, cardCount: 1, shardCount: 1, catalog, shards: [{ ...shard, id: "0001", cardIds: ["200"] }] };
    const enrichmentManifest = resolve(root, "detail-manifest.json"); await writeFile(enrichmentManifest, JSON.stringify(em));
    return { root, pm, em, primaryManifest, primaryPayload, enrichmentManifest, enrichmentDir: root };
}
async function cleanOwned(path: string, root: string) {
    const rel = relative(root, path); assert(rel && rel !== ".." && !rel.startsWith(`..${sep}`));
    assert((await lstat(path)).isDirectory()); await rm(path, { recursive: true });
}
test("strict opt-in and required flags", () => {
    assert.throws(() => parseArgs([])); assert.throws(() => parseArgs(["--opt-in-offline", "--unknown", "x"]));
    const flags = ["db","elf","layout20","layout201","python","primary-manifest","primary-payload","enrichment-manifest","enrichment-dir","output-dir"];
    const args = ["--opt-in-offline", ...flags.flatMap(f => [`--${f}`, "local-file"]), "--generated-at", "2026-09-09T12:00:00.000Z"];
    assert.equal(parseArgs(args).generatedAt, "2026-09-09T12:00:00.000Z");
    assert.throws(() => parseArgs([...args,"--db","again"])); assert.throws(() => parseArgs([...args.slice(0,-1),"2026-02-30T00:00:00.000Z"]));
});
test("validated exact roster union without reading legacy stats", async () => {
    const f = await sourceFixture(); try {
        const before = sha256(await readFile(f.primaryPayload)); const r = await readRoster(f);
        assert.deepEqual(r.ids, [100,200]); assert.equal(r.inventory.length, 5);
        assert.equal(sha256(await readFile(f.primaryPayload)), before);
        const bad = { ...f.pm, sha256: "0".repeat(64), expandedSizeBytes: f.pm.uncompressedSizeBytes };
        await assert.rejects(readPayload(f.primaryPayload, bad), /hash/);
        await assert.rejects(readPayload(f.primaryPayload, { ...bad, sha256: f.pm.sha256, expandedSizeBytes: 1 }));
    } finally { await cleanOwned(f.root, LOGS); }
});
const mutations: [string, (m: any) => void][] = [
    ["source", m => m.sourceDatabaseSha256 = "0".repeat(64)],
    ["contract", m => m.contractVersion = "2.0.0"],
    ["binding", m => m.sourceBindings.primaryCharacters.characterCount = 2],
    ["count", m => m.cardCount = 2],
    ["path traversal", m => m.shards[0].objectKey = "../outside.json.gz"],
    ["declared IDs", m => m.shards[0].cardIds = ["100"]],
    ["duplicate shard", m => { m.shards.push(m.shards[0]); m.shardCount++; }],
    ["wrong size", m => m.shards[0].sizeBytes++],
];
for (const [name, mutate] of mutations) test(`roster rejects ${name}`, async () => {
    const f = await sourceFixture(); try { mutate(f.em); await writeFile(f.enrichmentManifest, JSON.stringify(f.em)); await assert.rejects(readRoster(f)); }
    finally { await cleanOwned(f.root, LOGS); }
});
test("fresh confined deterministic candidate, completion manifest last", async () => {
    const suffix = `${process.pid}-${Date.now()}`; const first = resolve(HIPO_ROOT, `unit-a-${suffix}`); const second = resolve(HIPO_ROOT, `unit-b-${suffix}`);
    const partial = resolve(HIPO_ROOT, `unit-partial-${suffix}`);
    const index = { generatedAt: "2026-09-09T12:00:00.000Z", source: { databaseSha256: DB_SHA }, byCardId: { "100": { status: "unknown" } } };
    try {
        await assert.rejects(writeCandidate(resolve(HIPO_ROOT, "../escape"), index, {}, []));
        const a = await writeCandidate(first, index, { cardCount: 1 }, []); const b = await writeCandidate(second, index, { cardCount: 1 }, []);
        assert.deepEqual(a.manifest, b.manifest); assert.equal(a.manifestSha256, b.manifestSha256);
        assert.deepEqual(await readPayload(resolve(first, a.manifest.catalog.objectKey), a.manifest.catalog), index);
        await assert.rejects(writeCandidate(first, index, {}, []), /already exists/);
        // Inject a serialization failure after reserving the directory; incomplete output is never valid.
        await assert.rejects(writeCandidate(partial, index, {}, [{ invalid: BigInt(1) }]));
        await assert.rejects(lstat(resolve(partial, "hidden-potential-manifest.json")), { code: "ENOENT" });
    } finally {
        for (const path of [first, second, partial]) if (await lstat(path).catch(() => null)) await cleanOwned(path, HIPO_ROOT);
    }
});
test("output child junction cannot redirect writes", async () => {
    await mkdir(HIPO_ROOT, { recursive: true }); const f = await sourceFixture(); const path = resolve(HIPO_ROOT, `unit-link-${process.pid}-${Date.now()}`);
    try {
        await symlink(f.root, path, process.platform === "win32" ? "junction" : "dir");
        await assert.rejects(writeCandidate(path, {}, {}, []), /already exists/);
    } finally { await rm(path, { force: true }); await cleanOwned(f.root, LOGS); }
});
