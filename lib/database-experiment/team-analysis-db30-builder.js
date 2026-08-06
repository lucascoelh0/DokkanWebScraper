"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildDatabaseTeamAnalysisDb30Coverage = exports.buildDatabaseTeamAnalysisDb30Dataset = void 0;
const crypto_1 = require("crypto");
const COLUMNS = ["efficacy_type", "exec_timing_type", "exec_game_type", "target_type", "calc_option", "turn", "is_once", "probability", "causality_conditions", "eff_value1", "eff_value2", "eff_value3"];
const ROLES = { passive_skill_row_constructor: "sqlite_eff_value_columns_stored_at_offsets_128_132_136", create_passive_skill: "passive_offsets_128_132_136_copied_in_order_to_runtime_values", ability_status_efficacy_constructor: "three_runtime_values_materialized_in_index_order", call_change_param_initializer: "runtime_values_copied_to_call_param_offsets_40_48_56", removal_handler: "reorders_three_values_into_exact_removal_selector_then_zeros_target_and_source_status", exact_efficacy_remover: "removes_entries_matching_category_deck_index_skill_type_and_skill_id", target_status_lookup: "looks_up_target_status_by_deck_category_skill_type_and_skill_id" };
const CONCLUSIONS = ["efficacy_110_removes_exactly_selected_efficacy_info_entries", "eff_value1_is_raw_skill_type_selector", "eff_value2_is_raw_skill_id_selector", "eff_value3_is_raw_removal_category_selector", "matching_target_status_and_source_status_are_written_raw_zero"];
const UNKNOWNS = ["skill_type_15_human_name_and_target_dictionary", "category_selector_enum_names", "source_target_type_16_human_name", "status_raw_zero_enum_name_beyond_inactive_handler_behavior", "activation_timing_and_calculation_bucket", "recurrence_and_probability_order"];
function sha(value) { return (0, crypto_1.createHash)("sha256").update(value).digest("hex"); }
function integer(value) { const n = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : NaN; return Number.isSafeInteger(n) ? n : undefined; }
function uint32(value) { const n = integer(value); return n !== undefined && n >= 0 && n <= 0xffffffff ? n : undefined; }
function int32(value) { const n = integer(value); return n !== undefined && n >= -0x80000000 && n <= 0x7fffffff ? n : undefined; }
function count(values) { const out = {}; for (const v of values)
    out[v === null ? "null" : String(v)] = (out[v === null ? "null" : String(v)] ?? 0) + 1; return Object.fromEntries(Object.entries(out).sort(([a], [b]) => a.localeCompare(b, "en", { numeric: true }))); }
function validateEvidence(i, e, native) {
    if (e.schemaVersion !== 1 || e.sourceSha256 !== native || e.efficacyType !== 110 || e.auditScope !== "efficacy-110-exact-removal-and-status-inactivation" || JSON.stringify(e.conclusions) !== JSON.stringify(CONCLUSIONS) || JSON.stringify(e.unknowns) !== JSON.stringify(UNKNOWNS))
        throw new Error("DB30 evidence identity mismatch");
    if (JSON.stringify(e.valueBindings) !== JSON.stringify([{ column: "eff_value1", callChangeParamOffset: 40, runtimeRole: "skill_type_selector" }, { column: "eff_value2", callChangeParamOffset: 48, runtimeRole: "skill_id_selector" }, { column: "eff_value3", callChangeParamOffset: 56, runtimeRole: "removal_category_selector" }]) || e.codeRegions.length !== Object.keys(ROLES).length || new Set(e.codeRegions.map(v => v.role)).size !== e.codeRegions.length)
        throw new Error("DB30 evidence shape mismatch");
    for (const r of e.codeRegions) {
        if (!(r.role in ROLES) || ROLES[r.role] !== r.observation || r.sizeBytes <= 0 || sha(i.readVirtualBytes(r.vma, r.sizeBytes)) !== r.codeSha256)
            throw new Error(`DB30 native region mismatch ${r.role}`);
        if (!r.symbol.startsWith("local@")) {
            const s = i.symbols.find(v => v.name === r.symbol);
            if (!s || s.value !== r.vma || s.size !== r.sizeBytes)
                throw new Error(`DB30 symbol mismatch ${r.role}`);
        }
    }
    const info = e.abilityEfficacyInfoVtable, status = e.abilityStatusEfficacyVtable;
    const exactSlots = [{ offset: 48, symbol: "_ZNK19AbilityEfficacyInfo10getDeckIdxEv" }, { offset: 64, symbol: "_ZNK19AbilityEfficacyInfo15getCategoryTypeEv" }, { offset: 96, symbol: "_ZNK19AbilityEfficacyInfo12getSkillTypeEv" }, { offset: 112, symbol: "_ZNK19AbilityEfficacyInfo10getSkillIdEv" }];
    const rel = (base, off, sym) => { const x = i.relocations.filter(v => v.offset === base + off); return x.length === 1 && x[0].symbolName === sym; };
    if (info.symbol !== "_ZTV19AbilityEfficacyInfo" || info.sizeBytes !== 624 || JSON.stringify(info.slots) !== JSON.stringify(exactSlots) || !i.symbols.some(v => v.name === info.symbol && v.value === info.vma && v.size === info.sizeBytes) || !info.slots.every(v => rel(info.vma, v.offset, v.symbol)))
        throw new Error("DB30 efficacy-info vtable mismatch");
    if (status.symbol !== "_ZTV21AbilityStatusEfficacy" || status.sizeBytes !== 264 || status.targetTypeSlotOffset !== 168 || status.targetTypeSymbol !== "_ZNK21AbilityStatusEfficacy13getTargetTypeEv" || !i.symbols.some(v => v.name === status.symbol && v.value === status.vma && v.size === status.sizeBytes) || !rel(status.vma, 168, status.targetTypeSymbol))
        throw new Error("DB30 status vtable mismatch");
    if (JSON.stringify(e.runtimeBehavior) !== JSON.stringify({ removalMatchFields: ["removal_category_selector", "selected_deck_index", "skill_type_selector", "skill_id_selector"], statusLookupCategoryOneSkillTypes: [10, 13, 18], statusLookupCategoryOtherwise: 0, alternateDeckIndexWhenSourceTargetType: 16, primaryDeckIndexCallChangeParamOffset: 0, alternateDeckIndexCallChangeParamOffset: 72, targetStatusWriteOffset: 20, sourceStatusWriteOffset: 20, writtenStatusRaw: 0 }))
        throw new Error("DB30 runtime behavior mismatch");
}
function buildDatabaseTeamAnalysisDb30Dataset(o) {
    if (o.db8.contractVersion !== "0.7.0" || o.db9.contractVersion !== "0.8.0" || o.db11.contractVersion !== "0.10.0" || o.db8.sourceSha256 !== o.db9.sourceDatabaseSha256 || o.db8.sourceSha256 !== o.db11.sourceSha256 || o.db8.sourceSnapshotVersion !== o.db9.sourceSnapshotVersion || o.db8.sourceSnapshotVersion !== o.db11.sourceSnapshotVersion || o.db9.sourceDb8.sha256 !== o.db8Sha256 || o.db9.nativeRuntime.sha256 !== o.nativeSha256 || o.db9.nativeRuntime.sizeBytes !== o.nativeSizeBytes)
        throw new Error("DB30 source lineage mismatch");
    validateEvidence(o.inspection, o.evidence, o.nativeSha256);
    const gap = o.db8.efficacyGaps.filter(v => integer(v.efficacyType) === 110), runtime = o.db9.efficacyGapEvidence.filter(v => v.enumValue === 110), dispatch = o.db9.efficacyDispatchSlots.filter(v => v.enumValue === 110), handler = o.evidence.codeRegions.find(v => v.role === "removal_handler");
    if (gap.length !== 1 || runtime.length !== 1 || dispatch.length !== 1 || runtime[0].identityStatus !== "runtime_identified" || runtime[0].occurrenceCount !== gap[0].ruleCount || runtime[0].affectedStateCount !== gap[0].affectedStateCount || runtime[0].symbol !== handler.symbol || runtime[0].symbolAddress !== handler.vma || dispatch[0].status !== "identified" || dispatch[0].symbol !== handler.symbol || dispatch[0].symbolAddress !== handler.vma)
        throw new Error("DB30 runtime lineage mismatch");
    const rows = new Map();
    for (const row of o.tables.passive_skills ?? []) {
        const id = String(row.id);
        if (rows.has(id))
            throw new Error(`DB30 duplicate passive row ${id}`);
        rows.set(id, row);
    }
    const resolutions = [], keys = new Set();
    for (const state of o.db11.states)
        for (const rule of state.passive?.rules ?? []) {
            if (integer(rule.source.efficacyType) !== 110)
                continue;
            const key = `${state.stateKey}|${rule.ruleKey}`;
            if (keys.has(key))
                throw new Error(`DB30 duplicate resolution ${key}`);
            keys.add(key);
            const row = rows.get(rule.source.passiveSkillId);
            if (!row || !["id", ...COLUMNS].every(c => Object.prototype.hasOwnProperty.call(row, c)) || integer(row.efficacy_type) !== 110)
                throw new Error(`DB30 incomplete row ${rule.source.passiveSkillId}`);
            const skillType = uint32(row.eff_value1), skillId = int32(row.eff_value2), category = uint32(row.eff_value3);
            if (skillType === undefined || skillId === undefined || category === undefined)
                throw new Error(`DB30 invalid selector ${rule.source.passiveSkillId}`);
            const joined = skillType === 2 && rows.has(String(skillId));
            resolutions.push({ stateKey: state.stateKey, ruleKey: rule.ruleKey, passiveSkillId: rule.source.passiveSkillId, efficacyType: 110, operation: "remove_efficacy_and_inactivate_status", semanticStatus: "partial", selector: { skillType: { raw: row.eff_value1, runtimeUnsignedInteger: skillType, semanticName: "unknown" }, skillId: { raw: row.eff_value2, runtimeSignedInteger: skillId }, removalCategory: { raw: row.eff_value3, runtimeUnsignedInteger: category, semanticName: "unknown" }, selectedDeckIndex: { primarySource: "call_change_param_offset_0", alternateSource: "call_change_param_offset_72", alternateWhenSourceTargetTypeRaw: 16, sourceTargetTypeSemanticName: "unknown" }, exactRemovalMatchFields: ["category", "deck_index", "skill_type", "skill_id"] }, targetJoin: joined ? { status: "partial", kind: "candidate_passive_skill_id", table: "passive_skills", rowId: String(skillId), boundary: "skill_type_2_enum_name_unproven" } : { status: "unknown", kind: "unknown_skill_type", rawSkillType: row.eff_value1, rawSkillId: row.eff_value2 }, statusMutation: { targetStatus: { mutation: "inactivated", when: "lookup_returns_status" }, sourceStatus: { mutation: "inactivated", when: "always_after_lookup" }, rawWriteOffset: 20, rawWrittenValue: 0, enumNameStatus: "unknown", lookupCategory: { raw: [10, 13, 18].includes(skillType) ? 1 : 0, source: "skill_type_membership_10_13_18" } }, activation: { executionTimingType: row.exec_timing_type, executionGameType: row.exec_game_type, targetType: row.target_type, calculationOption: row.calc_option, turn: row.turn, isOnce: row.is_once, probability: row.probability, causalityConditions: row.causality_conditions, conditionStatus: rule.conditionStatus, timingStatus: "unknown", calculationBucket: "unknown", recurrence: "unknown" }, provenance: { database: { table: "passive_skills", rowId: rule.source.passiveSkillId, columns: [...COLUMNS], ...(joined ? { targetRow: { table: "passive_skills", rowId: String(skillId) } } : {}) }, runtime: { fileName: "libcocos2dcpp.so", sha256: o.nativeSha256, evidenceFile: "native-efficacy-removal-semantics.json", evidenceSha256: o.evidenceSha256, codeRegions: o.evidence.codeRegions } } });
        }
    resolutions.sort((a, b) => a.stateKey.localeCompare(b.stateKey, "en", { numeric: true }) || a.ruleKey.localeCompare(b.ruleKey, "en", { numeric: true }));
    if (resolutions.length !== gap[0].ruleCount || new Set(resolutions.map(v => v.stateKey)).size !== gap[0].affectedStateCount)
        throw new Error("DB30 source accounting mismatch");
    return { schemaVersion: 1, contract: "dokkan-team-analysis-efficacy-removal-native-semantics-experiment", contractVersion: "0.29.0", generatedAt: o.db11.generatedAt, sourceSnapshotVersion: o.db8.sourceSnapshotVersion, sourceDatabaseSha256: o.db8.sourceSha256, sourceDb8: { fileName: "team-analysis-db8-evidence-experiment.json.gz", sha256: o.db8Sha256, contractVersion: "0.7.0" }, sourceDb9: { fileName: "team-analysis-db9-runtime-evidence.json.gz", sha256: o.db9Sha256, contractVersion: "0.8.0" }, sourceDb11: { fileName: "team-analysis-db11-experiment.json.gz", sha256: o.db11Sha256, contractVersion: "0.10.0" }, nativeRuntime: { fileName: "libcocos2dcpp.so", sha256: o.nativeSha256, sizeBytes: o.nativeSizeBytes }, nativeEvidence: { fileName: "native-efficacy-removal-semantics.json", sha256: o.evidenceSha256 }, inheritedSemanticPromotionCount: 3, semanticPromotionCount: 1, resolutions };
}
exports.buildDatabaseTeamAnalysisDb30Dataset = buildDatabaseTeamAnalysisDb30Dataset;
function buildDatabaseTeamAnalysisDb30Coverage(d, sourceGapRuleCount) { return { schemaVersion: 1, sourceGapRuleCount, resolutionCount: d.resolutions.length, affectedStateCount: new Set(d.resolutions.map(v => v.stateKey)).size, uniquePassiveSkillCount: new Set(d.resolutions.map(v => v.passiveSkillId)).size, candidatePassiveTargetJoinCount: d.resolutions.filter(v => v.targetJoin.status === "partial").length, unknownTargetJoinCount: d.resolutions.filter(v => v.targetJoin.status === "unknown").length, partialResolutionCount: d.resolutions.length, skillTypeCounts: count(d.resolutions.map(v => v.selector.skillType.raw)), removalCategoryCounts: count(d.resolutions.map(v => v.selector.removalCategory.raw)), executionTimingTypeCounts: count(d.resolutions.map(v => v.activation.executionTimingType)), calculationOptionCounts: count(d.resolutions.map(v => v.activation.calculationOption)), inheritedSemanticPromotionCount: 3, semanticPromotionCount: 1 }; }
exports.buildDatabaseTeamAnalysisDb30Coverage = buildDatabaseTeamAnalysisDb30Coverage;
//# sourceMappingURL=team-analysis-db30-builder.js.map