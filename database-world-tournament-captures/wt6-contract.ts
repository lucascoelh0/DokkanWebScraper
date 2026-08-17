export const WT6_ALLOWED_HISTORICAL_HAR_TARGET_FINGERPRINTS = [
    "45576478cd2fe49f06ccd1b3a6bcac5dc95767ada5c8f25171d13c5b1401a2f3",
    "7b11a7ff85160d8335073df91c51d11cd4a312dbbf9e64e5cd82669c92dd5f30",
] as const;

export type Wt6DecisionStatus = "GO" | "NO_GO";
export interface Wt6MemoryEvidence { schemaVersion: 1; contract: "dokkan-world-tournament-memory-evidence"; contractVersion: "0.12.0"; method: "windows_process_tree_working_set_poll_15ms"; limitBytes: 1073741824; sourceSha256: string; artifactAggregateSha256: string; implementationAggregateSha256: string; measurements: Array<{ gate: "WT0" | "WT1" | "WT2" | "WT3" | "WT4" | "WT5" | "WT6"; peakProcessTreeWorkingSetBytes: number; exitCode: 0 }>; observedMaxPeakBytes: number }
export interface Wt6Decision { key: string; status: Wt6DecisionStatus; scope: string; rationale: string; exitCriteria: string[] }
export interface Wt6Dataset {
    schemaVersion: 1;
    contract: "dokkan-world-tournament-readiness";
    contractVersion: "0.12.0";
    collectionMode: "offline_double_generation_no_requests";
    productionMutation: false;
    defaultEnabled: false;
    source: { sourceId: "world-tournament-until-start-crash-2026-08-16"; sizeBytes: number; sha256: string; entryCount: number };
    lineage: Array<{ gate: "WT0" | "WT1" | "WT2" | "WT3" | "WT4" | "WT5"; fileName: string; sizeBytes: number; sha256: string }>;
    determinism: { passCount: 2; upstreamArtifactCount: 18; wt6OutputFileCount: 3; totalArtifactCount: 21; upstreamAggregateSha256: string; implementationAggregateSha256: string; upstreamByteIdentical: true; wt6OutputByteIdentical: true };
    security: {
        commitCount: number;
        targetCount: number;
        uniqueBlobCount: number;
        categoryTargetCounts: { tip: number; history_old: number; history_new: number };
        sensitiveValueCount: number;
        sourceCategoryValueCounts: { headers: number; cookies: number; url_path: number; query: number; url_credentials: number; request_body: number; response_body: number };
        sensitiveMatchCount: number;
        matchClassCounts: { prohibited_sensitive: number; permitted_protocol_structure: number; permitted_public_game_structure: number; permitted_synthetic_fixture: number; unresolved: number };
        matchRuleCounts: Record<string, number>;
        prohibitedSensitiveMatchCount: 0;
        unresolvedMatchCount: 0;
        permittedStructuralMatchCount: number;
        mutationBodyMatchCount: number;
        publicFirstPartyIdentityMatchCount: number;
        accountScopedPayloadMatchCount: 0;
        opaqueCredentialMatchCount: 0;
        firstPartyAppIdentityEvidence: WtFirstPartyAppIdentityEvidence;
        harStructureTargetCount: 2;
        tipHarStructureTargetCount: 0;
        rawHarTargetCount: 0;
        historicalHarAllowlistCount: 2;
        historicalHarAllowlistSatisfied: true;
        historicalHarTargetFingerprints: [string, string];
        allTrackedTipBlobsExamined: true;
        allChangedHistoricalBlobsExamined: true;
        noPathOrDocumentTypeExclusions: true;
        valid: true;
        requestReplayImplemented: false;
        credentialFlowImplemented: false;
    };
    memory: Wt6MemoryEvidence;
    decisions: Wt6Decision[];
    futureRefresh: { currentCampaignNeedsAdditionalHar: false; mode: "manual_offline_external_source_only"; steps: string[]; authenticatedAutomation: false; requestsAllowed: false };
    stop: { gate: "WT6"; executionIntegrationPerformed: false; integrationPolicy: "reviewed_offline_default_off_infrastructure_only" };
}
export interface Wt6Validation { schemaVersion: 1; valid: boolean; failures: string[]; decisionCount: number; lineageCount: number; observedMaxPeakBytes: number }
import { WtFirstPartyAppIdentityEvidence } from "./wt-first-party-app-identity";
