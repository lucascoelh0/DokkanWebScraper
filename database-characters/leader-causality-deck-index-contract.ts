import type { CharacterLeaderCausalityCollectionReport } from "./leader-causality-collection-contract";

export const CHARACTER_LEADER_CAUSALITY_DECK_INDEX_CONTRACT_VERSION = "1.0.0" as const;
export const CHARACTER_LEADER_CAUSALITY_DECK_INDEX_REPORT_LIMIT_BYTES = 64 * 1024;
export const CHARACTER_LEADER_CAUSALITY_DECK_INDEX_RSS_LIMIT_BYTES = 1024 * 1024 * 1024;
export const CHARACTER_LEADER_CAUSALITY_DECK_INDEX_PIN = {
    nativeSha256: "7d6c2c1e095fc20a71ec4764e88a17b4d4b82f3f12952b9ba8c6eb0405a7215a",
    nativeSizeBytes: 95_662_296,
    nativeEvidenceSha256: "a0fda20b98c3efbc6e3b3fd4ff461dc7744acd0362ea3a70dda5858cca7d054c",
    nativeEvidenceSizeBytes: 10_521,
    nativeCodeRegions: 11,
    nativeInstructionFragments: 11,
    nativeExactDirectCalls: 1,
    nativeExactPltCalls: 6,
    nativeVtables: 3,
    nativeVtableBindings: 4,
    observedCausalityRows: 17,
    factoryCurrentCharacterVtableSlotBytes: 0x20,
    createAbilityStatusDeckIndexOffsetBytes: 0x0c,
    abilityStatusDeckIndexOffsetBytes: 0x10,
    leaderSkillTargetTypeOffsetBytes: 0x40,
    createAbilityStatusTargetTypeOffsetBytes: 0x2c,
    abilityStatusTargetTypeOffsetBytes: 0xe0,
} as const;

export interface CharacterLeaderCausalityDeckIndexNativeProof {
    elfSha256: string;
    elfSizeBytes: number;
    evidenceSha256: string;
    evidenceSizeBytes: number;
    codeRegionCount: number;
    instructionFragmentCount: number;
    exactDirectCallCount: number;
    exactPltCallCount: number;
    vtableCount: number;
    vtableBindingCount: number;
    factoryVtableSlotBound: true;
    firstRuntimeArgumentCapturedAsW22: true;
    sameArgumentSelectsCurrentCharacter: true;
    currentCharacterVtableSlotBound: true;
    currentCharacterCreationGuardBound: true;
    passiveConstructorChainBound: true;
    deckIndexCreateToStatusCopyBound: true;
    deckIndexGetterReadsStatusOffset0x10: true;
    targetTypeLeaderToCreateCopyBound: true;
    targetTypeGetterReadsStatusOffset0xe0: true;
    deckIndexAndTargetTypeIndependentFields: true;
    staticCallerOrSourceRowBindingFound: false;
    effectiveLeaderRuntimeBranchBound: false;
    dataLevelBranchSelectionBound: false;
    lifecycleBound: false;
    stackingBound: false;
    productAuthorityBound: false;
}

export interface CharacterLeaderCausalityDeckIndexReport {
    schemaVersion: 1;
    contract: "dokkan-database-character-leader-causality-deck-index-audit";
    contractVersion: typeof CHARACTER_LEADER_CAUSALITY_DECK_INDEX_CONTRACT_VERSION;
    mode: "offline_local_explicit_opt_in_stdout_only";
    upstreamK53: CharacterLeaderCausalityCollectionReport;
    sources: { native: CharacterLeaderCausalityDeckIndexNativeProof };
    scope: {
        observedType82CausalityRows: typeof CHARACTER_LEADER_CAUSALITY_DECK_INDEX_PIN.observedCausalityRows;
        staticallyBoundRuntimeDeckIndexRows: 0;
    };
    semantics: {
        deckIndexSource: "first_runtime_argument_to_AbilityManager_createLeaderSkill";
        deckIndexPropagation: "factory_w1_to_create_status_0x0c_to_ability_status_0x10";
        sameArgumentCharacterSelection: "InGameData_getCharaDataCurrent_vtable_slot_0x20_then_canCreateLeaderSkill_guard";
        targetTypePropagation: "leader_skill_0x40_to_create_status_0x2c_to_ability_status_0xe0";
        fieldRelationship: "deck_index_and_target_type_are_independent_runtime_fields";
        observedRowBranch: "not_statically_bound";
    };
    offsets: {
        factoryCurrentCharacterVtableSlotBytes: typeof CHARACTER_LEADER_CAUSALITY_DECK_INDEX_PIN.factoryCurrentCharacterVtableSlotBytes;
        createAbilityStatusDeckIndexOffsetBytes: typeof CHARACTER_LEADER_CAUSALITY_DECK_INDEX_PIN.createAbilityStatusDeckIndexOffsetBytes;
        abilityStatusDeckIndexOffsetBytes: typeof CHARACTER_LEADER_CAUSALITY_DECK_INDEX_PIN.abilityStatusDeckIndexOffsetBytes;
        leaderSkillTargetTypeOffsetBytes: typeof CHARACTER_LEADER_CAUSALITY_DECK_INDEX_PIN.leaderSkillTargetTypeOffsetBytes;
        createAbilityStatusTargetTypeOffsetBytes: typeof CHARACTER_LEADER_CAUSALITY_DECK_INDEX_PIN.createAbilityStatusTargetTypeOffsetBytes;
        abilityStatusTargetTypeOffsetBytes: typeof CHARACTER_LEADER_CAUSALITY_DECK_INDEX_PIN.abilityStatusTargetTypeOffsetBytes;
    };
    policy: {
        nativeStructuralEvidenceOnly: true;
        runtimeArgumentProvenanceOnly: true;
        targetTypeDoesNotSelectDeckIndexInAuditedCreationChain: true;
        staticCallerOrSourceRowBindingDerived: false;
        effectiveLeaderRuntimeBranchSelected: false;
        dataLevelBranchSelectionDerived: false;
        lifecycleDerived: false;
        stackingDerived: false;
        sourceTextIncluded: false;
        payloadWritten: false;
        authoritySelected: false;
        productionModified: false;
        networkEnabled: false;
        r2Enabled: false;
        androidImplemented: false;
    };
    inputIntegrity: {
        k53RealAudit: "GO" | "NOT_EXECUTED";
        k53StructuralGosAndNoGosPreserved: boolean;
        nativeProofBefore: "GO" | "NOT_EXECUTED";
        nativeProofAfter: "GO" | "NOT_EXECUTED";
        nativeProofStableAcrossK53: boolean;
        reportTimestampIncluded: false;
        reportMaximumBytesExclusive: typeof CHARACTER_LEADER_CAUSALITY_DECK_INDEX_REPORT_LIMIT_BYTES;
        rssMaximumBytesExclusive: typeof CHARACTER_LEADER_CAUSALITY_DECK_INDEX_RSS_LIMIT_BYTES;
        rssStayedBelowExclusiveLimit: boolean;
    };
    readiness: {
        deckIndexRuntimeArgumentProvenance: "GO" | "NOT_EXECUTED";
        deckIndexIndependentFromTargetType: "GO" | "NOT_EXECUTED";
        effectiveLeaderRuntimeBranch: "NO-GO";
        dataLevelBranchSelection: "NO-GO";
        lifecycle: "NO-GO";
        stacking: "NO-GO";
        productProjection: "NO-GO";
        authority: "NO-GO";
        production: "NO-GO";
        writer: "NO-GO";
        publisher: "NO-GO";
        network: "NO-GO";
        r2: "NO-GO";
        android: "NO-GO";
    };
}
