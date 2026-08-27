import { deepEqual, equal, rejects } from "assert";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { dirname, join } from "path";
import { afterEach, describe, it } from "mocha";
import sharp = require("sharp");
import { Rarities } from "../character";
import {
    composeFirstPartyPortrait,
    composeFirstPartyPortraitArtifacts,
    resolveFirstPartyPortraitLayerPaths,
} from "./first-party-portrait-compositor";

const temporaryDirectories: string[] = [];

async function rgbaAt(bytes: Buffer, x: number, y: number): Promise<number[]> {
    const { data, info } = await sharp(bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const offset = (y * info.width + x) * 4;
    return [...data.subarray(offset, offset + 4)];
}

afterEach(async () => {
    for (const directory of temporaryDirectories.splice(0)) {
        await rm(directory, { recursive: true, force: true });
    }
});

describe("first-party portrait compositor", function () {
    it("resolves exact official class, rarity, frame and thumb layers", () => {
        const paths = resolveFirstPartyPortraitLayerPaths({
            iconId: 1014470,
            frameColorId: 2,
            rarity: Rarities.LR,
            elementCode: "22",
        }, { sharedLayers: "C:/official/shared", cardThumbs: "C:/official/thumbs" });
        equal(paths.background.endsWith(join("character_thumb_bg", "cha_base_02_05.png")), true);
        equal(paths.thumb.endsWith("card_1014470_thumb.png"), true);
        equal(paths.rarity.endsWith("cha_rare_sm_lr.png"), true);
        equal(paths.type.endsWith("cha_type_icon_22.png"), true);
    });

    it("composes a deterministic 150px portrait from explicit local official layers", async () => {
        const root = await mkdtemp(join(tmpdir(), "dokkan-official-portrait-test-"));
        temporaryDirectories.push(root);
        const sharedLayers = join(root, "shared");
        const cardThumbs = join(root, "thumbs");
        const spec = { iconId: 1014470, frameColorId: 2, rarity: Rarities.LR, elementCode: "22" };
        const paths = resolveFirstPartyPortraitLayerPaths(spec, { sharedLayers, cardThumbs });
        for (const [path, width, height, color] of [
            [paths.background, 200, 200, "#663399"],
            [paths.thumb, 250, 250, "#00808080"],
            [paths.rarity, 60, 60, "#ffff00"],
            [paths.type, 130, 130, "#00ffff"],
        ] as const) {
            await mkdir(dirname(path), { recursive: true });
            await writeFile(path, await sharp({
                create: { width, height, channels: 4, background: color },
            }).png().toBuffer());
        }
        const sourceLayers = {
            background: await readFile(paths.background),
            thumb: await readFile(paths.thumb),
            rarity: await readFile(paths.rarity),
            type: await readFile(paths.type),
        };
        const firstArtifacts = await composeFirstPartyPortraitArtifacts(sourceLayers);
        const secondArtifacts = await composeFirstPartyPortraitArtifacts(sourceLayers);
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
        const first = await composeFirstPartyPortrait(spec, { sharedLayers, cardThumbs });
        equal(first.equals(firstArtifacts.portrait), true);
        equal(firstArtifacts.portrait.equals(legacyCombined), true);
        equal(firstArtifacts.portrait.equals(secondArtifacts.portrait), true);
        for (const kind of ["background", "thumb", "overlay"] as const) {
            equal(firstArtifacts.portraitLayers[kind].equals(secondArtifacts.portraitLayers[kind]), true);
            const layerMetadata = await sharp(firstArtifacts.portraitLayers[kind]).metadata();
            equal(layerMetadata.width, 150);
            equal(layerMetadata.height, 150);
            equal(layerMetadata.channels, 4);
            equal(layerMetadata.hasAlpha, true);
        }
        const metadata = await sharp(firstArtifacts.portrait).metadata();
        equal(metadata.width, 150);
        equal(metadata.height, 150);

        equal((await rgbaAt(firstArtifacts.portraitLayers.background, 14, 15))[3], 0);
        deepEqual(await rgbaAt(firstArtifacts.portraitLayers.background, 15, 15), [102, 51, 153, 255]);
        deepEqual(await rgbaAt(firstArtifacts.portraitLayers.background, 134, 134), [102, 51, 153, 255]);
        equal((await rgbaAt(firstArtifacts.portraitLayers.background, 135, 134))[3], 0);
        deepEqual(await rgbaAt(firstArtifacts.portraitLayers.thumb, 0, 0), [0, 127, 127, 128]);
        deepEqual(await rgbaAt(firstArtifacts.portraitLayers.thumb, 149, 149), [0, 127, 127, 128]);
        deepEqual(await rgbaAt(firstArtifacts.portraitLayers.overlay, 0, 78), [255, 255, 0, 255]);
        deepEqual(await rgbaAt(firstArtifacts.portraitLayers.overlay, 71, 149), [255, 255, 0, 255]);
        deepEqual(await rgbaAt(firstArtifacts.portraitLayers.overlay, 93, 0), [0, 255, 255, 255]);
        deepEqual(await rgbaAt(firstArtifacts.portraitLayers.overlay, 149, 56), [0, 255, 255, 255]);
        equal((await rgbaAt(firstArtifacts.portraitLayers.overlay, 92, 0))[3], 0);
    });

    it("rejects invalid layer identities before reading files", async () => {
        await rejects(
            () => composeFirstPartyPortrait({
                iconId: 1014471,
                frameColorId: 2,
                rarity: Rarities.LR,
                elementCode: "22",
            }, { sharedLayers: "C:/official/shared", cardThumbs: "C:/official/thumbs" }),
            /invalid normalized icon ID/,
        );
    });
});
