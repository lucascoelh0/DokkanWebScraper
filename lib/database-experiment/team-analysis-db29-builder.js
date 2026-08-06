"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildDatabaseTeamAnalysisDb29Coverage = exports.buildDatabaseTeamAnalysisDb29Dataset = void 0;
const crypto_1 = require("crypto");
const DATABASE_COLUMNS = ["efficacy_type", "exec_timing_type", "exec_game_type", "target_type", "calc_option", "turn", "is_once", "probability", "causality_conditions", "eff_value1", "eff_value2", "eff_value3"];
const ROLES = new Map([
    ["attack_break_handler", "enemy_index_at_call_param_offset_0_then_raw_condition_check_and_none_value_type_111_registration"],
    ["condition_checker", "consumes_two_raw_condition_masks_without_proven_human_names"],
    ["generic_info_creator", "copies_call_param_identity_and_three_generic_values_into_efficacy_info"],
    ["none_value_registration", "registers_generic_efficacy_info_without_value_specific_mutation"],
    ["breaking_action_selector", "counts_type_111_entries_matching_enemy_index_and_selects_first_n_eligible_current_actions"],
    ["break_action_bank_setup", "marks_selected_actions_and_registers_attack_break_action_bank_while_one_raw_condition_path_removes_markers"],
    ["separate_invalidation_handler", "efficacy_112_uses_shared_raw_condition_mask_as_separate_invalidation_family"],
]);
const CONCLUSIONS = ["efficacy_111_is_attack_break_marker", "eff_value1_2_3_are_not_consumed_by_attack_break_selection", "target_is_runtime_enemy_index", "each_matching_marker_selects_up_to_one_eligible_current_action_in_order"];
const UNKNOWNS = ["condition_mask_16777216_human_name", "condition_mask_33554432_human_name", "target_type_enum_3_4", "execution_timing_type_4_5", "calculation_option_0_2", "probability_application_order", "action_eligibility_field_names", "exact_duration_and_recurrence", "efficacy_112_invalidation_interaction"];
function sha256(value) { return (0, crypto_1.createHash)("sha256").update(value).digest("hex"); }
function integer(value) { const parsed = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : NaN; return Number.isSafeInteger(parsed) ? parsed : undefined; }
function count(values) { const result = {}; for (const value of values) {
    const key = value === null ? "null" : String(value);
    result[key] = (result[key] ?? 0) + 1;
} return Object.fromEntries(Object.entries(result).sort(([a], [b]) => a.localeCompare(b, "en", { numeric: true }))); }
function statusCounts(values) { return { supported: values.filter(value => value === "supported").length, partial: values.filter(value => value === "partial").length, unknown: values.filter(value => value === "unknown").length }; }
function validateCode(inspection, region) { const symbol = inspection.symbols.find(value => value.name === region.symbol); if (!symbol || symbol.value !== region.vma || symbol.size !== region.sizeBytes || region.sizeBytes <= 0 || sha256(inspection.readVirtualBytes(region.vma, region.sizeBytes)) !== region.codeSha256)
    throw new Error(`DB29 native code mismatch ${region.role}`); }
function relocation(inspection, offset, symbol) { const matches = inspection.relocations.filter(value => value.offset === offset); return matches.length === 1 && matches[0].symbolName === symbol; }
function validateEvidence(inspection, evidence, nativeSha256) {
    if (evidence.schemaVersion !== 1 || evidence.sourceSha256 !== nativeSha256 || evidence.efficacyType !== 111 || evidence.auditScope !== "efficacy-111-attack-break-marker-target-and-multiplicity" || JSON.stringify(evidence.conditionMasksRaw) !== JSON.stringify([16777216, 33554432]) || JSON.stringify(evidence.conclusions) !== JSON.stringify(CONCLUSIONS) || JSON.stringify(evidence.unknowns) !== JSON.stringify(UNKNOWNS))
        throw new Error("DB29 native evidence identity mismatch");
    if (evidence.codeRegions.length !== ROLES.size || new Set(evidence.codeRegions.map(value => value.role)).size !== ROLES.size)
        throw new Error("DB29 native evidence region cardinality mismatch");
    for (const region of evidence.codeRegions) {
        if (!ROLES.has(region.role) || typeof region.observation !== "string" || ROLES.get(region.role) !== region.observation)
            throw new Error(`DB29 native observation mismatch ${region.role}`);
        validateCode(inspection, region);
    }
    const vtable = evidence.abilityEfficacyInfoVtable, symbol = inspection.symbols.find(value => value.name === vtable.symbol);
    if (vtable.symbol !== "_ZTV19AbilityEfficacyInfo" || vtable.deckIndexSymbol !== "_ZNK19AbilityEfficacyInfo10getDeckIdxEv" || vtable.efficacyTypeSymbol !== "_ZNK19AbilityEfficacyInfo15getEfficacyTypeEv" || !symbol || symbol.value !== vtable.vma || symbol.size !== vtable.sizeBytes || vtable.sizeBytes !== 624 || vtable.deckIndexSlotOffset !== 48 || vtable.efficacyTypeSlotOffset !== 144 || !relocation(inspection, vtable.vma + 48, vtable.deckIndexSymbol) || !relocation(inspection, vtable.vma + 144, vtable.efficacyTypeSymbol))
        throw new Error("DB29 AbilityEfficacyInfo vtable mismatch");
    const consumer = evidence.consumer;
    if (consumer.target !== "enemy_index" || consumer.targetSource !== "call_change_param_offset_0_copied_to_efficacy_info_deck_index" || consumer.multiplicity !== "one_eligible_current_action_per_matching_type_111_entry" || consumer.selectionOrder !== "current_action_order_first_n" || JSON.stringify(consumer.eligibility) !== JSON.stringify([{ actionOffset: 8, predicate: "int32_nonzero", semanticName: "unknown" }, { actionOffset: 44, predicate: "byte_bit_0_clear", semanticName: "unknown" }]) || consumer.removedOnRawConditionMask !== 16777216)
        throw new Error("DB29 attack-break consumer evidence mismatch");
}
function buildDatabaseTeamAnalysisDb29Dataset(options) {
    if (options.db8.contractVersion !== "0.7.0" || options.db9.contractVersion !== "0.8.0" || options.db11.contractVersion !== "0.10.0" || options.db8.semanticPromotionCount !== 0 || options.db9.semanticPromotionCount !== 0 || options.db8.sourceSha256 !== options.db9.sourceDatabaseSha256 || options.db8.sourceSha256 !== options.db11.sourceSha256 || options.db8.sourceSnapshotVersion !== options.db9.sourceSnapshotVersion || options.db8.sourceSnapshotVersion !== options.db11.sourceSnapshotVersion || options.db9.sourceDb8.sha256 !== options.db8Sha256 || options.db9.nativeRuntime.sha256 !== options.nativeSha256 || options.db9.nativeRuntime.sizeBytes !== options.nativeSizeBytes)
        throw new Error("DB29 source lineage mismatch");
    validateEvidence(options.inspection, options.evidence, options.nativeSha256);
    const gaps = options.db8.efficacyGaps.filter(value => integer(value.efficacyType) === 111), runtimes = options.db9.efficacyGapEvidence.filter(value => value.enumValue === 111), dispatches = options.db9.efficacyDispatchSlots.filter(value => value.enumValue === 111);
    if (gaps.length !== 1 || runtimes.length !== 1 || dispatches.length !== 1)
        throw new Error("DB29 efficacy 111 evidence cardinality mismatch");
    const gap = gaps[0], runtime = runtimes[0], dispatch = dispatches[0], handler = options.evidence.codeRegions.find(value => value.role === "attack_break_handler");
    if (gap.statusCounts.unknown !== gap.ruleCount || runtime.identityStatus !== "runtime_identified" || runtime.occurrenceCount !== gap.ruleCount || runtime.affectedStateCount !== gap.affectedStateCount || runtime.symbol !== handler.symbol || runtime.symbolAddress !== handler.vma || dispatch.status !== "identified" || dispatch.symbol !== handler.symbol || dispatch.symbolAddress !== handler.vma)
        throw new Error("DB29 efficacy 111 evidence lineage mismatch");
    const rows = new Map();
    for (const row of options.tables.passive_skills ?? []) {
        if (row.id === null || row.id === "")
            throw new Error("DB29 passive row has no id");
        const id = String(row.id);
        if (rows.has(id))
            throw new Error(`DB29 duplicate passive_skills row ${id}`);
        rows.set(id, row);
    }
    const resolutions = [], keys = new Set();
    for (const state of options.db11.states)
        for (const rule of state.passive?.rules ?? []) {
            if (integer(rule.source.efficacyType) !== 111)
                continue;
            const key = `${state.stateKey}|${rule.ruleKey}`;
            if (keys.has(key))
                throw new Error(`DB29 duplicate state/rule ${key}`);
            keys.add(key);
            const row = rows.get(rule.source.passiveSkillId);
            if (!row || !["id", ...DATABASE_COLUMNS].every(column => Object.prototype.hasOwnProperty.call(row, column)) || String(row.id) !== rule.source.passiveSkillId || integer(row.efficacy_type) !== 111)
                throw new Error(`DB29 passive row missing or incomplete ${rule.source.passiveSkillId}`);
            resolutions.push({
                stateKey: state.stateKey, ruleKey: rule.ruleKey, passiveSkillId: rule.source.passiveSkillId, efficacyType: 111, operation: "attack_break_marker", semanticStatus: "partial",
                effect: { status: "supported", target: { kind: "enemy_index", runtimeSource: "call_change_param_offset_0", efficacyInfoField: "deck_index", structuredTargetType: { raw: row.target_type, status: "unknown" } }, behavioralParameters: { kind: "none", status: "supported", rawEffValue1: row.eff_value1, rawEffValue2: row.eff_value2, rawEffValue3: row.eff_value3 }, multiplicity: { markerUnit: 1, countSource: "matching_efficacy_111_entries_for_enemy_index", result: "up_to_n_eligible_current_enemy_actions", selectionOrder: "current_action_order_first_n", eligibility: [{ actionOffset: 8, predicate: "int32_nonzero", semanticName: "unknown" }, { actionOffset: 44, predicate: "byte_bit_0_clear", semanticName: "unknown" }] } },
                nativeGate: { checker: "AbilityEfficacyBadConditionFunc::checkEnableCondition", conditionMasksRaw: [16777216, 33554432], semanticNames: ["unknown", "unknown"] },
                lifecycle: { removalObservedOnRawConditionMask: 16777216, removedEntryPredicate: "unknown", duration: "unknown", recurrence: "unknown" },
                activation: { executionTimingType: row.exec_timing_type, executionGameType: row.exec_game_type, calculationOption: row.calc_option, turn: row.turn, isOnce: row.is_once, probability: row.probability, causalityConditions: row.causality_conditions, conditionStatus: rule.conditionStatus, timingStatus: "unknown", calculationBucket: "unknown" },
                provenance: { database: { table: "passive_skills", rowId: rule.source.passiveSkillId, columns: [...DATABASE_COLUMNS] }, runtime: { fileName: "libcocos2dcpp.so", sha256: options.nativeSha256, evidenceFile: "native-attack-break-semantics.json", evidenceSha256: options.evidenceSha256, codeRegions: options.evidence.codeRegions } },
            });
        }
    resolutions.sort((a, b) => a.stateKey.localeCompare(b.stateKey, "en", { numeric: true }) || a.ruleKey.localeCompare(b.ruleKey, "en", { numeric: true }));
    if (resolutions.length !== gap.ruleCount || new Set(resolutions.map(value => value.stateKey)).size !== gap.affectedStateCount)
        throw new Error("DB29 source gap accounting mismatch");
    return { schemaVersion: 1, contract: "dokkan-team-analysis-attack-break-native-semantics-experiment", contractVersion: "0.28.0", generatedAt: options.db11.generatedAt, sourceSnapshotVersion: options.db8.sourceSnapshotVersion, sourceDatabaseSha256: options.db8.sourceSha256, sourceDb8: { fileName: "team-analysis-db8-evidence-experiment.json.gz", sha256: options.db8Sha256, contractVersion: "0.7.0" }, sourceDb9: { fileName: "team-analysis-db9-runtime-evidence.json.gz", sha256: options.db9Sha256, contractVersion: "0.8.0" }, sourceDb11: { fileName: "team-analysis-db11-experiment.json.gz", sha256: options.db11Sha256, contractVersion: "0.10.0" }, nativeRuntime: { fileName: "libcocos2dcpp.so", sha256: options.nativeSha256, sizeBytes: options.nativeSizeBytes }, nativeEvidence: { fileName: "native-attack-break-semantics.json", sha256: options.evidenceSha256 }, inheritedSemanticPromotionCount: 3, semanticPromotionCount: 1, resolutions };
}
exports.buildDatabaseTeamAnalysisDb29Dataset = buildDatabaseTeamAnalysisDb29Dataset;
function buildDatabaseTeamAnalysisDb29Coverage(dataset, sourceGapRuleCount) {
    const zero = (value) => integer(value) === 0;
    return { schemaVersion: 1, sourceGapRuleCount, resolutionCount: dataset.resolutions.length, affectedStateCount: new Set(dataset.resolutions.map(value => value.stateKey)).size, uniquePassiveSkillCount: new Set(dataset.resolutions.map(value => value.passiveSkillId)).size, supportedEffectCount: dataset.resolutions.filter(value => value.effect.status === "supported").length, partialResolutionCount: dataset.resolutions.filter(value => value.semanticStatus === "partial").length, zeroRawValueRuleCount: dataset.resolutions.filter(value => zero(value.effect.behavioralParameters.rawEffValue1) && zero(value.effect.behavioralParameters.rawEffValue2) && zero(value.effect.behavioralParameters.rawEffValue3)).length, conditionStatusCounts: statusCounts(dataset.resolutions.map(value => value.activation.conditionStatus)), executionTimingTypeCounts: count(dataset.resolutions.map(value => value.activation.executionTimingType)), targetTypeCounts: count(dataset.resolutions.map(value => value.effect.target.structuredTargetType.raw)), calculationOptionCounts: count(dataset.resolutions.map(value => value.activation.calculationOption)), isOnceCounts: count(dataset.resolutions.map(value => value.activation.isOnce)), probabilityCounts: count(dataset.resolutions.map(value => value.activation.probability)), inheritedSemanticPromotionCount: 3, semanticPromotionCount: 1 };
}
exports.buildDatabaseTeamAnalysisDb29Coverage = buildDatabaseTeamAnalysisDb29Coverage;
//# sourceMappingURL=team-analysis-db29-builder.js.map