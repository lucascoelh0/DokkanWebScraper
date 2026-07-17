"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.contentTypeForAsset = exports.collectSupportMemoryAssetRefs = exports.inspectSupportMemoryDatasetAssets = exports.writeSupportMemoryDatasetManifest = exports.inspectSupportMemoryDatasetArtifacts = exports.SUPPORT_MEMORY_ASSET_ROOT = exports.SUPPORT_MEMORY_ASSET_PREFIX = exports.SUPPORT_MEMORY_MANIFEST_FILE_NAME = exports.SUPPORT_MEMORY_DETAILS_FILE_NAME = void 0;
const crypto_1 = require("crypto");
const promises_1 = require("fs/promises");
const path_1 = require("path");
const format_json_1 = require("./format-json");
const support_memory_dokkaninfo_enrichment_1 = require("./support-memory-dokkaninfo-enrichment");
exports.SUPPORT_MEMORY_DETAILS_FILE_NAME = "support-memory-details.json";
exports.SUPPORT_MEMORY_MANIFEST_FILE_NAME = "support-memory-manifest.json";
exports.SUPPORT_MEMORY_ASSET_PREFIX = "support-memories/assets/";
exports.SUPPORT_MEMORY_ASSET_ROOT = "data/support-memories/assets/dokkaninfo";
async function inspectSupportMemoryDatasetArtifacts(dataset, detailsPath, projectRoot = process.cwd()) {
    const detailsBuffer = await (0, promises_1.readFile)(detailsPath);
    const assets = await inspectSupportMemoryDatasetAssets(dataset, projectRoot);
    const manifest = {
        schemaVersion: 1,
        datasetVersion: dataset.generatedAt,
        generatedAt: dataset.generatedAt,
        fileName: exports.SUPPORT_MEMORY_DETAILS_FILE_NAME,
        sha256: (0, crypto_1.createHash)("sha256").update(detailsBuffer).digest("hex"),
        sizeBytes: detailsBuffer.byteLength,
        supportMemoryCount: dataset.entries.length,
        assetCount: assets.length,
        assetBytes: assets.reduce((total, asset) => total + asset.sizeBytes, 0),
        assetsIncluded: true,
        assetPrefix: exports.SUPPORT_MEMORY_ASSET_PREFIX,
    };
    return {
        detailsBuffer,
        manifest,
        assets,
    };
}
exports.inspectSupportMemoryDatasetArtifacts = inspectSupportMemoryDatasetArtifacts;
async function writeSupportMemoryDatasetManifest(dataset, detailsPath, manifestPath, projectRoot = process.cwd()) {
    const inspection = await inspectSupportMemoryDatasetArtifacts(dataset, detailsPath, projectRoot);
    await (0, format_json_1.writeFormattedJson)(manifestPath, inspection.manifest);
    return inspection.manifest;
}
exports.writeSupportMemoryDatasetManifest = writeSupportMemoryDatasetManifest;
async function inspectSupportMemoryDatasetAssets(dataset, projectRoot = process.cwd()) {
    const assetRefs = collectSupportMemoryAssetRefs(dataset);
    const assets = [];
    const assetRoot = (0, path_1.resolve)(projectRoot, exports.SUPPORT_MEMORY_ASSET_ROOT);
    for (const assetRef of assetRefs.values()) {
        const localPath = normalizeProjectPath(assetRef.localPath);
        const absolutePath = (0, path_1.resolve)(projectRoot, localPath);
        const relativeAssetPath = (0, path_1.relative)(assetRoot, absolutePath).replace(/\\/g, "/");
        if (!relativeAssetPath || relativeAssetPath === ".." || relativeAssetPath.startsWith("../")) {
            throw new Error(`Support memory asset is outside the managed asset directory: ${localPath}`);
        }
        const objectKey = (0, support_memory_dokkaninfo_enrichment_1.supportMemoryAssetObjectKey)(localPath);
        if (!objectKey || !objectKey.startsWith(exports.SUPPORT_MEMORY_ASSET_PREFIX)) {
            throw new Error(`Support memory asset has an invalid object key: ${localPath}`);
        }
        const fileStats = await (0, promises_1.stat)(absolutePath);
        if (!fileStats.isFile()) {
            throw new Error(`Support memory asset is not a file: ${absolutePath}`);
        }
        const buffer = await (0, promises_1.readFile)(absolutePath);
        assets.push({
            objectKey,
            localPath,
            absolutePath,
            sizeBytes: fileStats.size,
            sha256: (0, crypto_1.createHash)("sha256").update(buffer).digest("hex"),
            contentType: contentTypeForAsset(localPath),
        });
    }
    return assets.sort((left, right) => left.objectKey.localeCompare(right.objectKey));
}
exports.inspectSupportMemoryDatasetAssets = inspectSupportMemoryDatasetAssets;
function collectSupportMemoryAssetRefs(dataset) {
    const refs = new Map();
    for (const entry of dataset.entries) {
        const dokkanInfo = entry.dokkanInfo;
        if (!dokkanInfo) {
            continue;
        }
        addAssetRef(refs, dokkanInfo.largeAsset);
        addAssetRef(refs, dokkanInfo.completeAsset);
        addAssetRef(refs, dokkanInfo.requiredFilm);
        for (const item of dokkanInfo.enhancementItems) {
            addAssetRef(refs, item.asset);
        }
        if (dokkanInfo.animation) {
            addAssetRef(refs, dokkanInfo.animation.lwf);
            for (const texture of dokkanInfo.animation.textures) {
                addAssetRef(refs, texture);
            }
        }
    }
    return refs;
}
exports.collectSupportMemoryAssetRefs = collectSupportMemoryAssetRefs;
function contentTypeForAsset(localPath) {
    const normalizedPath = localPath.toLowerCase();
    if (normalizedPath.endsWith(".png")) {
        return "image/png";
    }
    if (normalizedPath.endsWith(".jpg") || normalizedPath.endsWith(".jpeg")) {
        return "image/jpeg";
    }
    if (normalizedPath.endsWith(".webp")) {
        return "image/webp";
    }
    return "application/octet-stream";
}
exports.contentTypeForAsset = contentTypeForAsset;
function addAssetRef(refs, asset) {
    const localPath = asset?.localPath;
    if (!localPath) {
        return;
    }
    const normalizedPath = normalizeProjectPath(localPath);
    const objectKey = (0, support_memory_dokkaninfo_enrichment_1.supportMemoryAssetObjectKey)(normalizedPath);
    if (!objectKey) {
        throw new Error(`Support memory asset path cannot be published: ${localPath}`);
    }
    const existing = refs.get(objectKey);
    if (existing && normalizeProjectPath(existing.localPath) !== normalizedPath) {
        throw new Error(`Multiple local paths map to support memory object ${objectKey}.`);
    }
    refs.set(objectKey, {
        ...asset,
        localPath: normalizedPath,
        objectKey,
    });
}
function normalizeProjectPath(value) {
    return value.replace(/\\/g, "/").replace(/^\.\//, "");
}
//# sourceMappingURL=support-memory-dataset-artifacts.js.map