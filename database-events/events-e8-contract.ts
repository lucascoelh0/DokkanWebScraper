export type EventsE8SidecarKey = "event_catalog" | "stage_topology" | "encounters" | "boss_mechanics" | "rewards" | "asset_references";

export interface EventsE8RefreshProfile {
    schemaVersion: 1;
    contract: "dokkan-events-database-first-refresh-profile";
    contractVersion: "0.9.0";
    profileId: string;
    baselineFiles: Array<{ role: "e0_inventory" | "e3_goldens" | "e4_native_evidence" | "e6_apk"; fileName: string; sha256: string }>;
    requiredSources: { database: { sizeBytes: number; sha256: string }; elf: { sizeBytes: number; sha256: string }; apk: { sizeBytes: number; sha256: string } };
}

export interface EventsE8SidecarInput {
    key: EventsE8SidecarKey;
    role: string;
    gate: 1 | 2 | 3 | 4 | 5 | 6;
    contractVersion: string;
    manifestFileName: string;
    payload: { fileName: string; sha256: string; sizeBytes: number };
    coverage: { fileName: string; sha256: string; sizeBytes: number; counts: Record<string, unknown> };
    validation: { fileName: string; sha256: string; sizeBytes: number; value: Record<string, unknown> };
    lineage: Record<string, string | number>;
}

export interface EventsE8Registry {
    schemaVersion: 1;
    contract: "dokkan-events-database-first-sidecars";
    contractVersion: "0.9.0";
    generatedAt: string;
    generatedAtPolicy: "pinned_to_source_snapshot_for_reproducible_bytes";
    sourceSnapshotVersion: string;
    sourceDatabaseSha256: string;
    refreshProfile: { profileId: string; sha256: string };
    sourceAnchors: {
        inventory: { contractVersion: "0.1.0"; fileName: string; sha256: string; sizeBytes: number };
        elf: { sha256: string; sizeBytes: number; nativeEvidenceSha256: string };
        apk: { sha256: string; sizeBytes: number; apkBaselineSha256: string };
    };
    delivery: { optional: true; defaultPipelineEnabled: false; productionReplacement: false; r2Published: false; androidConsumed: false };
    sidecars: EventsE8SidecarInput[];
}

export interface EventsE8RefreshReceipt {
    schemaVersion: 1;
    contract: "dokkan-events-database-first-refresh-receipt";
    contractVersion: "0.9.0";
    generatedAt: string;
    sourceSnapshotVersion: string;
    sourceDatabaseSha256: string;
    refreshProfileSha256: string;
    executionPolicy: "focused_sequential_isolated_processes";
    gateOrder: ["E0", "E1", "E2", "E3", "E4", "E5", "E6", "E8"];
    refreshedSidecars: Array<{ key: EventsE8SidecarKey; sha256: string; sizeBytes: number }>;
    result: "validated_optional_artifacts";
}

export interface EventsE8Coverage { schemaVersion: 1; sidecarCount: number; totalPayloadBytes: number; payloadBytesBySidecar: Record<EventsE8SidecarKey, number>; sourceCoverage: Record<EventsE8SidecarKey, Record<string, unknown>>; invalidValidationCount: number; danglingIdCount: number }
export interface EventsE8Validation { schemaVersion: 1; valid: boolean; exactProjection: boolean; allPayloadHashesValid: boolean; allCoverageHashesValid: boolean; allValidationHashesValid: boolean; allSourceValidationsGreen: boolean; lineageChainValid: boolean; refreshProfileValid: boolean; failures: string[] }
export interface EventsE8Manifest { schemaVersion: 1; contractVersion: "0.9.0"; generatedAt: string; generatedAtPolicy: "pinned_to_source_snapshot_for_reproducible_bytes"; sourceSnapshotVersion: string; fileName: "events-sidecars.json"; compression: "none"; sha256: string; sizeBytes: number; sourceDatabaseSha256: string; refreshProfileSha256: string; coverage: { fileName: "events-e8-coverage.json"; sha256: string; sizeBytes: number }; validation: { fileName: "events-e8-validation.json"; sha256: string; sizeBytes: number }; refreshReceipt: { fileName: "events-e8-refresh-receipt.json"; sha256: string; sizeBytes: number } }
