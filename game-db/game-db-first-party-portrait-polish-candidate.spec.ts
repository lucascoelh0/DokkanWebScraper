import { createHash } from "crypto";
import { deepEqual, equal, match } from "assert";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { dirname, join } from "path";
import { gunzipSync } from "zlib";
import { afterEach, describe, it } from "mocha";
import sharp = require("sharp");
import { Classes, Rarities, Types, type Character } from "../character";
import { buildCharacterDatasetArtifact } from "../dataset-artifacts";
import {
    buildFirstPartyPortraitPolishCandidate,
    FIRST_PARTY_PORTRAIT_POLISH_CANDIDATE_ROOT,
} from "./game-db-first-party-portrait-polish-candidate";

const temporaryDirectories: string[] = [];
const sha256 = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");

afterEach(async () => {
    for (const directory of temporaryDirectories.splice(0)) await rm(directory, { recursive: true, force: true });
});

async function png(width: number, height: number, color: { r: number, g: number, b: number, alpha: number }): Promise<Buffer> {
    return sharp({ create: { width, height, channels: 4, background: color } }).png().toBuffer();
}

async function writeObject(root: string, key: string, bytes: Buffer): Promise<void> {
    const path = join(root, ...key.split("/"));
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, bytes);
}

function character(portraitURL: string, layers: { backgroundURL: string, thumbURL: string, overlayURL: string }): Character {
    return {
        id: "1014471", name: "Metal Cooler Army", title: "Fixture", rarity: Rarities.LR,
        characterClass: Classes.Extreme, type: Types.INT, maxLevel: 150, maxSALevel: 20, cost: 1,
        portraitURL, portraitFilename: "portrait_1014471",
        portraitSpec: { iconId: 1014470, frameColorId: 2, rarity: Rarities.LR, elementCode: "22" },
        portraitLayers: layers, leaderSkill: "", superAttack: "", ultraSuperAttack: "", exSuperAttack: "",
        passive: "", domain: "", links: [], categories: [], kiMeter: [], artURL: "", artFilename: "",
        baseHP: 0, maxLevelHP: 0, freeDupeHP: 0, rainbowHP: 0,
        baseAttack: 0, maxLevelAttack: 0, freeDupeAttack: 0, rainbowAttack: 0,
        baseDefence: 0, maxDefence: 0, freeDupeDefence: 0, rainbowDefence: 0,
        kiMultiplier: "", standbySkill: "", awakeningCards: [], transformations: [],
    };
}

describe("first-party portrait polish candidate", function () {
    it("shrinks badge geometry, preserves alpha, and produces a replayable self-contained candidate", async () => {
        this.timeout(20_000);
        await mkdir(FIRST_PARTY_PORTRAIT_POLISH_CANDIDATE_ROOT, { recursive: true });
        const inputRoot = await mkdtemp(join(tmpdir(), "portrait-polish-input-"));
        const outputRoot = await mkdtemp(join(FIRST_PARTY_PORTRAIT_POLISH_CANDIDATE_ROOT, "test-"));
        const replayRoot = await mkdtemp(join(FIRST_PARTY_PORTRAIT_POLISH_CANDIDATE_ROOT, "replay-"));
        temporaryDirectories.push(inputRoot, outputRoot, replayRoot);
        const objectRoot = join(inputRoot, "objects");
        const sharedRoot = join(inputRoot, "shared");

        const background = await png(150, 150, { r: 80, g: 40, b: 120, alpha: 0.5 });
        const thumb = await sharp({
            create: { width: 150, height: 150, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
        }).composite([{ input: await png(100, 100, { r: 10, g: 20, b: 30, alpha: 255 }), left: 25, top: 25 }])
            .png().toBuffer();
        const legacyOverlay = await png(150, 150, { r: 0, g: 0, b: 0, alpha: 0 });
        const sourcePortrait = await sharp(background).composite([{ input: thumb }, { input: legacyOverlay }]).png().toBuffer();
        const portraitKey = `staging/v2/images/v4/portrait_1014471.${sha256(sourcePortrait)}.png`;
        const layers = {
            backgroundURL: `staging/v2/images/v5/layers/background.${sha256(background)}.png`,
            thumbURL: `staging/v2/images/v5/layers/thumb.${sha256(thumb)}.png`,
            overlayURL: `staging/v2/images/v5/layers/overlay.${sha256(legacyOverlay)}.png`,
        };
        await Promise.all([
            writeObject(objectRoot, portraitKey, sourcePortrait),
            writeObject(objectRoot, layers.backgroundURL, background),
            writeObject(objectRoot, layers.thumbURL, thumb),
            writeObject(objectRoot, layers.overlayURL, legacyOverlay),
        ]);

        const rarityPath = join(sharedRoot, "cha_rare_sm_lr.png");
        const typePath = join(sharedRoot, "cha_type_icon_22.png");
        await mkdir(sharedRoot, { recursive: true });
        await Promise.all([
            writeFile(rarityPath, await png(250, 250, { r: 255, g: 255, b: 0, alpha: 255 })),
            writeFile(typePath, await png(250, 250, { r: 0, g: 255, b: 255, alpha: 255 })),
        ]);

        const artifact = buildCharacterDatasetArtifact([character(portraitKey, layers)], {
            datasetVersion: "2026-08-31T00:00:00.000Z",
            generatedAt: "2026-08-31T00:00:00.000Z",
        });
        const manifestPath = join(inputRoot, "characters-manifest.json");
        const payloadPath = join(inputRoot, "characters.json.gz");
        await Promise.all([
            writeFile(manifestPath, `${JSON.stringify(artifact.manifest, null, 2)}\n`),
            writeFile(payloadPath, artifact.gzipBuffer),
        ]);
        const options = {
            baselineManifestPath: manifestPath,
            baselinePayloadPath: payloadPath,
            baselineObjectRoot: objectRoot,
            sharedLayersRoot: sharedRoot,
            outputDir: outputRoot,
            generatedAt: "2026-08-31T01:00:00.000Z",
        };
        const result = await buildFirstPartyPortraitPolishCandidate(options);
        equal(result.portraitCount, 1);
        const report = JSON.parse(await readFile(result.reportPath, "utf8"));
        deepEqual(report.geometry, {
            badgeScale: 0.9,
            rarity: { height: 65, anchor: "bottom-left" },
            classType: { height: 51, anchor: "top-right" },
        });
        equal(report.transparency.thumbsMissingAlpha, 0);
        equal(report.transparency.thumbsWithOpaqueCorners, 0);
        equal(report.transparency.colorKeyRemovalApplied, false);
        equal(report.checks.nonPortraitDataUnchanged, true);
        equal(report.readiness.publication, "NO-GO");

        const outputCharacters = JSON.parse(gunzipSync(await readFile(result.payloadPath)).toString("utf8")) as Character[];
        match(outputCharacters[0].portraitURL, /^staging\/v2\/images\/v4\/portrait_1014471\.[a-f0-9]{64}\.png$/);
        match(outputCharacters[0].portraitLayers?.overlayURL ?? "", /^staging\/v2\/images\/v5\/layers\/overlay\.[a-f0-9]{64}\.png$/);
        equal(outputCharacters[0].portraitLayers?.backgroundURL, layers.backgroundURL);
        equal(outputCharacters[0].portraitLayers?.thumbURL, layers.thumbURL);
        const overlayPath = join(outputRoot, "objects", ...(outputCharacters[0].portraitLayers?.overlayURL ?? "").split("/"));
        const { data } = await sharp(overlayPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
        const alpha = (x: number, y: number) => data[(y * 150 + x) * 4 + 3];
        equal(alpha(0, 84), 0);
        equal(alpha(0, 85), 255);
        equal(alpha(98, 0), 0);
        equal(alpha(99, 0), 255);

        const replay = await buildFirstPartyPortraitPolishCandidate({ ...options, outputDir: replayRoot });
        equal((await readFile(result.payloadPath)).equals(await readFile(replay.payloadPath)), true);
        equal((await readFile(result.manifestPath)).equals(await readFile(replay.manifestPath)), true);
        equal((await readFile(result.reportPath)).equals(await readFile(replay.reportPath)), true);
    });
});
