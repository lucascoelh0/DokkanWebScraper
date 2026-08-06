"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildDatabaseTeamAnalysisDb34Coverage = exports.buildDatabaseTeamAnalysisDb34Dataset = exports.db34OperandUnit = exports.projectDb34BasicStatShape = exports.projectDb34CalculationBucket = void 0;
const crypto_1 = require("crypto");
const sha256 = (value) => (0, crypto_1.createHash)("sha256").update(value).digest("hex");
const EXPECTED_DB33_SHA256 = "70fbd3a714ffeec21392ada5fd070e2c52986ab20d67418d397145071f809024";
const EXPECTED_BINDINGS = [
    { column: "exec_timing_type", literalVma: 32456068, passiveSkillOffset: 56, runtimeRole: "bucket_selector" },
    { column: "calc_option", literalVma: 33024419, passiveSkillOffset: 72, callChangeParamOffset: 24, runtimeRole: "calculation_operation" },
    { column: "eff_value1", literalVma: 32524339, passiveSkillOffset: 128, callChangeParamOffset: 40, runtimeRole: "first_modifier" },
    { column: "eff_value2", literalVma: 32045530, passiveSkillOffset: 132, callChangeParamOffset: 48, runtimeRole: "second_modifier" },
];
const EXPECTED_BUCKETS = [
    { bucket: "former_passive_stat", timingValues: [1, 3, 11, 15, 18], callTimingValues: [1, 11, 3, 15, 18], timingPairLiteralVma: 33223360, timingPairLiteralHex: "0100000002000000", attackSummaryRole: "former_passive_attack_summary", attackVmas: [46847456, 46847480, 46847500, 46847524, 46847552], defenseVmas: [46843588, 46843612, 46843632, 46843656, 46843684] },
    { bucket: "latter_passive_stat", timingValues: [4, 5, 6, 7, 9, 14], callTimingValues: [4, 5, 6, 7, 9, 14], timingPairLiteralVma: 33223664, timingPairLiteralHex: "0400000002000000", attackSummaryRole: "latter_passive_attack_summary", attackVmas: [46848524, 46848548, 46848572, 46848596, 46848624, 46848648], defenseVmas: [46844516, 46844540, 46844564, 46844588, 46844616, 46844640] },
];
const EXPECTED_EFFICACY_DISPATCH = [
    { raw: 1, handlerRole: "efficacy_1_attack", statApplications: [{ stat: "attack", column: "eff_value1", callChangeParamOffset: 40 }] },
    { raw: 2, handlerRole: "efficacy_2_defense", statApplications: [{ stat: "defense", column: "eff_value1", callChangeParamOffset: 40 }] },
    { raw: 3, handlerRole: "efficacy_3_attack_defense", statApplications: [{ stat: "attack", column: "eff_value1", callChangeParamOffset: 40 }, { stat: "defense", column: "eff_value2", callChangeParamOffset: 48 }] },
];
const EXPECTED_EFFICACY_INFO_VTABLE_SLOTS = [
    { offset: 80, symbol: "_ZNK19AbilityEfficacyInfo13getExecTimingEv" },
    { offset: 160, symbol: "_ZNK19AbilityEfficacyInfo13getCalcOptionEv" },
    { offset: 448, symbol: "_ZNK19AbilityEfficacyInfo22getModifierAttackValueEv" },
    { offset: 464, symbol: "_ZNK19AbilityEfficacyInfo23getModifierDefenseValueEv" },
];
const EXPECTED_CONCLUSIONS = ["efficacy_1_applies_eff_value1_to_attack", "efficacy_2_applies_eff_value1_to_defense", "efficacy_3_applies_eff_value1_to_attack_and_eff_value2_to_defense", "timings_1_3_11_15_18_feed_former_passive_stat_bucket", "timings_4_5_6_7_9_14_feed_latter_passive_stat_bucket", "basic_stat_modifiers_materialize_as_float32_and_accumulate_in_double_precision"];
const EXPECTED_UNKNOWNS = ["timing_12_stat_bucket", "target_semantics", "duration", "recurrence", "expiry", "reset", "cross_bucket_final_formula_order", "non_basic_stat_efficacy_buckets"];
const EXPECTED_REGIONS = {
    passive_skill_row_constructor: "_ZN12PassiveSkillC1EPN7SQLite33RowE", create_passive_skill: "_ZN14AbilityManager18createPassiveSkillEiiNSt6__ndk110shared_ptrI15PassiveSkillSetEE", ability_status_efficacy_constructor: "_ZN21AbilityStatusEfficacyC1EP27CreateAbilityStatusEfficacy", call_change_param_initializer: "local@AbilityEfficacyTarget::targetSelf+0xe0",
    efficacy_1_attack: "_ZN31AbilityEfficacyPureStatusUpFunc22callChangeAtkParamFuncEPN19AbilityEfficacyCore15CallChangeParamE", efficacy_2_defense: "_ZN31AbilityEfficacyPureStatusUpFunc22callChangeDefParamFuncEPN19AbilityEfficacyCore15CallChangeParamE", efficacy_3_attack_defense: "_ZN31AbilityEfficacyPureStatusUpFunc25callChangeAtkDefParamFuncEPN19AbilityEfficacyCore15CallChangeParamE",
    apply_attack: "_ZN21AbilityEfficacyHelper15applyAttackFuncEPN19AbilityEfficacyCore15CallChangeParamEf", apply_defense: "_ZN21AbilityEfficacyHelper16applyDefenseFuncEPN19AbilityEfficacyCore15CallChangeParamEf", generate_attack_info: "_ZN28AbilityEfficacyInfoGenerator33addAbilityEfficacyInfoAttackValueEPN19AbilityEfficacyCore15CallChangeParamE17SkillEfficacyTypef", generate_defense_info: "_ZN28AbilityEfficacyInfoGenerator34addAbilityEfficacyInfoDefenseValueEPN19AbilityEfficacyCore15CallChangeParamE17SkillEfficacyTypef",
    double_calc_dispatcher: "_ZN21AbilityCalcFuncDouble18getAbilityCalcFuncE15SkillCalcOption", double_calc_add: "_ZN21AbilityCalcFuncDouble8calcPlusEdd", double_calc_subtract: "_ZN21AbilityCalcFuncDouble9calcMinusEdd", double_calc_percent_add: "_ZN21AbilityCalcFuncDouble15calcPercentPlusEdd", double_calc_percent_subtract: "_ZN21AbilityCalcFuncDouble16calcPercentMinusEdd", double_calc_assign: "_ZN21AbilityCalcFuncDouble9calcEqualEdd",
    attack_stat_consumer: "_ZN25AbilityManagerStatHelpers35calcAttackValueFromEfficacyInfoListEPN14AbilityManager24CalcAbilityEfficacyParamEb", defense_stat_consumer: "_ZN25AbilityManagerStatHelpers36calcDefenseValueFromEfficacyInfoListEPN14AbilityManager24CalcAbilityEfficacyParamEb", stat_diff_accumulator: "_ZN25AbilityManagerStatHelpers27getDiffFromEfficacyInfoListERKNSt6__ndk18functionIFbR19AbilityEfficacyInfoEEEN14AbilityManager8CoefTypeEii17SkillCategoryTypeb",
    former_passive_attack_summary: "_ZN17AttackCalculation28calcFormerPassiveSkillAttackEi17SkillCategoryType", latter_passive_attack_summary: "_ZN17AttackCalculation28calcLatterPassiveSkillAttackEi17SkillCategoryType", total_attack_integration: "_ZN17AttackCalculation15calcTotalAttackEi17SkillCategoryTypeii", total_defense_integration: "_ZN18DefenseCalculation31calcInGameCharacterDefenceValueEi17SkillCategoryTypei",
};
const int = (value) => typeof value === "number" && Number.isSafeInteger(value) ? value : typeof value === "string" && value.trim() && Number.isSafeInteger(Number(value)) ? Number(value) : undefined;
const numeric = (value) => typeof value === "number" && Number.isFinite(value) ? value : typeof value === "string" && value.trim() && Number.isFinite(Number(value)) ? Number(value) : undefined;
const id = (row) => row.id === null || row.id === undefined ? undefined : String(row.id);
const relocation = (inspection, offset, symbol) => inspection.relocations.filter(value => value.offset === offset).length === 1 && inspection.relocations.find(value => value.offset === offset)?.symbolName === symbol;
function projectDb34CalculationBucket(value) {
    const raw = int(value);
    if ([1, 3, 11, 15, 18].includes(raw ?? -1))
        return { status: "supported", value: "former_passive_stat" };
    if ([4, 5, 6, 7, 9, 14].includes(raw ?? -1))
        return { status: "supported", value: "latter_passive_stat" };
    return { status: "unknown", value: "unknown" };
}
exports.projectDb34CalculationBucket = projectDb34CalculationBucket;
function projectDb34BasicStatShape(efficacyType) {
    const value = int(efficacyType);
    if (value === 1)
        return [{ stat: "attack", sourceColumn: "eff_value1" }];
    if (value === 2)
        return [{ stat: "defense", sourceColumn: "eff_value1" }];
    if (value === 3)
        return [{ stat: "attack", sourceColumn: "eff_value1" }, { stat: "defense", sourceColumn: "eff_value2" }];
    return [];
}
exports.projectDb34BasicStatShape = projectDb34BasicStatShape;
function db34OperandUnit(operation) {
    if (operation.status !== "supported")
        return { status: "unknown", value: "unknown" };
    return { status: "supported", value: operation.value === "add_percent_of_lhs" || operation.value === "subtract_percent_of_lhs_floor_zero" ? "percent_points_of_current_stat" : "stat_points" };
}
exports.db34OperandUnit = db34OperandUnit;
function validateEvidence(inspection, evidence, nativeSha) {
    if (evidence.schemaVersion !== 1 || evidence.sourceSha256 !== nativeSha || evidence.auditScope !== "basic-passive-atk-def-native-calculation-buckets" || JSON.stringify(evidence.sqliteBindings) !== JSON.stringify(EXPECTED_BINDINGS) || JSON.stringify(evidence.conclusions) !== JSON.stringify(EXPECTED_CONCLUSIONS) || JSON.stringify(evidence.unknowns) !== JSON.stringify(EXPECTED_UNKNOWNS))
        throw new Error("DB34 native evidence identity mismatch");
    for (const binding of evidence.sqliteBindings)
        if (!inspection.readVirtualBytes(binding.literalVma, binding.column.length + 1).equals(Buffer.from(`${binding.column}\0`)))
            throw new Error(`DB34 SQLite literal mismatch ${binding.column}`);
    if (evidence.codeRegions.length !== Object.keys(EXPECTED_REGIONS).length || new Set(evidence.codeRegions.map(value => value.role)).size !== evidence.codeRegions.length)
        throw new Error("DB34 code region cardinality mismatch");
    for (const region of evidence.codeRegions) {
        if (EXPECTED_REGIONS[region.role] !== region.symbol)
            throw new Error(`DB34 code region role mismatch ${region.role}`);
        const symbol = inspection.symbols.find(value => value.name === region.symbol);
        if (region.symbol.startsWith("local@")) {
            if (sha256(inspection.readVirtualBytes(region.vma, region.sizeBytes)) !== region.codeSha256)
                throw new Error(`DB34 local code mismatch ${region.role}`);
        }
        else if (!symbol || symbol.value !== region.vma || symbol.size !== region.sizeBytes || sha256(inspection.readVirtualBytes(region.vma, region.sizeBytes)) !== region.codeSha256)
            throw new Error(`DB34 native code mismatch ${region.role}`);
    }
    if (evidence.efficacyDispatch.tableVma !== 92049840 || JSON.stringify(evidence.efficacyDispatch.slots) !== JSON.stringify(EXPECTED_EFFICACY_DISPATCH))
        throw new Error("DB34 efficacy dispatch metadata mismatch");
    for (const expected of EXPECTED_EFFICACY_DISPATCH) {
        const region = evidence.codeRegions.find(value => value.role === expected.handlerRole);
        if (!region || !relocation(inspection, 92049840 + expected.raw * 8, region.symbol))
            throw new Error(`DB34 efficacy dispatch slot mismatch ${expected.raw}`);
    }
    if (evidence.doubleCalculationDispatch.tableVma !== 92053528 || evidence.doubleCalculationDispatch.dispatcherRole !== "double_calc_dispatcher" || JSON.stringify(evidence.doubleCalculationDispatch.operationRoles) !== JSON.stringify(["double_calc_add", "double_calc_subtract", "double_calc_percent_add", "double_calc_percent_subtract", "double_calc_assign"]) || evidence.doubleCalculationDispatch.materialization !== "sqlite_numeric_to_double_then_handler_float32_then_widened_double")
        throw new Error("DB34 double dispatch metadata mismatch");
    for (let raw = 0; raw < 5; raw++) {
        const role = evidence.doubleCalculationDispatch.operationRoles[raw], region = evidence.codeRegions.find(value => value.role === role);
        if (!region || !relocation(inspection, 92053528 + raw * 8, region.symbol))
            throw new Error(`DB34 double dispatch slot mismatch ${raw}`);
    }
    if (evidence.bucketGroups.length !== 2)
        throw new Error("DB34 bucket cardinality mismatch");
    for (const expected of EXPECTED_BUCKETS) {
        const group = evidence.bucketGroups.find(value => value.bucket === expected.bucket);
        if (!group || JSON.stringify(group.timingValues) !== JSON.stringify(expected.timingValues) || group.timingPairLiteralVma !== expected.timingPairLiteralVma || group.timingPairLiteralHex !== expected.timingPairLiteralHex || group.attackSummaryRole !== expected.attackSummaryRole || JSON.stringify(group.attackIntegrationCallSites.map(value => value.callVma)) !== JSON.stringify(expected.attackVmas) || JSON.stringify(group.defenseIntegrationCallSites.map(value => value.callVma)) !== JSON.stringify(expected.defenseVmas) || inspection.readVirtualBytes(group.timingPairLiteralVma, 8).toString("hex") !== group.timingPairLiteralHex)
            throw new Error(`DB34 bucket metadata mismatch ${expected.bucket}`);
        if (JSON.stringify(group.attackIntegrationCallSites.map(value => value.timing)) !== JSON.stringify(expected.callTimingValues) || JSON.stringify(group.defenseIntegrationCallSites.map(value => value.timing)) !== JSON.stringify(expected.callTimingValues))
            throw new Error(`DB34 bucket timing order mismatch ${expected.bucket}`);
        for (const call of [...group.attackIntegrationCallSites, ...group.defenseIntegrationCallSites])
            if (inspection.readVirtualBytes(call.callVma, 4).toString("hex") !== call.instructionHex)
                throw new Error(`DB34 bucket call bytes mismatch ${call.callVma}`);
    }
    const expectedAccumulator = { role: "stat_diff_accumulator", coefTypes: [{ raw: 0, stat: "attack", modifierGetterVtableOffset: 448 }, { raw: 1, stat: "defense", modifierGetterVtableOffset: 464 }], calcOptionGetterVtableOffset: 160, behavior: { "0": "truncate_modifier_then_add_to_flat_delta", "1": "truncate_modifier_then_subtract_from_flat_delta", "2": "add_modifier_div_100_to_double_multiplier", "3": "subtract_modifier_div_100_from_double_multiplier_floor_zero", "4": "truncate_modifier_as_assignment_last_assignment_wins" }, result: "selected_assignment_or_trunc_base_times_multiplier_plus_flat_delta_minus_base", iterationOrder: "ability_efficacy_info_list_order", rounding: "modifier_float32_then_double_accumulation_with_fcvtzs_truncation" };
    if (JSON.stringify(evidence.accumulator) !== JSON.stringify(expectedAccumulator))
        throw new Error("DB34 accumulator metadata mismatch");
    if (evidence.abilityEfficacyInfoVtable.symbol !== "_ZTV19AbilityEfficacyInfo" || evidence.abilityEfficacyInfoVtable.vma !== 92053824 || evidence.abilityEfficacyInfoVtable.sizeBytes !== 624 || JSON.stringify(evidence.abilityEfficacyInfoVtable.slots) !== JSON.stringify(EXPECTED_EFFICACY_INFO_VTABLE_SLOTS))
        throw new Error("DB34 vtable identity mismatch");
    const vtable = inspection.symbols.find(value => value.name === evidence.abilityEfficacyInfoVtable.symbol);
    if (!vtable || vtable.value !== evidence.abilityEfficacyInfoVtable.vma || vtable.size !== evidence.abilityEfficacyInfoVtable.sizeBytes)
        throw new Error("DB34 vtable ELF mismatch");
    for (const slot of evidence.abilityEfficacyInfoVtable.slots)
        if (!relocation(inspection, vtable.value + slot.offset, slot.symbol))
            throw new Error(`DB34 vtable slot mismatch ${slot.offset}`);
}
function validateLineage(options) {
    if (options.db11.contractVersion !== "0.10.0" || options.db13.contractVersion !== "0.12.1" || options.db31.contractVersion !== "0.30.0" || options.db33.contractVersion !== "0.32.0" || options.db33Sha256 !== EXPECTED_DB33_SHA256)
        throw new Error("DB34 source contract mismatch");
    if (options.db13.sourceDb11.sha256 !== options.db11Sha256 || options.db31.sourceDb11.sha256 !== options.db11Sha256 || options.db33.sourceDatabaseSha256 !== options.db11.sourceSha256 || options.db13.sourceDatabaseSha256 !== options.db11.sourceSha256 || options.db31.sourceDatabaseSha256 !== options.db11.sourceSha256 || options.db33.currentTeamAnalysis.sha256 !== options.currentSha256 || options.db13.sourceCurrentTeamAnalysis.sha256 !== options.currentSha256 || options.db31.currentTeamAnalysis.sha256 !== options.currentSha256 || options.db33.nativeRuntime.sha256 !== options.nativeSha256 || options.db33.nativeRuntime.sizeBytes !== options.nativeSizeBytes)
        throw new Error("DB34 source lineage mismatch");
}
function buildDatabaseTeamAnalysisDb34Dataset(options) {
    validateLineage(options);
    validateEvidence(options.inspection, options.evidence, options.nativeSha256);
    const rows = new Map((options.tables.passive_skills ?? []).map(row => [id(row), row]));
    const timings = new Map(options.db33.ruleTimings.map(value => [`${value.stateKey}|${value.ruleKey}`, value]));
    const operations = new Map(options.db31.ruleProjections.map(value => [`${value.stateKey}|${value.ruleKey}`, value]));
    const statApplications = [], basicRuleKeys = new Set();
    const proofRoles = options.evidence.codeRegions.map(value => value.role);
    for (const state of options.db11.states)
        for (const rule of state.passive?.rules ?? []) {
            const efficacyType = int(rule.source.efficacyType);
            if (![1, 2, 3].includes(efficacyType ?? -1))
                continue;
            const key = `${state.stateKey}|${rule.ruleKey}`, row = rows.get(rule.source.passiveSkillId), timing = timings.get(key), operation = operations.get(key), shape = projectDb34BasicStatShape(efficacyType), bucket = projectDb34CalculationBucket(rule.source.executionTimingType);
            if (!row || !timing || !operation || id(row) !== rule.source.passiveSkillId || int(row.efficacy_type) !== efficacyType || int(row.exec_timing_type) !== int(rule.source.executionTimingType) || JSON.stringify(operation.operation) !== JSON.stringify(timing.calculationOperation) || operation.passiveSkillId !== rule.source.passiveSkillId || timing.passiveSkillId !== rule.source.passiveSkillId || shape.length !== rule.effects.length)
                throw new Error(`DB34 source rule mismatch ${key}`);
            const operandUnit = db34OperandUnit(operation.operation);
            if (operandUnit.status !== "supported")
                throw new Error(`DB34 unsupported calculation operation ${key}`);
            basicRuleKeys.add(key);
            for (const item of shape) {
                const rawModifier = row[item.sourceColumn], modifier = numeric(rawModifier);
                if (modifier === undefined)
                    throw new Error(`DB34 invalid modifier ${key}|${item.sourceColumn}`);
                statApplications.push({ stateKey: state.stateKey, ruleKey: rule.ruleKey, passiveSkillId: rule.source.passiveSkillId, efficacyType: efficacyType, stat: item.stat, sourceColumn: item.sourceColumn, rawModifier: rawModifier ?? null, runtimeModifierFloat32: Math.fround(modifier), rawExecutionTimingType: rule.source.executionTimingType, calculationBucket: bucket, calculationOperation: operation.operation, operandUnit, executionTiming: timing.executionTiming, semanticStatus: "partial", independentDimensions: { target: "unknown", duration: "unknown", recurrence: "unknown", expiry: "unknown", reset: "unknown", crossBucketOrder: "unknown" }, provenance: { database: { table: "passive_skills", rowId: rule.source.passiveSkillId, columns: ["efficacy_type", "exec_timing_type", "calc_option", item.sourceColumn] }, runtime: { fileName: "libcocos2dcpp.so", sha256: options.nativeSha256, evidenceFile: "native-basic-stat-bucket-semantics.json", evidenceSha256: options.evidenceSha256, proofRoles } } });
            }
        }
    statApplications.sort((left, right) => left.stateKey.localeCompare(right.stateKey, "en", { numeric: true }) || left.ruleKey.localeCompare(right.ruleKey, "en", { numeric: true }) || left.stat.localeCompare(right.stat));
    const currentRules = new Map();
    for (const state of options.current.states)
        for (const rule of state.passive?.rules ?? []) {
            const key = `${state.stateKey}|${rule.ruleKey ?? rule.id}`;
            const values = currentRules.get(key) ?? [];
            values.push(rule);
            currentRules.set(key, values);
        }
    const applicationsByRule = new Map();
    for (const value of statApplications)
        applicationsByRule.set(`${value.stateKey}|${value.ruleKey}`, value);
    const crossTab = {}, candidateConflicts = [];
    let alignedBasicStatRuleCount = 0;
    for (const alignment of options.db13.ruleAlignments) {
        if (alignment.kind !== "exact_effect_set_unique")
            continue;
        const application = applicationsByRule.get(`${alignment.stateKey}|${alignment.databaseRuleKey}`), matches = currentRules.get(`${alignment.stateKey}|${alignment.currentRuleKey}`);
        if (!application || !matches || matches.length !== 1)
            continue;
        alignedBasicStatRuleCount++;
        const legacyBuckets = [...new Set((matches[0].effects ?? []).map(effect => { const bucket = effect.calculationBucket; return typeof bucket?.bucket === "string" ? bucket.bucket : "absent"; }))].sort();
        const legacySignature = legacyBuckets.join("+") || "absent", crossKey = `${application.calculationBucket.value}|${legacySignature}`;
        crossTab[crossKey] = (crossTab[crossKey] ?? 0) + 1;
        if (application.calculationBucket.value === "latter_passive_stat" && legacySignature === "passive_start_of_turn")
            candidateConflicts.push({ stateKey: alignment.stateKey, databaseRuleKey: alignment.databaseRuleKey, currentRuleKey: alignment.currentRuleKey, passiveSkillId: application.passiveSkillId, rawExecutionTimingType: application.rawExecutionTimingType, firstPartyBucket: "latter_passive_stat", legacyBucket: "passive_start_of_turn", status: "candidate", boundary: "db13_unique_effect_set_alignment_is_diagnostic_not_identity_proof" });
    }
    candidateConflicts.sort((left, right) => left.stateKey.localeCompare(right.stateKey, "en", { numeric: true }));
    const sourceRules = options.db33.ruleTimings;
    return { schemaVersion: 1, contract: "dokkan-team-analysis-basic-stat-calculation-bucket-experiment", contractVersion: "0.33.0", generatedAt: options.db33.generatedAt, sourceSnapshotVersion: options.db33.sourceSnapshotVersion, sourceDatabaseSha256: options.db33.sourceDatabaseSha256,
        sourceDb11: { fileName: "team-analysis-db11-experiment.json.gz", sha256: options.db11Sha256, contractVersion: "0.10.0" }, sourceDb13: { fileName: "team-analysis-db13-rule-alignment.json.gz", sha256: options.db13Sha256, contractVersion: "0.12.1" }, sourceDb31: { fileName: "team-analysis-db31-skill-calc-option.json.gz", sha256: options.db31Sha256, contractVersion: "0.30.0" }, sourceDb33: { fileName: "team-analysis-db33-player-attack-setup-timing.json.gz", sha256: options.db33Sha256, contractVersion: "0.32.0" }, currentTeamAnalysis: { fileName: "team-analysis.json.gz", sha256: options.currentSha256 }, nativeRuntime: { fileName: "libcocos2dcpp.so", sha256: options.nativeSha256, sizeBytes: options.nativeSizeBytes }, nativeEvidence: { fileName: "native-basic-stat-bucket-semantics.json", sha256: options.evidenceSha256 }, inheritedSemanticPromotionCount: 10, semanticPromotionCount: 5, sourcePopulation: { ruleCount: sourceRules.length, effectCount: sourceRules.reduce((sum, value) => sum + value.effectCount, 0) }, statApplications, legacyComparison: { alignedBasicStatRuleCount, crossTab: Object.fromEntries(Object.entries(crossTab).sort(([left], [right]) => left.localeCompare(right))), confirmedConflictCount: 0, candidateConflicts, boundary: "db13_alignment_only_no_legacy_bucket_equivalence" } };
}
exports.buildDatabaseTeamAnalysisDb34Dataset = buildDatabaseTeamAnalysisDb34Dataset;
const counts = (values, key) => { const result = {}; for (const value of values) {
    const name = key(value);
    result[name] = (result[name] ?? 0) + 1;
} return Object.fromEntries(Object.entries(result).sort(([left], [right]) => left.localeCompare(right, "en", { numeric: true }))); };
function buildDatabaseTeamAnalysisDb34Coverage(dataset) {
    const ruleKeys = new Set(dataset.statApplications.map(value => `${value.stateKey}|${value.ruleKey}`));
    const supportedApplications = dataset.statApplications.filter(value => value.calculationBucket.status === "supported"), supportedRuleKeys = new Set(supportedApplications.map(value => `${value.stateKey}|${value.ruleKey}`));
    return { schemaVersion: 1, sourceRuleCount: dataset.sourcePopulation.ruleCount, sourceEffectCount: dataset.sourcePopulation.effectCount, basicStatRuleCount: ruleKeys.size, statApplicationCount: dataset.statApplications.length, affectedPassiveSkillCount: new Set(dataset.statApplications.map(value => value.passiveSkillId)).size, affectedStateCount: new Set(dataset.statApplications.map(value => value.stateKey)).size, supportedBucketRuleCount: supportedRuleKeys.size, supportedBucketApplicationCount: supportedApplications.length, unknownBucketRuleCount: ruleKeys.size - supportedRuleKeys.size, unknownBucketApplicationCount: dataset.statApplications.length - supportedApplications.length, ruleCountsByBucket: counts([...ruleKeys], key => dataset.statApplications.find(value => `${value.stateKey}|${value.ruleKey}` === key).calculationBucket.value), applicationCountsByBucket: counts(dataset.statApplications, value => value.calculationBucket.value), applicationCountsByStatAndBucket: counts(dataset.statApplications, value => `${value.calculationBucket.value}|${value.stat}`), applicationCountsByOperation: counts(dataset.statApplications, value => value.calculationOperation.value), applicationCountsByOperandUnit: counts(dataset.statApplications, value => value.operandUnit.value), rawTimingCounts: counts(dataset.statApplications.filter((value, index, values) => values.findIndex(other => other.stateKey === value.stateKey && other.ruleKey === value.ruleKey) === index), value => String(value.rawExecutionTimingType)), alignedBasicStatRuleCount: dataset.legacyComparison.alignedBasicStatRuleCount, confirmedLegacyConflictCount: 0, candidateLegacyConflictCount: dataset.legacyComparison.candidateConflicts.length, inheritedSemanticPromotionCount: 10, semanticPromotionCount: 5 };
}
exports.buildDatabaseTeamAnalysisDb34Coverage = buildDatabaseTeamAnalysisDb34Coverage;
//# sourceMappingURL=team-analysis-db34-builder.js.map