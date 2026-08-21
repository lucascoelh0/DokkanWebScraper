import { mkdir } from "fs/promises";
import { resolve } from "path";
import { acquireGameDbSource, GameDbAcquisitionMode, GameDbAcquisitionReport } from "./game-db-acquisition";
import {
    DEFAULT_GOLDEN_CARD_IDS,
    buildGameDbCharacterSnapshots,
    buildGameDbComparisonReport,
    loadRequiredGameDbTables,
    maybeReadFyiExperimentCharacters,
    parseCardIds,
} from "./game-db-experiment";
import { readSourceSettings } from "./game-db-source-settings";
import { writeFormattedJson } from "../format-json";
import { writeGameDbDataset } from "./game-db-dataset";
import { hasOption, publishGameDbDataset } from "./game-db-publish-r2";

export interface GameDbUpdateRunnerReport {
    source: "game-db-update-runner",
    generatedAt: string,
    acquisitionMode: GameDbAcquisitionMode,
    sourceRoot: string,
    dataDir: string,
    acquisition: GameDbAcquisitionReport,
    dataset: {
        datasetVersion: string,
        outputDir: string,
        selectedCardCount: number,
        explicitCardIdOverride: boolean,
        cardLimit?: number,
    },
    validation: {
        skipped: boolean,
        cardIds: string[],
        fyiSampleFound?: boolean,
        comparedCardCount?: number,
        mismatchCount?: number,
        mismatchFields?: string[],
        reportPath?: string,
    },
    publish: {
        skipped: boolean,
        preparedPortraitCount?: number,
        forwardedArgs: string[],
        publishStatePath?: string,
    },
    sourceSettings?: {
        glbAssetVersion?: number,
        glbDbVersion?: number,
        glbApkVersion?: string,
    },
}

interface GameDbUpdateRunnerOptions {
    skipValidation: boolean,
    skipPublish: boolean,
    explicitCardIds?: string,
    cardLimit?: number,
    validationCardIds: string[],
    publishArgs: string[],
    acquisitionMode?: GameDbAcquisitionMode,
    mirrorUrl?: string,
    mirrorDir?: string,
    mirrorBranch?: string,
    firstPartyDir?: string,
    skipSync?: boolean,
}

function parseOptionalPositiveInt(value?: string): number | undefined {
    const parsed = parseInt((value ?? "").trim(), 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

export function parseGameDbUpdateRunnerArgs(argv: string[]): GameDbUpdateRunnerOptions {
    const publishArgs: string[] = [];
    let skipValidation = false;
    let skipPublish = false;
    let explicitCardIds: string | undefined;
    let cardLimit: number | undefined;
    let validationCardIds = [...DEFAULT_GOLDEN_CARD_IDS];
    let acquisitionMode: GameDbAcquisitionMode | undefined;
    let mirrorUrl: string | undefined;
    let mirrorDir: string | undefined;
    let mirrorBranch: string | undefined;
    let firstPartyDir: string | undefined;
    let skipSync: boolean | undefined;

    for (let index = 0; index < argv.length; index += 1) {
        const token = argv[index];

        if (token === "--skip-validation") {
            skipValidation = true;
            continue;
        }

        if (token === "--skip-publish") {
            skipPublish = true;
            continue;
        }

        if (token === "--card-ids" || token.startsWith("--card-ids=")) {
            const value = token.includes("=") ? token.split("=", 2)[1] : argv[++index];
            explicitCardIds = value;
            continue;
        }

        if (token === "--card-limit" || token.startsWith("--card-limit=")) {
            const value = token.includes("=") ? token.split("=", 2)[1] : argv[++index];
            cardLimit = parseOptionalPositiveInt(value);
            continue;
        }

        if (token === "--validation-card-ids" || token.startsWith("--validation-card-ids=")) {
            const value = token.includes("=") ? token.split("=", 2)[1] : argv[++index];
            validationCardIds = parseCardIds(value);
            continue;
        }

        if (token === "--acquisition-mode" || token.startsWith("--acquisition-mode=")) {
            const value = token.includes("=") ? token.split("=", 2)[1] : argv[++index];
            if (value === "existing-export" || value === "mirror-repo" || value === "first-party-export") {
                acquisitionMode = value;
                continue;
            }

            throw new Error(`Unsupported acquisition mode: ${value}`);
        }

        if (token === "--mirror-url" || token.startsWith("--mirror-url=")) {
            mirrorUrl = token.includes("=") ? token.split("=", 2)[1] : argv[++index];
            continue;
        }

        if (token === "--mirror-dir" || token.startsWith("--mirror-dir=")) {
            mirrorDir = token.includes("=") ? token.split("=", 2)[1] : argv[++index];
            continue;
        }

        if (token === "--mirror-branch" || token.startsWith("--mirror-branch=")) {
            mirrorBranch = token.includes("=") ? token.split("=", 2)[1] : argv[++index];
            continue;
        }

        if (token === "--first-party-dir" || token.startsWith("--first-party-dir=")) {
            firstPartyDir = token.includes("=") ? token.split("=", 2)[1] : argv[++index];
            continue;
        }

        if (token === "--skip-sync") {
            skipSync = true;
            continue;
        }

        publishArgs.push(token);
    }

    return {
        skipValidation,
        skipPublish,
        explicitCardIds,
        cardLimit,
        validationCardIds,
        publishArgs,
        acquisitionMode,
        mirrorUrl,
        mirrorDir,
        mirrorBranch,
        firstPartyDir,
        skipSync,
    };
}

function collectMismatchFields(comparisonReport: ReturnType<typeof buildGameDbComparisonReport>): string[] {
    return comparisonReport.cards.flatMap(card =>
        card.checks
            .filter(check => !check.matches)
            .map(check => `${card.id}:${check.field}`),
    );
}

export async function runGameDbUpdate(options?: {
    argv?: string[],
}): Promise<{
    report: GameDbUpdateRunnerReport,
    reportPath: string,
}> {
    const parsed = parseGameDbUpdateRunnerArgs(options?.argv ?? process.argv.slice(2));
    const { sourceConfig, report: acquisition } = await acquireGameDbSource({
        mode: parsed.acquisitionMode,
        mirrorUrl: parsed.mirrorUrl,
        mirrorDir: parsed.mirrorDir,
        mirrorBranch: parsed.mirrorBranch,
        firstPartyDir: parsed.firstPartyDir,
        skipSync: parsed.skipSync,
    });
    const sourceSettings = await readSourceSettings(sourceConfig.settingsPath);
    const generatedAt = new Date().toISOString();
    const updateOutputDir = resolve(__dirname, "data", "game-db-update", "latest");

    const buildResult = await writeGameDbDataset({
        explicitCardIds: parsed.explicitCardIds,
        cardLimit: parsed.cardLimit,
        sourceConfig,
        datasetVersionHint: acquisition.firstParty
            ? [
                acquisition.firstParty.metadata.dbVersion ? `glb-db-${acquisition.firstParty.metadata.dbVersion}` : "",
                acquisition.firstParty.metadata.assetVersion ? `asset-${acquisition.firstParty.metadata.assetVersion}` : "",
            ].filter(Boolean)
            : undefined,
    });

    const validationReportPath = resolve(updateOutputDir, "validation-report.json");
    let validation: GameDbUpdateRunnerReport["validation"];

    if (parsed.skipValidation) {
        validation = {
            skipped: true,
            cardIds: parsed.validationCardIds,
        };
    } else {
        const tables = await loadRequiredGameDbTables(sourceConfig);
        const validationCharacters = buildGameDbCharacterSnapshots(parsed.validationCardIds, tables);
        const fyiCharacters = await maybeReadFyiExperimentCharacters();
        const comparisonReport = buildGameDbComparisonReport(validationCharacters, fyiCharacters);
        const mismatchFields = collectMismatchFields(comparisonReport);

        await mkdir(updateOutputDir, { recursive: true });
        await writeFormattedJson(validationReportPath, comparisonReport);

        validation = {
            skipped: false,
            cardIds: parsed.validationCardIds,
            fyiSampleFound: comparisonReport.fyiSampleFound,
            comparedCardCount: comparisonReport.comparedCardCount,
            mismatchCount: mismatchFields.length,
            mismatchFields,
            reportPath: validationReportPath,
        };
    }

    let publish: GameDbUpdateRunnerReport["publish"];
    if (parsed.skipPublish) {
        publish = {
            skipped: true,
            forwardedArgs: parsed.publishArgs,
        };
    } else {
        const publishResult = await publishGameDbDataset({
            forwardedArgs: parsed.publishArgs,
            buildResult,
        });

        publish = {
            skipped: false,
            preparedPortraitCount: publishResult.preparedPortraitCount,
            forwardedArgs: parsed.publishArgs,
            publishStatePath: publishResult.publishStatePath,
        };
    }

    const report: GameDbUpdateRunnerReport = {
        source: "game-db-update-runner",
        generatedAt,
        acquisitionMode: acquisition.mode,
        sourceRoot: sourceConfig.sourceRoot,
        dataDir: sourceConfig.dataDir,
        acquisition,
        dataset: {
            datasetVersion: buildResult.datasetVersion,
            outputDir: buildResult.outputDir,
            selectedCardCount: buildResult.selectedCardIds.length,
            explicitCardIdOverride: Boolean(parsed.explicitCardIds),
            cardLimit: parsed.cardLimit,
        },
        validation,
        publish,
        sourceSettings,
    };

    await mkdir(updateOutputDir, { recursive: true });
    const reportPath = resolve(updateOutputDir, "update-report.json");
    await writeFormattedJson(reportPath, report);

    return {
        report,
        reportPath,
    };
}

async function main() {
    const result = await runGameDbUpdate();
    console.log(`Wrote game-db update report to ${result.reportPath}`);
}

if (require.main === module) {
    main().catch(error => {
        console.error(error);
        process.exitCode = 1;
    });
}

