"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildDatabaseTeamAnalysisDb47Coverage = exports.buildDatabaseTeamAnalysisDb47Dataset = exports.validateDb47Evidence = exports.projectDb47Timing = void 0;
const crypto_1 = require("crypto");
const DB46_SHA = "6bc13b29197a5fcbca6d52f484377a0bd65cf48d4750a4604461f64f2bd6f837";
const REGIONS = [
    { role: "execution_filter", symbol: "_ZN14AbilityManager21callAbilityStatusExecEi17SkillCategoryType19SkillExecTimingType9SkillTypeN13AbilityStatus14AddtionalParamE", vma: 64372436, sizeBytes: 1068, codeSha256: "e479bd26a683eef5f1a8a035c4c99e83cd4e4a1de0ab4a716f5842df7e8aa707" },
    { role: "timing_owner", symbol: "_ZN28AcquiredEnergyBallController21callAbilityStatusExecEv", vma: 48218256, sizeBytes: 452, codeSha256: "c2a45117e6a5085fa5186c4b6f394edc2f5a1cbcec268df3d33ea6ae097b0fc8" },
    { role: "move_end_caller", symbol: "_ZN16DPuzzleGameLayer21onPuzzleAttackMoveEndEv", vma: 47653552, sizeBytes: 928, codeSha256: "47065a64361f751c5e5d4c49bb90b2c63025ac780f04782bbb7c614feb6447a5" },
    { role: "controller_virtual_callback_handler", symbol: "_ZN28AcquiredEnergyBallController18playBallAnimationsEPN7cocos2d5LayerE", vma: 48218708, sizeBytes: 856, codeSha256: "feca82becb01a8cac38afa4f36a7e0ef08fe095ad30cb69da008d61a4907f8db" },
];
const EVENT = { raw: 15, name: "puzzle_attack_move_end_after_controller_callback", sequence: "on_puzzle_attack_move_end_after_calc_absorb_ball_value_and_controller_virtual_callback_before_footer_and_remaining_charge_updates", categoryRaw: 0, skillTypeRaw: 2, deckIndexSource: "current_character_runtime_deck_index", instructions: [
        { role: "ball_value_calculation_call", vma: 47653596, hex: "4dad9b94" },
        { role: "controller_vtable_load", vma: 47653608, hex: "080040f9" },
        { role: "controller_vtable_slot_load", vma: 47653612, hex: "080940f9" },
        { role: "controller_virtual_callback_call", vma: 47653616, hex: "00013fd6" },
        { role: "timing_owner_call", vma: 47653624, hex: "4aad9b94" },
        { role: "timing_literal", vma: 48218488, hex: "e3018052" },
        { role: "skill_type_literal", vma: 48218492, hex: "44008052" },
        { role: "execution_filter_call", vma: 48218496, hex: "b8709a94" },
    ] };
const DIRECT_CALLS = [
    { role: "ball_value_calculation_call", callVma: 47653596, callHex: "4dad9b94", pltVma: 88463376, pltHex: "503300f0115a45f910c22a9120021fd6", relocation: { offset: 95193776, type: 1026, symbol: "_ZN28AcquiredEnergyBallController19calcAbsorbBallValueEv", symbolValue: 48217016, addend: 0 } },
    { role: "timing_owner_call", callVma: 47653624, callHex: "4aad9b94", pltVma: 88463392, pltHex: "503300f0115e45f910e22a9120021fd6", relocation: { offset: 95193784, type: 1026, symbol: "_ZN28AcquiredEnergyBallController21callAbilityStatusExecEv", symbolValue: 48218256, addend: 0 } },
    { role: "execution_filter_call", callVma: 48218496, callHex: "b8709a94", pltVma: 88704096, pltHex: "703200d0116e40f91062039120021fd6", relocation: { offset: 95314136, type: 1026, symbol: "_ZN14AbilityManager21callAbilityStatusExecEi17SkillCategoryType19SkillExecTimingType9SkillTypeN13AbilityStatus14AddtionalParamE", symbolValue: 64372436, addend: 0 } },
];
const VIRTUAL_CALL = { callVma: 47653616, callHex: "00013fd6", vptrSlotOffset: 16, vtable: { symbol: "_ZTV28AcquiredEnergyBallController", vma: 89410432, sizeBytes: 40, rawSha256: "2c34ce1df23b838c5abf2a7f6437cca3d3067ed509ff25f11df6b11b582b51eb" }, relocation: { offset: 89410464, type: 257, symbol: "_ZN28AcquiredEnergyBallController18playBallAnimationsEPN7cocos2d5LayerE", symbolValue: 48218708, addend: 0 } };
const DOES = ["damage_calculation_bucket", "attack_executed", "attack_landed", "hp_applied", "ball_type_identity", "animation_completion", "duration", "recurrence", "stacking"];
const UNKNOWNS = ["controller_virtual_callback_effects", "ball_value_unit_and_population", "probability_order", "status_reset_and_expiry"];
const hash = (bytes) => (0, crypto_1.createHash)("sha256").update(bytes).digest("hex");
const integer = (value) => { const parsed = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : NaN; return Number.isSafeInteger(parsed) ? parsed : undefined; };
const branchTarget = (bytes, vma) => { const word = bytes.readUInt32LE(); if (word >>> 26 !== 37)
    return null; let immediate = word & 0x3ffffff; if (immediate & 0x2000000)
    immediate -= 0x4000000; return vma + immediate * 4; };
function projectDb47Timing(value) { return integer(value) === 15 ? { status: "supported", event: EVENT.name, sequence: EVENT.sequence } : null; }
exports.projectDb47Timing = projectDb47Timing;
function validateDb47Evidence(inspection, evidence, nativeSha256) {
    if (evidence.schemaVersion !== 1 || evidence.sourceSha256 !== nativeSha256 || evidence.auditScope !== "execution-timing-15-puzzle-attack-move-end" || JSON.stringify(evidence.regions) !== JSON.stringify(REGIONS) || JSON.stringify(evidence.event) !== JSON.stringify(EVENT) || JSON.stringify(evidence.directCalls) !== JSON.stringify(DIRECT_CALLS) || JSON.stringify(evidence.virtualCall) !== JSON.stringify(VIRTUAL_CALL) || JSON.stringify(evidence.doesNotImply) !== JSON.stringify(DOES) || JSON.stringify(evidence.unknowns) !== JSON.stringify(UNKNOWNS))
        throw Error("DB47 evidence identity");
    for (const region of REGIONS) {
        const symbol = inspection.symbols.find(value => value.name === region.symbol);
        const bytes = inspection.readVirtualBytes(region.vma, region.sizeBytes);
        if (!symbol || symbol.value !== region.vma || symbol.size !== region.sizeBytes || hash(bytes) !== region.codeSha256)
            throw Error("DB47 code region");
    }
    for (const instruction of EVENT.instructions)
        if (inspection.readVirtualBytes(instruction.vma, 4).toString("hex") !== instruction.hex)
            throw Error("DB47 instruction");
    for (const call of DIRECT_CALLS) {
        if (branchTarget(inspection.readVirtualBytes(call.callVma, 4), call.callVma) !== call.pltVma || inspection.readVirtualBytes(call.pltVma, 16).toString("hex") !== call.pltHex)
            throw Error("DB47 direct call");
        const relocations = inspection.relocations.filter(value => value.offset === call.relocation.offset);
        if (relocations.length !== 1 || JSON.stringify(relocations[0]) !== JSON.stringify({ offset: call.relocation.offset, type: call.relocation.type, symbolName: call.relocation.symbol, symbolValue: call.relocation.symbolValue, addend: call.relocation.addend }))
            throw Error("DB47 direct call relocation");
    }
    if (inspection.readVirtualBytes(VIRTUAL_CALL.callVma, 4).toString("hex") !== VIRTUAL_CALL.callHex)
        throw Error("DB47 virtual call");
    const vtable = inspection.symbols.find(value => value.name === VIRTUAL_CALL.vtable.symbol);
    if (!vtable || vtable.value !== VIRTUAL_CALL.vtable.vma || vtable.size !== VIRTUAL_CALL.vtable.sizeBytes || hash(inspection.readVirtualBytes(vtable.value, vtable.size)) !== VIRTUAL_CALL.vtable.rawSha256)
        throw Error("DB47 virtual call vtable");
    const virtualRelocations = inspection.relocations.filter(value => value.offset === VIRTUAL_CALL.relocation.offset);
    if (VIRTUAL_CALL.relocation.offset !== VIRTUAL_CALL.vtable.vma + 16 + VIRTUAL_CALL.vptrSlotOffset || virtualRelocations.length !== 1 || JSON.stringify(virtualRelocations[0]) !== JSON.stringify({ offset: VIRTUAL_CALL.relocation.offset, type: VIRTUAL_CALL.relocation.type, symbolName: VIRTUAL_CALL.relocation.symbol, symbolValue: VIRTUAL_CALL.relocation.symbolValue, addend: VIRTUAL_CALL.relocation.addend }))
        throw Error("DB47 virtual call relocation");
}
exports.validateDb47Evidence = validateDb47Evidence;
function buildDatabaseTeamAnalysisDb47Dataset(source, sourceSha256, inspection, nativeSha256, nativeSizeBytes, evidence, evidenceSha256) {
    if (source.contractVersion !== "0.45.0" || sourceSha256 !== DB46_SHA)
        throw Error("DB47 lineage");
    validateDb47Evidence(inspection, evidence, nativeSha256);
    const ruleTimings = source.ruleTimings.map(value => { const projection = projectDb47Timing(value.rawExecutionTimingType); return projection ? { ...value, executionTiming: projection, provenance: { database: value.provenance.database, runtime: { fileName: "libcocos2dcpp.so", sha256: nativeSha256, evidenceFile: "native-puzzle-move-end-timing-semantics.json", evidenceSha256, proofRoles: REGIONS.map(region => region.role) } } } : value; });
    return { schemaVersion: 1, contract: "dokkan-team-analysis-puzzle-move-end-timing-native-semantics-experiment", contractVersion: "0.46.0", generatedAt: source.generatedAt, sourceSnapshotVersion: source.sourceSnapshotVersion, sourceDatabaseSha256: source.sourceDatabaseSha256, sourceDb46: { fileName: "team-analysis-db46-enemy-attack-timing.json.gz", sha256: sourceSha256, contractVersion: "0.45.0" }, nativeRuntime: { fileName: "libcocos2dcpp.so", sha256: nativeSha256, sizeBytes: nativeSizeBytes }, nativeEvidence: { fileName: "native-puzzle-move-end-timing-semantics.json", sha256: evidenceSha256 }, inheritedSemanticPromotionCount: 60, semanticPromotionCount: 1, ruleTimings };
}
exports.buildDatabaseTeamAnalysisDb47Dataset = buildDatabaseTeamAnalysisDb47Dataset;
function buildDatabaseTeamAnalysisDb47Coverage(dataset) { const newlySupported = dataset.ruleTimings.filter(value => integer(value.rawExecutionTimingType) === 15); const supported = dataset.ruleTimings.filter(value => value.executionTiming.status === "supported"); return { schemaVersion: 1, ruleCount: dataset.ruleTimings.length, effectCount: dataset.ruleTimings.reduce((sum, value) => sum + value.effectCount, 0), supportedBefore: supported.length - newlySupported.length, supportedAfter: supported.length, newlySupportedRuleCount: newlySupported.length, newlySupportedEffectCount: newlySupported.reduce((sum, value) => sum + value.effectCount, 0), newlySupportedPassiveSkillCount: new Set(newlySupported.map(value => value.passiveSkillId)).size, newlySupportedStateCount: new Set(newlySupported.map(value => value.stateKey)).size, remainingUnknownRuleCount: dataset.ruleTimings.length - supported.length, inheritedSemanticPromotionCount: 60, semanticPromotionCount: 1 }; }
exports.buildDatabaseTeamAnalysisDb47Coverage = buildDatabaseTeamAnalysisDb47Coverage;
//# sourceMappingURL=team-analysis-db47-builder.js.map