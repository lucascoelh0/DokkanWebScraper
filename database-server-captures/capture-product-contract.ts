export type CaptureProductValue = string | number | boolean | null | string[] | number[];

export interface CaptureProductFactProvenance {
    captureId: string;
    captureFingerprint: string;
    captureSchemaFingerprint: string;
    captureSourceIdentityFingerprint: string;
    capturePublicValueFingerprint: string;
    normalizedEndpoint: string;
    method: "GET";
    captureTimestamp: string;
    observedAt: string;
    httpStatus: number;
    jsonPath: string;
    endpointClassification: "product_catalog" | "mixed_product_and_user_state";
    confidence: "partial";
    userDerivedAuthority: false;
    evidenceOrigin: "official_capture_allowlisted_product_value";
    valueEvidenceSha256: string;
}

export interface CaptureProductFact {
    factId: string;
    field: string;
    value: CaptureProductValue;
    provenance: CaptureProductFactProvenance;
}

export interface CaptureProductEntity {
    entityType: string;
    entityId: number;
    facts: CaptureProductFact[];
}

export interface CaptureProductResponseContext {
    captureId: string;
    captureFingerprint: string;
    captureSchemaFingerprint: string;
    captureSourceIdentityFingerprint: string;
    captureTimestamp: string;
    normalizedEndpoint: string;
    method: "GET";
    observedAt: string;
    httpStatus: number;
    endpointClassification: "product_catalog" | "mixed_product_and_user_state" | "asset_delivery";
    hostname: "ishin-global.aktsk.com" | "cf.ishin-global.aktsk.com";
    pathname: string;
    body: unknown;
}
