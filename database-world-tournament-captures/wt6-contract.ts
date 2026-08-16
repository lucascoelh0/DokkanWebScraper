export type Wt6DecisionStatus = "GO" | "NO_GO";
export interface Wt6MemoryEvidence { schemaVersion: 1; contract: "dokkan-world-tournament-memory-evidence"; contractVersion: "0.7.0"; method: "windows_process_tree_working_set_poll_15ms"; limitBytes: 1073741824; sourceSha256: string; artifactAggregateSha256: string; implementationAggregateSha256: string; measurements: Array<{ gate: "WT0" | "WT1" | "WT2" | "WT3" | "WT4" | "WT5" | "WT6"; peakProcessTreeWorkingSetBytes: number; exitCode: 0 }>; observedMaxPeakBytes: number }
export interface Wt6Decision { key: string; status: Wt6DecisionStatus; scope: string; rationale: string; exitCriteria: string[] }
export interface Wt6Dataset {
    schemaVersion: 1;
    contract: "dokkan-world-tournament-readiness";
    contractVersion: "0.7.0";
    collectionMode: "offline_double_generation_no_requests";
    productionMutation: false;
    defaultEnabled: false;
    source: { sourceId: "world-tournament-until-start-crash-2026-08-16"; sizeBytes: number; sha256: string; entryCount: number };
    lineage: Array<{ gate: "WT0" | "WT1" | "WT2" | "WT3" | "WT4" | "WT5"; fileName: string; sizeBytes: number; sha256: string }>;
    determinism: { passCount: 2; upstreamArtifactCount: 18; wt6OutputFileCount: 3; totalArtifactCount: 21; upstreamAggregateSha256: string; implementationAggregateSha256: string; upstreamByteIdentical: true; wt6OutputByteIdentical: true };
    security: { scannedFileCount: number; capturedSensitiveValueCount: number; exactCapturedValueMatches: 0; genericSecretPatternMatches: 0; valid: true; rawHarTracked: false; requestReplayImplemented: false; credentialFlowImplemented: false };
    memory: Wt6MemoryEvidence;
    decisions: Wt6Decision[];
    futureRefresh: { currentCampaignNeedsAdditionalHar: false; mode: "manual_offline_external_source_only"; steps: string[]; authenticatedAutomation: false; requestsAllowed: false };
    stop: { gate: "WT6"; mergeMainAllowed: false; deliveryPolicy: "push_isolated_branch_only" };
}
export interface Wt6Validation { schemaVersion: 1; valid: boolean; failures: string[]; decisionCount: number; lineageCount: number; observedMaxPeakBytes: number }
