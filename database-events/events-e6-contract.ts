import { EventsE3RawRow } from "./events-e3-contract";

export interface EventsE6Observation {
    areas: EventsE3RawRow[];
    questMaps: EventsE3RawRow[];
    questTargets: EventsE3RawRow[];
    zBattleStages: EventsE3RawRow[];
    zBattleStageViews: EventsE3RawRow[];
    budokais: EventsE3RawRow[];
    originSeries: EventsE3RawRow[];
    originEpisodes: EventsE3RawRow[];
    originPages: EventsE3RawRow[];
    originBattles: EventsE3RawRow[];
    sdMaps: EventsE3RawRow[];
    sdArenas: EventsE3RawRow[];
    linkedMissionCategoryIds: Array<number | string>;
    linkedMissionCategories: EventsE3RawRow[];
    referencedEnemyCardIds: Array<number | string>;
    referencedEnemyCards: EventsE3RawRow[];
    unusedAssetPathPatterns: EventsE3RawRow[];
}

export interface EventsE6ApkObservation {
    entryCount: number;
    assetEntryCount: number;
    assetExtensionCounts: Record<string, number>;
    assetEntryPaths: string[];
    samples: Array<{ path: string; exists: boolean; sizeBytes: number | null; compressedSizeBytes: number | null; sha256: string | null }>;
}

export interface EventsE6ApkBaseline {
    schemaVersion: 1;
    sourceApk: { fileName: "dokkan-global-base.apk"; sizeBytes: number; sha256: string };
    entryCount: number;
    assetEntryCount: number;
    samples: Array<{ path: string; sizeBytes: number; sha256: string }>;
}

export type EventsE6EntityKind = "area" | "quest_level" | "z_battle_stage" | "budokai" | "origin_series" | "origin_episode" | "origin_page" | "origin_battle" | "sd_map" | "sd_arena" | "mission_category" | "enemy_card";
export type EventsE6NumericAssetKind = "bgm" | "battle_background" | "script" | "origin_background" | "sd_background_image" | "card_resource" | "z_enemy_resource";

export interface EventsE6Binding {
    source: { entityKind: EventsE6EntityKind; entityId: string; table: string; rowId: string; column: string };
    assetKey: string;
    structuralStatus: "supported";
}

export interface EventsE6Dataset {
    schemaVersion: 1;
    contract: "dokkan-events-database-first-assets";
    contractVersion: "0.7.0";
    generatedAt: string;
    generatedAtPolicy: "pinned_to_source_snapshot_for_reproducible_bytes";
    sourceSnapshotVersion: string;
    sourceDatabaseSha256: string;
    sourceE5: { contractVersion: "0.6.0"; sha256: string };
    sourceApk: { fileName: "dokkan-global-base.apk"; sha256: string; sizeBytes: number; entryCount: number; assetEntryCount: number };
    pathAssets: Array<{ assetKey: string; rawPath: string; source: "database_path_column"; baseApkLiteralEntryStatus: "present_literal" | "absent_literal"; baseApkLiteralEntryPath: string | null; baseApkPrefixedCandidate: { apkEntryPath: string; status: "partial"; boundary: "assets_prefix_resolution_has_no_runtime_consumer_proof" } | null; deliveryStatus: "extractable_direct_from_base_apk" | "unknown_requires_downloaded_container_or_endpoint" }>;
    numericAssets: Array<{ assetKey: string; kind: EventsE6NumericAssetKind; rawId: string; status: "partial"; bundledCandidates: Array<{ apkEntryPath: string; status: "partial"; boundary: "filename_pattern_candidate_no_runtime_consumer_proof" }>; missing: "validated_runtime_asset_manifest" }>;
    bindings: EventsE6Binding[];
    apkAssetInventory: { extensionCounts: Record<string, number>; representativeSamples: Array<{ apkEntryPath: string; sizeBytes: number; compressedSizeBytes: number; sha256: string; status: "supported" }> };
    downloadBoundary: { directDatabasePathPresentInBaseApkCount: number; directDatabasePathAbsentFromBaseApkCount: number; bundledAssetEntryCount: number; cpkContainerCount: number; eventAssetEndpointStatus: "unknown"; note: "base_apk_entries_are_extractable_event_paths_may_require_downloaded_cpk_or_external_endpoint" };
    unusedAssetPathPatterns: Array<{ sourceRowId: string; rawPattern: string; status: "unknown"; boundary: "table_name_does_not_establish_download_or_exclusion_semantics" }>;
}

export interface EventsE6Coverage {
    schemaVersion: 1;
    pathAssetCount: number;
    numericAssetCount: number;
    bindingCount: number;
    bindingsByEntityKind: Record<string, number>;
    directBaseApkPathCount: number;
    absentBaseApkPathCount: number;
    bundledCandidateCount: number;
    representativeSampleCount: number;
    representativeSampleBytes: number;
    danglingIdCount: number;
}

export interface EventsE6Validation { schemaVersion: 1; valid: boolean; exactProjection: boolean; losslessSourceBindingCount: number; apkBaselineValid: boolean; failures: string[] }
export interface EventsE6Manifest { schemaVersion: 1; contractVersion: "0.7.0"; generatedAt: string; generatedAtPolicy: "pinned_to_source_snapshot_for_reproducible_bytes"; sourceSnapshotVersion: string; fileName: "events-e6-assets.json"; compression: "none"; sha256: string; sizeBytes: number; sourceDatabaseSha256: string; sourceE5Sha256: string; sourceApkSha256: string; sourceApkSizeBytes: number; apkBaselineSha256: string; coverage: { fileName: "events-e6-coverage.json"; sha256: string; sizeBytes: number }; validation: { fileName: "events-e6-validation.json"; sha256: string; sizeBytes: number } }
