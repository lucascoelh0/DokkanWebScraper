export type CaptureH8TrafficClass = "read" | "mutation" | "telemetry" | "cdn" | "unknown";

export interface CaptureH8Entry {
    entryIndex: number;
    hostClass: "official_api" | "official_cdn" | "telemetry" | "unknown";
    method: string;
    normalizedPath: string;
    trafficClass: CaptureH8TrafficClass;
    status: number;
    requestMimeType: string;
    responseMimeType: string;
    requestBodyBytes: number;
    responseBodyBytes: number;
    capturedAt: string | null;
    sensitiveRequestHeaderNames: string[];
    sensitiveResponseHeaderNames: string[];
    representation: "body_observed" | "not_modified_body_omitted" | "body_absent";
}

export interface CaptureH8Inventory {
    captureId: string;
    fileName: string;
    sizeBytes: number;
    entryCount: number;
    capturedAtStart: string | null;
    capturedAtEnd: string | null;
    structuralSha256: string;
    sourceIdentityFingerprint: string;
    exactDuplicateOf: string | null;
    entries: CaptureH8Entry[];
}

export interface CaptureH8Overlap {
    leftCaptureId: string;
    rightCaptureId: string;
    leftRouteCount: number;
    rightRouteCount: number;
    sharedRouteCount: number;
    unionRouteCount: number;
}

export interface CaptureH8Dataset {
    schemaVersion: 1;
    contract: "dokkan-official-capture-extension-inventory";
    contractVersion: "0.9.0";
    generatedAt: string;
    generatedAtPolicy: "latest_capture_timestamp_for_deterministic_bytes";
    collectionMode: "offline_local_har_no_requests";
    productionMutation: false;
    defaultEnabled: false;
    authority: "structural_observation_only_no_account_or_product_authority";
    exactDuplicatePolicy: "raw_bytes_compared_in_memory_digest_not_persisted";
    inputManifestSha256: string;
    captures: CaptureH8Inventory[];
    exactDuplicateGroups: string[][];
    overlaps: CaptureH8Overlap[];
}

export interface CaptureH8Validation {
    schemaVersion: 1;
    valid: boolean;
    captureCount: number;
    entryCount: number;
    trafficClassCounts: Record<CaptureH8TrafficClass, number>;
    exactDuplicateGroupCount: number;
    failures: string[];
}
