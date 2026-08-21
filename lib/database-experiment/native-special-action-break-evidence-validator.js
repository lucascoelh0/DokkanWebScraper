"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateNativeSpecialActionBreakEvidence = void 0;
const crypto_1 = require("crypto");
const EXPECTED_SCOPE = "special-extra-efficacy-111-to-native-action-break-consumer";
const EXPECTED_NATIVE_SHA256 = "7d6c2c1e095fc20a71ec4764e88a17b4d4b82f3f12952b9ba8c6eb0405a7215a";
const EXPECTED_SEMANTIC = {
    kind: "action_break",
    status: "partial",
    actionSelection: "one_eligible_current_enemy_action_per_marker",
    evidence: {
        fileName: "native-special-action-break-semantics.json",
        nativeRuntimeSha256: EXPECTED_NATIVE_SHA256,
    },
};
const EXPECTED_RUNTIME_CHAIN = [
    "CardSpecial::Efficacy maps Special::ExtraEfficacySpecial to SpecialType 1",
    "AbilityManager::createSpecialSkill takes the SpecialType 1 branch and calls createAbilityForSpecialEfficacy",
    "createAbilityForSpecialEfficacy copies efficacy_type 111 into CreateAbilityStatusEfficacy and creates AbilityStatusActive",
    "AbilityStatusActive inherits AbilityStatusCausality::exec through its vtable",
    "AbilityStatusCausality::process loads the unchanged efficacy type and calls AbilityEfficacyCore::callEfficacyFunc",
    "dispatch slot 111 resolves to callChangeConditionAttackBreakFunc",
    "the handler emits a type-111 AbilityEfficacyInfo marker and AbilityManager::getAttackBreakingActions consumes matching markers to select one eligible current enemy action per marker",
];
const EXPECTED_CODE_REGIONS = [
    ["special_type_initializer", "local@47084248", 47084248, 452, "a15fdc64a6f0da424a2d01a7754003999f2c23541c39b5819dbc3e8159ec811a"],
    ["special_sqlite_constructor", "_ZN11CardSpecial8EfficacyC1EPN7SQLite33RowE", 47079100, 1216, "d9677f1d4be110222146d9388e0724dcef3eb1c6ae047ae9747de6d5d8046aec"],
    ["create_special_skill", "_ZN14AbilityManager18createSpecialSkillEii17SkillCategoryTypeRKNSt6__ndk110shared_ptrIN11CardSpecial11EfficacySetEEEibbb", 64392112, 1400, "40731b7b2e1f0e864a726794ea628d4961b56cd67ead69658af79373570110a1"],
    ["create_special_efficacy", "_ZN14AbilityManager31createAbilityForSpecialEfficacyERKNSt6__ndk110shared_ptrIN11CardSpecial8EfficacyEEEiiiib", 64394092, 836, "4b74c2ffe49998b18ea11b674eca6a69cfce4896d49c5adb060a096eb90b6888"],
    ["create_active_status", "_ZN19AbilityStatusActive6createEP25CreateAbilityStatusActive", 64479468, 80, "a90ddf4fb7fec950c3268c07bc5e45e2a73466783c0a7f698d337300bc7baef8"],
    ["copy_status_efficacy", "_ZN21AbilityStatusEfficacyC1EP27CreateAbilityStatusEfficacy", 64493900, 820, "8207716704da65ad571c7e4fc3eeeda6e7ab59552716bcbf8dbb9e9bf1069f64"],
    ["process_active_status", "_ZN22AbilityStatusCausality7processEv", 64485824, 364, "ad8c39e22d77d14da0a026e80e3e08a94dc7708fd62fb235149c8ff1e9f84303"],
    ["dispatch_efficacy", "_ZN19AbilityEfficacyCore16callEfficacyFuncE17SkillEfficacyTypeNSt6__ndk110shared_ptrI22AbilityStatusCausalityEE", 64243608, 440, "fbaed51c5902630885bb6de3db7555de65ea2ac83bcccb09bc2a0e4b9539fe2e"],
    ["attack_break_handler", "_ZN31AbilityEfficacyBadConditionFunc34callChangeConditionAttackBreakFuncEPN19AbilityEfficacyCore15CallChangeParamE", 64279504, 496, "edd7ab755c8dc39147dd977df316e79520cbaf1b54551c0355ad083f18791b88"],
    ["breaking_action_selector", "_ZN14AbilityManager24getAttackBreakingActionsEi", 64449308, 684, "085dcfa8e741672c182e17109c5f279937db5c598a1bb97bb78630ce350af896"],
];
const EXPECTED_ASSERTIONS = [
    ["normal_special_enum_zero", 47084392, "ff1b00b9"], ["extra_special_enum_one", 47084440, "28008052"], ["extra_special_enum_store", 47084464, "e83b00b9"],
    ["sqlite_efficacy_store_offset_12", 47079368, "750e00b9"], ["special_type_map_value_load", 47079904, "082840b9"], ["special_type_store_offset_8", 47079912, "680a00b9"],
    ["create_special_load_type_offset_8", 64392716, "680b40b9"], ["create_special_compare_type_one", 64392724, "1f050071"], ["create_special_reject_non_one", 64392728, "21060054"],
    ["create_efficacy_load_raw_offset_12", 64394524, "0a0d40b9"], ["create_efficacy_store_create_offset_36", 64394540, "ea2f00b9"],
    ["status_copy_create_offset_36", 64493968, "a04242fc"], ["status_store_efficacy_offset_120", 64493984, "603e00fd"],
    ["process_load_efficacy_offset_120", 64485896, "747a40b9"], ["process_forward_efficacy_argument", 64485924, "e003142a"],
    ["dispatcher_table_page", 64243648, "28d400b0"], ["dispatcher_table_offset", 64243652, "08c10691"], ["dispatcher_index_by_efficacy", 64243656, "155960f8"],
    ["handler_literal_efficacy_111", 64279752, "e10d8052"], ["selector_load_efficacy_info_range", 64449360, "155844a9"],
    ["selector_compare_type_111", 64449544, "1fbc0171"], ["selector_compare_enemy_index", 64449568, "1f00146b"], ["selector_count_matching_marker", 64449572, "5a179a1a"],
    ["selector_require_marker", 64449640, "5f070071"], ["selector_action_nonzero_field", 64449656, "090940b9"], ["selector_action_bit_field", 64449664, "09b14039"], ["selector_consume_one_marker", 64449732, "5a070051"],
];
const EXPECTED_CALLS = [
    ["special_type_one_to_factory", 64392768, "bc805d94", 88903984, 95414080, "_ZN14AbilityManager31createAbilityForSpecialEfficacyERKNSt6__ndk110shared_ptrIN11CardSpecial8EfficacyEEEiiiib", 64394092],
    ["factory_to_active_status", 64394648, "e2be5c94", 88707360, 95315768, "_ZN19AbilityStatusActive6createEP25CreateAbilityStatusActive", 64479468],
    ["active_process_to_dispatcher", 64485928, "ca665c94", 88708432, 95316304, "_ZN19AbilityEfficacyCore16callEfficacyFuncE17SkillEfficacyTypeNSt6__ndk110shared_ptrI22AbilityStatusCausalityEE", 64243608],
    ["handler_to_type_111_marker", 64279756, "dded5d94", 88902720, 95413448, "_ZN28AbilityEfficacyInfoGenerator31addAbilityEfficacyInfoNoneValueEPN19AbilityEfficacyCore15CallChangeParamE17SkillEfficacyType", 64266668],
];
const EXPECTED_UNKNOWNS = [
    "target_type_3_human_name",
    "exact_duration_and_recurrence",
    "probability_application_order",
    "action_eligibility_field_names",
    "efficacy_112_invalidation_interaction",
];
function sha256(value) {
    return (0, crypto_1.createHash)("sha256").update(value).digest("hex");
}
function branchTarget(bytes, instructionVma) {
    const word = bytes.readUInt32LE(0);
    if (((word & 0xfc000000) >>> 0) !== 0x94000000)
        throw new Error(`Expected BL at ${instructionVma}`);
    let immediate = word & 0x03ffffff;
    if (immediate & 0x02000000)
        immediate -= 0x04000000;
    return instructionVma + immediate * 4;
}
function validateNativeSpecialActionBreakEvidence(inspection, evidence, nativeSha256) {
    if (evidence?.schemaVersion !== 1
        || nativeSha256 !== EXPECTED_NATIVE_SHA256
        || evidence.sourceSha256 !== nativeSha256
        || evidence.auditScope !== EXPECTED_SCOPE
        || JSON.stringify(evidence.runtimeChain) !== JSON.stringify(EXPECTED_RUNTIME_CHAIN)
        || JSON.stringify(evidence.semanticProjection) !== JSON.stringify(EXPECTED_SEMANTIC)
        || JSON.stringify(evidence.unknowns) !== JSON.stringify(EXPECTED_UNKNOWNS)) {
        throw new Error("Special action-break evidence identity mismatch");
    }
    if (JSON.stringify(evidence.sqliteBinding) !== JSON.stringify({
        table: "specials",
        typeColumn: "type",
        efficacyColumn: "efficacy_type",
        specialTypeString: "Special::ExtraEfficacySpecial",
        specialTypeEnum: 1,
        efficacyType: 111,
        objectTypeOffset: 8,
        objectEfficacyOffset: 12,
    })) {
        throw new Error("Special action-break SQLite binding mismatch");
    }
    for (const literal of evidence.stringLiterals ?? []) {
        if (!Number.isSafeInteger(literal.vma)
            || !inspection.readVirtualBytes(literal.vma, Buffer.byteLength(literal.value) + 1)
                .equals(Buffer.from(`${literal.value}\0`))) {
            throw new Error(`Special action-break string literal mismatch at ${literal.vma}`);
        }
    }
    if (JSON.stringify(evidence.stringLiterals?.map((value) => [value.value, value.enumValue]))
        !== JSON.stringify([["Special::NormalEfficacySpecial", 0], ["Special::ExtraEfficacySpecial", 1]])) {
        throw new Error("Special action-break SpecialType map mismatch");
    }
    if (JSON.stringify((evidence.codeRegions ?? []).map((region) => [region.role, region.symbol, region.vma, region.sizeBytes, region.codeSha256])) !== JSON.stringify(EXPECTED_CODE_REGIONS)) {
        throw new Error("Special action-break code-region identity mismatch");
    }
    for (const region of evidence.codeRegions ?? []) {
        if (!Number.isSafeInteger(region.vma)
            || !Number.isSafeInteger(region.sizeBytes)
            || region.sizeBytes <= 0
            || sha256(inspection.readVirtualBytes(region.vma, region.sizeBytes)) !== region.codeSha256) {
            throw new Error(`Special action-break code region mismatch: ${region.role}`);
        }
        if (!region.symbol.startsWith("local@")) {
            const symbol = inspection.symbols.find(value => value.name === region.symbol);
            if (!symbol || symbol.value !== region.vma || symbol.size !== region.sizeBytes) {
                throw new Error(`Special action-break symbol mismatch: ${region.role}`);
            }
        }
    }
    if (JSON.stringify((evidence.structuralAssertions ?? []).map((assertion) => [assertion.role, assertion.vma, assertion.hex])) !== JSON.stringify(EXPECTED_ASSERTIONS)) {
        throw new Error("Special action-break structural assertion identity mismatch");
    }
    for (const assertion of evidence.structuralAssertions) {
        if (inspection.readVirtualBytes(assertion.vma, assertion.hex.length / 2).toString("hex") !== assertion.hex) {
            throw new Error(`Special action-break structural assertion mismatch: ${assertion.role}`);
        }
    }
    if (JSON.stringify((evidence.directCalls ?? []).map((call) => [call.role, call.callVma, call.callHex, call.targetPltVma, call.gotRelocationOffset, call.targetSymbol, call.targetVma])) !== JSON.stringify(EXPECTED_CALLS)) {
        throw new Error("Special action-break direct-call identity mismatch");
    }
    for (const call of evidence.directCalls) {
        const bytes = inspection.readVirtualBytes(call.callVma, 4);
        if (bytes.toString("hex") !== call.callHex
            || branchTarget(bytes, call.callVma) !== call.targetPltVma
            || inspection.relocations.filter(value => value.offset === call.gotRelocationOffset
                && value.type === 1026
                && value.symbolName === call.targetSymbol
                && value.symbolValue === call.targetVma
                && value.addend === 0).length !== 1) {
            throw new Error(`Special action-break direct-call mismatch: ${call.role}`);
        }
    }
    const dispatch = evidence.dispatch;
    if (JSON.stringify([dispatch?.tableVma, dispatch?.entrySizeBytes, dispatch?.slot, dispatch?.slotVma,
        dispatch?.relocationType, dispatch?.handlerVma])
        !== JSON.stringify([92049840, 8, 111, 92050728, 257, 64279504])
        || inspection.relocations.filter(value => value.offset === dispatch.slotVma
            && value.type === dispatch.relocationType
            && value.symbolName === dispatch.handlerSymbol
            && value.symbolValue === dispatch.handlerVma).length !== 1) {
        throw new Error("Special action-break dispatch mismatch");
    }
    const vtable = evidence.activeVtable;
    const vtableSymbol = inspection.symbols.find(value => value.name === vtable?.symbol);
    if (!vtableSymbol
        || vtableSymbol.value !== vtable.vma
        || vtableSymbol.size !== vtable.sizeBytes
        || sha256(inspection.readVirtualBytes(vtable.vma, vtable.sizeBytes)) !== vtable.rawSha256
        || vtable.execRelocationOffset !== 296
        || inspection.relocations.filter(value => value.offset === vtable.vma + vtable.execRelocationOffset
            && value.type === 257
            && value.symbolName === vtable.execSymbol
            && value.symbolValue === vtable.execVma).length !== 1) {
        throw new Error("Special action-break active-status vtable mismatch");
    }
}
exports.validateNativeSpecialActionBreakEvidence = validateNativeSpecialActionBreakEvidence;
//# sourceMappingURL=native-special-action-break-evidence-validator.js.map