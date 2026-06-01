import { existsSync, mkdirSync } from "fs";
import { resolve } from "path";
import { getDokkanData, getEquipmentData } from "./scraper";
import * as fs from 'fs';
import * as sharp from 'sharp';
import { Character, PortraitSpec, Rarities } from "./character";
import { writeFormattedJson } from "./format-json";

const DOKKAN_INFO_ASSET_BASE_URL = 'https://dokkaninfo.com/assets/global/en';

export async function saveDokkanResults() {
    if (!existsSync(resolve(__dirname, 'data'))) {
        mkdirSync('data');
    }
    if (!existsSync(resolve(__dirname, 'data/images'))) {
        mkdirSync('data/images');
    }
    console.log('Starting scrape');
    const data = await getDokkanData();
    console.log('Finished scraping cards');
    const equipment = await getEquipmentData();
    console.log('Finished scraping equipment');
    let currentDate = new Date();
    let day = ("0" + currentDate.getUTCDate()).slice(-2);
    let month = ("0" + (currentDate.getUTCMonth() + 1)).slice(-2);
    let year = currentDate.getUTCFullYear()

    console.log('Saving images');

    await saveData(`${year}${month}${day}DokkanCharacterData`, data);
    await saveData(`${year}${month}${day}DokkanEquipmentData`, equipment);

    for (const portrait of collectPortraitTargets(data)) {
        await savePortraitWithRetry(`${portrait.filename}.png`, portrait.spec, 6)
    }
}

async function savePortraitWithRetry(filename: string, portraitSpec: PortraitSpec | undefined, compressionLevel: number, retries = 3) {
    try {
        await savePortrait(filename, portraitSpec, compressionLevel);
    } catch (error) {
        if (retries > 0) {
            console.log(`Error composing portrait ${filename}. Retrying in 2 seconds...`);
            return savePortraitWithRetry(filename, portraitSpec, compressionLevel, retries - 1);
        } else {
            console.error(`Failed to compose portrait ${filename} after 3 attempts.`);
            throw error;
        }
    }
}

async function saveImageWithRetry(filename: string, url: string, compressionLevel: number, retries = 3) {
    try {
        await saveImage(filename, url, compressionLevel);
    } catch (error) {
        if (retries > 0) {
            console.log(`Error saving image from ${url}. Retrying in 2 seconds...`);
            return saveImageWithRetry(filename, url, compressionLevel, retries - 1);
        } else {
            console.error(`Failed to save image from ${url} after 3 attempts.`);
            throw error;
        }
    }
}

async function saveData(fileName: string, data: unknown) {
    await writeFormattedJson(
        resolve(__dirname, `data/${fileName}.json`),
        data,
    );
}

function collectPortraitTargets(characters: Character[]): { filename: string, spec?: PortraitSpec }[] {
    const portraits = new Map<string, PortraitSpec | undefined>();

    const addPortrait = (filename: string | undefined, spec: PortraitSpec | undefined) => {
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

const savePortrait = async (filename: string, portraitSpec: PortraitSpec | undefined, compressionLevel: number) => {
    const path = `data/images/${filename}`
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
        .toFile(`${path}`)
}

function portraitAssetUrls(spec: PortraitSpec) {
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

function rarityToNumber(rarity: Rarities): number {
    const rarityMap: Record<Rarities, number> = {
        [Rarities.N]: 0,
        [Rarities.R]: 1,
        [Rarities.SR]: 2,
        [Rarities.SSR]: 3,
        [Rarities.UR]: 4,
        [Rarities.LR]: 5,
    };

    return rarityMap[rarity];
}


const saveImage = async (filename: string, url: string, compressionLevel: number) => {
    const path = `data/images/${filename}`
    if (!fs.existsSync(path)) {
        await delay(200);
        const buffer = await fetchImageBuffer(url)
        await sharp(buffer)
            .png({ quality: 10, compressionLevel: compressionLevel })
            .toFile(`${path}`)
    }
}

async function fetchImageBuffer(url: string) {
    const response = await fetch(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36',
            'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
        },
    })
    const blob = await response.blob()
    const arrayBuffer = await blob.arrayBuffer()
    return Buffer.from(arrayBuffer)
}

async function isCurrentPortrait(path: string): Promise<boolean> {
    if (!fs.existsSync(path)) {
        return false;
    }

    try {
        const metadata = await sharp(path).metadata();
        return metadata.width === 150 && metadata.height === 150;
    } catch (error) {
        return false;
    }
}

async function delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

saveDokkanResults()
