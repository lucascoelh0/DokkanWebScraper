"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CHARACTER_LEADER_TARGET_RUNTIME_BRIDGE_PIN = exports.CHARACTER_LEADER_TARGET_PIN = exports.CHARACTER_LEADER_TARGET_SEMANTICS_RSS_LIMIT_BYTES = exports.CHARACTER_LEADER_TARGET_SEMANTICS_REPORT_LIMIT_BYTES = exports.CHARACTER_LEADER_TARGET_SEMANTICS_CONTRACT_VERSION = void 0;
exports.CHARACTER_LEADER_TARGET_SEMANTICS_CONTRACT_VERSION = "1.0.0";
exports.CHARACTER_LEADER_TARGET_SEMANTICS_REPORT_LIMIT_BYTES = 64 * 1024;
exports.CHARACTER_LEADER_TARGET_SEMANTICS_RSS_LIMIT_BYTES = 1024 * 1024 * 1024;
exports.CHARACTER_LEADER_TARGET_PIN = {
    type82Rows: 3853, type82References: 12310, referencesWithSet: 9040, referencesWithoutSet: 3270,
    distinctNonzeroSets: 625, targetRows: 1588, targetOccurrences: 15988,
    includeCategoryRows: 883, excludeCategoryRows: 705, unsupportedTargetRows: 0,
    teamAlliesRows: 3788, superClassAlliesRows: 37, extremeClassAlliesRows: 28,
    targetDispatchEvidenceSha256: "287fbc7ca18787b6ac6f20cd785dac3c0188cf3efbb01a2d2ffd6974f8c825b5",
    targetDispatchEvidenceSizeBytes: 11444,
    subTargetEvidenceSha256: "48be3a3b33bdb3d13ce761eb268766c33daeb24e5fee02cb5d108251dbac1cca",
    subTargetEvidenceSizeBytes: 8323,
};
exports.CHARACTER_LEADER_TARGET_RUNTIME_BRIDGE_PIN = {
    codeRegions: [
        { role: "passive_status_factory", symbol: "_ZN20AbilityStatusPassive6createEP26CreateAbilityStatusPassive", vma: 64502080, sizeBytes: 80, codeSha256: "d05e63cab621838979d78b8f0b727b30ba9a7a4fd534501ec5f5183c7f93ab45" },
        { role: "ability_manager_add_status", symbol: "_ZN14AbilityManager16addAbilityStatusENSt6__ndk110shared_ptrI22AbilityStatusCausalityEEb", vma: 64365596, sizeBytes: 532, codeSha256: "a24c705d6b484f69c0b6c7d05bd6a155bbcad77fa2417a6d5ad8d95090c21008" },
        { role: "status_exec", symbol: "_ZN22AbilityStatusCausality4execEv", vma: 64485444, sizeBytes: 380, codeSha256: "d0f2551f2910791a0154f249c507a6a6530f74c625282b4727bfe1630e627596" },
        { role: "status_process", symbol: "_ZN22AbilityStatusCausality7processEv", vma: 64485824, sizeBytes: 364, codeSha256: "ad8c39e22d77d14da0a026e80e3e08a94dc7708fd62fb235149c8ff1e9f84303" },
        { role: "efficacy_dispatch", symbol: "_ZN19AbilityEfficacyCore16callEfficacyFuncE17SkillEfficacyTypeNSt6__ndk110shared_ptrI22AbilityStatusCausalityEE", vma: 64243608, sizeBytes: 440, codeSha256: "fbaed51c5902630885bb6de3db7555de65ea2ac83bcccb09bc2a0e4b9539fe2e" },
    ],
    managerVtable: { symbol: "_ZTV14AbilityManager", vma: 92054472, sizeBytes: 200, bytesSha256: "58ec95077a7df39db01804932f0b4b1f926eac72b956891a84e775d42c6a7753" },
    passiveVtable: { symbol: "_ZTV20AbilityStatusPassive", vma: 92059608, sizeBytes: 360, bytesSha256: "d3df611a0ed2e328b050d285287637c60643ba96ec09e4aaefaad7f2cd114b77" },
    vtableBindings: [
        { offset: 92054504, symbol: "_ZN14AbilityManager16addAbilityStatusENSt6__ndk110shared_ptrI22AbilityStatusCausalityEEb", symbolValue: 64365596 },
        { offset: 92059776, symbol: "_ZNK21AbilityStatusEfficacy13getTargetTypeEv", symbolValue: 64480256 },
        { offset: 92059784, symbol: "_ZNK21AbilityStatusEfficacy17getSubTargetTypesEv", symbolValue: 64480264 },
        { offset: 92059904, symbol: "_ZN22AbilityStatusCausality4execEv", symbolValue: 64485444 },
    ],
    pltCalls: [
        { callerVma: 64389808, instructionHex: "58c05c94", pltVma: 88704016, pltBytesHex: "703200d0115a40f910c2029120021fd6", relocationOffset: 95314096, symbol: "_ZN20AbilityStatusPassive6createEP26CreateAbilityStatusPassive", symbolValue: 64502080 },
        { callerVma: 64485696, instructionHex: "c8255d94", pltVma: 88903776, pltBytesHex: "b03100b0116e43f910621b9120021fd6", relocationOffset: 95413976, symbol: "_ZN22AbilityStatusCausality7processEv", symbolValue: 64485824 },
        { callerVma: 64485928, instructionHex: "ca665c94", pltVma: 88708432, pltBytesHex: "703200b011aa44f91042259120021fd6", relocationOffset: 95316304, symbol: "_ZN19AbilityEfficacyCore16callEfficacyFuncE17SkillEfficacyTypeNSt6__ndk110shared_ptrI22AbilityStatusCausalityEE", symbolValue: 64243608 },
    ],
    managerAddDispatchBlock: { vma: 64389820, sizeBytes: 36, bytesSha256: "297aa8094f31be37748c15a0e56936a6bb58824f4606c6f62a36fb0bd43199fc" },
};
//# sourceMappingURL=leader-target-semantics-contract.js.map