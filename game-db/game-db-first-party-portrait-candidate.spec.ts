import { createHash } from "crypto";
import { deepEqual, equal, match, rejects } from "assert";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { dirname, join, relative } from "path";
import { gunzipSync } from "zlib";
import { afterEach, describe, it } from "mocha";
import sharp = require("sharp");
import { Classes, Rarities, Types, type Character } from "../character";
import { buildCharacterDatasetArtifact } from "../dataset-artifacts";
import { resolveFirstPartyPortraitLayerPaths } from "./first-party-portrait-compositor";
import {
    buildFirstPartyPortraitCandidate,
    FIRST_PARTY_PORTRAIT_SOURCE_CONTRACT,
} from "./game-db-first-party-portrait-candidate";

const temporaryDirectories: string[] = [];
const hash = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");

afterEach(async () => {
    for (const directory of temporaryDirectories.splice(0)) await rm(directory, { recursive: true, force: true });
});

function fixtureCharacter(): Character {
    return {
        id: "1015830",
        name: "Shared Super",
        title: "Fixture",
        rarity: Rarities.SSR,
        characterClass: Classes.Super,
        type: Types.PHY,
        maxLevel: 80,
        maxSALevel: 10,
        cost: 1,
        portraitURL: "images/v3/portrait_1015830.old.png",
        portraitFilename: "portrait_1015830",
        portraitSpec: { iconId: 1015830, frameColorId: 4, rarity: Rarities.SSR, elementCode: "14" },
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
            rarity: Rarities.SSR,
            characterClass: Classes.Super,
            type: Types.PHY,
            portraitURL: "images/v3/portrait_1015850.old.png",
            portraitSpec: { iconId: 1015820, frameColorId: 4, rarity: Rarities.SSR, elementCode: "14" },
            artURL: "",
        }],
        transformations: [{
            id: "1015841",
            baseCharacterId: "1015830",
            name: "Shared Extreme",
            characterClass: Classes.Extreme,
            type: Types.PHY,
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
            portraitSpec: { iconId: 1015840, frameColorId: 4, rarity: Rarities.UR, elementCode: "14" },
            artURL: "",
            artFilename: "art_1015841",
            finishingMove: [],
        }],
    };
}

async function writePng(path: string, color: string): Promise<void> {
    await mkdir(dirname(path), { recursive: true });
    const fill = await sharp({
        create: { width: 200, height: 200, channels: 4, background: color },
    }).png().toBuffer();
    await writeFile(path, await sharp({
        create: { width: 250, height: 250, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
    }).composite([{ input: fill, left: 25, top: 25 }]).png().toBuffer());
}

async function inventory(entries: Array<{ path: string, absolutePath: string }>): Promise<{
    fileCount: number,
    totalBytes: number,
    sha256: string,
}> {
    const unique = new Map(entries.map(entry => [entry.path, entry.absolutePath]));
    const identities = await Promise.all([...unique]
        .sort(([left], [right]) => left.localeCompare(right, undefined, { numeric: true }))
        .map(async ([path, absolutePath]) => {
            const bytes = await readFile(absolutePath);
            return { path, sizeBytes: bytes.length, sha256: hash(bytes) };
        }));
    return {
        fileCount: identities.length,
        totalBytes: identities.reduce((total, entry) => total + entry.sizeBytes, 0),
        sha256: hash(Buffer.from(`${JSON.stringify(identities, null, 2)}\n`, "utf8")),
    };
}

describe("first-party portrait staging candidate", function () {
    it("deduplicates official shared thumbs while producing class-specific content-addressed portraits", async () => {
        this.timeout(20_000);
        const root = await mkdtemp(join(tmpdir(), "dokkan-portrait-candidate-test-"));
        temporaryDirectories.push(root);
        const baselineDir = join(root, "baseline");
        const firstPartyDir = join(root, "first-party");
        const cpkBundleRoot = join(root, "cpk-bundle");
        const sharedLayersRoot = join(root, "extracted", "shared");
        const cardThumbsRoot = join(root, "extracted", "thumbs");
        const outputDir = join(root, "candidate");
        await mkdir(join(firstPartyDir, "data"), { recursive: true });
        await mkdir(join(cpkBundleRoot, "thumbs"), { recursive: true });
        await mkdir(baselineDir, { recursive: true });

        const baseline = buildCharacterDatasetArtifact([fixtureCharacter()], {
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
            writeFile(join(baselineDir, "characters.json.gz"), baseline.gzipBuffer),
            writeFile(join(baselineDir, "characters-manifest.json"), `${JSON.stringify(baseline.manifest, null, 2)}\n`),
            writeFile(join(firstPartyDir, "metadata.json"), `${JSON.stringify({
                source: "first-party-export", region: "global", dbVersion: "1", assetVersion: "2", apkVersion: "6.5.0",
            })}\n`),
            writeFile(join(firstPartyDir, "data", "cards.csv"), cardsCsv),
            writeFile(join(cpkBundleRoot, "character.cpk"), "shared-cpk"),
            writeFile(join(cpkBundleRoot, "thumbs", "card_1015820_thumb.cpk"), "thumb-cpk"),
        ]);

        const extractedEntries: Array<{ path: string, absolutePath: string }> = [];
        for (const spec of [
            { iconId: 1015820, frameColorId: 4, rarity: Rarities.SSR, elementCode: "14" },
            { iconId: 1015820, frameColorId: 4, rarity: Rarities.UR, elementCode: "24" },
        ]) {
            const paths = resolveFirstPartyPortraitLayerPaths(spec, {
                sharedLayers: sharedLayersRoot,
                cardThumbs: cardThumbsRoot,
            });
            await writePng(paths.background, "#222222");
            await writePng(paths.thumb, "#555555");
            await writePng(paths.rarity, spec.rarity === Rarities.SSR ? "#ffff00" : "#ff00ff");
            await writePng(paths.type, spec.elementCode === "14" ? "#00ff00" : "#ff0000");
            for (const [kind, path] of Object.entries(paths)) {
                const assetRoot = kind === "thumb" ? cardThumbsRoot : sharedLayersRoot;
                extractedEntries.push({ path: `${kind}/${relative(assetRoot, path).replace(/\\/g, "/")}`, absolutePath: path });
            }
        }

        const archive = Buffer.from("official-asset-archive");
        const baseApk = Buffer.from("official-base-apk");
        const archivePath = join(root, "official-assets.tar");
        const baseApkPath = join(root, "base.apk");
        const provenancePath = join(root, "provenance.json");
        const cpkInventory = await inventory([
            { path: "character.cpk", absolutePath: join(cpkBundleRoot, "character.cpk") },
            { path: "thumbs/card_1015820_thumb.cpk", absolutePath: join(cpkBundleRoot, "thumbs", "card_1015820_thumb.cpk") },
        ]);
        const extractedLayerInventory = await inventory(extractedEntries);
        await writeFile(archivePath, archive);
        await writeFile(baseApkPath, baseApk);
        const provenance = {
            schemaVersion: 1,
            contract: FIRST_PARTY_PORTRAIT_SOURCE_CONTRACT,
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
        } as const;
        await writeFile(provenancePath, `${JSON.stringify(provenance, null, 2)}\n`);

        const candidateOptions = {
            baselineManifestPath: join(baselineDir, "characters-manifest.json"),
            baselinePayloadPath: join(baselineDir, "characters.json.gz"),
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

        const wrongBaseApkPath = join(root, "wrong-base.apk");
        await writeFile(wrongBaseApkPath, "wrong-official-base-apk");
        await rejects(
            buildFirstPartyPortraitCandidate({
                ...candidateOptions,
                baseApkPath: wrongBaseApkPath,
                outputDir: join(root, "rejected-apk"),
            }),
            /official base APK identity rejected/,
        );

        await writeFile(provenancePath, `${JSON.stringify({
            ...provenance,
            packageVersionName: "6.5.1",
        }, null, 2)}\n`);
        await rejects(
            buildFirstPartyPortraitCandidate({ ...candidateOptions, outputDir: join(root, "rejected-version-lineage") }),
            /official portrait source APK version lineage rejected/,
        );
        await writeFile(provenancePath, `${JSON.stringify(provenance, null, 2)}\n`);

        await writeFile(join(firstPartyDir, "data", "cards.csv"), Buffer.concat([cardsCsv, Buffer.from("\n")]));
        await rejects(
            buildFirstPartyPortraitCandidate({ ...candidateOptions, outputDir: join(root, "rejected-db") }),
            /portrait candidate DB source identity rejected/,
        );
        await writeFile(join(firstPartyDir, "data", "cards.csv"), cardsCsv);

        const thumbPath = resolveFirstPartyPortraitLayerPaths({
            iconId: 1015820,
            frameColorId: 4,
            rarity: Rarities.SSR,
            elementCode: "14",
        }, { sharedLayers: sharedLayersRoot, cardThumbs: cardThumbsRoot }).thumb;
        const thumbBytes = await readFile(thumbPath);
        await writePng(thumbPath, "#777777");
        await rejects(
            buildFirstPartyPortraitCandidate({ ...candidateOptions, outputDir: join(root, "rejected-layers") }),
            /official extracted-layer inventory provenance rejected/,
        );
        await writeFile(thumbPath, thumbBytes);

        const result = await buildFirstPartyPortraitCandidate(candidateOptions);

        equal(result.portraitCount, 3);
        equal(result.portraitLayerObjectCount, 4);
        equal(result.portraitLayerProjectedBytes > 0, true);
        const report = JSON.parse(await readFile(result.reportPath, "utf8"));
        equal(report.contractVersion, "1.2.0");
        equal(report.portraits.uniqueThumbAssetCount, 1);
        equal(report.portraitLayers.referenceCount, 3);
        equal(report.portraitLayers.uniqueObjectCount, 4);
        equal(report.portraitLayers.backgroundObjectCount, 1);
        equal(report.portraitLayers.thumbObjectCount, 1);
        equal(report.portraitLayers.overlayObjectCount, 2);
        equal(report.portraitLayers.projectedBytes, result.portraitLayerProjectedBytes);
        equal(Object.values(report.portraitLayers.projectedBytesByKind)
            .reduce((total: number, value) => total + Number(value), 0), result.portraitLayerProjectedBytes);
        equal(report.source.cpkInventory.entries.length, 2);
        equal(report.checks.baseApkIdentityMatchesProvenance, true);
        equal(report.checks.gameDbMetadataAndCardsCsvMatchProvenance, true);
        equal(report.checks.cpkAndExtractedInventoriesMatchProvenance, true);
        equal(report.checks.nonPortraitDataUnchanged, true);
        equal(report.checks.portraitLayersDeduplicatedByContentHash, true);
        equal(report.checks.everyPortraitPreservesTransparency, true);
        equal(report.readiness.localPortraitCandidate, "GO");
        equal(report.readiness.publication, "NO-GO");
        const manifest = JSON.parse(await readFile(result.manifestPath, "utf8"));
        const characters = JSON.parse(gunzipSync(await readFile(result.payloadPath)).toString("utf8")) as Character[];
        match(manifest.fileName, /^staging\/v2\/releases\//);
        match(characters[0].portraitURL, /^staging\/v2\/images\/v4\/portrait_1015830\.[a-f0-9]{64}\.png$/);
        match(characters[0].transformations?.[0].portraitURL ?? "", /^staging\/v2\/images\/v4\/portrait_1015841\.[a-f0-9]{64}\.png$/);
        match(characters[0].awakeningCards?.[0].portraitURL ?? "", /^staging\/v2\/images\/v4\/portrait_1015850\.[a-f0-9]{64}\.png$/);
        equal(characters[0].portraitURL === characters[0].transformations?.[0].portraitURL, false);
        const references = [characters[0], characters[0].transformations?.[0], characters[0].awakeningCards?.[0]];
        for (const reference of references) {
            const layers = reference?.portraitLayers;
            match(layers?.backgroundURL ?? "", /^staging\/v2\/images\/v5\/layers\/background\.[a-f0-9]{64}\.png$/);
            match(layers?.thumbURL ?? "", /^staging\/v2\/images\/v5\/layers\/thumb\.[a-f0-9]{64}\.png$/);
            match(layers?.overlayURL ?? "", /^staging\/v2\/images\/v5\/layers\/overlay\.[a-f0-9]{64}\.png$/);
            for (const objectKey of Object.values(layers ?? {})) {
                const object = await readFile(join(outputDir, "objects", ...objectKey.split("/")));
                const metadata = await sharp(object).metadata();
                equal(metadata.width, 150);
                equal(metadata.height, 150);
                equal(metadata.channels, 4);
                equal(metadata.hasAlpha, true);
            }
        }
        deepEqual(characters[0].portraitLayers, characters[0].awakeningCards?.[0].portraitLayers);
        equal(characters[0].portraitLayers?.thumbURL, characters[0].transformations?.[0].portraitLayers?.thumbURL);
        equal(characters[0].portraitLayers?.backgroundURL, characters[0].transformations?.[0].portraitLayers?.backgroundURL);
        equal(characters[0].portraitLayers?.overlayURL === characters[0].transformations?.[0].portraitLayers?.overlayURL, false);
        deepEqual(characters[0].portraitSpec, {
            iconId: 1015820, frameColorId: 4, rarity: Rarities.SSR, elementCode: "14",
        });
        deepEqual(characters[0].transformations?.[0].portraitSpec, {
            iconId: 1015820, frameColorId: 4, rarity: Rarities.UR, elementCode: "24",
        });

        const replay = await buildFirstPartyPortraitCandidate({ ...candidateOptions, outputDir: join(root, "candidate-replay") });
        equal((await readFile(replay.payloadPath)).equals(await readFile(result.payloadPath)), true);
        equal((await readFile(replay.manifestPath)).equals(await readFile(result.manifestPath)), true);
        equal((await readFile(replay.reportPath)).equals(await readFile(result.reportPath)), true);
    });
});
