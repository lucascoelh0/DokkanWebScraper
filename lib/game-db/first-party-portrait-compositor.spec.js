"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = require("assert");
const promises_1 = require("fs/promises");
const os_1 = require("os");
const path_1 = require("path");
const mocha_1 = require("mocha");
const sharp = require("sharp");
const character_1 = require("../character");
const first_party_portrait_compositor_1 = require("./first-party-portrait-compositor");
const temporaryDirectories = [];
async function rgbaAt(bytes, x, y) {
    const { data, info } = await sharp(bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const offset = (y * info.width + x) * 4;
    return [...data.subarray(offset, offset + 4)];
}
(0, mocha_1.afterEach)(async () => {
    for (const directory of temporaryDirectories.splice(0)) {
        await (0, promises_1.rm)(directory, { recursive: true, force: true });
    }
});
(0, mocha_1.describe)("first-party portrait compositor", function () {
    (0, mocha_1.it)("resolves exact official class, rarity, frame and thumb layers", () => {
        const paths = (0, first_party_portrait_compositor_1.resolveFirstPartyPortraitLayerPaths)({
            iconId: 1014470,
            frameColorId: 2,
            rarity: character_1.Rarities.LR,
            elementCode: "22",
        }, { sharedLayers: "C:/official/shared", cardThumbs: "C:/official/thumbs" });
        (0, assert_1.equal)(paths.background.endsWith((0, path_1.join)("character_thumb_bg", "cha_base_02_05.png")), true);
        (0, assert_1.equal)(paths.thumb.endsWith("card_1014470_thumb.png"), true);
        (0, assert_1.equal)(paths.rarity.endsWith("cha_rare_sm_lr.png"), true);
        (0, assert_1.equal)(paths.type.endsWith("cha_type_icon_22.png"), true);
    });
    (0, mocha_1.it)("composes a deterministic 150px portrait from explicit local official layers", async () => {
        const root = await (0, promises_1.mkdtemp)((0, path_1.join)((0, os_1.tmpdir)(), "dokkan-official-portrait-test-"));
        temporaryDirectories.push(root);
        const sharedLayers = (0, path_1.join)(root, "shared");
        const cardThumbs = (0, path_1.join)(root, "thumbs");
        const spec = { iconId: 1014470, frameColorId: 2, rarity: character_1.Rarities.LR, elementCode: "22" };
        const paths = (0, first_party_portrait_compositor_1.resolveFirstPartyPortraitLayerPaths)(spec, { sharedLayers, cardThumbs });
        for (const [path, width, height, color] of [
            [paths.background, 200, 200, "#663399"],
            [paths.thumb, 250, 250, "#00808080"],
            [paths.rarity, 60, 60, "#ffff00"],
            [paths.type, 130, 130, "#00ffff"],
        ]) {
            await (0, promises_1.mkdir)((0, path_1.dirname)(path), { recursive: true });
            await (0, promises_1.writeFile)(path, await sharp({
                create: { width, height, channels: 4, background: color },
            }).png().toBuffer());
        }
        const sourceLayers = {
            background: await (0, promises_1.readFile)(paths.background),
            thumb: await (0, promises_1.readFile)(paths.thumb),
            rarity: await (0, promises_1.readFile)(paths.rarity),
            type: await (0, promises_1.readFile)(paths.type),
        };
        const firstArtifacts = await (0, first_party_portrait_compositor_1.composeFirstPartyPortraitArtifacts)(sourceLayers);
        const secondArtifacts = await (0, first_party_portrait_compositor_1.composeFirstPartyPortraitArtifacts)(sourceLayers);
        const [legacyBackground, legacyThumb, legacyRarity, legacyType] = await Promise.all([
            sharp(sourceLayers.background).resize({ height: 120 }).png().toBuffer(),
            sharp(sourceLayers.thumb).resize({ height: 150 }).png().toBuffer(),
            sharp(sourceLayers.rarity).resize({ height: 72 }).png().toBuffer(),
            sharp(sourceLayers.type).resize({ height: 57 }).png().toBuffer(),
        ]);
        const legacyCombined = await sharp({
            create: {
                width: 150,
                height: 150,
                channels: 4,
                background: { r: 0, g: 0, b: 0, alpha: 0 },
            },
        }).composite([
            { input: legacyBackground, left: 15, top: 15 },
            { input: legacyThumb, left: 0, top: 0 },
            { input: legacyRarity, left: 0, top: 78 },
            { input: legacyType, left: 93, top: 0 },
        ]).png({ quality: 10, compressionLevel: 6 }).toBuffer();
        const first = await (0, first_party_portrait_compositor_1.composeFirstPartyPortrait)(spec, { sharedLayers, cardThumbs });
        (0, assert_1.equal)(first.equals(firstArtifacts.portrait), true);
        (0, assert_1.equal)(firstArtifacts.portrait.equals(legacyCombined), false);
        (0, assert_1.equal)(firstArtifacts.portrait.equals(secondArtifacts.portrait), true);
        for (const kind of ["background", "thumb", "overlay"]) {
            (0, assert_1.equal)(firstArtifacts.portraitLayers[kind].equals(secondArtifacts.portraitLayers[kind]), true);
            const layerMetadata = await sharp(firstArtifacts.portraitLayers[kind]).metadata();
            (0, assert_1.equal)(layerMetadata.width, 150);
            (0, assert_1.equal)(layerMetadata.height, 150);
            (0, assert_1.equal)(layerMetadata.channels, 4);
            (0, assert_1.equal)(layerMetadata.hasAlpha, true);
        }
        const metadata = await sharp(firstArtifacts.portrait).metadata();
        (0, assert_1.equal)(metadata.width, 150);
        (0, assert_1.equal)(metadata.height, 150);
        (0, assert_1.equal)(metadata.channels, 4);
        (0, assert_1.equal)(metadata.hasAlpha, true);
        (0, assert_1.equal)((await rgbaAt(firstArtifacts.portraitLayers.background, 14, 15))[3], 0);
        (0, assert_1.deepEqual)(await rgbaAt(firstArtifacts.portraitLayers.background, 15, 15), [102, 51, 153, 255]);
        (0, assert_1.deepEqual)(await rgbaAt(firstArtifacts.portraitLayers.background, 134, 134), [102, 51, 153, 255]);
        (0, assert_1.equal)((await rgbaAt(firstArtifacts.portraitLayers.background, 135, 134))[3], 0);
        (0, assert_1.deepEqual)(await rgbaAt(firstArtifacts.portraitLayers.thumb, 0, 0), [0, 127, 127, 128]);
        (0, assert_1.deepEqual)(await rgbaAt(firstArtifacts.portraitLayers.thumb, 149, 149), [0, 127, 127, 128]);
        (0, assert_1.deepEqual)(await rgbaAt(firstArtifacts.portraitLayers.overlay, 0, 85), [255, 255, 0, 255]);
        (0, assert_1.deepEqual)(await rgbaAt(firstArtifacts.portraitLayers.overlay, 64, 149), [255, 255, 0, 255]);
        (0, assert_1.deepEqual)(await rgbaAt(firstArtifacts.portraitLayers.overlay, 99, 0), [0, 255, 255, 255]);
        (0, assert_1.deepEqual)(await rgbaAt(firstArtifacts.portraitLayers.overlay, 149, 50), [0, 255, 255, 255]);
        (0, assert_1.equal)((await rgbaAt(firstArtifacts.portraitLayers.overlay, 98, 0))[3], 0);
        (0, assert_1.equal)((await rgbaAt(firstArtifacts.portraitLayers.overlay, 0, 84))[3], 0);
    });
    (0, mocha_1.it)("rejects invalid layer identities before reading files", async () => {
        await (0, assert_1.rejects)(() => (0, first_party_portrait_compositor_1.composeFirstPartyPortrait)({
            iconId: 1014471,
            frameColorId: 2,
            rarity: character_1.Rarities.LR,
            elementCode: "22",
        }, { sharedLayers: "C:/official/shared", cardThumbs: "C:/official/thumbs" }), /invalid normalized icon ID/);
    });
});
//# sourceMappingURL=first-party-portrait-compositor.spec.js.map