import { deepEqual, equal, rejects, throws } from "assert";
import { createHash } from "crypto";
import { mkdtempSync, renameSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { buildGameDbSqliteCompatibility, evaluateGameDbSqliteCompatibility, parseGameDbSqliteCompatibilityArgs } from "./game-db-sqlite-compatibility";
import { integrationC4SchemaSha256 } from "../database-integration/integration-c4-builder";

const inspection = {
    tableCount: 2,
    tables: [
        { name: "cards", columns: ["id", "character_id"], rowCount: 1 },
        { name: "passive_skills", columns: ["id", "efficacy_type"], rowCount: 2 },
    ],
};
const databaseSha256 = createHash("sha256").update("database").digest("hex");
const evidenceSha256 = createHash("sha256").update("evidence").digest("hex");
const baseline: any = {
    schemaVersion: 1,
    contractVersion: "1.0.0",
    snapshotVersion: "global-profile",
    sourceDatabase: {
        sha256: databaseSha256,
        sizeBytes: 100,
        tableCount: inspection.tableCount,
        schemaSha256: integrationC4SchemaSha256(inspection),
        requiredTables: { cards: ["id", "character_id"], passive_skills: ["id", "efficacy_type"] },
    },
    nativeRuntime: { sha256: evidenceSha256, sizeBytes: 200, elfClass: 64, endian: "little", machine: 183 },
    semanticInputs: {
        DB48: { contractVersion: "1", sha256: evidenceSha256 },
        DB49: { contractVersion: "1", sha256: evidenceSha256 },
        DB50: { contractVersion: "1", sha256: evidenceSha256 },
    },
};

function temp(): string { return mkdtempSync(join(tmpdir(), "dokkan-c4-toctou-")); }
function sqliteBytes(fill: number): Buffer { return Buffer.concat([Buffer.from("SQLite format 3\0"), Buffer.alloc(64, fill)]); }
function runtimeBaseline(root: string, bytes: Buffer): string {
    const value = JSON.parse(JSON.stringify(baseline));
    value.sourceDatabase.sha256 = createHash("sha256").update(bytes).digest("hex");
    value.sourceDatabase.sizeBytes = bytes.byteLength;
    value.sourceDatabase.tableCount = inspection.tableCount;
    value.sourceDatabase.schemaSha256 = integrationC4SchemaSha256(inspection);
    const path = join(root, "baseline.json");
    writeFileSync(path, JSON.stringify(value));
    return path;
}

describe("game DB SQLite compatibility", () => {
    it("classifies an exact SQLite profile without authorizing native evidence reuse", () => {
        const report = evaluateGameDbSqliteCompatibility({ baseline, acquiredArtifactState: "readable_sqlite", sourceDatabase: { sha256: databaseSha256, sizeBytes: 100, inspection } });
        equal(report.status, "exact_profile_match");
        equal(report.pinnedNativeEvidence.evaluatedInThisStep, false);
        equal(report.pinnedNativeEvidence.automaticReuseAuthorized, false);
        equal(report.nextPermittedStep, "run_c4_with_exact_pinned_elf_and_semantic_artifacts");
    });

    it("requires evidence refresh for a schema-compatible changed SQLite", () => {
        const report = evaluateGameDbSqliteCompatibility({ baseline, acquiredArtifactState: "readable_sqlite", sourceDatabase: { sha256: "a".repeat(64), sizeBytes: 101, inspection } });
        equal(report.status, "schema_compatible_but_evidence_refresh_required");
        equal(report.nextPermittedStep, "refresh_bounded_native_evidence_then_review_c4_baseline");
    });

    it("rejects missing required columns", () => {
        const changed = JSON.parse(JSON.stringify(inspection));
        changed.tables[1].columns = ["id"];
        const report = evaluateGameDbSqliteCompatibility({ baseline, acquiredArtifactState: "readable_sqlite", sourceDatabase: { sha256: "b".repeat(64), sizeBytes: 90, inspection: changed } });
        equal(report.status, "incompatible");
        deepEqual(report.c4Profile.missingRequiredColumns, ["passive_skills.efficacy_type"]);
    });

    it("keeps encrypted or packaged bytes unknown until local decryption", () => {
        const report = evaluateGameDbSqliteCompatibility({ baseline, acquiredArtifactState: "encrypted_or_packaged" });
        equal(report.status, "unknown");
        equal(report.c4Profile.sourceDatabase.actualSha256, null);
    });

    it("is deterministic and fails closed on malformed inputs", () => {
        const input: any = { baseline, acquiredArtifactState: "readable_sqlite", sourceDatabase: { sha256: databaseSha256, sizeBytes: 100, inspection } };
        equal(JSON.stringify(evaluateGameDbSqliteCompatibility(input)), JSON.stringify(evaluateGameDbSqliteCompatibility(input)));
        throws(() => evaluateGameDbSqliteCompatibility({ ...input, sourceDatabase: { ...input.sourceDatabase, sha256: "bad" } }), /identity/);
        throws(() => evaluateGameDbSqliteCompatibility({ baseline, acquiredArtifactState: "readable_sqlite" }), /requires/);
        throws(() => evaluateGameDbSqliteCompatibility({ ...input, acquiredArtifactState: "forged" } as any), /artifact state/);
    });

    it("parses only the bounded manual compatibility CLI", () => {
        deepEqual(parseGameDbSqliteCompatibilityArgs(["--sqlite-path", "database.db", "--output-file=report.json"]), { sqlitePath: "database.db", baselineFile: undefined, outputFile: "report.json" });
        throws(() => parseGameDbSqliteCompatibilityArgs(["--url", "https://example.test"]), /Unexpected/);
        throws(() => parseGameDbSqliteCompatibilityArgs([]), /sqlite-path/);
    });

    it("builds a report only from one stable canonical SQLite identity", async () => {
        const root = temp(), bytes = sqliteBytes(1), sqlitePath = join(root, "database.db");
        try {
            writeFileSync(sqlitePath, bytes);
            const report = await buildGameDbSqliteCompatibility({ sqlitePath, baselineFile: runtimeBaseline(root, bytes) }, { inspectSqlite: async canonicalPath => {
                equal(canonicalPath, sqlitePath);
                return inspection;
            } });
            equal(report.status, "exact_profile_match");
            equal(report.c4Profile.sourceDatabase.actualSha256, createHash("sha256").update(bytes).digest("hex"));
        } finally { rmSync(root, { recursive: true, force: true }); }
    });

    it("rejects a pathname whose target is replaced after canonical resolution", async () => {
        const root = temp(), original = sqliteBytes(1), replacement = sqliteBytes(2), sqlitePath = join(root, "database.db"), displaced = join(root, "displaced.db");
        let inspectionCalls = 0;
        try {
            writeFileSync(sqlitePath, original);
            await rejects(buildGameDbSqliteCompatibility({ sqlitePath, baselineFile: runtimeBaseline(root, original) }, {
                inspectSqlite: async () => { inspectionCalls += 1; return inspection; },
                hooks: { afterCanonicalResolution: () => { renameSync(sqlitePath, displaced); writeFileSync(sqlitePath, replacement); } },
            }), /target changed during canonical resolution/);
            equal(inspectionCalls, 0);
        } finally { rmSync(root, { recursive: true, force: true }); }
    });

    it("rejects deterministic mutation performed during SQLite inspection", async () => {
        const root = temp(), original = sqliteBytes(3), sqlitePath = join(root, "database.db");
        try {
            writeFileSync(sqlitePath, original);
            await rejects(buildGameDbSqliteCompatibility({ sqlitePath, baselineFile: runtimeBaseline(root, original) }, {
                inspectSqlite: async canonicalPath => { writeFileSync(canonicalPath, sqliteBytes(4)); return inspection; },
            }), /changed after inspection|changed during inspection/);
        } finally { rmSync(root, { recursive: true, force: true }); }
    });

    it("rejects file replacement between fingerprint and inspection", async () => {
        const root = temp(), original = sqliteBytes(5), replacement = sqliteBytes(6), sqlitePath = join(root, "database.db"), displaced = join(root, "old.db");
        let inspectionCalls = 0;
        try {
            writeFileSync(sqlitePath, original);
            await rejects(buildGameDbSqliteCompatibility({ sqlitePath, baselineFile: runtimeBaseline(root, original) }, {
                inspectSqlite: async () => { inspectionCalls += 1; return inspection; },
                hooks: { afterPreInspectionFingerprint: () => { renameSync(sqlitePath, displaced); writeFileSync(sqlitePath, replacement); } },
            }), /target changed after inspection/);
            equal(inspectionCalls, 1);
        } finally { rmSync(root, { recursive: true, force: true }); }
    });
});
