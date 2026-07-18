"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateFyiCharacterDataset = exports.compareCharacterIds = exports.validateCharacterRecords = void 0;
const crypto_1 = require("crypto");
const fs_1 = require("fs");
const promises_1 = require("fs/promises");
const path_1 = require("path");
const zlib_1 = require("zlib");
const sharp = require("sharp");
const character_1 = require("./character");
const publish_r2_1 = require("./publish-r2");
const DEFAULT_DATA_ROOT = "data/fyi-characters";
const DEFAULT_DATASET_PATH = "data/fyi-characters/latest/characters.json.gz";
const DEFAULT_MANIFEST_PATH = "data/fyi-characters/latest/characters-manifest.json";
const DEFAULT_REPORT_PATH = "data/fyi-characters/latest/run-report.json";
const DEFAULT_PORTRAIT_CONCURRENCY = 8;
function validateCharacterRecords(characters) {
    const duplicateCharacterIds = duplicateValues(characters.map(character => character.id));
    const invalidCharacterIds = uniqueSorted(characters
        .filter(character => !/^\d+$/.test(character.id))
        .map(character => character.id || "<empty>"));
    const invalidRarities = uniqueSorted(characters
        .filter(character => !Object.values(character_1.Rarities).includes(character.rarity))
        .map(character => `${character.id}:${character.rarity}`));
    const invalidClasses = uniqueSorted(characters
        .filter(character => !Object.values(character_1.Classes).includes(character.characterClass))
        .map(character => `${character.id}:${character.characterClass}`));
    const invalidTypes = uniqueSorted(characters
        .filter(character => !Object.values(character_1.Types).includes(character.type))
        .map(character => `${character.id}:${character.type}`));
    return {
        duplicateCharacterIds,
        invalidCharacterIds,
        invalidRarities,
        invalidClasses,
        invalidTypes,
    };
}
exports.validateCharacterRecords = validateCharacterRecords;
function compareCharacterIds(currentIds, legacyIds) {
    const current = new Set(currentIds);
    const legacy = new Set(legacyIds);
    return {
        currentOnly: [...current].filter(id => !legacy.has(id)).sort(compareStrings),
        legacyOnly: [...legacy].filter(id => !current.has(id)).sort(compareStrings),
    };
}
exports.compareCharacterIds = compareCharacterIds;
async function validateFyiCharacterDataset(options) {
    const manifest = JSON.parse(await (0, promises_1.readFile)(options.manifestPath, "utf8"));
    const runReport = JSON.parse(await (0, promises_1.readFile)(options.reportPath, "utf8"));
    const gzipBuffer = await (0, promises_1.readFile)(options.datasetPath);
    const jsonBuffer = (0, zlib_1.gunzipSync)(gzipBuffer);
    const characters = JSON.parse(jsonBuffer.toString("utf8"));
    const recordIssues = validateCharacterRecords(characters);
    const portraitKeys = (0, publish_r2_1.collectReferencedPortraitKeys)(characters);
    const { missingPortraits, invalidPortraits } = await validatePortraits(portraitKeys, options.dataRoot);
    const manifestMatchesBundle = manifestMatches(manifest, gzipBuffer, jsonBuffer, characters.length);
    const publishableReport = runReport.publishable === true
        && (runReport.failedCharacterIds?.length ?? 0) === 0
        && (runReport.missingCharacterIds?.length ?? 0) === 0
        && (runReport.duplicateCharacterIds?.length ?? 0) === 0;
    const fullCatalogReport = runReport.fullCatalog === true;
    const legacyComparison = options.legacyDatasetPath
        ? await compareWithLegacy(characters, options.legacyDatasetPath)
        : undefined;
    return {
        valid: manifestMatchesBundle
            && recordIssues.duplicateCharacterIds.length === 0
            && recordIssues.invalidCharacterIds.length === 0
            && recordIssues.invalidRarities.length === 0
            && recordIssues.invalidClasses.length === 0
            && recordIssues.invalidTypes.length === 0
            && missingPortraits.length === 0
            && invalidPortraits.length === 0
            && (!options.requirePublishable || (publishableReport && fullCatalogReport)),
        datasetPath: options.datasetPath,
        manifestPath: options.manifestPath,
        reportPath: options.reportPath,
        characterCount: characters.length,
        referencedPortraitCount: portraitKeys.length,
        missingPortraits,
        invalidPortraits,
        ...recordIssues,
        manifestMatchesBundle,
        publishableReport,
        fullCatalogReport,
        legacyComparison,
    };
}
exports.validateFyiCharacterDataset = validateFyiCharacterDataset;
function manifestMatches(manifest, gzipBuffer, jsonBuffer, characterCount) {
    return manifest.schemaVersion === 1
        && manifest.compression === "gzip"
        && manifest.fileName === "characters.json.gz"
        && manifest.sha256 === (0, crypto_1.createHash)("sha256").update(gzipBuffer).digest("hex")
        && manifest.sizeBytes === gzipBuffer.byteLength
        && manifest.uncompressedSizeBytes === jsonBuffer.byteLength
        && manifest.characterCount === characterCount;
}
async function validatePortraits(portraitKeys, dataRoot) {
    const missingPortraits = [];
    const invalidPortraits = [];
    let nextIndex = 0;
    const workerCount = Math.min(requestedPortraitConcurrency(), portraitKeys.length);
    async function worker() {
        while (true) {
            const index = nextIndex++;
            if (index >= portraitKeys.length) {
                return;
            }
            const objectKey = portraitKeys[index];
            const filePath = (0, path_1.resolve)(dataRoot, objectKey);
            if (!(0, fs_1.existsSync)(filePath)) {
                missingPortraits.push(objectKey);
                continue;
            }
            try {
                const metadata = await sharp(await (0, promises_1.readFile)(filePath)).metadata();
                if (metadata.format !== "png" || metadata.width !== 150 || metadata.height !== 150) {
                    invalidPortraits.push(objectKey);
                }
            }
            catch {
                invalidPortraits.push(objectKey);
            }
        }
    }
    await Promise.all(Array.from({ length: workerCount }, () => worker()));
    return {
        missingPortraits: missingPortraits.sort(compareStrings),
        invalidPortraits: invalidPortraits.sort(compareStrings),
    };
}
async function compareWithLegacy(characters, legacyDatasetPath) {
    const legacy = JSON.parse((0, zlib_1.gunzipSync)(await (0, promises_1.readFile)(legacyDatasetPath)).toString("utf8"));
    const comparison = compareCharacterIds(characters.map(character => character.id), legacy.map(character => character.id));
    return {
        currentOnlyCount: comparison.currentOnly.length,
        legacyOnlyCount: comparison.legacyOnly.length,
        currentOnlySample: comparison.currentOnly.slice(0, 10),
        legacyOnlySample: comparison.legacyOnly.slice(0, 10),
    };
}
function parseArgs(argv) {
    const values = new Map();
    for (let index = 0; index < argv.length; index += 1) {
        const token = argv[index];
        if (!token.startsWith("--")) {
            throw new Error(`Unexpected argument: ${token}`);
        }
        const [name, inlineValue] = token.split("=", 2);
        if (inlineValue !== undefined) {
            values.set(name, inlineValue);
            continue;
        }
        const nextToken = argv[index + 1];
        if (!nextToken || nextToken.startsWith("--")) {
            throw new Error(`Missing value for ${name}`);
        }
        values.set(name, nextToken);
        index += 1;
    }
    return {
        dataRoot: (0, path_1.resolve)(values.get("--data-root") ?? DEFAULT_DATA_ROOT),
        datasetPath: (0, path_1.resolve)(values.get("--dataset") ?? DEFAULT_DATASET_PATH),
        manifestPath: (0, path_1.resolve)(values.get("--manifest") ?? DEFAULT_MANIFEST_PATH),
        reportPath: (0, path_1.resolve)(values.get("--report") ?? DEFAULT_REPORT_PATH),
        legacyDatasetPath: values.get("--legacy-dataset")
            ? (0, path_1.resolve)(values.get("--legacy-dataset"))
            : undefined,
        requirePublishable: values.get("--allow-partial") !== "true",
    };
}
function requestedPortraitConcurrency() {
    const value = Number.parseInt(process.env.DOKKAN_FYI_PORTRAIT_CONCURRENCY ?? "", 10);
    return Number.isFinite(value) && value > 0 ? value : DEFAULT_PORTRAIT_CONCURRENCY;
}
function duplicateValues(values) {
    const counts = new Map();
    for (const value of values) {
        counts.set(value, (counts.get(value) ?? 0) + 1);
    }
    return [...counts.entries()]
        .filter(([, count]) => count > 1)
        .map(([value]) => value)
        .sort(compareStrings);
}
function uniqueSorted(values) {
    return [...new Set(values)].sort(compareStrings);
}
function compareStrings(left, right) {
    return left.localeCompare(right);
}
async function main() {
    const report = await validateFyiCharacterDataset(parseArgs(process.argv.slice(2)));
    console.log(JSON.stringify(report, null, 2));
    if (!report.valid) {
        process.exitCode = 1;
    }
}
if (require.main === module) {
    main().catch(error => {
        console.error(error);
        process.exitCode = 1;
    });
}
//# sourceMappingURL=fyi-character-dataset-validate.js.map