"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildFyiCharacterDatasetRunReport = exports.runDokkanFyiCharacterDataset = void 0;
const promises_1 = require("fs/promises");
const path_1 = require("path");
const dataset_artifacts_1 = require("./dataset-artifacts");
const fyi_character_portraits_1 = require("./fyi-character-portraits");
const fyi_scraper_1 = require("./fyi-scraper");
const fyi_character_catalog_1 = require("./fyi-character-catalog");
const format_json_1 = require("./format-json");
const OUTPUT_DIR = (0, path_1.resolve)(__dirname, "data/fyi-characters/latest");
async function runDokkanFyiCharacterDataset() {
    const catalog = await (0, fyi_character_catalog_1.getDokkanFyiCharacterCatalog)();
    const requestedIds = requestedCharacterIds(catalog);
    const { characters, failedCharacterIds } = await (0, fyi_scraper_1.getDokkanFyiDataWithReport)(requestedIds.map(Number));
    const report = buildFyiCharacterDatasetRunReport(catalog, requestedIds, characters, failedCharacterIds);
    await (0, promises_1.mkdir)(OUTPUT_DIR, { recursive: true });
    const reportPath = (0, path_1.resolve)(OUTPUT_DIR, "run-report.json");
    await (0, format_json_1.writeFormattedJson)(reportPath, report);
    if (report.missingCharacterIds.length > 0 || report.duplicateCharacterIds.length > 0) {
        throw new Error("The scraped character set does not match the requested catalog. See run-report.json.");
    }
    if (report.failedCharacterIds.length > 0) {
        throw new Error(`Character scrape has ${report.failedCharacterIds.length} failed cards. See run-report.json.`);
    }
    const portraitSummary = await (0, fyi_character_portraits_1.mirrorFyiPortraits)(characters, (0, path_1.resolve)(__dirname, "data/fyi-characters"));
    const localizedCharacters = (0, fyi_character_portraits_1.localizeCharacterPortraitUrls)(characters);
    const generatedAt = report.generatedAt;
    const artifact = (0, dataset_artifacts_1.buildCharacterDatasetArtifact)(localizedCharacters, {
        datasetVersion: generatedAt,
        generatedAt,
        fileName: "characters.json.gz",
    });
    await (0, dataset_artifacts_1.writeCharacterDatasetBundle)(OUTPUT_DIR, artifact, {
        manifestFileName: "characters-manifest.json",
    });
    return {
        characters: localizedCharacters,
        catalog,
        report,
        portraitSummary,
        datasetPath: (0, path_1.resolve)(OUTPUT_DIR, artifact.manifest.fileName),
        manifestPath: (0, path_1.resolve)(OUTPUT_DIR, "characters-manifest.json"),
        reportPath,
    };
}
exports.runDokkanFyiCharacterDataset = runDokkanFyiCharacterDataset;
function buildFyiCharacterDatasetRunReport(catalog, requestedIds, characters, failedCharacterIds) {
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
exports.buildFyiCharacterDatasetRunReport = buildFyiCharacterDatasetRunReport;
function requestedCharacterIds(catalog) {
    const limit = optionalPositiveInteger(process.env.DOKKAN_FYI_CHARACTER_DATASET_LIMIT);
    const ids = catalog.characters.map(character => character.id);
    return limit ? ids.slice(0, limit) : ids;
}
function optionalPositiveInteger(value) {
    const parsed = Number.parseInt(value ?? "", 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}
function uniqueSorted(values) {
    return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}
//# sourceMappingURL=fyi-character-dataset.js.map