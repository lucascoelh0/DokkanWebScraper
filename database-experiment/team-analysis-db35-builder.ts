import { createHash } from "crypto";
import { DatabaseExperimentTables } from "./builder";
import { NativeRuntimeElfInspection } from "./native-runtime-elf-adapter";
import { DatabaseTeamAnalysisDb11Dataset } from "./team-analysis-db11-contract";
import { DatabaseTeamAnalysisDb33Dataset } from "./team-analysis-db33-contract";
import {
    DatabaseTeamAnalysisDb35Coverage,
    DatabaseTeamAnalysisDb35Dataset,
    Db35NativeEvidence,
    Db35RuleTarget,
    Db35TargetSemantic,
} from "./team-analysis-db35-contract";

const sha256 = (value: Buffer) => createHash("sha256").update(value).digest("hex");
const integer = (value: unknown) => typeof value === "number" && Number.isSafeInteger(value)
    ? value
    : typeof value === "string" && value.trim() && Number.isSafeInteger(Number(value)) ? Number(value) : undefined;
const rowId = (row: Record<string, unknown>) => row.id === null || row.id === undefined ? undefined : String(row.id);
const EXPECTED_DB33_SHA256 = "70fbd3a714ffeec21392ada5fd070e2c52986ab20d67418d397145071f809024";
const EXPECTED_DB32_SHA256 = "29c408e3ced29f3d07fe8a4715afb88a6d950c52be43cb7fadc7d2b23de4fdfa";
const EXPECTED_DISPATCH_INSTRUCTIONS = [
    { vma: 64243676, hex: "080040f9", role: "load_status_object" },
    { vma: 64243680, hex: "084d40f9", role: "load_target_getter_from_vtable" },
    { vma: 64243684, hex: "00013fd6", role: "call_target_getter" },
    { vma: 64243812, hex: "28d400b0", role: "load_dispatch_page" },
    { vma: 64243816, hex: "08411791", role: "add_dispatch_offset" },
    { vma: 64243824, hex: "085976f8", role: "load_handler_by_raw_target_index" },
] as const;
const EXPECTED_UNKNOWNS = [
    "target_types_0_5_7_8_9_10_11_not_present_in_projected_passives",
    "target_type_6_null_dispatch",
    "sqlite_sub_target_set_to_runtime_status_binding",
    "sub_target_value_type_semantics",
    "sub_target_boolean_composition",
    "duration",
    "recurrence",
    "expiry",
    "reset",
    "calculation_bucket",
] as const;

const EXPECTED_SLOTS = [
    { raw: 0, handlerRole: "target_none", symbol: "_ZN21AbilityEfficacyTarget10targetNoneERKNSt6__ndk110shared_ptrI22AbilityStatusCausalityEEPFvPN19AbilityEfficacyCore15CallChangeParamEE" },
    { raw: 1, handlerRole: "target_self", symbol: "_ZN21AbilityEfficacyTarget10targetSelfERKNSt6__ndk110shared_ptrI22AbilityStatusCausalityEEPFvPN19AbilityEfficacyCore15CallChangeParamEE" },
    { raw: 2, handlerRole: "target_party_all", symbol: "_ZN21AbilityEfficacyTarget14targetPartyAllERKNSt6__ndk110shared_ptrI22AbilityStatusCausalityEEPFvPN19AbilityEfficacyCore15CallChangeParamEE" },
    { raw: 3, handlerRole: "target_enemy_selected", symbol: "_ZN21AbilityEfficacyTarget11targetEnemyERKNSt6__ndk110shared_ptrI22AbilityStatusCausalityEEPFvPN19AbilityEfficacyCore15CallChangeParamEE" },
    { raw: 4, handlerRole: "target_enemy_all", symbol: "_ZN21AbilityEfficacyTarget14targetEnemyAllERKNSt6__ndk110shared_ptrI22AbilityStatusCausalityEEPFvPN19AbilityEfficacyCore15CallChangeParamEE" },
    { raw: 5, handlerRole: "target_self_and_target", symbol: "_ZN21AbilityEfficacyTarget19targetSelfAndTargetERKNSt6__ndk110shared_ptrI22AbilityStatusCausalityEEPFvPN19AbilityEfficacyCore15CallChangeParamEE" },
    { raw: 6, handlerRole: null, symbol: null },
    { raw: 7, handlerRole: "target_party_exist_chara", symbol: "_ZN21AbilityEfficacyTarget21targetPartyExistCharaERKNSt6__ndk110shared_ptrI22AbilityStatusCausalityEEPFvPN19AbilityEfficacyCore15CallChangeParamEE" },
    { raw: 8, handlerRole: "target_except", symbol: "_ZN21AbilityEfficacyTarget19targetTargetExcepctERKNSt6__ndk110shared_ptrI22AbilityStatusCausalityEEPFvPN19AbilityEfficacyCore15CallChangeParamEE" },
    { raw: 9, handlerRole: "target_party_enemy_attack_order", symbol: "_ZN21AbilityEfficacyTarget33targetTargetPartyEnemyAttackOrderERKNSt6__ndk110shared_ptrI22AbilityStatusCausalityEEPFvPN19AbilityEfficacyCore15CallChangeParamEE" },
    { raw: 10, handlerRole: "target_slot_attacker", symbol: "_ZN21AbilityEfficacyTarget18targetSlotAttackerERKNSt6__ndk110shared_ptrI22AbilityStatusCausalityEEPFvPN19AbilityEfficacyCore15CallChangeParamEE" },
    { raw: 11, handlerRole: "target_party_slot_random", symbol: "_ZN21AbilityEfficacyTarget21targetPartySlotRandomERKNSt6__ndk110shared_ptrI22AbilityStatusCausalityEEPFvPN19AbilityEfficacyCore15CallChangeParamEE" },
    { raw: 12, handlerRole: "target_party_super_class", symbol: "_ZN21AbilityEfficacyTarget14targetPartyChoERKNSt6__ndk110shared_ptrI22AbilityStatusCausalityEEPFvPN19AbilityEfficacyCore15CallChangeParamEE" },
    { raw: 13, handlerRole: "target_party_extreme_class", symbol: "_ZN21AbilityEfficacyTarget15targetPartyGokuERKNSt6__ndk110shared_ptrI22AbilityStatusCausalityEEPFvPN19AbilityEfficacyCore15CallChangeParamEE" },
    { raw: 14, handlerRole: "target_enemy_super_class", symbol: "_ZN21AbilityEfficacyTarget14targetEnemyChoERKNSt6__ndk110shared_ptrI22AbilityStatusCausalityEEPFvPN19AbilityEfficacyCore15CallChangeParamEE" },
    { raw: 15, handlerRole: "target_enemy_extreme_class", symbol: "_ZN21AbilityEfficacyTarget15targetEnemyGokuERKNSt6__ndk110shared_ptrI22AbilityStatusCausalityEEPFvPN19AbilityEfficacyCore15CallChangeParamEE" },
    { raw: 16, handlerRole: "target_party_except_self", symbol: "_ZN21AbilityEfficacyTarget21targetPartyExceptSelfERKNSt6__ndk110shared_ptrI22AbilityStatusCausalityEEPFvPN19AbilityEfficacyCore15CallChangeParamEE" },
] as const;

const SUPPORTED_TARGETS: Db35TargetSemantic[] = [
    { raw: 1, scope: "self", candidateDomain: "ability_owner", candidateOrder: "single_owner_deck_index", selfInclusion: "included", classPredicateRaw: [], parametersRead: ["ability_owner_deck_index", "sub_target_predicate_result"], parametersIgnored: [] },
    { raw: 2, scope: "team_allies", candidateDomain: "player_party", candidateOrder: "deck_indices_0_through_6", selfInclusion: "included", classPredicateRaw: [], parametersRead: ["sub_target_predicate_result"], parametersIgnored: [] },
    { raw: 3, scope: "enemy", candidateDomain: "runtime_selected_enemy", candidateOrder: "stored_enemy_index_or_owner_target_fallback", selfInclusion: "not_applicable", classPredicateRaw: [], parametersRead: ["ability_owner_deck_index", "stored_enemy_target_index", "sub_target_predicate_result"], parametersIgnored: [] },
    { raw: 4, scope: "all_enemies", candidateDomain: "current_enemy_vector", candidateOrder: "enemy_vector_index_order", selfInclusion: "not_applicable", classPredicateRaw: [], parametersRead: ["current_enemy_count", "sub_target_predicate_result"], parametersIgnored: [] },
    { raw: 12, scope: "super_class_allies", candidateDomain: "player_party", candidateOrder: "deck_indices_0_through_6", selfInclusion: "included", classPredicateRaw: [1, 3], parametersRead: ["candidate_awakening_element_type", "sub_target_predicate_result"], parametersIgnored: [] },
    { raw: 13, scope: "extreme_class_allies", candidateDomain: "player_party", candidateOrder: "deck_indices_0_through_6", selfInclusion: "included", classPredicateRaw: [2, 3], parametersRead: ["candidate_awakening_element_type", "sub_target_predicate_result"], parametersIgnored: [] },
    { raw: 14, scope: "super_class_enemies", candidateDomain: "current_enemy_vector", candidateOrder: "enemy_vector_index_order", selfInclusion: "not_applicable", classPredicateRaw: [1, 3], parametersRead: ["candidate_awakening_element_type", "sub_target_predicate_result"], parametersIgnored: [] },
    { raw: 15, scope: "extreme_class_enemies", candidateDomain: "current_enemy_vector", candidateOrder: "enemy_vector_index_order", selfInclusion: "not_applicable", classPredicateRaw: [2, 3], parametersRead: ["candidate_awakening_element_type", "sub_target_predicate_result"], parametersIgnored: [] },
    { raw: 16, scope: "team_allies_excluding_self", candidateDomain: "player_party_for_projected_passive_category_0", candidateOrder: "deck_indices_0_through_6_except_owner", selfInclusion: "excluded", classPredicateRaw: [], parametersRead: ["ability_owner_deck_index", "skill_category", "sub_target_predicate_result"], parametersIgnored: [] },
];

const EXPECTED_REGION_SYMBOLS: Record<string, string> = {
    passive_skill_row_constructor: "_ZN12PassiveSkillC1EPN7SQLite33RowE",
    create_passive_skill: "_ZN14AbilityManager18createPassiveSkillEiiNSt6__ndk110shared_ptrI15PassiveSkillSetEE",
    dispatch_consumer: "_ZN19AbilityEfficacyCore16callEfficacyFuncE17SkillEfficacyTypeNSt6__ndk110shared_ptrI22AbilityStatusCausalityEE",
    call_param_initializer: "local@AbilityEfficacyTarget::targetSelf+0xe0",
    target_self: EXPECTED_SLOTS[1].symbol,
    target_party_all: EXPECTED_SLOTS[2].symbol,
    target_enemy_selected: EXPECTED_SLOTS[3].symbol,
    target_enemy_all: EXPECTED_SLOTS[4].symbol,
    target_party_super_class: EXPECTED_SLOTS[12].symbol,
    target_party_extreme_class: EXPECTED_SLOTS[13].symbol,
    target_enemy_super_class: EXPECTED_SLOTS[14].symbol,
    target_enemy_extreme_class: EXPECTED_SLOTS[15].symbol,
    target_party_except_self: EXPECTED_SLOTS[16].symbol,
    contains_sub_target: "_ZN21AbilityEfficacyTarget21containsSubTargetTypeERKNSt6__ndk110shared_ptrI22AbilityStatusCausalityEEii",
    owner_enemy_target_fallback: "_ZN21AbilityEfficacyTarget28getTargetEnemyIdxFromDeckIdxEi",
    super_class_candidate: "_ZN22AbilityEfficacyElement16isChoElementTypeEii",
    extreme_class_candidate: "_ZN22AbilityEfficacyElement17isGokuElementTypeEii",
    super_class_raw_predicate: "_ZN22AbilityEfficacyElement16isChoElementTypeE20AwakeningElementType",
    extreme_class_raw_predicate: "_ZN22AbilityEfficacyElement17isGokuElementTypeE20AwakeningElementType",
    target_getter: "_ZNK21AbilityStatusEfficacy13getTargetTypeEv",
};

export function projectDb35Target(value: unknown) {
    const semantic = SUPPORTED_TARGETS.find(item => item.raw === integer(value));
    return semantic
        ? { status: "supported" as const, value: { ...semantic, classPredicateRaw: [...semantic.classPredicateRaw], parametersRead: [...semantic.parametersRead], parametersIgnored: [...semantic.parametersIgnored] } }
        : { status: "unknown" as const, value: "unknown" as const };
}

function validateEvidence(inspection: NativeRuntimeElfInspection, evidence: Db35NativeEvidence, nativeSha256: string): void {
    const expectedBinding = { table: "passive_skills", column: "target_type", literalVma: 32873222, passiveSkillOffset: 64, createAbilityStatusOffset: 36, abilityStatusOffset: 224 };
    if (evidence.schemaVersion !== 1 || evidence.sourceSha256 !== nativeSha256 || evidence.auditScope !== "passive-target-type-native-dispatch-and-current-handler-behavior" || JSON.stringify(evidence.sqliteBinding) !== JSON.stringify(expectedBinding) || JSON.stringify(evidence.supportedTargets) !== JSON.stringify(SUPPORTED_TARGETS)) throw new Error("DB35 evidence identity mismatch");
    if (!inspection.readVirtualBytes(expectedBinding.literalVma, 12).equals(Buffer.from("target_type\0"))) throw new Error("DB35 SQLite literal mismatch");
    const dispatch = evidence.dispatch;
    if (dispatch.consumerSymbol !== EXPECTED_REGION_SYMBOLS.dispatch_consumer || dispatch.tableVma !== 92050896 || dispatch.entrySizeBytes !== 8 || dispatch.entryCount !== 17 || dispatch.zeroBytesSha256 !== "b707241545a346265aab1ffb32ff64b55bf8f8dc1b56a46ef33ce3d15db11d33" || sha256(inspection.readVirtualBytes(dispatch.tableVma, 136)) !== dispatch.zeroBytesSha256 || dispatch.targetGetterVtableOffsetFromObjectVptr !== 152 || dispatch.targetGetterSymbol !== EXPECTED_REGION_SYMBOLS.target_getter || JSON.stringify(dispatch.instructionBytes) !== JSON.stringify(EXPECTED_DISPATCH_INSTRUCTIONS) || JSON.stringify(dispatch.slots) !== JSON.stringify(EXPECTED_SLOTS.map(({ raw, handlerRole }) => ({ raw, handlerRole })))) throw new Error("DB35 dispatch metadata mismatch");
    for (const instruction of dispatch.instructionBytes) if (inspection.readVirtualBytes(instruction.vma, 4).toString("hex") !== instruction.hex) throw new Error(`DB35 dispatch instruction mismatch ${instruction.role}`);
    for (const slot of EXPECTED_SLOTS) {
        const relocations = inspection.relocations.filter(item => item.offset === dispatch.tableVma + slot.raw * 8);
        if (slot.symbol === null) {
            if (relocations.length !== 0 || inspection.readVirtualUint64(dispatch.tableVma + slot.raw * 8) !== 0n) throw new Error("DB35 null dispatch slot mismatch");
        } else if (relocations.length !== 1 || relocations[0].symbolName !== slot.symbol) throw new Error(`DB35 dispatch slot mismatch ${slot.raw}`);
    }
    if (evidence.codeRegions.length !== Object.keys(EXPECTED_REGION_SYMBOLS).length || new Set(evidence.codeRegions.map(item => item.role)).size !== evidence.codeRegions.length) throw new Error("DB35 code region cardinality mismatch");
    for (const region of evidence.codeRegions) {
        if (EXPECTED_REGION_SYMBOLS[region.role] !== region.symbol || sha256(inspection.readVirtualBytes(region.vma, region.sizeBytes)) !== region.codeSha256) throw new Error(`DB35 native code mismatch ${region.role}`);
        if (!region.symbol.startsWith("local@")) {
            const symbol = inspection.symbols.find(item => item.name === region.symbol);
            if (!symbol || symbol.value !== region.vma || symbol.size !== region.sizeBytes) throw new Error(`DB35 symbol mismatch ${region.role}`);
        }
    }
    const vtable = evidence.abilityStatusVtable;
    const symbol = inspection.symbols.find(item => item.name === vtable.symbol);
    if (!symbol || vtable.symbol !== "_ZTV22AbilityStatusCausality" || symbol.value !== vtable.vma || symbol.size !== vtable.sizeBytes || sha256(inspection.readVirtualBytes(vtable.vma, vtable.sizeBytes)) !== vtable.rawSha256 || vtable.targetGetterRelocationOffset !== 168 || vtable.targetGetterSymbol !== EXPECTED_REGION_SYMBOLS.target_getter || inspection.relocations.filter(item => item.offset === vtable.vma + 168 && item.symbolName === vtable.targetGetterSymbol).length !== 1) throw new Error("DB35 vtable mismatch");
    if (JSON.stringify(evidence.subTargetBoundary) !== JSON.stringify({ predicateRole: "contains_sub_target_type", appliedBeforeCallback: true, sqliteSetBinding: "unknown_in_db35", valueTypeSemantics: "unknown_in_db35" })) throw new Error("DB35 sub-target boundary mismatch");
    if (JSON.stringify(evidence.unknowns) !== JSON.stringify(EXPECTED_UNKNOWNS)) throw new Error("DB35 unknown boundary mismatch");
}

interface Db35CurrentTeamAnalysis {
    states: Array<{ passive?: { rules?: Array<{ effects?: Array<Record<string, unknown>> }> } }>;
}

export function buildDatabaseTeamAnalysisDb35Dataset(options: {
    db11: DatabaseTeamAnalysisDb11Dataset, db11Sha256: string,
    db33: DatabaseTeamAnalysisDb33Dataset, db33Sha256: string,
    tables: DatabaseExperimentTables, current: Db35CurrentTeamAnalysis, currentSha256: string,
    inspection: NativeRuntimeElfInspection, nativeSha256: string, nativeSizeBytes: number,
    evidence: Db35NativeEvidence, evidenceSha256: string,
}): DatabaseTeamAnalysisDb35Dataset {
    if (options.db11.contractVersion !== "0.10.0" || options.db33.contractVersion !== "0.32.0" || options.db33Sha256 !== EXPECTED_DB33_SHA256 || options.db33.sourceDb32.sha256 !== EXPECTED_DB32_SHA256 || options.db33.sourceDatabaseSha256 !== options.db11.sourceSha256 || options.db33.currentTeamAnalysis.sha256 !== options.currentSha256 || options.db33.nativeRuntime.sha256 !== options.nativeSha256 || options.db33.nativeRuntime.sizeBytes !== options.nativeSizeBytes) throw new Error("DB35 lineage mismatch");
    validateEvidence(options.inspection, options.evidence, options.nativeSha256);
    const rows = new Map((options.tables.passive_skills ?? []).map(row => [rowId(row)!, row]));
    const timings = new Map(options.db33.ruleTimings.map(rule => [`${rule.stateKey}|${rule.ruleKey}`, rule]));
    const proofRoles = options.evidence.codeRegions.map(item => item.role);
    const ruleTargets: Db35RuleTarget[] = [];
    for (const state of options.db11.states) for (const rule of state.passive?.rules ?? []) {
        const key = `${state.stateKey}|${rule.ruleKey}`;
        const row = rows.get(rule.source.passiveSkillId);
        const timing = timings.get(key);
        const target = projectDb35Target(rule.source.targetType);
        if (!row || !timing || timing.passiveSkillId !== rule.source.passiveSkillId || integer(row.target_type) !== integer(rule.source.targetType)) throw new Error(`DB35 source mismatch ${key}`);
        const handlerRole = target.status === "supported" ? options.evidence.dispatch.slots.find(item => item.raw === target.value.raw)?.handlerRole : undefined;
        ruleTargets.push({
            stateKey: state.stateKey, ruleKey: rule.ruleKey, passiveSkillId: rule.source.passiveSkillId,
            rawTargetType: rule.source.targetType, effectCount: rule.effects.length, target,
            subTarget: { status: "unknown", rawSetId: row.sub_target_type_set_id ?? null, runtimeAssociation: "unknown", valueTypeSemantics: "unknown", booleanComposition: "unknown" },
            semanticStatus: "partial",
            independentDimensions: { timing: "independent", operation: "independent", unit: "independent", calculationBucket: "unknown", duration: "unknown", recurrence: "unknown", expiry: "unknown", reset: "unknown" },
            provenance: {
                database: { table: "passive_skills", rowId: rule.source.passiveSkillId, columns: ["target_type", "sub_target_type_set_id"] },
                ...(target.status === "supported" && handlerRole ? { runtime: { fileName: "libcocos2dcpp.so" as const, sha256: options.nativeSha256, evidenceFile: "native-passive-target-dispatch-semantics.json" as const, evidenceSha256: options.evidenceSha256, handlerRole, proofRoles } } : {}),
            },
        });
    }
    ruleTargets.sort((left, right) => left.stateKey.localeCompare(right.stateKey, "en", { numeric: true }) || left.ruleKey.localeCompare(right.ruleKey, "en", { numeric: true }));
    const currentAggregateTargetScopes: Record<string, number> = {};
    for (const state of options.current.states) for (const rule of state.passive?.rules ?? []) for (const effect of rule.effects ?? []) {
        const target = effect.target;
        const scope = target && typeof target === "object" && !Array.isArray(target) && typeof (target as Record<string, unknown>).scope === "string"
            ? String((target as Record<string, unknown>).scope)
            : "absent";
        currentAggregateTargetScopes[scope] = (currentAggregateTargetScopes[scope] ?? 0) + 1;
    }
    return {
        schemaVersion: 1, contract: "dokkan-team-analysis-passive-target-native-dispatch-experiment", contractVersion: "0.34.0",
        generatedAt: options.db33.generatedAt, sourceSnapshotVersion: options.db33.sourceSnapshotVersion, sourceDatabaseSha256: options.db33.sourceDatabaseSha256,
        sourceDb11: { fileName: "team-analysis-db11-experiment.json.gz", sha256: options.db11Sha256, contractVersion: "0.10.0" },
        sourceDb33: { fileName: "team-analysis-db33-player-attack-setup-timing.json.gz", sha256: options.db33Sha256, contractVersion: "0.32.0" },
        currentTeamAnalysis: { fileName: "team-analysis.json.gz", sha256: options.currentSha256 }, nativeRuntime: { fileName: "libcocos2dcpp.so", sha256: options.nativeSha256, sizeBytes: options.nativeSizeBytes }, nativeEvidence: { fileName: "native-passive-target-dispatch-semantics.json", sha256: options.evidenceSha256 },
        inheritedSemanticPromotionCount: 15, semanticPromotionCount: 9, ruleTargets,
        legacyComparison: { currentAggregateTargetScopes: Object.fromEntries(Object.entries(currentAggregateTargetScopes).sort(([left], [right]) => left.localeCompare(right))), directlyComparableRuleCount: 0, confirmedConflictCount: 0, boundary: "aggregate_only_no_first_party_to_legacy_rule_identity" },
    };
}

const counts = <T>(values: T[], key: (value: T) => string) => {
    const result: Record<string, number> = {};
    for (const value of values) { const name = key(value); result[name] = (result[name] ?? 0) + 1; }
    return Object.fromEntries(Object.entries(result).sort(([left], [right]) => left.localeCompare(right, "en", { numeric: true })));
};

export function buildDatabaseTeamAnalysisDb35Coverage(dataset: DatabaseTeamAnalysisDb35Dataset): DatabaseTeamAnalysisDb35Coverage {
    const supported = dataset.ruleTargets.filter((rule): rule is Db35RuleTarget & { target: { status: "supported", value: Db35TargetSemantic } } => rule.target.status === "supported");
    return {
        schemaVersion: 1, ruleCount: dataset.ruleTargets.length, effectCount: dataset.ruleTargets.reduce((sum, rule) => sum + rule.effectCount, 0),
        passiveSkillCount: new Set(dataset.ruleTargets.map(rule => rule.passiveSkillId)).size, affectedStateCount: new Set(dataset.ruleTargets.map(rule => rule.stateKey)).size,
        supportedRuleCount: supported.length, unknownRuleCount: dataset.ruleTargets.length - supported.length, supportedEffectCount: supported.reduce((sum, rule) => sum + rule.effectCount, 0),
        ruleCountsByTarget: counts(supported, rule => rule.target.value.scope), effectCountsByTarget: counts(supported.flatMap(rule => Array(rule.effectCount).fill(rule)), rule => rule.target.value.scope), rawTargetCounts: counts(dataset.ruleTargets, rule => String(rule.rawTargetType)),
        rulesWithNonzeroRawSubTargetSetIdCount: dataset.ruleTargets.filter(rule => { const value = integer(rule.subTarget.rawSetId); return value !== undefined && value !== 0; }).length,
        inheritedSemanticPromotionCount: 15, semanticPromotionCount: 9, confirmedLegacyConflictCount: 0,
    };
}
