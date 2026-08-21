"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runGameDbUpdate = exports.parseGameDbUpdateRunnerArgs = void 0;
const promises_1 = require("fs/promises");
const path_1 = require("path");
const game_db_acquisition_1 = require("./game-db-acquisition");
const game_db_experiment_1 = require("./game-db-experiment");
const game_db_source_settings_1 = require("./game-db-source-settings");
const format_json_1 = require("../format-json");
const game_db_dataset_1 = require("./game-db-dataset");
const game_db_publish_r2_1 = require("./game-db-publish-r2");
function parseOptionalPositiveInt(value) {
    const parsed = parseInt((value ?? "").trim(), 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}
function parseGameDbUpdateRunnerArgs(argv) {
    const publishArgs = [];
    let skipValidation = false;
    let skipPublish = false;
    let explicitCardIds;
    let cardLimit;
    let validationCardIds = [...game_db_experiment_1.DEFAULT_GOLDEN_CARD_IDS];
    let acquisitionMode;
    let mirrorUrl;
    let mirrorDir;
    let mirrorBranch;
    let firstPartyDir;
    let skipSync;
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
            validationCardIds = (0, game_db_experiment_1.parseCardIds)(value);
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
exports.parseGameDbUpdateRunnerArgs = parseGameDbUpdateRunnerArgs;
function collectMismatchFields(comparisonReport) {
    return comparisonReport.cards.flatMap(card => card.checks
        .filter(check => !check.matches)
        .map(check => `${card.id}:${check.field}`));
}
async function runGameDbUpdate(options) {
    const parsed = parseGameDbUpdateRunnerArgs(options?.argv ?? process.argv.slice(2));
    const { sourceConfig, report: acquisition } = await (0, game_db_acquisition_1.acquireGameDbSource)({
        mode: parsed.acquisitionMode,
        mirrorUrl: parsed.mirrorUrl,
        mirrorDir: parsed.mirrorDir,
        mirrorBranch: parsed.mirrorBranch,
        firstPartyDir: parsed.firstPartyDir,
        skipSync: parsed.skipSync,
    });
    const sourceSettings = await (0, game_db_source_settings_1.readSourceSettings)(sourceConfig.settingsPath);
    const generatedAt = new Date().toISOString();
    const updateOutputDir = (0, path_1.resolve)(__dirname, "data", "game-db-update", "latest");
    const buildResult = await (0, game_db_dataset_1.writeGameDbDataset)({
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
    const validationReportPath = (0, path_1.resolve)(updateOutputDir, "validation-report.json");
    let validation;
    if (parsed.skipValidation) {
        validation = {
            skipped: true,
            cardIds: parsed.validationCardIds,
        };
    }
    else {
        const tables = await (0, game_db_experiment_1.loadRequiredGameDbTables)(sourceConfig);
        const validationCharacters = (0, game_db_experiment_1.buildGameDbCharacterSnapshots)(parsed.validationCardIds, tables);
        const fyiCharacters = await (0, game_db_experiment_1.maybeReadFyiExperimentCharacters)();
        const comparisonReport = (0, game_db_experiment_1.buildGameDbComparisonReport)(validationCharacters, fyiCharacters);
        const mismatchFields = collectMismatchFields(comparisonReport);
        await (0, promises_1.mkdir)(updateOutputDir, { recursive: true });
        await (0, format_json_1.writeFormattedJson)(validationReportPath, comparisonReport);
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
    let publish;
    if (parsed.skipPublish) {
        publish = {
            skipped: true,
            forwardedArgs: parsed.publishArgs,
        };
    }
    else {
        const publishResult = await (0, game_db_publish_r2_1.publishGameDbDataset)({
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
    const report = {
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
    await (0, promises_1.mkdir)(updateOutputDir, { recursive: true });
    const reportPath = (0, path_1.resolve)(updateOutputDir, "update-report.json");
    await (0, format_json_1.writeFormattedJson)(reportPath, report);
    return {
        report,
        reportPath,
    };
}
exports.runGameDbUpdate = runGameDbUpdate;
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
//# sourceMappingURL=game-db-update-runner.js.map