"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.downloadDatabaseArtifact = exports.resolveClientAssetsDatabaseInput = exports.parseDownloadDatabaseArtifactArgs = void 0;
const axios_1 = require("axios");
const promises_1 = require("fs/promises");
const path_1 = require("path");
const game_db_experiment_1 = require("./game-db-experiment");
const format_json_1 = require("../format-json");
const DEFAULT_OUTPUT_DIR = (0, path_1.resolve)(__dirname, "data", "game-db-acquisition", "downloads", "latest");
const SQLITE_HEADER = Buffer.from("SQLite format 3\u0000", "utf8");
function parseDownloadDatabaseArtifactArgs(argv) {
    let databaseUrl;
    let clientAssetsJson;
    let outputDir = DEFAULT_OUTPUT_DIR;
    let outputFileName = "database.db";
    let settingsJson;
    let dbVersion;
    let assetVersion;
    let apkVersion;
    let region = "global";
    let note = "Downloaded from a captured /client_assets/database response.";
    for (let index = 0; index < argv.length; index += 1) {
        const token = argv[index];
        if (token === "--database-url" || token.startsWith("--database-url=")) {
            databaseUrl = token.includes("=") ? token.split("=", 2)[1] : argv[++index];
            continue;
        }
        if (token === "--client-assets-json" || token.startsWith("--client-assets-json=")) {
            clientAssetsJson = (0, path_1.resolve)(token.includes("=") ? token.split("=", 2)[1] : argv[++index]);
            continue;
        }
        if (token === "--output-dir" || token.startsWith("--output-dir=")) {
            outputDir = (0, path_1.resolve)(token.includes("=") ? token.split("=", 2)[1] : argv[++index]);
            continue;
        }
        if (token === "--output-file-name" || token.startsWith("--output-file-name=")) {
            outputFileName = token.includes("=") ? token.split("=", 2)[1] : argv[++index];
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
    if (!databaseUrl && !clientAssetsJson) {
        throw new Error("Pass either --database-url or --client-assets-json");
    }
    return {
        databaseUrl,
        clientAssetsJson,
        outputDir,
        outputFileName,
        settingsJson,
        dbVersion,
        assetVersion,
        apkVersion,
        region,
        note,
    };
}
exports.parseDownloadDatabaseArtifactArgs = parseDownloadDatabaseArtifactArgs;
function resolveClientAssetsDatabaseInput(input) {
    const databaseUrl = input.explicitDatabaseUrl ?? input.payload?.url;
    if (!databaseUrl) {
        throw new Error("Could not resolve database URL from arguments or client-assets payload");
    }
    const dbVersion = input.explicitDbVersion
        ?? (input.payload?.version === undefined ? undefined : String(input.payload.version));
    return {
        databaseUrl,
        dbVersion,
    };
}
exports.resolveClientAssetsDatabaseInput = resolveClientAssetsDatabaseInput;
async function readClientAssetsDatabasePayload(filePath) {
    if (!filePath) {
        return undefined;
    }
    const rawPayload = await (0, promises_1.readFile)(filePath, "utf8");
    const parsedPayload = JSON.parse(rawPayload);
    return parsedPayload;
}
function buildNextSuggestedCommand(args) {
    if (args.appearsReadableSqlite) {
        const settingsPart = args.settingsJson
            ? ` --settings-json "${args.settingsJson}"`
            : "";
        return `npm run run:game-db-build-first-party-export -- --sqlite-path "${args.artifactPath}"${settingsPart}`;
    }
    return [
        "Decrypt this artifact first, then build the export with:",
        `npm run run:game-db-build-first-party-export -- --sqlite-path "<decrypted-sqlite-path>"${args.settingsJson ? ` --settings-json "${args.settingsJson}"` : ""}`,
    ].join(" ");
}
async function downloadDatabaseArtifact(options) {
    const payload = await readClientAssetsDatabasePayload(options.clientAssetsJson);
    const resolvedInput = resolveClientAssetsDatabaseInput({
        explicitDatabaseUrl: options.databaseUrl,
        explicitDbVersion: options.dbVersion,
        payload,
    });
    const sourceSettings = options.settingsJson ? await (0, game_db_experiment_1.readSourceSettings)(options.settingsJson) : undefined;
    const artifactPath = (0, path_1.resolve)(options.outputDir, options.outputFileName);
    const metadataPath = (0, path_1.resolve)(options.outputDir, "download-metadata.json");
    await (0, promises_1.mkdir)(options.outputDir, { recursive: true });
    const response = await axios_1.default.get(resolvedInput.databaseUrl, {
        responseType: "arraybuffer",
        maxRedirects: 5,
    });
    const buffer = Buffer.from(response.data);
    await (0, promises_1.writeFile)(artifactPath, buffer);
    const appearsReadableSqlite = buffer.subarray(0, SQLITE_HEADER.length).equals(SQLITE_HEADER);
    const metadata = {
        source: "client-assets-database-download",
        region: options.region,
        downloadedAt: new Date().toISOString(),
        databaseUrl: resolvedInput.databaseUrl,
        clientAssetsPayloadPath: options.clientAssetsJson,
        artifactPath,
        artifactFileName: (0, path_1.basename)(artifactPath),
        artifactByteLength: buffer.length,
        appearsReadableSqlite,
        dbVersion: resolvedInput.dbVersion,
        assetVersion: options.assetVersion ?? sourceSettings?.glbAssetVersion?.toString(),
        apkVersion: options.apkVersion ?? sourceSettings?.glbApkVersion,
        note: options.note,
        nextSuggestedCommand: buildNextSuggestedCommand({
            appearsReadableSqlite,
            artifactPath,
            settingsJson: options.settingsJson,
        }),
    };
    await (0, format_json_1.writeFormattedJson)(metadataPath, metadata);
    return {
        artifactPath,
        metadataPath,
        metadata,
    };
}
exports.downloadDatabaseArtifact = downloadDatabaseArtifact;
async function main() {
    const options = parseDownloadDatabaseArtifactArgs(process.argv.slice(2));
    const result = await downloadDatabaseArtifact(options);
    console.log(`Downloaded database artifact to ${result.artifactPath}`);
    console.log(`Wrote metadata to ${result.metadataPath}`);
    console.log(`Readable SQLite: ${result.metadata.appearsReadableSqlite ? "yes" : "no"}`);
    console.log(result.metadata.nextSuggestedCommand);
}
if (require.main === module) {
    main().catch(error => {
        console.error(error);
        process.exitCode = 1;
    });
}
//# sourceMappingURL=game-db-download-database-artifact.js.map