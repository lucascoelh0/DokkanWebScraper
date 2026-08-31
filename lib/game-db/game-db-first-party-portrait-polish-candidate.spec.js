"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const crypto_1 = require("crypto");
const assert_1 = require("assert");
const promises_1 = require("fs/promises");
const os_1 = require("os");
const path_1 = require("path");
const zlib_1 = require("zlib");
const mocha_1 = require("mocha");
const sharp = require("sharp");
const character_1 = require("../character");
const dataset_artifacts_1 = require("../dataset-artifacts");
const game_db_first_party_portrait_polish_candidate_1 = require("./game-db-first-party-portrait-polish-candidate");
const temporaryDirectories = [];
const sha256 = (bytes) => (0, crypto_1.createHash)("sha256").update(bytes).digest("hex");
(0, mocha_1.afterEach)(async () => {
    for (const directory of temporaryDirectories.splice(0))
        await (0, promises_1.rm)(directory, { recursive: true, force: true });
});
async function png(width, height, color) {
    return sharp({ create: { width, height, channels: 4, background: color } }).png().toBuffer();
}
async function writeObject(root, key, bytes) {
    const path = (0, path_1.join)(root, ...key.split("/"));
    await (0, promises_1.mkdir)((0, path_1.dirname)(path), { recursive: true });
    await (0, promises_1.writeFile)(path, bytes);
}
function character(portraitURL, layers) {
    return {
        id: "1014471", name: "Metal Cooler Army", title: "Fixture", rarity: character_1.Rarities.LR,
        characterClass: character_1.Classes.Extreme, type: character_1.Types.INT, maxLevel: 150, maxSALevel: 20, cost: 1,
        portraitURL, portraitFilename: "portrait_1014471",
        portraitSpec: { iconId: 1014470, frameColorId: 2, rarity: character_1.Rarities.LR, elementCode: "22" },
        portraitLayers: layers, leaderSkill: "", superAttack: "", ultraSuperAttack: "", exSuperAttack: "",
        passive: "", domain: "", links: [], categories: [], kiMeter: [], artURL: "", artFilename: "",
        baseHP: 0, maxLevelHP: 0, freeDupeHP: 0, rainbowHP: 0,
        baseAttack: 0, maxLevelAttack: 0, freeDupeAttack: 0, rainbowAttack: 0,
        baseDefence: 0, maxDefence: 0, freeDupeDefence: 0, rainbowDefence: 0,
        kiMultiplier: "", standbySkill: "", awakeningCards: [], transformations: [],
    };
}
(0, mocha_1.describe)("first-party portrait polish candidate", function () {
    (0, mocha_1.it)("shrinks badge geometry, preserves alpha, and produces a replayable self-contained candidate", async () => {
        this.timeout(20000);
        await (0, promises_1.mkdir)(game_db_first_party_portrait_polish_candidate_1.FIRST_PARTY_PORTRAIT_POLISH_CANDIDATE_ROOT, { recursive: true });
        const inputRoot = await (0, promises_1.mkdtemp)((0, path_1.join)((0, os_1.tmpdir)(), "portrait-polish-input-"));
        const outputRoot = await (0, promises_1.mkdtemp)((0, path_1.join)(game_db_first_party_portrait_polish_candidate_1.FIRST_PARTY_PORTRAIT_POLISH_CANDIDATE_ROOT, "test-"));
        const replayRoot = await (0, promises_1.mkdtemp)((0, path_1.join)(game_db_first_party_portrait_polish_candidate_1.FIRST_PARTY_PORTRAIT_POLISH_CANDIDATE_ROOT, "replay-"));
        temporaryDirectories.push(inputRoot, outputRoot, replayRoot);
        const objectRoot = (0, path_1.join)(inputRoot, "objects");
        const sharedRoot = (0, path_1.join)(inputRoot, "shared");
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
        const rarityPath = (0, path_1.join)(sharedRoot, "cha_rare_sm_lr.png");
        const typePath = (0, path_1.join)(sharedRoot, "cha_type_icon_22.png");
        await (0, promises_1.mkdir)(sharedRoot, { recursive: true });
        await Promise.all([
            (0, promises_1.writeFile)(rarityPath, await png(250, 250, { r: 255, g: 255, b: 0, alpha: 255 })),
            (0, promises_1.writeFile)(typePath, await png(250, 250, { r: 0, g: 255, b: 255, alpha: 255 })),
        ]);
        const artifact = (0, dataset_artifacts_1.buildCharacterDatasetArtifact)([character(portraitKey, layers)], {
            datasetVersion: "2026-08-31T00:00:00.000Z",
            generatedAt: "2026-08-31T00:00:00.000Z",
        });
        const manifestPath = (0, path_1.join)(inputRoot, "characters-manifest.json");
        const payloadPath = (0, path_1.join)(inputRoot, "characters.json.gz");
        await Promise.all([
            (0, promises_1.writeFile)(manifestPath, `${JSON.stringify(artifact.manifest, null, 2)}\n`),
            (0, promises_1.writeFile)(payloadPath, artifact.gzipBuffer),
        ]);
        const options = {
            baselineManifestPath: manifestPath,
            baselinePayloadPath: payloadPath,
            baselineObjectRoot: objectRoot,
            sharedLayersRoot: sharedRoot,
            outputDir: outputRoot,
            generatedAt: "2026-08-31T01:00:00.000Z",
        };
        const result = await (0, game_db_first_party_portrait_polish_candidate_1.buildFirstPartyPortraitPolishCandidate)(options);
        (0, assert_1.equal)(result.portraitCount, 1);
        const report = JSON.parse(await (0, promises_1.readFile)(result.reportPath, "utf8"));
        (0, assert_1.deepEqual)(report.geometry, {
            badgeScale: 0.9,
            rarity: { height: 65, anchor: "bottom-left" },
            classType: { height: 51, anchor: "top-right" },
        });
        (0, assert_1.equal)(report.transparency.thumbsMissingAlpha, 0);
        (0, assert_1.equal)(report.transparency.thumbsWithOpaqueCorners, 0);
        (0, assert_1.equal)(report.transparency.colorKeyRemovalApplied, false);
        (0, assert_1.equal)(report.checks.nonPortraitDataUnchanged, true);
        (0, assert_1.equal)(report.readiness.publication, "NO-GO");
        const outputCharacters = JSON.parse((0, zlib_1.gunzipSync)(await (0, promises_1.readFile)(result.payloadPath)).toString("utf8"));
        (0, assert_1.match)(outputCharacters[0].portraitURL, /^staging\/v2\/images\/v4\/portrait_1014471\.[a-f0-9]{64}\.png$/);
        (0, assert_1.match)(outputCharacters[0].portraitLayers?.overlayURL ?? "", /^staging\/v2\/images\/v5\/layers\/overlay\.[a-f0-9]{64}\.png$/);
        (0, assert_1.equal)(outputCharacters[0].portraitLayers?.backgroundURL, layers.backgroundURL);
        (0, assert_1.equal)(outputCharacters[0].portraitLayers?.thumbURL, layers.thumbURL);
        const overlayPath = (0, path_1.join)(outputRoot, "objects", ...(outputCharacters[0].portraitLayers?.overlayURL ?? "").split("/"));
        const { data } = await sharp(overlayPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
        const alpha = (x, y) => data[(y * 150 + x) * 4 + 3];
        (0, assert_1.equal)(alpha(0, 84), 0);
        (0, assert_1.equal)(alpha(0, 85), 255);
        (0, assert_1.equal)(alpha(98, 0), 0);
        (0, assert_1.equal)(alpha(99, 0), 255);
        const replay = await (0, game_db_first_party_portrait_polish_candidate_1.buildFirstPartyPortraitPolishCandidate)({ ...options, outputDir: replayRoot });
        (0, assert_1.equal)((await (0, promises_1.readFile)(result.payloadPath)).equals(await (0, promises_1.readFile)(replay.payloadPath)), true);
        (0, assert_1.equal)((await (0, promises_1.readFile)(result.manifestPath)).equals(await (0, promises_1.readFile)(replay.manifestPath)), true);
        (0, assert_1.equal)((await (0, promises_1.readFile)(result.reportPath)).equals(await (0, promises_1.readFile)(replay.reportPath)), true);
    });
});
//# sourceMappingURL=game-db-first-party-portrait-polish-candidate.spec.js.map