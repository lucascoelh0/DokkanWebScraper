import { deepStrictEqual, equal } from "assert";
import { buildCharacterShadowReadiness } from "./shadow-readiness-builder";

describe("database character K14 readiness", () => {
    it("allows GO only when every field criterion is green", () => {
        const matrix = [
            { field: "type", characterField: "type", owner: "k2", authority: "database_candidate", note: "x" },
            { field: "name", characterField: "name", owner: "k2", authority: "database_candidate", note: "x" },
            { field: "leaderSkill", characterField: "leaderSkill", owner: "external", authority: "external_fallback", note: "x" },
        ];
        const counts = (agreement: number, mismatch = 0, fallback = 0) => ({ agreements: agreement, representationGains: 0, representationMismatches: mismatch, confirmedConflicts: 0, unknown: 0, unjoinable: 1_463, externalFallback: fallback });
        const coverage: any = { cardCount: 5_759, productionJoinedCount: 4_296, productionUnjoinableCount: 1_463, preservedK7Conflicts: [], fieldCoverage: [
            { field: "type", supported: 5_759, production: counts(4_296), patchableCharacterCount: 4_296 },
            { field: "name", supported: 5_759, production: counts(4_000, 296), patchableCharacterCount: 4_000 },
            { field: "leaderSkill", supported: 0, production: counts(0, 0, 4_296), patchableCharacterCount: 0 },
        ] };
        const validation: any = { valid: true, safety: { ambiguousStateBindingCount: 0, partialOrUnknownPatchCount: 0, unjoinableDatabaseCandidateCount: 0, conflictWinnerCount: 0 } };
        const result = buildCharacterShadowReadiness({ generatedAt: "x", authorityMatrix: matrix } as any, coverage, validation);
        equal(result.fields.find(item => item.field === "type")?.decision, "GO");
        equal(result.fields.find(item => item.field === "name")?.decision, "NO-GO");
        equal(result.fields.find(item => item.field === "leaderSkill")?.decision, "NO-GO");
        deepStrictEqual(result.firstMigrationCandidates, ["type"]);
        equal(result.production.authorityPromoted, false);
    });
});
