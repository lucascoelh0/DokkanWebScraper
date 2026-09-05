"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const crypto_1 = require("crypto");
const assert_1 = require("assert");
const mocha_1 = require("mocha");
const game_db_stage_candidate_1 = require("./game-db-stage-candidate");
const game_db_wallpaper_assets_1 = require("./game-db-wallpaper-assets");
(0, mocha_1.describe)("Stage candidate pinned source profile", () => {
    const sha = (value) => (0, crypto_1.createHash)("sha256").update(typeof value === "string" ? value : JSON.stringify(value)).digest("hex");
    function wallpaperManifest() {
        const archives = [{ path: "0076.cpk", sizeBytes: 100, sha256: sha("archive") }];
        const extractedFiles = [
            { path: "0076/0076.lwf", sizeBytes: 10, sha256: sha("lwf") },
            { path: "0076/Images_0076.png", sizeBytes: 13, sha256: sha("full") },
            { path: "0076/icon_0076.png", sizeBytes: 11, sha256: sha("icon") },
            { path: "0076/thumb_0076.png", sizeBytes: 12, sha256: sha("thumb") },
        ].sort((left, right) => left.path.localeCompare(right.path, "en", { numeric: true }));
        const assets = [
            { path: "item/wallpaper/0076/full_0076.png", sourceUrl: "official-cpk-extract://item/wallpaper/0076.cpk#Images_0076.png", sourceFiles: ["archives/0076.cpk", "extracted/0076/0076.lwf", "extracted/0076/Images_0076.png"], sizeBytes: 13, sha256: sha("full") },
            { path: "item/wallpaper/0076/icon_0076.png", sourceUrl: "official-cpk-extract://item/wallpaper/0076.cpk#icon_0076.png", sourceFiles: ["archives/0076.cpk", "extracted/0076/0076.lwf", "extracted/0076/icon_0076.png"], sizeBytes: 11, sha256: sha("icon") },
            { path: "item/wallpaper/0076/thumb_0076.png", sourceUrl: "official-cpk-extract://item/wallpaper/0076.cpk#thumb_0076.png", sourceFiles: ["archives/0076.cpk", "extracted/0076/0076.lwf", "extracted/0076/thumb_0076.png"], sizeBytes: 12, sha256: sha("thumb") },
        ];
        return {
            schemaVersion: 1,
            contract: "dokkan-wallpaper-game-assets",
            contractVersion: "1.0.0",
            generatedAt: "2026-09-04T12:00:00.000Z",
            source: {
                packageName: "com.bandainamcogames.dbzdokkanww",
                versionName: "6.5.5",
                versionCode: "348",
                databaseSnapshotVersion: game_db_stage_candidate_1.PINNED_STAGE_SOURCE_PROFILE.sourceSnapshotVersion,
                databaseSha256: game_db_stage_candidate_1.PINNED_STAGE_SOURCE_PROFILE.sourceDatabaseSha256,
                acquiredAt: "2026-09-04T12:00:00.000Z",
                cpkReader: { repository: "https://github.com/Sewer56/CriFsV2Lib", commit: "169b001c748dfffc28c9fc14fcec269dd45e6eec" },
                bundleRoot: "fixture",
                archiveCount: archives.length,
                archiveBytes: 100,
                archiveInventorySha256: sha(archives),
                archives,
                extractorSha256: game_db_wallpaper_assets_1.WALLPAPER_CPK_EXTRACTOR_SHA256,
                readerBinarySha256: game_db_wallpaper_assets_1.WALLPAPER_CPK_READER_BINARY_SHA256,
                definitionsBinarySha256: game_db_wallpaper_assets_1.WALLPAPER_CPK_DEFINITIONS_BINARY_SHA256,
                extractedFileCount: extractedFiles.length,
                extractedBytes: extractedFiles.reduce((sum, entry) => sum + entry.sizeBytes, 0),
                extractedInventorySha256: sha(extractedFiles),
                extractedFiles,
            },
            wallpaperCount: 1,
            presentationCount: 1,
            rewardThumbnailCount: 1,
            thumbnailCount: 1,
            fullImageCount: 1,
            fullImageGaps: [],
            assetCount: assets.length,
            assetBytes: assets.reduce((sum, entry) => sum + entry.sizeBytes, 0),
            inventorySha256: sha(assets),
            presentations: [{
                    itemId: "76",
                    name: "Companions on Planet Vampa",
                    description: "Official description",
                    rewardThumbnailAssetPath: "item/wallpaper/0076/icon_0076.png",
                    thumbnailAssetPath: "item/wallpaper/0076/thumb_0076.png",
                    fullImageAssetPath: "item/wallpaper/0076/full_0076.png",
                }],
            assets,
        };
    }
    function pinnedTables() {
        return {
            sugoroku_maps: Array.from({ length: game_db_stage_candidate_1.PINNED_STAGE_SOURCE_PROFILE.questLevelCount }, (_, index) => ({ id: String(index + 1), quest_id: "1" })),
            z_battle_stages: Array.from({ length: game_db_stage_candidate_1.PINNED_STAGE_SOURCE_PROFILE.zBattleCount }, (_, index) => ({ id: String(index + 1) })),
            equipment_skill_items: Array.from({ length: game_db_stage_candidate_1.PINNED_STAGE_SOURCE_PROFILE.equipmentItemCount }, (_, index) => ({ id: String(index === 0 ? game_db_stage_candidate_1.PINNED_STAGE_SOURCE_PROFILE.equipmentItemMaxId : index + 1) })),
            equipment_skills: Array.from({ length: game_db_stage_candidate_1.PINNED_STAGE_SOURCE_PROFILE.equipmentSkillCount }, (_, index) => ({ id: String(index + 1) })),
            equipment_skill_limitations: Array.from({ length: game_db_stage_candidate_1.PINNED_STAGE_SOURCE_PROFILE.equipmentLimitationCount }, (_, index) => ({ id: String(index + 1) })),
            link_skill_lv_up_items: Array.from({ length: game_db_stage_candidate_1.PINNED_STAGE_SOURCE_PROFILE.linkSkillLvUpItemCount }, (_, index) => ({ id: String(index + 1) })),
            wallpaper_items: Array.from({ length: game_db_stage_candidate_1.PINNED_STAGE_SOURCE_PROFILE.wallpaperItemCount }, (_, index) => ({ id: String(index) })),
        };
    }
    (0, mocha_1.it)("accepts the exact frozen database identity and cardinalities", () => {
        (0, game_db_stage_candidate_1.validatePinnedStageSourceProfile)(game_db_stage_candidate_1.PINNED_STAGE_SOURCE_PROFILE.sourceSnapshotVersion, game_db_stage_candidate_1.PINNED_STAGE_SOURCE_PROFILE.sourceDatabaseSha256, pinnedTables());
    });
    (0, mocha_1.it)("fails generation when a frozen cardinality or SHA differs", () => {
        const changed = pinnedTables();
        changed.equipment_skills.pop();
        (0, assert_1.throws)(() => (0, game_db_stage_candidate_1.validatePinnedStageSourceProfile)(game_db_stage_candidate_1.PINNED_STAGE_SOURCE_PROFILE.sourceSnapshotVersion, game_db_stage_candidate_1.PINNED_STAGE_SOURCE_PROFILE.sourceDatabaseSha256, changed), /equipmentSkillCount/);
        (0, assert_1.throws)(() => (0, game_db_stage_candidate_1.validatePinnedStageSourceProfile)(game_db_stage_candidate_1.PINNED_STAGE_SOURCE_PROFILE.sourceSnapshotVersion, "0".repeat(64), pinnedTables()), /sourceDatabaseSha256/);
    });
    (0, mocha_1.it)("allows a formally changed snapshot to define its own profile", () => {
        (0, game_db_stage_candidate_1.validatePinnedStageSourceProfile)("1788329251", "0".repeat(64), {});
        (0, assert_1.equal)(true, true);
    });
    (0, mocha_1.it)("validates the complete wallpaper contract at the Stage input boundary", () => {
        const manifest = wallpaperManifest();
        (0, assert_1.equal)((0, game_db_stage_candidate_1.validateStageWallpaperManifest)(manifest, game_db_stage_candidate_1.PINNED_STAGE_SOURCE_PROFILE.sourceSnapshotVersion, game_db_stage_candidate_1.PINNED_STAGE_SOURCE_PROFILE.sourceDatabaseSha256), manifest);
        (0, game_db_stage_candidate_1.validateStageWallpaperCatalogCoverage)(manifest, [{ id: "76", name: "Companions on Planet Vampa", description: "Official description" }]);
        const duplicate = structuredClone(manifest);
        duplicate.presentations.push(structuredClone(duplicate.presentations[0]));
        (0, assert_1.throws)(() => (0, game_db_stage_candidate_1.validateStageWallpaperManifest)(duplicate, game_db_stage_candidate_1.PINNED_STAGE_SOURCE_PROFILE.sourceSnapshotVersion, game_db_stage_candidate_1.PINNED_STAGE_SOURCE_PROFILE.sourceDatabaseSha256), /Duplicate wallpaper presentation/);
        const malformed = structuredClone(manifest);
        malformed.schemaVersion = 2;
        (0, assert_1.throws)(() => (0, game_db_stage_candidate_1.validateStageWallpaperManifest)(malformed, game_db_stage_candidate_1.PINNED_STAGE_SOURCE_PROFILE.sourceSnapshotVersion, game_db_stage_candidate_1.PINNED_STAGE_SOURCE_PROFILE.sourceDatabaseSha256), /Unsupported wallpaper asset manifest contract/);
        const unapprovedTool = structuredClone(manifest);
        unapprovedTool.source.extractorSha256 = "0".repeat(64);
        (0, assert_1.throws)(() => (0, game_db_stage_candidate_1.validateStageWallpaperManifest)(unapprovedTool, game_db_stage_candidate_1.PINNED_STAGE_SOURCE_PROFILE.sourceSnapshotVersion, game_db_stage_candidate_1.PINNED_STAGE_SOURCE_PROFILE.sourceDatabaseSha256), /not generated by the pinned CriFsV2Lib toolchain/);
        const mismatched = structuredClone(manifest);
        mismatched.source.databaseSha256 = "0".repeat(64);
        (0, assert_1.throws)(() => (0, game_db_stage_candidate_1.validateStageWallpaperManifest)(mismatched, game_db_stage_candidate_1.PINNED_STAGE_SOURCE_PROFILE.sourceSnapshotVersion, game_db_stage_candidate_1.PINNED_STAGE_SOURCE_PROFILE.sourceDatabaseSha256), /does not match the Stage source snapshot/);
        (0, assert_1.throws)(() => (0, game_db_stage_candidate_1.validateStageWallpaperCatalogCoverage)(manifest, []), /cardinality mismatch/);
        (0, assert_1.throws)(() => (0, game_db_stage_candidate_1.validateStageWallpaperCatalogCoverage)(manifest, [{ id: "76", name: "Changed", description: "Official description" }]), /does not exactly match/);
        (0, assert_1.throws)(() => (0, game_db_stage_candidate_1.validateStageWallpaperCatalogCoverage)(manifest, [
            { id: "76", name: "Companions on Planet Vampa", description: "Official description" },
            { id: "76", name: "Companions on Planet Vampa", description: "Official description" },
        ]), /Duplicate wallpaper_items row/);
    });
});
//# sourceMappingURL=game-db-stage-candidate.spec.js.map