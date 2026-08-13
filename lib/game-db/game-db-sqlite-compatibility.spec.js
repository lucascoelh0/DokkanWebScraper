"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = require("assert");
const child_process_1 = require("child_process");
const fs_1 = require("fs");
const os_1 = require("os");
const path_1 = require("path");
const game_db_sqlite_compatibility_1 = require("./game-db-sqlite-compatibility");
function temp() { return (0, fs_1.mkdtempSync)((0, path_1.join)((0, os_1.tmpdir)(), "dokkan-c4-closed-api-")); }
function python() { return process.platform === "win32" ? "python" : "python3"; }
function createSqlite(path) {
    (0, child_process_1.execFileSync)(python(), ["-c", "import sqlite3,sys; c=sqlite3.connect(sys.argv[1]); c.execute('create table cards(id integer primary key, character_id integer)'); c.commit(); c.close()", path]);
}
describe("game DB SQLite compatibility", function () {
    this.timeout(10000);
    it("parses only the bounded manual compatibility CLI", () => {
        (0, assert_1.deepEqual)((0, game_db_sqlite_compatibility_1.parseGameDbSqliteCompatibilityArgs)(["--sqlite-path", "database.db", "--output-file=report.json"]), { sqlitePath: "database.db", outputFile: "report.json" });
        (0, assert_1.deepEqual)((0, game_db_sqlite_compatibility_1.parseGameDbSqliteCompatibilityArgs)(["--sqlite-path=database.db"]), { sqlitePath: "database.db" });
        (0, assert_1.throws)(() => (0, game_db_sqlite_compatibility_1.parseGameDbSqliteCompatibilityArgs)(["--baseline-file", "forged.json", "--sqlite-path", "database.db"]), /Unexpected/);
        (0, assert_1.throws)(() => (0, game_db_sqlite_compatibility_1.parseGameDbSqliteCompatibilityArgs)(["--python-command", "forged", "--sqlite-path", "database.db"]), /Unexpected/);
        (0, assert_1.throws)(() => (0, game_db_sqlite_compatibility_1.parseGameDbSqliteCompatibilityArgs)(["--url", "https://example.test"]), /Unexpected/);
        (0, assert_1.throws)(() => (0, game_db_sqlite_compatibility_1.parseGameDbSqliteCompatibilityArgs)([]), /sqlite-path/);
    });
    it("exposes no evaluator or test seam from the compiled production module", () => {
        const compiledApi = require("./game-db-sqlite-compatibility");
        (0, assert_1.equal)(compiledApi.evaluateGameDbSqliteCompatibility, undefined);
        (0, assert_1.equal)(compiledApi.GameDbSqliteCompatibilityDependencies, undefined);
        (0, assert_1.deepEqual)(Object.keys(compiledApi).sort(), ["buildGameDbSqliteCompatibility", "parseGameDbSqliteCompatibilityArgs"]);
    });
    it("rejects forged JavaScript option objects and positional dependencies", async () => {
        const root = temp(), sqlitePath = (0, path_1.join)(root, "database.db");
        createSqlite(sqlitePath);
        const compiledApi = require("./game-db-sqlite-compatibility");
        const inspection = { tableCount: 0, tables: [] };
        try {
            for (const forged of [
                { sqlitePath, baselineFile: (0, path_1.join)(root, "baseline.json") },
                { sqlitePath, inspectSqlite: async () => inspection },
                { sqlitePath, hooks: { afterInspection() { } } },
                { sqlitePath, pythonCommand: "forged" },
                { sqlitePath, outputFile: (0, path_1.join)(root, "report.json") },
            ])
                await (0, assert_1.rejects)(compiledApi.buildGameDbSqliteCompatibility(forged), /only sqlitePath/);
            await (0, assert_1.rejects)(compiledApi.buildGameDbSqliteCompatibility({ sqlitePath }, { inspectSqlite: async () => inspection }), /only sqlitePath/);
        }
        finally {
            (0, fs_1.rmSync)(root, { recursive: true, force: true });
        }
    });
    it("uses the production read-only adapter and canonical C4 baseline", async () => {
        const root = temp(), sqlitePath = (0, path_1.join)(root, "database.db");
        createSqlite(sqlitePath);
        try {
            const report = await (0, game_db_sqlite_compatibility_1.buildGameDbSqliteCompatibility)({ sqlitePath });
            (0, assert_1.equal)(report.status, "incompatible");
            (0, assert_1.equal)(report.c4Profile.snapshotVersion, "global-6.4.0-v338-2026-08-05");
            (0, assert_1.equal)(report.c4Profile.sourceDatabase.actualTableCount, 1);
            (0, assert_1.equal)(report.pinnedNativeEvidence.evaluatedInThisStep, false);
            (0, assert_1.equal)(report.pinnedNativeEvidence.automaticReuseAuthorized, false);
        }
        finally {
            (0, fs_1.rmSync)(root, { recursive: true, force: true });
        }
    });
    it("never reports exact_profile_match for a SQLite header alone", async () => {
        const root = temp(), sqlitePath = (0, path_1.join)(root, "header-only.db");
        (0, fs_1.writeFileSync)(sqlitePath, Buffer.from("SQLite format 3\0"));
        try {
            let status;
            try {
                status = (await (0, game_db_sqlite_compatibility_1.buildGameDbSqliteCompatibility)({ sqlitePath })).status;
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
    it("keeps encrypted or packaged bytes unknown", async () => {
        const root = temp(), artifactPath = (0, path_1.join)(root, "database.db");
        (0, fs_1.writeFileSync)(artifactPath, Buffer.from("encrypted-or-packaged"));
        try {
            const report = await (0, game_db_sqlite_compatibility_1.buildGameDbSqliteCompatibility)({ sqlitePath: artifactPath });
            (0, assert_1.equal)(report.status, "unknown");
            (0, assert_1.equal)(report.c4Profile.sourceDatabase.actualSha256, null);
        }
        finally {
            (0, fs_1.rmSync)(root, { recursive: true, force: true });
        }
    });
    it("rejects symlinked SQLite inputs", async function () {
        const root = temp(), sqlitePath = (0, path_1.join)(root, "database.db"), linkedPath = (0, path_1.join)(root, "linked.db");
        createSqlite(sqlitePath);
        try {
            try {
                (0, fs_1.symlinkSync)(sqlitePath, linkedPath, "file");
            }
            catch (error) {
                if (error?.code === "EPERM") {
                    this.skip();
                    return;
                }
                throw error;
            }
            await (0, assert_1.rejects)((0, game_db_sqlite_compatibility_1.buildGameDbSqliteCompatibility)({ sqlitePath: linkedPath }), /regular file/);
        }
        finally {
            (0, fs_1.rmSync)(root, { recursive: true, force: true });
        }
    });
});
//# sourceMappingURL=game-db-sqlite-compatibility.spec.js.map