"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const crypto_1 = require("crypto");
const assert_1 = require("assert");
const mocha_1 = require("mocha");
const team_analysis_db28_builder_1 = require("./team-analysis-db28-builder");
function fixture() {
    const bytes = Buffer.from("x"), hash = (0, crypto_1.createHash)("sha256").update(bytes).digest("hex");
    const handlers = [
        { causalityType: 47, symbol: "h47", vma: 47, sizeBytes: 1, codeSha256: hash, scope: "ability_owner_deck_index_pure_current_record", predicate: "revival_skill_activation_count_gt_zero", parameterReads: [], ignoredParameters: ["cau_val1", "cau_val2", "cau_val3"] },
        { causalityType: 54, symbol: "h54", vma: 54, sizeBytes: 1, codeSha256: hash, scope: "deck_indices_0_through_6_pure_and_back_current_records", predicate: "any_revival_skill_activation_count_gt_zero", parameterReads: ["cau_val1"], ignoredParameters: ["cau_val2", "cau_val3"], cauVal1Polarity: "zero_requires_any_nonzero_requires_none" },
    ];
    const evidence = {
        schemaVersion: 1, sourceSha256: "native", auditScope: "causality-types-47-54-revival-activation-counter",
        skillCausalityPayload: { containerOffset: 8, elementSizeBytes: 4, indexColumns: ["cau_val1", "cau_val2", "cau_val3"], constructorSymbol: "ctor", constructorVma: 10, constructorSizeBytes: 1, constructorCodeSha256: hash, rowConstructorSymbol: "rowCtor", rowConstructorVma: 11, rowConstructorSizeBytes: 1, rowConstructorCodeSha256: hash },
        abilityStatusVtable: { symbol: "_ZTV22AbilityStatusCausality", vma: 100, sizeBytes: 360, deckIndexSlotOffset: 88, deckIndexSymbol: "deck" },
        inGameDataVtable: { symbol: "_ZTV10InGameData", vma: 200, sizeBytes: 472, pureCurrentSlotOffset: 40, pureCurrentSymbol: "pure", backCurrentSlotOffset: 88, backCurrentSymbol: "back" },
        counter: {
            inGameCharaDataOffset: 616, widthBits: 32,
            incrementWriter: { symbol: "increment", vma: 12, sizeBytes: 1, codeSha256: hash, observation: "available_revival_efficacy_setup_callback_increments_pure_current_record_counter" },
            availabilityReader: { symbol: "available", vma: 13, sizeBytes: 1, codeSha256: hash, observation: "revival_availability_rejects_positive_counters_across_party_records" },
            resetWriter: { symbol: "reset", vma: 14, sizeBytes: 1, codeSha256: hash, observation: "zeros_same_counter_across_in_game_character_records" },
        }, handlers,
        conclusions: ["counter_is_incremented_after_available_revival_skill_view_callback", "counter_is_consulted_by_revival_availability_and_reset_by_named_runtime_writer", "type_47_tests_ability_owner_pure_current_record_counter_gt_zero", "type_54_tests_party_pure_and_back_current_records_with_cau_val1_polarity"],
        unknowns: ["reset_trigger_and_history_window", "activation_timing", "recurrence", "calculation_bucket", "counter_overflow_behavior"],
    };
    const gaps = [47, 54].map(type => ({ causalityType: type, occurrenceCount: 1, affectedStateCount: 1, uniqueCausalityCount: 1 }));
    const db8 = { contractVersion: "0.7.0", semanticPromotionCount: 0, sourceSnapshotVersion: "snapshot", sourceSha256: "database", causalityGaps: gaps };
    const db9 = { contractVersion: "0.8.0", semanticPromotionCount: 0, sourceSnapshotVersion: "snapshot", sourceDatabaseSha256: "database", sourceDb8: { sha256: "db8" }, nativeRuntime: { sha256: "native", sizeBytes: 1 }, causalityGapEvidence: handlers.map(value => ({ enumValue: value.causalityType, identityStatus: "runtime_identified", occurrenceCount: 1, affectedStateCount: 1, symbol: value.symbol, symbolAddress: value.vma })), causalityDispatchSlots: handlers.map(value => ({ enumValue: value.causalityType, status: "identified", symbol: value.symbol, symbolAddress: value.vma })) };
    const rules = [47, 54].map(type => ({ ruleKey: `r${type}`, source: { passiveSkillId: `p${type}` }, condition: { op: "unknown", causalityId: String(type), causalityType: type, raw: { causality_type: type } } }));
    const db11 = { contractVersion: "0.10.0", generatedAt: "x", sourceSnapshotVersion: "snapshot", sourceSha256: "database", states: [{ stateKey: "state", passive: { rules } }] };
    const tables = { skill_causalities: [{ id: 47, causality_type: 47, cau_val1: 99, cau_val2: 98, cau_val3: 97 }, { id: 54, causality_type: 54, cau_val1: 0, cau_val2: 0, cau_val3: 0 }] };
    const symbols = ["ctor", "rowCtor", "increment", "available", "reset"].map((name, index) => ({ name, value: 10 + index, size: 1 })).concat(handlers.map(value => ({ name: value.symbol, value: value.vma, size: 1 })), [{ name: "_ZTV22AbilityStatusCausality", value: 100, size: 360 }, { name: "_ZTV10InGameData", value: 200, size: 472 }]);
    const inspection = { symbols, relocations: [{ offset: 188, symbolName: "deck" }, { offset: 240, symbolName: "pure" }, { offset: 288, symbolName: "back" }], readVirtualBytes: () => bytes };
    return { db8, db9, db11, tables, inspection, evidence };
}
function build(value) { return (0, team_analysis_db28_builder_1.buildDatabaseTeamAnalysisDb28Dataset)({ ...value, db8Sha256: "db8", db9Sha256: "db9", db11Sha256: "db11", nativeSha256: "native", nativeSizeBytes: 1, evidenceSha256: "evidence" }); }
(0, mocha_1.describe)("database Team Analysis DB28 revival counters", function () {
    (0, mocha_1.it)("projects owner and party activation-count predicates", () => {
        const dataset = build(fixture());
        (0, assert_1.deepStrictEqual)(dataset.resolutions.map(value => value.predicate), [
            { status: "supported", event: "revival_skill_activated", metric: "activation_count", scope: "ability_owner_pure_current_record", deckIndexSource: "ability_status", comparator: "gt", value: 0 },
            { status: "supported", event: "revival_skill_activated", metric: "activation_count", scope: "party_pure_and_back_current_records", deckIndices: { from: 0, to: 6, inclusive: true }, aggregate: "any_gt_zero", expected: true, rawPolarity: 0 },
        ]);
        const coverage = (0, team_analysis_db28_builder_1.buildDatabaseTeamAnalysisDb28Coverage)(dataset, 2);
        (0, assert_1.equal)(coverage.resolutionCount, 2);
        (0, assert_1.equal)(coverage.supportedPredicateCount, 2);
        (0, assert_1.equal)(coverage.partialResolutionCount, 2);
    });
    (0, mocha_1.it)("preserves nonzero party polarity as requires-none", () => { const value = fixture(); value.tables.skill_causalities[1].cau_val1 = 1; const dataset = build(value); const predicate = dataset.resolutions[1].predicate; (0, assert_1.equal)(predicate.scope === "party_pure_and_back_current_records" && predicate.expected, false); (0, assert_1.equal)((0, team_analysis_db28_builder_1.buildDatabaseTeamAnalysisDb28Coverage)(dataset, 2).nonzeroPolarityCount, 1); });
    (0, mocha_1.it)("allows ignored type-47 payload values without reinterpretation", () => { const dataset = build(fixture()); (0, assert_1.deepStrictEqual)(dataset.resolutions[0].raw, { cauVal1: 99, cauVal2: 98, cauVal3: 97 }); });
    (0, mocha_1.it)("rejects a mutated increment writer", () => { const value = fixture(); value.evidence.counter.incrementWriter.codeSha256 = "0".repeat(64); (0, assert_1.throws)(() => build(value), /increment writer native code mismatch/); });
    (0, mocha_1.it)("rejects a wrong current-record vtable relocation", () => { const value = fixture(); value.inspection.relocations[1].symbolName = "other"; (0, assert_1.throws)(() => build(value), /InGameData vtable evidence mismatch/); });
    (0, mocha_1.it)("rejects an incomplete parameter audit", () => { const value = fixture(); value.evidence.handlers[0].ignoredParameters = ["cau_val1", "cau_val2"]; (0, assert_1.throws)(() => build(value), /handler semantics mismatch/); });
    (0, mocha_1.it)("rejects a nonnumeric type-54 polarity", () => { const value = fixture(); value.tables.skill_causalities[1].cau_val1 = "unknown"; (0, assert_1.throws)(() => build(value), /invalid polarity/); });
    (0, mocha_1.it)("reconciles unique causality cardinality", () => { const value = fixture(); value.db8.causalityGaps[0].uniqueCausalityCount = 2; (0, assert_1.throws)(() => build(value), /source gap accounting mismatch/); });
    (0, mocha_1.it)("rejects a null SQLite identity", () => { const value = fixture(); value.tables.skill_causalities.push({ id: null, causality_type: 1, cau_val1: 0, cau_val2: 0, cau_val3: 0 }); (0, assert_1.throws)(() => build(value), /has no id/); });
});
//# sourceMappingURL=team-analysis-db28-builder.spec.js.map