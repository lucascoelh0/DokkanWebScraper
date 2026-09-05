"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseSkillOrbCandidateArgs = exports.buildSkillOrbCandidate = exports.buildSkillOrbAssetInventory = exports.PINNED_SKILL_ORB_ASSET_INVENTORY = exports.REQUIRED_SKILL_ORB_TABLES = void 0;
const crypto_1 = require("crypto");
const promises_1 = require("fs/promises");
const path_1 = require("path");
const zlib_1 = require("zlib");
const format_json_1 = require("../format-json");
const game_db_equipment_ui_assets_1 = require("./game-db-equipment-ui-assets");
const game_db_source_1 = require("./game-db-source");
const game_db_skill_orb_catalog_1 = require("./game-db-skill-orb-catalog");
exports.REQUIRED_SKILL_ORB_TABLES = [
    "cards", "card_card_categories", "card_categories", "card_unique_infos", "card_unique_info_set_relations",
    "equipment_skill_items", "equipment_skill_limitations", "equipment_skills",
];
const PINNED_OFFICIAL_ASSET_ARCHIVES = [
    { path: "item-equipment.cpk", sizeBytes: 2153592, sha256: "a801c1352e3de1c15f65db44f0ed4e020dad486c220666cd53f7b1c87b653c14" },
    { path: "layout-item.cpk", sizeBytes: 2083936, sha256: "d93b462664f77242088618ec47b1f323164e695e405e748e8046b4c32fe53175" },
    { path: "layout-character.cpk", sizeBytes: 3593648, sha256: "8cd3d18c12ad805f1b192f80b7bb8a7d4a4e66dbdc4df33367810726346d457e" },
    { path: "layout-charamenu.cpk", sizeBytes: 4504104, sha256: "c1037dab8d05d97f179fbd8005715f65c79e976862550ef65c96d3c12e8e0ed3" },
];
exports.PINNED_SKILL_ORB_ASSET_INVENTORY = {
    assetCount: 196,
    totalBytes: 2153473,
    inventorySha256: "138f90f5203d19cff95eab005ff5d0863e838477234f250a0f6bf4d90d365cbf",
};
function sha256(bytes) {
    return (0, crypto_1.createHash)("sha256").update(bytes).digest("hex");
}
function contained(root, relativePath) {
    const normalized = relativePath.replace(/\\/g, "/");
    if (!normalized || normalized.startsWith("/") || normalized.split("/").some(value => !value || value === "." || value === ".."))
        throw new Error(`Unsafe Skill Orb asset path ${relativePath}`);
    const target = (0, path_1.resolve)(root, ...normalized.split("/"));
    if (!target.toLowerCase().startsWith(`${(0, path_1.resolve)(root)}${path_1.sep}`.toLowerCase()))
        throw new Error(`Skill Orb asset escapes root: ${relativePath}`);
    return target;
}
async function requireMissing(path) {
    try {
        await (0, promises_1.stat)(path);
        throw new Error(`Skill Orb candidate output already exists: ${path}`);
    }
    catch (error) {
        if (error.code !== "ENOENT")
            throw error;
    }
}
async function loadTables(sourceDataDir) {
    const config = { sourceRoot: sourceDataDir, dataDir: sourceDataDir };
    return Object.fromEntries(await Promise.all(exports.REQUIRED_SKILL_ORB_TABLES.map(async (table) => [table, await (0, game_db_source_1.readGameDbTable)(config, table)])));
}
async function validatePinnedCpkRoot(root) {
    for (const expected of PINNED_OFFICIAL_ASSET_ARCHIVES) {
        const bytes = await (0, promises_1.readFile)(contained(root, expected.path));
        if (bytes.byteLength !== expected.sizeBytes || sha256(bytes) !== expected.sha256)
            throw new Error(`Official Skill Orb CPK drifted: ${expected.path}`);
    }
}
async function validateEquipmentUiSource(sourceDir, manifest) {
    if (manifest.schemaVersion !== 2 || manifest.packageName !== "com.bandainamcogames.dbzdokkanww"
        || manifest.versionName !== "6.5.5" || manifest.databaseSnapshotVersion !== game_db_skill_orb_catalog_1.PINNED_SKILL_ORB_PROFILE.snapshotVersion
        || manifest.assetVersion !== "1788327754"
        || manifest.cpkReader.repository !== "https://github.com/Sewer56/CriFsV2Lib"
        || manifest.cpkReader.commit !== "169b001c748dfffc28c9fc14fcec269dd45e6eec") {
        throw new Error("Invalid official equipment UI source manifest identity");
    }
    for (const archive of manifest.archives) {
        const bytes = await (0, promises_1.readFile)(contained(sourceDir, archive.path));
        if (bytes.byteLength !== archive.sizeBytes || sha256(bytes) !== archive.sha256)
            throw new Error(`Official equipment UI archive drifted: ${archive.path}`);
    }
    const result = new Map();
    for (const file of manifest.files) {
        const bytes = await (0, promises_1.readFile)(contained(sourceDir, file.path));
        if (bytes.byteLength !== file.sizeBytes || sha256(bytes) !== file.sha256)
            throw new Error(`Official equipment UI file drifted: ${file.path}`);
        const archive = manifest.archives.find(value => value.role === file.archiveRole);
        if (!archive)
            throw new Error(`Official equipment UI file ${file.path} references missing archive ${file.archiveRole}`);
        result.set(file.path, { bytes, sourceFiles: [archive.path, file.entryPath] });
    }
    return result;
}
function officialExtractedSource(path) {
    const foreground = /^item\/equipment\/(equ_item_\d{5}\.png)$/.exec(path);
    if (foreground)
        return { relativePath: `item-equipment/${foreground[1]}`, sourceFiles: ["item-equipment.cpk", foreground[1]] };
    const background = /^layout\/en\/image\/item\/(equipment\/equipment_thumb_bg\/equ_base_(?:bronze|silver|gold)\.png)$/.exec(path);
    if (background)
        return { relativePath: `layout-item/${background[1]}`, sourceFiles: ["layout-item.cpk", background[1]] };
    const typeIcon = /^layout\/en\/image\/character\/(cha_type_icon_\d{2}\.png)$/.exec(path);
    if (typeIcon)
        return { relativePath: `layout-character/${typeIcon[1]}`, sourceFiles: ["layout-character.cpk", typeIcon[1]] };
    return undefined;
}
async function writeAsset(outputDir, path, bytes) {
    const target = contained(outputDir, `game-assets/${path}`);
    await (0, promises_1.mkdir)((0, path_1.dirname)(target), { recursive: true });
    await (0, promises_1.writeFile)(target, bytes, { flag: "wx" });
}
async function buildSkillOrbAssetInventory(options) {
    await validatePinnedCpkRoot(options.officialCpkRoot);
    const uiFiles = await validateEquipmentUiSource(options.equipmentUiSourceDir, options.equipmentUiSourceManifest);
    const paths = (0, game_db_skill_orb_catalog_1.requiredSkillOrbAssetPaths)(options.tables);
    const categories = new Map();
    for (const [category, values] of Object.entries(paths))
        for (const path of values) {
            if (categories.has(path))
                throw new Error(`Skill Orb asset belongs to multiple roles: ${path}`);
            categories.set(path, category);
        }
    const assets = [];
    const fontPath = "fonts/en/black.otf";
    const singleBasePath = "layout/en/image/common/label/com_label_lv_02.png";
    const dualBasePath = "layout/en/image/charamenu/potential/equ_Lv_two.png";
    const font = uiFiles.get(fontPath), singleBase = uiFiles.get(singleBasePath), dualBase = uiFiles.get(dualBasePath);
    if (!font || !singleBase || !dualBase)
        throw new Error("Official equipment UI source is missing level renderer inputs");
    for (const path of [...categories.keys()].sort((left, right) => left.localeCompare(right, "en", { numeric: true }))) {
        const levelMatch = /^derived\/equipment\/levels\/lv-(\d+)(?:-(\d+))?\.png$/.exec(path);
        let bytes;
        let provenance;
        let sourceFiles;
        if (levelMatch) {
            const levels = [Number(levelMatch[1]), ...(levelMatch[2] ? [Number(levelMatch[2])] : [])];
            bytes = await (0, game_db_equipment_ui_assets_1.renderEquipmentLevelAsset)(contained(options.equipmentUiSourceDir, fontPath), singleBase.bytes, dualBase.bytes, levels);
            provenance = "official-cpk-derived";
            sourceFiles = [fontPath, levels.length === 2 ? dualBasePath : singleBasePath];
        }
        else {
            const uiFile = uiFiles.get(path);
            if (uiFile) {
                bytes = uiFile.bytes;
                sourceFiles = uiFile.sourceFiles;
            }
            else {
                const extracted = officialExtractedSource(path);
                if (!extracted)
                    throw new Error(`No first-party Skill Orb asset source for ${path}`);
                bytes = await (0, promises_1.readFile)(contained(options.officialAssetsRoot, extracted.relativePath));
                sourceFiles = extracted.sourceFiles;
            }
            provenance = "official-cpk";
        }
        if (!bytes.byteLength)
            throw new Error(`Empty first-party Skill Orb asset ${path}`);
        await writeAsset(options.outputDir, path, bytes);
        assets.push({ path, sizeBytes: bytes.byteLength, sha256: sha256(bytes), provenance, sourceFiles });
    }
    const counts = {
        foregroundIcons: paths.foregroundIcons.length,
        gradeBackgrounds: paths.gradeBackgrounds.length,
        levelAssets: paths.levelAssets.length,
        infinityAssets: paths.infinityAssets.length,
        restrictionBadges: paths.restrictionBadges.length,
        total: assets.length,
    };
    const inventory = { assets, counts, totalBytes: assets.reduce((sum, asset) => sum + asset.sizeBytes, 0), inventorySha256: (0, game_db_skill_orb_catalog_1.computeAssetInventorySha256)(assets) };
    if (inventory.assets.length !== exports.PINNED_SKILL_ORB_ASSET_INVENTORY.assetCount
        || inventory.totalBytes !== exports.PINNED_SKILL_ORB_ASSET_INVENTORY.totalBytes
        || inventory.inventorySha256 !== exports.PINNED_SKILL_ORB_ASSET_INVENTORY.inventorySha256) {
        throw new Error(`Official Skill Orb asset inventory drifted: ${inventory.assets.length}/${inventory.totalBytes}/${inventory.inventorySha256}`);
    }
    return inventory;
}
exports.buildSkillOrbAssetInventory = buildSkillOrbAssetInventory;
async function buildSkillOrbCandidate(options) {
    if (options.snapshotVersion !== game_db_skill_orb_catalog_1.PINNED_SKILL_ORB_PROFILE.snapshotVersion || options.sourceDatabaseSha256.toLowerCase() !== game_db_skill_orb_catalog_1.PINNED_SKILL_ORB_PROFILE.sourceDatabaseSha256)
        throw new Error("Skill Orb candidate source identity is not pinned");
    await requireMissing(options.outputDir);
    await (0, promises_1.mkdir)((0, path_1.dirname)(options.outputDir), { recursive: true });
    await (0, promises_1.mkdir)(options.outputDir, { recursive: false });
    const tables = await loadTables(options.sourceDataDir);
    const equipmentUiSourceManifest = JSON.parse(await (0, promises_1.readFile)(options.equipmentUiSourceManifestPath, "utf8"));
    const assetInventory = await buildSkillOrbAssetInventory({ ...options, tables, equipmentUiSourceManifest });
    const catalog = (0, game_db_skill_orb_catalog_1.buildSkillOrbCatalog)({ snapshotVersion: options.snapshotVersion, sourceDatabaseSha256: options.sourceDatabaseSha256, tables, assetInventory });
    const rawBytes = Buffer.from(JSON.stringify(catalog), "utf8");
    const gzipBytes = (0, zlib_1.gzipSync)(rawBytes, { level: 9 });
    const payloadSha256 = sha256(gzipBytes);
    const objectKey = `equipment-skill-orbs/objects/${payloadSha256}.json.gz`;
    const objectPath = contained(options.outputDir, objectKey);
    await (0, promises_1.mkdir)((0, path_1.dirname)(objectPath), { recursive: true });
    await (0, promises_1.writeFile)(objectPath, gzipBytes, { flag: "wx" });
    await (0, promises_1.writeFile)((0, path_1.resolve)(options.outputDir, "equipment-skill-orbs.json"), rawBytes, { flag: "wx" });
    await (0, format_json_1.writeFormattedJson)((0, path_1.resolve)(options.outputDir, "equipment-skill-orb-assets-manifest.json"), {
        schemaVersion: 1,
        provenance: catalog.provenance,
        cpkReader: equipmentUiSourceManifest.cpkReader,
        archives: PINNED_OFFICIAL_ASSET_ARCHIVES,
        equipmentUiArchives: equipmentUiSourceManifest.archives,
        inventory: assetInventory,
    });
    const manifest = {
        schemaVersion: 1,
        datasetVersion: `${options.snapshotVersion}-${game_db_skill_orb_catalog_1.SKILL_ORB_CONTRACT_VERSION}-${payloadSha256.slice(0, 16)}`,
        parserVersion: game_db_skill_orb_catalog_1.SKILL_ORB_CONTRACT_VERSION,
        snapshotVersion: options.snapshotVersion,
        sourceDatabaseSha256: options.sourceDatabaseSha256.toLowerCase(),
        ...(options.assetBaseUrl ? { assetBaseUrl: options.assetBaseUrl.replace(/\/+$/, "") } : {}),
        payload: {
            objectKey, sizeBytes: gzipBytes.byteLength, sha256: payloadSha256,
            contentType: "application/json", contentEncoding: "gzip",
            uncompressedSizeBytes: rawBytes.byteLength, uncompressedSha256: sha256(rawBytes),
        },
        assets: { count: assetInventory.assets.length, sizeBytes: assetInventory.totalBytes, inventorySha256: assetInventory.inventorySha256 },
        counts: {
            items: catalog.items.length,
            effects: catalog.items.reduce((sum, item) => sum + item.effects.length, 0),
            singleEffectItems: catalog.items.filter(item => item.effects.length === 1).length,
            dualEffectItems: catalog.items.filter(item => item.effects.length === 2).length,
            eternalItems: catalog.items.filter(item => item.isEternal).length,
            grades: {
                bronze: catalog.items.filter(item => item.grade === "bronze").length,
                silver: catalog.items.filter(item => item.grade === "silver").length,
                gold: catalog.items.filter(item => item.grade === "gold").length,
            },
            limitationSets: catalog.limitationSets.length,
            limitationRows: catalog.limitationSets.reduce((sum, set) => sum + set.conditions.length, 0),
            itemsByLimitationKind: Object.fromEntries(["element", "category", "card", "card-unique-info-set"].map(kind => [kind, catalog.items.filter(item => catalog.limitationSets.find(set => set.id === item.limitationSetId).conditions[0].kind === kind).length])),
            limitationRowsByKind: Object.fromEntries(["element", "category", "card", "card-unique-info-set"].map(kind => [kind, catalog.limitationSets.flatMap(set => set.conditions).filter(condition => condition.kind === kind).length])),
            exactCardReferences: catalog.limitationSets.flatMap(set => set.conditions).filter(condition => condition.kind === "card").flatMap(condition => condition.cardIds ?? []).length,
            exactUniqueCards: Object.keys(catalog.indexes.exactCardId).length,
            cardUniqueInfoSetLimitationRows: catalog.limitationSets.flatMap(set => set.conditions).filter(condition => condition.kind === "card-unique-info-set").length,
            exactCardIndexKeys: Object.keys(catalog.indexes.exactCardId).length,
            familyEligibleCardIndexKeys: Object.keys(catalog.indexes.familyEligibleCardId).length,
            foregroundIcons: new Set(catalog.items.map(item => item.iconImageId)).size,
            levelCombinations: new Set(catalog.items.map(item => item.levelAssetPath)).size,
            assets: assetInventory.assets.length,
            assetBytes: assetInventory.totalBytes,
        },
    };
    await (0, format_json_1.writeFormattedJson)((0, path_1.resolve)(options.outputDir, "equipment-skill-orbs-manifest.json"), manifest);
    return { manifest, outputDir: options.outputDir };
}
exports.buildSkillOrbCandidate = buildSkillOrbCandidate;
function parseSkillOrbCandidateArgs(args) {
    const supported = new Set(["--source-data-dir", "--snapshot-version", "--source-database-sha256", "--official-assets-root", "--official-cpk-root", "--equipment-ui-source-dir", "--equipment-ui-source-manifest", "--output-dir", "--asset-base-url"]);
    const values = new Map();
    for (let index = 0; index < args.length; index += 1) {
        const token = args[index];
        const separator = token.indexOf("=");
        const key = separator >= 0 ? token.slice(0, separator) : token;
        if (!supported.has(key))
            throw new Error(`Unexpected Skill Orb candidate argument: ${token}`);
        const value = separator >= 0 ? token.slice(separator + 1) : args[++index];
        if (!value || values.has(key))
            throw new Error(`Missing or duplicate Skill Orb candidate argument: ${key}`);
        values.set(key, value);
    }
    for (const key of [...supported].filter(key => key !== "--asset-base-url"))
        if (!values.has(key))
            throw new Error(`Missing Skill Orb candidate argument: ${key}`);
    const assetBaseUrl = values.get("--asset-base-url");
    if (assetBaseUrl && !/^https:\/\/[^\s]+$/.test(assetBaseUrl))
        throw new Error("Skill Orb asset base URL must be HTTPS");
    return {
        sourceDataDir: (0, path_1.resolve)(values.get("--source-data-dir")),
        snapshotVersion: values.get("--snapshot-version"),
        sourceDatabaseSha256: values.get("--source-database-sha256"),
        officialAssetsRoot: (0, path_1.resolve)(values.get("--official-assets-root")),
        officialCpkRoot: (0, path_1.resolve)(values.get("--official-cpk-root")),
        equipmentUiSourceDir: (0, path_1.resolve)(values.get("--equipment-ui-source-dir")),
        equipmentUiSourceManifestPath: (0, path_1.resolve)(values.get("--equipment-ui-source-manifest")),
        outputDir: (0, path_1.resolve)(values.get("--output-dir")),
        ...(assetBaseUrl ? { assetBaseUrl } : {}),
    };
}
exports.parseSkillOrbCandidateArgs = parseSkillOrbCandidateArgs;
async function main() {
    const result = await buildSkillOrbCandidate(parseSkillOrbCandidateArgs(process.argv.slice(2)));
    console.log(JSON.stringify(result, null, 2));
}
if (require.main === module)
    main().catch(error => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; });
//# sourceMappingURL=game-db-skill-orb-candidate.js.map