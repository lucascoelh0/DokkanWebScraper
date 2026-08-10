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
        equal(result.contractVersion, "1.0.1");
        equal(result.decisionScope, "field_evidence_only_no_delivery_authorization");
        equal(result.fields.find(item => item.field === "type")?.decision, "GO");
        equal(result.fields.find(item => item.field === "name")?.decision, "NO-GO");
        equal(result.fields.find(item => item.field === "leaderSkill")?.decision, "NO-GO");
        deepStrictEqual(result.firstMigrationCandidates, []);
        equal(result.production.authorityPromoted, false);
        equal(result.artifactPolicy.k11.classification, "audit_only");
        equal(result.artifactPolicy.k11.uncompressedSizeBytes, 511_791_355);
        equal(result.artifactPolicy.k11.runtimeConsumption, "NO-GO");
        equal(result.artifactPolicy.k11.optInConsumption, "NO-GO");
        equal(result.artifactPolicy.k11.publication, "NO-GO");
        equal(result.artifactPolicy.k11.androidConsumption, "NO-GO");
        deepStrictEqual(result.artifactPolicy.k15.fields, ["id", "rarity", "type"]);
        deepStrictEqual(result.artifactPolicy.k15.lineageRequired, ["k11", "k0", "k1", "k2"]);
        equal(result.artifactPolicy.k15.status, "not_implemented");
        equal(result.artifactPolicy.k15.futureConsumerInput, "k15_only");
        equal(result.nextGate.action, "generate_compact_supported_projection");
        equal(result.nextGate.artifact, "k15");
        equal(result.nextGate.decision, "GO");
        equal(result.nextGate.gates.generateAndValidate, "GO");
        for (const decision of [result.nextGate.gates.publication, result.nextGate.gates.consumption, result.nextGate.gates.authorityPromotion, result.nextGate.gates.r2, result.nextGate.gates.android, result.nextGate.gates.production]) equal(decision, "NO-GO");
        for (const fieldDecision of result.fields.filter(item => item.decision === "GO")) equal(/k11|manifest/i.test(JSON.stringify(fieldDecision)), false);
        const ambiguousGuidance = [
            new RegExp(["same", "manifest"].join("\\s+"), "i"),
            new RegExp(["in-memory", "consumer"].join("\\s+"), "i"),
            new RegExp(["consume", "K11"].join("\\s+"), "i"),
        ];
        for (const pattern of ambiguousGuidance) equal(pattern.test(JSON.stringify(result)), false);
    });
});
