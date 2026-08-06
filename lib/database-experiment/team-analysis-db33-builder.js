"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildDatabaseTeamAnalysisDb33Coverage = exports.buildDatabaseTeamAnalysisDb33Dataset = exports.validateDb33SourceLineage = exports.validateDb33Evidence = exports.projectDb33AttackSetupTiming = exports.parseDb33ExecutionTiming = void 0;
const crypto_1 = require("crypto");
const sha256 = (value) => (0, crypto_1.createHash)("sha256").update(value).digest("hex");
const EXPECTED_DB32_SHA256 = "29c408e3ced29f3d07fe8a4715afb88a6d950c52be43cb7fadc7d2b23de4fdfa";
const parseDb33ExecutionTiming = (value) => typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : Number.NaN;
exports.parseDb33ExecutionTiming = parseDb33ExecutionTiming;
const projectDb33AttackSetupTiming = (value) => Number.isSafeInteger((0, exports.parseDb33ExecutionTiming)(value)) && (0, exports.parseDb33ExecutionTiming)(value) === 4
    ? { status: "supported", event: "player_attack_setup", sequence: "inside_player_attack_damage_and_action_bank_setup_before_setup_result_consumer" }
    : { status: "unknown", event: "unknown" };
exports.projectDb33AttackSetupTiming = projectDb33AttackSetupTiming;
const EXPECTED_REGIONS = {
    execution_filter: ["_ZN14AbilityManager21callAbilityStatusExecEi17SkillCategoryType19SkillExecTimingType9SkillTypeN13AbilityStatus14AddtionalParamE", 64372436, 1068, "e479bd26a683eef5f1a8a035c4c99e83cd4e4a1de0ab4a716f5842df7e8aa707"],
    player_attack_setup: ["_ZN31PlayerAttackDamageAndActionBank5setupEP21DPuzzleGameControlleriRK21SetupExtraActionParambiRKNSt6__ndk112basic_stringIcNS5_11char_traitsIcEENS5_9allocatorIcEEEEP18AimAllSpecialParamRNS5_13unordered_mapIiiNS5_4hashIiEENS5_8equal_toIiEENS9_INS5_4pairIKiiEEEEEENS5_8optionalIiEE", 48049704, 20232, "cbe4e3fcc989cae9b89d464bb4197b63a5def56e2f040956c36d71ccc2573aa4"],
    setup_extra_attacks: ["_ZN21DPuzzleGameController17setupExtraAttacksEi", 47890920, 936, "215fa6189febfc92415632ed3a8badb8e939979b0b938474f70ba292c0427c72"],
    execute_player_attack_order: ["_ZN21DPuzzleGameController21execPlayerAttackOrderEiRK21SetupExtraActionParam", 47894536, 784, "5957ef077667ecb6a04798d498f5a4696d22a328a547ec983310b0724b5e66d1"],
    setup_player_attack_wrapper: ["_ZN21DPuzzleGameController36setupPlayerAttackDamageAndActionBankEiRK21SetupExtraActionParambiRKNSt6__ndk112basic_stringIcNS3_11char_traitsIcEENS3_9allocatorIcEEEEP18AimAllSpecialParamNS3_8optionalIiEE", 47898368, 40, "e3f4a8f93c5ce2ebb2c6e90e8e39f71661e3f5e53e7872d9eaa17cdb8332d809"],
    execute_counter_attack: ["_ZN21DPuzzleGameController20executeCounterAttackEiiiiN21SetupExtraActionParam10AttackTypeE", 47913816, 1352, "3eff8bc7d3f2c1167ab706468ce398284d22807efece94bda77b7ca9ebb2329b"],
    public_passive_creator: ["_ZN14AbilityManager18createPassiveSkillEiii", 64382960, 500, "cb273ea34b565f2fdfe938c73149679862e1767556175c90773f0170d153198b"],
    shared_passive_creator: ["_ZN14AbilityManager18createPassiveSkillEiiNSt6__ndk110shared_ptrI15PassiveSkillSetEE", 64383460, 1524, "b56f963ad641d1d9e67027199b0529fb56cf7039b5dc206209eb359a9bb2d04d"],
    base_status_constructor: ["_ZN13AbilityStatusC1EP19CreateAbilityStatus", 64481244, 216, "3771214b5975010426d243415138025a6c551c077e4ed54494caa9ab38e00f84"],
    transformation_passive_creation: ["_ZN14Transformation19createPassiveSkillsEi", 47855676, 656, "66395ef4529818cb8175a97c83c3fe86fe6612e1825e5229b72d0bd2e883ee8f"],
    metamorphic_passive_creation: ["_ZN21DPuzzleGameController21beginMetamorphicCharaERKNSt6__ndk110shared_ptrI16MetamorphicParamEE", 47920352, 4808, "4001577bbb15c15c0e50f7eaabf44fed1cb1efbcf25f0460dbdbc839c874ce40"],
    initial_passive_creation: ["_ZN10InGameData12setupAbilityEiRKNSt6__ndk110shared_ptrI8UserCardEES5_", 49879224, 884, "ea34f0f850f073b604e265f1c8e6a7a01427978457d22f21393eb562da68011d"],
};
const EXPECTED_CALLS = [
    { literalVma: 48052872, callVma: 48052884, skillCategoryRaw: 0, skillTypeRaw: 2, outputConsumptionVma: 48052900, literalInstructionHex: "83008052", callInstructionHex: "73129b94" },
    { literalVma: 48053164, callVma: 48053176, skillCategoryRaw: 0, skillTypeRaw: 11, outputConsumptionVma: 48053192, literalInstructionHex: "83008052", callInstructionHex: "2a129b94" },
    { literalVma: 48054080, callVma: 48054092, skillCategoryRaw: 1, skillTypeRaw: 10, outputConsumptionVma: 48054108, literalInstructionHex: "83008052", callInstructionHex: "45119b94" },
];
const EXPECTED_CALLERS = [
    { callVma: 47891408, ownerSymbol: "_ZN21DPuzzleGameController17setupExtraAttacksEi" },
    { callVma: 47895000, ownerSymbol: "_ZN21DPuzzleGameController21execPlayerAttackOrderEiRK21SetupExtraActionParam" },
    { callVma: 47898392, ownerSymbol: "_ZN21DPuzzleGameController36setupPlayerAttackDamageAndActionBankEiRK21SetupExtraActionParambiRKNSt6__ndk112basic_stringIcNS3_11char_traitsIcEENS3_9allocatorIcEEEEP18AimAllSpecialParamNS3_8optionalIiEE" },
    { callVma: 47914304, ownerSymbol: "_ZN21DPuzzleGameController20executeCounterAttackEiiiiN21SetupExtraActionParam10AttackTypeE" },
    { callVma: 47914760, ownerSymbol: "_ZN21DPuzzleGameController20executeCounterAttackEiiiiN21SetupExtraActionParam10AttackTypeE" },
];
const EXPECTED_UNKNOWNS = ["on_attack_label", "before_attack_label", "attack_execution", "calculation_bucket", "unit", "target", "duration", "recurrence", "stacking", "is_once_interaction", "turn_field_interaction"];
const EXPECTED_PASSIVE_FILTER_PROOF = {
    referenceScan: { algorithm: "aarch64_bl_imm26_target_scan", alignmentBytes: 4, publicCreatorVma: 64382960, publicCreatorPltVma: 88713616, directCallVmas: [], pltCallVmas: [47856028, 47923908, 49879788] },
    publicCreator: { symbol: "_ZN14AbilityManager18createPassiveSkillEiii", categoryArgumentRegister: "w2", virtualForwardVma: 64383172, abilityManagerVtableSymbol: "_ZTV14AbilityManager", vtableRelocationOffset: 56, forwardedCategoryRegister: "w2" },
    allPublicCreatorCallSites: [
        { categoryLiteralVma: 47856020, callVma: 47856028, ownerSymbol: "_ZN14Transformation19createPassiveSkillsEi", categoryRaw: 0, literalInstructionHex: "e2031f2a" },
        { categoryLiteralVma: 47923904, callVma: 47923908, ownerSymbol: "_ZN21DPuzzleGameController21beginMetamorphicCharaERKNSt6__ndk110shared_ptrI16MetamorphicParamEE", categoryRaw: 0, literalInstructionHex: "e2031f2a" },
        { categoryLiteralVma: 49879784, callVma: 49879788, ownerSymbol: "_ZN10InGameData12setupAbilityEiRKNSt6__ndk110shared_ptrI8UserCardEES5_", categoryRaw: 0, literalInstructionHex: "e2031f2a" },
    ],
    sharedCreator: { symbol: "_ZN14AbilityManager18createPassiveSkillEiiNSt6__ndk110shared_ptrI15PassiveSkillSetEE", categoryArgumentRegister: "w2", categoryStoreVma: 64383712, createCategoryOffset: 16, skillTypeRaw: 2, skillTypeLiteralVma: 64383696, skillTypeStoreVma: 64383724, createSkillTypeOffset: 24 },
    baseStatus: { symbol: "_ZN13AbilityStatusC1EP19CreateAbilityStatus", createCategoryOffset: 16, statusCategoryOffset: 28, categoryCopyVma: 64481320, createSkillTypeOffset: 24, statusSkillTypeOffset: 32, skillTypeCopyVma: 64481308 },
    passiveVtable: { symbol: "_ZTV20AbilityStatusPassive", vma: 92059608, sizeBytes: 360, rawSha256: "d3df611a0ed2e328b050d285287637c60643ba96ec09e4aaefaad7f2cd114b77", timingGetterRelocationOffset: 64, categoryGetterRelocationOffset: 96, skillTypeGetterRelocationOffset: 104 },
    abilityManagerVtable: { symbol: "_ZTV14AbilityManager", vma: 92054472, sizeBytes: 200, rawSha256: "58ec95077a7df39db01804932f0b4b1f926eac72b956891a84e775d42c6a7753", sharedCreatorRelocationOffset: 56 },
    filterComparisons: { timingVma: 64372640, skillTypeVma: 64372672, categoryVma: 64372696 },
    matchingSetupCall: { callVma: 48052884, categoryRaw: 0, skillTypeRaw: 2 },
};
function validateCode(inspection, region) {
    const symbol = inspection.symbols.find(value => value.name === region.symbol);
    if (!symbol || symbol.value !== region.vma || symbol.size !== region.sizeBytes || sha256(inspection.readVirtualBytes(region.vma, region.sizeBytes)) !== region.codeSha256)
        throw new Error(`DB33 native region mismatch ${region.symbol}`);
}
function validateDb33Evidence(inspection, evidence, nativeSha256) {
    if (evidence.schemaVersion !== 1 || evidence.sourceSha256 !== nativeSha256 || evidence.auditScope !== "passive-skill-execution-timing-value-4" || JSON.stringify(evidence.unknowns) !== JSON.stringify(EXPECTED_UNKNOWNS))
        throw new Error("DB33 evidence identity mismatch");
    if (JSON.stringify(evidence.sqliteField) !== JSON.stringify({ table: "passive_skills", column: "exec_timing_type" }))
        throw new Error("DB33 SQLite binding mismatch");
    if (JSON.stringify(evidence.filter) !== JSON.stringify({ symbol: "_ZN14AbilityManager21callAbilityStatusExecEi17SkillCategoryType19SkillExecTimingType9SkillTypeN13AbilityStatus14AddtionalParamE", timingArgumentRegister: "w3", getterVirtualCallVma: 64372628, equalityCompareVma: 64372640 }))
        throw new Error("DB33 filter mismatch");
    if (evidence.supportedValue.raw !== 4 || evidence.supportedValue.event !== "player_attack_setup" || evidence.supportedValue.sequence !== "inside_player_attack_damage_and_action_bank_setup_before_setup_result_consumer" || JSON.stringify(evidence.supportedValue.callSites) !== JSON.stringify(EXPECTED_CALLS))
        throw new Error("DB33 supported value mismatch");
    if (JSON.stringify(evidence.setupCallers) !== JSON.stringify(EXPECTED_CALLERS))
        throw new Error("DB33 setup callers mismatch");
    if (JSON.stringify(evidence.sequenceProof) !== JSON.stringify({ ownerSymbol: "_ZN21DPuzzleGameController21execPlayerAttackOrderEiRK21SetupExtraActionParam", setupCallVma: 47895000, setupResultConsumerCallVma: 47895044, setupResultConsumerSymbol: "_ZN21SpecialAttackAllUtils19TrySpecialAttackAllEP21DPuzzleGameControlleriRK21SetupExtraActionParamRKNSt6__ndk18optionalIiEERKN31PlayerAttackDamageAndActionBank11SetupResultER18AimAllSpecialParam" }))
        throw new Error("DB33 sequence proof mismatch");
    if (JSON.stringify(evidence.passiveStatusFilterProof) !== JSON.stringify(EXPECTED_PASSIVE_FILTER_PROOF))
        throw new Error("DB33 passive status filter proof mismatch");
    if (evidence.codeRegions.length !== 12 || new Set(evidence.codeRegions.map(value => value.role)).size !== 12)
        throw new Error("DB33 code region count mismatch");
    for (const region of evidence.codeRegions) {
        const expected = EXPECTED_REGIONS[region.role];
        if (!expected || JSON.stringify([region.symbol, region.vma, region.sizeBytes, region.codeSha256]) !== JSON.stringify(expected))
            throw new Error(`DB33 code region metadata mismatch ${region.role}`);
        validateCode(inspection, region);
    }
    for (const call of evidence.supportedValue.callSites) {
        if (inspection.readVirtualBytes(call.literalVma, 4).toString("hex") !== call.literalInstructionHex || inspection.readVirtualBytes(call.callVma, 4).toString("hex") !== call.callInstructionHex)
            throw new Error(`DB33 call-site bytes mismatch ${call.callVma}`);
    }
    for (const call of evidence.passiveStatusFilterProof.allPublicCreatorCallSites)
        if (inspection.readVirtualBytes(call.categoryLiteralVma, 4).toString("hex") !== call.literalInstructionHex)
            throw new Error(`DB33 passive creator category mismatch ${call.callVma}`);
    const managerVtable = inspection.symbols.find(value => value.name === evidence.passiveStatusFilterProof.abilityManagerVtable.symbol);
    if (!managerVtable || managerVtable.value !== evidence.passiveStatusFilterProof.abilityManagerVtable.vma || managerVtable.size !== evidence.passiveStatusFilterProof.abilityManagerVtable.sizeBytes || sha256(inspection.readVirtualBytes(managerVtable.value, managerVtable.size)) !== evidence.passiveStatusFilterProof.abilityManagerVtable.rawSha256)
        throw new Error("DB33 AbilityManager vtable mismatch");
    const managerCreatorRelocation = inspection.relocations.filter(value => value.offset === managerVtable.value + evidence.passiveStatusFilterProof.abilityManagerVtable.sharedCreatorRelocationOffset);
    if (managerCreatorRelocation.length !== 1 || managerCreatorRelocation[0].symbolName !== evidence.passiveStatusFilterProof.sharedCreator.symbol || managerCreatorRelocation[0].symbolValue !== 64383460)
        throw new Error("DB33 passive creator vtable slot mismatch");
    const passiveVtable = inspection.symbols.find(value => value.name === evidence.passiveStatusFilterProof.passiveVtable.symbol);
    if (!passiveVtable || passiveVtable.value !== evidence.passiveStatusFilterProof.passiveVtable.vma || passiveVtable.size !== evidence.passiveStatusFilterProof.passiveVtable.sizeBytes || sha256(inspection.readVirtualBytes(passiveVtable.value, passiveVtable.size)) !== evidence.passiveStatusFilterProof.passiveVtable.rawSha256)
        throw new Error("DB33 passive vtable mismatch");
    const expectedGetters = [[64, "_ZNK13AbilityStatus13getExecTimingEv", 64480160], [96, "_ZNK13AbilityStatus11getCategoryEv", 64480192], [104, "_ZNK13AbilityStatus12getSkillTypeEv", 64480200]];
    for (const [offset, symbolName, symbolValue] of expectedGetters) {
        const relocation = inspection.relocations.filter(value => value.offset === passiveVtable.value + offset);
        if (relocation.length !== 1 || relocation[0].symbolName !== symbolName || relocation[0].symbolValue !== symbolValue)
            throw new Error(`DB33 passive getter slot mismatch ${offset}`);
    }
}
exports.validateDb33Evidence = validateDb33Evidence;
function validateDb33SourceLineage(db32, db32Sha256, sourceDatabaseSha256, currentSha256, nativeSha256, nativeSizeBytes) {
    if (db32.contractVersion !== "0.31.0" || db32Sha256 !== EXPECTED_DB32_SHA256 || db32.sourceDatabaseSha256 !== sourceDatabaseSha256 || db32.currentTeamAnalysis.sha256 !== currentSha256 || db32.nativeRuntime.sha256 !== nativeSha256 || db32.nativeRuntime.sizeBytes !== nativeSizeBytes)
        throw new Error("DB33 source lineage mismatch");
}
exports.validateDb33SourceLineage = validateDb33SourceLineage;
function buildDatabaseTeamAnalysisDb33Dataset(options) {
    validateDb33SourceLineage(options.db32, options.db32Sha256, options.sourceDatabaseSha256, options.currentSha256, options.nativeSha256, options.nativeSizeBytes);
    validateDb33Evidence(options.inspection, options.evidence, options.nativeSha256);
    const proofRoles = options.evidence.codeRegions.map(value => value.role);
    const ruleTimings = options.db32.ruleTimings.map(source => {
        const raw = (0, exports.parseDb33ExecutionTiming)(source.rawExecutionTimingType);
        if (raw === 1 && (source.executionTiming.status !== "supported" || source.executionTiming.event !== "turn_start" || !source.provenance.runtime))
            throw new Error(`DB33 inherited timing mismatch ${source.stateKey}|${source.ruleKey}`);
        if (raw !== 1 && source.executionTiming.status !== "unknown")
            throw new Error(`DB33 unexpected inherited timing ${source.stateKey}|${source.ruleKey}`);
        const promoted = (0, exports.projectDb33AttackSetupTiming)(source.rawExecutionTimingType);
        const executionTiming = promoted.status === "supported" ? promoted : source.executionTiming;
        const provenance = promoted.status === "supported" ? {
            database: source.provenance.database,
            runtime: { fileName: "libcocos2dcpp.so", sha256: options.nativeSha256, evidenceFile: "native-execution-timing-value-4-semantics.json", evidenceSha256: options.evidenceSha256, proofRoles },
        } : source.provenance;
        return { stateKey: source.stateKey, ruleKey: source.ruleKey, passiveSkillId: source.passiveSkillId, rawExecutionTimingType: source.rawExecutionTimingType, effectCount: source.effectCount, calculationOperation: source.calculationOperation, executionTiming, independentDimensions: source.independentDimensions, provenance };
    });
    const explicitWhenAttackingEffectCount = options.current.states.flatMap(state => state.passive?.rules ?? []).flatMap(rule => rule.effects ?? []).filter(effect => effect.activationTiming?.moment === "when_attacking").length;
    return {
        schemaVersion: 1, contract: "dokkan-team-analysis-player-attack-setup-timing-experiment", contractVersion: "0.32.0", generatedAt: options.db32.generatedAt,
        sourceSnapshotVersion: options.db32.sourceSnapshotVersion, sourceDatabaseSha256: options.db32.sourceDatabaseSha256,
        sourceDb32: { fileName: "team-analysis-db32-execution-timing.json.gz", sha256: options.db32Sha256, contractVersion: "0.31.0" },
        currentTeamAnalysis: { fileName: "team-analysis.json.gz", sha256: options.currentSha256 },
        nativeRuntime: { fileName: "libcocos2dcpp.so", sha256: options.nativeSha256, sizeBytes: options.nativeSizeBytes },
        nativeEvidence: { fileName: "native-execution-timing-value-4-semantics.json", sha256: options.evidenceSha256 },
        inheritedSemanticPromotionCount: 9, semanticPromotionCount: 1, ruleTimings,
        legacyComparison: { explicitWhenAttackingEffectCount, directlyComparableRuleCount: 0, confirmedConflictCount: 0, boundary: "aggregate_only_no_first_party_rule_identity_and_no_label_equivalence" },
    };
}
exports.buildDatabaseTeamAnalysisDb33Dataset = buildDatabaseTeamAnalysisDb33Dataset;
function counts(values) { const result = {}; for (const value of values) {
    const key = String(value);
    result[key] = (result[key] ?? 0) + 1;
} return Object.fromEntries(Object.entries(result).sort(([a], [b]) => a.localeCompare(b, "en", { numeric: true }))); }
function buildDatabaseTeamAnalysisDb33Coverage(dataset) {
    const supported = dataset.ruleTimings.filter(value => value.executionTiming.status === "supported");
    const newlySupported = dataset.ruleTimings.filter(value => value.executionTiming.status === "supported" && value.executionTiming.event === "player_attack_setup");
    return {
        schemaVersion: 1, ruleCount: dataset.ruleTimings.length, effectCount: dataset.ruleTimings.reduce((sum, value) => sum + value.effectCount, 0), passiveSkillCount: new Set(dataset.ruleTimings.map(value => value.passiveSkillId)).size, affectedStateCount: new Set(dataset.ruleTimings.map(value => value.stateKey)).size,
        supportedRuleCount: supported.length, supportedEffectCount: supported.reduce((sum, value) => sum + value.effectCount, 0), supportedPassiveSkillCount: new Set(supported.map(value => value.passiveSkillId)).size, supportedStateCount: new Set(supported.map(value => value.stateKey)).size,
        newlySupportedRuleCount: newlySupported.length, newlySupportedEffectCount: newlySupported.reduce((sum, value) => sum + value.effectCount, 0), newlySupportedPassiveSkillCount: new Set(newlySupported.map(value => value.passiveSkillId)).size, newlySupportedStateCount: new Set(newlySupported.map(value => value.stateKey)).size,
        unknownRuleCount: dataset.ruleTimings.length - supported.length, rawTimingCounts: counts(dataset.ruleTimings.map(value => value.rawExecutionTimingType)), explicitLegacyWhenAttackingEffectCount: dataset.legacyComparison.explicitWhenAttackingEffectCount,
        inheritedSemanticPromotionCount: 9, semanticPromotionCount: 1,
    };
}
exports.buildDatabaseTeamAnalysisDb33Coverage = buildDatabaseTeamAnalysisDb33Coverage;
//# sourceMappingURL=team-analysis-db33-builder.js.map