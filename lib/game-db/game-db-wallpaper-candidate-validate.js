"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateWallpaperCandidate = void 0;
const crypto_1 = require("crypto");
const promises_1 = require("fs/promises");
const path_1 = require("path");
const game_db_wallpaper_assets_1 = require("./game-db-wallpaper-assets");
const SNAPSHOT = "1788329250";
const DATABASE_SHA256 = "7a6ca01808aea355ef28f9c0190e2c072f43a7c08be41d363f5b052824922495";
function sha256(bytes) {
    return (0, crypto_1.createHash)("sha256").update(bytes).digest("hex");
}
async function validateWallpaperCandidate(options) {
    const dataset = JSON.parse(await (0, promises_1.readFile)((0, path_1.resolve)(options.stageDatasetPath), "utf8"));
    const audit = JSON.parse(await (0, promises_1.readFile)((0, path_1.resolve)(options.rewardAuditPath), "utf8"));
    const manifest = (0, game_db_wallpaper_assets_1.validateWallpaperAssetManifest)(JSON.parse(await (0, promises_1.readFile)((0, path_1.resolve)(options.wallpaperManifestPath), "utf8")));
    if (dataset.sourceSnapshotVersion !== SNAPSHOT || audit.sourceSnapshotVersion !== SNAPSHOT
        || manifest.source.databaseSnapshotVersion !== SNAPSHOT
        || dataset.sourceDatabaseSha256 !== DATABASE_SHA256 || audit.sourceDatabaseSha256 !== DATABASE_SHA256
        || manifest.source.databaseSha256 !== DATABASE_SHA256)
        throw new Error("WP-01 artifacts are not bound to the current official snapshot");
    if (audit.schemaVersion !== 3 || manifest.wallpaperCount !== 88 || manifest.presentationCount !== 88
        || audit.wallpaper.catalogAndAssets.catalogCount !== 88
        || audit.wallpaper.catalogAndAssets.assetPresentationCount !== 88
        || audit.wallpaper.catalogAndAssets.completeCount !== 88
        || audit.wallpaper.globalAuditedCoverage.occurrenceCount !== 53
        || audit.wallpaper.globalAuditedCoverage.uniqueItemCount !== 28
        || audit.wallpaper.stageDeliverableCoverage.occurrenceCount !== 24
        || audit.wallpaper.stageDeliverableCoverage.uniqueItemCount !== 24
        || audit.wallpaper.stageDeliveredCoverage.occurrenceCount !== 24
        || audit.wallpaper.stageDeliveredCoverage.uniqueItemCount !== 24
        || audit.wallpaper.outsideCurrentConsumerContract.occurrenceCount !== 29) {
        throw new Error("WP-01 current wallpaper cardinalities drifted");
    }
    const deliveredSurfaceCounts = new Map(audit.wallpaper.stageDeliveredCoverage.surfaceOccurrences
        .map(item => [item.surface, item.occurrenceCount]));
    if (deliveredSurfaceCounts.get("eventMissions") !== 24
        || deliveredSurfaceCounts.get("questLevelBossDrops") !== 0
        || deliveredSurfaceCounts.get("questLevelDropPreviews") !== 0
        || deliveredSurfaceCounts.get("zBattleCheckpointRewards") !== 0
        || deliveredSurfaceCounts.get("zBattleFirstRewards") !== 0) {
        throw new Error("WP-01 current Stage wallpaper surface distribution drifted");
    }
    const outsideCounts = new Map(audit.wallpaper.outsideCurrentConsumerContract.classifications
        .map(item => [item.kind, item.occurrenceCount]));
    if (outsideCounts.get("mission-category-completion-rewards") !== 25
        || outsideCounts.get("rmbattle-mission-rewards") !== 1
        || outsideCounts.get("general-missions-without-stage-binding") !== 3) {
        throw new Error("WP-01 outside-contract wallpaper classification drifted");
    }
    const mission = dataset.eventMissions?.find(item => item.id === "30050");
    if (!mission || mission.areaId !== "1203" || JSON.stringify(mission.stageIds) !== JSON.stringify(["12030011", "12030021"])) {
        throw new Error("WP-01 fixture mission 30050 did not resolve to area 1203 and its official stages");
    }
    const reward = mission.rewards.find(item => item.itemType === "WallpaperItem" && item.itemId === "76");
    if (!reward || reward.quantity !== 1 || reward.name !== "Companions on Planet Vampa" || !reward.description
        || !reward.wallpaper?.rewardThumbnailAssetPath || !reward.wallpaper.thumbnailAssetPath || !reward.wallpaper.fullImageAssetPath) {
        throw new Error("WP-01 fixture WallpaperItem:76 lacks the official reward presentation");
    }
    const fixturePaths = [reward.wallpaper.rewardThumbnailAssetPath, reward.wallpaper.thumbnailAssetPath, reward.wallpaper.fullImageAssetPath];
    for (const path of fixturePaths) {
        const entry = manifest.assets.find(asset => asset.path === path);
        if (!entry || !entry.sourceUrl.startsWith("official-cpk-extract://") || entry.sourceFiles.length < 3) {
            throw new Error(`WP-01 fixture asset lacks official provenance: ${path}`);
        }
        const bytes = await (0, promises_1.readFile)((0, path_1.resolve)(options.wallpaperAssetRoot, "game-assets", ...path.split("/")));
        if (bytes.byteLength !== entry.sizeBytes || sha256(bytes) !== entry.sha256)
            throw new Error(`WP-01 fixture asset drifted: ${path}`);
    }
    if (manifest.assets.some(asset => !asset.sourceUrl.startsWith("official-cpk-extract://"))) {
        throw new Error("WP-01 wallpaper mirror contains a non-first-party source");
    }
    return {
        snapshot: SNAPSHOT,
        databaseSha256: DATABASE_SHA256,
        wallpaperCount: manifest.wallpaperCount,
        globalAuditedCoverage: audit.wallpaper.globalAuditedCoverage,
        stageDeliverableCoverage: audit.wallpaper.stageDeliverableCoverage,
        stageDeliveredCoverage: audit.wallpaper.stageDeliveredCoverage,
        outsideCurrentConsumerContract: audit.wallpaper.outsideCurrentConsumerContract.classifications,
        fixture: { missionId: mission.id, areaId: mission.areaId, itemId: reward.itemId, quantity: reward.quantity, name: reward.name, assetPaths: fixturePaths },
        mirror: { assetCount: manifest.assetCount, assetBytes: manifest.assetBytes, inventorySha256: manifest.inventorySha256, fullImageCount: manifest.fullImageCount, gaps: manifest.fullImageGaps },
    };
}
exports.validateWallpaperCandidate = validateWallpaperCandidate;
async function main() {
    const values = new Map();
    const args = process.argv.slice(2);
    for (let index = 0; index < args.length; index += 1) {
        const separator = args[index].indexOf("=");
        const name = separator >= 0 ? args[index].slice(0, separator) : args[index];
        if (!["--stage-dataset", "--reward-audit", "--wallpaper-manifest", "--wallpaper-asset-root"].includes(name))
            throw new Error(`Unexpected WP-01 validation argument: ${name}`);
        const value = separator >= 0 ? args[index].slice(separator + 1) : args[++index];
        if (!value || values.has(name))
            throw new Error(`Missing or duplicate WP-01 validation argument: ${name}`);
        values.set(name, value);
    }
    for (const required of ["--stage-dataset", "--reward-audit", "--wallpaper-manifest", "--wallpaper-asset-root"])
        if (!values.has(required))
            throw new Error(`Missing WP-01 validation argument: ${required}`);
    console.log(JSON.stringify(await validateWallpaperCandidate({
        stageDatasetPath: values.get("--stage-dataset"),
        rewardAuditPath: values.get("--reward-audit"),
        wallpaperManifestPath: values.get("--wallpaper-manifest"),
        wallpaperAssetRoot: values.get("--wallpaper-asset-root"),
    }), null, 2));
}
if (require.main === module)
    main().catch(error => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; });
//# sourceMappingURL=game-db-wallpaper-candidate-validate.js.map