import { equal, throws } from "assert";
import { describe, it } from "mocha";
import { parseDb33ExecutionTiming, projectDb33AttackSetupTiming, validateDb33SourceLineage } from "./team-analysis-db33-builder";

describe("DB33 player attack setup timing", () => {
    it("promotes only raw value 4", () => {
        equal(projectDb33AttackSetupTiming(4).event, "player_attack_setup");
        for (const value of [1, 3, 5, 6, 7, 9, 11, 12, 14, 15, -4, null, " "]) equal(projectDb33AttackSetupTiming(value).status, "unknown");
    });
    it("rejects fractional, unsafe and invalid values", () => {
        equal(projectDb33AttackSetupTiming(4.5).status, "unknown");
        equal(Number.isSafeInteger(parseDb33ExecutionTiming(Number.MAX_SAFE_INTEGER + 1)), false);
        equal(projectDb33AttackSetupTiming("attack").status, "unknown");
    });
    it("pins DB32 to the database and runtime", () => {
        const db32 = { contractVersion: "0.31.0", sourceDatabaseSha256: "db", currentTeamAnalysis: { sha256: "current" }, nativeRuntime: { sha256: "elf", sizeBytes: 10 } } as any;
        const hash = "29c408e3ced29f3d07fe8a4715afb88a6d950c52be43cb7fadc7d2b23de4fdfa";
        validateDb33SourceLineage(db32, hash, "db", "current", "elf", 10);
        throws(() => validateDb33SourceLineage(db32, "other", "db", "current", "elf", 10), /lineage/);
        throws(() => validateDb33SourceLineage({ ...db32, sourceDatabaseSha256: "other" }, hash, "db", "current", "elf", 10), /lineage/);
        throws(() => validateDb33SourceLineage({ ...db32, currentTeamAnalysis: { sha256: "other" } }, hash, "db", "current", "elf", 10), /lineage/);
        throws(() => validateDb33SourceLineage({ ...db32, nativeRuntime: { sha256: "other", sizeBytes: 10 } }, hash, "db", "current", "elf", 10), /lineage/);
    });
    it("does not infer a calculation bucket", () => equal((projectDb33AttackSetupTiming(4) as any).calculationBucket, undefined));
});
