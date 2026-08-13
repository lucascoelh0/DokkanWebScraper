export type DdCaptureId = "incremental" | "clean_install" | "download_all";
export type DdCaptureMode = "incremental" | "clean_install" | "download_all";

export interface DdCaptureLock {
    captureId: DdCaptureId;
    mode: DdCaptureMode;
    fileName: string;
    sizeBytes: number;
    sha256: string;
    entryCount: number;
    modifiedAt: string;
}

export type DdExternalSourceId = "clean_install_ondemand_manifest" | "download_all_ondemand_manifest" | "download_all_client_assets_manifest" | "clean_install_cards_account_body";
export interface DdExternalSourceLock {
    sourceId: DdExternalSourceId;
    fileName: string | null;
    locator: "exact_file_name" | "single_client_assets_device_size_pattern";
    sizeBytes: number;
    sha256: string;
    modifiedAt: string;
    classification: "allowlisted_manifest_body_in_memory_only" | "opaque_account_scoped_sensitive_body";
    captureId: "clean_install" | "download_all";
    endpoint: "/ondemand_assets" | "/client_assets" | "/cards";
    uiFileCount: 4868 | 25233 | null;
}

export interface Dd0SourceLock {
    schemaVersion: 1;
    contract: "dokkan-data-download-offline-source-lock";
    contractVersion: "0.1.0";
    captureRoot: "dokkan-har-2026-08-13";
    captures: DdCaptureLock[];
    externalConfidentialSources: DdExternalSourceLock[];
    externalScreenshots: Array<{ role: "clean_install_ui" | "download_all_ui"; uiFileCount: number; sizeBytes: number; sha256: string; modifiedAt: string }>;
    preTransformClassification: {
        allowedVersionableTargets: string[];
        forbiddenVersionableTargets: string[];
    };
}

export interface Dd0Dataset {
    schemaVersion: 1;
    contract: "dokkan-data-download-source-audit";
    contractVersion: "0.1.0";
    generatedAt: string;
    collectionMode: "offline_local_har_no_requests_no_replay";
    defaultEnabled: false;
    productionMutation: false;
    sourceLockSha256: string;
    sources: DdCaptureLock[];
    externalConfidentialSources: DdExternalSourceLock[];
    externalScreenshots: Dd0SourceLock["externalScreenshots"];
    preTransformClassification: Dd0SourceLock["preTransformClassification"];
}

export type DdScope = "global" | "account" | "mixed" | "auth" | "mutation" | "cdn" | "unknown";
export type DdBodyDisposition = "absent" | "json_identity" | "identity_non_json" | "binary_base64" | "binary_identity_not_captured" | "not_modified_304";
export interface DdBodyMetadata { present: boolean; mimeType: string; encoding: "identity" | "base64"; declaredSizeBytes: number | null; capturedSizeBytes: number; disposition: DdBodyDisposition }
export interface Dd1Entry {
    captureId: DdCaptureId;
    mode: DdCaptureMode;
    entryIndex: number;
    capturedAt: string | null;
    host: "ishin-global.aktsk.com" | "cf.ishin-global.aktsk.com";
    method: string;
    pathname: string;
    status: number;
    requestBodyPresent: boolean;
    request: DdBodyMetadata;
    response: DdBodyMetadata;
    safeRequestHeaderNames: string[];
    safeResponseHeaderNames: string[];
    scope: DdScope;
    mutationObservedOnly: boolean;
    deviceAssetSizeBytesQuery: { presence: "present" | "absent"; type: "decimal_string" | "unknown"; relationToPriorObservation: "equal" | "different" | "not_comparable" };
}
export interface Dd1TemporalRelation { captureId: DdCaptureId; earlierEntryIndex: number; laterEntryIndex: number; kind: "api_to_manifest" | "manifest_to_cdn"; evidence: "capture_order_only" }
export interface Dd1Dataset { schemaVersion: 1; contract: "dokkan-data-download-lossless-entry-inventory"; contractVersion: "0.1.0"; generatedAt: string; collectionMode: "offline_local_har_no_requests_no_replay"; productionMutation: false; defaultEnabled: false; valuePolicy: "no_query_header_cookie_request_body_or_account_values"; sources: DdCaptureLock[]; entries: Dd1Entry[]; temporalRelations: Dd1TemporalRelation[] }

export interface DdProvenance { captureId: DdCaptureId; mode: DdCaptureMode; entryIndex: number; capturedAt: string | null; pathname: "/client_assets" | "/client_assets/database" | "/ondemand_assets"; status: number; bodyState: "observed" | "absent_partial_unknown" }
export interface DdAssetDescriptor { filePath: string; urlPathname: string; algorithm: string; upstreamHashOpaque: string; sizeBytes: number; state: "observed"; provenance: DdProvenance }
export interface DdManifestSummary { sourceId: DdExternalSourceId; descriptorCount: number; uniqueFilePathCount: number; totalSizeBytes: number; algorithm: "xxhash"; identitySetSha256: string; urlPolicy: "ephemeral_non_identity_not_persisted"; transportBinding: DdProvenance }
export type DdPathFamily = "character/card" | "character/card_bg" | "ingame/battle/character" | "character/thumb" | "item" | "gasha/banner" | "bgm/voice/se" | "movie/packaged_movies" | "battle/effect/sprites" | "structural_script/lua/tmx" | "other";
export interface DdPathFamilySummary { family: DdPathFamily; extension: string; descriptorCount: number; totalSizeBytes: number }
export interface DdClientAssetsContract { endpoint: "/client_assets"; state: "observed" | "partial"; completeness: "captured_response_only_not_complete_catalog"; latestVersion: number | null; observedResponseCardinalities: number[]; descriptorObservationCount: number; uniqueFilePathCount: number; crossObservationConsistency: "single_observation" | "agreement" | "representation_mismatch"; assets: DdAssetDescriptor[]; externalFullManifest: null | (DdManifestSummary & { latestVersion: number; pathFamilySummaries: DdPathFamilySummary[]; mandatoryOndemandRelation: { relation: "exact_superset"; mandatoryCount: number; mandatorySizeBytes: number; deltaCount: number; deltaSizeBytes: number } }); deviceAssetSizeBytesQuery: { observedCount: number; absentCount: number; observedType: "decimal_string" | "unknown"; crossObservationRelation: "equal" | "different" | "not_comparable"; captureSpecificProof: null | { captureId: "download_all"; scope: "capture_specific_not_universal"; mandatoryAssetSizeBytes: number; databaseSizeBytes: number; equality: true; queryValuePersisted: false } }; provenance: DdProvenance[] }
export interface DdDatabaseDescriptor { version: number; algorithm: string; upstreamHashOpaque: string; filePath: string; urlPathname: string; patch: { descriptorState: "observed_null"; hashState: "observed_null" }; observedCdnDeclaredSizeBytes: number | null; state: "observed"; provenance: DdProvenance }
export interface DdDatabaseContract { endpoint: "/client_assets/database"; state: "observed" | "partial"; descriptorObservationCount: number; uniqueDescriptorCount: number; crossObservationConsistency: "single_observation" | "agreement" | "representation_mismatch"; descriptors: DdDatabaseDescriptor[]; provenance: DdProvenance[] }
export interface DdOndemandCategorySummary { category: "cards" | "battle_characters" | "card_bgs"; descriptorCount: number; totalSizeBytes: number; algorithm: "xxhash"; identitySetSha256: string }
export interface DdOndemandContract { endpoint: "/ondemand_assets"; state: "partial" | "unknown"; completeness: "external_body_observed_bound_to_body_absent_har_not_universal_complete_catalog"; cardinality: null; assets: []; externalBodyEvidence: null | { observations: DdManifestSummary[]; categories: DdOndemandCategorySummary[]; descriptorCount: number; uniqueFilePathCount: number; totalSizeBytes: number; identityAcrossObservations: "agreement"; urlsAcrossObservations: "all_different_ephemeral_non_identity" }; provenance: DdProvenance[] }
export interface Dd2Dataset { schemaVersion: 1; contract: "dokkan-data-download-asset-contracts"; contractVersion: "0.1.0"; generatedAt: string; collectionMode: "offline_local_har_no_requests_no_replay"; productionMutation: false; defaultEnabled: false; authority: "observed_delivery_metadata_only_no_catalog_completeness_or_runtime_authority"; clientAssets: DdClientAssetsContract; database: DdDatabaseContract; ondemand: DdOndemandContract }

export interface DdValidation { schemaVersion: 1; valid: boolean; failures: string[]; counts: Record<string, number> }
