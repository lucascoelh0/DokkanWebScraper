export type EventsE9DecisionId = "merge_disabled_infrastructure" | "pinned_optional_generation" | "replace_scraped_datasets" | "publish_r2" | "android_shadow_consumption" | "event_stage_screens" | "beneficial_character_calculation" | "boss_damage_simulation";
export type EventsE9DecisionStatus = "GO" | "NO_GO";

export interface EventsE9Dataset {
    schemaVersion: 1;
    contract: "dokkan-events-database-first-readiness";
    contractVersion: "1.0.0";
    generatedAt: string;
    generatedAtPolicy: "pinned_to_source_snapshot_for_reproducible_bytes";
    sourceSnapshotVersion: string;
    sourceDatabaseSha256: string;
    sourceE7: { contractVersion: "0.8.0"; sha256: string };
    sourceE8: { contractVersion: "0.9.0"; sha256: string; refreshProfileSha256: string };
    sourceRefreshEvidence: { sha256: string };
    evidence: {
        sidecarCount: number;
        totalSidecarPayloadBytes: number;
        parityByClassification: Record<string, number>;
        confirmedConflictCount: number;
        paginationByStatus: Record<string, number>;
        mechanics: { supported: number; partial: number; unknown: number };
        assets: { pathReferences: number; numericReferences: number; bindings: number; directBaseApkPaths: number; absentBaseApkPaths: number; endpointStatus: "unknown" };
        rewards: { supportedItemReferences: number; unknownItemReferences: number };
        focusedRefresh: { comparedArtifactCount: number; observedMaxPeakWorkingSetBytes: number; memoryLimitBytes: number; byteIdentical: boolean };
    };
    decisions: Array<{ id: EventsE9DecisionId; status: EventsE9DecisionStatus; rationale: string[]; exitConditions: string[] }>;
    remainingBoundaries: Array<{ key: string; status: "partial" | "unknown" | "unjoinable"; nextAuthority: "server_api" | "runtime_consumer_proof" | "download_manifest_or_endpoint" | "android_integration" | "product_decision" | "legacy_source_contract" }>;
    checkpoint: { gatesComplete: ["E0", "E1", "E2", "E3", "E4", "E5", "E6", "E7", "E8", "E9"]; stopReason: "E0_E9_COMPLETE"; productionChanged: false; androidChanged: false; r2Published: false };
}

export interface EventsE9Coverage { schemaVersion: 1; decisionCount: number; goCount: number; noGoCount: number; remainingBoundaryCount: number; sourceConflictCount: number; sourceSidecarCount: number; sourceSidecarBytes: number }
export interface EventsE9RefreshEvidence { schemaVersion: 1; profileId: string; refreshProfileSha256: string; sourceDatabaseSha256: string; memoryLimitBytes: number; observedMaxPeakWorkingSetBytes: number; fullRefreshByteIdentical: boolean; comparedArtifactCount: number; comparedArtifacts: Array<{ fileName: string; beforeSha256: string; afterSha256: string }>; gates: Array<{ gate: "E0" | "E1" | "E2" | "E3" | "E4" | "E5" | "E6" | "E8"; payloadFileName: string; payloadSha256: string; peakWorkingSetBytes: number }> }
export interface EventsE9Validation { schemaVersion: 1; valid: boolean; exactProjection: boolean; sourceEvidenceValid: boolean; decisionPolicyValid: boolean; failures: string[] }
export interface EventsE9Manifest { schemaVersion: 1; contractVersion: "1.0.0"; generatedAt: string; generatedAtPolicy: "pinned_to_source_snapshot_for_reproducible_bytes"; sourceSnapshotVersion: string; fileName: "events-e9-readiness.json"; compression: "none"; sha256: string; sizeBytes: number; sourceDatabaseSha256: string; sourceE7Sha256: string; sourceE8Sha256: string; refreshEvidenceSha256: string; coverage: { fileName: "events-e9-coverage.json"; sha256: string; sizeBytes: number }; validation: { fileName: "events-e9-validation.json"; sha256: string; sizeBytes: number } }
