import { deepEqual, equal, match, rejects } from "assert";
import { createHash } from "crypto";
import { chmodSync, existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "fs";
import { FileHandle } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { Readable } from "stream";
import { DERIVED_SQLITE_MAX_BYTES } from "./game-db-derived-sqlite-artifact-contract";
import {
    deriveSqliteArtifact,
    DerivedSqliteOutputSink,
    DerivedSqliteSecretProvider,
    DerivedSqliteTransformer,
    DerivedSqliteTransformerResult,
    MAX_DERIVED_TRANSFORM_TIMEOUT_MS,
} from "./game-db-derived-sqlite-artifact-runner";
import { validateDerivedSqliteArtifact } from "./game-db-derived-sqlite-artifact-validator";
import { acquireDatabaseArtifact, DatabaseArtifactTransport } from "./game-db-download-database-artifact";

const version = Math.floor(Date.UTC(2026, 7, 12, 8, 16, 57) / 1000);
const implementationSha256 = createHash("sha256").update("injected-test-transformer-v1").digest("hex");
const secretSentinel = "DQ-SECRET-SENTINEL-2d78803f";

function temp(prefix = "dokkan-dq-"): string { return mkdtempSync(join(tmpdir(), prefix)); }

function descriptor(): any {
    return {
        url: "https://cf.ishin-global.aktsk.com/sqlite/current/en/20260812-081657/database.db",
        file_path: "sqlite/current/en/database.db",
        algorithm: "version",
        hash: String(version),
        version,
        patch: null,
        patch_hash: null,
    };
}

function fakeTransport(bytes: Buffer): DatabaseArtifactTransport {
    return { async get() { return { statusCode: 200, headers: { "content-length": String(bytes.length) }, body: Readable.from([bytes]) }; } };
}

async function createParent(base: string): Promise<{ storeRoot: string, identity: string }> {
    const storeRoot = join(base, "aq-store");
    const acquired = await acquireDatabaseArtifact({
        descriptor: descriptor(),
        storeRoot,
        transport: fakeTransport(Buffer.from("synthetic-encrypted-aq-source-v1")),
        now: () => new Date("2026-08-13T12:00:00.000Z"),
    });
    equal(acquired.metadata.artifactState, "encrypted_or_packaged");
    return { storeRoot, identity: acquired.identity };
}

function sqliteBytes(seed = 0): Buffer {
    const bytes = Buffer.alloc(512);
    Buffer.from("SQLite format 3\u0000", "utf8").copy(bytes, 0);
    bytes.writeUInt16BE(512, 16);
    bytes[18] = 1;
    bytes[19] = 1;
    bytes[20] = 0;
    bytes[21] = 64;
    bytes[22] = 32;
    bytes[23] = 32;
    bytes.writeUInt32BE(1, 28);
    bytes.writeUInt32BE(4, 44);
    bytes.writeUInt32BE(1, 56);
    bytes.writeUInt32BE(1, 92);
    bytes.writeUInt32BE(3_045_000, 96);
    bytes[100] = 13;
    bytes.writeUInt16BE(512, 105);
    bytes[511] = seed;
    return bytes;
}

function declaration(bytes: Buffer, overrides: Partial<DerivedSqliteTransformerResult> = {}): DerivedSqliteTransformerResult {
    return {
        declaredSizeBytes: bytes.length,
        declaredSha256: createHash("sha256").update(bytes).digest("hex"),
        ...overrides,
    };
}

function transformer(run: (context: { source: FileHandle, output: DerivedSqliteOutputSink, secret: Uint8Array, signal: AbortSignal }) => Promise<DerivedSqliteTransformerResult>, parameters: Record<string, unknown> = { cipherCompatibility: 4 }): DerivedSqliteTransformer {
    return {
        kind: "sqlcipher_decrypt",
        implementation: { identity: "injected-test-transformer", version: "1.0.0-test", sha256: implementationSha256 },
        nonSecretParameters: parameters as any,
        transform: run,
    };
}

function secretProvider(counter?: { calls: number }): DerivedSqliteSecretProvider {
    return {
        async provideSecret() {
            if (counter) counter.calls += 1;
            return Buffer.from(secretSentinel, "utf8");
        },
    };
}

function writingTransformer(bytes: Buffer, overrides: Partial<DerivedSqliteTransformerResult> = {}): DerivedSqliteTransformer {
    return transformer(async ({ output, secret }) => {
        equal(Buffer.from(secret).toString("utf8"), secretSentinel);
        await output.write(bytes);
        return declaration(bytes, overrides);
    });
}

function treeBytes(root: string): Array<{ relativePath: string, bytes: Buffer }> {
    if (!existsSync(root)) return [];
    const result: Array<{ relativePath: string, bytes: Buffer }> = [];
    const visit = (directory: string, prefix: string) => {
        for (const entry of readdirSync(directory, { withFileTypes: true })) {
            const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;
            const path = join(directory, entry.name);
            if (entry.isDirectory()) visit(path, relativePath);
            else result.push({ relativePath, bytes: readFileSync(path) });
        }
    };
    visit(root, "");
    return result;
}

describe("derived decrypted SQLite artifact DQ0-DQ4", function () {
    this.timeout(15_000);
    const roots: string[] = [];
    afterEach(() => {
        while (roots.length) rmSync(roots.pop()!, { recursive: true, force: true });
    });

    it("creates deterministic marker-last metadata and keeps operational time in a receipt", async () => {
        const base = temp(); roots.push(base);
        const parent = await createParent(base);
        const storeRoot = join(base, "derived-store");
        const output = sqliteBytes(7);
        const first = await deriveSqliteArtifact({
            source: { storeRoot: parent.storeRoot, useLatest: true },
            derivedStoreRoot: storeRoot,
            transformer: writingTransformer(output),
            secretProvider: secretProvider(),
            now: () => new Date("2026-08-13T13:00:00.000Z"),
        });
        const second = await deriveSqliteArtifact({
            source: { storeRoot: parent.storeRoot, artifactIdentity: parent.identity },
            derivedStoreRoot: storeRoot,
            transformer: writingTransformer(output),
            secretProvider: secretProvider(),
            now: () => new Date("2026-08-13T14:00:00.000Z"),
        });

        equal(first.reused, false);
        equal(second.reused, true);
        equal(first.identity, second.identity);
        equal(first.metadata.parent.artifactIdentity, parent.identity);
        equal(first.metadata.parent.sourceState, "encrypted_or_packaged");
        equal(first.metadata.transform.implementation.sha256, implementationSha256);
        deepEqual(first.metadata.transform.nonSecretParameters, { cipherCompatibility: 4 });
        equal(first.metadata.output.sizeBytes, output.length);
        equal(first.metadata.output.state, "readable_sqlite");
        const validated = await validateDerivedSqliteArtifact({ storeRoot, sourceStoreRoot: parent.storeRoot, artifactIdentity: first.identity });
        const metadataText = readFileSync(validated.metadataPath, "utf8");
        equal(/At|timestamp|result|reused|created/.test(metadataText), false);
        equal(second.receipt.completedAt, "2026-08-13T14:00:00.000Z");
        equal(second.receipt.result, "reused");
        match(second.receiptFileName, /^[a-f0-9]{64}\.json$/);
        const receiptText = readFileSync(join(storeRoot, "receipts", second.receiptFileName), "utf8");
        equal(/key|url|headers|query|descriptor|absolute|account|stdout|stderr/i.test(receiptText), false);
        deepEqual(readdirSync(validated.artifactDirectory).sort(), ["commit-marker.json", "database.sqlite", "metadata.json"]);
        equal((statSync(validated.artifactPath).mode & 0o222), 0);
    });

    it("rejects malformed runtime objects, unsafe parameters and malformed committed JSON", async () => {
        await rejects(() => deriveSqliteArtifact({} as any), /options are invalid/);
        await rejects(() => validateDerivedSqliteArtifact({ storeRoot: temp(), sourceStoreRoot: temp(), artifactIdentity: "../escape" } as any), /identity is invalid/);

        const base = temp(); roots.push(base);
        const parent = await createParent(base);
        const providerCalls = { calls: 0 };
        for (const timeoutMs of [0, -1, 1.5, MAX_DERIVED_TRANSFORM_TIMEOUT_MS + 1, "25"] as any[]) {
            await rejects(() => deriveSqliteArtifact({
                source: { storeRoot: parent.storeRoot, artifactIdentity: parent.identity },
                derivedStoreRoot: join(base, `invalid-timeout-${String(timeoutMs)}`),
                transformer: writingTransformer(sqliteBytes()),
                secretProvider: secretProvider(providerCalls),
                timeoutMs,
            } as any), /timeout is invalid/);
        }
        await rejects(() => deriveSqliteArtifact({
            source: { storeRoot: parent.storeRoot, artifactIdentity: parent.identity },
            derivedStoreRoot: join(base, "invalid-signal"),
            transformer: writingTransformer(sqliteBytes()),
            secretProvider: secretProvider(providerCalls),
            signal: {},
        } as any), /AbortSignal is invalid/);
        await rejects(() => deriveSqliteArtifact({
            source: { storeRoot: parent.storeRoot, artifactIdentity: parent.identity },
            derivedStoreRoot: join(base, "unsafe-parameters"),
            transformer: transformer(async () => declaration(sqliteBytes()), { keyPath: "../secret" }),
            secretProvider: secretProvider(providerCalls),
        }), /prohibited field/);
        equal(providerCalls.calls, 0);

        const storeRoot = join(base, "derived-store");
        const committed = await deriveSqliteArtifact({
            source: { storeRoot: parent.storeRoot, artifactIdentity: parent.identity },
            derivedStoreRoot: storeRoot,
            transformer: writingTransformer(sqliteBytes()),
            secretProvider: secretProvider(),
        });
        const validated = await validateDerivedSqliteArtifact({ storeRoot, sourceStoreRoot: parent.storeRoot, artifactIdentity: committed.identity });
        chmodSync(validated.metadataPath, 0o600);
        writeFileSync(validated.metadataPath, "{malformed", "utf8");
        chmodSync(validated.metadataPath, 0o444);
        await rejects(() => validateDerivedSqliteArtifact({ storeRoot, sourceStoreRoot: parent.storeRoot, artifactIdentity: committed.identity }), /metadata JSON is malformed/);
    });

    it("does not leak a secret sentinel through artifacts, receipts, results, filenames or errors", async () => {
        const base = temp(); roots.push(base);
        const parent = await createParent(base);
        const storeRoot = join(base, secretSentinel, "derived-store");
        const result = await deriveSqliteArtifact({
            source: { storeRoot: parent.storeRoot, artifactIdentity: parent.identity },
            derivedStoreRoot: storeRoot,
            transformer: writingTransformer(sqliteBytes()),
            secretProvider: secretProvider(),
        });
        equal(JSON.stringify(result).includes(secretSentinel), false);
        for (const item of treeBytes(storeRoot)) {
            equal(item.relativePath.includes(secretSentinel), false);
            equal(item.bytes.includes(Buffer.from(secretSentinel)), false, item.relativePath);
        }

        let failure: unknown;
        try {
            await deriveSqliteArtifact({
                source: { storeRoot: parent.storeRoot, artifactIdentity: parent.identity },
                derivedStoreRoot: join(base, "failing-store"),
                transformer: transformer(async () => { throw new Error(secretSentinel); }),
                secretProvider: secretProvider(),
            });
        } catch (error) { failure = error; }
        match(String(failure), /Derived transformer failed/);
        equal(String(failure).includes(secretSentinel), false);
        for (const item of treeBytes(join(base, "failing-store"))) {
            equal(item.relativePath.includes(secretSentinel), false);
            equal(item.bytes.includes(Buffer.from(secretSentinel)), false, item.relativePath);
        }
    });

    it("rejects empty, oversized, non-SQLite and falsely declared output", async () => {
        const base = temp(); roots.push(base);
        const parent = await createParent(base);
        const valid = sqliteBytes();
        const cases: Array<{ name: string, value: DerivedSqliteTransformer }> = [
            { name: "empty", value: transformer(async () => ({ declaredSizeBytes: 1, declaredSha256: "0".repeat(64) })) },
            { name: "non-sqlite", value: writingTransformer(Buffer.alloc(512)) },
            { name: "wrong-size", value: writingTransformer(valid, { declaredSizeBytes: valid.length + 1 }) },
            { name: "wrong-hash", value: writingTransformer(valid, { declaredSha256: "0".repeat(64) }) },
        ];
        for (const item of cases) {
            const storeRoot = join(base, `derived-${item.name}`);
            await rejects(() => deriveSqliteArtifact({
                source: { storeRoot: parent.storeRoot, artifactIdentity: parent.identity },
                derivedStoreRoot: storeRoot,
                transformer: item.value,
                secretProvider: secretProvider(),
            }));
            const artifacts = join(storeRoot, "artifacts");
            equal(existsSync(artifacts) ? readdirSync(artifacts).length : 0, 0, item.name);
        }
    });

    it("bounds a hanging transformer, propagates cancellation and revokes late writes", async () => {
        const base = temp(); roots.push(base);
        const parent = await createParent(base);
        let timeoutSignal: AbortSignal | undefined;
        let lateWrite: (() => Promise<void>) | undefined;
        const startedAt = Date.now();
        await rejects(() => deriveSqliteArtifact({
            source: { storeRoot: parent.storeRoot, artifactIdentity: parent.identity },
            derivedStoreRoot: join(base, "timeout-store"),
            transformer: transformer(async ({ output, signal }) => {
                timeoutSignal = signal;
                lateWrite = () => output.write(sqliteBytes());
                return new Promise<DerivedSqliteTransformerResult>(() => undefined);
            }),
            secretProvider: secretProvider(),
            timeoutMs: 25,
        }), /Derived transformer timed out/);
        equal(Date.now() - startedAt < 1_000, true);
        equal(timeoutSignal?.aborted, true);
        await rejects(() => lateWrite!(), /output sink is closed/);
        equal(readdirSync(join(base, "timeout-store", "work")).length, 0);

        const controller = new AbortController();
        let cancellationSignal: AbortSignal | undefined;
        await rejects(() => deriveSqliteArtifact({
            source: { storeRoot: parent.storeRoot, artifactIdentity: parent.identity },
            derivedStoreRoot: join(base, "cancel-store"),
            transformer: transformer(async ({ signal }) => {
                cancellationSignal = signal;
                setTimeout(() => controller.abort(), 20);
                return new Promise<DerivedSqliteTransformerResult>(() => undefined);
            }),
            secretProvider: secretProvider(),
            timeoutMs: 1_000,
            signal: controller.signal,
        }), /Derived transformation was cancelled/);
        equal(cancellationSignal?.aborted, true);
        equal(readdirSync(join(base, "cancel-store", "work")).length, 0);
    });

    it("rejects a controlled-sink write before it can exceed the 112 MiB quota", async () => {
        const base = temp(); roots.push(base);
        const parent = await createParent(base);
        const storeRoot = join(base, "quota-store");
        await rejects(() => deriveSqliteArtifact({
            source: { storeRoot: parent.storeRoot, artifactIdentity: parent.identity },
            derivedStoreRoot: storeRoot,
            transformer: transformer(async ({ output }) => {
                await output.write(Buffer.allocUnsafe(DERIVED_SQLITE_MAX_BYTES + 1));
                return declaration(sqliteBytes());
            }),
            secretProvider: secretProvider(),
        }), /output exceeds the byte limit/);
        equal(readdirSync(join(storeRoot, "artifacts")).length, 0);
        equal(readdirSync(join(storeRoot, "work")).length, 0);
    });

    it("rejects transformer output containing the secret and removes operation staging", async () => {
        const base = temp(); roots.push(base);
        const parent = await createParent(base);
        const storeRoot = join(base, "derived-store");
        await rejects(() => deriveSqliteArtifact({
            source: { storeRoot: parent.storeRoot, artifactIdentity: parent.identity },
            derivedStoreRoot: storeRoot,
            transformer: transformer(async ({ output, secret }) => {
                const bytes = sqliteBytes();
                Buffer.from(secret).copy(bytes, 200);
                secret.fill(0);
                await output.write(bytes);
                return declaration(bytes);
            }),
            secretProvider: secretProvider(),
        }), /sensitive material/);
        equal(readdirSync(join(storeRoot, "artifacts")).length, 0);
        equal(readdirSync(join(storeRoot, "work")).length, 0);
    });

    it("fails closed on a corrupt same-identity destination without replacing it", async () => {
        const base = temp(); roots.push(base);
        const parent = await createParent(base);
        const storeRoot = join(base, "derived-store");
        const bytes = sqliteBytes(3);
        const committed = await deriveSqliteArtifact({
            source: { storeRoot: parent.storeRoot, artifactIdentity: parent.identity },
            derivedStoreRoot: storeRoot,
            transformer: writingTransformer(bytes),
            secretProvider: secretProvider(),
        });
        const validated = await validateDerivedSqliteArtifact({ storeRoot, sourceStoreRoot: parent.storeRoot, artifactIdentity: committed.identity });
        chmodSync(validated.commitMarkerPath, 0o600);
        writeFileSync(validated.commitMarkerPath, "corrupt-destination", "utf8");
        chmodSync(validated.commitMarkerPath, 0o444);
        const corruptBytes = readFileSync(validated.commitMarkerPath);

        await rejects(() => deriveSqliteArtifact({
            source: { storeRoot: parent.storeRoot, artifactIdentity: parent.identity },
            derivedStoreRoot: storeRoot,
            transformer: writingTransformer(bytes),
            secretProvider: secretProvider(),
        }));
        equal(readFileSync(validated.commitMarkerPath).equals(corruptBytes), true);
        equal(readdirSync(join(storeRoot, "artifacts")).length, 1);
    });

    it("preserves a previous valid derived commit when a later transform fails", async () => {
        const base = temp(); roots.push(base);
        const parent = await createParent(base);
        const storeRoot = join(base, "derived-store");
        const previous = await deriveSqliteArtifact({
            source: { storeRoot: parent.storeRoot, artifactIdentity: parent.identity },
            derivedStoreRoot: storeRoot,
            transformer: writingTransformer(sqliteBytes(1)),
            secretProvider: secretProvider(),
        });
        await rejects(() => deriveSqliteArtifact({
            source: { storeRoot: parent.storeRoot, artifactIdentity: parent.identity },
            derivedStoreRoot: storeRoot,
            transformer: writingTransformer(Buffer.alloc(512)),
            secretProvider: secretProvider(),
        }), /not plain SQLite|invalid plain SQLite/);
        const revalidated = await validateDerivedSqliteArtifact({ storeRoot, sourceStoreRoot: parent.storeRoot, artifactIdentity: previous.identity });
        equal(revalidated.identity, previous.identity);
        deepEqual(readdirSync(join(storeRoot, "artifacts")), [previous.identity]);
    });

    it("requires the material AQ parent at derived validation time", async () => {
        const base = temp(); roots.push(base);
        const parent = await createParent(base);
        const storeRoot = join(base, "derived-store");
        const committed = await deriveSqliteArtifact({
            source: { storeRoot: parent.storeRoot, artifactIdentity: parent.identity },
            derivedStoreRoot: storeRoot,
            transformer: writingTransformer(sqliteBytes()),
            secretProvider: secretProvider(),
        });
        await validateDerivedSqliteArtifact({ storeRoot, sourceStoreRoot: parent.storeRoot, artifactIdentity: committed.identity });
        await rejects(() => validateDerivedSqliteArtifact({ storeRoot, sourceStoreRoot: join(base, "missing-aq-store"), artifactIdentity: committed.identity }));

        const aqDatabase = join(parent.storeRoot, "artifacts", parent.identity, "database.db");
        chmodSync(aqDatabase, 0o600);
        writeFileSync(aqDatabase, "corrupt-parent", "utf8");
        chmodSync(aqDatabase, 0o444);
        await rejects(() => validateDerivedSqliteArtifact({ storeRoot, sourceStoreRoot: parent.storeRoot, artifactIdentity: committed.identity }));
    });

    it("keeps a fully validated material commit when clock evidence fails after marker", async () => {
        const base = temp(); roots.push(base);
        const parent = await createParent(base);
        const storeRoot = join(base, "derived-store");
        await rejects(() => deriveSqliteArtifact({
            source: { storeRoot: parent.storeRoot, artifactIdentity: parent.identity },
            derivedStoreRoot: storeRoot,
            transformer: writingTransformer(sqliteBytes(9)),
            secretProvider: secretProvider(),
            now: () => { throw new Error("clock unavailable"); },
        }), /timestamp provider failed/);

        const identities = readdirSync(join(storeRoot, "artifacts")).filter(name => /^[a-f0-9]{64}$/.test(name));
        deepEqual(identities.length, 1);
        await validateDerivedSqliteArtifact({ storeRoot, sourceStoreRoot: parent.storeRoot, artifactIdentity: identities[0] });
        deepEqual(readdirSync(join(storeRoot, "receipts")), []);
        deepEqual(readdirSync(join(storeRoot, "quarantine")), []);
    });

    it("stops before secret access or transformation when parent AQ validation fails", async () => {
        const base = temp(); roots.push(base);
        const parent = await createParent(base);
        const aqMetadata = join(parent.storeRoot, "artifacts", parent.identity, "metadata.json");
        chmodSync(aqMetadata, 0o600);
        writeFileSync(aqMetadata, "{broken", "utf8");
        chmodSync(aqMetadata, 0o444);
        const providerCalls = { calls: 0 };
        let transformCalls = 0;
        await rejects(() => deriveSqliteArtifact({
            source: { storeRoot: parent.storeRoot, artifactIdentity: parent.identity },
            derivedStoreRoot: join(base, "derived-store"),
            transformer: transformer(async ({ output }) => { transformCalls += 1; const bytes = sqliteBytes(); await output.write(bytes); return declaration(bytes); }),
            secretProvider: secretProvider(providerCalls),
        }));
        equal(providerCalls.calls, 0);
        equal(transformCalls, 0);
        equal(existsSync(join(base, "derived-store")), false);
    });
});
