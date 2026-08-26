import { readFile } from "fs/promises";
import { isAbsolute, relative, resolve, sep } from "path";
import sharp = require("sharp");
import { PortraitSpec, Rarities } from "../character";
import { normalizePortraitElementCode } from "./portrait-asset-contract";

export interface FirstPartyPortraitLayerPaths {
    background: string,
    thumb: string,
    rarity: string,
    type: string,
}

export interface FirstPartyPortraitAssetRoots {
    /** Directory containing the extracted official layout/en/image/character.cpk members. */
    sharedLayers: string,
    /** Directory containing exact official card_<normalized-id>_thumb.png members. */
    cardThumbs: string,
}

export interface FirstPartyPortraitLayerBytes {
    background: Buffer,
    thumb: Buffer,
    rarity: Buffer,
    type: Buffer,
}

function rarityNumber(rarity: Rarities): number {
    switch (rarity) {
        case Rarities.N: return 0;
        case Rarities.R: return 1;
        case Rarities.SR: return 2;
        case Rarities.SSR: return 3;
        case Rarities.UR: return 4;
        case Rarities.LR: return 5;
        default: throw new Error("portrait has an unsupported rarity");
    }
}

function rarityKey(rarity: Rarities): string {
    return rarity.toLowerCase();
}

function containedPath(root: string, ...parts: string[]): string {
    const canonicalRoot = resolve(root);
    const target = resolve(canonicalRoot, ...parts);
    const child = relative(canonicalRoot, target);
    if (!child || child === ".." || child.startsWith(`..${sep}`) || isAbsolute(child)) {
        throw new Error("official portrait asset path escaped its root");
    }
    return target;
}

export function resolveFirstPartyPortraitLayerPaths(
    spec: PortraitSpec,
    roots: FirstPartyPortraitAssetRoots,
): FirstPartyPortraitLayerPaths {
    if (!Number.isSafeInteger(spec.iconId) || spec.iconId <= 0 || spec.iconId % 10 !== 0) {
        throw new Error("portrait has an invalid normalized icon ID");
    }
    if (!Number.isSafeInteger(spec.frameColorId) || spec.frameColorId < 0 || spec.frameColorId > 4) {
        throw new Error("portrait has an invalid frame color ID");
    }
    const elementCode = normalizePortraitElementCode(spec.elementCode);
    const rarity = rarityNumber(spec.rarity);
    return {
        background: containedPath(
            roots.sharedLayers,
            "character_thumb_bg",
            `cha_base_0${spec.frameColorId}_0${rarity}.png`,
        ),
        thumb: containedPath(roots.cardThumbs, `card_${spec.iconId}_thumb.png`),
        rarity: containedPath(roots.sharedLayers, `cha_rare_sm_${rarityKey(spec.rarity)}.png`),
        type: containedPath(roots.sharedLayers, `cha_type_icon_${elementCode}.png`),
    };
}

export async function composeFirstPartyPortrait(
    spec: PortraitSpec,
    roots: FirstPartyPortraitAssetRoots,
): Promise<Buffer> {
    const paths = resolveFirstPartyPortraitLayerPaths(spec, roots);
    const [background, thumb, rarity, type] = await Promise.all([
        readFile(paths.background),
        readFile(paths.thumb),
        readFile(paths.rarity),
        readFile(paths.type),
    ]);
    return composeFirstPartyPortraitLayers({ background, thumb, rarity, type });
}

export async function composeFirstPartyPortraitLayers(
    layers: FirstPartyPortraitLayerBytes,
): Promise<Buffer> {
    const { background, thumb, rarity, type } = layers;
    const [backgroundLayer, thumbLayer, rarityLayer, typeLayer] = await Promise.all([
        sharp(background).resize({ height: 120 }).png().toBuffer(),
        sharp(thumb).resize({ height: 150 }).png().toBuffer(),
        sharp(rarity).resize({ height: 72 }).png().toBuffer(),
        sharp(type).resize({ height: 57 }).png().toBuffer(),
    ]);
    return sharp({
        create: {
            width: 150,
            height: 150,
            channels: 4,
            background: { r: 0, g: 0, b: 0, alpha: 0 },
        },
    }).composite([
        { input: backgroundLayer, left: 15, top: 15 },
        { input: thumbLayer, left: 0, top: 0 },
        { input: rarityLayer, left: 0, top: 78 },
        { input: typeLayer, left: 93, top: 0 },
    ]).png({ quality: 10, compressionLevel: 6 }).toBuffer();
}
