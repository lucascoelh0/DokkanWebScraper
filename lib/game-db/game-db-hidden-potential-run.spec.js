"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = require("assert");
const promises_1 = require("fs/promises");
const path_1 = require("path");
const zlib_1 = require("zlib");
const mocha_1 = require("mocha");
const game_db_hidden_potential_run_1 = require("./game-db-hidden-potential-run");
const LOGS = (0, path_1.resolve)(".agent-logs");
async function sourceFixture() {
    await (0, promises_1.mkdir)(LOGS, { recursive: true });
    const root = await (0, promises_1.mkdtemp)((0, path_1.resolve)(LOGS, "hipo-run-test-"));
    const p = [{ id: "100" }];
    const compressed = (0, zlib_1.gzipSync)(Buffer.from(JSON.stringify(p)));
    const primaryPayload = (0, path_1.resolve)(root, "primary.json.gz");
    await (0, promises_1.writeFile)(primaryPayload, compressed);
    const primaryManifest = (0, path_1.resolve)(root, "primary-manifest.json");
    const pm = { schemaVersion: 1, datasetVersion: "test", compression: "gzip", sha256: (0, game_db_hidden_potential_run_1.sha256)(compressed), sizeBytes: compressed.length, uncompressedSizeBytes: Buffer.byteLength(JSON.stringify(p)), characterCount: 1 };
    await (0, promises_1.writeFile)(primaryManifest, JSON.stringify(pm));
    const binding = { primaryCharacters: { datasetVersion: "test", payloadSha256: pm.sha256, characterCount: 1 } };
    const identity = { cardId: "200", characterId: "1" };
    const record = { identity, form: { kind: "awakening-card" }, canonicalNavigation: { cardId: "200", releaseState: "base" }, detail: { id: "200" } };
    const head = { schemaVersion: 1, contract: "dokkan-character-detail-enrichment", contractVersion: "1.0.0", datasetVersion: "test-detail" };
    const meta = { source: "dokkan-game-db", sourceSnapshotVersion: "1788329250", sourceDatabaseSha256: game_db_hidden_potential_run_1.DB_SHA, sourceBindings: binding };
    const object = async (value) => {
        const raw = Buffer.from(JSON.stringify(value));
        const gzip = (0, zlib_1.gzipSync)(raw);
        const digest = (0, game_db_hidden_potential_run_1.sha256)(gzip);
        const objectKey = `character-details/objects/${digest}.json.gz`;
        await (0, promises_1.mkdir)((0, path_1.resolve)(root, "character-details/objects"), { recursive: true });
        await (0, promises_1.writeFile)((0, path_1.resolve)(root, objectKey), gzip);
        return { objectKey, sha256: digest, sizeBytes: gzip.length, expandedSizeBytes: raw.length, contentEncoding: "gzip", contentType: "application/json" };
    };
    const catalog = await object({ ...head, ...meta, count: 1, entries: [{ identity, detailShardId: "0001" }] });
    const shard = await object({ ...head, shardId: "0001", records: [record] });
    const em = { ...head, ...meta, cardCount: 1, shardCount: 1, catalog, shards: [{ ...shard, id: "0001", cardIds: ["200"] }] };
    const enrichmentManifest = (0, path_1.resolve)(root, "detail-manifest.json");
    await (0, promises_1.writeFile)(enrichmentManifest, JSON.stringify(em));
    return { root, pm, em, primaryManifest, primaryPayload, enrichmentManifest, enrichmentDir: root };
}
async function cleanOwned(path, root) {
    const rel = (0, path_1.relative)(root, path);
    (0, assert_1.strict)(rel && rel !== ".." && !rel.startsWith(`..${path_1.sep}`));
    (0, assert_1.strict)((await (0, promises_1.lstat)(path)).isDirectory());
    await (0, promises_1.rm)(path, { recursive: true });
}
(0, mocha_1.it)("strict opt-in and required flags", () => {
    assert_1.strict.throws(() => (0, game_db_hidden_potential_run_1.parseArgs)([]));
    assert_1.strict.throws(() => (0, game_db_hidden_potential_run_1.parseArgs)(["--opt-in-offline", "--unknown", "x"]));
    const flags = ["db", "elf", "layout20", "layout201", "python", "primary-manifest", "primary-payload", "enrichment-manifest", "enrichment-dir", "output-dir"];
    const args = ["--opt-in-offline", ...flags.flatMap(f => [`--${f}`, "local-file"]), "--generated-at", "2026-09-09T12:00:00.000Z"];
    assert_1.strict.equal((0, game_db_hidden_potential_run_1.parseArgs)(args).generatedAt, "2026-09-09T12:00:00.000Z");
    assert_1.strict.throws(() => (0, game_db_hidden_potential_run_1.parseArgs)([...args, "--db", "again"]));
    assert_1.strict.throws(() => (0, game_db_hidden_potential_run_1.parseArgs)([...args.slice(0, -1), "2026-02-30T00:00:00.000Z"]));
});
(0, mocha_1.it)("validated exact roster union without reading legacy stats", async () => {
    const f = await sourceFixture();
    try {
        const before = (0, game_db_hidden_potential_run_1.sha256)(await (0, promises_1.readFile)(f.primaryPayload));
        const r = await (0, game_db_hidden_potential_run_1.readRoster)(f);
        assert_1.strict.deepEqual(r.ids, [100, 200]);
        assert_1.strict.equal(r.inventory.length, 5);
        assert_1.strict.equal((0, game_db_hidden_potential_run_1.sha256)(await (0, promises_1.readFile)(f.primaryPayload)), before);
        const bad = { ...f.pm, sha256: "0".repeat(64), expandedSizeBytes: f.pm.uncompressedSizeBytes };
        await assert_1.strict.rejects((0, game_db_hidden_potential_run_1.readPayload)(f.primaryPayload, bad), /hash/);
        await assert_1.strict.rejects((0, game_db_hidden_potential_run_1.readPayload)(f.primaryPayload, { ...bad, sha256: f.pm.sha256, expandedSizeBytes: 1 }));
    }
    finally {
        await cleanOwned(f.root, LOGS);
    }
});
const mutations = [
    ["source", m => m.sourceDatabaseSha256 = "0".repeat(64)],
    ["contract", m => m.contractVersion = "2.0.0"],
    ["binding", m => m.sourceBindings.primaryCharacters.characterCount = 2],
    ["count", m => m.cardCount = 2],
    ["path traversal", m => m.shards[0].objectKey = "../outside.json.gz"],
    ["declared IDs", m => m.shards[0].cardIds = ["100"]],
    ["duplicate shard", m => { m.shards.push(m.shards[0]); m.shardCount++; }],
    ["wrong size", m => m.shards[0].sizeBytes++],
];
for (const [name, mutate] of mutations)
    (0, mocha_1.it)(`roster rejects ${name}`, async () => {
        const f = await sourceFixture();
        try {
            mutate(f.em);
            await (0, promises_1.writeFile)(f.enrichmentManifest, JSON.stringify(f.em));
            await assert_1.strict.rejects((0, game_db_hidden_potential_run_1.readRoster)(f));
        }
        finally {
            await cleanOwned(f.root, LOGS);
        }
    });
(0, mocha_1.it)("fresh confined deterministic candidate, completion manifest last", async () => {
    const suffix = `${process.pid}-${Date.now()}`;
    const first = (0, path_1.resolve)(game_db_hidden_potential_run_1.HIPO_ROOT, `unit-a-${suffix}`);
    const second = (0, path_1.resolve)(game_db_hidden_potential_run_1.HIPO_ROOT, `unit-b-${suffix}`);
    const partial = (0, path_1.resolve)(game_db_hidden_potential_run_1.HIPO_ROOT, `unit-partial-${suffix}`);
    const index = { generatedAt: "2026-09-09T12:00:00.000Z", source: { databaseSha256: game_db_hidden_potential_run_1.DB_SHA }, byCardId: { "100": { status: "unknown" } } };
    try {
        await assert_1.strict.rejects((0, game_db_hidden_potential_run_1.writeCandidate)((0, path_1.resolve)(game_db_hidden_potential_run_1.HIPO_ROOT, "../escape"), index, {}, []));
        const a = await (0, game_db_hidden_potential_run_1.writeCandidate)(first, index, { cardCount: 1 }, []);
        const b = await (0, game_db_hidden_potential_run_1.writeCandidate)(second, index, { cardCount: 1 }, []);
        assert_1.strict.deepEqual(a.manifest, b.manifest);
        assert_1.strict.equal(a.manifestSha256, b.manifestSha256);
        assert_1.strict.deepEqual(await (0, game_db_hidden_potential_run_1.readPayload)((0, path_1.resolve)(first, a.manifest.catalog.objectKey), a.manifest.catalog), index);
        await assert_1.strict.rejects((0, game_db_hidden_potential_run_1.writeCandidate)(first, index, {}, []), /already exists/);
        // Inject a serialization failure after reserving the directory; incomplete output is never valid.
        await assert_1.strict.rejects((0, game_db_hidden_potential_run_1.writeCandidate)(partial, index, {}, [{ invalid: BigInt(1) }]));
        await assert_1.strict.rejects((0, promises_1.lstat)((0, path_1.resolve)(partial, "hidden-potential-manifest.json")), { code: "ENOENT" });
    }
    finally {
        for (const path of [first, second, partial])
            if (await (0, promises_1.lstat)(path).catch(() => null))
                await cleanOwned(path, game_db_hidden_potential_run_1.HIPO_ROOT);
    }
});
(0, mocha_1.it)("output child junction cannot redirect writes", async () => {
    await (0, promises_1.mkdir)(game_db_hidden_potential_run_1.HIPO_ROOT, { recursive: true });
    const f = await sourceFixture();
    const path = (0, path_1.resolve)(game_db_hidden_potential_run_1.HIPO_ROOT, `unit-link-${process.pid}-${Date.now()}`);
    try {
        await (0, promises_1.symlink)(f.root, path, process.platform === "win32" ? "junction" : "dir");
        await assert_1.strict.rejects((0, game_db_hidden_potential_run_1.writeCandidate)(path, {}, {}, []), /already exists/);
    }
    finally {
        await (0, promises_1.rm)(path, { force: true });
        await cleanOwned(f.root, LOGS);
    }
});
//# sourceMappingURL=game-db-hidden-potential-run.spec.js.map