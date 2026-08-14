import type {
    CharacterStateProductProjectionAwakeningTransition,
    CharacterStateProductProjectionFormTransition,
    CharacterStateProductProjectionReleaseTransition,
    CharacterStateProductProjectionState,
} from "./state-product-projection-contract";

export const CHARACTER_STATE_PRODUCT_SHADOW_CONTRACT_VERSION = "1.0.0" as const;
export const CHARACTER_STATE_PRODUCT_SHADOW_REPORT_LIMIT_BYTES = 64 * 1024;
export const CHARACTER_STATE_PRODUCT_SHADOW_RSS_LIMIT_BYTES = 1024 * 1024 * 1024;
export const CHARACTER_STATE_PRODUCT_SHADOW_SAMPLE_LIMIT = 5 as const;
export const CHARACTER_STATE_PRODUCT_SHADOW_PIN = {
    states: 10_651,
    releaseTransitions: 4_892,
    awakeningTransitions: 6_905,
    formTransitions: 374,
    allTransitions: 12_171,
    k7ProductionAgreement: 4_296,
    k7ProductionUnjoinable: 1_463,
} as const;

export type CharacterStateProductShadowState = Readonly<CharacterStateProductProjectionState>;

export type CharacterStateProductShadowTransition =
    | Readonly<{ transitionType: "release"; record: Readonly<CharacterStateProductProjectionReleaseTransition> }>
    | Readonly<{ transitionType: "awakening"; record: Readonly<CharacterStateProductProjectionAwakeningTransition> }>
    | Readonly<{ transitionType: "form"; record: Readonly<CharacterStateProductProjectionFormTransition> }>;

export interface CharacterStateProductShadowLookupInventory {
    stateByIdCount: number;
    stateCardIdCount: number;
    transitionByIdCount: number;
    transitionCardIdCount: number;
}

export interface CharacterStateProductShadowLookup {
    getStateByStateId(stateId: string): CharacterStateProductShadowState | null;
    getStatesByCardId(cardId: string): readonly CharacterStateProductShadowState[];
    getTransitionByTransitionId(transitionId: string): CharacterStateProductShadowTransition | null;
    getTransitionsByCardId(cardId: string): readonly CharacterStateProductShadowTransition[];
    inventory(): Readonly<CharacterStateProductShadowLookupInventory>;
}

export interface CharacterStateProductShadowReport {
    schemaVersion: 1;
    contract: "dokkan-database-character-state-product-shadow-audit";
    contractVersion: typeof CHARACTER_STATE_PRODUCT_SHADOW_CONTRACT_VERSION;
    mode: "offline_local_explicit_opt_in_stdout_only";
    source: {
        k43ManifestSha256: string;
        k43PayloadSha256: string;
        k43RawSha256: string;
        k42SourceFingerprintSha256: string;
        sidecars: Record<"k0" | "k1" | "k2" | "k7", { sha256: string; sizeBytes: number }>;
        production: { sha256: string; sizeBytes: number; topLevelCount: number };
        fyi: { sha256: string; sizeBytes: number; topLevelCount: number };
        k7ProductionCoverage: { agreement: number; unjoinable: number; use: "coverage_only" };
    };
    policy: {
        structuralIdsOnly: true;
        presentationIncluded: false;
        characterArrayIncluded: false;
        lookupsReturnFrozenClones: true;
        internalIndexesMutableByCaller: false;
        persistedConsumerImplemented: false;
        applyOrOverlayImplemented: false;
        authoritySelected: false;
        writerImplemented: false;
        outputArtifactWritten: false;
        networkEnabled: false;
        publisherImplemented: false;
        r2Enabled: false;
        androidImplemented: false;
    };
    counts: {
        states: number;
        releaseTransitions: number;
        awakeningTransitions: number;
        formTransitions: number;
        allTransitions: number;
    };
    lookupInventory: CharacterStateProductShadowLookupInventory;
    samples: {
        stateIds: string[];
        stateCardIds: string[];
        transitionIds: string[];
        transitionCardIds: string[];
        limitPerKind: typeof CHARACTER_STATE_PRODUCT_SHADOW_SAMPLE_LIMIT;
    };
    inputIntegrity: {
        k43ValidatedOnlyBySourceBoundApi: boolean;
        sourceBoundValidationBeforeLookup: "GO" | "NOT_EXECUTED";
        sourceBoundValidationAfterLookup: "GO" | "NOT_EXECUTED";
        exactK43ArtifactIdentityStable: boolean;
        exactSourceLineageStable: boolean;
        reportTimestampIncluded: false;
        reportMaximumBytesExclusive: typeof CHARACTER_STATE_PRODUCT_SHADOW_REPORT_LIMIT_BYTES;
        rssMaximumBytesExclusive: typeof CHARACTER_STATE_PRODUCT_SHADOW_RSS_LIMIT_BYTES;
    };
    readiness: {
        consumerShadow: "GO" | "NOT_EXECUTED";
        persistedConsumer: "NO-GO";
        applyOrOverlay: "NO-GO";
        authority: "NO-GO";
        production: "NO-GO";
        writer: "NO-GO";
        publisher: "NO-GO";
        network: "NO-GO";
        r2: "NO-GO";
        android: "NO-GO";
        fyiRemoval: "NO-GO";
        dokkanInfoRemoval: "NO-GO";
    };
}

export interface CharacterStateProductShadowConsumer {
    report: Readonly<CharacterStateProductShadowReport>;
    lookup: Readonly<CharacterStateProductShadowLookup>;
}
