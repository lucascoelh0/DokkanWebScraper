"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.acquireGameDbSource = exports.resolveGameDbAcquisitionOptions = exports.DEFAULT_FIRST_PARTY_DIR = void 0;
const child_process_1 = require("child_process");
const fs_1 = require("fs");
const promises_1 = require("fs/promises");
const path_1 = require("path");
const game_db_source_1 = require("./game-db-source");
const DEFAULT_MIRROR_URL = "https://github.com/Nicholas1006/dokkan-backend.git";
const DEFAULT_MIRROR_DIR = (0, path_1.resolve)(__dirname, "data", "game-db-acquisition", "mirror", "dokkan-backend");
const DEFAULT_MIRROR_BRANCH = "main";
exports.DEFAULT_FIRST_PARTY_DIR = (0, path_1.resolve)(__dirname, "data", "game-db-acquisition", "first-party", "latest");
function normalizeMode(value) {
    if (!value) {
        return undefined;
    }
    if (value === "existing-export" || value === "mirror-repo" || value === "first-party-export") {
        return value;
    }
    throw new Error(`Unsupported game DB acquisition mode: ${value}`);
}
async function spawnInherited(command, args, cwd) {
    await new Promise((resolvePromise, rejectPromise) => {
        const child = (0, child_process_1.spawn)(command, args, {
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
function parseBooleanFlag(value) {
    return value === "1" || value === "true" || value === "yes";
}
function resolveGameDbAcquisitionOptions(options) {
    const mode = options?.mode
        ?? normalizeMode(process.env.DOKKAN_GAME_DB_ACQUISITION_MODE)
        ?? "existing-export";
    const sourceRootOverride = options?.sourceRootOverride
        ?? process.env.DOKKAN_GAME_DB_SOURCE_ROOT
        ?? "";
    const mirrorUrl = options?.mirrorUrl
        ?? process.env.DOKKAN_GAME_DB_MIRROR_URL
        ?? DEFAULT_MIRROR_URL;
    const mirrorDir = (0, path_1.resolve)(options?.mirrorDir
        ?? process.env.DOKKAN_GAME_DB_MIRROR_DIR
        ?? DEFAULT_MIRROR_DIR);
    const mirrorBranch = options?.mirrorBranch
        ?? process.env.DOKKAN_GAME_DB_MIRROR_BRANCH
        ?? DEFAULT_MIRROR_BRANCH;
    const firstPartyDir = (0, path_1.resolve)(options?.firstPartyDir
        ?? process.env.DOKKAN_GAME_DB_FIRST_PARTY_DIR
        ?? exports.DEFAULT_FIRST_PARTY_DIR);
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
exports.resolveGameDbAcquisitionOptions = resolveGameDbAcquisitionOptions;
async function syncMirrorRepo(options) {
    await (0, promises_1.mkdir)((0, path_1.dirname)(options.mirrorDir), { recursive: true });
    if (!(0, fs_1.existsSync)(options.mirrorDir)) {
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
        }
        else {
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
    }
    else {
        await spawnInherited("git", ["-C", options.mirrorDir, "fetch", "origin", options.mirrorBranch]);
        await spawnInherited("git", ["-C", options.mirrorDir, "checkout", options.mirrorBranch]);
        await spawnInherited("git", ["-C", options.mirrorDir, "pull", "--ff-only", "origin", options.mirrorBranch]);
    }
    return options.mirrorDir;
}
async function readFirstPartyExportMetadata(rootDir) {
    const metadataPath = (0, path_1.resolve)(rootDir, "metadata.json");
    if (!(0, fs_1.existsSync)(metadataPath)) {
        throw new Error(`First-party export metadata is missing: ${metadataPath}. ` +
            "Expected a metadata.json file describing the export contract.");
    }
    const { readFile } = await Promise.resolve().then(() => require("fs/promises"));
    const rawMetadata = await readFile(metadataPath, "utf8");
    const metadata = JSON.parse(rawMetadata);
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
async function acquireGameDbSource(options) {
    const resolvedOptions = resolveGameDbAcquisitionOptions(options);
    if (resolvedOptions.mode === "existing-export") {
        const sourceConfig = (0, game_db_source_1.resolveGameDbSourceConfig)(resolvedOptions.sourceRootOverride || undefined);
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
        const sourceConfig = (0, game_db_source_1.resolveGameDbSourceConfig)(resolvedOptions.firstPartyDir);
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
    const sourceConfig = (0, game_db_source_1.resolveGameDbSourceConfig)(mirrorRoot);
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
exports.acquireGameDbSource = acquireGameDbSource;
//# sourceMappingURL=game-db-acquisition.js.map