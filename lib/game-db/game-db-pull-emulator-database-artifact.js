"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.pullEmulatorDatabaseArtifact = exports.parsePullEmulatorDatabaseArtifactArgs = exports.summarizeArtifactBuffer = exports.buildDefaultDokkanBackupPath = void 0;
const child_process_1 = require("child_process");
const promises_1 = require("fs/promises");
const path_1 = require("path");
const game_db_source_settings_1 = require("./game-db-source-settings");
const format_json_1 = require("../format-json");
const DEFAULT_PACKAGE_NAME = "com.bandainamcogames.dbzdokkanww";
const DEFAULT_OUTPUT_DIR = (0, path_1.resolve)(__dirname, "data", "game-db-acquisition", "downloads", "emulator-backup-latest");
const SQLITE_HEADER = Buffer.from("SQLite format 3\u0000", "utf8");
function buildDefaultDokkanBackupPath(packageName = DEFAULT_PACKAGE_NAME) {
    return `/data/data/${packageName}/files/backup/database.db`;
}
exports.buildDefaultDokkanBackupPath = buildDefaultDokkanBackupPath;
function summarizeArtifactBuffer(buffer) {
    return {
        artifactByteLength: buffer.length,
        artifactHeaderHex: buffer.subarray(0, 16).toString("hex"),
        appearsReadableSqlite: buffer.subarray(0, SQLITE_HEADER.length).equals(SQLITE_HEADER),
    };
}
exports.summarizeArtifactBuffer = summarizeArtifactBuffer;
function parsePullEmulatorDatabaseArtifactArgs(argv) {
    let adbPath = "adb";
    let deviceSerial;
    let packageName = DEFAULT_PACKAGE_NAME;
    let remotePath = buildDefaultDokkanBackupPath(packageName);
    let outputDir = DEFAULT_OUTPUT_DIR;
    let outputFileName = "database.db";
    let settingsJson;
    let dbVersion;
    let assetVersion;
    let apkVersion;
    let region = "global";
    let note = "Pulled from a rooted Android emulator Dokkan app sandbox backup path.";
    let ensureAdbRoot = true;
    for (let index = 0; index < argv.length; index += 1) {
        const token = argv[index];
        if (token === "--adb-path" || token.startsWith("--adb-path=")) {
            adbPath = token.includes("=") ? token.split("=", 2)[1] : argv[++index];
            continue;
        }
        if (token === "--device-serial" || token.startsWith("--device-serial=")) {
            deviceSerial = token.includes("=") ? token.split("=", 2)[1] : argv[++index];
            continue;
        }
        if (token === "--package-name" || token.startsWith("--package-name=")) {
            packageName = token.includes("=") ? token.split("=", 2)[1] : argv[++index];
            remotePath = buildDefaultDokkanBackupPath(packageName);
            continue;
        }
        if (token === "--remote-path" || token.startsWith("--remote-path=")) {
            remotePath = token.includes("=") ? token.split("=", 2)[1] : argv[++index];
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
        if (token === "--skip-adb-root") {
            ensureAdbRoot = false;
            continue;
        }
        throw new Error(`Unexpected argument: ${token}`);
    }
    return {
        adbPath,
        deviceSerial,
        packageName,
        remotePath,
        outputDir,
        outputFileName,
        settingsJson,
        dbVersion,
        assetVersion,
        apkVersion,
        region,
        note,
        ensureAdbRoot,
    };
}
exports.parsePullEmulatorDatabaseArtifactArgs = parsePullEmulatorDatabaseArtifactArgs;
function buildAdbArgs(options, args) {
    return options.deviceSerial
        ? ["-s", options.deviceSerial, ...args]
        : args;
}
function runAdbCommand(options, args) {
    const result = (0, child_process_1.spawnSync)(options.adbPath, buildAdbArgs(options, args), {
        encoding: "utf8",
    });
    if (result.error) {
        throw result.error;
    }
    return {
        stdout: result.stdout ?? "",
        stderr: result.stderr ?? "",
        status: result.status,
    };
}
function buildNextSuggestedCommand(args) {
    if (args.appearsReadableSqlite) {
        const settingsPart = args.settingsJson
            ? ` --settings-json "${args.settingsJson}"`
            : "";
        return `npm run experimental:game-db-build-first-party-export-from-sqlite -- --sqlite-path "${args.artifactPath}"${settingsPart}`;
    }
    return [
        "Decrypt this artifact first, then build the export with:",
        `npm run experimental:game-db-build-first-party-export-from-sqlite -- --sqlite-path "<decrypted-sqlite-path>"${args.settingsJson ? ` --settings-json "${args.settingsJson}"` : ""}`,
    ].join(" ");
}
function ensureAdbRootIfNeeded(options) {
    if (!options.ensureAdbRoot) {
        return "skipped";
    }
    const rootResult = runAdbCommand(options, ["root"]);
    const combinedOutput = `${rootResult.stdout}\n${rootResult.stderr}`.trim();
    if (rootResult.status !== 0) {
        if (/cannot run as root in production builds/i.test(combinedOutput)) {
            return "not-supported";
        }
        throw new Error(`adb root failed: ${combinedOutput || `exit code ${rootResult.status}`}`);
    }
    if (/restarting adbd as root/i.test(combinedOutput)) {
        const waitResult = runAdbCommand(options, ["wait-for-device"]);
        if (waitResult.status !== 0) {
            const waitOutput = `${waitResult.stdout}\n${waitResult.stderr}`.trim();
            throw new Error(`adb wait-for-device failed: ${waitOutput || `exit code ${waitResult.status}`}`);
        }
        return "restarted-as-root";
    }
    return "already-root";
}
async function pullEmulatorDatabaseArtifact(options) {
    const sourceSettings = options.settingsJson ? await (0, game_db_source_settings_1.readSourceSettings)(options.settingsJson) : undefined;
    const artifactPath = (0, path_1.resolve)(options.outputDir, options.outputFileName);
    const metadataPath = (0, path_1.resolve)(options.outputDir, "pull-metadata.json");
    await (0, promises_1.mkdir)(options.outputDir, { recursive: true });
    const adbRootResult = ensureAdbRootIfNeeded(options);
    const pullResult = runAdbCommand(options, ["pull", options.remotePath, artifactPath]);
    if (pullResult.status !== 0) {
        const pullOutput = `${pullResult.stdout}\n${pullResult.stderr}`.trim();
        throw new Error(`adb pull failed: ${pullOutput || `exit code ${pullResult.status}`}`);
    }
    const buffer = await (0, promises_1.readFile)(artifactPath);
    const summary = summarizeArtifactBuffer(buffer);
    const metadata = {
        source: "emulator-backup-pull",
        region: options.region,
        packageName: options.packageName,
        remotePath: options.remotePath,
        pulledAt: new Date().toISOString(),
        adbPath: options.adbPath,
        deviceSerial: options.deviceSerial,
        adbRootResult,
        artifactPath,
        artifactFileName: (0, path_1.basename)(artifactPath),
        artifactByteLength: summary.artifactByteLength,
        artifactHeaderHex: summary.artifactHeaderHex,
        appearsReadableSqlite: summary.appearsReadableSqlite,
        dbVersion: options.dbVersion,
        assetVersion: options.assetVersion ?? sourceSettings?.glbAssetVersion?.toString(),
        apkVersion: options.apkVersion ?? sourceSettings?.glbApkVersion,
        note: options.note,
        nextSuggestedCommand: buildNextSuggestedCommand({
            appearsReadableSqlite: summary.appearsReadableSqlite,
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
exports.pullEmulatorDatabaseArtifact = pullEmulatorDatabaseArtifact;
async function main() {
    const options = parsePullEmulatorDatabaseArtifactArgs(process.argv.slice(2));
    const result = await pullEmulatorDatabaseArtifact(options);
    console.log(`Pulled emulator database artifact to ${result.artifactPath}`);
    console.log(`Wrote metadata to ${result.metadataPath}`);
    console.log(`Readable SQLite: ${result.metadata.appearsReadableSqlite ? "yes" : "no"}`);
    console.log(`ADB root result: ${result.metadata.adbRootResult}`);
    console.log(`Header hex: ${result.metadata.artifactHeaderHex}`);
    console.log(result.metadata.nextSuggestedCommand);
}
if (require.main === module) {
    main().catch(error => {
        console.error(error);
        process.exitCode = 1;
    });
}
//# sourceMappingURL=game-db-pull-emulator-database-artifact.js.map