import type { CharacterLeaderCausalityDeckIndexReport } from "./leader-causality-deck-index-contract";

export const CHARACTER_LEADER_LIFECYCLE_SEMANTICS_CONTRACT_VERSION = "1.0.0" as const;
export const CHARACTER_LEADER_LIFECYCLE_SEMANTICS_REPORT_LIMIT_BYTES = 64 * 1024;
export const CHARACTER_LEADER_LIFECYCLE_SEMANTICS_RSS_LIMIT_BYTES = 1024 * 1024 * 1024;
export const CHARACTER_LEADER_LIFECYCLE_SEMANTICS_PIN = {
    nativeSha256: "7d6c2c1e095fc20a71ec4764e88a17b4d4b82f3f12952b9ba8c6eb0405a7215a",
    nativeSizeBytes: 95_662_296,
    nativeEvidenceSha256: "136d7792840ddb716a7d601b561bed56b7dda37297f4029480a605b6c1a95ec8",
    nativeEvidenceSizeBytes: 11_356,
    nativeCodeRegions: 9,
    nativeInstructionFragments: 10,
    nativeExactDirectBranches: 1,
    nativeExactPltCalls: 12,
    nativeVtables: 1,
    nativeVtableBindings: 1,
    totalType82Effects: 3_853,
    totalType82References: 12_310,
    unconditionalType82Effects: 3_836,
    unconditionalType82References: 12_265,
    conditionalType82Effects: 17,
    conditionalType82References: 45,
} as const;

export interface CharacterLeaderLifecycleSemanticsNativeProof {
    elfSha256: string;
    elfSizeBytes: number;
    evidenceSha256: string;
    evidenceSizeBytes: number;
    codeRegionCount: number;
    instructionFragmentCount: number;
    exactDirectBranchCount: number;
    exactPltCallCount: number;
    vtableCount: number;
    vtableBindingCount: number;
    oneStatusPerSourceRowBound: true;
    startTurnSharedExecutionInvocationBound: true;
    type82MatchingRowsAdditiveInCalculatorBound: true;
    calcOption0IntegerConversionAtHandlerBound: true;
    calcOption2DivideBy100FloatAtHandlerBound: true;
    independentOfType35PostConditionBound: true;
    deactivationApisInvoked: true;
    deactivationOutcomeBound: false;
    db37PassiveTurnOrIsOnceLeaderBindingFound: false;
    singleEvaluationOrReevaluationBound: false;
    durationBound: false;
    resetOrRemovalOutcomeBound: false;
    enterExitBound: false;
    leaderFriendCompositionBound: false;
    finalStackingOrCompositionBound: false;
    finalOperationOrderingOutsideHandlerBound: false;
    transformationDeathReviveExchangeStandbyBound: false;
    finalRoundingBound: false;
}

export interface CharacterLeaderLifecycleSemanticsReport {
    schemaVersion: 1;
    contract: "dokkan-database-character-leader-lifecycle-semantics-audit";
    contractVersion: typeof CHARACTER_LEADER_LIFECYCLE_SEMANTICS_CONTRACT_VERSION;
    mode: "offline_local_explicit_opt_in_stdout_only";
    upstreamK54: CharacterLeaderCausalityDeckIndexReport;
    sources: { native: CharacterLeaderLifecycleSemanticsNativeProof };
    scope: {
        unconditional: {
            effects: typeof CHARACTER_LEADER_LIFECYCLE_SEMANTICS_PIN.unconditionalType82Effects;
            references: typeof CHARACTER_LEADER_LIFECYCLE_SEMANTICS_PIN.unconditionalType82References;
            status: "supported";
        };
        conditional: {
            effects: typeof CHARACTER_LEADER_LIFECYCLE_SEMANTICS_PIN.conditionalType82Effects;
            references: typeof CHARACTER_LEADER_LIFECYCLE_SEMANTICS_PIN.conditionalType82References;
            status: "excluded";
            reason: "runtime_deck_index_unresolved";
        };
    };
    supported: {
        oneStatusPerSourceRow: true;
        startTurnSharedExecutionInvocation: true;
        type82MatchingRowsAdditiveInCalculator: true;
        calcOption0IntegerConversionAtHandler: true;
        calcOption2DivideBy100FloatAtHandler: true;
        independentOfType35ForPostCondition: true;
    };
    partial: {
        creation: "factory_per_source_row";
        application: "shared_start_turn_execution_invocation";
        creationToApplicationCardinality: "unknown";
        deactivation: "apis_invoked_outcome_unbound";
    };
    unknown: {
        singleEvaluationOrReevaluation: true;
        duration: true;
        resetOrRemovalOutcome: true;
        enterExitLifecycle: true;
        leaderFriendComposition: true;
        finalStackingOrComposition: true;
        finalOperationOrderingOutsideHandler: true;
        transformationDeathReviveExchangeStandby: true;
        finalRounding: true;
    };
    policy: {
        nativeStructuralEvidenceOnly: true;
        postConditionIndependentOfType35Only: true;
        runtimeDeckIndexReopened: false;
        db37PassiveTurnOrIsOnceUsedAsLeaderBinding: false;
        lifecycleDerived: false;
        removalOutcomeDerived: false;
        leaderFriendCompositionDerived: false;
        finalStackingDerived: false;
        finalRoundingDerived: false;
        sourceTextIncluded: false;
        payloadWritten: false;
        authoritySelected: false;
        productionModified: false;
        networkEnabled: false;
        r2Enabled: false;
        androidImplemented: false;
    };
    inputIntegrity: {
        k54RealAudit: "GO" | "NOT_EXECUTED";
        k54StructuralGosAndAllNoGosPreserved: boolean;
        nativeProofBefore: "GO" | "NOT_EXECUTED";
        nativeProofAfter: "GO" | "NOT_EXECUTED";
        nativeProofStableAcrossK54: boolean;
        reportTimestampIncluded: false;
        reportMaximumBytesExclusive: typeof CHARACTER_LEADER_LIFECYCLE_SEMANTICS_REPORT_LIMIT_BYTES;
        rssMaximumBytesExclusive: typeof CHARACTER_LEADER_LIFECYCLE_SEMANTICS_RSS_LIMIT_BYTES;
        rssStayedBelowExclusiveLimit: boolean;
    };
    readiness: {
        oneStatusPerSourceRow: "GO" | "NOT_EXECUTED";
        startTurnSharedExecutionInvocation: "GO" | "NOT_EXECUTED";
        type82MatchingRowsAdditiveInCalculator: "GO" | "NOT_EXECUTED";
        calcOption0IntegerConversionAtHandler: "GO" | "NOT_EXECUTED";
        calcOption2DivideBy100FloatAtHandler: "GO" | "NOT_EXECUTED";
        postConditionIndependentOfType35: "GO" | "NOT_EXECUTED";
        conditionalType82RuntimeBranch: "NO-GO";
        singleEvaluationOrReevaluation: "NO-GO";
        duration: "NO-GO";
        resetOrRemovalOutcome: "NO-GO";
        enterExitLifecycle: "NO-GO";
        leaderFriendComposition: "NO-GO";
        finalStackingOrComposition: "NO-GO";
        finalOperationOrderingOutsideHandler: "NO-GO";
        transformationDeathReviveExchangeStandby: "NO-GO";
        finalRounding: "NO-GO";
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
