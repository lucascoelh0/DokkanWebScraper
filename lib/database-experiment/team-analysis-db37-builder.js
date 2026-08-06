"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildDatabaseTeamAnalysisDb37Coverage = exports.buildDatabaseTeamAnalysisDb37Dataset = exports.projectDb37Duration = exports.projectDb37OnceOnly = void 0;
const crypto_1 = require("crypto");
const DB36_SHA = "f94c117e69464b83cf4ba4cb00578bcd4e52539b9116cf6158907f39a1d3bfcb";
const DB20_SHA = "6ceed5b54c5c21089d60751a96d80aa10963a5a03cde749d5210a1083e401e01";
const SOURCE_SHA = "3654eb7db9e18dfe4c238abd02bcc06a688ffa6f30aa1ad93fd108dcfeb78265";
const sha256 = (value) => (0, crypto_1.createHash)("sha256").update(value).digest("hex");
const id = (value) => value === null || value === undefined ? undefined : String(value);
const integer = (value) => typeof value === "number" && Number.isSafeInteger(value) && value >= -2147483648 && value <= 2147483647
    ? value
    : typeof value === "string" && value.trim() !== "" && Number.isSafeInteger(Number(value)) && Number(value) >= -2147483648 && Number(value) <= 2147483647 ? Number(value) : undefined;
const EXPECTED_REGIONS = {
    passive_skill_row_constructor: ["_ZN12PassiveSkillC1EPN7SQLite33RowE", 46449820, 2248, "7cec861db0b338c586868fc49b008da0c08950d1f5656fceebf2dd1acea5843e"],
    create_passive_skill: ["_ZN14AbilityManager18createPassiveSkillEiiNSt6__ndk110shared_ptrI15PassiveSkillSetEE", 64383460, 1524, "b56f963ad641d1d9e67027199b0529fb56cf7039b5dc206209eb359a9bb2d04d"],
    status_causality_constructor: ["_ZN22AbilityStatusCausalityC2EP28CreateAbilityStatusCausality", 64484464, 284, "a124f4b274a60436dba01bf70971c096e1981ed4b498a7671c7cd8a288e8f85f"],
    get_is_once: ["_ZNK21AbilityStatusEfficacy9getIsOnceEv", 64480352, 8, "99e95b2d624118baf7db5d5e8af7351227463c455833d39b4656589df43e1c0c"],
    set_is_once: ["_ZN21AbilityStatusEfficacy9setIsOnceEb", 64480360, 8, "981ec03e626e5b8f5c95a18586d7ab3ece53c36df015d06c93eb8eb8c19850ff"],
    once_viability_gate: ["_ZNK22AbilityStatusCausality8isViableEv", 64485156, 64, "01abf94a16ab9f174c1858d070036f53c5aaa40a5f94e3f670ecc6e43c4e3853"],
    draw_lots: ["_ZN22AbilityStatusCausality8drawLotsEv", 64484828, 64, "9b6a84a572403b3bed147c2c6b2c8fe2cfc21e8679565593eafa5b5bde03491c"],
    exec_causality_conditions: ["_ZN22AbilityStatusCausality23execCausalityConditionsEv", 64484900, 256, "a15efe19275a3d7a4abd41b6b922bc76d18af8d999bcdb3f855f801cc1f7075b"],
    successful_execution: ["_ZN22AbilityStatusCausality4execEv", 64485444, 380, "d0f2551f2910791a0154f249c507a6a6530f74c625282b4727bfe1630e627596"],
    get_exec_count: ["_ZNK22AbilityStatusCausality12getExecCountEv", 64480408, 8, "b7e245f31c286c4f19d085b57c1282c8f764d4a82d98d45e05500925c9991033"],
    set_exec_count: ["_ZN22AbilityStatusCausality12setExecCountEi", 64480416, 8, "27382928501c013ddaab9c668a8e8f6fbc11e1d8ec77d15dab2def8f491c422e"],
    increment_exec_count: ["_ZN22AbilityStatusCausality18incrementExecCountEv", 64486788, 24, "405403512f77c39d207e5fad8fc3e9947223761e5766d09b785e3e02d4debf4e"],
    update_turn: ["_ZN22AbilityStatusCausality10updateTurnEv", 64486828, 336, "6b99feffce760378248812d37b5b6bf300979689d2c410e20814ebcb5cd2dfcf"],
    update_turn_internal: ["_ZN22AbilityStatusCausality18updateTurnInternalEv", 64487164, 60, "ea41a5069cad70938484a226984a1f105c645f216d9a297387670053b80562e7"],
    is_end_turn: ["_ZN22AbilityStatusCausality9isEndTurnEv", 64487488, 16, "5477e554513a5989dd0256e899f3e99407c158031b8b34b152e1093fc970c3cc"],
    ability_manager_end_turn: ["_ZN14AbilityManager7endTurnEv", 64406968, 280, "8aefd5c41527567ff425f9fa678317544d77fe6f088da523a0efa9e9c1478ed8"],
    clear_exec_count: ["_ZN14AbilityManager14clearExecCountEv", 64440520, 128, "2b60281189f73b7d1422a9fc07bdf50205a4c18f7a56355d2febaa3bb8e8dcfb"],
    reset_executed_this_turn: ["_ZN14AbilityManager34resetAbilityStatusExecutedThisTurnEv", 64369612, 108, "516e2ba62feda3eb9c13a9f2f5293f9eda1d0965f44367545618bc05691660b5"],
    update_all_status_turns: ["_ZN14AbilityManager23updateAbilityStatusTurnEv", 64369552, 60, "a499a016c854ab60b7a92c04aa532a7534631e888e01cc417ff454d239d0de20"],
    availability_reactivation_gate: ["_ZN14AbilityManager25setAvailableAbilityStatusEi17SkillCategoryType9SkillTypeib", 64420644, 536, "0dd36bbb8b380dd75bf5cb93579790b70b1b579e1454127d9025c3b3c6f535ae"],
};
const EXPECTED_UNKNOWNS = ["clear_exec_count_trigger_and_epoch", "all_status_removal_paths", "cross_status_recurrence", "stacking", "calculation_bucket", "timing", "target", "unit"];
const EXPECTED_SQLITE_BINDING = { table: "passive_skills", turn: { column: "turn", passiveSkillOffset: 76, createStatusOffset: 176 }, isOnce: { column: "is_once", rowNormalization: "nonzero_to_true", passiveSkillOffset: 80, createStatusOffset: 180 } };
const EXPECTED_RUNTIME_STORAGE = { isOnceOffset: 284, currentTurnOffset: 352, maximumTurnOffset: 356, internalTurnGateOffset: 360, execCountOffset: 364, executedThisTurnOffset: 368 };
const EXPECTED_ONCE_ONLY = { viabilityExpression: "is_once == 0 || exec_count < 1", successfulExecMutation: "executed_this_turn = true; exec_count += 1", parametersRead: ["is_once", "exec_count"], parametersIgnored: ["turn", "exec_timing_type", "target_type", "calc_option"], return: "boolean viability gate composed after independent status and availability gates" };
const EXPECTED_DURATION = { constructor: "current_turn = maximum_turn = raw turn", successfulExecMutation: "current_turn = maximum_turn", endTurnMutation: "after active, available and internal-turn gates, raw -1 bypasses decrement; otherwise decrement one, clamp to zero and deactivate when result <= 0", isEndTurnExpression: "current_turn < 1", parametersRead: ["current_turn", "maximum_turn", "status", "available", "internal_turn_gate"], parametersIgnored: ["is_once", "exec_count", "exec_timing_type", "target_type", "calc_option"] };
const EXPECTED_EXECUTED_THIS_TURN = { successfulExecMutation: "set true", endTurnMutation: "set false after updateTurn loop", independentFromExecCount: true };
const EXPECTED_RESET_BOUNDARY = { clearExecCountOperation: "set every status exec_count to zero", trigger: "unknown", boundedStaticCallerAudit: "no direct caller established in this DSO; dynamic or external dispatch remains possible", executedThisTurnResetIsNotExecCountReset: true };
const EXPECTED_VTABLE = {
    symbol: "_ZTV22AbilityStatusCausality", vma: 92058432, sizeBytes: 360, rawSha256: "d3df611a0ed2e328b050d285287637c60643ba96ec09e4aaefaad7f2cd114b77",
    relocations: [
        { offset: 232, symbol: "_ZNK21AbilityStatusEfficacy9getIsOnceEv" }, { offset: 240, symbol: "_ZN21AbilityStatusEfficacy9setIsOnceEb" },
        { offset: 264, symbol: "_ZN22AbilityStatusCausality10updateTurnEv" }, { offset: 272, symbol: "_ZNK22AbilityStatusCausality7getTurnEv" },
        { offset: 288, symbol: "_ZN22AbilityStatusCausality23execCausalityConditionsEv" }, { offset: 296, symbol: "_ZN22AbilityStatusCausality4execEv" },
        { offset: 304, symbol: "_ZNK22AbilityStatusCausality8isViableEv" }, { offset: 320, symbol: "_ZN22AbilityStatusCausality8drawLotsEv" },
        { offset: 328, symbol: "_ZNK22AbilityStatusCausality12getExecCountEv" }, { offset: 336, symbol: "_ZN22AbilityStatusCausality12setExecCountEi" },
    ],
};
function validateEvidence(inspection, evidence, nativeSha256) {
    if (evidence.schemaVersion !== 1 || evidence.sourceSha256 !== nativeSha256 || evidence.auditScope !== "passive-skill-turn-is-once-sqlite-runtime-lifecycle")
        throw new Error("DB37 evidence identity mismatch");
    if (JSON.stringify(evidence.sqliteBinding) !== JSON.stringify(EXPECTED_SQLITE_BINDING) || JSON.stringify(evidence.runtimeStorage) !== JSON.stringify(EXPECTED_RUNTIME_STORAGE) || JSON.stringify(evidence.onceOnly) !== JSON.stringify(EXPECTED_ONCE_ONLY) || JSON.stringify(evidence.duration) !== JSON.stringify(EXPECTED_DURATION) || JSON.stringify(evidence.executedThisTurn) !== JSON.stringify(EXPECTED_EXECUTED_THIS_TURN) || JSON.stringify(evidence.resetBoundary) !== JSON.stringify(EXPECTED_RESET_BOUNDARY) || JSON.stringify(evidence.vtable) !== JSON.stringify(EXPECTED_VTABLE) || JSON.stringify(evidence.unknowns) !== JSON.stringify(EXPECTED_UNKNOWNS))
        throw new Error("DB37 evidence boundary mismatch");
    const roles = new Set(evidence.codeRegions.map(region => region.role));
    if (roles.size !== evidence.codeRegions.length || roles.size !== Object.keys(EXPECTED_REGIONS).length)
        throw new Error("DB37 evidence role cardinality mismatch");
    for (const region of evidence.codeRegions) {
        const expected = EXPECTED_REGIONS[region.role];
        if (!expected || JSON.stringify([region.symbol, region.vma, region.sizeBytes, region.codeSha256]) !== JSON.stringify(expected))
            throw new Error(`DB37 evidence role mismatch ${region.role}`);
        const symbol = inspection.symbols.find(value => value.name === region.symbol);
        if (!symbol || symbol.value !== region.vma || symbol.size !== region.sizeBytes || sha256(inspection.readVirtualBytes(region.vma, region.sizeBytes)) !== region.codeSha256)
            throw new Error(`DB37 native code mismatch ${region.role}`);
    }
    const vtable = inspection.symbols.find(value => value.name === evidence.vtable.symbol);
    if (!vtable || vtable.value !== evidence.vtable.vma || vtable.size !== evidence.vtable.sizeBytes || sha256(inspection.readVirtualBytes(vtable.value, vtable.size)) !== evidence.vtable.rawSha256)
        throw new Error("DB37 vtable identity mismatch");
    for (const relocation of evidence.vtable.relocations)
        if (inspection.relocations.filter(value => value.offset === evidence.vtable.vma + relocation.offset && value.symbolName === relocation.symbol).length !== 1)
            throw new Error(`DB37 vtable relocation mismatch ${relocation.symbol}`);
}
function projectDb37OnceOnly(rawIsOnce) {
    const raw = integer(rawIsOnce);
    if (raw === undefined)
        return { status: "unknown", rawIsOnce: rawIsOnce, normalizedIsOnce: null, enabled: null, viabilityPredicate: "unknown", successfulExecutionMutation: "unknown", execCountReset: { operation: "unknown", trigger: "unknown" } };
    const enabled = raw !== 0;
    return { status: "supported", rawIsOnce: rawIsOnce, normalizedIsOnce: enabled ? 1 : 0, enabled, viabilityPredicate: enabled ? "exec_count_less_than_1" : "no_additional_is_once_gate", successfulExecutionMutation: enabled ? "increment_exec_count" : "independent", execCountReset: { operation: "set_zero", trigger: "unknown" } };
}
exports.projectDb37OnceOnly = projectDb37OnceOnly;
function projectDb37Duration(rawTurn) {
    const raw = integer(rawTurn);
    if (raw === undefined || raw < -1)
        return { status: "unknown", rawTurn: rawTurn, initialCurrentTurn: null, maximumTurn: null, successfulExecutionMutation: "unknown", endTurnMutation: "unknown", endTurnPredicate: "unknown" };
    if (raw === -1)
        return { status: "partial", rawTurn: rawTurn, initialCurrentTurn: -1, maximumTurn: -1, successfulExecutionMutation: "current_turn_equals_maximum_turn", endTurnMutation: "sentinel_minus_one_not_decremented_when_update_eligible", endTurnPredicate: "current_turn_less_than_1" };
    return { status: "supported", rawTurn: rawTurn, initialCurrentTurn: raw, maximumTurn: raw, successfulExecutionMutation: "current_turn_equals_maximum_turn", endTurnMutation: "decrement_one_then_deactivate_at_nonpositive_when_update_eligible", endTurnPredicate: "current_turn_less_than_1" };
}
exports.projectDb37Duration = projectDb37Duration;
function buildDatabaseTeamAnalysisDb37Dataset(options) {
    if (options.db36.contractVersion !== "0.35.0" || options.db36Sha256 !== DB36_SHA || options.db20.contractVersion !== "0.19.0" || options.db20Sha256 !== DB20_SHA || options.db20.sourceDatabaseSha256 !== SOURCE_SHA || options.db36.sourceDatabaseSha256 !== SOURCE_SHA || options.db20.generatedAt !== options.db36.generatedAt || options.db20.sourceSnapshotVersion !== options.db36.sourceSnapshotVersion || options.db36.nativeRuntime.sha256 !== options.nativeSha256)
        throw new Error("DB37 lineage mismatch");
    validateEvidence(options.inspection, options.evidence, options.nativeSha256);
    const passiveRows = new Map((options.tables.passive_skills ?? []).map(row => [id(row.id), row]));
    const proofRoles = options.evidence.codeRegions.map(region => region.role);
    const ruleLifecycles = options.db36.ruleSubTargets.map(rule => {
        const row = passiveRows.get(rule.passiveSkillId);
        if (!row)
            throw new Error(`DB37 passive row missing ${rule.passiveSkillId}`);
        const onceOnly = projectDb37OnceOnly(row.is_once), duration = projectDb37Duration(row.turn);
        return {
            stateKey: rule.stateKey, ruleKey: rule.ruleKey, passiveSkillId: rule.passiveSkillId, effectCount: rule.effectCount,
            simulationStatus: onceOnly.status === "unknown" || duration.status === "unknown" ? "unknown" : "partial",
            onceOnly, duration,
            executedThisTurn: { status: "supported", successfulExecutionMutation: "set_true", endTurnMutation: "set_false", independentFromExecCount: true },
            independentDimensions: { condition: "independent", target: "inherited_db36", timing: "independent", operation: "independent", unit: "independent", calculationBucket: "independent", recurrence: "partial", stacking: "unknown" },
            provenance: { database: { table: "passive_skills", rowId: rule.passiveSkillId, columns: ["turn", "is_once"] }, runtime: { fileName: "libcocos2dcpp.so", sha256: options.nativeSha256, evidenceFile: "native-passive-lifecycle-semantics.json", evidenceSha256: options.evidenceSha256, proofRoles } },
        };
    });
    const numericallyEqual = options.db20.correlations.filter(value => value.correlationStatus === "exact_numeric_match").length, numericallyDifferent = options.db20.correlations.filter(value => value.correlationStatus === "numeric_mismatch").length;
    return { schemaVersion: 1, contract: "dokkan-team-analysis-passive-lifecycle-native-semantics-experiment", contractVersion: "0.36.0", generatedAt: options.db36.generatedAt, sourceSnapshotVersion: options.db36.sourceSnapshotVersion, sourceDatabaseSha256: options.db36.sourceDatabaseSha256, sourceDb36: { fileName: "team-analysis-db36-sub-target-semantics.json.gz", sha256: options.db36Sha256, contractVersion: "0.35.0" }, sourceDb20: { fileName: "team-analysis-db20-passive-turn-correlation.json.gz", sha256: options.db20Sha256, contractVersion: "0.19.0" }, nativeRuntime: { fileName: "libcocos2dcpp.so", sha256: options.nativeSha256, sizeBytes: options.nativeSizeBytes }, nativeEvidence: { fileName: "native-passive-lifecycle-semantics.json", sha256: options.evidenceSha256 }, inheritedSemanticPromotionCount: 29, semanticPromotionCount: 2, legacyComparison: { alignedAppearanceTurnCandidates: options.db20.correlations.length, numericallyEqual, numericallyDifferent, semanticAgreementCount: 0, confirmedBehaviorConflictCount: 0, classification: "independent_runtime_dimensions_not_directly_comparable" }, ruleLifecycles };
}
exports.buildDatabaseTeamAnalysisDb37Dataset = buildDatabaseTeamAnalysisDb37Dataset;
function distribution(items, selector, effects = false) {
    const output = {};
    for (const item of items) {
        const key = String(selector(item));
        output[key] = (output[key] ?? 0) + (effects ? item.effectCount : 1);
    }
    return Object.fromEntries(Object.entries(output).sort(([left], [right]) => Number(left) - Number(right)));
}
function buildDatabaseTeamAnalysisDb37Coverage(dataset) {
    const once = dataset.ruleLifecycles.filter(rule => rule.onceOnly.enabled === true);
    return { schemaVersion: 1, ruleCount: dataset.ruleLifecycles.length, effectCount: dataset.ruleLifecycles.reduce((sum, rule) => sum + rule.effectCount, 0), affectedStateCount: new Set(dataset.ruleLifecycles.map(rule => rule.stateKey)).size, passiveSkillCount: new Set(dataset.ruleLifecycles.map(rule => rule.passiveSkillId)).size, fieldSupportedRuleCount: dataset.ruleLifecycles.filter(rule => rule.onceOnly.status === "supported" && rule.duration.status === "supported").length, simulationPartialRuleCount: dataset.ruleLifecycles.filter(rule => rule.simulationStatus === "partial").length, simulationUnknownRuleCount: dataset.ruleLifecycles.filter(rule => rule.simulationStatus === "unknown").length, onceOnlyEnabledRuleCount: once.length, onceOnlyEnabledEffectCount: once.reduce((sum, rule) => sum + rule.effectCount, 0), onceOnlyEnabledStateCount: new Set(once.map(rule => rule.stateKey)).size, ruleCountsByRawIsOnce: distribution(dataset.ruleLifecycles, rule => rule.onceOnly.rawIsOnce), effectCountsByRawIsOnce: distribution(dataset.ruleLifecycles, rule => rule.onceOnly.rawIsOnce, true), ruleCountsByRawTurn: distribution(dataset.ruleLifecycles, rule => rule.duration.rawTurn), effectCountsByRawTurn: distribution(dataset.ruleLifecycles, rule => rule.duration.rawTurn, true), inheritedSemanticPromotionCount: 29, semanticPromotionCount: 2 };
}
exports.buildDatabaseTeamAnalysisDb37Coverage = buildDatabaseTeamAnalysisDb37Coverage;
//# sourceMappingURL=team-analysis-db37-builder.js.map