"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = require("assert");
const child_process_1 = require("child_process");
const fs_1 = require("fs");
const os_1 = require("os");
const path_1 = require("path");
const stream_1 = require("stream");
const sqlite_readonly_adapter_1 = require("../database-experiment/sqlite-readonly-adapter");
const game_db_download_database_artifact_1 = require("./game-db-download-database-artifact");
const game_db_sqlite_compatibility_1 = require("./game-db-sqlite-compatibility");
function temp() { return (0, fs_1.mkdtempSync)((0, path_1.join)((0, os_1.tmpdir)(), "dokkan-c4-closed-api-")); }
function python() { return process.platform === "win32" ? "python" : "python3"; }
function createSqlite(path) {
    (0, child_process_1.execFileSync)(python(), ["-c", "import sqlite3,sys; c=sqlite3.connect(sys.argv[1]); c.execute('create table cards(id integer primary key, character_id integer)'); c.commit(); c.close()", path]);
}
const descriptorVersion = Math.floor(Date.UTC(2026, 7, 12, 8, 16, 57) / 1000);
function descriptor() {
    return { url: "https://cf.ishin-global.aktsk.com/sqlite/current/en/20260812-081657/database.db", file_path: "sqlite/current/en/database.db", algorithm: "version", hash: String(descriptorVersion), version: descriptorVersion, patch: null, patch_hash: null };
}
function transport(bytes) {
    return { async get() { return { statusCode: 200, headers: { "content-length": String(bytes.length) }, body: stream_1.Readable.from([bytes]) }; } };
}
async function commit(root, bytes) {
    return (0, game_db_download_database_artifact_1.acquireDatabaseArtifact)({ descriptor: descriptor(), storeRoot: root, transport: transport(bytes) });
}
function makeWritable(path) { (0, fs_1.chmodSync)(path, 0o644); }
describe("game DB SQLite compatibility", function () {
    this.timeout(10000);
    it("parses only the descriptor-bound compatibility CLI", () => {
        (0, assert_1.deepEqual)((0, game_db_sqlite_compatibility_1.parseGameDbSqliteCompatibilityArgs)(["--store-root", "store", "--artifact-identity=" + "a".repeat(64), "--output-file=report.json"]), { storeRoot: "store", artifactIdentity: "a".repeat(64), outputFile: "report.json" });
        (0, assert_1.deepEqual)((0, game_db_sqlite_compatibility_1.parseGameDbSqliteCompatibilityArgs)(["--store-root=store", "--latest"]), { storeRoot: "store", useLatest: true });
        (0, assert_1.throws)(() => (0, game_db_sqlite_compatibility_1.parseGameDbSqliteCompatibilityArgs)(["--sqlite-path", "database.db"]), /Unexpected/);
        (0, assert_1.throws)(() => (0, game_db_sqlite_compatibility_1.parseGameDbSqliteCompatibilityArgs)(["--store-root", "store"]), /exactly one/);
        (0, assert_1.throws)(() => (0, game_db_sqlite_compatibility_1.parseGameDbSqliteCompatibilityArgs)(["--store-root", "store", "--latest", "--artifact-identity", "a".repeat(64)]), /exactly one/);
        (0, assert_1.throws)(() => (0, game_db_sqlite_compatibility_1.parseGameDbSqliteCompatibilityArgs)([]), /store-root/);
    });
    it("exposes no arbitrary-path evaluator or test seam from the compiled production module", () => {
        const compiledApi = require((0, path_1.resolve)(process.cwd(), "lib/game-db/game-db-sqlite-compatibility.js"));
        (0, assert_1.equal)(compiledApi.evaluateGameDbSqliteCompatibility, undefined);
        (0, assert_1.equal)(compiledApi.GameDbSqliteCompatibilityDependencies, undefined);
        (0, assert_1.deepEqual)(Object.keys(compiledApi).sort(), ["buildGameDbSqliteCompatibility", "parseGameDbSqliteCompatibilityArgs"]);
    });
    it("rejects loose SQLite paths and forged JavaScript option objects through TypeScript and compiled APIs", async () => {
        const root = temp(), sqlitePath = (0, path_1.join)(root, "database.db");
        createSqlite(sqlitePath);
        const compiledApi = require((0, path_1.resolve)(process.cwd(), "lib/game-db/game-db-sqlite-compatibility.js"));
        try {
            for (const api of [game_db_sqlite_compatibility_1.buildGameDbSqliteCompatibility, compiledApi.buildGameDbSqliteCompatibility]) {
                await (0, assert_1.rejects)(api({ sqlitePath }), /AQ artifact selector/);
                await (0, assert_1.rejects)(api({ storeRoot: root, artifactIdentity: "a".repeat(64), sqlitePath }), /AQ artifact selector/);
                await (0, assert_1.rejects)(api({ storeRoot: root, useLatest: true, receiptPath: "forged.json" }), /AQ artifact selector/);
                await (0, assert_1.rejects)(api({ storeRoot: root, artifactIdentity: "a".repeat(64) }, { sqlitePath }), /options/);
            }
        }
        finally {
            (0, fs_1.rmSync)(root, { recursive: true, force: true });
        }
    });
    it("uses only a validated AQ identity with the production adapter and canonical C4 baseline", async () => {
        const root = temp(), sqlitePath = (0, path_1.join)(root, "source.db");
        createSqlite(sqlitePath);
        try {
            const acquired = await commit(root, (0, fs_1.readFileSync)(sqlitePath));
            const report = await (0, game_db_sqlite_compatibility_1.buildGameDbSqliteCompatibility)({ storeRoot: root, artifactIdentity: acquired.identity });
            (0, assert_1.equal)(report.status, "incompatible");
            (0, assert_1.equal)(report.contractVersion, "1.2.0");
            (0, assert_1.equal)(report.acquiredArtifact.identity, acquired.identity);
            (0, assert_1.equal)(report.acquiredArtifact.sha256, acquired.metadata.localSha256);
            (0, assert_1.equal)(report.inspectionSnapshot.acquiredArtifactIdentity, acquired.identity);
            (0, assert_1.equal)(report.inspectionSnapshot.sha256, acquired.metadata.localSha256);
            (0, assert_1.equal)(report.inspectionSnapshot.sizeBytes, acquired.metadata.observedSizeBytes);
            (0, assert_1.equal)(report.acquiredArtifact.resolvedFromLatest, false);
            (0, assert_1.equal)(report.c4Profile.snapshotVersion, "global-6.4.0-v338-2026-08-05");
            (0, assert_1.equal)(report.c4Profile.sourceDatabase.actualTableCount, 1);
            (0, assert_1.equal)(report.pinnedNativeEvidence.evaluatedInThisStep, false);
            (0, assert_1.equal)(report.pinnedNativeEvidence.automaticReuseAuthorized, false);
            const tombstones = (0, fs_1.readdirSync)(root).filter(name => name.startsWith(".c4-snapshot-tombstone-"));
            (0, assert_1.equal)((0, fs_1.readdirSync)(root).some(name => name.startsWith(".c4-snapshot-") && !name.startsWith(".c4-snapshot-tombstone-")), false);
            (0, assert_1.equal)(tombstones.length, 1);
            (0, assert_1.equal)((0, fs_1.statSync)((0, path_1.join)(root, tombstones[0], "snapshot", "database.db")).size, 0);
        }
        finally {
            (0, fs_1.rmSync)(root, { recursive: true, force: true });
        }
    });
    it("revalidates latest and its pointed commit before inspection", async () => {
        const root = temp(), sqlitePath = (0, path_1.join)(root, "source.db");
        createSqlite(sqlitePath);
        try {
            const acquired = await commit(root, (0, fs_1.readFileSync)(sqlitePath));
            const report = await (0, game_db_sqlite_compatibility_1.buildGameDbSqliteCompatibility)({ storeRoot: root, useLatest: true });
            (0, assert_1.equal)(report.acquiredArtifact.identity, acquired.identity);
            (0, assert_1.equal)(report.acquiredArtifact.resolvedFromLatest, true);
        }
        finally {
            (0, fs_1.rmSync)(root, { recursive: true, force: true });
        }
    });
    it("inspects only a private snapshot when the AQ source pathname changes A to B to A", async () => {
        const root = temp(), aPath = (0, path_1.join)(root, "a.db"), bPath = (0, path_1.join)(root, "b.db"), displaced = (0, path_1.join)(root, "displaced-a.db");
        createSqlite(aPath);
        (0, child_process_1.execFileSync)(python(), ["-c", "import sqlite3,sys; c=sqlite3.connect(sys.argv[1]); c.execute('create table cards(id integer primary key, character_id integer)'); c.execute('create table forged_b(id integer)'); c.commit(); c.close()", bPath]);
        const originalInspect = sqlite_readonly_adapter_1.ReadOnlySqliteAdapter.prototype.inspect;
        let swapped = false;
        try {
            const acquired = await commit(root, (0, fs_1.readFileSync)(aPath));
            sqlite_readonly_adapter_1.ReadOnlySqliteAdapter.prototype.inspect = async function () {
                (0, assert_1.equal)(this.databasePath.includes(".c4-snapshot-"), true);
                makeWritable(acquired.artifactPath);
                (0, fs_1.renameSync)(acquired.artifactPath, displaced);
                (0, fs_1.writeFileSync)(acquired.artifactPath, (0, fs_1.readFileSync)(bPath));
                (0, fs_1.chmodSync)(acquired.artifactPath, 0o444);
                swapped = true;
                try {
                    return await originalInspect.call(this);
                }
                finally {
                    makeWritable(acquired.artifactPath);
                    (0, fs_1.unlinkSync)(acquired.artifactPath);
                    (0, fs_1.renameSync)(displaced, acquired.artifactPath);
                    (0, fs_1.chmodSync)(acquired.artifactPath, 0o444);
                }
            };
            const report = await (0, game_db_sqlite_compatibility_1.buildGameDbSqliteCompatibility)({ storeRoot: root, artifactIdentity: acquired.identity });
            (0, assert_1.equal)(swapped, true);
            (0, assert_1.equal)(report.c4Profile.sourceDatabase.actualTableCount, 1);
            (0, assert_1.equal)(report.inspectionSnapshot.sha256, acquired.metadata.localSha256);
            (0, assert_1.equal)(report.acquiredArtifact.sha256, report.inspectionSnapshot.sha256);
        }
        finally {
            sqlite_readonly_adapter_1.ReadOnlySqliteAdapter.prototype.inspect = originalInspect;
            (0, fs_1.rmSync)(root, { recursive: true, force: true });
        }
    });
    it("never reports exact_profile_match for a SQLite header alone", async () => {
        const root = temp();
        try {
            const acquired = await commit(root, Buffer.from("SQLite format 3\0"));
            let status;
            try {
                status = (await (0, game_db_sqlite_compatibility_1.buildGameDbSqliteCompatibility)({ storeRoot: root, artifactIdentity: acquired.identity })).status;
            }
            catch (error) {
                (0, assert_1.notEqual)(String(error), "");
            }
            (0, assert_1.notEqual)(status, "exact_profile_match");
        }
        finally {
            (0, fs_1.rmSync)(root, { recursive: true, force: true });
        }
    });
    it("keeps descriptor-bound encrypted or packaged bytes unknown", async () => {
        const root = temp();
        try {
            const acquired = await commit(root, Buffer.from("encrypted-or-packaged"));
            const report = await (0, game_db_sqlite_compatibility_1.buildGameDbSqliteCompatibility)({ storeRoot: root, artifactIdentity: acquired.identity });
            (0, assert_1.equal)(report.status, "unknown");
            (0, assert_1.equal)(report.acquiredArtifactState, "encrypted_or_packaged");
            (0, assert_1.equal)(report.c4Profile.sourceDatabase.actualSha256, null);
        }
        finally {
            (0, fs_1.rmSync)(root, { recursive: true, force: true });
        }
    });
    it("fails closed for forged metadata, marker, identity and latest pointer through the compiled API", async () => {
        const compiledApi = require((0, path_1.resolve)(process.cwd(), "lib/game-db/game-db-sqlite-compatibility.js"));
        for (const variant of ["metadata", "marker", "identity", "latest"]) {
            const root = temp();
            try {
                const acquired = await commit(root, Buffer.from("encrypted-or-packaged-" + variant));
                if (variant === "metadata") {
                    makeWritable(acquired.metadataPath);
                    const value = JSON.parse((0, fs_1.readFileSync)(acquired.metadataPath, "utf8"));
                    value.databaseVersion += 1;
                    (0, fs_1.writeFileSync)(acquired.metadataPath, `${JSON.stringify(value, null, 2)}\n`);
                }
                else if (variant === "marker") {
                    makeWritable(acquired.commitMarkerPath);
                    (0, fs_1.writeFileSync)(acquired.commitMarkerPath, "{}\n");
                }
                else if (variant === "latest") {
                    makeWritable(acquired.pointerRecordPath);
                    (0, fs_1.writeFileSync)(acquired.pointerRecordPath, "{}\n");
                }
                const options = variant === "identity"
                    ? { storeRoot: root, artifactIdentity: "f".repeat(64) }
                    : variant === "latest" ? { storeRoot: root, useLatest: true } : { storeRoot: root, artifactIdentity: acquired.identity };
                await (0, assert_1.rejects)(compiledApi.buildGameDbSqliteCompatibility(options), /artifact|commit|identity|latest|pointer|read-only|journal/i, variant);
            }
            finally {
                (0, fs_1.rmSync)(root, { recursive: true, force: true });
            }
        }
    });
    it("rejects a real junction store root", async () => {
        const root = temp(), linkedContainer = temp(), linkedRoot = (0, path_1.join)(linkedContainer, "linked-store");
        try {
            await commit(root, Buffer.from("encrypted"));
            (0, fs_1.symlinkSync)(root, linkedRoot, process.platform === "win32" ? "junction" : "dir");
            await (0, assert_1.rejects)((0, game_db_sqlite_compatibility_1.buildGameDbSqliteCompatibility)({ storeRoot: linkedRoot, useLatest: true }), /directory|symlink|junction|reparse/);
        }
        finally {
            (0, fs_1.rmSync)(root, { recursive: true, force: true });
            (0, fs_1.rmSync)(linkedContainer, { recursive: true, force: true });
        }
    });
});
//# sourceMappingURL=game-db-sqlite-compatibility.spec.js.map