import { createHash } from "crypto";
import { readFile, stat } from "fs/promises";
import { relative, resolve } from "path";
import { writeFormattedJson } from "./format-json";
import {
    SupportMemoryDokkanInfoAssetRef,
    supportMemoryAssetObjectKey,
} from "./support-memory-dokkaninfo-enrichment";
import { SupportMemoryDetailsDataset } from "./support-memory-details";

export const SUPPORT_MEMORY_DETAILS_FILE_NAME = "support-memory-details.json";
export const SUPPORT_MEMORY_MANIFEST_FILE_NAME = "support-memory-manifest.json";
export const SUPPORT_MEMORY_ASSET_PREFIX = "support-memories/assets/";
export const SUPPORT_MEMORY_ASSET_ROOT = "data/support-memories/assets/dokkaninfo";
export const SUPPORT_MEMORY_GAME_ASSET_ROOT = "data/support-memories/assets/game";

export interface SupportMemoryDatasetManifest {
    schemaVersion: 1,
    datasetVersion: string,
    generatedAt: string,
    fileName: typeof SUPPORT_MEMORY_DETAILS_FILE_NAME,
    sha256: string,
    sizeBytes: number,
    supportMemoryCount: number,
    assetCount: number,
    assetBytes: number,
    assetsIncluded: true,
    assetPrefix: typeof SUPPORT_MEMORY_ASSET_PREFIX,
}

export interface SupportMemoryDatasetAsset {
    objectKey: string,
    localPath: string,
    absolutePath: string,
    sizeBytes: number,
    sha256: string,
    contentType: string,
}

export interface SupportMemoryDatasetArtifactInspection {
    detailsBuffer: Buffer,
    manifest: SupportMemoryDatasetManifest,
    assets: SupportMemoryDatasetAsset[],
}

export async function inspectSupportMemoryDatasetArtifacts(
    dataset: SupportMemoryDetailsDataset,
    detailsPath: string,
    projectRoot = process.cwd(),
): Promise<SupportMemoryDatasetArtifactInspection> {
    const detailsBuffer = await readFile(detailsPath);
    const assets = await inspectSupportMemoryDatasetAssets(dataset, projectRoot);
    const manifest: SupportMemoryDatasetManifest = {
        schemaVersion: 1,
        datasetVersion: dataset.generatedAt,
        generatedAt: dataset.generatedAt,
        fileName: SUPPORT_MEMORY_DETAILS_FILE_NAME,
        sha256: createHash("sha256").update(detailsBuffer).digest("hex"),
        sizeBytes: detailsBuffer.byteLength,
        supportMemoryCount: dataset.entries.length,
        assetCount: assets.length,
        assetBytes: assets.reduce((total, asset) => total + asset.sizeBytes, 0),
        assetsIncluded: true,
        assetPrefix: SUPPORT_MEMORY_ASSET_PREFIX,
    };

    return {
        detailsBuffer,
        manifest,
        assets,
    };
}

export async function writeSupportMemoryDatasetManifest(
    dataset: SupportMemoryDetailsDataset,
    detailsPath: string,
    manifestPath: string,
    projectRoot = process.cwd(),
): Promise<SupportMemoryDatasetManifest> {
    const inspection = await inspectSupportMemoryDatasetArtifacts(dataset, detailsPath, projectRoot);
    await writeFormattedJson(manifestPath, inspection.manifest);
    return inspection.manifest;
}

export async function inspectSupportMemoryDatasetAssets(
    dataset: SupportMemoryDetailsDataset,
    projectRoot = process.cwd(),
): Promise<SupportMemoryDatasetAsset[]> {
    const assetRefs = collectSupportMemoryAssetRefs(dataset);
    const assets: SupportMemoryDatasetAsset[] = [];
    const assetRoots = [SUPPORT_MEMORY_ASSET_ROOT, SUPPORT_MEMORY_GAME_ASSET_ROOT].map(root => resolve(projectRoot, root));

    for (const assetRef of assetRefs.values()) {
        const localPath = normalizeProjectPath(assetRef.localPath as string);
        const absolutePath = resolve(projectRoot, localPath);
        const isManagedAsset = assetRoots.some(assetRoot => {
            const relativeAssetPath = relative(assetRoot, absolutePath).replace(/\\/g, "/");
            return Boolean(relativeAssetPath && relativeAssetPath !== ".." && !relativeAssetPath.startsWith("../"));
        });
        if (!isManagedAsset) {
            throw new Error(`Support memory asset is outside the managed asset directory: ${localPath}`);
        }

        const objectKey = supportMemoryAssetObjectKey(localPath);
        if (!objectKey || !objectKey.startsWith(SUPPORT_MEMORY_ASSET_PREFIX)) {
            throw new Error(`Support memory asset has an invalid object key: ${localPath}`);
        }

        const fileStats = await stat(absolutePath);
        if (!fileStats.isFile()) {
            throw new Error(`Support memory asset is not a file: ${absolutePath}`);
        }

        const buffer = await readFile(absolutePath);
        assets.push({
            objectKey,
            localPath,
            absolutePath,
            sizeBytes: fileStats.size,
            sha256: createHash("sha256").update(buffer).digest("hex"),
            contentType: contentTypeForAsset(localPath),
        });
    }

    return assets.sort((left, right) => left.objectKey.localeCompare(right.objectKey));
}

export function collectSupportMemoryAssetRefs(
    dataset: SupportMemoryDetailsDataset,
): Map<string, SupportMemoryDokkanInfoAssetRef> {
    const refs = new Map<string, SupportMemoryDokkanInfoAssetRef>();

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

export function contentTypeForAsset(localPath: string): string {
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

function addAssetRef(
    refs: Map<string, SupportMemoryDokkanInfoAssetRef>,
    asset: SupportMemoryDokkanInfoAssetRef | undefined,
): void {
    const localPath = asset?.localPath;
    if (!localPath) {
        return;
    }

    const normalizedPath = normalizeProjectPath(localPath);
    const objectKey = supportMemoryAssetObjectKey(normalizedPath);
    if (!objectKey) {
        throw new Error(`Support memory asset path cannot be published: ${localPath}`);
    }

    const existing = refs.get(objectKey);
    if (existing && normalizeProjectPath(existing.localPath as string) !== normalizedPath) {
        throw new Error(`Multiple local paths map to support memory object ${objectKey}.`);
    }

    refs.set(objectKey, {
        ...asset,
        localPath: normalizedPath,
        objectKey,
    });
}

function normalizeProjectPath(value: string): string {
    return value.replace(/\\/g, "/").replace(/^\.\//, "");
}
