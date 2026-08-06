import { createHash } from "crypto";
import { deepStrictEqual, equal, throws } from "assert";
import { describe, it } from "mocha";
import { buildDatabaseTeamAnalysisDb25Coverage, buildDatabaseTeamAnalysisDb25Dataset } from "./team-analysis-db25-builder";

function fixture() {
    const bytes = Buffer.from("x"), hash = createHash("sha256").update(bytes).digest("hex");
    const handlers = [{ causalityType: 40, symbol: "type40", vma: 40, sizeBytes: 1, codeSha256: hash, predicate: "additional_param_byte_1_bit_0_set", snapshotPayloadPath: "all_current_rows_have_zero_cau_val1_2_3", parameterReads: [], ignoredParameters: [], unknowns: [] }, { causalityType: 56, symbol: "type56", vma: 56, sizeBytes: 1, codeSha256: hash, predicate: "additional_param_byte_1_equals_zero", snapshotPayloadPath: "all_current_rows_have_zero_cau_val1_2_3", parameterReads: [], ignoredParameters: ["cau_val1", "cau_val2", "cau_val3"], unknowns: [] }] as any;
    const evidence = { schemaVersion: 1, sourceSha256: "native", auditScope: "causality-types-40-and-56-attack-context-predicates", additionalParam: { copySymbol: "copy", copyVma: 20, copySizeBytes: 1, copyCodeSha256: hash, observedByteOffset: 1, observation: "caller_supplied_additional_param_is_copied_into_ability_status_causality" }, handlers, conclusions: ["type_40_tests_additional_param_byte_1_bit_0", "type_56_tests_additional_param_byte_1_equals_zero", "skill_causality_payload_is_zero_for_all_current_type_40_and_56_rows", "localized_or_symbol_names_are_not_semantic_proof"], dynamicExperiment: { required: true, captureAt: "x", capture: [], cases: [], successCriterion: "reproducible_mapping_of_byte_values_to_attack_kind_and_direction" } } as any;
    const db8 = { contractVersion: "0.7.0", sourceSnapshotVersion: "snapshot", sourceSha256: "database", causalityGaps: [{ causalityType: 56, occurrenceCount: 1, affectedStateCount: 1 }] } as any;
    const db9 = { contractVersion: "0.8.0", sourceSnapshotVersion: "snapshot", sourceDatabaseSha256: "database", sourceDb8: { sha256: "db8" }, nativeRuntime: { sha256: "native", sizeBytes: 1 }, causalityGapEvidence: [{ enumValue: 56, identityStatus: "runtime_identified", occurrenceCount: 1, affectedStateCount: 1 }], causalityDispatchSlots: handlers.map((value: any) => ({ enumValue: value.causalityType, status: "identified", symbol: value.symbol, symbolAddress: value.vma })) } as any;
    const condition40 = { op: "predicate", predicate: { kind: "super_attacks_performed", scope: "self", eventMode: "current_event", sourceCausalityId: "40", sourceCausalityType: 40, evidence: "first-party-row-join" } };
    const condition56 = { op: "unknown", causalityId: "56", causalityType: 56, raw: { causality_type: 56 } };
    const db11 = { contractVersion: "0.10.0", generatedAt: "x", sourceSnapshotVersion: "snapshot", sourceSha256: "database", states: [{ stateKey: "state", passive: { rules: [{ ruleKey: "r40", source: { passiveSkillId: "p40" }, condition: condition40 }, { ruleKey: "r56", source: { passiveSkillId: "p56" }, condition: condition56 }] } }] } as any;
    const tables = { skill_causalities: [{ id: 40, causality_type: 40, cau_val1: 0, cau_val2: 0, cau_val3: 0 }, { id: 56, causality_type: 56, cau_val1: 0, cau_val2: 0, cau_val3: 0 }] } as any;
    const inspection = { symbols: [{ name: "copy", value: 20, size: 1 }, { name: "type40", value: 40, size: 1 }, { name: "type56", value: 56, size: 1 }], readVirtualBytes: () => bytes } as any;
    return { db8, db9, db11, tables, inspection, evidence };
}
function build(x: ReturnType<typeof fixture>) { return buildDatabaseTeamAnalysisDb25Dataset({ ...x, db8Sha256: "db8", db9Sha256: "db9", db11Sha256: "db11", nativeSha256: "native", nativeSizeBytes: 1, evidenceSha256: "evidence" }); }

describe("database Team Analysis DB25 attack context correction", function () {
    it("replaces both labels with the same conservative native context boundary", () => { const dataset = build(fixture()); deepStrictEqual(dataset.resolutions.map(value => [value.causalityType, value.previousProjection.status, value.canonicalProjection.test, value.canonicalProjection.attackKind]), [[40, "overclaimed", "additional_param_byte_1_bit_0_set", "unknown"], [56, "unknown", "additional_param_byte_1_equals_zero", "unknown"]]); const coverage = buildDatabaseTeamAnalysisDb25Coverage(dataset); equal(coverage.overclaimCorrectionCount, 1); equal(coverage.newPartialNativePredicateCount, 1); equal(coverage.semanticPromotionCount, 0); });
    it("rejects a nonzero snapshot payload", () => { const x = fixture(); x.tables.skill_causalities[1].cau_val2 = 1; throws(() => build(x), /nonzero payload/); });
    it("rejects mutated native code", () => { const x = fixture(); x.evidence.handlers[0].codeSha256 = "0".repeat(64); throws(() => build(x), /handler evidence mismatch/); });
    it("rejects duplicate type 56 gap evidence", () => { const x = fixture(); x.db8.causalityGaps.push(x.db8.causalityGaps[0]); throws(() => build(x), /cardinality mismatch/); });
    it("rejects a missing consumed column", () => { const x = fixture(); delete x.tables.skill_causalities[0].cau_val3; throws(() => build(x), /incomplete/); });
    it("rejects a changed legacy type 40 projection", () => { const x = fixture(); x.db11.states[0].passive.rules[0].condition.predicate.scope = "team"; throws(() => build(x), /legacy projection shape mismatch/); });
    it("audits non-projected snapshot rows too", () => { const x = fixture(); x.tables.skill_causalities.push({ id: 99, causality_type: 40, cau_val1: 1, cau_val2: 0, cau_val3: 0 }); throws(() => build(x), /nonzero payload/); });
});
