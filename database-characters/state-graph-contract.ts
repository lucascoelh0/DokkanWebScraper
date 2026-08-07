import { CharacterEvidenceStatus } from "./identity-contract";

export type CharacterAwakeningKind = "z_awaken" | "dokkan_awaken" | "eza" | "seza" | "unknown";
export type CharacterFormKind = "transformation" | "giant_or_rage" | "reversible_exchange" | "unknown";

export interface CharacterGraphState {
    stateId: string;
    sourceStateKey: string;
    cardId: string;
    releaseState: "initial" | "eza" | "seza" | "unknown";
    growthRowId?: string;
    growthStep?: number;
    hardDuplicateGroupId: string;
}

export interface CharacterAwakeningTransition {
    transitionId: string;
    kind: CharacterAwakeningKind;
    sourceCardId: string;
    targetCardId: string;
    sourceStateId?: string;
    targetStateId?: string;
    targetStatus: CharacterEvidenceStatus;
    cardIdentityPolicy: "collapse_z_awakened_ui_duplicate" | "preserve_distinct_card_identity" | "same_card_release_progression" | "unknown";
    route: { table: "card_awakening_routes"; rowId: string; rawType: unknown; optimalAwakeningType: unknown; optimalAwakeningStep: unknown };
}

export interface CharacterFormTransition {
    transitionId: string;
    kind: CharacterFormKind;
    channel: "passive" | "active" | "standby" | "finish";
    sourceCardId: string;
    targetCardId: string;
    sourceSkillId: string;
    sourceSkillSetId?: string;
    sourceStateIds: string[];
    stateBindingStatus: CharacterEvidenceStatus;
    reversible: boolean;
    source: { table: string; rowId: string; columns: string[] };
}

export interface CharacterReleaseStateTransition {
    transitionId: string;
    cardId: string;
    sourceStateId: string;
    targetStateId: string;
    releaseState: "eza" | "seza" | "unknown";
    growthRowId: string;
    growthStep: number;
    evidenceStatus: CharacterEvidenceStatus;
    routeRowIds: string[];
}

export interface DatabaseCharacterStateGraphDataset {
    schemaVersion: 1;
    contract: "dokkan-database-characters-state-graph";
    contractVersion: "1.0.0";
    generatedAt: string;
    source: { snapshotVersion: string; databaseSha256: string; db1ArtifactSha256: string; lineage: "validated-db1-stream-no-db0-db50-replay" };
    policy: {
        numericIdProximityInference: false;
        cardIdentitySeparateFromPlayableState: true;
        uiGroupingSeparateFromCardIdentity: true;
        originalRarityOwnedByTaxonomySidecar: true;
    };
    states: CharacterGraphState[];
    releaseStateTransitions: CharacterReleaseStateTransition[];
    awakeningTransitions: CharacterAwakeningTransition[];
    formTransitions: CharacterFormTransition[];
}

export interface DatabaseCharacterStateGraphCoverage {
    schemaVersion: 1;
    stateCount: number;
    releaseStateTransitionCounts: Record<"eza" | "seza" | "unknown", number>;
    awakeningTransitionCounts: Record<CharacterAwakeningKind, number>;
    formTransitionCounts: Record<CharacterFormKind, number>;
    formChannelCounts: Record<"passive" | "active" | "standby" | "finish", number>;
    supportedFormStateBindingCount: number;
    partialFormStateBindingCount: number;
    unknownFormStateBindingCount: number;
    danglingAwakeningTargetIds: string[];
    duplicateTransitionIdentityCount: number;
    duplicateStateIdentityCount: number;
}

export interface DatabaseCharacterStateGraphValidation { schemaVersion: 1; valid: boolean; stateCount: number; transitionCount: number; failures: string[] }
