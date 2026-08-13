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
            calls.count += 1; return { statusCode: overrides.statusCode ?? 200, headers: { "content-length": overrides.contentLength ?? String(bytes.length) }, body: overrides.body ?? stream_1.Readable.from([bytes]) }; } };
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
        for (const statusCode of [301, 404]) {
            const root = temp();
            try {
                await (0, assert_1.rejects)((0, game_db_download_database_artifact_1.acquireDatabaseArtifact)({ descriptor: descriptor(), storeRoot: root, transport: fakeTransport(Buffer.from("x"), { statusCode }) }), /redirect|successful/);
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
            try {
                (0, fs_1.symlinkSync)(outside, linkedRoot, "junction");
            }
            catch (error) {
                if (error?.code === "EPERM") {
                    this.skip();
                    return;
                }
                throw error;
            }
            await (0, assert_1.rejects)((0, game_db_download_database_artifact_1.acquireDatabaseArtifact)({ descriptor: descriptor(), storeRoot: linkedRoot, transport: fakeTransport(Buffer.from("x")) }), /symlink|junction/);
        }
        finally {
            (0, fs_1.rmSync)(root, { recursive: true, force: true });
        }
    });
    it("rejects a junction substituted for artifacts and never writes outside the validated root", async function () {
        const base = temp(), store = (0, path_1.join)(base, "store"), outside = (0, path_1.join)(base, "outside");
        await (0, promises_1.mkdir)(store);
        await (0, promises_1.mkdir)(outside);
        try {
            const artifacts = (0, path_1.join)(store, "artifacts");
            try {
                (0, fs_1.symlinkSync)(outside, artifacts, "junction");
            }
            catch (error) {
                if (error?.code === "EPERM") {
                    this.skip();
                    return;
                }
                throw error;
            }
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
                    if (error?.code === "EPERM")
                        return false;
                    throw error;
                }
                swapped = true;
            }
            return false;
        });
        try {
            await (0, assert_1.rejects)((0, game_db_download_database_artifact_1.acquireDatabaseArtifact)({ descriptor: descriptor(), storeRoot: store, transport: fakeTransport(Buffer.from("root-swap")), signal }), /identity changed|controlled directory/i);
            if (!swapped) {
                this.skip();
                return;
            }
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
                    if (error?.code === "EPERM")
                        return false;
                    throw error;
                }
                swapped = true;
            }
            return false;
        });
        try {
            await (0, assert_1.rejects)((0, game_db_download_database_artifact_1.acquireDatabaseArtifact)({ descriptor: descriptor(), storeRoot: store, transport: fakeTransport(Buffer.from("artifacts-swap")), signal }), /identity changed|controlled directory/i);
            if (!swapped) {
                this.skip();
                return;
            }
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