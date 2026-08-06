import { createHash } from "crypto";
import { deepStrictEqual, equal, throws } from "assert";
import { describe, it } from "mocha";
import { buildDatabaseTeamAnalysisDb27Coverage, buildDatabaseTeamAnalysisDb27Dataset } from "./team-analysis-db27-builder";

function fixture() {
    const bytes = Buffer.from("x"), hash = createHash("sha256").update(bytes).digest("hex");
    const handlers = [
        { causalityType: 17, symbol: "s17", vma: 17, sizeBytes: 1, codeSha256: hash, metric: "selected_enemy_current_hp_div_max_times_100_float", comparator: "gte", parameterReads: ["cau_val1"], ignoredParameters: ["cau_val2", "cau_val3"], gate: "selection_flag_equals_zero" },
        { causalityType: 18, symbol: "s18", vma: 18, sizeBytes: 1, codeSha256: hash, metric: "selected_enemy_current_hp_div_max_times_100_float", comparator: "lte", parameterReads: ["cau_val1"], ignoredParameters: ["cau_val2", "cau_val3"], gate: "selection_flag_equals_zero" },
        { causalityType: 33, symbol: "s33", vma: 33, sizeBytes: 1, codeSha256: hash, metric: "runtime_selected_player_or_enemy_hp_rate_integer", comparator: "between_inclusive", parameterReads: ["cau_val1", "cau_val2"], ignoredParameters: ["cau_val3"], gate: "none" },
    ] as any[];
    const evidence = { schemaVersion: 1, sourceSha256: "native", auditScope: "causality-types-17-18-33-target-hp-percent", abilityStatusVtable: { symbol: "_ZTV22AbilityStatusCausality", vma: 100, sizeBytes: 360, deckIndexSlotOffset: 88, deckIndexSymbol: "deck", selectionFlagSlotOffset: 96, selectionFlagSymbol: "flag", selectionFlagSemanticName: "unknown" }, handlers, hpRateHelper: { symbol: "helper", vma: 50, sizeBytes: 1, codeSha256: hash, zeroNumeratorOrDenominatorResult: 0, normalizationWindows: [{ when: "ratio_percent_gt_0_lt_1", value: 1 }, { when: "ratio_percent_gt_99_lt_100", value: 99 }], rounding: "nearest_ties_away_from_zero" }, conclusions: ["types_17_18_use_selected_enemy_hp_float_percent", "type_33_uses_runtime_selected_player_or_enemy_integer_hp_percent", "all_comparators_are_inclusive"], unknowns: ["selection_flag_semantic_name", "types_17_18_nonzero_gate_meaning", "activation_timing", "recurrence", "calculation_bucket", "types_17_18_zero_max_policy"] } as any;
    const gaps = [17, 18, 33].map(type => ({ causalityType: type, occurrenceCount: 1, affectedStateCount: 1, uniqueCausalityCount: 1 }));
    const db8 = { contractVersion: "0.7.0", semanticPromotionCount: 0, sourceSnapshotVersion: "snapshot", sourceSha256: "database", causalityGaps: gaps } as any;
    const db9 = { contractVersion: "0.8.0", semanticPromotionCount: 0, sourceSnapshotVersion: "snapshot", sourceDatabaseSha256: "database", sourceDb8: { sha256: "db8" }, nativeRuntime: { sha256: "native", sizeBytes: 1 }, causalityGapEvidence: handlers.map(value => ({ enumValue: value.causalityType, identityStatus: "runtime_identified", occurrenceCount: 1, affectedStateCount: 1, symbol: value.symbol, symbolAddress: value.vma })), causalityDispatchSlots: handlers.map(value => ({ enumValue: value.causalityType, status: "identified", symbol: value.symbol, symbolAddress: value.vma })) } as any;
    const rules = [17, 18, 33].map(type => ({ ruleKey: `r${type}`, source: { passiveSkillId: `p${type}` }, condition: { op: "unknown", causalityId: String(type), causalityType: type, raw: { causality_type: type } } }));
    const db11 = { contractVersion: "0.10.0", generatedAt: "x", sourceSnapshotVersion: "snapshot", sourceSha256: "database", states: [{ stateKey: "state", passive: { rules } }] } as any;
    const tables = { skill_causalities: [{ id: 17, causality_type: 17, cau_val1: 60, cau_val2: 0, cau_val3: 0 }, { id: 18, causality_type: 18, cau_val1: 40, cau_val2: 0, cau_val3: 0 }, { id: 33, causality_type: 33, cau_val1: 25, cau_val2: 75, cau_val3: 0 }] } as any;
    const symbols = [...handlers.map(value => ({ name: value.symbol, value: value.vma, size: 1 })), { name: "helper", value: 50, size: 1 }, { name: "_ZTV22AbilityStatusCausality", value: 100, size: 360 }];
    const inspection = { symbols, relocations: [{ offset: 188, symbolName: "deck" }, { offset: 196, symbolName: "flag" }], readVirtualBytes: () => bytes } as any;
    return { db8, db9, db11, tables, inspection, evidence };
}
function build(x: ReturnType<typeof fixture>) { return buildDatabaseTeamAnalysisDb27Dataset({ ...x, db8Sha256: "db8", db9Sha256: "db9", db11Sha256: "db11", nativeSha256: "native", nativeSizeBytes: 1, evidenceSha256: "evidence" }); }

describe("database Team Analysis DB27 target HP", function () {
    it("projects inclusive float and integer predicates", () => { const d = build(fixture()); deepStrictEqual(d.resolutions.map(value => value.predicate), [{ metric: "selected_enemy_hp_percent_float", comparator: "gte", threshold: 60, selectionGate: { rawFlagComparator: "eq", value: 0, semanticName: "unknown" }, zeroMaxPolicy: "unknown" }, { metric: "selected_enemy_hp_percent_float", comparator: "lte", threshold: 40, selectionGate: { rawFlagComparator: "eq", value: 0, semanticName: "unknown" }, zeroMaxPolicy: "unknown" }, { metric: "runtime_selected_hp_percent_integer", comparator: "between_inclusive", lower: 25, upper: 75, selection: { rawFlagZero: "player", rawFlagNonzero: "enemy", semanticName: "unknown" }, calculation: { zeroNumeratorOrDenominatorResult: 0, normalizationWindows: [{ when: "ratio_percent_gt_0_lt_1", value: 1 }, { when: "ratio_percent_gt_99_lt_100", value: 99 }], rounding: "nearest_ties_away_from_zero" } }]); const c = buildDatabaseTeamAnalysisDb27Coverage(d, 3); equal(c.resolutionCount, 3); equal(c.partialResolutionCount, 3); });
    it("rejects an inverted interval", () => { const x = fixture(); x.tables.skill_causalities[2].cau_val1 = 80; x.tables.skill_causalities[2].cau_val2 = 20; throws(() => build(x), /invalid threshold/); });
    it("rejects a wrong vtable relocation", () => { const x = fixture(); x.inspection.relocations[1].symbolName = "other"; throws(() => build(x), /vtable evidence mismatch/); });
    it("rejects mutated helper code", () => { const x = fixture(); x.evidence.hpRateHelper.codeSha256 = "0".repeat(64); throws(() => build(x), /helper evidence mismatch/); });
    it("rejects duplicate gap evidence", () => { const x = fixture(); x.db8.causalityGaps.push(x.db8.causalityGaps[0]); throws(() => build(x), /cardinality mismatch/); });
    it("rejects mismatched DB9 handler addresses", () => { const x = fixture(); x.db9.causalityGapEvidence[0].symbolAddress = 99; throws(() => build(x), /runtime lineage mismatch/); });
    it("rejects mutated ignored-parameter evidence", () => { const x = fixture(); x.evidence.handlers[0].ignoredParameters = ["cau_val2"]; throws(() => build(x), /handler semantics mismatch/); });
    it("reconciles unique causality cardinality", () => { const x = fixture(); x.db8.causalityGaps[0].uniqueCausalityCount = 2; throws(() => build(x), /source gap accounting mismatch/); });
    it("rejects a null SQLite identity", () => { const x = fixture(); x.tables.skill_causalities.push({ id: null, causality_type: 1, cau_val1: 0, cau_val2: 0, cau_val3: 0 }); throws(() => build(x), /has no id/); });
});
