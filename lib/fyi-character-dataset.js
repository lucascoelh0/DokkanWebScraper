"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildFyiCharacterDatasetRunReport = exports.parseFyiCharacterDatasetCli = exports.runDokkanFyiCharacterDataset = void 0;
const promises_1 = require("fs/promises");
const path_1 = require("path");
const dataset_artifacts_1 = require("./dataset-artifacts");
const fyi_character_portraits_1 = require("./fyi-character-portraits");
const fyi_scraper_1 = require("./fyi-scraper");
const fyi_character_catalog_1 = require("./fyi-character-catalog");
const format_json_1 = require("./format-json");
const compact_validator_1 = require("./database-characters/compact-validator");
const compact_overlay_1 = require("./database-characters/compact-overlay");
const fyi_character_candidate_1 = require("./fyi-character-candidate");
const FYI_DATA_ROOT = (0, path_1.resolve)(__dirname, "data/fyi-characters");
const OUTPUT_DIR = (0, path_1.resolve)(FYI_DATA_ROOT, "latest");
const K15_DATA_ROOT = (0, path_1.resolve)(__dirname, "data/database-characters");
const defaultDependencies = {
    getCatalog: fyi_character_catalog_1.getDokkanFyiCharacterCatalog,
    getDataWithReport: fyi_scraper_1.getDokkanFyiDataWithReport,
    mirrorPortraits: fyi_character_portraits_1.mirrorFyiPortraits,
    localizePortraitUrls: fyi_character_portraits_1.localizeCharacterPortraitUrls,
    validateK15: async (directoryName) => (0, compact_validator_1.validateCharacterCompactArtifact)(await (0, fyi_character_candidate_1.resolveFyiK15Directory)(K15_DATA_ROOT, directoryName)),
    writeLatestReport: format_json_1.writeFormattedJson,
    writeLatestBundle: dataset_artifacts_1.writeCharacterDatasetBundle,
    writeCandidate: fyi_character_candidate_1.writeFyiCharacterCandidateDirectory,
    fyiDataRoot: FYI_DATA_ROOT,
    latestOutputDir: OUTPUT_DIR,
};
async function runDokkanFyiCharacterDataset(options = { mode: "latest" }, injected = {}) {
    const dependencies = { ...defaultDependencies, ...injected };
    const candidateMode = options.mode === "candidate-k19";
    if (candidateMode && options.optInK19 !== true)
        throw new Error("K19 requires explicit opt-in");
    const catalog = await dependencies.getCatalog();
    const requestedIds = requestedCharacterIds(catalog, !candidateMode);
    const { characters, failedCharacterIds } = await dependencies.getDataWithReport(requestedIds.map(Number));
    const report = buildFyiCharacterDatasetRunReport(catalog, requestedIds, characters, failedCharacterIds);
    if (!candidateMode) {
        await (0, promises_1.mkdir)(dependencies.latestOutputDir, { recursive: true });
        const reportPath = (0, path_1.resolve)(dependencies.latestOutputDir, "run-report.json");
        await dependencies.writeLatestReport(reportPath, report);
        assertCompleteFyiRun(report, false);
        const portraitSummary = await dependencies.mirrorPortraits(characters, dependencies.fyiDataRoot);
        const localizedCharacters = dependencies.localizePortraitUrls(characters);
        const artifact = (0, dataset_artifacts_1.buildCharacterDatasetArtifact)(localizedCharacters, {
            datasetVersion: report.generatedAt,
            generatedAt: report.generatedAt,
            fileName: "characters.json.gz",
        });
        await dependencies.writeLatestBundle(dependencies.latestOutputDir, artifact, { manifestFileName: "characters-manifest.json" });
        return {
            characters: localizedCharacters, catalog, report, portraitSummary,
            datasetPath: (0, path_1.resolve)(dependencies.latestOutputDir, artifact.manifest.fileName),
            manifestPath: (0, path_1.resolve)(dependencies.latestOutputDir, "characters-manifest.json"), reportPath,
        };
    }
    assertCompleteFyiRun(report, true);
    const localizedCharacters = dependencies.localizePortraitUrls(characters);
    const baselineArtifact = (0, dataset_artifacts_1.buildCharacterDatasetArtifact)(localizedCharacters, {
        datasetVersion: report.generatedAt,
        generatedAt: report.generatedAt,
        fileName: "baseline-characters.json.gz",
    });
    const k15DirectoryName = options.k15DirectoryName ?? fyi_character_candidate_1.FYI_CHARACTER_K15_DIRECTORY;
    const k15Before = await dependencies.validateK15(k15DirectoryName);
    const k15Snapshot = JSON.stringify(k15Before);
    const targetScope = (0, fyi_character_candidate_1.scopeCharacterCompactProjectionToTarget)(k15Before.projection, localizedCharacters);
    const overlay = (0, compact_overlay_1.createCharacterCompactRarityOverlay)(localizedCharacters, targetScope.projection);
    if (overlay.decision.readiness !== "GO" || overlay.decision.evaluation.blockers.total !== 0) {
        throw new Error(`K19 target-scoped overlay blocked with ${overlay.decision.evaluation.blockers.total} blocker(s)`);
    }
    const k15After = await dependencies.validateK15(k15DirectoryName);
    if (JSON.stringify(k15After) !== k15Snapshot)
        throw new Error("K19 K15 input changed during candidate generation");
    const candidateArtifact = (0, dataset_artifacts_1.buildCharacterDatasetArtifact)(overlay.characters, {
        datasetVersion: report.generatedAt,
        generatedAt: report.generatedAt,
        fileName: "characters.json.gz",
    });
    const candidateReport = (0, fyi_character_candidate_1.buildFyiCharacterCandidateK19Report)({
        generatedAt: report.generatedAt,
        baseline: baselineArtifact,
        candidate: candidateArtifact,
        k15Manifest: k15Before.manifest,
        k15RecordCount: k15Before.projection.records.length,
        scope: targetScope,
        overlay: overlay.decision,
    });
    const candidateDirectoryName = options.candidateDirectoryName ?? fyi_character_candidate_1.FYI_CHARACTER_CANDIDATE_DIRECTORY;
    let portraitSummary = { targetCount: 0, downloadedCount: 0 };
    const outputDirectory = await dependencies.writeCandidate(dependencies.fyiDataRoot, candidateDirectoryName, (0, fyi_character_candidate_1.candidateFiles)({ baseline: baselineArtifact, candidate: candidateArtifact, runReport: report, candidateReport }), async (stagingDirectory) => {
        portraitSummary = await dependencies.mirrorPortraits(characters, stagingDirectory);
    });
    return {
        characters: overlay.characters, catalog, report, candidateReport, portraitSummary,
        datasetPath: (0, path_1.resolve)(outputDirectory, candidateArtifact.manifest.fileName),
        manifestPath: (0, path_1.resolve)(outputDirectory, "characters-manifest.json"),
        reportPath: (0, path_1.resolve)(outputDirectory, "run-report.json"),
    };
}
exports.runDokkanFyiCharacterDataset = runDokkanFyiCharacterDataset;
function assertCompleteFyiRun(report, requireFullCatalog) {
    if (report.missingCharacterIds.length > 0 || report.duplicateCharacterIds.length > 0) {
        throw new Error("The scraped character set does not match the requested catalog.");
    }
    if (report.failedCharacterIds.length > 0) {
        throw new Error(`Character scrape has ${report.failedCharacterIds.length} failed cards.`);
    }
    if (requireFullCatalog && (!report.fullCatalog || !report.publishable)) {
        throw new Error("K19 requires a complete publishable FYI baseline");
    }
}
function parseFyiCharacterDatasetCli(args) {
    if (args.length === 0)
        return { mode: "latest" };
    let optInCount = 0;
    const values = new Map();
    for (let index = 0; index < args.length; index++) {
        const argument = args[index];
        if (argument === "--candidate-k19") {
            optInCount++;
            continue;
        }
        if (argument !== "--candidate-dir" && argument !== "--k15-dir") {
            throw new Error(`K19 unsupported argument ${argument}`);
        }
        if (values.has(argument))
            throw new Error(`K19 duplicate ${argument}`);
        const value = args[++index];
        if (!value || value.startsWith("--"))
            throw new Error(`K19 missing value for ${argument}`);
        values.set(argument, value);
    }
    if (optInCount !== 1)
        throw new Error("K19 candidate options require exactly one --candidate-k19");
    const candidateDirectoryName = values.get("--candidate-dir") ?? fyi_character_candidate_1.FYI_CHARACTER_CANDIDATE_DIRECTORY;
    const k15DirectoryName = values.get("--k15-dir") ?? fyi_character_candidate_1.FYI_CHARACTER_K15_DIRECTORY;
    if (candidateDirectoryName !== fyi_character_candidate_1.FYI_CHARACTER_CANDIDATE_DIRECTORY)
        throw new Error("K19 candidate directory name not allowed");
    if (k15DirectoryName !== fyi_character_candidate_1.FYI_CHARACTER_K15_DIRECTORY)
        throw new Error("K19 K15 directory name not allowed");
    return {
        mode: "candidate-k19", optInK19: true,
        candidateDirectoryName, k15DirectoryName,
    };
}
exports.parseFyiCharacterDatasetCli = parseFyiCharacterDatasetCli;
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
function requestedCharacterIds(catalog, allowLegacyEnvironmentLimit) {
    const limit = allowLegacyEnvironmentLimit
        ? optionalPositiveInteger(process.env.DOKKAN_FYI_CHARACTER_DATASET_LIMIT)
        : undefined;
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