"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateStageWallpaperCatalogCoverage = exports.validateStageWallpaperManifest = exports.parseStageCandidateArgs = exports.REQUIRED_STAGE_TABLES = exports.validatePinnedStageSourceProfile = exports.PINNED_STAGE_SOURCE_PROFILE = void 0;
const crypto_1 = require("crypto");
const promises_1 = require("fs/promises");
const path_1 = require("path");
const zlib_1 = require("zlib");
const format_json_1 = require("../format-json");
const game_db_stage_1 = require("./game-db-stage");
const game_db_stage_delivery_1 = require("./game-db-stage-delivery");
const game_db_source_1 = require("./game-db-source");
const game_db_wallpaper_assets_1 = require("./game-db-wallpaper-assets");
exports.PINNED_STAGE_SOURCE_PROFILE = {
    sourceSnapshotVersion: "1788329250",
    sourceDatabaseSha256: "7a6ca01808aea355ef28f9c0190e2c072f43a7c08be41d363f5b052824922495",
    questLevelCount: 5394,
    zBattleCount: 235,
    equipmentItemCount: 8751,
    equipmentItemMaxId: 9069,
    equipmentSkillCount: 14021,
    equipmentLimitationCount: 310,
    linkSkillLvUpItemCount: 3,
    wallpaperItemCount: 88,
};
function validatePinnedStageSourceProfile(sourceSnapshotVersion, sourceDatabaseSha256, tables) {
    if (sourceSnapshotVersion !== exports.PINNED_STAGE_SOURCE_PROFILE.sourceSnapshotVersion)
        return;
    const observed = {
        sourceDatabaseSha256: sourceDatabaseSha256.toLowerCase(),
        questLevelCount: tables.sugoroku_maps.filter(row => String(row.quest_id ?? "").trim()).length,
        zBattleCount: tables.z_battle_stages.length,
        equipmentItemCount: tables.equipment_skill_items.length,
        equipmentItemMaxId: Math.max(...tables.equipment_skill_items.map(row => Number(row.id))),
        equipmentSkillCount: tables.equipment_skills.length,
        equipmentLimitationCount: tables.equipment_skill_limitations.length,
        linkSkillLvUpItemCount: tables.link_skill_lv_up_items.length,
        wallpaperItemCount: tables.wallpaper_items?.length ?? 0,
    };
    for (const [key, expected] of Object.entries(exports.PINNED_STAGE_SOURCE_PROFILE)) {
        if (key === "sourceSnapshotVersion")
            continue;
        if (observed[key] !== expected) {
            throw new Error(`Pinned Stage source profile mismatch for ${key}: expected ${expected}, observed ${observed[key]}`);
        }
    }
}
exports.validatePinnedStageSourceProfile = validatePinnedStageSourceProfile;
exports.REQUIRED_STAGE_TABLES = [
    "areas",
    "card_awakening_routes",
    "cards",
    "card_unique_infos",
    "card_unique_info_set_relations",
    "card_specials",
    "card_categories",
    "chapters",
    "db_stories",
    "enemy_round_skill_set_relations",
    "enemy_round_skill_sets",
    "enemy_round_skills",
    "enemy_skill_cutin_extensions",
    "enemy_skills",
    "equipment_skill_items",
    "equipment_skill_limitations",
    "equipment_skills",
    "link_skill_lv_up_items",
    "wallpaper_items",
    "link_skills",
    "mission_rewards",
    "missions",
    "passive_skill_sets",
    "quest_category_bonus_groups",
    "quest_category_bonus_rarity_tables",
    "quest_category_bonuses",
    "quest_drop_item_views",
    "quests",
    "related_card_categories",
    "related_link_skills",
    "related_optimal_awakenings",
    "related_passive_skill_sets",
    "sugoroku_map_boss_drop_items",
    "sugoroku_map_enemy_informations",
    "sugoroku_map_puzzle_colors",
    "sugoroku_maps",
    "treasure_items",
    "special_sets",
    "special_views",
    "special_categories",
    "z_battle_check_points",
    "z_battle_enemies",
    "z_battle_enemy_card_escalations",
    "z_battle_enemy_skill_escalations",
    "z_battle_enemy_status_escalations",
    "z_battle_first_reward_level_ranges",
    "z_battle_first_rewards",
    "z_battle_normal_reward_tables",
    "z_battle_normal_rewards",
    "z_battle_powerup_thresholds",
    "z_battle_stage_views",
    "z_battle_stages",
];
function parseStageCandidateArgs(args) {
    const supported = new Set([
        "--source-data-dir",
        "--source-snapshot-version",
        "--source-database-sha256",
        "--output-dir",
        "--generated-at",
        "--previous-dataset",
        "--asset-base-url",
        "--wallpaper-assets-manifest",
    ]);
    const values = new Map();
    for (let index = 0; index < args.length; index += 1) {
        const token = args[index];
        const separator = token.indexOf("=");
        const key = separator >= 0 ? token.slice(0, separator) : token;
        if (!supported.has(key))
            throw new Error(`Unexpected Stage candidate argument: ${token}`);
        const value = separator >= 0 ? token.slice(separator + 1) : args[++index];
        if (!value || values.has(key))
            throw new Error(`Missing or duplicate Stage candidate argument: ${key}`);
        values.set(key, value);
    }
    for (const key of ["--source-data-dir", "--source-snapshot-version", "--source-database-sha256", "--output-dir"]) {
        if (!values.has(key))
            throw new Error(`Missing Stage candidate argument: ${key}`);
    }
    const generatedAt = values.get("--generated-at") ?? new Date().toISOString();
    if (Number.isNaN(Date.parse(generatedAt)))
        throw new Error("Invalid Stage --generated-at");
    return {
        sourceDataDir: (0, path_1.resolve)(values.get("--source-data-dir")),
        sourceSnapshotVersion: values.get("--source-snapshot-version"),
        sourceDatabaseSha256: values.get("--source-database-sha256"),
        outputDir: (0, path_1.resolve)(values.get("--output-dir")),
        generatedAt,
        ...(values.get("--previous-dataset") ? { previousDatasetPath: (0, path_1.resolve)(values.get("--previous-dataset")) } : {}),
        ...(values.get("--asset-base-url") ? { assetBaseUrl: values.get("--asset-base-url") } : {}),
        ...(values.get("--wallpaper-assets-manifest") ? { wallpaperAssetsManifestPath: (0, path_1.resolve)(values.get("--wallpaper-assets-manifest")) } : {}),
    };
}
exports.parseStageCandidateArgs = parseStageCandidateArgs;
async function loadTables(sourceDataDir) {
    const config = { sourceRoot: sourceDataDir, dataDir: sourceDataDir };
    const entries = await Promise.all(exports.REQUIRED_STAGE_TABLES.map(async (table) => [table, await (0, game_db_source_1.readGameDbTable)(config, table)]));
    return Object.fromEntries(entries);
}
async function requireMissing(path) {
    try {
        await (0, promises_1.stat)(path);
        throw new Error(`Stage candidate output must not already exist: ${path}`);
    }
    catch (error) {
        if (error.code !== "ENOENT")
            throw error;
    }
}
function validateStageWallpaperManifest(value, sourceSnapshotVersion, sourceDatabaseSha256) {
    const manifest = (0, game_db_wallpaper_assets_1.validateWallpaperAssetManifest)(value);
    (0, game_db_wallpaper_assets_1.validatePinnedWallpaperToolchain)(manifest);
    if (manifest.source.databaseSnapshotVersion !== sourceSnapshotVersion
        || manifest.source.databaseSha256 !== sourceDatabaseSha256) {
        throw new Error("Wallpaper asset manifest does not match the Stage source snapshot");
    }
    return manifest;
}
exports.validateStageWallpaperManifest = validateStageWallpaperManifest;
function validateStageWallpaperCatalogCoverage(manifest, wallpaperItems) {
    const catalog = new Map();
    for (const row of wallpaperItems) {
        const itemId = (0, game_db_source_1.normalizeDbId)(row.id);
        const name = row.name?.trim();
        const description = row.description?.trim();
        if (!itemId || !name || !description)
            throw new Error("wallpaper_items contains an invalid ID or official text");
        if (catalog.has(itemId))
            throw new Error(`Duplicate wallpaper_items row ${itemId}`);
        catalog.set(itemId, { name, description });
    }
    if (catalog.size !== manifest.presentations.length) {
        throw new Error(`Wallpaper manifest/catalog cardinality mismatch: ${manifest.presentations.length}/${catalog.size}`);
    }
    for (const presentation of manifest.presentations) {
        const item = catalog.get(presentation.itemId);
        if (!item || item.name !== presentation.name || item.description !== presentation.description) {
            throw new Error(`Wallpaper manifest does not exactly match wallpaper_items row ${presentation.itemId}`);
        }
    }
}
exports.validateStageWallpaperCatalogCoverage = validateStageWallpaperCatalogCoverage;
async function main() {
    const options = parseStageCandidateArgs(process.argv.slice(2));
    await requireMissing(options.outputDir);
    const tables = await loadTables(options.sourceDataDir);
    validatePinnedStageSourceProfile(options.sourceSnapshotVersion, options.sourceDatabaseSha256, tables);
    const wallpaperManifest = options.wallpaperAssetsManifestPath
        ? validateStageWallpaperManifest(JSON.parse(await (0, promises_1.readFile)(options.wallpaperAssetsManifestPath, "utf8")), options.sourceSnapshotVersion, options.sourceDatabaseSha256)
        : undefined;
    if (wallpaperManifest)
        validateStageWallpaperCatalogCoverage(wallpaperManifest, tables.wallpaper_items ?? []);
    const candidate = (0, game_db_stage_1.buildStageFirstPartyCandidate)({
        generatedAt: options.generatedAt,
        sourceSnapshotVersion: options.sourceSnapshotVersion,
        sourceDatabaseSha256: options.sourceDatabaseSha256,
        tables,
        wallpaperPresentations: new Map(wallpaperManifest?.presentations.map(item => [item.itemId, item]) ?? []),
    });
    const previous = options.previousDatasetPath
        ? JSON.parse(await (0, promises_1.readFile)(options.previousDatasetPath, "utf8"))
        : undefined;
    const previousIds = new Set(previous?.entries.map(entry => entry.id) ?? []);
    const candidateIds = new Set(candidate.dataset.entries.map(entry => entry.id));
    const comparison = {
        previousCount: previous?.count ?? 0,
        candidateCount: candidate.dataset.count,
        addedIds: [...candidateIds].filter(stageId => !previousIds.has(stageId)).sort((left, right) => Number(left) - Number(right)),
        removedIds: [...previousIds].filter(stageId => !candidateIds.has(stageId)).sort((left, right) => Number(left) - Number(right)),
    };
    await (0, promises_1.mkdir)((0, path_1.dirname)(options.outputDir), { recursive: true });
    await (0, promises_1.mkdir)(options.outputDir);
    const datasetPath = (0, path_1.resolve)(options.outputDir, "stage-details.json");
    const auditPath = (0, path_1.resolve)(options.outputDir, "stage-first-party-audit.json");
    const transportPath = (0, path_1.resolve)(options.outputDir, "stage-details.json.gz");
    const deliveryManifestPath = (0, path_1.resolve)(options.outputDir, "stage-details-manifest.json");
    const deliveryAuditPath = (0, path_1.resolve)(options.outputDir, "stage-delivery-audit.json");
    await (0, format_json_1.writeFormattedJson)(datasetPath, candidate.dataset);
    await (0, format_json_1.writeFormattedJson)(auditPath, { ...candidate.audit, comparison });
    const compactDatasetBytes = Buffer.from(JSON.stringify(candidate.dataset), "utf8");
    await (0, promises_1.writeFile)(transportPath, (0, zlib_1.gzipSync)(compactDatasetBytes, { level: 9 }), { flag: "wx" });
    const delivery = (0, game_db_stage_delivery_1.buildStageDelivery)(candidate.dataset, undefined, undefined, options.assetBaseUrl);
    await (0, format_json_1.writeFormattedJson)(deliveryManifestPath, delivery.manifest);
    await (0, format_json_1.writeFormattedJson)(deliveryAuditPath, delivery.audit);
    const deliveryObjectRoot = (0, path_1.resolve)(options.outputDir, "stage-details", "objects");
    await (0, promises_1.mkdir)(deliveryObjectRoot, { recursive: true });
    const deliveryObjects = [
        { object: delivery.manifest.catalog, bytes: delivery.catalogGzip },
        ...delivery.shards.map(shard => ({ object: shard.manifest, bytes: shard.gzip })),
    ];
    for (const item of deliveryObjects) {
        const objectPath = (0, path_1.resolve)(options.outputDir, item.object.objectKey);
        await (0, promises_1.mkdir)((0, path_1.dirname)(objectPath), { recursive: true });
        await (0, promises_1.writeFile)(objectPath, item.bytes, { flag: "wx" });
    }
    const datasetBytes = await (0, promises_1.readFile)(datasetPath);
    const auditBytes = await (0, promises_1.readFile)(auditPath);
    const transportBytes = await (0, promises_1.readFile)(transportPath);
    const deliveryManifestBytes = await (0, promises_1.readFile)(deliveryManifestPath);
    const deliveryAuditBytes = await (0, promises_1.readFile)(deliveryAuditPath);
    const deliveryFileEntries = deliveryObjects.map(item => ({
        name: item.object.objectKey,
        sizeBytes: item.bytes.byteLength,
        sha256: (0, crypto_1.createHash)("sha256").update(item.bytes).digest("hex"),
    }));
    await (0, promises_1.writeFile)((0, path_1.resolve)(options.outputDir, "candidate-manifest.json"), `${JSON.stringify({
        schemaVersion: 2,
        generatedAt: options.generatedAt,
        sourceSnapshotVersion: options.sourceSnapshotVersion,
        sourceDatabaseSha256: options.sourceDatabaseSha256,
        stageCount: candidate.dataset.count,
        zBattleCount: candidate.dataset.zBattles?.length ?? 0,
        transport: {
            fileName: "stage-details.json.gz",
            contentType: "application/json",
            contentEncoding: "gzip",
            uncompressedSizeBytes: compactDatasetBytes.byteLength,
        },
        delivery: {
            manifestFileName: "stage-details-manifest.json",
            catalogObjectKey: delivery.manifest.catalog.objectKey,
            shardCount: delivery.manifest.shards.length,
            totalCompressedBytes: delivery.audit.totalCompressedBytes,
            totalExpandedBytes: delivery.audit.totalExpandedBytes,
            shardMaxExpandedBytes: delivery.audit.shardMaxExpandedBytes,
        },
        files: [
            { name: "stage-details.json", sizeBytes: datasetBytes.byteLength, sha256: (0, crypto_1.createHash)("sha256").update(datasetBytes).digest("hex") },
            { name: "stage-details.json.gz", sizeBytes: transportBytes.byteLength, sha256: (0, crypto_1.createHash)("sha256").update(transportBytes).digest("hex") },
            { name: "stage-first-party-audit.json", sizeBytes: auditBytes.byteLength, sha256: (0, crypto_1.createHash)("sha256").update(auditBytes).digest("hex") },
            { name: "stage-details-manifest.json", sizeBytes: deliveryManifestBytes.byteLength, sha256: (0, crypto_1.createHash)("sha256").update(deliveryManifestBytes).digest("hex") },
            { name: "stage-delivery-audit.json", sizeBytes: deliveryAuditBytes.byteLength, sha256: (0, crypto_1.createHash)("sha256").update(deliveryAuditBytes).digest("hex") },
            ...deliveryFileEntries,
        ],
    }, null, 2)}\n`, { encoding: "utf8", flag: "w" });
    console.log(JSON.stringify({
        outputDir: options.outputDir,
        counts: candidate.audit.counts,
        comparison,
        delivery: delivery.audit,
    }, null, 2));
}
if (require.main === module) {
    main().catch(error => {
        console.error(error instanceof Error ? error.message : String(error));
        process.exitCode = 1;
    });
}
//# sourceMappingURL=game-db-stage-candidate.js.map