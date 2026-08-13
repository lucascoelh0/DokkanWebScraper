import { deepEqual, equal, match, rejects, throws } from "assert";
import { mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from "fs";
import { mkdir, readFile } from "fs/promises";
import { tmpdir } from "os";
import { join, resolve } from "path";
import { Readable } from "stream";
import {
    acquireDatabaseArtifact,
    DatabaseArtifactTransport,
    parseDownloadDatabaseArtifactArgs,
    readAndValidateDatabaseDescriptor,
    runDownloadDatabaseArtifact,
    validateClientAssetsDatabaseDescriptor,
} from "./game-db-download-database-artifact";

const version = Math.floor(Date.UTC(2026, 7, 12, 8, 16, 57) / 1000);
function descriptor(overrides: Record<string, unknown> = {}): any {
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
function fakeTransport(bytes: Buffer, overrides: Partial<{ statusCode: number, contentLength: string, body: Readable }> = {}, calls?: { count: number }): DatabaseArtifactTransport {
    return { async get() { if (calls) calls.count += 1; return { statusCode: overrides.statusCode ?? 200, headers: { "content-length": overrides.contentLength ?? String(bytes.length) }, body: overrides.body ?? Readable.from([bytes]) }; } };
}
function temp(): string { return mkdtempSync(join(tmpdir(), "dokkan-aq-")); }

describe("game DB manual database artifact acquisition", function () {
    this.timeout(10_000);

    it("accepts the strict synthetic Global EN descriptor and freezes it", () => {
        const source = descriptor();
        const value = validateClientAssetsDatabaseDescriptor(source);
        equal(value.databaseVersion, version);
        equal(value.deliveryTimestamp, "20260812-081657");
        equal(Object.isFrozen(value), true);
        source.url = "https://evil.invalid/database.db";
        equal(value.url.includes("evil"), false);
    });

    it("rejects malformed JSON and non-object JSON", async () => {
        const root = temp();
        try {
            writeFileSync(join(root, "bad.json"), "{");
            await rejects(readAndValidateDatabaseDescriptor(join(root, "bad.json")), /malformed/);
            writeFileSync(join(root, "array.json"), "[]");
            await rejects(readAndValidateDatabaseDescriptor(join(root, "array.json")), /object/);
        } finally { rmSync(root, { recursive: true, force: true }); }
    });

    it("rejects missing, extra and incorrectly typed fields", () => {
        const missing = descriptor(); delete missing.patch_hash;
        throws(() => validateClientAssetsDatabaseDescriptor(missing), /fields/);
        throws(() => validateClientAssetsDatabaseDescriptor(descriptor({ extra: true })), /fields/);
        throws(() => validateClientAssetsDatabaseDescriptor(descriptor({ file_path: 1 })), /file_path/);
        throws(() => validateClientAssetsDatabaseDescriptor(descriptor({ url: 1 })), /URL/);
    });

    it("rejects invalid versions, algorithms, hashes and patches", () => {
        for (const invalid of [0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1]) throws(() => validateClientAssetsDatabaseDescriptor(descriptor({ version: invalid })), /version/);
        throws(() => validateClientAssetsDatabaseDescriptor(descriptor({ algorithm: "xxhash" })), /algorithm/);
        throws(() => validateClientAssetsDatabaseDescriptor(descriptor({ hash: "0" })), /hash/);
        throws(() => validateClientAssetsDatabaseDescriptor(descriptor({ hash: version })), /hash/);
        throws(() => validateClientAssetsDatabaseDescriptor(descriptor({ patch: {} })), /patch/);
        throws(() => validateClientAssetsDatabaseDescriptor(descriptor({ patch_hash: "x" })), /patch/);
    });

    it("rejects HTTP, similar hosts, malicious subdomains and ports", () => {
        const urls = [
            descriptor().url.replace("https:", "http:"),
            descriptor().url.replace("cf.ishin-global.aktsk.com", "cf.ishin-global.aktsk.com.evil.test"),
            descriptor().url.replace("cf.ishin-global.aktsk.com", "evilcf.ishin-global.aktsk.com"),
            descriptor().url.replace(".com/", ".com:444/"),
        ];
        for (const url of urls) throws(() => validateClientAssetsDatabaseDescriptor(descriptor({ url })), /HTTPS|host|port/);
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
        for (const url of urls) throws(() => validateClientAssetsDatabaseDescriptor(descriptor({ url })), /credentials|fragment|query|path/);
    });

    it("rejects logical traversal and Windows path forms", () => {
        for (const file_path of ["../database.db", "sqlite/current/en/../database.db", "C:\\database.db", "C:database.db", "\\\\server\\share\\database.db", "\\\\?\\C:\\database.db", "sqlite/current\\en/database.db"]) {
            throws(() => validateClientAssetsDatabaseDescriptor(descriptor({ file_path })), /file_path/);
        }
    });

    it("parses only descriptor or artifact modes and disables the legacy URL", () => {
        const parsed = parseDownloadDatabaseArtifactArgs(["--descriptor-json", "descriptor.json", "--dry-run"]);
        equal(parsed.descriptorJson, resolve("descriptor.json")); equal(parsed.dryRun, true);
        const artifact = parseDownloadDatabaseArtifactArgs(["--artifact-path=database.db", "--descriptor-json=descriptor.json"]);
        equal(artifact.artifactPath, resolve("database.db")); equal(artifact.descriptorJson, resolve("descriptor.json"));
        throws(() => parseDownloadDatabaseArtifactArgs([]), /descriptor lineage/);
        throws(() => parseDownloadDatabaseArtifactArgs(["--artifact-path", "a"]), /descriptor lineage/);
        throws(() => parseDownloadDatabaseArtifactArgs(["--database-url", "https://example.test"]), /disabled/);
        throws(() => parseDownloadDatabaseArtifactArgs(["--artifact-path", "a", "--descriptor-json", "b", "--authorize-download"]), /cannot be combined/);
    });

    it("proves import-style validation and dry-run make no transport request", async () => {
        const root = temp(); const calls = { count: 0 };
        try {
            const path = join(root, "descriptor.json"); writeFileSync(path, JSON.stringify(descriptor()));
            const result = await runDownloadDatabaseArtifact({ descriptorJson: path, storeRoot: join(root, "store"), authorizeDownload: false, dryRun: true }, { transport: fakeTransport(Buffer.from("never"), {}, calls) });
            equal(result.mode, "descriptor_validation"); equal(calls.count, 0); equal(JSON.stringify(result).includes("https://"), false);
        } finally { rmSync(root, { recursive: true, force: true }); }
    });

    it("revalidates untrusted compiled-JavaScript payloads before any transport call", async () => {
        const root = temp(); const calls = { count: 0 };
        const transport = fakeTransport(Buffer.from("must-not-run"), {}, calls);
        const compiledApi: any = acquireDatabaseArtifact;
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
                await rejects(compiledApi({ descriptor: payload, storeRoot: join(root, "store"), transport }), /host|HTTPS|path|hash/);
            }
            equal(calls.count, 0);
        } finally { rmSync(root, { recursive: true, force: true }); }
    });

    it("validates an offline artifact only with validated descriptor lineage", async () => {
        const root = temp();
        try {
            const descriptorPath = join(root, "descriptor.json"), artifactPath = join(root, "database.db");
            writeFileSync(descriptorPath, JSON.stringify(descriptor()));
            writeFileSync(artifactPath, Buffer.from("encrypted-or-packaged"));
            const validatedAt = "2026-08-13T20:00:00.000Z";
            const result = await runDownloadDatabaseArtifact({ descriptorJson: descriptorPath, artifactPath, storeRoot: join(root, "store"), authorizeDownload: false, dryRun: false }, { now: () => new Date(validatedAt) });
            equal(result.mode, "artifact_validation");
            if (result.mode !== "artifact_validation") throw new Error("unexpected mode");
            equal(result.descriptor.databaseVersion, version);
            equal(result.descriptor.logicalFilePath, "sqlite/current/en/database.db");
            equal(result.inspection.artifactState, "encrypted_or_packaged");
            equal(result.receipt.mode, "offline_existing_artifact_validation");
            equal(result.receipt.result, "validated");
            if (result.receipt.mode !== "offline_existing_artifact_validation") throw new Error("unexpected receipt mode");
            equal(result.receipt.validatedAt, validatedAt);
            equal(result.receipt.artifactIdentity, result.identity);
            equal(readFileSync(result.receiptPath, "utf8"), `${JSON.stringify(result.receipt, null, 2)}\n`);
            writeFileSync(descriptorPath, JSON.stringify(descriptor({ url: "https://evil.invalid/database.db" })));
            await rejects(runDownloadDatabaseArtifact({ descriptorJson: descriptorPath, artifactPath, storeRoot: join(root, "store"), authorizeDownload: false, dryRun: false }), /host/);
        } finally { rmSync(root, { recursive: true, force: true }); }
    });

    it("classifies readable SQLite and encrypted or packaged bytes offline", async () => {
        const root = temp();
        try {
            const descriptorPath = join(root, "descriptor.json"), sqlite = join(root, "readable.bin"), encrypted = join(root, "encrypted.bin");
            writeFileSync(descriptorPath, JSON.stringify(descriptor()));
            writeFileSync(sqlite, Buffer.concat([Buffer.from("SQLite format 3\0"), Buffer.alloc(8)]));
            writeFileSync(encrypted, Buffer.from("encrypted-or-packaged"));
            const readable = await runDownloadDatabaseArtifact({ descriptorJson: descriptorPath, artifactPath: sqlite, storeRoot: join(root, "store"), authorizeDownload: false, dryRun: false });
            const packaged = await runDownloadDatabaseArtifact({ descriptorJson: descriptorPath, artifactPath: encrypted, storeRoot: join(root, "store"), authorizeDownload: false, dryRun: false });
            if (readable.mode !== "artifact_validation" || packaged.mode !== "artifact_validation") throw new Error("unexpected mode");
            equal(readable.inspection.artifactState, "readable_sqlite");
            equal(packaged.inspection.artifactState, "encrypted_or_packaged");
        } finally { rmSync(root, { recursive: true, force: true }); }
    });

    it("blocks redirects and non-success responses", async () => {
        for (const statusCode of [301, 404]) {
            const root = temp();
            try { await rejects(acquireDatabaseArtifact({ descriptor: descriptor(), storeRoot: root, transport: fakeTransport(Buffer.from("x"), { statusCode }) }), /redirect|successful/); }
            finally { rmSync(root, { recursive: true, force: true }); }
        }
    });

    it("rejects excessive Content-Length and streams above the hard limit", async () => {
        const root = temp();
        try {
            const raw = descriptor();
            await rejects(acquireDatabaseArtifact({ descriptor: raw, storeRoot: root, transport: fakeTransport(Buffer.from("x"), { contentLength: "11" }), maxBytes: 10 }), /Content-Length/);
            await rejects(acquireDatabaseArtifact({ descriptor: raw, storeRoot: root, transport: fakeTransport(Buffer.from("123456"), { contentLength: "5" }), maxBytes: 5 }), /exceeds/);
        } finally { rmSync(root, { recursive: true, force: true }); }
    });

    it("rejects truncation and size divergence", async () => {
        const root = temp();
        try { await rejects(acquireDatabaseArtifact({ descriptor: descriptor(), storeRoot: root, transport: fakeTransport(Buffer.from("123"), { contentLength: "4" }) }), /truncated|size-divergent/); }
        finally { rmSync(root, { recursive: true, force: true }); }
    });

    it("times out a transport that never resolves", async () => {
        const root = temp();
        const transport: DatabaseArtifactTransport = { get: async () => new Promise(() => undefined) };
        try { await rejects(acquireDatabaseArtifact({ descriptor: descriptor(), storeRoot: root, transport, timeoutMs: 20 }), /timed out/); }
        finally { rmSync(root, { recursive: true, force: true }); }
    });

    it("honors cancellation and removes temporary state", async () => {
        const root = temp(); const controller = new AbortController(); controller.abort();
        try {
            await rejects(acquireDatabaseArtifact({ descriptor: descriptor(), storeRoot: root, transport: fakeTransport(Buffer.from("x")), signal: controller.signal }), /cancelled/);
            equal(readdirSync(root).some(name => name.startsWith(".download-") || name.startsWith(".pending-")), false);
        } finally { rmSync(root, { recursive: true, force: true }); }
    });

    it("cancels a stalled response stream", async () => {
        const root = temp(); const controller = new AbortController();
        const stalled = new Readable({ read() { /* intentionally stalled */ } });
        setTimeout(() => controller.abort(), 10);
        try {
            await rejects(acquireDatabaseArtifact({ descriptor: descriptor(), storeRoot: root, transport: fakeTransport(Buffer.alloc(0), { contentLength: "1", body: stalled }), signal: controller.signal }), /cancelled/);
            equal(readdirSync(root).some(name => name.startsWith(".download-") || name.startsWith(".pending-")), false);
        } finally { rmSync(root, { recursive: true, force: true }); }
    });

    it("commits immutable content marker-last and emits portable deterministic metadata", async () => {
        const root = temp(); const bytes = Buffer.concat([Buffer.from("SQLite format 3\0"), Buffer.alloc(64, 7)]);
        try {
            const first = await acquireDatabaseArtifact({ descriptor: descriptor(), storeRoot: root, transport: fakeTransport(bytes), now: () => new Date("2026-08-13T20:00:00.000Z") });
            const firstMetadata = readFileSync(first.metadataPath, "utf8");
            const firstMarker = readFileSync(first.commitMarkerPath, "utf8");
            const second = await acquireDatabaseArtifact({ descriptor: descriptor(), storeRoot: root, transport: fakeTransport(bytes), now: () => new Date("2026-08-13T21:00:00.000Z") });
            equal(second.reused, true); equal(second.identity, first.identity); equal(readFileSync(second.metadataPath, "utf8"), firstMetadata);
            equal(readFileSync(second.commitMarkerPath, "utf8"), firstMarker);
            equal(first.receipt.mode, "official_descriptor_download"); equal(first.receipt.result, "acquired");
            equal(second.receipt.mode, "official_descriptor_download"); equal(second.receipt.result, "reused");
            if (first.receipt.mode !== "official_descriptor_download" || second.receipt.mode !== "official_descriptor_download") throw new Error("unexpected receipt mode");
            equal(first.receipt.acquiredAt, "2026-08-13T20:00:00.000Z");
            equal(second.receipt.acquiredAt, "2026-08-13T21:00:00.000Z");
            equal(first.receipt.artifactIdentity, second.receipt.artifactIdentity);
            equal(first.receiptPath === second.receiptPath, false);
            const receiptText = `${readFileSync(first.receiptPath, "utf8")}\n${readFileSync(second.receiptPath, "utf8")}`;
            const text = `${firstMetadata}\n${firstMarker}`;
            equal(text.includes(OFFICIAL_SECRET), false);
            equal(text.includes(root), false); equal(text.includes("https://"), false); equal(text.includes("url"), false);
            equal(/acquiredAt|validatedAt/.test(text), false);
            equal(receiptText.includes(OFFICIAL_SECRET), false); equal(receiptText.includes(root), false); equal(receiptText.includes("https://"), false);
            equal(/query|headers|token|account|descriptorJson|artifactPath/i.test(receiptText), false);
            equal(first.metadata.artifactState, "readable_sqlite");
        } finally { rmSync(root, { recursive: true, force: true }); }
    });

    it("streams the observed-scale artifact without constructing a whole-file buffer", async () => {
        const root = temp();
        const size = 97_738_752;
        const chunk = Buffer.alloc(64 * 1024, 0x5a);
        function* chunks() {
            let remaining = size;
            while (remaining > 0) {
                const length = Math.min(remaining, chunk.byteLength);
                yield length === chunk.byteLength ? chunk : chunk.subarray(0, length);
                remaining -= length;
            }
        }
        const transport: DatabaseArtifactTransport = { async get() { return { statusCode: 200, headers: { "content-length": String(size) }, body: Readable.from(chunks()) }; } };
        try {
            const result = await acquireDatabaseArtifact({ descriptor: descriptor(), storeRoot: root, transport });
            equal(result.metadata.observedSizeBytes, size);
            equal(result.metadata.artifactState, "encrypted_or_packaged");
        } finally { rmSync(root, { recursive: true, force: true }); }
    });

    it("preserves the previous artifact and latest pointer when a later acquisition fails", async () => {
        const root = temp();
        try {
            const raw = descriptor();
            const first = await acquireDatabaseArtifact({ descriptor: raw, storeRoot: root, transport: fakeTransport(Buffer.from("first-valid-bytes")) });
            const latestBefore = await readFile(first.latestPointerPath, "utf8");
            await rejects(acquireDatabaseArtifact({ descriptor: raw, storeRoot: root, transport: fakeTransport(Buffer.from("bad"), { contentLength: "4" }) }), /truncated/);
            equal(await readFile(first.latestPointerPath, "utf8"), latestBefore);
            equal(readFileSync(first.artifactPath).toString(), "first-valid-bytes");
            equal(readdirSync(root).some(name => name.startsWith(".download-") || name.startsWith(".pending-")), false);
        } finally { rmSync(root, { recursive: true, force: true }); }
    });

    it("does not promote latest when the operational receipt cannot be committed", async () => {
        const root = temp();
        try {
            const raw = descriptor();
            const first = await acquireDatabaseArtifact({ descriptor: raw, storeRoot: root, transport: fakeTransport(Buffer.from("first-valid-bytes")), now: () => new Date("2026-08-13T20:00:00.000Z") });
            const latestBefore = await readFile(first.latestPointerPath, "utf8");
            rmSync(join(root, "receipts"), { recursive: true, force: true });
            writeFileSync(join(root, "receipts"), "blocks receipt directory");
            await rejects(acquireDatabaseArtifact({ descriptor: raw, storeRoot: root, transport: fakeTransport(Buffer.from("second-valid-bytes")), now: () => new Date("2026-08-13T21:00:00.000Z") }), /EEXIST|directory|store root/i);
            equal(await readFile(first.latestPointerPath, "utf8"), latestBefore);
        } finally { rmSync(root, { recursive: true, force: true }); }
    });

    it("enforces an explicit single-writer lock", async () => {
        const root = temp();
        try {
            await mkdir(join(root, ".acquisition.lock"));
            await rejects(acquireDatabaseArtifact({ descriptor: descriptor(), storeRoot: root, transport: fakeTransport(Buffer.from("x")) }), /active writer/);
        } finally { rmSync(root, { recursive: true, force: true }); }
    });

    it("rejects descriptor symlinks and external store junctions when supported", async function () {
        const root = temp();
        try {
            const realDescriptor = join(root, "real.json"), linkedDescriptor = join(root, "linked.json");
            writeFileSync(realDescriptor, JSON.stringify(descriptor()));
            try { symlinkSync(realDescriptor, linkedDescriptor, "file"); }
            catch { this.skip(); return; }
            await rejects(readAndValidateDatabaseDescriptor(linkedDescriptor), /symlink|junction/);
            const outside = join(root, "outside"), linkedRoot = join(root, "linked-root"); await mkdir(outside);
            try { symlinkSync(outside, linkedRoot, "junction"); }
            catch { this.skip(); return; }
            await rejects(acquireDatabaseArtifact({ descriptor: descriptor(), storeRoot: linkedRoot, transport: fakeTransport(Buffer.from("x")) }), /symlink|junction/);
        } finally { rmSync(root, { recursive: true, force: true }); }
    });
});

const OFFICIAL_SECRET = "cf.ishin-global.aktsk.com";
