import {
    TaxonomyProjectionBucketUsageObservation,
    TaxonomyProjectionRemotePreflightReport,
} from "./taxonomy-projection-remote-preflight-contract";
import { TaxonomyProjectionDeliveryArtifactKind } from "./taxonomy-projection-delivery-contract";

export const TAXONOMY_PROJECTION_PUBLISHER_DRY_RUN_SCHEMA_VERSION = 1 as const;
export const TAXONOMY_PROJECTION_PUBLISHER_DRY_RUN_CONTRACT_VERSION = "1.0.0" as const;
export const TAXONOMY_PROJECTION_PUBLISHER_DRY_RUN_NAMESPACE =
    "database-characters-k39-taxonomy-projection-publisher-dry-run-v1" as const;
export const TAXONOMY_PROJECTION_PUBLISHER_DRY_RUN_REPORT_FILE =
    "database-characters-k39-taxonomy-projection-publisher-dry-run-report.json" as const;
export const TAXONOMY_PROJECTION_PUBLISHER_DRY_RUN_MAX_REPORT_BYTES = 128 * 1024;
export const TAXONOMY_PROJECTION_PUBLISHER_DRY_RUN_RSS_LIMIT_BYTES = 1024 * 1024 * 1024;
export const TAXONOMY_PROJECTION_PUBLISHER_DRY_RUN_RSS_REPORT_RESERVE_BYTES =
    TAXONOMY_PROJECTION_PUBLISHER_DRY_RUN_MAX_REPORT_BYTES * 4;
export const TAXONOMY_PROJECTION_PUBLISHER_DRY_RUN_MAX_ERROR_LENGTH = 512;
export const TAXONOMY_PROJECTION_IMMUTABLE_CACHE_CONTROL =
    "public, max-age=31536000, immutable" as const;

export type TaxonomyProjectionPublisherContentType = "application/gzip" | "application/json";

export interface TaxonomyProjectionPublisherImmutableDryRunAction {
    order: 1 | 2 | 3 | 4;
    kind: TaxonomyProjectionDeliveryArtifactKind;
    sourceFileName: string;
    objectKey: string;
    expectedSha256: string;
    expectedSizeBytes: number;
    contentType: TaxonomyProjectionPublisherContentType;
    cacheControl: typeof TAXONOMY_PROJECTION_IMMUTABLE_CACHE_CONTROL;
    k38Status: "matching" | "missing";
    action: "reuse_verified_remote_bytes" | "create_if_absent";
    prospectiveCreateSemantics: {
        authorizationRequired: true;
        ifNoneMatch: "*";
        onlyWhenK38StatusIsMissing: true;
    };
    postCreateVerification: {
        byteSha256AndSize: "REQUIRED";
        contentTypeAndCacheControlMetadata: "REQUIRED";
    };
    overwrite: "FORBIDDEN";
    delete: "FORBIDDEN";
}

export interface TaxonomyProjectionPublisherMutableManifestDryRunAction {
    order: "LAST_AFTER_ALL_IMMUTABLE_OBJECTS";
    objectKey: "database-characters/taxonomy-projection/v1/manifest.json";
    expectedSha256: string;
    expectedSizeBytes: number;
    contentType: "application/json";
    cacheControl: "no-store";
    k38Status: "matching" | "missing" | "different";
    action: "reuse_and_verify" | "prospective_create_if_absent" | "prospective_replace_if_match";
    futureWritePrecondition:
        | "NO_WRITE_REUSE_AND_VERIFY"
        | "If-None-Match: *"
        | "If-Match: FRESH_ETAG_REQUIRED";
    freshDirectMetadataAndEtagVerificationRequired: true;
    futureSeparatelyAuthorizedWriteGateRequired: true;
    unconditionalOverwrite: "FORBIDDEN";
    delete: "FORBIDDEN";
    postWriteByteAndMetadataVerification: "REQUIRED";
}

export interface TaxonomyProjectionPublisherDryRunReport {
    schemaVersion: typeof TAXONOMY_PROJECTION_PUBLISHER_DRY_RUN_SCHEMA_VERSION;
    contract: "dokkan-database-character-taxonomy-projection-publisher-dry-run-k39";
    contractVersion: typeof TAXONOMY_PROJECTION_PUBLISHER_DRY_RUN_CONTRACT_VERSION;
    checkedAt: string;
    mode: "explicit_opt_in_remote_read_only_dry_run_only";
    planId: string;
    k36ReleaseId: string;
    source: {
        k37: {
            planSha256: string;
            planSizeBytes: number;
            manifestCandidateSha256: string;
            manifestCandidateSizeBytes: number;
            receiptSha256: string;
            receiptSizeBytes: number;
            markerSha256: string;
            markerSizeBytes: number;
            sourceBoundBeforeDryRun: "GO";
            sourceBoundAfterDryRun: "GO";
            sourceUnchanged: true;
        };
        k38: {
            contract: "dokkan-database-character-taxonomy-projection-remote-preflight-k38";
            contractVersion: string;
            checkedAt: string;
            reportSha256: string;
            readiness: "GO";
            productivelyRerunForThisDryRun: true;
            savedReportNotUsedAsAuthority: true;
        };
    };
    remote: {
        publicBaseUrl: string;
        bucket: string;
        immutableActions: TaxonomyProjectionPublisherImmutableDryRunAction[];
        mutableManifest: TaxonomyProjectionPublisherMutableManifestDryRunAction;
        mutationExecuted: false;
        overwriteCount: 0;
        deleteCount: 0;
    };
    k38BucketUsage: TaxonomyProjectionBucketUsageObservation;
    k38Budget: TaxonomyProjectionRemotePreflightReport["budget"];
    checks: {
        k38RerunWithEveryExplicitInput: true;
        k38ReadinessGoRequired: true;
        exactFourImmutableActionsInK37Order: true;
        immutableMatchingReused: true;
        immutableMissingCreateIfAbsentOnly: true;
        immutableIfNoneMatchStarRequired: true;
        immutablePostCreateByteAndMetadataVerificationRequired: true;
        mutableManifestLast: true;
        mutableManifestFreshEtagRequiredForReplacement: true;
        noRemoteMutation: true;
        zeroOverwrite: true;
        zeroDelete: true;
        boundedReport: true;
        createOnlyReport: true;
        existingReportReuse: false;
        callerControlledStableOutputNamespaceRequired: true;
        savedReportIsNotPublicationAuthority: true;
        futurePublisherMustRerunK38: true;
        futurePublisherMustDirectlyVerifyMetadataAndEtag: true;
        rssStrictlyWithinLimitWithReservedHeadroom: true;
    };
    readiness: {
        dryRun: "GO";
        publicationAuthorization: "REQUIRED";
        publication: "NO-GO";
        r2Mutation: "NO-GO";
        android: "NO-GO";
        consumer: "NO-GO";
        authority: "NO-GO";
        production: "NO-GO";
    };
    state: "OPERATIONAL_DRY_RUN_ONLY_NON_AUTHORITATIVE_FUTURE_PUBLISHER_MUST_RERUN_K38";
}
