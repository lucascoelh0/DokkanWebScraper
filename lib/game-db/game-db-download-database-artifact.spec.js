"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = require("assert");
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
function latest(root) { return JSON.parse((0, fs_1.readFileSync)((0, path_1.join)(root, "latest.json"), "utf8")); }
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
            const pointerBefore = (0, fs_1.readFileSync)(first.latestPointerPath, "utf8");
            const signal = boundarySignal(() => (0, fs_1.readdirSync)(root).some(name => name.startsWith(".download-") && (0, fs_1.readFileSync)((0, path_1.join)(root, name)).byteLength === nextBytes.byteLength));
            await (0, assert_1.rejects)((0, game_db_download_database_artifact_1.acquireDatabaseArtifact)({ descriptor: descriptor(), storeRoot: root, transport: fakeTransport(nextBytes), signal }), /cancelled/);
            (0, assert_1.equal)((0, fs_1.readFileSync)(first.latestPointerPath, "utf8"), pointerBefore);
            (0, assert_1.equal)((0, fs_1.readdirSync)(root).some(name => name.startsWith(".download-") || name.startsWith(".pending-")), false);
        }
        finally {
            (0, fs_1.rmSync)(root, { recursive: true, force: true });
        }
    });
    it("fails closed after artifact promotion and permits the validated orphan to remain", async () => {
        const root = temp(), firstBytes = Buffer.from("first-valid-bytes"), nextBytes = Buffer.from("second-valid-artifact");
        try {
            const first = await (0, game_db_download_database_artifact_1.acquireDatabaseArtifact)({ descriptor: descriptor(), storeRoot: root, transport: fakeTransport(firstBytes) });
            const pointerBefore = (0, fs_1.readFileSync)(first.latestPointerPath, "utf8");
            const signal = boundarySignal(() => {
                const artifacts = (0, path_1.join)(root, "artifacts");
                return (0, fs_1.existsSync)(artifacts) && (0, fs_1.readdirSync)(artifacts).some(name => /^[a-f0-9]{64}$/.test(name) && name !== first.identity && (0, fs_1.existsSync)((0, path_1.join)(artifacts, name, "commit-marker.json")));
            });
            await (0, assert_1.rejects)((0, game_db_download_database_artifact_1.acquireDatabaseArtifact)({ descriptor: descriptor(), storeRoot: root, transport: fakeTransport(nextBytes), signal }), /cancelled/);
            (0, assert_1.equal)((0, fs_1.readFileSync)(first.latestPointerPath, "utf8"), pointerBefore);
            const orphans = (0, fs_1.readdirSync)((0, path_1.join)(root, "artifacts")).filter(name => /^[a-f0-9]{64}$/.test(name) && name !== first.identity);
            (0, assert_1.equal)(orphans.length, 1);
            (0, assert_1.equal)((0, fs_1.existsSync)((0, path_1.join)(root, "artifacts", orphans[0], "commit-marker.json")), true);
        }
        finally {
            (0, fs_1.rmSync)(root, { recursive: true, force: true });
        }
    });
    it("fails closed after receipt without promoting latest", async () => {
        const root = temp(), firstBytes = Buffer.from("first-valid-bytes"), nextBytes = Buffer.from("third-valid-artifact");
        try {
            const first = await (0, game_db_download_database_artifact_1.acquireDatabaseArtifact)({ descriptor: descriptor(), storeRoot: root, transport: fakeTransport(firstBytes), now: () => new Date("2026-08-13T20:00:00.000Z") });
            const pointerBefore = (0, fs_1.readFileSync)(first.latestPointerPath, "utf8");
            const receiptsBefore = (0, fs_1.readdirSync)((0, path_1.join)(root, "receipts")).length;
            const signal = boundarySignal(() => (0, fs_1.existsSync)((0, path_1.join)(root, "receipts")) && (0, fs_1.readdirSync)((0, path_1.join)(root, "receipts")).filter(name => !name.startsWith(".")).length > receiptsBefore);
            await (0, assert_1.rejects)((0, game_db_download_database_artifact_1.acquireDatabaseArtifact)({ descriptor: descriptor(), storeRoot: root, transport: fakeTransport(nextBytes), signal, now: () => new Date("2026-08-13T21:00:00.000Z") }), /cancelled/);
            (0, assert_1.equal)((0, fs_1.readFileSync)(first.latestPointerPath, "utf8"), pointerBefore);
            (0, assert_1.equal)((0, fs_1.readdirSync)((0, path_1.join)(root, "receipts")).filter(name => !name.startsWith(".")).length, receiptsBefore + 1);
        }
        finally {
            (0, fs_1.rmSync)(root, { recursive: true, force: true });
        }
    });
    it("rolls latest back if cancellation is observed immediately after promotion", async () => {
        const root = temp(), firstBytes = Buffer.from("first-valid-bytes"), nextBytes = Buffer.from("fourth-valid-artifact");
        try {
            const first = await (0, game_db_download_database_artifact_1.acquireDatabaseArtifact)({ descriptor: descriptor(), storeRoot: root, transport: fakeTransport(firstBytes) });
            const pointerBefore = (0, fs_1.readFileSync)(first.latestPointerPath, "utf8");
            const signal = boundarySignal(() => (0, fs_1.existsSync)((0, path_1.join)(root, "latest.json")) && (0, fs_1.readFileSync)((0, path_1.join)(root, "latest.json"), "utf8") !== pointerBefore);
            await (0, assert_1.rejects)((0, game_db_download_database_artifact_1.acquireDatabaseArtifact)({ descriptor: descriptor(), storeRoot: root, transport: fakeTransport(nextBytes), signal }), /cancelled/);
            (0, assert_1.equal)((0, fs_1.readFileSync)(first.latestPointerPath, "utf8"), pointerBefore);
        }
        finally {
            (0, fs_1.rmSync)(root, { recursive: true, force: true });
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
    it("moves and retains a replacement swapped exactly at latest withdrawal", async () => {
        const root = temp(), latestPath = (0, path_1.join)(root, "latest.json"), displaced = (0, path_1.join)(root, "withdrawal-original.json");
        let raced = false;
        try {
            const first = await (0, game_db_download_database_artifact_1.acquireDatabaseArtifact)({ descriptor: descriptor(), storeRoot: root, transport: fakeTransport(Buffer.from("withdrawal-first")) });
            const pointerBefore = (0, fs_1.readFileSync)(first.latestPointerPath, "utf8");
            const signal = boundarySignal(() => {
                if (!raced && (0, fs_1.readdirSync)(root).some(name => name.startsWith(".latest-history-"))) {
                    (0, fs_1.renameSync)(latestPath, displaced);
                    (0, fs_1.writeFileSync)(latestPath, "withdrawal-race-sentinel");
                    raced = true;
                }
                return false;
            });
            await (0, assert_1.rejects)((0, game_db_download_database_artifact_1.acquireDatabaseArtifact)({ descriptor: descriptor(), storeRoot: root, transport: fakeTransport(Buffer.from("withdrawal-next")), signal }), /replacement identity|retained/i);
            (0, assert_1.equal)(raced, true);
            (0, assert_1.equal)((0, fs_1.readFileSync)(displaced, "utf8"), pointerBefore);
            (0, assert_1.equal)((0, fs_1.existsSync)(latestPath), false);
            const histories = (0, fs_1.readdirSync)(root).filter(name => name.startsWith(".latest-history-"));
            (0, assert_1.equal)(histories.some(name => (0, fs_1.readFileSync)((0, path_1.join)(root, name, "latest.json"), "utf8") === "withdrawal-race-sentinel"), true);
        }
        finally {
            (0, fs_1.rmSync)(root, { recursive: true, force: true });
        }
    });
    it("does not overwrite a latest replacement introduced during rollback and retains the prior pointer", async () => {
        const root = temp(), displaced = (0, path_1.join)(root, "displaced-promoted-latest.json");
        let swapped = false;
        try {
            const first = await (0, game_db_download_database_artifact_1.acquireDatabaseArtifact)({ descriptor: descriptor(), storeRoot: root, transport: fakeTransport(Buffer.from("rollback-original")) });
            const pointerBefore = (0, fs_1.readFileSync)(first.latestPointerPath, "utf8");
            const controller = new AbortController();
            const signal = new Proxy(controller.signal, {
                get(target, property) {
                    if (property === "aborted") {
                        const histories = (0, fs_1.readdirSync)(root).filter(name => name.startsWith(".latest-history-"));
                        if (!target.aborted && (0, fs_1.existsSync)(first.latestPointerPath) && (0, fs_1.readFileSync)(first.latestPointerPath, "utf8") !== pointerBefore)
                            controller.abort();
                        else if (target.aborted && !swapped && histories.length >= 2) {
                            (0, fs_1.renameSync)(first.latestPointerPath, displaced);
                            (0, fs_1.writeFileSync)(first.latestPointerPath, "rollback-race-sentinel");
                            swapped = true;
                        }
                        return target.aborted;
                    }
                    const value = Reflect.get(target, property, target);
                    return typeof value === "function" ? value.bind(target) : value;
                }
            });
            await (0, assert_1.rejects)((0, game_db_download_database_artifact_1.acquireDatabaseArtifact)({ descriptor: descriptor(), storeRoot: root, transport: fakeTransport(Buffer.from("rollback-next")), signal }), /replacement latest pointer|retained/i);
            (0, assert_1.equal)(swapped, true);
            (0, assert_1.equal)((0, fs_1.existsSync)(first.latestPointerPath), false);
            const historyTexts = (0, fs_1.readdirSync)(root).filter(name => name.startsWith(".latest-history-")).map(name => (0, fs_1.readFileSync)((0, path_1.join)(root, name, "latest.json"), "utf8"));
            (0, assert_1.equal)(historyTexts.includes(pointerBefore), true);
            (0, assert_1.equal)(historyTexts.includes("rollback-race-sentinel"), true);
        }
        finally {
            (0, fs_1.rmSync)(root, { recursive: true, force: true });
        }
    });
    it("restores the prior pointer from retained history on late cancellation", async () => {
        const root = temp();
        try {
            const first = await (0, game_db_download_database_artifact_1.acquireDatabaseArtifact)({ descriptor: descriptor(), storeRoot: root, transport: fakeTransport(Buffer.from("finalize-first")) });
            const pointerBefore = (0, fs_1.readFileSync)(first.latestPointerPath, "utf8");
            const signal = boundarySignal(() => {
                const latestChanged = (0, fs_1.existsSync)(first.latestPointerPath) && (0, fs_1.readFileSync)(first.latestPointerPath, "utf8") !== pointerBefore;
                return latestChanged;
            });
            await (0, assert_1.rejects)((0, game_db_download_database_artifact_1.acquireDatabaseArtifact)({ descriptor: descriptor(), storeRoot: root, transport: fakeTransport(Buffer.from("finalize-second")), signal }), /cancelled/);
            (0, assert_1.equal)((0, fs_1.readFileSync)(first.latestPointerPath, "utf8"), pointerBefore);
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
    it("rejects a full failed-staging history budget before transport while allowing small latest histories", async () => {
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
            await (0, game_db_download_database_artifact_1.acquireDatabaseArtifact)({ descriptor: descriptor(), storeRoot: smallRoot, transport: fakeTransport(Buffer.from("small-history-one")), maxBytes: 1024 });
            const second = await (0, game_db_download_database_artifact_1.acquireDatabaseArtifact)({ descriptor: descriptor(), storeRoot: smallRoot, transport: fakeTransport(Buffer.from("small-history-two")), maxBytes: 1024 });
            (0, assert_1.equal)(latest(smallRoot).currentIdentity, second.identity);
            (0, assert_1.equal)((0, fs_1.readdirSync)(smallRoot).some(name => name.startsWith(".latest-history-")), true);
        }
        finally {
            (0, fs_1.rmSync)(smallRoot, { recursive: true, force: true });
        }
    });
    it("fails closed when committed artifact members or latest are swapped after their handles open", async function () {
        const variants = [
            { name: "metadata", abortedRead: 6, target: first => first.metadataPath },
            { name: "artifact", abortedRead: 7, target: first => first.artifactPath },
            { name: "marker", abortedRead: 8, target: first => first.commitMarkerPath },
            { name: "latest", abortedRead: 24, target: first => first.latestPointerPath },
        ];
        for (const variant of variants) {
            const root = temp(), bytes = Buffer.from(`stable-${variant.name}`);
            let displaced = "", target = "", swapped = false;
            try {
                const first = await (0, game_db_download_database_artifact_1.acquireDatabaseArtifact)({ descriptor: descriptor(), storeRoot: root, transport: fakeTransport(bytes) });
                const pointerBefore = (0, fs_1.readFileSync)(first.latestPointerPath, "utf8");
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
                (0, assert_1.match)(String(failure), /pathname|identity|replaced|changed/i, `${variant.name}: ${String(failure)} at ${mutation.count()}`);
                if (swapped) {
                    (0, fs_1.unlinkSync)(target);
                    (0, fs_1.renameSync)(displaced, target);
                    swapped = false;
                }
                (0, assert_1.equal)((0, fs_1.readFileSync)(first.latestPointerPath, "utf8"), pointerBefore, variant.name);
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
    it("preserves the previous artifact and latest pointer when a later acquisition fails", async () => {
        const root = temp();
        try {
            const raw = descriptor();
            const first = await (0, game_db_download_database_artifact_1.acquireDatabaseArtifact)({ descriptor: raw, storeRoot: root, transport: fakeTransport(Buffer.from("first-valid-bytes")) });
            const latestBefore = await (0, promises_1.readFile)(first.latestPointerPath, "utf8");
            await (0, assert_1.rejects)((0, game_db_download_database_artifact_1.acquireDatabaseArtifact)({ descriptor: raw, storeRoot: root, transport: fakeTransport(Buffer.from("bad"), { contentLength: "4" }) }), /truncated/);
            (0, assert_1.equal)(await (0, promises_1.readFile)(first.latestPointerPath, "utf8"), latestBefore);
            (0, assert_1.equal)((0, fs_1.readFileSync)(first.artifactPath).toString(), "first-valid-bytes");
            (0, assert_1.equal)((0, fs_1.readdirSync)(root).some(name => name.startsWith(".download-") || name.startsWith(".pending-")), false);
        }
        finally {
            (0, fs_1.rmSync)(root, { recursive: true, force: true });
        }
    });
    it("does not promote latest when the operational receipt cannot be committed", async () => {
        const root = temp();
        try {
            const raw = descriptor();
            const first = await (0, game_db_download_database_artifact_1.acquireDatabaseArtifact)({ descriptor: raw, storeRoot: root, transport: fakeTransport(Buffer.from("first-valid-bytes")), now: () => new Date("2026-08-13T20:00:00.000Z") });
            const latestBefore = await (0, promises_1.readFile)(first.latestPointerPath, "utf8");
            (0, fs_1.rmSync)((0, path_1.join)(root, "receipts"), { recursive: true, force: true });
            (0, fs_1.writeFileSync)((0, path_1.join)(root, "receipts"), "blocks receipt directory");
            await (0, assert_1.rejects)((0, game_db_download_database_artifact_1.acquireDatabaseArtifact)({ descriptor: raw, storeRoot: root, transport: fakeTransport(Buffer.from("second-valid-bytes")), now: () => new Date("2026-08-13T21:00:00.000Z") }), /EEXIST|directory|store root/i);
            (0, assert_1.equal)(await (0, promises_1.readFile)(first.latestPointerPath, "utf8"), latestBefore);
        }
        finally {
            (0, fs_1.rmSync)(root, { recursive: true, force: true });
        }
    });
    it("validates complete latest rollback chains for new and repeated identities", async () => {
        const root = temp();
        try {
            const first = await (0, game_db_download_database_artifact_1.acquireDatabaseArtifact)({ descriptor: descriptor(), storeRoot: root, transport: fakeTransport(Buffer.from("identity-one")) });
            (0, assert_1.deepEqual)(latest(root), { schemaVersion: 1, contract: "dokkan-game-db-local-latest", contractVersion: "1.0.0", currentIdentity: first.identity, previousIdentity: null });
            const second = await (0, game_db_download_database_artifact_1.acquireDatabaseArtifact)({ descriptor: descriptor(), storeRoot: root, transport: fakeTransport(Buffer.from("identity-two")) });
            (0, assert_1.deepEqual)(latest(root), { schemaVersion: 1, contract: "dokkan-game-db-local-latest", contractVersion: "1.0.0", currentIdentity: second.identity, previousIdentity: first.identity });
            const repeated = await (0, game_db_download_database_artifact_1.acquireDatabaseArtifact)({ descriptor: descriptor(), storeRoot: root, transport: fakeTransport(Buffer.from("identity-two")) });
            (0, assert_1.equal)(repeated.reused, true);
            (0, assert_1.deepEqual)(latest(root), { schemaVersion: 1, contract: "dokkan-game-db-local-latest", contractVersion: "1.0.0", currentIdentity: second.identity, previousIdentity: first.identity });
        }
        finally {
            (0, fs_1.rmSync)(root, { recursive: true, force: true });
        }
    });
    it("rejects arbitrary, missing, cyclic and corrupt latest references without replacing the pointer", async () => {
        const variants = [
            { name: "arbitrary previous", mutate(root, _first, second) { const pointer = latest(root); pointer.previousIdentity = "a".repeat(64); (0, fs_1.writeFileSync)((0, path_1.join)(root, "latest.json"), `${JSON.stringify(pointer, null, 2)}\n`); } },
            { name: "missing current artifact", mutate(root, _first, second) { (0, fs_1.rmSync)((0, path_1.join)(root, "artifacts", second.identity), { recursive: true, force: true }); } },
            { name: "cycle", mutate(root, _first, second) { const pointer = latest(root); pointer.previousIdentity = second.identity; (0, fs_1.writeFileSync)((0, path_1.join)(root, "latest.json"), `${JSON.stringify(pointer, null, 2)}\n`); } },
            { name: "corrupt current metadata", mutate(root, _first, second) { (0, fs_1.writeFileSync)((0, path_1.join)(root, "artifacts", second.identity, "metadata.json"), "{}\n"); } },
            { name: "corrupt previous marker", mutate(root, first) { (0, fs_1.writeFileSync)((0, path_1.join)(root, "artifacts", first.identity, "commit-marker.json"), "{}\n"); } },
        ];
        for (const variant of variants) {
            const root = temp();
            try {
                const first = await (0, game_db_download_database_artifact_1.acquireDatabaseArtifact)({ descriptor: descriptor(), storeRoot: root, transport: fakeTransport(Buffer.from(`first-${variant.name}`)) });
                const second = await (0, game_db_download_database_artifact_1.acquireDatabaseArtifact)({ descriptor: descriptor(), storeRoot: root, transport: fakeTransport(Buffer.from(`second-${variant.name}`)) });
                variant.mutate(root, first, second);
                const pointerBefore = (0, fs_1.readFileSync)((0, path_1.join)(root, "latest.json"), "utf8");
                await (0, assert_1.rejects)((0, game_db_download_database_artifact_1.acquireDatabaseArtifact)({ descriptor: descriptor(), storeRoot: root, transport: fakeTransport(Buffer.from(`third-${variant.name}`)) }), /latest|artifact|metadata|marker|identity|cyclic/i, variant.name);
                (0, assert_1.equal)((0, fs_1.readFileSync)((0, path_1.join)(root, "latest.json"), "utf8"), pointerBefore, variant.name);
            }
            finally {
                (0, fs_1.rmSync)(root, { recursive: true, force: true });
            }
        }
    });
    it("enforces an explicit single-writer lock", async () => {
        const root = temp();
        try {
            await (0, promises_1.mkdir)((0, path_1.join)(root, ".acquisition.lock"));
            await (0, assert_1.rejects)((0, game_db_download_database_artifact_1.acquireDatabaseArtifact)({ descriptor: descriptor(), storeRoot: root, transport: fakeTransport(Buffer.from("x")) }), /active writer/);
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