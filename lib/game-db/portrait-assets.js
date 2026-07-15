"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.savePortraitFile = exports.portraitSpecFromTypeAndClass = exports.portraitSpecFromElement = exports.cardArtUrlFromCardId = exports.portraitOutputUrl = exports.normalizeAssetId = void 0;
const fs_1 = require("fs");
const promises_1 = require("fs/promises");
const path_1 = require("path");
const sharp = require("sharp");
const character_1 = require("../character");
const DOKKAN_INFO_ASSET_BASE_URL = "https://dokkaninfo.com/assets/global/en";
function normalizeAssetId(cardId) {
    return Math.floor(cardId / 10) * 10;
}
exports.normalizeAssetId = normalizeAssetId;
function portraitOutputUrl(portraitFilename) {
    return `images/${portraitFilename}.png`;
}
exports.portraitOutputUrl = portraitOutputUrl;
function cardArtUrlFromCardId(cardId) {
    const assetId = normalizeAssetId(typeof cardId === "string" ? parseInt(cardId, 10) : cardId);
    return `${DOKKAN_INFO_ASSET_BASE_URL}/character/card/${assetId}/${assetId}.png`;
}
exports.cardArtUrlFromCardId = cardArtUrlFromCardId;
function portraitSpecFromElement(cardId, rarity, element) {
    const numericCardId = typeof cardId === "string" ? parseInt(cardId, 10) : cardId;
    const normalizedElement = element.padStart(2, "0");
    const typeDigit = parseInt(normalizedElement[normalizedElement.length - 1] ?? "0", 10);
    return {
        iconId: normalizeAssetId(numericCardId),
        frameColorId: typeDigit,
        rarity,
        elementCode: normalizedElement,
    };
}
exports.portraitSpecFromElement = portraitSpecFromElement;
function portraitSpecFromTypeAndClass(cardId, rarity, typeDigit, characterClass) {
    const classDigit = characterClass === character_1.Classes.Extreme ? 2 : characterClass === character_1.Classes.Super ? 1 : 0;
    return portraitSpecFromElement(cardId, rarity, `${classDigit}${typeDigit}`);
}
exports.portraitSpecFromTypeAndClass = portraitSpecFromTypeAndClass;
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
        backgroundURL: `${DOKKAN_INFO_ASSET_BASE_URL}/layout/en/image/character/character_thumb_bg/cha_base_0${frameColorId}_0${rarityNumber}.png`,
        iconURL: `${DOKKAN_INFO_ASSET_BASE_URL}/character/thumb/card_${iconId}_thumb/card_${iconId}_thumb.png`,
        rarityURL: `${DOKKAN_INFO_ASSET_BASE_URL}/layout/en/image/character/cha_rare_sm_${rarityKey}.png`,
        typeURL: `${DOKKAN_INFO_ASSET_BASE_URL}/layout/en/image/character/cha_type_icon_${elementCode}.png`,
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
async function isCurrentPortrait(path) {
    if (!(0, fs_1.existsSync)(path)) {
        return false;
    }
    const info = await (0, promises_1.stat)(path);
    return info.size > 0;
}
async function savePortraitFile(portraitFilename, portraitSpec, outputDir = (0, path_1.resolve)(__dirname, "..", "data", "images")) {
    await (0, promises_1.mkdir)(outputDir, { recursive: true });
    const outputPath = (0, path_1.resolve)(outputDir, `${portraitFilename}.png`);
    if (await isCurrentPortrait(outputPath)) {
        return;
    }
    const portraitAssets = portraitAssetUrls(portraitSpec);
    const [background, icon, rarity, type] = await Promise.all([
        fetchImageBuffer(portraitAssets.backgroundURL),
        fetchImageBuffer(portraitAssets.iconURL),
        fetchImageBuffer(portraitAssets.rarityURL),
        fetchImageBuffer(portraitAssets.typeURL),
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