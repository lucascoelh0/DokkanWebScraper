export type ServerS2Status = "supported" | "partial" | "unknown";
export type ServerS2JoinStatus = "supported" | "unjoinable" | "not_applicable";

export interface ServerS2IdentitySet {
    key: string;
    kind: string;
    ids: string[];
    source: string;
    authority: "sqlite_first_party" | "community_shadow" | "native_static_evidence";
}

export interface ServerS2Join {
    key: string;
    leftSet: string;
    rightSet: string | null;
    joinKey: string | null;
    status: ServerS2JoinStatus;
    matchedCount: number;
    unmatchedCount: number;
    boundary: string;
}

export interface ServerS2Family {
    key: "super_battle_road" | "ultimate_clash" | "world_tournament" | "burst_mode" | "pettan_battle";
    productLabel: string;
    semanticStatus: ServerS2Status;
    rootStatus: ServerS2Status;
    resolution: "already_database_rooted" | "candidate_ids_without_root" | "database_rooted_runtime_unknown" | "root_unknown" | "community_roots_without_database_join";
    identitySets: ServerS2IdentitySet[];
    joins: ServerS2Join[];
    evidence: Array<{ source: string; locator: string; observation: string; status: ServerS2Status }>;
    missing: string[];
}

export interface ServerS2SourceLineage {
    key: "events_e1" | "events_e2" | "events_e7" | "dokkaninfo_family_cache";
    path: string;
    sha256: string;
    sizeBytes: number;
    authority: "sqlite_first_party" | "community_shadow";
}

export interface ServerS2Dataset {
    schemaVersion: 1;
    contract: "dokkan-server-root-resolution";
    contractVersion: "0.3.0";
    generatedAt: string;
    generatedAtPolicy: "pinned_to_static_evidence_checkpoint";
    sourceSnapshotVersion: string;
    collectionMode: "local_static_and_cached_evidence_no_network";
    identityPolicy: {
        structuralIdsOnly: true;
        titleJoinAllowed: false;
        overlappingNumericNamespacesJoinAutomatically: false;
        remotePresentationAuthority: false;
    };
    sourceLineage: ServerS2SourceLineage[];
    families: ServerS2Family[];
    semanticCorrections: Array<{ priorClaim: string; correctedClaim: string; impact: string }>;
}

export interface ServerS2Coverage {
    schemaVersion: 1;
    familyCount: number;
    supportedRootFamilyCount: number;
    partialOrUnknownRootFamilyCount: number;
    supportedJoinCount: number;
    unjoinableJoinCount: number;
    structurallyMatchedIdentityCount: number;
    titleJoinCount: 0;
    networkRequestCount: 0;
}

export interface ServerS2Validation {
    schemaVersion: 1;
    valid: boolean;
    deterministic: boolean;
    structuralIdsOnly: boolean;
    sqliteAuthorityPreserved: boolean;
    numericNamespaceIsolationPreserved: boolean;
    failures: string[];
}

export interface ServerS2Manifest {
    schemaVersion: 1;
    contractVersion: "0.3.0";
    generatedAt: string;
    generatedAtPolicy: "pinned_to_static_evidence_checkpoint";
    fileName: "server-s2-roots.json";
    compression: "none";
    sha256: string;
    sizeBytes: number;
    sourceSnapshotVersion: string;
    sourceLineageAggregateSha256: string;
    coverage: { fileName: "server-s2-coverage.json"; sha256: string; sizeBytes: number };
    validation: { fileName: "server-s2-validation.json"; sha256: string; sizeBytes: number };
}

export interface ServerS2Observation {
    sourceSnapshotVersion: string;
    sourceLineage: ServerS2SourceLineage[];
    areaIds: string[];
    budokaiIds: string[];
    rmbattleCandidateIds: string[];
    questLevelsByArea: Record<string, string[]>;
    sdMapIds: string[];
    sdbattleRootIds: string[];
    challengeRoots: Array<{ id: string; type: string; stageIds: string[]; presentationName: string }>;
    e7Families: Array<{ family: string; eventCount: number; joinedRootCount: number; joinedStageCount: number; rootTarget: string | null; rootClassification: string }>;
    unrootedTables: Array<{ table: string; rowCount: number }>;
}
