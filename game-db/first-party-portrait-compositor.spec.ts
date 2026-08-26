import { equal, rejects } from "assert";
import { mkdir, mkdtemp, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { dirname, join } from "path";
import { afterEach, describe, it } from "mocha";
import sharp = require("sharp");
import { Rarities } from "../character";
import {
    composeFirstPartyPortrait,
    resolveFirstPartyPortraitLayerPaths,
} from "./first-party-portrait-compositor";

const temporaryDirectories: string[] = [];

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
        const first = await composeFirstPartyPortrait(spec, { sharedLayers, cardThumbs });
        const second = await composeFirstPartyPortrait(spec, { sharedLayers, cardThumbs });
        equal(first.equals(second), true);
        const metadata = await sharp(first).metadata();
        equal(metadata.width, 150);
        equal(metadata.height, 150);
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
