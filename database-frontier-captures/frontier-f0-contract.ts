export type FrontierF0TrafficClass = "read_product" | "mutation_observed" | "cdn" | "authentication" | "account_state" | "telemetry" | "unknown";
export type FrontierF0Scope = "global_product" | "mixed_product_account" | "account_scoped" | "authentication" | "asset_delivery" | "telemetry" | "unknown";

export interface FrontierF0SourceLock {
    schemaVersion: 1;
    contract: "dokkan-frontier-offline-capture-source-lock";
    contractVersion: "0.1.0";
    captureRoot: "dokkan-har-0810";
    captureId: "frontier-2026-08-10";
    fileName: "frontier.har";
    sizeBytes: number;
    sha256: string;
    entryCount: number;
}

export interface FrontierF0Entry {
    entryIndex: number;
    capturedAt: string | null;
    hostClass: "official_api" | "official_cdn" | "telemetry" | "unknown";
    method: string;
    normalizedPath: string;
    status: number;
    trafficClass: FrontierF0TrafficClass;
    scope: FrontierF0Scope;
    queryKeyNames: string[];
    requestMimeType: string;
    responseMimeType: string;
    requestBodyBytes: number;
    responseBodyBytes: number;
    responseContentEncoding: "base64" | "identity" | "unknown";
    sensitiveRequestHeaderNames: string[];
    sensitiveResponseHeaderNames: string[];
}

export interface FrontierF0Dataset {
    schemaVersion: 1;
    contract: "dokkan-frontier-offline-capture-inventory";
    contractVersion: "0.1.0";
    generatedAt: string;
    generatedAtPolicy: "latest_capture_timestamp_for_deterministic_bytes";
    collectionMode: "offline_local_har_no_requests_no_replay";
    productionMutation: false;
    defaultEnabled: false;
    authority: "structural_observation_only_no_account_or_product_authority";
    source: { captureId: string; fileName: string; sizeBytes: number; sha256: string; entryCount: number };
    entries: FrontierF0Entry[];
}

export interface FrontierF0Validation {
    schemaVersion: 1;
    valid: boolean;
    entryCount: number;
    targetHostEntryCount: number;
    trafficClassCounts: Record<FrontierF0TrafficClass, number>;
    scopeCounts: Record<FrontierF0Scope, number>;
    failures: string[];
}
