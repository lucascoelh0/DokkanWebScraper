import { deepEqual, equal, notEqual, rejects, throws } from "assert";
import { execFileSync } from "child_process";
import { mkdtempSync, rmSync, symlinkSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { buildGameDbSqliteCompatibility, parseGameDbSqliteCompatibilityArgs } from "./game-db-sqlite-compatibility";

function temp(): string { return mkdtempSync(join(tmpdir(), "dokkan-c4-closed-api-")); }
function python(): string { return process.platform === "win32" ? "python" : "python3"; }
function createSqlite(path: string): void {
    execFileSync(python(), ["-c", "import sqlite3,sys; c=sqlite3.connect(sys.argv[1]); c.execute('create table cards(id integer primary key, character_id integer)'); c.commit(); c.close()", path]);
}

describe("game DB SQLite compatibility", function () {
    this.timeout(10_000);

    it("parses only the bounded manual compatibility CLI", () => {
        deepEqual(parseGameDbSqliteCompatibilityArgs(["--sqlite-path", "database.db", "--output-file=report.json"]), { sqlitePath: "database.db", outputFile: "report.json" });
        deepEqual(parseGameDbSqliteCompatibilityArgs(["--sqlite-path=database.db"]), { sqlitePath: "database.db" });
        throws(() => parseGameDbSqliteCompatibilityArgs(["--baseline-file", "forged.json", "--sqlite-path", "database.db"]), /Unexpected/);
        throws(() => parseGameDbSqliteCompatibilityArgs(["--python-command", "forged", "--sqlite-path", "database.db"]), /Unexpected/);
        throws(() => parseGameDbSqliteCompatibilityArgs(["--url", "https://example.test"]), /Unexpected/);
        throws(() => parseGameDbSqliteCompatibilityArgs([]), /sqlite-path/);
    });

    it("exposes no evaluator or test seam from the compiled production module", () => {
        const compiledApi: any = require("./game-db-sqlite-compatibility");
        equal(compiledApi.evaluateGameDbSqliteCompatibility, undefined);
        equal(compiledApi.GameDbSqliteCompatibilityDependencies, undefined);
        deepEqual(Object.keys(compiledApi).sort(), ["buildGameDbSqliteCompatibility", "parseGameDbSqliteCompatibilityArgs"]);
    });

    it("rejects forged JavaScript option objects and positional dependencies", async () => {
        const root = temp(), sqlitePath = join(root, "database.db");
        createSqlite(sqlitePath);
        const compiledApi: any = require("./game-db-sqlite-compatibility");
        const inspection = { tableCount: 0, tables: [] };
        try {
            for (const forged of [
                { sqlitePath, baselineFile: join(root, "baseline.json") },
                { sqlitePath, inspectSqlite: async () => inspection },
                { sqlitePath, hooks: { afterInspection() {} } },
                { sqlitePath, pythonCommand: "forged" },
                { sqlitePath, outputFile: join(root, "report.json") },
            ]) await rejects(compiledApi.buildGameDbSqliteCompatibility(forged), /only sqlitePath/);
            await rejects(compiledApi.buildGameDbSqliteCompatibility({ sqlitePath }, { inspectSqlite: async () => inspection }), /only sqlitePath/);
        } finally { rmSync(root, { recursive: true, force: true }); }
    });

    it("uses the production read-only adapter and canonical C4 baseline", async () => {
        const root = temp(), sqlitePath = join(root, "database.db");
        createSqlite(sqlitePath);
        try {
            const report = await buildGameDbSqliteCompatibility({ sqlitePath });
            equal(report.status, "incompatible");
            equal(report.c4Profile.snapshotVersion, "global-6.4.0-v338-2026-08-05");
            equal(report.c4Profile.sourceDatabase.actualTableCount, 1);
            equal(report.pinnedNativeEvidence.evaluatedInThisStep, false);
            equal(report.pinnedNativeEvidence.automaticReuseAuthorized, false);
        } finally { rmSync(root, { recursive: true, force: true }); }
    });

    it("never reports exact_profile_match for a SQLite header alone", async () => {
        const root = temp(), sqlitePath = join(root, "header-only.db");
        writeFileSync(sqlitePath, Buffer.from("SQLite format 3\0"));
        try {
            let status: string | undefined;
            try { status = (await buildGameDbSqliteCompatibility({ sqlitePath })).status; }
            catch (error) { notEqual(String(error), ""); }
            notEqual(status, "exact_profile_match");
        } finally { rmSync(root, { recursive: true, force: true }); }
    });

    it("keeps encrypted or packaged bytes unknown", async () => {
        const root = temp(), artifactPath = join(root, "database.db");
        writeFileSync(artifactPath, Buffer.from("encrypted-or-packaged"));
        try {
            const report = await buildGameDbSqliteCompatibility({ sqlitePath: artifactPath });
            equal(report.status, "unknown");
            equal(report.c4Profile.sourceDatabase.actualSha256, null);
        } finally { rmSync(root, { recursive: true, force: true }); }
    });

    it("rejects symlinked SQLite inputs", async function () {
        const root = temp(), sqlitePath = join(root, "database.db"), linkedPath = join(root, "linked.db");
        createSqlite(sqlitePath);
        try {
            try { symlinkSync(sqlitePath, linkedPath, "file"); }
            catch (error: any) { if (error?.code === "EPERM") { this.skip(); return; } throw error; }
            await rejects(buildGameDbSqliteCompatibility({ sqlitePath: linkedPath }), /regular file/);
        } finally { rmSync(root, { recursive: true, force: true }); }
    });
});
