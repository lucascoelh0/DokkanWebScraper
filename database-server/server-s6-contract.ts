export type ServerS6Classification = "agreement" | "representation_gain" | "confirmed_conflict" | "unknown" | "unjoinable";

export interface ServerS6Counts {
    agreement: number;
    representationGain: number;
    confirmedConflict: number;
    unknown: number;
    unjoinable: number;
}

export interface ServerS6SourceLineage {
    key: "server_s1" | "server_s2" | "server_s3" | "server_s4" | "server_s5" | "fyi_summons_implementation" | "summons_index_cache" | "summons_details_cache" | "characters_manifest" | "characters_payload";
    path: string;
    contractVersion: string | null;
    sha256: string;
    sizeBytes: number;
    authority: "validated_server_gate" | "repository_implementation" | "existing_community_cache";
    generatedAt: string | null;
}

export interface ServerS6Subject {
    key: "active_banner_cache_delta" | "featured_character_identity" | "official_featured_relationship" | "current_schedule_authority" | "maintenance_authority" | "banner_commercial_semantics" | "sbr_root_and_stage_identity" | "ultimate_clash_root_identity" | "world_tournament_current_schedule" | "burst_mode_root_identity" | "pettan_series_map_relation" | "reward_row_identity" | "asset_reference_delivery" | "current_asset_manifest_version";
    unit: "banner_id" | "card_id" | "featured_relation" | "dimension" | "root_or_stage_id" | "root_candidate_id" | "root_id" | "candidate_row" | "series_id" | "reward_row" | "asset_reference";
    comparedCount: number;
    counts: ServerS6Counts;
    identityMaterialization: "complete" | "source_gate_only";
    identities: Partial<Record<ServerS6Classification, string[]>>;
    left: string;
    right: string;
    basis: string;
    boundary: string;
}

export interface ServerS6Dataset {
    schemaVersion: 1;
    contract: "dokkan-server-shadow-parity";
    contractVersion: "0.7.0";
    generatedAt: string;
    generatedAtPolicy: "latest_input_derivation_time";
    collectionMode: "validated_local_artifacts_no_network";
    sourceLineage: ServerS6SourceLineage[];
    subjects: ServerS6Subject[];
    totals: ServerS6Counts & { comparedCount: number; subjectCount: 14 };
    completeness: {
        proven: false;
        zeroConfirmedConflictsImpliesCompleteness: false;
        unknownOrUnjoinableCount: number;
        boundary: string;
    };
}

export interface ServerS6Validation {
    schemaVersion: 1;
    valid: boolean;
    deterministic: boolean;
    exclusiveClassifications: boolean;
    exactAccounting: boolean;
    sourceLineageComplete: boolean;
    sqliteAuthorityPreserved: boolean;
    classificationPolicyPreserved: boolean;
    zeroConflictNotCompleteness: boolean;
    failures: string[];
}

export interface ServerS6Manifest {
    schemaVersion: 1;
    contractVersion: "0.7.0";
    generatedAt: string;
    generatedAtPolicy: "latest_input_derivation_time";
    fileName: "server-s6-shadow-parity.json";
    compression: "none";
    sha256: string;
    sizeBytes: number;
    sourceLineageAggregateSha256: string;
    validation: { fileName: "server-s6-validation.json"; sha256: string; sizeBytes: number };
}

export interface ServerS6InputGate {
    gate: "s1" | "s2" | "s3" | "s4" | "s5";
    contractVersion: string;
    path: string;
    sha256: string;
    sizeBytes: number;
    generatedAt: string;
    dataset: any;
}

export interface ServerS6CacheInput {
    existingBannerIds: string[];
    characterIds: string[];
    generatedAt: string;
    sourceLineage: ServerS6SourceLineage[];
}
