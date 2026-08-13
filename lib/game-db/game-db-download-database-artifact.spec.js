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
        (0, assert_1.equal)((0, game_db_download_database_artifact_1.parseDownloadDatabaseArtifactArgs)(["--artifact-path=database.db"]).artifactPath, (0, path_1.resolve)("database.db"));
        (0, assert_1.throws)(() => (0, game_db_download_database_artifact_1.parseDownloadDatabaseArtifactArgs)([]), /exactly one/);
        (0, assert_1.throws)(() => (0, game_db_download_database_artifact_1.parseDownloadDatabaseArtifactArgs)(["--descriptor-json", "a", "--artifact-path", "b"]), /exactly one/);
        (0, assert_1.throws)(() => (0, game_db_download_database_artifact_1.parseDownloadDatabaseArtifactArgs)(["--database-url", "https://example.test"]), /disabled/);
        (0, assert_1.throws)(() => (0, game_db_download_database_artifact_1.parseDownloadDatabaseArtifactArgs)(["--artifact-path", "a", "--authorize-download"]), /requires/);
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
    it("classifies readable SQLite and encrypted or packaged bytes offline", async () => {
        const root = temp();
        try {
            const sqlite = (0, path_1.join)(root, "readable.bin"), encrypted = (0, path_1.join)(root, "encrypted.bin");
            (0, fs_1.writeFileSync)(sqlite, Buffer.concat([Buffer.from("SQLite format 3\0"), Buffer.alloc(8)]));
            (0, fs_1.writeFileSync)(encrypted, Buffer.from("encrypted-or-packaged"));
            (0, assert_1.equal)((await (0, game_db_download_database_artifact_1.inspectDownloadedDatabaseArtifact)(sqlite)).artifactState, "readable_sqlite");
            (0, assert_1.equal)((await (0, game_db_download_database_artifact_1.inspectDownloadedDatabaseArtifact)(encrypted)).artifactState, "encrypted_or_packaged");
        }
        finally {
            (0, fs_1.rmSync)(root, { recursive: true, force: true });
        }
    });
    it("blocks redirects and non-success responses", async () => {
        for (const statusCode of [301, 404]) {
            const root = temp();
            try {
                await (0, assert_1.rejects)((0, game_db_download_database_artifact_1.acquireDatabaseArtifact)({ descriptor: (0, game_db_download_database_artifact_1.validateClientAssetsDatabaseDescriptor)(descriptor()), storeRoot: root, transport: fakeTransport(Buffer.from("x"), { statusCode }) }), /redirect|successful/);
            }
            finally {
                (0, fs_1.rmSync)(root, { recursive: true, force: true });
            }
        }
    });
    it("rejects excessive Content-Length and streams above the hard limit", async () => {
        const root = temp();
        try {
            const validated = (0, game_db_download_database_artifact_1.validateClientAssetsDatabaseDescriptor)(descriptor());
            await (0, assert_1.rejects)((0, game_db_download_database_artifact_1.acquireDatabaseArtifact)({ descriptor: validated, storeRoot: root, transport: fakeTransport(Buffer.from("x"), { contentLength: "11" }), maxBytes: 10 }), /Content-Length/);
            await (0, assert_1.rejects)((0, game_db_download_database_artifact_1.acquireDatabaseArtifact)({ descriptor: validated, storeRoot: root, transport: fakeTransport(Buffer.from("123456"), { contentLength: "5" }), maxBytes: 5 }), /exceeds/);
        }
        finally {
            (0, fs_1.rmSync)(root, { recursive: true, force: true });
        }
    });
    it("rejects truncation and size divergence", async () => {
        const root = temp();
        try {
            await (0, assert_1.rejects)((0, game_db_download_database_artifact_1.acquireDatabaseArtifact)({ descriptor: (0, game_db_download_database_artifact_1.validateClientAssetsDatabaseDescriptor)(descriptor()), storeRoot: root, transport: fakeTransport(Buffer.from("123"), { contentLength: "4" }) }), /truncated|size-divergent/);
        }
        finally {
            (0, fs_1.rmSync)(root, { recursive: true, force: true });
        }
    });
    it("times out a transport that never resolves", async () => {
        const root = temp();
        const transport = { get: async () => new Promise(() => undefined) };
        try {
            await (0, assert_1.rejects)((0, game_db_download_database_artifact_1.acquireDatabaseArtifact)({ descriptor: (0, game_db_download_database_artifact_1.validateClientAssetsDatabaseDescriptor)(descriptor()), storeRoot: root, transport, timeoutMs: 20 }), /timed out/);
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
            await (0, assert_1.rejects)((0, game_db_download_database_artifact_1.acquireDatabaseArtifact)({ descriptor: (0, game_db_download_database_artifact_1.validateClientAssetsDatabaseDescriptor)(descriptor()), storeRoot: root, transport: fakeTransport(Buffer.from("x")), signal: controller.signal }), /cancelled/);
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
            await (0, assert_1.rejects)((0, game_db_download_database_artifact_1.acquireDatabaseArtifact)({ descriptor: (0, game_db_download_database_artifact_1.validateClientAssetsDatabaseDescriptor)(descriptor()), storeRoot: root, transport: fakeTransport(Buffer.alloc(0), { contentLength: "1", body: stalled }), signal: controller.signal }), /cancelled/);
            (0, assert_1.equal)((0, fs_1.readdirSync)(root).some(name => name.startsWith(".download-") || name.startsWith(".pending-")), false);
        }
        finally {
            (0, fs_1.rmSync)(root, { recursive: true, force: true });
        }
    });
    it("commits immutable content marker-last and emits portable deterministic metadata", async () => {
        const root = temp();
        const bytes = Buffer.concat([Buffer.from("SQLite format 3\0"), Buffer.alloc(64, 7)]);
        try {
            const input = { descriptor: (0, game_db_download_database_artifact_1.validateClientAssetsDatabaseDescriptor)(descriptor()), storeRoot: root, transport: fakeTransport(bytes) };
            const first = await (0, game_db_download_database_artifact_1.acquireDatabaseArtifact)(input);
            const firstMetadata = (0, fs_1.readFileSync)(first.metadataPath, "utf8");
            const second = await (0, game_db_download_database_artifact_1.acquireDatabaseArtifact)(input);
            (0, assert_1.equal)(second.reused, true);
            (0, assert_1.equal)(second.identity, first.identity);
            (0, assert_1.equal)((0, fs_1.readFileSync)(second.metadataPath, "utf8"), firstMetadata);
            const text = `${firstMetadata}\n${(0, fs_1.readFileSync)(first.commitMarkerPath, "utf8")}`;
            (0, assert_1.equal)(text.includes(OFFICIAL_SECRET), false);
            (0, assert_1.equal)(text.includes(root), false);
            (0, assert_1.equal)(text.includes("https://"), false);
            (0, assert_1.equal)(text.includes("url"), false);
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
            const result = await (0, game_db_download_database_artifact_1.acquireDatabaseArtifact)({ descriptor: (0, game_db_download_database_artifact_1.validateClientAssetsDatabaseDescriptor)(descriptor()), storeRoot: root, transport });
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
            const validated = (0, game_db_download_database_artifact_1.validateClientAssetsDatabaseDescriptor)(descriptor());
            const first = await (0, game_db_download_database_artifact_1.acquireDatabaseArtifact)({ descriptor: validated, storeRoot: root, transport: fakeTransport(Buffer.from("first-valid-bytes")) });
            const latestBefore = await (0, promises_1.readFile)(first.latestPointerPath, "utf8");
            await (0, assert_1.rejects)((0, game_db_download_database_artifact_1.acquireDatabaseArtifact)({ descriptor: validated, storeRoot: root, transport: fakeTransport(Buffer.from("bad"), { contentLength: "4" }) }), /truncated/);
            (0, assert_1.equal)(await (0, promises_1.readFile)(first.latestPointerPath, "utf8"), latestBefore);
            (0, assert_1.equal)((0, fs_1.readFileSync)(first.artifactPath).toString(), "first-valid-bytes");
            (0, assert_1.equal)((0, fs_1.readdirSync)(root).some(name => name.startsWith(".download-") || name.startsWith(".pending-")), false);
        }
        finally {
            (0, fs_1.rmSync)(root, { recursive: true, force: true });
        }
    });
    it("enforces an explicit single-writer lock", async () => {
        const root = temp();
        try {
            await (0, promises_1.mkdir)((0, path_1.join)(root, ".acquisition.lock"));
            await (0, assert_1.rejects)((0, game_db_download_database_artifact_1.acquireDatabaseArtifact)({ descriptor: (0, game_db_download_database_artifact_1.validateClientAssetsDatabaseDescriptor)(descriptor()), storeRoot: root, transport: fakeTransport(Buffer.from("x")) }), /active writer/);
        }
        finally {
            (0, fs_1.rmSync)(root, { recursive: true, force: true });
        }
    });
    it("rejects descriptor symlinks and external store junctions when supported", async function () {
        const root = temp();
        try {
            const realDescriptor = (0, path_1.join)(root, "real.json"), linkedDescriptor = (0, path_1.join)(root, "linked.json");
            (0, fs_1.writeFileSync)(realDescriptor, JSON.stringify(descriptor()));
            try {
                (0, fs_1.symlinkSync)(realDescriptor, linkedDescriptor, "file");
            }
            catch {
                this.skip();
                return;
            }
            await (0, assert_1.rejects)((0, game_db_download_database_artifact_1.readAndValidateDatabaseDescriptor)(linkedDescriptor), /symlink|junction/);
            const outside = (0, path_1.join)(root, "outside"), linkedRoot = (0, path_1.join)(root, "linked-root");
            await (0, promises_1.mkdir)(outside);
            try {
                (0, fs_1.symlinkSync)(outside, linkedRoot, "junction");
            }
            catch {
                this.skip();
                return;
            }
            await (0, assert_1.rejects)((0, game_db_download_database_artifact_1.acquireDatabaseArtifact)({ descriptor: (0, game_db_download_database_artifact_1.validateClientAssetsDatabaseDescriptor)(descriptor()), storeRoot: linkedRoot, transport: fakeTransport(Buffer.from("x")) }), /symlink|junction/);
        }
        finally {
            (0, fs_1.rmSync)(root, { recursive: true, force: true });
        }
    });
});
const OFFICIAL_SECRET = "cf.ishin-global.aktsk.com";
//# sourceMappingURL=game-db-download-database-artifact.spec.js.map