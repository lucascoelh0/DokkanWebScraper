"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = require("assert");
const crypto_1 = require("crypto");
const fs_1 = require("fs");
const os_1 = require("os");
const path_1 = require("path");
const game_db_sqlite_compatibility_1 = require("./game-db-sqlite-compatibility");
const integration_c4_builder_1 = require("../database-integration/integration-c4-builder");
const inspection = {
    tableCount: 2,
    tables: [
        { name: "cards", columns: ["id", "character_id"], rowCount: 1 },
        { name: "passive_skills", columns: ["id", "efficacy_type"], rowCount: 2 },
    ],
};
const databaseSha256 = (0, crypto_1.createHash)("sha256").update("database").digest("hex");
const evidenceSha256 = (0, crypto_1.createHash)("sha256").update("evidence").digest("hex");
const baseline = {
    schemaVersion: 1,
    contractVersion: "1.0.0",
    snapshotVersion: "global-profile",
    sourceDatabase: {
        sha256: databaseSha256,
        sizeBytes: 100,
        tableCount: inspection.tableCount,
        schemaSha256: (0, integration_c4_builder_1.integrationC4SchemaSha256)(inspection),
        requiredTables: { cards: ["id", "character_id"], passive_skills: ["id", "efficacy_type"] },
    },
    nativeRuntime: { sha256: evidenceSha256, sizeBytes: 200, elfClass: 64, endian: "little", machine: 183 },
    semanticInputs: {
        DB48: { contractVersion: "1", sha256: evidenceSha256 },
        DB49: { contractVersion: "1", sha256: evidenceSha256 },
        DB50: { contractVersion: "1", sha256: evidenceSha256 },
    },
};
function temp() { return (0, fs_1.mkdtempSync)((0, path_1.join)((0, os_1.tmpdir)(), "dokkan-c4-toctou-")); }
function sqliteBytes(fill) { return Buffer.concat([Buffer.from("SQLite format 3\0"), Buffer.alloc(64, fill)]); }
function runtimeBaseline(root, bytes) {
    const value = JSON.parse(JSON.stringify(baseline));
    value.sourceDatabase.sha256 = (0, crypto_1.createHash)("sha256").update(bytes).digest("hex");
    value.sourceDatabase.sizeBytes = bytes.byteLength;
    value.sourceDatabase.tableCount = inspection.tableCount;
    value.sourceDatabase.schemaSha256 = (0, integration_c4_builder_1.integrationC4SchemaSha256)(inspection);
    const path = (0, path_1.join)(root, "baseline.json");
    (0, fs_1.writeFileSync)(path, JSON.stringify(value));
    return path;
}
describe("game DB SQLite compatibility", () => {
    it("classifies an exact SQLite profile without authorizing native evidence reuse", () => {
        const report = (0, game_db_sqlite_compatibility_1.evaluateGameDbSqliteCompatibility)({ baseline, acquiredArtifactState: "readable_sqlite", sourceDatabase: { sha256: databaseSha256, sizeBytes: 100, inspection } });
        (0, assert_1.equal)(report.status, "exact_profile_match");
        (0, assert_1.equal)(report.pinnedNativeEvidence.evaluatedInThisStep, false);
        (0, assert_1.equal)(report.pinnedNativeEvidence.automaticReuseAuthorized, false);
        (0, assert_1.equal)(report.nextPermittedStep, "run_c4_with_exact_pinned_elf_and_semantic_artifacts");
    });
    it("requires evidence refresh for a schema-compatible changed SQLite", () => {
        const report = (0, game_db_sqlite_compatibility_1.evaluateGameDbSqliteCompatibility)({ baseline, acquiredArtifactState: "readable_sqlite", sourceDatabase: { sha256: "a".repeat(64), sizeBytes: 101, inspection } });
        (0, assert_1.equal)(report.status, "schema_compatible_but_evidence_refresh_required");
        (0, assert_1.equal)(report.nextPermittedStep, "refresh_bounded_native_evidence_then_review_c4_baseline");
    });
    it("rejects missing required columns", () => {
        const changed = JSON.parse(JSON.stringify(inspection));
        changed.tables[1].columns = ["id"];
        const report = (0, game_db_sqlite_compatibility_1.evaluateGameDbSqliteCompatibility)({ baseline, acquiredArtifactState: "readable_sqlite", sourceDatabase: { sha256: "b".repeat(64), sizeBytes: 90, inspection: changed } });
        (0, assert_1.equal)(report.status, "incompatible");
        (0, assert_1.deepEqual)(report.c4Profile.missingRequiredColumns, ["passive_skills.efficacy_type"]);
    });
    it("keeps encrypted or packaged bytes unknown until local decryption", () => {
        const report = (0, game_db_sqlite_compatibility_1.evaluateGameDbSqliteCompatibility)({ baseline, acquiredArtifactState: "encrypted_or_packaged" });
        (0, assert_1.equal)(report.status, "unknown");
        (0, assert_1.equal)(report.c4Profile.sourceDatabase.actualSha256, null);
    });
    it("is deterministic and fails closed on malformed inputs", () => {
        const input = { baseline, acquiredArtifactState: "readable_sqlite", sourceDatabase: { sha256: databaseSha256, sizeBytes: 100, inspection } };
        (0, assert_1.equal)(JSON.stringify((0, game_db_sqlite_compatibility_1.evaluateGameDbSqliteCompatibility)(input)), JSON.stringify((0, game_db_sqlite_compatibility_1.evaluateGameDbSqliteCompatibility)(input)));
        (0, assert_1.throws)(() => (0, game_db_sqlite_compatibility_1.evaluateGameDbSqliteCompatibility)({ ...input, sourceDatabase: { ...input.sourceDatabase, sha256: "bad" } }), /identity/);
        (0, assert_1.throws)(() => (0, game_db_sqlite_compatibility_1.evaluateGameDbSqliteCompatibility)({ baseline, acquiredArtifactState: "readable_sqlite" }), /requires/);
        (0, assert_1.throws)(() => (0, game_db_sqlite_compatibility_1.evaluateGameDbSqliteCompatibility)({ ...input, acquiredArtifactState: "forged" }), /artifact state/);
    });
    it("parses only the bounded manual compatibility CLI", () => {
        (0, assert_1.deepEqual)((0, game_db_sqlite_compatibility_1.parseGameDbSqliteCompatibilityArgs)(["--sqlite-path", "database.db", "--output-file=report.json"]), { sqlitePath: "database.db", baselineFile: undefined, outputFile: "report.json" });
        (0, assert_1.throws)(() => (0, game_db_sqlite_compatibility_1.parseGameDbSqliteCompatibilityArgs)(["--url", "https://example.test"]), /Unexpected/);
        (0, assert_1.throws)(() => (0, game_db_sqlite_compatibility_1.parseGameDbSqliteCompatibilityArgs)([]), /sqlite-path/);
    });
    it("builds a report only from one stable canonical SQLite identity", async () => {
        const root = temp(), bytes = sqliteBytes(1), sqlitePath = (0, path_1.join)(root, "database.db");
        try {
            (0, fs_1.writeFileSync)(sqlitePath, bytes);
            const report = await (0, game_db_sqlite_compatibility_1.buildGameDbSqliteCompatibility)({ sqlitePath, baselineFile: runtimeBaseline(root, bytes) }, { inspectSqlite: async (canonicalPath) => {
                    (0, assert_1.equal)(canonicalPath, sqlitePath);
                    return inspection;
                } });
            (0, assert_1.equal)(report.status, "exact_profile_match");
            (0, assert_1.equal)(report.c4Profile.sourceDatabase.actualSha256, (0, crypto_1.createHash)("sha256").update(bytes).digest("hex"));
        }
        finally {
            (0, fs_1.rmSync)(root, { recursive: true, force: true });
        }
    });
    it("rejects a pathname whose target is replaced after canonical resolution", async () => {
        const root = temp(), original = sqliteBytes(1), replacement = sqliteBytes(2), sqlitePath = (0, path_1.join)(root, "database.db"), displaced = (0, path_1.join)(root, "displaced.db");
        let inspectionCalls = 0;
        try {
            (0, fs_1.writeFileSync)(sqlitePath, original);
            await (0, assert_1.rejects)((0, game_db_sqlite_compatibility_1.buildGameDbSqliteCompatibility)({ sqlitePath, baselineFile: runtimeBaseline(root, original) }, {
                inspectSqlite: async () => { inspectionCalls += 1; return inspection; },
                hooks: { afterCanonicalResolution: () => { (0, fs_1.renameSync)(sqlitePath, displaced); (0, fs_1.writeFileSync)(sqlitePath, replacement); } },
            }), /target changed during canonical resolution/);
            (0, assert_1.equal)(inspectionCalls, 0);
        }
        finally {
            (0, fs_1.rmSync)(root, { recursive: true, force: true });
        }
    });
    it("rejects deterministic mutation performed during SQLite inspection", async () => {
        const root = temp(), original = sqliteBytes(3), sqlitePath = (0, path_1.join)(root, "database.db");
        try {
            (0, fs_1.writeFileSync)(sqlitePath, original);
            await (0, assert_1.rejects)((0, game_db_sqlite_compatibility_1.buildGameDbSqliteCompatibility)({ sqlitePath, baselineFile: runtimeBaseline(root, original) }, {
                inspectSqlite: async (canonicalPath) => { (0, fs_1.writeFileSync)(canonicalPath, sqliteBytes(4)); return inspection; },
            }), /changed after inspection|changed during inspection/);
        }
        finally {
            (0, fs_1.rmSync)(root, { recursive: true, force: true });
        }
    });
    it("rejects file replacement between fingerprint and inspection", async () => {
        const root = temp(), original = sqliteBytes(5), replacement = sqliteBytes(6), sqlitePath = (0, path_1.join)(root, "database.db"), displaced = (0, path_1.join)(root, "old.db");
        let inspectionCalls = 0;
        try {
            (0, fs_1.writeFileSync)(sqlitePath, original);
            await (0, assert_1.rejects)((0, game_db_sqlite_compatibility_1.buildGameDbSqliteCompatibility)({ sqlitePath, baselineFile: runtimeBaseline(root, original) }, {
                inspectSqlite: async () => { inspectionCalls += 1; return inspection; },
                hooks: { afterPreInspectionFingerprint: () => { (0, fs_1.renameSync)(sqlitePath, displaced); (0, fs_1.writeFileSync)(sqlitePath, replacement); } },
            }), /target changed after inspection/);
            (0, assert_1.equal)(inspectionCalls, 1);
        }
        finally {
            (0, fs_1.rmSync)(root, { recursive: true, force: true });
        }
    });
});
//# sourceMappingURL=game-db-sqlite-compatibility.spec.js.map