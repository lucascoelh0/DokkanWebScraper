"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = require("assert");
const crypto_1 = require("crypto");
const fs_1 = require("fs");
const promises_1 = require("fs/promises");
const os_1 = require("os");
const path_1 = require("path");
const game_db_skill_orb_publisher_1 = require("./game-db-skill-orb-publisher");
const CANDIDATE = (0, path_1.resolve)("data/skill-orbs/candidate-sko11-1788329250-local");
const realCandidateIt = (0, fs_1.existsSync)(CANDIDATE) ? it : it.skip;
let activeTestCandidate;
const syntheticRoots = new Set();
function sha256(bytes) {
    return (0, crypto_1.createHash)("sha256").update(bytes).digest("hex");
}
function options(mode = "dry-run-staging-v2") {
    return {
        candidateDir: CANDIDATE,
        mode,
        ...(mode === "publish-staging-v2" ? { confirmDatasetVersion: game_db_skill_orb_publisher_1.SKO02_PIN.datasetVersion } : {}),
        concurrency: 4,
        timeoutMs: 1000,
        retryAttempts: 2,
        retryBaseDelayMs: 0,
    };
}
async function executeSkillOrbPublisher(publisherOptions, dependencies) {
    const result = await (0, game_db_skill_orb_publisher_1.executeSkillOrbPublisherTestHarness)(publisherOptions, {
        ...dependencies,
        ...(activeTestCandidate ? { validateCandidateForTestOnly: async () => activeTestCandidate } : {}),
    });
    (0, assert_1.equal)(result.authority, "TEST_ONLY_NON_AUTHORITATIVE");
    return result.report;
}
class FakeStore {
    objects = new Map();
    inventoryOnly = new Map();
    puts = [];
    listCalls = 0;
    headCalls = 0;
    getCalls = 0;
    putCalls = 0;
    pageSize = 10000;
    failFirstList;
    listHook;
    async listPage(continuationToken) {
        this.listCalls += 1;
        this.listHook?.(this.listCalls);
        if (this.failFirstList && this.listCalls === 1)
            throw this.failFirstList;
        const all = [
            ...[...this.objects].map(([key, value]) => ({ key, sizeBytes: value.sizeBytes, etag: value.etag })),
            ...[...this.inventoryOnly].filter(([key]) => !this.objects.has(key)).map(([key, sizeBytes]) => ({ key, sizeBytes })),
        ].sort((left, right) => left.key.localeCompare(right.key));
        const offset = continuationToken ? Number(continuationToken) : 0;
        const objects = all.slice(offset, offset + this.pageSize);
        const next = offset + objects.length;
        return {
            objects,
            isTruncated: next < all.length,
            ...(next < all.length ? { nextContinuationToken: String(next) } : {}),
        };
    }
    async head(key) {
        this.headCalls += 1;
        const value = this.objects.get(key);
        if (!value)
            return undefined;
        const { bytes: _bytes, ...metadata } = value;
        return { ...metadata };
    }
    async get(key) {
        this.getCalls += 1;
        const value = this.objects.get(key);
        return value ? { ...value, bytes: Buffer.from(value.bytes) } : undefined;
    }
    async put(key, bytes, metadata, condition) {
        this.putCalls += 1;
        this.puts.push({ key, condition });
        const current = this.objects.get(key);
        if ("ifNoneMatch" in condition ? Boolean(current) : !current || current.etag !== condition.ifMatch) {
            return "precondition-failed";
        }
        this.objects.set(key, {
            bytes: Buffer.from(bytes), sizeBytes: bytes.byteLength,
            etag: `"${sha256(bytes).slice(0, 32)}"`, ...metadata,
        });
        return "written";
    }
}
async function readExpected(candidate, object) {
    return (0, promises_1.readFile)((0, path_1.join)(candidate.root, ...object.relativePath.split("/")));
}
async function realStoreWithExpected(mode = "bounded-preflight") {
    const candidate = await (0, game_db_skill_orb_publisher_1.validateSkillOrbCandidate)(CANDIDATE);
    activeTestCandidate = candidate;
    const store = new FakeStore();
    for (const object of candidate.objects) {
        const absent = mode === "bounded-preflight" && (object.kind === "manifest" || object.kind === "payload"
            || object.key.endsWith("/lv-5-6.png") || object.key.endsWith("/lv-7-6.png"));
        if (absent)
            continue;
        const bytes = await readExpected(candidate, object);
        store.objects.set(object.key, {
            bytes, sizeBytes: bytes.byteLength, etag: `"${sha256(bytes).slice(0, 32)}"`,
            contentType: object.contentType, contentEncoding: object.contentEncoding,
            cacheControl: object.cacheControl, sha256Metadata: object.sha256Metadata,
        });
    }
    return { store, candidate };
}
async function storeWithExpected(mode = "bounded-preflight") {
    const root = await (0, promises_1.mkdtemp)((0, path_1.join)((0, os_1.tmpdir)(), "sko02-core-"));
    syntheticRoots.add(root);
    const definitions = [
        { kind: "asset", relativePath: "assets/a.png", key: "staging/v2/game-assets/a.png", bytes: Buffer.from("asset-a"), contentType: "image/png", immutable: true },
        { kind: "asset", relativePath: "assets/b.png", key: "staging/v2/game-assets/b.png", bytes: Buffer.from("asset-b"), contentType: "image/png", immutable: true },
        { kind: "payload", relativePath: "payload.json.gz", key: "staging/v2/equipment-skill-orbs/objects/synthetic.json.gz", bytes: Buffer.from("payload"), contentType: "application/json", contentEncoding: "gzip", immutable: true },
        { kind: "manifest", relativePath: "equipment-skill-orbs-manifest.json", key: "staging/v2/equipment-skill-orbs-manifest.json", bytes: Buffer.from("{\"synthetic\":true}\n"), contentType: "application/json", immutable: false },
    ];
    for (const definition of definitions) {
        await (0, promises_1.mkdir)((0, path_1.resolve)(root, definition.relativePath, ".."), { recursive: true });
        await (0, promises_1.writeFile)((0, path_1.resolve)(root, definition.relativePath), definition.bytes);
    }
    const objects = definitions.map(definition => ({
        kind: definition.kind, key: definition.key, relativePath: definition.relativePath,
        sizeBytes: definition.bytes.byteLength, sha256: sha256(definition.bytes), contentType: definition.contentType,
        ...("contentEncoding" in definition ? { contentEncoding: definition.contentEncoding } : {}),
        cacheControl: definition.immutable ? "public, max-age=31536000, immutable" : "no-store",
        sha256Metadata: sha256(definition.bytes), immutable: definition.immutable,
    }));
    const candidate = {
        root,
        manifest: {
            schemaVersion: 1, datasetVersion: "synthetic-test-only", parserVersion: "1.0.0", snapshotVersion: "synthetic",
            sourceDatabaseSha256: "1".repeat(64),
            payload: {
                objectKey: definitions[2].key.slice("staging/v2/".length), sizeBytes: definitions[2].bytes.byteLength,
                sha256: sha256(definitions[2].bytes), contentType: "application/json", contentEncoding: "gzip",
                uncompressedSizeBytes: 7, uncompressedSha256: "2".repeat(64),
            },
            assets: { count: 2, sizeBytes: 14, inventorySha256: "3".repeat(64) }, counts: {},
        },
        manifestSha256: sha256(definitions[3].bytes), assetManifestSha256: "4".repeat(64),
        sourceFingerprint: "5".repeat(64), objects,
        totals: { assets: 2, assetBytes: 14, candidateObjectBytes: objects.reduce((sum, object) => sum + object.sizeBytes, 0) },
    };
    activeTestCandidate = candidate;
    const store = new FakeStore();
    for (const object of candidate.objects) {
        const absent = mode === "bounded-preflight";
        if (absent)
            continue;
        const bytes = await readExpected(candidate, object);
        store.objects.set(object.key, {
            bytes, sizeBytes: bytes.byteLength, etag: `"${sha256(bytes).slice(0, 32)}"`,
            contentType: object.contentType, contentEncoding: object.contentEncoding,
            cacheControl: object.cacheControl, sha256Metadata: object.sha256Metadata,
        });
    }
    return { store, candidate };
}
async function copyCandidate() {
    const parent = await (0, promises_1.mkdtemp)((0, path_1.join)((0, os_1.tmpdir)(), "sko02-"));
    const destination = (0, path_1.join)(parent, "candidate");
    await (0, promises_1.cp)(CANDIDATE, destination, { recursive: true });
    return destination;
}
async function mutateJson(root, relativePath, mutate) {
    const path = (0, path_1.join)(root, relativePath);
    const value = JSON.parse(await (0, promises_1.readFile)(path, "utf8"));
    mutate(value);
    await (0, promises_1.writeFile)(path, `${JSON.stringify(value, null, 2)}\n`);
}
describe("SKO-02 Skill Orb publisher", function () {
    this.timeout(120000);
    after(async () => {
        await Promise.all([...syntheticRoots].map(root => (0, promises_1.rm)(root, { recursive: true, force: true })));
    });
    realCandidateIt("source-binds the exact pinned candidate and all bounded files", async () => {
        const candidate = await (0, game_db_skill_orb_publisher_1.validateSkillOrbCandidate)(CANDIDATE);
        (0, assert_1.equal)(candidate.manifest.datasetVersion, game_db_skill_orb_publisher_1.SKO02_PIN.datasetVersion);
        (0, assert_1.equal)(candidate.manifest.payload.sha256, game_db_skill_orb_publisher_1.SKO02_PIN.payloadSha256);
        (0, assert_1.equal)(candidate.totals.assets, 196);
        (0, assert_1.equal)(candidate.totals.assetBytes, 2153473);
        (0, assert_1.equal)(candidate.objects.length, 198);
        (0, assert_1.ok)(candidate.objects.every(value => value.key.startsWith("staging/v2/")));
    });
    realCandidateIt("rejects snapshot, version, hash and size drift", async () => {
        for (const mutate of [
            (value) => { value.snapshotVersion = "1788329251"; },
            (value) => { value.datasetVersion = "wrong"; },
            (value) => { value.payload.sha256 = "0".repeat(64); },
            (value) => { value.payload.sizeBytes += 1; },
        ]) {
            const root = await copyCandidate();
            try {
                await mutateJson(root, "equipment-skill-orbs-manifest.json", mutate);
                await (0, assert_1.rejects)((0, game_db_skill_orb_publisher_1.validateSkillOrbCandidate)(root), /pinned release/);
            }
            finally {
                await (0, promises_1.rm)((0, path_1.resolve)(root, ".."), { recursive: true, force: true });
            }
        }
    });
    realCandidateIt("rejects a divergent expanded/raw payload", async () => {
        const root = await copyCandidate();
        try {
            const path = (0, path_1.join)(root, "equipment-skill-orbs.json");
            const bytes = await (0, promises_1.readFile)(path);
            bytes[100] ^= 1;
            await (0, promises_1.writeFile)(path, bytes);
            await (0, assert_1.rejects)((0, game_db_skill_orb_publisher_1.validateSkillOrbCandidate)(root), /Raw Skill Orb payload/);
        }
        finally {
            await (0, promises_1.rm)((0, path_1.resolve)(root, ".."), { recursive: true, force: true });
        }
    });
    realCandidateIt("rejects duplicate and traversal asset inventory paths", async () => {
        for (const mutate of [
            (value) => { value.inventory.assets[1].path = value.inventory.assets[0].path; },
            (value) => { value.inventory.assets[0].path = "../escape.png"; },
        ]) {
            const root = await copyCandidate();
            try {
                await mutateJson(root, "equipment-skill-orb-assets-manifest.json", mutate);
                await (0, assert_1.rejects)((0, game_db_skill_orb_publisher_1.validateSkillOrbCandidate)(root), /inventory|asset entry/i);
            }
            finally {
                await (0, promises_1.rm)((0, path_1.resolve)(root, ".."), { recursive: true, force: true });
            }
        }
    });
    realCandidateIt("rejects missing and extra candidate files", async () => {
        const missing = await copyCandidate();
        try {
            await (0, promises_1.unlink)((0, path_1.join)(missing, "game-assets/derived/equipment/levels/lv-1.png"));
            await (0, assert_1.rejects)((0, game_db_skill_orb_publisher_1.validateSkillOrbCandidate)(missing), /Missing Skill Orb candidate file|missing or extra/);
        }
        finally {
            await (0, promises_1.rm)((0, path_1.resolve)(missing, ".."), { recursive: true, force: true });
        }
        const extra = await copyCandidate();
        try {
            await (0, promises_1.writeFile)((0, path_1.join)(extra, "unexpected.txt"), "unexpected");
            await (0, assert_1.rejects)((0, game_db_skill_orb_publisher_1.validateSkillOrbCandidate)(extra), /missing or extra/);
        }
        finally {
            await (0, promises_1.rm)((0, path_1.resolve)(extra, ".."), { recursive: true, force: true });
        }
    });
    realCandidateIt("rejects oversized files and linked file identities before parsing", async () => {
        const oversized = await copyCandidate();
        try {
            await (0, promises_1.writeFile)((0, path_1.join)(oversized, "equipment-skill-orbs-manifest.json"), Buffer.alloc(64 * 1024 + 1, 0x20));
            await (0, assert_1.rejects)((0, game_db_skill_orb_publisher_1.validateSkillOrbCandidate)(oversized), /Invalid bounded Skill Orb file/);
        }
        finally {
            await (0, promises_1.rm)((0, path_1.resolve)(oversized, ".."), { recursive: true, force: true });
        }
        const linked = await copyCandidate();
        try {
            const target = (0, path_1.join)(linked, "game-assets/derived/equipment/levels/lv-1.png");
            const source = (0, path_1.join)(linked, "game-assets/derived/equipment/levels/lv-2.png");
            await (0, promises_1.unlink)(target);
            await (0, promises_1.link)(source, target);
            await (0, assert_1.rejects)((0, game_db_skill_orb_publisher_1.validateSkillOrbCandidate)(linked), /Invalid bounded Skill Orb file|unsupported entry/);
        }
        finally {
            await (0, promises_1.rm)((0, path_1.resolve)(linked, ".."), { recursive: true, force: true });
        }
    });
    realCandidateIt("rejects cross-channel keys and production modes", async () => {
        const root = await copyCandidate();
        try {
            await mutateJson(root, "equipment-skill-orbs-manifest.json", value => {
                value.payload.objectKey = "production/equipment-skill-orbs.json.gz";
            });
            await (0, assert_1.rejects)((0, game_db_skill_orb_publisher_1.validateSkillOrbCandidate)(root), /pinned release/);
        }
        finally {
            await (0, promises_1.rm)((0, path_1.resolve)(root, ".."), { recursive: true, force: true });
        }
        try {
            (0, game_db_skill_orb_publisher_1.parseSkillOrbPublisherArgs)(["--candidate", CANDIDATE, "--production", "--dry-run-staging-v2"]);
            throw new Error("expected parse failure");
        }
        catch (error) {
            (0, assert_1.match)(String(error), /Unexpected/);
        }
    });
    it("requires live authorization before constructing a remote store", async () => {
        let factoryCalls = 0;
        await (0, assert_1.rejects)(executeSkillOrbPublisher({ ...options("publish-staging-v2"), confirmDatasetVersion: undefined }, {
            createRemoteStore: () => { factoryCalls += 1; return new FakeStore(); },
            delay: async () => undefined,
        }), /requires --confirm-dataset-version/);
        (0, assert_1.equal)(factoryCalls, 0);
    });
    it("rejects every unknown runtime mode before constructing a remote store", async () => {
        let factoryCalls = 0;
        await (0, assert_1.rejects)(executeSkillOrbPublisher({ ...options(), mode: "production" }, {
            createRemoteStore: () => { factoryCalls += 1; return new FakeStore(); },
            delay: async () => undefined,
        }), /Invalid Skill Orb publisher mode/);
        (0, assert_1.equal)(factoryCalls, 0);
    });
    realCandidateIt("reproduces the bounded read-only plan with no writes", async () => {
        const { store, candidate } = await realStoreWithExpected();
        const report = await executeSkillOrbPublisher(options(), { createRemoteStore: () => store, delay: async () => undefined });
        const missingBytes = candidate.objects
            .filter(value => !store.objects.has(value.key))
            .reduce((sum, value) => sum + value.sizeBytes, 0);
        (0, assert_1.equal)(report.decision, "GO");
        (0, assert_1.equal)(report.remote.reusedObjects, 194);
        (0, assert_1.equal)(report.remote.newObjects, 4);
        (0, assert_1.equal)(report.remote.conflictingObjects, 0);
        (0, assert_1.equal)(report.remote.newNetBytes, missingBytes);
        (0, assert_1.equal)(report.remote.futureWriteBytes, missingBytes);
        (0, assert_1.equal)(store.putCalls, 0);
        (0, assert_1.equal)(report.telemetry.put, 0);
        (0, assert_1.equal)(report.telemetry.delete, 0);
        (0, assert_1.equal)(report.telemetry.stateWrites, 0);
    });
    it("fails closed on immutable byte conflicts", async () => {
        const { store, candidate } = await storeWithExpected("all");
        const target = candidate.objects.find(value => value.kind === "asset" && store.objects.has(value.key));
        store.objects.get(target.key).bytes[0] ^= 1;
        const report = await executeSkillOrbPublisher(options(), { createRemoteStore: () => store, delay: async () => undefined });
        (0, assert_1.equal)(report.decision, "NO-GO");
        (0, assert_1.equal)(report.remote.conflictingObjects, 1);
        (0, assert_1.equal)(report.remote.objects.find(value => value.key === target.key).reason, "immutable-byte-conflict");
    });
    it("fails closed on immutable metadata drift", async () => {
        const { store, candidate } = await storeWithExpected("all");
        const target = candidate.objects.find(value => value.kind === "asset" && store.objects.has(value.key));
        store.objects.get(target.key).contentType = "application/octet-stream";
        const report = await executeSkillOrbPublisher(options(), { createRemoteStore: () => store, delay: async () => undefined });
        (0, assert_1.equal)(report.decision, "NO-GO");
        (0, assert_1.equal)(report.remote.objects.find(value => value.key === target.key).reason, "immutable-metadata-drift");
    });
    it("detects a metadata-only manifest baseline race before the first write", async () => {
        const { store, candidate } = await storeWithExpected("all");
        const manifest = candidate.objects.find(value => value.kind === "manifest");
        store.listHook = call => {
            if (call === 2) {
                store.objects.get(manifest.key).cacheControl = "max-age=1";
            }
        };
        const report = await executeSkillOrbPublisher(options("publish-staging-v2"), {
            createRemoteStore: () => store, delay: async () => undefined,
        });
        (0, assert_1.deepEqual)(report.failure, { phase: "publication", code: "BASELINE_CHANGED" });
        (0, assert_1.equal)(store.putCalls, 0);
    });
    it("detects a metadata-only manifest baseline race before manifest promotion", async () => {
        const { store, candidate } = await storeWithExpected();
        const manifest = candidate.objects.find(value => value.kind === "manifest");
        const oldBytes = Buffer.from("old manifest");
        store.objects.set(manifest.key, {
            bytes: oldBytes, sizeBytes: oldBytes.length, etag: '"same-etag"', contentType: "application/json",
            cacheControl: "no-store", sha256Metadata: sha256(oldBytes),
        });
        store.listHook = call => {
            if (call === 3) {
                store.objects.get(manifest.key).cacheControl = "max-age=1";
            }
        };
        const report = await executeSkillOrbPublisher(options("publish-staging-v2"), {
            createRemoteStore: () => store, delay: async () => undefined,
        });
        (0, assert_1.deepEqual)(report.failure, { phase: "publication", code: "BASELINE_CHANGED" });
        (0, assert_1.ok)(store.puts.every(value => value.key !== manifest.key));
    });
    it("uses create-only immutable writes, verifies readback and writes the manifest last", async () => {
        const { store, candidate } = await storeWithExpected();
        const report = await executeSkillOrbPublisher(options("publish-staging-v2"), {
            createRemoteStore: () => store, delay: async () => undefined,
        });
        (0, assert_1.equal)(report.decision, "GO");
        (0, assert_1.equal)(store.puts.length, 4);
        (0, assert_1.ok)(store.puts.slice(0, -1).every(value => "ifNoneMatch" in value.condition));
        (0, assert_1.equal)(store.puts.at(-1).key, candidate.objects.find(value => value.kind === "manifest").key);
        (0, assert_1.ok)("ifNoneMatch" in store.puts.at(-1).condition);
        (0, assert_1.equal)(report.telemetry.bytesWritten, candidate.totals.candidateObjectBytes);
        (0, assert_1.equal)(report.telemetry.delete, 0);
    });
    it("uses a strong-ETag CAS for a different mutable manifest", async () => {
        const { store, candidate } = await storeWithExpected("all");
        const manifest = candidate.objects.find(value => value.kind === "manifest");
        const different = Buffer.from("old manifest");
        store.objects.set(manifest.key, {
            bytes: different, sizeBytes: different.length, etag: '"old-etag"',
            contentType: "application/json", cacheControl: "no-store", sha256Metadata: sha256(different),
        });
        const report = await executeSkillOrbPublisher(options("publish-staging-v2"), {
            createRemoteStore: () => store, delay: async () => undefined,
        });
        (0, assert_1.equal)(report.remote.replacedObjects, 1);
        (0, assert_1.equal)(store.puts.length, 1);
        (0, assert_1.deepEqual)(store.puts[0].condition, { ifMatch: '"old-etag"' });
    });
    it("is idempotent when every remote object and the manifest match", async () => {
        const { store, candidate } = await storeWithExpected("all");
        const report = await executeSkillOrbPublisher(options("publish-staging-v2"), {
            createRemoteStore: () => store, delay: async () => undefined,
        });
        (0, assert_1.equal)(report.remote.reusedObjects, candidate.objects.length);
        (0, assert_1.equal)(report.remote.newObjects, 0);
        (0, assert_1.equal)(report.remote.futureWriteBytes, 0);
        (0, assert_1.equal)(store.putCalls, 0);
    });
    it("retries bounded 429 failures and completes paginated inventory", async () => {
        const { store } = await storeWithExpected();
        store.inventoryOnly.set("unrelated/a", 1);
        store.inventoryOnly.set("unrelated/b", 1);
        store.pageSize = 1;
        store.failFirstList = { $metadata: { httpStatusCode: 429 } };
        const report = await executeSkillOrbPublisher(options(), { createRemoteStore: () => store, delay: async () => undefined });
        (0, assert_1.equal)(report.decision, "GO");
        (0, assert_1.equal)(report.telemetry.retries, 1);
        (0, assert_1.ok)(report.remote.inventoryPages > 1);
    });
    it("times out bounded remote work", async () => {
        const store = new FakeStore();
        store.listPage = async () => new Promise(() => undefined);
        const report = await executeSkillOrbPublisher({ ...options(), retryAttempts: 1 }, {
            createRemoteStore: () => store, delay: async () => undefined,
        });
        (0, assert_1.equal)(report.decision, "NO-GO");
        (0, assert_1.deepEqual)(report.failure, { phase: "remote-preflight", code: "REMOTE_OPERATION_FAILED" });
    });
    it("fails closed when projected bytes reach the 10 GB ceiling", async () => {
        const { store, candidate } = await storeWithExpected();
        const presentBytes = [...store.objects.values()].reduce((sum, value) => sum + value.sizeBytes, 0);
        store.inventoryOnly.set("unrelated/large-object", 10000000000 - presentBytes - candidate.totals.candidateObjectBytes);
        const report = await executeSkillOrbPublisher(options(), { createRemoteStore: () => store, delay: async () => undefined });
        (0, assert_1.equal)(report.remote.projectedBucketBytes, 10000000000);
        (0, assert_1.equal)(report.remote.belowBucketCeiling, false);
        (0, assert_1.equal)(report.decision, "NO-GO");
        (0, assert_1.equal)(store.putCalls, 0);
    });
    it("reports a fresh second-LIST capacity race before any write", async () => {
        const { store, candidate } = await storeWithExpected();
        store.listHook = call => {
            if (call === 2) {
                store.inventoryOnly.set("unrelated/pre-write-growth", 10000000000 - candidate.totals.candidateObjectBytes);
            }
        };
        const report = await executeSkillOrbPublisher(options("publish-staging-v2"), {
            createRemoteStore: () => store, delay: async () => undefined,
        });
        (0, assert_1.deepEqual)(report.failure, { phase: "publication", code: "BUCKET_CEILING_REACHED" });
        (0, assert_1.equal)(report.remote.currentObjectCount, 1);
        (0, assert_1.equal)(report.remote.currentBucketBytes, 10000000000 - candidate.totals.candidateObjectBytes);
        (0, assert_1.equal)(report.remote.projectedBucketBytes, 10000000000);
        (0, assert_1.equal)(report.remote.belowBucketCeiling, false);
        (0, assert_1.equal)(store.putCalls, 0);
    });
    it("rechecks the 10 GB ceiling after immutable writes and before the manifest", async () => {
        const { store, candidate } = await storeWithExpected();
        const manifest = candidate.objects.find(value => value.kind === "manifest");
        store.listHook = call => {
            if (call === 3) {
                const presentBytes = [...store.objects.values()].reduce((sum, value) => sum + value.sizeBytes, 0);
                store.inventoryOnly.set("unrelated/concurrent-growth", 10000000000 - presentBytes - manifest.sizeBytes);
            }
        };
        const report = await executeSkillOrbPublisher(options("publish-staging-v2"), {
            createRemoteStore: () => store, delay: async () => undefined,
        });
        (0, assert_1.deepEqual)(report.failure, { phase: "publication", code: "BUCKET_CEILING_REACHED" });
        (0, assert_1.ok)(store.puts.every(value => value.key !== manifest.key));
    });
    it("retains sanitized telemetry after a partial write failure", async () => {
        const { store } = await storeWithExpected();
        const secret = "SUPER-SECRET-PARTIAL-WRITE";
        const originalGet = store.get.bind(store);
        store.get = async (key) => {
            if (store.putCalls > 0)
                throw new Error(secret);
            return originalGet(key);
        };
        const report = await executeSkillOrbPublisher(options("publish-staging-v2"), {
            createRemoteStore: () => store, delay: async () => undefined,
        });
        (0, assert_1.equal)(report.decision, "NO-GO");
        (0, assert_1.equal)(report.failure?.phase, "publication");
        (0, assert_1.ok)(report.telemetry.put > 0);
        (0, assert_1.equal)(report.telemetry.delete, 0);
        (0, assert_1.equal)(report.telemetry.stateWrites, 0);
        (0, assert_1.equal)(JSON.stringify(report).includes(secret), false);
    });
    it("never exposes secrets or a delete/state-write operation in reports", async () => {
        const { store } = await storeWithExpected();
        const secret = "SUPER-SECRET-R2-CREDENTIAL";
        const report = await executeSkillOrbPublisher(options(), { createRemoteStore: () => store, delay: async () => { void secret; } });
        const serialized = JSON.stringify(report);
        (0, assert_1.equal)(serialized.includes(secret), false);
        (0, assert_1.equal)(report.telemetry.delete, 0);
        (0, assert_1.equal)(report.telemetry.stateWrites, 0);
        (0, assert_1.equal)("delete" in store, false);
    });
    it("does not echo unknown CLI tokens or their values", () => {
        const secret = "SUPER-SECRET-ARGV";
        try {
            (0, game_db_skill_orb_publisher_1.parseSkillOrbPublisherArgs)(["--candidate", CANDIDATE, "--dry-run-staging-v2", `--unknown=${secret}`]);
            throw new Error("expected parse failure");
        }
        catch (error) {
            (0, assert_1.equal)(String(error).includes(secret), false);
            (0, assert_1.equal)(String(error).includes("--unknown"), false);
        }
    });
});
//# sourceMappingURL=game-db-skill-orb-publisher.spec.js.map