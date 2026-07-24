"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseStageDetailsR2Args = void 0;
const crypto_1 = require("crypto");
const child_process_1 = require("child_process");
const fs_1 = require("fs");
const promises_1 = require("fs/promises");
const path_1 = require("path");
const util_1 = require("util");
const format_json_1 = require("./format-json");
const stage_detail_dataset_artifacts_1 = require("./stage-detail-dataset-artifacts");
const DEFAULT_BUCKET = "dokkanpanion-data";
const DEFAULT_DETAILS_PATH = "data/stage-details/latest/stage-details.json";
const DEFAULT_MANIFEST_PATH = "data/stage-details/latest/stage-details-manifest.json";
const DEFAULT_STATE_PATH = "data/stage-details/latest/stage-details-r2-publish-state.json";
const MAX_DEFAULT_UPLOAD_BYTES = 512 * 1024 * 1024;
const UPLOAD_CONCURRENCY = 4;
const RETRY_ATTEMPTS = 4;
const execFileAsync = (0, util_1.promisify)(child_process_1.execFile);
function parseStageDetailsR2Args(argv) {
    const values = new Map();
    const flags = new Set();
    for (let index = 0; index < argv.length; index += 1) {
        const token = argv[index];
        if (!token.startsWith("--"))
            throw new Error(`Unexpected argument: ${token}`);
        const [name, inlineValue] = token.split("=", 2);
        if (inlineValue !== undefined) {
            values.set(name, inlineValue);
            continue;
        }
        const next = argv[index + 1];
        if (!next || next.startsWith("--"))
            flags.add(name);
        else {
            values.set(name, next);
            index += 1;
        }
    }
    return {
        bucket: values.get("--bucket") ?? DEFAULT_BUCKET,
        detailsPath: (0, path_1.resolve)(values.get("--details") ?? DEFAULT_DETAILS_PATH),
        manifestPath: (0, path_1.resolve)(values.get("--manifest") ?? DEFAULT_MANIFEST_PATH),
        statePath: (0, path_1.resolve)(values.get("--state") ?? DEFAULT_STATE_PATH),
        target: flags.has("--local") ? "local" : "remote",
        dryRun: flags.has("--dry-run"),
        maxUploadBytes: parsePositiveNumber(values.get("--max-upload-bytes"), MAX_DEFAULT_UPLOAD_BYTES),
    };
}
exports.parseStageDetailsR2Args = parseStageDetailsR2Args;
async function main() {
    const options = parseStageDetailsR2Args(process.argv.slice(2));
    const plan = await readPlan(options);
    printPlan(plan);
    if (options.dryRun) {
        console.log("Dry run complete. No R2 objects or publish state were changed.");
        return;
    }
    const state = {
        schemaVersion: 1,
        status: "in-progress",
        detailsSha256: plan.previousState?.detailsSha256 ?? "",
        manifestSha256: plan.previousState?.manifestSha256 ?? "",
        assets: { ...(plan.previousState?.assets ?? {}) },
    };
    const writeState = async () => {
        await (0, promises_1.mkdir)((0, path_1.dirname)(options.statePath), { recursive: true });
        await (0, format_json_1.writeFormattedJson)(options.statePath, state);
    };
    if (plan.uploadDetails) {
        await uploadObject(options.bucket, stage_detail_dataset_artifacts_1.STAGE_DETAILS_FILE_NAME, options.detailsPath, "application/json", "public, max-age=300", options.target);
        state.detailsSha256 = plan.manifest.sha256;
        await writeState();
    }
    await mapWithConcurrency(plan.changedAssets, UPLOAD_CONCURRENCY, async (asset) => {
        await uploadObject(options.bucket, asset.objectKey, asset.absolutePath, asset.contentType, "public, max-age=31536000, immutable", options.target);
        state.assets[asset.objectKey] = { sha256: asset.sha256, sizeBytes: asset.sizeBytes };
        await writeState();
    });
    if (plan.uploadManifest) {
        await uploadObject(options.bucket, stage_detail_dataset_artifacts_1.STAGE_DETAILS_MANIFEST_FILE_NAME, options.manifestPath, "application/json", "no-store", options.target);
        state.manifestSha256 = plan.manifestSha256;
    }
    state.status = "complete";
    await writeState();
    console.log("Stage details R2 publish complete.");
}
async function readPlan(options) {
    if (!(0, fs_1.existsSync)(options.detailsPath) || !(0, fs_1.existsSync)(options.manifestPath)) {
        throw new Error("Stage details JSON and manifest must exist before publishing.");
    }
    const detailsBuffer = await (0, promises_1.readFile)(options.detailsPath);
    const manifestBuffer = await (0, promises_1.readFile)(options.manifestPath);
    const dataset = JSON.parse(detailsBuffer.toString("utf8"));
    const manifest = JSON.parse(manifestBuffer.toString("utf8"));
    const detailsSha256 = (0, crypto_1.createHash)("sha256").update(detailsBuffer).digest("hex");
    if (manifest.fileName !== stage_detail_dataset_artifacts_1.STAGE_DETAILS_FILE_NAME || manifest.sizeBytes !== detailsBuffer.byteLength || manifest.sha256 !== detailsSha256) {
        throw new Error("Stage details manifest does not match the JSON payload.");
    }
    const assets = await (0, stage_detail_dataset_artifacts_1.inspectStageDetailsDatasetAssets)(dataset, process.cwd());
    const assetBytes = assets.reduce((total, asset) => total + asset.sizeBytes, 0);
    if (manifest.assetCount !== assets.length || manifest.assetBytes !== assetBytes) {
        throw new Error("Stage details asset counts or bytes do not match the manifest.");
    }
    const totalDatasetBytes = detailsBuffer.byteLength + manifestBuffer.byteLength + assetBytes;
    if (totalDatasetBytes > options.maxUploadBytes)
        throw new Error(`Stage details dataset exceeds ${options.maxUploadBytes} bytes.`);
    const previousState = await readState(options.statePath);
    const changedAssets = assets.filter(asset => previousState?.assets[asset.objectKey]?.sha256 !== asset.sha256);
    const manifestSha256 = (0, stage_detail_dataset_artifacts_1.stageDetailsManifestFingerprint)(manifest, manifestBuffer.byteLength);
    const uploadDetails = previousState?.detailsSha256 !== manifest.sha256;
    const uploadManifest = previousState?.manifestSha256 !== manifestSha256;
    return {
        options,
        manifest,
        assets,
        detailsBytes: detailsBuffer.byteLength,
        manifestBytes: manifestBuffer.byteLength,
        assetBytes,
        totalDatasetBytes,
        uploadBytes: (uploadDetails ? detailsBuffer.byteLength : 0)
            + (uploadManifest ? manifestBuffer.byteLength : 0)
            + changedAssets.reduce((total, asset) => total + asset.sizeBytes, 0),
        uploadDetails,
        uploadManifest,
        changedAssets,
        previousState,
        manifestSha256,
    };
}
async function readState(path) {
    if (!(0, fs_1.existsSync)(path))
        return undefined;
    const state = JSON.parse(await (0, promises_1.readFile)(path, "utf8"));
    if (state.schemaVersion !== 1 || !state.assets)
        throw new Error(`Unsupported stage details publish state: ${path}`);
    return state;
}
function printPlan(plan) {
    console.log(`Target: ${plan.options.target}`);
    console.log(`Bucket: ${plan.options.bucket}`);
    console.log(`Details: ${plan.detailsBytes} bytes -> ${stage_detail_dataset_artifacts_1.STAGE_DETAILS_FILE_NAME}${plan.uploadDetails ? " [upload]" : " [unchanged]"}`);
    console.log(`Manifest: ${plan.manifestBytes} bytes -> ${stage_detail_dataset_artifacts_1.STAGE_DETAILS_MANIFEST_FILE_NAME}${plan.uploadManifest ? " [upload]" : " [unchanged]"}`);
    console.log(`Assets: ${plan.assets.length} files / ${plan.assetBytes} bytes (${plan.changedAssets.length} changed)`);
    console.log(`Dataset size: ${plan.totalDatasetBytes} bytes`);
    console.log(`This run uploads: ${plan.uploadBytes} bytes`);
    console.log(`Dataset version: ${plan.manifest.datasetVersion}`);
    console.log(`SHA-256: ${plan.manifest.sha256}`);
}
async function uploadObject(bucket, key, filePath, contentType, cacheControl, target) {
    await runWrangler([
        "r2", "object", "put", `${bucket}/${key}`, "--file", filePath,
        "--content-type", contentType, "--cache-control", cacheControl,
        target === "remote" ? "--remote" : "--local",
    ]);
}
async function runWrangler(args) {
    for (let attempt = 1; attempt <= RETRY_ATTEMPTS; attempt += 1) {
        try {
            if (process.platform === "win32")
                await execFileAsync("cmd.exe", ["/d", "/s", "/c", "npx", "wrangler", ...args]);
            else
                await execFileAsync("npx", ["wrangler", ...args]);
            return;
        }
        catch (error) {
            if (attempt === RETRY_ATTEMPTS)
                throw error;
            await new Promise(resolvePromise => setTimeout(resolvePromise, attempt * 1500));
        }
    }
}
async function mapWithConcurrency(items, concurrency, mapper) {
    let nextIndex = 0;
    await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, async () => {
        while (true) {
            const index = nextIndex++;
            if (index >= items.length)
                return;
            await mapper(items[index]);
        }
    }));
}
function parsePositiveNumber(value, fallback) {
    if (!value)
        return fallback;
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed) || parsed < 1)
        throw new Error(`Invalid positive number: ${value}`);
    return parsed;
}
if (require.main === module) {
    main().catch(error => {
        console.error(error instanceof Error ? error.message : error);
        process.exitCode = 1;
    });
}
//# sourceMappingURL=publish-stage-details-r2.js.map