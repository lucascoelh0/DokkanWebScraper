export type CaptureH7DecisionStatus = "GO" | "NO_GO" | "UNRESOLVED";
export type CaptureH7MetricClassification = "agreement" | "representationGain" | "confirmedConflict" | "unknown" | "unjoinable";

export interface CaptureH7SourceLineage {
    key: string;
    sourceClass: "capture_sidecar" | "database_server" | "database_events";
    artifactPath: string;
    artifactContract: string;
    artifactContractVersion: string;
    artifactSizeBytes: number;
    artifactSha256: string;
    manifestPath: string | null;
    manifestSha256: string | null;
    validationSha256: string | null;
}

export interface CaptureH7Comparison {
    key: string;
    left: string;
    right: string;
    unit: string;
    basis: string;
    includedInTotals: boolean;
    counts: Record<CaptureH7MetricClassification, number>;
    boundary: string;
}

export interface CaptureH7Decision {
    key: string;
    status: CaptureH7DecisionStatus;
    rationale: string;
    exitCriteria: string[];
}

export interface CaptureH7Dataset {
    schemaVersion: 1;
    contract: "dokkan-official-capture-shadow-readiness";
    contractVersion: "0.8.0";
    generatedAt: string;
    generatedAtPolicy: "latest_capture_timestamp_for_deterministic_bytes";
    collectionMode: "offline_pinned_artifact_comparison_no_requests";
    productionMutation: false;
    defaultEnabled: false;
    authority: "shadow_parity_only_zero_conflicts_does_not_prove_completeness";
    aggregationPolicy: "non_exclusive_sum_of_comparison_cells_units_may_overlap";
    externalSourceLockPath: "database-server-captures/capture-h7-source-lock.json";
    externalSourceLockSha256: string;
    sourceLineage: CaptureH7SourceLineage[];
    comparisons: CaptureH7Comparison[];
    comparisonCellTotals: Record<CaptureH7MetricClassification, number>;
    decisions: CaptureH7Decision[];
}

export interface CaptureH7Validation {
    schemaVersion: 1;
    valid: boolean;
    sourceCount: number;
    comparisonCount: number;
    decisionCount: number;
    comparisonCellTotals: Record<CaptureH7MetricClassification, number>;
    failures: string[];
}
