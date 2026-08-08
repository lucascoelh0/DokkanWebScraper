import { CaptureProductEntity } from "./capture-product-contract";

export interface CaptureH5Dataset {
    schemaVersion: 1;
    contract: "dokkan-official-capture-mission-boards";
    contractVersion: "0.6.0";
    generatedAt: string;
    generatedAtPolicy: "latest_capture_timestamp_for_deterministic_bytes";
    collectionMode: "offline_allowlisted_product_values_no_requests";
    productionMutation: false;
    defaultEnabled: false;
    authority: "capture_observation_partial_no_progress_completion_or_reward_grant_authority";
    missionArrayDisposition: "discarded_as_progress_wrapper_including_mission_ids";
    rewardRepresentation: "display_reward_id_reference_only_no_contents_quantity_or_grant_semantics";
    discardedFields: string[];
    entities: CaptureProductEntity[];
}

export interface CaptureH5Validation {
    schemaVersion: 1;
    valid: boolean;
    entityCount: number;
    factCount: number;
    supportedCount: number;
    partialCount: number;
    userDerivedAuthorityCount: number;
    failures: string[];
}
