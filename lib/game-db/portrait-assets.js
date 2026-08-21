"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.savePortraitFile = exports.portraitSpecFromTypeAndClass = exports.portraitSpecFromElement = exports.portraitOutputUrl = exports.normalizeAssetId = exports.cardArtUrlFromCardId = exports.assertPortraitFilename = void 0;
const fs_1 = require("fs");
const promises_1 = require("fs/promises");
const path_1 = require("path");
const sharp = require("sharp");
const character_1 = require("../character");
const portrait_asset_contract_1 = require("./portrait-asset-contract");
var portrait_asset_contract_2 = require("./portrait-asset-contract");
Object.defineProperty(exports, "assertPortraitFilename", { enumerable: true, get: function () { return portrait_asset_contract_2.assertPortraitFilename; } });
Object.defineProperty(exports, "cardArtUrlFromCardId", { enumerable: true, get: function () { return portrait_asset_contract_2.cardArtUrlFromCardId; } });
Object.defineProperty(exports, "normalizeAssetId", { enumerable: true, get: function () { return portrait_asset_contract_2.normalizeAssetId; } });
Object.defineProperty(exports, "portraitOutputUrl", { enumerable: true, get: function () { return portrait_asset_contract_2.portraitOutputUrl; } });
Object.defineProperty(exports, "portraitSpecFromElement", { enumerable: true, get: function () { return portrait_asset_contract_2.portraitSpecFromElement; } });
Object.defineProperty(exports, "portraitSpecFromTypeAndClass", { enumerable: true, get: function () { return portrait_asset_contract_2.portraitSpecFromTypeAndClass; } });
const sharedPortraitAssetCache = new Map();
function rarityToNumber(rarity) {
    const rarityMap = {
        [character_1.Rarities.N]: 0,
        [character_1.Rarities.R]: 1,
        [character_1.Rarities.SR]: 2,
        [character_1.Rarities.SSR]: 3,
        [character_1.Rarities.UR]: 4,
        [character_1.Rarities.LR]: 5,
    };
    return rarityMap[rarity];
}
function portraitAssetUrls(spec) {
    const rarityNumber = rarityToNumber(spec.rarity);
    const rarityKey = spec.rarity.toLowerCase();
    const frameColorId = spec.frameColorId.toString().padStart(1, "0");
    const iconId = spec.iconId.toString().padStart(7, "0");
    const elementCode = spec.elementCode.padStart(2, "0");
    return {
        backgroundURL: `${portrait_asset_contract_1.DOKKAN_INFO_ASSET_BASE_URL}/layout/en/image/character/character_thumb_bg/cha_base_0${frameColorId}_0${rarityNumber}.png`,
        iconURL: `${portrait_asset_contract_1.DOKKAN_INFO_ASSET_BASE_URL}/character/thumb/card_${iconId}_thumb/card_${iconId}_thumb.png`,
        rarityURL: `${portrait_asset_contract_1.DOKKAN_INFO_ASSET_BASE_URL}/layout/en/image/character/cha_rare_sm_${rarityKey}.png`,
        typeURL: `${portrait_asset_contract_1.DOKKAN_INFO_ASSET_BASE_URL}/layout/en/image/character/cha_type_icon_${elementCode}.png`,
    };
}
async function fetchImageBuffer(url) {
    const response = await fetch(url, {
        headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36",
            "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
        },
    });
    if (!response.ok) {
        throw new Error(`Failed to fetch portrait asset ${url}: ${response.status} ${response.statusText}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
}
function fetchSharedImageBuffer(url) {
    const cached = sharedPortraitAssetCache.get(url);
    if (cached) {
        return cached;
    }
    const request = fetchImageBuffer(url);
    sharedPortraitAssetCache.set(url, request);
    return request;
}
async function isCurrentPortrait(path) {
    if (!(0, fs_1.existsSync)(path)) {
        return false;
    }
    const info = await (0, promises_1.stat)(path);
    return info.size > 0;
}
async function savePortraitFile(portraitFilename, portraitSpec, outputDir = (0, path_1.resolve)(__dirname, "..", "data", "images"), force = false) {
    (0, portrait_asset_contract_1.assertPortraitFilename)(portraitFilename);
    await (0, promises_1.mkdir)(outputDir, { recursive: true });
    const outputPath = (0, path_1.resolve)(outputDir, `${portraitFilename}.png`);
    if (!force && await isCurrentPortrait(outputPath)) {
        return;
    }
    const portraitAssets = portraitAssetUrls(portraitSpec);
    const [background, icon, rarity, type] = await Promise.all([
        fetchSharedImageBuffer(portraitAssets.backgroundURL),
        fetchImageBuffer(portraitAssets.iconURL),
        fetchSharedImageBuffer(portraitAssets.rarityURL),
        fetchSharedImageBuffer(portraitAssets.typeURL),
    ]);
    const backgroundLayer = await sharp(background).resize({ height: 120 }).png().toBuffer();
    const iconLayer = await sharp(icon).resize({ height: 150 }).png().toBuffer();
    const rarityLayer = await sharp(rarity).resize({ height: 72 }).png().toBuffer();
    const typeLayer = await sharp(type).resize({ height: 57 }).png().toBuffer();
    await sharp({
        create: {
            width: 150,
            height: 150,
            channels: 4,
            background: { r: 0, g: 0, b: 0, alpha: 0 },
        },
    })
        .composite([
        { input: backgroundLayer, left: 15, top: 15 },
        { input: iconLayer, left: 0, top: 0 },
        { input: rarityLayer, left: 0, top: 78 },
        { input: typeLayer, left: 93, top: 0 },
    ])
        .png({ quality: 10, compressionLevel: 6 })
        .toFile(outputPath);
}
exports.savePortraitFile = savePortraitFile;
//# sourceMappingURL=portrait-assets.js.map