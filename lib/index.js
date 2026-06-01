"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.saveDokkanResults = void 0;
const fs_1 = require("fs");
const path_1 = require("path");
const scraper_1 = require("./scraper");
const fs = require("fs");
const sharp = require("sharp");
const character_1 = require("./character");
const format_json_1 = require("./format-json");
const DOKKAN_INFO_ASSET_BASE_URL = 'https://dokkaninfo.com/assets/global/en';
async function saveDokkanResults() {
    if (!(0, fs_1.existsSync)((0, path_1.resolve)(__dirname, 'data'))) {
        (0, fs_1.mkdirSync)('data');
    }
    if (!(0, fs_1.existsSync)((0, path_1.resolve)(__dirname, 'data/images'))) {
        (0, fs_1.mkdirSync)('data/images');
    }
    console.log('Starting scrape');
    const data = await (0, scraper_1.getDokkanData)();
    console.log('Finished scraping cards');
    const equipment = await (0, scraper_1.getEquipmentData)();
    console.log('Finished scraping equipment');
    let currentDate = new Date();
    let day = ("0" + currentDate.getUTCDate()).slice(-2);
    let month = ("0" + (currentDate.getUTCMonth() + 1)).slice(-2);
    let year = currentDate.getUTCFullYear();
    console.log('Saving images');
    await saveData(`${year}${month}${day}DokkanCharacterData`, data);
    await saveData(`${year}${month}${day}DokkanEquipmentData`, equipment);
    for (const portrait of collectPortraitTargets(data)) {
        await savePortraitWithRetry(`${portrait.filename}.png`, portrait.spec, 6);
    }
}
exports.saveDokkanResults = saveDokkanResults;
async function savePortraitWithRetry(filename, portraitSpec, compressionLevel, retries = 3) {
    try {
        await savePortrait(filename, portraitSpec, compressionLevel);
    }
    catch (error) {
        if (retries > 0) {
            console.log(`Error composing portrait ${filename}. Retrying in 2 seconds...`);
            return savePortraitWithRetry(filename, portraitSpec, compressionLevel, retries - 1);
        }
        else {
            console.error(`Failed to compose portrait ${filename} after 3 attempts.`);
            throw error;
        }
    }
}
async function saveImageWithRetry(filename, url, compressionLevel, retries = 3) {
    try {
        await saveImage(filename, url, compressionLevel);
    }
    catch (error) {
        if (retries > 0) {
            console.log(`Error saving image from ${url}. Retrying in 2 seconds...`);
            return saveImageWithRetry(filename, url, compressionLevel, retries - 1);
        }
        else {
            console.error(`Failed to save image from ${url} after 3 attempts.`);
            throw error;
        }
    }
}
async function saveData(fileName, data) {
    await (0, format_json_1.writeFormattedJson)((0, path_1.resolve)(__dirname, `data/${fileName}.json`), data);
}
function collectPortraitTargets(characters) {
    const portraits = new Map();
    const addPortrait = (filename, spec) => {
        if (!filename || portraits.has(filename)) {
            return;
        }
        portraits.set(filename, spec);
    };
    for (const character of characters) {
        addPortrait(character.portraitFilename, character.portraitSpec);
        for (const transformation of character.transformations ?? []) {
            addPortrait(transformation.portraitFilename, transformation.portraitSpec);
        }
        for (const awakening of [
            ...(character.awakeningCards ?? []),
            ...(character.previousAwakenings ?? []),
            ...(character.nextAwakenings ?? []),
        ]) {
            addPortrait(`portrait_${awakening.id}`, awakening.portraitSpec);
        }
    }
    return Array.from(portraits, ([filename, spec]) => ({ filename, spec }));
}
const savePortrait = async (filename, portraitSpec, compressionLevel) => {
    const path = `data/images/${filename}`;
    if (await isCurrentPortrait(path)) {
        return;
    }
    if (!portraitSpec) {
        throw new Error(`Missing portrait spec for ${filename}`);
    }
    const portraitAssets = portraitAssetUrls(portraitSpec);
    await delay(200);
    const [background, icon, rarity, type] = await Promise.all([
        fetchImageBuffer(portraitAssets.backgroundURL),
        fetchImageBuffer(portraitAssets.iconURL),
        fetchImageBuffer(portraitAssets.rarityURL),
        fetchImageBuffer(portraitAssets.typeURL),
    ]);
    const canvasWidth = 150;
    const canvasHeight = 150;
    const backgroundLayer = await sharp(background).resize({ height: 120 }).png().toBuffer();
    const iconLayer = await sharp(icon).resize({ height: 150 }).png().toBuffer();
    const rarityLayer = await sharp(rarity).resize({ height: 72 }).png().toBuffer();
    const typeLayer = await sharp(type).resize({ height: 57 }).png().toBuffer();
    await sharp({
        create: {
            width: canvasWidth,
            height: canvasHeight,
            channels: 4,
            background: { r: 0, g: 0, b: 0, alpha: 0 },
        }
    })
        .composite([
        { input: backgroundLayer, left: 15, top: 15 },
        { input: iconLayer, left: 0, top: 0 },
        { input: rarityLayer, left: 0, top: 78 },
        { input: typeLayer, left: 93, top: 0 },
    ])
        .png({ quality: 10, compressionLevel: compressionLevel })
        .toFile(`${path}`);
};
function portraitAssetUrls(spec) {
    const rarityNumber = rarityToNumber(spec.rarity);
    const rarityKey = spec.rarity.toLowerCase();
    const frameColorId = spec.frameColorId.toString().padStart(1, '0');
    const iconId = spec.iconId.toString().padStart(7, '0');
    const elementCode = spec.elementCode.padStart(2, '0');
    return {
        backgroundURL: `${DOKKAN_INFO_ASSET_BASE_URL}/layout/en/image/character/character_thumb_bg/cha_base_0${frameColorId}_0${rarityNumber}.png`,
        iconURL: `${DOKKAN_INFO_ASSET_BASE_URL}/character/thumb/card_${iconId}_thumb/card_${iconId}_thumb.png`,
        rarityURL: `${DOKKAN_INFO_ASSET_BASE_URL}/layout/en/image/character/cha_rare_sm_${rarityKey}.png`,
        typeURL: `${DOKKAN_INFO_ASSET_BASE_URL}/layout/en/image/character/cha_type_icon_${elementCode}.png`,
    };
}
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
const saveImage = async (filename, url, compressionLevel) => {
    const path = `data/images/${filename}`;
    if (!fs.existsSync(path)) {
        await delay(200);
        const buffer = await fetchImageBuffer(url);
        await sharp(buffer)
            .png({ quality: 10, compressionLevel: compressionLevel })
            .toFile(`${path}`);
    }
};
async function fetchImageBuffer(url) {
    const response = await fetch(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36',
            'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
        },
    });
    const blob = await response.blob();
    const arrayBuffer = await blob.arrayBuffer();
    return Buffer.from(arrayBuffer);
}
async function isCurrentPortrait(path) {
    if (!fs.existsSync(path)) {
        return false;
    }
    try {
        const metadata = await sharp(path).metadata();
        return metadata.width === 150 && metadata.height === 150;
    }
    catch (error) {
        return false;
    }
}
async function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
saveDokkanResults();
//# sourceMappingURL=index.js.map