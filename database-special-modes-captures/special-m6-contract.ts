import { SpecialM5Classification } from "./special-m5-contract";

export type SpecialM6DecisionStatus = "GO" | "NO_GO";
export type SpecialM6DecisionId = "merge_disabled_infrastructure" | "tracked_synthetic_fixtures" | "pettan_active_catalog_or_battle" | "burst_gameplay_or_scoring" | "burst_opaque_start_configuration" | "replace_existing_sources_or_caches" | "android" | "r2_or_publisher" | "production_enablement" | "request_replay_or_mutation_automation";
export interface SpecialM6Decision { id: SpecialM6DecisionId; status: SpecialM6DecisionStatus; reason: string }
export interface SpecialM6Artifact { gate: "m0" | "m1" | "m2" | "m3" | "m4" | "m5"; fileName: string; sizeBytes: number; sha256: string }
export interface SpecialM6MemoryEvidence { schemaVersion: 1; contract: "dokkan-special-modes-memory-evidence"; contractVersion: "0.7.0"; platform: "windows"; measurementPolicy: string; limitBytes: 1073741824; measurements: Array<{ gate: string; peakWorkingSetBytes: number }>; maximumPeakWorkingSetBytes: number; withinLimit: boolean }
export interface SpecialM6CaptureStep { order: number; action: string; retain: string[]; stopBoundary: string; expectedStatus: "supported" | "partial" | "unknown" }
export interface SpecialM6CaptureFlow { id: string; domain: "pettan" | "burst" | "representation" | "zstandard"; precondition: string; steps: SpecialM6CaptureStep[]; completionEvidence: string }
export interface SpecialM6Dataset {
    schemaVersion: 1;
    contract: "dokkan-special-modes-capture-readiness";
    contractVersion: "0.7.0";
    generatedAt: string;
    generatedAtPolicy: "inherits_m5_capture_timestamp";
    collectionMode: "offline_local_artifacts_no_requests_no_replay";
    defaultEnabled: false;
    productionMutation: false;
    coverage: { harEntries: number; pettanObservedPacks: number; pettanBattleRoutes: number; burstFacts: number; losslessFacts: number; sourceSpans: number; parityFacts: number; parityByClassification: Record<SpecialM5Classification, number> };
    zstandard: { observedBodyCount: 0; dictionaryIdOfInterest: 315060143; dictionaryIdentityStatus: "not_proved_and_not_needed_for_current_inputs"; decodeStatus: "not_attempted"; proofBoundary: "exact_dictionary_bytes_size_sha256_id_and_independent_provenance_required_id_alone_never_proves_identity" };
    artifacts: SpecialM6Artifact[];
    fixture: { fileName: "special-modes-synthetic-shapes.json"; sizeBytes: number; sha256: string; synthetic: true };
    memory: SpecialM6MemoryEvidence;
    decisions: SpecialM6Decision[];
    gaps: Array<{ id: string; status: "partial" | "unknown"; boundary: string }>;
    captureFlows: SpecialM6CaptureFlow[];
}
export interface SpecialM6Validation { schemaVersion: 1; valid: boolean; decisionCount: number; goCount: number; noGoCount: number; artifactCount: number; captureFlowCount: number; maximumPeakWorkingSetBytes: number; failures: string[] }
