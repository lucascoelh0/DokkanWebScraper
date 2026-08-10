import { SpecialSourceSpan } from "./special-m1-contract";
export type SpecialM5Classification = "agreement" | "representation_gain" | "representation_mismatch" | "coverage_gap" | "unknown" | "unjoinable" | "confirmed_conflict";
export interface SpecialM5FileLock { key: string; root: "main" | "capture"; path: string; sizeBytes: number; sha256: string }
export interface SpecialM5DirectoryLock { key: string; root: "main"; path: string; filter: "all_json" | "sdbattle_json"; fileCount: number; totalBytes: number; aggregateSha256: string }
export interface SpecialM5SourceLock { schemaVersion: 1; contract: "dokkan-special-modes-shadow-source-lock"; contractVersion: "0.6.0"; files: SpecialM5FileLock[]; directories: SpecialM5DirectoryLock[] }
export interface SpecialM5Lineage { key: string; sizeBytes: number; sha256: string; sourceKind: "file" | "directory_aggregate" }
export interface SpecialM5Fact { key: string; domain: "pettan" | "burst" | "closure" | "cache"; classification: SpecialM5Classification; unitCount: number; sourceSpans: SpecialSourceSpan[]; reason: string }
export interface SpecialM5Dataset {
    schemaVersion: 1;
    contract: "dokkan-special-modes-shadow-parity";
    contractVersion: "0.6.0";
    generatedAt: string;
    generatedAtPolicy: "inherits_m4_capture_timestamp";
    collectionMode: "validated_local_artifacts_and_current_caches_no_network";
    defaultEnabled: false;
    productionMutation: false;
    identityPolicy: "numeric_structural_ids_only_representation_differences_never_conflicts";
    aggregatePolicy: "exclusive_fact_rows_with_typed_non_equivalent_unit_counts";
    m4ArtifactSha256: string;
    m4ArtifactSizeBytes: number;
    sourceLineage: SpecialM5Lineage[];
    closure: { e0e9: true; s0s7: true; h0h13: true; h13ConfirmedConflictCount: 0 };
    currentCaches: { dokkanInfoEventFileCount: number; dokkanInfoSdbattleFileCount: number; stageCatalogEntryCount: number; frontierSeriesCount: number; frontierChapterCount: number };
    facts: SpecialM5Fact[];
    totals: Record<SpecialM5Classification, number>;
    complete: false;
}
export interface SpecialM5Validation { schemaVersion: 1; valid: boolean; factCount: number; unitCount: number; byClassification: Record<SpecialM5Classification, number>; confirmedConflictCount: number; sourceCount: number; failures: string[] }
