import { createHash } from "crypto";
import { readFile, stat } from "fs/promises";
import { relative, resolve } from "path";
import { writeFormattedJson } from "./format-json";
import { collectStageDetailAssets } from "./fyi-stage-details";
import { StageDetailsDataset } from "./stage-detail";

export const STAGE_DETAILS_FILE_NAME = "stage-details.json";
export const STAGE_DETAILS_MANIFEST_FILE_NAME = "stage-details-manifest.json";
export const STAGE_DETAILS_ASSET_PREFIX = "stage-details/assets/";

export interface StageDetailsDatasetManifest {
    schemaVersion: 1,
    datasetVersion: string,
    generatedAt: string,
    fileName: typeof STAGE_DETAILS_FILE_NAME,
    sha256: string,
    sizeBytes: number,
    stageCount: number,
    assetCount: number,
    assetBytes: number,
    assetsIncluded: true,
    assetPrefix: typeof STAGE_DETAILS_ASSET_PREFIX,
}

export interface StageDetailsDatasetAsset {
    objectKey: string,
    localPath: string,
    absolutePath: string,
    sizeBytes: number,
    sha256: string,
    contentType: string,
}

export async function writeStageDetailsDatasetManifest(
    dataset: StageDetailsDataset,
    detailsPath: string,
    manifestPath: string,
    projectRoot = process.cwd(),
): Promise<StageDetailsDatasetManifest> {
    const detailsBuffer = await readFile(detailsPath);
    const assets = await inspectStageDetailsDatasetAssets(dataset, projectRoot);
    const manifest: StageDetailsDatasetManifest = {
        schemaVersion: 1,
        datasetVersion: dataset.generatedAt,
        generatedAt: dataset.generatedAt,
        fileName: STAGE_DETAILS_FILE_NAME,
        sha256: createHash("sha256").update(detailsBuffer).digest("hex"),
        sizeBytes: detailsBuffer.byteLength,
        stageCount: dataset.entries.length,
        assetCount: assets.length,
        assetBytes: assets.reduce((total, asset) => total + asset.sizeBytes, 0),
        assetsIncluded: true,
        assetPrefix: STAGE_DETAILS_ASSET_PREFIX,
    };
    await writeFormattedJson(manifestPath, manifest);
    return manifest;
}

export async function inspectStageDetailsDatasetAssets(
    dataset: StageDetailsDataset,
    projectRoot = process.cwd(),
): Promise<StageDetailsDatasetAsset[]> {
    const assets = collectStageDetailAssets(dataset, true);
    return Promise.all(assets.map(async asset => {
        if (!asset.localPath || !asset.objectKey) {
            throw new Error(`Stage detail asset is not localized: ${asset.remoteUrl}`);
        }
        const absolutePath = resolve(projectRoot, asset.localPath);
        const info = await stat(absolutePath);
        if (!info.isFile()) {
            throw new Error(`Stage detail asset is not a file: ${absolutePath}`);
        }
        const buffer = await readFile(absolutePath);
        const objectKey = asset.objectKey.replace(/^\/+/, "");
        if (!objectKey.startsWith(STAGE_DETAILS_ASSET_PREFIX)) {
            throw new Error(`Stage detail asset has an invalid object key: ${objectKey}`);
        }
        return {
            objectKey,
            localPath: asset.localPath,
            absolutePath,
            sizeBytes: info.size,
            sha256: createHash("sha256").update(buffer).digest("hex"),
            contentType: contentTypeForPath(asset.localPath),
        };
    })).then(items => items.sort((left, right) => left.objectKey.localeCompare(right.objectKey)));
}

function contentTypeForPath(path: string): string {
    if (/\.jpe?g$/i.test(path)) return "image/jpeg";
    if (/\.webp$/i.test(path)) return "image/webp";
    if (/\.gif$/i.test(path)) return "image/gif";
    return "image/png";
}

export function stageDetailsManifestFingerprint(
    manifest: StageDetailsDatasetManifest,
    manifestBytes: number,
): string {
    return createHash("sha256")
        .update(JSON.stringify({ ...manifest, _serializedBytes: manifestBytes }))
        .digest("hex");
}

export function stageDetailsAssetRelativePath(assetPath: string, projectRoot = process.cwd()): string {
    return relative(projectRoot, resolve(projectRoot, assetPath)).replace(/\\/g, "/");
}
