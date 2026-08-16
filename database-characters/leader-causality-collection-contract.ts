import type { CharacterLeaderCausalitySemanticsReport } from "./leader-causality-semantics-contract";

export const CHARACTER_LEADER_CAUSALITY_COLLECTION_CONTRACT_VERSION = "1.0.0" as const;
export const CHARACTER_LEADER_CAUSALITY_COLLECTION_REPORT_LIMIT_BYTES = 64 * 1024;
export const CHARACTER_LEADER_CAUSALITY_COLLECTION_RSS_LIMIT_BYTES = 1024 * 1024 * 1024;
export const CHARACTER_LEADER_CAUSALITY_COLLECTION_PIN = {
    nativeSha256: "7d6c2c1e095fc20a71ec4764e88a17b4d4b82f3f12952b9ba8c6eb0405a7215a",
    nativeSizeBytes: 95_662_296,
    nativeEvidenceSha256: "b9ad4b4138ace36ee56595e6308fc7d095fe0502dfa14d16405de9b516843b89",
    nativeEvidenceSizeBytes: 7_745,
    nativeCodeRegions: 6,
    nativeInstructionFragments: 6,
    nativeExactCalls: 6,
    nativeVtables: 2,
    nativeVtableBindings: 3,
    supportedDeckIndices: [0, 1] as const,
    playerCandidateCount: 7,
    playerCandidateStrideBytes: 0x590,
    playerUserCardReferenceOffsetBytes: 0xa0,
    puzzleEnemyVectorBeginOffsetBytes: 0x100,
    puzzleEnemyVectorEndOffsetBytes: 0x108,
    puzzleEnemyVectorElementSizeBytes: 8,
} as const;

export interface CharacterLeaderCausalityCollectionNativeProof {
    elfSha256: string;
    elfSizeBytes: number;
    evidenceSha256: string;
    evidenceSizeBytes: number;
    codeRegionCount: number;
    instructionFragmentCount: number;
    exactCallCount: number;
    vtableCount: number;
    vtableBindingCount: number;
    deckIndexVirtualDispatchBound: true;
    deckIndex0SevenPlayerRecordsBound: true;
    deckIndex1PuzzleEnemyVectorBound: true;
    deckIndex1EmptyFailsBound: true;
    otherDeckIndicesSupported: false;
    playerRuntimeUserCardOffsetBound: true;
    masterCardResolutionBound: true;
    cardElementGettersBound: true;
    elementBitPatternCallBound: true;
    onlyCauVal1Read: true;
    explicitAliveActiveCategoryOrTargetFilterFound: false;
    effectiveLeaderBranchBound: false;
    humanElementNamesBound: false;
    lifecycleBound: false;
    deathOrRemovalBound: false;
    stackingBound: false;
    productAuthorityBound: false;
}

export interface CharacterLeaderCausalityCollectionReport {
    schemaVersion: 1;
    contract: "dokkan-database-character-leader-causality-collection-audit";
    contractVersion: typeof CHARACTER_LEADER_CAUSALITY_COLLECTION_CONTRACT_VERSION;
    mode: "offline_local_explicit_opt_in_stdout_only";
    upstreamK52: CharacterLeaderCausalitySemanticsReport;
    sources: { native: CharacterLeaderCausalityCollectionNativeProof };
    semantics: {
        deckIndex0Collection: "exactly_seven_ingame_data_indexed_character_records";
        deckIndex1Collection: "puzzle_enemy_runtime_vector_at_ingame_data_0x100_0x108";
        deckIndex1Empty: "condition_false";
        otherDeckIndices: "unsupported";
        playerCandidateSource: "runtime_user_card_reference_at_candidate_index_times_0x590_plus_0xa0";
        candidatePredicate: "master_card_element_and_awakening_element_type_against_selected_bit";
    };
    offsets: {
        playerCandidateStrideBytes: typeof CHARACTER_LEADER_CAUSALITY_COLLECTION_PIN.playerCandidateStrideBytes;
        playerUserCardReferenceOffsetBytes: typeof CHARACTER_LEADER_CAUSALITY_COLLECTION_PIN.playerUserCardReferenceOffsetBytes;
        puzzleEnemyVectorBeginOffsetBytes: typeof CHARACTER_LEADER_CAUSALITY_COLLECTION_PIN.puzzleEnemyVectorBeginOffsetBytes;
        puzzleEnemyVectorEndOffsetBytes: typeof CHARACTER_LEADER_CAUSALITY_COLLECTION_PIN.puzzleEnemyVectorEndOffsetBytes;
        puzzleEnemyVectorElementSizeBytes: typeof CHARACTER_LEADER_CAUSALITY_COLLECTION_PIN.puzzleEnemyVectorElementSizeBytes;
    };
    policy: {
        nativeStructuralEvidenceOnly: true;
        effectiveLeaderBranchSelected: false;
        humanElementNamesDerived: false;
        lifecycleDerived: false;
        deathOrRemovalDerived: false;
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
        k52RealAudit: "GO" | "NOT_EXECUTED";
        k52ConservativeNoGosPreserved: boolean;
        nativeProofBefore: "GO" | "NOT_EXECUTED";
        nativeProofAfter: "GO" | "NOT_EXECUTED";
        nativeProofStableAcrossK52: boolean;
        reportTimestampIncluded: false;
        reportMaximumBytesExclusive: typeof CHARACTER_LEADER_CAUSALITY_COLLECTION_REPORT_LIMIT_BYTES;
        rssMaximumBytesExclusive: typeof CHARACTER_LEADER_CAUSALITY_COLLECTION_RSS_LIMIT_BYTES;
        rssStayedBelowExclusiveLimit: boolean;
    };
    readiness: {
        leaderCausalityCandidateCollection: "GO" | "NOT_EXECUTED";
        deckIndex0And1StructuralCollection: "GO" | "NOT_EXECUTED";
        effectiveLeaderRuntimeBranch: "NO-GO";
        humanElementNames: "NO-GO";
        lifecycle: "NO-GO";
        deathOrRemoval: "NO-GO";
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
