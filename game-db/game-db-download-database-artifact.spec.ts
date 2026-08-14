import { deepEqual, equal, match, notEqual, rejects, throws } from "assert";
import { createHash } from "crypto";
import { chmodSync, copyFileSync, existsSync, linkSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, renameSync, rmSync, statSync, symlinkSync, truncateSync, unlinkSync, writeFileSync } from "fs";
import { mkdir } from "fs/promises";
import { tmpdir } from "os";
import { join, resolve } from "path";
import { Readable } from "stream";
import {
    acquireDatabaseArtifact,
    DatabaseArtifactTransport,
    parseDownloadDatabaseArtifactArgs,
    readAndValidateDatabaseDescriptor,
    runDownloadDatabaseArtifact,
    validateAcquiredDatabaseArtifact,
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
function fakeTransport(bytes: Buffer, overrides: Partial<{ statusCode: number, contentLength: string, headers: Record<string, string | string[] | undefined>, body: Readable }> = {}, calls?: { count: number }): DatabaseArtifactTransport {
    return { async get() { if (calls) calls.count += 1; return { statusCode: overrides.statusCode ?? 200, headers: overrides.headers ?? { "content-length": overrides.contentLength ?? String(bytes.length) }, body: overrides.body ?? Readable.from([bytes]) }; } };
}
function temp(): string { return mkdtempSync(join(tmpdir(), "dokkan-aq-")); }
function journalFiles(root: string): string[] { const directory = join(root, "pointers"); return existsSync(directory) ? readdirSync(directory).filter(name => /^[a-f0-9]{64}\.json$/.test(name)).sort() : []; }
function journalState(root: string): string { return JSON.stringify(journalFiles(root).map(name => [name, readFileSync(join(root, "pointers", name), "utf8")])); }
function canonicalJson(value: unknown): string { return `${JSON.stringify(value, null, 2)}\n`; }
function writePointerRecord(root: string, record: unknown): string { const text = canonicalJson(record), name = `${createHash("sha256").update(text).digest("hex")}.json`, path = join(root, "pointers", name); writeFileSync(path, text, { flag: "wx", mode: 0o600 }); chmodSync(path, 0o444); return path; }
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
function mutationSignal(mutateAt: number, mutation: () => void): { signal: AbortSignal, count: () => number } {
    const controller = new AbortController();
    let reads = 0;
    return {
        signal: new Proxy(controller.signal, {
            get(target, property) {
                if (property === "aborted") {
                    reads += 1;
                    if (reads === mutateAt) mutation();
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
        for (const statusCode of [206, 301, 404]) {
            const root = temp();
            try { await rejects(acquireDatabaseArtifact({ descriptor: descriptor(), storeRoot: root, transport: fakeTransport(Buffer.from("x"), { statusCode }) }), /redirect|successful/); }
            finally { rmSync(root, { recursive: true, force: true }); }
        }
    });

    it("accepts only an unencoded complete 200 response with one canonical Content-Length", async () => {
        const rejected: Array<{ name: string, statusCode?: number, headers: Record<string, string | string[] | undefined>, pattern: RegExp }> = [
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
            const body = Readable.from([Buffer.from("x")]);
            try {
                await rejects(acquireDatabaseArtifact({ descriptor: descriptor(), storeRoot: root, transport: fakeTransport(Buffer.from("x"), { statusCode: variant.statusCode, headers: variant.headers, body }) }), variant.pattern, variant.name);
                equal(body.destroyed, true, variant.name);
                equal(existsSync(join(root, "latest.json")), false, variant.name);
                equal(existsSync(join(root, "receipts")), false, variant.name);
            } finally { rmSync(root, { recursive: true, force: true }); }
        }
        for (const headers of [{ "content-length": "1" }, { "content-length": "1", "content-encoding": "identity" }]) {
            const root = temp();
            try {
                const result = await acquireDatabaseArtifact({ descriptor: descriptor(), storeRoot: root, transport: fakeTransport(Buffer.from("x"), { headers }) });
                equal(result.metadata.observedSizeBytes, 1);
            } finally { rmSync(root, { recursive: true, force: true }); }
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
            const pointerBefore = journalState(root);
            const signal = boundarySignal(() => readdirSync(root).some(name => name.startsWith(".download-") && readFileSync(join(root, name)).byteLength === nextBytes.byteLength));
            await rejects(acquireDatabaseArtifact({ descriptor: descriptor(), storeRoot: root, transport: fakeTransport(nextBytes), signal }), /cancelled/);
            equal(journalState(root), pointerBefore);
            equal(readdirSync(root).some(name => name.startsWith(".download-") || name.startsWith(".pending-")), false);
        } finally { rmSync(root, { recursive: true, force: true }); }
    });

    it("fails closed during post-promotion validation and quarantines the reserved destination", async () => {
        const root = temp(), firstBytes = Buffer.from("first-valid-bytes"), nextBytes = Buffer.from("second-valid-artifact");
        try {
            const first = await acquireDatabaseArtifact({ descriptor: descriptor(), storeRoot: root, transport: fakeTransport(firstBytes) });
            const pointerBefore = journalState(root);
            const signal = boundarySignal(() => {
                const artifacts = join(root, "artifacts");
                return existsSync(artifacts) && readdirSync(artifacts).some(name => /^[a-f0-9]{64}$/.test(name) && name !== first.identity && existsSync(join(artifacts, name, "commit-marker.json")));
            });
            await rejects(acquireDatabaseArtifact({ descriptor: descriptor(), storeRoot: root, transport: fakeTransport(nextBytes), signal }), /cancelled/);
            equal(journalState(root), pointerBefore);
            const orphans = readdirSync(join(root, "artifacts")).filter(name => /^[a-f0-9]{64}$/.test(name) && name !== first.identity);
            equal(orphans.length, 0);
            const quarantines = readdirSync(join(root, "artifacts")).filter(name => name.startsWith(".quarantine-"));
            equal(quarantines.length, 1);
            equal(existsSync(join(root, "artifacts", quarantines[0], "artifact", "commit-marker.json")), true);
        } finally { rmSync(root, { recursive: true, force: true }); }
    });

    it("fails closed after receipt without appending a pointer record", async () => {
        const root = temp(), firstBytes = Buffer.from("first-valid-bytes"), nextBytes = Buffer.from("third-valid-artifact");
        try {
            const first = await acquireDatabaseArtifact({ descriptor: descriptor(), storeRoot: root, transport: fakeTransport(firstBytes), now: () => new Date("2026-08-13T20:00:00.000Z") });
            const pointerBefore = journalState(root);
            const receiptsBefore = readdirSync(join(root, "receipts")).length;
            const signal = boundarySignal(() => existsSync(join(root, "receipts")) && readdirSync(join(root, "receipts")).filter(name => !name.startsWith(".")).length > receiptsBefore);
            await rejects(acquireDatabaseArtifact({ descriptor: descriptor(), storeRoot: root, transport: fakeTransport(nextBytes), signal, now: () => new Date("2026-08-13T21:00:00.000Z") }), /cancelled/);
            equal(journalState(root), pointerBefore);
            equal(readdirSync(join(root, "receipts")).filter(name => !name.startsWith(".")).length, receiptsBefore + 1);
        } finally { rmSync(root, { recursive: true, force: true }); }
    });

    it("never overwrites a pointer sentinel introduced at the create-only installation boundary", async () => {
        const root = temp(), probeRoot = temp(), firstBytes = Buffer.from("first-valid-bytes"), nextBytes = Buffer.from("fourth-valid-artifact");
        let sentinelPath = "";
        try {
            const first = await acquireDatabaseArtifact({ descriptor: descriptor(), storeRoot: root, transport: fakeTransport(firstBytes) });
            const probe = await acquireDatabaseArtifact({ descriptor: descriptor(), storeRoot: probeRoot, transport: fakeTransport(nextBytes) });
            const record = { schemaVersion: 1, contract: "dokkan-game-db-pointer-record", contractVersion: "1.0.0", identity: probe.identity, predecessorIdentity: first.identity < probe.identity ? first.identity : null, order: { databaseVersion: version, artifactIdentity: probe.identity } };
            const text = canonicalJson(record), name = `${createHash("sha256").update(text).digest("hex")}.json`;
            const receiptsBefore = readdirSync(join(root, "receipts")).length;
            const signal = boundarySignal(() => {
                if (!sentinelPath && readdirSync(join(root, "receipts")).length > receiptsBefore) {
                    sentinelPath = join(root, "pointers", name);
                    writeFileSync(sentinelPath, "pointer-install-sentinel", { flag: "wx" });
                }
                return false;
            });
            await rejects(acquireDatabaseArtifact({ descriptor: descriptor(), storeRoot: root, transport: fakeTransport(nextBytes), signal }), /exact valid create-only record|exist/i);
            equal(readFileSync(sentinelPath, "utf8"), "pointer-install-sentinel");
            equal((await validateAcquiredDatabaseArtifact({ storeRoot: root, useLatest: true })).identity, first.identity);
        } finally { rmSync(root, { recursive: true, force: true }); rmSync(probeRoot, { recursive: true, force: true }); }
    });

    it("never clobbers a receipt destination created at the installation boundary", async () => {
        const root = temp();
        let racedTarget = "";
        const signal = boundarySignal(() => {
            const receipts = join(root, "receipts");
            if (racedTarget || !existsSync(receipts)) return false;
            const temporary = readdirSync(receipts).find(name => name.startsWith(".official_descriptor_download-") && name.endsWith(`.${process.pid}.tmp`));
            if (!temporary) return false;
            racedTarget = join(receipts, temporary.slice(1, -`.${process.pid}.tmp`.length));
            writeFileSync(racedTarget, "raced-receipt-sentinel");
            return false;
        });
        try {
            await rejects(acquireDatabaseArtifact({ descriptor: descriptor(), storeRoot: root, transport: fakeTransport(Buffer.from("receipt-race")), signal }), /EEXIST|exist/i);
            equal(readFileSync(racedTarget, "utf8"), "raced-receipt-sentinel");
            equal(existsSync(join(root, "latest.json")), false);
        } finally { rmSync(root, { recursive: true, force: true }); }
    });

    it("allows two concurrent promotions to append without overwrite and selects deterministic current and rollback", async () => {
        const root = temp();
        mkdirSync(join(root, "artifacts"));
        mkdirSync(join(root, "receipts"));
        mkdirSync(join(root, "pointers"));
        let arrivals = 0;
        let release!: () => void;
        const barrier = new Promise<void>(done => { release = done; });
        function transport(bytes: Buffer): DatabaseArtifactTransport {
            return { async get() { arrivals += 1; if (arrivals === 2) release(); await barrier; return { statusCode: 200, headers: { "content-length": String(bytes.length) }, body: Readable.from([bytes]) }; } };
        }
        try {
            const [left, right] = await Promise.all([
                acquireDatabaseArtifact({ descriptor: descriptor(), storeRoot: root, transport: transport(Buffer.from("concurrent-left")) }),
                acquireDatabaseArtifact({ descriptor: descriptor(), storeRoot: root, transport: transport(Buffer.from("concurrent-right")) }),
            ]);
            equal(journalFiles(root).length, 2);
            const ordered = [left.identity, right.identity].sort();
            const selected = await validateAcquiredDatabaseArtifact({ storeRoot: root, useLatest: true });
            equal(selected.identity, ordered[1]);
            equal(selected.previousIdentity, ordered[0]);
            equal((await validateAcquiredDatabaseArtifact({ storeRoot: root, artifactIdentity: ordered[0] })).identity, ordered[0]);
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

    it("rejects a hard-link alias introduced deterministically before promotion", async () => {
        const root = temp(), alias = join(root, "pending-database-alias.db");
        let linked = false;
        try {
            const first = await acquireDatabaseArtifact({ descriptor: descriptor(), storeRoot: root, transport: fakeTransport(Buffer.from("alias-prior")) });
            const pointerBefore = journalState(root);
            const signal = boundarySignal(() => {
                const artifacts = join(root, "artifacts");
                const pending = existsSync(artifacts) ? readdirSync(artifacts).find(name => name.startsWith(".pending-") && existsSync(join(artifacts, name, "commit-marker.json"))) : undefined;
                if (!pending || linked) return false;
                linkSync(join(artifacts, pending, "database.db"), alias);
                linked = true;
                return false;
            });
            await rejects(acquireDatabaseArtifact({ descriptor: descriptor(), storeRoot: root, transport: fakeTransport(Buffer.from("alias-next")), signal }), /hard link|changed|identity/i);
            equal(linked, true);
            equal(journalState(root), pointerBefore);
        } finally { rmSync(root, { recursive: true, force: true }); }
    });

    it("rejects pending mutation after the database copy and before marker-last completion", async () => {
        const seedRoot = temp(), root = temp();
        let mutated = false;
        try {
            const nextBytes = Buffer.from("pending-mutated-after-copy");
            const seed = await acquireDatabaseArtifact({ descriptor: descriptor(), storeRoot: seedRoot, transport: fakeTransport(nextBytes) });
            const first = await acquireDatabaseArtifact({ descriptor: descriptor(), storeRoot: root, transport: fakeTransport(Buffer.from("pending-copy-prior")) });
            const pointerBefore = journalState(root);
            const signal = boundarySignal(() => {
                const artifacts = join(root, "artifacts"), finalDatabase = join(artifacts, seed.identity, "database.db");
                const pending = existsSync(artifacts) ? readdirSync(artifacts).find(name => name.startsWith(".pending-")) : undefined;
                if (!pending || mutated || !existsSync(finalDatabase) || existsSync(join(artifacts, seed.identity, "metadata.json"))) return false;
                writeFileSync(join(artifacts, pending, "database.db"), Buffer.from("pending-mutated-after-copy!"));
                mutated = true;
                return false;
            });
            await rejects(acquireDatabaseArtifact({ descriptor: descriptor(), storeRoot: root, transport: fakeTransport(nextBytes), signal }), /pending artifact database\.db changed/i);
            equal(mutated, true);
            equal(journalState(root), pointerBefore);
        } finally { rmSync(seedRoot, { recursive: true, force: true }); rmSync(root, { recursive: true, force: true }); }
    });

    it("rejects deterministic database, metadata and marker replacement before journal promotion", async () => {
        const seedRoot = temp();
        try {
            const nextBytes = Buffer.from("replace-final-before-latest");
            const seed = await acquireDatabaseArtifact({ descriptor: descriptor(), storeRoot: seedRoot, transport: fakeTransport(nextBytes) });
            for (const member of ["database.db", "metadata.json", "commit-marker.json"]) {
                const root = temp(); let replaced = false;
                try {
                    const first = await acquireDatabaseArtifact({ descriptor: descriptor(), storeRoot: root, transport: fakeTransport(Buffer.from(`prior-${member}`)) });
                    const pointerBefore = journalState(root);
                    const signal = boundarySignal(() => {
                        const artifacts = join(root, "artifacts"), directory = join(artifacts, seed.identity), target = join(directory, member);
                        const hasPending = existsSync(artifacts) && readdirSync(artifacts).some(name => name.startsWith(".pending-"));
                        if (replaced || hasPending || !existsSync(join(directory, "commit-marker.json"))) return false;
                        renameSync(target, join(root, `.displaced-${member}`));
                        writeFileSync(target, `replacement-${member}`);
                        replaced = true;
                        return false;
                    });
                    await rejects(acquireDatabaseArtifact({ descriptor: descriptor(), storeRoot: root, transport: fakeTransport(nextBytes), signal }), /read-only|identity|metadata|marker|changed/i, member);
                    equal(replaced, true, member);
                    equal(journalState(root), pointerBefore, member);
                } finally { rmSync(root, { recursive: true, force: true }); }
            }
        } finally { rmSync(seedRoot, { recursive: true, force: true }); }
    });

    it("fails closed to the prior valid journal winner when the new pointed commit is corrupted immediately after append", async () => {
        const seedRoot = temp(), root = temp();
        let corrupted = false;
        try {
            const nextBytes = Buffer.from("corrupt-immediately-after-latest");
            const seed = await acquireDatabaseArtifact({ descriptor: descriptor(), storeRoot: seedRoot, transport: fakeTransport(nextBytes) });
            const first = await acquireDatabaseArtifact({ descriptor: descriptor(), storeRoot: root, transport: fakeTransport(Buffer.from("latest-corruption-prior")) });
            const pointerBefore = journalState(root);
            const signal = boundarySignal(() => {
                if (corrupted) return false;
                const promoted = journalFiles(root).some(name => {
                    try { return JSON.parse(readFileSync(join(root, "pointers", name), "utf8")).identity === seed.identity; }
                    catch { return false; }
                });
                if (!promoted) return false;
                const metadataPath = join(root, "artifacts", seed.identity, "metadata.json");
                chmodSync(metadataPath, 0o644);
                writeFileSync(metadataPath, "{}\n");
                corrupted = true;
                return false;
            });
            await rejects(acquireDatabaseArtifact({ descriptor: descriptor(), storeRoot: root, transport: fakeTransport(nextBytes), signal }), /artifact|metadata|read-only|identity/i);
            equal(corrupted, true);
            equal((await validateAcquiredDatabaseArtifact({ storeRoot: root, useLatest: true })).identity, first.identity);
        } finally { rmSync(seedRoot, { recursive: true, force: true }); rmSync(root, { recursive: true, force: true }); }
    });

    it("fails closed for nlink greater than one, writable final members and a corrupt latest consumer", async () => {
        for (const variant of ["nlink", "writable", "latest-corrupt"] as const) {
            const root = temp();
            try {
                const acquired = await acquireDatabaseArtifact({ descriptor: descriptor(), storeRoot: root, transport: fakeTransport(Buffer.from(`consumer-${variant}`)) });
                if (variant === "nlink") linkSync(acquired.artifactPath, join(root, "database-alias.db"));
                if (variant === "writable") chmodSync(acquired.metadataPath, 0o644);
                if (variant === "latest-corrupt") { chmodSync(acquired.commitMarkerPath, 0o644); writeFileSync(acquired.commitMarkerPath, "{}\n"); }
                const options = variant === "latest-corrupt" ? { storeRoot: root, useLatest: true as const } : { storeRoot: root, artifactIdentity: acquired.identity };
                await rejects(validateAcquiredDatabaseArtifact(options), /hard link|read-only|marker|commit|identity|journal/i, variant);
            } finally { rmSync(root, { recursive: true, force: true }); }
        }
    });

    it("binds database, metadata and marker replacements to the marker-last material snapshot", async () => {
        for (const member of ["database.db", "metadata.json", "commit-marker.json"]) {
            const root = temp(); let mutated = false;
            try {
                const first = await acquireDatabaseArtifact({ descriptor: descriptor(), storeRoot: root, transport: fakeTransport(Buffer.from(`prior-${member}`)) });
                const pointerBefore = journalState(root);
                const signal = boundarySignal(() => {
                    const artifacts = join(root, "artifacts");
                    const pending = existsSync(artifacts) ? readdirSync(artifacts).find(name => name.startsWith(".pending-") && existsSync(join(artifacts, name, "commit-marker.json"))) : undefined;
                    if (!pending || mutated) return false;
                    const target = join(artifacts, pending, member);
                    unlinkSync(target);
                    writeFileSync(target, `replacement-${member}`);
                    mutated = true;
                    return false;
                });
                await rejects(acquireDatabaseArtifact({ descriptor: descriptor(), storeRoot: root, transport: fakeTransport(Buffer.from(`next-${member}`)), signal }), /snapshot|pathname|identity|metadata|marker|database/i, member);
                equal(mutated, true, member);
                equal(journalState(root), pointerBefore, member);
                deepEqual(readdirSync(join(root, "artifacts")).filter(name => /^[a-f0-9]{64}$/.test(name)), [first.identity], member);
            } finally { rmSync(root, { recursive: true, force: true }); }
        }
    });

    it("uses an exclusive final-name reservation and never replaces a raced destination", async () => {
        const seedRoot = temp();
        const nextBytes = Buffer.from("create-only-race-candidate");
        try {
            const seed = await acquireDatabaseArtifact({ descriptor: descriptor(), storeRoot: seedRoot, transport: fakeTransport(nextBytes) });
            const variants: Array<{ name: string, valid: boolean, introduce(target: string, outside: string): void }> = [
                { name: "empty directory", valid: false, introduce(target) { mkdirSync(target); } },
                { name: "regular file", valid: false, introduce(target) { writeFileSync(target, "external-file"); } },
                { name: "valid same-identity commit", valid: true, introduce(target) {
                    mkdirSync(target);
                    for (const name of ["database.db", "metadata.json", "commit-marker.json"]) {
                        const member = join(target, name);
                        copyFileSync(join(seedRoot, "artifacts", seed.identity, name), member);
                        chmodSync(member, 0o444);
                    }
                } },
                { name: "invalid commit", valid: false, introduce(target) {
                    mkdirSync(target);
                    writeFileSync(join(target, "database.db"), "invalid");
                    writeFileSync(join(target, "metadata.json"), "{}\n");
                    writeFileSync(join(target, "commit-marker.json"), "{}\n");
                } },
                { name: "junction or directory symlink", valid: false, introduce(target, outside) { symlinkSync(outside, target, "junction"); } },
            ];
            for (const variant of variants) {
                const root = temp(); let introduced = false; let targetIdentity = "";
                try {
                    const first = await acquireDatabaseArtifact({ descriptor: descriptor(), storeRoot: root, transport: fakeTransport(Buffer.from(`prior-${variant.name}`)) });
                    const pointerBefore = journalState(root);
                    const target = join(root, "artifacts", seed.identity);
                    const outside = join(root, "outside");
                    mkdirSync(outside);
                    writeFileSync(join(outside, "sentinel.txt"), "keep");
                    const signal = boundarySignal(() => {
                        const artifacts = join(root, "artifacts");
                        const markerReady = existsSync(artifacts) && readdirSync(artifacts).some(name => name.startsWith(".pending-") && existsSync(join(artifacts, name, "commit-marker.json")));
                        if (!markerReady || introduced) return false;
                        variant.introduce(target, outside);
                        const stat: any = statSync(target, { bigint: true });
                        targetIdentity = `${stat.dev}:${stat.ino}:${stat.size}`;
                        introduced = true;
                        return false;
                    });
                    if (variant.valid) {
                        const result = await acquireDatabaseArtifact({ descriptor: descriptor(), storeRoot: root, transport: fakeTransport(nextBytes), signal });
                        equal(result.reused, true, variant.name);
                        equal(result.identity, seed.identity, variant.name);
                        const stat: any = statSync(target, { bigint: true });
                        equal(`${stat.dev}:${stat.ino}:${stat.size}`, targetIdentity, variant.name);
                        const selected = await validateAcquiredDatabaseArtifact({ storeRoot: root, useLatest: true });
                        equal(selected.identity, [first.identity, seed.identity].sort()[1]);
                    } else {
                        await rejects(acquireDatabaseArtifact({ descriptor: descriptor(), storeRoot: root, transport: fakeTransport(nextBytes), signal }), /destination|directory|members|metadata|regular|read-only|symlink|junction|reparse/i, variant.name);
                        equal(journalState(root), pointerBefore, variant.name);
                        equal(existsSync(target), true, variant.name);
                        equal(readFileSync(join(outside, "sentinel.txt"), "utf8"), "keep", variant.name);
                    }
                    equal(introduced, true, variant.name);
                } finally { rmSync(root, { recursive: true, force: true }); }
            }
        } finally { rmSync(seedRoot, { recursive: true, force: true }); }
    });

    it("quarantines only its reserved directory when a member is replaced after installation", async () => {
        const root = temp(); let mutated = false;
        try {
            const first = await acquireDatabaseArtifact({ descriptor: descriptor(), storeRoot: root, transport: fakeTransport(Buffer.from("prior-post-promotion")) });
            const pointerBefore = journalState(root);
            const signal = boundarySignal(() => {
                const artifacts = join(root, "artifacts");
                if (!existsSync(artifacts) || mutated) return false;
                const promoted = readdirSync(artifacts).find(name => /^[a-f0-9]{64}$/.test(name) && name !== first.identity && existsSync(join(artifacts, name, "commit-marker.json")));
                if (!promoted) return false;
                const target = join(artifacts, promoted, "metadata.json");
                unlinkSync(target);
                writeFileSync(target, "{}\n");
                mutated = true;
                return false;
            });
            await rejects(acquireDatabaseArtifact({ descriptor: descriptor(), storeRoot: root, transport: fakeTransport(Buffer.from("next-post-promotion")), signal }), /snapshot|identity|metadata|changed/i);
            equal(mutated, true);
            equal(journalState(root), pointerBefore);
            deepEqual(readdirSync(join(root, "artifacts")).filter(name => /^[a-f0-9]{64}$/.test(name)), [first.identity]);
            equal(readdirSync(join(root, "artifacts")).filter(name => name.startsWith(".quarantine-")).length, 1);
        } finally { rmSync(root, { recursive: true, force: true }); }
    });

    it("discards successful and reused staging without retaining a physical staging link", async () => {
        const root = temp(), bytes = Buffer.from("bounded-success-staging");
        try {
            await acquireDatabaseArtifact({ descriptor: descriptor(), storeRoot: root, transport: fakeTransport(bytes) });
            await acquireDatabaseArtifact({ descriptor: descriptor(), storeRoot: root, transport: fakeTransport(bytes) });
            equal(readdirSync(root).some(name => name.startsWith(".discard-") || name.startsWith(".file-history-") || name.startsWith(".download-")), false);
            equal(readdirSync(join(root, "receipts")).some(name => name.startsWith(".")), false);
        } finally { rmSync(root, { recursive: true, force: true }); }
    });

    it("rejects a full failed-staging history budget before transport while allowing pointer journal growth", async () => {
        const root = temp(), calls = { count: 0 };
        try {
            const history = join(root, ".file-history-seeded-failure");
            mkdirSync(history);
            const retained = join(history, "latest.json");
            writeFileSync(retained, "x");
            truncateSync(retained, 128 * 1024 * 1024 + 1);
            await rejects(acquireDatabaseArtifact({ descriptor: descriptor(), storeRoot: root, transport: fakeTransport(Buffer.from("never"), {}, calls) }), /256 MiB local storage budget/);
            equal(calls.count, 0);
            equal(statSync(retained).size, 128 * 1024 * 1024 + 1);
        } finally { rmSync(root, { recursive: true, force: true }); }

        const smallRoot = temp();
        try {
            const first = await acquireDatabaseArtifact({ descriptor: descriptor(), storeRoot: smallRoot, transport: fakeTransport(Buffer.from("small-history-one")), maxBytes: 1024 });
            const second = await acquireDatabaseArtifact({ descriptor: descriptor(), storeRoot: smallRoot, transport: fakeTransport(Buffer.from("small-history-two")), maxBytes: 1024 });
            const selected = await validateAcquiredDatabaseArtifact({ storeRoot: smallRoot, useLatest: true });
            equal(selected.identity, [first.identity, second.identity].sort().pop());
            equal(journalFiles(smallRoot).length, 2);
        } finally { rmSync(smallRoot, { recursive: true, force: true }); }
    });

    it("fails closed when committed artifact members are swapped after their handles open", async function () {
        const variants: Array<{ name: string, abortedRead: number, target(first: any): string }> = [
            { name: "metadata", abortedRead: 6, target: first => first.metadataPath },
            { name: "artifact", abortedRead: 7, target: first => first.artifactPath },
            { name: "marker", abortedRead: 8, target: first => first.commitMarkerPath },
        ];
        for (const variant of variants) {
            const root = temp(), bytes = Buffer.from(`stable-${variant.name}`);
            let displaced = "", target = "", swapped = false;
            try {
                const first = await acquireDatabaseArtifact({ descriptor: descriptor(), storeRoot: root, transport: fakeTransport(bytes) });
                const pointerBefore = journalState(root);
                target = variant.target(first);
                displaced = join(root, `.displaced-${variant.name}`);
                const mutation = mutationSignal(variant.abortedRead, () => {
                    try {
                        renameSync(target, displaced);
                        writeFileSync(target, Buffer.from(`replacement-${variant.name}`));
                        swapped = true;
                    } catch (error) {
                        if (existsSync(displaced) && !existsSync(target)) renameSync(displaced, target);
                        throw error;
                    }
                });
                let failure: unknown;
                try { await acquireDatabaseArtifact({ descriptor: descriptor(), storeRoot: root, transport: fakeTransport(bytes), signal: mutation.signal }); }
                catch (error) { failure = error; }
                equal(swapped, true, `${variant.name} hook count ${mutation.count()}`);
                match(String(failure), /pathname|identity|replaced|changed|read-only/i, `${variant.name}: ${String(failure)} at ${mutation.count()}`);
                if (swapped) {
                    unlinkSync(target);
                    renameSync(displaced, target);
                    swapped = false;
                }
                equal(journalState(root), pointerBefore, variant.name);
            } finally {
                if (swapped && existsSync(target)) unlinkSync(target);
                if (existsSync(displaced)) renameSync(displaced, target);
                rmSync(root, { recursive: true, force: true });
            }
        }
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

    it("preserves the previous artifact and journal when a later acquisition fails", async () => {
        const root = temp();
        try {
            const raw = descriptor();
            const first = await acquireDatabaseArtifact({ descriptor: raw, storeRoot: root, transport: fakeTransport(Buffer.from("first-valid-bytes")) });
            const latestBefore = journalState(root);
            await rejects(acquireDatabaseArtifact({ descriptor: raw, storeRoot: root, transport: fakeTransport(Buffer.from("bad"), { contentLength: "4" }) }), /truncated/);
            equal(journalState(root), latestBefore);
            equal(readFileSync(first.artifactPath).toString(), "first-valid-bytes");
            equal(readdirSync(root).some(name => name.startsWith(".download-") || name.startsWith(".pending-")), false);
        } finally { rmSync(root, { recursive: true, force: true }); }
    });

    it("does not append a pointer record when the operational receipt cannot be committed", async () => {
        const root = temp();
        try {
            const raw = descriptor();
            const first = await acquireDatabaseArtifact({ descriptor: raw, storeRoot: root, transport: fakeTransport(Buffer.from("first-valid-bytes")), now: () => new Date("2026-08-13T20:00:00.000Z") });
            const latestBefore = journalState(root);
            rmSync(join(root, "receipts"), { recursive: true, force: true });
            writeFileSync(join(root, "receipts"), "blocks receipt directory");
            await rejects(acquireDatabaseArtifact({ descriptor: raw, storeRoot: root, transport: fakeTransport(Buffer.from("second-valid-bytes")), now: () => new Date("2026-08-13T21:00:00.000Z") }), /EEXIST|directory|store root/i);
            equal(journalState(root), latestBefore);
        } finally { rmSync(root, { recursive: true, force: true }); }
    });

    it("selects current and rollback deterministically for new and repeated identities", async () => {
        const root = temp();
        try {
            const first = await acquireDatabaseArtifact({ descriptor: descriptor(), storeRoot: root, transport: fakeTransport(Buffer.from("identity-one")) });
            let selected = await validateAcquiredDatabaseArtifact({ storeRoot: root, useLatest: true });
            equal(selected.identity, first.identity); equal(selected.previousIdentity, null);
            const second = await acquireDatabaseArtifact({ descriptor: descriptor(), storeRoot: root, transport: fakeTransport(Buffer.from("identity-two")) });
            const order = [first.identity, second.identity].sort();
            selected = await validateAcquiredDatabaseArtifact({ storeRoot: root, useLatest: true });
            equal(selected.identity, order[1]); equal(selected.previousIdentity, order[0]);
            const repeated = await acquireDatabaseArtifact({ descriptor: descriptor(), storeRoot: root, transport: fakeTransport(Buffer.from("identity-two")) });
            equal(repeated.reused, true);
            equal(journalFiles(root).length, 2);
            selected = await validateAcquiredDatabaseArtifact({ storeRoot: root, useLatest: true });
            equal(selected.identity, order[1]); equal(selected.previousIdentity, order[0]);
        } finally { rmSync(root, { recursive: true, force: true }); }
    });

    it("deduplicates external records for one commit before selecting deterministic rollback", async () => {
        const root = temp();
        try {
            await acquireDatabaseArtifact({ descriptor: descriptor(), storeRoot: root, transport: fakeTransport(Buffer.from("duplicate-one")) });
            await acquireDatabaseArtifact({ descriptor: descriptor(), storeRoot: root, transport: fakeTransport(Buffer.from("duplicate-two")) });
            const before = await validateAcquiredDatabaseArtifact({ storeRoot: root, useLatest: true });
            if (!before.pointerRecordPath || !before.previousIdentity) throw new Error("expected journal selection");
            const duplicate = JSON.parse(readFileSync(before.pointerRecordPath, "utf8"));
            duplicate.predecessorIdentity = duplicate.predecessorIdentity === null ? before.previousIdentity : null;
            writePointerRecord(root, duplicate);
            const after = await validateAcquiredDatabaseArtifact({ storeRoot: root, useLatest: true });
            equal(after.identity, before.identity);
            equal(after.previousIdentity, before.previousIdentity);
            notEqual(after.previousIdentity, after.identity);
            equal(journalFiles(root).length, 3);
        } finally { rmSync(root, { recursive: true, force: true }); }
    });

    it("ignores corrupt, truncated and missing-commit records while failing closed without any valid winner", async () => {
        const root = temp();
        try {
            const acquired = await acquireDatabaseArtifact({ descriptor: descriptor(), storeRoot: root, transport: fakeTransport(Buffer.from("journal-valid")) });
            const corrupt = join(root, "pointers", `${"a".repeat(64)}.json`);
            writeFileSync(corrupt, "{"); chmodSync(corrupt, 0o444);
            const missing = { schemaVersion: 1, contract: "dokkan-game-db-pointer-record", contractVersion: "1.0.0", identity: "b".repeat(64), predecessorIdentity: null, order: { databaseVersion: version + 1, artifactIdentity: "b".repeat(64) } };
            writePointerRecord(root, missing);
            equal((await validateAcquiredDatabaseArtifact({ storeRoot: root, useLatest: true })).identity, acquired.identity);
            chmodSync(acquired.pointerRecordPath, 0o600); rmSync(acquired.pointerRecordPath, { force: true });
            await rejects(validateAcquiredDatabaseArtifact({ storeRoot: root, useLatest: true }), /journal has no valid materialized record/);
        } finally { rmSync(root, { recursive: true, force: true }); }
    });

    it("ignores a divergent latest cache and rejects unexpected pointer directory members", async () => {
        const root = temp();
        try {
            const acquired = await acquireDatabaseArtifact({ descriptor: descriptor(), storeRoot: root, transport: fakeTransport(Buffer.from("cache-divergence")) });
            writeFileSync(join(root, "latest.json"), "{\"currentIdentity\":\"forged\"}\n");
            equal((await validateAcquiredDatabaseArtifact({ storeRoot: root, useLatest: true })).identity, acquired.identity);
            writeFileSync(join(root, "pointers", "unexpected.txt"), "sentinel");
            await rejects(validateAcquiredDatabaseArtifact({ storeRoot: root, useLatest: true }), /unexpected or non-regular member/);
            equal(readFileSync(join(root, "pointers", "unexpected.txt"), "utf8"), "sentinel");
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
            symlinkSync(outside, linkedRoot, "junction");
            await rejects(acquireDatabaseArtifact({ descriptor: descriptor(), storeRoot: linkedRoot, transport: fakeTransport(Buffer.from("x")) }), /symlink|junction/);
        } finally { rmSync(root, { recursive: true, force: true }); }
    });

    it("rejects an existing-parent swap between its snapshot and store creation", async function () {
        const base = temp(), parent = join(base, "parent"), displaced = join(base, "parent-displaced"), outside = join(base, "outside"), store = join(parent, "new", "store");
        await mkdir(parent); await mkdir(outside);
        let swapped = false;
        const mutation = mutationSignal(1, () => {
            renameSync(parent, displaced);
            try { symlinkSync(outside, parent, "junction"); }
            catch (error) {
                renameSync(displaced, parent);
                throw error;
            }
            swapped = true;
        });
        const calls = { count: 0 };
        try {
            let failure: unknown;
            try { await acquireDatabaseArtifact({ descriptor: descriptor(), storeRoot: store, transport: fakeTransport(Buffer.from("never"), {}, calls), signal: mutation.signal }); }
            catch (error) { failure = error; }
            equal(swapped, true);
            match(String(failure), /identity changed|controlled directory/i);
            equal(calls.count, 0);
            deepEqual(readdirSync(outside), []);
            equal(existsSync(join(outside, "new")), false);
        } finally {
            if (swapped && existsSync(parent)) unlinkSync(parent);
            if (swapped && existsSync(displaced)) renameSync(displaced, parent);
            rmSync(base, { recursive: true, force: true });
        }
    });

    it("rejects a junction substituted for artifacts and never writes outside the validated root", async function () {
        const base = temp(), store = join(base, "store"), outside = join(base, "outside");
        await mkdir(store); await mkdir(outside);
        try {
            const artifacts = join(store, "artifacts");
            symlinkSync(outside, artifacts, "junction");
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
                catch (error) { throw error; }
                swapped = true;
            }
            return false;
        });
        try {
            await rejects(acquireDatabaseArtifact({ descriptor: descriptor(), storeRoot: store, transport: fakeTransport(Buffer.from("root-swap")), signal }), /identity changed|controlled directory/i);
            equal(swapped, true);
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
                catch (error) { throw error; }
                swapped = true;
            }
            return false;
        });
        try {
            await rejects(acquireDatabaseArtifact({ descriptor: descriptor(), storeRoot: store, transport: fakeTransport(Buffer.from("artifacts-swap")), signal }), /identity changed|controlled directory/i);
            equal(swapped, true);
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
