import { CaptureEndpointClass, CaptureTargetHostClass } from "./capture-h0-contract";

export type CaptureBodyDisposition = "absent" | "schema_only" | "omitted_by_classification" | "non_json_or_unavailable_omitted";

export interface CaptureH1SchemaObservation {
    hostClass: CaptureTargetHostClass;
    method: string;
    normalizedEndpoint: string;
    classification: CaptureEndpointClass;
    status: number;
    count: number;
    capturedAtStart: string | null;
    capturedAtEnd: string | null;
    queryKeys: string[];
    requestBodyDisposition: CaptureBodyDisposition;
    responseBodyDisposition: CaptureBodyDisposition;
    requestSchema: string[];
    responseSchema: string[];
}

export interface CaptureH1Dataset {
    schemaVersion: 1;
    contract: "dokkan-official-capture-schema-only-sanitizer";
    contractVersion: "0.2.0";
    generatedAt: string;
    generatedAtPolicy: "latest_capture_timestamp_for_deterministic_bytes";
    collectionMode: "offline_local_har_no_requests";
    productionMutation: false;
    valueFixtureCount: 0;
    authority: "schema_only_no_user_derived_authority";
    sanitization: {
        headers: "omitted";
        cookies: "omitted";
        queryValues: "omitted_key_names_only";
        sensitiveAndUnknownBodyKeys: "collapsed_before_output";
        authMutationUserRequestBodies: "omitted";
        valueFixtures: "deny_by_default_explicit_public_product_allowlist_required";
    };
    captures: Array<{
        captureId: string;
        structuralFingerprint: string;
        schemaFingerprint: string;
        observations: CaptureH1SchemaObservation[];
    }>;
}

export interface CaptureSecretScanResult {
    schemaVersion: 1;
    valid: boolean;
    captureSecretValueCount: number;
    targetCount: number;
    exactCapturedSecretMatches: number;
    genericSecretPatternMatches: number;
    failingTargets: string[];
}
