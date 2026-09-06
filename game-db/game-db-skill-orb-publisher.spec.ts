import { deepEqual, equal, match, ok, rejects } from "assert";
import { createHash } from "crypto";
import { existsSync } from "fs";
import { cp, link, mkdir, mkdtemp, readFile, rm, unlink, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { join, resolve } from "path";
import {
    ConditionalPut,
    executeSkillOrbPublisherTestHarness,
    parseSkillOrbPublisherArgs,
    RemoteInventoryPage,
    RemoteObjectMetadata,
    RemoteObjectRead,
    SKO02_PIN,
    SkillOrbObjectStore,
    SkillOrbPublisherOptions,
    SkillOrbPublisherTestDependencies,
    ValidatedSkillOrbCandidate,
    validateSkillOrbCandidate,
} from "./game-db-skill-orb-publisher";

const CANDIDATE = resolve("data/skill-orbs/candidate-sko11-1788329250-local");
const realCandidateIt = existsSync(CANDIDATE) ? it : it.skip;
let activeTestCandidate: ValidatedSkillOrbCandidate | undefined;
const syntheticRoots = new Set<string>();

function sha256(bytes: Buffer): string {
    return createHash("sha256").update(bytes).digest("hex");
}

function options(mode: SkillOrbPublisherOptions["mode"] = "dry-run-staging-v2"): SkillOrbPublisherOptions {
    return {
        candidateDir: CANDIDATE,
        mode,
        ...(mode === "publish-staging-v2" ? { confirmDatasetVersion: SKO02_PIN.datasetVersion } : {}),
        concurrency: 4,
        timeoutMs: 1_000,
        retryAttempts: 2,
        retryBaseDelayMs: 0,
    };
}

async function executeSkillOrbPublisher(
    publisherOptions: SkillOrbPublisherOptions,
    dependencies: SkillOrbPublisherTestDependencies,
) {
    const result = await executeSkillOrbPublisherTestHarness(publisherOptions, {
        ...dependencies,
        ...(activeTestCandidate ? { validateCandidateForTestOnly: async () => activeTestCandidate! } : {}),
    });
    equal(result.authority, "TEST_ONLY_NON_AUTHORITATIVE");
    return result.report;
}

interface StoredObject extends RemoteObjectMetadata { bytes: Buffer }

class FakeStore implements SkillOrbObjectStore {
    readonly objects = new Map<string, StoredObject>();
    readonly inventoryOnly = new Map<string, number>();
    readonly puts: Array<{ key: string, condition: ConditionalPut }> = [];
    listCalls = 0;
    headCalls = 0;
    getCalls = 0;
    putCalls = 0;
    pageSize = 10_000;
    failFirstList?: unknown;
    listHook?: (call: number) => void;

    async listPage(continuationToken: string | undefined): Promise<RemoteInventoryPage> {
        this.listCalls += 1;
        this.listHook?.(this.listCalls);
        if (this.failFirstList && this.listCalls === 1) throw this.failFirstList;
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

    async head(key: string): Promise<RemoteObjectMetadata | undefined> {
        this.headCalls += 1;
        const value = this.objects.get(key);
        if (!value) return undefined;
        const { bytes: _bytes, ...metadata } = value;
        return { ...metadata };
    }

    async get(key: string): Promise<RemoteObjectRead | undefined> {
        this.getCalls += 1;
        const value = this.objects.get(key);
        return value ? { ...value, bytes: Buffer.from(value.bytes) } : undefined;
    }

    async put(
        key: string,
        bytes: Buffer,
        metadata: Omit<RemoteObjectMetadata, "sizeBytes" | "etag">,
        condition: ConditionalPut,
    ): Promise<"written" | "precondition-failed"> {
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

async function readExpected(candidate: Awaited<ReturnType<typeof validateSkillOrbCandidate>>, object: typeof candidate.objects[number]): Promise<Buffer> {
    return readFile(join(candidate.root, ...object.relativePath.split("/")));
}

async function realStoreWithExpected(mode: "bounded-preflight" | "all" = "bounded-preflight"): Promise<{ store: FakeStore, candidate: Awaited<ReturnType<typeof validateSkillOrbCandidate>> }> {
    const candidate = await validateSkillOrbCandidate(CANDIDATE);
    activeTestCandidate = candidate;
    const store = new FakeStore();
    for (const object of candidate.objects) {
        const absent = mode === "bounded-preflight" && (
            object.kind === "manifest" || object.kind === "payload"
            || object.key.endsWith("/lv-5-6.png") || object.key.endsWith("/lv-7-6.png")
        );
        if (absent) continue;
        const bytes = await readExpected(candidate, object);
        store.objects.set(object.key, {
            bytes, sizeBytes: bytes.byteLength, etag: `"${sha256(bytes).slice(0, 32)}"`,
            contentType: object.contentType, contentEncoding: object.contentEncoding,
            cacheControl: object.cacheControl, sha256Metadata: object.sha256Metadata,
        });
    }
    return { store, candidate };
}

async function storeWithExpected(mode: "bounded-preflight" | "all" = "bounded-preflight"): Promise<{ store: FakeStore, candidate: ValidatedSkillOrbCandidate }> {
    const root = await mkdtemp(join(tmpdir(), "sko02-core-"));
    syntheticRoots.add(root);
    const definitions = [
        { kind: "asset", relativePath: "assets/a.png", key: "staging/v2/game-assets/a.png", bytes: Buffer.from("asset-a"), contentType: "image/png", immutable: true },
        { kind: "asset", relativePath: "assets/b.png", key: "staging/v2/game-assets/b.png", bytes: Buffer.from("asset-b"), contentType: "image/png", immutable: true },
        { kind: "payload", relativePath: "payload.json.gz", key: "staging/v2/equipment-skill-orbs/objects/synthetic.json.gz", bytes: Buffer.from("payload"), contentType: "application/json", contentEncoding: "gzip", immutable: true },
        { kind: "manifest", relativePath: "equipment-skill-orbs-manifest.json", key: "staging/v2/equipment-skill-orbs-manifest.json", bytes: Buffer.from("{\"synthetic\":true}\n"), contentType: "application/json", immutable: false },
    ] as const;
    for (const definition of definitions) {
        await mkdir(resolve(root, definition.relativePath, ".."), { recursive: true });
        await writeFile(resolve(root, definition.relativePath), definition.bytes);
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
            assets: { count: 2, sizeBytes: 14, inventorySha256: "3".repeat(64) }, counts: {} as any,
        },
        manifestSha256: sha256(definitions[3].bytes), assetManifestSha256: "4".repeat(64),
        sourceFingerprint: "5".repeat(64), objects,
        totals: { assets: 2, assetBytes: 14, candidateObjectBytes: objects.reduce((sum, object) => sum + object.sizeBytes, 0) },
    } as ValidatedSkillOrbCandidate;
    activeTestCandidate = candidate;
    const store = new FakeStore();
    for (const object of candidate.objects) {
        const absent = mode === "bounded-preflight";
        if (absent) continue;
        const bytes = await readExpected(candidate, object);
        store.objects.set(object.key, {
            bytes, sizeBytes: bytes.byteLength, etag: `"${sha256(bytes).slice(0, 32)}"`,
            contentType: object.contentType, contentEncoding: object.contentEncoding,
            cacheControl: object.cacheControl, sha256Metadata: object.sha256Metadata,
        });
    }
    return { store, candidate };
}

async function copyCandidate(): Promise<string> {
    const parent = await mkdtemp(join(tmpdir(), "sko02-"));
    const destination = join(parent, "candidate");
    await cp(CANDIDATE, destination, { recursive: true });
    return destination;
}

async function mutateJson(root: string, relativePath: string, mutate: (value: any) => void): Promise<void> {
    const path = join(root, relativePath);
    const value = JSON.parse(await readFile(path, "utf8"));
    mutate(value);
    await writeFile(path, `${JSON.stringify(value, null, 2)}\n`);
}

describe("SKO-02 Skill Orb publisher", function () {
    this.timeout(120_000);

    after(async () => {
        await Promise.all([...syntheticRoots].map(root => rm(root, { recursive: true, force: true })));
    });

    realCandidateIt("source-binds the exact pinned candidate and all bounded files", async () => {
        const candidate = await validateSkillOrbCandidate(CANDIDATE);
        equal(candidate.manifest.datasetVersion, SKO02_PIN.datasetVersion);
        equal(candidate.manifest.payload.sha256, SKO02_PIN.payloadSha256);
        equal(candidate.totals.assets, 196);
        equal(candidate.totals.assetBytes, 2_153_473);
        equal(candidate.objects.length, 198);
        ok(candidate.objects.every(value => value.key.startsWith("staging/v2/")));
    });

    realCandidateIt("rejects snapshot, version, hash and size drift", async () => {
        for (const mutate of [
            (value: any) => { value.snapshotVersion = "1788329251"; },
            (value: any) => { value.datasetVersion = "wrong"; },
            (value: any) => { value.payload.sha256 = "0".repeat(64); },
            (value: any) => { value.payload.sizeBytes += 1; },
        ]) {
            const root = await copyCandidate();
            try {
                await mutateJson(root, "equipment-skill-orbs-manifest.json", mutate);
                await rejects(validateSkillOrbCandidate(root), /pinned release/);
            } finally { await rm(resolve(root, ".."), { recursive: true, force: true }); }
        }
    });

    realCandidateIt("rejects a divergent expanded/raw payload", async () => {
        const root = await copyCandidate();
        try {
            const path = join(root, "equipment-skill-orbs.json");
            const bytes = await readFile(path);
            bytes[100] ^= 1;
            await writeFile(path, bytes);
            await rejects(validateSkillOrbCandidate(root), /Raw Skill Orb payload/);
        } finally { await rm(resolve(root, ".."), { recursive: true, force: true }); }
    });

    realCandidateIt("rejects duplicate and traversal asset inventory paths", async () => {
        for (const mutate of [
            (value: any) => { value.inventory.assets[1].path = value.inventory.assets[0].path; },
            (value: any) => { value.inventory.assets[0].path = "../escape.png"; },
        ]) {
            const root = await copyCandidate();
            try {
                await mutateJson(root, "equipment-skill-orb-assets-manifest.json", mutate);
                await rejects(validateSkillOrbCandidate(root), /inventory|asset entry/i);
            } finally { await rm(resolve(root, ".."), { recursive: true, force: true }); }
        }
    });

    realCandidateIt("rejects missing and extra candidate files", async () => {
        const missing = await copyCandidate();
        try {
            await unlink(join(missing, "game-assets/derived/equipment/levels/lv-1.png"));
            await rejects(validateSkillOrbCandidate(missing), /Missing Skill Orb candidate file|missing or extra/);
        } finally { await rm(resolve(missing, ".."), { recursive: true, force: true }); }
        const extra = await copyCandidate();
        try {
            await writeFile(join(extra, "unexpected.txt"), "unexpected");
            await rejects(validateSkillOrbCandidate(extra), /missing or extra/);
        } finally { await rm(resolve(extra, ".."), { recursive: true, force: true }); }
    });

    realCandidateIt("rejects oversized files and linked file identities before parsing", async () => {
        const oversized = await copyCandidate();
        try {
            await writeFile(join(oversized, "equipment-skill-orbs-manifest.json"), Buffer.alloc(64 * 1024 + 1, 0x20));
            await rejects(validateSkillOrbCandidate(oversized), /Invalid bounded Skill Orb file/);
        } finally { await rm(resolve(oversized, ".."), { recursive: true, force: true }); }

        const linked = await copyCandidate();
        try {
            const target = join(linked, "game-assets/derived/equipment/levels/lv-1.png");
            const source = join(linked, "game-assets/derived/equipment/levels/lv-2.png");
            await unlink(target);
            await link(source, target);
            await rejects(validateSkillOrbCandidate(linked), /Invalid bounded Skill Orb file|unsupported entry/);
        } finally { await rm(resolve(linked, ".."), { recursive: true, force: true }); }
    });

    realCandidateIt("rejects cross-channel keys and production modes", async () => {
        const root = await copyCandidate();
        try {
            await mutateJson(root, "equipment-skill-orbs-manifest.json", value => {
                value.payload.objectKey = "production/equipment-skill-orbs.json.gz";
            });
            await rejects(validateSkillOrbCandidate(root), /pinned release/);
        } finally { await rm(resolve(root, ".."), { recursive: true, force: true }); }
        try {
            parseSkillOrbPublisherArgs(["--candidate", CANDIDATE, "--production", "--dry-run-staging-v2"]);
            throw new Error("expected parse failure");
        } catch (error) { match(String(error), /Unexpected/); }
    });

    it("requires live authorization before constructing a remote store", async () => {
        let factoryCalls = 0;
        await rejects(executeSkillOrbPublisher({ ...options("publish-staging-v2"), confirmDatasetVersion: undefined }, {
            createRemoteStore: () => { factoryCalls += 1; return new FakeStore(); },
            delay: async () => undefined,
        }), /requires --confirm-dataset-version/);
        equal(factoryCalls, 0);
    });

    it("rejects every unknown runtime mode before constructing a remote store", async () => {
        let factoryCalls = 0;
        await rejects(executeSkillOrbPublisher({ ...options(), mode: "production" as any }, {
            createRemoteStore: () => { factoryCalls += 1; return new FakeStore(); },
            delay: async () => undefined,
        }), /Invalid Skill Orb publisher mode/);
        equal(factoryCalls, 0);
    });

    realCandidateIt("reproduces the bounded read-only plan with no writes", async () => {
        const { store, candidate } = await realStoreWithExpected();
        const report = await executeSkillOrbPublisher(options(), { createRemoteStore: () => store, delay: async () => undefined });
        const missingBytes = candidate.objects
            .filter(value => !store.objects.has(value.key))
            .reduce((sum, value) => sum + value.sizeBytes, 0);
        equal(report.decision, "GO");
        equal(report.remote!.reusedObjects, 194);
        equal(report.remote!.newObjects, 4);
        equal(report.remote!.conflictingObjects, 0);
        equal(report.remote!.newNetBytes, missingBytes);
        equal(report.remote!.futureWriteBytes, missingBytes);
        equal(store.putCalls, 0);
        equal(report.telemetry.put, 0);
        equal(report.telemetry.delete, 0);
        equal(report.telemetry.stateWrites, 0);
    });

    it("fails closed on immutable byte conflicts", async () => {
        const { store, candidate } = await storeWithExpected("all");
        const target = candidate.objects.find(value => value.kind === "asset" && store.objects.has(value.key))!;
        store.objects.get(target.key)!.bytes[0] ^= 1;
        const report = await executeSkillOrbPublisher(options(), { createRemoteStore: () => store, delay: async () => undefined });
        equal(report.decision, "NO-GO");
        equal(report.remote!.conflictingObjects, 1);
        equal(report.remote!.objects.find(value => value.key === target.key)!.reason, "immutable-byte-conflict");
    });

    it("fails closed on immutable metadata drift", async () => {
        const { store, candidate } = await storeWithExpected("all");
        const target = candidate.objects.find(value => value.kind === "asset" && store.objects.has(value.key))!;
        store.objects.get(target.key)!.contentType = "application/octet-stream";
        const report = await executeSkillOrbPublisher(options(), { createRemoteStore: () => store, delay: async () => undefined });
        equal(report.decision, "NO-GO");
        equal(report.remote!.objects.find(value => value.key === target.key)!.reason, "immutable-metadata-drift");
    });

    it("detects a metadata-only manifest baseline race before the first write", async () => {
        const { store, candidate } = await storeWithExpected("all");
        const manifest = candidate.objects.find(value => value.kind === "manifest")!;
        store.listHook = call => {
            if (call === 2) {
                store.objects.get(manifest.key)!.cacheControl = "max-age=1";
            }
        };
        const report = await executeSkillOrbPublisher(options("publish-staging-v2"), {
            createRemoteStore: () => store, delay: async () => undefined,
        });
        deepEqual(report.failure, { phase: "publication", code: "BASELINE_CHANGED" });
        equal(store.putCalls, 0);
    });

    it("detects a metadata-only manifest baseline race before manifest promotion", async () => {
        const { store, candidate } = await storeWithExpected();
        const manifest = candidate.objects.find(value => value.kind === "manifest")!;
        const oldBytes = Buffer.from("old manifest");
        store.objects.set(manifest.key, {
            bytes: oldBytes, sizeBytes: oldBytes.length, etag: '"same-etag"', contentType: "application/json",
            cacheControl: "no-store", sha256Metadata: sha256(oldBytes),
        });
        store.listHook = call => {
            if (call === 3) {
                store.objects.get(manifest.key)!.cacheControl = "max-age=1";
            }
        };
        const report = await executeSkillOrbPublisher(options("publish-staging-v2"), {
            createRemoteStore: () => store, delay: async () => undefined,
        });
        deepEqual(report.failure, { phase: "publication", code: "BASELINE_CHANGED" });
        ok(store.puts.every(value => value.key !== manifest.key));
    });

    it("uses create-only immutable writes, verifies readback and writes the manifest last", async () => {
        const { store, candidate } = await storeWithExpected();
        const report = await executeSkillOrbPublisher(options("publish-staging-v2"), {
            createRemoteStore: () => store, delay: async () => undefined,
        });
        equal(report.decision, "GO");
        equal(store.puts.length, 4);
        ok(store.puts.slice(0, -1).every(value => "ifNoneMatch" in value.condition));
        equal(store.puts.at(-1)!.key, candidate.objects.find(value => value.kind === "manifest")!.key);
        ok("ifNoneMatch" in store.puts.at(-1)!.condition);
        equal(report.telemetry.bytesWritten, candidate.totals.candidateObjectBytes);
        equal(report.telemetry.delete, 0);
    });

    it("uses a strong-ETag CAS for a different mutable manifest", async () => {
        const { store, candidate } = await storeWithExpected("all");
        const manifest = candidate.objects.find(value => value.kind === "manifest")!;
        const different = Buffer.from("old manifest");
        store.objects.set(manifest.key, {
            bytes: different, sizeBytes: different.length, etag: '"old-etag"',
            contentType: "application/json", cacheControl: "no-store", sha256Metadata: sha256(different),
        });
        const report = await executeSkillOrbPublisher(options("publish-staging-v2"), {
            createRemoteStore: () => store, delay: async () => undefined,
        });
        equal(report.remote!.replacedObjects, 1);
        equal(store.puts.length, 1);
        deepEqual(store.puts[0].condition, { ifMatch: '"old-etag"' });
    });

    it("is idempotent when every remote object and the manifest match", async () => {
        const { store, candidate } = await storeWithExpected("all");
        const report = await executeSkillOrbPublisher(options("publish-staging-v2"), {
            createRemoteStore: () => store, delay: async () => undefined,
        });
        equal(report.remote!.reusedObjects, candidate.objects.length);
        equal(report.remote!.newObjects, 0);
        equal(report.remote!.futureWriteBytes, 0);
        equal(store.putCalls, 0);
    });

    it("retries bounded 429 failures and completes paginated inventory", async () => {
        const { store } = await storeWithExpected();
        store.inventoryOnly.set("unrelated/a", 1);
        store.inventoryOnly.set("unrelated/b", 1);
        store.pageSize = 1;
        store.failFirstList = { $metadata: { httpStatusCode: 429 } };
        const report = await executeSkillOrbPublisher(options(), { createRemoteStore: () => store, delay: async () => undefined });
        equal(report.decision, "GO");
        equal(report.telemetry.retries, 1);
        ok(report.remote!.inventoryPages > 1);
    });

    it("times out bounded remote work", async () => {
        const store = new FakeStore();
        store.listPage = async () => new Promise<RemoteInventoryPage>(() => undefined);
        const report = await executeSkillOrbPublisher({ ...options(), retryAttempts: 1 }, {
            createRemoteStore: () => store, delay: async () => undefined,
        });
        equal(report.decision, "NO-GO");
        deepEqual(report.failure, { phase: "remote-preflight", code: "REMOTE_OPERATION_FAILED" });
    });

    it("fails closed when projected bytes reach the 10 GB ceiling", async () => {
        const { store, candidate } = await storeWithExpected();
        const presentBytes = [...store.objects.values()].reduce((sum, value) => sum + value.sizeBytes, 0);
        store.inventoryOnly.set("unrelated/large-object", 10_000_000_000 - presentBytes - candidate.totals.candidateObjectBytes);
        const report = await executeSkillOrbPublisher(options(), { createRemoteStore: () => store, delay: async () => undefined });
        equal(report.remote!.projectedBucketBytes, 10_000_000_000);
        equal(report.remote!.belowBucketCeiling, false);
        equal(report.decision, "NO-GO");
        equal(store.putCalls, 0);
    });

    it("reports a fresh second-LIST capacity race before any write", async () => {
        const { store, candidate } = await storeWithExpected();
        store.listHook = call => {
            if (call === 2) {
                store.inventoryOnly.set("unrelated/pre-write-growth", 10_000_000_000 - candidate.totals.candidateObjectBytes);
            }
        };
        const report = await executeSkillOrbPublisher(options("publish-staging-v2"), {
            createRemoteStore: () => store, delay: async () => undefined,
        });
        deepEqual(report.failure, { phase: "publication", code: "BUCKET_CEILING_REACHED" });
        equal(report.remote!.currentObjectCount, 1);
        equal(report.remote!.currentBucketBytes, 10_000_000_000 - candidate.totals.candidateObjectBytes);
        equal(report.remote!.projectedBucketBytes, 10_000_000_000);
        equal(report.remote!.belowBucketCeiling, false);
        equal(store.putCalls, 0);
    });

    it("rechecks the 10 GB ceiling after immutable writes and before the manifest", async () => {
        const { store, candidate } = await storeWithExpected();
        const manifest = candidate.objects.find(value => value.kind === "manifest")!;
        store.listHook = call => {
            if (call === 3) {
                const presentBytes = [...store.objects.values()].reduce((sum, value) => sum + value.sizeBytes, 0);
                store.inventoryOnly.set("unrelated/concurrent-growth", 10_000_000_000 - presentBytes - manifest.sizeBytes);
            }
        };
        const report = await executeSkillOrbPublisher(options("publish-staging-v2"), {
            createRemoteStore: () => store, delay: async () => undefined,
        });
        deepEqual(report.failure, { phase: "publication", code: "BUCKET_CEILING_REACHED" });
        ok(store.puts.every(value => value.key !== manifest.key));
    });

    it("retains sanitized telemetry after a partial write failure", async () => {
        const { store } = await storeWithExpected();
        const secret = "SUPER-SECRET-PARTIAL-WRITE";
        const originalGet = store.get.bind(store);
        store.get = async key => {
            if (store.putCalls > 0) throw new Error(secret);
            return originalGet(key);
        };
        const report = await executeSkillOrbPublisher(options("publish-staging-v2"), {
            createRemoteStore: () => store, delay: async () => undefined,
        });
        equal(report.decision, "NO-GO");
        equal(report.failure?.phase, "publication");
        ok(report.telemetry.put > 0);
        equal(report.telemetry.delete, 0);
        equal(report.telemetry.stateWrites, 0);
        equal(JSON.stringify(report).includes(secret), false);
    });

    it("never exposes secrets or a delete/state-write operation in reports", async () => {
        const { store } = await storeWithExpected();
        const secret = "SUPER-SECRET-R2-CREDENTIAL";
        const report = await executeSkillOrbPublisher(options(), { createRemoteStore: () => store, delay: async () => { void secret; } });
        const serialized = JSON.stringify(report);
        equal(serialized.includes(secret), false);
        equal(report.telemetry.delete, 0);
        equal(report.telemetry.stateWrites, 0);
        equal("delete" in store, false);
    });

    it("does not echo unknown CLI tokens or their values", () => {
        const secret = "SUPER-SECRET-ARGV";
        try {
            parseSkillOrbPublisherArgs(["--candidate", CANDIDATE, "--dry-run-staging-v2", `--unknown=${secret}`]);
            throw new Error("expected parse failure");
        } catch (error) {
            equal(String(error).includes(secret), false);
            equal(String(error).includes("--unknown"), false);
        }
    });
});
