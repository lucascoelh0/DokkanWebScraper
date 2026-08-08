export type CaptureEndpointClass =
    | "product_catalog"
    | "mixed_product_and_user_state"
    | "user_state"
    | "mutation"
    | "auth"
    | "asset_delivery";

export type CaptureTargetHostClass = "official_api" | "official_cdn";

export interface CaptureInputManifest {
    schemaVersion: 1;
    inputRoot: string;
    captures: Array<{
        captureId: string;
        path: string;
    }>;
}

export interface CaptureH0EndpointInventory {
    hostClass: CaptureTargetHostClass;
    method: string;
    normalizedEndpoint: string;
    classification: CaptureEndpointClass;
    count: number;
    statusCodes: number[];
    queryKeys: string[];
}

export interface CaptureH0Inventory {
    captureId: string;
    structuralFingerprint: string;
    schemaFingerprint: string;
    duplicateOf: string | null;
    sizeBytes: number;
    capturedAtStart: string | null;
    capturedAtEnd: string | null;
    entryCount: number;
    targetEntryCount: number;
    nonTargetEntryCount: number;
    classificationCounts: Record<CaptureEndpointClass, number>;
    endpoints: CaptureH0EndpointInventory[];
}

export interface CaptureH0Dataset {
    schemaVersion: 1;
    contract: "dokkan-official-capture-structural-inventory";
    contractVersion: "0.1.0";
    generatedAt: string;
    generatedAtPolicy: "latest_capture_timestamp_for_deterministic_bytes";
    collectionMode: "offline_local_har_no_requests";
    productionMutation: false;
    authority: "structural_evidence_only_no_user_derived_authority";
    pathPolicy: "logical_allowlisted_root_relative_regular_files_only";
    fingerprintPolicy: "structural_sha256_excludes_values_headers_and_bodies_schema_sha256_remains_separate";
    captures: CaptureH0Inventory[];
    duplicateGroups: string[][];
}
