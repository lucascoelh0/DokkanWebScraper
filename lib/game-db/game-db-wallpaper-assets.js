"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildWallpaperGameAssets = exports.validatePinnedWallpaperToolchain = exports.validateWallpaperAssetManifest = exports.WALLPAPER_CPK_DEFINITIONS_BINARY_SHA256 = exports.WALLPAPER_CPK_READER_BINARY_SHA256 = exports.WALLPAPER_CPK_EXTRACTOR_SHA256 = exports.WALLPAPER_CPK_READER_COMMIT = exports.WALLPAPER_ASSET_CONTRACT_VERSION = exports.WALLPAPER_ASSET_CONTRACT = void 0;
const crypto_1 = require("crypto");
const child_process_1 = require("child_process");
const promises_1 = require("fs/promises");
const os_1 = require("os");
const path_1 = require("path");
const game_db_source_1 = require("./game-db-source");
exports.WALLPAPER_ASSET_CONTRACT = "dokkan-wallpaper-game-assets";
exports.WALLPAPER_ASSET_CONTRACT_VERSION = "1.0.0";
exports.WALLPAPER_CPK_READER_COMMIT = "169b001c748dfffc28c9fc14fcec269dd45e6eec";
exports.WALLPAPER_CPK_EXTRACTOR_SHA256 = "aa3bc37266de5fb0c169b3c217b00fc9dcf5300ccbcb73328a77969dc0d3e898";
exports.WALLPAPER_CPK_READER_BINARY_SHA256 = "fd917ef4cb67681fd30e6e12e1119b93a0b239d5e75b5b2c36b9c5e8c6524c94";
exports.WALLPAPER_CPK_DEFINITIONS_BINARY_SHA256 = "c3420ba142d182c65c5feb78a586351fbe8f9fcd62778060d2099879c39d7cad";
function contained(root, ...segments) {
    const normalizedRoot = (0, path_1.resolve)(root);
    const candidate = (0, path_1.resolve)(normalizedRoot, ...segments);
    if (candidate !== normalizedRoot && !candidate.startsWith(`${normalizedRoot}${path_1.sep}`)) {
        throw new Error(`Wallpaper asset path escapes its root: ${candidate}`);
    }
    return candidate;
}
function sha256(buffer) {
    return (0, crypto_1.createHash)("sha256").update(buffer).digest("hex");
}
function canonicalItemId(value, label) {
    if (typeof value !== "string" || !/^(?:0|[1-9]\d*)$/.test(value))
        throw new Error(`Invalid ${label}`);
    return value;
}
function positiveInteger(value, label) {
    if (!Number.isSafeInteger(value) || Number(value) <= 0)
        throw new Error(`Invalid ${label}`);
    return Number(value);
}
function nonNegativeInteger(value, label) {
    if (!Number.isSafeInteger(value) || Number(value) < 0)
        throw new Error(`Invalid ${label}`);
    return Number(value);
}
function assertSha256(value, label) {
    if (typeof value !== "string" || !/^[a-f0-9]{64}$/.test(value))
        throw new Error(`Invalid ${label}`);
    return value;
}
function validateInventoryEntries(value, label, pathPattern) {
    if (!Array.isArray(value))
        throw new Error(`Invalid ${label}`);
    const paths = new Set();
    const entries = value.map((raw, index) => {
        if (!raw || typeof raw !== "object")
            throw new Error(`Invalid ${label}[${index}]`);
        const entry = raw;
        if (typeof entry.path !== "string" || !pathPattern.test(entry.path) || paths.has(entry.path)) {
            throw new Error(`Invalid or duplicate ${label} path ${entry.path ?? ""}`);
        }
        paths.add(entry.path);
        return {
            path: entry.path,
            sizeBytes: positiveInteger(entry.sizeBytes, `${label} sizeBytes`),
            sha256: assertSha256(entry.sha256, `${label} sha256`),
        };
    });
    const sorted = [...entries].sort((left, right) => left.path.localeCompare(right.path, "en", { numeric: true }));
    if (JSON.stringify(entries) !== JSON.stringify(sorted))
        throw new Error(`${label} must be sorted by path`);
    return entries;
}
function validateWallpaperAssetManifest(value) {
    if (!value || typeof value !== "object")
        throw new Error("Invalid wallpaper asset manifest");
    const manifest = value;
    if (manifest.schemaVersion !== 1 || manifest.contract !== exports.WALLPAPER_ASSET_CONTRACT
        || manifest.contractVersion !== exports.WALLPAPER_ASSET_CONTRACT_VERSION
        || typeof manifest.generatedAt !== "string" || Number.isNaN(Date.parse(manifest.generatedAt))) {
        throw new Error("Unsupported wallpaper asset manifest contract");
    }
    if (!manifest.source || typeof manifest.source !== "object")
        throw new Error("Invalid wallpaper asset manifest source");
    validateIdentity(manifest.source);
    const archives = validateInventoryEntries(manifest.source.archives, "wallpaper archive inventory", /^\d{4}\.cpk$/);
    const extractedFiles = validateInventoryEntries(manifest.source.extractedFiles, "wallpaper extracted inventory", /^\d{4}\/[A-Za-z0-9_.-]+$/);
    if (manifest.source.archiveCount !== archives.length
        || manifest.source.archiveBytes !== archives.reduce((sum, entry) => sum + entry.sizeBytes, 0)
        || manifest.source.archiveInventorySha256 !== sha256(Buffer.from(JSON.stringify(archives)))) {
        throw new Error("Wallpaper archive inventory summary mismatch");
    }
    assertSha256(manifest.source.extractorSha256, "wallpaper CPK extractor sha256");
    assertSha256(manifest.source.readerBinarySha256, "wallpaper CPK reader binary sha256");
    assertSha256(manifest.source.definitionsBinarySha256, "wallpaper CPK definitions binary sha256");
    if (manifest.source.extractedFileCount !== extractedFiles.length
        || manifest.source.extractedBytes !== extractedFiles.reduce((sum, entry) => sum + entry.sizeBytes, 0)
        || manifest.source.extractedInventorySha256 !== sha256(Buffer.from(JSON.stringify(extractedFiles)))) {
        throw new Error("Wallpaper extracted inventory summary mismatch");
    }
    if (!Array.isArray(manifest.presentations) || !Array.isArray(manifest.assets) || !Array.isArray(manifest.fullImageGaps)) {
        throw new Error("Invalid wallpaper asset manifest collections");
    }
    const archivePaths = new Set(archives.map(entry => entry.path));
    const extractedPaths = new Set(extractedFiles.map(entry => entry.path));
    const assetPaths = new Set();
    for (const asset of manifest.assets) {
        if (!asset || typeof asset !== "object" || typeof asset.path !== "string" || assetPaths.has(asset.path)) {
            throw new Error(`Invalid or duplicate wallpaper asset path ${asset?.path ?? ""}`);
        }
        const match = /^item\/wallpaper\/(\d{4})\/(icon_|thumb_|full_)(\d{4})\.png$/.exec(asset.path);
        if (!match || match[1] !== match[3])
            throw new Error(`Invalid wallpaper asset path ${asset.path}`);
        const member = match[2] === "full_" ? `Images_${match[1]}.png` : `${match[2]}${match[1]}.png`;
        const expectedUrl = `official-cpk-extract://item/wallpaper/${match[1]}.cpk#${member}`;
        const expectedSources = [`archives/${match[1]}.cpk`, `extracted/${match[1]}/${match[1]}.lwf`, `extracted/${match[1]}/${member}`];
        if (asset.sourceUrl !== expectedUrl || JSON.stringify(asset.sourceFiles) !== JSON.stringify(expectedSources)
            || !archivePaths.has(`${match[1]}.cpk`)
            || !extractedPaths.has(`${match[1]}/${match[1]}.lwf`)
            || !extractedPaths.has(`${match[1]}/${member}`)) {
            throw new Error(`Wallpaper asset ${asset.path} has invalid extraction provenance`);
        }
        positiveInteger(asset.sizeBytes, `wallpaper asset ${asset.path} sizeBytes`);
        assertSha256(asset.sha256, `wallpaper asset ${asset.path} sha256`);
        assetPaths.add(asset.path);
    }
    const presentationIds = new Set();
    const advertisedAssetPaths = new Set();
    for (const presentation of manifest.presentations) {
        if (!presentation || typeof presentation !== "object")
            throw new Error("Invalid wallpaper presentation");
        const itemId = canonicalItemId(presentation.itemId, "wallpaper presentation itemId");
        if (presentationIds.has(itemId))
            throw new Error(`Duplicate wallpaper presentation ${itemId}`);
        presentationIds.add(itemId);
        if (typeof presentation.name !== "string" || presentation.name.trim() !== presentation.name || !presentation.name
            || typeof presentation.description !== "string" || presentation.description.trim() !== presentation.description || !presentation.description) {
            throw new Error(`Wallpaper presentation ${itemId} has invalid official text`);
        }
        const padded = itemId.padStart(4, "0");
        const expectedReward = `item/wallpaper/${padded}/icon_${padded}.png`;
        const expectedThumbnail = `item/wallpaper/${padded}/thumb_${padded}.png`;
        const expectedFull = `item/wallpaper/${padded}/full_${padded}.png`;
        if (presentation.rewardThumbnailAssetPath !== expectedReward || presentation.thumbnailAssetPath !== expectedThumbnail
            || (presentation.fullImageAssetPath !== undefined && presentation.fullImageAssetPath !== expectedFull)
            || !assetPaths.has(expectedReward) || !assetPaths.has(expectedThumbnail)
            || (presentation.fullImageAssetPath !== undefined && !assetPaths.has(expectedFull))) {
            throw new Error(`Wallpaper presentation ${itemId} has invalid advertised assets`);
        }
        advertisedAssetPaths.add(expectedReward);
        advertisedAssetPaths.add(expectedThumbnail);
        if (presentation.fullImageAssetPath)
            advertisedAssetPaths.add(expectedFull);
    }
    if (assetPaths.size !== advertisedAssetPaths.size || [...assetPaths].some(path => !advertisedAssetPaths.has(path))) {
        throw new Error("Wallpaper asset inventory does not exactly match advertised presentations");
    }
    const gaps = new Set();
    for (const gap of manifest.fullImageGaps) {
        const itemId = canonicalItemId(gap?.itemId, "wallpaper full-image gap itemId");
        if (gaps.has(itemId) || !presentationIds.has(itemId)
            || gap.reason !== "official-lwf-has-no-unambiguous-single-texture") {
            throw new Error(`Invalid or duplicate wallpaper full-image gap ${itemId}`);
        }
        const presentation = manifest.presentations.find(item => item.itemId === itemId);
        if (presentation.fullImageAssetPath)
            throw new Error(`Wallpaper ${itemId} advertises a full image and a gap`);
        gaps.add(itemId);
    }
    for (const presentation of manifest.presentations) {
        if (!presentation.fullImageAssetPath && !gaps.has(presentation.itemId)) {
            throw new Error(`Wallpaper ${presentation.itemId} is missing a full-image gap`);
        }
    }
    const fullImageCount = manifest.presentations.filter(item => item.fullImageAssetPath).length;
    if (nonNegativeInteger(manifest.wallpaperCount, "wallpaperCount") !== manifest.presentations.length
        || archives.length !== manifest.presentations.length
        || [...presentationIds].some(itemId => !archivePaths.has(`${itemId.padStart(4, "0")}.cpk`))
        || manifest.presentationCount !== manifest.presentations.length
        || manifest.rewardThumbnailCount !== manifest.presentations.length
        || manifest.thumbnailCount !== manifest.presentations.length
        || manifest.fullImageCount !== fullImageCount
        || manifest.fullImageGaps.length !== manifest.presentations.length - fullImageCount
        || manifest.assetCount !== manifest.assets.length
        || manifest.assetBytes !== manifest.assets.reduce((sum, entry) => sum + entry.sizeBytes, 0)
        || manifest.inventorySha256 !== sha256(Buffer.from(JSON.stringify(manifest.assets)))) {
        throw new Error("Wallpaper asset manifest cardinality or inventory mismatch");
    }
    return manifest;
}
exports.validateWallpaperAssetManifest = validateWallpaperAssetManifest;
function validatePinnedWallpaperToolchain(manifest) {
    if (manifest.source.cpkReader.commit !== exports.WALLPAPER_CPK_READER_COMMIT
        || manifest.source.extractorSha256 !== exports.WALLPAPER_CPK_EXTRACTOR_SHA256
        || manifest.source.readerBinarySha256 !== exports.WALLPAPER_CPK_READER_BINARY_SHA256
        || manifest.source.definitionsBinarySha256 !== exports.WALLPAPER_CPK_DEFINITIONS_BINARY_SHA256) {
        throw new Error("Wallpaper asset manifest was not generated by the pinned CriFsV2Lib toolchain");
    }
}
exports.validatePinnedWallpaperToolchain = validatePinnedWallpaperToolchain;
function rowId(row) {
    const value = (0, game_db_source_1.normalizeDbId)(row.id);
    if (!value)
        throw new Error("Wallpaper row is missing id");
    return value;
}
function officialText(row, column) {
    const value = row[column]?.trim();
    if (!value)
        throw new Error(`Wallpaper item ${rowId(row)} is missing official ${column}`);
    return value;
}
function isPng(buffer) {
    return buffer.byteLength >= 8 && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
}
async function inventory(root) {
    const paths = [];
    async function walk(directory) {
        for (const entry of await (0, promises_1.readdir)(directory, { withFileTypes: true })) {
            const path = contained(directory, entry.name);
            if (entry.isSymbolicLink())
                throw new Error(`Wallpaper source contains a symlink: ${path}`);
            if (entry.isDirectory())
                await walk(path);
            else if (entry.isFile())
                paths.push(path);
            else
                throw new Error(`Unsupported wallpaper source entry: ${path}`);
        }
    }
    await walk(root);
    const entries = await Promise.all(paths.map(async (path) => {
        const bytes = await (0, promises_1.readFile)(path);
        return { path: (0, path_1.relative)(root, path).replace(/\\/g, "/"), sizeBytes: bytes.byteLength, sha256: sha256(bytes) };
    }));
    return entries.sort((left, right) => left.path.localeCompare(right.path, "en", { numeric: true }));
}
async function verifyArchiveExtraction(cpkExtractorPath, archivePath, expectedRoot) {
    const verificationRoot = await (0, promises_1.mkdtemp)((0, path_1.resolve)((0, os_1.tmpdir)(), "dokkan-wallpaper-cpk-"));
    const outputRoot = contained(verificationRoot, "extracted");
    try {
        const extension = cpkExtractorPath.toLowerCase();
        const executable = extension.endsWith(".dll") ? "dotnet" : extension.endsWith(".js") ? process.execPath : cpkExtractorPath;
        const args = extension.endsWith(".dll") || extension.endsWith(".js")
            ? [cpkExtractorPath, archivePath, outputRoot]
            : [archivePath, outputRoot];
        const result = (0, child_process_1.spawnSync)(executable, args, { encoding: "utf8", stdio: "pipe", maxBuffer: 16 * 1024 * 1024 });
        if (result.error)
            throw result.error;
        if (result.status !== 0) {
            throw new Error(`${(0, path_1.basename)(cpkExtractorPath)} rejected wallpaper CPK ${(0, path_1.basename)(archivePath)}: ${(result.stderr ?? "").trim()}`);
        }
        const [verified, expected] = await Promise.all([inventory(outputRoot), inventory(expectedRoot)]);
        if (JSON.stringify(verified) !== JSON.stringify(expected)) {
            throw new Error(`Pinned CPK extraction does not match source bundle for ${(0, path_1.basename)(archivePath)}`);
        }
    }
    finally {
        await (0, promises_1.rm)(verificationRoot, { recursive: true, force: true });
    }
}
function validateIdentity(source) {
    if (source.packageName !== "com.bandainamcogames.dbzdokkanww"
        || !source.versionName.trim() || !/^\d+$/.test(source.versionCode)
        || !/^\d+$/.test(source.databaseSnapshotVersion)
        || !/^[a-f0-9]{64}$/.test(source.databaseSha256)
        || Number.isNaN(Date.parse(source.acquiredAt))) {
        throw new Error("Invalid wallpaper source identity");
    }
    if (source.cpkReader.repository !== "https://github.com/Sewer56/CriFsV2Lib"
        || !/^[a-f0-9]{40}$/.test(source.cpkReader.commit)) {
        throw new Error("Invalid wallpaper CPK reader provenance");
    }
}
async function buildWallpaperGameAssets(options) {
    validateIdentity(options.sourceIdentity);
    if (Number.isNaN(Date.parse(options.generatedAt)))
        throw new Error("Invalid wallpaper generation timestamp");
    const sourceRoot = (0, path_1.resolve)(options.sourceBundleRoot);
    const outputRoot = (0, path_1.resolve)(options.outputRoot);
    const cpkExtractorPath = (0, path_1.resolve)(options.cpkExtractorPath);
    const extractorBytes = await (0, promises_1.readFile)(cpkExtractorPath).catch(() => undefined);
    if (!extractorBytes?.byteLength)
        throw new Error(`Wallpaper CPK extractor is missing: ${cpkExtractorPath}`);
    const extractorSha256 = sha256(extractorBytes);
    const expectedExtractorSha256 = options.testOnlyExpectedExtractorSha256 ?? exports.WALLPAPER_CPK_EXTRACTOR_SHA256;
    if (extractorSha256 !== expectedExtractorSha256)
        throw new Error(`Wallpaper CPK extractor is not approved: ${extractorSha256}`);
    const extractorDirectory = (0, path_1.dirname)(cpkExtractorPath);
    const readerBinaryBytes = options.testOnlyExpectedExtractorSha256
        ? extractorBytes
        : await (0, promises_1.readFile)((0, path_1.resolve)(extractorDirectory, "CriFsV2Lib.dll")).catch(() => undefined);
    const definitionsBinaryBytes = options.testOnlyExpectedExtractorSha256
        ? extractorBytes
        : await (0, promises_1.readFile)((0, path_1.resolve)(extractorDirectory, "CriFsV2Lib.Definitions.dll")).catch(() => undefined);
    const readerBinarySha256 = readerBinaryBytes ? sha256(readerBinaryBytes) : "";
    const definitionsBinarySha256 = definitionsBinaryBytes ? sha256(definitionsBinaryBytes) : "";
    if (!options.testOnlyExpectedExtractorSha256
        && (options.sourceIdentity.cpkReader.commit !== exports.WALLPAPER_CPK_READER_COMMIT
            || readerBinarySha256 !== exports.WALLPAPER_CPK_READER_BINARY_SHA256
            || definitionsBinarySha256 !== exports.WALLPAPER_CPK_DEFINITIONS_BINARY_SHA256)) {
        throw new Error("Wallpaper CPK extractor runtime does not match the pinned CriFsV2Lib build");
    }
    try {
        await (0, promises_1.stat)(outputRoot);
        throw new Error(`Wallpaper asset output already exists: ${outputRoot}`);
    }
    catch (error) {
        if (error.code !== "ENOENT")
            throw error;
    }
    const rows = new Map();
    for (const row of options.wallpaperItems) {
        const id = rowId(row);
        if (rows.has(id))
            throw new Error(`Duplicate wallpaper item ${id}`);
        rows.set(id, row);
    }
    const sortedRows = [...rows.values()].sort((left, right) => Number(rowId(left)) - Number(rowId(right)));
    const archivesRoot = contained(sourceRoot, "archives");
    const extractedRoot = contained(sourceRoot, "extracted");
    const archiveInventory = await inventory(archivesRoot);
    const expectedArchives = sortedRows.map(row => `${rowId(row).padStart(4, "0")}.cpk`);
    if (JSON.stringify(archiveInventory.map(entry => entry.path)) !== JSON.stringify(expectedArchives)) {
        throw new Error("Official wallpaper CPK inventory does not match wallpaper_items");
    }
    const archiveBytesById = new Map();
    for (const row of sortedRows) {
        const paddedId = rowId(row).padStart(4, "0");
        const bytes = await (0, promises_1.readFile)(contained(archivesRoot, `${paddedId}.cpk`));
        if (bytes.byteLength < 16 || bytes.subarray(0, 4).toString("ascii") !== "CPK ") {
            throw new Error(`Invalid official wallpaper CPK ${paddedId}`);
        }
        archiveBytesById.set(paddedId, bytes);
    }
    const extractedDirectories = (await (0, promises_1.readdir)(extractedRoot, { withFileTypes: true }))
        .filter(entry => entry.isDirectory()).map(entry => entry.name).sort((left, right) => left.localeCompare(right, "en", { numeric: true }));
    const expectedDirectories = sortedRows.map(row => rowId(row).padStart(4, "0"));
    if (JSON.stringify(extractedDirectories) !== JSON.stringify(expectedDirectories)) {
        throw new Error("Official wallpaper extracted inventory does not match wallpaper_items");
    }
    const plans = [];
    const presentations = [];
    const fullImageGaps = [];
    for (const row of sortedRows) {
        const itemId = rowId(row);
        const paddedId = itemId.padStart(4, "0");
        const directory = contained(extractedRoot, paddedId);
        await verifyArchiveExtraction(cpkExtractorPath, contained(archivesRoot, `${paddedId}.cpk`), directory);
        const lwfName = `${paddedId}.lwf`;
        const lwfPath = contained(directory, lwfName);
        const lwf = await (0, promises_1.readFile)(lwfPath).catch(() => undefined);
        if (!lwf)
            throw new Error(`Missing official wallpaper LWF ${paddedId}`);
        const referencedPngs = [...new Set(lwf.toString("latin1").match(/[A-Za-z0-9_-]+\.png/g) ?? [])];
        if (!referencedPngs.length)
            throw new Error(`Wallpaper ${itemId} LWF does not advertise any PNG textures`);
        const extractedMembers = (await (0, promises_1.readdir)(directory, { withFileTypes: true }))
            .filter(entry => entry.isFile())
            .map(entry => entry.name);
        const extractedMemberNames = new Set(extractedMembers);
        const archiveBytes = archiveBytesById.get(paddedId);
        const eligibleFullTextures = referencedPngs.filter(name => archiveBytes.includes(Buffer.from(name, "ascii")));
        for (const member of eligibleFullTextures) {
            if (!extractedMemberNames.has(member))
                throw new Error(`Missing extracted wallpaper CPK member ${paddedId}/${member}`);
        }
        for (const member of extractedMembers) {
            if (!archiveBytes.includes(Buffer.from(member, "ascii"))) {
                throw new Error(`Wallpaper CPK ${paddedId} does not advertise extracted member ${member}`);
            }
        }
        const sourceFiles = [`archives/${paddedId}.cpk`, `extracted/${paddedId}/${lwfName}`];
        const planPng = async (sourceName, destinationName) => {
            const source = contained(directory, sourceName);
            const bytes = await (0, promises_1.readFile)(source).catch(() => undefined);
            if (!bytes || !isPng(bytes))
                throw new Error(`Missing or invalid official wallpaper PNG ${paddedId}/${sourceName}`);
            const path = `item/wallpaper/${paddedId}/${destinationName}`;
            const destination = contained(outputRoot, "game-assets", ...path.split("/"));
            plans.push({
                source,
                destination,
                entry: {
                    path,
                    sourceUrl: `official-cpk-extract://item/wallpaper/${paddedId}.cpk#${sourceName}`,
                    sourceFiles: [...sourceFiles, `extracted/${paddedId}/${sourceName}`],
                    sizeBytes: bytes.byteLength,
                    sha256: sha256(bytes),
                },
            });
            return path;
        };
        const rewardThumbnailAssetPath = await planPng(`icon_${paddedId}.png`, `icon_${paddedId}.png`);
        const thumbnailAssetPath = await planPng(`thumb_${paddedId}.png`, `thumb_${paddedId}.png`);
        const canonicalFullName = `Images_${paddedId}.png`;
        let fullImageAssetPath;
        if (eligibleFullTextures.length === 1 && eligibleFullTextures[0] === canonicalFullName) {
            fullImageAssetPath = await planPng(canonicalFullName, `full_${paddedId}.png`);
        }
        if (!fullImageAssetPath)
            fullImageGaps.push({ itemId, reason: "official-lwf-has-no-unambiguous-single-texture" });
        presentations.push({
            itemId,
            name: officialText(row, "name"),
            description: officialText(row, "description"),
            rewardThumbnailAssetPath,
            thumbnailAssetPath,
            ...(fullImageAssetPath ? { fullImageAssetPath } : {}),
        });
    }
    const duplicatePaths = plans.map(plan => plan.entry.path).filter((path, index, paths) => paths.indexOf(path) !== index);
    if (duplicatePaths.length)
        throw new Error(`Duplicate wallpaper output path ${duplicatePaths[0]}`);
    await (0, promises_1.mkdir)((0, path_1.dirname)(outputRoot), { recursive: true });
    await (0, promises_1.mkdir)(outputRoot, { recursive: false });
    for (const plan of plans) {
        await (0, promises_1.mkdir)((0, path_1.dirname)(plan.destination), { recursive: true });
        await (0, promises_1.copyFile)(plan.source, plan.destination);
    }
    const extractedInventory = await inventory(extractedRoot);
    const assets = plans.map(plan => plan.entry).sort((left, right) => left.path.localeCompare(right.path, "en", { numeric: true }));
    const manifest = {
        schemaVersion: 1,
        contract: exports.WALLPAPER_ASSET_CONTRACT,
        contractVersion: exports.WALLPAPER_ASSET_CONTRACT_VERSION,
        generatedAt: options.generatedAt,
        source: {
            ...options.sourceIdentity,
            bundleRoot: sourceRoot.replace(/\\/g, "/"),
            archiveCount: archiveInventory.length,
            archiveBytes: archiveInventory.reduce((sum, entry) => sum + entry.sizeBytes, 0),
            archiveInventorySha256: sha256(Buffer.from(JSON.stringify(archiveInventory))),
            archives: archiveInventory,
            extractorSha256,
            readerBinarySha256,
            definitionsBinarySha256,
            extractedFileCount: extractedInventory.length,
            extractedBytes: extractedInventory.reduce((sum, entry) => sum + entry.sizeBytes, 0),
            extractedInventorySha256: sha256(Buffer.from(JSON.stringify(extractedInventory))),
            extractedFiles: extractedInventory,
        },
        wallpaperCount: rows.size,
        presentationCount: presentations.length,
        rewardThumbnailCount: presentations.length,
        thumbnailCount: presentations.length,
        fullImageCount: presentations.filter(item => item.fullImageAssetPath).length,
        fullImageGaps,
        assetCount: assets.length,
        assetBytes: assets.reduce((sum, entry) => sum + entry.sizeBytes, 0),
        inventorySha256: sha256(Buffer.from(JSON.stringify(assets))),
        presentations,
        assets,
    };
    validateWallpaperAssetManifest(manifest);
    await (0, promises_1.writeFile)(contained(outputRoot, "wallpaper-assets-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
    return manifest;
}
exports.buildWallpaperGameAssets = buildWallpaperGameAssets;
async function main() {
    const values = new Map();
    const supported = new Set(["--source-data-dir", "--source-bundle-root", "--source-identity", "--output-dir", "--generated-at", "--cpk-extractor"]);
    const args = process.argv.slice(2);
    for (let index = 0; index < args.length; index += 1) {
        const separator = args[index].indexOf("=");
        const name = separator >= 0 ? args[index].slice(0, separator) : args[index];
        if (!supported.has(name))
            throw new Error(`Unexpected wallpaper asset argument: ${args[index]}`);
        const value = separator >= 0 ? args[index].slice(separator + 1) : args[++index];
        if (!value || values.has(name))
            throw new Error(`Missing or duplicate wallpaper asset argument: ${name}`);
        values.set(name, value);
    }
    for (const required of ["--source-data-dir", "--source-bundle-root", "--source-identity", "--output-dir", "--cpk-extractor"]) {
        if (!values.has(required))
            throw new Error(`Missing wallpaper asset argument: ${required}`);
    }
    const sourceDataDir = (0, path_1.resolve)(values.get("--source-data-dir"));
    const sourceIdentity = JSON.parse(await (0, promises_1.readFile)((0, path_1.resolve)(values.get("--source-identity")), "utf8"));
    const manifest = await buildWallpaperGameAssets({
        generatedAt: values.get("--generated-at") ?? new Date().toISOString(),
        sourceIdentity,
        sourceBundleRoot: (0, path_1.resolve)(values.get("--source-bundle-root")),
        outputRoot: (0, path_1.resolve)(values.get("--output-dir")),
        wallpaperItems: await (0, game_db_source_1.readGameDbTable)({ sourceRoot: sourceDataDir, dataDir: sourceDataDir }, "wallpaper_items"),
        cpkExtractorPath: (0, path_1.resolve)(values.get("--cpk-extractor")),
    });
    console.log(JSON.stringify({
        outputDir: (0, path_1.resolve)(values.get("--output-dir")),
        wallpaperCount: manifest.wallpaperCount,
        fullImageCount: manifest.fullImageCount,
        fullImageGaps: manifest.fullImageGaps,
        assetCount: manifest.assetCount,
        assetBytes: manifest.assetBytes,
        inventorySha256: manifest.inventorySha256,
    }, null, 2));
}
if (require.main === module) {
    main().catch(error => {
        console.error(error instanceof Error ? error.message : String(error));
        process.exitCode = 1;
    });
}
//# sourceMappingURL=game-db-wallpaper-assets.js.map