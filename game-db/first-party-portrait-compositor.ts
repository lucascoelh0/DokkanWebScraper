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

export interface FirstPartyPortraitStaticLayers {
    background: Buffer,
    thumb: Buffer,
    overlay: Buffer,
}

export interface FirstPartyPortraitArtifacts {
    portrait: Buffer,
    portraitLayers: FirstPartyPortraitStaticLayers,
}

interface ResizedPortraitLayers {
    background: Buffer,
    thumb: Buffer,
    rarity: Buffer,
    type: Buffer,
}

const PORTRAIT_SIZE = 150;
const BACKGROUND_PLACEMENT = { left: 15, top: 15, height: 120 } as const;
const THUMB_PLACEMENT = { left: 0, top: 0, height: 150 } as const;
const RARITY_PLACEMENT = { left: 0, top: 78, height: 72 } as const;
const TYPE_PLACEMENT = { left: 93, top: 0, height: 57 } as const;
const PNG_OPTIONS = { quality: 10, compressionLevel: 6 } as const;
const STATIC_LAYER_PNG_OPTIONS = { compressionLevel: 6, palette: false } as const;

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
    return (await composeFirstPartyPortraitArtifacts(layers)).portrait;
}

export async function composeFirstPartyPortraitStaticLayers(
    layers: FirstPartyPortraitLayerBytes,
): Promise<FirstPartyPortraitStaticLayers> {
    return (await composeFirstPartyPortraitArtifacts(layers)).portraitLayers;
}

async function resizePortraitLayers(layers: FirstPartyPortraitLayerBytes): Promise<ResizedPortraitLayers> {
    const { background, thumb, rarity, type } = layers;
    const [backgroundLayer, thumbLayer, rarityLayer, typeLayer] = await Promise.all([
        sharp(background).resize({ height: BACKGROUND_PLACEMENT.height }).png().toBuffer(),
        sharp(thumb).resize({ height: THUMB_PLACEMENT.height }).png().toBuffer(),
        sharp(rarity).resize({ height: RARITY_PLACEMENT.height }).png().toBuffer(),
        sharp(type).resize({ height: TYPE_PLACEMENT.height }).png().toBuffer(),
    ]);
    return { background: backgroundLayer, thumb: thumbLayer, rarity: rarityLayer, type: typeLayer };
}

async function transparentPortraitCanvas(
    inputs: Array<{ input: Buffer, left: number, top: number }>,
    preserveAlpha: boolean,
): Promise<Buffer> {
    let pipeline = sharp({
        create: {
            width: PORTRAIT_SIZE,
            height: PORTRAIT_SIZE,
            channels: 4,
            background: { r: 0, g: 0, b: 0, alpha: 0 },
        },
    }).composite(inputs);
    if (preserveAlpha) pipeline = pipeline.ensureAlpha();
    return pipeline.png(preserveAlpha ? STATIC_LAYER_PNG_OPTIONS : PNG_OPTIONS).toBuffer();
}

async function transparentPng(bytes: Buffer): Promise<Buffer> {
    return sharp(bytes).ensureAlpha().png(STATIC_LAYER_PNG_OPTIONS).toBuffer();
}

export async function composeFirstPartyPortraitArtifacts(
    layers: FirstPartyPortraitLayerBytes,
): Promise<FirstPartyPortraitArtifacts> {
    const resized = await resizePortraitLayers(layers);
    const [portrait, background, thumb, overlay] = await Promise.all([
        transparentPortraitCanvas([
            { input: resized.background, left: BACKGROUND_PLACEMENT.left, top: BACKGROUND_PLACEMENT.top },
            { input: resized.thumb, left: THUMB_PLACEMENT.left, top: THUMB_PLACEMENT.top },
            { input: resized.rarity, left: RARITY_PLACEMENT.left, top: RARITY_PLACEMENT.top },
            { input: resized.type, left: TYPE_PLACEMENT.left, top: TYPE_PLACEMENT.top },
        ], false),
        transparentPortraitCanvas([
            { input: resized.background, left: BACKGROUND_PLACEMENT.left, top: BACKGROUND_PLACEMENT.top },
        ], true),
        transparentPng(resized.thumb),
        transparentPortraitCanvas([
            { input: resized.rarity, left: RARITY_PLACEMENT.left, top: RARITY_PLACEMENT.top },
            { input: resized.type, left: TYPE_PLACEMENT.left, top: TYPE_PLACEMENT.top },
        ], true),
    ]);
    return { portrait, portraitLayers: { background, thumb, overlay } };
}
