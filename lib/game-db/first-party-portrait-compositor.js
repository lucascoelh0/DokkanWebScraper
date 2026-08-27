"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.composeFirstPartyPortraitArtifacts = exports.composeFirstPartyPortraitStaticLayers = exports.composeFirstPartyPortraitLayers = exports.composeFirstPartyPortrait = exports.resolveFirstPartyPortraitLayerPaths = void 0;
const promises_1 = require("fs/promises");
const path_1 = require("path");
const sharp = require("sharp");
const character_1 = require("../character");
const portrait_asset_contract_1 = require("./portrait-asset-contract");
const PORTRAIT_SIZE = 150;
const BACKGROUND_PLACEMENT = { left: 15, top: 15, height: 120 };
const THUMB_PLACEMENT = { left: 0, top: 0, height: 150 };
const RARITY_PLACEMENT = { left: 0, top: 78, height: 72 };
const TYPE_PLACEMENT = { left: 93, top: 0, height: 57 };
const PNG_OPTIONS = { quality: 10, compressionLevel: 6 };
const STATIC_LAYER_PNG_OPTIONS = { compressionLevel: 6, palette: false };
function rarityNumber(rarity) {
    switch (rarity) {
        case character_1.Rarities.N: return 0;
        case character_1.Rarities.R: return 1;
        case character_1.Rarities.SR: return 2;
        case character_1.Rarities.SSR: return 3;
        case character_1.Rarities.UR: return 4;
        case character_1.Rarities.LR: return 5;
        default: throw new Error("portrait has an unsupported rarity");
    }
}
function rarityKey(rarity) {
    return rarity.toLowerCase();
}
function containedPath(root, ...parts) {
    const canonicalRoot = (0, path_1.resolve)(root);
    const target = (0, path_1.resolve)(canonicalRoot, ...parts);
    const child = (0, path_1.relative)(canonicalRoot, target);
    if (!child || child === ".." || child.startsWith(`..${path_1.sep}`) || (0, path_1.isAbsolute)(child)) {
        throw new Error("official portrait asset path escaped its root");
    }
    return target;
}
function resolveFirstPartyPortraitLayerPaths(spec, roots) {
    if (!Number.isSafeInteger(spec.iconId) || spec.iconId <= 0 || spec.iconId % 10 !== 0) {
        throw new Error("portrait has an invalid normalized icon ID");
    }
    if (!Number.isSafeInteger(spec.frameColorId) || spec.frameColorId < 0 || spec.frameColorId > 4) {
        throw new Error("portrait has an invalid frame color ID");
    }
    const elementCode = (0, portrait_asset_contract_1.normalizePortraitElementCode)(spec.elementCode);
    const rarity = rarityNumber(spec.rarity);
    return {
        background: containedPath(roots.sharedLayers, "character_thumb_bg", `cha_base_0${spec.frameColorId}_0${rarity}.png`),
        thumb: containedPath(roots.cardThumbs, `card_${spec.iconId}_thumb.png`),
        rarity: containedPath(roots.sharedLayers, `cha_rare_sm_${rarityKey(spec.rarity)}.png`),
        type: containedPath(roots.sharedLayers, `cha_type_icon_${elementCode}.png`),
    };
}
exports.resolveFirstPartyPortraitLayerPaths = resolveFirstPartyPortraitLayerPaths;
async function composeFirstPartyPortrait(spec, roots) {
    const paths = resolveFirstPartyPortraitLayerPaths(spec, roots);
    const [background, thumb, rarity, type] = await Promise.all([
        (0, promises_1.readFile)(paths.background),
        (0, promises_1.readFile)(paths.thumb),
        (0, promises_1.readFile)(paths.rarity),
        (0, promises_1.readFile)(paths.type),
    ]);
    return composeFirstPartyPortraitLayers({ background, thumb, rarity, type });
}
exports.composeFirstPartyPortrait = composeFirstPartyPortrait;
async function composeFirstPartyPortraitLayers(layers) {
    return (await composeFirstPartyPortraitArtifacts(layers)).portrait;
}
exports.composeFirstPartyPortraitLayers = composeFirstPartyPortraitLayers;
async function composeFirstPartyPortraitStaticLayers(layers) {
    return (await composeFirstPartyPortraitArtifacts(layers)).portraitLayers;
}
exports.composeFirstPartyPortraitStaticLayers = composeFirstPartyPortraitStaticLayers;
async function resizePortraitLayers(layers) {
    const { background, thumb, rarity, type } = layers;
    const [backgroundLayer, thumbLayer, rarityLayer, typeLayer] = await Promise.all([
        sharp(background).resize({ height: BACKGROUND_PLACEMENT.height }).png().toBuffer(),
        sharp(thumb).resize({ height: THUMB_PLACEMENT.height }).png().toBuffer(),
        sharp(rarity).resize({ height: RARITY_PLACEMENT.height }).png().toBuffer(),
        sharp(type).resize({ height: TYPE_PLACEMENT.height }).png().toBuffer(),
    ]);
    return { background: backgroundLayer, thumb: thumbLayer, rarity: rarityLayer, type: typeLayer };
}
async function transparentPortraitCanvas(inputs, preserveAlpha) {
    let pipeline = sharp({
        create: {
            width: PORTRAIT_SIZE,
            height: PORTRAIT_SIZE,
            channels: 4,
            background: { r: 0, g: 0, b: 0, alpha: 0 },
        },
    }).composite(inputs);
    if (preserveAlpha)
        pipeline = pipeline.ensureAlpha();
    return pipeline.png(preserveAlpha ? STATIC_LAYER_PNG_OPTIONS : PNG_OPTIONS).toBuffer();
}
async function transparentPng(bytes) {
    return sharp(bytes).ensureAlpha().png(STATIC_LAYER_PNG_OPTIONS).toBuffer();
}
async function composeFirstPartyPortraitArtifacts(layers) {
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
exports.composeFirstPartyPortraitArtifacts = composeFirstPartyPortraitArtifacts;
//# sourceMappingURL=first-party-portrait-compositor.js.map