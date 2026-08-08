import { CaptureEndpointClass } from "./capture-h0-contract";

export type CaptureEvidenceStatus = "supported" | "partial" | "unknown";

export interface CaptureFactProvenance {
    captureId: string;
    captureFingerprint: string;
    captureSchemaFingerprint: string;
    normalizedEndpoint: string;
    method: string;
    captureTimestamp: string;
    observedAtStart: string;
    observedAtEnd: string;
    httpStatus: number;
    jsonPath: string;
    endpointClassification: CaptureEndpointClass;
    confidence: CaptureEvidenceStatus;
    userDerivedAuthority: false;
    evidenceOrigin: "official_capture_sanitized_schema" | "official_capture_allowlisted_product_value";
}

export interface CaptureH2Fact {
    factId: string;
    factKind: "response_schema_presence";
    schemaType: string;
    provenance: CaptureFactProvenance;
}

export interface CaptureH2Dataset {
    schemaVersion: 1;
    contract: "dokkan-official-capture-fact-provenance";
    contractVersion: "0.3.0";
    generatedAt: string;
    generatedAtPolicy: "latest_capture_timestamp_for_deterministic_bytes";
    collectionMode: "offline_sanitized_h1_no_requests";
    productionMutation: false;
    authority: "observed_schema_only_no_product_or_user_authority";
    identityPolicy: "fact_hash_uses_capture_schema_and_structural_endpoint_status_json_path_no_names_or_text";
    facts: CaptureH2Fact[];
}

export interface CaptureH2Validation {
    schemaVersion: 1;
    valid: boolean;
    factCount: number;
    supportedCount: number;
    partialCount: number;
    unknownCount: number;
    userDerivedAuthorityCount: number;
    failures: string[];
}
