import { CaptureProductEntity } from "./capture-product-contract";

export interface CaptureH4Dataset {
    schemaVersion: 1;
    contract: "dokkan-official-capture-gashas";
    contractVersion: "0.5.0";
    generatedAt: string;
    generatedAtPolicy: "latest_capture_timestamp_for_deterministic_bytes";
    collectionMode: "offline_allowlisted_product_values_no_requests";
    productionMutation: false;
    defaultEnabled: false;
    authority: "capture_observation_partial_no_commercial_or_global_summonability_authority";
    poolRepresentation: "per_gasha_observed_unions_step_association_not_claimed";
    discardedFields: string[];
    entities: CaptureProductEntity[];
}

export interface CaptureH4Validation {
    schemaVersion: 1;
    valid: boolean;
    entityCount: number;
    factCount: number;
    supportedCount: number;
    partialCount: number;
    userDerivedAuthorityCount: number;
    failures: string[];
}
