"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildSupportMemoryR2PublishPlan = exports.parseSupportMemoryR2PublishArgs = void 0;
const crypto_1 = require("crypto");
const child_process_1 = require("child_process");
const fs_1 = require("fs");
const promises_1 = require("fs/promises");
const path_1 = require("path");
const util_1 = require("util");
const format_json_1 = require("./format-json");
const support_memory_dataset_artifacts_1 = require("./support-memory-dataset-artifacts");
const DEFAULT_BUCKET = "dokkanpanion-data";
const DEFAULT_DETAILS_PATH = "data/support-memories/latest/support-memory-details.json";
const DEFAULT_MANIFEST_PATH = "data/support-memories/latest/support-memory-manifest.json";
const DEFAULT_STATE_PATH = "data/support-memories/latest/support-memory-r2-publish-state.json";
const MAX_DEFAULT_UPLOAD_BYTES = 1024 * 1024 * 1024;
const UPLOAD_CONCURRENCY = 6;
const WRANGLER_RETRY_ATTEMPTS = 4;
const execFileAsync = (0, util_1.promisify)(child_process_1.execFile);
function parseSupportMemoryR2PublishArgs(argv) {
    const values = new Map();
    const flags = new Set();
    for (let index = 0; index < argv.length; index += 1) {
        const token = argv[index];
        if (!token.startsWith("--")) {
            throw new Error(`Unexpected argument: ${token}`);
        }
        const [name, inlineValue] = token.split("=", 2);
        if (inlineValue !== undefined) {
            values.set(name, inlineValue);
            continue;
        }
        const nextToken = argv[index + 1];
        if (!nextToken || nextToken.startsWith("--")) {
            flags.add(name);
            continue;
        }
        values.set(name, nextToken);
        index += 1;
    }
    const target = flags.has("--local") ? "local" : "remote";
    if (flags.has("--local") && flags.has("--remote")) {
        throw new Error("Choose only one of --local or --remote.");
    }
    return {
        bucket: values.get("--bucket") ?? process.env.R2_BUCKET_NAME ?? DEFAULT_BUCKET,
        detailsPath: (0, path_1.resolve)(values.get("--details") ?? DEFAULT_DETAILS_PATH),
        manifestPath: (0, path_1.resolve)(values.get("--manifest") ?? DEFAULT_MANIFEST_PATH),
        statePath: (0, path_1.resolve)(values.get("--state") ?? DEFAULT_STATE_PATH),
        dryRun: flags.has("--dry-run"),
        target,
        keepStaleAssets: flags.has("--keep-stale-assets"),
        maxUploadBytes: parsePositiveNumber(values.get("--max-upload-bytes"), MAX_DEFAULT_UPLOAD_BYTES),
    };
}
exports.parseSupportMemoryR2PublishArgs = parseSupportMemoryR2PublishArgs;
function buildSupportMemoryR2PublishPlan(options, manifest, assets, detailsBytes, manifestBytes, previousState, manifestSha256Value) {
    if (manifest.fileName !== support_memory_dataset_artifacts_1.SUPPORT_MEMORY_DETAILS_FILE_NAME) {
        throw new Error(`Unexpected support memory file name in manifest: ${manifest.fileName}`);
    }
    if (!manifest.assetsIncluded) {
        throw new Error("Support memory manifest does not include the local asset mirror.");
    }
    const assetBytes = assets.reduce((total, asset) => total + asset.sizeBytes, 0);
    if (manifest.assetCount !== assets.length || manifest.assetBytes !== assetBytes) {
        throw new Error("Support memory asset counts or bytes do not match the manifest.");
    }
    const totalDatasetBytes = detailsBytes + manifestBytes + assetBytes;
    if (totalDatasetBytes > options.maxUploadBytes) {
        throw new Error(`Support memory dataset is ${totalDatasetBytes} bytes, above the configured limit of ${options.maxUploadBytes} bytes.`);
    }
    const previousAssets = previousState?.assets ?? {};
    const changedAssets = assets.filter(asset => previousAssets[asset.objectKey]?.sha256 !== asset.sha256);
    const staleAssetKeys = Object.keys(previousAssets)
        .filter(objectKey => !assets.some(asset => asset.objectKey === objectKey))
        .sort();
    const uploadDetails = previousState?.detailsSha256 !== manifest.sha256;
    const resolvedManifestSha256 = manifestSha256Value ?? manifestFingerprint(manifest, manifestBytes);
    const uploadManifest = previousState?.manifestSha256 !== resolvedManifestSha256;
    const uploadBytes = (uploadDetails ? detailsBytes : 0)
        + (uploadManifest ? manifestBytes : 0)
        + changedAssets.reduce((total, asset) => total + asset.sizeBytes, 0);
    return {
        options,
        manifest,
        assets,
        detailsObjectKey: support_memory_dataset_artifacts_1.SUPPORT_MEMORY_DETAILS_FILE_NAME,
        manifestObjectKey: support_memory_dataset_artifacts_1.SUPPORT_MEMORY_MANIFEST_FILE_NAME,
        detailsBytes,
        manifestBytes,
        assetBytes,
        totalDatasetBytes,
        uploadBytes,
        uploadAssetCount: changedAssets.length,
        staleAssetKeys: options.keepStaleAssets ? [] : staleAssetKeys,
        uploadDetails,
        uploadManifest,
        manifestSha256: resolvedManifestSha256,
        previousState,
    };
}
exports.buildSupportMemoryR2PublishPlan = buildSupportMemoryR2PublishPlan;
async function main() {
    const options = parseSupportMemoryR2PublishArgs(process.argv.slice(2));
    const plan = await readPublishPlan(options);
    printPlan(plan);
    if (options.dryRun) {
        console.log("Dry run complete. No R2 objects or publish state were changed.");
        return;
    }
    const checkpointState = createCheckpointState(plan);
    const writeCheckpoint = createCheckpointWriter(options.statePath, checkpointState);
    await writeCheckpoint();
    if (plan.uploadDetails) {
        await uploadObject(plan.options.bucket, plan.detailsObjectKey, plan.options.detailsPath, "application/json", "public, max-age=300", plan.options.target);
        checkpointState.detailsSha256 = plan.manifest.sha256;
        await writeCheckpoint();
    }
    const changedAssets = plan.assets.filter(asset => (plan.previousState?.assets[asset.objectKey]?.sha256 !== asset.sha256));
    await mapWithConcurrency(changedAssets, UPLOAD_CONCURRENCY, async (asset) => {
        await uploadObject(plan.options.bucket, asset.objectKey, asset.absolutePath, asset.contentType, "public, max-age=31536000, immutable", plan.options.target);
        checkpointState.assets[asset.objectKey] = {
            sha256: asset.sha256,
            sizeBytes: asset.sizeBytes,
        };
        await writeCheckpoint();
    });
    for (const staleAssetKey of plan.staleAssetKeys) {
        await deleteObject(plan.options.bucket, staleAssetKey, plan.options.target);
        delete checkpointState.assets[staleAssetKey];
        await writeCheckpoint();
    }
    if (plan.uploadManifest) {
        await uploadObject(plan.options.bucket, plan.manifestObjectKey, plan.options.manifestPath, "application/json", "no-store", plan.options.target);
        checkpointState.manifestSha256 = plan.manifestSha256;
    }
    checkpointState.status = "complete";
    await writeCheckpoint();
    console.log("Support memory R2 publish complete.");
}
async function readPublishPlan(options) {
    if (!(0, fs_1.existsSync)(options.detailsPath)) {
        throw new Error(`Support memory details not found: ${options.detailsPath}`);
    }
    if (!(0, fs_1.existsSync)(options.manifestPath)) {
        throw new Error(`Support memory manifest not found: ${options.manifestPath}`);
    }
    const detailsBuffer = await (0, promises_1.readFile)(options.detailsPath);
    const manifestBuffer = await (0, promises_1.readFile)(options.manifestPath);
    const dataset = JSON.parse(detailsBuffer.toString("utf8"));
    const manifest = JSON.parse(manifestBuffer.toString("utf8"));
    const actualDetailsSha256 = (0, crypto_1.createHash)("sha256").update(detailsBuffer).digest("hex");
    const actualManifestSha256 = (0, crypto_1.createHash)("sha256").update(manifestBuffer).digest("hex");
    if (manifest.sizeBytes !== detailsBuffer.byteLength) {
        throw new Error(`Support memory details size ${detailsBuffer.byteLength} does not match manifest size ${manifest.sizeBytes}.`);
    }
    if (actualDetailsSha256.toLowerCase() !== manifest.sha256.toLowerCase()) {
        throw new Error("Support memory details SHA-256 does not match the manifest.");
    }
    const inspection = await (0, support_memory_dataset_artifacts_1.inspectSupportMemoryDatasetArtifacts)(dataset, options.detailsPath);
    if (inspection.manifest.sha256 !== manifest.sha256 || inspection.manifest.assetBytes !== manifest.assetBytes) {
        throw new Error("Support memory files do not match the generated manifest.");
    }
    const previousState = await readPublishState(options.statePath);
    return buildSupportMemoryR2PublishPlan(options, manifest, inspection.assets, detailsBuffer.byteLength, manifestBuffer.byteLength, previousState, actualManifestSha256);
}
function createCheckpointState(plan) {
    return {
        schemaVersion: 1,
        status: "in-progress",
        datasetVersion: plan.manifest.datasetVersion,
        detailsSha256: plan.previousState?.detailsSha256 ?? "",
        manifestSha256: plan.previousState?.manifestSha256 ?? "",
        assets: { ...(plan.previousState?.assets ?? {}) },
    };
}
function createCheckpointWriter(statePath, state) {
    let writeChain = Promise.resolve();
    return async () => {
        writeChain = writeChain.then(() => writeCheckpointState(statePath, state));
        await writeChain;
    };
}
async function writeCheckpointState(statePath, state) {
    await (0, promises_1.mkdir)((0, path_1.dirname)(statePath), { recursive: true });
    await (0, format_json_1.writeFormattedJson)(statePath, state);
}
async function readPublishState(statePath) {
    if (!(0, fs_1.existsSync)(statePath)) {
        return undefined;
    }
    const state = JSON.parse(await (0, promises_1.readFile)(statePath, "utf8"));
    if (state.schemaVersion !== 1 || !state.assets || typeof state.assets !== "object") {
        throw new Error(`Unsupported support memory publish state: ${statePath}`);
    }
    return state;
}
function printPlan(plan) {
    console.log(`Target: ${plan.options.target}`);
    console.log(`Bucket: ${plan.options.bucket}`);
    console.log(`Details: ${plan.detailsBytes} bytes -> ${plan.detailsObjectKey}${plan.uploadDetails ? " [upload]" : " [unchanged]"}`);
    console.log(`Manifest: ${plan.manifestBytes} bytes -> ${plan.manifestObjectKey}${plan.uploadManifest ? " [upload]" : " [unchanged]"}`);
    console.log(`Assets: ${plan.assets.length} files / ${plan.assetBytes} bytes (${plan.uploadAssetCount} changed)`);
    console.log(`Stale tracked assets: ${plan.staleAssetKeys.length}`);
    console.log(`Dataset size: ${plan.totalDatasetBytes} bytes`);
    console.log(`This run uploads: ${plan.uploadBytes} bytes`);
    console.log(`Dataset version: ${plan.manifest.datasetVersion}`);
    console.log(`SHA-256: ${plan.manifest.sha256}`);
}
async function uploadObject(bucket, objectKey, filePath, contentType, cacheControl, target) {
    const args = [
        "r2",
        "object",
        "put",
        `${bucket}/${objectKey}`,
        "--file",
        filePath,
        "--content-type",
        contentType,
        "--cache-control",
        cacheControl,
        target === "remote" ? "--remote" : "--local",
    ];
    await runWranglerWithRetry(args);
}
async function deleteObject(bucket, objectKey, target) {
    const args = [
        "r2",
        "object",
        "delete",
        `${bucket}/${objectKey}`,
        target === "remote" ? "--remote" : "--local",
        "--force",
    ];
    await runWranglerWithRetry(args);
}
async function runWranglerWithRetry(args) {
    for (let attempt = 1; attempt <= WRANGLER_RETRY_ATTEMPTS; attempt += 1) {
        try {
            if (process.platform === "win32") {
                await execFileAsync("cmd.exe", ["/d", "/s", "/c", "npx", "wrangler", ...args]);
            }
            else {
                await execFileAsync("npx", ["wrangler", ...args]);
            }
            return;
        }
        catch (error) {
            if (attempt === WRANGLER_RETRY_ATTEMPTS || !isRetryableWranglerError(error)) {
                throw error;
            }
            const delayMs = attempt * 1500;
            console.warn(`Wrangler transient failure; retrying in ${delayMs}ms (${attempt}/${WRANGLER_RETRY_ATTEMPTS - 1}).`);
            await delay(delayMs);
        }
    }
}
function isRetryableWranglerError(error) {
    const message = error instanceof Error ? error.message : String(error);
    return /(?:\b429\b|\b500\b|\b502\b|\b503\b|\b504\b|internal server error|econnreset|etimedout|socket hang up)/i.test(message);
}
function delay(milliseconds) {
    return new Promise(resolvePromise => setTimeout(resolvePromise, milliseconds));
}
async function mapWithConcurrency(values, concurrency, worker) {
    let nextIndex = 0;
    const workers = Array.from({ length: Math.min(concurrency, values.length) }, async () => {
        while (true) {
            const index = nextIndex++;
            if (index >= values.length) {
                return;
            }
            await worker(values[index], index);
        }
    });
    await Promise.all(workers);
}
function manifestFingerprint(manifest, manifestBytes) {
    return (0, crypto_1.createHash)("sha256")
        .update(JSON.stringify({ ...manifest, _serializedBytes: manifestBytes }))
        .digest("hex");
}
function parsePositiveNumber(value, fallback) {
    if (!value)
        return fallback;
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed) || parsed < 1) {
        throw new Error(`Invalid positive number: ${value}`);
    }
    return parsed;
}
if (require.main === module) {
    main().catch(error => {
        console.error(error instanceof Error ? error.message : error);
        process.exitCode = 1;
    });
}
//# sourceMappingURL=publish-support-memory-r2.js.map