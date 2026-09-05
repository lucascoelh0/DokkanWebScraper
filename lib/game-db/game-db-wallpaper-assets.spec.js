"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = require("assert");
const crypto_1 = require("crypto");
const promises_1 = require("fs/promises");
const os_1 = require("os");
const path_1 = require("path");
const mocha_1 = require("mocha");
const game_db_wallpaper_assets_1 = require("./game-db-wallpaper-assets");
const png = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), Buffer.from("fixture")]);
const sourceIdentity = {
    packageName: "com.bandainamcogames.dbzdokkanww",
    versionName: "6.5.5",
    versionCode: "348",
    databaseSnapshotVersion: "1788329250",
    databaseSha256: "7a6ca01808aea355ef28f9c0190e2c072f43a7c08be41d363f5b052824922495",
    acquiredAt: "2026-09-04T12:00:00.000Z",
    cpkReader: { repository: "https://github.com/Sewer56/CriFsV2Lib", commit: "169b001c748dfffc28c9fc14fcec269dd45e6eec" },
};
const row = (values) => values;
async function fixture(root, id, mode = "canonical") {
    const padded = id.padStart(4, "0");
    await (0, promises_1.mkdir)((0, path_1.join)(root, "archives"), { recursive: true });
    const extracted = (0, path_1.join)(root, "extracted", padded);
    await (0, promises_1.mkdir)(extracted, { recursive: true });
    const textures = mode === "canonical"
        ? [`Images_${padded}.png`]
        : mode === "layered"
            ? ["Images_layer_01.png"]
            : [`Images_${padded}.png`, "Images_layer_01.png"];
    const archiveMembers = [`${padded}.lwf`, `icon_${padded}.png`, `thumb_${padded}.png`, ...textures];
    await (0, promises_1.writeFile)((0, path_1.join)(root, "archives", `${padded}.cpk`), Buffer.from(`CPK ${archiveMembers.join("\0")}`, "ascii"));
    await (0, promises_1.writeFile)((0, path_1.join)(extracted, `${padded}.lwf`), textures.join("\0"));
    await (0, promises_1.writeFile)((0, path_1.join)(extracted, `icon_${padded}.png`), png);
    await (0, promises_1.writeFile)((0, path_1.join)(extracted, `thumb_${padded}.png`), png);
    for (const texture of textures)
        await (0, promises_1.writeFile)((0, path_1.join)(extracted, texture), png);
}
async function fakeExtractor(root) {
    const path = (0, path_1.join)(root, "fake-cpk-extractor.js");
    await (0, promises_1.writeFile)(path, [
        'const { cpSync } = require("fs");',
        'const { basename, dirname, join } = require("path");',
        'const archive = process.argv[2];',
        'const output = process.argv[3];',
        'const id = basename(archive, ".cpk");',
        'cpSync(join(dirname(dirname(archive)), "extracted", id), output, { recursive: true, errorOnExist: true });',
    ].join("\n"));
    return { path, sha256: (0, crypto_1.createHash)("sha256").update(await (0, promises_1.readFile)(path)).digest("hex") };
}
(0, mocha_1.describe)("official wallpaper assets", function () {
    (0, mocha_1.it)("mirrors canonical official presentation and records multi-texture fallback", async () => {
        const root = await (0, promises_1.mkdtemp)((0, path_1.join)((0, os_1.tmpdir)(), "dokkan-wallpaper-"));
        try {
            const source = (0, path_1.join)(root, "source");
            await fixture(source, "76");
            await fixture(source, "87", "layered");
            await fixture(source, "58", "canonical-plus-layer");
            const extractor = await fakeExtractor(root);
            const output = (0, path_1.join)(root, "output");
            const manifest = await (0, game_db_wallpaper_assets_1.buildWallpaperGameAssets)({
                generatedAt: "2026-09-04T12:00:00.000Z",
                sourceIdentity,
                sourceBundleRoot: source,
                outputRoot: output,
                wallpaperItems: [
                    row({ id: "76", name: "Companions on Planet Vampa", description: "Official description" }),
                    row({ id: "87", name: "Composite", description: "Official composite" }),
                    row({ id: "58", name: "Ambiguous canonical", description: "Official layered composition" }),
                ],
                cpkExtractorPath: extractor.path,
                testOnlyExpectedExtractorSha256: extractor.sha256,
            });
            (0, assert_1.equal)(manifest.wallpaperCount, 3);
            (0, assert_1.equal)(manifest.assetCount, 7);
            (0, assert_1.equal)(manifest.fullImageCount, 1);
            (0, assert_1.equal)(manifest.fullImageGaps.length, 2);
            (0, assert_1.equal)(manifest.presentations.find(item => item.itemId === "58")?.fullImageAssetPath, undefined);
            (0, assert_1.equal)(manifest.presentations.find(item => item.itemId === "76")?.fullImageAssetPath, "item/wallpaper/0076/full_0076.png");
            (0, assert_1.equal)((await (0, promises_1.readFile)((0, path_1.join)(output, "game-assets", "item", "wallpaper", "0076", "full_0076.png"))).equals(png), true);
            (0, game_db_wallpaper_assets_1.validateWallpaperAssetManifest)(manifest);
            (0, assert_1.throws)(() => (0, game_db_wallpaper_assets_1.validatePinnedWallpaperToolchain)(manifest), /not generated by the pinned CriFsV2Lib toolchain/);
            const duplicate = structuredClone(manifest);
            duplicate.presentations.push(structuredClone(duplicate.presentations[0]));
            (0, assert_1.throws)(() => (0, game_db_wallpaper_assets_1.validateWallpaperAssetManifest)(duplicate), /Duplicate wallpaper presentation/);
            const invalidInventory = structuredClone(manifest);
            invalidInventory.inventorySha256 = "0".repeat(64);
            (0, assert_1.throws)(() => (0, game_db_wallpaper_assets_1.validateWallpaperAssetManifest)(invalidInventory), /cardinality or inventory mismatch/);
            const invalidPath = structuredClone(manifest);
            invalidPath.presentations[0].thumbnailAssetPath = "item/wallpaper/0058/thumb_9999.png";
            (0, assert_1.throws)(() => (0, game_db_wallpaper_assets_1.validateWallpaperAssetManifest)(invalidPath), /invalid advertised assets/);
        }
        finally {
            await (0, promises_1.rm)(root, { recursive: true, force: true });
        }
    });
    (0, mocha_1.it)("rejects archives that are not structurally CPK files", async () => {
        const root = await (0, promises_1.mkdtemp)((0, path_1.join)((0, os_1.tmpdir)(), "dokkan-wallpaper-invalid-cpk-"));
        try {
            const source = (0, path_1.join)(root, "source");
            await fixture(source, "76");
            const extractor = await fakeExtractor(root);
            await (0, promises_1.writeFile)((0, path_1.join)(source, "archives", "0076.cpk"), "arbitrary bytes with member names");
            await (0, assert_1.rejects)((0, game_db_wallpaper_assets_1.buildWallpaperGameAssets)({
                generatedAt: "2026-09-04T12:00:00.000Z",
                sourceIdentity,
                sourceBundleRoot: source,
                outputRoot: (0, path_1.join)(root, "output"),
                wallpaperItems: [row({ id: "76", name: "Name", description: "Description" })],
                cpkExtractorPath: extractor.path,
                testOnlyExpectedExtractorSha256: extractor.sha256,
            }), /Invalid official wallpaper CPK/);
        }
        finally {
            await (0, promises_1.rm)(root, { recursive: true, force: true });
        }
    });
    (0, mocha_1.it)("fails closed when the canonical full image advertised to consumers is missing", async () => {
        const root = await (0, promises_1.mkdtemp)((0, path_1.join)((0, os_1.tmpdir)(), "dokkan-wallpaper-missing-"));
        try {
            const source = (0, path_1.join)(root, "source");
            await fixture(source, "76");
            const extractor = await fakeExtractor(root);
            await (0, promises_1.rm)((0, path_1.join)(source, "extracted", "0076", "Images_0076.png"));
            await (0, assert_1.rejects)((0, game_db_wallpaper_assets_1.buildWallpaperGameAssets)({
                generatedAt: "2026-09-04T12:00:00.000Z",
                sourceIdentity,
                sourceBundleRoot: source,
                outputRoot: (0, path_1.join)(root, "output"),
                wallpaperItems: [row({ id: "76", name: "Name", description: "Description" })],
                cpkExtractorPath: extractor.path,
                testOnlyExpectedExtractorSha256: extractor.sha256,
            }), /Missing extracted wallpaper CPK member/);
        }
        finally {
            await (0, promises_1.rm)(root, { recursive: true, force: true });
        }
    });
    (0, mocha_1.it)("rejects an extractor outside the pinned production identity", async () => {
        const root = await (0, promises_1.mkdtemp)((0, path_1.join)((0, os_1.tmpdir)(), "dokkan-wallpaper-unapproved-extractor-"));
        try {
            const source = (0, path_1.join)(root, "source");
            await fixture(source, "76");
            const extractor = await fakeExtractor(root);
            await (0, assert_1.rejects)((0, game_db_wallpaper_assets_1.buildWallpaperGameAssets)({
                generatedAt: "2026-09-04T12:00:00.000Z",
                sourceIdentity,
                sourceBundleRoot: source,
                outputRoot: (0, path_1.join)(root, "output"),
                wallpaperItems: [row({ id: "76", name: "Name", description: "Description" })],
                cpkExtractorPath: extractor.path,
            }), /CPK extractor is not approved/);
        }
        finally {
            await (0, promises_1.rm)(root, { recursive: true, force: true });
        }
    });
});
//# sourceMappingURL=game-db-wallpaper-assets.spec.js.map