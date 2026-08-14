import type { CharacterAwakeningKind, CharacterFormKind } from "./state-graph-contract";

export const CHARACTER_STATE_PRODUCT_SCOPE_CONTRACT_VERSION = "1.0.0" as const;
export const CHARACTER_STATE_PRODUCT_SCOPE_SAMPLE_LIMIT = 5 as const;
export const CHARACTER_STATE_PRODUCT_SCOPE_MAX_REPORT_BYTES = 64 * 1024;
export const CHARACTER_STATE_PRODUCT_SCOPE_MAX_ERROR_LENGTH = 512;

export const CHARACTER_STATE_PRODUCT_SCOPE_PIN = {
    states: { included: 10_651, excluded: 3 },
    releaseTransitions: { included: 4_892, excluded: 3 },
    awakeningTransitions: { included: 6_905, excluded: 2 },
    formTransitions: { included: 374, excluded: 184 },
    productionCoverage: { agreement: 4_296, unjoinable: 1_463 },
} as const;

export interface CharacterStateProductScopeSelectionCount {
    included: number;
    excluded: number;
}

export interface CharacterStateProductScopeSourceIdentity {
    sha256: string;
    sizeBytes: number;
}

export interface CharacterStateProductScopeEvaluation {
    states: CharacterStateProductScopeSelectionCount & {
        byReleaseState: Record<"initial" | "eza" | "seza" | "unknown", CharacterStateProductScopeSelectionCount>;
    };
    releaseTransitions: CharacterStateProductScopeSelectionCount & {
        byReleaseState: Record<"eza" | "seza" | "unknown", CharacterStateProductScopeSelectionCount>;
    };
    awakeningTransitions: CharacterStateProductScopeSelectionCount & {
        byKind: Record<CharacterAwakeningKind, CharacterStateProductScopeSelectionCount>;
    };
    formTransitions: CharacterStateProductScopeSelectionCount & {
        byKind: Record<CharacterFormKind, CharacterStateProductScopeSelectionCount>;
        byChannel: Record<"passive" | "active" | "standby" | "finish", CharacterStateProductScopeSelectionCount>;
    };
    productionCoverage: {
        agreement: number;
        unjoinable: number;
        use: "coverage_only";
    };
    excludedStructuralIds: {
        stateIds: string[];
        releaseTransitionIds: string[];
        awakeningTransitionIds: string[];
        formTransitionIds: string[];
        limitPerScope: typeof CHARACTER_STATE_PRODUCT_SCOPE_SAMPLE_LIMIT;
    };
}

export interface CharacterStateProductScopeReport {
    schemaVersion: 1;
    contract: "dokkan-database-character-state-product-scope-audit";
    contractVersion: typeof CHARACTER_STATE_PRODUCT_SCOPE_CONTRACT_VERSION;
    mode: "offline_local_explicit_opt_in_stdout_only";
    sources: {
        fingerprintSha256: string;
        sidecars: Record<"k0" | "k1" | "k2" | "k7", CharacterStateProductScopeSourceIdentity>;
        production: CharacterStateProductScopeSourceIdentity & { topLevelCount: number };
        fyi: CharacterStateProductScopeSourceIdentity & { topLevelCount: number };
    };
    policy: {
        structuralIdsOnly: true;
        sourceTextReadForScope: false;
        supportedOnly: true;
        unknownIncluded: false;
        partialIncluded: false;
        k7ProductionAgreementUsedAs: "coverage_only";
        characterArrayReturned: false;
        applyOrOverlayImplemented: false;
        authoritySelected: false;
        productionModified: false;
        writerImplemented: false;
        artifactWritten: false;
        publisherEnabled: false;
        networkEnabled: false;
        androidEnabled: false;
    };
    scope: CharacterStateProductScopeEvaluation;
    inputIntegrity: {
        loadedByCharacterShadowSource: true;
        everyK1StateMatchedK0IdentityAndEvidence: true;
        sourcesReloadedAfterEvaluation: true;
        sourceIdentitiesMatchedAfterReload: true;
        structuralFingerprintMatchedAfterReload: true;
        reportHasTimestamp: false;
        boundedStructuralIdSamples: true;
    };
    readiness: {
        scopeAudit: "GO";
        nextSupportedOnlyProjection: "GO";
        productProjection: "NOT_EXECUTED";
        characterArray: "NO-GO";
        applyOrOverlay: "NO-GO";
        authority: "NO-GO";
        production: "NO-GO";
        writer: "NO-GO";
        publisher: "NO-GO";
        network: "NO-GO";
        android: "NO-GO";
        r2: "NO-GO";
        fyiRemoval: "NO-GO";
        dokkanInfoRemoval: "NO-GO";
    };
}
