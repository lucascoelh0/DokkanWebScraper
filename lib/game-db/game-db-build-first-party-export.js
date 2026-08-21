"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildFirstPartyExport = exports.parseBuildFirstPartyExportArgs = void 0;
const child_process_1 = require("child_process");
const path_1 = require("path");
const game_db_acquisition_1 = require("./game-db-acquisition");
const game_db_first_party_export_commit_1 = require("./game-db-first-party-export-commit");
const game_db_experiment_1 = require("./game-db-experiment");
const game_db_table_inventory_1 = require("./game-db-table-inventory");
// Historical development utility only. This loose-path contract is not AQ/C4,
// does not emit acquiredArtifactState, and cannot establish productive lineage.
function parseBuildFirstPartyExportArgs(argv) {
    let sqlitePath = "";
    let outputDir = game_db_acquisition_1.DEFAULT_FIRST_PARTY_DIR;
    let settingsJson;
    let dbVersion;
    let assetVersion;
    let apkVersion;
    let region = "global";
    let note = "Exported directly from a local Dokkan SQLite database.";
    for (let index = 0; index < argv.length; index += 1) {
        const token = argv[index];
        if (token === "--sqlite-path" || token.startsWith("--sqlite-path=")) {
            sqlitePath = (0, path_1.resolve)(token.includes("=") ? token.split("=", 2)[1] : argv[++index]);
            continue;
        }
        if (token === "--output-dir" || token.startsWith("--output-dir=")) {
            outputDir = (0, path_1.resolve)(token.includes("=") ? token.split("=", 2)[1] : argv[++index]);
            continue;
        }
        if (token === "--settings-json" || token.startsWith("--settings-json=")) {
            settingsJson = (0, path_1.resolve)(token.includes("=") ? token.split("=", 2)[1] : argv[++index]);
            continue;
        }
        if (token === "--db-version" || token.startsWith("--db-version=")) {
            dbVersion = token.includes("=") ? token.split("=", 2)[1] : argv[++index];
            continue;
        }
        if (token === "--asset-version" || token.startsWith("--asset-version=")) {
            assetVersion = token.includes("=") ? token.split("=", 2)[1] : argv[++index];
            continue;
        }
        if (token === "--apk-version" || token.startsWith("--apk-version=")) {
            apkVersion = token.includes("=") ? token.split("=", 2)[1] : argv[++index];
            continue;
        }
        if (token === "--region" || token.startsWith("--region=")) {
            const value = token.includes("=") ? token.split("=", 2)[1] : argv[++index];
            if (value === "global" || value === "jp" || value === "unknown") {
                region = value;
                continue;
            }
            throw new Error(`Unsupported region: ${value}`);
        }
        if (token === "--note" || token.startsWith("--note=")) {
            note = token.includes("=") ? token.split("=", 2)[1] : argv[++index];
            continue;
        }
        throw new Error(`Unexpected argument: ${token}`);
    }
    if (!sqlitePath) {
        throw new Error("Missing --sqlite-path");
    }
    return {
        sqlitePath,
        outputDir,
        settingsJson,
        dbVersion,
        assetVersion,
        apkVersion,
        region,
        note,
    };
}
exports.parseBuildFirstPartyExportArgs = parseBuildFirstPartyExportArgs;
async function spawnInherited(command, args) {
    await new Promise((resolvePromise, rejectPromise) => {
        const child = (0, child_process_1.spawn)(command, args, {
            stdio: "inherit",
            shell: false,
        });
        child.on("error", error => rejectPromise(error));
        child.on("exit", code => {
            if (code && code !== 0) {
                rejectPromise(new Error(`Command failed with exit code ${code}: ${command} ${args.join(" ")}`));
                return;
            }
            resolvePromise();
        });
    });
}
async function exportSqliteTables(sqlitePath, outputDir) {
    const args = [
        (0, path_1.resolve)(__dirname, "game-db-export-sqlite.py"),
        "--sqlite-path",
        sqlitePath,
        "--output-dir",
        outputDir,
        ...game_db_table_inventory_1.FIRST_PARTY_EXPORT_GAME_DB_TABLES.flatMap(tableName => ["--table", tableName]),
    ];
    if (process.platform === "win32") {
        await spawnInherited("python", args);
        return;
    }
    await spawnInherited("python3", args);
}
async function buildFirstPartyExport(options) {
    await (0, game_db_first_party_export_commit_1.assertNoFirstPartyExportPathOverlap)(options.sqlitePath, options.outputDir);
    const sourceSettings = options.settingsJson ? await (0, game_db_experiment_1.readSourceSettings)(options.settingsJson) : undefined;
    const metadata = {
        source: "first-party-export",
        region: options.region,
        exportedAt: new Date().toISOString(),
        dbVersion: options.dbVersion ?? sourceSettings?.glbDbVersion?.toString(),
        assetVersion: options.assetVersion ?? sourceSettings?.glbAssetVersion?.toString(),
        apkVersion: options.apkVersion ?? sourceSettings?.glbApkVersion,
        notes: options.note,
    };
    const committed = await (0, game_db_first_party_export_commit_1.commitFirstPartyExport)({
        outputDir: options.outputDir,
        metadata,
        materializeData: dataDir => exportSqliteTables(options.sqlitePath, dataDir),
    });
    return {
        outputDir: committed.outputDir,
        metadataPath: committed.metadataPath,
        exportedTableCount: game_db_table_inventory_1.FIRST_PARTY_EXPORT_GAME_DB_TABLES.length,
    };
}
exports.buildFirstPartyExport = buildFirstPartyExport;
async function main() {
    const options = parseBuildFirstPartyExportArgs(process.argv.slice(2));
    const result = await buildFirstPartyExport(options);
    console.log(`Built first-party export with ${result.exportedTableCount} table(s) in ${result.outputDir}`);
    console.log(`Wrote metadata to ${result.metadataPath}`);
}
if (require.main === module) {
    main().catch(error => {
        console.error(error);
        process.exitCode = 1;
    });
}
//# sourceMappingURL=game-db-build-first-party-export.js.map