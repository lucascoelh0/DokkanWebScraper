import { SqliteInspection } from "../database-experiment/sqlite-readonly-adapter";

export type IntegrationC4Gate = "DB48" | "DB49" | "DB50";
export interface IntegrationC4Baseline {
    schemaVersion: 1; contractVersion: "1.0.0"; snapshotVersion: string;
    sourceDatabase: { sha256: string; sizeBytes: number; tableCount: number; schemaSha256: string; requiredTables: Record<string, string[]> };
    nativeRuntime: { sha256: string; sizeBytes: number; elfClass: 64; endian: "little"; machine: 183 };
    semanticInputs: Record<IntegrationC4Gate, { contractVersion: string; sha256: string }>;
}
export interface IntegrationC4Fingerprint { sha256: string; sizeBytes: number; modifiedAtMs: number }
export interface IntegrationC4Observed {
    sourceDatabase: IntegrationC4Fingerprint & { tableCount: number; schemaSha256: string; inspection: SqliteInspection };
    nativeRuntime: IntegrationC4Fingerprint & { elfClass: number; endian: string; machine: number };
    semanticInputs: Record<IntegrationC4Gate, { contractVersion: string; sha256: string; sourceDatabaseSha256: string; nativeRuntimeSha256: string }>;
}
export type IntegrationC4IssueCode = "database_hash_changed" | "database_size_changed" | "database_schema_changed" | "required_table_or_column_missing" | "native_hash_changed" | "native_size_changed" | "native_format_changed" | "semantic_artifact_changed" | "semantic_artifact_source_mismatch";
export interface IntegrationC4Issue { code: IntegrationC4IssueCode; subject: string; expected: unknown; actual: unknown }
export interface IntegrationC4CompatibilityReport {
    schemaVersion: 1; contract: "dokkan-database-first-focused-refresh-compatibility"; contractVersion: "1.0.0";
    snapshotVersion: string; status: "compatible" | "incompatible"; reusePolicy: "exact_evidence_identity_only";
    issues: IntegrationC4Issue[]; sourceDatabase: Omit<IntegrationC4Observed["sourceDatabase"], "inspection">; nativeRuntime: IntegrationC4Observed["nativeRuntime"];
}
export interface IntegrationC4Receipt {
    schemaVersion: 1; contract: "dokkan-database-first-focused-refresh"; contractVersion: "1.0.0"; generatedAt: string; snapshotVersion: string;
    mode: "focused_c1_c2_c3_no_db0_db50_replay"; compatibilityReportSha256: string;
    inputs: { sourceDatabaseSha256: string; nativeRuntimeSha256: string; schemaSha256: string; semanticArtifacts: Record<IntegrationC4Gate, string> };
    outputs: { c1Sha256: string; c2Sha256: string; c3Sha256: string };
    readOnlySourceGuarantee: true;
}
export interface IntegrationC4ReceiptExpectation {
    generatedAt: string; snapshotVersion: string; compatibilityReportSha256: string;
    sourceDatabaseSha256: string; nativeRuntimeSha256: string; schemaSha256: string;
    semanticArtifacts: Record<IntegrationC4Gate, string>; c1Sha256: string; c2Sha256: string; c3Sha256: string;
}
export interface IntegrationC4Manifest { schemaVersion: 1; contractVersion: "1.0.0"; generatedAt: string; fileName: "database-first-update-c4-receipt.json"; sha256: string; sizeBytes: number; compatibilityFile: "database-first-update-c4-compatibility.json" }
export interface IntegrationC4Validation { schemaVersion: 1; valid: boolean; compatibilityExact: boolean; receiptExact: boolean; mutationRejectionCount: number; failures: string[] }
