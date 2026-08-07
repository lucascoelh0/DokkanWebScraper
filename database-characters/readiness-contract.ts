export type CharacterReadinessDecisionValue = "GO" | "NO-GO";

export const CHARACTER_READINESS_DECISION_IDS = [
    "merge_disabled_infrastructure",
    "pinned_optional_generation",
    "replace_identity_state_graph",
    "replace_taxonomy_categories_links",
    "replace_leader_skills",
    "replace_passive_sa_text",
    "replace_transformations_standby_exchange",
    "replace_portraits_asset_references",
    "remove_dokkaninfo",
    "remove_dokkan_fyi",
    "publish_r2",
    "android_shadow_mode",
    "team_builder_first_party",
    "combat_calculations",
] as const;

export type CharacterReadinessDecisionId = typeof CHARACTER_READINESS_DECISION_IDS[number];

export interface CharacterReadinessDecision {
    id: CharacterReadinessDecisionId;
    decision: CharacterReadinessDecisionValue;
    rationale: string;
    evidenceGates: string[];
    prerequisites: string[];
}

export interface DatabaseCharacterReadinessDataset {
    schemaVersion: 1;
    contract: "dokkan-database-character-readiness";
    contractVersion: "1.0.0";
    generatedAt: string;
    source: { k8ReceiptSha256: string; k8ManifestSha256: string; profileId: string; snapshotVersion: string };
    status: "infrastructure_ready_consumers_disabled";
    decisions: CharacterReadinessDecision[];
    fieldAuthority: Array<{ domain: string; currentAuthority: "production" | "FYI/DokkanInfo" | "server" | "none"; databaseFirstStatus: "shadow_candidate" | "audit_only" | "unsupported"; evidence: string; promotionRequirement: string }>;
    remainingDependencies: {
        server: string[];
        fyi: string[];
        dokkanInfo: string[];
    };
    confirmedConflicts: Array<{ source: "fyi"; cardId: string; stateKey: string; availableAt: string; fields: Array<{ field: "maxLevel" | "maxSALevel"; databaseValue: number; externalValue: number }> }>;
    updateStrategy: string[];
    projectedSidecars: Array<{ gate: string; sha256: string; sizeBytes: number; uncompressedSizeBytes: number; consumerEligible: boolean }>;
    projectedTotals: { sidecarCount: number; compressedBytes: number; uncompressedBytes: number };
    policy: { productionModified: false; authorityPromoted: false; r2Published: false; androidModified: false; teamBuilderModified: false; combatImplemented: false };
}

export interface DatabaseCharacterReadinessCoverage {
    schemaVersion: 1;
    decisionCount: number;
    goCount: number;
    noGoCount: number;
    fieldAuthorityCount: number;
    confirmedConflictCardCount: number;
    confirmedConflictFieldCount: number;
    projectedSidecarCount: number;
    projectedCompressedBytes: number;
    duplicateDecisionCount: number;
}

export interface DatabaseCharacterReadinessValidation { schemaVersion: 1; valid: boolean; failures: string[] }
