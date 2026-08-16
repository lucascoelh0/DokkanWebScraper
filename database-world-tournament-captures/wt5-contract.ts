export type Wt5ComparisonStatus = "agreement" | "coverage_gap" | "unknown" | "unjoinable";

export interface Wt5SourceLock {
    schemaVersion: 1;
    contract: "dokkan-world-tournament-shadow-source-lock";
    contractVersion: "0.6.0";
    files: Array<{ key: string; root: "main" | "capture"; path: string; sizeBytes: number; sha256: string }>;
    database: { fileName: "dokkan-global-current.db"; sizeBytes: number; sha256: string };
}

export interface Wt5Lineage {
    key: string;
    sourceKind: "validated_artifact" | "sqlite_snapshot" | "wt_gate";
    contractVersion: string;
    sizeBytes: number;
    sha256: string;
}

export interface Wt5Comparison {
    key: string;
    left: string;
    right: string;
    joinKey: string | null;
    structuralIds: number[];
    classification: "global" | "account_scoped" | "opaque" | "partial" | "unknown" | "unjoinable";
    status: Wt5ComparisonStatus;
    matchedCount: number;
    boundary: string;
}

export interface Wt5Dataset {
    schemaVersion: 1;
    contract: "dokkan-world-tournament-shadow-parity";
    contractVersion: "0.6.0";
    collectionMode: "offline_pinned_structural_ids_only_no_requests";
    productionMutation: false;
    defaultEnabled: false;
    identityPolicy: "numeric_structural_ids_only_names_and_texts_never_identity";
    sourceLockSha256: string;
    lineage: Wt5Lineage[];
    sourceCoverage: Array<{
        series: "E0-E9" | "H0-H13" | "S0-S7" | "SQLite";
        status: "direct_and_pinned" | "via_pinned_closure";
        boundary: string;
    }>;
    comparisons: Wt5Comparison[];
    rewards: {
        definitions: { status: "observed_definition" | "coverage_gap"; coordinates: Array<{ kind: "budokai_mission" | "budokai_box_ranking"; id: number }>; observedCount: number };
        granted: { status: "unknown"; observed: false; boundary: "no_reward_grant_or_claim_observed" };
    };
    totals: Record<Wt5ComparisonStatus, number>;
}

export interface Wt5Validation {
    schemaVersion: 1;
    valid: boolean;
    failures: string[];
    comparisonCount: number;
    totals: Record<Wt5ComparisonStatus, number>;
}

export interface Wt5SqliteEvidence {
    schemaVersion: 1;
    contract: "dokkan-world-tournament-sqlite-structural-evidence";
    contractVersion: "0.6.0";
    collectionMode: "private_pinned_snapshot_sqlite_uri_mode_ro_query_only";
    identityPolicy: "numeric_structural_ids_only_no_text_columns";
    tablePresence: Record<"budokais" | "budokai_missions" | "budokai_box_rankings" | "budokai_maps", boolean>;
    budokaiIds: number[];
    missionLinks: Array<{ missionId: number; budokaiId: number }>;
    boxRankingLinks: Array<{ boxRankingId: number; budokaiId: number }>;
    mapLinks: Array<{ mapId: number; budokaiId: number }>;
}

export interface Wt5Sources {
    files: Map<string, any>;
    sqlite: Wt5SqliteEvidence;
    lineage: Wt5Lineage[];
}
