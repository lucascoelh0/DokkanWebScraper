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
const first_party_portrait_compositor_1 = require("./first-party-portrait-compositor");
const game_db_first_party_portrait_candidate_1 = require("./game-db-first-party-portrait-candidate");
const temporaryDirectories = [];
const hash = (bytes) => (0, crypto_1.createHash)("sha256").update(bytes).digest("hex");
(0, mocha_1.afterEach)(async () => {
    for (const directory of temporaryDirectories.splice(0))
        await (0, promises_1.rm)(directory, { recursive: true, force: true });
});
function fixtureCharacter() {
    return {
        id: "1015830",
        name: "Shared Super",
        title: "Fixture",
        rarity: character_1.Rarities.SSR,
        characterClass: character_1.Classes.Super,
        type: character_1.Types.PHY,
        maxLevel: 80,
        maxSALevel: 10,
        cost: 1,
        portraitURL: "images/v3/portrait_1015830.old.png",
        portraitFilename: "portrait_1015830",
        portraitSpec: { iconId: 1015830, frameColorId: 4, rarity: character_1.Rarities.SSR, elementCode: "14" },
        leaderSkill: "",
        superAttack: "",
        ultraSuperAttack: "",
        exSuperAttack: "",
        passive: "",
        domain: "",
        links: [],
        categories: [],
        kiMeter: [],
        artURL: "",
        artFilename: "art_1015830",
        baseHP: 0,
        maxLevelHP: 0,
        freeDupeHP: 0,
        rainbowHP: 0,
        baseAttack: 0,
        maxLevelAttack: 0,
        freeDupeAttack: 0,
        rainbowAttack: 0,
        baseDefence: 0,
        maxDefence: 0,
        freeDupeDefence: 0,
        rainbowDefence: 0,
        kiMultiplier: "",
        standbySkill: "",
        awakeningCards: [{
                id: "1015850",
                name: "Shared Super Awakening",
                rarity: character_1.Rarities.SSR,
                characterClass: character_1.Classes.Super,
                type: character_1.Types.PHY,
                portraitURL: "images/v3/portrait_1015850.old.png",
                portraitSpec: { iconId: 1015820, frameColorId: 4, rarity: character_1.Rarities.SSR, elementCode: "14" },
                artURL: "",
            }],
        transformations: [{
                id: "1015841",
                baseCharacterId: "1015830",
                name: "Shared Extreme",
                characterClass: character_1.Classes.Extreme,
                type: character_1.Types.PHY,
                superAttack: "",
                ultraSuperAttack: "",
                exSuperAttack: "",
                passive: "",
                activeSkill: "",
                activeSkillCondition: "",
                domain: "",
                links: [],
                portraitURL: "images/v3/portrait_1015841.old.png",
                portraitFilename: "portrait_1015841",
                portraitSpec: { iconId: 1015840, frameColorId: 4, rarity: character_1.Rarities.UR, elementCode: "14" },
                artURL: "",
                artFilename: "art_1015841",
                finishingMove: [],
            }],
    };
}
async function writePng(path, color) {
    await (0, promises_1.mkdir)((0, path_1.dirname)(path), { recursive: true });
    const fill = await sharp({
        create: { width: 200, height: 200, channels: 4, background: color },
    }).png().toBuffer();
    await (0, promises_1.writeFile)(path, await sharp({
        create: { width: 250, height: 250, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
    }).composite([{ input: fill, left: 25, top: 25 }]).png().toBuffer());
}
async function inventory(entries) {
    const unique = new Map(entries.map(entry => [entry.path, entry.absolutePath]));
    const identities = await Promise.all([...unique]
        .sort(([left], [right]) => left.localeCompare(right, undefined, { numeric: true }))
        .map(async ([path, absolutePath]) => {
        const bytes = await (0, promises_1.readFile)(absolutePath);
        return { path, sizeBytes: bytes.length, sha256: hash(bytes) };
    }));
    return {
        fileCount: identities.length,
        totalBytes: identities.reduce((total, entry) => total + entry.sizeBytes, 0),
        sha256: hash(Buffer.from(`${JSON.stringify(identities, null, 2)}\n`, "utf8")),
    };
}
(0, mocha_1.describe)("first-party portrait staging candidate", function () {
    (0, mocha_1.it)("deduplicates official shared thumbs while producing class-specific content-addressed portraits", async () => {
        this.timeout(20000);
        const root = await (0, promises_1.mkdtemp)((0, path_1.join)((0, os_1.tmpdir)(), "dokkan-portrait-candidate-test-"));
        temporaryDirectories.push(root);
        const baselineDir = (0, path_1.join)(root, "baseline");
        const firstPartyDir = (0, path_1.join)(root, "first-party");
        const cpkBundleRoot = (0, path_1.join)(root, "cpk-bundle");
        const sharedLayersRoot = (0, path_1.join)(root, "extracted", "shared");
        const cardThumbsRoot = (0, path_1.join)(root, "extracted", "thumbs");
        const outputDir = (0, path_1.join)(root, "candidate");
        await (0, promises_1.mkdir)((0, path_1.join)(firstPartyDir, "data"), { recursive: true });
        await (0, promises_1.mkdir)((0, path_1.join)(cpkBundleRoot, "thumbs"), { recursive: true });
        await (0, promises_1.mkdir)(baselineDir, { recursive: true });
        const baseline = (0, dataset_artifacts_1.buildCharacterDatasetArtifact)([fixtureCharacter()], {
            datasetVersion: "2026-08-26T00:00:00.000Z",
            generatedAt: "2026-08-26T00:00:00.000Z",
        });
        const cardsCsv = Buffer.from([
            "id,name,rarity,element,resource_id",
            "1015830,Shared Super,3,14,1015820",
            "1015841,Shared Extreme,4,24,1015821",
            "1015850,Shared Super Awakening,3,14,1015822",
            "",
        ].join("\n"), "utf8");
        await Promise.all([
            (0, promises_1.writeFile)((0, path_1.join)(baselineDir, "characters.json.gz"), baseline.gzipBuffer),
            (0, promises_1.writeFile)((0, path_1.join)(baselineDir, "characters-manifest.json"), `${JSON.stringify(baseline.manifest, null, 2)}\n`),
            (0, promises_1.writeFile)((0, path_1.join)(firstPartyDir, "metadata.json"), `${JSON.stringify({
                source: "first-party-export", region: "global", dbVersion: "1", assetVersion: "2", apkVersion: "6.5.0",
            })}\n`),
            (0, promises_1.writeFile)((0, path_1.join)(firstPartyDir, "data", "cards.csv"), cardsCsv),
            (0, promises_1.writeFile)((0, path_1.join)(cpkBundleRoot, "character.cpk"), "shared-cpk"),
            (0, promises_1.writeFile)((0, path_1.join)(cpkBundleRoot, "thumbs", "card_1015820_thumb.cpk"), "thumb-cpk"),
        ]);
        const extractedEntries = [];
        for (const spec of [
            { iconId: 1015820, frameColorId: 4, rarity: character_1.Rarities.SSR, elementCode: "14" },
            { iconId: 1015820, frameColorId: 4, rarity: character_1.Rarities.UR, elementCode: "24" },
        ]) {
            const paths = (0, first_party_portrait_compositor_1.resolveFirstPartyPortraitLayerPaths)(spec, {
                sharedLayers: sharedLayersRoot,
                cardThumbs: cardThumbsRoot,
            });
            await writePng(paths.background, "#222222");
            await writePng(paths.thumb, "#555555");
            await writePng(paths.rarity, spec.rarity === character_1.Rarities.SSR ? "#ffff00" : "#ff00ff");
            await writePng(paths.type, spec.elementCode === "14" ? "#00ff00" : "#ff0000");
            for (const [kind, path] of Object.entries(paths)) {
                const assetRoot = kind === "thumb" ? cardThumbsRoot : sharedLayersRoot;
                extractedEntries.push({ path: `${kind}/${(0, path_1.relative)(assetRoot, path).replace(/\\/g, "/")}`, absolutePath: path });
            }
        }
        const archive = Buffer.from("official-asset-archive");
        const baseApk = Buffer.from("official-base-apk");
        const archivePath = (0, path_1.join)(root, "official-assets.tar");
        const baseApkPath = (0, path_1.join)(root, "base.apk");
        const provenancePath = (0, path_1.join)(root, "provenance.json");
        const cpkInventory = await inventory([
            { path: "character.cpk", absolutePath: (0, path_1.join)(cpkBundleRoot, "character.cpk") },
            { path: "thumbs/card_1015820_thumb.cpk", absolutePath: (0, path_1.join)(cpkBundleRoot, "thumbs", "card_1015820_thumb.cpk") },
        ]);
        const extractedLayerInventory = await inventory(extractedEntries);
        await (0, promises_1.writeFile)(archivePath, archive);
        await (0, promises_1.writeFile)(baseApkPath, baseApk);
        const provenance = {
            schemaVersion: 1,
            contract: game_db_first_party_portrait_candidate_1.FIRST_PARTY_PORTRAIT_SOURCE_CONTRACT,
            contractVersion: "1.0.0",
            packageName: "com.bandainamcogames.dbzdokkanww",
            packageVersionName: "6.5.0",
            packageVersionCode: 342,
            baseApk: { sizeBytes: baseApk.length, sha256: hash(baseApk) },
            gameDb: {
                region: "global", dbVersion: "1", assetVersion: "2", apkVersion: "6.5.0",
                cardsCsv: { sizeBytes: cardsCsv.length, sha256: hash(cardsCsv) },
            },
            assetArchive: { sizeBytes: archive.length, sha256: hash(archive) },
            cpkInventory,
            extractedLayerInventory,
            cpkReader: { repository: "https://example.test/cpk", commit: "b".repeat(40) },
        };
        await (0, promises_1.writeFile)(provenancePath, `${JSON.stringify(provenance, null, 2)}\n`);
        const candidateOptions = {
            baselineManifestPath: (0, path_1.join)(baselineDir, "characters-manifest.json"),
            baselinePayloadPath: (0, path_1.join)(baselineDir, "characters.json.gz"),
            firstPartyDir,
            baseApkPath,
            assetArchivePath: archivePath,
            cpkBundleRoot,
            sharedLayersRoot,
            cardThumbsRoot,
            assetProvenancePath: provenancePath,
            outputDir,
            generatedAt: "2026-08-26T01:00:00.000Z",
        };
        const wrongBaseApkPath = (0, path_1.join)(root, "wrong-base.apk");
        await (0, promises_1.writeFile)(wrongBaseApkPath, "wrong-official-base-apk");
        await (0, assert_1.rejects)((0, game_db_first_party_portrait_candidate_1.buildFirstPartyPortraitCandidate)({
            ...candidateOptions,
            baseApkPath: wrongBaseApkPath,
            outputDir: (0, path_1.join)(root, "rejected-apk"),
        }), /official base APK identity rejected/);
        await (0, promises_1.writeFile)(provenancePath, `${JSON.stringify({
            ...provenance,
            packageVersionName: "6.5.1",
        }, null, 2)}\n`);
        await (0, assert_1.rejects)((0, game_db_first_party_portrait_candidate_1.buildFirstPartyPortraitCandidate)({ ...candidateOptions, outputDir: (0, path_1.join)(root, "rejected-version-lineage") }), /official portrait source APK version lineage rejected/);
        await (0, promises_1.writeFile)(provenancePath, `${JSON.stringify(provenance, null, 2)}\n`);
        await (0, promises_1.writeFile)((0, path_1.join)(firstPartyDir, "data", "cards.csv"), Buffer.concat([cardsCsv, Buffer.from("\n")]));
        await (0, assert_1.rejects)((0, game_db_first_party_portrait_candidate_1.buildFirstPartyPortraitCandidate)({ ...candidateOptions, outputDir: (0, path_1.join)(root, "rejected-db") }), /portrait candidate DB source identity rejected/);
        await (0, promises_1.writeFile)((0, path_1.join)(firstPartyDir, "data", "cards.csv"), cardsCsv);
        const thumbPath = (0, first_party_portrait_compositor_1.resolveFirstPartyPortraitLayerPaths)({
            iconId: 1015820,
            frameColorId: 4,
            rarity: character_1.Rarities.SSR,
            elementCode: "14",
        }, { sharedLayers: sharedLayersRoot, cardThumbs: cardThumbsRoot }).thumb;
        const thumbBytes = await (0, promises_1.readFile)(thumbPath);
        await writePng(thumbPath, "#777777");
        await (0, assert_1.rejects)((0, game_db_first_party_portrait_candidate_1.buildFirstPartyPortraitCandidate)({ ...candidateOptions, outputDir: (0, path_1.join)(root, "rejected-layers") }), /official extracted-layer inventory provenance rejected/);
        await (0, promises_1.writeFile)(thumbPath, thumbBytes);
        const result = await (0, game_db_first_party_portrait_candidate_1.buildFirstPartyPortraitCandidate)(candidateOptions);
        (0, assert_1.equal)(result.portraitCount, 3);
        (0, assert_1.equal)(result.portraitLayerObjectCount, 4);
        (0, assert_1.equal)(result.portraitLayerProjectedBytes > 0, true);
        const report = JSON.parse(await (0, promises_1.readFile)(result.reportPath, "utf8"));
        (0, assert_1.equal)(report.contractVersion, "1.2.0");
        (0, assert_1.equal)(report.portraits.uniqueThumbAssetCount, 1);
        (0, assert_1.equal)(report.portraitLayers.referenceCount, 3);
        (0, assert_1.equal)(report.portraitLayers.uniqueObjectCount, 4);
        (0, assert_1.equal)(report.portraitLayers.backgroundObjectCount, 1);
        (0, assert_1.equal)(report.portraitLayers.thumbObjectCount, 1);
        (0, assert_1.equal)(report.portraitLayers.overlayObjectCount, 2);
        (0, assert_1.equal)(report.portraitLayers.projectedBytes, result.portraitLayerProjectedBytes);
        (0, assert_1.equal)(Object.values(report.portraitLayers.projectedBytesByKind)
            .reduce((total, value) => total + Number(value), 0), result.portraitLayerProjectedBytes);
        (0, assert_1.equal)(report.source.cpkInventory.entries.length, 2);
        (0, assert_1.equal)(report.checks.baseApkIdentityMatchesProvenance, true);
        (0, assert_1.equal)(report.checks.gameDbMetadataAndCardsCsvMatchProvenance, true);
        (0, assert_1.equal)(report.checks.cpkAndExtractedInventoriesMatchProvenance, true);
        (0, assert_1.equal)(report.checks.nonPortraitDataUnchanged, true);
        (0, assert_1.equal)(report.checks.portraitLayersDeduplicatedByContentHash, true);
        (0, assert_1.equal)(report.checks.everyPortraitPreservesTransparency, true);
        (0, assert_1.equal)(report.readiness.localPortraitCandidate, "GO");
        (0, assert_1.equal)(report.readiness.publication, "NO-GO");
        const manifest = JSON.parse(await (0, promises_1.readFile)(result.manifestPath, "utf8"));
        const characters = JSON.parse((0, zlib_1.gunzipSync)(await (0, promises_1.readFile)(result.payloadPath)).toString("utf8"));
        (0, assert_1.match)(manifest.fileName, /^staging\/v2\/releases\//);
        (0, assert_1.match)(characters[0].portraitURL, /^staging\/v2\/images\/v4\/portrait_1015830\.[a-f0-9]{64}\.png$/);
        (0, assert_1.match)(characters[0].transformations?.[0].portraitURL ?? "", /^staging\/v2\/images\/v4\/portrait_1015841\.[a-f0-9]{64}\.png$/);
        (0, assert_1.match)(characters[0].awakeningCards?.[0].portraitURL ?? "", /^staging\/v2\/images\/v4\/portrait_1015850\.[a-f0-9]{64}\.png$/);
        (0, assert_1.equal)(characters[0].portraitURL === characters[0].transformations?.[0].portraitURL, false);
        const references = [characters[0], characters[0].transformations?.[0], characters[0].awakeningCards?.[0]];
        for (const reference of references) {
            const layers = reference?.portraitLayers;
            (0, assert_1.match)(layers?.backgroundURL ?? "", /^staging\/v2\/images\/v5\/layers\/background\.[a-f0-9]{64}\.png$/);
            (0, assert_1.match)(layers?.thumbURL ?? "", /^staging\/v2\/images\/v5\/layers\/thumb\.[a-f0-9]{64}\.png$/);
            (0, assert_1.match)(layers?.overlayURL ?? "", /^staging\/v2\/images\/v5\/layers\/overlay\.[a-f0-9]{64}\.png$/);
            for (const objectKey of Object.values(layers ?? {})) {
                const object = await (0, promises_1.readFile)((0, path_1.join)(outputDir, "objects", ...objectKey.split("/")));
                const metadata = await sharp(object).metadata();
                (0, assert_1.equal)(metadata.width, 150);
                (0, assert_1.equal)(metadata.height, 150);
                (0, assert_1.equal)(metadata.channels, 4);
                (0, assert_1.equal)(metadata.hasAlpha, true);
            }
        }
        (0, assert_1.deepEqual)(characters[0].portraitLayers, characters[0].awakeningCards?.[0].portraitLayers);
        (0, assert_1.equal)(characters[0].portraitLayers?.thumbURL, characters[0].transformations?.[0].portraitLayers?.thumbURL);
        (0, assert_1.equal)(characters[0].portraitLayers?.backgroundURL, characters[0].transformations?.[0].portraitLayers?.backgroundURL);
        (0, assert_1.equal)(characters[0].portraitLayers?.overlayURL === characters[0].transformations?.[0].portraitLayers?.overlayURL, false);
        (0, assert_1.deepEqual)(characters[0].portraitSpec, {
            iconId: 1015820, frameColorId: 4, rarity: character_1.Rarities.SSR, elementCode: "14",
        });
        (0, assert_1.deepEqual)(characters[0].transformations?.[0].portraitSpec, {
            iconId: 1015820, frameColorId: 4, rarity: character_1.Rarities.UR, elementCode: "24",
        });
        const replay = await (0, game_db_first_party_portrait_candidate_1.buildFirstPartyPortraitCandidate)({ ...candidateOptions, outputDir: (0, path_1.join)(root, "candidate-replay") });
        (0, assert_1.equal)((await (0, promises_1.readFile)(replay.payloadPath)).equals(await (0, promises_1.readFile)(result.payloadPath)), true);
        (0, assert_1.equal)((await (0, promises_1.readFile)(replay.manifestPath)).equals(await (0, promises_1.readFile)(result.manifestPath)), true);
        (0, assert_1.equal)((await (0, promises_1.readFile)(replay.reportPath)).equals(await (0, promises_1.readFile)(result.reportPath)), true);
    });
});
//# sourceMappingURL=game-db-first-party-portrait-candidate.spec.js.map