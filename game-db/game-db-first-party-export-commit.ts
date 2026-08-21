import { constants, createWriteStream, existsSync } from "fs";
import { copyFile, lstat, mkdir, mkdtemp, open, readdir, realpath, rm, writeFile } from "fs/promises";
import { basename, dirname, isAbsolute, relative, resolve, sep } from "path";
import { pipeline } from "stream/promises";
import { GameDbFirstPartyExportMetadata } from "./game-db-acquisition";
import { FIRST_PARTY_EXPORT_GAME_DB_TABLES } from "./game-db-table-inventory";

async function assertRegularFile(path: string, label: string): Promise<void> {
    const stat = await lstat(path);
    if (!stat.isFile() || stat.isSymbolicLink()) {
        throw new Error(`${label} must be a regular non-symbolic-link file: ${path}`);
    }
}

export async function assertFirstPartyExportSourceInventory(dataDir: string): Promise<void> {
    for (const table of FIRST_PARTY_EXPORT_GAME_DB_TABLES) {
        const path = resolve(dataDir, `${table}.csv`);
        try {
            await assertRegularFile(path, `First-party source table ${table}`);
        } catch {
            throw new Error(`First-party source inventory is incomplete or invalid: ${table}.csv`);
        }
    }
}

function sameFileIdentity(
    left: { dev: number | bigint, ino: number | bigint },
    right: { dev: number | bigint, ino: number | bigint },
): boolean {
    return left.dev === right.dev && left.ino === right.ino;
}

async function copyVerifiedRegularFile(sourcePath: string, targetPath: string, label: string): Promise<void> {
    const pathBefore = await lstat(sourcePath);
    if (!pathBefore.isFile() || pathBefore.isSymbolicLink()) {
        throw new Error(`${label} must be a regular non-symbolic-link file: ${sourcePath}`);
    }

    const source = await open(sourcePath, "r");
    try {
        const openedBefore = await source.stat();
        if (!openedBefore.isFile()
            || !sameFileIdentity(pathBefore, openedBefore)
            || pathBefore.size !== openedBefore.size
            || pathBefore.mtimeMs !== openedBefore.mtimeMs) {
            throw new Error(`${label} changed while opening: ${sourcePath}`);
        }
        await pipeline(
            source.createReadStream({ autoClose: false }),
            createWriteStream(targetPath, { flags: "wx" }),
        );
        const openedAfter = await source.stat();
        const pathAfter = await lstat(sourcePath);
        if (!sameFileIdentity(openedBefore, openedAfter)
            || !sameFileIdentity(openedBefore, pathAfter)
            || openedBefore.size !== openedAfter.size
            || openedBefore.mtimeMs !== openedAfter.mtimeMs
            || openedBefore.size !== pathAfter.size
            || openedBefore.mtimeMs !== pathAfter.mtimeMs
            || !pathAfter.isFile()
            || pathAfter.isSymbolicLink()) {
            throw new Error(`${label} changed while copying: ${sourcePath}`);
        }
    } finally {
        await source.close();
    }
}

export async function copyFirstPartyExportSourceInventory(
    sourceDataDir: string,
    targetDataDir: string,
): Promise<void> {
    await assertFirstPartyExportSourceInventory(sourceDataDir);
    for (const table of FIRST_PARTY_EXPORT_GAME_DB_TABLES) {
        await copyVerifiedRegularFile(
            resolve(sourceDataDir, `${table}.csv`),
            resolve(targetDataDir, `${table}.csv`),
            `First-party source table ${table}`,
        );
    }
}

function containsPath(parent: string, child: string): boolean {
    const path = relative(resolve(parent), resolve(child));
    return path === "" || (path !== ".." && !path.startsWith(`..${sep}`) && !isAbsolute(path));
}

async function physicalPath(path: string): Promise<string> {
    let existing = resolve(path);
    while (!existsSync(existing)) {
        const parent = dirname(existing);
        if (parent === existing) {
            throw new Error(`Unable to resolve an existing parent for path: ${path}`);
        }
        existing = parent;
    }
    const physicalParent = await realpath(existing);
    return resolve(physicalParent, relative(existing, resolve(path)));
}

export async function assertNoFirstPartyExportPathOverlap(sourcePath: string, outputDir: string): Promise<void> {
    const physicalSource = await physicalPath(sourcePath);
    const physicalOutput = await physicalPath(outputDir);
    if (containsPath(physicalSource, physicalOutput) || containsPath(physicalOutput, physicalSource)) {
        throw new Error("First-party export source and output paths must not overlap");
    }
}

async function assertStagedExportInventory(stagingRoot: string): Promise<void> {
    const rootMembers = await readdir(stagingRoot, { withFileTypes: true });
    if (rootMembers.length !== 2
        || !rootMembers.some(member => member.name === "data" && member.isDirectory() && !member.isSymbolicLink())
        || !rootMembers.some(member => member.name === "metadata.json" && member.isFile() && !member.isSymbolicLink())) {
        throw new Error("Staged first-party export root inventory is invalid");
    }

    const dataDir = resolve(stagingRoot, "data");
    const actualMembers = await readdir(dataDir, { withFileTypes: true });
    const actualNames = actualMembers.map(member => member.name).sort();
    const expectedNames = FIRST_PARTY_EXPORT_GAME_DB_TABLES.map(table => `${table}.csv`).sort();
    if (JSON.stringify(actualNames) !== JSON.stringify(expectedNames)
        || actualMembers.some(member => !member.isFile() || member.isSymbolicLink())) {
        throw new Error("Staged first-party export table inventory is invalid");
    }

    await Promise.all(expectedNames.map(name => assertRegularFile(resolve(dataDir, name), `Staged table ${name}`)));
    await assertRegularFile(resolve(stagingRoot, "metadata.json"), "Staged metadata");
}

export async function commitFirstPartyExport(options: {
    outputDir: string,
    metadata: GameDbFirstPartyExportMetadata,
    materializeData: (stagingDataDir: string) => Promise<void>,
}): Promise<{ outputDir: string, metadataPath: string }> {
    return commitFirstPartyExportInternal(options);
}

export async function commitFirstPartyExportForTest(
    options: {
        outputDir: string,
        metadata: GameDbFirstPartyExportMetadata,
        materializeData: (stagingDataDir: string) => Promise<void>,
    },
    afterOutputClaimed: (outputDir: string, dataDir: string) => Promise<void>,
): Promise<{ outputDir: string, metadataPath: string }> {
    return commitFirstPartyExportInternal(options, afterOutputClaimed);
}

async function commitFirstPartyExportInternal(
    options: {
        outputDir: string,
        metadata: GameDbFirstPartyExportMetadata,
        materializeData: (stagingDataDir: string) => Promise<void>,
    },
    afterOutputClaimed?: (outputDir: string, dataDir: string) => Promise<void>,
): Promise<{ outputDir: string, metadataPath: string }> {
    const outputDir = resolve(options.outputDir);
    const parentDir = dirname(outputDir);
    const outputName = basename(outputDir);
    if (parentDir === outputDir || outputName.length === 0) {
        throw new Error(`Refusing unsafe first-party export output directory: ${outputDir}`);
    }

    await mkdir(parentDir, { recursive: true });
    const stagingRoot = await mkdtemp(resolve(parentDir, `.${outputName}.pending-`));
    const stagingDataDir = resolve(stagingRoot, "data");
    try {
        if (existsSync(outputDir)) {
            throw new Error(`Refusing to replace an existing first-party export directory: ${outputDir}`);
        }
        await mkdir(stagingDataDir);
        await options.materializeData(stagingDataDir);
        await writeFile(
            resolve(stagingRoot, "metadata.json"),
            `${JSON.stringify(options.metadata, null, 2)}\n`,
            { encoding: "utf8", flag: "wx" },
        );
        await assertStagedExportInventory(stagingRoot);

        try {
            await mkdir(outputDir);
        } catch {
            throw new Error(`First-party export output appeared during staging: ${outputDir}`);
        }
        const outputIdentity = await lstat(outputDir);
        if (!outputIdentity.isDirectory() || outputIdentity.isSymbolicLink()) {
            throw new Error(`Claimed first-party export output is invalid: ${outputDir}`);
        }
        const outputDataDir = resolve(outputDir, "data");
        await mkdir(outputDataDir);
        const dataIdentity = await lstat(outputDataDir);
        if (!dataIdentity.isDirectory() || dataIdentity.isSymbolicLink()) {
            throw new Error(`Claimed first-party export data directory is invalid: ${outputDataDir}`);
        }
        await afterOutputClaimed?.(outputDir, outputDataDir);
        for (const table of FIRST_PARTY_EXPORT_GAME_DB_TABLES) {
            const currentIdentity = await lstat(outputDir);
            const currentDataIdentity = await lstat(outputDataDir);
            if (!sameFileIdentity(outputIdentity, currentIdentity)
                || !currentIdentity.isDirectory()
                || currentIdentity.isSymbolicLink()) {
                throw new Error(`Claimed first-party export output changed during installation: ${outputDir}`);
            }
            if (!sameFileIdentity(dataIdentity, currentDataIdentity)
                || !currentDataIdentity.isDirectory()
                || currentDataIdentity.isSymbolicLink()) {
                throw new Error(`Claimed first-party export data directory changed during installation: ${outputDataDir}`);
            }
            await copyFile(
                resolve(stagingDataDir, `${table}.csv`),
                resolve(outputDataDir, `${table}.csv`),
                constants.COPYFILE_EXCL,
            );
        }
        const finalOutputIdentity = await lstat(outputDir);
        const finalDataIdentity = await lstat(outputDataDir);
        if (!sameFileIdentity(outputIdentity, finalOutputIdentity)
            || !finalOutputIdentity.isDirectory()
            || finalOutputIdentity.isSymbolicLink()
            || !sameFileIdentity(dataIdentity, finalDataIdentity)
            || !finalDataIdentity.isDirectory()
            || finalDataIdentity.isSymbolicLink()) {
            throw new Error(`Claimed first-party export directories changed before metadata installation: ${outputDir}`);
        }
        await copyFile(
            resolve(stagingRoot, "metadata.json"),
            resolve(outputDir, "metadata.json"),
            constants.COPYFILE_EXCL,
        );
        return {
            outputDir,
            metadataPath: resolve(outputDir, "metadata.json"),
        };
    } finally {
        if (existsSync(stagingRoot)) {
            await rm(stagingRoot, { recursive: true, force: true });
        }
    }
}
