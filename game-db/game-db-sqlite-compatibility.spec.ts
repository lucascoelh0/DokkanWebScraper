import { deepEqual, equal, notEqual, rejects, throws } from "assert";
import { execFileSync } from "child_process";
import { chmodSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { Readable } from "stream";
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
async function commit(root: string, bytes: Buffer): Promise<AcquiredDatabaseArtifactResult> {
    return acquireDatabaseArtifact({ descriptor: descriptor(), storeRoot: root, transport: transport(bytes) });
}
function makeWritable(path: string): void { chmodSync(path, 0o644); }

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
        const compiledApi: any = require("./game-db-sqlite-compatibility");
        equal(compiledApi.evaluateGameDbSqliteCompatibility, undefined);
        equal(compiledApi.GameDbSqliteCompatibilityDependencies, undefined);
        deepEqual(Object.keys(compiledApi).sort(), ["buildGameDbSqliteCompatibility", "parseGameDbSqliteCompatibilityArgs"]);
    });

    it("rejects loose SQLite paths and forged JavaScript option objects through TypeScript and compiled APIs", async () => {
        const root = temp(), sqlitePath = join(root, "database.db");
        createSqlite(sqlitePath);
        const compiledApi: any = require("./game-db-sqlite-compatibility");
        try {
            for (const api of [buildGameDbSqliteCompatibility as any, compiledApi.buildGameDbSqliteCompatibility]) {
                await rejects(api({ sqlitePath }), /AQ artifact selector/);
                await rejects(api({ storeRoot: root, artifactIdentity: "a".repeat(64), sqlitePath }), /AQ artifact selector/);
                await rejects(api({ storeRoot: root, useLatest: true, receiptPath: "forged.json" }), /AQ artifact selector/);
                await rejects(api({ storeRoot: root, artifactIdentity: "a".repeat(64) }, { sqlitePath }), /options/);
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
            equal(report.contractVersion, "1.1.0");
            equal(report.acquiredArtifact.identity, acquired.identity);
            equal(report.acquiredArtifact.sha256, acquired.metadata.localSha256);
            equal(report.acquiredArtifact.resolvedFromLatest, false);
            equal(report.c4Profile.snapshotVersion, "global-6.4.0-v338-2026-08-05");
            equal(report.c4Profile.sourceDatabase.actualTableCount, 1);
            equal(report.pinnedNativeEvidence.evaluatedInThisStep, false);
            equal(report.pinnedNativeEvidence.automaticReuseAuthorized, false);
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

    it("never reports exact_profile_match for a SQLite header alone", async () => {
        const root = temp();
        try {
            const acquired = await commit(root, Buffer.from("SQLite format 3\0"));
            let status: string | undefined;
            try { status = (await buildGameDbSqliteCompatibility({ storeRoot: root, artifactIdentity: acquired.identity })).status; }
            catch (error) { notEqual(String(error), ""); }
            notEqual(status, "exact_profile_match");
        } finally { rmSync(root, { recursive: true, force: true }); }
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
        const compiledApi: any = require("./game-db-sqlite-compatibility");
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
                    writeFileSync(acquired.latestPointerPath, "{}\n");
                }
                const options = variant === "identity"
                    ? { storeRoot: root, artifactIdentity: "f".repeat(64) }
                    : variant === "latest" ? { storeRoot: root, useLatest: true } : { storeRoot: root, artifactIdentity: acquired.identity };
                await rejects(compiledApi.buildGameDbSqliteCompatibility(options), /artifact|commit|identity|latest|pointer|read-only/i, variant);
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
