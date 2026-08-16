export type WtEvidenceClass = "global" | "account_scoped" | "opaque" | "partial" | "unknown" | "unjoinable";
export type WtSchemaType = "array" | "boolean" | "null" | "number" | "object" | "string";

export interface WtExternalSourceLock {
    schemaVersion: 1;
    contract: "dokkan-world-tournament-external-source-lock";
    contractVersion: "0.1.0";
    sourceId: "world-tournament-until-start-crash-2026-08-16";
    fileName: "world_tournament_until_start_crash.har";
    sizeBytes: number;
    sha256: string;
    entryCount: number;
}

export interface WtSchemaNode { path: string; types: WtSchemaType[] }
export type WtBodyDisposition = "absent" | "schema_only" | "opaque_envelope_schema_only" | "binary_or_unparsed_not_retained";

export interface Wt0Entry {
    entryIndex: number;
    method: "GET" | "POST";
    route: string;
    status: number;
    classification: WtEvidenceClass;
    traffic: "read_observed" | "mutation_observed_not_replayable";
    queryKeyNames: string[];
    requestBodyDisposition: WtBodyDisposition;
    responseBodyDisposition: WtBodyDisposition;
    requestSchema: WtSchemaNode[];
    responseSchema: WtSchemaNode[];
}

export interface Wt0CacheRelation {
    route: string;
    sourceEntryIndex: number;
    notModifiedEntryIndex: number;
    validatorKind: "etag" | "last_modified";
    exactUrlMatched: true;
    validatorMatched: true;
}

export interface Wt0SecretScan {
    capturedSensitiveValueCount: number;
    exactCapturedValueMatches: number;
    genericSecretPatternMatches: number;
    valid: boolean;
}
export interface Wt0StructuralId {
    kind: "budokai" | "budokai_map" | "box_ranking" | "bonus_schedule" | "mission" | "script" | "quest";
    id: number;
    sourcePath: string;
    classification: WtEvidenceClass;
    observedEntryIndexes: number[];
}

export interface Wt0Dataset {
    schemaVersion: 1;
    contract: "dokkan-world-tournament-offline-inventory";
    contractVersion: "0.1.0";
    collectionMode: "offline_local_har_no_requests_no_replay";
    defaultEnabled: false;
    productionMutation: false;
    source: Omit<WtExternalSourceLock, "fileName">;
    observedEntryCount: number;
    retainedEntryCount: number;
    excludedNonWtEntryCount: number;
    unclassifiedWtEntryCount: number;
    entries: Wt0Entry[];
    structuralIds: Wt0StructuralId[];
    cacheRelations: Wt0CacheRelation[];
    exclusions: string[];
    secretScan: Wt0SecretScan;
}

export interface Wt0Validation { schemaVersion: 1; valid: boolean; failures: string[]; retainedEntryCount: number; cacheRelationCount: number }
