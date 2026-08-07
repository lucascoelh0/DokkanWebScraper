export type ServerS5SidecarKind = "schedule" | "banners" | "server_roots" | "reward_joins" | "asset_delivery";

export interface ServerS5Source {
    gate: "s1" | "s2" | "s3" | "s4";
    contractVersion: string;
    sha256: string;
    sizeBytes: number;
}

export interface ServerS5SidecarPayload {
    schemaVersion: 1;
    contract: string;
    contractVersion: "1.0.0";
    kind: ServerS5SidecarKind;
    generatedAt: string;
    fetchedAt: string | null;
    source: ServerS5Source;
    authority: "community_dynamic_shadow" | "derived_static_shadow";
    optional: true;
    defaultEnabled: false;
    data: unknown;
}

export interface ServerS5SidecarManifest {
    schemaVersion: 1;
    contractVersion: "1.0.0";
    kind: ServerS5SidecarKind;
    generatedAt: string;
    fetchedAt: string | null;
    dynamic: boolean;
    ttlSeconds: number | null;
    payloadFileName: string;
    payloadObjectKey: string;
    payloadSha256: string;
    payloadSizeBytes: number;
    source: ServerS5Source;
    cachePolicy: "revalidate_after_ttl" | "content_addressed_immutable";
    compatibility: {
        missing: "ignore_sidecar_continue_database_first";
        stale: "ignore_sidecar_continue_database_first" | "not_applicable_content_addressed";
        unknownSchemaOrContract: "reject_sidecar_continue_database_first";
        lineageMismatch: "reject_sidecar_continue_database_first";
    };
}

export interface ServerS5RegistryEntry {
    kind: ServerS5SidecarKind;
    optional: true;
    defaultEnabled: false;
    manifestFileName: string;
    manifestObjectKey: string;
    manifestSha256: string;
    manifestSizeBytes: number;
    payloadFileName: string;
    payloadSha256: string;
    payloadSizeBytes: number;
    dynamic: boolean;
    ttlSeconds: number | null;
}

export interface ServerS5Registry {
    schemaVersion: 1;
    contract: "dokkan-server-sidecar-registry";
    contractVersion: "0.6.0";
    generatedAt: string;
    generatedAtPolicy: "latest_input_derivation_time";
    defaultEnabled: false;
    productionMutation: false;
    sidecars: ServerS5RegistryEntry[];
    consumerFallback: "existing_database_first_and_scraper_pipeline";
}

export interface ServerS5Coverage {
    schemaVersion: 1;
    sidecarCount: 5;
    dynamicSidecarCount: 2;
    staticSidecarCount: 3;
    contentAddressedPayloadCount: 5;
    ttlSidecarCount: 2;
    defaultEnabledSidecarCount: 0;
    optionalSidecarCount: 5;
    networkRequestCount: 0;
}

export interface ServerS5Validation {
    schemaVersion: 1;
    valid: boolean;
    deterministic: boolean;
    independentPayloads: boolean;
    contentAddressed: boolean;
    ttlOnlyDynamic: boolean;
    failClosedCompatibility: boolean;
    absentCompatible: boolean;
    failures: string[];
}

export interface ServerS5Manifest {
    schemaVersion: 1;
    contractVersion: "0.6.0";
    generatedAt: string;
    fileName: "server-s5-registry.json";
    compression: "none";
    sha256: string;
    sizeBytes: number;
    sidecarManifests: Array<{ kind: ServerS5SidecarKind; fileName: string; sha256: string; sizeBytes: number }>;
    coverage: { fileName: "server-s5-coverage.json"; sha256: string; sizeBytes: number };
    validation: { fileName: "server-s5-validation.json"; sha256: string; sizeBytes: number };
}

export interface ServerS5InputGate {
    gate: ServerS5Source["gate"];
    contractVersion: string;
    sha256: string;
    sizeBytes: number;
    generatedAt: string;
    fetchedAt: string | null;
    dataset: any;
}

export interface ServerS5BuildResult {
    payloads: ServerS5SidecarPayload[];
    payloadTexts: Map<ServerS5SidecarKind, string>;
    manifests: ServerS5SidecarManifest[];
    manifestTexts: Map<ServerS5SidecarKind, string>;
    registry: ServerS5Registry;
}
