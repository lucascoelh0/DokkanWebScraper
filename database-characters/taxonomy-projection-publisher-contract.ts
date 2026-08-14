import { TaxonomyProjectionDeliveryArtifactKind } from "./taxonomy-projection-delivery-contract";
import { TaxonomyProjectionPublisherDryRunReport } from "./taxonomy-projection-publisher-dry-run-contract";

export const TAXONOMY_PROJECTION_PUBLISHER_SCHEMA_VERSION = 1 as const;
export const TAXONOMY_PROJECTION_PUBLISHER_CONTRACT_VERSION = "1.0.0" as const;
export const TAXONOMY_PROJECTION_PUBLISHER_BUCKET = "dokkanpanion-data" as const;
export const TAXONOMY_PROJECTION_PUBLISHER_REGION = "auto" as const;
export const TAXONOMY_PROJECTION_PUBLISHER_ENDPOINT_PATTERN =
    "https://<32-hex-account-id>.r2.cloudflarestorage.com" as const;
export const TAXONOMY_PROJECTION_PUBLISHER_NAMESPACE =
    "database-characters-k40-taxonomy-projection-publisher-v1" as const;
export const TAXONOMY_PROJECTION_PUBLISHER_REPORT_FILE =
    "database-characters-k40-taxonomy-projection-publisher-dry-run-report.json" as const;
export const TAXONOMY_PROJECTION_PUBLISHER_MAX_OBJECT_BYTES = 1024 * 1024;
export const TAXONOMY_PROJECTION_PUBLISHER_MAX_AGGREGATE_READ_BYTES = 5 * 1024 * 1024;
export const TAXONOMY_PROJECTION_PUBLISHER_MAX_REPORT_BYTES = 192 * 1024;
export const TAXONOMY_PROJECTION_PUBLISHER_RSS_LIMIT_BYTES = 1024 * 1024 * 1024;
export const TAXONOMY_PROJECTION_PUBLISHER_RSS_REPORT_RESERVE_BYTES =
    TAXONOMY_PROJECTION_PUBLISHER_MAX_REPORT_BYTES * 4;
export const TAXONOMY_PROJECTION_PUBLISHER_MAX_ERROR_LENGTH = 512;
export const TAXONOMY_PROJECTION_PUBLISHER_IMMUTABLE_CACHE_CONTROL =
    "public, max-age=31536000, immutable" as const;

export interface TaxonomyProjectionPublicationObjectPlan {
    order: 1 | 2 | 3 | 4;
    kind: TaxonomyProjectionDeliveryArtifactKind;
    sourceFileName: string;
    objectKey: string;
    sha256: string;
    sizeBytes: number;
    contentType: "application/gzip" | "application/json";
    cacheControl: typeof TAXONOMY_PROJECTION_PUBLISHER_IMMUTABLE_CACHE_CONTROL;
    existingPolicy: "REUSE_ONLY_AFTER_EXACT_BYTES_AND_METADATA_VERIFICATION";
    missingPolicy: "PUT_IF_NONE_MATCH_STAR";
    racePolicy: "ACCEPT_409_OR_412_ONLY_AFTER_EXACT_DIRECT_REREAD";
    postCreateVerification: "DIRECT_BYTES_AND_METADATA_REQUIRED";
    overwrite: "FORBIDDEN";
    delete: "FORBIDDEN";
}

export interface TaxonomyProjectionPublicationPlanBody {
    schemaVersion: typeof TAXONOMY_PROJECTION_PUBLISHER_SCHEMA_VERSION;
    contract: "dokkan-database-character-taxonomy-projection-publication-plan-k40";
    contractVersion: typeof TAXONOMY_PROJECTION_PUBLISHER_CONTRACT_VERSION;
    remote: {
        bucket: typeof TAXONOMY_PROJECTION_PUBLISHER_BUCKET;
        region: typeof TAXONOMY_PROJECTION_PUBLISHER_REGION;
        endpointPattern: typeof TAXONOMY_PROJECTION_PUBLISHER_ENDPOINT_PATTERN;
    };
    source: {
        k37PlanId: string;
        k37PlanSha256: string;
        k37ManifestCandidateSha256: string;
        k36ReleaseId: string;
        k36ReceiptSha256: string;
        k36MarkerSha256: string;
    };
    immutableObjects: TaxonomyProjectionPublicationObjectPlan[];
    mutableManifest: {
        order: "LAST";
        source: "CANONICAL_K37_MANIFEST_CANDIDATE_BYTES";
        objectKey: "database-characters/taxonomy-projection/v1/manifest.json";
        sha256: string;
        sizeBytes: number;
        contentType: "application/json";
        cacheControl: "no-store";
        matchingPolicy: "NO_WRITE_AND_FINAL_DIRECT_VERIFY";
        missingPolicy: "PUT_IF_NONE_MATCH_STAR";
        differentPolicy: "PUT_IF_MATCH_FRESH_DIRECT_ETAG";
        freshnessPolicy: "REREAD_IMMEDIATELY_BEFORE_PROMOTION";
        concurrentCompletionPolicy: "ACCEPT_ONLY_IF_ALREADY_EXACT_BYTES_AND_METADATA";
        racePolicy: "ACCEPT_409_OR_412_ONLY_AFTER_EXACT_FINAL_DIRECT_REREAD";
        finalVerification: "DIRECT_BYTES_AND_METADATA_REQUIRED";
        unconditionalOverwrite: "FORBIDDEN";
        delete: "FORBIDDEN";
    };
    ordering: {
        immutableInK37Order: true;
        revalidateAllLocalSourcesBeforeManifest: true;
        manifestLast: true;
        noRollbackOrDeleteOrphanedImmutableObjects: true;
    };
    limits: {
        objectBytesExclusive: number;
        aggregateDirectReadBytesExclusive: number;
        reportBytesExclusive: number;
        rssBytesExclusive: number;
    };
    safety: {
        noCopy: true;
        noMultipart: true;
        noDelete: true;
        noProductionSwitch: true;
        noAndroidMutation: true;
        noAuthorityPromotion: true;
    };
}

export interface TaxonomyProjectionPublicationPlan extends TaxonomyProjectionPublicationPlanBody {
    publicationId: string;
}

export interface TaxonomyProjectionPublisherDryRunOperationalReport {
    schemaVersion: typeof TAXONOMY_PROJECTION_PUBLISHER_SCHEMA_VERSION;
    contract: "dokkan-database-character-taxonomy-projection-publisher-dry-run-k40";
    contractVersion: typeof TAXONOMY_PROJECTION_PUBLISHER_CONTRACT_VERSION;
    checkedAt: string;
    mode: "explicit_opt_in_remote_k40_dry_run_operational_report";
    publicationId: string;
    plan: TaxonomyProjectionPublicationPlan;
    current: {
        k39CheckedAt: string;
        k39ReportSha256: string;
        k39PlanId: string;
        k39ReleaseId: string;
        immutableObservations: TaxonomyProjectionPublisherDryRunReport["remote"]["immutableActions"];
        mutableManifestObservation: TaxonomyProjectionPublisherDryRunReport["remote"]["mutableManifest"];
        bucketUsage: TaxonomyProjectionPublisherDryRunReport["k38BucketUsage"];
        budget: TaxonomyProjectionPublisherDryRunReport["k38Budget"];
        k39DryRunReadiness: "GO";
    };
    checks: {
        k39ProductivelyRerun: true;
        k39RerunsK38: true;
        currentBudgetsGo: true;
        k37SourceBoundBeforeAndAfterPlan: true;
        k36SourceBoundBeforeAndAfterPlan: true;
        exactFourK36MembersBoundAndRead: true;
        canonicalK37MutableCandidateBytes: true;
        deterministicPublicationIdExcludesOperationalTimeAndObservations: true;
        dryRunReportCreateOnly: true;
        savedReportNotPublicationAuthority: true;
        noRemoteMutationDuringReport: true;
    };
    readiness: {
        dryRun: "GO";
        publicationAuthorization: "REQUIRED";
        publication: "NOT_EXECUTED";
        android: "NO-GO";
        consumer: "NO-GO";
        authority: "NO-GO";
        production: "NO-GO";
    };
    state: "OPERATIONAL_DRY_RUN_ONLY_NON_AUTHORITATIVE";
}

export interface TaxonomyProjectionPublicationSummary {
    publicationId: string;
    immutableUploaded: number;
    immutableReused: number;
    immutableVerified: 4;
    immutableBytesUploaded: number;
    manifestPromoted: boolean;
    manifestResult: "REUSED" | "CREATED" | "REPLACED" | "CONCURRENT_IDEMPOTENT_COMPLETION";
    finalManifestVerified: true;
    deleteCount: 0;
    rollbackAttempted: false;
    readiness: {
        publicationExecution: "COMPLETED_CONDITIONALLY";
        android: "NO-GO";
        consumer: "NO-GO";
        authority: "NO-GO";
        production: "NO-GO";
    };
}
