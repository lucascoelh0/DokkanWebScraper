"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = require("assert");
const shadow_readiness_builder_1 = require("./shadow-readiness-builder");
describe("database character K14 readiness", () => {
    it("allows GO only when every field criterion is green", () => {
        const matrix = [
            { field: "type", characterField: "type", owner: "k2", authority: "database_candidate", note: "x" },
            { field: "name", characterField: "name", owner: "k2", authority: "database_candidate", note: "x" },
            { field: "leaderSkill", characterField: "leaderSkill", owner: "external", authority: "external_fallback", note: "x" },
        ];
        const counts = (agreement, mismatch = 0, fallback = 0) => ({ agreements: agreement, representationGains: 0, representationMismatches: mismatch, confirmedConflicts: 0, unknown: 0, unjoinable: 1463, externalFallback: fallback });
        const coverage = { cardCount: 5759, productionJoinedCount: 4296, productionUnjoinableCount: 1463, preservedK7Conflicts: [], fieldCoverage: [
                { field: "type", supported: 5759, production: counts(4296), patchableCharacterCount: 4296 },
                { field: "name", supported: 5759, production: counts(4000, 296), patchableCharacterCount: 4000 },
                { field: "leaderSkill", supported: 0, production: counts(0, 0, 4296), patchableCharacterCount: 0 },
            ] };
        const validation = { valid: true, safety: { ambiguousStateBindingCount: 0, partialOrUnknownPatchCount: 0, unjoinableDatabaseCandidateCount: 0, conflictWinnerCount: 0 } };
        const result = (0, shadow_readiness_builder_1.buildCharacterShadowReadiness)({ generatedAt: "x", authorityMatrix: matrix }, coverage, validation);
        (0, assert_1.equal)(result.fields.find(item => item.field === "type")?.decision, "GO");
        (0, assert_1.equal)(result.fields.find(item => item.field === "name")?.decision, "NO-GO");
        (0, assert_1.equal)(result.fields.find(item => item.field === "leaderSkill")?.decision, "NO-GO");
        (0, assert_1.deepStrictEqual)(result.firstMigrationCandidates, ["type"]);
        (0, assert_1.equal)(result.production.authorityPromoted, false);
    });
});
//# sourceMappingURL=shadow-readiness-builder.spec.js.map