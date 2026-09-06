"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseSkillOrbPublisherArgs = exports.executeSkillOrbPublisherTestHarness = exports.executeSkillOrbPublisher = exports.validateSkillOrbCandidate = exports.SKO02_PIN = void 0;
const client_s3_1 = require("@aws-sdk/client-s3");
const crypto_1 = require("crypto");
const fs_1 = require("fs");
const promises_1 = require("fs/promises");
const path_1 = require("path");
const stream_1 = require("stream");
const zlib_1 = require("zlib");
const game_db_skill_orb_catalog_1 = require("./game-db-skill-orb-catalog");
const BUCKET = "dokkanpanion-data";
const STAGING_PREFIX = "staging/v2";
const MANIFEST_NAME = "equipment-skill-orbs-manifest.json";
const ASSET_MANIFEST_NAME = "equipment-skill-orb-assets-manifest.json";
const RAW_PAYLOAD_NAME = "equipment-skill-orbs.json";
const IMMUTABLE_CACHE = "public, max-age=31536000, immutable";
const MANIFEST_CACHE = "no-store";
const BUCKET_CEILING_BYTES = 10000000000;
exports.SKO02_PIN = {
    snapshotVersion: "1788329250",
    datasetVersion: "1788329250-1.2.0-2b45636e0eee239c",
    parserVersion: "1.2.0",
    sourceDatabaseSha256: "7a6ca01808aea355ef28f9c0190e2c072f43a7c08be41d363f5b052824922495",
    manifestSizeBytes: 1922,
    manifestSha256: "41548427e44fcb2732fbd89cd0c624f31636e8ff494980b02cd8c4335a8c1576",
    assetManifestSizeBytes: 67804,
    assetManifestSha256: "878583e46f0fe1291e7445f0dfe8f0a8d3dc709d22affa2e12c05dde4186a3e0",
    payloadSizeBytes: 673076,
    payloadSha256: "2b45636e0eee239ced39d813e7e66403a0551d9524899e132a37f55c9c7c79b6",
    expandedSizeBytes: 10335871,
    expandedSha256: "158edf4cb135a04051dea978a6fd2d9238117f4a248f90f9cd8ba25b3e9154ec",
    assetCount: 196,
    assetBytes: 2153473,
    assetInventorySha256: "138f90f5203d19cff95eab005ff5d0863e838477234f250a0f6bf4d90d365cbf",
    itemCount: 8751,
};
const LIMITS = {
    manifestBytes: 64 * 1024,
    assetManifestBytes: 1024 * 1024,
    compressedPayloadBytes: 16 * 1024 * 1024,
    expandedPayloadBytes: 64 * 1024 * 1024,
    individualAssetBytes: 4 * 1024 * 1024,
    totalAssetBytes: 64 * 1024 * 1024,
    assets: 512,
    items: 20000,
    remoteObjectBytes: 64 * 1024 * 1024,
};
function sha256(bytes) {
    return (0, crypto_1.createHash)("sha256").update(bytes).digest("hex");
}
function isRecord(value) {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
function isSha256(value) {
    return typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
}
function canonicalRelativePath(value) {
    return /^[a-z0-9][a-z0-9._/-]*$/.test(value)
        && !value.includes("\\")
        && !value.split("/").some(part => !part || part === "." || part === "..");
}
function contained(root, relativePath) {
    if (!canonicalRelativePath(relativePath))
        throw new Error(`Non-canonical Skill Orb path: ${relativePath}`);
    const target = (0, path_1.resolve)(root, ...relativePath.split("/"));
    const prefix = `${(0, path_1.resolve)(root)}${path_1.sep}`.toLowerCase();
    if (!target.toLowerCase().startsWith(prefix))
        throw new Error(`Skill Orb path escapes candidate root: ${relativePath}`);
    return target;
}
async function readStrictFile(root, relativePath, maxBytes) {
    const target = contained(root, relativePath);
    const validateDirectoryChain = async () => {
        const rootInfo = await (0, promises_1.lstat)(root);
        if (!rootInfo.isDirectory() || rootInfo.isSymbolicLink())
            throw new Error("Skill Orb candidate root must be a real directory");
        const rootReal = await (0, promises_1.realpath)(root);
        let directory = root;
        for (const part of relativePath.split("/").slice(0, -1)) {
            directory = (0, path_1.resolve)(directory, part);
            const info = await (0, promises_1.lstat)(directory);
            if (!info.isDirectory() || info.isSymbolicLink())
                throw new Error(`Skill Orb candidate contains a link: ${relativePath}`);
            const directoryReal = await (0, promises_1.realpath)(directory);
            if (!directoryReal.toLowerCase().startsWith(`${rootReal}${path_1.sep}`.toLowerCase())) {
                throw new Error(`Skill Orb file escapes candidate root: ${relativePath}`);
            }
        }
        return rootReal;
    };
    const rootReal = await validateDirectoryChain();
    let handle;
    try {
        handle = await (0, promises_1.open)(target, fs_1.constants.O_RDONLY | (fs_1.constants.O_NOFOLLOW ?? 0));
    }
    catch (error) {
        if (error.code === "ENOENT")
            throw new Error(`Missing Skill Orb candidate file: ${relativePath}`);
        throw new Error(`Invalid bounded Skill Orb file: ${relativePath}`);
    }
    try {
        const before = await handle.stat();
        if (!before.isFile() || before.nlink !== 1 || !Number.isSafeInteger(before.size) || before.size < 1 || before.size > maxBytes) {
            throw new Error(`Invalid bounded Skill Orb file: ${relativePath}`);
        }
        const bytes = Buffer.alloc(before.size);
        let offset = 0;
        while (offset < bytes.byteLength) {
            const result = await handle.read(bytes, offset, bytes.byteLength - offset, offset);
            if (result.bytesRead < 1)
                throw new Error(`Skill Orb file changed while being read: ${relativePath}`);
            offset += result.bytesRead;
        }
        const extra = Buffer.alloc(1);
        if ((await handle.read(extra, 0, 1, before.size)).bytesRead !== 0) {
            throw new Error(`Skill Orb file changed while being read: ${relativePath}`);
        }
        const after = await handle.stat();
        const pathAfter = await (0, promises_1.lstat)(target);
        const targetReal = await (0, promises_1.realpath)(target);
        await validateDirectoryChain();
        if (!pathAfter.isFile() || pathAfter.isSymbolicLink() || pathAfter.nlink !== 1
            || after.dev !== before.dev || after.ino !== before.ino || after.size !== before.size || after.mtimeMs !== before.mtimeMs
            || pathAfter.dev !== before.dev || pathAfter.ino !== before.ino || pathAfter.size !== before.size
            || !targetReal.toLowerCase().startsWith(`${rootReal}${path_1.sep}`.toLowerCase())) {
            throw new Error(`Skill Orb file changed while being read: ${relativePath}`);
        }
        return bytes;
    }
    finally {
        await handle.close();
    }
}
async function enumerateCandidateFiles(root) {
    const rootStat = await (0, promises_1.lstat)(root);
    if (!rootStat.isDirectory() || rootStat.isSymbolicLink())
        throw new Error("Skill Orb candidate root must be a real directory");
    const files = [];
    async function visit(directory) {
        for (const entry of await (0, promises_1.readdir)(directory, { withFileTypes: true })) {
            const absolute = (0, path_1.resolve)(directory, entry.name);
            const info = await (0, promises_1.lstat)(absolute);
            if (info.isSymbolicLink())
                throw new Error(`Skill Orb candidate contains a link: ${(0, path_1.relative)(root, absolute)}`);
            if (info.isDirectory())
                await visit(absolute);
            else if (info.isFile() && info.nlink === 1)
                files.push((0, path_1.relative)(root, absolute).replace(/\\/g, "/"));
            else
                throw new Error(`Skill Orb candidate contains an unsupported entry: ${(0, path_1.relative)(root, absolute)}`);
        }
    }
    await visit(root);
    return files.sort((left, right) => left.localeCompare(right, "en", { numeric: true }));
}
function parseJson(bytes, context) {
    try {
        return JSON.parse(bytes.toString("utf8"));
    }
    catch {
        throw new Error(`Invalid JSON in ${context}`);
    }
}
async function hashExpandedGzip(compressedBytes) {
    const gunzip = (0, zlib_1.createGunzip)();
    stream_1.Readable.from([compressedBytes]).pipe(gunzip);
    const hash = (0, crypto_1.createHash)("sha256");
    let sizeBytes = 0;
    for await (const chunk of gunzip) {
        const bytes = Buffer.from(chunk);
        sizeBytes += bytes.byteLength;
        if (sizeBytes > LIMITS.expandedPayloadBytes)
            throw new Error("Expanded Skill Orb payload exceeds its limit");
        hash.update(bytes);
    }
    return { sizeBytes, sha256: hash.digest("hex") };
}
function validateManifest(manifest) {
    const payloadKey = `equipment-skill-orbs/objects/${exports.SKO02_PIN.payloadSha256}.json.gz`;
    if (manifest.schemaVersion !== 1
        || manifest.snapshotVersion !== exports.SKO02_PIN.snapshotVersion
        || manifest.datasetVersion !== exports.SKO02_PIN.datasetVersion
        || manifest.parserVersion !== exports.SKO02_PIN.parserVersion
        || manifest.sourceDatabaseSha256 !== exports.SKO02_PIN.sourceDatabaseSha256
        || manifest.assetBaseUrl !== "https://assets.dkbcompanion.com/staging/v2/game-assets"
        || manifest.payload.objectKey !== payloadKey
        || manifest.payload.sizeBytes !== exports.SKO02_PIN.payloadSizeBytes
        || manifest.payload.sha256 !== exports.SKO02_PIN.payloadSha256
        || manifest.payload.contentType !== "application/json"
        || manifest.payload.contentEncoding !== "gzip"
        || manifest.payload.uncompressedSizeBytes !== exports.SKO02_PIN.expandedSizeBytes
        || manifest.payload.uncompressedSha256 !== exports.SKO02_PIN.expandedSha256
        || manifest.assets.count !== exports.SKO02_PIN.assetCount
        || manifest.assets.sizeBytes !== exports.SKO02_PIN.assetBytes
        || manifest.assets.inventorySha256 !== exports.SKO02_PIN.assetInventorySha256
        || manifest.counts.items !== exports.SKO02_PIN.itemCount) {
        throw new Error("Skill Orb candidate manifest does not match the pinned release");
    }
}
function validateAssetManifest(manifest) {
    if (!isRecord(manifest) || manifest.schemaVersion !== 1 || !isRecord(manifest.provenance)
        || manifest.provenance.snapshotVersion !== exports.SKO02_PIN.snapshotVersion
        || manifest.provenance.sourceDatabaseSha256 !== exports.SKO02_PIN.sourceDatabaseSha256
        || !isRecord(manifest.inventory) || !Array.isArray(manifest.inventory.assets)) {
        throw new Error("Invalid Skill Orb asset manifest identity");
    }
    const assets = manifest.inventory.assets;
    if (assets.length !== exports.SKO02_PIN.assetCount || assets.length > LIMITS.assets
        || manifest.inventory.totalBytes !== exports.SKO02_PIN.assetBytes
        || manifest.inventory.totalBytes > LIMITS.totalAssetBytes
        || manifest.inventory.inventorySha256 !== exports.SKO02_PIN.assetInventorySha256
        || (0, game_db_skill_orb_catalog_1.computeAssetInventorySha256)(assets) !== exports.SKO02_PIN.assetInventorySha256) {
        throw new Error("Skill Orb asset inventory does not match the pinned release");
    }
    const paths = new Set();
    for (const asset of assets) {
        if (!canonicalRelativePath(asset.path) || paths.has(asset.path) || !Number.isSafeInteger(asset.sizeBytes)
            || asset.sizeBytes < 1 || asset.sizeBytes > LIMITS.individualAssetBytes || !isSha256(asset.sha256)
            || (asset.provenance !== "official-cpk" && asset.provenance !== "official-cpk-derived")
            || !Array.isArray(asset.sourceFiles) || asset.sourceFiles.some(value => typeof value !== "string" || !value)) {
            throw new Error(`Invalid or duplicate Skill Orb asset entry: ${String(asset.path)}`);
        }
        paths.add(asset.path);
    }
    return assets;
}
async function validateSkillOrbCandidate(candidateDir) {
    const root = (0, path_1.resolve)(candidateDir);
    const manifestBytes = await readStrictFile(root, MANIFEST_NAME, LIMITS.manifestBytes);
    const assetManifestBytes = await readStrictFile(root, ASSET_MANIFEST_NAME, LIMITS.assetManifestBytes);
    const manifest = parseJson(manifestBytes, MANIFEST_NAME);
    validateManifest(manifest);
    const assetManifest = parseJson(assetManifestBytes, ASSET_MANIFEST_NAME);
    const assets = validateAssetManifest(assetManifest);
    if (manifestBytes.byteLength !== exports.SKO02_PIN.manifestSizeBytes || sha256(manifestBytes) !== exports.SKO02_PIN.manifestSha256) {
        throw new Error("Skill Orb candidate manifest bytes drifted from the pinned release");
    }
    if (assetManifestBytes.byteLength !== exports.SKO02_PIN.assetManifestSizeBytes || sha256(assetManifestBytes) !== exports.SKO02_PIN.assetManifestSha256) {
        throw new Error("Skill Orb asset manifest bytes drifted from the pinned release");
    }
    const payloadBytes = await readStrictFile(root, manifest.payload.objectKey, LIMITS.compressedPayloadBytes);
    if (payloadBytes.byteLength !== exports.SKO02_PIN.payloadSizeBytes || sha256(payloadBytes) !== exports.SKO02_PIN.payloadSha256) {
        throw new Error("Compressed Skill Orb payload drifted from the pinned release");
    }
    const expanded = await hashExpandedGzip(payloadBytes);
    if (expanded.sizeBytes !== exports.SKO02_PIN.expandedSizeBytes || expanded.sha256 !== exports.SKO02_PIN.expandedSha256) {
        throw new Error("Expanded Skill Orb payload drifted from the pinned release");
    }
    const rawBytes = await readStrictFile(root, RAW_PAYLOAD_NAME, LIMITS.expandedPayloadBytes);
    if (rawBytes.byteLength !== exports.SKO02_PIN.expandedSizeBytes || sha256(rawBytes) !== exports.SKO02_PIN.expandedSha256) {
        throw new Error("Raw Skill Orb payload does not match the expanded gzip");
    }
    const catalog = parseJson(rawBytes, RAW_PAYLOAD_NAME);
    if (catalog.items.length > LIMITS.items)
        throw new Error("Skill Orb item count exceeds its limit");
    (0, game_db_skill_orb_catalog_1.validateSkillOrbCatalog)(catalog);
    if (JSON.stringify(catalog.assetInventory) !== JSON.stringify(assetManifest.inventory)) {
        throw new Error("Skill Orb payload and asset manifest inventories differ");
    }
    const assetObjects = [];
    let assetBytes = 0;
    const sourceRows = [];
    for (const asset of assets) {
        const relativePath = `game-assets/${asset.path}`;
        const bytes = await readStrictFile(root, relativePath, LIMITS.individualAssetBytes);
        const digest = sha256(bytes);
        if (bytes.byteLength !== asset.sizeBytes || digest !== asset.sha256) {
            throw new Error(`Skill Orb asset bytes drifted: ${asset.path}`);
        }
        assetBytes += bytes.byteLength;
        sourceRows.push(`${relativePath}\0${bytes.byteLength}\0${digest}`);
        assetObjects.push({
            kind: "asset", key: `${STAGING_PREFIX}/game-assets/${asset.path}`, relativePath,
            sizeBytes: bytes.byteLength, sha256: digest, contentType: "image/png",
            cacheControl: IMMUTABLE_CACHE, sha256Metadata: digest, immutable: true,
        });
    }
    if (assetBytes !== exports.SKO02_PIN.assetBytes)
        throw new Error("Skill Orb asset byte total drifted");
    const expectedFiles = [
        MANIFEST_NAME, ASSET_MANIFEST_NAME, RAW_PAYLOAD_NAME, manifest.payload.objectKey,
        ...assets.map(asset => `game-assets/${asset.path}`),
    ].sort((left, right) => left.localeCompare(right, "en", { numeric: true }));
    const actualFiles = await enumerateCandidateFiles(root);
    if (expectedFiles.length !== actualFiles.length || expectedFiles.some((value, index) => value !== actualFiles[index])) {
        throw new Error("Skill Orb candidate contains missing or extra files");
    }
    const objects = [
        ...assetObjects,
        {
            kind: "payload", key: `${STAGING_PREFIX}/${manifest.payload.objectKey}`,
            relativePath: manifest.payload.objectKey, sizeBytes: payloadBytes.byteLength,
            sha256: exports.SKO02_PIN.payloadSha256, contentType: "application/json", contentEncoding: "gzip",
            cacheControl: IMMUTABLE_CACHE, sha256Metadata: exports.SKO02_PIN.payloadSha256, immutable: true,
        },
        {
            kind: "manifest", key: `${STAGING_PREFIX}/${MANIFEST_NAME}`,
            relativePath: MANIFEST_NAME, sizeBytes: manifestBytes.byteLength,
            sha256: exports.SKO02_PIN.manifestSha256, contentType: "application/json",
            cacheControl: MANIFEST_CACHE, sha256Metadata: exports.SKO02_PIN.manifestSha256, immutable: false,
        },
    ];
    if (objects.some(object => !object.key.startsWith(`${STAGING_PREFIX}/`) || !canonicalRelativePath(object.key))) {
        throw new Error("Skill Orb candidate derived a non-canonical or out-of-channel object key");
    }
    sourceRows.push(`${MANIFEST_NAME}\0${manifestBytes.byteLength}\0${sha256(manifestBytes)}`);
    sourceRows.push(`${ASSET_MANIFEST_NAME}\0${assetManifestBytes.byteLength}\0${sha256(assetManifestBytes)}`);
    sourceRows.push(`${RAW_PAYLOAD_NAME}\0${rawBytes.byteLength}\0${sha256(rawBytes)}`);
    sourceRows.push(`${manifest.payload.objectKey}\0${payloadBytes.byteLength}\0${sha256(payloadBytes)}`);
    return {
        root, manifest, manifestSha256: sha256(manifestBytes), assetManifestSha256: sha256(assetManifestBytes),
        sourceFingerprint: sha256(sourceRows.sort().join("\n")), objects,
        totals: { assets: assets.length, assetBytes, candidateObjectBytes: objects.reduce((sum, object) => sum + object.sizeBytes, 0) },
    };
}
exports.validateSkillOrbCandidate = validateSkillOrbCandidate;
function emptyTelemetry() {
    return { list: 0, head: 0, get: 0, put: 0, retries: 0, conditionalFailures: 0, bytesRead: 0, bytesWritten: 0, delete: 0, stateWrites: 0 };
}
function candidateReport(candidate) {
    return {
        root: candidate.root,
        snapshotVersion: candidate.manifest.snapshotVersion,
        datasetVersion: candidate.manifest.datasetVersion,
        manifestSha256: candidate.manifestSha256,
        payloadSha256: candidate.manifest.payload.sha256,
        payloadSizeBytes: candidate.manifest.payload.sizeBytes,
        expandedSha256: candidate.manifest.payload.uncompressedSha256,
        expandedSizeBytes: candidate.manifest.payload.uncompressedSizeBytes,
        assetCount: candidate.manifest.assets.count,
        assetBytes: candidate.manifest.assets.sizeBytes,
        assetInventorySha256: candidate.manifest.assets.inventorySha256,
        sourceFingerprint: candidate.sourceFingerprint,
    };
}
function retryable(error) {
    const record = error;
    const status = record?.$metadata?.httpStatusCode;
    return record?.name === "AbortError" || record?.name === "TimeoutError"
        || status === 429 || (typeof status === "number" && status >= 500)
        || ["ECONNRESET", "ETIMEDOUT", "EAI_AGAIN", "ENOTFOUND", "ECONNREFUSED"].includes(record?.code ?? "");
}
async function boundedCall(operation, options, telemetry, delay, action) {
    let lastError;
    for (let attempt = 1; attempt <= options.retryAttempts; attempt += 1) {
        telemetry[operation] += 1;
        const controller = new AbortController();
        let timeout;
        try {
            const timeoutPromise = new Promise((_, reject) => {
                timeout = setTimeout(() => {
                    controller.abort();
                    reject(Object.assign(new Error(`${operation} timed out`), { name: "TimeoutError" }));
                }, options.timeoutMs);
            });
            return await Promise.race([action(controller.signal), timeoutPromise]);
        }
        catch (error) {
            lastError = error;
            if (!retryable(error) || attempt === options.retryAttempts)
                throw error;
            telemetry.retries += 1;
            await delay(options.retryBaseDelayMs * (2 ** (attempt - 1)));
        }
        finally {
            if (timeout)
                clearTimeout(timeout);
        }
    }
    throw lastError;
}
async function mapConcurrent(values, concurrency, callback) {
    const result = new Array(values.length);
    let cursor = 0;
    async function worker() {
        while (true) {
            const index = cursor++;
            if (index >= values.length)
                return;
            result[index] = await callback(values[index]);
        }
    }
    await Promise.all(Array.from({ length: Math.min(concurrency, Math.max(values.length, 1)) }, () => worker()));
    return result;
}
async function readBucketInventory(store, options, telemetry, delay) {
    const entries = new Map();
    const tokens = new Set();
    let token;
    let pages = 0;
    let bytes = 0;
    do {
        const page = await boundedCall("list", options, telemetry, delay, signal => store.listPage(token, signal));
        pages += 1;
        for (const entry of page.objects) {
            if (!entry.key || !Number.isSafeInteger(entry.sizeBytes) || entry.sizeBytes < 0 || entries.has(entry.key)) {
                throw new Error("Invalid or duplicate object in paginated R2 inventory");
            }
            entries.set(entry.key, entry);
            bytes += entry.sizeBytes;
            if (!Number.isSafeInteger(bytes))
                throw new Error("R2 bucket byte total is unsafe");
        }
        if (page.isTruncated) {
            const next = page.nextContinuationToken;
            if (!next || tokens.has(next))
                throw new Error("Invalid or repeated R2 continuation token");
            tokens.add(next);
            token = next;
        }
        else {
            if (page.nextContinuationToken)
                throw new Error("Unexpected continuation token on final R2 page");
            token = undefined;
        }
    } while (token);
    return { entries, pages, bytes };
}
function metadataMatches(expected, remote) {
    return remote.contentType === expected.contentType
        && remote.contentEncoding === expected.contentEncoding
        && remote.cacheControl === expected.cacheControl
        && remote.sha256Metadata === expected.sha256Metadata;
}
async function observeObject(expected, listed, store, options, telemetry, delay) {
    const inventoryEntry = listed.get(expected.key);
    const head = await boundedCall("head", options, telemetry, delay, signal => store.head(expected.key, signal));
    if (!head) {
        if (inventoryEntry)
            throw new Error(`R2 inventory/HEAD race for ${expected.key}`);
        return { expected, status: "missing", reason: "remote-object-missing" };
    }
    if (!inventoryEntry || inventoryEntry.sizeBytes !== head.sizeBytes) {
        throw new Error(`R2 inventory/HEAD drift for ${expected.key}`);
    }
    if (!Number.isSafeInteger(head.sizeBytes) || head.sizeBytes < 0 || head.sizeBytes > LIMITS.remoteObjectBytes) {
        return { expected, status: "conflict", reason: "remote-size-outside-safe-limit" };
    }
    const remote = await boundedCall("get", options, telemetry, delay, signal => store.get(expected.key, LIMITS.remoteObjectBytes, signal));
    if (!remote)
        throw new Error(`R2 HEAD/GET race for ${expected.key}`);
    telemetry.bytesRead += remote.bytes.byteLength;
    if (remote.sizeBytes !== remote.bytes.byteLength || remote.sizeBytes !== head.sizeBytes || remote.etag !== head.etag) {
        throw new Error(`R2 HEAD/GET metadata drift for ${expected.key}`);
    }
    const remoteSha256 = sha256(remote.bytes);
    const exactBytes = remote.sizeBytes === expected.sizeBytes && remoteSha256 === expected.sha256;
    const exactMetadata = metadataMatches(expected, remote) && metadataMatches(expected, head);
    if (exactBytes && exactMetadata) {
        return { expected, status: "matching", reason: "exact-bytes-and-metadata", remote: { ...remote, sha256: remoteSha256 } };
    }
    if (expected.immutable) {
        return {
            expected, status: "conflict",
            reason: exactBytes ? "immutable-metadata-drift" : "immutable-byte-conflict",
            remote: { ...remote, sha256: remoteSha256 },
        };
    }
    if (!head.etag || head.etag.startsWith("W/")) {
        return { expected, status: "conflict", reason: "mutable-manifest-missing-strong-etag", remote: { ...remote, sha256: remoteSha256 } };
    }
    return { expected, status: "different", reason: exactBytes ? "mutable-manifest-metadata-drift" : "mutable-manifest-different", remote: { ...remote, sha256: remoteSha256 } };
}
function sameBaseline(left, right) {
    return left.status === right.status
        && left.remote?.etag === right.remote?.etag
        && left.remote?.sizeBytes === right.remote?.sizeBytes
        && left.remote?.sha256 === right.remote?.sha256
        && left.remote?.contentType === right.remote?.contentType
        && left.remote?.contentEncoding === right.remote?.contentEncoding
        && left.remote?.cacheControl === right.remote?.cacheControl
        && left.remote?.sha256Metadata === right.remote?.sha256Metadata;
}
function failureCode(error) {
    const message = error instanceof Error ? error.message : "";
    if (/baseline raced/.test(message))
        return "BASELINE_CHANGED";
    if (/bucket ceiling/i.test(message))
        return "BUCKET_CEILING_REACHED";
    if (/readback|immutable object is not ready/.test(message))
        return "READBACK_FAILED";
    if (/candidate changed|source object changed/.test(message))
        return "SOURCE_CHANGED";
    return "REMOTE_OPERATION_FAILED";
}
function plannedObject(observation) {
    const action = observation.status === "matching" ? "reuse"
        : observation.status === "missing" ? "create"
            : observation.status === "different" ? "replace" : "conflict";
    return {
        kind: observation.expected.kind,
        key: observation.expected.key,
        sizeBytes: observation.expected.sizeBytes,
        sha256: observation.expected.sha256,
        action,
        reason: observation.reason,
    };
}
async function buildRemoteReport(candidate, store, options, telemetry, delay) {
    const inventory = await readBucketInventory(store, options, telemetry, delay);
    const observations = await mapConcurrent(candidate.objects, options.concurrency, expected => observeObject(expected, inventory.entries, store, options, telemetry, delay));
    const objects = observations.map(plannedObject);
    const conflicts = observations.filter(value => value.status === "conflict");
    const reused = observations.filter(value => value.status === "matching");
    const created = observations.filter(value => value.status === "missing");
    const replaced = observations.filter(value => value.status === "different");
    const newNetBytes = created.reduce((sum, value) => sum + value.expected.sizeBytes, 0)
        + replaced.reduce((sum, value) => sum + value.expected.sizeBytes - (value.remote?.sizeBytes ?? 0), 0);
    const futureWriteBytes = [...created, ...replaced].reduce((sum, value) => sum + value.expected.sizeBytes, 0);
    const projectedBucketBytes = inventory.bytes + newNetBytes;
    const belowBucketCeiling = Number.isSafeInteger(projectedBucketBytes) && projectedBucketBytes < BUCKET_CEILING_BYTES;
    const decision = conflicts.length === 0 && belowBucketCeiling ? "GO" : "NO-GO";
    return {
        observations, inventory,
        report: {
            schemaVersion: 1,
            mode: options.mode,
            target: "staging/v2",
            decision,
            candidate: candidateReport(candidate),
            remote: {
                bucket: BUCKET, objectPrefix: STAGING_PREFIX, inventoryPages: inventory.pages,
                currentObjectCount: inventory.entries.size, currentBucketBytes: inventory.bytes,
                projectedBucketBytes, bucketCeilingBytes: BUCKET_CEILING_BYTES, belowBucketCeiling,
                reusedObjects: reused.length, newObjects: created.length, replacedObjects: replaced.length,
                conflictingObjects: conflicts.length,
                reusedBytes: reused.reduce((sum, value) => sum + value.expected.sizeBytes, 0),
                newNetBytes, futureWriteBytes, zeroRemovals: true, manifestLast: true, objects,
            },
            telemetry,
        },
    };
}
async function assertCandidateStable(candidate, validateCandidate) {
    const current = await validateCandidate(candidate.root);
    if (current.sourceFingerprint !== candidate.sourceFingerprint)
        throw new Error("Skill Orb candidate changed during publication");
    return current;
}
async function readExpectedBytes(candidate, expected) {
    const max = expected.kind === "manifest" ? LIMITS.manifestBytes
        : expected.kind === "payload" ? LIMITS.compressedPayloadBytes : LIMITS.individualAssetBytes;
    const bytes = await readStrictFile(candidate.root, expected.relativePath, max);
    if (bytes.byteLength !== expected.sizeBytes || sha256(bytes) !== expected.sha256) {
        throw new Error(`Skill Orb source object changed before write: ${expected.key}`);
    }
    return bytes;
}
async function putAndVerify(candidate, expected, condition, store, options, telemetry, delay) {
    const bytes = await readExpectedBytes(candidate, expected);
    const metadata = {
        contentType: expected.contentType,
        contentEncoding: expected.contentEncoding,
        cacheControl: expected.cacheControl,
        sha256Metadata: expected.sha256Metadata,
    };
    const result = await boundedCall("put", options, telemetry, delay, signal => store.put(expected.key, bytes, metadata, condition, signal));
    if (result === "precondition-failed")
        telemetry.conditionalFailures += 1;
    else {
        telemetry.bytesWritten += bytes.byteLength;
    }
    const head = await boundedCall("head", options, telemetry, delay, signal => store.head(expected.key, signal));
    const remote = await boundedCall("get", options, telemetry, delay, signal => store.get(expected.key, LIMITS.remoteObjectBytes, signal));
    if (!head || !remote)
        throw new Error(`Skill Orb write readback missing: ${expected.key}`);
    telemetry.bytesRead += remote.bytes.byteLength;
    if (remote.bytes.byteLength !== expected.sizeBytes || sha256(remote.bytes) !== expected.sha256
        || !metadataMatches(expected, head) || !metadataMatches(expected, remote)) {
        throw new Error(`Skill Orb write readback mismatch: ${expected.key}`);
    }
}
async function publishRemote(candidate, initial, store, options, telemetry, delay, validateCandidate) {
    if (initial.report.decision !== "GO")
        return initial.report;
    await assertCandidateStable(candidate, validateCandidate);
    const initialManifest = initial.observations.find(value => value.expected.kind === "manifest");
    const freshInventory = await readBucketInventory(store, options, telemetry, delay);
    const prospective = initial.report.remote.futureWriteBytes;
    const freshProjectedBytes = freshInventory.bytes + prospective;
    if (!Number.isSafeInteger(freshProjectedBytes) || freshProjectedBytes >= BUCKET_CEILING_BYTES) {
        initial.report.decision = "NO-GO";
        initial.report.failure = { phase: "publication", code: "BUCKET_CEILING_REACHED" };
        initial.report.remote.inventoryPages = freshInventory.pages;
        initial.report.remote.currentObjectCount = freshInventory.entries.size;
        initial.report.remote.currentBucketBytes = freshInventory.bytes;
        initial.report.remote.projectedBucketBytes = freshProjectedBytes;
        initial.report.remote.belowBucketCeiling = false;
        return initial.report;
    }
    const manifestBeforeFirstWrite = await observeObject(initialManifest.expected, freshInventory.entries, store, options, telemetry, delay);
    if (!sameBaseline(initialManifest, manifestBeforeFirstWrite)) {
        throw new Error("Skill Orb manifest baseline raced before the first write");
    }
    const creates = initial.observations.filter(value => value.expected.immutable && value.status === "missing");
    await mapConcurrent(creates, options.concurrency, value => putAndVerify(candidate, value.expected, { ifNoneMatch: true }, store, options, telemetry, delay));
    await assertCandidateStable(candidate, validateCandidate);
    const beforeManifestInventory = await readBucketInventory(store, options, telemetry, delay);
    const immutable = candidate.objects.filter(value => value.immutable);
    const immutableProofs = await mapConcurrent(immutable, options.concurrency, expected => observeObject(expected, beforeManifestInventory.entries, store, options, telemetry, delay));
    const badImmutable = immutableProofs.find(value => value.status !== "matching");
    if (badImmutable)
        throw new Error(`Skill Orb immutable object is not ready before manifest: ${badImmutable.expected.key}`);
    const manifestBeforePromotion = await observeObject(initialManifest.expected, beforeManifestInventory.entries, store, options, telemetry, delay);
    if (!sameBaseline(initialManifest, manifestBeforePromotion)) {
        throw new Error("Skill Orb manifest baseline raced before manifest promotion");
    }
    const manifestNetBytes = initialManifest.status === "matching" ? 0
        : initialManifest.expected.sizeBytes - (manifestBeforePromotion.remote?.sizeBytes ?? 0);
    const finalProjectedBytes = beforeManifestInventory.bytes + manifestNetBytes;
    if (!Number.isSafeInteger(finalProjectedBytes) || finalProjectedBytes >= BUCKET_CEILING_BYTES) {
        initial.report.remote.currentObjectCount = beforeManifestInventory.entries.size;
        initial.report.remote.currentBucketBytes = beforeManifestInventory.bytes;
        initial.report.remote.projectedBucketBytes = finalProjectedBytes;
        initial.report.remote.belowBucketCeiling = false;
        throw new Error("Skill Orb bucket ceiling reached before manifest promotion");
    }
    if (initialManifest.status !== "matching") {
        const condition = initialManifest.status === "missing"
            ? { ifNoneMatch: true }
            : { ifMatch: initialManifest.remote.etag };
        await putAndVerify(candidate, initialManifest.expected, condition, store, options, telemetry, delay);
    }
    await assertCandidateStable(candidate, validateCandidate);
    return initial.report;
}
function validateOptions(options) {
    if (options.mode !== "local-validate" && options.mode !== "dry-run-staging-v2" && options.mode !== "publish-staging-v2") {
        throw new Error("Invalid Skill Orb publisher mode");
    }
    if (!options.candidateDir || !Number.isSafeInteger(options.concurrency) || options.concurrency < 1 || options.concurrency > 16
        || !Number.isSafeInteger(options.timeoutMs) || options.timeoutMs < 1000 || options.timeoutMs > 60000
        || !Number.isSafeInteger(options.retryAttempts) || options.retryAttempts < 1 || options.retryAttempts > 5
        || !Number.isSafeInteger(options.retryBaseDelayMs) || options.retryBaseDelayMs < 0 || options.retryBaseDelayMs > 5000) {
        throw new Error("Invalid bounded Skill Orb publisher options");
    }
    if (options.mode === "publish-staging-v2" && options.confirmDatasetVersion !== exports.SKO02_PIN.datasetVersion) {
        throw new Error(`Live staging publication requires --confirm-dataset-version ${exports.SKO02_PIN.datasetVersion}`);
    }
    if (options.mode !== "publish-staging-v2" && options.confirmDatasetVersion !== undefined) {
        throw new Error("Dataset confirmation is accepted only with --publish-staging-v2");
    }
}
async function executeSkillOrbPublisherEngine(options, dependencies) {
    validateOptions(options);
    const telemetry = emptyTelemetry();
    const validateCandidate = dependencies.validateCandidateForTestOnly ?? validateSkillOrbCandidate;
    const candidate = await validateCandidate(options.candidateDir);
    switch (options.mode) {
        case "local-validate":
            return {
                schemaVersion: 1, mode: options.mode, target: "local", decision: "GO",
                candidate: candidateReport(candidate), telemetry,
            };
        case "dry-run-staging-v2":
        case "publish-staging-v2": {
            const store = dependencies.createRemoteStore();
            let initial;
            try {
                initial = await buildRemoteReport(candidate, store, options, telemetry, dependencies.delay);
            }
            catch (error) {
                return {
                    schemaVersion: 1, mode: options.mode, target: "staging/v2", decision: "NO-GO",
                    candidate: candidateReport(candidate),
                    failure: { phase: "remote-preflight", code: failureCode(error) }, telemetry,
                };
            }
            if (options.mode === "dry-run-staging-v2")
                return initial.report;
            try {
                return await publishRemote(candidate, initial, store, options, telemetry, dependencies.delay, validateCandidate);
            }
            catch (error) {
                initial.report.decision = "NO-GO";
                initial.report.failure = { phase: "publication", code: failureCode(error) };
                return initial.report;
            }
        }
        default:
            throw new Error("Invalid Skill Orb publisher mode");
    }
}
async function executeSkillOrbPublisher(options) {
    return executeSkillOrbPublisherEngine(options, {
        createRemoteStore: () => createRemoteSkillOrbObjectStore(),
        delay: ms => new Promise(resolveDelay => setTimeout(resolveDelay, ms)),
    });
}
exports.executeSkillOrbPublisher = executeSkillOrbPublisher;
async function executeSkillOrbPublisherTestHarness(options, dependencies) {
    return {
        authority: "TEST_ONLY_NON_AUTHORITATIVE",
        report: await executeSkillOrbPublisherEngine(options, dependencies),
    };
}
exports.executeSkillOrbPublisherTestHarness = executeSkillOrbPublisherTestHarness;
function integer(value, fallback, name) {
    if (value === undefined)
        return fallback;
    if (!/^\d+$/.test(value))
        throw new Error(`Invalid ${name}`);
    return Number(value);
}
function parseSkillOrbPublisherArgs(argv) {
    const values = new Map();
    const modes = new Set();
    const valueFlags = new Set(["--candidate", "--confirm-dataset-version", "--concurrency", "--timeout-ms", "--retry-attempts", "--retry-base-delay-ms"]);
    const modeFlags = new Map([
        ["--local-validate", "local-validate"],
        ["--dry-run-staging-v2", "dry-run-staging-v2"],
        ["--publish-staging-v2", "publish-staging-v2"],
    ]);
    for (let index = 0; index < argv.length; index += 1) {
        const token = argv[index];
        const separator = token.indexOf("=");
        const name = separator >= 0 ? token.slice(0, separator) : token;
        const mode = modeFlags.get(name);
        if (mode) {
            if (separator >= 0 || modes.has(mode))
                throw new Error(`Invalid duplicate Skill Orb publisher mode: ${name}`);
            modes.add(mode);
            continue;
        }
        if (!valueFlags.has(name))
            throw new Error("Unexpected Skill Orb publisher argument");
        const value = separator >= 0 ? token.slice(separator + 1) : argv[++index];
        if (!value || values.has(name))
            throw new Error(`Missing or duplicate Skill Orb publisher argument: ${name}`);
        values.set(name, value);
    }
    if (modes.size !== 1)
        throw new Error("Choose exactly one of --local-validate, --dry-run-staging-v2 or --publish-staging-v2");
    const candidate = values.get("--candidate");
    if (!candidate)
        throw new Error("Skill Orb publisher requires --candidate");
    const options = {
        candidateDir: (0, path_1.resolve)(candidate), mode: [...modes][0],
        confirmDatasetVersion: values.get("--confirm-dataset-version"),
        concurrency: integer(values.get("--concurrency"), 4, "--concurrency"),
        timeoutMs: integer(values.get("--timeout-ms"), 30000, "--timeout-ms"),
        retryAttempts: integer(values.get("--retry-attempts"), 4, "--retry-attempts"),
        retryBaseDelayMs: integer(values.get("--retry-base-delay-ms"), 250, "--retry-base-delay-ms"),
    };
    validateOptions(options);
    return options;
}
exports.parseSkillOrbPublisherArgs = parseSkillOrbPublisherArgs;
function missingObject(error) {
    const record = error;
    return record?.name === "NotFound" || record?.name === "NoSuchKey" || record?.$metadata?.httpStatusCode === 404;
}
function preconditionFailed(error) {
    const record = error;
    return record?.name === "PreconditionFailed" || record?.$metadata?.httpStatusCode === 409 || record?.$metadata?.httpStatusCode === 412;
}
async function readS3Body(body, contentLength, maxBytes) {
    if (!Number.isSafeInteger(contentLength) || contentLength < 0 || contentLength > maxBytes) {
        throw new Error("R2 GET returned an invalid or oversized Content-Length");
    }
    if (!body || !(Symbol.asyncIterator in Object(body)))
        throw new Error("R2 GET returned a non-streaming body");
    const chunks = [];
    let total = 0;
    for await (const chunk of body) {
        const bytes = Buffer.from(chunk);
        total += bytes.byteLength;
        if (total > contentLength || total > maxBytes)
            throw new Error("R2 GET exceeded its bounded length");
        chunks.push(bytes);
    }
    if (total !== contentLength)
        throw new Error("R2 GET body length mismatch");
    return Buffer.concat(chunks, total);
}
function createRemoteSkillOrbObjectStore() {
    const accountId = process.env.CLOUDFLARE_ACCOUNT_ID ?? "";
    const accessKeyId = process.env.R2_ACCESS_KEY_ID ?? "";
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY ?? "";
    if (!/^[a-f0-9]{32}$/.test(accountId) || !accessKeyId || !secretAccessKey || /[\r\n]/.test(accessKeyId + secretAccessKey)) {
        throw new Error("R2 S3 credentials are missing or invalid");
    }
    const client = new client_s3_1.S3Client({
        region: "auto",
        endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
        credentials: { accessKeyId, secretAccessKey },
        maxAttempts: 1,
    });
    return {
        async listPage(continuationToken, signal) {
            const output = await client.send(new client_s3_1.ListObjectsV2Command({
                Bucket: BUCKET,
                ContinuationToken: continuationToken,
            }), { abortSignal: signal });
            return {
                objects: (output.Contents ?? []).map(value => ({
                    key: value.Key ?? "", sizeBytes: value.Size ?? -1, etag: value.ETag,
                })),
                isTruncated: output.IsTruncated === true,
                nextContinuationToken: output.NextContinuationToken,
            };
        },
        async head(key, signal) {
            try {
                const output = await client.send(new client_s3_1.HeadObjectCommand({ Bucket: BUCKET, Key: key }), { abortSignal: signal });
                return {
                    sizeBytes: output.ContentLength ?? -1, etag: output.ETag,
                    contentType: output.ContentType, contentEncoding: output.ContentEncoding,
                    cacheControl: output.CacheControl, sha256Metadata: output.Metadata?.sha256,
                };
            }
            catch (error) {
                if (missingObject(error))
                    return undefined;
                throw error;
            }
        },
        async get(key, maxBytes, signal) {
            try {
                const output = await client.send(new client_s3_1.GetObjectCommand({ Bucket: BUCKET, Key: key }), { abortSignal: signal });
                const bytes = await readS3Body(output.Body, output.ContentLength, maxBytes);
                return {
                    bytes, sizeBytes: output.ContentLength, etag: output.ETag,
                    contentType: output.ContentType, contentEncoding: output.ContentEncoding,
                    cacheControl: output.CacheControl, sha256Metadata: output.Metadata?.sha256,
                };
            }
            catch (error) {
                if (missingObject(error))
                    return undefined;
                throw error;
            }
        },
        async put(key, bytes, metadata, condition, signal) {
            try {
                await client.send(new client_s3_1.PutObjectCommand({
                    Bucket: BUCKET, Key: key, Body: bytes,
                    ContentType: metadata.contentType, ContentEncoding: metadata.contentEncoding,
                    CacheControl: metadata.cacheControl,
                    Metadata: metadata.sha256Metadata ? { sha256: metadata.sha256Metadata } : undefined,
                    ...("ifNoneMatch" in condition ? { IfNoneMatch: "*" } : { IfMatch: condition.ifMatch }),
                }), { abortSignal: signal });
                return "written";
            }
            catch (error) {
                if (preconditionFailed(error))
                    return "precondition-failed";
                throw error;
            }
        },
    };
}
async function main() {
    const options = parseSkillOrbPublisherArgs(process.argv.slice(2));
    const report = await executeSkillOrbPublisher(options);
    console.log(JSON.stringify(report, null, 2));
    if (report.decision !== "GO")
        process.exitCode = 2;
}
if (require.main === module)
    main().catch(error => {
        console.error(error instanceof Error ? error.message : String(error));
        process.exitCode = 1;
    });
//# sourceMappingURL=game-db-skill-orb-publisher.js.map