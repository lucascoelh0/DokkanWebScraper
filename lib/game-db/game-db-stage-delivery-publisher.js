"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.scopedObjectKey = exports.buildStageDeliveryPublishPlan = exports.parseStageDeliveryPublishArgs = exports.STAGE_DELIVERY_HTTP_CONTENT_TYPE = void 0;
const crypto_1 = require("crypto");
const child_process_1 = require("child_process");
const fs_1 = require("fs");
const promises_1 = require("fs/promises");
const path_1 = require("path");
const util_1 = require("util");
const zlib_1 = require("zlib");
const format_json_1 = require("../format-json");
const game_db_stage_delivery_1 = require("./game-db-stage-delivery");
const DEFAULT_BUCKET = "dokkanpanion-data";
const DEFAULT_RELEASE_DIR = "data/stage-details/delivery-local-1787900894";
const DEFAULT_STATE_PATH = "data/stage-details/staging-v2-r2-publish-state.json";
const MANIFEST_FILE_NAME = "stage-details-manifest.json";
exports.STAGE_DELIVERY_HTTP_CONTENT_TYPE = "application/gzip";
const MAX_DEFAULT_UPLOAD_BYTES = 512 * 1024 * 1024;
const UPLOAD_CONCURRENCY = 4;
const RETRY_ATTEMPTS = 4;
const execFileAsync = (0, util_1.promisify)(child_process_1.execFile);
function parseStageDeliveryPublishArgs(argv) {
    const values = new Map();
    const flags = new Set();
    const valueOptions = new Set([
        "--bucket",
        "--object-prefix",
        "--release-dir",
        "--manifest",
        "--state",
        "--max-upload-bytes",
    ]);
    const flagOptions = new Set(["--dry-run", "--local", "--remote", "--adopt-unbound-state"]);
    for (let index = 0; index < argv.length; index += 1) {
        const token = argv[index];
        const [name, inlineValue] = token.split("=", 2);
        if (flagOptions.has(name)) {
            if (inlineValue !== undefined)
                throw new Error(`Flag does not accept a value: ${name}`);
            flags.add(name);
            continue;
        }
        if (!valueOptions.has(name))
            throw new Error(`Unexpected Stage delivery publisher argument: ${token}`);
        const value = inlineValue ?? argv[++index];
        if (!value || value.startsWith("--") || values.has(name)) {
            throw new Error(`Missing or duplicate Stage delivery publisher argument: ${name}`);
        }
        values.set(name, value);
    }
    if (flags.has("--local") && flags.has("--remote"))
        throw new Error("Choose only one of --local or --remote");
    const releaseDir = (0, path_1.resolve)(values.get("--release-dir") ?? DEFAULT_RELEASE_DIR);
    return {
        bucket: values.get("--bucket") ?? process.env.R2_BUCKET_NAME ?? DEFAULT_BUCKET,
        objectPrefix: normalizeObjectPrefix(values.get("--object-prefix") ?? ""),
        releaseDir,
        manifestPath: (0, path_1.resolve)(values.get("--manifest") ?? (0, path_1.resolve)(releaseDir, MANIFEST_FILE_NAME)),
        statePath: (0, path_1.resolve)(values.get("--state") ?? DEFAULT_STATE_PATH),
        target: flags.has("--local") ? "local" : "remote",
        dryRun: flags.has("--dry-run"),
        adoptUnboundState: flags.has("--adopt-unbound-state"),
        maxUploadBytes: parsePositiveNumber(values.get("--max-upload-bytes"), MAX_DEFAULT_UPLOAD_BYTES),
    };
}
exports.parseStageDeliveryPublishArgs = parseStageDeliveryPublishArgs;
function buildStageDeliveryPublishPlan(options, manifest, manifestBytes, manifestSha256, files, previousState) {
    validateManifestShape(manifest);
    if (previousState && JSON.stringify(previousState.destination) !== JSON.stringify(publishDestination(options))) {
        throw new Error("Stage delivery publish state belongs to a different destination");
    }
    const expectedObjects = [manifest.catalog, ...manifest.shards];
    if (files.length !== expectedObjects.length)
        throw new Error("Stage delivery object count does not match the manifest");
    const byKey = new Map(files.map(file => [file.object.objectKey, file]));
    if (byKey.size !== files.length || expectedObjects.some(object => !byKey.has(object.objectKey))) {
        throw new Error("Stage delivery files do not match the manifest object set");
    }
    const totalObjectBytes = files.reduce((sum, file) => sum + file.object.sizeBytes, 0);
    const totalDatasetBytes = manifestBytes + totalObjectBytes;
    if (totalDatasetBytes > options.maxUploadBytes) {
        throw new Error(`Stage delivery dataset is ${totalDatasetBytes} bytes, above the configured limit of ${options.maxUploadBytes} bytes`);
    }
    const changedFiles = files.filter(file => {
        const prior = previousState?.objects[file.object.objectKey];
        return prior?.sha256 !== file.object.sha256 || prior.sizeBytes !== file.object.sizeBytes;
    });
    const uploadManifest = previousState?.manifestSha256 !== manifestSha256;
    return {
        options,
        manifest,
        manifestBytes,
        manifestSha256,
        files,
        changedFiles,
        totalDatasetBytes,
        uploadBytes: changedFiles.reduce((sum, file) => sum + file.object.sizeBytes, 0)
            + (uploadManifest ? manifestBytes : 0),
        uploadManifest,
        previousState,
    };
}
exports.buildStageDeliveryPublishPlan = buildStageDeliveryPublishPlan;
async function main() {
    const options = parseStageDeliveryPublishArgs(process.argv.slice(2));
    const plan = await readPlan(options);
    printPlan(plan);
    if (options.dryRun) {
        console.log("Dry run complete. No R2 objects or publish state were changed.");
        return;
    }
    const state = {
        schemaVersion: 2,
        status: "in-progress",
        destination: publishDestination(options),
        datasetVersion: plan.manifest.datasetVersion,
        manifestSha256: plan.previousState?.manifestSha256 ?? "",
        objects: { ...(plan.previousState?.objects ?? {}) },
    };
    let writeChain = Promise.resolve();
    const writeState = async () => {
        writeChain = writeChain.then(async () => {
            await (0, promises_1.mkdir)((0, path_1.dirname)(options.statePath), { recursive: true });
            await (0, format_json_1.writeFormattedJson)(options.statePath, state);
        });
        await writeChain;
    };
    await writeState();
    await mapWithConcurrency(plan.changedFiles, UPLOAD_CONCURRENCY, async (file) => {
        await uploadObject(options.bucket, scopedObjectKey(options.objectPrefix, file.object.objectKey), file.absolutePath, exports.STAGE_DELIVERY_HTTP_CONTENT_TYPE, "public, max-age=31536000, immutable", options.target);
        state.objects[file.object.objectKey] = {
            sha256: file.object.sha256,
            sizeBytes: file.object.sizeBytes,
        };
        await writeState();
    });
    if (plan.uploadManifest) {
        await uploadObject(options.bucket, scopedObjectKey(options.objectPrefix, MANIFEST_FILE_NAME), options.manifestPath, "application/json", "no-store", options.target);
        state.manifestSha256 = plan.manifestSha256;
    }
    state.status = "complete";
    await writeState();
    console.log("Stage delivery R2 publish complete.");
}
async function readPlan(options) {
    if (!(0, fs_1.existsSync)(options.manifestPath))
        throw new Error(`Stage delivery manifest not found: ${options.manifestPath}`);
    const manifestBuffer = await (0, promises_1.readFile)(options.manifestPath);
    const manifest = JSON.parse(manifestBuffer.toString("utf8"));
    validateManifestShape(manifest);
    const files = await Promise.all([manifest.catalog, ...manifest.shards].map(object => validateObjectFile(options.releaseDir, object, manifest)));
    const previousState = await readState(options.statePath, options);
    return buildStageDeliveryPublishPlan(options, manifest, manifestBuffer.byteLength, sha256(manifestBuffer), files, previousState);
}
async function validateObjectFile(releaseDir, object, manifest) {
    if (!/^stage-details\/objects\/[a-f0-9]{64}\.json\.gz$/.test(object.objectKey)) {
        throw new Error(`Invalid Stage delivery object key: ${object.objectKey}`);
    }
    if (object.contentType !== "application/json" || object.contentEncoding !== "gzip") {
        throw new Error(`Invalid Stage delivery transport metadata: ${object.objectKey}`);
    }
    if (object.objectKey.split("/").at(-1)?.split(".")[0] !== object.sha256) {
        throw new Error(`Stage delivery object key does not bind its SHA-256: ${object.objectKey}`);
    }
    const absolutePath = (0, path_1.resolve)(releaseDir, ...object.objectKey.split("/"));
    const root = `${(0, path_1.resolve)(releaseDir)}${path_1.sep}`.toLowerCase();
    if (!absolutePath.toLowerCase().startsWith(root))
        throw new Error(`Stage delivery object escapes the release directory: ${object.objectKey}`);
    const compressed = await (0, promises_1.readFile)(absolutePath);
    if (compressed.byteLength !== object.sizeBytes || sha256(compressed) !== object.sha256) {
        throw new Error(`Stage delivery object bytes do not match the manifest: ${object.objectKey}`);
    }
    const expanded = (0, zlib_1.gunzipSync)(compressed);
    if (expanded.byteLength !== object.expandedSizeBytes) {
        throw new Error(`Stage delivery expanded size does not match the manifest: ${object.objectKey}`);
    }
    const payload = JSON.parse(expanded.toString("utf8"));
    if (payload.contract !== game_db_stage_delivery_1.STAGE_DELIVERY_CONTRACT
        || payload.contractVersion !== game_db_stage_delivery_1.STAGE_DELIVERY_CONTRACT_VERSION
        || payload.datasetVersion !== manifest.datasetVersion) {
        throw new Error(`Stage delivery object contract does not match the manifest: ${object.objectKey}`);
    }
    if (object.objectKey === manifest.catalog.objectKey) {
        validateCatalogPayload(payload, manifest);
    }
    else {
        const shard = manifest.shards.find(candidate => candidate.objectKey === object.objectKey);
        if (!shard)
            throw new Error(`Stage delivery shard is absent from the manifest: ${object.objectKey}`);
        validateShardPayload(payload, shard, manifest);
    }
    return { object, absolutePath };
}
function validateManifestShape(manifest) {
    if (manifest.schemaVersion !== 2
        || manifest.contract !== game_db_stage_delivery_1.STAGE_DELIVERY_CONTRACT
        || manifest.contractVersion !== game_db_stage_delivery_1.STAGE_DELIVERY_CONTRACT_VERSION) {
        throw new Error("Unsupported Stage delivery manifest contract");
    }
    if (!manifest.datasetVersion || manifest.generatedAt !== manifest.datasetVersion) {
        throw new Error("Stage delivery manifest has an invalid dataset version");
    }
    if (manifest.source !== "dokkan-game-db"
        || !/^\d+$/.test(manifest.sourceSnapshotVersion)
        || !/^[a-f0-9]{64}$/.test(manifest.sourceDatabaseSha256)
        || !Number.isSafeInteger(manifest.questLevelCount)
        || !Number.isSafeInteger(manifest.zBattleCount)
        || !Number.isSafeInteger(manifest.supportMemoryRelationCount)
        || !Number.isSafeInteger(manifest.eventMissionCount)
        || manifest.questLevelCount < 0
        || manifest.zBattleCount < 0
        || manifest.supportMemoryRelationCount < 0
        || manifest.eventMissionCount < 0) {
        throw new Error("Stage delivery manifest has invalid source lineage or counts");
    }
    if (manifest.fileName !== manifest.catalog.objectKey
        || manifest.sha256 !== manifest.catalog.sha256
        || manifest.sizeBytes !== manifest.catalog.sizeBytes) {
        throw new Error("Stage delivery compatibility fields do not match the catalog object");
    }
    if (manifest.stageCount !== manifest.questLevelCount) {
        throw new Error("Stage delivery compatibility stage count does not match quest count");
    }
    const keys = [manifest.catalog.objectKey, ...manifest.shards.map(shard => shard.objectKey)];
    if (new Set(keys).size !== keys.length)
        throw new Error("Stage delivery manifest contains duplicate object keys");
    const shardIds = manifest.shards.map(shard => shard.id);
    if (new Set(shardIds).size !== shardIds.length || shardIds.some(id => !/^\d{4}$/.test(id))) {
        throw new Error("Stage delivery manifest contains invalid shard IDs");
    }
}
function validateCatalogPayload(catalog, manifest) {
    if (catalog.schemaVersion !== 1
        || catalog.contract !== game_db_stage_delivery_1.STAGE_DELIVERY_CONTRACT
        || catalog.contractVersion !== game_db_stage_delivery_1.STAGE_DELIVERY_CONTRACT_VERSION
        || catalog.datasetVersion !== manifest.datasetVersion
        || catalog.generatedAt !== manifest.generatedAt
        || catalog.source !== manifest.source
        || catalog.sourceSnapshotVersion !== manifest.sourceSnapshotVersion
        || catalog.sourceDatabaseSha256 !== manifest.sourceDatabaseSha256
        || !Array.isArray(catalog.entries)
        || !Array.isArray(catalog.supportMemoryRelations)
        || typeof catalog.eventMissionsComplete !== "boolean"
        || !Array.isArray(catalog.eventMissions)
        || catalog.count !== catalog.entries.length
        || catalog.questLevelCount !== manifest.questLevelCount
        || catalog.zBattleCount !== manifest.zBattleCount
        || catalog.eventMissions.length !== manifest.eventMissionCount
        || catalog.supportMemoryRelations.length !== manifest.supportMemoryRelationCount) {
        throw new Error("Stage delivery catalog does not match its manifest");
    }
    const shardsById = new Map(manifest.shards.map(shard => [shard.id, shard]));
    const keys = catalog.entries.map(entry => entry.key);
    if (new Set(keys).size !== keys.length
        || catalog.entries.some(entry => {
            const shard = shardsById.get(entry.detailShardId);
            return entry.key !== `${entry.kind}:${entry.id}`
                || !shard
                || (entry.kind === "quest-level"
                    ? !shard.questLevelIds.includes(entry.id)
                    : !shard.zBattleIds.includes(entry.id));
        })
        || catalog.entries.filter(entry => entry.kind === "quest-level").length !== manifest.questLevelCount
        || catalog.entries.filter(entry => entry.kind === "z-battle").length !== manifest.zBattleCount) {
        throw new Error("Stage delivery catalog routes do not match its manifest");
    }
}
function validateShardPayload(payload, shard, manifest) {
    if (payload.schemaVersion !== 1
        || payload.contract !== game_db_stage_delivery_1.STAGE_DELIVERY_CONTRACT
        || payload.contractVersion !== game_db_stage_delivery_1.STAGE_DELIVERY_CONTRACT_VERSION
        || payload.datasetVersion !== manifest.datasetVersion
        || payload.shardId !== shard.id
        || !Array.isArray(payload.questLevels)
        || !Array.isArray(payload.zBattles)
        || !sameStringSet(payload.questLevels.map(entry => entry.id), shard.questLevelIds)
        || !sameStringSet(payload.zBattles.map(entry => entry.id), shard.zBattleIds)
        || !sameStringSet([...new Set(payload.questLevels.map(entry => entry.areaId))], shard.areaIds)) {
        throw new Error(`Stage delivery shard ${shard.id} does not match its manifest route index`);
    }
}
function sameStringSet(left, right) {
    return left.length === right.length
        && new Set(left).size === left.length
        && left.every(value => right.includes(value));
}
async function readState(path, options) {
    if (!(0, fs_1.existsSync)(path))
        return undefined;
    const parsed = JSON.parse(await (0, promises_1.readFile)(path, "utf8"));
    if (parsed.schemaVersion === 1 && options.adoptUnboundState) {
        return {
            schemaVersion: 2,
            status: "in-progress",
            destination: publishDestination(options),
            datasetVersion: parsed.datasetVersion,
            manifestSha256: "",
            objects: {},
        };
    }
    const state = parsed;
    if (state.schemaVersion !== 2 || !state.objects || typeof state.objects !== "object" || !state.destination) {
        throw new Error(`Unsupported Stage delivery publish state: ${path}`);
    }
    if (JSON.stringify(state.destination) !== JSON.stringify(publishDestination(options))) {
        throw new Error(`Stage delivery publish state belongs to a different destination: ${path}`);
    }
    return state;
}
function publishDestination(options) {
    return {
        bucket: options.bucket,
        objectPrefix: options.objectPrefix,
        target: options.target,
        manifestObjectKey: scopedObjectKey(options.objectPrefix, MANIFEST_FILE_NAME),
    };
}
function printPlan(plan) {
    console.log(`Target: ${plan.options.target}`);
    console.log(`Bucket: ${plan.options.bucket}`);
    console.log(`Object prefix: ${plan.options.objectPrefix || "(root)"}`);
    console.log(`Objects: ${plan.files.length} files / ${plan.files.reduce((sum, file) => sum + file.object.sizeBytes, 0)} bytes (${plan.changedFiles.length} changed)`);
    console.log(`Manifest: ${plan.manifestBytes} bytes -> ${scopedObjectKey(plan.options.objectPrefix, MANIFEST_FILE_NAME)}${plan.uploadManifest ? " [upload]" : " [unchanged]"}`);
    console.log(`Dataset size: ${plan.totalDatasetBytes} bytes`);
    console.log(`This run uploads: ${plan.uploadBytes} bytes`);
    console.log(`Dataset version: ${plan.manifest.datasetVersion}`);
    console.log(`Catalog SHA-256: ${plan.manifest.catalog.sha256}`);
}
async function uploadObject(bucket, objectKey, filePath, contentType, cacheControl, target) {
    const args = [
        "r2", "object", "put", `${bucket}/${objectKey}`,
        "--file", filePath,
        "--content-type", contentType,
        "--cache-control", cacheControl,
        target === "remote" ? "--remote" : "--local",
    ];
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
function scopedObjectKey(prefix, objectKey) {
    return prefix ? `${prefix}/${objectKey}` : objectKey;
}
exports.scopedObjectKey = scopedObjectKey;
function normalizeObjectPrefix(value) {
    const normalized = value.trim().replace(/^\/+|\/+$/g, "");
    const segments = normalized.split("/");
    if (normalized && (!/^[A-Za-z0-9._-]+(?:\/[A-Za-z0-9._-]+)*$/.test(normalized)
        || segments.some(segment => segment === "." || segment === ".."))) {
        throw new Error(`Invalid R2 object prefix: ${value}`);
    }
    return normalized;
}
function parsePositiveNumber(value, fallback) {
    if (!value)
        return fallback;
    const parsed = Number.parseInt(value, 10);
    if (!Number.isSafeInteger(parsed) || parsed < 1)
        throw new Error(`Invalid positive number: ${value}`);
    return parsed;
}
function sha256(bytes) {
    return (0, crypto_1.createHash)("sha256").update(bytes).digest("hex");
}
if (require.main === module) {
    main().catch(error => {
        console.error(error instanceof Error ? error.message : String(error));
        process.exitCode = 1;
    });
}
//# sourceMappingURL=game-db-stage-delivery-publisher.js.map