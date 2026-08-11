import { mkdir } from "fs/promises";
import { resolve } from "path";
import { Character } from "./character";
import { buildCharacterDatasetArtifact, writeCharacterDatasetBundle } from "./dataset-artifacts";
import { localizeCharacterPortraitUrls, mirrorFyiPortraits } from "./fyi-character-portraits";
import { getDokkanFyiDataWithReport } from "./fyi-scraper";
import { FyiCharacterCatalogDataset, getDokkanFyiCharacterCatalog } from "./fyi-character-catalog";
import { writeFormattedJson } from "./format-json";
import { validateCharacterCompactArtifact } from "./database-characters/compact-validator";
import { createCharacterCompactRarityOverlay } from "./database-characters/compact-overlay";
import {
    buildFyiCharacterCandidateK19Report,
    candidateFiles,
    FYI_CHARACTER_CANDIDATE_DIRECTORY,
    FYI_CHARACTER_K15_DIRECTORY,
    FyiCharacterCandidateK19Report,
    resolveFyiK15Directory,
    scopeCharacterCompactProjectionToTarget,
    writeFyiCharacterCandidateDirectory,
} from "./fyi-character-candidate";

const FYI_DATA_ROOT = resolve(__dirname, "data/fyi-characters");
const OUTPUT_DIR = resolve(FYI_DATA_ROOT, "latest");
const K15_DATA_ROOT = resolve(__dirname, "data/database-characters");

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

export type FyiCharacterDatasetOptions =
    | { mode?: "latest" }
    | {
        mode: "candidate-k19";
        optInK19: true;
        candidateDirectoryName?: typeof FYI_CHARACTER_CANDIDATE_DIRECTORY;
        k15DirectoryName?: typeof FYI_CHARACTER_K15_DIRECTORY;
    };

type K15Validation = Awaited<ReturnType<typeof validateCharacterCompactArtifact>>;

export interface FyiCharacterDatasetDependencies {
    getCatalog: typeof getDokkanFyiCharacterCatalog;
    getDataWithReport: typeof getDokkanFyiDataWithReport;
    mirrorPortraits: typeof mirrorFyiPortraits;
    localizePortraitUrls: typeof localizeCharacterPortraitUrls;
    validateK15: (directoryName: string) => Promise<K15Validation>;
    writeLatestReport: typeof writeFormattedJson;
    writeLatestBundle: typeof writeCharacterDatasetBundle;
    writeCandidate: typeof writeFyiCharacterCandidateDirectory;
    fyiDataRoot: string;
    latestOutputDir: string;
}

const defaultDependencies: FyiCharacterDatasetDependencies = {
    getCatalog: getDokkanFyiCharacterCatalog,
    getDataWithReport: getDokkanFyiDataWithReport,
    mirrorPortraits: mirrorFyiPortraits,
    localizePortraitUrls: localizeCharacterPortraitUrls,
    validateK15: async directoryName => validateCharacterCompactArtifact(
        await resolveFyiK15Directory(K15_DATA_ROOT, directoryName),
    ),
    writeLatestReport: writeFormattedJson,
    writeLatestBundle: writeCharacterDatasetBundle,
    writeCandidate: writeFyiCharacterCandidateDirectory,
    fyiDataRoot: FYI_DATA_ROOT,
    latestOutputDir: OUTPUT_DIR,
};

export async function runDokkanFyiCharacterDataset(
    options: FyiCharacterDatasetOptions = { mode: "latest" },
    injected: Partial<FyiCharacterDatasetDependencies> = {},
): Promise<{
    characters: Character[],
    catalog: FyiCharacterCatalogDataset,
    report: FyiCharacterDatasetRunReport,
    candidateReport?: FyiCharacterCandidateK19Report,
    datasetPath: string,
    manifestPath: string,
    reportPath: string,
    portraitSummary: {
        targetCount: number,
        downloadedCount: number,
    },
}> {
    const dependencies = { ...defaultDependencies, ...injected };
    const candidateMode = options.mode === "candidate-k19";
    if (candidateMode && options.optInK19 !== true) throw new Error("K19 requires explicit opt-in");
    const catalog = await dependencies.getCatalog();
    const requestedIds = requestedCharacterIds(catalog, !candidateMode);
    const { characters, failedCharacterIds } = await dependencies.getDataWithReport(requestedIds.map(Number));
    const report = buildFyiCharacterDatasetRunReport(catalog, requestedIds, characters, failedCharacterIds);

    if (!candidateMode) {
        await mkdir(dependencies.latestOutputDir, { recursive: true });
        const reportPath = resolve(dependencies.latestOutputDir, "run-report.json");
        await dependencies.writeLatestReport(reportPath, report);
        assertCompleteFyiRun(report, false);
        const portraitSummary = await dependencies.mirrorPortraits(characters, dependencies.fyiDataRoot);
        const localizedCharacters = dependencies.localizePortraitUrls(characters);
        const artifact = buildCharacterDatasetArtifact(localizedCharacters, {
            datasetVersion: report.generatedAt,
            generatedAt: report.generatedAt,
            fileName: "characters.json.gz",
        });
        await dependencies.writeLatestBundle(dependencies.latestOutputDir, artifact, { manifestFileName: "characters-manifest.json" });
        return {
            characters: localizedCharacters, catalog, report, portraitSummary,
            datasetPath: resolve(dependencies.latestOutputDir, artifact.manifest.fileName),
            manifestPath: resolve(dependencies.latestOutputDir, "characters-manifest.json"), reportPath,
        };
    }

    assertCompleteFyiRun(report, true);
    const localizedCharacters = dependencies.localizePortraitUrls(characters);
    const baselineArtifact = buildCharacterDatasetArtifact(localizedCharacters, {
        datasetVersion: report.generatedAt,
        generatedAt: report.generatedAt,
        fileName: "baseline-characters.json.gz",
    });
    const k15DirectoryName = options.k15DirectoryName ?? FYI_CHARACTER_K15_DIRECTORY;
    const k15Before = await dependencies.validateK15(k15DirectoryName);
    const k15Snapshot = JSON.stringify(k15Before);
    const targetScope = scopeCharacterCompactProjectionToTarget(k15Before.projection, localizedCharacters);
    const overlay = createCharacterCompactRarityOverlay(localizedCharacters, targetScope.projection);
    if (overlay.decision.readiness !== "GO" || overlay.decision.evaluation.blockers.total !== 0) {
        throw new Error(`K19 target-scoped overlay blocked with ${overlay.decision.evaluation.blockers.total} blocker(s)`);
    }
    const k15After = await dependencies.validateK15(k15DirectoryName);
    if (JSON.stringify(k15After) !== k15Snapshot) throw new Error("K19 K15 input changed during candidate generation");

    const candidateArtifact = buildCharacterDatasetArtifact(overlay.characters, {
        datasetVersion: report.generatedAt,
        generatedAt: report.generatedAt,
        fileName: "characters.json.gz",
    });
    const candidateReport = buildFyiCharacterCandidateK19Report({
        generatedAt: report.generatedAt,
        baseline: baselineArtifact,
        candidate: candidateArtifact,
        k15Manifest: k15Before.manifest,
        k15RecordCount: k15Before.projection.records.length,
        scope: targetScope,
        overlay: overlay.decision,
    });
    const candidateDirectoryName = options.candidateDirectoryName ?? FYI_CHARACTER_CANDIDATE_DIRECTORY;
    let portraitSummary = { targetCount: 0, downloadedCount: 0 };
    const outputDirectory = await dependencies.writeCandidate(
        dependencies.fyiDataRoot,
        candidateDirectoryName,
        candidateFiles({ baseline: baselineArtifact, candidate: candidateArtifact, runReport: report, candidateReport }),
        async stagingDirectory => {
            portraitSummary = await dependencies.mirrorPortraits(characters, stagingDirectory);
        },
    );
    return {
        characters: overlay.characters, catalog, report, candidateReport, portraitSummary,
        datasetPath: resolve(outputDirectory, candidateArtifact.manifest.fileName),
        manifestPath: resolve(outputDirectory, "characters-manifest.json"),
        reportPath: resolve(outputDirectory, "run-report.json"),
    };
}

function assertCompleteFyiRun(report: FyiCharacterDatasetRunReport, requireFullCatalog: boolean): void {
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

export function parseFyiCharacterDatasetCli(args: string[]): FyiCharacterDatasetOptions {
    if (args.length === 0) return { mode: "latest" };
    let optInCount = 0;
    const values = new Map<string, string>();
    for (let index = 0; index < args.length; index++) {
        const argument = args[index];
        if (argument === "--candidate-k19") {
            optInCount++;
            continue;
        }
        if (argument !== "--candidate-dir" && argument !== "--k15-dir") {
            throw new Error(`K19 unsupported argument ${argument}`);
        }
        if (values.has(argument)) throw new Error(`K19 duplicate ${argument}`);
        const value = args[++index];
        if (!value || value.startsWith("--")) throw new Error(`K19 missing value for ${argument}`);
        values.set(argument, value);
    }
    if (optInCount !== 1) throw new Error("K19 candidate options require exactly one --candidate-k19");
    const candidateDirectoryName = values.get("--candidate-dir") ?? FYI_CHARACTER_CANDIDATE_DIRECTORY;
    const k15DirectoryName = values.get("--k15-dir") ?? FYI_CHARACTER_K15_DIRECTORY;
    if (candidateDirectoryName !== FYI_CHARACTER_CANDIDATE_DIRECTORY) throw new Error("K19 candidate directory name not allowed");
    if (k15DirectoryName !== FYI_CHARACTER_K15_DIRECTORY) throw new Error("K19 K15 directory name not allowed");
    return {
        mode: "candidate-k19", optInK19: true,
        candidateDirectoryName, k15DirectoryName,
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

function requestedCharacterIds(catalog: FyiCharacterCatalogDataset, allowLegacyEnvironmentLimit: boolean): string[] {
    const limit = allowLegacyEnvironmentLimit
        ? optionalPositiveInteger(process.env.DOKKAN_FYI_CHARACTER_DATASET_LIMIT)
        : undefined;
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
