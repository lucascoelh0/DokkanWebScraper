import { deepEqual, equal, throws } from "assert";
import { createHash } from "crypto";
import { evaluateGameDbSqliteCompatibility, parseGameDbSqliteCompatibilityArgs } from "./game-db-sqlite-compatibility";
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
    });

    it("parses only the bounded manual compatibility CLI", () => {
        deepEqual(parseGameDbSqliteCompatibilityArgs(["--sqlite-path", "database.db", "--output-file=report.json"]), { sqlitePath: "database.db", baselineFile: undefined, outputFile: "report.json" });
        throws(() => parseGameDbSqliteCompatibilityArgs(["--url", "https://example.test"]), /Unexpected/);
        throws(() => parseGameDbSqliteCompatibilityArgs([]), /sqlite-path/);
    });
});
