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
        (0, assert_1.equal)(result.contractVersion, "1.0.1");
        (0, assert_1.equal)(result.decisionScope, "field_evidence_only_no_delivery_authorization");
        (0, assert_1.equal)(result.fields.find(item => item.field === "type")?.decision, "GO");
        (0, assert_1.equal)(result.fields.find(item => item.field === "name")?.decision, "NO-GO");
        (0, assert_1.equal)(result.fields.find(item => item.field === "leaderSkill")?.decision, "NO-GO");
        (0, assert_1.deepStrictEqual)(result.firstMigrationCandidates, []);
        (0, assert_1.equal)(result.production.authorityPromoted, false);
        (0, assert_1.equal)(result.artifactPolicy.k11.classification, "audit_only");
        (0, assert_1.equal)(result.artifactPolicy.k11.uncompressedSizeBytes, 511791355);
        (0, assert_1.equal)(result.artifactPolicy.k11.runtimeConsumption, "NO-GO");
        (0, assert_1.equal)(result.artifactPolicy.k11.optInConsumption, "NO-GO");
        (0, assert_1.equal)(result.artifactPolicy.k11.publication, "NO-GO");
        (0, assert_1.equal)(result.artifactPolicy.k11.androidConsumption, "NO-GO");
        (0, assert_1.deepStrictEqual)(result.artifactPolicy.k15.fields, ["id", "rarity", "type"]);
        (0, assert_1.deepStrictEqual)(result.artifactPolicy.k15.lineageRequired, ["k11", "k0", "k1", "k2"]);
        (0, assert_1.equal)(result.artifactPolicy.k15.status, "not_implemented");
        (0, assert_1.equal)(result.artifactPolicy.k15.futureConsumerInput, "k15_only");
        (0, assert_1.equal)(result.nextGate.action, "generate_compact_supported_projection");
        (0, assert_1.equal)(result.nextGate.artifact, "k15");
        (0, assert_1.equal)(result.nextGate.decision, "GO");
        (0, assert_1.equal)(result.nextGate.gates.generateAndValidate, "GO");
        for (const decision of [result.nextGate.gates.publication, result.nextGate.gates.consumption, result.nextGate.gates.authorityPromotion, result.nextGate.gates.r2, result.nextGate.gates.android, result.nextGate.gates.production])
            (0, assert_1.equal)(decision, "NO-GO");
        for (const fieldDecision of result.fields.filter(item => item.decision === "GO"))
            (0, assert_1.equal)(/k11|manifest/i.test(JSON.stringify(fieldDecision)), false);
        const ambiguousGuidance = [
            new RegExp(["same", "manifest"].join("\\s+"), "i"),
            new RegExp(["in-memory", "consumer"].join("\\s+"), "i"),
            new RegExp(["consume", "K11"].join("\\s+"), "i"),
        ];
        for (const pattern of ambiguousGuidance)
            (0, assert_1.equal)(pattern.test(JSON.stringify(result)), false);
    });
});
//# sourceMappingURL=shadow-readiness-builder.spec.js.map