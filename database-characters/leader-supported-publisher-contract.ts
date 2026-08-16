import type { CharacterLeaderSupportedPublisherObjectKind } from "./leader-supported-publisher-dry-run-contract";

export const CHARACTER_LEADER_SUPPORTED_PUBLISHER_CONTRACT_VERSION = "1.0.0" as const;
export const CHARACTER_LEADER_SUPPORTED_PUBLISHER_BUCKET = "dokkanpanion-data" as const;
export const CHARACTER_LEADER_SUPPORTED_PUBLISHER_REGION = "auto" as const;
export const CHARACTER_LEADER_SUPPORTED_PUBLISHER_ENDPOINT_PATTERN = "https://<32-hex-account-id>.r2.cloudflarestorage.com" as const;
export const CHARACTER_LEADER_SUPPORTED_PUBLISHER_NAMESPACE = "database-characters/leader-supported/v1" as const;
export const CHARACTER_LEADER_SUPPORTED_PUBLISHER_REPORT_NAMESPACE = "database-characters-k60-leader-supported-publisher-v1" as const;
export const CHARACTER_LEADER_SUPPORTED_PUBLISHER_REPORT_FILE = "database-characters-k60-leader-supported-publisher-report.json" as const;
export const CHARACTER_LEADER_SUPPORTED_PUBLISHER_RECEIPT_FILE = "database-characters-k60-leader-supported-publication-receipt.json" as const;
export const CHARACTER_LEADER_SUPPORTED_PUBLISHER_REPORT_LIMIT_BYTES = 64 * 1024;
export const CHARACTER_LEADER_SUPPORTED_PUBLISHER_OBJECT_LIMIT_BYTES = 16 * 1024 * 1024;
export const CHARACTER_LEADER_SUPPORTED_PUBLISHER_AGGREGATE_LIMIT_BYTES = 96 * 1024 * 1024;
export const CHARACTER_LEADER_SUPPORTED_PUBLISHER_RSS_LIMIT_BYTES = 1024 * 1024 * 1024;

export interface CharacterLeaderSupportedPublicationObjectPlan {
    order: 1 | 2 | 3 | 4;
    kind: CharacterLeaderSupportedPublisherObjectKind;
    objectKey: string;
    sha256: string;
    sizeBytes: number;
    contentType: "application/gzip" | "application/json";
    cacheControl: "public, max-age=31536000, immutable";
    missingProtocol: "PUT_IF_NONE_MATCH_STAR";
    raceProtocol: "ACCEPT_409_OR_412_ONLY_AFTER_EXACT_REREAD";
    overwrite: "FORBIDDEN";
}

export interface CharacterLeaderSupportedPublicationPlanBody {
    schemaVersion: 1;
    contract: "dokkan-database-character-leader-supported-publication-plan";
    contractVersion: typeof CHARACTER_LEADER_SUPPORTED_PUBLISHER_CONTRACT_VERSION;
    remote: {
        bucket: typeof CHARACTER_LEADER_SUPPORTED_PUBLISHER_BUCKET;
        region: typeof CHARACTER_LEADER_SUPPORTED_PUBLISHER_REGION;
        endpointPattern: typeof CHARACTER_LEADER_SUPPORTED_PUBLISHER_ENDPOINT_PATTERN;
        namespace: typeof CHARACTER_LEADER_SUPPORTED_PUBLISHER_NAMESPACE;
    };
    source: {
        k58FullArtifactFingerprintSha256: string;
        k58LineageFingerprintSha256: string;
        k58ArtifactSetSha256: string;
        k56ArtifactSetSha256: string;
    };
    immutableObjects: CharacterLeaderSupportedPublicationObjectPlan[];
    mutableManifest: {
        order: "LAST";
        objectKey: "database-characters/leader-supported/v1/manifest.json";
        sha256: string;
        sizeBytes: number;
        contentType: "application/json";
        cacheControl: "no-store";
        missingProtocol: "PUT_IF_NONE_MATCH_STAR";
        differentProtocol: "PUT_IF_MATCH_FRESH_STRONG_ETAG";
        matchingProtocol: "NO_WRITE_EXACT_REREAD";
        raceProtocol: "ACCEPT_409_OR_412_ONLY_AFTER_EXACT_REREAD";
        unconditionalWrite: "FORBIDDEN";
    };
    ordering: {
        immutableInK58Order: true;
        sourceRevalidationBeforeMutableManifest: true;
        allImmutablesRereadImmediatelyBeforeMutableManifest: true;
        mutableManifestRereadImmediatelyBeforeCas: true;
        manifestLast: true;
    };
    forbidden: { unconditionalWrite: true; delete: true; copy: true; multipart: true };
}

export interface CharacterLeaderSupportedPublicationPlan extends CharacterLeaderSupportedPublicationPlanBody {
    publicationId: string;
}

export interface CharacterLeaderSupportedPublisherReport {
    schemaVersion: 1;
    contract: "dokkan-database-character-leader-supported-publisher";
    contractVersion: typeof CHARACTER_LEADER_SUPPORTED_PUBLISHER_CONTRACT_VERSION;
    checkedAt: string;
    mode: "operational-prepublication-dry-run";
    publicationId: string;
    plan: CharacterLeaderSupportedPublicationPlan;
    k59: {
        reportSha256: string;
        checkedAt: string;
        remotePreflight: "GO";
        actions: Array<{ order: number | "LAST"; objectKey: string; observedStatus: string; action: string; precondition: string }>;
    };
    checks: {
        k59FreshRealReadOnlyGo: true;
        k58SourceBoundAfterK59: true;
        publicationIdExcludesCheckedAtAndK59Observations: true;
        clientConstruction: "NOT_EXECUTED";
        credentialRead: false;
        remoteWriteCount: 0;
        localReportCreateOnly: true;
        outputNamespaceThreatModel: "caller_controlled_stable_during_operation";
        concurrentSameUserAncestorReplacementProtected: false;
    };
    readiness: {
        dryRun: "GO";
        publication: "NOT_EXECUTED";
        r2Mutation: "NO-GO";
        authority: "NO-GO";
        production: "NO-GO";
        android: "NO-GO";
        perProcessRssUnder1GiB: "NOT_EXECUTED";
        processTreeRssUnder1GiB: "NO-GO";
        concurrentOutputAncestorReplacement: "NO-GO";
    };
}

export interface CharacterLeaderSupportedPublicationReceipt {
    schemaVersion: 1;
    contract: "dokkan-database-character-leader-supported-publication-receipt";
    contractVersion: typeof CHARACTER_LEADER_SUPPORTED_PUBLISHER_CONTRACT_VERSION;
    publicationId: string;
    planSha256: string;
    k59ReportSha256: string;
    source: {
        k58FullArtifactFingerprintSha256: string;
        k58LineageFingerprintSha256: string;
        k58ArtifactSetSha256: string;
        k56ArtifactSetSha256: string;
    };
    summary: CharacterLeaderSupportedPublicationSummary;
    finalManifestVerified: true;
    forbiddenOperations: { deleteCount: 0; unconditionalWriteCount: 0; copyCount: 0; multipartCount: 0 };
    rssValidation: "NOT_INCLUDED_ARTIFACT_IS_NOT_RSS_AUTHORITY";
}

export interface CharacterLeaderSupportedPublicationSummary {
    publicationId: string;
    immutableUploaded: number;
    immutableReused: number;
    immutableVerified: 4;
    manifestResult: "REUSED" | "CREATED" | "REPLACED" | "CONCURRENT_IDEMPOTENT_COMPLETION";
    manifestLast: true;
    finalManifestVerified: true;
    deleteCount: 0;
    unconditionalWriteCount: 0;
    copyCount: 0;
    multipartCount: 0;
    readiness: { publicationExecution: "COMPLETED_CONDITIONALLY"; authority: "NO-GO"; production: "NO-GO"; android: "NO-GO" };
}
