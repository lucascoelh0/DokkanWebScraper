import { SpecialSourceSpan } from "./special-m1-contract";
export type SpecialM4Status = "supported" | "partial" | "unknown";
export interface SpecialM4Fact { key: string; domain: "pettan" | "burst" | "join"; status: SpecialM4Status; sourceArtifact: "m1" | "m2" | "m3"; sourcePointer: string; sourceSpans: SpecialSourceSpan[]; valueFingerprint: string; boundary: string }
export interface SpecialM4Dataset {
    schemaVersion: 1;
    contract: "dokkan-special-modes-lossless-sanitized-facts";
    contractVersion: "0.5.0";
    generatedAt: string;
    generatedAtPolicy: "inherits_m3_capture_timestamp";
    collectionMode: "validated_local_sanitized_artifacts_no_network";
    defaultEnabled: false;
    productionMutation: false;
    losslessPolicy: "one_fact_per_allowlisted_observation_fact_and_join_rebuilt_from_sources";
    statusPolicy: "supported_is_direct_identity_or_bytes_partial_is_raw_semantics_unknown_is_missing_authority_or_join";
    sourceArtifacts: Array<{ key: "m1" | "m2" | "m3"; sizeBytes: number; sha256: string }>;
    facts: SpecialM4Fact[];
    omissions: Array<{ source: "pettan" | "burst"; surface: string; reason: "account_value" | "secret_or_header" | "presentation_text" | "raw_payload" | "binary_bytes" | "opaque_signature" }>;
}
export interface SpecialM4Validation { schemaVersion: 1; valid: boolean; factCount: number; supportedCount: number; partialCount: number; unknownCount: number; sourceSpanCount: number; omissionCount: number; failures: string[] }
