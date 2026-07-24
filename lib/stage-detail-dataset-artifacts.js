"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.stageDetailsAssetRelativePath = exports.stageDetailsManifestFingerprint = exports.inspectStageDetailsDatasetAssets = exports.writeStageDetailsDatasetManifest = exports.STAGE_DETAILS_ASSET_PREFIX = exports.STAGE_DETAILS_MANIFEST_FILE_NAME = exports.STAGE_DETAILS_FILE_NAME = void 0;
const crypto_1 = require("crypto");
const promises_1 = require("fs/promises");
const path_1 = require("path");
const format_json_1 = require("./format-json");
const fyi_stage_details_1 = require("./fyi-stage-details");
exports.STAGE_DETAILS_FILE_NAME = "stage-details.json";
exports.STAGE_DETAILS_MANIFEST_FILE_NAME = "stage-details-manifest.json";
exports.STAGE_DETAILS_ASSET_PREFIX = "stage-details/assets/";
async function writeStageDetailsDatasetManifest(dataset, detailsPath, manifestPath, projectRoot = process.cwd()) {
    const detailsBuffer = await (0, promises_1.readFile)(detailsPath);
    const assets = await inspectStageDetailsDatasetAssets(dataset, projectRoot);
    const manifest = {
        schemaVersion: 1,
        datasetVersion: dataset.generatedAt,
        generatedAt: dataset.generatedAt,
        fileName: exports.STAGE_DETAILS_FILE_NAME,
        sha256: (0, crypto_1.createHash)("sha256").update(detailsBuffer).digest("hex"),
        sizeBytes: detailsBuffer.byteLength,
        stageCount: dataset.entries.length,
        assetCount: assets.length,
        assetBytes: assets.reduce((total, asset) => total + asset.sizeBytes, 0),
        assetsIncluded: true,
        assetPrefix: exports.STAGE_DETAILS_ASSET_PREFIX,
    };
    await (0, format_json_1.writeFormattedJson)(manifestPath, manifest);
    return manifest;
}
exports.writeStageDetailsDatasetManifest = writeStageDetailsDatasetManifest;
async function inspectStageDetailsDatasetAssets(dataset, projectRoot = process.cwd()) {
    const assets = (0, fyi_stage_details_1.collectStageDetailAssets)(dataset, true);
    return Promise.all(assets.map(async (asset) => {
        if (!asset.localPath || !asset.objectKey) {
            throw new Error(`Stage detail asset is not localized: ${asset.remoteUrl}`);
        }
        const absolutePath = (0, path_1.resolve)(projectRoot, asset.localPath);
        const info = await (0, promises_1.stat)(absolutePath);
        if (!info.isFile()) {
            throw new Error(`Stage detail asset is not a file: ${absolutePath}`);
        }
        const buffer = await (0, promises_1.readFile)(absolutePath);
        const objectKey = asset.objectKey.replace(/^\/+/, "");
        if (!objectKey.startsWith(exports.STAGE_DETAILS_ASSET_PREFIX)) {
            throw new Error(`Stage detail asset has an invalid object key: ${objectKey}`);
        }
        return {
            objectKey,
            localPath: asset.localPath,
            absolutePath,
            sizeBytes: info.size,
            sha256: (0, crypto_1.createHash)("sha256").update(buffer).digest("hex"),
            contentType: contentTypeForPath(asset.localPath),
        };
    })).then(items => items.sort((left, right) => left.objectKey.localeCompare(right.objectKey)));
}
exports.inspectStageDetailsDatasetAssets = inspectStageDetailsDatasetAssets;
function contentTypeForPath(path) {
    if (/\.jpe?g$/i.test(path))
        return "image/jpeg";
    if (/\.webp$/i.test(path))
        return "image/webp";
    if (/\.gif$/i.test(path))
        return "image/gif";
    return "image/png";
}
function stageDetailsManifestFingerprint(manifest, manifestBytes) {
    return (0, crypto_1.createHash)("sha256")
        .update(JSON.stringify({ ...manifest, _serializedBytes: manifestBytes }))
        .digest("hex");
}
exports.stageDetailsManifestFingerprint = stageDetailsManifestFingerprint;
function stageDetailsAssetRelativePath(assetPath, projectRoot = process.cwd()) {
    return (0, path_1.relative)(projectRoot, (0, path_1.resolve)(projectRoot, assetPath)).replace(/\\/g, "/");
}
exports.stageDetailsAssetRelativePath = stageDetailsAssetRelativePath;
//# sourceMappingURL=stage-detail-dataset-artifacts.js.map