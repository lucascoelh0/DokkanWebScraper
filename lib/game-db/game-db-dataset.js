"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.writeGameDbDataset = exports.applyOptionalCardLimit = exports.parseOptionalCardLimit = exports.selectPrimaryGameDbCardIds = exports.isPrimaryPlayableCardRow = void 0;
const crypto_1 = require("crypto");
const promises_1 = require("fs/promises");
const path_1 = require("path");
const zlib_1 = require("zlib");
const game_db_app_projection_1 = require("./game-db-app-projection");
const game_db_experiment_1 = require("./game-db-experiment");
const game_db_source_settings_1 = require("./game-db-source-settings");
const format_json_1 = require("../format-json");
const game_db_source_1 = require("./game-db-source");
const PRIMARY_CARD_ID_MAX = 4000000;
const MINIMUM_HP_INIT = 300;
const DEFAULT_OUTPUT_DIR = (0, path_1.resolve)(__dirname, "data", "game-db-dataset", "latest");
function isReleasedAtOrBefore(openAt, now) {
    if (!openAt) {
        return true;
    }
    return new Date(openAt).getTime() <= now.getTime();
}
function isPrimaryPlayableCardRow(row, now = new Date()) {
    const cardId = (0, game_db_source_1.parseDbInt)(row.id);
    const rarity = (0, game_db_source_1.parseDbInt)(row.rarity);
    const hpInit = (0, game_db_source_1.parseDbInt)(row.hp_init) ?? 0;
    const cardUniqueInfoId = (0, game_db_source_1.normalizeDbId)(row.card_unique_info_id);
    const openAt = (0, game_db_source_1.parseDbDate)(row.open_at);
    return Boolean(cardId
        && cardId > 0
        && cardId < PRIMARY_CARD_ID_MAX
        && rarity !== undefined
        && rarity >= 0
        && rarity <= 5
        && hpInit > MINIMUM_HP_INIT
        && cardUniqueInfoId
        && isReleasedAtOrBefore(openAt, now));
}
exports.isPrimaryPlayableCardRow = isPrimaryPlayableCardRow;
function comparePreferredPrimaryCardRow(left, right) {
    return ((0, game_db_source_1.parseDbInt)(left.id) ?? 0) - ((0, game_db_source_1.parseDbInt)(right.id) ?? 0);
}
function selectPrimaryGameDbCardIds(rows, now = new Date()) {
    const selectedByUniqueInfoId = new Map();
    for (const row of rows) {
        if (!isPrimaryPlayableCardRow(row, now)) {
            continue;
        }
        const cardUniqueInfoId = (0, game_db_source_1.normalizeDbId)(row.card_unique_info_id);
        const cardId = (0, game_db_source_1.normalizeDbId)(row.id);
        if (!cardUniqueInfoId || !cardId) {
            continue;
        }
        const existing = selectedByUniqueInfoId.get(cardUniqueInfoId);
        if (!existing || comparePreferredPrimaryCardRow(existing, row) < 0) {
            selectedByUniqueInfoId.set(cardUniqueInfoId, row);
        }
    }
    return [...selectedByUniqueInfoId.values()]
        .map(row => (0, game_db_source_1.normalizeDbId)(row.id))
        .filter((value) => Boolean(value))
        .sort((left, right) => (parseInt(left, 10) - parseInt(right, 10)));
}
exports.selectPrimaryGameDbCardIds = selectPrimaryGameDbCardIds;
function parseOptionalCardLimit(value) {
    const parsed = parseInt((value ?? "").trim(), 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}
exports.parseOptionalCardLimit = parseOptionalCardLimit;
function applyOptionalCardLimit(cardIds, limit) {
    return limit ? cardIds.slice(0, limit) : cardIds;
}
exports.applyOptionalCardLimit = applyOptionalCardLimit;
function datasetVersionFromSourceSettings(generatedAt, sourceSettings, fallbackVersionParts) {
    if (sourceSettings?.glbDbVersion || sourceSettings?.glbAssetVersion) {
        return [
            sourceSettings.glbDbVersion ? `glb-db-${sourceSettings.glbDbVersion}` : "",
            sourceSettings.glbAssetVersion ? `asset-${sourceSettings.glbAssetVersion}` : "",
        ].filter(Boolean).join("__");
    }
    if (fallbackVersionParts && fallbackVersionParts.length > 0) {
        return fallbackVersionParts.filter(Boolean).join("__");
    }
    return `generated-${generatedAt.replace(/[:]/g, "-")}`;
}
function buildProjectionDatasetArtifact(characters, generatedAt, datasetVersion) {
    const jsonText = `${JSON.stringify(characters, null, 2)}\n`;
    const utf8Buffer = Buffer.from(jsonText, "utf8");
    const gzipBuffer = (0, zlib_1.gzipSync)(utf8Buffer, { level: 9 });
    return {
        jsonText,
        gzipBuffer,
        manifest: {
            schemaVersion: 1,
            datasetVersion,
            generatedAt,
            fileName: "characters.json.gz",
            compression: "gzip",
            sha256: (0, crypto_1.createHash)("sha256").update(gzipBuffer).digest("hex"),
            sizeBytes: gzipBuffer.byteLength,
            uncompressedSizeBytes: utf8Buffer.byteLength,
            characterCount: characters.length,
        },
    };
}
async function writeGameDbDataset(options) {
    const sourceConfig = options?.sourceConfig ?? (0, game_db_source_1.resolveGameDbSourceConfig)();
    const tables = await (0, game_db_experiment_1.loadRequiredGameDbTables)(sourceConfig);
    const explicitCardIds = options?.explicitCardIds ?? process.env.DOKKAN_GAME_DB_CARD_IDS;
    const cardLimit = options?.cardLimit ?? parseOptionalCardLimit(process.env.DOKKAN_GAME_DB_CARD_LIMIT);
    const generatedAt = new Date().toISOString();
    const sourceSettings = await (0, game_db_source_settings_1.readSourceSettings)(sourceConfig.settingsPath);
    const selectedCardIds = applyOptionalCardLimit(explicitCardIds
        ? (0, game_db_experiment_1.parseCardIds)(explicitCardIds)
        : selectPrimaryGameDbCardIds(tables.cards), cardLimit);
    const sourceCharacters = (0, game_db_experiment_1.buildGameDbCharacterSnapshots)(selectedCardIds, tables);
    const projectionCharacters = (0, game_db_app_projection_1.projectGameDbCharactersToDokkanpanion)(sourceCharacters);
    const datasetVersion = datasetVersionFromSourceSettings(generatedAt, sourceSettings, options?.datasetVersionHint);
    const artifact = buildProjectionDatasetArtifact(projectionCharacters, generatedAt, datasetVersion);
    const outputDir = options?.outputDir ?? DEFAULT_OUTPUT_DIR;
    const datasetPath = (0, path_1.resolve)(outputDir, artifact.manifest.fileName);
    const manifestPath = (0, path_1.resolve)(outputDir, "characters-manifest.json");
    const projectionPath = (0, path_1.resolve)(outputDir, "characters.json");
    const sourceSnapshotPath = (0, path_1.resolve)(outputDir, "source-characters.json");
    const reportPath = (0, path_1.resolve)(outputDir, "report.json");
    const report = {
        source: "game-db-dataset",
        generatedAt,
        sourceRoot: sourceConfig.sourceRoot,
        dataDir: sourceConfig.dataDir,
        datasetVersion,
        selectedCardCount: projectionCharacters.length,
        explicitCardIdOverride: Boolean(explicitCardIds),
        cardLimit,
        selectionRules: {
            maxPrimaryCardIdExclusive: PRIMARY_CARD_ID_MAX,
            minHpInitExclusive: MINIMUM_HP_INIT,
            groupedBy: "card_unique_info_id",
            selectedVariant: "highest-card-id",
        },
        sourceSettings,
    };
    await (0, promises_1.mkdir)(outputDir, { recursive: true });
    await (0, format_json_1.writeFormattedJson)(projectionPath, projectionCharacters);
    await (0, format_json_1.writeFormattedJson)(sourceSnapshotPath, sourceCharacters);
    await (0, format_json_1.writeFormattedJson)(reportPath, report);
    await (0, promises_1.writeFile)(datasetPath, artifact.gzipBuffer);
    await (0, promises_1.writeFile)(manifestPath, `${JSON.stringify(artifact.manifest, null, 2)}\n`, "utf8");
    return {
        outputDir,
        projectionPath,
        reportPath,
        manifestPath,
        datasetPath,
        selectedCardIds,
        datasetVersion,
    };
}
exports.writeGameDbDataset = writeGameDbDataset;
async function main() {
    const result = await writeGameDbDataset();
    console.log(`Wrote game-db dataset to ${result.outputDir}`);
    console.log(`Selected ${result.selectedCardIds.length} primary card(s)`);
}
if (require.main === module) {
    main().catch(error => {
        console.error(error);
        process.exitCode = 1;
    });
}
//# sourceMappingURL=game-db-dataset.js.map