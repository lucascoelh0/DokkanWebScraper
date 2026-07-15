import { spawn } from "child_process";
import { existsSync } from "fs";
import { mkdir } from "fs/promises";
import { dirname, resolve } from "path";
import { GameDbSourceConfig, resolveGameDbSourceConfig } from "./game-db-source";

const DEFAULT_MIRROR_URL = "https://github.com/Nicholas1006/dokkan-backend.git";
const DEFAULT_MIRROR_DIR = resolve(__dirname, "data", "game-db-acquisition", "mirror", "dokkan-backend");
const DEFAULT_MIRROR_BRANCH = "main";
export const DEFAULT_FIRST_PARTY_DIR = resolve(__dirname, "data", "game-db-acquisition", "first-party", "latest");

export type GameDbAcquisitionMode = "existing-export" | "mirror-repo" | "first-party-export";

export interface GameDbFirstPartyExportMetadata {
    source: "first-party-export",
    region: "global" | "jp" | "unknown",
    exportedAt?: string,
    dbVersion?: string,
    assetVersion?: string,
    apkVersion?: string,
    notes?: string,
}

export interface GameDbAcquisitionOptions {
    mode?: GameDbAcquisitionMode,
    sourceRootOverride?: string,
    mirrorUrl?: string,
    mirrorDir?: string,
    mirrorBranch?: string,
    firstPartyDir?: string,
    skipSync?: boolean,
}

export interface GameDbAcquisitionReport {
    mode: GameDbAcquisitionMode,
    sourceRoot: string,
    dataDir: string,
    settingsPath?: string,
    mirror?: {
        url: string,
        dir: string,
        branch: string,
        synced: boolean,
    },
    firstParty?: {
        dir: string,
        metadataPath: string,
        metadata: GameDbFirstPartyExportMetadata,
    },
}

function normalizeMode(value?: string): GameDbAcquisitionMode | undefined {
    if (!value) {
        return undefined;
    }

    if (value === "existing-export" || value === "mirror-repo" || value === "first-party-export") {
        return value;
    }

    throw new Error(`Unsupported game DB acquisition mode: ${value}`);
}

async function spawnInherited(command: string, args: string[], cwd?: string): Promise<void> {
    await new Promise<void>((resolvePromise, rejectPromise) => {
        const child = spawn(command, args, {
            cwd,
            stdio: "inherit",
            shell: false,
        });

        child.on("error", error => {
            rejectPromise(error);
        });

        child.on("exit", code => {
            if (code && code !== 0) {
                rejectPromise(new Error(`Command failed with exit code ${code}: ${command} ${args.join(" ")}`));
                return;
            }

            resolvePromise();
        });
    });
}

function parseBooleanFlag(value?: string): boolean {
    return value === "1" || value === "true" || value === "yes";
}

export function resolveGameDbAcquisitionOptions(options?: GameDbAcquisitionOptions): Required<GameDbAcquisitionOptions> {
    const mode = options?.mode
        ?? normalizeMode(process.env.DOKKAN_GAME_DB_ACQUISITION_MODE)
        ?? "existing-export";
    const sourceRootOverride = options?.sourceRootOverride
        ?? process.env.DOKKAN_GAME_DB_SOURCE_ROOT
        ?? "";
    const mirrorUrl = options?.mirrorUrl
        ?? process.env.DOKKAN_GAME_DB_MIRROR_URL
        ?? DEFAULT_MIRROR_URL;
    const mirrorDir = resolve(options?.mirrorDir
        ?? process.env.DOKKAN_GAME_DB_MIRROR_DIR
        ?? DEFAULT_MIRROR_DIR);
    const mirrorBranch = options?.mirrorBranch
        ?? process.env.DOKKAN_GAME_DB_MIRROR_BRANCH
        ?? DEFAULT_MIRROR_BRANCH;
    const firstPartyDir = resolve(options?.firstPartyDir
        ?? process.env.DOKKAN_GAME_DB_FIRST_PARTY_DIR
        ?? DEFAULT_FIRST_PARTY_DIR);
    const skipSync = options?.skipSync
        ?? parseBooleanFlag(process.env.DOKKAN_GAME_DB_SKIP_SYNC);

    return {
        mode,
        sourceRootOverride,
        mirrorUrl,
        mirrorDir,
        mirrorBranch,
        firstPartyDir,
        skipSync,
    };
}

async function syncMirrorRepo(options: Required<GameDbAcquisitionOptions>): Promise<string> {
    await mkdir(dirname(options.mirrorDir), { recursive: true });

    if (!existsSync(options.mirrorDir)) {
        if (options.skipSync) {
            throw new Error(`Mirror directory does not exist and sync is disabled: ${options.mirrorDir}`);
        }

        console.log(`Cloning game DB mirror from ${options.mirrorUrl}...`);
        if (process.platform === "win32") {
            await spawnInherited("cmd.exe", [
                "/d",
                "/s",
                "/c",
                "git",
                "clone",
                "--branch",
                options.mirrorBranch,
                "--single-branch",
                options.mirrorUrl,
                options.mirrorDir,
            ]);
        } else {
            await spawnInherited("git", [
                "clone",
                "--branch",
                options.mirrorBranch,
                "--single-branch",
                options.mirrorUrl,
                options.mirrorDir,
            ]);
        }

        return options.mirrorDir;
    }

    if (options.skipSync) {
        return options.mirrorDir;
    }

    console.log(`Updating game DB mirror in ${options.mirrorDir}...`);
    if (process.platform === "win32") {
        await spawnInherited("cmd.exe", ["/d", "/s", "/c", "git", "-C", options.mirrorDir, "fetch", "origin", options.mirrorBranch]);
        await spawnInherited("cmd.exe", ["/d", "/s", "/c", "git", "-C", options.mirrorDir, "checkout", options.mirrorBranch]);
        await spawnInherited("cmd.exe", ["/d", "/s", "/c", "git", "-C", options.mirrorDir, "pull", "--ff-only", "origin", options.mirrorBranch]);
    } else {
        await spawnInherited("git", ["-C", options.mirrorDir, "fetch", "origin", options.mirrorBranch]);
        await spawnInherited("git", ["-C", options.mirrorDir, "checkout", options.mirrorBranch]);
        await spawnInherited("git", ["-C", options.mirrorDir, "pull", "--ff-only", "origin", options.mirrorBranch]);
    }

    return options.mirrorDir;
}

async function readFirstPartyExportMetadata(rootDir: string): Promise<{
    metadataPath: string,
    metadata: GameDbFirstPartyExportMetadata,
}> {
    const metadataPath = resolve(rootDir, "metadata.json");
    if (!existsSync(metadataPath)) {
        throw new Error(
            `First-party export metadata is missing: ${metadataPath}. ` +
            "Expected a metadata.json file describing the export contract.",
        );
    }

    const { readFile } = await import("fs/promises");
    const rawMetadata = await readFile(metadataPath, "utf8");
    const metadata = JSON.parse(rawMetadata) as Partial<GameDbFirstPartyExportMetadata>;

    if (metadata.source !== "first-party-export") {
        throw new Error(`Invalid first-party export metadata source in ${metadataPath}`);
    }

    return {
        metadataPath,
        metadata: {
            source: "first-party-export",
            region: metadata.region ?? "unknown",
            exportedAt: metadata.exportedAt,
            dbVersion: metadata.dbVersion,
            assetVersion: metadata.assetVersion,
            apkVersion: metadata.apkVersion,
            notes: metadata.notes,
        },
    };
}

export async function acquireGameDbSource(options?: GameDbAcquisitionOptions): Promise<{
    sourceConfig: GameDbSourceConfig,
    report: GameDbAcquisitionReport,
}> {
    const resolvedOptions = resolveGameDbAcquisitionOptions(options);

    if (resolvedOptions.mode === "existing-export") {
        const sourceConfig = resolveGameDbSourceConfig(resolvedOptions.sourceRootOverride || undefined);
        return {
            sourceConfig,
            report: {
                mode: "existing-export",
                sourceRoot: sourceConfig.sourceRoot,
                dataDir: sourceConfig.dataDir,
                settingsPath: sourceConfig.settingsPath,
            },
        };
    }

    if (resolvedOptions.mode === "first-party-export") {
        const sourceConfig = resolveGameDbSourceConfig(resolvedOptions.firstPartyDir);
        const firstParty = await readFirstPartyExportMetadata(resolvedOptions.firstPartyDir);

        return {
            sourceConfig,
            report: {
                mode: "first-party-export",
                sourceRoot: sourceConfig.sourceRoot,
                dataDir: sourceConfig.dataDir,
                settingsPath: sourceConfig.settingsPath,
                firstParty: {
                    dir: resolvedOptions.firstPartyDir,
                    metadataPath: firstParty.metadataPath,
                    metadata: firstParty.metadata,
                },
            },
        };
    }

    const mirrorRoot = await syncMirrorRepo(resolvedOptions);
    const sourceConfig = resolveGameDbSourceConfig(mirrorRoot);
    return {
        sourceConfig,
        report: {
            mode: "mirror-repo",
            sourceRoot: sourceConfig.sourceRoot,
            dataDir: sourceConfig.dataDir,
            settingsPath: sourceConfig.settingsPath,
            mirror: {
                url: resolvedOptions.mirrorUrl,
                dir: resolvedOptions.mirrorDir,
                branch: resolvedOptions.mirrorBranch,
                synced: !resolvedOptions.skipSync,
            },
        },
    };
}

