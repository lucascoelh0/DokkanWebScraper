import { TaxonomyProjectionDeliveryArtifactKind } from "./taxonomy-projection-delivery-contract";

export const TAXONOMY_PROJECTION_REMOTE_PREFLIGHT_SCHEMA_VERSION = 1 as const;
export const TAXONOMY_PROJECTION_REMOTE_PREFLIGHT_CONTRACT_VERSION = "1.0.0" as const;
export const TAXONOMY_PROJECTION_REMOTE_PREFLIGHT_NAMESPACE = "database-characters-k38-taxonomy-projection-remote-preflight-v1" as const;
export const TAXONOMY_PROJECTION_REMOTE_PREFLIGHT_REPORT_FILE = "database-characters-k38-taxonomy-projection-remote-preflight-report.json" as const;
export const TAXONOMY_PROJECTION_REMOTE_PREFLIGHT_PUBLIC_BASE_URL = "https://assets.dkbcompanion.com/" as const;
export const TAXONOMY_PROJECTION_REMOTE_PREFLIGHT_BUCKET = "dokkanpanion-data" as const;
export const TAXONOMY_PROJECTION_REMOTE_PREFLIGHT_MAX_RESPONSE_BYTES = 1024 * 1024;
export const TAXONOMY_PROJECTION_REMOTE_PREFLIGHT_MAX_AGGREGATE_BYTES = 5 * 1024 * 1024;
export const TAXONOMY_PROJECTION_REMOTE_PREFLIGHT_CONCURRENCY = 2;
export const TAXONOMY_PROJECTION_REMOTE_PREFLIGHT_REQUEST_TIMEOUT_MS = 30_000;
export const TAXONOMY_PROJECTION_REMOTE_PREFLIGHT_BUCKET_TIMEOUT_MS = 30_000;
export const TAXONOMY_PROJECTION_REMOTE_PREFLIGHT_BUCKET_MAX_BUFFER_BYTES = 256 * 1024;
export const TAXONOMY_PROJECTION_REMOTE_PREFLIGHT_MAX_REPORT_BYTES = 64 * 1024;
export const TAXONOMY_PROJECTION_REMOTE_PREFLIGHT_RSS_LIMIT_BYTES = 1024 * 1024 * 1024;
export const TAXONOMY_PROJECTION_REMOTE_PREFLIGHT_RSS_REPORT_RESERVE_BYTES =
    TAXONOMY_PROJECTION_REMOTE_PREFLIGHT_MAX_REPORT_BYTES * 4;
export const TAXONOMY_PROJECTION_REMOTE_PREFLIGHT_RSS_REMOTE_RESERVE_BYTES =
    (TAXONOMY_PROJECTION_REMOTE_PREFLIGHT_MAX_AGGREGATE_BYTES * 2)
    + TAXONOMY_PROJECTION_REMOTE_PREFLIGHT_RSS_REPORT_RESERVE_BYTES;
export const TAXONOMY_PROJECTION_REMOTE_PREFLIGHT_MAX_FAILURE_LENGTH = 256;
export const TAXONOMY_PROJECTION_REMOTE_PREFLIGHT_MAX_ERROR_LENGTH = 512;

export type TaxonomyProjectionRemoteObjectStatus = "matching" | "missing" | "conflict" | "failed";

export interface TaxonomyProjectionRemoteObjectObservation {
    kind: TaxonomyProjectionDeliveryArtifactKind;
    objectKey: string;
    status: TaxonomyProjectionRemoteObjectStatus;
    expectedSha256: string;
    expectedSizeBytes: number;
    actualSha256?: string;
    actualSizeBytes?: number;
    failure?: string;
}

export interface TaxonomyProjectionRemoteManifestObservation {
    objectKey: "database-characters/taxonomy-projection/v1/manifest.json";
    status: "matching" | "different" | "missing" | "failed";
    expectedSha256: string;
    expectedSizeBytes: number;
    actualSha256?: string;
    actualSizeBytes?: number;
    observedDatasetVersion?: string;
    observedReleaseId?: string;
    failure?: string;
}

export interface TaxonomyProjectionBucketUsageObservation {
    status: "known" | "failed";
    reported?: string;
    conservativeUpperBoundBytes?: number;
    failure?: string;
}

export interface TaxonomyProjectionRemotePreflightReport {
    schemaVersion: typeof TAXONOMY_PROJECTION_REMOTE_PREFLIGHT_SCHEMA_VERSION;
    contract: "dokkan-database-character-taxonomy-projection-remote-preflight-k38";
    contractVersion: typeof TAXONOMY_PROJECTION_REMOTE_PREFLIGHT_CONTRACT_VERSION;
    checkedAt: string;
    planId: string;
    k36ReleaseId: string;
    mode: "explicit_opt_in_remote_read_only";
    remote: {
        publicBaseUrl: typeof TAXONOMY_PROJECTION_REMOTE_PREFLIGHT_PUBLIC_BASE_URL;
        bucket: typeof TAXONOMY_PROJECTION_REMOTE_PREFLIGHT_BUCKET;
        objectMethod: "GET";
        redirects: "BLOCKED";
        acceptEncoding: "identity";
        immutableConcurrency: number;
        requestTimeoutMs: number;
        bucketCommand: "r2 bucket info dokkanpanion-data --json";
        bucketTimeoutMs: number;
        bucketMaxBufferBytes: number;
        bucketKillSignal: "SIGKILL";
        rssLimitBytesExclusive: number;
        rssRemoteAndReportReserveBytes: number;
    };
    source: {
        k37PlanSha256: string;
        k37PlanSizeBytes: number;
        k37ManifestCandidateSha256: string;
        k37ManifestCandidateSizeBytes: number;
        k37ReceiptSha256: string;
        k37ReceiptSizeBytes: number;
        k37MarkerSha256: string;
        k37MarkerSizeBytes: number;
        sourceBoundBeforeTransport: "GO";
        sourceBoundAfterRemoteReads: "GO";
        sourceUnchanged: true;
    };
    objects: TaxonomyProjectionRemoteObjectObservation[];
    objectSummary: Record<TaxonomyProjectionRemoteObjectStatus, number> & { total: 4 };
    manifest: TaxonomyProjectionRemoteManifestObservation;
    bucketUsage: TaxonomyProjectionBucketUsageObservation;
    budget: {
        responseLimitBytesExclusive: number;
        aggregateLimitBytesExclusive: number;
        bytesRead: number;
        namespaceLimitBytesExclusive: number;
        namespacePlanBytes: number;
        namespacePlanStrictlyWithinLimit: boolean;
        missingImmutableBytes: number;
        manifestCandidateBytes: number;
        bytesNewIfPublished: number;
        bucketCeilingBytesExclusive: number;
        bucketConservativeUpperBoundBytes: number | "UNKNOWN";
        projectedBucketUpperBoundBytes: number | "UNKNOWN";
        withinBucketCeiling: boolean | "UNKNOWN";
    };
    checks: {
        exactImmutableObjectCount: boolean;
        exactRemoteKeysOnly: boolean;
        everyImmutableObjectInspected: boolean;
        noImmutableConflict: boolean;
        noRemoteReadFailure: boolean;
        mutableManifestPlanningStateAcceptable: boolean;
        bucketUsageKnown: boolean;
        namespacePlanStrictlyWithinLimit: boolean;
        bucketProjectionStrictlyWithinLimit: boolean;
        readOnlyTransport: true;
        noRemoteMutation: true;
        savedReportIsNotPublicationAuthority: true;
        futurePublisherMustRerunK38: true;
        callerControlledStableOutputNamespaceRequired: true;
        rssStrictlyWithinLimitWithReservedHeadroom: boolean;
    };
    readiness: {
        readOnlyRemotePreflight: "GO" | "NO-GO";
        publicationAuthorization: "REQUIRED";
        publication: "NO-GO";
        r2Mutation: "NO-GO";
        android: "NO-GO";
        consumer: "NO-GO";
        authority: "NO-GO";
        production: "NO-GO";
    };
    state: "OPERATIONAL_OBSERVATION_ONLY_FUTURE_PUBLISHER_MUST_RERUN_K38";
}
