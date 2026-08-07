export type ServerS7Gate = "s0" | "s1" | "s2" | "s3" | "s4" | "s5" | "s6";
export type ServerS7DecisionKey = "merge_disabled_infrastructure" | "optional_refresh" | "replace_scraped_schedule" | "replace_banners" | "resolve_sbr_rmbattle" | "asset_delivery" | "r2_publication" | "android_shadow_mode" | "future_html_removal";

export interface ServerS7SourceLineage {
    gate: ServerS7Gate;
    contractVersion: string;
    path: string;
    sha256: string;
    sizeBytes: number;
    generatedAt: string;
}

export interface ServerS7Decision {
    key: ServerS7DecisionKey;
    decision: "GO" | "NO_GO";
    effect: "readiness_only_no_action";
    scope: string;
    evidenceGates: ServerS7Gate[];
    rationale: string;
    blockers: string[];
    conditions: string[];
    exitCriteria: string[];
}

export interface ServerS7Dataset {
    schemaVersion: 1;
    contract: "dokkan-server-readiness";
    contractVersion: "0.8.0";
    generatedAt: string;
    generatedAtPolicy: "latest_validated_gate_derivation_time";
    collectionMode: "validated_local_artifacts_no_network";
    productionMutation: false;
    sourceLineage: ServerS7SourceLineage[];
    coverage: {
        finalCapturedRequestCount: number;
        finalCapturedBytes: number;
        scheduleCount: number;
        bannerCount: number;
        featuredRelationCount: number;
        sbrStructurallyMatchedIdentityCount: number;
        ultimateClashUnjoinableRootCount: number;
        rewardUnknownCount: number;
        rewardUnjoinableCount: number;
        assetReferenceCount: number;
        assetDeliveryJoinCount: number;
        localApkSampleBytes: number;
        fullAssetCatalogProjectedBytes: null;
        sidecarCount: 5;
        enabledSidecarCount: 0;
        parityComparedCount: number;
        parityConfirmedConflictCount: number;
        parityUnknownOrUnjoinableCount: number;
    };
    decisions: ServerS7Decision[];
    terminalBoundary: {
        stop: true;
        reasons: string[];
        prohibitedWithoutNewEvidenceOrAuthority: string[];
    };
    nextPrompt: string;
}

export interface ServerS7Validation {
    schemaVersion: 1;
    valid: boolean;
    deterministic: boolean;
    exactDecisionSet: boolean;
    evidenceClosed: boolean;
    noActionAuthorized: boolean;
    noGoExitCriteriaComplete: boolean;
    stopBoundaryPreserved: boolean;
    failures: string[];
}

export interface ServerS7Manifest {
    schemaVersion: 1;
    contractVersion: "0.8.0";
    generatedAt: string;
    generatedAtPolicy: "latest_validated_gate_derivation_time";
    fileName: "server-s7-readiness.json";
    compression: "none";
    sha256: string;
    sizeBytes: number;
    sourceLineageAggregateSha256: string;
    validation: { fileName: "server-s7-validation.json"; sha256: string; sizeBytes: number };
}

export interface ServerS7InputGate extends ServerS7SourceLineage { dataset: any }
