"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateStageAssetManifest = exports.parseStageAssetPublishArgs = void 0;
const client_s3_1 = require("@aws-sdk/client-s3");
const crypto_1 = require("crypto");
const child_process_1 = require("child_process");
const fs_1 = require("fs");
const promises_1 = require("fs/promises");
const path_1 = require("path");
const util_1 = require("util");
const format_json_1 = require("../format-json");
const game_db_stage_assets_1 = require("./game-db-stage-assets");
const DEFAULT_BUCKET = "dokkanpanion-data";
const DEFAULT_STATE_PATH = "data/stage-assets/staging-v2-r2-publish-state.json";
const MANIFEST_FILE_NAME = "game-assets-manifest.json";
const MAX_UPLOAD_BYTES = 1024 * 1024 * 1024;
const UPLOAD_CONCURRENCY = 12;
const RETRY_ATTEMPTS = 4;
const execFileAsync = (0, util_1.promisify)(child_process_1.execFile);
let remoteClient;
function parseStageAssetPublishArgs(argv) {
    const values = new Map();
    const flags = new Set();
    const valueOptions = new Set(["--bucket", "--object-prefix", "--release-dir", "--manifest", "--state", "--max-upload-bytes"]);
    const flagOptions = new Set(["--dry-run", "--local", "--remote"]);
    for (let index = 0; index < argv.length; index += 1) {
        const [name, inline] = argv[index].split("=", 2);
        if (flagOptions.has(name)) {
            if (inline !== undefined || flags.has(name))
                throw new Error(`Invalid duplicate Stage asset flag: ${name}`);
            flags.add(name);
            continue;
        }
        if (!valueOptions.has(name))
            throw new Error(`Unexpected Stage asset publisher argument: ${argv[index]}`);
        const value = inline ?? argv[++index];
        if (!value || values.has(name))
            throw new Error(`Missing or duplicate Stage asset publisher argument: ${name}`);
        values.set(name, value);
    }
    if (flags.has("--local") && flags.has("--remote"))
        throw new Error("Choose only one of --local or --remote");
    const releaseDir = (0, path_1.resolve)(requireValue(values.get("--release-dir"), "--release-dir"));
    return {
        bucket: values.get("--bucket") ?? process.env.R2_BUCKET_NAME ?? DEFAULT_BUCKET,
        objectPrefix: normalizeObjectPrefix(values.get("--object-prefix") ?? ""),
        releaseDir,
        manifestPath: (0, path_1.resolve)(values.get("--manifest") ?? (0, path_1.resolve)(releaseDir, "stage-assets-manifest.json")),
        statePath: (0, path_1.resolve)(values.get("--state") ?? DEFAULT_STATE_PATH),
        target: flags.has("--local") ? "local" : "remote",
        dryRun: flags.has("--dry-run"),
        maxUploadBytes: positiveNumber(values.get("--max-upload-bytes"), MAX_UPLOAD_BYTES),
    };
}
exports.parseStageAssetPublishArgs = parseStageAssetPublishArgs;
async function main() {
    const options = parseStageAssetPublishArgs(process.argv.slice(2));
    const manifestBytes = await (0, promises_1.readFile)(options.manifestPath);
    const manifest = JSON.parse(manifestBytes.toString("utf8"));
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
    if (conflict)
        throw new Error(`Immutable Stage asset changed bytes: ${conflict.entry.objectKey}`);
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
    const state = previous ?? {
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
            await (0, promises_1.mkdir)((0, path_1.dirname)(options.statePath), { recursive: true });
            await (0, format_json_1.writeFormattedJson)(options.statePath, state);
        });
        await writeChain;
    };
    await writeState();
    await mapWithConcurrency(changed, UPLOAD_CONCURRENCY, async (file) => {
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
function validateStageAssetManifest(manifest) {
    if (manifest.schemaVersion !== 1 || manifest.contract !== game_db_stage_assets_1.STAGE_ASSET_CONTRACT
        || manifest.contractVersion !== game_db_stage_assets_1.STAGE_ASSET_CONTRACT_VERSION || manifest.objectPrefix !== "game-assets/"
        || !manifest.datasetVersion || !/^\d+$/.test(manifest.sourceSnapshotVersion)
        || !/^[a-f0-9]{64}$/.test(manifest.sourceDatabaseSha256)
        || manifest.assetCount !== manifest.assets.length
        || manifest.requestedAssetCount !== manifest.assetCount + manifest.missingAssetCount
        || manifest.missingAssetCount !== manifest.missingAssets.length
        || manifest.inventorySha256 !== sha256(Buffer.from(JSON.stringify(manifest.assets)))) {
        throw new Error("Invalid Stage asset manifest");
    }
    const keys = manifest.assets.map(asset => asset.objectKey);
    if (new Set(keys).size !== keys.length)
        throw new Error("Duplicate Stage asset object key");
    for (const asset of manifest.assets) {
        if ((0, game_db_stage_assets_1.normalizeStageAssetPath)(asset.path) !== asset.path || asset.objectKey !== `game-assets/${asset.path}`) {
            throw new Error(`Invalid Stage asset path: ${asset.path}`);
        }
        validateStageAssetSourceUrl(asset.sourceUrl, asset.path, asset.sourceFiles);
    }
    for (const missing of manifest.missingAssets) {
        if ((0, game_db_stage_assets_1.normalizeStageAssetPath)(missing.path) !== missing.path || !Array.isArray(missing.sourceUrls)) {
            throw new Error(`Invalid missing Stage asset path: ${missing.path}`);
        }
        missing.sourceUrls.forEach(sourceUrl => validateStageAssetSourceUrl(sourceUrl, missing.path));
    }
    (0, game_db_stage_assets_1.validateStageAssetMissingAcceptance)(manifest.sourceSnapshotVersion, manifest.missingAssets, manifest.missingAcceptance);
}
exports.validateStageAssetManifest = validateStageAssetManifest;
async function validateAsset(root, entry) {
    if (entry.objectKey !== `game-assets/${entry.path}` || entry.contentType !== "image/png"
        || !/^[a-f0-9]{64}$/.test(entry.sha256) || !Number.isSafeInteger(entry.sizeBytes) || entry.sizeBytes < 8) {
        throw new Error(`Invalid Stage asset entry: ${entry.objectKey}`);
    }
    const absolutePath = (0, path_1.resolve)(root, ...entry.objectKey.split("/"));
    if (!absolutePath.toLowerCase().startsWith(`${(0, path_1.resolve)(root)}${path_1.sep}`.toLowerCase()))
        throw new Error(`Stage asset escapes release root: ${entry.objectKey}`);
    const bytes = await (0, promises_1.readFile)(absolutePath);
    if (bytes.byteLength !== entry.sizeBytes || sha256(bytes) !== entry.sha256)
        throw new Error(`Stage asset does not match manifest: ${entry.objectKey}`);
    return { entry, absolutePath };
}
async function readState(path, options) {
    if (!(0, fs_1.existsSync)(path))
        return undefined;
    const state = JSON.parse(await (0, promises_1.readFile)(path, "utf8"));
    if (state.schemaVersion !== 1 || !state.assets || JSON.stringify(state.destination) !== JSON.stringify(destination(options))) {
        throw new Error(`Stage asset publish state belongs to another destination: ${path}`);
    }
    return state;
}
function destination(options) {
    return { bucket: options.bucket, objectPrefix: options.objectPrefix, target: options.target };
}
async function uploadObject(bucket, key, path, contentType, cacheControl, target, immutable, expectedSha256) {
    if (target === "remote") {
        const bytes = await (0, promises_1.readFile)(path);
        for (let attempt = 1; attempt <= RETRY_ATTEMPTS; attempt += 1) {
            try {
                await stageAssetRemoteClient().send(new client_s3_1.PutObjectCommand({
                    Bucket: bucket,
                    Key: key,
                    Body: bytes,
                    ContentType: contentType,
                    CacheControl: cacheControl,
                    ...(expectedSha256 ? { Metadata: { sha256: expectedSha256 } } : {}),
                    ...(immutable ? { IfNoneMatch: "*" } : {}),
                }));
                return;
            }
            catch (error) {
                const status = error?.$metadata?.httpStatusCode;
                if (immutable && (status === 409 || status === 412)) {
                    const existing = await stageAssetRemoteClient().send(new client_s3_1.HeadObjectCommand({ Bucket: bucket, Key: key }));
                    if (existing.ContentLength === bytes.byteLength
                        && existing.ContentType === contentType
                        && existing.CacheControl === cacheControl
                        && existing.Metadata?.sha256 === expectedSha256) {
                        return;
                    }
                    throw new Error(`Immutable Stage asset conflicts with the planned bytes: ${key}`);
                }
                if (attempt === RETRY_ATTEMPTS)
                    throw error;
                await new Promise(done => setTimeout(done, attempt * 1500));
            }
        }
        return;
    }
    const args = ["r2", "object", "put", `${bucket}/${key}`, "--file", path, "--content-type", contentType, "--cache-control", cacheControl, "--local"];
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
            await new Promise(done => setTimeout(done, attempt * 1500));
        }
    }
}
function validateStageAssetSourceUrl(value, path, sourceFiles) {
    const officialScheme = value.startsWith("official-cpk-derived://")
        ? "official-cpk-derived"
        : value.startsWith("official-cpk-extract://")
            ? "official-cpk-extract"
            : undefined;
    if (officialScheme) {
        const expectedPath = `${officialScheme}://${path}`;
        const wallpaperPath = /^item\/wallpaper\/(\d{4})\/(icon|thumb|full)_\1\.png$/.exec(path);
        const wallpaperSource = /^official-cpk-extract:\/\/item\/wallpaper\/(\d{4})\.cpk#([A-Za-z0-9_-]+\.png)$/.exec(value);
        const validPathKind = officialScheme === "official-cpk-derived"
            ? /^derived\/equipment\/levels\/lv-\d+(?:-\d+)?\.png$/.test(path)
            : /^layout\/en\/image\/(?:character|charamenu\/potential)\/[A-Za-z0-9_.-]+\.png$/.test(path) || Boolean(wallpaperPath);
        const expectedWallpaperMember = wallpaperPath
            ? wallpaperPath[2] === "full" ? `Images_${wallpaperPath[1]}.png` : `${wallpaperPath[2]}_${wallpaperPath[1]}.png`
            : undefined;
        const validSourceUrl = wallpaperPath
            ? wallpaperSource?.[1] === wallpaperPath[1] && wallpaperSource[2] === expectedWallpaperMember
            : value === expectedPath;
        if (!validSourceUrl || !validPathKind || !sourceFiles?.length
            || sourceFiles.some(source => !/^(?:fonts|layout|archives|extracted)\/[A-Za-z0-9_./-]+$/.test(source)
                || source.split("/").some(part => !part || part === "." || part === ".."))) {
            throw new Error(`Unsafe Stage asset source URL for ${path}`);
        }
        return;
    }
    let url;
    try {
        url = new URL(value);
    }
    catch {
        throw new Error(`Invalid Stage asset source URL for ${path}`);
    }
    if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) {
        throw new Error(`Unsafe Stage asset source URL for ${path}`);
    }
}
function stageAssetRemoteClient() {
    if (remoteClient)
        return remoteClient;
    const accountId = process.env.CLOUDFLARE_ACCOUNT_ID ?? "";
    const accessKeyId = process.env.R2_ACCESS_KEY_ID ?? "";
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY ?? "";
    if (!/^[a-f0-9]{32}$/.test(accountId) || !accessKeyId || !secretAccessKey || /[\r\n]/.test(accessKeyId + secretAccessKey)) {
        throw new Error("Stage asset R2 S3 credentials are missing or invalid");
    }
    remoteClient = new client_s3_1.S3Client({
        region: "auto",
        endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
        credentials: { accessKeyId, secretAccessKey },
    });
    return remoteClient;
}
async function mapWithConcurrency(items, concurrency, mapper) {
    const results = new Array(items.length);
    let cursor = 0;
    await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, async () => {
        while (true) {
            const index = cursor++;
            if (index >= items.length)
                return;
            results[index] = await mapper(items[index]);
        }
    }));
    return results;
}
function scopedKey(prefix, key) { return prefix ? `${prefix}/${key}` : key; }
function sha256(bytes) { return (0, crypto_1.createHash)("sha256").update(bytes).digest("hex"); }
function requireValue(value, name) { if (!value)
    throw new Error(`Missing Stage asset publisher argument: ${name}`); return value; }
function positiveNumber(value, fallback) { const parsed = value ? Number(value) : fallback; if (!Number.isSafeInteger(parsed) || parsed < 1)
    throw new Error("Invalid max upload bytes"); return parsed; }
function normalizeObjectPrefix(value) { const normalized = value.trim().replace(/^\/+|\/+$/g, ""); if (normalized && (!/^[A-Za-z0-9._-]+(?:\/[A-Za-z0-9._-]+)*$/.test(normalized) || normalized.split("/").some(part => part === "." || part === "..")))
    throw new Error(`Invalid R2 object prefix: ${value}`); return normalized; }
if (require.main === module) {
    main().catch(error => {
        console.error(error instanceof Error ? error.message : String(error));
        process.exitCode = 1;
    });
}
//# sourceMappingURL=game-db-stage-assets-publisher.js.map