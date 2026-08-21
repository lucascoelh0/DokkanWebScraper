"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.promoteToFirstPartyExport = exports.parsePromoteArgs = void 0;
const path_1 = require("path");
const game_db_acquisition_1 = require("./game-db-acquisition");
const game_db_first_party_export_commit_1 = require("./game-db-first-party-export-commit");
const game_db_experiment_1 = require("./game-db-experiment");
const game_db_table_inventory_1 = require("./game-db-table-inventory");
const game_db_source_1 = require("./game-db-source");
function parsePromoteArgs(argv) {
    let sourceRoot = "";
    let outputDir = game_db_acquisition_1.DEFAULT_FIRST_PARTY_DIR;
    let note = "Promoted from an existing external export into the first-party export contract.";
    for (let index = 0; index < argv.length; index += 1) {
        const token = argv[index];
        if (token === "--source-root" || token.startsWith("--source-root=")) {
            sourceRoot = (0, path_1.resolve)(token.includes("=") ? token.split("=", 2)[1] : argv[++index]);
            continue;
        }
        if (token === "--output-dir" || token.startsWith("--output-dir=")) {
            outputDir = (0, path_1.resolve)(token.includes("=") ? token.split("=", 2)[1] : argv[++index]);
            continue;
        }
        if (token === "--note" || token.startsWith("--note=")) {
            note = token.includes("=") ? token.split("=", 2)[1] : argv[++index];
            continue;
        }
        throw new Error(`Unexpected argument: ${token}`);
    }
    return {
        sourceRoot,
        outputDir,
        note,
    };
}
exports.parsePromoteArgs = parsePromoteArgs;
async function promoteToFirstPartyExport(options) {
    const parsed = {
        sourceRoot: options?.sourceRoot ?? "",
        outputDir: options?.outputDir ?? game_db_acquisition_1.DEFAULT_FIRST_PARTY_DIR,
        note: options?.note ?? "Promoted from an existing external export into the first-party export contract.",
    };
    const acquisitionDefaults = (0, game_db_acquisition_1.resolveGameDbAcquisitionOptions)();
    const sourceConfig = (0, game_db_source_1.resolveGameDbSourceConfig)(parsed.sourceRoot || acquisitionDefaults.sourceRootOverride || undefined);
    const outputDir = (0, path_1.resolve)(parsed.outputDir);
    const sourceSettings = await (0, game_db_experiment_1.readSourceSettings)(sourceConfig.settingsPath);
    await (0, game_db_first_party_export_commit_1.assertNoFirstPartyExportPathOverlap)(sourceConfig.dataDir, outputDir);
    await (0, game_db_first_party_export_commit_1.assertFirstPartyExportSourceInventory)(sourceConfig.dataDir);
    const metadata = {
        source: "first-party-export",
        region: "global",
        exportedAt: new Date().toISOString(),
        dbVersion: sourceSettings?.glbDbVersion?.toString(),
        assetVersion: sourceSettings?.glbAssetVersion?.toString(),
        apkVersion: sourceSettings?.glbApkVersion,
        notes: parsed.note,
    };
    const committed = await (0, game_db_first_party_export_commit_1.commitFirstPartyExport)({
        outputDir,
        metadata,
        materializeData: dataDir => (0, game_db_first_party_export_commit_1.copyFirstPartyExportSourceInventory)(sourceConfig.dataDir, dataDir),
    });
    return {
        outputDir: committed.outputDir,
        metadataPath: committed.metadataPath,
        copiedTableCount: game_db_table_inventory_1.FIRST_PARTY_EXPORT_GAME_DB_TABLES.length,
    };
}
exports.promoteToFirstPartyExport = promoteToFirstPartyExport;
async function main() {
    const parsed = parsePromoteArgs(process.argv.slice(2));
    const result = await promoteToFirstPartyExport(parsed);
    console.log(`Promoted ${result.copiedTableCount} table(s) into ${result.outputDir}`);
    console.log(`Wrote metadata to ${result.metadataPath}`);
}
if (require.main === module) {
    main().catch(error => {
        console.error(error);
        process.exitCode = 1;
    });
}
//# sourceMappingURL=game-db-promote-to-first-party-export.js.map