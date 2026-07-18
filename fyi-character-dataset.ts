import { mkdir } from "fs/promises";
import { resolve } from "path";
import { Character } from "./character";
import { buildCharacterDatasetArtifact, writeCharacterDatasetBundle } from "./dataset-artifacts";
import {
    getDokkanFyiDataWithReport,
} from "./fyi-scraper";
import {
    FyiCharacterCatalogDataset,
    getDokkanFyiCharacterCatalog,
} from "./fyi-character-catalog";
import { writeFormattedJson } from "./format-json";

const OUTPUT_DIR = resolve(__dirname, "data/fyi-characters/latest");

export interface FyiCharacterDatasetRunReport {
    generatedAt: string,
    source: "dokkan.fyi",
    publishable: boolean,
    fullCatalog: boolean,
    catalog: {
        pageCount: number,
        candidateCount: number,
        characterCount: number,
        awakeningLineCount: number,
        duplicateGroupCount: number,
    },
    requestedCharacterCount: number,
    scrapedCharacterCount: number,
    failedCharacterIds: string[],
    missingCharacterIds: string[],
    duplicateCharacterIds: string[],
    mechanicCoverage: {
        activeSkillCount: number,
        standbyCount: number,
        finishSkillCount: number,
        reversibleExchangeCount: number,
        transformationCount: number,
        exclusiveSkillOrbCount: number,
        freeToPlayCount: number,
    },
}

export async function runDokkanFyiCharacterDataset(): Promise<{
    characters: Character[],
    catalog: FyiCharacterCatalogDataset,
    report: FyiCharacterDatasetRunReport,
    datasetPath: string,
    manifestPath: string,
    reportPath: string,
}> {
    const catalog = await getDokkanFyiCharacterCatalog();
    const requestedIds = requestedCharacterIds(catalog);
    const { characters, failedCharacterIds } = await getDokkanFyiDataWithReport(requestedIds.map(Number));
    const report = buildFyiCharacterDatasetRunReport(catalog, requestedIds, characters, failedCharacterIds);

    await mkdir(OUTPUT_DIR, { recursive: true });
    const reportPath = resolve(OUTPUT_DIR, "run-report.json");
    await writeFormattedJson(reportPath, report);

    if (report.missingCharacterIds.length > 0 || report.duplicateCharacterIds.length > 0) {
        throw new Error("The scraped character set does not match the requested catalog. See run-report.json.");
    }

    if (report.failedCharacterIds.length > 0) {
        throw new Error(`Character scrape has ${report.failedCharacterIds.length} failed cards. See run-report.json.`);
    }

    const generatedAt = report.generatedAt;
    const artifact = buildCharacterDatasetArtifact(characters, {
        datasetVersion: generatedAt,
        generatedAt,
        fileName: "characters.json.gz",
    });
    await writeCharacterDatasetBundle(OUTPUT_DIR, artifact, {
        manifestFileName: "characters-manifest.json",
    });

    return {
        characters,
        catalog,
        report,
        datasetPath: resolve(OUTPUT_DIR, artifact.manifest.fileName),
        manifestPath: resolve(OUTPUT_DIR, "characters-manifest.json"),
        reportPath,
    };
}

export function buildFyiCharacterDatasetRunReport(
    catalog: FyiCharacterCatalogDataset,
    requestedIds: string[],
    characters: Character[],
    failedCharacterIds: string[],
): FyiCharacterDatasetRunReport {
    const actualIds = characters.map(character => character.id);
    const actualIdSet = new Set(actualIds);
    const missingCharacterIds = requestedIds.filter(id => !actualIdSet.has(id));
    const duplicateCharacterIds = actualIds.filter((id, index) => actualIds.indexOf(id) !== index);
    const fullCatalog = catalog.isComplete && requestedIds.length === catalog.characterCount;

    return {
        generatedAt: new Date().toISOString(),
        source: "dokkan.fyi",
        publishable: fullCatalog && failedCharacterIds.length === 0 && missingCharacterIds.length === 0 && duplicateCharacterIds.length === 0,
        fullCatalog,
        catalog: {
            pageCount: catalog.pageCount,
            candidateCount: catalog.candidateCount,
            characterCount: catalog.characterCount,
            awakeningLineCount: catalog.awakeningLineCount,
            duplicateGroupCount: catalog.duplicateGroupCount,
        },
        requestedCharacterCount: requestedIds.length,
        scrapedCharacterCount: characters.length,
        failedCharacterIds: uniqueSorted(failedCharacterIds),
        missingCharacterIds: uniqueSorted(missingCharacterIds),
        duplicateCharacterIds: uniqueSorted(duplicateCharacterIds),
        mechanicCoverage: {
            activeSkillCount: characters.filter(character => Boolean(character.activeSkill)).length,
            standbyCount: characters.filter(character => Boolean(character.standby)).length,
            finishSkillCount: characters.filter(character => (character.finishSkills?.length ?? 0) > 0).length,
            reversibleExchangeCount: characters.filter(character => Boolean(character.reversibleExchange)).length,
            transformationCount: characters.reduce((count, character) => count + (character.transformations?.length ?? 0), 0),
            exclusiveSkillOrbCount: characters.reduce((count, character) => count + (character.exclusiveSkillOrbs?.length ?? 0), 0),
            freeToPlayCount: characters.filter(character => character.isFreeToPlay === true).length,
        },
    };
}

function requestedCharacterIds(catalog: FyiCharacterCatalogDataset): string[] {
    const limit = optionalPositiveInteger(process.env.DOKKAN_FYI_CHARACTER_DATASET_LIMIT);
    const ids = catalog.characters.map(character => character.id);
    return limit ? ids.slice(0, limit) : ids;
}

function optionalPositiveInteger(value: string | undefined): number | undefined {
    const parsed = Number.parseInt(value ?? "", 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function uniqueSorted(values: string[]): string[] {
    return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}
