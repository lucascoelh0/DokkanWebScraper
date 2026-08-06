"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildDatabaseTeamAnalysisDb44Coverage = exports.buildDatabaseTeamAnalysisDb44Dataset = exports.projectDb44Modifier = exports.validateDb44NativeEvidence = void 0;
const crypto_1 = require("crypto");
const team_analysis_db39_builder_1 = require("./team-analysis-db39-builder");
const SOURCE_SHA = "3654eb7db9e18dfe4c238abd02bcc06a688ffa6f30aa1ad93fd108dcfeb78265";
const ARTIFACT_SHA = {
    db8: "814502fd8dfe6f692ea133f60a3c0e4de422de09a5f98b4567a021bf4dfa3658",
    db9: "99f5b296fc8c8c0fd678c716303e8a0cc02c95092dedc705a0689737d57ee87d",
    db11: "42ed0aa644dd0d08fa7ca1660b82652327b1fe07e8f710dd8327d16617f7bee3",
    db31: "1d4dcfeb91df820aea48d34a5496617e197a5c320e53e9efc0a47d806eeff7e1",
    db34: "090fc93ff3bedb2054b2590394cd6fa9e08c09ee1aa85ea4eeffd5a6e0f8295b",
    db35: "513c6c8242b7bcc613ba5b897b346f6900f7ca7372346427cad38cc90e0d97a6",
    db36: "f94c117e69464b83cf4ba4cb00578bcd4e52539b9116cf6158907f39a1d3bfcb",
    db37: "ed31b70cc8d0f38dab6bcb9451e1ab2ca05814b51a0e6e5ec05414a4fb4b3a6a",
    db39: "a74482a1350fb2f750b1f5cd583133afd69f17116d7d8fe1c79866e19c060c01",
};
const DB39_EVIDENCE_SHA = "72ccd099961126240abbda125e5cf909f544a0e883edd00a1b146cafd7a6c836";
const DATABASE_COLUMNS = ["efficacy_type", "eff_value1", "eff_value2", "eff_value3", "calc_option", "exec_timing_type", "target_type", "sub_target_type_set_id", "turn", "is_once"];
const sha256 = (value) => (0, crypto_1.createHash)("sha256").update(value).digest("hex");
const id = (value) => value == null ? undefined : String(value);
const integer = (value) => { const parsed = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : NaN; return Number.isSafeInteger(parsed) ? parsed : undefined; };
const numeric = (value) => { const parsed = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : NaN; return Number.isFinite(parsed) ? parsed : undefined; };
const ruleKey = (value) => `${value.stateKey}|${value.ruleKey}`;
const index = (values, label) => { const result = new Map(); for (const value of values) {
    const key = ruleKey(value);
    if (result.has(key))
        throw new Error(`DB44 duplicate ${label} ${key}`);
    result.set(key, value);
} return result; };
const EXPECTED_SQLITE = {
    table: "passive_skills", enumColumn: "efficacy_type",
    eff_value1: { callChangeParamOffset: 40, role: "single_stat_modifier_per_count" },
    eff_value2: { callChangeParamOffset: 48, role: "ignored_by_both_pure_handlers" },
    eff_value3: { callChangeParamOffset: 56, role: "ignored_by_both_pure_handlers" },
    calc_option: { callChangeParamOffset: 24, role: "post_scaling_stat_operation" },
};
const EXPECTED_DISPATCH = { tableVma: 92049840, entrySizeBytes: 8, entries: [{ efficacyType: 59, slotVma: 92050312, handlerRole: "efficacy_59_handler" }, { efficacyType: 60, slotVma: 92050320, handlerRole: "efficacy_60_handler" }] };
const EXPECTED_HANDLER = { proportionalFlag: { callChangeParamOffset: 28, writtenValue: 1 }, efficacy59: { stat: "attack", tailTargetRole: "pure_attack_handler" }, efficacy60: { stat: "defense", tailTargetRole: "pure_defense_handler" }, parametersRead: ["call_change_param_pointer"], numericParametersReadDirectly: [], returnBehavior: "tail_return_of_pure_stat_handler" };
const EXPECTED_PURE = { input: "eff_value1_double_at_call_change_param_offset_40", conversion: "double_to_float32", efficacy59Output: "apply_attack", efficacy60Output: "apply_defense", ignoredInputs: ["eff_value2_at_offset_48", "eff_value3_at_offset_56"], returnBehavior: "tail_return_of_apply_stat_handler" };
const EXPECTED_SHARED = { sourceContractVersion: "0.38.0", sourceArtifactSha256: ARTIFACT_SHA.db39, sourceNativeEvidenceSha256: DB39_EVIDENCE_SHA, proportionalFlagAbilityEfficacyInfoOffset: 40, defaultRawBallType: 11, defaultRawBitpattern: 0, mapGetter: "_ZNK15InGameCharaData26getObtainedBallTypeNumbersEv", mapKey: 11, missingMapKeyValue: 0, arithmetic: "handler_float32_modifier_widened_to_double_times_signed_int32_map_count_before_calc_option", inheritedProofRoles: ["apply_attack", "apply_defense", "create_efficacy_info", "efficacy_info_default_constructor", "generate_attack", "generate_defense", "stat_diff_consumer", "get_is_proportional", "get_raw_ball_type", "get_raw_bitpattern", "get_obtained_ball_type_numbers", "build_obtained_ball_type_numbers"], rawBallTypeSemanticName: "unknown" };
const EXPECTED_UNKNOWNS = ["raw_ball_type_11_semantic_name", "obtained_ball_count_population_and_reset_window", "consumer_boolean_argument_product_name", "cross_bucket_final_formula_order", "recurrence_and_expiry", "cross_status_stacking_order"];
const REGIONS = {
    efficacy_59_handler: ["_ZN39AbilityEfficacyStatusUpByEnergyBallFunc39callChangeEnergyBallProportionalAtkFuncEPN19AbilityEfficacyCore15CallChangeParamE", 64331876, 12, "9e020042cf60ac1905f7b4f7586068689c0f3b9458faefa2e55cbb743437de5b", "2800805208700039cdba5d14"],
    efficacy_60_handler: ["_ZN39AbilityEfficacyStatusUpByEnergyBallFunc39callChangeEnergyBallProportionalDefFuncEPN19AbilityEfficacyCore15CallChangeParamE", 64331888, 12, "0380e6d6788c79c624c10d1db26529f6c7b6f6577e02c80dd516688be148d1a8", "2800805208700039ceba5d14"],
    pure_attack_handler: ["_ZN31AbilityEfficacyPureStatusUpFunc22callChangeAtkParamFuncEPN19AbilityEfficacyCore15CallChangeParamE", 64320480, 12, "d99470373faf26bc750fde3608e2522e2573ca4839efcd10ddc33df43a689403", "001440fd0040621e9ac65d14"],
    pure_defense_handler: ["_ZN31AbilityEfficacyPureStatusUpFunc22callChangeDefParamFuncEPN19AbilityEfficacyCore15CallChangeParamE", 64320492, 12, "28d5f46e5d04b1c441617477ff732e5ac3f001355c79f4c44b3ac83afbad2638", "001440fd0040621e9bc65d14"],
};
const BRANCHES = [
    { sourceRole: "efficacy_59_handler", instructionVma: 64331884, instructionHex: "cdba5d14", targetPltVma: 88902560, gotRelocationOffset: 95413368, targetRole: "pure_attack_handler" },
    { sourceRole: "efficacy_60_handler", instructionVma: 64331896, instructionHex: "ceba5d14", targetPltVma: 88902576, gotRelocationOffset: 95413376, targetRole: "pure_defense_handler" },
    { sourceRole: "pure_attack_handler", instructionVma: 64320488, instructionHex: "9ac65d14", targetPltVma: 88903248, gotRelocationOffset: 95413712, targetRole: "apply_attack" },
    { sourceRole: "pure_defense_handler", instructionVma: 64320500, instructionHex: "9bc65d14", targetPltVma: 88903264, gotRelocationOffset: 95413720, targetRole: "apply_defense" },
];
const APPLY_SYMBOLS = { apply_attack: "_ZN21AbilityEfficacyHelper15applyAttackFuncEPN19AbilityEfficacyCore15CallChangeParamEf", apply_defense: "_ZN21AbilityEfficacyHelper16applyDefenseFuncEPN19AbilityEfficacyCore15CallChangeParamEf" };
function branchTarget(bytes, instructionVma) {
    const instruction = bytes.readUInt32LE(0);
    if ((instruction >>> 26) !== 5)
        return null;
    let immediate = instruction & 0x03ffffff;
    if ((immediate & 0x02000000) !== 0)
        immediate -= 0x04000000;
    return instructionVma + immediate * 4;
}
function validateDb44NativeEvidence(inspection, evidence, nativeSha256) {
    if (evidence.schemaVersion !== 1 || evidence.sourceSha256 !== nativeSha256 || JSON.stringify(evidence.efficacyTypes) !== JSON.stringify([59, 60]) || evidence.auditScope !== "passive-efficacy-59-60-single-stat-per-obtained-ball-raw-type-11")
        throw new Error("DB44 evidence identity mismatch");
    if (JSON.stringify(evidence.sqliteBinding) !== JSON.stringify(EXPECTED_SQLITE) || JSON.stringify(evidence.dispatch) !== JSON.stringify(EXPECTED_DISPATCH) || JSON.stringify(evidence.handlerBehavior) !== JSON.stringify(EXPECTED_HANDLER) || JSON.stringify(evidence.pureHandlerBehavior) !== JSON.stringify(EXPECTED_PURE) || JSON.stringify(evidence.sharedConsumerEvidence) !== JSON.stringify(EXPECTED_SHARED) || JSON.stringify(evidence.branchSites) !== JSON.stringify(BRANCHES) || JSON.stringify(evidence.unknowns) !== JSON.stringify(EXPECTED_UNKNOWNS))
        throw new Error("DB44 evidence semantics mismatch");
    if (evidence.codeRegions.length !== Object.keys(REGIONS).length || new Set(evidence.codeRegions.map(value => value.role)).size !== evidence.codeRegions.length)
        throw new Error("DB44 code region cardinality mismatch");
    for (const region of evidence.codeRegions) {
        const expected = REGIONS[region.role];
        if (!expected || JSON.stringify([region.symbol, region.vma, region.sizeBytes, region.codeSha256]) !== JSON.stringify(expected.slice(0, 4)))
            throw new Error(`DB44 code identity ${region.role}`);
        const bytes = inspection.readVirtualBytes(region.vma, region.sizeBytes), symbol = inspection.symbols.find(value => value.name === region.symbol);
        if (!symbol || symbol.value !== region.vma || symbol.size !== region.sizeBytes || bytes.toString("hex") !== expected[4] || sha256(bytes) !== region.codeSha256)
            throw new Error(`DB44 native code mismatch ${region.role}`);
    }
    for (const entry of EXPECTED_DISPATCH.entries) {
        const symbol = REGIONS[entry.handlerRole][0];
        if (inspection.relocations.filter(value => value.offset === entry.slotVma && value.type === 257 && value.symbolName === symbol).length !== 1)
            throw new Error(`DB44 dispatch relocation ${entry.efficacyType}`);
    }
    for (const branch of BRANCHES) {
        const bytes = inspection.readVirtualBytes(branch.instructionVma, 4), targetSymbol = REGIONS[branch.targetRole]?.[0] ?? APPLY_SYMBOLS[branch.targetRole];
        if (bytes.toString("hex") !== branch.instructionHex || branchTarget(bytes, branch.instructionVma) !== branch.targetPltVma || inspection.relocations.filter(value => value.offset === branch.gotRelocationOffset && value.type === 1026 && value.symbolName === targetSymbol).length !== 1)
            throw new Error(`DB44 branch linkage ${branch.sourceRole}`);
    }
}
exports.validateDb44NativeEvidence = validateDb44NativeEvidence;
function projectDb44Modifier(efficacyType, rawModifier) {
    const type = integer(efficacyType), stat = type === 59 ? "attack" : type === 60 ? "defense" : "unknown", value = numeric(rawModifier), float32 = value === undefined ? NaN : Math.fround(value);
    if (stat === "unknown" || !Number.isFinite(float32))
        return { status: "unknown", stat, sourceColumn: "eff_value1", rawModifierPerCount: rawModifier, runtimeModifierFloat32: null, scaledModifierFormula: "unknown" };
    return { status: "supported", stat, sourceColumn: "eff_value1", rawModifierPerCount: rawModifier, runtimeModifierFloat32: float32, scaledModifierFormula: "float32_modifier_widened_to_double_times_signed_int32_obtained_count" };
}
exports.projectDb44Modifier = projectDb44Modifier;
function buildDatabaseTeamAnalysisDb44Dataset(options) {
    const { db8, db9, db11, db31, db34, db35, db36, db37, db39 } = options;
    if (db8.contractVersion !== "0.7.0" || db9.contractVersion !== "0.8.0" || db11.contractVersion !== "0.10.0" || db31.contractVersion !== "0.30.0" || db34.contractVersion !== "0.33.0" || db35.contractVersion !== "0.34.0" || db36.contractVersion !== "0.35.0" || db37.contractVersion !== "0.36.0" || db39.contractVersion !== "0.38.0")
        throw new Error("DB44 contract lineage mismatch");
    for (const [name, actual] of Object.entries({ db8: options.db8Sha256, db9: options.db9Sha256, db11: options.db11Sha256, db31: options.db31Sha256, db34: options.db34Sha256, db35: options.db35Sha256, db36: options.db36Sha256, db37: options.db37Sha256, db39: options.db39Sha256 }))
        if (actual !== ARTIFACT_SHA[name])
            throw new Error(`DB44 artifact lineage mismatch ${name}`);
    if (db9.sourceDb8.sha256 !== options.db8Sha256 || db31.sourceDb11.sha256 !== options.db11Sha256 || db34.sourceDb31.sha256 !== options.db31Sha256 || db36.sourceDb35.sha256 !== options.db35Sha256 || db37.sourceDb36.sha256 !== options.db36Sha256 || db39.sourceDb31.sha256 !== options.db31Sha256 || db39.sourceDb34.sha256 !== options.db34Sha256 || db39.sourceDb37.sha256 !== options.db37Sha256 || db39.nativeEvidence.sha256 !== DB39_EVIDENCE_SHA)
        throw new Error("DB44 inherited artifact chain mismatch");
    if ([db8.sourceSha256, db9.sourceDatabaseSha256, db11.sourceSha256, db31.sourceDatabaseSha256, db34.sourceDatabaseSha256, db35.sourceDatabaseSha256, db36.sourceDatabaseSha256, db37.sourceDatabaseSha256, db39.sourceDatabaseSha256].some(value => value !== SOURCE_SHA) || new Set([db8.generatedAt, db9.generatedAt, db11.generatedAt, db31.generatedAt, db34.generatedAt, db35.generatedAt, db36.generatedAt, db37.generatedAt, db39.generatedAt]).size !== 1 || [db9.nativeRuntime.sha256, db31.nativeRuntime.sha256, db34.nativeRuntime.sha256, db35.nativeRuntime.sha256, db36.nativeRuntime.sha256, db37.nativeRuntime.sha256, db39.nativeRuntime.sha256].some(value => value !== options.nativeSha256))
        throw new Error("DB44 source lineage mismatch");
    validateDb44NativeEvidence(options.inspection, options.evidence, options.nativeSha256);
    for (const [type, count] of [[59, 22], [60, 11]]) {
        const gap = db8.efficacyGaps.find(value => integer(value.efficacyType) === type), runtime = db9.efficacyGapEvidence.find(value => value.enumValue === type), dispatch = db9.efficacyDispatchSlots.find(value => value.enumValue === type), region = options.evidence.codeRegions.find(value => value.role === `efficacy_${type}_handler`);
        if (!gap || gap.ruleCount !== count || gap.affectedStateCount !== count || gap.statusCounts.unknown !== count || !runtime || runtime.identityStatus !== "runtime_identified" || runtime.occurrenceCount !== count || runtime.affectedStateCount !== count || runtime.symbol !== region.symbol || runtime.symbolAddress !== region.vma || !dispatch || dispatch.status !== "identified" || dispatch.slotVma !== 92049840 + type * 8 || dispatch.symbol !== region.symbol || dispatch.symbolAddress !== region.vma)
            throw new Error(`DB44 gap/runtime identity mismatch ${type}`);
    }
    const rows = new Map((options.tables.passive_skills ?? []).map(row => [id(row.id), row])), operations = index(db31.ruleProjections, "operation"), targets = index(db35.ruleTargets, "target"), subTargets = index(db36.ruleSubTargets, "sub-target");
    const legacy = new Map();
    for (const state of db11.states)
        for (const rule of state.passive?.rules ?? [])
            legacy.set(`${state.stateKey}|${rule.ruleKey}`, rule.effects[0]?.kind ?? null);
    const inheritedProofRoles = options.evidence.sharedConsumerEvidence.inheritedProofRoles.map(value => `db39:${value}`), proofRoles = [...options.evidence.codeRegions.map(value => value.role), ...inheritedProofRoles], ruleProjections = [];
    for (const lifecycle of db37.ruleLifecycles) {
        const row = rows.get(lifecycle.passiveSkillId), type = integer(row?.efficacy_type);
        if (type !== 59 && type !== 60)
            continue;
        const key = `${lifecycle.stateKey}|${lifecycle.ruleKey}`, operation = operations.get(key), target = targets.get(key), subTarget = subTargets.get(key);
        if (!operation || !target || !subTarget || operation.passiveSkillId !== lifecycle.passiveSkillId || target.passiveSkillId !== lifecycle.passiveSkillId || subTarget.passiveSkillId !== lifecycle.passiveSkillId)
            throw new Error(`DB44 inherited rule missing ${key}`);
        if (target.target.status !== "supported" || subTarget.status !== "supported")
            throw new Error(`DB44 unsupported target ${key}`);
        const statModifier = projectDb44Modifier(type, row.eff_value1), calculationBucket = (0, team_analysis_db39_builder_1.projectDb39Bucket)(row.exec_timing_type), operandUnit = (0, team_analysis_db39_builder_1.db39OperandUnit)(operation.operation), currentKind = legacy.get(key) ?? null;
        const simulationStatus = statModifier.status === "supported" && calculationBucket.status === "supported" && operation.operation.status === "supported" ? "partial" : "unknown";
        ruleProjections.push({ stateKey: lifecycle.stateKey, ruleKey: lifecycle.ruleKey, passiveSkillId: lifecycle.passiveSkillId, efficacyType: type, sourceEffectCount: lifecycle.effectCount, statModifier, ignoredBehavioralParameters: { status: "not_read_by_handler", rawEffValue2: row.eff_value2, rawEffValue3: row.eff_value3 }, countInput: { status: "partial", source: "InGameCharaData.getObtainedBallTypeNumbers", rawBallType: 11, rawBitpattern: 0, absentMapEntryValue: 0, semanticName: "unknown" }, rawExecutionTimingType: row.exec_timing_type, rawCalculationOption: row.calc_option, rawTargetType: row.target_type, calculationBucket, calculationOperation: operation.operation, operandUnit, target: { status: "supported", candidate: target.target.value, subTarget: { status: "supported", rawSetId: subTarget.rawSetId, composition: subTarget.composition, emptySetBehavior: subTarget.emptySetBehavior, filters: subTarget.filters } }, lifecycle: { duration: lifecycle.duration, onceOnly: lifecycle.onceOnly, recurrence: "partial", resetAndExpiry: "unknown" }, simulationStatus, legacyComparison: { currentKind, status: currentKind === "unknown" ? "representation_gain_legacy_unknown" : "not_comparable", confirmedConflict: false }, independentDimensions: { condition: "independent", target: "inherited_db35_db36", timing: "independent", calculationOperation: "inherited_db31", calculationBucket: "inherited_db34", duration: "inherited_db37", onceOnly: "inherited_db37", recurrence: "partial", reset: "unknown", stacking: "unknown" }, provenance: { database: { table: "passive_skills", rowId: lifecycle.passiveSkillId, columns: [...DATABASE_COLUMNS] }, runtime: { fileName: "libcocos2dcpp.so", sha256: options.nativeSha256, evidenceFile: "native-single-stat-energy-ball-proportional-semantics.json", evidenceSha256: options.evidenceSha256, proofRoles }, inherited: { db8Sha256: options.db8Sha256, db9Sha256: options.db9Sha256, db11Sha256: options.db11Sha256, db31Sha256: options.db31Sha256, db34Sha256: options.db34Sha256, db35Sha256: options.db35Sha256, db36Sha256: options.db36Sha256, db37Sha256: options.db37Sha256, db39Sha256: options.db39Sha256, db39NativeEvidenceSha256: DB39_EVIDENCE_SHA } } });
    }
    return { schemaVersion: 1, contract: "dokkan-team-analysis-single-stat-energy-ball-proportional-native-semantics-experiment", contractVersion: "0.43.0", generatedAt: db37.generatedAt, sourceSnapshotVersion: db37.sourceSnapshotVersion, sourceDatabaseSha256: db37.sourceDatabaseSha256, sourceDb8: { fileName: "team-analysis-db8-evidence-experiment.json.gz", sha256: options.db8Sha256, contractVersion: "0.7.0" }, sourceDb9: { fileName: "team-analysis-db9-runtime-evidence.json.gz", sha256: options.db9Sha256, contractVersion: "0.8.0" }, sourceDb11: { fileName: "team-analysis-db11-experiment.json.gz", sha256: options.db11Sha256, contractVersion: "0.10.0" }, sourceDb31: { fileName: "team-analysis-db31-skill-calc-option.json.gz", sha256: options.db31Sha256, contractVersion: "0.30.0" }, sourceDb34: { fileName: "team-analysis-db34-basic-stat-buckets.json.gz", sha256: options.db34Sha256, contractVersion: "0.33.0" }, sourceDb35: { fileName: "team-analysis-db35-target-dispatch.json.gz", sha256: options.db35Sha256, contractVersion: "0.34.0" }, sourceDb36: { fileName: "team-analysis-db36-sub-target-semantics.json.gz", sha256: options.db36Sha256, contractVersion: "0.35.0" }, sourceDb37: { fileName: "team-analysis-db37-passive-lifecycle.json.gz", sha256: options.db37Sha256, contractVersion: "0.36.0" }, sourceDb39: { fileName: "team-analysis-db39-energy-ball-proportional-stats.json.gz", sha256: options.db39Sha256, contractVersion: "0.38.0", nativeEvidenceSha256: DB39_EVIDENCE_SHA }, nativeRuntime: { fileName: "libcocos2dcpp.so", sha256: options.nativeSha256, sizeBytes: options.nativeSizeBytes }, nativeEvidence: { fileName: "native-single-stat-energy-ball-proportional-semantics.json", sha256: options.evidenceSha256 }, inheritedSemanticPromotionCount: 51, semanticPromotionCount: 2, ruleProjections };
}
exports.buildDatabaseTeamAnalysisDb44Dataset = buildDatabaseTeamAnalysisDb44Dataset;
const distribution = (items, get) => { const result = {}; for (const item of items) {
    const key = get(item);
    result[key] = (result[key] ?? 0) + 1;
} return Object.fromEntries(Object.entries(result).sort(([left], [right]) => left.localeCompare(right, "en", { numeric: true }))); };
function buildDatabaseTeamAnalysisDb44Coverage(dataset) {
    const rules = dataset.ruleProjections, zero = (value) => integer(value) === 0;
    return { schemaVersion: 1, ruleCount: rules.length, sourceEffectCount: rules.reduce((sum, rule) => sum + rule.sourceEffectCount, 0), statApplicationCount: rules.length, affectedStateCount: new Set(rules.map(rule => rule.stateKey)).size, passiveSkillCount: new Set(rules.map(rule => rule.passiveSkillId)).size, supportedModifierRuleCount: rules.filter(rule => rule.statModifier.status === "supported").length, supportedBucketRuleCount: rules.filter(rule => rule.calculationBucket.status === "supported").length, supportedTargetRuleCount: rules.filter(rule => rule.target.status === "supported").length, emptySubTargetIdentityRuleCount: rules.filter(rule => rule.target.subTarget.status === "supported" && rule.target.subTarget.filters.length === 0).length, zeroIgnoredBehavioralParameterRuleCount: rules.filter(rule => zero(rule.ignoredBehavioralParameters.rawEffValue2) && zero(rule.ignoredBehavioralParameters.rawEffValue3)).length, countSemanticPartialRuleCount: rules.filter(rule => rule.countInput.status === "partial").length, simulationPartialRuleCount: rules.filter(rule => rule.simulationStatus === "partial").length, simulationUnknownRuleCount: rules.filter(rule => rule.simulationStatus === "unknown").length, legacyRepresentationGainRuleCount: rules.filter(rule => rule.legacyComparison.status === "representation_gain_legacy_unknown").length, confirmedLegacyConflictCount: 0, ruleCountsByEfficacyType: distribution(rules, rule => String(rule.efficacyType)), ruleCountsByStat: distribution(rules, rule => rule.statModifier.stat), ruleCountsByTiming: distribution(rules, rule => String(rule.rawExecutionTimingType)), ruleCountsByCalculationOption: distribution(rules, rule => String(rule.rawCalculationOption)), ruleCountsByTurn: distribution(rules, rule => String(rule.lifecycle.duration.rawTurn)), ruleCountsByOnceOnly: distribution(rules, rule => String(rule.lifecycle.onceOnly.rawIsOnce)), statApplicationsByStatAndBucket: distribution(rules, rule => `${rule.statModifier.stat}|${rule.calculationBucket.value}`), inheritedSemanticPromotionCount: 51, semanticPromotionCount: 2 };
}
exports.buildDatabaseTeamAnalysisDb44Coverage = buildDatabaseTeamAnalysisDb44Coverage;
//# sourceMappingURL=team-analysis-db44-builder.js.map