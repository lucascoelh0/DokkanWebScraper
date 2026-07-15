import { spawnSync } from "child_process";
import { mkdir, readFile } from "fs/promises";
import { basename, resolve } from "path";
import { readSourceSettings } from "./game-db-experiment";
import { writeFormattedJson } from "../format-json";

const DEFAULT_PACKAGE_NAME = "com.bandainamcogames.dbzdokkanww";
const DEFAULT_OUTPUT_DIR = resolve(__dirname, "data", "game-db-acquisition", "downloads", "emulator-backup-latest");
const SQLITE_HEADER = Buffer.from("SQLite format 3\u0000", "utf8");

export interface PullEmulatorDatabaseArtifactOptions {
    adbPath: string,
    deviceSerial?: string,
    packageName: string,
    remotePath: string,
    outputDir: string,
    outputFileName: string,
    settingsJson?: string,
    dbVersion?: string,
    assetVersion?: string,
    apkVersion?: string,
    region: "global" | "jp" | "unknown",
    note: string,
    ensureAdbRoot: boolean,
}

export interface PulledEmulatorDatabaseArtifactMetadata {
    source: "emulator-backup-pull",
    region: "global" | "jp" | "unknown",
    packageName: string,
    remotePath: string,
    pulledAt: string,
    adbPath: string,
    deviceSerial?: string,
    adbRootResult: "skipped" | "already-root" | "restarted-as-root" | "not-supported",
    artifactPath: string,
    artifactFileName: string,
    artifactByteLength: number,
    artifactHeaderHex: string,
    appearsReadableSqlite: boolean,
    dbVersion?: string,
    assetVersion?: string,
    apkVersion?: string,
    note: string,
    nextSuggestedCommand: string,
}

export interface ArtifactBufferSummary {
    artifactByteLength: number,
    artifactHeaderHex: string,
    appearsReadableSqlite: boolean,
}

export function buildDefaultDokkanBackupPath(packageName = DEFAULT_PACKAGE_NAME): string {
    return `/data/data/${packageName}/files/backup/database.db`;
}

export function summarizeArtifactBuffer(buffer: Buffer): ArtifactBufferSummary {
    return {
        artifactByteLength: buffer.length,
        artifactHeaderHex: buffer.subarray(0, 16).toString("hex"),
        appearsReadableSqlite: buffer.subarray(0, SQLITE_HEADER.length).equals(SQLITE_HEADER),
    };
}

export function parsePullEmulatorDatabaseArtifactArgs(argv: string[]): PullEmulatorDatabaseArtifactOptions {
    let adbPath = "adb";
    let deviceSerial: string | undefined;
    let packageName = DEFAULT_PACKAGE_NAME;
    let remotePath = buildDefaultDokkanBackupPath(packageName);
    let outputDir = DEFAULT_OUTPUT_DIR;
    let outputFileName = "database.db";
    let settingsJson: string | undefined;
    let dbVersion: string | undefined;
    let assetVersion: string | undefined;
    let apkVersion: string | undefined;
    let region: "global" | "jp" | "unknown" = "global";
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
            outputDir = resolve(token.includes("=") ? token.split("=", 2)[1] : argv[++index]);
            continue;
        }

        if (token === "--output-file-name" || token.startsWith("--output-file-name=")) {
            outputFileName = token.includes("=") ? token.split("=", 2)[1] : argv[++index];
            continue;
        }

        if (token === "--settings-json" || token.startsWith("--settings-json=")) {
            settingsJson = resolve(token.includes("=") ? token.split("=", 2)[1] : argv[++index]);
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

function buildAdbArgs(options: PullEmulatorDatabaseArtifactOptions, args: string[]): string[] {
    return options.deviceSerial
        ? ["-s", options.deviceSerial, ...args]
        : args;
}

function runAdbCommand(options: PullEmulatorDatabaseArtifactOptions, args: string[]): {
    stdout: string,
    stderr: string,
    status: number | null,
} {
    const result = spawnSync(options.adbPath, buildAdbArgs(options, args), {
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

function buildNextSuggestedCommand(args: {
    appearsReadableSqlite: boolean,
    artifactPath: string,
    settingsJson?: string,
}): string {
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

function ensureAdbRootIfNeeded(options: PullEmulatorDatabaseArtifactOptions): PulledEmulatorDatabaseArtifactMetadata["adbRootResult"] {
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

export async function pullEmulatorDatabaseArtifact(options: PullEmulatorDatabaseArtifactOptions): Promise<{
    artifactPath: string,
    metadataPath: string,
    metadata: PulledEmulatorDatabaseArtifactMetadata,
}> {
    const sourceSettings = options.settingsJson ? await readSourceSettings(options.settingsJson) : undefined;
    const artifactPath = resolve(options.outputDir, options.outputFileName);
    const metadataPath = resolve(options.outputDir, "pull-metadata.json");

    await mkdir(options.outputDir, { recursive: true });

    const adbRootResult = ensureAdbRootIfNeeded(options);
    const pullResult = runAdbCommand(options, ["pull", options.remotePath, artifactPath]);
    if (pullResult.status !== 0) {
        const pullOutput = `${pullResult.stdout}\n${pullResult.stderr}`.trim();
        throw new Error(`adb pull failed: ${pullOutput || `exit code ${pullResult.status}`}`);
    }

    const buffer = await readFile(artifactPath);
    const summary = summarizeArtifactBuffer(buffer);
    const metadata: PulledEmulatorDatabaseArtifactMetadata = {
        source: "emulator-backup-pull",
        region: options.region,
        packageName: options.packageName,
        remotePath: options.remotePath,
        pulledAt: new Date().toISOString(),
        adbPath: options.adbPath,
        deviceSerial: options.deviceSerial,
        adbRootResult,
        artifactPath,
        artifactFileName: basename(artifactPath),
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

    await writeFormattedJson(metadataPath, metadata);

    return {
        artifactPath,
        metadataPath,
        metadata,
    };
}

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

