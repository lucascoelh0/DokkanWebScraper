export type CaptureH6AssetExtension = "png" | "jpg" | "db";
export type CaptureH6ReferenceKind = "product_json_reference" | "client_database_url" | "captured_cdn_request";
export type CaptureH6DeliveryEvidence = "reference_only" | "http_2xx_response_observed" | "http_304_revalidation_observed";

export interface CaptureH6Provenance {
    captureId: string;
    captureFingerprint: string;
    captureSchemaFingerprint: string;
    captureSourceIdentityFingerprint: string;
    capturePublicValueFingerprint: string;
    captureTimestamp: string;
    observedAt: string;
    hostClass: "official_api" | "official_cdn";
    normalizedEndpoint: string;
    endpointClassification: "product_catalog" | "mixed_product_and_user_state" | "asset_delivery";
    method: "GET";
    httpStatus: number;
    jsonPath: string;
    confidence: "partial";
    userDerivedAuthority: false;
    evidenceOrigin: "official_capture_allowlisted_asset_evidence";
    valueEvidenceSha256: string;
}

export interface CaptureH6AssetObservation {
    observationId: string;
    assetPath: string;
    assetPathSha256: string;
    extension: CaptureH6AssetExtension;
    referenceKind: CaptureH6ReferenceKind;
    deliveryEvidence: CaptureH6DeliveryEvidence;
    provenance: CaptureH6Provenance;
}

export interface CaptureH6DatabaseDescriptor {
    descriptorId: string;
    version: number;
    algorithm: string;
    upstreamHashOpaque: string;
    assetPath: string;
    provenance: CaptureH6Provenance;
}

export interface CaptureH6Dataset {
    schemaVersion: 1;
    contract: "dokkan-official-capture-asset-evidence";
    contractVersion: "0.7.0";
    generatedAt: string;
    generatedAtPolicy: "latest_capture_timestamp_for_deterministic_bytes";
    collectionMode: "offline_allowlisted_references_and_captured_requests_no_requests";
    productionMutation: false;
    defaultEnabled: false;
    authority: "capture_observation_partial_no_current_availability_or_content_completeness_authority";
    queryDisposition: "omitted_all_query_names_and_values";
    cdnBodyDisposition: "omitted_no_asset_bytes_persisted";
    joinPolicy: "exact_sanitized_asset_path_only_no_inferred_identity";
    observations: CaptureH6AssetObservation[];
    databaseDescriptors: CaptureH6DatabaseDescriptor[];
}

export interface CaptureH6Validation {
    schemaVersion: 1;
    valid: boolean;
    observationCount: number;
    databaseDescriptorCount: number;
    referenceCount: number;
    capturedCdnRequestCount: number;
    exactReferenceWithCaptured2xxPathCount: number;
    exactReferenceWithCaptured304PathCount: number;
    userDerivedAuthorityCount: number;
    failures: string[];
}
