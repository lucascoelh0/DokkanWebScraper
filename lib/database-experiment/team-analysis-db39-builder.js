"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildDatabaseTeamAnalysisDb39Coverage = exports.buildDatabaseTeamAnalysisDb39Dataset = exports.scaleDb39Modifier = exports.projectDb39Modifier = exports.db39OperandUnit = exports.projectDb39Bucket = exports.validateDb39NativeEvidence = void 0;
const crypto_1 = require("crypto");
const SOURCE_SHA = "3654eb7db9e18dfe4c238abd02bcc06a688ffa6f30aa1ad93fd108dcfeb78265";
const DB11_SHA = "42ed0aa644dd0d08fa7ca1660b82652327b1fe07e8f710dd8327d16617f7bee3";
const DB31_SHA = "1d4dcfeb91df820aea48d34a5496617e197a5c320e53e9efc0a47d806eeff7e1";
const DB34_SHA = "090fc93ff3bedb2054b2590394cd6fa9e08c09ee1aa85ea4eeffd5a6e0f8295b";
const DB37_SHA = "ed31b70cc8d0f38dab6bcb9451e1ab2ca05814b51a0e6e5ec05414a4fb4b3a6a";
const sha256 = (value) => (0, crypto_1.createHash)("sha256").update(value).digest("hex");
const id = (value) => value == null ? undefined : String(value);
const integer = (value) => typeof value === "number" && Number.isSafeInteger(value) ? value : typeof value === "string" && value.trim() !== "" && Number.isSafeInteger(Number(value)) ? Number(value) : undefined;
const numeric = (value) => typeof value === "number" && Number.isFinite(value) ? value : typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value)) ? Number(value) : undefined;
const EXPECTED_DISPATCH = { tableVma: 92049840, slotVma: 92050328, symbol: "_ZN39AbilityEfficacyStatusUpByEnergyBallFunc42callChangeEnergyBallProportionalAtkDefFuncEPN19AbilityEfficacyCore15CallChangeParamE", handlerVma: 64331900 };
const EXPECTED_REGIONS = {
    efficacy_61_handler: [EXPECTED_DISPATCH.symbol, 64331900, 12, "908ebce4adbff98de6f66fa4ecef552ed753883c92d3e374b56af9791c2cb6eb"],
    pure_attack_defense_handler: ["_ZN31AbilityEfficacyPureStatusUpFunc25callChangeAtkDefParamFuncEPN19AbilityEfficacyCore15CallChangeParamE", 64320504, 60, "4bc50a098b7dd425a1f41aad66a41111f142aa73526ce64b4095a5fbfbb0a677"],
    apply_attack: ["_ZN21AbilityEfficacyHelper15applyAttackFuncEPN19AbilityEfficacyCore15CallChangeParamEf", 64338252, 412, "165444e45ecb8e5a44dbd8bfd7dcb41f7d854d653eda178f1fe4d5763fe2a645"],
    apply_defense: ["_ZN21AbilityEfficacyHelper16applyDefenseFuncEPN19AbilityEfficacyCore15CallChangeParamEf", 64338664, 412, "8bf6031c0ba23fab2faae7957f13fc21ada865875222cecc40ab471d34be357b"],
    create_efficacy_info: ["_ZN28AbilityEfficacyInfoGenerator18createEfficacyInfoEPN19AbilityEfficacyCore15CallChangeParamE17SkillEfficacyType", 64265256, 564, "cf1465ba21a967ebc6e8baf54f61e7524d99d12c2170e9cd5d2546b1e0ae7907"],
    efficacy_info_default_constructor: ["_ZN19AbilityEfficacyInfoC2Ev", 64265820, 848, "8a0bbac11e3709748cdb621f27df67e54084bf04341dda04692fd70fc59039a5"],
    generate_attack: ["_ZN28AbilityEfficacyInfoGenerator33addAbilityEfficacyInfoAttackValueEPN19AbilityEfficacyCore15CallChangeParamE17SkillEfficacyTypef", 64266900, 336, "ef7fabdf7ac1a1f14d7d9f641fc3d644c19b1ab155e4dbd42d00652bbe7c5211"],
    generate_defense: ["_ZN28AbilityEfficacyInfoGenerator34addAbilityEfficacyInfoDefenseValueEPN19AbilityEfficacyCore15CallChangeParamE17SkillEfficacyTypef", 64267236, 336, "f96b5d4170a70a3c83d0d35d41d381d51375ef10d93db49817ace1534787336d"],
    stat_diff_consumer: ["_ZN25AbilityManagerStatHelpers27getDiffFromEfficacyInfoListERKNSt6__ndk18functionIFbR19AbilityEfficacyInfoEEEN14AbilityManager8CoefTypeEii17SkillCategoryTypeb", 64475152, 1352, "5fd02137cd7775d078dc69cb5e03c11defd004448683380beb5958e5dbb54567"],
    get_is_proportional: ["_ZNK19AbilityEfficacyInfo32getIsEnergyBallProportionalSkillEv", 64353312, 8, "d2625c08dab8a7ed6a0ec29ef5e0b21222fe8c8aa1243088ffebd3218ae29cdc"],
    get_raw_ball_type: ["_ZNK19AbilityEfficacyInfo38getEnergyBallProportionalSkillBallTypeEv", 64353328, 8, "0471b33ab0983b843889248d4e9bd2f02e4d575679dc5668cc0ef6ea9dd367b5"],
    get_raw_bitpattern: ["_ZNK19AbilityEfficacyInfo40getEnergyBallProportionalSkillBitpatternEv", 64353344, 8, "615cc4d4d19713a7b9ea6b3843c274d040126c740088a3e2d95ffe19ba04c269"],
    get_obtained_ball_type_numbers: ["_ZNK15InGameCharaData26getObtainedBallTypeNumbersEv", 46624236, 8, "522e271fbe0c4e18cda544b079e706b8ed74aebce70244749e0bfbef4310be51"],
    build_obtained_ball_type_numbers: ["_ZNK16DPuzzleBallModel26getObtainedBallTypeNumbersEv", 47226832, 564, "d267d66703b249a1081a97f24804348bf9a1ec481e16bcff88a8f0d5c5da73a0"],
};
const EXPECTED_UNKNOWNS = ["raw_ball_type_11_semantic_name", "obtained_ball_count_population_and_reset_window", "consumer_boolean_argument_product_name", "cross_bucket_final_formula_order", "recurrence_and_expiry"];
const EXPECTED_VTABLES = [
    { vtableSymbol: "_ZTV19AbilityEfficacyInfo", vtableVma: 92053824, relocationOffset: 176, symbol: "_ZNK19AbilityEfficacyInfo32getIsEnergyBallProportionalSkillEv" },
    { vtableSymbol: "_ZTV19AbilityEfficacyInfo", vtableVma: 92053824, relocationOffset: 192, symbol: "_ZNK19AbilityEfficacyInfo38getEnergyBallProportionalSkillBallTypeEv" },
    { vtableSymbol: "_ZTV19AbilityEfficacyInfo", vtableVma: 92053824, relocationOffset: 208, symbol: "_ZNK19AbilityEfficacyInfo40getEnergyBallProportionalSkillBitpatternEv" },
    { vtableSymbol: "_ZTV15InGameCharaData", vtableVma: 89258904, relocationOffset: 288, symbol: "_ZNK15InGameCharaData26getObtainedBallTypeNumbersEv" },
];
function validateDb39NativeEvidence(inspection, evidence, nativeSha256) {
    if (evidence.schemaVersion !== 1 || evidence.sourceSha256 !== nativeSha256 || evidence.efficacyType !== 61 || evidence.auditScope !== "passive-efficacy-61-atk-def-per-obtained-ball-raw-type-11")
        throw new Error("DB39 evidence identity mismatch");
    if (JSON.stringify(evidence.dispatch) !== JSON.stringify(EXPECTED_DISPATCH) || JSON.stringify(evidence.unknowns) !== JSON.stringify(EXPECTED_UNKNOWNS))
        throw new Error("DB39 evidence dispatch or unknown boundary mismatch");
    if (JSON.stringify(evidence.sqliteBinding) !== JSON.stringify({ table: "passive_skills", eff_value1: { callChangeParamOffset: 40, role: "attack_modifier_per_count" }, eff_value2: { callChangeParamOffset: 48, role: "defense_modifier_per_count" }, eff_value3: { callChangeParamOffset: 56, role: "ignored_by_handler" }, calc_option: { callChangeParamOffset: 24, role: "post_scaling_stat_operation" } }))
        throw new Error("DB39 SQLite binding mismatch");
    if (JSON.stringify(evidence.emittedFields) !== JSON.stringify({ attack: "eff_value1 converted double_to_float32 and emitted through modifier_attack", defense: "eff_value2 converted double_to_float32 and emitted through modifier_defense", skillEfficacyType: 1 }) || JSON.stringify(evidence.proportionalFlag) !== JSON.stringify({ callChangeParamOffset: 28, writtenValue: 1, abilityEfficacyInfoOffset: 40, defaultRawBallType: 11, defaultRawBitpattern: 0 }))
        throw new Error("DB39 emitted field or proportional flag mismatch");
    if (JSON.stringify(evidence.countConsumer) !== JSON.stringify({ function: "_ZN25AbilityManagerStatHelpers27getDiffFromEfficacyInfoListERKNSt6__ndk18functionIFbR19AbilityEfficacyInfoEEEN14AbilityManager8CoefTypeEii17SkillCategoryTypeb", enabledWhen: "is_energy_ball_proportional_true_and_consumer_boolean_argument_zero", mapGetter: "_ZNK15InGameCharaData26getObtainedBallTypeNumbersEv", mapKey: 11, missingMapKeyValue: 0, modifierArithmetic: "SQLite numeric to double; handler narrows to float32; consumer widens to double and multiplies by signed int32 map count before calc_option", rawBallTypeSemanticName: "unknown" }) || JSON.stringify(evidence.inheritedBuckets) !== JSON.stringify({ sourceContractVersion: "0.33.0", timing1: "former_passive_stat", timing4: "latter_passive_stat" }))
        throw new Error("DB39 consumer or bucket evidence mismatch");
    if (evidence.codeRegions.length !== Object.keys(EXPECTED_REGIONS).length || new Set(evidence.codeRegions.map(value => value.role)).size !== evidence.codeRegions.length)
        throw new Error("DB39 code role cardinality mismatch");
    for (const region of evidence.codeRegions) {
        const expected = EXPECTED_REGIONS[region.role];
        if (!expected || JSON.stringify([region.symbol, region.vma, region.sizeBytes, region.codeSha256]) !== JSON.stringify(expected))
            throw new Error(`DB39 native role identity mismatch ${region.role}`);
        const symbol = inspection.symbols.find(value => value.name === region.symbol);
        if (!symbol || symbol.value !== region.vma || symbol.size !== region.sizeBytes || sha256(inspection.readVirtualBytes(region.vma, region.sizeBytes)) !== region.codeSha256)
            throw new Error(`DB39 native code mismatch ${region.role}`);
    }
    if (inspection.relocations.filter(value => value.offset === EXPECTED_DISPATCH.slotVma && value.symbolName === EXPECTED_DISPATCH.symbol).length !== 1)
        throw new Error("DB39 dispatch relocation mismatch");
    if (JSON.stringify(evidence.vtableRelocations) !== JSON.stringify(EXPECTED_VTABLES))
        throw new Error("DB39 vtable evidence identity mismatch");
    for (const relocation of evidence.vtableRelocations)
        if (inspection.relocations.filter(value => value.offset === relocation.vtableVma + relocation.relocationOffset && value.symbolName === relocation.symbol).length !== 1)
            throw new Error(`DB39 vtable relocation mismatch ${relocation.symbol}`);
    const count = evidence.countConsumer, flag = evidence.proportionalFlag;
    if (count.mapKey !== 11 || count.missingMapKeyValue !== 0 || count.rawBallTypeSemanticName !== "unknown" || flag.defaultRawBallType !== 11 || flag.defaultRawBitpattern !== 0 || flag.writtenValue !== 1)
        throw new Error("DB39 proportional count semantics mismatch");
}
exports.validateDb39NativeEvidence = validateDb39NativeEvidence;
function projectDb39Bucket(rawTiming) {
    if (integer(rawTiming) === 1)
        return { status: "supported", value: "former_passive_stat" };
    if (integer(rawTiming) === 4)
        return { status: "supported", value: "latter_passive_stat" };
    return { status: "unknown", value: "unknown" };
}
exports.projectDb39Bucket = projectDb39Bucket;
function db39OperandUnit(operation) {
    const boundary = "raw_ball_type_11_semantic_name_unknown";
    if (operation.status !== "supported")
        return { status: "partial", value: "unknown", boundary };
    return { status: "partial", value: operation.value === "add_percent_of_lhs" || operation.value === "subtract_percent_of_lhs_floor_zero" ? "percent_points_of_current_stat_per_raw_ball_type_11_count" : "stat_points_per_raw_ball_type_11_count", boundary };
}
exports.db39OperandUnit = db39OperandUnit;
function projectDb39Modifier(stat, rawModifier) {
    const value = numeric(rawModifier), sourceColumn = stat === "attack" ? "eff_value1" : "eff_value2";
    const float32 = value === undefined ? NaN : Math.fround(value);
    if (!Number.isFinite(float32))
        return { status: "unknown", stat, sourceColumn, rawModifierPerCount: rawModifier, runtimeModifierFloat32: null, scaledModifierFormula: "unknown" };
    return { status: "supported", stat, sourceColumn, rawModifierPerCount: rawModifier, runtimeModifierFloat32: float32, scaledModifierFormula: "float32_modifier_widened_to_double_times_signed_int32_obtained_count" };
}
exports.projectDb39Modifier = projectDb39Modifier;
function scaleDb39Modifier(rawModifier, rawCount) {
    const modifier = numeric(rawModifier), count = integer(rawCount);
    const float32 = modifier === undefined ? NaN : Math.fround(modifier);
    if (!Number.isFinite(float32) || count === undefined || count < -2147483648 || count > 2147483647)
        return null;
    return float32 * count;
}
exports.scaleDb39Modifier = scaleDb39Modifier;
function buildDatabaseTeamAnalysisDb39Dataset(options) {
    if (options.db11.contractVersion !== "0.10.0" || options.db31.contractVersion !== "0.30.0" || options.db34.contractVersion !== "0.33.0" || options.db37.contractVersion !== "0.36.0" || options.db11Sha256 !== DB11_SHA || options.db31Sha256 !== DB31_SHA || options.db34Sha256 !== DB34_SHA || options.db37Sha256 !== DB37_SHA)
        throw new Error("DB39 artifact lineage mismatch");
    if ([options.db11.sourceSha256, options.db31.sourceDatabaseSha256, options.db34.sourceDatabaseSha256, options.db37.sourceDatabaseSha256].some(value => value !== SOURCE_SHA) || new Set([options.db11.generatedAt, options.db31.generatedAt, options.db34.generatedAt, options.db37.generatedAt]).size !== 1)
        throw new Error("DB39 snapshot lineage mismatch");
    validateDb39NativeEvidence(options.inspection, options.evidence, options.nativeSha256);
    const rows = new Map((options.tables.passive_skills ?? []).map(row => [id(row.id), row]));
    const operations = new Map(options.db31.ruleProjections.map(rule => [`${rule.stateKey}|${rule.ruleKey}`, rule]));
    const legacy = new Map();
    for (const state of options.db11.states)
        for (const rule of state.passive?.rules ?? [])
            legacy.set(`${state.stateKey}|${rule.ruleKey}`, rule.effects[0]?.kind ?? null);
    const proofRoles = options.evidence.codeRegions.map(region => region.role);
    const ruleProjections = [];
    for (const lifecycle of options.db37.ruleLifecycles) {
        const row = rows.get(lifecycle.passiveSkillId);
        if (!row || integer(row.efficacy_type) !== 61)
            continue;
        const key = `${lifecycle.stateKey}|${lifecycle.ruleKey}`, operation = operations.get(key);
        if (!operation || operation.passiveSkillId !== lifecycle.passiveSkillId)
            throw new Error(`DB39 missing operation ${key}`);
        const attack = projectDb39Modifier("attack", row.eff_value1), defense = projectDb39Modifier("defense", row.eff_value2), bucket = projectDb39Bucket(row.exec_timing_type), currentKind = legacy.get(key) ?? null;
        const simulationStatus = attack.status === "supported" && defense.status === "supported" && bucket.status === "supported" && operation.operation.status === "supported" ? "partial" : "unknown";
        ruleProjections.push({ stateKey: lifecycle.stateKey, ruleKey: lifecycle.ruleKey, passiveSkillId: lifecycle.passiveSkillId, sourceEffectCount: lifecycle.effectCount, rawExecutionTimingType: row.exec_timing_type, rawCalculationOption: row.calc_option, rawTargetType: row.target_type, attack, defense, countInput: { status: "partial", source: "InGameCharaData.getObtainedBallTypeNumbers", rawBallType: 11, rawBitpattern: 0, absentMapEntryValue: 0, semanticName: "unknown" }, calculationBucket: bucket, calculationOperation: operation.operation, operandUnit: db39OperandUnit(operation.operation), simulationStatus, legacyComparison: { currentKind, status: currentKind === "unknown" ? "representation_gain_legacy_unknown" : "not_comparable", confirmedConflict: false }, independentDimensions: { condition: "independent", target: "inherited_db36", timing: "independent", calculationOperation: "inherited_db31", calculationBucket: "inherited_db34", duration: "inherited_db37", onceOnly: "inherited_db37", recurrence: "partial", reset: "unknown" }, provenance: { database: { table: "passive_skills", rowId: lifecycle.passiveSkillId, columns: ["efficacy_type", "eff_value1", "eff_value2", "eff_value3", "calc_option", "exec_timing_type", "target_type"] }, runtime: { fileName: "libcocos2dcpp.so", sha256: options.nativeSha256, evidenceFile: "native-energy-ball-proportional-stat-semantics.json", evidenceSha256: options.evidenceSha256, proofRoles }, inherited: { db31RuleKey: operation.ruleKey, db31Sha256: options.db31Sha256, db34Sha256: options.db34Sha256, db37RuleKey: lifecycle.ruleKey, db37Sha256: options.db37Sha256 }, ...(currentKind !== null ? { legacy: { db11RuleKey: lifecycle.ruleKey, db11Sha256: options.db11Sha256 } } : {}) } });
    }
    return { schemaVersion: 1, contract: "dokkan-team-analysis-energy-ball-proportional-stat-native-semantics-experiment", contractVersion: "0.38.0", generatedAt: options.db37.generatedAt, sourceSnapshotVersion: options.db37.sourceSnapshotVersion, sourceDatabaseSha256: options.db37.sourceDatabaseSha256, sourceDb11: { fileName: "team-analysis-db11-experiment.json.gz", sha256: options.db11Sha256, contractVersion: "0.10.0" }, sourceDb31: { fileName: "team-analysis-db31-skill-calc-option.json.gz", sha256: options.db31Sha256, contractVersion: "0.30.0" }, sourceDb34: { fileName: "team-analysis-db34-basic-stat-buckets.json.gz", sha256: options.db34Sha256, contractVersion: "0.33.0" }, sourceDb37: { fileName: "team-analysis-db37-passive-lifecycle.json.gz", sha256: options.db37Sha256, contractVersion: "0.36.0" }, nativeRuntime: { fileName: "libcocos2dcpp.so", sha256: options.nativeSha256, sizeBytes: options.nativeSizeBytes }, nativeEvidence: { fileName: "native-energy-ball-proportional-stat-semantics.json", sha256: options.evidenceSha256 }, inheritedSemanticPromotionCount: 39, semanticPromotionCount: 6, ruleProjections };
}
exports.buildDatabaseTeamAnalysisDb39Dataset = buildDatabaseTeamAnalysisDb39Dataset;
const distribution = (items, key) => { const result = {}; for (const item of items) {
    const value = key(item);
    result[value] = (result[value] ?? 0) + 1;
} return Object.fromEntries(Object.entries(result).sort(([left], [right]) => left.localeCompare(right, "en", { numeric: true }))); };
function buildDatabaseTeamAnalysisDb39Coverage(dataset) {
    const rules = dataset.ruleProjections;
    return { schemaVersion: 1, ruleCount: rules.length, sourceEffectCount: rules.reduce((sum, rule) => sum + rule.sourceEffectCount, 0), statApplicationCount: rules.length * 2, affectedStateCount: new Set(rules.map(rule => rule.stateKey)).size, passiveSkillCount: new Set(rules.map(rule => rule.passiveSkillId)).size, supportedModifierRuleCount: rules.filter(rule => rule.attack.status === "supported" && rule.defense.status === "supported").length, supportedBucketRuleCount: rules.filter(rule => rule.calculationBucket.status === "supported").length, countSemanticPartialRuleCount: rules.filter(rule => rule.countInput.status === "partial").length, simulationPartialRuleCount: rules.filter(rule => rule.simulationStatus === "partial").length, simulationUnknownRuleCount: rules.filter(rule => rule.simulationStatus === "unknown").length, legacyRepresentationGainRuleCount: rules.filter(rule => rule.legacyComparison.status === "representation_gain_legacy_unknown").length, confirmedLegacyConflictCount: 0, ruleCountsByTiming: distribution(rules, rule => String(rule.rawExecutionTimingType)), ruleCountsByCalculationOption: distribution(rules, rule => String(rule.rawCalculationOption)), ruleCountsByTarget: distribution(rules, rule => String(rule.rawTargetType)), statApplicationsByStatAndBucket: distribution(rules.flatMap(rule => ["attack", "defense"].map(stat => ({ stat, bucket: rule.calculationBucket.value }))), value => `${value.stat}|${value.bucket}`), inheritedSemanticPromotionCount: 39, semanticPromotionCount: 6 };
}
exports.buildDatabaseTeamAnalysisDb39Coverage = buildDatabaseTeamAnalysisDb39Coverage;
//# sourceMappingURL=team-analysis-db39-builder.js.map