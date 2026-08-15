import type { CharacterLeaderScopeK3Identity, CharacterLeaderScopeK43Identity } from "./leader-scope-contract";

export const CHARACTER_LEADER_PROJECTION_CONTRACT_VERSION = "1.0.0" as const;
export const CHARACTER_LEADER_PROJECTION_RAW_LIMIT_BYTES = 16 * 1024 * 1024;
export const CHARACTER_LEADER_PROJECTION_GZIP_LIMIT_BYTES = 2 * 1024 * 1024;
export const CHARACTER_LEADER_PROJECTION_METADATA_LIMIT_BYTES = 64 * 1024;
export const CHARACTER_LEADER_PROJECTION_RSS_LIMIT_BYTES = 1024 * 1024 * 1024;
export const CHARACTER_LEADER_PROJECTION_SAMPLE_LIMIT = 5 as const;
export const CHARACTER_LEADER_PROJECTION_REPEAT_PIN = {
    effectReferences: 0,
    targetReferences: 12_720,
} as const;

export const CHARACTER_LEADER_PROJECTION_FILES = {
    coverage: "database-characters-k46-leader-projection-coverage.json",
    validation: "database-characters-k46-leader-projection-validation.json",
    manifest: "database-characters-k46-leader-projection-manifest.json",
} as const;

export interface CharacterLeaderProjectionLineage {
    k45: {
        contractVersion: "1.0.0";
        structuralScope: "GO";
        nextStructuralIdOnlyProjection: "GO";
        k43SourceBoundBeforeAndAfter: "GO";
    };
    k43: CharacterLeaderScopeK43Identity;
    k3: CharacterLeaderScopeK3Identity;
}

export interface CharacterLeaderProjectionRowRef { table: string; rowId: string }

export interface CharacterLeaderProjectionState {
    stateId: string;
    sourceStateKey: string;
    cardId: string;
    releaseState: "initial" | "eza" | "seza";
    leader: {
        set: CharacterLeaderProjectionRowRef;
        effects: CharacterLeaderProjectionRowRef[];
        targets: CharacterLeaderProjectionRowRef[];
    };
}

export interface CharacterLeaderProjectionDataset {
    schemaVersion: 1;
    contract: "dokkan-database-character-leader-structural-projection";
    contractVersion: typeof CHARACTER_LEADER_PROJECTION_CONTRACT_VERSION;
    mode: "explicit_opt_in_offline_local_structural_ids_only";
    source: CharacterLeaderProjectionLineage;
    policy: {
        structuralIdsOnly: true;
        sourceReferenceOrderAndMultiplicityPreserved: true;
        referencesDeduplicated: false;
        effectTargetAssociationsSelected: false;
        percentValuesIncluded: false;
        presentationIncluded: false;
        semanticsSelected: false;
        rawRowsIncluded: false;
        characterArrayIncluded: false;
        consumerImplemented: false;
        applyOrOverlayImplemented: false;
        authoritySelected: false;
        productionModified: false;
        publisherImplemented: false;
        networkEnabled: false;
        r2Enabled: false;
        androidImplemented: false;
    };
    states: CharacterLeaderProjectionState[];
}

export interface CharacterLeaderProjectionCoverage {
    schemaVersion: 1;
    contract: "dokkan-database-character-leader-structural-projection-coverage";
    contractVersion: typeof CHARACTER_LEADER_PROJECTION_CONTRACT_VERSION;
    states: { included: number; excluded: number };
    leaderReferences: {
        uniqueSetRows: number;
        effectReferences: number;
        targetReferences: number;
        multiEffectStates: number;
        multiTargetStates: number;
        maximumEffectsPerState: number;
        maximumTargetsPerState: number;
        emptyEffectStates: number;
        emptyTargetStates: number;
        repeatedEffectReferences: number;
        repeatedTargetReferences: number;
    };
    excludedStateIds: string[];
    excludedStateIdLimit: typeof CHARACTER_LEADER_PROJECTION_SAMPLE_LIMIT;
}

export interface CharacterLeaderProjectionValidation {
    schemaVersion: 1;
    contract: "dokkan-database-character-leader-structural-projection-validation";
    contractVersion: typeof CHARACTER_LEADER_PROJECTION_CONTRACT_VERSION;
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
        duplicateStateIdCount: number;
        repeatedEffectReferenceCount: number;
        repeatedTargetReferenceCount: number;
        unstableStateOrderCount: number;
        extraOrPresentationFieldCount: number;
        percentValueFieldCount: number;
        characterArrayRecordCount: 0;
        networkRequestCount: 0;
        automaticCleanupAttempted: false;
        outputNamespaceThreatModel: "caller_controlled_stable_during_operation";
    };
    readiness: {
        offlineGeneration: "GO";
        sourceBoundValidation: "NOT_EXECUTED";
        consumer: "NO-GO";
        leaderClauseSemantics: "NO-GO";
        presentation: "NO-GO";
        applyOrOverlay: "NO-GO";
        authority: "NO-GO";
        production: "NO-GO";
        publisher: "NO-GO";
        network: "NO-GO";
        r2: "NO-GO";
        android: "NO-GO";
    };
}

export interface CharacterLeaderProjectionManifest {
    schemaVersion: 1;
    contract: "dokkan-database-character-leader-structural-projection-manifest";
    contractVersion: typeof CHARACTER_LEADER_PROJECTION_CONTRACT_VERSION;
    fileName: string;
    compression: "gzip";
    sha256: string;
    sizeBytes: number;
    uncompressedSha256: string;
    uncompressedSizeBytes: number;
    counts: { states: number; uniqueSetRows: number; effectReferences: number; targetReferences: number };
    source: CharacterLeaderProjectionLineage;
    coverageFile: typeof CHARACTER_LEADER_PROJECTION_FILES.coverage;
    coverageSha256: string;
    coverageSizeBytes: number;
    validationFile: typeof CHARACTER_LEADER_PROJECTION_FILES.validation;
    validationSha256: string;
    validationSizeBytes: number;
}

export interface CharacterLeaderProjectionArtifactSet {
    dataset: CharacterLeaderProjectionDataset;
    coverage: CharacterLeaderProjectionCoverage;
    validation: CharacterLeaderProjectionValidation;
    manifest: CharacterLeaderProjectionManifest;
    raw: Buffer;
    gzip: Buffer;
    coverageBytes: Buffer;
    validationBytes: Buffer;
    manifestBytes: Buffer;
}
