import type { CharacterLeaderSupportedPublisherObjectKind } from "./leader-supported-publisher-dry-run-contract";

export const CHARACTER_LEADER_SUPPORTED_REMOTE_PREFLIGHT_CONTRACT_VERSION = "1.0.0" as const;
export const CHARACTER_LEADER_SUPPORTED_REMOTE_PREFLIGHT_PUBLIC_BASE_URL = "https://assets.dkbcompanion.com/" as const;
export const CHARACTER_LEADER_SUPPORTED_REMOTE_PREFLIGHT_BUCKET = "dokkanpanion-data" as const;
export const CHARACTER_LEADER_SUPPORTED_REMOTE_PREFLIGHT_BUCKET_CEILING_BYTES = 10_000_000_000;
export const CHARACTER_LEADER_SUPPORTED_REMOTE_PREFLIGHT_REPORT_FILE =
    "database-characters-k59-leader-supported-remote-preflight-report.json" as const;
export const CHARACTER_LEADER_SUPPORTED_REMOTE_PREFLIGHT_RESPONSE_LIMIT_BYTES = 2 * 1024 * 1024;
export const CHARACTER_LEADER_SUPPORTED_REMOTE_PREFLIGHT_AGGREGATE_LIMIT_BYTES = 8 * 1024 * 1024;
export const CHARACTER_LEADER_SUPPORTED_REMOTE_PREFLIGHT_REQUEST_TIMEOUT_MS = 30_000;
export const CHARACTER_LEADER_SUPPORTED_REMOTE_PREFLIGHT_BUCKET_TIMEOUT_MS = 30_000;
export const CHARACTER_LEADER_SUPPORTED_REMOTE_PREFLIGHT_BUCKET_MAX_BUFFER_BYTES = 256 * 1024;
export const CHARACTER_LEADER_SUPPORTED_REMOTE_PREFLIGHT_REPORT_LIMIT_BYTES = 64 * 1024;
export const CHARACTER_LEADER_SUPPORTED_REMOTE_PREFLIGHT_RSS_LIMIT_BYTES = 1024 * 1024 * 1024;
export const CHARACTER_LEADER_SUPPORTED_REMOTE_PREFLIGHT_MAX_FAILURE_LENGTH = 256;

export interface CharacterLeaderSupportedRemoteImmutableObservation {
    order: 1 | 2 | 3 | 4;
    kind: CharacterLeaderSupportedPublisherObjectKind;
    objectKey: string;
    status: "matching" | "missing" | "conflict" | "failed";
    expectedSha256: string;
    expectedSizeBytes: number;
    expectedContentType: "application/gzip" | "application/json";
    expectedCacheControl: "public, max-age=31536000, immutable";
    actualSha256?: string;
    actualSizeBytes?: number;
    observedContentType?: string;
    observedCacheControl?: string;
    futureAction: "verified_reuse" | "create_if_absent" | "BLOCKED";
    futurePrecondition: "NO_WRITE_VERIFIED_REUSE" | "If-None-Match: *" | "BLOCKED";
    failure?: string;
}

export interface CharacterLeaderSupportedRemoteManifestObservation {
    objectKey: "database-characters/leader-supported/v1/manifest.json";
    status: "matching" | "missing" | "different" | "failed";
    expectedSha256: string;
    expectedSizeBytes: number;
    actualSha256?: string;
    actualSizeBytes?: number;
    observedContentType?: string;
    observedCacheControl?: string;
    observedEtag?: string;
    futureAction: "no_op_already_current" | "create_if_absent" | "replace_if_match" | "BLOCKED";
    futurePrecondition: "NO_WRITE_ALREADY_CURRENT" | "If-None-Match: *" | "If-Match: OBSERVED_FRESH_ETAG" | "BLOCKED";
    unconditionalWrite: "FORBIDDEN";
    delete: "FORBIDDEN";
    failure?: string;
}

export interface CharacterLeaderSupportedBucketUsageObservation {
    status: "known" | "failed";
    reported?: string;
    conservativeUpperBoundBytes?: number;
    failure?: string;
}

export interface CharacterLeaderSupportedRemotePreflightReport {
    schemaVersion: 1;
    contract: "dokkan-database-character-leader-supported-remote-preflight";
    contractVersion: typeof CHARACTER_LEADER_SUPPORTED_REMOTE_PREFLIGHT_CONTRACT_VERSION;
    checkedAt: string;
    mode: "explicit_opt_in_public_http_and_bucket_read_only";
    remote: {
        publicBaseUrl: typeof CHARACTER_LEADER_SUPPORTED_REMOTE_PREFLIGHT_PUBLIC_BASE_URL;
        bucket: typeof CHARACTER_LEADER_SUPPORTED_REMOTE_PREFLIGHT_BUCKET;
        exactGetCount: 5;
        method: "GET";
        redirects: "BLOCKED";
        acceptEncoding: "identity";
        requestTimeoutMs: typeof CHARACTER_LEADER_SUPPORTED_REMOTE_PREFLIGHT_REQUEST_TIMEOUT_MS;
        bucketCommand: "r2 bucket info dokkanpanion-data --json";
        bucketTimeoutMs: typeof CHARACTER_LEADER_SUPPORTED_REMOTE_PREFLIGHT_BUCKET_TIMEOUT_MS;
        bucketMaxBufferBytes: typeof CHARACTER_LEADER_SUPPORTED_REMOTE_PREFLIGHT_BUCKET_MAX_BUFFER_BYTES;
    };
    source: {
        candidateManifestSha256: string;
        candidateManifestSizeBytes: number;
        planSha256: string;
        planSizeBytes: number;
        receiptSha256: string;
        receiptSizeBytes: number;
        markerSha256: string;
        markerSizeBytes: number;
        fullArtifactFingerprintSha256: string;
        lineageFingerprintSha256: string;
        sourceBoundBeforeReads: "GO";
        sourceBoundAfterReads: "GO";
        sourceUnchanged: true;
    };
    objects: CharacterLeaderSupportedRemoteImmutableObservation[];
    objectSummary: { matching: number; missing: number; conflict: number; failed: number; total: 4 };
    manifest: CharacterLeaderSupportedRemoteManifestObservation;
    bucketUsage: CharacterLeaderSupportedBucketUsageObservation;
    budget: {
        responseLimitBytesExclusive: typeof CHARACTER_LEADER_SUPPORTED_REMOTE_PREFLIGHT_RESPONSE_LIMIT_BYTES;
        aggregateLimitBytesExclusive: typeof CHARACTER_LEADER_SUPPORTED_REMOTE_PREFLIGHT_AGGREGATE_LIMIT_BYTES;
        bytesRead: number;
        missingImmutableBytes: number;
        candidateManifestReservationBytes: number;
        prospectiveAdditionalBytes: number;
        bucketCeilingBytesExclusive: typeof CHARACTER_LEADER_SUPPORTED_REMOTE_PREFLIGHT_BUCKET_CEILING_BYTES;
        bucketConservativeUpperBoundBytes: number | "UNKNOWN";
        projectedBucketUpperBoundBytes: number | "UNKNOWN";
        withinBucketCeiling: boolean | "UNKNOWN";
    };
    checks: {
        exactFiveOrderedGets: boolean;
        everyImmutableInspected: boolean;
        noImmutableConflict: boolean;
        noReadFailure: boolean;
        mutableManifestSafe: boolean;
        bucketUsageKnown: boolean;
        projectedBucketStrictlyBelowCeiling: boolean;
        sourceRevalidatedAfterAllReads: true;
        noRemoteMutation: true;
        noUnconditionalWriteModel: true;
        callerControlledStableOutputRootRequired: true;
        concurrentSameUserOutputAncestorReplacementProtected: false;
        perProcessRssUnder1GiB: true;
        processTreeRssUnder1GiB: false;
    };
    readiness: {
        remotePreflight: "GO" | "NO-GO";
        publication: "NO-GO";
        r2Mutation: "NO-GO";
        authority: "NO-GO";
        production: "NO-GO";
        android: "NO-GO";
        perProcessRssUnder1GiB: "GO";
        processTreeRssUnder1GiB: "NO-GO";
        concurrentOutputAncestorReplacement: "NO-GO";
    };
}

export interface CharacterLeaderSupportedRemotePreflightResult {
    reportPath: string;
    reportSha256: string;
    report: CharacterLeaderSupportedRemotePreflightReport;
    rssAccountingScope: "per_process_not_process_tree";
    k55BeforeProcessPeakRssBytes: number;
    k55AfterProcessPeakRssBytes: number;
    k59ParentProcessPeakRssBytes: number;
    maximumIndividualProcessPeakRssBytes: number;
}
