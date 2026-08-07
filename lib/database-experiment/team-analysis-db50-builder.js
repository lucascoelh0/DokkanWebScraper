"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildDatabaseTeamAnalysisDb50Coverage = exports.buildDatabaseTeamAnalysisDb50Dataset = exports.validateDb50Evidence = exports.hasDb50PayloadIdentity = exports.hasDb50JoinIdentity = exports.doesDb50RateSetFlag = exports.applyDb50CounterResistance = exports.selectDb50Counter = exports.decodeDb50BlTarget = void 0;
const crypto_1 = require("crypto");
const SEMANTICS = {
    gate: { callChangeParamOffset: 4, registerOnlyWhenValue: 0, nonzeroBehavior: "skip_registration", fieldSemantic: "unknown" },
    selection: { filters: ["efficacy_type_equals_120", "deck_index_equals_input"], ranking: "highest_resist_damage_rate", tieBehavior: "first_in_efficacy_info_order", result: "optional_counter_behavior" },
    preference: { dodgeCandidateEfficacyType: 128, normalCandidateEfficacyType: 120, order: "dodge_then_normal", callerBooleanSemantic: "unknown", cannotAttackAndTriggerCounterGates: "preserved_raw_control_flow" },
    damage: { bucket: "enemy_source_after_efficacy_13_before_defense_and_guard", formula: "pre_minus_trunc_toward_zero(pre_times_resist_damage_rate_div_100)", rateAbove99SetsFlag: true, finalHpApplication: "unknown" },
    unknowns: ["call_change_param_offset_4_product_semantic", "caller_boolean_semantic", "external_counter_activation_event", "type_128_sqlite_binding", "increase_damage_percent_consumer", "battle_script_behavior", "probability_application", "lifecycle_reset_expiry", "final_hp_application"],
};
const REGIONS = [
    ["counter_handler", "_ZN26AbilityEfficacyCounterFunc30callCounterAttackBehaviourFuncEPN19AbilityEfficacyCore15CallChangeParamE", 64285212, 188, "346883c472ae27ac5812d5708bab4c8568d77326b92a5d1ecb9ae44631fc04c9"],
    ["counter_choice", "_ZN15AbilityEfficacy15CounterBehavior24getCounterAttackBehaviorEib", 64259020, 204, "bc95d024e65f0c81f0df905f270522799e8714898f0b94c614313d6281cab049"],
    ["dodge_counter_choice", "_ZN15AbilityEfficacy15CounterBehavior29getDodgeCounterAttackBehaviorEib", 64259224, 164, "886caafaac82eae5d3f7d56edc8e64c4628c73c5dee6a002fb758da4bfea5b8e"],
    ["normal_counter_choice", "_ZN15AbilityEfficacy15CounterBehavior30getNormalCounterAttackBehaviorEi", 64259388, 236, "5787de3459a31c15de9ec9cd3d53aa2c2b1d157444741db458a0cbd1074d7052"],
    ["counter_resist_choice", "_ZN15AbilityEfficacy15CounterBehavior40getCounterAttackBehaviorResistDamageRateEib", 64259624, 204, "f76e3bdf3cd72767effed3849f29bc60985fc060948cfed444a8e533f51e4d19"],
    ["normal_counter_resist_choice", "_ZN15AbilityEfficacy15CounterBehavior46getNormalCounterAttackBehaviorResistDamageRateEi", 64259828, 576, "af6611063d50c1811ec69a7ab951d5b5712341ca5477e3b438c99fa14c56e883"],
    ["generic_type_deck_selector", "local@CounterBehavior+0x568", 64260404, 584, "452cac93c831cbaaac2ef51893292b5398c5467e648243af199a4aed3f00b967"],
    ["type120_filter_lambda", "local@CounterBehavior+0xacc", 64261784, 88, "54478786d934d83b66c9c82522005575a37c3783ffa66fee3cf97136f475af1a"],
    ["enemy_damage", "_ZN17DamageCalculation31calcIntermediateDamageFromEnemyEiiidbbNSt6__ndk110shared_ptrI4CardEEP15InGameCharaDataPN16InGameBattleInfo18InGameBattleRecordEbbbbNS0_8optionalIiEE", 48026384, 784, "732737e064b1a950a1eac739d88c895e94c8d8b5312e0a1ff4fe728d517c90c4"],
    ["enemy_attack_setup", "_ZN30EnemyAttackDamageAndActionBank5setupEP21DPuzzleGameControlleriiNSt6__ndk110shared_ptrIN15PuzzleEnemyData6ActionEEEPiibbRNS2_5queueIiNS2_5dequeIiNS2_9allocatorIiEEEEEERNS2_12basic_stringIcNS2_11char_traitsIcEENSA_IcEEEE", 48102712, 13200, "129865aa6bfc05c69f0998ba2d12c92eb41440f85d4c636c764cea27b74252aa"],
];
const CALLS = [
    ["enemy_damage_to_counter_resist_choice", 48026684, "75369b94", 88714768, "703200b011da42f910c2169120021fd6", 95319472, REGIONS[4][1], 64259624],
    ["enemy_setup_to_counter_choice", 48106796, "b9e89a94", 88715280, "70320090115a43f910c21a9120021fd6", 95319728, REGIONS[1][1], 64259020],
    ["choice_to_dodge", 64259064, "5e025e94", 88903024, "b03100d011b242f91082159120021fd6", 95413600, REGIONS[2][1], 64259224],
    ["choice_to_normal", 64259120, "54025e94", 88903040, "b03100d011b642f910a2159120021fd6", 95413608, REGIONS[3][1], 64259388],
    ["resist_choice_to_dodge", 64259668, "c7015e94", 88903024, "b03100d011b242f91082159120021fd6", 95413600, REGIONS[2][1], 64259224],
    ["resist_choice_to_normal", 64259724, "c1015e94", 88903056, "b03100d011ba42f910c2159120021fd6", 95413616, REGIONS[5][1], 64259828],
];
const sha256 = (value) => (0, crypto_1.createHash)("sha256").update(value).digest("hex");
const key = (value) => `${value.stateKey}|${value.ruleKey}`;
const decodeDb50BlTarget = (bytes, vma) => { const word = bytes.readUInt32LE(); if (word >>> 26 !== 37)
    return null; let immediate = word & 0x03ffffff; if (immediate & 0x02000000)
    immediate -= 0x04000000; return vma + immediate * 4; };
exports.decodeDb50BlTarget = decodeDb50BlTarget;
const selectDb50Counter = (values) => values.reduce((best, value) => best === null || value.resistDamageRate > best.resistDamageRate ? value : best, null);
exports.selectDb50Counter = selectDb50Counter;
const applyDb50CounterResistance = (preDamage, resistDamageRate) => preDamage - Math.trunc(preDamage * resistDamageRate / 100);
exports.applyDb50CounterResistance = applyDb50CounterResistance;
const doesDb50RateSetFlag = (resistDamageRate) => resistDamageRate > 99;
exports.doesDb50RateSetFlag = doesDb50RateSetFlag;
const hasDb50JoinIdentity = (passiveSkillId, effectCount, ...values) => values.every(value => value.passiveSkillId === passiveSkillId && value.effectCount === effectCount);
exports.hasDb50JoinIdentity = hasDb50JoinIdentity;
const hasDb50PayloadIdentity = (source) => source.efficacyType === 120 && [source.payload.resistDamageRate, source.payload.increaseDamagePercent, source.payload.battleScriptNo].every(field => field.status === "supported" && Number.isSafeInteger(field.runtimeInteger)) && source.payload.resistDamageRate.sqliteColumn === "eff_value1" && source.payload.resistDamageRate.nativeField === "resistDamageRate" && source.payload.increaseDamagePercent.sqliteColumn === "eff_value2" && source.payload.increaseDamagePercent.nativeField === "increaseDamagePercent" && source.payload.battleScriptNo.sqliteColumn === "eff_value3" && source.payload.battleScriptNo.nativeField === "battleScriptNo";
exports.hasDb50PayloadIdentity = hasDb50PayloadIdentity;
function validateDb50Evidence(inspection, evidence, nativeSha256) {
    if (evidence.schemaVersion !== 1 || evidence.sourceSha256 !== nativeSha256 || evidence.auditScope !== "efficacy-120-counter-selection-and-enemy-damage-resistance-consumer" || JSON.stringify(evidence.registrationGate) !== JSON.stringify(SEMANTICS.gate) || JSON.stringify(evidence.normalSelection) !== JSON.stringify(SEMANTICS.selection) || JSON.stringify(evidence.preference) !== JSON.stringify(SEMANTICS.preference) || JSON.stringify(evidence.damageConsumer) !== JSON.stringify(SEMANTICS.damage) || JSON.stringify(evidence.unknowns) !== JSON.stringify(SEMANTICS.unknowns))
        throw Error("DB50 evidence identity");
    const regions = REGIONS.map(([role, symbol, vma, sizeBytes, codeSha256]) => ({ role, symbol, vma, sizeBytes, codeSha256 }));
    const calls = CALLS.map(([role, callVma, callHex, pltVma, pltHex, offset, symbol, symbolValue]) => ({ role, callVma, callHex, pltVma, pltHex, relocation: { offset, type: 1026, symbol, symbolValue, addend: 0 } }));
    if (JSON.stringify(evidence.codeRegions) !== JSON.stringify(regions) || JSON.stringify(evidence.directCalls) !== JSON.stringify(calls))
        throw Error("DB50 evidence tuples");
    for (const region of evidence.codeRegions) {
        if (sha256(inspection.readVirtualBytes(region.vma, region.sizeBytes)) !== region.codeSha256)
            throw Error(`DB50 region ${region.role}`);
        if (!region.symbol.startsWith("local@")) {
            const symbol = inspection.symbols.find(value => value.name === region.symbol);
            if (!symbol || symbol.value !== region.vma || symbol.size !== region.sizeBytes)
                throw Error(`DB50 symbol ${region.role}`);
        }
    }
    for (const call of evidence.directCalls) {
        const callBytes = inspection.readVirtualBytes(call.callVma, 4);
        if (callBytes.toString("hex") !== call.callHex || (0, exports.decodeDb50BlTarget)(callBytes, call.callVma) !== call.pltVma || inspection.readVirtualBytes(call.pltVma, 16).toString("hex") !== call.pltHex || inspection.relocations.filter(value => value.offset === call.relocation.offset && value.type === call.relocation.type && value.symbolName === call.relocation.symbol && value.symbolValue === call.relocation.symbolValue && value.addend === call.relocation.addend).length !== 1)
            throw Error(`DB50 call ${call.role}`);
    }
}
exports.validateDb50Evidence = validateDb50Evidence;
function buildDatabaseTeamAnalysisDb50Dataset(options) {
    if (options.db24.contractVersion !== "0.23.0" || options.db35.contractVersion !== "0.34.0" || options.db47.contractVersion !== "0.46.0" || [options.db24.sourceDatabaseSha256, options.db35.sourceDatabaseSha256, options.db47.sourceDatabaseSha256].some(value => value !== options.db24.sourceDatabaseSha256) || [options.db24.nativeRuntime.sha256, options.db35.nativeRuntime.sha256, options.db47.nativeRuntime.sha256].some(value => value !== options.nativeSha256))
        throw Error("DB50 lineage");
    validateDb50Evidence(options.inspection, options.evidence, options.nativeSha256);
    const targets = new Map(options.db35.ruleTargets.map(value => [key(value), value]));
    const timings = new Map(options.db47.ruleTimings.map(value => [key(value), value]));
    const projections = options.db24.counterBehaviorResolutions.map(source => {
        const target = targets.get(key(source));
        const timing = timings.get(key(source));
        if (!(0, exports.hasDb50PayloadIdentity)(source))
            throw Error(`DB50 payload ${key(source)}`);
        if (!target || target.target.status !== "supported" || !timing || !(0, exports.hasDb50JoinIdentity)(source.passiveSkillId, target.effectCount, target, timing))
            throw Error(`DB50 join ${key(source)}`);
        return {
            stateKey: source.stateKey,
            ruleKey: source.ruleKey,
            passiveSkillId: source.passiveSkillId,
            efficacyType: 120,
            sourceEffectCount: target.effectCount,
            payload: source.payload,
            registrationGate: { status: "supported", callChangeParamOffset: 4, registerWhenZero: true, nonzeroBehavior: "skip_registration", fieldSemantic: "unknown" },
            target: { status: "supported", value: target.target.value },
            executionTiming: timing.executionTiming,
            selection: { status: "supported", filters: ["efficacy_type_120", "deck_index_input"], ranking: "highest_resist_damage_rate", tieBehavior: "first_in_efficacy_info_order", preference: "efficacy_128_dodge_then_efficacy_120_normal", callerBoolean: "unknown", externalActivation: "unknown" },
            damage: { status: "supported", bucket: "enemy_source_after_efficacy_13_before_defense_and_guard", formula: "pre_minus_trunc_toward_zero(pre_times_resist_damage_rate_div_100)", rateAbove99SetsFlag: true, finalHpApplication: "unknown" },
            rawActivation: source.activation,
            simulationStatus: "partial",
            provenance: { database: source.provenance.database, runtime: { fileName: "libcocos2dcpp.so", sha256: options.nativeSha256, evidenceFile: "native-counter-consumer-semantics.json", evidenceSha256: options.evidenceSha256, proofRoles: options.evidence.codeRegions.map(value => value.role) }, inherited: { db24Sha256: options.db24Sha256, db35Sha256: options.db35Sha256, db47Sha256: options.db47Sha256 } },
        };
    });
    return { schemaVersion: 1, contract: "dokkan-team-analysis-counter-consumer-native-semantics-experiment", contractVersion: "0.49.0", generatedAt: options.db47.generatedAt, sourceSnapshotVersion: options.db47.sourceSnapshotVersion, sourceDatabaseSha256: options.db47.sourceDatabaseSha256, sourceDb24: { fileName: "team-analysis-db24-counter-behavior.json.gz", sha256: options.db24Sha256, contractVersion: "0.23.0" }, sourceDb35: { fileName: "team-analysis-db35-target-dispatch.json.gz", sha256: options.db35Sha256, contractVersion: "0.34.0" }, sourceDb47: { fileName: "team-analysis-db47-puzzle-move-end-timing.json.gz", sha256: options.db47Sha256, contractVersion: "0.46.0" }, nativeRuntime: { fileName: "libcocos2dcpp.so", sha256: options.nativeSha256, sizeBytes: options.nativeSizeBytes }, nativeEvidence: { fileName: "native-counter-consumer-semantics.json", sha256: options.evidenceSha256 }, inheritedSemanticPromotionCount: 76, semanticPromotionCount: 6, projections };
}
exports.buildDatabaseTeamAnalysisDb50Dataset = buildDatabaseTeamAnalysisDb50Dataset;
const counts = (values) => {
    const result = {};
    for (const value of values)
        result[String(value)] = (result[String(value)] ?? 0) + 1;
    return Object.fromEntries(Object.entries(result).sort(([left], [right]) => left.localeCompare(right, "en", { numeric: true })));
};
function buildDatabaseTeamAnalysisDb50Coverage(dataset) {
    return { schemaVersion: 1, ruleCount: dataset.projections.length, affectedStateCount: new Set(dataset.projections.map(value => value.stateKey)).size, supportedPayloadFieldCount: dataset.projections.flatMap(value => Object.values(value.payload)).filter(value => value.status === "supported").length, supportedTargetCount: dataset.projections.filter(value => value.target.status === "supported").length, supportedTimingCount: dataset.projections.filter(value => value.executionTiming.status === "supported").length, supportedSelectionCount: dataset.projections.filter(value => value.selection.status === "supported").length, supportedDamageCount: dataset.projections.filter(value => value.damage.status === "supported").length, partialSimulationCount: dataset.projections.filter(value => value.simulationStatus === "partial").length, resistRateCounts: counts(dataset.projections.map(value => value.payload.resistDamageRate.runtimeInteger)), probabilityCounts: counts(dataset.projections.map(value => value.rawActivation.probability)), inheritedSemanticPromotionCount: 76, semanticPromotionCount: 6 };
}
exports.buildDatabaseTeamAnalysisDb50Coverage = buildDatabaseTeamAnalysisDb50Coverage;
//# sourceMappingURL=team-analysis-db50-builder.js.map