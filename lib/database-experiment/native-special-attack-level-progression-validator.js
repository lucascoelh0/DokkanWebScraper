"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateNativeSpecialAttackLevelProgressionEvidence = void 0;
const crypto_1 = require("crypto");
const EXPECTED_NATIVE_SHA256 = "7d6c2c1e095fc20a71ec4764e88a17b4d4b82f3f12952b9ba8c6eb0405a7215a";
const EXPECTED_SCOPE = "special-attack-increase-rate-and-level-bonus-progression";
const EXPECTED_SQLITE_BINDING = {
    table: "special_sets",
    increaseRateColumn: "increase_rate",
    levelBonusColumn: "lv_bonus",
    increaseRateObjectOffset: 116,
    levelBonusObjectOffset: 120,
};
const EXPECTED_FORMULA = {
    skillLevelSource: "UserCard.skill_lv",
    skillLevelObjectOffset: 60,
    coefficientBeforeRuntimeModifiers: "increase_rate + max(skill_lv - 1, 0) * lv_bonus",
    runtimeModifierStep: "coefficient_before_runtime_modifiers + calcModifierSpecialAtkRate(deck_index, SkillCategoryType::Special)",
    projection: "level-1 and max-level endpoints of coefficient_before_runtime_modifiers",
};
const EXPECTED_RUNTIME_CHAIN = [
    "CardSpecial::EfficacySet reads special_sets.increase_rate and special_sets.lv_bonus into adjacent typed fields",
    "AbilityManager::createSpecialSkill forwards those fields to calcAttackIncreaseForParty",
    "calcAttackIncreaseForParty loads UserCard.skill_lv and clamps levels below 1 to the level-1 coefficient",
    "for skill levels at least 1, MADD computes increase_rate + (skill_lv - 1) * lv_bonus",
    "calcModifierSpecialAtkRate is called afterward and its result is added separately",
];
const EXPECTED_CODE_REGIONS = [
    ["special_set_sqlite_constructor", "_ZN11CardSpecial11EfficacySetC1EPN7SQLite33RowE", 47067980, 1108, "ed6a5b9e1d5035c25276f94bb9ec69985e6e7e54d4b6e2a44809f63d027bd01c"],
    ["create_special_skill", "_ZN14AbilityManager18createSpecialSkillEii17SkillCategoryTypeRKNSt6__ndk110shared_ptrIN11CardSpecial11EfficacySetEEEibbb", 64392112, 1400, "40731b7b2e1f0e864a726794ea628d4961b56cd67ead69658af79373570110a1"],
    ["calculate_party_special_attack_increase", "_ZN14AbilityManager26calcAttackIncreaseForPartyEiii", 64393512, 292, "e2b9535c30dc99b04a0c6fa105d47f4cbb3c4d2e162e368a924bbfa31a4292d8"],
];
const EXPECTED_ASSERTIONS = [
    ["increase_rate_literal_page", 47068308, "2992ff90"],
    ["increase_rate_literal_offset", 47068312, "29e50f91"],
    ["store_increase_rate_offset_116", 47068384, "767600b9"],
    ["construct_lv_bonus_part_1", 47068376, "89cd8ed2"],
    ["construct_lv_bonus_part_2", 47068388, "e94bacf2"],
    ["construct_lv_bonus_part_3", 47068396, "e9cdcdf2"],
    ["construct_lv_bonus_part_4", 47068404, "a96eeef2"],
    ["store_lv_bonus_offset_120", 47068472, "767a00b9"],
    ["load_adjacent_rate_and_bonus", 64392244, "018d4e29"],
    ["load_user_card_skill_level_offset_60", 64393624, "083d40b9"],
    ["subtract_level_one", 64393628, "08050071"],
    ["skip_negative_level_delta", 64393632, "4b000054"],
    ["multiply_add_level_progression", 64393636, "134d151b"],
    ["add_runtime_modifier_after_progression", 64393720, "8002130b"],
];
const EXPECTED_CALLS = [
    ["create_special_to_party_progression", 64392252, "39815d94", 88903968, 95414072, "_ZN14AbilityManager26calcAttackIncreaseForPartyEiii", 64393512],
    ["progression_to_runtime_modifier", 64393648, "c4d25b94", 88464576, 95194376, "_ZN19DPuzzleGameCalcData26calcModifierSpecialAtkRateEi17SkillCategoryType", 46830568],
];
const EXPECTED_UNKNOWNS = [
    "final_damage_multiplier_base",
    "special_bonus_application_order",
    "runtime_modifier_sources_and_order",
    "integer_rounding_boundaries",
];
function sha256(value) {
    return (0, crypto_1.createHash)("sha256").update(value).digest("hex");
}
function branchTarget(bytes, instructionVma) {
    const word = bytes.readUInt32LE(0);
    if (((word & 0xfc000000) >>> 0) !== 0x94000000) {
        throw new Error(`Expected BL at ${instructionVma}`);
    }
    let immediate = word & 0x03ffffff;
    if (immediate & 0x02000000)
        immediate -= 0x04000000;
    return instructionVma + immediate * 4;
}
function validateNativeSpecialAttackLevelProgressionEvidence(inspection, evidence, nativeSha256) {
    if (evidence?.schemaVersion !== 1
        || nativeSha256 !== EXPECTED_NATIVE_SHA256
        || evidence.sourceSha256 !== nativeSha256
        || evidence.auditScope !== EXPECTED_SCOPE
        || JSON.stringify(evidence.sqliteBinding) !== JSON.stringify(EXPECTED_SQLITE_BINDING)
        || JSON.stringify(evidence.runtimeFormula) !== JSON.stringify(EXPECTED_FORMULA)
        || JSON.stringify(evidence.runtimeChain) !== JSON.stringify(EXPECTED_RUNTIME_CHAIN)
        || JSON.stringify(evidence.unknowns) !== JSON.stringify(EXPECTED_UNKNOWNS)) {
        throw new Error("Special Attack level-progression evidence identity mismatch");
    }
    const [literal] = evidence.stringLiterals ?? [];
    if (evidence.stringLiterals?.length !== 1
        || literal?.vma !== 32666617
        || literal?.value !== "increase_rate"
        || !inspection.readVirtualBytes(literal.vma, Buffer.byteLength(literal.value) + 1)
            .equals(Buffer.from(`${literal.value}\0`))) {
        throw new Error("Special Attack level-progression string literal mismatch");
    }
    if (JSON.stringify((evidence.codeRegions ?? []).map((region) => [
        region.role,
        region.symbol,
        region.vma,
        region.sizeBytes,
        region.codeSha256,
    ])) !== JSON.stringify(EXPECTED_CODE_REGIONS)) {
        throw new Error("Special Attack level-progression code-region identity mismatch");
    }
    for (const region of evidence.codeRegions) {
        const symbol = inspection.symbols.find(value => value.name === region.symbol);
        if (!symbol
            || symbol.value !== region.vma
            || symbol.size !== region.sizeBytes
            || sha256(inspection.readVirtualBytes(region.vma, region.sizeBytes)) !== region.codeSha256) {
            throw new Error(`Special Attack level-progression code region mismatch: ${region.role}`);
        }
    }
    if (JSON.stringify((evidence.structuralAssertions ?? []).map((assertion) => [
        assertion.role,
        assertion.vma,
        assertion.hex,
    ])) !== JSON.stringify(EXPECTED_ASSERTIONS)) {
        throw new Error("Special Attack level-progression structural assertion identity mismatch");
    }
    for (const assertion of evidence.structuralAssertions) {
        if (inspection.readVirtualBytes(assertion.vma, assertion.hex.length / 2).toString("hex") !== assertion.hex) {
            throw new Error(`Special Attack level-progression structural assertion mismatch: ${assertion.role}`);
        }
    }
    if (JSON.stringify((evidence.directCalls ?? []).map((call) => [
        call.role,
        call.callVma,
        call.callHex,
        call.targetPltVma,
        call.gotRelocationOffset,
        call.targetSymbol,
        call.targetVma,
    ])) !== JSON.stringify(EXPECTED_CALLS)) {
        throw new Error("Special Attack level-progression direct-call identity mismatch");
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
            throw new Error(`Special Attack level-progression direct call mismatch: ${call.role}`);
        }
    }
}
exports.validateNativeSpecialAttackLevelProgressionEvidence = validateNativeSpecialAttackLevelProgressionEvidence;
//# sourceMappingURL=native-special-attack-level-progression-validator.js.map