import type { CharacterLeaderScopeK3Identity, CharacterLeaderScopeK43Identity } from "./leader-scope-contract";

export const CHARACTER_LEADER_ASSOCIATION_SCOPE_CONTRACT_VERSION = "1.0.0" as const;
export const CHARACTER_LEADER_ASSOCIATION_SCOPE_REPORT_LIMIT_BYTES = 64 * 1024;
export const CHARACTER_LEADER_ASSOCIATION_SCOPE_RSS_LIMIT_BYTES = 1024 * 1024 * 1024;
export const CHARACTER_LEADER_ASSOCIATION_SCOPE_SAMPLE_LIMIT = 5 as const;

export const CHARACTER_LEADER_ASSOCIATION_SCOPE_PIN = {
    states: 10_651,
    effectAssociations: 49_435,
    flattenedTargetReferences: 34_914,
    uniqueTargetReferencesWithinState: 22_194,
    repeatedFlattenedTargetReferences: 12_720,
    repetitionsFromRepeatedTargetSetExpansion: 12_720,
    missingEffectRows: 0,
    missingTargetRows: 0,
    flattenedTargetMismatchStates: 0,
} as const;

export interface CharacterLeaderAssociationRawEffect { rowId: string; targetSetId: string | null }
export interface CharacterLeaderAssociationRawTarget { rowId: string; targetSetId: string }

export interface CharacterLeaderAssociationK3State {
    stateId: string;
    sourceStateKey: string;
    cardId: string;
    releaseState: "initial" | "eza" | "seza" | "unknown";
    effectRowIds: string[];
    flattenedTargetRowIds: string[];
}

export interface CharacterLeaderAssociationK3Identity {
    profileId: string;
    snapshotVersion: string;
    manifest: { sha256: string; sizeBytes: number };
    artifact: { sha256: string; sizeBytes: number; uncompressedSizeBytes: number; uncompressedSha256: string };
    coverage: { sha256: string; sizeBytes: number };
    validation: { sha256: string; sizeBytes: number };
    associationInputFingerprintSha256: string;
}

export interface CharacterLeaderAssociationK3Source {
    identity: CharacterLeaderAssociationK3Identity;
    states: CharacterLeaderAssociationK3State[];
    effects: CharacterLeaderAssociationRawEffect[];
    targets: CharacterLeaderAssociationRawTarget[];
}

export interface CharacterLeaderAssociationK46State {
    stateId: string;
    sourceStateKey: string;
    cardId: string;
    releaseState: "initial" | "eza" | "seza";
    effectRowIds: string[];
    flattenedTargetRowIds: string[];
}

export interface CharacterLeaderAssociationK46Identity {
    manifestSha256: string;
    payloadSha256: string;
    rawSha256: string;
    stateFingerprintSha256: string;
    k43: CharacterLeaderScopeK43Identity;
    k3: CharacterLeaderScopeK3Identity;
}

export interface CharacterLeaderAssociationK46Source {
    identity: CharacterLeaderAssociationK46Identity;
    states: CharacterLeaderAssociationK46State[];
    policy: {
        sourceReferenceOrderAndMultiplicityPreserved: true;
        referencesDeduplicated: false;
        effectTargetAssociationsSelected: false;
    };
    coverage: {
        states: number;
        effects: number;
        targets: number;
        repeatedEffects: number;
        repeatedTargets: number;
    };
}

export interface CharacterLeaderEffectTargetAssociation {
    effectRowId: string;
    targetSetId: string | null;
    targetRowIds: string[];
}

export interface CharacterLeaderAssociationScopeEvaluation {
    states: number;
    effectAssociations: number;
    flattenedTargetReferences: number;
    uniqueTargetReferencesWithinState: number;
    repeatedFlattenedTargetReferences: number;
    repetitionsFromRepeatedTargetSetExpansion: number;
    missingEffectRows: number;
    missingTargetRows: number;
    flattenedTargetMismatchStates: number;
    samples: {
        repeatedStateIds: string[];
        repeatedTargetSetIds: string[];
        effectsWithoutTargetSetIds: string[];
        limitPerKind: typeof CHARACTER_LEADER_ASSOCIATION_SCOPE_SAMPLE_LIMIT;
    };
}

export interface CharacterLeaderAssociationScopeReport {
    schemaVersion: 1;
    contract: "dokkan-database-character-leader-effect-target-association-scope-audit";
    contractVersion: typeof CHARACTER_LEADER_ASSOCIATION_SCOPE_CONTRACT_VERSION;
    mode: "offline_local_explicit_opt_in_stdout_only";
    sources: { k46: CharacterLeaderAssociationK46Identity; k3: CharacterLeaderAssociationK3Identity };
    policy: {
        structuralIdsOnly: true;
        sourceOrderAndMultiplicityPreserved: true;
        flattenedTargetsComparedByteExact: true;
        repetitionsExplainedByRepeatedTargetSetExpansion: true;
        semanticAssociationSelected: false;
        percentTextOrValueIncluded: false;
        payloadWritten: false;
        consumerImplemented: false;
        applyOrOverlayImplemented: false;
        authoritySelected: false;
        productionModified: false;
        publisherImplemented: false;
        networkEnabled: false;
        r2Enabled: false;
        androidImplemented: false;
    };
    scope: CharacterLeaderAssociationScopeEvaluation;
    inputIntegrity: {
        k46SourceBoundBefore: "GO" | "NOT_EXECUTED";
        k46SourceBoundAfter: "GO" | "NOT_EXECUTED";
        k46IdentityAndFingerprintStable: boolean;
        k3ExactPinnedBeforeAndAfter: boolean;
        k3AssociationFingerprintStable: boolean;
        k3DecodeBoundedToPinnedRawSize: boolean;
        reportTimestampIncluded: false;
        reportMaximumBytesExclusive: typeof CHARACTER_LEADER_ASSOCIATION_SCOPE_REPORT_LIMIT_BYTES;
        rssMaximumBytesExclusive: typeof CHARACTER_LEADER_ASSOCIATION_SCOPE_RSS_LIMIT_BYTES;
    };
    readiness: {
        structuralAssociationScope: "GO" | "NOT_EXECUTED";
        nextStructuralIdAssociationProjection: "GO" | "NOT_EXECUTED";
        semanticAssociation: "NO-GO";
        leaderClauseSemantics: "NO-GO";
        presentation: "NO-GO";
        productProjection: "NO-GO";
        consumer: "NO-GO";
        applyOrOverlay: "NO-GO";
        authority: "NO-GO";
        production: "NO-GO";
        writer: "NO-GO";
        publisher: "NO-GO";
        network: "NO-GO";
        r2: "NO-GO";
        android: "NO-GO";
    };
}
