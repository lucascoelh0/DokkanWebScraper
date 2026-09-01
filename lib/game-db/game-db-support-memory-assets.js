"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildSupportMemoryGameAssets = exports.SUPPORT_MEMORY_GAME_ASSET_CONTRACT_VERSION = exports.SUPPORT_MEMORY_GAME_ASSET_CONTRACT = void 0;
const crypto_1 = require("crypto");
const promises_1 = require("fs/promises");
const path_1 = require("path");
const support_memory_dokkaninfo_enrichment_1 = require("../support-memory-dokkaninfo-enrichment");
const game_db_source_1 = require("./game-db-source");
exports.SUPPORT_MEMORY_GAME_ASSET_CONTRACT = "dokkan-support-memory-game-assets";
exports.SUPPORT_MEMORY_GAME_ASSET_CONTRACT_VERSION = "1.0.0";
const FILM_CODES = {
    "1": "original",
    "2": "z",
    "3": "gt",
    "4": "super",
    "5": "movie",
};
const numericCompare = (left, right) => Number(left) - Number(right) || left.localeCompare(right);
function id(row, column = "id") {
    const value = (0, game_db_source_1.normalizeDbId)(row[column]);
    if (!value)
        throw new Error(`Support Memory game-asset row is missing ${column}`);
    return value;
}
function integer(row, column) {
    const raw = row[column]?.trim();
    const value = raw && Number.isSafeInteger(Number(raw)) ? Number(raw) : undefined;
    if (value === undefined)
        throw new Error(`Support Memory game-asset row ${id(row)} is missing integer ${column}`);
    return value;
}
function uniqueById(rows, label) {
    const result = new Map();
    for (const row of rows) {
        const rowId = id(row);
        if (result.has(rowId))
            throw new Error(`Duplicate ${label} row ID ${rowId}`);
        result.set(rowId, row);
    }
    return result;
}
function groupBy(rows, column) {
    const result = new Map();
    for (const row of rows) {
        const key = id(row, column);
        result.set(key, [...(result.get(key) ?? []), row]);
    }
    return result;
}
function normalizedProjectPath(projectRoot, absolutePath) {
    const normalized = (0, path_1.relative)(projectRoot, absolutePath).replace(/\\/g, "/");
    if (!normalized || normalized === ".." || normalized.startsWith("../")) {
        throw new Error(`Support Memory game asset is outside the project root: ${absolutePath}`);
    }
    return normalized;
}
function contained(root, ...segments) {
    const normalizedRoot = (0, path_1.resolve)(root);
    const candidate = (0, path_1.resolve)(normalizedRoot, ...segments);
    if (candidate !== normalizedRoot && !candidate.startsWith(`${normalizedRoot}${path_1.sep}`)) {
        throw new Error(`Support Memory game-asset path escapes its root: ${candidate}`);
    }
    return candidate;
}
function sha256(buffer) {
    return (0, crypto_1.createHash)("sha256").update(buffer).digest("hex");
}
async function inventoryFiles(root) {
    const files = [];
    async function walk(directory) {
        for (const entry of await (0, promises_1.readdir)(directory, { withFileTypes: true })) {
            const path = contained(directory, entry.name);
            if (entry.isSymbolicLink())
                throw new Error(`Support Memory game-asset source contains a symlink: ${path}`);
            if (entry.isDirectory())
                await walk(path);
            else if (entry.isFile())
                files.push(path);
            else
                throw new Error(`Unsupported Support Memory game-asset source entry: ${path}`);
        }
    }
    await walk(root);
    const inventory = await Promise.all(files.map(async (path) => {
        const buffer = await (0, promises_1.readFile)(path);
        return { path: (0, path_1.relative)(root, path).replace(/\\/g, "/"), sizeBytes: buffer.byteLength, sha256: sha256(buffer) };
    }));
    return inventory.sort((left, right) => left.path.localeCompare(right.path, "en", { numeric: true }));
}
function assetRef(asset) {
    return { remoteUrl: "", localPath: asset.localPath, objectKey: asset.objectKey };
}
function animationAssetId(row) {
    const scriptName = row.script_name?.trim();
    const match = /^sm(\d+)$/.exec(scriptName ?? "");
    if (!match)
        throw new Error(`Support Memory ${id(row)} has unsupported script_name ${scriptName ?? ""}`);
    return match[1];
}
async function buildSupportMemoryGameAssets(options) {
    if (options.sourceIdentity.packageName !== "com.bandainamcogames.dbzdokkanww")
        throw new Error("Unsupported Support Memory asset package");
    if (!options.sourceIdentity.versionName.trim() || !/^\d+$/.test(options.sourceIdentity.versionCode))
        throw new Error("Invalid Support Memory asset package version");
    if (!/^\d+$/.test(options.sourceIdentity.databaseSnapshotVersion))
        throw new Error("Invalid Support Memory asset database snapshot version");
    if (!/^\d{4}-\d{2}-\d{2}T/.test(options.sourceIdentity.acquiredAt))
        throw new Error("Invalid Support Memory asset acquisition timestamp");
    if (options.sourceIdentity.cpkReader.repository !== "https://github.com/Sewer56/CriFsV2Lib" || !/^[a-f0-9]{40}$/.test(options.sourceIdentity.cpkReader.commit)) {
        throw new Error("Invalid Support Memory CPK reader provenance");
    }
    const sourceRoot = (0, path_1.resolve)(options.sourceBundleRoot);
    const outputRoot = (0, path_1.resolve)(options.outputRoot);
    const projectRoot = (0, path_1.resolve)(options.projectRoot);
    const outputRelative = normalizedProjectPath(projectRoot, outputRoot);
    if (!/^data\/support-memories\/assets\/game\/[^/]+$/.test(outputRelative)) {
        throw new Error(`Support Memory game assets must use a versioned managed root: ${outputRelative}`);
    }
    try {
        await (0, promises_1.stat)(outputRoot);
        throw new Error(`Support Memory game-asset output already exists: ${outputRoot}`);
    }
    catch (error) {
        if (error.code !== "ENOENT")
            throw error;
    }
    const memoryRows = uniqueById(options.tables.support_memories, "Support Memory");
    const enhancementRows = uniqueById(options.tables.support_memory_enhancement_items, "Support Memory enhancement item");
    const filmRows = uniqueById(options.tables.support_films, "Support Film");
    const enhancedIds = new Set(options.tables.support_memory_enhancement_levels.map(row => id(row, "enhanced_support_memory_id")));
    const roots = [...memoryRows.values()].filter(row => !enhancedIds.has(id(row))).sort((left, right) => numericCompare(id(left), id(right)));
    const levelsByRoot = groupBy(options.tables.support_memory_enhancement_levels, "root_support_memory_id");
    const requirementsByMemory = groupBy(options.tables.support_memory_enhancement_require_items, "support_memory_id");
    const plans = [];
    const plannedByObjectKey = new Map();
    async function plan(sourceSegments, destinationSegments) {
        const sourcePath = contained(sourceRoot, ...sourceSegments);
        const sourceStats = await (0, promises_1.stat)(sourcePath).catch(() => undefined);
        if (!sourceStats?.isFile())
            throw new Error(`Missing Support Memory official asset: ${sourceSegments.join("/")}`);
        const destinationPath = contained(outputRoot, ...destinationSegments);
        const localPath = normalizedProjectPath(projectRoot, destinationPath);
        const objectKey = (0, support_memory_dokkaninfo_enrichment_1.supportMemoryAssetObjectKey)(localPath);
        if (!objectKey)
            throw new Error(`Invalid Support Memory official asset path: ${localPath}`);
        const existing = plannedByObjectKey.get(objectKey);
        if (existing) {
            if (existing.sourcePath !== sourcePath)
                throw new Error(`Conflicting Support Memory official asset object key: ${objectKey}`);
            return existing;
        }
        const asset = { sourcePath, destinationPath, localPath, objectKey, buffer: await (0, promises_1.readFile)(sourcePath) };
        plans.push(asset);
        plannedByObjectKey.set(objectKey, asset);
        return asset;
    }
    const presentations = new Map();
    const nonIdentityAnimationIds = [];
    for (const root of roots) {
        const memoryId = id(root);
        const filmId = id(root, "support_film_id");
        if (!filmRows.has(filmId))
            throw new Error(`Support Memory ${memoryId} references missing film ${filmId}`);
        const filmCode = FILM_CODES[filmId];
        if (!filmCode)
            throw new Error(`Support Memory ${memoryId} has unsupported film ${filmId}`);
        const large = await plan(["extracted", "support_memory", "large", `support_memory_large_${memoryId}.png`], [memoryId, "large.png"]);
        const complete = await plan(["extracted", "support_memory", "large", `support_memory_large_sepia_${memoryId}.png`], [memoryId, "complete.png"]);
        const film = await plan(["extracted", "support_memory", "film_icon", `support_memory_film_${filmCode}.png`], [memoryId, "film.png"]);
        const chainRows = [...(levelsByRoot.get(memoryId) ?? [])].sort((left, right) => integer(left, "level") - integer(right, "level"));
        const variantIds = [memoryId, ...chainRows.map(row => id(row, "enhanced_support_memory_id"))];
        const levelDescriptions = variantIds.map((variantId, index) => ({
            level: index + 1,
            description: memoryRows.get(variantId)?.description?.replace(/[ \t]+\r?\n/g, "\n").trim() ?? "",
        }));
        const enhancementItems = [];
        for (const variantId of variantIds) {
            const requirements = [...(requirementsByMemory.get(variantId) ?? [])].sort((left, right) => integer(left, "priority") - integer(right, "priority") || numericCompare(id(left), id(right)));
            for (const requirement of requirements) {
                const itemId = id(requirement, "support_memory_enhancement_item_id");
                if (!enhancementRows.has(itemId))
                    throw new Error(`Support Memory ${memoryId} references missing enhancement item ${itemId}`);
                const itemAsset = await plan(["extracted", "support_memory_enhancement", itemId, `${itemId}.png`], [memoryId, "enhancements", `${itemId}.png`]);
                enhancementItems.push({
                    itemType: "SupportMemoryEnhancementItem",
                    itemKey: (0, support_memory_dokkaninfo_enrichment_1.supportMemoryEnhancementItemKey)(itemId),
                    id: itemId,
                    quantity: integer(requirement, "quantity"),
                    asset: assetRef(itemAsset),
                });
            }
        }
        const scriptAssetId = animationAssetId(root);
        if (scriptAssetId !== memoryId)
            nonIdentityAnimationIds.push({ memoryId, scriptAssetId });
        const animationSource = contained(sourceRoot, "extracted", "animations", scriptAssetId, "en");
        const animationMembers = (await (0, promises_1.readdir)(animationSource, { withFileTypes: true }))
            .filter(entry => entry.isFile())
            .map(entry => entry.name)
            .sort((left, right) => left.localeCompare(right, "en", { numeric: true }));
        if (animationMembers.some(name => !/\.(?:lwf|png)$/i.test(name)))
            throw new Error(`Unsupported Support Memory animation member for ${memoryId}`);
        const expectedLwf = `support_memory_${scriptAssetId}.lwf`;
        if (animationMembers.filter(name => name.toLowerCase().endsWith(".lwf")).join() !== expectedLwf) {
            throw new Error(`Support Memory ${memoryId} animation has an invalid LWF inventory`);
        }
        const animationAssets = new Map();
        for (const member of animationMembers) {
            animationAssets.set(member, await plan(["extracted", "animations", scriptAssetId, "en", member], [memoryId, "animation", member]));
        }
        const animation = {
            sourceType: "lwf",
            status: "mirrored",
            remoteBaseUrl: "",
            localDirectory: normalizedProjectPath(projectRoot, contained(outputRoot, memoryId, "animation")),
            lwf: assetRef(animationAssets.get(expectedLwf)),
            textures: animationMembers.filter(name => name.toLowerCase().endsWith(".png")).map(name => assetRef(animationAssets.get(name))),
        };
        presentations.set(memoryId, {
            detailUrl: "",
            levelDescriptions,
            largeAsset: assetRef(large),
            completeAsset: { ...assetRef(complete), quantity: integer(root, "unlock_quantity") },
            requiredFilm: { ...assetRef(film), quantity: integer(root, "cost"), filmCode },
            enhancementItems,
            animation,
        });
    }
    const archiveInventory = await inventoryFiles(contained(sourceRoot, "archives"));
    const expectedArchiveCount = roots.length + 2;
    if (archiveInventory.length !== expectedArchiveCount)
        throw new Error(`Expected ${expectedArchiveCount} official Support Memory CPKs, found ${archiveInventory.length}`);
    const expectedArchives = [
        "support_memory.cpk",
        "support_memory_enhancement.cpk",
        ...roots.map(row => `animations/support_memory_${animationAssetId(row)}.cpk`),
    ].sort((left, right) => left.localeCompare(right, "en", { numeric: true }));
    const actualArchives = archiveInventory.map(entry => entry.path).sort((left, right) => left.localeCompare(right, "en", { numeric: true }));
    if (JSON.stringify(actualArchives) !== JSON.stringify(expectedArchives))
        throw new Error("Official Support Memory CPK inventory does not match the database roots");
    const extractedInputInventory = await inventoryFiles(contained(sourceRoot, "extracted"));
    await (0, promises_1.mkdir)((0, path_1.dirname)(outputRoot), { recursive: true });
    await (0, promises_1.mkdir)(outputRoot, { recursive: false });
    for (const asset of plans) {
        await (0, promises_1.mkdir)((0, path_1.dirname)(asset.destinationPath), { recursive: true });
        await (0, promises_1.copyFile)(asset.sourcePath, asset.destinationPath);
    }
    const files = plans.map(asset => ({
        path: (0, path_1.relative)(outputRoot, asset.destinationPath).replace(/\\/g, "/"),
        sizeBytes: asset.buffer.byteLength,
        sha256: sha256(asset.buffer),
    })).sort((left, right) => left.path.localeCompare(right.path, "en", { numeric: true }));
    const inventorySha256 = sha256(Buffer.from(JSON.stringify(files)));
    const audit = {
        schemaVersion: 1,
        contract: exports.SUPPORT_MEMORY_GAME_ASSET_CONTRACT,
        contractVersion: exports.SUPPORT_MEMORY_GAME_ASSET_CONTRACT_VERSION,
        generatedAt: options.generatedAt,
        source: {
            ...options.sourceIdentity,
            bundleRoot: normalizedProjectPath(projectRoot, sourceRoot),
            archiveInventory,
            extractedInputInventory,
        },
        output: {
            root: outputRelative,
            memoryCount: roots.length,
            fileCount: files.length,
            totalBytes: files.reduce((total, file) => total + file.sizeBytes, 0),
            inventorySha256,
            files,
        },
        joins: {
            animationByScriptNameCount: roots.length,
            nonIdentityAnimationIds,
            enhancementItemCount: enhancementRows.size,
            filmCount: filmRows.size,
        },
    };
    await (0, promises_1.writeFile)(contained(outputRoot, "support-memory-game-assets.json"), `${JSON.stringify(audit, null, 2)}\n`, "utf8");
    return { presentations, audit };
}
exports.buildSupportMemoryGameAssets = buildSupportMemoryGameAssets;
//# sourceMappingURL=game-db-support-memory-assets.js.map