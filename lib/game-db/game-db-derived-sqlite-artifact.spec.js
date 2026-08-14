"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = require("assert");
const crypto_1 = require("crypto");
const fs_1 = require("fs");
const os_1 = require("os");
const path_1 = require("path");
const stream_1 = require("stream");
const game_db_derived_sqlite_artifact_contract_1 = require("./game-db-derived-sqlite-artifact-contract");
const game_db_derived_sqlite_artifact_runner_1 = require("./game-db-derived-sqlite-artifact-runner");
const game_db_derived_sqlite_artifact_validator_1 = require("./game-db-derived-sqlite-artifact-validator");
const game_db_download_database_artifact_1 = require("./game-db-download-database-artifact");
const version = Math.floor(Date.UTC(2026, 7, 12, 8, 16, 57) / 1000);
const implementationSha256 = (0, crypto_1.createHash)("sha256").update("injected-test-transformer-v1").digest("hex");
const secretSentinel = "DQ-SECRET-SENTINEL-2d78803f";
function temp(prefix = "dokkan-dq-") { return (0, fs_1.mkdtempSync)((0, path_1.join)((0, os_1.tmpdir)(), prefix)); }
function descriptor() {
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
function fakeTransport(bytes) {
    return { async get() { return { statusCode: 200, headers: { "content-length": String(bytes.length) }, body: stream_1.Readable.from([bytes]) }; } };
}
async function createParent(base) {
    const storeRoot = (0, path_1.join)(base, "aq-store");
    const acquired = await (0, game_db_download_database_artifact_1.acquireDatabaseArtifact)({
        descriptor: descriptor(),
        storeRoot,
        transport: fakeTransport(Buffer.from("synthetic-encrypted-aq-source-v1")),
        now: () => new Date("2026-08-13T12:00:00.000Z"),
    });
    (0, assert_1.equal)(acquired.metadata.artifactState, "encrypted_or_packaged");
    return { storeRoot, identity: acquired.identity };
}
function sqliteBytes(seed = 0) {
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
    bytes.writeUInt32BE(3045000, 96);
    bytes[100] = 13;
    bytes.writeUInt16BE(512, 105);
    bytes[511] = seed;
    return bytes;
}
function declaration(bytes, overrides = {}) {
    return {
        declaredSizeBytes: bytes.length,
        declaredSha256: (0, crypto_1.createHash)("sha256").update(bytes).digest("hex"),
        ...overrides,
    };
}
function transformer(run, parameters = { cipherCompatibility: 4 }) {
    return {
        kind: "sqlcipher_decrypt",
        implementation: { identity: "injected-test-transformer", version: "1.0.0-test", sha256: implementationSha256 },
        nonSecretParameters: parameters,
        transform: run,
    };
}
function secretProvider(counter) {
    return {
        async provideSecret() {
            if (counter)
                counter.calls += 1;
            return Buffer.from(secretSentinel, "utf8");
        },
    };
}
function writingTransformer(bytes, overrides = {}) {
    return transformer(async ({ output, secret }) => {
        (0, assert_1.equal)(Buffer.from(secret).toString("utf8"), secretSentinel);
        await output.write(bytes);
        return declaration(bytes, overrides);
    });
}
function treeBytes(root) {
    if (!(0, fs_1.existsSync)(root))
        return [];
    const result = [];
    const visit = (directory, prefix) => {
        for (const entry of (0, fs_1.readdirSync)(directory, { withFileTypes: true })) {
            const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;
            const path = (0, path_1.join)(directory, entry.name);
            if (entry.isDirectory())
                visit(path, relativePath);
            else
                result.push({ relativePath, bytes: (0, fs_1.readFileSync)(path) });
        }
    };
    visit(root, "");
    return result;
}
describe("derived decrypted SQLite artifact DQ0-DQ4", function () {
    this.timeout(15000);
    const roots = [];
    afterEach(() => {
        while (roots.length)
            (0, fs_1.rmSync)(roots.pop(), { recursive: true, force: true });
    });
    it("creates deterministic marker-last metadata and keeps operational time in a receipt", async () => {
        const base = temp();
        roots.push(base);
        const parent = await createParent(base);
        const storeRoot = (0, path_1.join)(base, "derived-store");
        const output = sqliteBytes(7);
        const first = await (0, game_db_derived_sqlite_artifact_runner_1.deriveSqliteArtifact)({
            source: { storeRoot: parent.storeRoot, useLatest: true },
            derivedStoreRoot: storeRoot,
            transformer: writingTransformer(output),
            secretProvider: secretProvider(),
            now: () => new Date("2026-08-13T13:00:00.000Z"),
        });
        const second = await (0, game_db_derived_sqlite_artifact_runner_1.deriveSqliteArtifact)({
            source: { storeRoot: parent.storeRoot, artifactIdentity: parent.identity },
            derivedStoreRoot: storeRoot,
            transformer: writingTransformer(output),
            secretProvider: secretProvider(),
            now: () => new Date("2026-08-13T14:00:00.000Z"),
        });
        (0, assert_1.equal)(first.reused, false);
        (0, assert_1.equal)(second.reused, true);
        (0, assert_1.equal)(first.identity, second.identity);
        (0, assert_1.equal)(first.metadata.parent.artifactIdentity, parent.identity);
        (0, assert_1.equal)(first.metadata.parent.sourceState, "encrypted_or_packaged");
        (0, assert_1.equal)(first.metadata.transform.implementation.sha256, implementationSha256);
        (0, assert_1.deepEqual)(first.metadata.transform.nonSecretParameters, { cipherCompatibility: 4 });
        (0, assert_1.equal)(first.metadata.output.sizeBytes, output.length);
        (0, assert_1.equal)(first.metadata.output.state, "readable_sqlite");
        const validated = await (0, game_db_derived_sqlite_artifact_validator_1.validateDerivedSqliteArtifact)({ storeRoot, sourceStoreRoot: parent.storeRoot, artifactIdentity: first.identity });
        const metadataText = (0, fs_1.readFileSync)(validated.metadataPath, "utf8");
        (0, assert_1.equal)(/At|timestamp|result|reused|created/.test(metadataText), false);
        (0, assert_1.equal)(second.receipt.completedAt, "2026-08-13T14:00:00.000Z");
        (0, assert_1.equal)(second.receipt.result, "reused");
        (0, assert_1.match)(second.receiptFileName, /^[a-f0-9]{64}\.json$/);
        const receiptText = (0, fs_1.readFileSync)((0, path_1.join)(storeRoot, "receipts", second.receiptFileName), "utf8");
        (0, assert_1.equal)(/key|url|headers|query|descriptor|absolute|account|stdout|stderr/i.test(receiptText), false);
        (0, assert_1.deepEqual)((0, fs_1.readdirSync)(validated.artifactDirectory).sort(), ["commit-marker.json", "database.sqlite", "metadata.json"]);
        (0, assert_1.equal)(((0, fs_1.statSync)(validated.artifactPath).mode & 0o222), 0);
    });
    it("rejects malformed runtime objects, unsafe parameters and malformed committed JSON", async () => {
        await (0, assert_1.rejects)(() => (0, game_db_derived_sqlite_artifact_runner_1.deriveSqliteArtifact)({}), /options are invalid/);
        await (0, assert_1.rejects)(() => (0, game_db_derived_sqlite_artifact_validator_1.validateDerivedSqliteArtifact)({ storeRoot: temp(), sourceStoreRoot: temp(), artifactIdentity: "../escape" }), /identity is invalid/);
        const base = temp();
        roots.push(base);
        const parent = await createParent(base);
        const providerCalls = { calls: 0 };
        for (const timeoutMs of [0, -1, 1.5, game_db_derived_sqlite_artifact_runner_1.MAX_DERIVED_TRANSFORM_TIMEOUT_MS + 1, "25"]) {
            await (0, assert_1.rejects)(() => (0, game_db_derived_sqlite_artifact_runner_1.deriveSqliteArtifact)({
                source: { storeRoot: parent.storeRoot, artifactIdentity: parent.identity },
                derivedStoreRoot: (0, path_1.join)(base, `invalid-timeout-${String(timeoutMs)}`),
                transformer: writingTransformer(sqliteBytes()),
                secretProvider: secretProvider(providerCalls),
                timeoutMs,
            }), /timeout is invalid/);
        }
        await (0, assert_1.rejects)(() => (0, game_db_derived_sqlite_artifact_runner_1.deriveSqliteArtifact)({
            source: { storeRoot: parent.storeRoot, artifactIdentity: parent.identity },
            derivedStoreRoot: (0, path_1.join)(base, "invalid-signal"),
            transformer: writingTransformer(sqliteBytes()),
            secretProvider: secretProvider(providerCalls),
            signal: {},
        }), /AbortSignal is invalid/);
        await (0, assert_1.rejects)(() => (0, game_db_derived_sqlite_artifact_runner_1.deriveSqliteArtifact)({
            source: { storeRoot: parent.storeRoot, artifactIdentity: parent.identity },
            derivedStoreRoot: (0, path_1.join)(base, "unsafe-parameters"),
            transformer: transformer(async () => declaration(sqliteBytes()), { keyPath: "../secret" }),
            secretProvider: secretProvider(providerCalls),
        }), /prohibited field/);
        (0, assert_1.equal)(providerCalls.calls, 0);
        const storeRoot = (0, path_1.join)(base, "derived-store");
        const committed = await (0, game_db_derived_sqlite_artifact_runner_1.deriveSqliteArtifact)({
            source: { storeRoot: parent.storeRoot, artifactIdentity: parent.identity },
            derivedStoreRoot: storeRoot,
            transformer: writingTransformer(sqliteBytes()),
            secretProvider: secretProvider(),
        });
        const validated = await (0, game_db_derived_sqlite_artifact_validator_1.validateDerivedSqliteArtifact)({ storeRoot, sourceStoreRoot: parent.storeRoot, artifactIdentity: committed.identity });
        (0, fs_1.chmodSync)(validated.metadataPath, 0o600);
        (0, fs_1.writeFileSync)(validated.metadataPath, "{malformed", "utf8");
        (0, fs_1.chmodSync)(validated.metadataPath, 0o444);
        await (0, assert_1.rejects)(() => (0, game_db_derived_sqlite_artifact_validator_1.validateDerivedSqliteArtifact)({ storeRoot, sourceStoreRoot: parent.storeRoot, artifactIdentity: committed.identity }), /metadata JSON is malformed/);
    });
    it("does not leak a secret sentinel through artifacts, receipts, results, filenames or errors", async () => {
        const base = temp();
        roots.push(base);
        const parent = await createParent(base);
        const storeRoot = (0, path_1.join)(base, secretSentinel, "derived-store");
        const result = await (0, game_db_derived_sqlite_artifact_runner_1.deriveSqliteArtifact)({
            source: { storeRoot: parent.storeRoot, artifactIdentity: parent.identity },
            derivedStoreRoot: storeRoot,
            transformer: writingTransformer(sqliteBytes()),
            secretProvider: secretProvider(),
        });
        (0, assert_1.equal)(JSON.stringify(result).includes(secretSentinel), false);
        for (const item of treeBytes(storeRoot)) {
            (0, assert_1.equal)(item.relativePath.includes(secretSentinel), false);
            (0, assert_1.equal)(item.bytes.includes(Buffer.from(secretSentinel)), false, item.relativePath);
        }
        let failure;
        try {
            await (0, game_db_derived_sqlite_artifact_runner_1.deriveSqliteArtifact)({
                source: { storeRoot: parent.storeRoot, artifactIdentity: parent.identity },
                derivedStoreRoot: (0, path_1.join)(base, "failing-store"),
                transformer: transformer(async () => { throw new Error(secretSentinel); }),
                secretProvider: secretProvider(),
            });
        }
        catch (error) {
            failure = error;
        }
        (0, assert_1.match)(String(failure), /Derived transformer failed/);
        (0, assert_1.equal)(String(failure).includes(secretSentinel), false);
        for (const item of treeBytes((0, path_1.join)(base, "failing-store"))) {
            (0, assert_1.equal)(item.relativePath.includes(secretSentinel), false);
            (0, assert_1.equal)(item.bytes.includes(Buffer.from(secretSentinel)), false, item.relativePath);
        }
    });
    it("rejects empty, oversized, non-SQLite and falsely declared output", async () => {
        const base = temp();
        roots.push(base);
        const parent = await createParent(base);
        const valid = sqliteBytes();
        const cases = [
            { name: "empty", value: transformer(async () => ({ declaredSizeBytes: 1, declaredSha256: "0".repeat(64) })) },
            { name: "non-sqlite", value: writingTransformer(Buffer.alloc(512)) },
            { name: "wrong-size", value: writingTransformer(valid, { declaredSizeBytes: valid.length + 1 }) },
            { name: "wrong-hash", value: writingTransformer(valid, { declaredSha256: "0".repeat(64) }) },
        ];
        for (const item of cases) {
            const storeRoot = (0, path_1.join)(base, `derived-${item.name}`);
            await (0, assert_1.rejects)(() => (0, game_db_derived_sqlite_artifact_runner_1.deriveSqliteArtifact)({
                source: { storeRoot: parent.storeRoot, artifactIdentity: parent.identity },
                derivedStoreRoot: storeRoot,
                transformer: item.value,
                secretProvider: secretProvider(),
            }));
            const artifacts = (0, path_1.join)(storeRoot, "artifacts");
            (0, assert_1.equal)((0, fs_1.existsSync)(artifacts) ? (0, fs_1.readdirSync)(artifacts).length : 0, 0, item.name);
        }
    });
    it("bounds a hanging transformer, propagates cancellation and revokes late writes", async () => {
        const base = temp();
        roots.push(base);
        const parent = await createParent(base);
        let timeoutSignal;
        let lateWrite;
        const startedAt = Date.now();
        await (0, assert_1.rejects)(() => (0, game_db_derived_sqlite_artifact_runner_1.deriveSqliteArtifact)({
            source: { storeRoot: parent.storeRoot, artifactIdentity: parent.identity },
            derivedStoreRoot: (0, path_1.join)(base, "timeout-store"),
            transformer: transformer(async ({ output, signal }) => {
                timeoutSignal = signal;
                lateWrite = () => output.write(sqliteBytes());
                return new Promise(() => undefined);
            }),
            secretProvider: secretProvider(),
            timeoutMs: 25,
        }), /Derived transformer timed out/);
        (0, assert_1.equal)(Date.now() - startedAt < 1000, true);
        (0, assert_1.equal)(timeoutSignal?.aborted, true);
        await (0, assert_1.rejects)(() => lateWrite(), /output sink is closed/);
        (0, assert_1.equal)((0, fs_1.readdirSync)((0, path_1.join)(base, "timeout-store", "work")).length, 0);
        const controller = new AbortController();
        let cancellationSignal;
        await (0, assert_1.rejects)(() => (0, game_db_derived_sqlite_artifact_runner_1.deriveSqliteArtifact)({
            source: { storeRoot: parent.storeRoot, artifactIdentity: parent.identity },
            derivedStoreRoot: (0, path_1.join)(base, "cancel-store"),
            transformer: transformer(async ({ signal }) => {
                cancellationSignal = signal;
                setTimeout(() => controller.abort(), 20);
                return new Promise(() => undefined);
            }),
            secretProvider: secretProvider(),
            timeoutMs: 1000,
            signal: controller.signal,
        }), /Derived transformation was cancelled/);
        (0, assert_1.equal)(cancellationSignal?.aborted, true);
        (0, assert_1.equal)((0, fs_1.readdirSync)((0, path_1.join)(base, "cancel-store", "work")).length, 0);
    });
    it("rejects a controlled-sink write before it can exceed the 112 MiB quota", async () => {
        const base = temp();
        roots.push(base);
        const parent = await createParent(base);
        const storeRoot = (0, path_1.join)(base, "quota-store");
        await (0, assert_1.rejects)(() => (0, game_db_derived_sqlite_artifact_runner_1.deriveSqliteArtifact)({
            source: { storeRoot: parent.storeRoot, artifactIdentity: parent.identity },
            derivedStoreRoot: storeRoot,
            transformer: transformer(async ({ output }) => {
                await output.write(Buffer.allocUnsafe(game_db_derived_sqlite_artifact_contract_1.DERIVED_SQLITE_MAX_BYTES + 1));
                return declaration(sqliteBytes());
            }),
            secretProvider: secretProvider(),
        }), /output exceeds the byte limit/);
        (0, assert_1.equal)((0, fs_1.readdirSync)((0, path_1.join)(storeRoot, "artifacts")).length, 0);
        (0, assert_1.equal)((0, fs_1.readdirSync)((0, path_1.join)(storeRoot, "work")).length, 0);
    });
    it("rejects transformer output containing the secret and removes operation staging", async () => {
        const base = temp();
        roots.push(base);
        const parent = await createParent(base);
        const storeRoot = (0, path_1.join)(base, "derived-store");
        await (0, assert_1.rejects)(() => (0, game_db_derived_sqlite_artifact_runner_1.deriveSqliteArtifact)({
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
        (0, assert_1.equal)((0, fs_1.readdirSync)((0, path_1.join)(storeRoot, "artifacts")).length, 0);
        (0, assert_1.equal)((0, fs_1.readdirSync)((0, path_1.join)(storeRoot, "work")).length, 0);
    });
    it("fails closed on a corrupt same-identity destination without replacing it", async () => {
        const base = temp();
        roots.push(base);
        const parent = await createParent(base);
        const storeRoot = (0, path_1.join)(base, "derived-store");
        const bytes = sqliteBytes(3);
        const committed = await (0, game_db_derived_sqlite_artifact_runner_1.deriveSqliteArtifact)({
            source: { storeRoot: parent.storeRoot, artifactIdentity: parent.identity },
            derivedStoreRoot: storeRoot,
            transformer: writingTransformer(bytes),
            secretProvider: secretProvider(),
        });
        const validated = await (0, game_db_derived_sqlite_artifact_validator_1.validateDerivedSqliteArtifact)({ storeRoot, sourceStoreRoot: parent.storeRoot, artifactIdentity: committed.identity });
        (0, fs_1.chmodSync)(validated.commitMarkerPath, 0o600);
        (0, fs_1.writeFileSync)(validated.commitMarkerPath, "corrupt-destination", "utf8");
        (0, fs_1.chmodSync)(validated.commitMarkerPath, 0o444);
        const corruptBytes = (0, fs_1.readFileSync)(validated.commitMarkerPath);
        await (0, assert_1.rejects)(() => (0, game_db_derived_sqlite_artifact_runner_1.deriveSqliteArtifact)({
            source: { storeRoot: parent.storeRoot, artifactIdentity: parent.identity },
            derivedStoreRoot: storeRoot,
            transformer: writingTransformer(bytes),
            secretProvider: secretProvider(),
        }));
        (0, assert_1.equal)((0, fs_1.readFileSync)(validated.commitMarkerPath).equals(corruptBytes), true);
        (0, assert_1.equal)((0, fs_1.readdirSync)((0, path_1.join)(storeRoot, "artifacts")).length, 1);
    });
    it("preserves a previous valid derived commit when a later transform fails", async () => {
        const base = temp();
        roots.push(base);
        const parent = await createParent(base);
        const storeRoot = (0, path_1.join)(base, "derived-store");
        const previous = await (0, game_db_derived_sqlite_artifact_runner_1.deriveSqliteArtifact)({
            source: { storeRoot: parent.storeRoot, artifactIdentity: parent.identity },
            derivedStoreRoot: storeRoot,
            transformer: writingTransformer(sqliteBytes(1)),
            secretProvider: secretProvider(),
        });
        await (0, assert_1.rejects)(() => (0, game_db_derived_sqlite_artifact_runner_1.deriveSqliteArtifact)({
            source: { storeRoot: parent.storeRoot, artifactIdentity: parent.identity },
            derivedStoreRoot: storeRoot,
            transformer: writingTransformer(Buffer.alloc(512)),
            secretProvider: secretProvider(),
        }), /not plain SQLite|invalid plain SQLite/);
        const revalidated = await (0, game_db_derived_sqlite_artifact_validator_1.validateDerivedSqliteArtifact)({ storeRoot, sourceStoreRoot: parent.storeRoot, artifactIdentity: previous.identity });
        (0, assert_1.equal)(revalidated.identity, previous.identity);
        (0, assert_1.deepEqual)((0, fs_1.readdirSync)((0, path_1.join)(storeRoot, "artifacts")), [previous.identity]);
    });
    it("requires the material AQ parent at derived validation time", async () => {
        const base = temp();
        roots.push(base);
        const parent = await createParent(base);
        const storeRoot = (0, path_1.join)(base, "derived-store");
        const committed = await (0, game_db_derived_sqlite_artifact_runner_1.deriveSqliteArtifact)({
            source: { storeRoot: parent.storeRoot, artifactIdentity: parent.identity },
            derivedStoreRoot: storeRoot,
            transformer: writingTransformer(sqliteBytes()),
            secretProvider: secretProvider(),
        });
        await (0, game_db_derived_sqlite_artifact_validator_1.validateDerivedSqliteArtifact)({ storeRoot, sourceStoreRoot: parent.storeRoot, artifactIdentity: committed.identity });
        await (0, assert_1.rejects)(() => (0, game_db_derived_sqlite_artifact_validator_1.validateDerivedSqliteArtifact)({ storeRoot, sourceStoreRoot: (0, path_1.join)(base, "missing-aq-store"), artifactIdentity: committed.identity }));
        const aqDatabase = (0, path_1.join)(parent.storeRoot, "artifacts", parent.identity, "database.db");
        (0, fs_1.chmodSync)(aqDatabase, 0o600);
        (0, fs_1.writeFileSync)(aqDatabase, "corrupt-parent", "utf8");
        (0, fs_1.chmodSync)(aqDatabase, 0o444);
        await (0, assert_1.rejects)(() => (0, game_db_derived_sqlite_artifact_validator_1.validateDerivedSqliteArtifact)({ storeRoot, sourceStoreRoot: parent.storeRoot, artifactIdentity: committed.identity }));
    });
    it("keeps a fully validated material commit when clock evidence fails after marker", async () => {
        const base = temp();
        roots.push(base);
        const parent = await createParent(base);
        const storeRoot = (0, path_1.join)(base, "derived-store");
        await (0, assert_1.rejects)(() => (0, game_db_derived_sqlite_artifact_runner_1.deriveSqliteArtifact)({
            source: { storeRoot: parent.storeRoot, artifactIdentity: parent.identity },
            derivedStoreRoot: storeRoot,
            transformer: writingTransformer(sqliteBytes(9)),
            secretProvider: secretProvider(),
            now: () => { throw new Error("clock unavailable"); },
        }), /timestamp provider failed/);
        const identities = (0, fs_1.readdirSync)((0, path_1.join)(storeRoot, "artifacts")).filter(name => /^[a-f0-9]{64}$/.test(name));
        (0, assert_1.deepEqual)(identities.length, 1);
        await (0, game_db_derived_sqlite_artifact_validator_1.validateDerivedSqliteArtifact)({ storeRoot, sourceStoreRoot: parent.storeRoot, artifactIdentity: identities[0] });
        (0, assert_1.deepEqual)((0, fs_1.readdirSync)((0, path_1.join)(storeRoot, "receipts")), []);
        (0, assert_1.deepEqual)((0, fs_1.readdirSync)((0, path_1.join)(storeRoot, "quarantine")), []);
    });
    it("stops before secret access or transformation when parent AQ validation fails", async () => {
        const base = temp();
        roots.push(base);
        const parent = await createParent(base);
        const aqMetadata = (0, path_1.join)(parent.storeRoot, "artifacts", parent.identity, "metadata.json");
        (0, fs_1.chmodSync)(aqMetadata, 0o600);
        (0, fs_1.writeFileSync)(aqMetadata, "{broken", "utf8");
        (0, fs_1.chmodSync)(aqMetadata, 0o444);
        const providerCalls = { calls: 0 };
        let transformCalls = 0;
        await (0, assert_1.rejects)(() => (0, game_db_derived_sqlite_artifact_runner_1.deriveSqliteArtifact)({
            source: { storeRoot: parent.storeRoot, artifactIdentity: parent.identity },
            derivedStoreRoot: (0, path_1.join)(base, "derived-store"),
            transformer: transformer(async ({ output }) => { transformCalls += 1; const bytes = sqliteBytes(); await output.write(bytes); return declaration(bytes); }),
            secretProvider: secretProvider(providerCalls),
        }));
        (0, assert_1.equal)(providerCalls.calls, 0);
        (0, assert_1.equal)(transformCalls, 0);
        (0, assert_1.equal)((0, fs_1.existsSync)((0, path_1.join)(base, "derived-store")), false);
    });
});
//# sourceMappingURL=game-db-derived-sqlite-artifact.spec.js.map