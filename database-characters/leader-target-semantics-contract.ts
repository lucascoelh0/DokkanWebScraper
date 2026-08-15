import type { CharacterLeaderValueK3Identity, CharacterLeaderValueK48Identity } from "./leader-value-scope-contract";
import type { CharacterLeaderNativeProof } from "./leader-native-semantics-contract";

export const CHARACTER_LEADER_TARGET_SEMANTICS_CONTRACT_VERSION = "1.0.0" as const;
export const CHARACTER_LEADER_TARGET_SEMANTICS_REPORT_LIMIT_BYTES = 64 * 1024;
export const CHARACTER_LEADER_TARGET_SEMANTICS_RSS_LIMIT_BYTES = 1024 * 1024 * 1024;
export const CHARACTER_LEADER_TARGET_PIN = {
    type82Rows: 3_853, type82References: 12_310, referencesWithSet: 9_040, referencesWithoutSet: 3_270,
    distinctNonzeroSets: 625, targetRows: 1_588, targetOccurrences: 15_988,
    includeCategoryRows: 883, excludeCategoryRows: 705, unsupportedTargetRows: 0,
    teamAlliesRows: 3_788, superClassAlliesRows: 37, extremeClassAlliesRows: 28,
    targetDispatchEvidenceSha256: "287fbc7ca18787b6ac6f20cd785dac3c0188cf3efbb01a2d2ffd6974f8c825b5",
    targetDispatchEvidenceSizeBytes: 11_444,
    subTargetEvidenceSha256: "48be3a3b33bdb3d13ce761eb268766c33daeb24e5fee02cb5d108251dbac1cca",
    subTargetEvidenceSizeBytes: 8_323,
} as const;
export const CHARACTER_LEADER_TARGET_RUNTIME_BRIDGE_PIN = {
    codeRegions: [
        { role: "passive_status_factory", symbol: "_ZN20AbilityStatusPassive6createEP26CreateAbilityStatusPassive", vma: 64_502_080, sizeBytes: 80, codeSha256: "d05e63cab621838979d78b8f0b727b30ba9a7a4fd534501ec5f5183c7f93ab45" },
        { role: "ability_manager_add_status", symbol: "_ZN14AbilityManager16addAbilityStatusENSt6__ndk110shared_ptrI22AbilityStatusCausalityEEb", vma: 64_365_596, sizeBytes: 532, codeSha256: "a24c705d6b484f69c0b6c7d05bd6a155bbcad77fa2417a6d5ad8d95090c21008" },
        { role: "status_exec", symbol: "_ZN22AbilityStatusCausality4execEv", vma: 64_485_444, sizeBytes: 380, codeSha256: "d0f2551f2910791a0154f249c507a6a6530f74c625282b4727bfe1630e627596" },
        { role: "status_process", symbol: "_ZN22AbilityStatusCausality7processEv", vma: 64_485_824, sizeBytes: 364, codeSha256: "ad8c39e22d77d14da0a026e80e3e08a94dc7708fd62fb235149c8ff1e9f84303" },
        { role: "efficacy_dispatch", symbol: "_ZN19AbilityEfficacyCore16callEfficacyFuncE17SkillEfficacyTypeNSt6__ndk110shared_ptrI22AbilityStatusCausalityEE", vma: 64_243_608, sizeBytes: 440, codeSha256: "fbaed51c5902630885bb6de3db7555de65ea2ac83bcccb09bc2a0e4b9539fe2e" },
    ],
    managerVtable: { symbol: "_ZTV14AbilityManager", vma: 92_054_472, sizeBytes: 200, bytesSha256: "58ec95077a7df39db01804932f0b4b1f926eac72b956891a84e775d42c6a7753" },
    passiveVtable: { symbol: "_ZTV20AbilityStatusPassive", vma: 92_059_608, sizeBytes: 360, bytesSha256: "d3df611a0ed2e328b050d285287637c60643ba96ec09e4aaefaad7f2cd114b77" },
    vtableBindings: [
        { offset: 92_054_504, symbol: "_ZN14AbilityManager16addAbilityStatusENSt6__ndk110shared_ptrI22AbilityStatusCausalityEEb", symbolValue: 64_365_596 },
        { offset: 92_059_776, symbol: "_ZNK21AbilityStatusEfficacy13getTargetTypeEv", symbolValue: 64_480_256 },
        { offset: 92_059_784, symbol: "_ZNK21AbilityStatusEfficacy17getSubTargetTypesEv", symbolValue: 64_480_264 },
        { offset: 92_059_904, symbol: "_ZN22AbilityStatusCausality4execEv", symbolValue: 64_485_444 },
    ],
    pltCalls: [
        { callerVma: 64_389_808, instructionHex: "58c05c94", pltVma: 88_704_016, pltBytesHex: "703200d0115a40f910c2029120021fd6", relocationOffset: 95_314_096, symbol: "_ZN20AbilityStatusPassive6createEP26CreateAbilityStatusPassive", symbolValue: 64_502_080 },
        { callerVma: 64_485_696, instructionHex: "c8255d94", pltVma: 88_903_776, pltBytesHex: "b03100b0116e43f910621b9120021fd6", relocationOffset: 95_413_976, symbol: "_ZN22AbilityStatusCausality7processEv", symbolValue: 64_485_824 },
        { callerVma: 64_485_928, instructionHex: "ca665c94", pltVma: 88_708_432, pltBytesHex: "703200b011aa44f91042259120021fd6", relocationOffset: 95_316_304, symbol: "_ZN19AbilityEfficacyCore16callEfficacyFuncE17SkillEfficacyTypeNSt6__ndk110shared_ptrI22AbilityStatusCausalityEE", symbolValue: 64_243_608 },
    ],
    managerAddDispatchBlock: { vma: 64_389_820, sizeBytes: 36, bytesSha256: "297aa8094f31be37748c15a0e56936a6bb58824f4606c6f62a36fb0bd43199fc" },
} as const;

export interface CharacterLeaderTargetRawRow { rowId: string; targetSetId: string; valueType: number; valueId: string }
export interface CharacterLeaderTargetK3Source {
    identity: { artifactSha256: string; targetInputFingerprintSha256: string };
    rows: CharacterLeaderTargetRawRow[];
}
export interface CharacterLeaderTargetK48Source {
    identity: CharacterLeaderValueK48Identity;
    effects: Array<{ effectRowId: string; targetSetId: string | null; targetRowIds: string[] }>;
}
export interface CharacterLeaderTargetNativeProof {
    k50: CharacterLeaderNativeProof;
    targetDispatchEvidenceSha256: string;
    subTargetEvidenceSha256: string;
    targetCodeRegionCount: number;
    subTargetCodeRegionCount: number;
    leaderRuntimeBridgeCodeRegionCount: number;
    leaderRuntimeBridgeVtableBindingCount: number;
    leaderRuntimeBridgeCallSiteCount: number;
    targetTypesBound: boolean;
    subTargetTypesBound: boolean;
    leaderRuntimeBridgeBound: boolean;
}
export interface CharacterLeaderTargetEvaluation {
    type82Rows: number; type82References: number; referencesWithSet: number; referencesWithoutSet: number;
    distinctNonzeroSets: number; targetRows: number; targetOccurrences: number;
    includeCategoryRows: number; excludeCategoryRows: number; unsupportedTargetRows: number;
    targetTypeRows: Array<{ raw: 2 | 12 | 13; rows: number; scope: "team_allies" | "super_class_allies" | "extreme_class_allies" }>;
}
export interface CharacterLeaderTargetSemanticsReport {
    schemaVersion: 1; contract: "dokkan-database-character-leader-target-native-semantics-audit";
    contractVersion: typeof CHARACTER_LEADER_TARGET_SEMANTICS_CONTRACT_VERSION;
    mode: "offline_local_explicit_opt_in_stdout_only";
    sources: { k48: CharacterLeaderValueK48Identity; k3: CharacterLeaderValueK3Identity; targetK3FingerprintSha256: string; native: CharacterLeaderTargetNativeProof };
    semantics: {
        targetType2: "team_allies"; targetType12: "super_class_allies"; targetType13: "extreme_class_allies";
        subTargetType1: "include_card_category_id"; subTargetType2: "exclude_card_category_id";
        subTargetComposition: "and_sequential_filter_chain"; emptySetBehavior: "identity"; duplicateBehavior: "reapplied_filter";
    };
    scope: CharacterLeaderTargetEvaluation;
    policy: {
        nativeEvidenceOnly: true; localizedCategoryTextIncluded: false; categoryIdsAreStructuralOnly: true;
        causalityBehaviorDerived: false; battleLifecycleDerived: false; battleStackingOrCompositionDerived: false;
        productAuthoritySelected: false; payloadWritten: false; networkEnabled: false; r2Enabled: false; androidImplemented: false;
    };
    inputIntegrity: {
        k48SourceBoundBefore: "GO" | "NOT_EXECUTED"; k48SourceBoundAfter: "GO" | "NOT_EXECUTED";
        k48K3NativeAndTargetRowsStable: boolean; nativeEvidenceExactPinned: boolean; reportTimestampIncluded: false;
        reportMaximumBytesExclusive: typeof CHARACTER_LEADER_TARGET_SEMANTICS_REPORT_LIMIT_BYTES;
        rssMaximumBytesExclusive: typeof CHARACTER_LEADER_TARGET_SEMANTICS_RSS_LIMIT_BYTES;
    };
    readiness: {
        leaderTargetSemantics: "GO" | "NOT_EXECUTED"; type82TargetAndCategoryFilters: "GO" | "NOT_EXECUTED";
        causalityBehavior: "NO-GO"; battleLifecycle: "NO-GO"; battleStackingOrComposition: "NO-GO";
        productProjection: "NO-GO"; authority: "NO-GO"; production: "NO-GO"; writer: "NO-GO";
        publisher: "NO-GO"; network: "NO-GO"; r2: "NO-GO"; android: "NO-GO";
    };
}
