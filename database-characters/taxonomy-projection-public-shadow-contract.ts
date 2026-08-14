import { TaxonomyProjectionRecord } from "./taxonomy-projection-contract";

export const TAXONOMY_PROJECTION_PUBLIC_SHADOW_SCHEMA_VERSION = 1 as const;
export const TAXONOMY_PROJECTION_PUBLIC_SHADOW_CONTRACT_VERSION = "1.0.0" as const;
export const TAXONOMY_PROJECTION_PUBLIC_SHADOW_BASE_URL = "https://assets.dkbcompanion.com/" as const;
export const TAXONOMY_PROJECTION_PUBLIC_SHADOW_MANIFEST_KEY =
    "database-characters/taxonomy-projection/v1/manifest.json" as const;
export const TAXONOMY_PROJECTION_PUBLIC_SHADOW_MANIFEST_SHA256 =
    "9f803eb8eba00f2b7f49681b379fb3fe71eb08d551dc69cab03204542ec6e1e8" as const;
export const TAXONOMY_PROJECTION_PUBLIC_SHADOW_MANIFEST_SIZE_BYTES = 7_159;
export const TAXONOMY_PROJECTION_PUBLIC_SHADOW_MAX_RESPONSE_BYTES = 1024 * 1024;
export const TAXONOMY_PROJECTION_PUBLIC_SHADOW_MAX_AGGREGATE_BYTES = 5 * 1024 * 1024;
export const TAXONOMY_PROJECTION_PUBLIC_SHADOW_REQUEST_TIMEOUT_MS = 30_000;
export const TAXONOMY_PROJECTION_PUBLIC_SHADOW_MAX_ERROR_LENGTH = 512;

export interface TaxonomyProjectionPublicShadowReport {
    schemaVersion: typeof TAXONOMY_PROJECTION_PUBLIC_SHADOW_SCHEMA_VERSION;
    contract: "dokkan-database-character-taxonomy-projection-public-shadow-k41";
    contractVersion: typeof TAXONOMY_PROJECTION_PUBLIC_SHADOW_CONTRACT_VERSION;
    checkedAt: string;
    mode: "explicit_opt_in_remote_read_only_shadow";
    remote: {
        publicBaseUrl: typeof TAXONOMY_PROJECTION_PUBLIC_SHADOW_BASE_URL;
        mutableManifestKey: typeof TAXONOMY_PROJECTION_PUBLIC_SHADOW_MANIFEST_KEY;
        objectMethod: "GET";
        requestCount: 5;
        redirects: "BLOCKED";
        acceptEncoding: "identity";
        requestTimeoutMs: number;
        responseLimitBytesExclusive: number;
        aggregateLimitBytesExclusive: number;
        bytesRead: number;
    };
    release: {
        remoteManifestSha256: typeof TAXONOMY_PROJECTION_PUBLIC_SHADOW_MANIFEST_SHA256;
        remoteManifestSizeBytes: typeof TAXONOMY_PROJECTION_PUBLIC_SHADOW_MANIFEST_SIZE_BYTES;
        releaseId: "4a6dcfa4b8818abbd070bad2a1318eec5df9a2b1b306286adfec5fadee8ddfe4";
        datasetVersion: "global-6.4.0-v338-2026-08-05-k35-taxonomy-projection-v1";
        payloadSha256: "7e5c9fa501c8401489e8e6c0a057b1ecf01037d7969091ed88c0df73547f19e8";
        payloadSizeBytes: 247261;
        rawSha256: "c740d4874118c65f94588594f6b745146c506dd78a73fd605bbf40abf28d168a";
        rawSizeBytes: 4228101;
    };
    projection: {
        recordCount: 5759;
        characterClassIncludedCardCount: 5759;
        categoryIncludedCardCount: 5729;
        categoryUnknownCardCount: 30;
        categoryAssignmentCount: 54072;
        linkIncludedCardCount: 5620;
        linkUnknownCardCount: 139;
        linkEntryCount: 34018;
    };
    checks: {
        remoteManifestPinned: true;
        closedOrderedInventory: true;
        everyObjectHashAndSizeVerified: true;
        exactK35BytesReproduced: true;
        canonicalPayloadAndDeterministicGzip: true;
        supportedOnlyValidationValid: true;
        lookupKeyOnlyCardId: true;
        omittedDimensionsPreserved: true;
        labelsOrPresentationAbsent: true;
        characterArrayReadCount: 0;
        applyCount: 0;
        remoteMutationCount: 0;
    };
    readiness: {
        publicDelivery: "GO";
        remoteShadowLookup: "GO";
        persistedConsumer: "NO-GO";
        characterArray: "NO-GO";
        applyOrOverlay: "NO-GO";
        android: "NO-GO";
        authority: "NO-GO";
        production: "NO-GO";
        fyiRemoval: "NO-GO";
        dokkanInfoRemoval: "NO-GO";
    };
}

export interface TaxonomyProjectionPublicShadow {
    readonly report: TaxonomyProjectionPublicShadowReport;
    lookup(cardId: string): TaxonomyProjectionRecord | undefined;
}
