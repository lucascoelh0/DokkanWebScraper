import type { CharacterLeaderSupportedProjectionLineage } from "./leader-supported-projection-contract";

export const CHARACTER_LEADER_SUPPORTED_PUBLISHER_DRY_RUN_CONTRACT_VERSION = "1.0.0" as const;
export const CHARACTER_LEADER_SUPPORTED_PUBLISHER_NAMESPACE = "database-characters/leader-supported/v1" as const;
export const CHARACTER_LEADER_SUPPORTED_PUBLISHER_MANIFEST_KEY =
    "database-characters/leader-supported/v1/manifest.json" as const;
export const CHARACTER_LEADER_SUPPORTED_PUBLISHER_IMMUTABLE_CACHE_CONTROL =
    "public, max-age=31536000, immutable" as const;
export const CHARACTER_LEADER_SUPPORTED_PUBLISHER_REPORT_LIMIT_BYTES = 64 * 1024;
export const CHARACTER_LEADER_SUPPORTED_PUBLISHER_RSS_LIMIT_BYTES = 1024 * 1024 * 1024;
export const CHARACTER_LEADER_SUPPORTED_PUBLISHER_NAMESPACE_BUDGET_BYTES = 64 * 1024 * 1024;
export const CHARACTER_LEADER_SUPPORTED_PUBLISHER_FILES = {
    candidateManifest: "database-characters-k58-leader-supported-candidate-manifest.json",
    plan: "database-characters-k58-leader-supported-publisher-dry-run-plan.json",
    receipt: "database-characters-k58-leader-supported-publisher-dry-run-receipt.json",
    marker: "database-characters-k58-leader-supported-publisher-dry-run-marker.json",
} as const;

export type CharacterLeaderSupportedPublisherObjectKind = "payload" | "coverage" | "validation" | "manifest";
export type CharacterLeaderSupportedPublisherContentType = "application/gzip" | "application/json";

export interface CharacterLeaderSupportedPublisherImmutableObject {
    order: 1 | 2 | 3 | 4;
    kind: CharacterLeaderSupportedPublisherObjectKind;
    sourceFileName: string;
    objectKey: string;
    sha256: string;
    sizeBytes: number;
    contentType: CharacterLeaderSupportedPublisherContentType;
    cacheControl: typeof CHARACTER_LEADER_SUPPORTED_PUBLISHER_IMMUTABLE_CACHE_CONTROL;
    remotePreflight: "NOT_EXECUTED";
    action: "NOT_EXECUTED";
    futureProtocol: {
        missing: "create_if_absent_with_If-None-Match:*";
        matching: "verified_reuse_only";
        verifiedReuseRequiresSha256SizeContentTypeAndCacheControl: true;
        different: "FAIL_CLOSED";
        postCreateByteAndMetadataVerificationRequired: true;
        overwrite: "FORBIDDEN";
        delete: "FORBIDDEN";
    };
}

export interface CharacterLeaderSupportedPublisherCandidateManifest {
    schemaVersion: 1;
    contract: "dokkan-database-character-leader-supported-publisher-candidate-manifest";
    contractVersion: typeof CHARACTER_LEADER_SUPPORTED_PUBLISHER_DRY_RUN_CONTRACT_VERSION;
    namespace: typeof CHARACTER_LEADER_SUPPORTED_PUBLISHER_NAMESPACE;
    source: {
        fullArtifactFingerprintSha256: string;
        lineageFingerprintSha256: string;
        rawIdentity: { sha256: string; sizeBytes: number; persistedOrRemoteObject: false };
        lineage: CharacterLeaderSupportedProjectionLineage;
    };
    counts: {
        totalEffects: 3_853;
        totalReferences: 12_310;
        projectedEffects: 3_836;
        projectedReferences: 12_265;
        excludedEffects: 17;
        excludedReferences: 45;
    };
    immutableObjects: CharacterLeaderSupportedPublisherImmutableObject[];
    policy: {
        candidateOnly: true;
        manifestObjectKey: typeof CHARACTER_LEADER_SUPPORTED_PUBLISHER_MANIFEST_KEY;
        manifestAlwaysLast: true;
        remotePreflightRequired: true;
        remotePreflight: "NOT_EXECUTED";
        futureMissingManifestCreate: "If-None-Match: *";
        futureReplacement: "If-Match: FRESH_ETAG_REQUIRED";
        unconditionalWrite: "FORBIDDEN";
        delete: "FORBIDDEN";
        mutationExecuted: false;
    };
}

export interface CharacterLeaderSupportedPublisherDryRunPlan {
    schemaVersion: 1;
    contract: "dokkan-database-character-leader-supported-publisher-dry-run-plan";
    contractVersion: typeof CHARACTER_LEADER_SUPPORTED_PUBLISHER_DRY_RUN_CONTRACT_VERSION;
    mode: "explicit_opt_in_offline_local_dry_run_only_timestamp_free";
    namespace: typeof CHARACTER_LEADER_SUPPORTED_PUBLISHER_NAMESPACE;
    source: CharacterLeaderSupportedPublisherCandidateManifest["source"];
    counts: CharacterLeaderSupportedPublisherCandidateManifest["counts"];
    immutableObjects: CharacterLeaderSupportedPublisherImmutableObject[];
    mutableManifest: {
        order: "LAST_AFTER_ALL_IMMUTABLE_OBJECTS";
        objectKey: typeof CHARACTER_LEADER_SUPPORTED_PUBLISHER_MANIFEST_KEY;
        candidateSha256: string;
        candidateSizeBytes: number;
        contentType: "application/json";
        cacheControl: "no-store";
        remotePreflight: "NOT_EXECUTED";
        action: "NOT_EXECUTED";
        futureProtocol: {
            preflightRequired: true;
            missing: "If-None-Match: *";
            replacement: "If-Match: FRESH_ETAG_REQUIRED";
            freshEtagRequired: true;
            unconditionalWrite: "FORBIDDEN";
            delete: "FORBIDDEN";
        };
    };
    projection: {
        immutableObjectCount: 4;
        mutableCandidateManifestCount: 1;
        projectedRemoteObjectCount: 5;
        immutableBytes: number;
        candidateManifestBytes: number;
        projectedRemoteBytes: number;
    };
    budget: {
        conservativeNamespaceBudgetBytes: typeof CHARACTER_LEADER_SUPPORTED_PUBLISHER_NAMESPACE_BUDGET_BYTES;
        projectedRemoteBytes: number;
        conservativeNamespaceHeadroomBytes: number;
        withinConservativeNamespaceBudget: true;
        bucketBytes: "UNKNOWN";
        bucketHeadroomBytes: "UNKNOWN";
    };
    safety: {
        localOnly: true;
        noClientConstructed: true;
        environmentCredentialsRead: false;
        networkRequestCount: 0;
        remoteMutationCount: 0;
        overwriteCount: 0;
        deleteCount: 0;
        outputNamespaceThreatModel: "caller_controlled_stable_during_operation";
        concurrentSameUserAncestorReplacementProtected: false;
        localCreateOnly: true;
        localMarkerLast: true;
        automaticCleanupAttempted: false;
    };
    readiness: {
        dryRun: "GO" | "NOT_EXECUTED";
        sourceBoundValidation: "GO" | "NOT_EXECUTED";
        remotePreflight: "NOT_EXECUTED";
        publication: "NO-GO";
        r2Mutation: "NO-GO";
        authority: "NO-GO";
        production: "NO-GO";
        android: "NO-GO";
        ui: "NO-GO";
        concurrentOutputAncestorReplacement: "NO-GO";
    };
}

export interface CharacterLeaderSupportedPublisherDryRunReceipt {
    schemaVersion: 1;
    contract: "dokkan-database-character-leader-supported-publisher-dry-run-receipt";
    contractVersion: typeof CHARACTER_LEADER_SUPPORTED_PUBLISHER_DRY_RUN_CONTRACT_VERSION;
    planSha256: string;
    planSizeBytes: number;
    candidateManifestSha256: string;
    candidateManifestSizeBytes: number;
    immutableObjectCount: 4;
    remotePreflight: "NOT_EXECUTED";
    remoteMutationCount: 0;
    dryRun: "GO" | "NOT_EXECUTED";
}

export interface CharacterLeaderSupportedPublisherDryRunMarker {
    schemaVersion: 1;
    contract: "dokkan-database-character-leader-supported-publisher-dry-run-marker";
    contractVersion: typeof CHARACTER_LEADER_SUPPORTED_PUBLISHER_DRY_RUN_CONTRACT_VERSION;
    planSha256: string;
    receiptSha256: string;
    candidateManifestSha256: string;
    localArtifactSetComplete: true;
    markerWrittenLast: true;
    remotePreflight: "NOT_EXECUTED";
    remoteMutationCount: 0;
}

export interface CharacterLeaderSupportedPublisherDryRunArtifactSet {
    candidateManifest: CharacterLeaderSupportedPublisherCandidateManifest;
    plan: CharacterLeaderSupportedPublisherDryRunPlan;
    receipt: CharacterLeaderSupportedPublisherDryRunReceipt;
    marker: CharacterLeaderSupportedPublisherDryRunMarker;
    candidateManifestBytes: Buffer;
    planBytes: Buffer;
    receiptBytes: Buffer;
    markerBytes: Buffer;
}

export interface CharacterLeaderSupportedPublisherDryRunResult {
    outputRoot: string;
    planSha256: string;
    candidateManifestSha256: string;
    receiptSha256: string;
    markerSha256: string;
    sourceFullArtifactFingerprintSha256: string;
    sourceLineageFingerprintSha256: string;
    sourceStableAcrossDryRun: true;
    rssAccountingScope: "per_process_not_process_tree";
    k55BeforeProcessPeakRssBytes: number;
    k55AfterProcessPeakRssBytes: number;
    k58ParentProcessPeakRssBytes: number;
    maximumIndividualProcessPeakRssBytes: number;
    readiness: {
        dryRun: "GO";
        perProcessRssUnder1GiB: "GO";
        processTreeRssUnder1GiB: "NO-GO";
        remotePreflight: "NOT_EXECUTED";
        publication: "NO-GO";
        r2Mutation: "NO-GO";
        authority: "NO-GO";
        production: "NO-GO";
        network: "NO-GO";
        android: "NO-GO";
        concurrentOutputAncestorReplacement: "NO-GO";
    };
}
