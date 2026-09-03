import { HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { createHash } from "crypto";
import { execFile } from "child_process";
import { existsSync } from "fs";
import { mkdir, readFile } from "fs/promises";
import { dirname, resolve, sep } from "path";
import { promisify } from "util";
import { writeFormattedJson } from "../format-json";
import {
    StageAssetInventoryEntry,
    StageAssetManifest,
    STAGE_ASSET_CONTRACT,
    STAGE_ASSET_CONTRACT_VERSION,
    normalizeStageAssetPath,
    validateStageAssetMissingAcceptance,
} from "./game-db-stage-assets";

const DEFAULT_BUCKET = "dokkanpanion-data";
const DEFAULT_STATE_PATH = "data/stage-assets/staging-v2-r2-publish-state.json";
const MANIFEST_FILE_NAME = "game-assets-manifest.json";
const MAX_UPLOAD_BYTES = 1024 * 1024 * 1024;
const UPLOAD_CONCURRENCY = 12;
const RETRY_ATTEMPTS = 4;
const execFileAsync = promisify(execFile);
let remoteClient: S3Client | undefined;

interface Options {
    bucket: string,
    objectPrefix: string,
    releaseDir: string,
    manifestPath: string,
    statePath: string,
    target: "remote" | "local",
    dryRun: boolean,
    maxUploadBytes: number,
}

interface State {
    schemaVersion: 1,
    status: "in-progress" | "complete",
    destination: { bucket: string, objectPrefix: string, target: "remote" | "local" },
    datasetVersion: string,
    manifestSha256: string,
    assets: Record<string, { sha256: string, sizeBytes: number }>,
}

interface ValidatedAsset { entry: StageAssetInventoryEntry, absolutePath: string }

export function parseStageAssetPublishArgs(argv: string[]): Options {
    const values = new Map<string, string>();
    const flags = new Set<string>();
    const valueOptions = new Set(["--bucket", "--object-prefix", "--release-dir", "--manifest", "--state", "--max-upload-bytes"]);
    const flagOptions = new Set(["--dry-run", "--local", "--remote"]);
    for (let index = 0; index < argv.length; index += 1) {
        const [name, inline] = argv[index].split("=", 2);
        if (flagOptions.has(name)) {
            if (inline !== undefined || flags.has(name)) throw new Error(`Invalid duplicate Stage asset flag: ${name}`);
            flags.add(name);
            continue;
        }
        if (!valueOptions.has(name)) throw new Error(`Unexpected Stage asset publisher argument: ${argv[index]}`);
        const value = inline ?? argv[++index];
        if (!value || values.has(name)) throw new Error(`Missing or duplicate Stage asset publisher argument: ${name}`);
        values.set(name, value);
    }
    if (flags.has("--local") && flags.has("--remote")) throw new Error("Choose only one of --local or --remote");
    const releaseDir = resolve(requireValue(values.get("--release-dir"), "--release-dir"));
    return {
        bucket: values.get("--bucket") ?? process.env.R2_BUCKET_NAME ?? DEFAULT_BUCKET,
        objectPrefix: normalizeObjectPrefix(values.get("--object-prefix") ?? ""),
        releaseDir,
        manifestPath: resolve(values.get("--manifest") ?? resolve(releaseDir, "stage-assets-manifest.json")),
        statePath: resolve(values.get("--state") ?? DEFAULT_STATE_PATH),
        target: flags.has("--local") ? "local" : "remote",
        dryRun: flags.has("--dry-run"),
        maxUploadBytes: positiveNumber(values.get("--max-upload-bytes"), MAX_UPLOAD_BYTES),
    };
}

async function main(): Promise<void> {
    const options = parseStageAssetPublishArgs(process.argv.slice(2));
    const manifestBytes = await readFile(options.manifestPath);
    const manifest = JSON.parse(manifestBytes.toString("utf8")) as StageAssetManifest;
    validateStageAssetManifest(manifest);
    const files = await mapWithConcurrency(manifest.assets, 16, entry => validateAsset(options.releaseDir, entry));
    const totalBytes = files.reduce((sum, file) => sum + file.entry.sizeBytes, 0);
    if (totalBytes !== manifest.assetBytes || totalBytes > options.maxUploadBytes) {
        throw new Error(`Stage asset bytes ${totalBytes} do not match the manifest or exceed the configured limit`);
    }
    const previous = await readState(options.statePath, options);
    const conflict = files.find(file => {
        const prior = previous?.assets[file.entry.objectKey];
        return prior && (prior.sha256 !== file.entry.sha256 || prior.sizeBytes !== file.entry.sizeBytes);
    });
    if (conflict) throw new Error(`Immutable Stage asset changed bytes: ${conflict.entry.objectKey}`);
    const changed = files.filter(file => !previous?.assets[file.entry.objectKey]);
    const manifestSha256 = sha256(manifestBytes);
    const uploadManifest = previous?.manifestSha256 !== manifestSha256;
    const uploadBytes = changed.reduce((sum, file) => sum + file.entry.sizeBytes, 0)
        + (uploadManifest ? manifestBytes.byteLength : 0);
    console.log(`Target: ${options.target}`);
    console.log(`Bucket: ${options.bucket}`);
    console.log(`Object prefix: ${options.objectPrefix || "(root)"}`);
    console.log(`Assets: ${files.length} files / ${totalBytes} bytes (${changed.length} changed)`);
    console.log(`Manifest: ${manifestBytes.byteLength} bytes -> ${scopedKey(options.objectPrefix, MANIFEST_FILE_NAME)}${uploadManifest ? " [upload]" : " [unchanged]"}`);
    console.log(`This run uploads: ${uploadBytes} bytes`);
    console.log(`Inventory SHA-256: ${manifest.inventorySha256}`);
    if (options.dryRun) {
        console.log("Dry run complete. No R2 objects or publish state were changed.");
        return;
    }
    const state: State = previous ?? {
        schemaVersion: 1,
        status: "in-progress",
        destination: destination(options),
        datasetVersion: manifest.datasetVersion,
        manifestSha256: "",
        assets: {},
    };
    state.status = "in-progress";
    state.datasetVersion = manifest.datasetVersion;
    let writeChain = Promise.resolve();
    const writeState = async () => {
        writeChain = writeChain.then(async () => {
            await mkdir(dirname(options.statePath), { recursive: true });
            await writeFormattedJson(options.statePath, state);
        });
        await writeChain;
    };
    await writeState();
    await mapWithConcurrency(changed, UPLOAD_CONCURRENCY, async file => {
        await uploadObject(options.bucket, scopedKey(options.objectPrefix, file.entry.objectKey), file.absolutePath, "image/png", "public, max-age=31536000, immutable", options.target, true, file.entry.sha256);
        state.assets[file.entry.objectKey] = { sha256: file.entry.sha256, sizeBytes: file.entry.sizeBytes };
        await writeState();
    });
    if (uploadManifest) {
        await uploadObject(options.bucket, scopedKey(options.objectPrefix, MANIFEST_FILE_NAME), options.manifestPath, "application/json", "no-store", options.target, false);
        state.manifestSha256 = manifestSha256;
    }
    state.status = "complete";
    await writeState();
    console.log("Stage asset R2 publish complete.");
}

export function validateStageAssetManifest(manifest: StageAssetManifest): void {
    if (manifest.schemaVersion !== 1 || manifest.contract !== STAGE_ASSET_CONTRACT
        || manifest.contractVersion !== STAGE_ASSET_CONTRACT_VERSION || manifest.objectPrefix !== "game-assets/"
        || !manifest.datasetVersion || !/^\d+$/.test(manifest.sourceSnapshotVersion)
        || !/^[a-f0-9]{64}$/.test(manifest.sourceDatabaseSha256)
        || manifest.assetCount !== manifest.assets.length
        || manifest.requestedAssetCount !== manifest.assetCount + manifest.missingAssetCount
        || manifest.missingAssetCount !== manifest.missingAssets.length
        || manifest.inventorySha256 !== sha256(Buffer.from(JSON.stringify(manifest.assets)))) {
        throw new Error("Invalid Stage asset manifest");
    }
    const keys = manifest.assets.map(asset => asset.objectKey);
    if (new Set(keys).size !== keys.length) throw new Error("Duplicate Stage asset object key");
    for (const asset of manifest.assets) {
        if (normalizeStageAssetPath(asset.path) !== asset.path || asset.objectKey !== `game-assets/${asset.path}`) {
            throw new Error(`Invalid Stage asset path: ${asset.path}`);
        }
        validateStageAssetSourceUrl(asset.sourceUrl, asset.path);
    }
    for (const missing of manifest.missingAssets) {
        if (normalizeStageAssetPath(missing.path) !== missing.path || !Array.isArray(missing.sourceUrls)) {
            throw new Error(`Invalid missing Stage asset path: ${missing.path}`);
        }
        missing.sourceUrls.forEach(sourceUrl => validateStageAssetSourceUrl(sourceUrl, missing.path));
    }
    validateStageAssetMissingAcceptance(manifest.sourceSnapshotVersion, manifest.missingAssets, manifest.missingAcceptance);
}

async function validateAsset(root: string, entry: StageAssetInventoryEntry): Promise<ValidatedAsset> {
    if (entry.objectKey !== `game-assets/${entry.path}` || entry.contentType !== "image/png"
        || !/^[a-f0-9]{64}$/.test(entry.sha256) || !Number.isSafeInteger(entry.sizeBytes) || entry.sizeBytes < 8) {
        throw new Error(`Invalid Stage asset entry: ${entry.objectKey}`);
    }
    const absolutePath = resolve(root, ...entry.objectKey.split("/"));
    if (!absolutePath.toLowerCase().startsWith(`${resolve(root)}${sep}`.toLowerCase())) throw new Error(`Stage asset escapes release root: ${entry.objectKey}`);
    const bytes = await readFile(absolutePath);
    if (bytes.byteLength !== entry.sizeBytes || sha256(bytes) !== entry.sha256) throw new Error(`Stage asset does not match manifest: ${entry.objectKey}`);
    return { entry, absolutePath };
}

async function readState(path: string, options: Options): Promise<State | undefined> {
    if (!existsSync(path)) return undefined;
    const state = JSON.parse(await readFile(path, "utf8")) as State;
    if (state.schemaVersion !== 1 || !state.assets || JSON.stringify(state.destination) !== JSON.stringify(destination(options))) {
        throw new Error(`Stage asset publish state belongs to another destination: ${path}`);
    }
    return state;
}

function destination(options: Options): State["destination"] {
    return { bucket: options.bucket, objectPrefix: options.objectPrefix, target: options.target };
}

async function uploadObject(bucket: string, key: string, path: string, contentType: string, cacheControl: string, target: "remote" | "local", immutable: boolean, expectedSha256?: string): Promise<void> {
    if (target === "remote") {
        const bytes = await readFile(path);
        for (let attempt = 1; attempt <= RETRY_ATTEMPTS; attempt += 1) {
            try {
                await stageAssetRemoteClient().send(new PutObjectCommand({
                    Bucket: bucket,
                    Key: key,
                    Body: bytes,
                    ContentType: contentType,
                    CacheControl: cacheControl,
                    ...(expectedSha256 ? { Metadata: { sha256: expectedSha256 } } : {}),
                    ...(immutable ? { IfNoneMatch: "*" } : {}),
                }));
                return;
            } catch (error) {
                const status = (error as any)?.$metadata?.httpStatusCode;
                if (immutable && (status === 409 || status === 412)) {
                    const existing = await stageAssetRemoteClient().send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
                    if (existing.ContentLength === bytes.byteLength
                        && existing.ContentType === contentType
                        && existing.CacheControl === cacheControl
                        && existing.Metadata?.sha256 === expectedSha256) {
                        return;
                    }
                    throw new Error(`Immutable Stage asset conflicts with the planned bytes: ${key}`);
                }
                if (attempt === RETRY_ATTEMPTS) throw error;
                await new Promise(done => setTimeout(done, attempt * 1500));
            }
        }
        return;
    }
    const args = ["r2", "object", "put", `${bucket}/${key}`, "--file", path, "--content-type", contentType, "--cache-control", cacheControl, "--local"];
    for (let attempt = 1; attempt <= RETRY_ATTEMPTS; attempt += 1) {
        try {
            if (process.platform === "win32") await execFileAsync("cmd.exe", ["/d", "/s", "/c", "npx", "wrangler", ...args]);
            else await execFileAsync("npx", ["wrangler", ...args]);
            return;
        } catch (error) {
            if (attempt === RETRY_ATTEMPTS) throw error;
            await new Promise(done => setTimeout(done, attempt * 1500));
        }
    }
}

function validateStageAssetSourceUrl(value: string, path: string): void {
    let url: URL;
    try {
        url = new URL(value);
    } catch {
        throw new Error(`Invalid Stage asset source URL for ${path}`);
    }
    if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) {
        throw new Error(`Unsafe Stage asset source URL for ${path}`);
    }
}

function stageAssetRemoteClient(): S3Client {
    if (remoteClient) return remoteClient;
    const accountId = process.env.CLOUDFLARE_ACCOUNT_ID ?? "";
    const accessKeyId = process.env.R2_ACCESS_KEY_ID ?? "";
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY ?? "";
    if (!/^[a-f0-9]{32}$/.test(accountId) || !accessKeyId || !secretAccessKey || /[\r\n]/.test(accessKeyId + secretAccessKey)) {
        throw new Error("Stage asset R2 S3 credentials are missing or invalid");
    }
    remoteClient = new S3Client({
        region: "auto",
        endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
        credentials: { accessKeyId, secretAccessKey },
    });
    return remoteClient;
}

async function mapWithConcurrency<T, R>(items: T[], concurrency: number, mapper: (item: T) => Promise<R>): Promise<R[]> {
    const results = new Array<R>(items.length);
    let cursor = 0;
    await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, async () => {
        while (true) {
            const index = cursor++;
            if (index >= items.length) return;
            results[index] = await mapper(items[index]);
        }
    }));
    return results;
}

function scopedKey(prefix: string, key: string): string { return prefix ? `${prefix}/${key}` : key; }
function sha256(bytes: Buffer): string { return createHash("sha256").update(bytes).digest("hex"); }
function requireValue(value: string | undefined, name: string): string { if (!value) throw new Error(`Missing Stage asset publisher argument: ${name}`); return value; }
function positiveNumber(value: string | undefined, fallback: number): number { const parsed = value ? Number(value) : fallback; if (!Number.isSafeInteger(parsed) || parsed < 1) throw new Error("Invalid max upload bytes"); return parsed; }
function normalizeObjectPrefix(value: string): string { const normalized = value.trim().replace(/^\/+|\/+$/g, ""); if (normalized && (!/^[A-Za-z0-9._-]+(?:\/[A-Za-z0-9._-]+)*$/.test(normalized) || normalized.split("/").some(part => part === "." || part === ".."))) throw new Error(`Invalid R2 object prefix: ${value}`); return normalized; }

if (require.main === module) {
    main().catch(error => {
        console.error(error instanceof Error ? error.message : String(error));
        process.exitCode = 1;
    });
}
