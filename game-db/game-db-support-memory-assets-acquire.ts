import { spawnSync } from "child_process";
import { mkdir, stat } from "fs/promises";
import { basename, dirname, resolve } from "path";
import { writeFormattedJson } from "../format-json";
import { SupportMemoryGameAssetSourceIdentity } from "./game-db-support-memory-assets";
import { GameDbRow, GameDbSourceConfig, normalizeDbId, readGameDbTable } from "./game-db-source";

const PACKAGE_NAME = "com.bandainamcogames.dbzdokkanww";
const ASSET_ROOT = `/data/user/0/${PACKAGE_NAME}/files/assets`;

interface Options {
    adbPath: string,
    deviceSerial?: string,
    sourceDataDir: string,
    snapshotVersion: string,
    assetVersion?: string,
    outputDir: string,
    cpkExtractor: string,
    cpkReaderCommit: string,
}

interface ArchivePlan {
    remotePath: string,
    localPath: string,
    extractedPath: string,
}

function rowId(row: GameDbRow, column = "id"): string {
    const value = normalizeDbId(row[column]);
    if (!value) throw new Error(`Support Memory asset acquisition row is missing ${column}`);
    return value;
}

export function deriveSupportMemoryAnimationAssetIds(
    memories: GameDbRow[],
    enhancementLevels: GameDbRow[],
): Array<{ memoryId: string, scriptAssetId: string }> {
    const enhancedIds = new Set(enhancementLevels.map(row => rowId(row, "enhanced_support_memory_id")));
    const seenMemoryIds = new Set<string>();
    const seenAssetIds = new Set<string>();
    return memories
        .filter(row => !enhancedIds.has(rowId(row)))
        .sort((left, right) => Number(rowId(left)) - Number(rowId(right)))
        .map(row => {
            const memoryId = rowId(row);
            if (seenMemoryIds.has(memoryId)) throw new Error(`Duplicate root Support Memory ${memoryId}`);
            seenMemoryIds.add(memoryId);
            const match = /^sm(\d+)$/.exec(row.script_name?.trim() ?? "");
            if (!match) throw new Error(`Support Memory ${memoryId} has unsupported script_name ${row.script_name ?? ""}`);
            const scriptAssetId = match[1];
            if (seenAssetIds.has(scriptAssetId)) throw new Error(`Duplicate Support Memory animation asset ${scriptAssetId}`);
            seenAssetIds.add(scriptAssetId);
            return { memoryId, scriptAssetId };
        });
}

export function parseSupportMemoryAssetAcquisitionArgs(args: string[]): Options {
    const supported = new Set([
        "--adb-path", "--device-serial", "--source-data-dir", "--snapshot-version",
        "--asset-version", "--output-dir", "--cpk-extractor", "--cpk-reader-commit",
    ]);
    const values = new Map<string, string>();
    for (let index = 0; index < args.length; index += 1) {
        const token = args[index];
        const separator = token.indexOf("=");
        const key = separator >= 0 ? token.slice(0, separator) : token;
        if (!supported.has(key)) throw new Error(`Unexpected Support Memory asset acquisition argument: ${token}`);
        const value = separator >= 0 ? token.slice(separator + 1) : args[++index];
        if (!value || values.has(key)) throw new Error(`Missing or duplicate Support Memory asset acquisition argument: ${key}`);
        values.set(key, value);
    }
    const required = ["--source-data-dir", "--snapshot-version", "--output-dir", "--cpk-extractor", "--cpk-reader-commit"];
    for (const key of required) if (!values.has(key)) throw new Error(`Missing Support Memory asset acquisition argument: ${key}`);
    const snapshotVersion = values.get("--snapshot-version")!;
    const assetVersion = values.get("--asset-version");
    const cpkReaderCommit = values.get("--cpk-reader-commit")!;
    if (!/^\d+$/.test(snapshotVersion) || (assetVersion && !/^\d+$/.test(assetVersion))) throw new Error("Support Memory asset versions must be numeric");
    if (!/^[a-f0-9]{40}$/.test(cpkReaderCommit)) throw new Error("Support Memory CPK reader commit is invalid");
    return {
        adbPath: values.get("--adb-path") ?? "adb",
        ...(values.get("--device-serial") ? { deviceSerial: values.get("--device-serial") } : {}),
        sourceDataDir: resolve(values.get("--source-data-dir")!),
        snapshotVersion,
        ...(assetVersion ? { assetVersion } : {}),
        outputDir: resolve(values.get("--output-dir")!),
        cpkExtractor: resolve(values.get("--cpk-extractor")!),
        cpkReaderCommit,
    };
}

function run(executable: string, args: string[], captureOutput = true): string {
    const result = spawnSync(executable, args, {
        encoding: captureOutput ? "utf8" : undefined,
        stdio: captureOutput ? "pipe" : ["ignore", "ignore", "pipe"],
        maxBuffer: 16 * 1024 * 1024,
    });
    if (result.error) throw result.error;
    if (result.status !== 0) {
        const stderr = Buffer.isBuffer(result.stderr) ? result.stderr.toString("utf8") : result.stderr ?? "";
        throw new Error(`${basename(executable)} failed with exit ${result.status}: ${stderr.trim()}`);
    }
    const stdout = Buffer.isBuffer(result.stdout) ? result.stdout.toString("utf8") : result.stdout ?? "";
    const stderr = Buffer.isBuffer(result.stderr) ? result.stderr.toString("utf8") : result.stderr ?? "";
    return `${stdout}\n${stderr}`.trim();
}

function adbArgs(options: Options, args: string[]): string[] {
    return options.deviceSerial ? ["-s", options.deviceSerial, ...args] : args;
}

function runAdb(options: Options, args: string[]): string {
    return run(options.adbPath, adbArgs(options, args));
}

async function requireMissing(path: string): Promise<void> {
    try {
        await stat(path);
        throw new Error(`Support Memory asset source output must not already exist: ${path}`);
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
}

function extractArchive(options: Options, archive: ArchivePlan): void {
    const extractorArgs = options.cpkExtractor.toLowerCase().endsWith(".dll")
        ? [options.cpkExtractor, archive.localPath, archive.extractedPath]
        : [archive.localPath, archive.extractedPath];
    run(options.cpkExtractor.toLowerCase().endsWith(".dll") ? "dotnet" : options.cpkExtractor, extractorArgs, false);
}

export async function acquireSupportMemoryGameAssets(options: Options): Promise<SupportMemoryGameAssetSourceIdentity> {
    await requireMissing(options.outputDir);
    const sourceConfig: GameDbSourceConfig = { sourceRoot: options.sourceDataDir, dataDir: options.sourceDataDir };
    const [memories, enhancementLevels] = await Promise.all([
        readGameDbTable(sourceConfig, "support_memories"),
        readGameDbTable(sourceConfig, "support_memory_enhancement_levels"),
    ]);
    const animationAssets = deriveSupportMemoryAnimationAssetIds(memories, enhancementLevels);

    const rootResult = runAdb(options, ["root"]);
    if (/restarting adbd as root/i.test(rootResult)) runAdb(options, ["wait-for-device"]);
    if (/cannot run as root/i.test(rootResult)) throw new Error("Support Memory asset acquisition requires a rooted emulator");
    const packageInfo = runAdb(options, ["shell", "dumpsys", "package", PACKAGE_NAME]);
    const versionName = /^\s*versionName=(\S+)/m.exec(packageInfo)?.[1];
    const versionCode = /^\s*versionCode=(\d+)/m.exec(packageInfo)?.[1];
    if (!versionName || !versionCode) throw new Error(`Installed Dokkan package ${PACKAGE_NAME} has no readable version identity`);

    const archives: ArchivePlan[] = [
        {
            remotePath: `${ASSET_ROOT}/item/support_memory.cpk`,
            localPath: resolve(options.outputDir, "archives", "support_memory.cpk"),
            extractedPath: resolve(options.outputDir, "extracted", "support_memory"),
        },
        {
            remotePath: `${ASSET_ROOT}/item/support_memory_enhancement.cpk`,
            localPath: resolve(options.outputDir, "archives", "support_memory_enhancement.cpk"),
            extractedPath: resolve(options.outputDir, "extracted", "support_memory_enhancement"),
        },
        ...animationAssets.map(({ scriptAssetId }) => ({
            remotePath: `${ASSET_ROOT}/ingame/battle/effect/support_memory_${scriptAssetId}.cpk`,
            localPath: resolve(options.outputDir, "archives", "animations", `support_memory_${scriptAssetId}.cpk`),
            extractedPath: resolve(options.outputDir, "extracted", "animations", scriptAssetId),
        })),
    ];
    await mkdir(options.outputDir, { recursive: false });
    for (const archive of archives) {
        await mkdir(dirname(archive.localPath), { recursive: true });
        runAdb(options, ["pull", archive.remotePath, archive.localPath]);
        const pulled = await stat(archive.localPath);
        if (!pulled.isFile() || pulled.size <= 0) throw new Error(`ADB produced an invalid Support Memory archive: ${archive.remotePath}`);
        extractArchive(options, archive);
    }

    const sourceIdentity: SupportMemoryGameAssetSourceIdentity = {
        packageName: PACKAGE_NAME,
        versionName,
        versionCode,
        databaseSnapshotVersion: options.snapshotVersion,
        ...(options.assetVersion ? { assetVersion: options.assetVersion } : {}),
        acquiredAt: new Date().toISOString(),
        cpkReader: {
            repository: "https://github.com/Sewer56/CriFsV2Lib",
            commit: options.cpkReaderCommit,
        },
    };
    await writeFormattedJson(resolve(options.outputDir, "source-identity.json"), sourceIdentity);
    return sourceIdentity;
}

async function main(): Promise<void> {
    const options = parseSupportMemoryAssetAcquisitionArgs(process.argv.slice(2));
    const identity = await acquireSupportMemoryGameAssets(options);
    console.log(JSON.stringify({
        outputDir: options.outputDir,
        packageName: identity.packageName,
        versionName: identity.versionName,
        versionCode: identity.versionCode,
        snapshotVersion: options.snapshotVersion,
    }, null, 2));
}

if (require.main === module) {
    main().catch(error => {
        console.error(error);
        process.exitCode = 1;
    });
}
