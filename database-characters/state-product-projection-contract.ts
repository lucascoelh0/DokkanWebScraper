import type { CharacterStateProductScopeSelectionCount, CharacterStateProductScopeSourceIdentity } from "./state-product-scope-contract";
import type { CharacterAwakeningKind, CharacterFormKind } from "./state-graph-contract";

export const CHARACTER_STATE_PRODUCT_PROJECTION_CONTRACT_VERSION = "1.0.0" as const;
export const CHARACTER_STATE_PRODUCT_PROJECTION_RAW_LIMIT_BYTES = 16 * 1024 * 1024;
export const CHARACTER_STATE_PRODUCT_PROJECTION_GZIP_LIMIT_BYTES = 2 * 1024 * 1024;
export const CHARACTER_STATE_PRODUCT_PROJECTION_METADATA_LIMIT_BYTES = 64 * 1024;
export const CHARACTER_STATE_PRODUCT_PROJECTION_RSS_LIMIT_BYTES = 1024 * 1024 * 1024;
export const CHARACTER_STATE_PRODUCT_PROJECTION_SAMPLE_LIMIT = 5 as const;

export const CHARACTER_STATE_PRODUCT_PROJECTION_FILES = {
    coverage: "database-characters-k43-state-product-projection-coverage.json",
    validation: "database-characters-k43-state-product-projection-validation.json",
    manifest: "database-characters-k43-state-product-projection-manifest.json",
} as const;

export interface CharacterStateProductProjectionLineage {
    k42: {
        contractVersion: "1.0.0";
        scopeAudit: "GO";
        nextSupportedOnlyProjection: "GO";
        sourceFingerprintSha256: string;
    };
    sidecars: Record<"k0" | "k1" | "k2" | "k7", CharacterStateProductScopeSourceIdentity>;
    production: CharacterStateProductScopeSourceIdentity & { topLevelCount: number };
    fyi: CharacterStateProductScopeSourceIdentity & { topLevelCount: number };
    k7ProductionCoverage: { agreement: number; unjoinable: number; use: "coverage_only" };
}

export interface CharacterStateProductProjectionState {
    stateId: string;
    sourceStateKey: string;
    cardId: string;
    formId: string;
    releaseState: "initial" | "eza" | "seza";
    growthRowId: string | null;
    growthStep: number | null;
    hardDuplicateGroupId: string;
}

export interface CharacterStateProductProjectionReleaseTransition {
    transitionId: string;
    cardId: string;
    sourceStateId: string;
    targetStateId: string;
    releaseState: "eza" | "seza";
    growthRowId: string;
    growthStep: number;
    routeRowIds: string[];
}

export interface CharacterStateProductProjectionAwakeningTransition {
    transitionId: string;
    kind: Exclude<CharacterAwakeningKind, "unknown">;
    sourceCardId: string;
    targetCardId: string;
    sourceStateId: string | null;
    targetStateId: string | null;
    cardIdentityPolicy: "collapse_z_awakened_ui_duplicate" | "preserve_distinct_card_identity" | "same_card_release_progression";
    routeRowId: string;
}

export interface CharacterStateProductProjectionFormTransition {
    transitionId: string;
    kind: Exclude<CharacterFormKind, "unknown">;
    channel: "passive" | "active" | "standby" | "finish";
    sourceCardId: string;
    targetCardId: string;
    sourceSkillId: string;
    sourceSkillSetId: string | null;
    sourceStateIds: string[];
    reversible: boolean;
}

export interface CharacterStateProductProjectionDataset {
    schemaVersion: 1;
    contract: "dokkan-database-character-state-product-projection";
    contractVersion: typeof CHARACTER_STATE_PRODUCT_PROJECTION_CONTRACT_VERSION;
    mode: "explicit_opt_in_offline_local_supported_only";
    source: CharacterStateProductProjectionLineage;
    policy: {
        structuralIdsOnly: true;
        presentationIncluded: false;
        supportedOnly: true;
        unknownIncluded: false;
        partialIncluded: false;
        k7ProductionCoverageFiltersRecords: false;
        characterArrayIncluded: false;
        characterArrayReturned: false;
        characterArrayModified: false;
        consumerImplemented: false;
        applyOrOverlayImplemented: false;
        authoritySelected: false;
        productionModified: false;
        publisherImplemented: false;
        networkEnabled: false;
        androidImplemented: false;
    };
    states: CharacterStateProductProjectionState[];
    releaseTransitions: CharacterStateProductProjectionReleaseTransition[];
    awakeningTransitions: CharacterStateProductProjectionAwakeningTransition[];
    formTransitions: CharacterStateProductProjectionFormTransition[];
}

export interface CharacterStateProductProjectionCoverage {
    schemaVersion: 1;
    contract: "dokkan-database-character-state-product-projection-coverage";
    contractVersion: typeof CHARACTER_STATE_PRODUCT_PROJECTION_CONTRACT_VERSION;
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
    k7ProductionCoverage: { agreement: number; unjoinable: number; use: "coverage_only" };
    excludedStructuralIds: {
        stateIds: string[];
        releaseTransitionIds: string[];
        awakeningTransitionIds: string[];
        formTransitionIds: string[];
        limitPerScope: typeof CHARACTER_STATE_PRODUCT_PROJECTION_SAMPLE_LIMIT;
    };
}

export interface CharacterStateProductProjectionValidation {
    schemaVersion: 1;
    contract: "dokkan-database-character-state-product-projection-validation";
    contractVersion: typeof CHARACTER_STATE_PRODUCT_PROJECTION_CONTRACT_VERSION;
    valid: boolean;
    failures: string[];
    failuresTruncated: boolean;
    sizes: {
        rawMaximumBytesExclusive: number;
        gzipMaximumBytesExclusive: number;
        metadataMaximumBytesExclusive: number;
        rawSizeBytes: number;
        gzipSizeBytes: number;
        metadataSizeBytes: number;
    };
    safety: {
        duplicateStructuralIdCount: number;
        unstableOrderCount: number;
        missingStateReferenceCount: number;
        unsupportedRecordCount: number;
        extraOrPresentationFieldCount: number;
        characterArrayRecordCount: 0;
        networkRequestCount: 0;
        outputNamespaceThreatModel: "caller_controlled_stable_during_operation";
    };
    readiness: {
        offlineGeneration: "GO";
        sourceBoundValidation: "NOT_EXECUTED";
        consumer: "NO-GO";
        applyOrOverlay: "NO-GO";
        authority: "NO-GO";
        production: "NO-GO";
        publisher: "NO-GO";
        r2: "NO-GO";
        android: "NO-GO";
        fyiRemoval: "NO-GO";
        dokkanInfoRemoval: "NO-GO";
    };
}

export interface CharacterStateProductProjectionManifest {
    schemaVersion: 1;
    contract: "dokkan-database-character-state-product-projection-manifest";
    contractVersion: typeof CHARACTER_STATE_PRODUCT_PROJECTION_CONTRACT_VERSION;
    fileName: string;
    compression: "gzip";
    sha256: string;
    sizeBytes: number;
    uncompressedSha256: string;
    uncompressedSizeBytes: number;
    counts: { states: number; releaseTransitions: number; awakeningTransitions: number; formTransitions: number };
    source: CharacterStateProductProjectionLineage;
    coverageFile: typeof CHARACTER_STATE_PRODUCT_PROJECTION_FILES.coverage;
    coverageSha256: string;
    coverageSizeBytes: number;
    validationFile: typeof CHARACTER_STATE_PRODUCT_PROJECTION_FILES.validation;
    validationSha256: string;
    validationSizeBytes: number;
}

export interface CharacterStateProductProjectionArtifactSet {
    dataset: CharacterStateProductProjectionDataset;
    coverage: CharacterStateProductProjectionCoverage;
    validation: CharacterStateProductProjectionValidation;
    manifest: CharacterStateProductProjectionManifest;
    raw: Buffer;
    gzip: Buffer;
    coverageBytes: Buffer;
    validationBytes: Buffer;
    manifestBytes: Buffer;
}
