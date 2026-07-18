import { createHash } from "crypto";
import { existsSync } from "fs";
import { readFile } from "fs/promises";
import { resolve } from "path";
import { gunzipSync } from "zlib";
import * as sharp from "sharp";
import { Classes, Character, Rarities, Types } from "./character";
import { DatasetManifest } from "./dataset-artifacts";
import { collectReferencedPortraitKeys } from "./publish-r2";

const DEFAULT_DATA_ROOT = "data/fyi-characters";
const DEFAULT_DATASET_PATH = "data/fyi-characters/latest/characters.json.gz";
const DEFAULT_MANIFEST_PATH = "data/fyi-characters/latest/characters-manifest.json";
const DEFAULT_REPORT_PATH = "data/fyi-characters/latest/run-report.json";
const DEFAULT_PORTRAIT_CONCURRENCY = 8;

export interface FyiCharacterDatasetValidationOptions {
    dataRoot: string,
    datasetPath: string,
    manifestPath: string,
    reportPath: string,
    legacyDatasetPath?: string,
    requirePublishable: boolean,
}

export interface FyiCharacterDatasetValidationReport {
    valid: boolean,
    datasetPath: string,
    manifestPath: string,
    reportPath: string,
    characterCount: number,
    referencedPortraitCount: number,
    missingPortraits: string[],
    invalidPortraits: string[],
    duplicateCharacterIds: string[],
    invalidCharacterIds: string[],
    invalidRarities: string[],
    invalidClasses: string[],
    invalidTypes: string[],
    manifestMatchesBundle: boolean,
    publishableReport: boolean,
    fullCatalogReport: boolean,
    legacyComparison?: {
        currentOnlyCount: number,
        legacyOnlyCount: number,
        currentOnlySample: string[],
        legacyOnlySample: string[],
    },
}

export function validateCharacterRecords(characters: Character[]): {
    duplicateCharacterIds: string[],
    invalidCharacterIds: string[],
    invalidRarities: string[],
    invalidClasses: string[],
    invalidTypes: string[],
} {
    const duplicateCharacterIds = duplicateValues(characters.map(character => character.id));
    const invalidCharacterIds = uniqueSorted(characters
        .filter(character => !/^\d+$/.test(character.id))
        .map(character => character.id || "<empty>"));
    const invalidRarities = uniqueSorted(characters
        .filter(character => !Object.values(Rarities).includes(character.rarity))
        .map(character => `${character.id}:${character.rarity}`));
    const invalidClasses = uniqueSorted(characters
        .filter(character => !Object.values(Classes).includes(character.characterClass))
        .map(character => `${character.id}:${character.characterClass}`));
    const invalidTypes = uniqueSorted(characters
        .filter(character => !Object.values(Types).includes(character.type))
        .map(character => `${character.id}:${character.type}`));

    return {
        duplicateCharacterIds,
        invalidCharacterIds,
        invalidRarities,
        invalidClasses,
        invalidTypes,
    };
}

export function compareCharacterIds(
    currentIds: string[],
    legacyIds: string[],
): {
    currentOnly: string[],
    legacyOnly: string[],
} {
    const current = new Set(currentIds);
    const legacy = new Set(legacyIds);

    return {
        currentOnly: [...current].filter(id => !legacy.has(id)).sort(compareStrings),
        legacyOnly: [...legacy].filter(id => !current.has(id)).sort(compareStrings),
    };
}

export async function validateFyiCharacterDataset(
    options: FyiCharacterDatasetValidationOptions,
): Promise<FyiCharacterDatasetValidationReport> {
    const manifest = JSON.parse(await readFile(options.manifestPath, "utf8")) as DatasetManifest;
    const runReport = JSON.parse(await readFile(options.reportPath, "utf8")) as {
        publishable?: boolean,
        fullCatalog?: boolean,
        failedCharacterIds?: string[],
        missingCharacterIds?: string[],
        duplicateCharacterIds?: string[],
    };
    const gzipBuffer = await readFile(options.datasetPath);
    const jsonBuffer = gunzipSync(gzipBuffer);
    const characters = JSON.parse(jsonBuffer.toString("utf8")) as Character[];
    const recordIssues = validateCharacterRecords(characters);
    const portraitKeys = collectReferencedPortraitKeys(characters);
    const { missingPortraits, invalidPortraits } = await validatePortraits(
        portraitKeys,
        options.dataRoot,
    );
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

function manifestMatches(
    manifest: DatasetManifest,
    gzipBuffer: Buffer,
    jsonBuffer: Buffer,
    characterCount: number,
): boolean {
    return manifest.schemaVersion === 1
        && manifest.compression === "gzip"
        && manifest.fileName === "characters.json.gz"
        && manifest.sha256 === createHash("sha256").update(gzipBuffer).digest("hex")
        && manifest.sizeBytes === gzipBuffer.byteLength
        && manifest.uncompressedSizeBytes === jsonBuffer.byteLength
        && manifest.characterCount === characterCount;
}

async function validatePortraits(
    portraitKeys: string[],
    dataRoot: string,
): Promise<{ missingPortraits: string[], invalidPortraits: string[] }> {
    const missingPortraits: string[] = [];
    const invalidPortraits: string[] = [];
    let nextIndex = 0;
    const workerCount = Math.min(requestedPortraitConcurrency(), portraitKeys.length);

    async function worker() {
        while (true) {
            const index = nextIndex++;
            if (index >= portraitKeys.length) {
                return;
            }

            const objectKey = portraitKeys[index];
            const filePath = resolve(dataRoot, objectKey);
            if (!existsSync(filePath)) {
                missingPortraits.push(objectKey);
                continue;
            }

            try {
                const metadata = await sharp(await readFile(filePath)).metadata();
                if (metadata.format !== "png" || metadata.width !== 150 || metadata.height !== 150) {
                    invalidPortraits.push(objectKey);
                }
            } catch {
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

async function compareWithLegacy(
    characters: Character[],
    legacyDatasetPath: string,
): Promise<FyiCharacterDatasetValidationReport["legacyComparison"]> {
    const legacy = JSON.parse(gunzipSync(await readFile(legacyDatasetPath)).toString("utf8")) as Character[];
    const comparison = compareCharacterIds(
        characters.map(character => character.id),
        legacy.map(character => character.id),
    );
    return {
        currentOnlyCount: comparison.currentOnly.length,
        legacyOnlyCount: comparison.legacyOnly.length,
        currentOnlySample: comparison.currentOnly.slice(0, 10),
        legacyOnlySample: comparison.legacyOnly.slice(0, 10),
    };
}

function parseArgs(argv: string[]): FyiCharacterDatasetValidationOptions {
    const values = new Map<string, string>();
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
        dataRoot: resolve(values.get("--data-root") ?? DEFAULT_DATA_ROOT),
        datasetPath: resolve(values.get("--dataset") ?? DEFAULT_DATASET_PATH),
        manifestPath: resolve(values.get("--manifest") ?? DEFAULT_MANIFEST_PATH),
        reportPath: resolve(values.get("--report") ?? DEFAULT_REPORT_PATH),
        legacyDatasetPath: values.get("--legacy-dataset")
            ? resolve(values.get("--legacy-dataset") as string)
            : undefined,
        requirePublishable: values.get("--allow-partial") !== "true",
    };
}

function requestedPortraitConcurrency(): number {
    const value = Number.parseInt(process.env.DOKKAN_FYI_PORTRAIT_CONCURRENCY ?? "", 10);
    return Number.isFinite(value) && value > 0 ? value : DEFAULT_PORTRAIT_CONCURRENCY;
}

function duplicateValues(values: string[]): string[] {
    const counts = new Map<string, number>();
    for (const value of values) {
        counts.set(value, (counts.get(value) ?? 0) + 1);
    }

    return [...counts.entries()]
        .filter(([, count]) => count > 1)
        .map(([value]) => value)
        .sort(compareStrings);
}

function uniqueSorted(values: string[]): string[] {
    return [...new Set(values)].sort(compareStrings);
}

function compareStrings(left: string, right: string): number {
    return left.localeCompare(right);
}

async function main(): Promise<void> {
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
