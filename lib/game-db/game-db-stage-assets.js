"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeStageAssetPath = exports.validateStageAssetMissingAcceptance = exports.acquireStageAssets = exports.collectStageAssetRequests = exports.STAGE_ASSET_OBJECT_PREFIX = exports.DEFAULT_STAGE_ASSET_SOURCE_BASE_URL = exports.STAGE_ASSET_CONTRACT_VERSION = exports.STAGE_ASSET_CONTRACT = void 0;
const axios_1 = require("axios");
const crypto_1 = require("crypto");
const promises_1 = require("fs/promises");
const path_1 = require("path");
const format_json_1 = require("../format-json");
const zlib_1 = require("zlib");
const game_db_wallpaper_assets_1 = require("./game-db-wallpaper-assets");
exports.STAGE_ASSET_CONTRACT = "dokkan-game-asset-mirror";
exports.STAGE_ASSET_CONTRACT_VERSION = "1.0.0";
exports.DEFAULT_STAGE_ASSET_SOURCE_BASE_URL = "https://assets.dokkanstats.com/assets/global/en";
exports.STAGE_ASSET_OBJECT_PREFIX = "game-assets/";
const STAGE_ASSET_FALLBACK_SOURCE_BASE_URLS = [
    "https://dokkaninfo.com/assets/global/en",
    "https://cdn.dokkan.fyi/assets/en",
];
function collectStageAssetRequests(dataset, itemCatalog, frontier, sourceBaseUrl = exports.DEFAULT_STAGE_ASSET_SOURCE_BASE_URL, awakeningMedals) {
    const normalizedBaseUrl = validateHttpsBaseUrl(sourceBaseUrl);
    const requests = new Map();
    const addPath = (rawPath, originalUrl, alternatePaths = []) => {
        const path = normalizeStageAssetPath(rawPath);
        if (!path)
            return;
        const urls = requests.get(path) ?? new Set();
        urls.add(`${normalizedBaseUrl}/${path}`);
        STAGE_ASSET_FALLBACK_SOURCE_BASE_URLS.forEach(baseUrl => urls.add(`${baseUrl}/${path}`));
        if (originalUrl)
            urls.add(originalUrl);
        for (const alternateRawPath of alternatePaths) {
            const alternatePath = normalizeStageAssetPath(alternateRawPath);
            if (!alternatePath || alternatePath === path)
                continue;
            urls.add(`${normalizedBaseUrl}/${alternatePath}`);
            STAGE_ASSET_FALLBACK_SOURCE_BASE_URLS.forEach(baseUrl => urls.add(`${baseUrl}/${alternatePath}`));
        }
        const fallbackPath = fallbackCharacterThumbPath(path);
        if (fallbackPath) {
            urls.add(`${normalizedBaseUrl}/${fallbackPath}`);
            STAGE_ASSET_FALLBACK_SOURCE_BASE_URLS.forEach(baseUrl => urls.add(`${baseUrl}/${fallbackPath}`));
        }
        requests.set(path, urls);
    };
    const addRemoteUrl = (url) => {
        const path = assetPathFromUrl(url);
        if (path)
            addPath(path, url);
    };
    const itemsByKey = new Map();
    for (const item of itemCatalog.categories?.flatMap(category => category.items ?? []) ?? []) {
        const key = item.key ?? (item.itemType && item.id ? `${item.itemType}:${item.id}` : undefined);
        if (key)
            itemsByKey.set(key, item);
    }
    const addCharacterAssets = (thumbnailId, rarityRaw, elementRaw) => {
        const iconId = thumbnailId?.trim();
        if (!iconId || !/^\d+$/.test(iconId))
            return;
        addPath(`character/thumb/card_${iconId}_thumb/card_${iconId}_thumb.png`);
        if (rarityRaw === undefined || rarityRaw < 0 || rarityRaw > 5)
            return;
        const rarity = ["n", "r", "sr", "ssr", "ur", "lr"][rarityRaw];
        addPath(`layout/en/image/character/cha_rare_sm_${rarity}.png`);
        if (elementRaw === undefined || elementRaw < 0 || elementRaw > 24 || elementRaw % 10 > 4)
            return;
        const frameColor = elementRaw % 10;
        const elementCode = String(elementRaw).padStart(2, "0");
        addPath(`layout/en/image/character/character_thumb_bg/cha_base_0${frameColor}_0${rarityRaw}.png`);
        addPath(`layout/en/image/character/cha_type_icon_${elementCode}.png`);
    };
    const addReward = (reward) => {
        const itemType = reward.itemType;
        const itemId = reward.itemId;
        const catalogItem = itemsByKey.get(`${itemType}:${itemId}`);
        addPath(reward.iconAssetPath);
        addPath(reward.backgroundAssetPath);
        addPath(reward.equipmentSkill?.levelAssetPath);
        addPath(reward.equipmentSkill?.infinityAssetPath);
        addPath(reward.wallpaper?.rewardThumbnailAssetPath);
        addPath(reward.wallpaper?.thumbnailAssetPath);
        addPath(reward.wallpaper?.fullImageAssetPath);
        for (const badgePath of reward.equipmentSkill?.restriction.presentation.badgeAssetPaths ?? [])
            addPath(badgePath);
        addPath(reward.equipmentSkill?.restriction.presentation.badgeAssetPath);
        addRemoteUrl(catalogItem?.icon?.remoteUrl);
        addRemoteUrl(catalogItem?.background?.remoteUrl);
        if (itemType === "Point::Stone") {
            addPath("layout/en/image/item/login_bonus/stone.png");
        }
        else if (itemType === "AwakeningItem") {
            const padded = itemId.padStart(5, "0");
            addPath(`item/awaken/en/thumb/thumb_awaken_items_${padded}/thumb_awaken_items_${padded}.png`);
        }
        else if (itemType === "SupportMemory") {
            addPath(`item/support_memory/thumb/support_memory_thumb_${itemId}.png`);
        }
        else if (itemType === "TrainingItem") {
            addPath(`item/training_item/thumb_training_items_${itemId.padStart(7, "0")}.png`);
        }
        else if (itemType === "LinkSkillLvUpItem") {
            const padded = itemId.padStart(5, "0");
            addPath(`item/other/en/thumb/thumb_linkskill_orb_${padded}/thumb_linkskill_orb_${padded}.png`);
        }
        else if (itemType === "TreasureItem" && reward.thumbnailId) {
            const suffix = reward.thumbnailId.padStart(5, "0");
            addPath(`item/other/en/thumb/thumb_trade_jewel_${suffix}/thumb_trade_jewel_${suffix}.png`);
        }
        else if (itemType === "Card") {
            addCharacterAssets(reward.thumbnailId ?? itemId, reward.rarityRaw, reward.elementRaw);
        }
    };
    const addEnemy = (enemy) => {
        addCharacterAssets(enemy.thumbnailId ?? enemy.cardId, enemy.rarityRaw, enemy.elementRaw);
    };
    for (const stage of dataset.entries) {
        addPath(stage.images.button?.sourcePath ?? stage.images.header?.sourcePath, undefined, [stage.images.header?.sourcePath].filter((path) => Boolean(path)));
        addPath(stage.story?.banner?.sourcePath);
        if (stage.areaType === "Area::MainArea" && stage.chapter?.id) {
            addPath(`outgame/extension/adventure/chapter/${stage.chapter.id}/${stage.chapter.id}001.png`);
        }
        stage.enemies.forEach(addEnemy);
        stage.bossDrops?.forEach(addReward);
        stage.dropPreviews?.flatMap(preview => preview.items).forEach(addReward);
    }
    for (const stage of dataset.zBattles ?? []) {
        addPath(stage.listButton?.sourcePath ?? stage.banner?.sourcePath, undefined, [stage.banner?.sourcePath].filter((path) => Boolean(path)));
        stage.checkpoints?.flatMap(checkpoint => checkpoint.repeatRewards).forEach(addReward);
        stage.firstRewards?.flatMap(level => level.rewards).forEach(addReward);
        // Z-Battle escalation rows identify synthetic enemy cards (often 9xxxxxx),
        // but the Android screen currently presents those rows as text only. Do
        // not mirror a guessed thumb path for a visual that no consumer requests.
    }
    dataset.eventMissions?.flatMap(mission => mission.rewards).forEach(addReward);
    for (const medal of awakeningMedals?.items ?? []) {
        addPath(medal.iconAssetPath);
        if (/^(?:bronze|silver|gold|rainbow|super)$/.test(medal.rarity ?? "")) {
            addPath(`layout/en/image/item/awaken/awaken_thumb_bg/thumb_awaken_${medal.rarity}.png`);
        }
    }
    walkFrontier(frontier, addRemoteUrl, addPath, addCharacterAssets);
    return [...requests]
        .map(([path, urls]) => ({ path, sourceUrls: [...urls] }))
        .sort((left, right) => left.path.localeCompare(right.path, "en", { numeric: true }));
}
exports.collectStageAssetRequests = collectStageAssetRequests;
function walkFrontier(value, addRemoteUrl, addPath, addCharacterAssets) {
    if (typeof value === "string") {
        if (/^https:\/\//.test(value))
            addRemoteUrl(value);
        else if (/^(origin|character|layout|item)\//.test(value))
            addPath(value);
        return;
    }
    if (Array.isArray(value)) {
        value.forEach(item => walkFrontier(item, addRemoteUrl, addPath, addCharacterAssets));
        return;
    }
    if (!value || typeof value !== "object")
        return;
    const record = value;
    const portraitSpec = record.portraitSpec;
    if (portraitSpec && typeof portraitSpec === "object" && !Array.isArray(portraitSpec)) {
        const spec = portraitSpec;
        const rarityRaw = ["N", "R", "SR", "SSR", "UR", "LR"].indexOf(String(spec.rarity ?? ""));
        const elementRaw = Number(spec.elementCode);
        addCharacterAssets(String(spec.iconId ?? ""), rarityRaw >= 0 ? rarityRaw : undefined, Number.isSafeInteger(elementRaw) ? elementRaw : undefined);
        const step = Number(record.step);
        if (Number.isSafeInteger(step) && step > 0) {
            addPath(`layout/en/image/character/cha_label_efchange_${step}.png`);
        }
    }
    Object.values(record).forEach(item => walkFrontier(item, addRemoteUrl, addPath, addCharacterAssets));
}
async function acquireStageAssets(options) {
    const outputDir = (0, path_1.resolve)(options.outputDir);
    await requireMissing(outputDir);
    const reuseDir = options.reuseDir ? (0, path_1.resolve)(options.reuseDir) : undefined;
    const equipmentUiDir = options.equipmentUiDir ? (0, path_1.resolve)(options.equipmentUiDir) : undefined;
    const wallpaperAssetsDir = options.wallpaperAssetsDir ? (0, path_1.resolve)(options.wallpaperAssetsDir) : undefined;
    const reusedSourceUrls = reuseDir ? await readReusableSourceUrls(reuseDir) : new Map();
    const equipmentUiAssets = equipmentUiDir ? await readEquipmentUiAssets(equipmentUiDir) : new Map();
    const wallpaperAssets = wallpaperAssetsDir
        ? await readWallpaperAssets(wallpaperAssetsDir, options.dataset.sourceSnapshotVersion, options.dataset.sourceDatabaseSha256)
        : new Map();
    const sourceBaseUrl = validateHttpsBaseUrl(options.sourceBaseUrl ?? exports.DEFAULT_STAGE_ASSET_SOURCE_BASE_URL);
    const requests = collectStageAssetRequests(options.dataset, options.itemCatalog, options.frontier, sourceBaseUrl, options.awakeningMedals);
    const requiredEquipmentUiPaths = collectEquipmentUiPaths(options.dataset);
    if (requiredEquipmentUiPaths.size && !equipmentUiDir)
        throw new Error("Stage equipment UI assets require a verified official equipment UI directory");
    for (const path of requiredEquipmentUiPaths) {
        if (!equipmentUiAssets.has(path))
            throw new Error(`Verified official equipment UI directory is missing ${path}`);
    }
    const requiredWallpaperPaths = collectWallpaperPaths(options.dataset);
    if (requiredWallpaperPaths.size && !wallpaperAssetsDir)
        throw new Error("Stage wallpaper assets require a verified official wallpaper directory");
    for (const path of requiredWallpaperPaths) {
        if (!wallpaperAssets.has(path))
            throw new Error(`Verified official wallpaper directory is missing ${path}`);
    }
    await (0, promises_1.mkdir)((0, path_1.dirname)(outputDir), { recursive: true });
    await (0, promises_1.mkdir)(outputDir, { recursive: false });
    let completed = 0;
    const acquiredResults = await mapWithConcurrency(requests, options.concurrency ?? 12, async (request) => {
        const officialEquipmentUi = equipmentUiDir ? await readReusablePng(equipmentUiDir, request.path) : undefined;
        const officialWallpaper = wallpaperAssetsDir ? await readReusablePng(wallpaperAssetsDir, request.path) : undefined;
        const reused = officialEquipmentUi || officialWallpaper ? undefined : (reuseDir ? await readReusablePng(reuseDir, request.path) : undefined);
        const equipmentUiEntry = officialEquipmentUi ? equipmentUiAssets.get(request.path) : undefined;
        const wallpaperEntry = officialWallpaper ? wallpaperAssets.get(request.path) : undefined;
        if (officialEquipmentUi && !equipmentUiEntry)
            throw new Error(`Equipment UI bytes lack provenance: ${request.path}`);
        if (officialWallpaper && !wallpaperEntry)
            throw new Error(`Wallpaper bytes lack provenance: ${request.path}`);
        const acquired = officialEquipmentUi
            ? { buffer: officialEquipmentUi, sourceUrl: equipmentUiEntry.sourceUrl, sourceFiles: equipmentUiEntry.sourceFiles }
            : officialWallpaper
                ? { buffer: officialWallpaper, sourceUrl: wallpaperEntry.sourceUrl, sourceFiles: wallpaperEntry.sourceFiles }
                : reused
                    ? { buffer: reused, sourceUrl: reusedSourceUrls.get(request.path) ?? request.sourceUrls[0] }
                    : await fetchFirstPng(request);
        completed += 1;
        if (completed % 250 === 0 || completed === requests.length) {
            console.log(`Checked ${completed}/${requests.length} Stage assets`);
        }
        if (!acquired)
            return { request };
        const outputPath = contained(outputDir, exports.STAGE_ASSET_OBJECT_PREFIX + request.path);
        await (0, promises_1.mkdir)((0, path_1.dirname)(outputPath), { recursive: true });
        await (0, promises_1.writeFile)(outputPath, acquired.buffer, { flag: "wx" });
        const entry = {
            path: request.path,
            objectKey: exports.STAGE_ASSET_OBJECT_PREFIX + request.path,
            sourceUrl: acquired.sourceUrl,
            sha256: sha256(acquired.buffer),
            sizeBytes: acquired.buffer.byteLength,
            contentType: "image/png",
            ...("sourceFiles" in acquired ? { sourceFiles: acquired.sourceFiles } : {}),
        };
        return { request, entry };
    });
    const assets = acquiredResults.flatMap(result => result.entry ? [result.entry] : []);
    const missingAssets = acquiredResults
        .filter(result => !result.entry)
        .map(result => result.request);
    validateStageAssetMissingAcceptance(options.dataset.sourceSnapshotVersion, missingAssets, options.missingAcceptance);
    assets.sort((left, right) => left.path.localeCompare(right.path, "en", { numeric: true }));
    const manifest = {
        schemaVersion: 1,
        contract: exports.STAGE_ASSET_CONTRACT,
        contractVersion: exports.STAGE_ASSET_CONTRACT_VERSION,
        datasetVersion: options.dataset.generatedAt,
        sourceSnapshotVersion: requireValue(options.dataset.sourceSnapshotVersion, "source snapshot version"),
        sourceDatabaseSha256: requireValue(options.dataset.sourceDatabaseSha256, "source database SHA-256"),
        sourceBaseUrl,
        objectPrefix: exports.STAGE_ASSET_OBJECT_PREFIX,
        requestedAssetCount: requests.length,
        assetCount: assets.length,
        missingAssetCount: missingAssets.length,
        assetBytes: assets.reduce((sum, asset) => sum + asset.sizeBytes, 0),
        inventorySha256: sha256(Buffer.from(JSON.stringify(assets))),
        assets,
        missingAssets,
        ...(options.missingAcceptance ? { missingAcceptance: options.missingAcceptance } : {}),
    };
    await (0, format_json_1.writeFormattedJson)((0, path_1.resolve)(outputDir, "stage-assets-manifest.json"), manifest);
    return manifest;
}
exports.acquireStageAssets = acquireStageAssets;
function collectEquipmentUiPaths(dataset) {
    const paths = new Set();
    const addReward = (reward) => {
        const equipment = reward.equipmentSkill;
        if (!equipment)
            return;
        paths.add(equipment.levelAssetPath);
        if (equipment.infinityAssetPath)
            paths.add(equipment.infinityAssetPath);
        for (const path of equipment.restriction.presentation.badgeAssetPaths ?? [])
            paths.add(path);
        if (equipment.restriction.presentation.badgeAssetPath)
            paths.add(equipment.restriction.presentation.badgeAssetPath);
    };
    for (const stage of dataset.entries) {
        stage.bossDrops?.forEach(addReward);
        stage.dropPreviews?.flatMap(preview => preview.items).forEach(addReward);
    }
    for (const stage of dataset.zBattles ?? []) {
        stage.checkpoints?.flatMap(checkpoint => checkpoint.repeatRewards).forEach(addReward);
        stage.firstRewards?.flatMap(level => level.rewards).forEach(addReward);
    }
    dataset.eventMissions?.flatMap(mission => mission.rewards).forEach(addReward);
    return paths;
}
function collectWallpaperPaths(dataset) {
    const paths = new Set();
    const addReward = (reward) => {
        const wallpaper = reward.wallpaper;
        if (!wallpaper)
            return;
        paths.add(wallpaper.rewardThumbnailAssetPath);
        paths.add(wallpaper.thumbnailAssetPath);
        if (wallpaper.fullImageAssetPath)
            paths.add(wallpaper.fullImageAssetPath);
    };
    for (const stage of dataset.entries) {
        stage.bossDrops?.forEach(addReward);
        stage.dropPreviews?.flatMap(preview => preview.items).forEach(addReward);
    }
    for (const stage of dataset.zBattles ?? []) {
        stage.checkpoints?.flatMap(checkpoint => checkpoint.repeatRewards).forEach(addReward);
        stage.firstRewards?.flatMap(level => level.rewards).forEach(addReward);
    }
    dataset.eventMissions?.flatMap(mission => mission.rewards).forEach(addReward);
    return paths;
}
function validateStageAssetMissingAcceptance(sourceSnapshotVersion, missingAssets, acceptance) {
    if (missingAssets.length === 0) {
        if (acceptance)
            throw new Error("Stage asset missing acceptance is unnecessary for a complete mirror");
        return;
    }
    const missingPathsSha256 = sha256(Buffer.from(missingAssets.map(asset => asset.path).sort((left, right) => left.localeCompare(right, "en", { numeric: true })).join("\n")));
    if (!acceptance
        || acceptance.schemaVersion !== 1
        || acceptance.sourceSnapshotVersion !== sourceSnapshotVersion
        || acceptance.missingAssetCount !== missingAssets.length
        || acceptance.missingPathsSha256 !== missingPathsSha256
        || acceptance.reason.trim().length < 20) {
        throw new Error(`Stage asset mirror has ${missingAssets.length} unaccepted missing assets (${missingPathsSha256})`);
    }
}
exports.validateStageAssetMissingAcceptance = validateStageAssetMissingAcceptance;
async function fetchFirstPng(request) {
    for (const sourceUrl of request.sourceUrls) {
        try {
            const response = await axios_1.default.get(sourceUrl, {
                responseType: "arraybuffer",
                timeout: 30000,
                maxRedirects: 0,
                validateStatus: status => status === 200,
                headers: { "User-Agent": "Dokkanpanion-stage-asset-mirror/1.0" },
            });
            const buffer = Buffer.from(response.data);
            if (!isPng(buffer))
                continue;
            return { buffer, sourceUrl };
        }
        catch {
            continue;
        }
    }
    return undefined;
}
async function readReusableSourceUrls(reuseDir) {
    const raw = await (0, promises_1.readFile)((0, path_1.resolve)(reuseDir, "stage-assets-manifest.json"), "utf8");
    const manifest = JSON.parse(raw);
    return new Map((manifest.assets ?? []).map(asset => [asset.path, asset.sourceUrl]));
}
async function readEquipmentUiAssets(root) {
    const raw = await (0, promises_1.readFile)((0, path_1.resolve)(root, "equipment-ui-assets-manifest.json"), "utf8");
    const manifest = JSON.parse(raw);
    if (manifest.schemaVersion !== 1 || !Array.isArray(manifest.assets))
        throw new Error("Invalid equipment UI asset manifest");
    const result = new Map();
    for (const asset of manifest.assets) {
        if (normalizeStageAssetPath(asset.path) !== asset.path || result.has(asset.path)
            || !asset.sourceUrl.startsWith("official-cpk-") || !Array.isArray(asset.sourceFiles) || asset.sourceFiles.length === 0
            || !/^[a-f0-9]{64}$/.test(asset.sha256) || !Number.isSafeInteger(asset.sizeBytes) || asset.sizeBytes <= 0) {
            throw new Error(`Invalid equipment UI asset provenance for ${asset.path ?? "unknown"}`);
        }
        const bytes = await readReusablePng(root, asset.path);
        if (!bytes || bytes.byteLength !== asset.sizeBytes || sha256(bytes) !== asset.sha256)
            throw new Error(`Equipment UI asset drifted: ${asset.path}`);
        result.set(asset.path, asset);
    }
    return result;
}
async function readWallpaperAssets(root, sourceSnapshotVersion, sourceDatabaseSha256) {
    const raw = await (0, promises_1.readFile)((0, path_1.resolve)(root, "wallpaper-assets-manifest.json"), "utf8");
    const manifest = (0, game_db_wallpaper_assets_1.validateWallpaperAssetManifest)(JSON.parse(raw));
    (0, game_db_wallpaper_assets_1.validatePinnedWallpaperToolchain)(manifest);
    if (manifest.source.databaseSnapshotVersion !== sourceSnapshotVersion
        || manifest.source.databaseSha256 !== sourceDatabaseSha256) {
        throw new Error("Wallpaper asset manifest does not match the Stage dataset source");
    }
    const result = new Map();
    for (const asset of manifest.assets) {
        if (normalizeStageAssetPath(asset.path) !== asset.path || result.has(asset.path)
            || !asset.sourceUrl.startsWith("official-cpk-extract://") || !Array.isArray(asset.sourceFiles) || asset.sourceFiles.length < 3
            || !/^[a-f0-9]{64}$/.test(asset.sha256) || !Number.isSafeInteger(asset.sizeBytes) || asset.sizeBytes <= 0) {
            throw new Error(`Invalid wallpaper asset provenance for ${asset.path ?? "unknown"}`);
        }
        const bytes = await readReusablePng(root, asset.path);
        if (!bytes || bytes.byteLength !== asset.sizeBytes || sha256(bytes) !== asset.sha256)
            throw new Error(`Wallpaper asset drifted: ${asset.path}`);
        result.set(asset.path, asset);
    }
    return result;
}
async function readReusablePng(reuseDir, path) {
    try {
        const buffer = await (0, promises_1.readFile)(contained(reuseDir, exports.STAGE_ASSET_OBJECT_PREFIX + path));
        return isPng(buffer) ? buffer : undefined;
    }
    catch (error) {
        if (error.code === "ENOENT")
            return undefined;
        throw error;
    }
}
function normalizeStageAssetPath(value) {
    const path = value?.trim().replace(/\\/g, "/").replace(/^\/+/, "");
    if (!path || !path.endsWith(".png") || path.split("/").some(part => !part || part === "." || part === ".."))
        return undefined;
    if (!/^[A-Za-z0-9_./-]+$/.test(path))
        return undefined;
    return path;
}
exports.normalizeStageAssetPath = normalizeStageAssetPath;
function assetPathFromUrl(value) {
    if (!value)
        return undefined;
    try {
        const url = new URL(value);
        if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash)
            return undefined;
        const markers = ["/assets/global/en/", "/assets/en/"];
        const marker = markers.find(candidate => url.pathname.includes(candidate));
        return marker ? normalizeStageAssetPath(url.pathname.split(marker)[1]) : undefined;
    }
    catch {
        return undefined;
    }
}
function fallbackCharacterThumbPath(path) {
    const match = /^character\/thumb\/card_(\d+)_thumb\/card_\1_thumb\.png$/.exec(path);
    if (!match || match[1].endsWith("0"))
        return undefined;
    const fallbackId = match[1].slice(0, -1) + "0";
    return `character/thumb/card_${fallbackId}_thumb/card_${fallbackId}_thumb.png`;
}
function validateHttpsBaseUrl(value) {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) {
        throw new Error("Stage asset source base must be a safe HTTPS URL");
    }
    return url.toString().replace(/\/$/, "");
}
function isPng(buffer) {
    return buffer.byteLength >= 8 && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
}
function sha256(buffer) {
    return (0, crypto_1.createHash)("sha256").update(buffer).digest("hex");
}
function requireValue(value, label) {
    if (!value)
        throw new Error(`Stage asset dataset lacks ${label}`);
    return value;
}
function contained(root, path) {
    const target = (0, path_1.resolve)(root, ...path.split("/"));
    const prefix = `${(0, path_1.resolve)(root)}${path_1.sep}`.toLowerCase();
    if (!target.toLowerCase().startsWith(prefix))
        throw new Error(`Stage asset path escapes output: ${path}`);
    return target;
}
async function requireMissing(path) {
    try {
        await (0, promises_1.stat)(path);
        throw new Error(`Stage asset output must not already exist: ${path}`);
    }
    catch (error) {
        if (error.code !== "ENOENT")
            throw error;
    }
}
async function mapWithConcurrency(values, concurrency, task) {
    if (!Number.isSafeInteger(concurrency) || concurrency < 1 || concurrency > 32)
        throw new Error("Invalid Stage asset concurrency");
    const result = new Array(values.length);
    let cursor = 0;
    await Promise.all(Array.from({ length: Math.min(concurrency, values.length) }, async () => {
        while (true) {
            const index = cursor++;
            if (index >= values.length)
                return;
            result[index] = await task(values[index]);
        }
    }));
    return result;
}
async function main() {
    const values = new Map();
    const supported = new Set(["--dataset", "--item-catalog", "--frontier", "--awakening-medals", "--output-dir", "--reuse-dir", "--equipment-ui-dir", "--wallpaper-assets-dir", "--missing-acceptance", "--source-base-url", "--concurrency"]);
    const args = process.argv.slice(2);
    for (let index = 0; index < args.length; index += 1) {
        const [name, inline] = args[index].split("=", 2);
        if (!supported.has(name))
            throw new Error(`Unexpected Stage asset argument: ${args[index]}`);
        const value = inline ?? args[++index];
        if (!value || values.has(name))
            throw new Error(`Missing or duplicate Stage asset argument: ${name}`);
        values.set(name, value);
    }
    for (const required of ["--dataset", "--item-catalog", "--output-dir"]) {
        if (!values.has(required))
            throw new Error(`Missing Stage asset argument: ${required}`);
    }
    const dataset = JSON.parse(await (0, promises_1.readFile)((0, path_1.resolve)(values.get("--dataset")), "utf8"));
    const itemCatalog = JSON.parse(await (0, promises_1.readFile)((0, path_1.resolve)(values.get("--item-catalog")), "utf8"));
    const frontier = values.get("--frontier")
        ? JSON.parse(await (0, promises_1.readFile)((0, path_1.resolve)(values.get("--frontier")), "utf8"))
        : undefined;
    const awakeningMedalsPath = values.get("--awakening-medals");
    const awakeningMedals = awakeningMedalsPath
        ? JSON.parse((awakeningMedalsPath.endsWith(".gz")
            ? (0, zlib_1.gunzipSync)(await (0, promises_1.readFile)((0, path_1.resolve)(awakeningMedalsPath)))
            : await (0, promises_1.readFile)((0, path_1.resolve)(awakeningMedalsPath))).toString("utf8"))
        : undefined;
    const missingAcceptance = values.get("--missing-acceptance")
        ? JSON.parse(await (0, promises_1.readFile)((0, path_1.resolve)(values.get("--missing-acceptance")), "utf8"))
        : undefined;
    const manifest = await acquireStageAssets({
        dataset,
        itemCatalog,
        frontier,
        awakeningMedals,
        outputDir: (0, path_1.resolve)(values.get("--output-dir")),
        reuseDir: values.get("--reuse-dir") ? (0, path_1.resolve)(values.get("--reuse-dir")) : undefined,
        equipmentUiDir: values.get("--equipment-ui-dir") ? (0, path_1.resolve)(values.get("--equipment-ui-dir")) : undefined,
        wallpaperAssetsDir: values.get("--wallpaper-assets-dir") ? (0, path_1.resolve)(values.get("--wallpaper-assets-dir")) : undefined,
        missingAcceptance,
        sourceBaseUrl: values.get("--source-base-url"),
        concurrency: values.get("--concurrency") ? Number(values.get("--concurrency")) : undefined,
    });
    console.log(JSON.stringify({
        outputDir: (0, path_1.resolve)(values.get("--output-dir")),
        assetCount: manifest.assetCount,
        missingAssetCount: manifest.missingAssetCount,
        assetBytes: manifest.assetBytes,
        inventorySha256: manifest.inventorySha256,
    }, null, 2));
}
if (require.main === module) {
    main().catch(error => {
        console.error(error instanceof Error ? error.message : String(error));
        process.exitCode = 1;
    });
}
//# sourceMappingURL=game-db-stage-assets.js.map