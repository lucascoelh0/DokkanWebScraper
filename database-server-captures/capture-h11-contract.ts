import { CaptureH13Counts } from "./capture-h13-contract";

export type CaptureH11Class = "agreement" | "representationGain" | "temporalChange" | "representationMismatch" | "coverageGap" | "confirmedConflict" | "unknown" | "unjoinable";
export interface CaptureH11Counts { agreement: number; representationGain: number; temporalChange: number; representationMismatch: number; coverageGap: number; confirmedConflict: number; unknown: number; unjoinable: number; }
export interface CaptureH11Comparison { key: string; left: string; right: string; unit: string; includedInTotals: boolean; counts: CaptureH11Counts; boundary: string; }
export interface CaptureH11SourceCoverage { series: string; gates: string; status: "direct_pinned" | "via_h7_pinned_lineage" | "not_directly_comparable" | "not_available"; boundary: string; }
export interface CaptureH11Dataset {
    schemaVersion: 1;
    contract: "dokkan-official-capture-extension-shadow-parity";
    contractVersion: "0.12.1";
    generatedAt: string;
    generatedAtPolicy: "inherits_h10_capture_timestamp";
    collectionMode: "offline_pinned_shadow_comparison_no_requests";
    productionMutation: false;
    defaultEnabled: false;
    authority: "shadow_only_zero_conflicts_does_not_prove_completeness";
    aggregationPolicy: "non_exclusive_comparison_cells_may_overlap";
    sourceLockSha256: string;
    sourceCoverage: CaptureH11SourceCoverage[];
    comparisons: CaptureH11Comparison[];
    comparisonCellTotals: CaptureH11Counts;
    uniqueGashaAuditFactCount: 627;
    uniqueGashaAuditCounts: CaptureH13Counts;
    legacyUniqueGashaConflictFactCount: 627;
    legacyNonExclusiveGashaConflictCellCount: 1254;
}
export interface CaptureH11Validation { schemaVersion: 1; valid: boolean; comparisonCount: number; comparisonCellTotals: CaptureH11Counts; uniqueGashaAuditFactCount: number; sourceCoverageCount: number; failures: string[]; }
