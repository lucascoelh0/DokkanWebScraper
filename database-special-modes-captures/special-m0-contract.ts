export type SpecialCaptureId = "burst-mode-2026-08-10" | "pettan-not-live-2026-08-10";
export type SpecialScope = "global_product" | "mixed_product_account" | "account_scoped" | "authentication" | "asset_delivery" | "unknown";
export type SpecialTrafficClass = "read_observed" | "mutation_observed" | "authentication" | "asset_read" | "unknown";
export type SpecialBodyRepresentation = "absent" | "json_identity" | "binary_base64" | "cache_not_modified_304" | "zstandard_base64" | "encoded_unknown" | "identity_non_json";

export interface SpecialM0CaptureLock { captureId: SpecialCaptureId; fileName: string; sizeBytes: number; sha256: string; entryCount: number }
export interface SpecialM0SourceLock { schemaVersion: 1; contract: "dokkan-special-modes-offline-source-lock"; contractVersion: "0.1.0"; captureRoot: "special-modes-2026-08-10"; captures: SpecialM0CaptureLock[] }
export interface SpecialM0Body { mimeType: string; sizeBytes: number; representation: SpecialBodyRepresentation }
export interface SpecialM0Entry {
    captureId: SpecialCaptureId;
    entryIndex: number;
    capturedAt: string | null;
    hostClass: "official_api" | "official_cdn" | "unknown";
    method: string;
    normalizedPath: string;
    status: number;
    scope: SpecialScope;
    trafficClass: SpecialTrafficClass;
    queryKeyNames: string[];
    sensitiveRequestHeaderNames: string[];
    sensitiveResponseHeaderNames: string[];
    request: SpecialM0Body;
    response: SpecialM0Body;
}
export interface SpecialM0Dataset {
    schemaVersion: 1;
    contract: "dokkan-special-modes-offline-inventory";
    contractVersion: "0.1.0";
    generatedAt: string;
    generatedAtPolicy: "latest_capture_timestamp";
    collectionMode: "offline_local_har_no_requests_no_replay";
    defaultEnabled: false;
    productionMutation: false;
    replayCapability: false;
    valuePolicy: "metadata_and_names_only_no_header_query_cookie_or_body_values";
    sources: SpecialM0CaptureLock[];
    entries: SpecialM0Entry[];
}
export interface SpecialM0Validation {
    schemaVersion: 1;
    valid: boolean;
    entryCount: number;
    captureCounts: Record<SpecialCaptureId, number>;
    mutationObservedCount: number;
    representationCounts: Record<SpecialBodyRepresentation, number>;
    zstandardBodyCount: number;
    failures: string[];
}
