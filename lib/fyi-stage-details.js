"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.collectStageDetailAssets = exports.mirrorStageDetailAssets = exports.mapStageDetailImages = exports.mapStageDetailFromFyi = exports.removeUnmirroredStageDetailAssets = exports.localizeStageDetailAssets = exports.writeDokkanFyiStageDetails = exports.getDokkanFyiStageDetails = void 0;
const fs_1 = require("fs");
const promises_1 = require("fs/promises");
const path_1 = require("path");
const format_json_1 = require("./format-json");
const DOKKAN_FYI_BASE_URL = "https://dokkan.fyi";
const DOKKAN_FYI_CDN_BASE_URL = "https://cdn.dokkan.fyi/assets";
const STAGE_DETAIL_ASSET_ROOT = "data/stage-details/assets";
const DEFAULT_STAGE_IDS = [
    "17380223",
    "17380233",
    "17380243",
    "17380253",
    "17380264",
    "17380274",
];
async function getDokkanFyiStageDetails(stageIds = requestedStageIds()) {
    const ids = uniqueStageIds(stageIds);
    const entries = await mapWithConcurrency(ids, requestedStageDetailConcurrency(), async (id) => {
        const payload = await fetchStageDetailPage(id);
        return mapStageDetailFromFyi(payload.props.stage);
    });
    return {
        generatedAt: new Date().toISOString(),
        source: "dokkan.fyi",
        count: entries.length,
        entries: entries.sort((left, right) => left.id.localeCompare(right.id)),
    };
}
exports.getDokkanFyiStageDetails = getDokkanFyiStageDetails;
async function writeDokkanFyiStageDetails(dataset) {
    const outputDir = (0, path_1.resolve)(__dirname, "data/stage-details/latest");
    const outputPath = (0, path_1.resolve)(outputDir, "stage-details.json");
    await (0, promises_1.mkdir)(outputDir, { recursive: true });
    await (0, format_json_1.writeFormattedJson)(outputPath, dataset);
    return outputPath;
}
exports.writeDokkanFyiStageDetails = writeDokkanFyiStageDetails;
function localizeStageDetailAssets(dataset) {
    const assets = collectStageDetailAssets(dataset);
    const byRemoteUrl = new Map(assets.map(asset => [asset.remoteUrl, asset]));
    const localize = (asset) => {
        if (!asset)
            return undefined;
        return byRemoteUrl.get(asset.remoteUrl) ?? asset;
    };
    return {
        ...dataset,
        entries: dataset.entries.map(entry => ({
            ...entry,
            images: {
                header: localize(entry.images.header),
                banner: localize(entry.images.banner),
                button: localize(entry.images.button),
            },
            enemies: entry.enemies.map(enemy => ({
                ...enemy,
                portrait: localize(enemy.portrait),
            })),
        })),
    };
}
exports.localizeStageDetailAssets = localizeStageDetailAssets;
function removeUnmirroredStageDetailAssets(dataset, failedRemoteUrls, projectRoot) {
    const failed = new Set(failedRemoteUrls);
    const keepAsset = (asset) => {
        const localFileMissing = projectRoot && asset?.localPath && !(0, fs_1.existsSync)((0, path_1.resolve)(projectRoot, asset.localPath));
        if (!asset || failed.has(asset.remoteUrl) || localFileMissing) {
            return asset ? { remoteUrl: asset.remoteUrl } : undefined;
        }
        return asset;
    };
    return {
        ...dataset,
        entries: dataset.entries.map(entry => ({
            ...entry,
            images: {
                header: keepAsset(entry.images.header),
                banner: keepAsset(entry.images.banner),
                button: keepAsset(entry.images.button),
            },
            enemies: entry.enemies.map(enemy => ({
                ...enemy,
                portrait: keepAsset(enemy.portrait),
            })),
        })),
    };
}
exports.removeUnmirroredStageDetailAssets = removeUnmirroredStageDetailAssets;
function mapStageDetailFromFyi(stage) {
    const quest = stage.quest;
    const area = quest?.area;
    return {
        id: stage.id.toString(),
        difficulty: cleanText(stage.difficulty),
        stamina: toNumber(stage.stamina),
        requiredKeys: toNumber(stage.required_keys),
        rankExp: toNumber(stage.rank_exp),
        zeni: toNumber(stage.zeni),
        linkSkillLevelUpRate: toNumber(stage.link_skill_level_up_rate),
        questId: toNumber(stage.quest_id ?? quest?.id).toString(),
        questName: cleanText(quest?.name),
        areaId: toNumber(quest?.area_id ?? area?.id).toString(),
        areaName: cleanText(area?.name),
        areaType: cleanText(area?.type),
        startDate: normalizeDate(quest?.start_date),
        images: mapStageDetailImages(area),
        enemies: (stage.enemies ?? []).map(mapStageDetailEnemy),
    };
}
exports.mapStageDetailFromFyi = mapStageDetailFromFyi;
function mapStageDetailImages(area) {
    return {
        header: imageAsset(area?.images?.header),
        banner: imageAsset(area?.images?.banner),
        button: imageAsset(area?.images?.button),
    };
}
exports.mapStageDetailImages = mapStageDetailImages;
function mapStageDetailEnemy(enemy) {
    const character = enemy.character;
    const thumbnailId = toOptionalString(character?.thumbnail_id);
    return {
        id: enemy.id.toString(),
        battle: toNumber(enemy.battle),
        tile: toNumber(enemy.tile),
        characterId: toNumber(enemy.character_id).toString(),
        name: cleanText(character?.name),
        rarity: cleanText(character?.rarity_text) || undefined,
        type: cleanText(character?.type_text) || undefined,
        thumbnailId,
        portrait: thumbnailId ? imageAsset(portraitPath(thumbnailId)) : undefined,
        hp: toNumber(enemy.hp),
        atk: toNumber(enemy.atk),
        def: toNumber(enemy.def),
        skills: (enemy.skills ?? []).map(mapStageDetailSkill),
        turnAttacks: toOptionalNumber(enemy.turn_attacks),
    };
}
function mapStageDetailSkill(skill) {
    return {
        type: toOptionalNumber(skill.type),
        values: (skill.values ?? []).map(value => value === null ? null : toNumber(value)),
        target: toOptionalNumber(skill.target),
        calculation: toOptionalNumber(skill.calculation),
        turns: toOptionalNumber(skill.turns),
        chance: toOptionalNumber(skill.chance),
        name: cleanText(skill.name) || undefined,
        description: cleanText(skill.description) || undefined,
    };
}
async function mirrorStageDetailAssets(dataset, projectRoot = process.cwd()) {
    const assets = collectStageDetailAssets(dataset);
    const failedUrls = [];
    let downloadedCount = 0;
    await mapWithConcurrency(assets, requestedAssetConcurrency(), async (asset) => {
        const outputPath = (0, path_1.resolve)(projectRoot, asset.localPath);
        await (0, promises_1.mkdir)((0, path_1.resolve)(outputPath, ".."), { recursive: true });
        try {
            const response = await fetch(asset.remoteUrl, { headers: browserHeaders() });
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            const buffer = Buffer.from(await response.arrayBuffer());
            await writeFileIfMissingOrChanged(outputPath, buffer);
            downloadedCount += 1;
        }
        catch (error) {
            failedUrls.push(asset.remoteUrl);
        }
    });
    return {
        targetCount: assets.length,
        downloadedCount,
        failedUrls: failedUrls.sort(),
    };
}
exports.mirrorStageDetailAssets = mirrorStageDetailAssets;
function collectStageDetailAssets(dataset, localizedOnly = false) {
    const assets = new Map();
    for (const entry of dataset.entries) {
        addAsset(assets, entry.images.header, `areas/${entry.areaId}/header.png`, localizedOnly);
        addAsset(assets, entry.images.banner, `areas/${entry.areaId}/banner.png`, localizedOnly);
        addAsset(assets, entry.images.button, `areas/${entry.areaId}/button.png`, localizedOnly);
        for (const enemy of entry.enemies) {
            if (enemy.thumbnailId) {
                addAsset(assets, enemy.portrait, `portraits/${enemy.thumbnailId}.png`, localizedOnly);
            }
        }
    }
    return [...assets.values()].sort((left, right) => left.objectKey.localeCompare(right.objectKey));
}
exports.collectStageDetailAssets = collectStageDetailAssets;
async function fetchStageDetailPage(stageId) {
    const response = await fetch(`${DOKKAN_FYI_BASE_URL}/stages/${stageId}`, { headers: browserHeaders() });
    if (!response.ok) {
        throw new Error(`Could not fetch dokkan.fyi stage ${stageId}: ${response.status}`);
    }
    const html = await response.text();
    const match = html.match(/<script data-page="app" type="application\/json">([\s\S]*?)<\/script>/);
    if (!match?.[1]) {
        throw new Error(`Could not find stage payload for ${stageId}.`);
    }
    return JSON.parse(match[1]);
}
function addAsset(assets, asset, relativePath, localizedOnly) {
    if (!asset || assets.has(asset.remoteUrl) || (localizedOnly && (!asset.localPath || !asset.objectKey)))
        return;
    const localPath = asset.localPath ?? `${STAGE_DETAIL_ASSET_ROOT}/${relativePath}`;
    assets.set(asset.remoteUrl, {
        ...asset,
        localPath,
        objectKey: asset.objectKey ?? localPath.replace(/^data\//, ""),
    });
}
function imageAsset(path) {
    const normalized = cleanText(path);
    if (!normalized)
        return undefined;
    return {
        remoteUrl: /^https?:\/\//i.test(normalized)
            ? normalized
            : `${DOKKAN_FYI_CDN_BASE_URL}/${normalized.replace(/^\/+/, "")}`,
    };
}
function portraitPath(thumbnailId) {
    return `${DOKKAN_FYI_CDN_BASE_URL}/en/character/thumb/card_${thumbnailId}_thumb/card_${thumbnailId}_thumb.png`;
}
function requestedStageIds() {
    const configured = process.env.DOKKAN_FYI_STAGE_DETAIL_IDS;
    return configured ? uniqueStageIds(configured.split(/[\s,]+/)) : DEFAULT_STAGE_IDS;
}
function requestedStageDetailConcurrency() {
    return positiveInteger(process.env.DOKKAN_FYI_STAGE_DETAIL_CONCURRENCY, 3);
}
function requestedAssetConcurrency() {
    return positiveInteger(process.env.DOKKAN_FYI_STAGE_ASSET_CONCURRENCY, 4);
}
function positiveInteger(value, fallback) {
    const parsed = Number.parseInt(value ?? "", 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
function uniqueStageIds(ids) {
    return [...new Set(ids.map(id => id.trim()).filter(id => /^\d+$/.test(id)))];
}
function cleanText(value) {
    return value === null || value === undefined
        ? ""
        : value.toString().replace(/\s+/g, " ").trim();
}
function toNumber(value) {
    if (typeof value === "number")
        return Number.isFinite(value) ? value : 0;
    const parsed = Number.parseInt(value ?? "", 10);
    return Number.isFinite(parsed) ? parsed : 0;
}
function toOptionalNumber(value) {
    if (value === null || value === undefined || value === "")
        return undefined;
    const parsed = toNumber(value);
    return Number.isFinite(parsed) ? parsed : undefined;
}
function toOptionalString(value) {
    const normalized = cleanText(value);
    return normalized || undefined;
}
function normalizeDate(value) {
    const normalized = cleanText(value);
    if (!normalized)
        return undefined;
    const date = new Date(normalized.includes("T") ? normalized : normalized.replace(" ", "T") + "Z");
    return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}
function browserHeaders() {
    return {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/148.0.0.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9",
        "Cache-Control": "no-cache",
        "Pragma": "no-cache",
    };
}
async function writeFileIfMissingOrChanged(path, buffer) {
    try {
        const existing = await (0, promises_1.readFile)(path);
        if (existing.equals(buffer))
            return;
    }
    catch {
        // The asset does not exist yet.
    }
    await (0, promises_1.writeFile)(path, buffer);
}
async function mapWithConcurrency(items, concurrency, mapper) {
    const results = [];
    let nextIndex = 0;
    async function worker() {
        while (true) {
            const index = nextIndex++;
            if (index >= items.length)
                return;
            results[index] = await mapper(items[index]);
        }
    }
    await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
    return results;
}
//# sourceMappingURL=fyi-stage-details.js.map