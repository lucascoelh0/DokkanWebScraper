import axios from "axios";
import { mkdir, readFile, writeFile } from "fs/promises";
import { basename, resolve } from "path";
import { readSourceSettings } from "./game-db-experiment";
import { writeFormattedJson } from "../format-json";

const DEFAULT_OUTPUT_DIR = resolve(__dirname, "data", "game-db-acquisition", "downloads", "latest");
const SQLITE_HEADER = Buffer.from("SQLite format 3\u0000", "utf8");

export interface ClientAssetsDatabasePayload {
    url?: string,
    version?: string | number,
}

export interface GameDbDownloadDatabaseArtifactOptions {
    databaseUrl?: string,
    clientAssetsJson?: string,
    outputDir: string,
    outputFileName: string,
    settingsJson?: string,
    dbVersion?: string,
    assetVersion?: string,
    apkVersion?: string,
    region: "global" | "jp" | "unknown",
    note: string,
}

export interface GameDbDownloadedDatabaseArtifactMetadata {
    source: "client-assets-database-download",
    region: "global" | "jp" | "unknown",
    downloadedAt: string,
    databaseUrl: string,
    clientAssetsPayloadPath?: string,
    artifactPath: string,
    artifactFileName: string,
    artifactByteLength: number,
    appearsReadableSqlite: boolean,
    dbVersion?: string,
    assetVersion?: string,
    apkVersion?: string,
    note: string,
    nextSuggestedCommand: string,
}

export function parseDownloadDatabaseArtifactArgs(argv: string[]): GameDbDownloadDatabaseArtifactOptions {
    let databaseUrl: string | undefined;
    let clientAssetsJson: string | undefined;
    let outputDir = DEFAULT_OUTPUT_DIR;
    let outputFileName = "database.db";
    let settingsJson: string | undefined;
    let dbVersion: string | undefined;
    let assetVersion: string | undefined;
    let apkVersion: string | undefined;
    let region: "global" | "jp" | "unknown" = "global";
    let note = "Downloaded from a captured /client_assets/database response.";

    for (let index = 0; index < argv.length; index += 1) {
        const token = argv[index];

        if (token === "--database-url" || token.startsWith("--database-url=")) {
            databaseUrl = token.includes("=") ? token.split("=", 2)[1] : argv[++index];
            continue;
        }

        if (token === "--client-assets-json" || token.startsWith("--client-assets-json=")) {
            clientAssetsJson = resolve(token.includes("=") ? token.split("=", 2)[1] : argv[++index]);
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

export function resolveClientAssetsDatabaseInput(input: {
    explicitDatabaseUrl?: string,
    explicitDbVersion?: string,
    payload?: ClientAssetsDatabasePayload,
}): {
    databaseUrl: string,
    dbVersion?: string,
} {
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

async function readClientAssetsDatabasePayload(filePath?: string): Promise<ClientAssetsDatabasePayload | undefined> {
    if (!filePath) {
        return undefined;
    }

    const rawPayload = await readFile(filePath, "utf8");
    const parsedPayload = JSON.parse(rawPayload) as ClientAssetsDatabasePayload;
    return parsedPayload;
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

export async function downloadDatabaseArtifact(options: GameDbDownloadDatabaseArtifactOptions): Promise<{
    artifactPath: string,
    metadataPath: string,
    metadata: GameDbDownloadedDatabaseArtifactMetadata,
}> {
    const payload = await readClientAssetsDatabasePayload(options.clientAssetsJson);
    const resolvedInput = resolveClientAssetsDatabaseInput({
        explicitDatabaseUrl: options.databaseUrl,
        explicitDbVersion: options.dbVersion,
        payload,
    });

    const sourceSettings = options.settingsJson ? await readSourceSettings(options.settingsJson) : undefined;
    const artifactPath = resolve(options.outputDir, options.outputFileName);
    const metadataPath = resolve(options.outputDir, "download-metadata.json");

    await mkdir(options.outputDir, { recursive: true });

    const response = await axios.get<ArrayBuffer>(resolvedInput.databaseUrl, {
        responseType: "arraybuffer",
        maxRedirects: 5,
    });
    const buffer = Buffer.from(response.data);

    await writeFile(artifactPath, buffer);

    const appearsReadableSqlite = buffer.subarray(0, SQLITE_HEADER.length).equals(SQLITE_HEADER);
    const metadata: GameDbDownloadedDatabaseArtifactMetadata = {
        source: "client-assets-database-download",
        region: options.region,
        downloadedAt: new Date().toISOString(),
        databaseUrl: resolvedInput.databaseUrl,
        clientAssetsPayloadPath: options.clientAssetsJson,
        artifactPath,
        artifactFileName: basename(artifactPath),
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

    await writeFormattedJson(metadataPath, metadata);

    return {
        artifactPath,
        metadataPath,
        metadata,
    };
}

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

