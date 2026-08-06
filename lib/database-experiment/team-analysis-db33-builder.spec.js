"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = require("assert");
const mocha_1 = require("mocha");
const team_analysis_db33_builder_1 = require("./team-analysis-db33-builder");
(0, mocha_1.describe)("DB33 player attack setup timing", () => {
    (0, mocha_1.it)("promotes only raw value 4", () => {
        (0, assert_1.equal)((0, team_analysis_db33_builder_1.projectDb33AttackSetupTiming)(4).event, "player_attack_setup");
        for (const value of [1, 3, 5, 6, 7, 9, 11, 12, 14, 15, -4, null, " "])
            (0, assert_1.equal)((0, team_analysis_db33_builder_1.projectDb33AttackSetupTiming)(value).status, "unknown");
    });
    (0, mocha_1.it)("rejects fractional, unsafe and invalid values", () => {
        (0, assert_1.equal)((0, team_analysis_db33_builder_1.projectDb33AttackSetupTiming)(4.5).status, "unknown");
        (0, assert_1.equal)(Number.isSafeInteger((0, team_analysis_db33_builder_1.parseDb33ExecutionTiming)(Number.MAX_SAFE_INTEGER + 1)), false);
        (0, assert_1.equal)((0, team_analysis_db33_builder_1.projectDb33AttackSetupTiming)("attack").status, "unknown");
    });
    (0, mocha_1.it)("pins DB32 to the database and runtime", () => {
        const db32 = { contractVersion: "0.31.0", sourceDatabaseSha256: "db", currentTeamAnalysis: { sha256: "current" }, nativeRuntime: { sha256: "elf", sizeBytes: 10 } };
        const hash = "29c408e3ced29f3d07fe8a4715afb88a6d950c52be43cb7fadc7d2b23de4fdfa";
        (0, team_analysis_db33_builder_1.validateDb33SourceLineage)(db32, hash, "db", "current", "elf", 10);
        (0, assert_1.throws)(() => (0, team_analysis_db33_builder_1.validateDb33SourceLineage)(db32, "other", "db", "current", "elf", 10), /lineage/);
        (0, assert_1.throws)(() => (0, team_analysis_db33_builder_1.validateDb33SourceLineage)({ ...db32, sourceDatabaseSha256: "other" }, hash, "db", "current", "elf", 10), /lineage/);
        (0, assert_1.throws)(() => (0, team_analysis_db33_builder_1.validateDb33SourceLineage)({ ...db32, currentTeamAnalysis: { sha256: "other" } }, hash, "db", "current", "elf", 10), /lineage/);
        (0, assert_1.throws)(() => (0, team_analysis_db33_builder_1.validateDb33SourceLineage)({ ...db32, nativeRuntime: { sha256: "other", sizeBytes: 10 } }, hash, "db", "current", "elf", 10), /lineage/);
    });
    (0, mocha_1.it)("does not infer a calculation bucket", () => (0, assert_1.equal)((0, team_analysis_db33_builder_1.projectDb33AttackSetupTiming)(4).calculationBucket, undefined));
});
//# sourceMappingURL=team-analysis-db33-builder.spec.js.map