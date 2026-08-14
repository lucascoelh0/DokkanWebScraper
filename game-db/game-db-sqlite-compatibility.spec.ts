import { deepEqual, equal, notEqual, rejects, throws } from "assert";
import { execFileSync } from "child_process";
import { chmodSync, mkdtempSync, readFileSync, readdirSync, renameSync, rmSync, statSync, symlinkSync, unlinkSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join, resolve } from "path";
import { Readable } from "stream";
import { ReadOnlySqliteAdapter, SqliteBridgeTerminationUnconfirmedError } from "../database-experiment/sqlite-readonly-adapter";
import { acquireDatabaseArtifact, AcquiredDatabaseArtifactResult, DatabaseArtifactTransport } from "./game-db-download-database-artifact";
import { buildGameDbSqliteCompatibility, parseGameDbSqliteCompatibilityArgs } from "./game-db-sqlite-compatibility";

function temp(): string { return mkdtempSync(join(tmpdir(), "dokkan-c4-closed-api-")); }
function python(): string { return process.platform === "win32" ? "python" : "python3"; }
function createSqlite(path: string): void {
    execFileSync(python(), ["-c", "import sqlite3,sys; c=sqlite3.connect(sys.argv[1]); c.execute('create table cards(id integer primary key, character_id integer)'); c.commit(); c.close()", path]);
}
const descriptorVersion = Math.floor(Date.UTC(2026, 7, 12, 8, 16, 57) / 1000);
function descriptor(): any {
    return { url: "https://cf.ishin-global.aktsk.com/sqlite/current/en/20260812-081657/database.db", file_path: "sqlite/current/en/database.db", algorithm: "version", hash: String(descriptorVersion), version: descriptorVersion, patch: null, patch_hash: null };
}
function transport(bytes: Buffer): DatabaseArtifactTransport {
    return { async get() { return { statusCode: 200, headers: { "content-length": String(bytes.length) }, body: Readable.from([bytes]) }; } };
}
function sizedTransport(sizeBytes: number): DatabaseArtifactTransport {
    return { async get() {
        const chunk = Buffer.alloc(1024 * 1024, 0x45);
        async function* body() { let sent = 0; while (sent < sizeBytes) { const size = Math.min(chunk.length, sizeBytes - sent); sent += size; yield chunk.subarray(0, size); } }
        return { statusCode: 200, headers: { "content-length": String(sizeBytes) }, body: Readable.from(body()) };
    } };
}
async function commit(root: string, bytes: Buffer): Promise<AcquiredDatabaseArtifactResult> {
    return acquireDatabaseArtifact({ descriptor: descriptor(), storeRoot: root, transport: transport(bytes) });
}
async function commitSize(root: string, sizeBytes: number): Promise<AcquiredDatabaseArtifactResult> {
    return acquireDatabaseArtifact({ descriptor: descriptor(), storeRoot: root, transport: sizedTransport(sizeBytes) });
}
function makeWritable(path: string): void { chmodSync(path, 0o644); }
function activeSnapshots(root: string): string[] { return readdirSync(root).filter(name => name.startsWith(".c4-snapshot-") && !name.startsWith(".c4-snapshot-tombstone-")); }

describe("game DB SQLite compatibility", function () {
    this.timeout(10_000);

    it("parses only the descriptor-bound compatibility CLI", () => {
        deepEqual(parseGameDbSqliteCompatibilityArgs(["--store-root", "store", "--artifact-identity=" + "a".repeat(64), "--output-file=report.json"]), { storeRoot: "store", artifactIdentity: "a".repeat(64), outputFile: "report.json" });
        deepEqual(parseGameDbSqliteCompatibilityArgs(["--store-root=store", "--latest"]), { storeRoot: "store", useLatest: true });
        throws(() => parseGameDbSqliteCompatibilityArgs(["--sqlite-path", "database.db"]), /Unexpected/);
        throws(() => parseGameDbSqliteCompatibilityArgs(["--store-root", "store"]), /exactly one/);
        throws(() => parseGameDbSqliteCompatibilityArgs(["--store-root", "store", "--latest", "--artifact-identity", "a".repeat(64)]), /exactly one/);
        throws(() => parseGameDbSqliteCompatibilityArgs([]), /store-root/);
    });

    it("exposes no arbitrary-path evaluator or test seam from the compiled production module", () => {
        const compiledApi: any = require(resolve(process.cwd(), "lib/game-db/game-db-sqlite-compatibility.js"));
        equal(compiledApi.evaluateGameDbSqliteCompatibility, undefined);
        equal(compiledApi.GameDbSqliteCompatibilityDependencies, undefined);
        deepEqual(Object.keys(compiledApi).sort(), ["buildGameDbSqliteCompatibility", "parseGameDbSqliteCompatibilityArgs"]);
    });

    it("rejects loose SQLite paths and forged JavaScript option objects through TypeScript and compiled APIs", async () => {
        const root = temp(), sqlitePath = join(root, "database.db");
        createSqlite(sqlitePath);
        const compiledApi: any = require(resolve(process.cwd(), "lib/game-db/game-db-sqlite-compatibility.js"));
        try {
            for (const api of [buildGameDbSqliteCompatibility as any, compiledApi.buildGameDbSqliteCompatibility]) {
                await rejects(api({ sqlitePath }), /AQ artifact selector/);
                await rejects(api({ storeRoot: root, artifactIdentity: "a".repeat(64), sqlitePath }), /AQ artifact selector/);
                await rejects(api({ storeRoot: root, useLatest: true, receiptPath: "forged.json" }), /AQ artifact selector/);
                await rejects(api({ storeRoot: root, artifactIdentity: "a".repeat(64) }, { sqlitePath }), /options/);
                await rejects(api({ storeRoot: root, artifactIdentity: "a".repeat(64), signal: { aborted: false, addEventListener() {} } }), /AbortSignal/);
                const controller = new AbortController(); controller.abort();
                await rejects(api({ storeRoot: root, artifactIdentity: "a".repeat(64), signal: controller.signal }), /cancelled/);
            }
        } finally { rmSync(root, { recursive: true, force: true }); }
    });

    it("uses only a validated AQ identity with the production adapter and canonical C4 baseline", async () => {
        const root = temp(), sqlitePath = join(root, "source.db");
        createSqlite(sqlitePath);
        try {
            const acquired = await commit(root, readFileSync(sqlitePath));
            const report = await buildGameDbSqliteCompatibility({ storeRoot: root, artifactIdentity: acquired.identity });
            equal(report.status, "incompatible");
            equal(report.contractVersion, "1.2.0");
            equal(report.acquiredArtifact.identity, acquired.identity);
            equal(report.acquiredArtifact.sha256, acquired.metadata.localSha256);
            equal(report.inspectionSnapshot.acquiredArtifactIdentity, acquired.identity);
            equal(report.inspectionSnapshot.sha256, acquired.metadata.localSha256);
            equal(report.inspectionSnapshot.sizeBytes, acquired.metadata.observedSizeBytes);
            equal(report.acquiredArtifact.resolvedFromLatest, false);
            equal(report.c4Profile.snapshotVersion, "global-6.4.0-v338-2026-08-05");
            equal(report.c4Profile.sourceDatabase.actualTableCount, 1);
            equal(report.pinnedNativeEvidence.evaluatedInThisStep, false);
            equal(report.pinnedNativeEvidence.automaticReuseAuthorized, false);
            const tombstones = readdirSync(root).filter(name => name.startsWith(".c4-snapshot-tombstone-"));
            equal(readdirSync(root).some(name => name.startsWith(".c4-snapshot-") && !name.startsWith(".c4-snapshot-tombstone-")), false);
            equal(tombstones.length, 1);
            equal(statSync(join(root, tombstones[0], "snapshot", "database.db")).size, 0);
        } finally { rmSync(root, { recursive: true, force: true }); }
    });

    it("revalidates latest and its pointed commit before inspection", async () => {
        const root = temp(), sqlitePath = join(root, "source.db");
        createSqlite(sqlitePath);
        try {
            const acquired = await commit(root, readFileSync(sqlitePath));
            const report = await buildGameDbSqliteCompatibility({ storeRoot: root, useLatest: true });
            equal(report.acquiredArtifact.identity, acquired.identity);
            equal(report.acquiredArtifact.resolvedFromLatest, true);
        } finally { rmSync(root, { recursive: true, force: true }); }
    });

    it("inspects only a private snapshot when the AQ source pathname changes A to B to A", async () => {
        const root = temp(), aPath = join(root, "a.db"), bPath = join(root, "b.db"), displaced = join(root, "displaced-a.db");
        createSqlite(aPath);
        execFileSync(python(), ["-c", "import sqlite3,sys; c=sqlite3.connect(sys.argv[1]); c.execute('create table cards(id integer primary key, character_id integer)'); c.execute('create table forged_b(id integer)'); c.commit(); c.close()", bPath]);
        const originalInspect = ReadOnlySqliteAdapter.prototype.inspect;
        let swapped = false;
        try {
            const acquired = await commit(root, readFileSync(aPath));
            ReadOnlySqliteAdapter.prototype.inspect = async function () {
                equal(this.databasePath.includes(".c4-snapshot-"), true);
                makeWritable(acquired.artifactPath);
                renameSync(acquired.artifactPath, displaced);
                writeFileSync(acquired.artifactPath, readFileSync(bPath));
                chmodSync(acquired.artifactPath, 0o444);
                swapped = true;
                try { return await originalInspect.call(this); }
                finally {
                    makeWritable(acquired.artifactPath);
                    unlinkSync(acquired.artifactPath);
                    renameSync(displaced, acquired.artifactPath);
                    chmodSync(acquired.artifactPath, 0o444);
                }
            };
            const report = await buildGameDbSqliteCompatibility({ storeRoot: root, artifactIdentity: acquired.identity });
            equal(swapped, true);
            equal(report.c4Profile.sourceDatabase.actualTableCount, 1);
            equal(report.inspectionSnapshot.sha256, acquired.metadata.localSha256);
            equal(report.acquiredArtifact.sha256, report.inspectionSnapshot.sha256);
        } finally {
            ReadOnlySqliteAdapter.prototype.inspect = originalInspect;
            rmSync(root, { recursive: true, force: true });
        }
    });

    it("binds inspection bytes when the private snapshot pathname changes A to B to A", async () => {
        const root = temp(), aPath = join(root, "a.db"), bPath = join(root, "b.db");
        createSqlite(aPath);
        execFileSync(python(), ["-c", "import sqlite3,sys; c=sqlite3.connect(sys.argv[1]); c.execute('create table cards(id integer primary key, character_id integer)'); c.execute('create table forged_b(id integer)'); c.commit(); c.close()", bPath]);
        const originalInspect = ReadOnlySqliteAdapter.prototype.inspect;
        let swapped = false;
        let inspectedTableCount: number | undefined;
        try {
            const acquired = await commit(root, readFileSync(aPath));
            ReadOnlySqliteAdapter.prototype.inspect = async function () {
                const displaced = `${this.databasePath}.displaced-a`;
                renameSync(this.databasePath, displaced);
                writeFileSync(this.databasePath, readFileSync(bPath));
                chmodSync(this.databasePath, 0o444);
                swapped = true;
                try {
                    const inspection = await originalInspect.call(this);
                    inspectedTableCount = inspection.tableCount;
                    return inspection;
                }
                finally {
                    makeWritable(this.databasePath);
                    unlinkSync(this.databasePath);
                    renameSync(displaced, this.databasePath);
                }
            };
            let report: Awaited<ReturnType<typeof buildGameDbSqliteCompatibility>> | undefined;
            try { report = await buildGameDbSqliteCompatibility({ storeRoot: root, artifactIdentity: acquired.identity }); }
            catch (error) { equal(/snapshot identity changed during inspection/i.test(String(error)), true); }
            equal(swapped, true);
            equal(inspectedTableCount, 1);
            if (report) {
                equal(report.c4Profile.sourceDatabase.actualTableCount, 1);
                equal(report.inspectionSnapshot.sha256, acquired.metadata.localSha256);
                equal(report.acquiredArtifact.sha256, report.inspectionSnapshot.sha256);
            }
        } finally {
            ReadOnlySqliteAdapter.prototype.inspect = originalInspect;
            rmSync(root, { recursive: true, force: true });
        }
    });

    it("never reports exact_profile_match for a SQLite header alone", async () => {
        const root = temp();
        try {
            const acquired = await commit(root, Buffer.from("SQLite format 3\0"));
            let status: string | undefined;
            try { status = (await buildGameDbSqliteCompatibility({ storeRoot: root, artifactIdentity: acquired.identity })).status; }
            catch (error) { notEqual(String(error), ""); }
            notEqual(status, "exact_profile_match");
            equal(activeSnapshots(root).length, 0);
        } finally { rmSync(root, { recursive: true, force: true }); }
    });

    it("cleans the private snapshot when C4 cancellation reaches the adapter", async () => {
        const root = temp(), sqlitePath = join(root, "source.db"), controller = new AbortController();
        createSqlite(sqlitePath);
        const originalInspect = ReadOnlySqliteAdapter.prototype.inspect;
        try {
            const acquired = await commit(root, readFileSync(sqlitePath));
            ReadOnlySqliteAdapter.prototype.inspect = function () { controller.abort(); return originalInspect.call(this); };
            await rejects(buildGameDbSqliteCompatibility({ storeRoot: root, artifactIdentity: acquired.identity, signal: controller.signal }), /cancelled/);
            equal(activeSnapshots(root).length, 0);
            const tombstones = readdirSync(root).filter(name => name.startsWith(".c4-snapshot-tombstone-"));
            equal(tombstones.length, 1);
            equal(statSync(join(root, tombstones[0], "snapshot", "database.db")).size, 0);
        } finally {
            ReadOnlySqliteAdapter.prototype.inspect = originalInspect;
            rmSync(root, { recursive: true, force: true });
        }
    });

    it("cleans the private snapshot for every bounded bridge failure class", async function () {
        this.timeout(30_000);
        const failures = ["timed out", "stdout limit exceeded", "stderr limit exceeded", "closed stdin", "exit code 7", "invalid JSON", "unexpected trailing output"];
        const originalInspect = ReadOnlySqliteAdapter.prototype.inspect;
        try {
            for (const message of failures) {
                const root = temp(), sqlitePath = join(root, "source.db");
                createSqlite(sqlitePath);
                try {
                    const acquired = await commit(root, readFileSync(sqlitePath));
                    ReadOnlySqliteAdapter.prototype.inspect = async function () { throw new Error(message); };
                    await rejects(buildGameDbSqliteCompatibility({ storeRoot: root, artifactIdentity: acquired.identity }), new RegExp(message.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
                    equal(activeSnapshots(root).length, 0);
                    const tombstones = readdirSync(root).filter(name => name.startsWith(".c4-snapshot-tombstone-"));
                    equal(tombstones.length, 1);
                    equal(statSync(join(root, tombstones[0], "snapshot", "database.db")).size, 0);
                } finally { rmSync(root, { recursive: true, force: true }); }
            }
        } finally { ReadOnlySqliteAdapter.prototype.inspect = originalInspect; }
    });

    it("preserves an owned snapshot quarantine when bridge termination is unconfirmed", async () => {
        const root = temp(), sqlitePath = join(root, "source.db");
        createSqlite(sqlitePath);
        const originalInspect = ReadOnlySqliteAdapter.prototype.inspect;
        try {
            const acquired = await commit(root, readFileSync(sqlitePath));
            ReadOnlySqliteAdapter.prototype.inspect = async function () { throw new SqliteBridgeTerminationUnconfirmedError(); };
            await rejects(buildGameDbSqliteCompatibility({ storeRoot: root, artifactIdentity: acquired.identity }), /termination could not be confirmed/);
            equal(activeSnapshots(root).length, 0);
            const quarantines = readdirSync(root).filter(name => name.startsWith(".c4-bridge-quarantine-"));
            equal(quarantines.length, 1);
            const preserved = join(root, quarantines[0], "snapshot", "database.db");
            equal(statSync(preserved).size, acquired.metadata.observedSizeBytes);
            equal((statSync(preserved).mode & 0o222), 0);
        } finally {
            ReadOnlySqliteAdapter.prototype.inspect = originalInspect;
            rmSync(root, { recursive: true, force: true });
        }
    });

    it("accepts exactly 112 MiB and rejects the next byte before snapshot creation", async function () {
        this.timeout(120_000);
        const limit = 112 * 1024 * 1024;
        const exactRoot = temp(), overflowRoot = temp();
        try {
            const exact = await commitSize(exactRoot, limit);
            const report = await buildGameDbSqliteCompatibility({ storeRoot: exactRoot, artifactIdentity: exact.identity });
            equal(report.acquiredArtifact.sizeBytes, limit);
            equal(report.status, "unknown");
            equal(activeSnapshots(exactRoot).length, 0);

            const overflow = await commitSize(overflowRoot, limit + 1);
            await rejects(buildGameDbSqliteCompatibility({ storeRoot: overflowRoot, artifactIdentity: overflow.identity }), /112 MiB inspection limit/);
            equal(activeSnapshots(overflowRoot).length, 0);
            equal(readdirSync(overflowRoot).some(name => name.startsWith(".c4-snapshot-tombstone-")), false);
        } finally {
            rmSync(exactRoot, { recursive: true, force: true });
            rmSync(overflowRoot, { recursive: true, force: true });
        }
    });

    it("keeps descriptor-bound encrypted or packaged bytes unknown", async () => {
        const root = temp();
        try {
            const acquired = await commit(root, Buffer.from("encrypted-or-packaged"));
            const report = await buildGameDbSqliteCompatibility({ storeRoot: root, artifactIdentity: acquired.identity });
            equal(report.status, "unknown");
            equal(report.acquiredArtifactState, "encrypted_or_packaged");
            equal(report.c4Profile.sourceDatabase.actualSha256, null);
        } finally { rmSync(root, { recursive: true, force: true }); }
    });

    it("fails closed for forged metadata, marker, identity and latest pointer through the compiled API", async () => {
        const compiledApi: any = require(resolve(process.cwd(), "lib/game-db/game-db-sqlite-compatibility.js"));
        for (const variant of ["metadata", "marker", "identity", "latest"] as const) {
            const root = temp();
            try {
                const acquired = await commit(root, Buffer.from("encrypted-or-packaged-" + variant));
                if (variant === "metadata") {
                    makeWritable(acquired.metadataPath);
                    const value = JSON.parse(readFileSync(acquired.metadataPath, "utf8"));
                    value.databaseVersion += 1;
                    writeFileSync(acquired.metadataPath, `${JSON.stringify(value, null, 2)}\n`);
                } else if (variant === "marker") {
                    makeWritable(acquired.commitMarkerPath);
                    writeFileSync(acquired.commitMarkerPath, "{}\n");
                } else if (variant === "latest") {
                    makeWritable(acquired.pointerRecordPath);
                    writeFileSync(acquired.pointerRecordPath, "{}\n");
                }
                const options = variant === "identity"
                    ? { storeRoot: root, artifactIdentity: "f".repeat(64) }
                    : variant === "latest" ? { storeRoot: root, useLatest: true } : { storeRoot: root, artifactIdentity: acquired.identity };
                await rejects(compiledApi.buildGameDbSqliteCompatibility(options), /artifact|commit|identity|latest|pointer|read-only|journal/i, variant);
            } finally { rmSync(root, { recursive: true, force: true }); }
        }
    });

    it("rejects a real junction store root", async () => {
        const root = temp(), linkedContainer = temp(), linkedRoot = join(linkedContainer, "linked-store");
        try {
            await commit(root, Buffer.from("encrypted"));
            symlinkSync(root, linkedRoot, process.platform === "win32" ? "junction" : "dir");
            await rejects(buildGameDbSqliteCompatibility({ storeRoot: linkedRoot, useLatest: true }), /directory|symlink|junction|reparse/);
        } finally {
            rmSync(root, { recursive: true, force: true });
            rmSync(linkedContainer, { recursive: true, force: true });
        }
    });
});
