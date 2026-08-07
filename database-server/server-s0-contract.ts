export type ServerEvidenceStatus = "supported" | "partial" | "unknown";
export type ServerSourceClass = "official_client" | "community_structured" | "community_html" | "community_cdn" | "project_delivery";
export type ServerCollectionGate = "discover_only" | "eligible_get_probe" | "prohibited" | "reference_only";

export interface ServerS0Evidence {
    id: string;
    kind: "apk" | "native_elf" | "repository_file" | "local_cache" | "historical_observation";
    path: string;
    sha256: string | null;
    sizeBytes: number | null;
    status: ServerEvidenceStatus;
    containsSensitiveValues: boolean;
    note: string;
}

export interface ServerS0Host {
    key: string;
    host: string;
    sourceClass: ServerSourceClass;
    relationship: "embedded_in_official_client" | "used_by_repository" | "project_owned";
    status: ServerEvidenceStatus;
    authority: "candidate_dynamic_authority" | "shadow_only" | "delivery_mirror_only" | "project_sidecar_delivery_only";
}

export interface ServerS0Endpoint {
    key: string;
    hostKey: string;
    pathPattern: string;
    observedMethod: "GET" | "UNKNOWN";
    format: "json" | "html_with_embedded_json" | "html" | "binary" | "unknown";
    sourceClass: ServerSourceClass;
    status: ServerEvidenceStatus;
    domains: Array<"versions" | "schedule" | "availability" | "maintenance" | "banners" | "rewards" | "server_roots" | "asset_delivery">;
    collectionGate: ServerCollectionGate;
    evidence: Array<{ evidenceId: string; locator: string; observation: string }>;
    boundary: string;
}

export interface ServerS0Header {
    name: string;
    classification: "secret" | "pseudonymous" | "version" | "locale" | "transport";
    logPolicy: "redact_value" | "allow_value";
    evidenceId: string;
    evidenceLocator: string;
    requiredStatus: "unknown";
}

export interface ServerS0Catalog {
    schemaVersion: 1;
    contract: "dokkan-server-source-catalog";
    contractVersion: "0.1.0";
    generatedAt: string;
    generatedAtPolicy: "pinned_to_static_evidence_checkpoint";
    baselineCommit: string;
    sourceSnapshotVersion: string;
    collectionMode: "static_inventory_no_network_capture";
    authorityPolicy: {
        staticIdentity: "sqlite_first_party";
        dynamicState: "official_server_only_when_structurally_proven";
        communitySources: "shadow_and_gap_evidence_only";
        textIdentityAllowed: false;
        absentFieldsDefaulted: false;
    };
    evidence: ServerS0Evidence[];
    hosts: ServerS0Host[];
    endpoints: ServerS0Endpoint[];
    headers: ServerS0Header[];
    boundaries: Array<{ key: string; status: "partial" | "unknown"; stopCondition: string }>;
}

export interface ServerS0Coverage {
    schemaVersion: 1;
    evidenceCount: number;
    hostCount: number;
    endpointCount: number;
    endpointCountsByGate: Record<ServerCollectionGate, number>;
    officialEndpointCount: number;
    sensitiveHeaderCount: number;
    dynamicOfficialAuthorityCount: number;
    networkRequestCount: 0;
}

export interface ServerS0Validation {
    schemaVersion: 1;
    valid: boolean;
    deterministic: boolean;
    staticOnly: boolean;
    sensitiveHeadersRedacted: boolean;
    mutableEndpointsProhibited: boolean;
    failures: string[];
}

export interface ServerS0Manifest {
    schemaVersion: 1;
    contractVersion: "0.1.0";
    generatedAt: string;
    generatedAtPolicy: "pinned_to_static_evidence_checkpoint";
    fileName: "server-s0-catalog.json";
    compression: "none";
    sha256: string;
    sizeBytes: number;
    sourceSnapshotVersion: string;
    baselineCommit: string;
    coverage: { fileName: "server-s0-coverage.json"; sha256: string; sizeBytes: number };
    validation: { fileName: "server-s0-validation.json"; sha256: string; sizeBytes: number };
}
