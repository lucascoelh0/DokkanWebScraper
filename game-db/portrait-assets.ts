import { existsSync } from "fs";
import { mkdir, stat } from "fs/promises";
import { resolve } from "path";
import * as sharp from "sharp";
import { PortraitSpec, Rarities } from "../character";
import {
    assertPortraitFilename,
    DOKKAN_INFO_ASSET_BASE_URL,
} from "./portrait-asset-contract";

export {
    assertPortraitFilename,
    cardArtUrlFromCardId,
    normalizeAssetId,
    portraitOutputUrl,
    portraitSpecFromElement,
    portraitSpecFromTypeAndClass,
} from "./portrait-asset-contract";
const sharedPortraitAssetCache = new Map<string, Promise<Buffer>>();

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

function portraitAssetUrls(spec: PortraitSpec) {
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

async function fetchImageBuffer(url: string): Promise<Buffer> {
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

function fetchSharedImageBuffer(url: string): Promise<Buffer> {
    const cached = sharedPortraitAssetCache.get(url);
    if (cached) {
        return cached;
    }

    const request = fetchImageBuffer(url);
    sharedPortraitAssetCache.set(url, request);
    return request;
}

async function isCurrentPortrait(path: string): Promise<boolean> {
    if (!existsSync(path)) {
        return false;
    }

    const info = await stat(path);
    return info.size > 0;
}

export async function savePortraitFile(
    portraitFilename: string,
    portraitSpec: PortraitSpec,
    outputDir = resolve(__dirname, "..", "data", "images"),
    force = false,
): Promise<void> {
    assertPortraitFilename(portraitFilename);
    await mkdir(outputDir, { recursive: true });
    const outputPath = resolve(outputDir, `${portraitFilename}.png`);
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

