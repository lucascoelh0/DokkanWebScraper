"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parsePublishArgs = exports.validateLocalCharacterBundle = exports.buildPortraitPublishPlan = exports.collectReferencedPortraitKeys = exports.parseWranglerBucketSize = exports.assertExpectedRemoteBaselineSha256 = exports.buildCharacterManifestObjectKey = exports.buildRemoteDatasetObjectKey = void 0;
const crypto_1 = require("crypto");
const child_process_1 = require("child_process");
const fs_1 = require("fs");
const promises_1 = require("fs/promises");
const os_1 = require("os");
const path_1 = require("path");
const zlib_1 = require("zlib");
const dataset_publication_channel_1 = require("./dataset-publication-channel");
const DEFAULT_DATA_ROOT = "data";
const DEFAULT_IMAGES_ROOT = "data/images";
const DEFAULT_DATASET_PATH = "data/latest/characters.json.gz";
const DEFAULT_MANIFEST_PATH = "data/latest/characters-manifest.json";
const DEFAULT_STATE_PATH = "data/latest/r2-publish-state.json";
const DEFAULT_CONCURRENCY = 6;
const DEFAULT_MAX_TOTAL_BYTES = 10000000000;
const PACKAGE_ROOT = (0, fs_1.existsSync)((0, path_1.resolve)(__dirname, "package.json"))
    ? __dirname
    : (0, path_1.resolve)(__dirname, "..");
const WRANGLER_ENTRYPOINT = (0, path_1.resolve)(PACKAGE_ROOT, "node_modules", "wrangler", "bin", "wrangler.js");
function datasetVersionSlug(datasetVersion) {
    return datasetVersion
        .trim()
        .replace(/[:]/g, "-")
        .replace(/[^\w./-]/g, "_");
}
function buildRemoteDatasetObjectKey(manifest, channel = "production") {
    if (!/^[a-f0-9]{64}$/i.test(manifest.sha256)) {
        throw new Error("Character manifest SHA-256 is invalid.");
    }
    if (!manifest.datasetVersion || manifest.datasetVersion.trim().length === 0) {
        throw new Error("Character manifest dataset version is missing.");
    }
    const fileName = (0, path_1.basename)(manifest.fileName.replace(/\\/g, "/"));
    if (fileName !== "characters.json.gz") {
        throw new Error(`Character manifest filename is invalid: ${manifest.fileName}`);
    }
    return (0, dataset_publication_channel_1.channelObjectKey)(channel, `releases/${datasetVersionSlug(manifest.datasetVersion)}/${manifest.sha256.toLowerCase()}/${fileName}`);
}
exports.buildRemoteDatasetObjectKey = buildRemoteDatasetObjectKey;
function buildCharacterManifestObjectKey(channel = "production") {
    return (0, dataset_publication_channel_1.channelObjectKey)(channel, "characters-manifest.json");
}
exports.buildCharacterManifestObjectKey = buildCharacterManifestObjectKey;
function assertExpectedRemoteBaselineSha256(expectedSha256, remoteManifest) {
    if (!expectedSha256)
        return;
    if (!/^[a-f0-9]{64}$/.test(expectedSha256)) {
        throw new Error("Expected remote baseline SHA-256 is invalid.");
    }
    if (!remoteManifest) {
        throw new Error("Cannot prove the expected remote baseline without the remote manifest.");
    }
    if (remoteManifest.sha256.toLowerCase() !== expectedSha256) {
        throw new Error(`Remote Character baseline changed: expected ${expectedSha256}, found ${remoteManifest.sha256.toLowerCase()}.`);
    }
}
exports.assertExpectedRemoteBaselineSha256 = assertExpectedRemoteBaselineSha256;
function sha256(buffer) {
    return (0, crypto_1.createHash)("sha256").update(buffer).digest("hex");
}
function parseWranglerBucketSize(reported) {
    const match = /^\s*(\d+(?:\.\d+)?)\s*(B|kB|MB|GB|TB)\s*$/.exec(reported);
    if (!match) {
        throw new Error(`Unsupported Wrangler bucket size: ${reported}`);
    }
    const units = {
        B: 1,
        kB: 1000,
        MB: 1000000,
        GB: 1000000000,
        TB: 1000000000000,
    };
    const decimals = match[1].split(".")[1]?.length ?? 0;
    const displayResolution = 10 ** -decimals;
    const upperBound = Math.ceil((Number(match[1]) + displayResolution) * units[match[2]]);
    if (!Number.isSafeInteger(upperBound)) {
        throw new Error(`Wrangler bucket size is outside the safe integer range: ${reported}`);
    }
    return { reported, conservativeUpperBoundBytes: upperBound };
}
exports.parseWranglerBucketSize = parseWranglerBucketSize;
function normalizeObjectKey(value) {
    return value.replace(/\\/g, "/").replace(/^\/+/, "").replace(/^\.\//, "");
}
function collectReferencedPortraitKeys(characters) {
    const portraitKeys = new Set();
    const add = (portraitURL) => {
        if (!portraitURL) {
            return;
        }
        portraitKeys.add(normalizeObjectKey(portraitURL));
    };
    for (const character of characters) {
        add(character.portraitURL);
        for (const transformation of character.transformations ?? []) {
            add(transformation.portraitURL);
        }
        for (const awakening of [
            ...(character.awakeningCards ?? []),
            ...(character.previousAwakenings ?? []),
            ...(character.nextAwakenings ?? []),
        ]) {
            add(awakening.portraitURL);
        }
    }
    return Array.from(portraitKeys).sort((left, right) => left.localeCompare(right));
}
exports.collectReferencedPortraitKeys = collectReferencedPortraitKeys;
function buildPortraitPublishPlan(currentPortraits, previousState, options) {
    const previousPortraits = previousState?.portraits ?? {};
    const forcePortraits = options?.forcePortraits === true;
    const toUpload = forcePortraits
        ? [...currentPortraits]
        : currentPortraits.filter(entry => previousPortraits[entry.objectKey] !== entry.sha256);
    return {
        toUpload: toUpload.sort((left, right) => left.objectKey.localeCompare(right.objectKey)),
        // Portrait keys are immutable assets referenced by retained historical
        // bundles. Deletion requires a separate, release-aware GC policy.
        toDelete: [],
    };
}
exports.buildPortraitPublishPlan = buildPortraitPublishPlan;
async function buildPortraitEntries(objectKeys, dataRoot) {
    const entries = [];
    for (const objectKey of objectKeys) {
        const filePath = (0, path_1.resolve)(dataRoot, objectKey);
        if (!(0, fs_1.existsSync)(filePath)) {
            throw new Error(`Missing portrait file for ${objectKey}: ${filePath}`);
        }
        const fileBuffer = await (0, promises_1.readFile)(filePath);
        entries.push({
            objectKey,
            filePath,
            sha256: sha256(fileBuffer),
        });
    }
    return entries;
}
function validateLocalCharacterBundle(manifest, gzipBuffer) {
    if (manifest.schemaVersion !== 1) {
        throw new Error(`Unsupported Character manifest schema version: ${manifest.schemaVersion}`);
    }
    if (manifest.compression !== "gzip") {
        throw new Error(`Unsupported Character bundle compression: ${manifest.compression}`);
    }
    if (manifest.fileName !== "characters.json.gz") {
        throw new Error(`Local Character manifest filename is invalid: ${manifest.fileName}`);
    }
    if (!/^[a-f0-9]{64}$/.test(manifest.sha256)) {
        throw new Error("Local Character manifest SHA-256 is invalid.");
    }
    if (!manifest.datasetVersion || manifest.datasetVersion.trim().length === 0) {
        throw new Error("Local Character manifest dataset version is missing.");
    }
    if (!manifest.generatedAt || manifest.generatedAt.trim().length === 0) {
        throw new Error("Local Character manifest generation time is missing.");
    }
    if (!Number.isSafeInteger(manifest.sizeBytes) || manifest.sizeBytes < 1) {
        throw new Error("Local Character manifest compressed size is invalid.");
    }
    if (!Number.isSafeInteger(manifest.uncompressedSizeBytes) || manifest.uncompressedSizeBytes < 1) {
        throw new Error("Local Character manifest uncompressed size is invalid.");
    }
    if (!Number.isSafeInteger(manifest.characterCount) || manifest.characterCount < 0) {
        throw new Error("Local Character manifest character count is invalid.");
    }
    if (gzipBuffer.byteLength !== manifest.sizeBytes) {
        throw new Error(`Local Character bundle size mismatch: expected ${manifest.sizeBytes}, found ${gzipBuffer.byteLength}.`);
    }
    const actualSha256 = sha256(gzipBuffer);
    if (actualSha256 !== manifest.sha256) {
        throw new Error(`Local Character bundle SHA-256 mismatch: expected ${manifest.sha256}, found ${actualSha256}.`);
    }
    let uncompressedBuffer;
    try {
        uncompressedBuffer = (0, zlib_1.gunzipSync)(gzipBuffer);
    }
    catch (exception) {
        const message = exception instanceof Error ? exception.message : String(exception);
        throw new Error(`Local Character bundle is not valid gzip: ${message}`);
    }
    if (uncompressedBuffer.byteLength !== manifest.uncompressedSizeBytes) {
        throw new Error(`Local Character bundle uncompressed size mismatch: expected ${manifest.uncompressedSizeBytes}, found ${uncompressedBuffer.byteLength}.`);
    }
    const parsed = JSON.parse(uncompressedBuffer.toString("utf8"));
    if (!Array.isArray(parsed)) {
        throw new Error("Local Character bundle payload must be an array.");
    }
    if (parsed.length !== manifest.characterCount) {
        throw new Error(`Local Character bundle count mismatch: expected ${manifest.characterCount}, found ${parsed.length}.`);
    }
    return parsed;
}
exports.validateLocalCharacterBundle = validateLocalCharacterBundle;
async function readManifest(manifestPath) {
    return JSON.parse(await (0, promises_1.readFile)(manifestPath, "utf8"));
}
async function readPublishState(statePath, channel) {
    if (!(0, fs_1.existsSync)(statePath)) {
        return undefined;
    }
    const state = JSON.parse(await (0, promises_1.readFile)(statePath, "utf8"));
    const stateChannel = state.channel ?? "production";
    if (stateChannel !== channel) {
        throw new Error(`Character publish state belongs to ${stateChannel}, not requested channel ${channel}.`);
    }
    return state;
}
async function writePublishState(statePath, state) {
    await (0, promises_1.mkdir)((0, path_1.dirname)(statePath), { recursive: true });
    await (0, promises_1.writeFile)(statePath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
}
async function execFileAsync(command, args) {
    return new Promise((resolvePromise, rejectPromise) => {
        (0, child_process_1.execFile)(command, args, { maxBuffer: 1024 * 1024 * 16 }, (error, stdout, stderr) => {
            if (error) {
                rejectPromise(new Error(stderr || stdout || error.message));
                return;
            }
            resolvePromise({ stdout, stderr });
        });
    });
}
async function runWranglerCommand(args) {
    await execFileAsync(process.execPath, [WRANGLER_ENTRYPOINT, ...args]);
}
async function readRemoteBucketSizeReport(bucket) {
    let stdout;
    try {
        ({ stdout } = await execFileAsync(process.execPath, [
            WRANGLER_ENTRYPOINT,
            "r2",
            "bucket",
            "info",
            bucket,
            "--json",
        ]));
    }
    catch (exception) {
        const message = exception instanceof Error ? exception.message : String(exception);
        throw new Error(`Cannot prove the R2 bucket budget: ${message}`);
    }
    try {
        const parsed = JSON.parse(stdout);
        if (typeof parsed.bucket_size !== "string") {
            throw new Error("missing bucket_size");
        }
        return parseWranglerBucketSize(parsed.bucket_size);
    }
    catch (exception) {
        const message = exception instanceof Error ? exception.message : String(exception);
        throw new Error(`Cannot prove the R2 bucket budget: ${message}`);
    }
}
async function tryReadRemoteManifest(bucket, target, manifestObjectKey) {
    const tempDirectory = await (0, promises_1.mkdtemp)((0, path_1.resolve)((0, os_1.tmpdir)(), "dokkan-r2-manifest-"));
    const tempManifestPath = (0, path_1.resolve)(tempDirectory, "characters-manifest.json");
    try {
        const args = [
            "r2",
            "object",
            "get",
            `${bucket}/${manifestObjectKey}`,
            "--file",
            tempManifestPath,
            target === "remote" ? "--remote" : "--local",
        ];
        await runWranglerCommand(args);
        return JSON.parse(await (0, promises_1.readFile)(tempManifestPath, "utf8"));
    }
    catch (error) {
        return undefined;
    }
    finally {
        await (0, promises_1.rm)(tempDirectory, { recursive: true, force: true });
    }
}
async function uploadObject(bucket, objectKey, filePath, contentType, cacheControl, target) {
    await runWranglerCommand([
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
    ]);
}
async function runWithConcurrency(items, concurrency, task) {
    if (items.length === 0) {
        return;
    }
    let currentIndex = 0;
    const workerCount = Math.max(1, Math.min(concurrency, items.length));
    const workers = Array.from({ length: workerCount }, async () => {
        while (true) {
            const index = currentIndex;
            if (index >= items.length) {
                return;
            }
            currentIndex += 1;
            await task(items[index], index);
        }
    });
    await Promise.all(workers);
}
function parsePublishArgs(argv) {
    const values = new Map();
    const flags = new Set();
    const valueRequiredOptions = new Set([
        "--expected-remote-baseline-sha256",
        "--channel",
    ]);
    for (let index = 0; index < argv.length; index += 1) {
        const token = argv[index];
        if (!token.startsWith("--")) {
            throw new Error(`Unexpected argument: ${token}`);
        }
        const [name, inlineValue] = token.split("=", 2);
        if (inlineValue !== undefined) {
            if (valueRequiredOptions.has(name) && inlineValue.length === 0) {
                throw new Error(`${name} requires a value.`);
            }
            values.set(name, inlineValue);
            continue;
        }
        const nextToken = argv[index + 1];
        if (!nextToken || nextToken.startsWith("--")) {
            if (valueRequiredOptions.has(name)) {
                throw new Error(`${name} requires a value.`);
            }
            flags.add(name);
            continue;
        }
        values.set(name, nextToken);
        index += 1;
    }
    const bucket = values.get("--bucket") ?? process.env.R2_BUCKET_NAME;
    if (!bucket) {
        throw new Error("Missing bucket. Pass --bucket dokkanpanion-data or set R2_BUCKET_NAME.");
    }
    const localFlag = flags.has("--local");
    const remoteFlag = flags.has("--remote");
    if (localFlag && remoteFlag) {
        throw new Error("Choose only one of --local or --remote.");
    }
    const concurrencyRaw = values.get("--concurrency");
    const concurrency = concurrencyRaw ? Number.parseInt(concurrencyRaw, 10) : DEFAULT_CONCURRENCY;
    if (!Number.isFinite(concurrency) || concurrency < 1) {
        throw new Error(`Invalid --concurrency value: ${concurrencyRaw}`);
    }
    const maxTotalBytesRaw = values.get("--max-total-bytes");
    const maxTotalBytes = maxTotalBytesRaw
        ? Number.parseInt(maxTotalBytesRaw, 10)
        : DEFAULT_MAX_TOTAL_BYTES;
    if (!Number.isFinite(maxTotalBytes) || maxTotalBytes < 1) {
        throw new Error(`Invalid --max-total-bytes value: ${maxTotalBytesRaw}`);
    }
    const expectedRemoteBaselineSha256 = values.get("--expected-remote-baseline-sha256")?.toLowerCase();
    if (expectedRemoteBaselineSha256 && !/^[a-f0-9]{64}$/.test(expectedRemoteBaselineSha256)) {
        throw new Error("Invalid --expected-remote-baseline-sha256 value.");
    }
    if (expectedRemoteBaselineSha256 && flags.has("--skip-remote-manifest-check")) {
        throw new Error("--expected-remote-baseline-sha256 cannot be combined with --skip-remote-manifest-check.");
    }
    const channel = (0, dataset_publication_channel_1.parseDatasetPublicationChannel)(values.get("--channel"));
    if (channel === "staging" && !flags.has("--skip-portraits")) {
        throw new Error("Staging publication requires --skip-portraits because portrait keys are not channel-scoped.");
    }
    return {
        bucket,
        dataRoot: (0, path_1.resolve)(values.get("--data-root") ?? DEFAULT_DATA_ROOT),
        imagesRoot: (0, path_1.resolve)(values.get("--images-root") ?? DEFAULT_IMAGES_ROOT),
        datasetPath: (0, path_1.resolve)(values.get("--dataset") ?? DEFAULT_DATASET_PATH),
        manifestPath: (0, path_1.resolve)(values.get("--manifest") ?? DEFAULT_MANIFEST_PATH),
        statePath: values.has("--state")
            ? (0, path_1.resolve)(values.get("--state"))
            : (0, dataset_publication_channel_1.defaultChannelStatePath)(DEFAULT_STATE_PATH, channel),
        dryRun: flags.has("--dry-run"),
        forcePortraits: flags.has("--force-portraits"),
        skipPortraits: flags.has("--skip-portraits"),
        skipRemoteManifestCheck: flags.has("--skip-remote-manifest-check"),
        expectedRemoteBaselineSha256,
        target: localFlag ? "local" : "remote",
        concurrency,
        maxTotalBytes,
        channel,
        manifestObjectKey: buildCharacterManifestObjectKey(channel),
        promoteProduction: flags.has("--promote-production"),
    };
}
exports.parsePublishArgs = parsePublishArgs;
function manifestsMatch(left, right) {
    if (!right) {
        return false;
    }
    return left.sha256 === right.sha256
        && left.fileName === right.fileName
        && left.datasetVersion === right.datasetVersion;
}
async function publishDataset(options) {
    (0, dataset_publication_channel_1.assertDatasetPublicationWriteAuthorized)(options);
    if (!(0, fs_1.existsSync)(options.manifestPath)) {
        throw new Error(`Manifest not found: ${options.manifestPath}`);
    }
    if (!(0, fs_1.existsSync)(options.datasetPath)) {
        throw new Error(`Dataset bundle not found: ${options.datasetPath}`);
    }
    if (!(0, fs_1.existsSync)(options.imagesRoot)) {
        throw new Error(`Portrait directory not found: ${options.imagesRoot}`);
    }
    const localManifest = await readManifest(options.manifestPath);
    const localGzipBuffer = await (0, promises_1.readFile)(options.datasetPath);
    const characters = validateLocalCharacterBundle(localManifest, localGzipBuffer);
    const remoteDatasetObjectKey = buildRemoteDatasetObjectKey(localManifest, options.channel);
    const remoteManifest = {
        ...localManifest,
        fileName: remoteDatasetObjectKey,
    };
    const portraitKeys = collectReferencedPortraitKeys(characters);
    const previousState = await readPublishState(options.statePath, options.channel);
    const publishedRemoteManifest = options.skipRemoteManifestCheck
        ? undefined
        : await tryReadRemoteManifest(options.bucket, options.target, options.manifestObjectKey);
    assertExpectedRemoteBaselineSha256(options.expectedRemoteBaselineSha256, publishedRemoteManifest);
    const datasetNeedsUpload = !manifestsMatch(remoteManifest, publishedRemoteManifest);
    const skippedBecauseRemoteMatches = !datasetNeedsUpload && !options.forcePortraits && !options.skipPortraits;
    const portraitEntries = options.skipPortraits
        ? []
        : await buildPortraitEntries(portraitKeys, options.dataRoot);
    const portraitPlan = options.skipPortraits
        ? { toUpload: [], toDelete: [] }
        : buildPortraitPublishPlan(portraitEntries, previousState, { forcePortraits: options.forcePortraits });
    const projectedTotalBytes = (0, fs_1.statSync)(options.datasetPath).size
        + manifestByteSize(remoteManifest)
        + portraitEntries.reduce((total, entry) => total + (0, fs_1.statSync)(entry.filePath).size, 0);
    if (projectedTotalBytes > options.maxTotalBytes) {
        throw new Error(`Projected R2 dataset size ${projectedTotalBytes} bytes exceeds the configured limit of ${options.maxTotalBytes} bytes. `
            + "Reduce the dataset or raise the limit explicitly after checking the bucket budget.");
    }
    const prospectiveUploadBytes = (datasetNeedsUpload
        ? localGzipBuffer.byteLength + manifestByteSize(remoteManifest)
        : 0)
        + portraitPlan.toUpload.reduce((total, entry) => total + (0, fs_1.statSync)(entry.filePath).size, 0);
    const bucketSizeReport = options.target === "remote"
        ? await readRemoteBucketSizeReport(options.bucket)
        : undefined;
    const projectedBucketUpperBoundBytes = bucketSizeReport
        ? bucketSizeReport.conservativeUpperBoundBytes + prospectiveUploadBytes
        : undefined;
    if (projectedBucketUpperBoundBytes !== undefined && projectedBucketUpperBoundBytes >= options.maxTotalBytes) {
        throw new Error(`Projected conservative bucket upper bound ${projectedBucketUpperBoundBytes} bytes reaches or exceeds `
            + `the configured limit of ${options.maxTotalBytes} bytes.`);
    }
    console.log(`Channel: ${options.channel}`);
    console.log(`Manifest object key: ${options.manifestObjectKey}`);
    console.log(`Dataset version: ${remoteManifest.datasetVersion}`);
    console.log(`Dataset object key: ${remoteDatasetObjectKey}`);
    console.log(`Dataset upload needed: ${datasetNeedsUpload ? "yes" : "no"}`);
    console.log(`Portraits referenced: ${portraitKeys.length}`);
    console.log(`Portraits to upload: ${portraitPlan.toUpload.length}`);
    console.log(`Portraits to delete: ${portraitPlan.toDelete.length}`);
    console.log(`Projected managed size: ${projectedTotalBytes}/${options.maxTotalBytes} bytes`);
    if (bucketSizeReport && projectedBucketUpperBoundBytes !== undefined) {
        console.log(`Wrangler bucket size: ${bucketSizeReport.reported}; conservative projected upper bound: `
            + `${projectedBucketUpperBoundBytes}/${options.maxTotalBytes} bytes`);
    }
    if (options.dryRun) {
        return {
            datasetNeedsUpload,
            portraitUploadCount: portraitPlan.toUpload.length,
            portraitDeleteCount: portraitPlan.toDelete.length,
            skippedBecauseRemoteMatches,
            projectedTotalBytes,
        };
    }
    if (datasetNeedsUpload) {
        console.log("Uploading dataset bundle...");
        await uploadObject(options.bucket, remoteDatasetObjectKey, options.datasetPath, "application/gzip", "public, max-age=31536000, immutable", options.target);
    }
    if (portraitPlan.toUpload.length > 0) {
        console.log("Uploading portraits...");
        await runWithConcurrency(portraitPlan.toUpload, options.concurrency, async (entry, index) => {
            await uploadObject(options.bucket, entry.objectKey, entry.filePath, "image/png", "public, max-age=31536000, immutable", options.target);
            if ((index + 1) % 25 === 0 || index + 1 === portraitPlan.toUpload.length) {
                console.log(`Uploaded ${index + 1}/${portraitPlan.toUpload.length} portrait(s)`);
            }
        });
    }
    if (datasetNeedsUpload) {
        console.log("Uploading manifest...");
        const manifestTempDirectory = await (0, promises_1.mkdtemp)((0, path_1.resolve)((0, os_1.tmpdir)(), "dokkan-r2-publish-manifest-"));
        const manifestTempPath = (0, path_1.resolve)(manifestTempDirectory, "characters-manifest.json");
        await (0, promises_1.writeFile)(manifestTempPath, `${JSON.stringify(remoteManifest, null, 2)}\n`, "utf8");
        await uploadObject(options.bucket, options.manifestObjectKey, manifestTempPath, "application/json", "no-store", options.target);
        await (0, promises_1.rm)(manifestTempDirectory, { recursive: true, force: true });
    }
    // Character bundles are immutable and intentionally retained. Keeping the
    // prior content-addressed object and its portraits preserves rollback and
    // old-client reads. Every remote run measures the whole bucket and adds
    // prospective uploads conservatively; cleanup still needs a separate,
    // release-aware GC policy.
    const nextState = {
        schemaVersion: 1,
        bucket: options.bucket,
        target: options.target,
        channel: options.channel,
        datasetVersion: remoteManifest.datasetVersion,
        datasetObjectKey: remoteDatasetObjectKey,
        manifestSha256: remoteManifest.sha256,
        publishedAt: new Date().toISOString(),
        portraits: Object.fromEntries(portraitEntries.map(entry => [entry.objectKey, entry.sha256])),
    };
    await writePublishState(options.statePath, nextState);
    return {
        datasetNeedsUpload,
        portraitUploadCount: portraitPlan.toUpload.length,
        portraitDeleteCount: portraitPlan.toDelete.length,
        skippedBecauseRemoteMatches,
        projectedTotalBytes,
    };
}
function manifestByteSize(manifest) {
    return Buffer.byteLength(`${JSON.stringify(manifest, null, 2)}\n`, "utf8");
}
async function main() {
    const options = parsePublishArgs(process.argv.slice(2));
    const summary = await publishDataset(options);
    if (options.dryRun) {
        console.log("Dry run complete.");
        return;
    }
    if (!summary.datasetNeedsUpload && summary.portraitUploadCount === 0 && summary.portraitDeleteCount === 0) {
        console.log("Nothing changed. R2 is already aligned with the current local dataset.");
        return;
    }
    console.log("R2 publish complete.");
}
if (require.main === module) {
    main().catch((error) => {
        console.error(error instanceof Error ? error.message : error);
        process.exitCode = 1;
    });
}
//# sourceMappingURL=publish-r2.js.map