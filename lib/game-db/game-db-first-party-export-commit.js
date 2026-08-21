"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.commitFirstPartyExportForTest = exports.commitFirstPartyExport = exports.assertNoFirstPartyExportPathOverlap = exports.copyFirstPartyExportSourceInventory = exports.assertFirstPartyExportSourceInventory = void 0;
const fs_1 = require("fs");
const promises_1 = require("fs/promises");
const path_1 = require("path");
const promises_2 = require("stream/promises");
const game_db_table_inventory_1 = require("./game-db-table-inventory");
async function assertRegularFile(path, label) {
    const stat = await (0, promises_1.lstat)(path);
    if (!stat.isFile() || stat.isSymbolicLink()) {
        throw new Error(`${label} must be a regular non-symbolic-link file: ${path}`);
    }
}
async function assertFirstPartyExportSourceInventory(dataDir) {
    for (const table of game_db_table_inventory_1.FIRST_PARTY_EXPORT_GAME_DB_TABLES) {
        const path = (0, path_1.resolve)(dataDir, `${table}.csv`);
        try {
            await assertRegularFile(path, `First-party source table ${table}`);
        }
        catch {
            throw new Error(`First-party source inventory is incomplete or invalid: ${table}.csv`);
        }
    }
}
exports.assertFirstPartyExportSourceInventory = assertFirstPartyExportSourceInventory;
function sameFileIdentity(left, right) {
    return left.dev === right.dev && left.ino === right.ino;
}
async function copyVerifiedRegularFile(sourcePath, targetPath, label) {
    const pathBefore = await (0, promises_1.lstat)(sourcePath);
    if (!pathBefore.isFile() || pathBefore.isSymbolicLink()) {
        throw new Error(`${label} must be a regular non-symbolic-link file: ${sourcePath}`);
    }
    const source = await (0, promises_1.open)(sourcePath, "r");
    try {
        const openedBefore = await source.stat();
        if (!openedBefore.isFile()
            || !sameFileIdentity(pathBefore, openedBefore)
            || pathBefore.size !== openedBefore.size
            || pathBefore.mtimeMs !== openedBefore.mtimeMs) {
            throw new Error(`${label} changed while opening: ${sourcePath}`);
        }
        await (0, promises_2.pipeline)(source.createReadStream({ autoClose: false }), (0, fs_1.createWriteStream)(targetPath, { flags: "wx" }));
        const openedAfter = await source.stat();
        const pathAfter = await (0, promises_1.lstat)(sourcePath);
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
    }
    finally {
        await source.close();
    }
}
async function copyFirstPartyExportSourceInventory(sourceDataDir, targetDataDir) {
    await assertFirstPartyExportSourceInventory(sourceDataDir);
    for (const table of game_db_table_inventory_1.FIRST_PARTY_EXPORT_GAME_DB_TABLES) {
        await copyVerifiedRegularFile((0, path_1.resolve)(sourceDataDir, `${table}.csv`), (0, path_1.resolve)(targetDataDir, `${table}.csv`), `First-party source table ${table}`);
    }
}
exports.copyFirstPartyExportSourceInventory = copyFirstPartyExportSourceInventory;
function containsPath(parent, child) {
    const path = (0, path_1.relative)((0, path_1.resolve)(parent), (0, path_1.resolve)(child));
    return path === "" || (path !== ".." && !path.startsWith(`..${path_1.sep}`) && !(0, path_1.isAbsolute)(path));
}
async function physicalPath(path) {
    let existing = (0, path_1.resolve)(path);
    while (!(0, fs_1.existsSync)(existing)) {
        const parent = (0, path_1.dirname)(existing);
        if (parent === existing) {
            throw new Error(`Unable to resolve an existing parent for path: ${path}`);
        }
        existing = parent;
    }
    const physicalParent = await (0, promises_1.realpath)(existing);
    return (0, path_1.resolve)(physicalParent, (0, path_1.relative)(existing, (0, path_1.resolve)(path)));
}
async function assertNoFirstPartyExportPathOverlap(sourcePath, outputDir) {
    const physicalSource = await physicalPath(sourcePath);
    const physicalOutput = await physicalPath(outputDir);
    if (containsPath(physicalSource, physicalOutput) || containsPath(physicalOutput, physicalSource)) {
        throw new Error("First-party export source and output paths must not overlap");
    }
}
exports.assertNoFirstPartyExportPathOverlap = assertNoFirstPartyExportPathOverlap;
async function assertStagedExportInventory(stagingRoot) {
    const rootMembers = await (0, promises_1.readdir)(stagingRoot, { withFileTypes: true });
    if (rootMembers.length !== 2
        || !rootMembers.some(member => member.name === "data" && member.isDirectory() && !member.isSymbolicLink())
        || !rootMembers.some(member => member.name === "metadata.json" && member.isFile() && !member.isSymbolicLink())) {
        throw new Error("Staged first-party export root inventory is invalid");
    }
    const dataDir = (0, path_1.resolve)(stagingRoot, "data");
    const actualMembers = await (0, promises_1.readdir)(dataDir, { withFileTypes: true });
    const actualNames = actualMembers.map(member => member.name).sort();
    const expectedNames = game_db_table_inventory_1.FIRST_PARTY_EXPORT_GAME_DB_TABLES.map(table => `${table}.csv`).sort();
    if (JSON.stringify(actualNames) !== JSON.stringify(expectedNames)
        || actualMembers.some(member => !member.isFile() || member.isSymbolicLink())) {
        throw new Error("Staged first-party export table inventory is invalid");
    }
    await Promise.all(expectedNames.map(name => assertRegularFile((0, path_1.resolve)(dataDir, name), `Staged table ${name}`)));
    await assertRegularFile((0, path_1.resolve)(stagingRoot, "metadata.json"), "Staged metadata");
}
async function commitFirstPartyExport(options) {
    return commitFirstPartyExportInternal(options);
}
exports.commitFirstPartyExport = commitFirstPartyExport;
async function commitFirstPartyExportForTest(options, afterOutputClaimed) {
    return commitFirstPartyExportInternal(options, afterOutputClaimed);
}
exports.commitFirstPartyExportForTest = commitFirstPartyExportForTest;
async function commitFirstPartyExportInternal(options, afterOutputClaimed) {
    const outputDir = (0, path_1.resolve)(options.outputDir);
    const parentDir = (0, path_1.dirname)(outputDir);
    const outputName = (0, path_1.basename)(outputDir);
    if (parentDir === outputDir || outputName.length === 0) {
        throw new Error(`Refusing unsafe first-party export output directory: ${outputDir}`);
    }
    await (0, promises_1.mkdir)(parentDir, { recursive: true });
    const stagingRoot = await (0, promises_1.mkdtemp)((0, path_1.resolve)(parentDir, `.${outputName}.pending-`));
    const stagingDataDir = (0, path_1.resolve)(stagingRoot, "data");
    try {
        if ((0, fs_1.existsSync)(outputDir)) {
            throw new Error(`Refusing to replace an existing first-party export directory: ${outputDir}`);
        }
        await (0, promises_1.mkdir)(stagingDataDir);
        await options.materializeData(stagingDataDir);
        await (0, promises_1.writeFile)((0, path_1.resolve)(stagingRoot, "metadata.json"), `${JSON.stringify(options.metadata, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
        await assertStagedExportInventory(stagingRoot);
        try {
            await (0, promises_1.mkdir)(outputDir);
        }
        catch {
            throw new Error(`First-party export output appeared during staging: ${outputDir}`);
        }
        const outputIdentity = await (0, promises_1.lstat)(outputDir);
        if (!outputIdentity.isDirectory() || outputIdentity.isSymbolicLink()) {
            throw new Error(`Claimed first-party export output is invalid: ${outputDir}`);
        }
        const outputDataDir = (0, path_1.resolve)(outputDir, "data");
        await (0, promises_1.mkdir)(outputDataDir);
        const dataIdentity = await (0, promises_1.lstat)(outputDataDir);
        if (!dataIdentity.isDirectory() || dataIdentity.isSymbolicLink()) {
            throw new Error(`Claimed first-party export data directory is invalid: ${outputDataDir}`);
        }
        await afterOutputClaimed?.(outputDir, outputDataDir);
        for (const table of game_db_table_inventory_1.FIRST_PARTY_EXPORT_GAME_DB_TABLES) {
            const currentIdentity = await (0, promises_1.lstat)(outputDir);
            const currentDataIdentity = await (0, promises_1.lstat)(outputDataDir);
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
            await (0, promises_1.copyFile)((0, path_1.resolve)(stagingDataDir, `${table}.csv`), (0, path_1.resolve)(outputDataDir, `${table}.csv`), fs_1.constants.COPYFILE_EXCL);
        }
        const finalOutputIdentity = await (0, promises_1.lstat)(outputDir);
        const finalDataIdentity = await (0, promises_1.lstat)(outputDataDir);
        if (!sameFileIdentity(outputIdentity, finalOutputIdentity)
            || !finalOutputIdentity.isDirectory()
            || finalOutputIdentity.isSymbolicLink()
            || !sameFileIdentity(dataIdentity, finalDataIdentity)
            || !finalDataIdentity.isDirectory()
            || finalDataIdentity.isSymbolicLink()) {
            throw new Error(`Claimed first-party export directories changed before metadata installation: ${outputDir}`);
        }
        await (0, promises_1.copyFile)((0, path_1.resolve)(stagingRoot, "metadata.json"), (0, path_1.resolve)(outputDir, "metadata.json"), fs_1.constants.COPYFILE_EXCL);
        return {
            outputDir,
            metadataPath: (0, path_1.resolve)(outputDir, "metadata.json"),
        };
    }
    finally {
        if ((0, fs_1.existsSync)(stagingRoot)) {
            await (0, promises_1.rm)(stagingRoot, { recursive: true, force: true });
        }
    }
}
//# sourceMappingURL=game-db-first-party-export-commit.js.map