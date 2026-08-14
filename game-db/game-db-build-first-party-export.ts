import { spawn } from "child_process";
import { mkdir, writeFile } from "fs/promises";
import { resolve } from "path";
import { DEFAULT_FIRST_PARTY_DIR, GameDbFirstPartyExportMetadata } from "./game-db-acquisition";
import { REQUIRED_GAME_DB_TABLES, readSourceSettings } from "./game-db-experiment";

export interface GameDbBuildFirstPartyExportOptions {
    sqlitePath: string,
    outputDir: string,
    settingsJson?: string,
    dbVersion?: string,
    assetVersion?: string,
    apkVersion?: string,
    region: "global" | "jp" | "unknown",
    note: string,
}

// Historical development utility only. This loose-path contract is not AQ/C4,
// does not emit acquiredArtifactState, and cannot establish productive lineage.

export function parseBuildFirstPartyExportArgs(argv: string[]): GameDbBuildFirstPartyExportOptions {
    let sqlitePath = "";
    let outputDir = DEFAULT_FIRST_PARTY_DIR;
    let settingsJson: string | undefined;
    let dbVersion: string | undefined;
    let assetVersion: string | undefined;
    let apkVersion: string | undefined;
    let region: "global" | "jp" | "unknown" = "global";
    let note = "Exported directly from a local Dokkan SQLite database.";

    for (let index = 0; index < argv.length; index += 1) {
        const token = argv[index];

        if (token === "--sqlite-path" || token.startsWith("--sqlite-path=")) {
            sqlitePath = resolve(token.includes("=") ? token.split("=", 2)[1] : argv[++index]);
            continue;
        }

        if (token === "--output-dir" || token.startsWith("--output-dir=")) {
            outputDir = resolve(token.includes("=") ? token.split("=", 2)[1] : argv[++index]);
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

async function spawnInherited(command: string, args: string[]): Promise<void> {
    await new Promise<void>((resolvePromise, rejectPromise) => {
        const child = spawn(command, args, {
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

async function exportSqliteTables(sqlitePath: string, outputDir: string): Promise<void> {
    const args = [
        resolve(__dirname, "game-db-export-sqlite.py"),
        "--sqlite-path",
        sqlitePath,
        "--output-dir",
        outputDir,
        ...REQUIRED_GAME_DB_TABLES.flatMap(tableName => ["--table", tableName]),
    ];

    if (process.platform === "win32") {
        await spawnInherited("python", args);
        return;
    }

    await spawnInherited("python3", args);
}

export async function buildFirstPartyExport(options: GameDbBuildFirstPartyExportOptions): Promise<{
    outputDir: string,
    metadataPath: string,
    exportedTableCount: number,
}> {
    const dataDir = resolve(options.outputDir, "data");
    const metadataPath = resolve(options.outputDir, "metadata.json");
    const sourceSettings = options.settingsJson ? await readSourceSettings(options.settingsJson) : undefined;

    await mkdir(dataDir, { recursive: true });
    await exportSqliteTables(options.sqlitePath, dataDir);

    const metadata: GameDbFirstPartyExportMetadata = {
        source: "first-party-export",
        region: options.region,
        exportedAt: new Date().toISOString(),
        dbVersion: options.dbVersion ?? sourceSettings?.glbDbVersion?.toString(),
        assetVersion: options.assetVersion ?? sourceSettings?.glbAssetVersion?.toString(),
        apkVersion: options.apkVersion ?? sourceSettings?.glbApkVersion,
        notes: options.note,
    };

    await writeFile(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`, "utf8");

    return {
        outputDir: options.outputDir,
        metadataPath,
        exportedTableCount: REQUIRED_GAME_DB_TABLES.length,
    };
}

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

