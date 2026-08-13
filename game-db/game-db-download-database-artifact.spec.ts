import { deepEqual, equal, match, rejects, throws } from "assert";
import { existsSync, mkdtempSync, readFileSync, readdirSync, renameSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from "fs";
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
function latest(root: string): any { return JSON.parse(readFileSync(join(root, "latest.json"), "utf8")); }
function boundarySignal(predicate: () => boolean): AbortSignal {
    const controller = new AbortController();
    return new Proxy(controller.signal, {
        get(target, property) {
            if (property === "aborted" && !target.aborted && predicate()) controller.abort();
            const value = Reflect.get(target, property, target);
            return typeof value === "function" ? value.bind(target) : value;
        },
    });
}

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
        const year10000 = Math.floor(Date.UTC(10000, 0, 1, 0, 0, 0) / 1000);
        throws(() => validateClientAssetsDatabaseDescriptor(descriptor({
            version: year10000,
            hash: String(year10000),
            url: "https://cf.ishin-global.aktsk.com/sqlite/current/en/100000101-000000/database.db",
        })), /four digits/);
    });

    it("rejects year 10000 before transport", async () => {
        const root = temp(), calls = { count: 0 };
        const year10000 = Math.floor(Date.UTC(10000, 0, 1, 0, 0, 0) / 1000);
        try {
            await rejects(acquireDatabaseArtifact({
                descriptor: descriptor({ version: year10000, hash: String(year10000), url: "https://cf.ishin-global.aktsk.com/sqlite/current/en/100000101-000000/database.db" }),
                storeRoot: root,
                transport: fakeTransport(Buffer.from("never"), {}, calls),
            }), /four digits/);
            equal(calls.count, 0);
        } finally { rmSync(root, { recursive: true, force: true }); }
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

    it("fails closed on cancellation immediately after streaming", async () => {
        const root = temp(), firstBytes = Buffer.from("first-valid-bytes"), nextBytes = Buffer.from("second-valid-bytes");
        try {
            const first = await acquireDatabaseArtifact({ descriptor: descriptor(), storeRoot: root, transport: fakeTransport(firstBytes) });
            const pointerBefore = readFileSync(first.latestPointerPath, "utf8");
            const signal = boundarySignal(() => readdirSync(root).some(name => name.startsWith(".download-") && readFileSync(join(root, name)).byteLength === nextBytes.byteLength));
            await rejects(acquireDatabaseArtifact({ descriptor: descriptor(), storeRoot: root, transport: fakeTransport(nextBytes), signal }), /cancelled/);
            equal(readFileSync(first.latestPointerPath, "utf8"), pointerBefore);
            equal(readdirSync(root).some(name => name.startsWith(".download-") || name.startsWith(".pending-")), false);
        } finally { rmSync(root, { recursive: true, force: true }); }
    });

    it("fails closed after artifact promotion and permits the validated orphan to remain", async () => {
        const root = temp(), firstBytes = Buffer.from("first-valid-bytes"), nextBytes = Buffer.from("second-valid-artifact");
        try {
            const first = await acquireDatabaseArtifact({ descriptor: descriptor(), storeRoot: root, transport: fakeTransport(firstBytes) });
            const pointerBefore = readFileSync(first.latestPointerPath, "utf8");
            const signal = boundarySignal(() => {
                const artifacts = join(root, "artifacts");
                return existsSync(artifacts) && readdirSync(artifacts).some(name => /^[a-f0-9]{64}$/.test(name) && name !== first.identity && existsSync(join(artifacts, name, "commit-marker.json")));
            });
            await rejects(acquireDatabaseArtifact({ descriptor: descriptor(), storeRoot: root, transport: fakeTransport(nextBytes), signal }), /cancelled/);
            equal(readFileSync(first.latestPointerPath, "utf8"), pointerBefore);
            const orphans = readdirSync(join(root, "artifacts")).filter(name => /^[a-f0-9]{64}$/.test(name) && name !== first.identity);
            equal(orphans.length, 1);
            equal(existsSync(join(root, "artifacts", orphans[0], "commit-marker.json")), true);
        } finally { rmSync(root, { recursive: true, force: true }); }
    });

    it("fails closed after receipt without promoting latest", async () => {
        const root = temp(), firstBytes = Buffer.from("first-valid-bytes"), nextBytes = Buffer.from("third-valid-artifact");
        try {
            const first = await acquireDatabaseArtifact({ descriptor: descriptor(), storeRoot: root, transport: fakeTransport(firstBytes), now: () => new Date("2026-08-13T20:00:00.000Z") });
            const pointerBefore = readFileSync(first.latestPointerPath, "utf8");
            const receiptsBefore = readdirSync(join(root, "receipts")).length;
            const signal = boundarySignal(() => existsSync(join(root, "receipts")) && readdirSync(join(root, "receipts")).filter(name => !name.startsWith(".")).length > receiptsBefore);
            await rejects(acquireDatabaseArtifact({ descriptor: descriptor(), storeRoot: root, transport: fakeTransport(nextBytes), signal, now: () => new Date("2026-08-13T21:00:00.000Z") }), /cancelled/);
            equal(readFileSync(first.latestPointerPath, "utf8"), pointerBefore);
            equal(readdirSync(join(root, "receipts")).filter(name => !name.startsWith(".")).length, receiptsBefore + 1);
        } finally { rmSync(root, { recursive: true, force: true }); }
    });

    it("rolls latest back if cancellation is observed immediately after promotion", async () => {
        const root = temp(), firstBytes = Buffer.from("first-valid-bytes"), nextBytes = Buffer.from("fourth-valid-artifact");
        try {
            const first = await acquireDatabaseArtifact({ descriptor: descriptor(), storeRoot: root, transport: fakeTransport(firstBytes) });
            const pointerBefore = readFileSync(first.latestPointerPath, "utf8");
            const signal = boundarySignal(() => existsSync(join(root, "latest.json")) && readFileSync(join(root, "latest.json"), "utf8") !== pointerBefore);
            await rejects(acquireDatabaseArtifact({ descriptor: descriptor(), storeRoot: root, transport: fakeTransport(nextBytes), signal }), /cancelled/);
            equal(readFileSync(first.latestPointerPath, "utf8"), pointerBefore);
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

    it("validates complete latest rollback chains for new and repeated identities", async () => {
        const root = temp();
        try {
            const first = await acquireDatabaseArtifact({ descriptor: descriptor(), storeRoot: root, transport: fakeTransport(Buffer.from("identity-one")) });
            deepEqual(latest(root), { schemaVersion: 1, contract: "dokkan-game-db-local-latest", contractVersion: "1.0.0", currentIdentity: first.identity, previousIdentity: null });
            const second = await acquireDatabaseArtifact({ descriptor: descriptor(), storeRoot: root, transport: fakeTransport(Buffer.from("identity-two")) });
            deepEqual(latest(root), { schemaVersion: 1, contract: "dokkan-game-db-local-latest", contractVersion: "1.0.0", currentIdentity: second.identity, previousIdentity: first.identity });
            const repeated = await acquireDatabaseArtifact({ descriptor: descriptor(), storeRoot: root, transport: fakeTransport(Buffer.from("identity-two")) });
            equal(repeated.reused, true);
            deepEqual(latest(root), { schemaVersion: 1, contract: "dokkan-game-db-local-latest", contractVersion: "1.0.0", currentIdentity: second.identity, previousIdentity: first.identity });
        } finally { rmSync(root, { recursive: true, force: true }); }
    });

    it("rejects arbitrary, missing, cyclic and corrupt latest references without replacing the pointer", async () => {
        const variants: Array<{ name: string, mutate(root: string, first: any, second: any): void }> = [
            { name: "arbitrary previous", mutate(root, _first, second) { const pointer = latest(root); pointer.previousIdentity = "a".repeat(64); writeFileSync(join(root, "latest.json"), `${JSON.stringify(pointer, null, 2)}\n`); } },
            { name: "missing current artifact", mutate(root, _first, second) { rmSync(join(root, "artifacts", second.identity), { recursive: true, force: true }); } },
            { name: "cycle", mutate(root, _first, second) { const pointer = latest(root); pointer.previousIdentity = second.identity; writeFileSync(join(root, "latest.json"), `${JSON.stringify(pointer, null, 2)}\n`); } },
            { name: "corrupt current metadata", mutate(root, _first, second) { writeFileSync(join(root, "artifacts", second.identity, "metadata.json"), "{}\n"); } },
            { name: "corrupt previous marker", mutate(root, first) { writeFileSync(join(root, "artifacts", first.identity, "commit-marker.json"), "{}\n"); } },
        ];
        for (const variant of variants) {
            const root = temp();
            try {
                const first = await acquireDatabaseArtifact({ descriptor: descriptor(), storeRoot: root, transport: fakeTransport(Buffer.from(`first-${variant.name}`)) });
                const second = await acquireDatabaseArtifact({ descriptor: descriptor(), storeRoot: root, transport: fakeTransport(Buffer.from(`second-${variant.name}`)) });
                variant.mutate(root, first, second);
                const pointerBefore = readFileSync(join(root, "latest.json"), "utf8");
                await rejects(acquireDatabaseArtifact({ descriptor: descriptor(), storeRoot: root, transport: fakeTransport(Buffer.from(`third-${variant.name}`)) }), /latest|artifact|metadata|marker|identity|cyclic/i, variant.name);
                equal(readFileSync(join(root, "latest.json"), "utf8"), pointerBefore, variant.name);
            } finally { rmSync(root, { recursive: true, force: true }); }
        }
    });

    it("enforces an explicit single-writer lock", async () => {
        const root = temp();
        try {
            await mkdir(join(root, ".acquisition.lock"));
            await rejects(acquireDatabaseArtifact({ descriptor: descriptor(), storeRoot: root, transport: fakeTransport(Buffer.from("x")) }), /active writer/);
        } finally { rmSync(root, { recursive: true, force: true }); }
    });

    it("rejects descriptor symlinks when supported", async function () {
        const root = temp();
        try {
            const realDescriptor = join(root, "real.json"), linkedDescriptor = join(root, "linked.json");
            writeFileSync(realDescriptor, JSON.stringify(descriptor()));
            try { symlinkSync(realDescriptor, linkedDescriptor, "file"); }
            catch (error: any) { if (error?.code === "EPERM") { this.skip(); return; } throw error; }
            await rejects(readAndValidateDatabaseDescriptor(linkedDescriptor), /symlink|junction/);
        } finally { rmSync(root, { recursive: true, force: true }); }
    });

    it("rejects a real external store-root junction on Windows and other supported hosts", async function () {
        const root = temp();
        try {
            const outside = join(root, "outside"), linkedRoot = join(root, "linked-root"); await mkdir(outside);
            try { symlinkSync(outside, linkedRoot, "junction"); }
            catch (error: any) { if (error?.code === "EPERM") { this.skip(); return; } throw error; }
            await rejects(acquireDatabaseArtifact({ descriptor: descriptor(), storeRoot: linkedRoot, transport: fakeTransport(Buffer.from("x")) }), /symlink|junction/);
        } finally { rmSync(root, { recursive: true, force: true }); }
    });

    it("rejects a junction substituted for artifacts and never writes outside the validated root", async function () {
        const base = temp(), store = join(base, "store"), outside = join(base, "outside");
        await mkdir(store); await mkdir(outside);
        try {
            const artifacts = join(store, "artifacts");
            try { symlinkSync(outside, artifacts, "junction"); }
            catch (error: any) { if (error?.code === "EPERM") { this.skip(); return; } throw error; }
            await rejects(acquireDatabaseArtifact({ descriptor: descriptor(), storeRoot: store, transport: fakeTransport(Buffer.from("x")) }), /symlink|junction|reparse/);
            deepEqual(readdirSync(outside), []);
        } finally { rmSync(base, { recursive: true, force: true }); }
    });

    it("detects concurrent root replacement and does not clean through the replacement junction", async function () {
        const base = temp(), store = join(base, "store"), displaced = join(base, "displaced"), outside = join(base, "outside");
        await mkdir(store); await mkdir(outside); writeFileSync(join(outside, "sentinel.txt"), "keep");
        let swapped = false;
        const signal = boundarySignal(() => {
            if (!swapped && existsSync(store) && readdirSync(store).some(name => name.startsWith(".download-"))) {
                renameSync(store, displaced);
                try { symlinkSync(outside, store, "junction"); }
                catch (error: any) { if (error?.code === "EPERM") return false; throw error; }
                swapped = true;
            }
            return false;
        });
        try {
            await rejects(acquireDatabaseArtifact({ descriptor: descriptor(), storeRoot: store, transport: fakeTransport(Buffer.from("root-swap")), signal }), /identity changed|controlled directory/i);
            if (!swapped) { this.skip(); return; }
            equal(readFileSync(join(outside, "sentinel.txt"), "utf8"), "keep");
            deepEqual(readdirSync(outside), ["sentinel.txt"]);
        } finally {
            if (swapped && existsSync(store)) unlinkSync(store);
            if (swapped && existsSync(displaced)) renameSync(displaced, store);
            rmSync(base, { recursive: true, force: true });
        }
    });

    it("detects concurrent artifacts replacement and does not write or clean through it", async function () {
        const base = temp(), store = join(base, "store"), outside = join(base, "outside"), displaced = join(store, "artifacts-displaced");
        await mkdir(store); await mkdir(outside); writeFileSync(join(outside, "sentinel.txt"), "keep");
        let swapped = false;
        const signal = boundarySignal(() => {
            const artifacts = join(store, "artifacts");
            if (!swapped && existsSync(artifacts) && readdirSync(artifacts).some(name => name.startsWith(".pending-"))) {
                renameSync(artifacts, displaced);
                try { symlinkSync(outside, artifacts, "junction"); }
                catch (error: any) { if (error?.code === "EPERM") return false; throw error; }
                swapped = true;
            }
            return false;
        });
        try {
            await rejects(acquireDatabaseArtifact({ descriptor: descriptor(), storeRoot: store, transport: fakeTransport(Buffer.from("artifacts-swap")), signal }), /identity changed|controlled directory/i);
            if (!swapped) { this.skip(); return; }
            deepEqual(readdirSync(outside), ["sentinel.txt"]);
        } finally {
            const artifacts = join(store, "artifacts");
            if (swapped && existsSync(artifacts)) unlinkSync(artifacts);
            if (swapped && existsSync(displaced)) renameSync(displaced, artifacts);
            rmSync(base, { recursive: true, force: true });
        }
    });
});

const OFFICIAL_SECRET = "cf.ishin-global.aktsk.com";
