import { createHash } from "crypto";
import { equal, throws } from "assert";
import { describe, it } from "mocha";
import { StageFirstPartyTables } from "./game-db-stage";
import { PINNED_STAGE_SOURCE_PROFILE, validatePinnedStageSourceProfile, validateStageWallpaperCatalogCoverage, validateStageWallpaperManifest } from "./game-db-stage-candidate";
import { WALLPAPER_CPK_DEFINITIONS_BINARY_SHA256, WALLPAPER_CPK_EXTRACTOR_SHA256, WALLPAPER_CPK_READER_BINARY_SHA256 } from "./game-db-wallpaper-assets";

describe("Stage candidate pinned source profile", () => {
    const sha = (value: unknown): string => createHash("sha256").update(typeof value === "string" ? value : JSON.stringify(value)).digest("hex");

    function wallpaperManifest(): any {
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
                databaseSnapshotVersion: PINNED_STAGE_SOURCE_PROFILE.sourceSnapshotVersion,
                databaseSha256: PINNED_STAGE_SOURCE_PROFILE.sourceDatabaseSha256,
                acquiredAt: "2026-09-04T12:00:00.000Z",
                cpkReader: { repository: "https://github.com/Sewer56/CriFsV2Lib", commit: "169b001c748dfffc28c9fc14fcec269dd45e6eec" },
                bundleRoot: "fixture",
                archiveCount: archives.length,
                archiveBytes: 100,
                archiveInventorySha256: sha(archives),
                archives,
                extractorSha256: WALLPAPER_CPK_EXTRACTOR_SHA256,
                readerBinarySha256: WALLPAPER_CPK_READER_BINARY_SHA256,
                definitionsBinarySha256: WALLPAPER_CPK_DEFINITIONS_BINARY_SHA256,
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

    function pinnedTables(): StageFirstPartyTables {
        return {
            sugoroku_maps: Array.from({ length: PINNED_STAGE_SOURCE_PROFILE.questLevelCount }, (_, index) => ({ id: String(index + 1), quest_id: "1" })),
            z_battle_stages: Array.from({ length: PINNED_STAGE_SOURCE_PROFILE.zBattleCount }, (_, index) => ({ id: String(index + 1) })),
            equipment_skill_items: Array.from({ length: PINNED_STAGE_SOURCE_PROFILE.equipmentItemCount }, (_, index) => ({ id: String(index === 0 ? PINNED_STAGE_SOURCE_PROFILE.equipmentItemMaxId : index + 1) })),
            equipment_skills: Array.from({ length: PINNED_STAGE_SOURCE_PROFILE.equipmentSkillCount }, (_, index) => ({ id: String(index + 1) })),
            equipment_skill_limitations: Array.from({ length: PINNED_STAGE_SOURCE_PROFILE.equipmentLimitationCount }, (_, index) => ({ id: String(index + 1) })),
            link_skill_lv_up_items: Array.from({ length: PINNED_STAGE_SOURCE_PROFILE.linkSkillLvUpItemCount }, (_, index) => ({ id: String(index + 1) })),
            wallpaper_items: Array.from({ length: PINNED_STAGE_SOURCE_PROFILE.wallpaperItemCount }, (_, index) => ({ id: String(index) })),
        } as unknown as StageFirstPartyTables;
    }

    it("accepts the exact frozen database identity and cardinalities", () => {
        validatePinnedStageSourceProfile(PINNED_STAGE_SOURCE_PROFILE.sourceSnapshotVersion, PINNED_STAGE_SOURCE_PROFILE.sourceDatabaseSha256, pinnedTables());
    });

    it("fails generation when a frozen cardinality or SHA differs", () => {
        const changed = pinnedTables();
        changed.equipment_skills.pop();
        throws(() => validatePinnedStageSourceProfile(PINNED_STAGE_SOURCE_PROFILE.sourceSnapshotVersion, PINNED_STAGE_SOURCE_PROFILE.sourceDatabaseSha256, changed), /equipmentSkillCount/);
        throws(() => validatePinnedStageSourceProfile(PINNED_STAGE_SOURCE_PROFILE.sourceSnapshotVersion, "0".repeat(64), pinnedTables()), /sourceDatabaseSha256/);
    });

    it("allows a formally changed snapshot to define its own profile", () => {
        validatePinnedStageSourceProfile("1788329251", "0".repeat(64), {} as StageFirstPartyTables);
        equal(true, true);
    });

    it("validates the complete wallpaper contract at the Stage input boundary", () => {
        const manifest = wallpaperManifest();
        equal(validateStageWallpaperManifest(manifest, PINNED_STAGE_SOURCE_PROFILE.sourceSnapshotVersion, PINNED_STAGE_SOURCE_PROFILE.sourceDatabaseSha256), manifest);
        validateStageWallpaperCatalogCoverage(manifest, [{ id: "76", name: "Companions on Planet Vampa", description: "Official description" }]);

        const duplicate = structuredClone(manifest);
        duplicate.presentations.push(structuredClone(duplicate.presentations[0]));
        throws(() => validateStageWallpaperManifest(duplicate, PINNED_STAGE_SOURCE_PROFILE.sourceSnapshotVersion, PINNED_STAGE_SOURCE_PROFILE.sourceDatabaseSha256), /Duplicate wallpaper presentation/);

        const malformed = structuredClone(manifest);
        malformed.schemaVersion = 2;
        throws(() => validateStageWallpaperManifest(malformed, PINNED_STAGE_SOURCE_PROFILE.sourceSnapshotVersion, PINNED_STAGE_SOURCE_PROFILE.sourceDatabaseSha256), /Unsupported wallpaper asset manifest contract/);

        const unapprovedTool = structuredClone(manifest);
        unapprovedTool.source.extractorSha256 = "0".repeat(64);
        throws(() => validateStageWallpaperManifest(unapprovedTool, PINNED_STAGE_SOURCE_PROFILE.sourceSnapshotVersion, PINNED_STAGE_SOURCE_PROFILE.sourceDatabaseSha256), /not generated by the pinned CriFsV2Lib toolchain/);

        const mismatched = structuredClone(manifest);
        mismatched.source.databaseSha256 = "0".repeat(64);
        throws(() => validateStageWallpaperManifest(mismatched, PINNED_STAGE_SOURCE_PROFILE.sourceSnapshotVersion, PINNED_STAGE_SOURCE_PROFILE.sourceDatabaseSha256), /does not match the Stage source snapshot/);

        throws(() => validateStageWallpaperCatalogCoverage(manifest, []), /cardinality mismatch/);
        throws(() => validateStageWallpaperCatalogCoverage(manifest, [{ id: "76", name: "Changed", description: "Official description" }]), /does not exactly match/);
        throws(() => validateStageWallpaperCatalogCoverage(manifest, [
            { id: "76", name: "Companions on Planet Vampa", description: "Official description" },
            { id: "76", name: "Companions on Planet Vampa", description: "Official description" },
        ]), /Duplicate wallpaper_items row/);
    });
});
