import { CaptureProductEntity } from "./capture-product-contract";

export interface CaptureH3Dataset {
    schemaVersion: 1;
    contract: "dokkan-official-capture-schedules-availability";
    contractVersion: "0.4.0";
    generatedAt: string;
    generatedAtPolicy: "latest_capture_timestamp_for_deterministic_bytes";
    collectionMode: "offline_allowlisted_product_values_no_requests";
    productionMutation: false;
    defaultEnabled: false;
    authority: "capture_observation_partial_database_identity_remains_authoritative";
    discardedUserFields: string[];
    entities: CaptureProductEntity[];
}

export interface CaptureH3Validation {
    schemaVersion: 1;
    valid: boolean;
    entityCount: number;
    factCount: number;
    supportedCount: number;
    partialCount: number;
    userDerivedAuthorityCount: number;
    failures: string[];
}
