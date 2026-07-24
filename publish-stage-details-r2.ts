import { createHash } from "crypto";
import { execFile } from "child_process";
import { existsSync } from "fs";
import { mkdir, readFile, writeFile } from "fs/promises";
import { dirname, resolve } from "path";
import { promisify } from "util";
import { writeFormattedJson } from "./format-json";
import {
    inspectStageDetailsDatasetAssets,
    stageDetailsManifestFingerprint,
    STAGE_DETAILS_FILE_NAME,
    STAGE_DETAILS_MANIFEST_FILE_NAME,
    StageDetailsDatasetAsset,
    StageDetailsDatasetManifest,
} from "./stage-detail-dataset-artifacts";
import { StageDetailsDataset } from "./stage-detail";

const DEFAULT_BUCKET = "dokkanpanion-data";
const DEFAULT_DETAILS_PATH = "data/stage-details/latest/stage-details.json";
const DEFAULT_MANIFEST_PATH = "data/stage-details/latest/stage-details-manifest.json";
const DEFAULT_STATE_PATH = "data/stage-details/latest/stage-details-r2-publish-state.json";
const MAX_DEFAULT_UPLOAD_BYTES = 512 * 1024 * 1024;
const UPLOAD_CONCURRENCY = 4;
const RETRY_ATTEMPTS = 4;
const execFileAsync = promisify(execFile);

interface PublishOptions {
    bucket: string,
    detailsPath: string,
    manifestPath: string,
    statePath: string,
    target: "remote" | "local",
    dryRun: boolean,
    maxUploadBytes: number,
}

interface PublishState {
    schemaVersion: 1,
    status?: "in-progress" | "complete",
    detailsSha256: string,
    manifestSha256: string,
    assets: Record<string, { sha256: string, sizeBytes: number }>,
}

interface PublishPlan {
    options: PublishOptions,
    manifest: StageDetailsDatasetManifest,
    assets: StageDetailsDatasetAsset[],
    detailsBytes: number,
    manifestBytes: number,
    assetBytes: number,
    totalDatasetBytes: number,
    uploadBytes: number,
    uploadDetails: boolean,
    uploadManifest: boolean,
    changedAssets: StageDetailsDatasetAsset[],
    previousState?: PublishState,
    manifestSha256: string,
}

export function parseStageDetailsR2Args(argv: string[]): PublishOptions {
    const values = new Map<string, string>();
    const flags = new Set<string>();
    for (let index = 0; index < argv.length; index += 1) {
        const token = argv[index];
        if (!token.startsWith("--")) throw new Error(`Unexpected argument: ${token}`);
        const [name, inlineValue] = token.split("=", 2);
        if (inlineValue !== undefined) {
            values.set(name, inlineValue);
            continue;
        }
        const next = argv[index + 1];
        if (!next || next.startsWith("--")) flags.add(name);
        else {
            values.set(name, next);
            index += 1;
        }
    }
    return {
        bucket: values.get("--bucket") ?? DEFAULT_BUCKET,
        detailsPath: resolve(values.get("--details") ?? DEFAULT_DETAILS_PATH),
        manifestPath: resolve(values.get("--manifest") ?? DEFAULT_MANIFEST_PATH),
        statePath: resolve(values.get("--state") ?? DEFAULT_STATE_PATH),
        target: flags.has("--local") ? "local" : "remote",
        dryRun: flags.has("--dry-run"),
        maxUploadBytes: parsePositiveNumber(values.get("--max-upload-bytes"), MAX_DEFAULT_UPLOAD_BYTES),
    };
}

async function main(): Promise<void> {
    const options = parseStageDetailsR2Args(process.argv.slice(2));
    const plan = await readPlan(options);
    printPlan(plan);
    if (options.dryRun) {
        console.log("Dry run complete. No R2 objects or publish state were changed.");
        return;
    }

    const state: PublishState = {
        schemaVersion: 1,
        status: "in-progress",
        detailsSha256: plan.previousState?.detailsSha256 ?? "",
        manifestSha256: plan.previousState?.manifestSha256 ?? "",
        assets: { ...(plan.previousState?.assets ?? {}) },
    };
    const writeState = async () => {
        await mkdir(dirname(options.statePath), { recursive: true });
        await writeFormattedJson(options.statePath, state);
    };

    if (plan.uploadDetails) {
        await uploadObject(options.bucket, STAGE_DETAILS_FILE_NAME, options.detailsPath, "application/json", "public, max-age=300", options.target);
        state.detailsSha256 = plan.manifest.sha256;
        await writeState();
    }
    await mapWithConcurrency(plan.changedAssets, UPLOAD_CONCURRENCY, async asset => {
        await uploadObject(options.bucket, asset.objectKey, asset.absolutePath, asset.contentType, "public, max-age=31536000, immutable", options.target);
        state.assets[asset.objectKey] = { sha256: asset.sha256, sizeBytes: asset.sizeBytes };
        await writeState();
    });
    if (plan.uploadManifest) {
        await uploadObject(options.bucket, STAGE_DETAILS_MANIFEST_FILE_NAME, options.manifestPath, "application/json", "no-store", options.target);
        state.manifestSha256 = plan.manifestSha256;
    }
    state.status = "complete";
    await writeState();
    console.log("Stage details R2 publish complete.");
}

async function readPlan(options: PublishOptions): Promise<PublishPlan> {
    if (!existsSync(options.detailsPath) || !existsSync(options.manifestPath)) {
        throw new Error("Stage details JSON and manifest must exist before publishing.");
    }
    const detailsBuffer = await readFile(options.detailsPath);
    const manifestBuffer = await readFile(options.manifestPath);
    const dataset = JSON.parse(detailsBuffer.toString("utf8")) as StageDetailsDataset;
    const manifest = JSON.parse(manifestBuffer.toString("utf8")) as StageDetailsDatasetManifest;
    const detailsSha256 = createHash("sha256").update(detailsBuffer).digest("hex");
    if (manifest.fileName !== STAGE_DETAILS_FILE_NAME || manifest.sizeBytes !== detailsBuffer.byteLength || manifest.sha256 !== detailsSha256) {
        throw new Error("Stage details manifest does not match the JSON payload.");
    }
    const assets = await inspectStageDetailsDatasetAssets(dataset, process.cwd());
    const assetBytes = assets.reduce((total, asset) => total + asset.sizeBytes, 0);
    if (manifest.assetCount !== assets.length || manifest.assetBytes !== assetBytes) {
        throw new Error("Stage details asset counts or bytes do not match the manifest.");
    }
    const totalDatasetBytes = detailsBuffer.byteLength + manifestBuffer.byteLength + assetBytes;
    if (totalDatasetBytes > options.maxUploadBytes) throw new Error(`Stage details dataset exceeds ${options.maxUploadBytes} bytes.`);
    const previousState = await readState(options.statePath);
    const changedAssets = assets.filter(asset => previousState?.assets[asset.objectKey]?.sha256 !== asset.sha256);
    const manifestSha256 = stageDetailsManifestFingerprint(manifest, manifestBuffer.byteLength);
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

async function readState(path: string): Promise<PublishState | undefined> {
    if (!existsSync(path)) return undefined;
    const state = JSON.parse(await readFile(path, "utf8")) as PublishState;
    if (state.schemaVersion !== 1 || !state.assets) throw new Error(`Unsupported stage details publish state: ${path}`);
    return state;
}

function printPlan(plan: PublishPlan): void {
    console.log(`Target: ${plan.options.target}`);
    console.log(`Bucket: ${plan.options.bucket}`);
    console.log(`Details: ${plan.detailsBytes} bytes -> ${STAGE_DETAILS_FILE_NAME}${plan.uploadDetails ? " [upload]" : " [unchanged]"}`);
    console.log(`Manifest: ${plan.manifestBytes} bytes -> ${STAGE_DETAILS_MANIFEST_FILE_NAME}${plan.uploadManifest ? " [upload]" : " [unchanged]"}`);
    console.log(`Assets: ${plan.assets.length} files / ${plan.assetBytes} bytes (${plan.changedAssets.length} changed)`);
    console.log(`Dataset size: ${plan.totalDatasetBytes} bytes`);
    console.log(`This run uploads: ${plan.uploadBytes} bytes`);
    console.log(`Dataset version: ${plan.manifest.datasetVersion}`);
    console.log(`SHA-256: ${plan.manifest.sha256}`);
}

async function uploadObject(bucket: string, key: string, filePath: string, contentType: string, cacheControl: string, target: "remote" | "local"): Promise<void> {
    await runWrangler([
        "r2", "object", "put", `${bucket}/${key}`, "--file", filePath,
        "--content-type", contentType, "--cache-control", cacheControl,
        target === "remote" ? "--remote" : "--local",
    ]);
}

async function runWrangler(args: string[]): Promise<void> {
    for (let attempt = 1; attempt <= RETRY_ATTEMPTS; attempt += 1) {
        try {
            if (process.platform === "win32") await execFileAsync("cmd.exe", ["/d", "/s", "/c", "npx", "wrangler", ...args]);
            else await execFileAsync("npx", ["wrangler", ...args]);
            return;
        } catch (error) {
            if (attempt === RETRY_ATTEMPTS) throw error;
            await new Promise(resolvePromise => setTimeout(resolvePromise, attempt * 1500));
        }
    }
}

async function mapWithConcurrency<T>(items: T[], concurrency: number, mapper: (item: T) => Promise<void>): Promise<void> {
    let nextIndex = 0;
    await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, async () => {
        while (true) {
            const index = nextIndex++;
            if (index >= items.length) return;
            await mapper(items[index]);
        }
    }));
}

function parsePositiveNumber(value: string | undefined, fallback: number): number {
    if (!value) return fallback;
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed) || parsed < 1) throw new Error(`Invalid positive number: ${value}`);
    return parsed;
}

if (require.main === module) {
    main().catch(error => {
        console.error(error instanceof Error ? error.message : error);
        process.exitCode = 1;
    });
}
