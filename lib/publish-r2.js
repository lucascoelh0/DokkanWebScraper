"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildPortraitPublishPlan = exports.collectReferencedPortraitKeys = void 0;
const crypto_1 = require("crypto");
const child_process_1 = require("child_process");
const fs_1 = require("fs");
const promises_1 = require("fs/promises");
const os_1 = require("os");
const path_1 = require("path");
const zlib_1 = require("zlib");
const DEFAULT_DATA_ROOT = "data";
const DEFAULT_IMAGES_ROOT = "data/images";
const DEFAULT_DATASET_PATH = "data/latest/characters.json.gz";
const DEFAULT_MANIFEST_PATH = "data/latest/characters-manifest.json";
const DEFAULT_STATE_PATH = "data/latest/r2-publish-state.json";
const DEFAULT_CONCURRENCY = 6;
function sha256(buffer) {
    return (0, crypto_1.createHash)("sha256").update(buffer).digest("hex");
}
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
    const currentPortraitMap = new Map(currentPortraits.map(entry => [entry.objectKey, entry]));
    const toUpload = forcePortraits
        ? [...currentPortraits]
        : currentPortraits.filter(entry => previousPortraits[entry.objectKey] !== entry.sha256);
    const toDelete = previousState
        ? Object.keys(previousPortraits)
            .filter(objectKey => !currentPortraitMap.has(objectKey))
            .sort((left, right) => left.localeCompare(right))
        : [];
    return {
        toUpload: toUpload.sort((left, right) => left.objectKey.localeCompare(right.objectKey)),
        toDelete,
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
async function readCharactersFromBundle(datasetPath) {
    const gzipBuffer = await (0, promises_1.readFile)(datasetPath);
    return JSON.parse((0, zlib_1.gunzipSync)(gzipBuffer).toString("utf8"));
}
async function readManifest(manifestPath) {
    return JSON.parse(await (0, promises_1.readFile)(manifestPath, "utf8"));
}
async function readPublishState(statePath) {
    if (!(0, fs_1.existsSync)(statePath)) {
        return undefined;
    }
    return JSON.parse(await (0, promises_1.readFile)(statePath, "utf8"));
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
    await execFileAsync("npx", ["wrangler", ...args]);
}
async function tryReadRemoteManifest(bucket, target) {
    const tempDirectory = await (0, promises_1.mkdtemp)((0, path_1.resolve)((0, os_1.tmpdir)(), "dokkan-r2-manifest-"));
    const tempManifestPath = (0, path_1.resolve)(tempDirectory, "characters-manifest.json");
    try {
        const args = [
            "r2",
            "object",
            "get",
            `${bucket}/characters-manifest.json`,
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
async function deleteObject(bucket, objectKey, target) {
    await runWranglerCommand([
        "r2",
        "object",
        "delete",
        `${bucket}/${objectKey}`,
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
function parseArgs(argv) {
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
    return {
        bucket,
        dataRoot: (0, path_1.resolve)(values.get("--data-root") ?? DEFAULT_DATA_ROOT),
        imagesRoot: (0, path_1.resolve)(values.get("--images-root") ?? DEFAULT_IMAGES_ROOT),
        datasetPath: (0, path_1.resolve)(values.get("--dataset") ?? DEFAULT_DATASET_PATH),
        manifestPath: (0, path_1.resolve)(values.get("--manifest") ?? DEFAULT_MANIFEST_PATH),
        statePath: (0, path_1.resolve)(values.get("--state") ?? DEFAULT_STATE_PATH),
        dryRun: flags.has("--dry-run"),
        forcePortraits: flags.has("--force-portraits"),
        skipPortraits: flags.has("--skip-portraits"),
        skipRemoteManifestCheck: flags.has("--skip-remote-manifest-check"),
        target: localFlag ? "local" : "remote",
        concurrency,
    };
}
function manifestsMatch(left, right) {
    if (!right) {
        return false;
    }
    return left.sha256 === right.sha256
        && left.fileName === right.fileName
        && left.datasetVersion === right.datasetVersion;
}
async function publishDataset(options) {
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
    const characters = await readCharactersFromBundle(options.datasetPath);
    const portraitKeys = collectReferencedPortraitKeys(characters);
    const previousState = await readPublishState(options.statePath);
    const remoteManifest = options.skipRemoteManifestCheck
        ? undefined
        : await tryReadRemoteManifest(options.bucket, options.target);
    const datasetNeedsUpload = !manifestsMatch(localManifest, remoteManifest);
    const skippedBecauseRemoteMatches = !datasetNeedsUpload && !options.forcePortraits && !options.skipPortraits;
    const portraitEntries = options.skipPortraits
        ? []
        : await buildPortraitEntries(portraitKeys, options.dataRoot);
    const portraitPlan = options.skipPortraits
        ? { toUpload: [], toDelete: [] }
        : buildPortraitPublishPlan(portraitEntries, previousState, { forcePortraits: options.forcePortraits });
    console.log(`Dataset version: ${localManifest.datasetVersion}`);
    console.log(`Dataset upload needed: ${datasetNeedsUpload ? "yes" : "no"}`);
    console.log(`Portraits referenced: ${portraitKeys.length}`);
    console.log(`Portraits to upload: ${portraitPlan.toUpload.length}`);
    console.log(`Portraits to delete: ${portraitPlan.toDelete.length}`);
    if (options.dryRun) {
        return {
            datasetNeedsUpload,
            portraitUploadCount: portraitPlan.toUpload.length,
            portraitDeleteCount: portraitPlan.toDelete.length,
            skippedBecauseRemoteMatches,
        };
    }
    if (datasetNeedsUpload) {
        console.log("Uploading dataset bundle...");
        await uploadObject(options.bucket, localManifest.fileName, options.datasetPath, "application/gzip", "public, max-age=31536000, immutable", options.target);
    }
    if (portraitPlan.toDelete.length > 0) {
        console.log("Deleting stale portraits from R2...");
        await runWithConcurrency(portraitPlan.toDelete, options.concurrency, async (objectKey, index) => {
            await deleteObject(options.bucket, objectKey, options.target);
            if ((index + 1) % 25 === 0 || index + 1 === portraitPlan.toDelete.length) {
                console.log(`Deleted ${index + 1}/${portraitPlan.toDelete.length} stale portrait(s)`);
            }
        });
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
        await uploadObject(options.bucket, "characters-manifest.json", options.manifestPath, "application/json", "no-store", options.target);
    }
    const nextState = {
        schemaVersion: 1,
        bucket: options.bucket,
        target: options.target,
        datasetVersion: localManifest.datasetVersion,
        manifestSha256: localManifest.sha256,
        publishedAt: new Date().toISOString(),
        portraits: Object.fromEntries(portraitEntries.map(entry => [entry.objectKey, entry.sha256])),
    };
    await writePublishState(options.statePath, nextState);
    return {
        datasetNeedsUpload,
        portraitUploadCount: portraitPlan.toUpload.length,
        portraitDeleteCount: portraitPlan.toDelete.length,
        skippedBecauseRemoteMatches,
    };
}
async function main() {
    const options = parseArgs(process.argv.slice(2));
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