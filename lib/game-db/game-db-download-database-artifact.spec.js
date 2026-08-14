"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = require("assert");
const crypto_1 = require("crypto");
const fs_1 = require("fs");
const promises_1 = require("fs/promises");
const os_1 = require("os");
const path_1 = require("path");
const stream_1 = require("stream");
const game_db_download_database_artifact_1 = require("./game-db-download-database-artifact");
const version = Math.floor(Date.UTC(2026, 7, 12, 8, 16, 57) / 1000);
function descriptor(overrides = {}) {
    return {
        url: "https://cf.ishin-global.aktsk.com/sqlite/current/en/20260812-081657/database.db",
        file_path: "sqlite/current/en/database.db",
        algorithm: "version",
        hash: String(version),
        version,
        patch: null,
        patch_hash: null,
        ...overrides,
    };
}
function fakeTransport(bytes, overrides = {}, calls) {
    return { async get() { if (calls)
            calls.count += 1; return { statusCode: overrides.statusCode ?? 200, headers: overrides.headers ?? { "content-length": overrides.contentLength ?? String(bytes.length) }, body: overrides.body ?? stream_1.Readable.from([bytes]) }; } };
}
function temp() { return (0, fs_1.mkdtempSync)((0, path_1.join)((0, os_1.tmpdir)(), "dokkan-aq-")); }
function journalFiles(root) { const directory = (0, path_1.join)(root, "pointers"); return (0, fs_1.existsSync)(directory) ? (0, fs_1.readdirSync)(directory).filter(name => /^[a-f0-9]{64}\.json$/.test(name)).sort() : []; }
function journalState(root) { return JSON.stringify(journalFiles(root).map(name => [name, (0, fs_1.readFileSync)((0, path_1.join)(root, "pointers", name), "utf8")])); }
function canonicalJson(value) { return `${JSON.stringify(value, null, 2)}\n`; }
function writePointerRecord(root, record) { const text = canonicalJson(record), name = `${(0, crypto_1.createHash)("sha256").update(text).digest("hex")}.json`, path = (0, path_1.join)(root, "pointers", name); (0, fs_1.writeFileSync)(path, text, { flag: "wx", mode: 0o600 }); (0, fs_1.chmodSync)(path, 0o444); return path; }
function boundarySignal(predicate) {
    const controller = new AbortController();
    return new Proxy(controller.signal, {
        get(target, property) {
            if (property === "aborted" && !target.aborted && predicate())
                controller.abort();
            const value = Reflect.get(target, property, target);
            return typeof value === "function" ? value.bind(target) : value;
        },
    });
}
function mutationSignal(mutateAt, mutation) {
    const controller = new AbortController();
    let reads = 0;
    return {
        signal: new Proxy(controller.signal, {
            get(target, property) {
                if (property === "aborted") {
                    reads += 1;
                    if (reads === mutateAt)
                        mutation();
                    return false;
                }
                const value = Reflect.get(target, property, target);
                return typeof value === "function" ? value.bind(target) : value;
            },
        }),
        count: () => reads,
    };
}
describe("game DB manual database artifact acquisition", function () {
    this.timeout(10000);
    it("accepts the strict synthetic Global EN descriptor and freezes it", () => {
        const source = descriptor();
        const value = (0, game_db_download_database_artifact_1.validateClientAssetsDatabaseDescriptor)(source);
        (0, assert_1.equal)(value.databaseVersion, version);
        (0, assert_1.equal)(value.deliveryTimestamp, "20260812-081657");
        (0, assert_1.equal)(Object.isFrozen(value), true);
        source.url = "https://evil.invalid/database.db";
        (0, assert_1.equal)(value.url.includes("evil"), false);
    });
    it("rejects malformed JSON and non-object JSON", async () => {
        const root = temp();
        try {
            (0, fs_1.writeFileSync)((0, path_1.join)(root, "bad.json"), "{");
            await (0, assert_1.rejects)((0, game_db_download_database_artifact_1.readAndValidateDatabaseDescriptor)((0, path_1.join)(root, "bad.json")), /malformed/);
            (0, fs_1.writeFileSync)((0, path_1.join)(root, "array.json"), "[]");
            await (0, assert_1.rejects)((0, game_db_download_database_artifact_1.readAndValidateDatabaseDescriptor)((0, path_1.join)(root, "array.json")), /object/);
        }
        finally {
            (0, fs_1.rmSync)(root, { recursive: true, force: true });
        }
    });
    it("rejects missing, extra and incorrectly typed fields", () => {
        const missing = descriptor();
        delete missing.patch_hash;
        (0, assert_1.throws)(() => (0, game_db_download_database_artifact_1.validateClientAssetsDatabaseDescriptor)(missing), /fields/);
        (0, assert_1.throws)(() => (0, game_db_download_database_artifact_1.validateClientAssetsDatabaseDescriptor)(descriptor({ extra: true })), /fields/);
        (0, assert_1.throws)(() => (0, game_db_download_database_artifact_1.validateClientAssetsDatabaseDescriptor)(descriptor({ file_path: 1 })), /file_path/);
        (0, assert_1.throws)(() => (0, game_db_download_database_artifact_1.validateClientAssetsDatabaseDescriptor)(descriptor({ url: 1 })), /URL/);
    });
    it("rejects invalid versions, algorithms, hashes and patches", () => {
        for (const invalid of [0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1])
            (0, assert_1.throws)(() => (0, game_db_download_database_artifact_1.validateClientAssetsDatabaseDescriptor)(descriptor({ version: invalid })), /version/);
        (0, assert_1.throws)(() => (0, game_db_download_database_artifact_1.validateClientAssetsDatabaseDescriptor)(descriptor({ algorithm: "xxhash" })), /algorithm/);
        (0, assert_1.throws)(() => (0, game_db_download_database_artifact_1.validateClientAssetsDatabaseDescriptor)(descriptor({ hash: "0" })), /hash/);
        (0, assert_1.throws)(() => (0, game_db_download_database_artifact_1.validateClientAssetsDatabaseDescriptor)(descriptor({ hash: version })), /hash/);
        (0, assert_1.throws)(() => (0, game_db_download_database_artifact_1.validateClientAssetsDatabaseDescriptor)(descriptor({ patch: {} })), /patch/);
        (0, assert_1.throws)(() => (0, game_db_download_database_artifact_1.validateClientAssetsDatabaseDescriptor)(descriptor({ patch_hash: "x" })), /patch/);
        const year10000 = Math.floor(Date.UTC(10000, 0, 1, 0, 0, 0) / 1000);
        (0, assert_1.throws)(() => (0, game_db_download_database_artifact_1.validateClientAssetsDatabaseDescriptor)(descriptor({
            version: year10000,
            hash: String(year10000),
            url: "https://cf.ishin-global.aktsk.com/sqlite/current/en/100000101-000000/database.db",
        })), /four digits/);
    });
    it("rejects year 10000 before transport", async () => {
        const root = temp(), calls = { count: 0 };
        const year10000 = Math.floor(Date.UTC(10000, 0, 1, 0, 0, 0) / 1000);
        try {
            await (0, assert_1.rejects)((0, game_db_download_database_artifact_1.acquireDatabaseArtifact)({
                descriptor: descriptor({ version: year10000, hash: String(year10000), url: "https://cf.ishin-global.aktsk.com/sqlite/current/en/100000101-000000/database.db" }),
                storeRoot: root,
                transport: fakeTransport(Buffer.from("never"), {}, calls),
            }), /four digits/);
            (0, assert_1.equal)(calls.count, 0);
        }
        finally {
            (0, fs_1.rmSync)(root, { recursive: true, force: true });
        }
    });
    it("rejects HTTP, similar hosts, malicious subdomains and ports", () => {
        const urls = [
            descriptor().url.replace("https:", "http:"),
            descriptor().url.replace("cf.ishin-global.aktsk.com", "cf.ishin-global.aktsk.com.evil.test"),
            descriptor().url.replace("cf.ishin-global.aktsk.com", "evilcf.ishin-global.aktsk.com"),
            descriptor().url.replace(".com/", ".com:444/"),
        ];
        for (const url of urls)
            (0, assert_1.throws)(() => (0, game_db_download_database_artifact_1.validateClientAssetsDatabaseDescriptor)(descriptor({ url })), /HTTPS|host|port/);
    });
    it("rejects URL credentials, fragments, queries and incompatible paths", () => {
        const valid = descriptor().url;
        const urls = [
            valid.replace("https://", "https://user:password@"),
            `${valid}#fragment`,
            `${valid}?unexpected=1`,
            valid.replace("/en/", "/jp/"),
            valid.replace("20260812-081657", "20260812-081658"),
            valid.replace("database.db", "..%2Fdatabase.db"),
        ];
        for (const url of urls)
            (0, assert_1.throws)(() => (0, game_db_download_database_artifact_1.validateClientAssetsDatabaseDescriptor)(descriptor({ url })), /credentials|fragment|query|path/);
    });
    it("rejects logical traversal and Windows path forms", () => {
        for (const file_path of ["../database.db", "sqlite/current/en/../database.db", "C:\\database.db", "C:database.db", "\\\\server\\share\\database.db", "\\\\?\\C:\\database.db", "sqlite/current\\en/database.db"]) {
            (0, assert_1.throws)(() => (0, game_db_download_database_artifact_1.validateClientAssetsDatabaseDescriptor)(descriptor({ file_path })), /file_path/);
        }
    });
    it("parses only descriptor or artifact modes and disables the legacy URL", () => {
        const parsed = (0, game_db_download_database_artifact_1.parseDownloadDatabaseArtifactArgs)(["--descriptor-json", "descriptor.json", "--dry-run"]);
        (0, assert_1.equal)(parsed.descriptorJson, (0, path_1.resolve)("descriptor.json"));
        (0, assert_1.equal)(parsed.dryRun, true);
        const artifact = (0, game_db_download_database_artifact_1.parseDownloadDatabaseArtifactArgs)(["--artifact-path=database.db", "--descriptor-json=descriptor.json"]);
        (0, assert_1.equal)(artifact.artifactPath, (0, path_1.resolve)("database.db"));
        (0, assert_1.equal)(artifact.descriptorJson, (0, path_1.resolve)("descriptor.json"));
        (0, assert_1.throws)(() => (0, game_db_download_database_artifact_1.parseDownloadDatabaseArtifactArgs)([]), /descriptor lineage/);
        (0, assert_1.throws)(() => (0, game_db_download_database_artifact_1.parseDownloadDatabaseArtifactArgs)(["--artifact-path", "a"]), /descriptor lineage/);
        (0, assert_1.throws)(() => (0, game_db_download_database_artifact_1.parseDownloadDatabaseArtifactArgs)(["--database-url", "https://example.test"]), /disabled/);
        (0, assert_1.throws)(() => (0, game_db_download_database_artifact_1.parseDownloadDatabaseArtifactArgs)(["--artifact-path", "a", "--descriptor-json", "b", "--authorize-download"]), /cannot be combined/);
    });
    it("proves import-style validation and dry-run make no transport request", async () => {
        const root = temp();
        const calls = { count: 0 };
        try {
            const path = (0, path_1.join)(root, "descriptor.json");
            (0, fs_1.writeFileSync)(path, JSON.stringify(descriptor()));
            const result = await (0, game_db_download_database_artifact_1.runDownloadDatabaseArtifact)({ descriptorJson: path, storeRoot: (0, path_1.join)(root, "store"), authorizeDownload: false, dryRun: true }, { transport: fakeTransport(Buffer.from("never"), {}, calls) });
            (0, assert_1.equal)(result.mode, "descriptor_validation");
            (0, assert_1.equal)(calls.count, 0);
            (0, assert_1.equal)(JSON.stringify(result).includes("https://"), false);
        }
        finally {
            (0, fs_1.rmSync)(root, { recursive: true, force: true });
        }
    });
    it("revalidates untrusted compiled-JavaScript payloads before any transport call", async () => {
        const root = temp();
        const calls = { count: 0 };
        const transport = fakeTransport(Buffer.from("must-not-run"), {}, calls);
        const compiledApi = game_db_download_database_artifact_1.acquireDatabaseArtifact;
        const malicious = [
            descriptor({ url: descriptor().url.replace("cf.ishin-global.aktsk.com", "arbitrary.invalid") }),
            descriptor({ url: descriptor().url.replace("cf.ishin-global.aktsk.com", "cf.ishin-global.aktsk.com.evil.invalid") }),
            descriptor({ url: descriptor().url.replace("https:", "http:") }),
            descriptor({ url: descriptor().url.replace("/en/", "/jp/") }),
            descriptor({ hash: String(version + 1) }),
            descriptor({ version: version + 1 }),
        ];
        try {
            for (const payload of malicious) {
                await (0, assert_1.rejects)(compiledApi({ descriptor: payload, storeRoot: (0, path_1.join)(root, "store"), transport }), /host|HTTPS|path|hash/);
            }
            (0, assert_1.equal)(calls.count, 0);
        }
        finally {
            (0, fs_1.rmSync)(root, { recursive: true, force: true });
        }
    });
    it("validates an offline artifact only with validated descriptor lineage", async () => {
        const root = temp();
        try {
            const descriptorPath = (0, path_1.join)(root, "descriptor.json"), artifactPath = (0, path_1.join)(root, "database.db");
            (0, fs_1.writeFileSync)(descriptorPath, JSON.stringify(descriptor()));
            (0, fs_1.writeFileSync)(artifactPath, Buffer.from("encrypted-or-packaged"));
            const validatedAt = "2026-08-13T20:00:00.000Z";
            const result = await (0, game_db_download_database_artifact_1.runDownloadDatabaseArtifact)({ descriptorJson: descriptorPath, artifactPath, storeRoot: (0, path_1.join)(root, "store"), authorizeDownload: false, dryRun: false }, { now: () => new Date(validatedAt) });
            (0, assert_1.equal)(result.mode, "artifact_validation");
            if (result.mode !== "artifact_validation")
                throw new Error("unexpected mode");
            (0, assert_1.equal)(result.descriptor.databaseVersion, version);
            (0, assert_1.equal)(result.descriptor.logicalFilePath, "sqlite/current/en/database.db");
            (0, assert_1.equal)(result.inspection.artifactState, "encrypted_or_packaged");
            (0, assert_1.equal)(result.receipt.mode, "offline_existing_artifact_validation");
            (0, assert_1.equal)(result.receipt.result, "validated");
            if (result.receipt.mode !== "offline_existing_artifact_validation")
                throw new Error("unexpected receipt mode");
            (0, assert_1.equal)(result.receipt.validatedAt, validatedAt);
            (0, assert_1.equal)(result.receipt.artifactIdentity, result.identity);
            (0, assert_1.equal)((0, fs_1.readFileSync)(result.receiptPath, "utf8"), `${JSON.stringify(result.receipt, null, 2)}\n`);
            (0, fs_1.writeFileSync)(descriptorPath, JSON.stringify(descriptor({ url: "https://evil.invalid/database.db" })));
            await (0, assert_1.rejects)((0, game_db_download_database_artifact_1.runDownloadDatabaseArtifact)({ descriptorJson: descriptorPath, artifactPath, storeRoot: (0, path_1.join)(root, "store"), authorizeDownload: false, dryRun: false }), /host/);
        }
        finally {
            (0, fs_1.rmSync)(root, { recursive: true, force: true });
        }
    });
    it("classifies readable SQLite and encrypted or packaged bytes offline", async () => {
        const root = temp();
        try {
            const descriptorPath = (0, path_1.join)(root, "descriptor.json"), sqlite = (0, path_1.join)(root, "readable.bin"), encrypted = (0, path_1.join)(root, "encrypted.bin");
            (0, fs_1.writeFileSync)(descriptorPath, JSON.stringify(descriptor()));
            (0, fs_1.writeFileSync)(sqlite, Buffer.concat([Buffer.from("SQLite format 3\0"), Buffer.alloc(8)]));
            (0, fs_1.writeFileSync)(encrypted, Buffer.from("encrypted-or-packaged"));
            const readable = await (0, game_db_download_database_artifact_1.runDownloadDatabaseArtifact)({ descriptorJson: descriptorPath, artifactPath: sqlite, storeRoot: (0, path_1.join)(root, "store"), authorizeDownload: false, dryRun: false });
            const packaged = await (0, game_db_download_database_artifact_1.runDownloadDatabaseArtifact)({ descriptorJson: descriptorPath, artifactPath: encrypted, storeRoot: (0, path_1.join)(root, "store"), authorizeDownload: false, dryRun: false });
            if (readable.mode !== "artifact_validation" || packaged.mode !== "artifact_validation")
                throw new Error("unexpected mode");
            (0, assert_1.equal)(readable.inspection.artifactState, "readable_sqlite");
            (0, assert_1.equal)(packaged.inspection.artifactState, "encrypted_or_packaged");
        }
        finally {
            (0, fs_1.rmSync)(root, { recursive: true, force: true });
        }
    });
    it("blocks redirects and non-success responses", async () => {
        for (const statusCode of [206, 301, 404]) {
            const root = temp();
            try {
                await (0, assert_1.rejects)((0, game_db_download_database_artifact_1.acquireDatabaseArtifact)({ descriptor: descriptor(), storeRoot: root, transport: fakeTransport(Buffer.from("x"), { statusCode }) }), /redirect|successful/);
            }
            finally {
                (0, fs_1.rmSync)(root, { recursive: true, force: true });
            }
        }
    });
    it("accepts only an unencoded complete 200 response with one canonical Content-Length", async () => {
        const rejected = [
            { name: "206 without range", statusCode: 206, headers: { "content-length": "1" }, pattern: /exactly 200/ },
            { name: "206 with range", statusCode: 206, headers: { "content-length": "1", "content-range": "bytes 0-0/1" }, pattern: /exactly 200/ },
            { name: "200 with range", headers: { "content-length": "1", "content-range": "bytes 0-0/1" }, pattern: /Content-Range/ },
            { name: "gzip", headers: { "content-length": "1", "content-encoding": "gzip" }, pattern: /Content-Encoding/ },
            { name: "br", headers: { "content-length": "1", "content-encoding": "br" }, pattern: /Content-Encoding/ },
            { name: "conflicting lengths", headers: { "content-length": "1", "Content-Length": "2" }, pattern: /Content-Length/ },
            { name: "multiple equal lengths", headers: { "content-length": ["1", "1"] }, pattern: /Content-Length/ },
            { name: "missing length", headers: {}, pattern: /Content-Length/ },
            { name: "zero length", headers: { "content-length": "0" }, pattern: /Content-Length/ },
            { name: "signed length", headers: { "content-length": "+1" }, pattern: /Content-Length/ },
            { name: "decimal length", headers: { "content-length": "1.0" }, pattern: /Content-Length/ },
            { name: "comma length", headers: { "content-length": "1, 1" }, pattern: /Content-Length/ },
        ];
        for (const variant of rejected) {
            const root = temp();
            const body = stream_1.Readable.from([Buffer.from("x")]);
            try {
                await (0, assert_1.rejects)((0, game_db_download_database_artifact_1.acquireDatabaseArtifact)({ descriptor: descriptor(), storeRoot: root, transport: fakeTransport(Buffer.from("x"), { statusCode: variant.statusCode, headers: variant.headers, body }) }), variant.pattern, variant.name);
                (0, assert_1.equal)(body.destroyed, true, variant.name);
                (0, assert_1.equal)((0, fs_1.existsSync)((0, path_1.join)(root, "latest.json")), false, variant.name);
                (0, assert_1.equal)((0, fs_1.existsSync)((0, path_1.join)(root, "receipts")), false, variant.name);
            }
            finally {
                (0, fs_1.rmSync)(root, { recursive: true, force: true });
            }
        }
        for (const headers of [{ "content-length": "1" }, { "content-length": "1", "content-encoding": "identity" }]) {
            const root = temp();
            try {
                const result = await (0, game_db_download_database_artifact_1.acquireDatabaseArtifact)({ descriptor: descriptor(), storeRoot: root, transport: fakeTransport(Buffer.from("x"), { headers }) });
                (0, assert_1.equal)(result.metadata.observedSizeBytes, 1);
            }
            finally {
                (0, fs_1.rmSync)(root, { recursive: true, force: true });
            }
        }
    });
    it("rejects excessive Content-Length and streams above the hard limit", async () => {
        const root = temp();
        try {
            const raw = descriptor();
            await (0, assert_1.rejects)((0, game_db_download_database_artifact_1.acquireDatabaseArtifact)({ descriptor: raw, storeRoot: root, transport: fakeTransport(Buffer.from("x"), { contentLength: "11" }), maxBytes: 10 }), /Content-Length/);
            await (0, assert_1.rejects)((0, game_db_download_database_artifact_1.acquireDatabaseArtifact)({ descriptor: raw, storeRoot: root, transport: fakeTransport(Buffer.from("123456"), { contentLength: "5" }), maxBytes: 5 }), /exceeds/);
        }
        finally {
            (0, fs_1.rmSync)(root, { recursive: true, force: true });
        }
    });
    it("rejects truncation and size divergence", async () => {
        const root = temp();
        try {
            await (0, assert_1.rejects)((0, game_db_download_database_artifact_1.acquireDatabaseArtifact)({ descriptor: descriptor(), storeRoot: root, transport: fakeTransport(Buffer.from("123"), { contentLength: "4" }) }), /truncated|size-divergent/);
        }
        finally {
            (0, fs_1.rmSync)(root, { recursive: true, force: true });
        }
    });
    it("times out a transport that never resolves", async () => {
        const root = temp();
        const transport = { get: async () => new Promise(() => undefined) };
        try {
            await (0, assert_1.rejects)((0, game_db_download_database_artifact_1.acquireDatabaseArtifact)({ descriptor: descriptor(), storeRoot: root, transport, timeoutMs: 20 }), /timed out/);
        }
        finally {
            (0, fs_1.rmSync)(root, { recursive: true, force: true });
        }
    });
    it("honors cancellation and removes temporary state", async () => {
        const root = temp();
        const controller = new AbortController();
        controller.abort();
        try {
            await (0, assert_1.rejects)((0, game_db_download_database_artifact_1.acquireDatabaseArtifact)({ descriptor: descriptor(), storeRoot: root, transport: fakeTransport(Buffer.from("x")), signal: controller.signal }), /cancelled/);
            (0, assert_1.equal)((0, fs_1.readdirSync)(root).some(name => name.startsWith(".download-") || name.startsWith(".pending-")), false);
        }
        finally {
            (0, fs_1.rmSync)(root, { recursive: true, force: true });
        }
    });
    it("cancels a stalled response stream", async () => {
        const root = temp();
        const controller = new AbortController();
        const stalled = new stream_1.Readable({ read() { } });
        setTimeout(() => controller.abort(), 10);
        try {
            await (0, assert_1.rejects)((0, game_db_download_database_artifact_1.acquireDatabaseArtifact)({ descriptor: descriptor(), storeRoot: root, transport: fakeTransport(Buffer.alloc(0), { contentLength: "1", body: stalled }), signal: controller.signal }), /cancelled/);
            (0, assert_1.equal)((0, fs_1.readdirSync)(root).some(name => name.startsWith(".download-") || name.startsWith(".pending-")), false);
        }
        finally {
            (0, fs_1.rmSync)(root, { recursive: true, force: true });
        }
    });
    it("fails closed on cancellation immediately after streaming", async () => {
        const root = temp(), firstBytes = Buffer.from("first-valid-bytes"), nextBytes = Buffer.from("second-valid-bytes");
        try {
            const first = await (0, game_db_download_database_artifact_1.acquireDatabaseArtifact)({ descriptor: descriptor(), storeRoot: root, transport: fakeTransport(firstBytes) });
            const pointerBefore = journalState(root);
            const signal = boundarySignal(() => (0, fs_1.readdirSync)(root).some(name => name.startsWith(".download-") && (0, fs_1.readFileSync)((0, path_1.join)(root, name)).byteLength === nextBytes.byteLength));
            await (0, assert_1.rejects)((0, game_db_download_database_artifact_1.acquireDatabaseArtifact)({ descriptor: descriptor(), storeRoot: root, transport: fakeTransport(nextBytes), signal }), /cancelled/);
            (0, assert_1.equal)(journalState(root), pointerBefore);
            (0, assert_1.equal)((0, fs_1.readdirSync)(root).some(name => name.startsWith(".download-") || name.startsWith(".pending-")), false);
        }
        finally {
            (0, fs_1.rmSync)(root, { recursive: true, force: true });
        }
    });
    it("fails closed during post-promotion validation and quarantines the reserved destination", async () => {
        const root = temp(), firstBytes = Buffer.from("first-valid-bytes"), nextBytes = Buffer.from("second-valid-artifact");
        try {
            const first = await (0, game_db_download_database_artifact_1.acquireDatabaseArtifact)({ descriptor: descriptor(), storeRoot: root, transport: fakeTransport(firstBytes) });
            const pointerBefore = journalState(root);
            const signal = boundarySignal(() => {
                const artifacts = (0, path_1.join)(root, "artifacts");
                return (0, fs_1.existsSync)(artifacts) && (0, fs_1.readdirSync)(artifacts).some(name => /^[a-f0-9]{64}$/.test(name) && name !== first.identity && (0, fs_1.existsSync)((0, path_1.join)(artifacts, name, "commit-marker.json")));
            });
            await (0, assert_1.rejects)((0, game_db_download_database_artifact_1.acquireDatabaseArtifact)({ descriptor: descriptor(), storeRoot: root, transport: fakeTransport(nextBytes), signal }), /cancelled/);
            (0, assert_1.equal)(journalState(root), pointerBefore);
            const orphans = (0, fs_1.readdirSync)((0, path_1.join)(root, "artifacts")).filter(name => /^[a-f0-9]{64}$/.test(name) && name !== first.identity);
            (0, assert_1.equal)(orphans.length, 0);
            const quarantines = (0, fs_1.readdirSync)((0, path_1.join)(root, "artifacts")).filter(name => name.startsWith(".quarantine-"));
            (0, assert_1.equal)(quarantines.length, 1);
            (0, assert_1.equal)((0, fs_1.existsSync)((0, path_1.join)(root, "artifacts", quarantines[0], "artifact", "commit-marker.json")), true);
        }
        finally {
            (0, fs_1.rmSync)(root, { recursive: true, force: true });
        }
    });
    it("fails closed after receipt without appending a pointer record", async () => {
        const root = temp(), firstBytes = Buffer.from("first-valid-bytes"), nextBytes = Buffer.from("third-valid-artifact");
        try {
            const first = await (0, game_db_download_database_artifact_1.acquireDatabaseArtifact)({ descriptor: descriptor(), storeRoot: root, transport: fakeTransport(firstBytes), now: () => new Date("2026-08-13T20:00:00.000Z") });
            const pointerBefore = journalState(root);
            const receiptsBefore = (0, fs_1.readdirSync)((0, path_1.join)(root, "receipts")).length;
            const signal = boundarySignal(() => (0, fs_1.existsSync)((0, path_1.join)(root, "receipts")) && (0, fs_1.readdirSync)((0, path_1.join)(root, "receipts")).filter(name => !name.startsWith(".")).length > receiptsBefore);
            await (0, assert_1.rejects)((0, game_db_download_database_artifact_1.acquireDatabaseArtifact)({ descriptor: descriptor(), storeRoot: root, transport: fakeTransport(nextBytes), signal, now: () => new Date("2026-08-13T21:00:00.000Z") }), /cancelled/);
            (0, assert_1.equal)(journalState(root), pointerBefore);
            (0, assert_1.equal)((0, fs_1.readdirSync)((0, path_1.join)(root, "receipts")).filter(name => !name.startsWith(".")).length, receiptsBefore + 1);
        }
        finally {
            (0, fs_1.rmSync)(root, { recursive: true, force: true });
        }
    });
    it("never overwrites a pointer sentinel introduced at the create-only installation boundary", async () => {
        const root = temp(), probeRoot = temp(), firstBytes = Buffer.from("first-valid-bytes"), nextBytes = Buffer.from("fourth-valid-artifact");
        let sentinelPath = "";
        try {
            const first = await (0, game_db_download_database_artifact_1.acquireDatabaseArtifact)({ descriptor: descriptor(), storeRoot: root, transport: fakeTransport(firstBytes) });
            const probe = await (0, game_db_download_database_artifact_1.acquireDatabaseArtifact)({ descriptor: descriptor(), storeRoot: probeRoot, transport: fakeTransport(nextBytes) });
            const record = { schemaVersion: 1, contract: "dokkan-game-db-pointer-record", contractVersion: "1.0.0", identity: probe.identity, predecessorIdentity: first.identity < probe.identity ? first.identity : null, order: { databaseVersion: version, artifactIdentity: probe.identity } };
            const text = canonicalJson(record), name = `${(0, crypto_1.createHash)("sha256").update(text).digest("hex")}.json`;
            const receiptsBefore = (0, fs_1.readdirSync)((0, path_1.join)(root, "receipts")).length;
            const signal = boundarySignal(() => {
                if (!sentinelPath && (0, fs_1.readdirSync)((0, path_1.join)(root, "receipts")).length > receiptsBefore) {
                    sentinelPath = (0, path_1.join)(root, "pointers", name);
                    (0, fs_1.writeFileSync)(sentinelPath, "pointer-install-sentinel", { flag: "wx" });
                }
                return false;
            });
            await (0, assert_1.rejects)((0, game_db_download_database_artifact_1.acquireDatabaseArtifact)({ descriptor: descriptor(), storeRoot: root, transport: fakeTransport(nextBytes), signal }), /exact valid create-only record|exist/i);
            (0, assert_1.equal)((0, fs_1.readFileSync)(sentinelPath, "utf8"), "pointer-install-sentinel");
            (0, assert_1.equal)((await (0, game_db_download_database_artifact_1.validateAcquiredDatabaseArtifact)({ storeRoot: root, useLatest: true })).identity, first.identity);
        }
        finally {
            (0, fs_1.rmSync)(root, { recursive: true, force: true });
            (0, fs_1.rmSync)(probeRoot, { recursive: true, force: true });
        }
    });
    it("never clobbers a receipt destination created at the installation boundary", async () => {
        const root = temp();
        let racedTarget = "";
        const signal = boundarySignal(() => {
            const receipts = (0, path_1.join)(root, "receipts");
            if (racedTarget || !(0, fs_1.existsSync)(receipts))
                return false;
            const temporary = (0, fs_1.readdirSync)(receipts).find(name => name.startsWith(".official_descriptor_download-") && name.endsWith(`.${process.pid}.tmp`));
            if (!temporary)
                return false;
            racedTarget = (0, path_1.join)(receipts, temporary.slice(1, -`.${process.pid}.tmp`.length));
            (0, fs_1.writeFileSync)(racedTarget, "raced-receipt-sentinel");
            return false;
        });
        try {
            await (0, assert_1.rejects)((0, game_db_download_database_artifact_1.acquireDatabaseArtifact)({ descriptor: descriptor(), storeRoot: root, transport: fakeTransport(Buffer.from("receipt-race")), signal }), /EEXIST|exist/i);
            (0, assert_1.equal)((0, fs_1.readFileSync)(racedTarget, "utf8"), "raced-receipt-sentinel");
            (0, assert_1.equal)((0, fs_1.existsSync)((0, path_1.join)(root, "latest.json")), false);
        }
        finally {
            (0, fs_1.rmSync)(root, { recursive: true, force: true });
        }
    });
    it("allows two concurrent promotions to append without overwrite and selects deterministic current and rollback", async () => {
        const root = temp();
        (0, fs_1.mkdirSync)((0, path_1.join)(root, "artifacts"));
        (0, fs_1.mkdirSync)((0, path_1.join)(root, "receipts"));
        (0, fs_1.mkdirSync)((0, path_1.join)(root, "pointers"));
        let arrivals = 0;
        let release;
        const barrier = new Promise(done => { release = done; });
        function transport(bytes) {
            return { async get() { arrivals += 1; if (arrivals === 2)
                    release(); await barrier; return { statusCode: 200, headers: { "content-length": String(bytes.length) }, body: stream_1.Readable.from([bytes]) }; } };
        }
        try {
            const [left, right] = await Promise.all([
                (0, game_db_download_database_artifact_1.acquireDatabaseArtifact)({ descriptor: descriptor(), storeRoot: root, transport: transport(Buffer.from("concurrent-left")) }),
                (0, game_db_download_database_artifact_1.acquireDatabaseArtifact)({ descriptor: descriptor(), storeRoot: root, transport: transport(Buffer.from("concurrent-right")) }),
            ]);
            (0, assert_1.equal)(journalFiles(root).length, 2);
            const ordered = [left.identity, right.identity].sort();
            const selected = await (0, game_db_download_database_artifact_1.validateAcquiredDatabaseArtifact)({ storeRoot: root, useLatest: true });
            (0, assert_1.equal)(selected.identity, ordered[1]);
            (0, assert_1.equal)(selected.previousIdentity, ordered[0]);
            (0, assert_1.equal)((await (0, game_db_download_database_artifact_1.validateAcquiredDatabaseArtifact)({ storeRoot: root, artifactIdentity: ordered[0] })).identity, ordered[0]);
        }
        finally {
            (0, fs_1.rmSync)(root, { recursive: true, force: true });
        }
    });
    it("commits immutable content marker-last and emits portable deterministic metadata", async () => {
        const root = temp();
        const bytes = Buffer.concat([Buffer.from("SQLite format 3\0"), Buffer.alloc(64, 7)]);
        try {
            const first = await (0, game_db_download_database_artifact_1.acquireDatabaseArtifact)({ descriptor: descriptor(), storeRoot: root, transport: fakeTransport(bytes), now: () => new Date("2026-08-13T20:00:00.000Z") });
            const firstMetadata = (0, fs_1.readFileSync)(first.metadataPath, "utf8");
            const firstMarker = (0, fs_1.readFileSync)(first.commitMarkerPath, "utf8");
            const second = await (0, game_db_download_database_artifact_1.acquireDatabaseArtifact)({ descriptor: descriptor(), storeRoot: root, transport: fakeTransport(bytes), now: () => new Date("2026-08-13T21:00:00.000Z") });
            (0, assert_1.equal)(second.reused, true);
            (0, assert_1.equal)(second.identity, first.identity);
            (0, assert_1.equal)((0, fs_1.readFileSync)(second.metadataPath, "utf8"), firstMetadata);
            (0, assert_1.equal)((0, fs_1.readFileSync)(second.commitMarkerPath, "utf8"), firstMarker);
            (0, assert_1.equal)(first.receipt.mode, "official_descriptor_download");
            (0, assert_1.equal)(first.receipt.result, "acquired");
            (0, assert_1.equal)(second.receipt.mode, "official_descriptor_download");
            (0, assert_1.equal)(second.receipt.result, "reused");
            if (first.receipt.mode !== "official_descriptor_download" || second.receipt.mode !== "official_descriptor_download")
                throw new Error("unexpected receipt mode");
            (0, assert_1.equal)(first.receipt.acquiredAt, "2026-08-13T20:00:00.000Z");
            (0, assert_1.equal)(second.receipt.acquiredAt, "2026-08-13T21:00:00.000Z");
            (0, assert_1.equal)(first.receipt.artifactIdentity, second.receipt.artifactIdentity);
            (0, assert_1.equal)(first.receiptPath === second.receiptPath, false);
            const receiptText = `${(0, fs_1.readFileSync)(first.receiptPath, "utf8")}\n${(0, fs_1.readFileSync)(second.receiptPath, "utf8")}`;
            const text = `${firstMetadata}\n${firstMarker}`;
            (0, assert_1.equal)(text.includes(OFFICIAL_SECRET), false);
            (0, assert_1.equal)(text.includes(root), false);
            (0, assert_1.equal)(text.includes("https://"), false);
            (0, assert_1.equal)(text.includes("url"), false);
            (0, assert_1.equal)(/acquiredAt|validatedAt/.test(text), false);
            (0, assert_1.equal)(receiptText.includes(OFFICIAL_SECRET), false);
            (0, assert_1.equal)(receiptText.includes(root), false);
            (0, assert_1.equal)(receiptText.includes("https://"), false);
            (0, assert_1.equal)(/query|headers|token|account|descriptorJson|artifactPath/i.test(receiptText), false);
            (0, assert_1.equal)(first.metadata.artifactState, "readable_sqlite");
        }
        finally {
            (0, fs_1.rmSync)(root, { recursive: true, force: true });
        }
    });
    it("rejects a hard-link alias introduced deterministically before promotion", async () => {
        const root = temp(), alias = (0, path_1.join)(root, "pending-database-alias.db");
        let linked = false;
        try {
            const first = await (0, game_db_download_database_artifact_1.acquireDatabaseArtifact)({ descriptor: descriptor(), storeRoot: root, transport: fakeTransport(Buffer.from("alias-prior")) });
            const pointerBefore = journalState(root);
            const signal = boundarySignal(() => {
                const artifacts = (0, path_1.join)(root, "artifacts");
                const pending = (0, fs_1.existsSync)(artifacts) ? (0, fs_1.readdirSync)(artifacts).find(name => name.startsWith(".pending-") && (0, fs_1.existsSync)((0, path_1.join)(artifacts, name, "commit-marker.json"))) : undefined;
                if (!pending || linked)
                    return false;
                (0, fs_1.linkSync)((0, path_1.join)(artifacts, pending, "database.db"), alias);
                linked = true;
                return false;
            });
            await (0, assert_1.rejects)((0, game_db_download_database_artifact_1.acquireDatabaseArtifact)({ descriptor: descriptor(), storeRoot: root, transport: fakeTransport(Buffer.from("alias-next")), signal }), /hard link|changed|identity/i);
            (0, assert_1.equal)(linked, true);
            (0, assert_1.equal)(journalState(root), pointerBefore);
        }
        finally {
            (0, fs_1.rmSync)(root, { recursive: true, force: true });
        }
    });
    it("rejects pending mutation after the database copy and before marker-last completion", async () => {
        const seedRoot = temp(), root = temp();
        let mutated = false;
        try {
            const nextBytes = Buffer.from("pending-mutated-after-copy");
            const seed = await (0, game_db_download_database_artifact_1.acquireDatabaseArtifact)({ descriptor: descriptor(), storeRoot: seedRoot, transport: fakeTransport(nextBytes) });
            const first = await (0, game_db_download_database_artifact_1.acquireDatabaseArtifact)({ descriptor: descriptor(), storeRoot: root, transport: fakeTransport(Buffer.from("pending-copy-prior")) });
            const pointerBefore = journalState(root);
            const signal = boundarySignal(() => {
                const artifacts = (0, path_1.join)(root, "artifacts"), finalDatabase = (0, path_1.join)(artifacts, seed.identity, "database.db");
                const pending = (0, fs_1.existsSync)(artifacts) ? (0, fs_1.readdirSync)(artifacts).find(name => name.startsWith(".pending-")) : undefined;
                if (!pending || mutated || !(0, fs_1.existsSync)(finalDatabase) || (0, fs_1.existsSync)((0, path_1.join)(artifacts, seed.identity, "metadata.json")))
                    return false;
                (0, fs_1.writeFileSync)((0, path_1.join)(artifacts, pending, "database.db"), Buffer.from("pending-mutated-after-copy!"));
                mutated = true;
                return false;
            });
            await (0, assert_1.rejects)((0, game_db_download_database_artifact_1.acquireDatabaseArtifact)({ descriptor: descriptor(), storeRoot: root, transport: fakeTransport(nextBytes), signal }), /pending artifact database\.db changed/i);
            (0, assert_1.equal)(mutated, true);
            (0, assert_1.equal)(journalState(root), pointerBefore);
        }
        finally {
            (0, fs_1.rmSync)(seedRoot, { recursive: true, force: true });
            (0, fs_1.rmSync)(root, { recursive: true, force: true });
        }
    });
    it("rejects deterministic database, metadata and marker replacement before journal promotion", async () => {
        const seedRoot = temp();
        try {
            const nextBytes = Buffer.from("replace-final-before-latest");
            const seed = await (0, game_db_download_database_artifact_1.acquireDatabaseArtifact)({ descriptor: descriptor(), storeRoot: seedRoot, transport: fakeTransport(nextBytes) });
            for (const member of ["database.db", "metadata.json", "commit-marker.json"]) {
                const root = temp();
                let replaced = false;
                try {
                    const first = await (0, game_db_download_database_artifact_1.acquireDatabaseArtifact)({ descriptor: descriptor(), storeRoot: root, transport: fakeTransport(Buffer.from(`prior-${member}`)) });
                    const pointerBefore = journalState(root);
                    const signal = boundarySignal(() => {
                        const artifacts = (0, path_1.join)(root, "artifacts"), directory = (0, path_1.join)(artifacts, seed.identity), target = (0, path_1.join)(directory, member);
                        const hasPending = (0, fs_1.existsSync)(artifacts) && (0, fs_1.readdirSync)(artifacts).some(name => name.startsWith(".pending-"));
                        if (replaced || hasPending || !(0, fs_1.existsSync)((0, path_1.join)(directory, "commit-marker.json")))
                            return false;
                        (0, fs_1.renameSync)(target, (0, path_1.join)(root, `.displaced-${member}`));
                        (0, fs_1.writeFileSync)(target, `replacement-${member}`);
                        replaced = true;
                        return false;
                    });
                    await (0, assert_1.rejects)((0, game_db_download_database_artifact_1.acquireDatabaseArtifact)({ descriptor: descriptor(), storeRoot: root, transport: fakeTransport(nextBytes), signal }), /read-only|identity|metadata|marker|changed/i, member);
                    (0, assert_1.equal)(replaced, true, member);
                    (0, assert_1.equal)(journalState(root), pointerBefore, member);
                }
                finally {
                    (0, fs_1.rmSync)(root, { recursive: true, force: true });
                }
            }
        }
        finally {
            (0, fs_1.rmSync)(seedRoot, { recursive: true, force: true });
        }
    });
    it("fails closed to the prior valid journal winner when the new pointed commit is corrupted immediately after append", async () => {
        const seedRoot = temp(), root = temp();
        let corrupted = false;
        try {
            const nextBytes = Buffer.from("corrupt-immediately-after-latest");
            const seed = await (0, game_db_download_database_artifact_1.acquireDatabaseArtifact)({ descriptor: descriptor(), storeRoot: seedRoot, transport: fakeTransport(nextBytes) });
            const first = await (0, game_db_download_database_artifact_1.acquireDatabaseArtifact)({ descriptor: descriptor(), storeRoot: root, transport: fakeTransport(Buffer.from("latest-corruption-prior")) });
            const pointerBefore = journalState(root);
            const signal = boundarySignal(() => {
                if (corrupted)
                    return false;
                const promoted = journalFiles(root).some(name => {
                    try {
                        return JSON.parse((0, fs_1.readFileSync)((0, path_1.join)(root, "pointers", name), "utf8")).identity === seed.identity;
                    }
                    catch {
                        return false;
                    }
                });
                if (!promoted)
                    return false;
                const metadataPath = (0, path_1.join)(root, "artifacts", seed.identity, "metadata.json");
                (0, fs_1.chmodSync)(metadataPath, 0o644);
                (0, fs_1.writeFileSync)(metadataPath, "{}\n");
                corrupted = true;
                return false;
            });
            await (0, assert_1.rejects)((0, game_db_download_database_artifact_1.acquireDatabaseArtifact)({ descriptor: descriptor(), storeRoot: root, transport: fakeTransport(nextBytes), signal }), /artifact|metadata|read-only|identity/i);
            (0, assert_1.equal)(corrupted, true);
            (0, assert_1.equal)((await (0, game_db_download_database_artifact_1.validateAcquiredDatabaseArtifact)({ storeRoot: root, useLatest: true })).identity, first.identity);
        }
        finally {
            (0, fs_1.rmSync)(seedRoot, { recursive: true, force: true });
            (0, fs_1.rmSync)(root, { recursive: true, force: true });
        }
    });
    it("fails closed for nlink greater than one, writable final members and a corrupt latest consumer", async () => {
        for (const variant of ["nlink", "writable", "latest-corrupt"]) {
            const root = temp();
            try {
                const acquired = await (0, game_db_download_database_artifact_1.acquireDatabaseArtifact)({ descriptor: descriptor(), storeRoot: root, transport: fakeTransport(Buffer.from(`consumer-${variant}`)) });
                if (variant === "nlink")
                    (0, fs_1.linkSync)(acquired.artifactPath, (0, path_1.join)(root, "database-alias.db"));
                if (variant === "writable")
                    (0, fs_1.chmodSync)(acquired.metadataPath, 0o644);
                if (variant === "latest-corrupt") {
                    (0, fs_1.chmodSync)(acquired.commitMarkerPath, 0o644);
                    (0, fs_1.writeFileSync)(acquired.commitMarkerPath, "{}\n");
                }
                const options = variant === "latest-corrupt" ? { storeRoot: root, useLatest: true } : { storeRoot: root, artifactIdentity: acquired.identity };
                await (0, assert_1.rejects)((0, game_db_download_database_artifact_1.validateAcquiredDatabaseArtifact)(options), /hard link|read-only|marker|commit|identity|journal/i, variant);
            }
            finally {
                (0, fs_1.rmSync)(root, { recursive: true, force: true });
            }
        }
    });
    it("binds database, metadata and marker replacements to the marker-last material snapshot", async () => {
        for (const member of ["database.db", "metadata.json", "commit-marker.json"]) {
            const root = temp();
            let mutated = false;
            try {
                const first = await (0, game_db_download_database_artifact_1.acquireDatabaseArtifact)({ descriptor: descriptor(), storeRoot: root, transport: fakeTransport(Buffer.from(`prior-${member}`)) });
                const pointerBefore = journalState(root);
                const signal = boundarySignal(() => {
                    const artifacts = (0, path_1.join)(root, "artifacts");
                    const pending = (0, fs_1.existsSync)(artifacts) ? (0, fs_1.readdirSync)(artifacts).find(name => name.startsWith(".pending-") && (0, fs_1.existsSync)((0, path_1.join)(artifacts, name, "commit-marker.json"))) : undefined;
                    if (!pending || mutated)
                        return false;
                    const target = (0, path_1.join)(artifacts, pending, member);
                    (0, fs_1.unlinkSync)(target);
                    (0, fs_1.writeFileSync)(target, `replacement-${member}`);
                    mutated = true;
                    return false;
                });
                await (0, assert_1.rejects)((0, game_db_download_database_artifact_1.acquireDatabaseArtifact)({ descriptor: descriptor(), storeRoot: root, transport: fakeTransport(Buffer.from(`next-${member}`)), signal }), /snapshot|pathname|identity|metadata|marker|database/i, member);
                (0, assert_1.equal)(mutated, true, member);
                (0, assert_1.equal)(journalState(root), pointerBefore, member);
                (0, assert_1.deepEqual)((0, fs_1.readdirSync)((0, path_1.join)(root, "artifacts")).filter(name => /^[a-f0-9]{64}$/.test(name)), [first.identity], member);
            }
            finally {
                (0, fs_1.rmSync)(root, { recursive: true, force: true });
            }
        }
    });
    it("uses an exclusive final-name reservation and never replaces a raced destination", async () => {
        const seedRoot = temp();
        const nextBytes = Buffer.from("create-only-race-candidate");
        try {
            const seed = await (0, game_db_download_database_artifact_1.acquireDatabaseArtifact)({ descriptor: descriptor(), storeRoot: seedRoot, transport: fakeTransport(nextBytes) });
            const variants = [
                { name: "empty directory", valid: false, introduce(target) { (0, fs_1.mkdirSync)(target); } },
                { name: "regular file", valid: false, introduce(target) { (0, fs_1.writeFileSync)(target, "external-file"); } },
                { name: "valid same-identity commit", valid: true, introduce(target) {
                        (0, fs_1.mkdirSync)(target);
                        for (const name of ["database.db", "metadata.json", "commit-marker.json"]) {
                            const member = (0, path_1.join)(target, name);
                            (0, fs_1.copyFileSync)((0, path_1.join)(seedRoot, "artifacts", seed.identity, name), member);
                            (0, fs_1.chmodSync)(member, 0o444);
                        }
                    } },
                { name: "invalid commit", valid: false, introduce(target) {
                        (0, fs_1.mkdirSync)(target);
                        (0, fs_1.writeFileSync)((0, path_1.join)(target, "database.db"), "invalid");
                        (0, fs_1.writeFileSync)((0, path_1.join)(target, "metadata.json"), "{}\n");
                        (0, fs_1.writeFileSync)((0, path_1.join)(target, "commit-marker.json"), "{}\n");
                    } },
                { name: "junction or directory symlink", valid: false, introduce(target, outside) { (0, fs_1.symlinkSync)(outside, target, "junction"); } },
            ];
            for (const variant of variants) {
                const root = temp();
                let introduced = false;
                let targetIdentity = "";
                try {
                    const first = await (0, game_db_download_database_artifact_1.acquireDatabaseArtifact)({ descriptor: descriptor(), storeRoot: root, transport: fakeTransport(Buffer.from(`prior-${variant.name}`)) });
                    const pointerBefore = journalState(root);
                    const target = (0, path_1.join)(root, "artifacts", seed.identity);
                    const outside = (0, path_1.join)(root, "outside");
                    (0, fs_1.mkdirSync)(outside);
                    (0, fs_1.writeFileSync)((0, path_1.join)(outside, "sentinel.txt"), "keep");
                    const signal = boundarySignal(() => {
                        const artifacts = (0, path_1.join)(root, "artifacts");
                        const markerReady = (0, fs_1.existsSync)(artifacts) && (0, fs_1.readdirSync)(artifacts).some(name => name.startsWith(".pending-") && (0, fs_1.existsSync)((0, path_1.join)(artifacts, name, "commit-marker.json")));
                        if (!markerReady || introduced)
                            return false;
                        variant.introduce(target, outside);
                        const stat = (0, fs_1.statSync)(target, { bigint: true });
                        targetIdentity = `${stat.dev}:${stat.ino}:${stat.size}`;
                        introduced = true;
                        return false;
                    });
                    if (variant.valid) {
                        const result = await (0, game_db_download_database_artifact_1.acquireDatabaseArtifact)({ descriptor: descriptor(), storeRoot: root, transport: fakeTransport(nextBytes), signal });
                        (0, assert_1.equal)(result.reused, true, variant.name);
                        (0, assert_1.equal)(result.identity, seed.identity, variant.name);
                        const stat = (0, fs_1.statSync)(target, { bigint: true });
                        (0, assert_1.equal)(`${stat.dev}:${stat.ino}:${stat.size}`, targetIdentity, variant.name);
                        const selected = await (0, game_db_download_database_artifact_1.validateAcquiredDatabaseArtifact)({ storeRoot: root, useLatest: true });
                        (0, assert_1.equal)(selected.identity, [first.identity, seed.identity].sort()[1]);
                    }
                    else {
                        await (0, assert_1.rejects)((0, game_db_download_database_artifact_1.acquireDatabaseArtifact)({ descriptor: descriptor(), storeRoot: root, transport: fakeTransport(nextBytes), signal }), /destination|directory|members|metadata|regular|read-only|symlink|junction|reparse/i, variant.name);
                        (0, assert_1.equal)(journalState(root), pointerBefore, variant.name);
                        (0, assert_1.equal)((0, fs_1.existsSync)(target), true, variant.name);
                        (0, assert_1.equal)((0, fs_1.readFileSync)((0, path_1.join)(outside, "sentinel.txt"), "utf8"), "keep", variant.name);
                    }
                    (0, assert_1.equal)(introduced, true, variant.name);
                }
                finally {
                    (0, fs_1.rmSync)(root, { recursive: true, force: true });
                }
            }
        }
        finally {
            (0, fs_1.rmSync)(seedRoot, { recursive: true, force: true });
        }
    });
    it("quarantines only its reserved directory when a member is replaced after installation", async () => {
        const root = temp();
        let mutated = false;
        try {
            const first = await (0, game_db_download_database_artifact_1.acquireDatabaseArtifact)({ descriptor: descriptor(), storeRoot: root, transport: fakeTransport(Buffer.from("prior-post-promotion")) });
            const pointerBefore = journalState(root);
            const signal = boundarySignal(() => {
                const artifacts = (0, path_1.join)(root, "artifacts");
                if (!(0, fs_1.existsSync)(artifacts) || mutated)
                    return false;
                const promoted = (0, fs_1.readdirSync)(artifacts).find(name => /^[a-f0-9]{64}$/.test(name) && name !== first.identity && (0, fs_1.existsSync)((0, path_1.join)(artifacts, name, "commit-marker.json")));
                if (!promoted)
                    return false;
                const target = (0, path_1.join)(artifacts, promoted, "metadata.json");
                (0, fs_1.unlinkSync)(target);
                (0, fs_1.writeFileSync)(target, "{}\n");
                mutated = true;
                return false;
            });
            await (0, assert_1.rejects)((0, game_db_download_database_artifact_1.acquireDatabaseArtifact)({ descriptor: descriptor(), storeRoot: root, transport: fakeTransport(Buffer.from("next-post-promotion")), signal }), /snapshot|identity|metadata|changed/i);
            (0, assert_1.equal)(mutated, true);
            (0, assert_1.equal)(journalState(root), pointerBefore);
            (0, assert_1.deepEqual)((0, fs_1.readdirSync)((0, path_1.join)(root, "artifacts")).filter(name => /^[a-f0-9]{64}$/.test(name)), [first.identity]);
            (0, assert_1.equal)((0, fs_1.readdirSync)((0, path_1.join)(root, "artifacts")).filter(name => name.startsWith(".quarantine-")).length, 1);
        }
        finally {
            (0, fs_1.rmSync)(root, { recursive: true, force: true });
        }
    });
    it("discards successful and reused staging without retaining a physical staging link", async () => {
        const root = temp(), bytes = Buffer.from("bounded-success-staging");
        try {
            await (0, game_db_download_database_artifact_1.acquireDatabaseArtifact)({ descriptor: descriptor(), storeRoot: root, transport: fakeTransport(bytes) });
            await (0, game_db_download_database_artifact_1.acquireDatabaseArtifact)({ descriptor: descriptor(), storeRoot: root, transport: fakeTransport(bytes) });
            (0, assert_1.equal)((0, fs_1.readdirSync)(root).some(name => name.startsWith(".discard-") || name.startsWith(".file-history-") || name.startsWith(".download-")), false);
            (0, assert_1.equal)((0, fs_1.readdirSync)((0, path_1.join)(root, "receipts")).some(name => name.startsWith(".")), false);
        }
        finally {
            (0, fs_1.rmSync)(root, { recursive: true, force: true });
        }
    });
    it("rejects a full failed-staging history budget before transport while allowing pointer journal growth", async () => {
        const root = temp(), calls = { count: 0 };
        try {
            const history = (0, path_1.join)(root, ".file-history-seeded-failure");
            (0, fs_1.mkdirSync)(history);
            const retained = (0, path_1.join)(history, "latest.json");
            (0, fs_1.writeFileSync)(retained, "x");
            (0, fs_1.truncateSync)(retained, 128 * 1024 * 1024 + 1);
            await (0, assert_1.rejects)((0, game_db_download_database_artifact_1.acquireDatabaseArtifact)({ descriptor: descriptor(), storeRoot: root, transport: fakeTransport(Buffer.from("never"), {}, calls) }), /256 MiB local storage budget/);
            (0, assert_1.equal)(calls.count, 0);
            (0, assert_1.equal)((0, fs_1.statSync)(retained).size, 128 * 1024 * 1024 + 1);
        }
        finally {
            (0, fs_1.rmSync)(root, { recursive: true, force: true });
        }
        const smallRoot = temp();
        try {
            const first = await (0, game_db_download_database_artifact_1.acquireDatabaseArtifact)({ descriptor: descriptor(), storeRoot: smallRoot, transport: fakeTransport(Buffer.from("small-history-one")), maxBytes: 1024 });
            const second = await (0, game_db_download_database_artifact_1.acquireDatabaseArtifact)({ descriptor: descriptor(), storeRoot: smallRoot, transport: fakeTransport(Buffer.from("small-history-two")), maxBytes: 1024 });
            const selected = await (0, game_db_download_database_artifact_1.validateAcquiredDatabaseArtifact)({ storeRoot: smallRoot, useLatest: true });
            (0, assert_1.equal)(selected.identity, [first.identity, second.identity].sort().pop());
            (0, assert_1.equal)(journalFiles(smallRoot).length, 2);
        }
        finally {
            (0, fs_1.rmSync)(smallRoot, { recursive: true, force: true });
        }
    });
    it("fails closed when committed artifact members are swapped after their handles open", async function () {
        const variants = [
            { name: "metadata", abortedRead: 6, target: first => first.metadataPath },
            { name: "artifact", abortedRead: 7, target: first => first.artifactPath },
            { name: "marker", abortedRead: 8, target: first => first.commitMarkerPath },
        ];
        for (const variant of variants) {
            const root = temp(), bytes = Buffer.from(`stable-${variant.name}`);
            let displaced = "", target = "", swapped = false;
            try {
                const first = await (0, game_db_download_database_artifact_1.acquireDatabaseArtifact)({ descriptor: descriptor(), storeRoot: root, transport: fakeTransport(bytes) });
                const pointerBefore = journalState(root);
                target = variant.target(first);
                displaced = (0, path_1.join)(root, `.displaced-${variant.name}`);
                const mutation = mutationSignal(variant.abortedRead, () => {
                    try {
                        (0, fs_1.renameSync)(target, displaced);
                        (0, fs_1.writeFileSync)(target, Buffer.from(`replacement-${variant.name}`));
                        swapped = true;
                    }
                    catch (error) {
                        if ((0, fs_1.existsSync)(displaced) && !(0, fs_1.existsSync)(target))
                            (0, fs_1.renameSync)(displaced, target);
                        throw error;
                    }
                });
                let failure;
                try {
                    await (0, game_db_download_database_artifact_1.acquireDatabaseArtifact)({ descriptor: descriptor(), storeRoot: root, transport: fakeTransport(bytes), signal: mutation.signal });
                }
                catch (error) {
                    failure = error;
                }
                (0, assert_1.equal)(swapped, true, `${variant.name} hook count ${mutation.count()}`);
                (0, assert_1.match)(String(failure), /pathname|identity|replaced|changed|read-only/i, `${variant.name}: ${String(failure)} at ${mutation.count()}`);
                if (swapped) {
                    (0, fs_1.unlinkSync)(target);
                    (0, fs_1.renameSync)(displaced, target);
                    swapped = false;
                }
                (0, assert_1.equal)(journalState(root), pointerBefore, variant.name);
            }
            finally {
                if (swapped && (0, fs_1.existsSync)(target))
                    (0, fs_1.unlinkSync)(target);
                if ((0, fs_1.existsSync)(displaced))
                    (0, fs_1.renameSync)(displaced, target);
                (0, fs_1.rmSync)(root, { recursive: true, force: true });
            }
        }
    });
    it("streams the observed-scale artifact without constructing a whole-file buffer", async () => {
        const root = temp();
        const size = 97738752;
        const chunk = Buffer.alloc(64 * 1024, 0x5a);
        function* chunks() {
            let remaining = size;
            while (remaining > 0) {
                const length = Math.min(remaining, chunk.byteLength);
                yield length === chunk.byteLength ? chunk : chunk.subarray(0, length);
                remaining -= length;
            }
        }
        const transport = { async get() { return { statusCode: 200, headers: { "content-length": String(size) }, body: stream_1.Readable.from(chunks()) }; } };
        try {
            const result = await (0, game_db_download_database_artifact_1.acquireDatabaseArtifact)({ descriptor: descriptor(), storeRoot: root, transport });
            (0, assert_1.equal)(result.metadata.observedSizeBytes, size);
            (0, assert_1.equal)(result.metadata.artifactState, "encrypted_or_packaged");
        }
        finally {
            (0, fs_1.rmSync)(root, { recursive: true, force: true });
        }
    });
    it("preserves the previous artifact and journal when a later acquisition fails", async () => {
        const root = temp();
        try {
            const raw = descriptor();
            const first = await (0, game_db_download_database_artifact_1.acquireDatabaseArtifact)({ descriptor: raw, storeRoot: root, transport: fakeTransport(Buffer.from("first-valid-bytes")) });
            const latestBefore = journalState(root);
            await (0, assert_1.rejects)((0, game_db_download_database_artifact_1.acquireDatabaseArtifact)({ descriptor: raw, storeRoot: root, transport: fakeTransport(Buffer.from("bad"), { contentLength: "4" }) }), /truncated/);
            (0, assert_1.equal)(journalState(root), latestBefore);
            (0, assert_1.equal)((0, fs_1.readFileSync)(first.artifactPath).toString(), "first-valid-bytes");
            (0, assert_1.equal)((0, fs_1.readdirSync)(root).some(name => name.startsWith(".download-") || name.startsWith(".pending-")), false);
        }
        finally {
            (0, fs_1.rmSync)(root, { recursive: true, force: true });
        }
    });
    it("does not append a pointer record when the operational receipt cannot be committed", async () => {
        const root = temp();
        try {
            const raw = descriptor();
            const first = await (0, game_db_download_database_artifact_1.acquireDatabaseArtifact)({ descriptor: raw, storeRoot: root, transport: fakeTransport(Buffer.from("first-valid-bytes")), now: () => new Date("2026-08-13T20:00:00.000Z") });
            const latestBefore = journalState(root);
            (0, fs_1.rmSync)((0, path_1.join)(root, "receipts"), { recursive: true, force: true });
            (0, fs_1.writeFileSync)((0, path_1.join)(root, "receipts"), "blocks receipt directory");
            await (0, assert_1.rejects)((0, game_db_download_database_artifact_1.acquireDatabaseArtifact)({ descriptor: raw, storeRoot: root, transport: fakeTransport(Buffer.from("second-valid-bytes")), now: () => new Date("2026-08-13T21:00:00.000Z") }), /EEXIST|directory|store root/i);
            (0, assert_1.equal)(journalState(root), latestBefore);
        }
        finally {
            (0, fs_1.rmSync)(root, { recursive: true, force: true });
        }
    });
    it("selects current and rollback deterministically for new and repeated identities", async () => {
        const root = temp();
        try {
            const first = await (0, game_db_download_database_artifact_1.acquireDatabaseArtifact)({ descriptor: descriptor(), storeRoot: root, transport: fakeTransport(Buffer.from("identity-one")) });
            let selected = await (0, game_db_download_database_artifact_1.validateAcquiredDatabaseArtifact)({ storeRoot: root, useLatest: true });
            (0, assert_1.equal)(selected.identity, first.identity);
            (0, assert_1.equal)(selected.previousIdentity, null);
            const second = await (0, game_db_download_database_artifact_1.acquireDatabaseArtifact)({ descriptor: descriptor(), storeRoot: root, transport: fakeTransport(Buffer.from("identity-two")) });
            const order = [first.identity, second.identity].sort();
            selected = await (0, game_db_download_database_artifact_1.validateAcquiredDatabaseArtifact)({ storeRoot: root, useLatest: true });
            (0, assert_1.equal)(selected.identity, order[1]);
            (0, assert_1.equal)(selected.previousIdentity, order[0]);
            const repeated = await (0, game_db_download_database_artifact_1.acquireDatabaseArtifact)({ descriptor: descriptor(), storeRoot: root, transport: fakeTransport(Buffer.from("identity-two")) });
            (0, assert_1.equal)(repeated.reused, true);
            (0, assert_1.equal)(journalFiles(root).length, 2);
            selected = await (0, game_db_download_database_artifact_1.validateAcquiredDatabaseArtifact)({ storeRoot: root, useLatest: true });
            (0, assert_1.equal)(selected.identity, order[1]);
            (0, assert_1.equal)(selected.previousIdentity, order[0]);
        }
        finally {
            (0, fs_1.rmSync)(root, { recursive: true, force: true });
        }
    });
    it("deduplicates external records for one commit before selecting deterministic rollback", async () => {
        const root = temp();
        try {
            await (0, game_db_download_database_artifact_1.acquireDatabaseArtifact)({ descriptor: descriptor(), storeRoot: root, transport: fakeTransport(Buffer.from("duplicate-one")) });
            await (0, game_db_download_database_artifact_1.acquireDatabaseArtifact)({ descriptor: descriptor(), storeRoot: root, transport: fakeTransport(Buffer.from("duplicate-two")) });
            const before = await (0, game_db_download_database_artifact_1.validateAcquiredDatabaseArtifact)({ storeRoot: root, useLatest: true });
            if (!before.pointerRecordPath || !before.previousIdentity)
                throw new Error("expected journal selection");
            const duplicate = JSON.parse((0, fs_1.readFileSync)(before.pointerRecordPath, "utf8"));
            duplicate.predecessorIdentity = duplicate.predecessorIdentity === null ? before.previousIdentity : null;
            writePointerRecord(root, duplicate);
            const after = await (0, game_db_download_database_artifact_1.validateAcquiredDatabaseArtifact)({ storeRoot: root, useLatest: true });
            (0, assert_1.equal)(after.identity, before.identity);
            (0, assert_1.equal)(after.previousIdentity, before.previousIdentity);
            (0, assert_1.notEqual)(after.previousIdentity, after.identity);
            (0, assert_1.equal)(journalFiles(root).length, 3);
        }
        finally {
            (0, fs_1.rmSync)(root, { recursive: true, force: true });
        }
    });
    it("ignores corrupt, truncated and missing-commit records while failing closed without any valid winner", async () => {
        const root = temp();
        try {
            const acquired = await (0, game_db_download_database_artifact_1.acquireDatabaseArtifact)({ descriptor: descriptor(), storeRoot: root, transport: fakeTransport(Buffer.from("journal-valid")) });
            const corrupt = (0, path_1.join)(root, "pointers", `${"a".repeat(64)}.json`);
            (0, fs_1.writeFileSync)(corrupt, "{");
            (0, fs_1.chmodSync)(corrupt, 0o444);
            const missing = { schemaVersion: 1, contract: "dokkan-game-db-pointer-record", contractVersion: "1.0.0", identity: "b".repeat(64), predecessorIdentity: null, order: { databaseVersion: version + 1, artifactIdentity: "b".repeat(64) } };
            writePointerRecord(root, missing);
            (0, assert_1.equal)((await (0, game_db_download_database_artifact_1.validateAcquiredDatabaseArtifact)({ storeRoot: root, useLatest: true })).identity, acquired.identity);
            (0, fs_1.chmodSync)(acquired.pointerRecordPath, 0o600);
            (0, fs_1.rmSync)(acquired.pointerRecordPath, { force: true });
            await (0, assert_1.rejects)((0, game_db_download_database_artifact_1.validateAcquiredDatabaseArtifact)({ storeRoot: root, useLatest: true }), /journal has no valid materialized record/);
        }
        finally {
            (0, fs_1.rmSync)(root, { recursive: true, force: true });
        }
    });
    it("ignores a divergent latest cache and rejects unexpected pointer directory members", async () => {
        const root = temp();
        try {
            const acquired = await (0, game_db_download_database_artifact_1.acquireDatabaseArtifact)({ descriptor: descriptor(), storeRoot: root, transport: fakeTransport(Buffer.from("cache-divergence")) });
            (0, fs_1.writeFileSync)((0, path_1.join)(root, "latest.json"), "{\"currentIdentity\":\"forged\"}\n");
            (0, assert_1.equal)((await (0, game_db_download_database_artifact_1.validateAcquiredDatabaseArtifact)({ storeRoot: root, useLatest: true })).identity, acquired.identity);
            (0, fs_1.writeFileSync)((0, path_1.join)(root, "pointers", "unexpected.txt"), "sentinel");
            await (0, assert_1.rejects)((0, game_db_download_database_artifact_1.validateAcquiredDatabaseArtifact)({ storeRoot: root, useLatest: true }), /unexpected or non-regular member/);
            (0, assert_1.equal)((0, fs_1.readFileSync)((0, path_1.join)(root, "pointers", "unexpected.txt"), "utf8"), "sentinel");
        }
        finally {
            (0, fs_1.rmSync)(root, { recursive: true, force: true });
        }
    });
    it("rejects descriptor symlinks when supported", async function () {
        const root = temp();
        try {
            const realDescriptor = (0, path_1.join)(root, "real.json"), linkedDescriptor = (0, path_1.join)(root, "linked.json");
            (0, fs_1.writeFileSync)(realDescriptor, JSON.stringify(descriptor()));
            try {
                (0, fs_1.symlinkSync)(realDescriptor, linkedDescriptor, "file");
            }
            catch (error) {
                if (error?.code === "EPERM") {
                    this.skip();
                    return;
                }
                throw error;
            }
            await (0, assert_1.rejects)((0, game_db_download_database_artifact_1.readAndValidateDatabaseDescriptor)(linkedDescriptor), /symlink|junction/);
        }
        finally {
            (0, fs_1.rmSync)(root, { recursive: true, force: true });
        }
    });
    it("rejects a real external store-root junction on Windows and other supported hosts", async function () {
        const root = temp();
        try {
            const outside = (0, path_1.join)(root, "outside"), linkedRoot = (0, path_1.join)(root, "linked-root");
            await (0, promises_1.mkdir)(outside);
            (0, fs_1.symlinkSync)(outside, linkedRoot, "junction");
            await (0, assert_1.rejects)((0, game_db_download_database_artifact_1.acquireDatabaseArtifact)({ descriptor: descriptor(), storeRoot: linkedRoot, transport: fakeTransport(Buffer.from("x")) }), /symlink|junction/);
        }
        finally {
            (0, fs_1.rmSync)(root, { recursive: true, force: true });
        }
    });
    it("rejects an existing-parent swap between its snapshot and store creation", async function () {
        const base = temp(), parent = (0, path_1.join)(base, "parent"), displaced = (0, path_1.join)(base, "parent-displaced"), outside = (0, path_1.join)(base, "outside"), store = (0, path_1.join)(parent, "new", "store");
        await (0, promises_1.mkdir)(parent);
        await (0, promises_1.mkdir)(outside);
        let swapped = false;
        const mutation = mutationSignal(1, () => {
            (0, fs_1.renameSync)(parent, displaced);
            try {
                (0, fs_1.symlinkSync)(outside, parent, "junction");
            }
            catch (error) {
                (0, fs_1.renameSync)(displaced, parent);
                throw error;
            }
            swapped = true;
        });
        const calls = { count: 0 };
        try {
            let failure;
            try {
                await (0, game_db_download_database_artifact_1.acquireDatabaseArtifact)({ descriptor: descriptor(), storeRoot: store, transport: fakeTransport(Buffer.from("never"), {}, calls), signal: mutation.signal });
            }
            catch (error) {
                failure = error;
            }
            (0, assert_1.equal)(swapped, true);
            (0, assert_1.match)(String(failure), /identity changed|controlled directory/i);
            (0, assert_1.equal)(calls.count, 0);
            (0, assert_1.deepEqual)((0, fs_1.readdirSync)(outside), []);
            (0, assert_1.equal)((0, fs_1.existsSync)((0, path_1.join)(outside, "new")), false);
        }
        finally {
            if (swapped && (0, fs_1.existsSync)(parent))
                (0, fs_1.unlinkSync)(parent);
            if (swapped && (0, fs_1.existsSync)(displaced))
                (0, fs_1.renameSync)(displaced, parent);
            (0, fs_1.rmSync)(base, { recursive: true, force: true });
        }
    });
    it("rejects a junction substituted for artifacts and never writes outside the validated root", async function () {
        const base = temp(), store = (0, path_1.join)(base, "store"), outside = (0, path_1.join)(base, "outside");
        await (0, promises_1.mkdir)(store);
        await (0, promises_1.mkdir)(outside);
        try {
            const artifacts = (0, path_1.join)(store, "artifacts");
            (0, fs_1.symlinkSync)(outside, artifacts, "junction");
            await (0, assert_1.rejects)((0, game_db_download_database_artifact_1.acquireDatabaseArtifact)({ descriptor: descriptor(), storeRoot: store, transport: fakeTransport(Buffer.from("x")) }), /symlink|junction|reparse/);
            (0, assert_1.deepEqual)((0, fs_1.readdirSync)(outside), []);
        }
        finally {
            (0, fs_1.rmSync)(base, { recursive: true, force: true });
        }
    });
    it("detects concurrent root replacement and does not clean through the replacement junction", async function () {
        const base = temp(), store = (0, path_1.join)(base, "store"), displaced = (0, path_1.join)(base, "displaced"), outside = (0, path_1.join)(base, "outside");
        await (0, promises_1.mkdir)(store);
        await (0, promises_1.mkdir)(outside);
        (0, fs_1.writeFileSync)((0, path_1.join)(outside, "sentinel.txt"), "keep");
        let swapped = false;
        const signal = boundarySignal(() => {
            if (!swapped && (0, fs_1.existsSync)(store) && (0, fs_1.readdirSync)(store).some(name => name.startsWith(".download-"))) {
                (0, fs_1.renameSync)(store, displaced);
                try {
                    (0, fs_1.symlinkSync)(outside, store, "junction");
                }
                catch (error) {
                    throw error;
                }
                swapped = true;
            }
            return false;
        });
        try {
            await (0, assert_1.rejects)((0, game_db_download_database_artifact_1.acquireDatabaseArtifact)({ descriptor: descriptor(), storeRoot: store, transport: fakeTransport(Buffer.from("root-swap")), signal }), /identity changed|controlled directory/i);
            (0, assert_1.equal)(swapped, true);
            (0, assert_1.equal)((0, fs_1.readFileSync)((0, path_1.join)(outside, "sentinel.txt"), "utf8"), "keep");
            (0, assert_1.deepEqual)((0, fs_1.readdirSync)(outside), ["sentinel.txt"]);
        }
        finally {
            if (swapped && (0, fs_1.existsSync)(store))
                (0, fs_1.unlinkSync)(store);
            if (swapped && (0, fs_1.existsSync)(displaced))
                (0, fs_1.renameSync)(displaced, store);
            (0, fs_1.rmSync)(base, { recursive: true, force: true });
        }
    });
    it("detects concurrent artifacts replacement and does not write or clean through it", async function () {
        const base = temp(), store = (0, path_1.join)(base, "store"), outside = (0, path_1.join)(base, "outside"), displaced = (0, path_1.join)(store, "artifacts-displaced");
        await (0, promises_1.mkdir)(store);
        await (0, promises_1.mkdir)(outside);
        (0, fs_1.writeFileSync)((0, path_1.join)(outside, "sentinel.txt"), "keep");
        let swapped = false;
        const signal = boundarySignal(() => {
            const artifacts = (0, path_1.join)(store, "artifacts");
            if (!swapped && (0, fs_1.existsSync)(artifacts) && (0, fs_1.readdirSync)(artifacts).some(name => name.startsWith(".pending-"))) {
                (0, fs_1.renameSync)(artifacts, displaced);
                try {
                    (0, fs_1.symlinkSync)(outside, artifacts, "junction");
                }
                catch (error) {
                    throw error;
                }
                swapped = true;
            }
            return false;
        });
        try {
            await (0, assert_1.rejects)((0, game_db_download_database_artifact_1.acquireDatabaseArtifact)({ descriptor: descriptor(), storeRoot: store, transport: fakeTransport(Buffer.from("artifacts-swap")), signal }), /identity changed|controlled directory/i);
            (0, assert_1.equal)(swapped, true);
            (0, assert_1.deepEqual)((0, fs_1.readdirSync)(outside), ["sentinel.txt"]);
        }
        finally {
            const artifacts = (0, path_1.join)(store, "artifacts");
            if (swapped && (0, fs_1.existsSync)(artifacts))
                (0, fs_1.unlinkSync)(artifacts);
            if (swapped && (0, fs_1.existsSync)(displaced))
                (0, fs_1.renameSync)(displaced, artifacts);
            (0, fs_1.rmSync)(base, { recursive: true, force: true });
        }
    });
});
const OFFICIAL_SECRET = "cf.ishin-global.aktsk.com";
//# sourceMappingURL=game-db-download-database-artifact.spec.js.map