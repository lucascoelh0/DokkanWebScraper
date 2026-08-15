import type { CharacterLeaderAssociationK3Identity, CharacterLeaderAssociationK46Identity } from "./leader-association-scope-contract";

export const CHARACTER_LEADER_ASSOCIATION_PROJECTION_CONTRACT_VERSION = "1.0.0" as const;
export const CHARACTER_LEADER_ASSOCIATION_PROJECTION_RAW_LIMIT_BYTES = 16 * 1024 * 1024;
export const CHARACTER_LEADER_ASSOCIATION_PROJECTION_GZIP_LIMIT_BYTES = 2 * 1024 * 1024;
export const CHARACTER_LEADER_ASSOCIATION_PROJECTION_METADATA_LIMIT_BYTES = 64 * 1024;
export const CHARACTER_LEADER_ASSOCIATION_PROJECTION_RSS_LIMIT_BYTES = 1024 * 1024 * 1024;
export const CHARACTER_LEADER_ASSOCIATION_PROJECTION_SAMPLE_LIMIT = 5 as const;

export const CHARACTER_LEADER_ASSOCIATION_PROJECTION_FILES = {
    coverage: "database-characters-k48-leader-association-projection-coverage.json",
    validation: "database-characters-k48-leader-association-projection-validation.json",
    manifest: "database-characters-k48-leader-association-projection-manifest.json",
} as const;

export interface CharacterLeaderAssociationProjectionLineage {
    k47: {
        contractVersion: "1.0.0";
        structuralAssociationScope: "GO";
        nextStructuralIdAssociationProjection: "GO";
    };
    k46: CharacterLeaderAssociationK46Identity;
    k3: CharacterLeaderAssociationK3Identity;
}

export interface CharacterLeaderAssociationProjectionRef { table: string; rowId: string }
export interface CharacterLeaderAssociationProjectionEffect {
    effect: { table: "leader_skills"; rowId: string };
    targetSetId: string | null;
    targets: Array<{ table: "sub_target_types"; rowId: string }>;
}
export interface CharacterLeaderAssociationProjectionState {
    stateId: string;
    sourceStateKey: string;
    cardId: string;
    releaseState: "initial" | "eza" | "seza";
    leader: {
        set: CharacterLeaderAssociationProjectionRef;
        effects: CharacterLeaderAssociationProjectionEffect[];
    };
}

export interface CharacterLeaderAssociationProjectionDataset {
    schemaVersion: 1;
    contract: "dokkan-database-character-leader-association-structural-projection";
    contractVersion: typeof CHARACTER_LEADER_ASSOCIATION_PROJECTION_CONTRACT_VERSION;
    mode: "explicit_opt_in_offline_local_structural_ids_only";
    source: CharacterLeaderAssociationProjectionLineage;
    policy: {
        structuralIdsOnly: true;
        sourceOrderAndMultiplicityPreserved: true;
        redundantFlatTargetsIncluded: false;
        percentTextRawOrValueIncluded: false;
        semanticAssociationSelected: false;
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
    states: CharacterLeaderAssociationProjectionState[];
}

export interface CharacterLeaderAssociationProjectionCoverage {
    schemaVersion: 1;
    contract: "dokkan-database-character-leader-association-structural-projection-coverage";
    contractVersion: typeof CHARACTER_LEADER_ASSOCIATION_PROJECTION_CONTRACT_VERSION;
    states: { included: number; excluded: number };
    uniqueLeaderSetRows: number;
    effectAssociations: number;
    targetReferences: number;
    uniqueTargetReferencesWithinState: number;
    repeatedTargetReferences: number;
    repetitionsFromRepeatedTargetSetExpansion: number;
    missingEffectRows: number;
    missingTargetRows: number;
    flattenedTargetMismatchStates: number;
    excludedStateIds: string[];
    excludedStateIdLimit: typeof CHARACTER_LEADER_ASSOCIATION_PROJECTION_SAMPLE_LIMIT;
}

export interface CharacterLeaderAssociationProjectionValidation {
    schemaVersion: 1;
    contract: "dokkan-database-character-leader-association-structural-projection-validation";
    contractVersion: typeof CHARACTER_LEADER_ASSOCIATION_PROJECTION_CONTRACT_VERSION;
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
        unstableStateOrderCount: number;
        extraOrPresentationFieldCount: number;
        redundantFlatTargetFieldCount: number;
        nullTargetSetWithTargetsCount: number;
        percentTextRawOrValueFieldCount: number;
        characterArrayRecordCount: 0;
        networkRequestCount: 0;
        automaticCleanupAttempted: false;
        outputNamespaceThreatModel: "caller_controlled_stable_during_operation";
    };
    readiness: {
        offlineGeneration: "GO";
        sourceBoundValidation: "NOT_EXECUTED";
        semanticAssociation: "NO-GO";
        leaderClauseSemantics: "NO-GO";
        presentation: "NO-GO";
        productReplacement: "NO-GO";
        consumer: "NO-GO";
        applyOrOverlay: "NO-GO";
        authority: "NO-GO";
        production: "NO-GO";
        publisher: "NO-GO";
        network: "NO-GO";
        r2: "NO-GO";
        android: "NO-GO";
    };
}

export interface CharacterLeaderAssociationProjectionManifest {
    schemaVersion: 1;
    contract: "dokkan-database-character-leader-association-structural-projection-manifest";
    contractVersion: typeof CHARACTER_LEADER_ASSOCIATION_PROJECTION_CONTRACT_VERSION;
    fileName: string;
    compression: "gzip";
    sha256: string;
    sizeBytes: number;
    uncompressedSha256: string;
    uncompressedSizeBytes: number;
    counts: { states: number; effectAssociations: number; targetReferences: number; repeatedTargetReferences: number };
    source: CharacterLeaderAssociationProjectionLineage;
    coverageFile: typeof CHARACTER_LEADER_ASSOCIATION_PROJECTION_FILES.coverage;
    coverageSha256: string;
    coverageSizeBytes: number;
    validationFile: typeof CHARACTER_LEADER_ASSOCIATION_PROJECTION_FILES.validation;
    validationSha256: string;
    validationSizeBytes: number;
}

export interface CharacterLeaderAssociationProjectionArtifactSet {
    dataset: CharacterLeaderAssociationProjectionDataset;
    coverage: CharacterLeaderAssociationProjectionCoverage;
    validation: CharacterLeaderAssociationProjectionValidation;
    manifest: CharacterLeaderAssociationProjectionManifest;
    raw: Buffer;
    gzip: Buffer;
    coverageBytes: Buffer;
    validationBytes: Buffer;
    manifestBytes: Buffer;
}
