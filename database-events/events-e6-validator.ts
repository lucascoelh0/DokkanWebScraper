import { createHash } from "crypto";
import { buildEventsE6Coverage, buildEventsE6Dataset } from "./events-e6-builder";
import { EventsE6ApkBaseline, EventsE6ApkObservation, EventsE6Dataset, EventsE6Observation, EventsE6Validation } from "./events-e6-contract";

const str = (value: unknown) => String(value);
const keyHash = (value: string) => createHash("sha256").update(value).digest("hex");

export function validateEventsE6ApkBaseline(baseline: EventsE6ApkBaseline, apk: EventsE6ApkObservation, apkSha256: string, apkSizeBytes: number) {
    if (baseline.schemaVersion !== 1 || baseline.sourceApk.sha256 !== apkSha256 || baseline.sourceApk.sizeBytes !== apkSizeBytes || baseline.entryCount !== apk.entryCount || baseline.assetEntryCount !== apk.assetEntryCount) return false;
    if (Object.values(apk.assetExtensionCounts).reduce((sum, value) => sum + value, 0) !== apk.assetEntryCount || new Set(apk.assetEntryPaths).size !== apk.assetEntryPaths.length) return false;
    const observed = apk.samples.map(value => ({ path: value.path, exists: value.exists, sizeBytes: value.sizeBytes, sha256: value.sha256 }));
    const expected = baseline.samples.map(value => ({ path: value.path, exists: true, sizeBytes: value.sizeBytes, sha256: value.sha256 }));
    return JSON.stringify(observed) === JSON.stringify(expected);
}

function expectedBindingCount(o: EventsE6Observation) {
    const fields = (rows: Array<Record<string, unknown>>, columns: string[]) => rows.reduce((sum, row) => sum + columns.filter(column => row[column] !== null && row[column] !== undefined && row[column] !== "").length, 0);
    return fields(o.areas, ["event_image_path", "banner_image_path", "listbutton_image_path"]) + fields(o.questMaps, ["sugoroku_bgm_id", "battle_bgm_id", "boss_bgm_id", "battle_background_id", "start_script_id", "finish_script_id"]) + fields(o.zBattleStages, ["banner_image_path", "listbutton_image_path"]) + fields(o.zBattleStageViews, ["enemy_resource_id"]) + fields(o.budokais, ["mission_reward_image_path", "banner_image_path", "home_banner_image_path", "listbutton_image_path", "entry_script_id", "description_script_id"]) + fields(o.originSeries, ["banner_image_path"]) + fields(o.originEpisodes, ["banner_image_path", "bgm_id"]) + fields(o.originPages, ["background_image_path", "bgm_id"]) + fields(o.originBattles, ["bgm_id", "background_id"]) + fields(o.sdMaps, ["background_image_id"]) + fields(o.sdArenas, ["background_image_id"]) + fields(o.linkedMissionCategories, ["image_path"]) + fields(o.referencedEnemyCards, ["resource_id"]);
}

export function validateEventsE6Dataset(dataset: EventsE6Dataset, observation: EventsE6Observation, apk: EventsE6ApkObservation, baseline: EventsE6ApkBaseline, apkBaselineValid: boolean, expected?: { generatedAt: string; sourceSnapshotVersion: string; sourceDatabaseSha256: string; sourceE5Sha256: string; sourceApkSha256: string; sourceApkSizeBytes: number }): EventsE6Validation {
    const failures: string[] = [];
    if (dataset.schemaVersion !== 1 || dataset.contract !== "dokkan-events-database-first-assets" || dataset.contractVersion !== "0.7.0" || dataset.generatedAtPolicy !== "pinned_to_source_snapshot_for_reproducible_bytes") failures.push("contract identity");
    const rebuilt = buildEventsE6Dataset({ observation, apk, generatedAt: dataset.generatedAt, sourceSnapshotVersion: dataset.sourceSnapshotVersion, sourceDatabaseSha256: dataset.sourceDatabaseSha256, sourceE5Sha256: dataset.sourceE5.sha256, sourceApkSha256: dataset.sourceApk.sha256, sourceApkSizeBytes: dataset.sourceApk.sizeBytes }), exactProjection = JSON.stringify(dataset) === JSON.stringify(rebuilt); if (!exactProjection) failures.push("exact source projection");
    if (!apkBaselineValid || !validateEventsE6ApkBaseline(baseline, apk, dataset.sourceApk.sha256, dataset.sourceApk.sizeBytes)) failures.push("APK baseline");
    if (expected && (dataset.generatedAt !== expected.generatedAt || dataset.sourceSnapshotVersion !== expected.sourceSnapshotVersion || dataset.sourceDatabaseSha256 !== expected.sourceDatabaseSha256 || dataset.sourceE5.sha256 !== expected.sourceE5Sha256 || dataset.sourceApk.sha256 !== expected.sourceApkSha256 || dataset.sourceApk.sizeBytes !== expected.sourceApkSizeBytes)) failures.push("source lineage");
    const coverage = buildEventsE6Coverage(dataset, observation); if (coverage.danglingIdCount !== 0) failures.push(`dangling ids ${coverage.danglingIdCount}`);
    if (new Set(dataset.pathAssets.map(value => value.assetKey)).size !== dataset.pathAssets.length || new Set(dataset.numericAssets.map(value => value.assetKey)).size !== dataset.numericAssets.length) failures.push("duplicate asset key");
    for (const value of dataset.pathAssets) { if (value.assetKey !== `database_path:${keyHash(value.rawPath)}`) failures.push(`path key ${value.rawPath}`); if (value.baseApkLiteralEntryStatus === "absent_literal" && value.deliveryStatus !== "unknown_requires_downloaded_container_or_endpoint") failures.push(`path delivery promotion ${value.rawPath}`); if (value.baseApkPrefixedCandidate !== null && (value.baseApkPrefixedCandidate.status !== "partial" || value.deliveryStatus !== "unknown_requires_downloaded_container_or_endpoint")) failures.push(`prefix promotion ${value.rawPath}`); }
    for (const value of dataset.numericAssets) { if (value.assetKey !== `${value.kind}:${value.rawId}` || value.status !== "partial" || value.missing !== "validated_runtime_asset_manifest") failures.push(`numeric boundary ${value.assetKey}`); if (value.bundledCandidates.some(candidate => candidate.status !== "partial")) failures.push(`candidate promotion ${value.assetKey}`); }
    if (dataset.downloadBoundary.eventAssetEndpointStatus !== "unknown" || dataset.unusedAssetPathPatterns.some(value => value.status !== "unknown")) failures.push("delivery semantic promotion");
    const losslessSourceBindingCount = expectedBindingCount(observation); if (dataset.bindings.length !== losslessSourceBindingCount) failures.push("lossless source bindings");
    const samplePaths = new Set(apk.assetEntryPaths); for (const value of dataset.apkAssetInventory.representativeSamples) if (!samplePaths.has(value.apkEntryPath) || value.status !== "supported") failures.push(`sample ${value.apkEntryPath}`);
    const finite = (value: unknown): boolean => typeof value === "number" ? Number.isFinite(value) : Array.isArray(value) ? value.every(finite) : value !== null && typeof value === "object" ? Object.values(value).every(finite) : true; if (!finite(dataset)) failures.push("non-finite numeric value");
    return { schemaVersion: 1, valid: failures.length === 0, exactProjection, losslessSourceBindingCount, apkBaselineValid, failures };
}
