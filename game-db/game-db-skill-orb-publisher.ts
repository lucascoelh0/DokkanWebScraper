import {
    GetObjectCommand,
    HeadObjectCommand,
    ListObjectsV2Command,
    PutObjectCommand,
    S3Client,
} from "@aws-sdk/client-s3";
import { createHash } from "crypto";
import { constants } from "fs";
import { lstat, open, readdir, realpath } from "fs/promises";
import { resolve, relative, sep } from "path";
import { Readable } from "stream";
import { createGunzip } from "zlib";
import { SkillOrbCandidateManifest } from "./game-db-skill-orb-candidate";
import {
    computeAssetInventorySha256,
    SkillOrbAssetEntry,
    SkillOrbCatalog,
    validateSkillOrbCatalog,
} from "./game-db-skill-orb-catalog";

const BUCKET = "dokkanpanion-data";
const STAGING_PREFIX = "staging/v2";
const MANIFEST_NAME = "equipment-skill-orbs-manifest.json";
const ASSET_MANIFEST_NAME = "equipment-skill-orb-assets-manifest.json";
const RAW_PAYLOAD_NAME = "equipment-skill-orbs.json";
const IMMUTABLE_CACHE = "public, max-age=31536000, immutable";
const MANIFEST_CACHE = "no-store";
const BUCKET_CEILING_BYTES = 10_000_000_000;

export const SKO02_PIN = {
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
} as const;

const LIMITS = {
    manifestBytes: 64 * 1024,
    assetManifestBytes: 1024 * 1024,
    compressedPayloadBytes: 16 * 1024 * 1024,
    expandedPayloadBytes: 64 * 1024 * 1024,
    individualAssetBytes: 4 * 1024 * 1024,
    totalAssetBytes: 64 * 1024 * 1024,
    assets: 512,
    items: 20_000,
    remoteObjectBytes: 64 * 1024 * 1024,
} as const;

interface SkillOrbAssetManifest {
    schemaVersion: number,
    provenance: { snapshotVersion: string, sourceDatabaseSha256: string },
    inventory: {
        assets: SkillOrbAssetEntry[],
        counts: Record<string, number>,
        totalBytes: number,
        inventorySha256: string,
    },
}

export type SkillOrbPublisherMode = "local-validate" | "dry-run-staging-v2" | "publish-staging-v2";

export interface SkillOrbPublisherOptions {
    candidateDir: string,
    mode: SkillOrbPublisherMode,
    confirmDatasetVersion?: string,
    concurrency: number,
    timeoutMs: number,
    retryAttempts: number,
    retryBaseDelayMs: number,
}

export interface RemoteInventoryEntry {
    key: string,
    sizeBytes: number,
    etag?: string,
}

export interface RemoteInventoryPage {
    objects: RemoteInventoryEntry[],
    isTruncated: boolean,
    nextContinuationToken?: string,
}

export interface RemoteObjectMetadata {
    sizeBytes: number,
    etag?: string,
    contentType?: string,
    contentEncoding?: string,
    cacheControl?: string,
    sha256Metadata?: string,
}

export interface RemoteObjectRead extends RemoteObjectMetadata {
    bytes: Buffer,
}

export type ConditionalPut = { ifNoneMatch: true } | { ifMatch: string };
export type ConditionalPutResult = "written" | "precondition-failed";

export interface SkillOrbObjectStore {
    listPage(continuationToken: string | undefined, signal: AbortSignal): Promise<RemoteInventoryPage>,
    head(key: string, signal: AbortSignal): Promise<RemoteObjectMetadata | undefined>,
    get(key: string, maxBytes: number, signal: AbortSignal): Promise<RemoteObjectRead | undefined>,
    put(
        key: string,
        bytes: Buffer,
        metadata: Omit<RemoteObjectMetadata, "sizeBytes" | "etag">,
        condition: ConditionalPut,
        signal: AbortSignal,
    ): Promise<ConditionalPutResult>,
}

type ObjectKind = "asset" | "payload" | "manifest";

interface ExpectedObject {
    kind: ObjectKind,
    key: string,
    relativePath: string,
    sizeBytes: number,
    sha256: string,
    contentType: string,
    contentEncoding?: string,
    cacheControl: string,
    sha256Metadata?: string,
    immutable: boolean,
}

export interface ValidatedSkillOrbCandidate {
    root: string,
    manifest: SkillOrbCandidateManifest,
    manifestSha256: string,
    assetManifestSha256: string,
    sourceFingerprint: string,
    objects: ExpectedObject[],
    totals: {
        assets: number,
        assetBytes: number,
        candidateObjectBytes: number,
    },
}

export interface PublisherTelemetry {
    list: number,
    head: number,
    get: number,
    put: number,
    retries: number,
    conditionalFailures: number,
    bytesRead: number,
    bytesWritten: number,
    delete: 0,
    stateWrites: 0,
}

export interface PlannedObject {
    kind: ObjectKind,
    key: string,
    sizeBytes: number,
    sha256: string,
    action: "reuse" | "create" | "replace" | "conflict",
    reason: string,
}

export interface SkillOrbPublisherReport {
    schemaVersion: 1,
    mode: SkillOrbPublisherMode,
    target: "local" | "staging/v2",
    decision: "GO" | "NO-GO",
    candidate: {
        root: string,
        snapshotVersion: string,
        datasetVersion: string,
        manifestSha256: string,
        payloadSha256: string,
        payloadSizeBytes: number,
        expandedSha256: string,
        expandedSizeBytes: number,
        assetCount: number,
        assetBytes: number,
        assetInventorySha256: string,
        sourceFingerprint: string,
    },
    remote?: {
        bucket: string,
        objectPrefix: string,
        inventoryPages: number,
        currentObjectCount: number,
        currentBucketBytes: number,
        projectedBucketBytes: number,
        bucketCeilingBytes: number,
        belowBucketCeiling: boolean,
        reusedObjects: number,
        newObjects: number,
        replacedObjects: number,
        conflictingObjects: number,
        reusedBytes: number,
        newNetBytes: number,
        futureWriteBytes: number,
        zeroRemovals: true,
        manifestLast: true,
        objects: PlannedObject[],
    },
    failure?: {
        phase: "remote-preflight" | "publication",
        code: "REMOTE_OPERATION_FAILED" | "BASELINE_CHANGED" | "BUCKET_CEILING_REACHED" | "READBACK_FAILED" | "SOURCE_CHANGED",
    },
    telemetry: PublisherTelemetry,
}

export interface SkillOrbPublisherTestDependencies {
    createRemoteStore(): SkillOrbObjectStore,
    delay(ms: number): Promise<void>,
    validateCandidateForTestOnly?: (candidateDir: string) => Promise<ValidatedSkillOrbCandidate>,
}

export interface SkillOrbPublisherTestHarnessResult {
    authority: "TEST_ONLY_NON_AUTHORITATIVE",
    report: SkillOrbPublisherReport,
}

function sha256(bytes: Buffer | string): string {
    return createHash("sha256").update(bytes).digest("hex");
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isSha256(value: unknown): value is string {
    return typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
}

function canonicalRelativePath(value: string): boolean {
    return /^[a-z0-9][a-z0-9._/-]*$/.test(value)
        && !value.includes("\\")
        && !value.split("/").some(part => !part || part === "." || part === "..");
}

function contained(root: string, relativePath: string): string {
    if (!canonicalRelativePath(relativePath)) throw new Error(`Non-canonical Skill Orb path: ${relativePath}`);
    const target = resolve(root, ...relativePath.split("/"));
    const prefix = `${resolve(root)}${sep}`.toLowerCase();
    if (!target.toLowerCase().startsWith(prefix)) throw new Error(`Skill Orb path escapes candidate root: ${relativePath}`);
    return target;
}

async function readStrictFile(root: string, relativePath: string, maxBytes: number): Promise<Buffer> {
    const target = contained(root, relativePath);
    const validateDirectoryChain = async (): Promise<string> => {
        const rootInfo = await lstat(root);
        if (!rootInfo.isDirectory() || rootInfo.isSymbolicLink()) throw new Error("Skill Orb candidate root must be a real directory");
        const rootReal = await realpath(root);
        let directory = root;
        for (const part of relativePath.split("/").slice(0, -1)) {
            directory = resolve(directory, part);
            const info = await lstat(directory);
            if (!info.isDirectory() || info.isSymbolicLink()) throw new Error(`Skill Orb candidate contains a link: ${relativePath}`);
            const directoryReal = await realpath(directory);
            if (!directoryReal.toLowerCase().startsWith(`${rootReal}${sep}`.toLowerCase())) {
                throw new Error(`Skill Orb file escapes candidate root: ${relativePath}`);
            }
        }
        return rootReal;
    };
    const rootReal = await validateDirectoryChain();
    let handle;
    try {
        handle = await open(target, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") throw new Error(`Missing Skill Orb candidate file: ${relativePath}`);
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
            if (result.bytesRead < 1) throw new Error(`Skill Orb file changed while being read: ${relativePath}`);
            offset += result.bytesRead;
        }
        const extra = Buffer.alloc(1);
        if ((await handle.read(extra, 0, 1, before.size)).bytesRead !== 0) {
            throw new Error(`Skill Orb file changed while being read: ${relativePath}`);
        }
        const after = await handle.stat();
        const pathAfter = await lstat(target);
        const targetReal = await realpath(target);
        await validateDirectoryChain();
        if (!pathAfter.isFile() || pathAfter.isSymbolicLink() || pathAfter.nlink !== 1
            || after.dev !== before.dev || after.ino !== before.ino || after.size !== before.size || after.mtimeMs !== before.mtimeMs
            || pathAfter.dev !== before.dev || pathAfter.ino !== before.ino || pathAfter.size !== before.size
            || !targetReal.toLowerCase().startsWith(`${rootReal}${sep}`.toLowerCase())) {
            throw new Error(`Skill Orb file changed while being read: ${relativePath}`);
        }
        return bytes;
    } finally {
        await handle.close();
    }
}

async function enumerateCandidateFiles(root: string): Promise<string[]> {
    const rootStat = await lstat(root);
    if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) throw new Error("Skill Orb candidate root must be a real directory");
    const files: string[] = [];
    async function visit(directory: string): Promise<void> {
        for (const entry of await readdir(directory, { withFileTypes: true })) {
            const absolute = resolve(directory, entry.name);
            const info = await lstat(absolute);
            if (info.isSymbolicLink()) throw new Error(`Skill Orb candidate contains a link: ${relative(root, absolute)}`);
            if (info.isDirectory()) await visit(absolute);
            else if (info.isFile() && info.nlink === 1) files.push(relative(root, absolute).replace(/\\/g, "/"));
            else throw new Error(`Skill Orb candidate contains an unsupported entry: ${relative(root, absolute)}`);
        }
    }
    await visit(root);
    return files.sort((left, right) => left.localeCompare(right, "en", { numeric: true }));
}

function parseJson<T>(bytes: Buffer, context: string): T {
    try { return JSON.parse(bytes.toString("utf8")) as T; }
    catch { throw new Error(`Invalid JSON in ${context}`); }
}

async function hashExpandedGzip(compressedBytes: Buffer): Promise<{ sizeBytes: number, sha256: string }> {
    const gunzip = createGunzip();
    Readable.from([compressedBytes]).pipe(gunzip);
    const hash = createHash("sha256");
    let sizeBytes = 0;
    for await (const chunk of gunzip) {
        const bytes = Buffer.from(chunk as Buffer);
        sizeBytes += bytes.byteLength;
        if (sizeBytes > LIMITS.expandedPayloadBytes) throw new Error("Expanded Skill Orb payload exceeds its limit");
        hash.update(bytes);
    }
    return { sizeBytes, sha256: hash.digest("hex") };
}

function validateManifest(manifest: SkillOrbCandidateManifest): void {
    const payloadKey = `equipment-skill-orbs/objects/${SKO02_PIN.payloadSha256}.json.gz`;
    if (manifest.schemaVersion !== 1
        || manifest.snapshotVersion !== SKO02_PIN.snapshotVersion
        || manifest.datasetVersion !== SKO02_PIN.datasetVersion
        || manifest.parserVersion !== SKO02_PIN.parserVersion
        || manifest.sourceDatabaseSha256 !== SKO02_PIN.sourceDatabaseSha256
        || manifest.assetBaseUrl !== "https://assets.dkbcompanion.com/staging/v2/game-assets"
        || manifest.payload.objectKey !== payloadKey
        || manifest.payload.sizeBytes !== SKO02_PIN.payloadSizeBytes
        || manifest.payload.sha256 !== SKO02_PIN.payloadSha256
        || manifest.payload.contentType !== "application/json"
        || manifest.payload.contentEncoding !== "gzip"
        || manifest.payload.uncompressedSizeBytes !== SKO02_PIN.expandedSizeBytes
        || manifest.payload.uncompressedSha256 !== SKO02_PIN.expandedSha256
        || manifest.assets.count !== SKO02_PIN.assetCount
        || manifest.assets.sizeBytes !== SKO02_PIN.assetBytes
        || manifest.assets.inventorySha256 !== SKO02_PIN.assetInventorySha256
        || manifest.counts.items !== SKO02_PIN.itemCount) {
        throw new Error("Skill Orb candidate manifest does not match the pinned release");
    }
}

function validateAssetManifest(manifest: SkillOrbAssetManifest): SkillOrbAssetEntry[] {
    if (!isRecord(manifest) || manifest.schemaVersion !== 1 || !isRecord(manifest.provenance)
        || manifest.provenance.snapshotVersion !== SKO02_PIN.snapshotVersion
        || manifest.provenance.sourceDatabaseSha256 !== SKO02_PIN.sourceDatabaseSha256
        || !isRecord(manifest.inventory) || !Array.isArray(manifest.inventory.assets)) {
        throw new Error("Invalid Skill Orb asset manifest identity");
    }
    const assets = manifest.inventory.assets;
    if (assets.length !== SKO02_PIN.assetCount || assets.length > LIMITS.assets
        || manifest.inventory.totalBytes !== SKO02_PIN.assetBytes
        || manifest.inventory.totalBytes > LIMITS.totalAssetBytes
        || manifest.inventory.inventorySha256 !== SKO02_PIN.assetInventorySha256
        || computeAssetInventorySha256(assets) !== SKO02_PIN.assetInventorySha256) {
        throw new Error("Skill Orb asset inventory does not match the pinned release");
    }
    const paths = new Set<string>();
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

export async function validateSkillOrbCandidate(candidateDir: string): Promise<ValidatedSkillOrbCandidate> {
    const root = resolve(candidateDir);
    const manifestBytes = await readStrictFile(root, MANIFEST_NAME, LIMITS.manifestBytes);
    const assetManifestBytes = await readStrictFile(root, ASSET_MANIFEST_NAME, LIMITS.assetManifestBytes);
    const manifest = parseJson<SkillOrbCandidateManifest>(manifestBytes, MANIFEST_NAME);
    validateManifest(manifest);
    const assetManifest = parseJson<SkillOrbAssetManifest>(assetManifestBytes, ASSET_MANIFEST_NAME);
    const assets = validateAssetManifest(assetManifest);
    if (manifestBytes.byteLength !== SKO02_PIN.manifestSizeBytes || sha256(manifestBytes) !== SKO02_PIN.manifestSha256) {
        throw new Error("Skill Orb candidate manifest bytes drifted from the pinned release");
    }
    if (assetManifestBytes.byteLength !== SKO02_PIN.assetManifestSizeBytes || sha256(assetManifestBytes) !== SKO02_PIN.assetManifestSha256) {
        throw new Error("Skill Orb asset manifest bytes drifted from the pinned release");
    }
    const payloadBytes = await readStrictFile(root, manifest.payload.objectKey, LIMITS.compressedPayloadBytes);
    if (payloadBytes.byteLength !== SKO02_PIN.payloadSizeBytes || sha256(payloadBytes) !== SKO02_PIN.payloadSha256) {
        throw new Error("Compressed Skill Orb payload drifted from the pinned release");
    }
    const expanded = await hashExpandedGzip(payloadBytes);
    if (expanded.sizeBytes !== SKO02_PIN.expandedSizeBytes || expanded.sha256 !== SKO02_PIN.expandedSha256) {
        throw new Error("Expanded Skill Orb payload drifted from the pinned release");
    }
    const rawBytes = await readStrictFile(root, RAW_PAYLOAD_NAME, LIMITS.expandedPayloadBytes);
    if (rawBytes.byteLength !== SKO02_PIN.expandedSizeBytes || sha256(rawBytes) !== SKO02_PIN.expandedSha256) {
        throw new Error("Raw Skill Orb payload does not match the expanded gzip");
    }
    const catalog = parseJson<SkillOrbCatalog>(rawBytes, RAW_PAYLOAD_NAME);
    if (catalog.items.length > LIMITS.items) throw new Error("Skill Orb item count exceeds its limit");
    validateSkillOrbCatalog(catalog);
    if (JSON.stringify(catalog.assetInventory) !== JSON.stringify(assetManifest.inventory)) {
        throw new Error("Skill Orb payload and asset manifest inventories differ");
    }

    const assetObjects: ExpectedObject[] = [];
    let assetBytes = 0;
    const sourceRows: string[] = [];
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
    if (assetBytes !== SKO02_PIN.assetBytes) throw new Error("Skill Orb asset byte total drifted");
    const expectedFiles = [
        MANIFEST_NAME, ASSET_MANIFEST_NAME, RAW_PAYLOAD_NAME, manifest.payload.objectKey,
        ...assets.map(asset => `game-assets/${asset.path}`),
    ].sort((left, right) => left.localeCompare(right, "en", { numeric: true }));
    const actualFiles = await enumerateCandidateFiles(root);
    if (expectedFiles.length !== actualFiles.length || expectedFiles.some((value, index) => value !== actualFiles[index])) {
        throw new Error("Skill Orb candidate contains missing or extra files");
    }
    const objects: ExpectedObject[] = [
        ...assetObjects,
        {
            kind: "payload", key: `${STAGING_PREFIX}/${manifest.payload.objectKey}`,
            relativePath: manifest.payload.objectKey, sizeBytes: payloadBytes.byteLength,
            sha256: SKO02_PIN.payloadSha256, contentType: "application/json", contentEncoding: "gzip",
            cacheControl: IMMUTABLE_CACHE, sha256Metadata: SKO02_PIN.payloadSha256, immutable: true,
        },
        {
            kind: "manifest", key: `${STAGING_PREFIX}/${MANIFEST_NAME}`,
            relativePath: MANIFEST_NAME, sizeBytes: manifestBytes.byteLength,
            sha256: SKO02_PIN.manifestSha256, contentType: "application/json",
            cacheControl: MANIFEST_CACHE, sha256Metadata: SKO02_PIN.manifestSha256, immutable: false,
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

function emptyTelemetry(): PublisherTelemetry {
    return { list: 0, head: 0, get: 0, put: 0, retries: 0, conditionalFailures: 0, bytesRead: 0, bytesWritten: 0, delete: 0, stateWrites: 0 };
}

function candidateReport(candidate: ValidatedSkillOrbCandidate): SkillOrbPublisherReport["candidate"] {
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

function retryable(error: unknown): boolean {
    const record = error as { name?: string, code?: string, $metadata?: { httpStatusCode?: number } };
    const status = record?.$metadata?.httpStatusCode;
    return record?.name === "AbortError" || record?.name === "TimeoutError"
        || status === 429 || (typeof status === "number" && status >= 500)
        || ["ECONNRESET", "ETIMEDOUT", "EAI_AGAIN", "ENOTFOUND", "ECONNREFUSED"].includes(record?.code ?? "");
}

async function boundedCall<T>(
    operation: "list" | "head" | "get" | "put",
    options: SkillOrbPublisherOptions,
    telemetry: PublisherTelemetry,
    delay: (ms: number) => Promise<void>,
    action: (signal: AbortSignal) => Promise<T>,
): Promise<T> {
    let lastError: unknown;
    for (let attempt = 1; attempt <= options.retryAttempts; attempt += 1) {
        telemetry[operation] += 1;
        const controller = new AbortController();
        let timeout: NodeJS.Timeout | undefined;
        try {
            const timeoutPromise = new Promise<never>((_, reject) => {
                timeout = setTimeout(() => {
                    controller.abort();
                    reject(Object.assign(new Error(`${operation} timed out`), { name: "TimeoutError" }));
                }, options.timeoutMs);
            });
            return await Promise.race([action(controller.signal), timeoutPromise]);
        } catch (error) {
            lastError = error;
            if (!retryable(error) || attempt === options.retryAttempts) throw error;
            telemetry.retries += 1;
            await delay(options.retryBaseDelayMs * (2 ** (attempt - 1)));
        } finally {
            if (timeout) clearTimeout(timeout);
        }
    }
    throw lastError;
}

async function mapConcurrent<T, R>(values: T[], concurrency: number, callback: (value: T) => Promise<R>): Promise<R[]> {
    const result = new Array<R>(values.length);
    let cursor = 0;
    async function worker(): Promise<void> {
        while (true) {
            const index = cursor++;
            if (index >= values.length) return;
            result[index] = await callback(values[index]);
        }
    }
    await Promise.all(Array.from({ length: Math.min(concurrency, Math.max(values.length, 1)) }, () => worker()));
    return result;
}

async function readBucketInventory(
    store: SkillOrbObjectStore,
    options: SkillOrbPublisherOptions,
    telemetry: PublisherTelemetry,
    delay: (ms: number) => Promise<void>,
): Promise<{ entries: Map<string, RemoteInventoryEntry>, pages: number, bytes: number }> {
    const entries = new Map<string, RemoteInventoryEntry>();
    const tokens = new Set<string>();
    let token: string | undefined;
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
            if (!Number.isSafeInteger(bytes)) throw new Error("R2 bucket byte total is unsafe");
        }
        if (page.isTruncated) {
            const next = page.nextContinuationToken;
            if (!next || tokens.has(next)) throw new Error("Invalid or repeated R2 continuation token");
            tokens.add(next);
            token = next;
        } else {
            if (page.nextContinuationToken) throw new Error("Unexpected continuation token on final R2 page");
            token = undefined;
        }
    } while (token);
    return { entries, pages, bytes };
}

function metadataMatches(expected: ExpectedObject, remote: RemoteObjectMetadata): boolean {
    return remote.contentType === expected.contentType
        && remote.contentEncoding === expected.contentEncoding
        && remote.cacheControl === expected.cacheControl
        && remote.sha256Metadata === expected.sha256Metadata;
}

interface Observation {
    expected: ExpectedObject,
    status: "missing" | "matching" | "different" | "conflict",
    reason: string,
    remote?: RemoteObjectMetadata & { sha256: string },
}

async function observeObject(
    expected: ExpectedObject,
    listed: Map<string, RemoteInventoryEntry>,
    store: SkillOrbObjectStore,
    options: SkillOrbPublisherOptions,
    telemetry: PublisherTelemetry,
    delay: (ms: number) => Promise<void>,
): Promise<Observation> {
    const inventoryEntry = listed.get(expected.key);
    const head = await boundedCall("head", options, telemetry, delay, signal => store.head(expected.key, signal));
    if (!head) {
        if (inventoryEntry) throw new Error(`R2 inventory/HEAD race for ${expected.key}`);
        return { expected, status: "missing", reason: "remote-object-missing" };
    }
    if (!inventoryEntry || inventoryEntry.sizeBytes !== head.sizeBytes) {
        throw new Error(`R2 inventory/HEAD drift for ${expected.key}`);
    }
    if (!Number.isSafeInteger(head.sizeBytes) || head.sizeBytes < 0 || head.sizeBytes > LIMITS.remoteObjectBytes) {
        return { expected, status: "conflict", reason: "remote-size-outside-safe-limit" };
    }
    const remote = await boundedCall("get", options, telemetry, delay, signal => store.get(expected.key, LIMITS.remoteObjectBytes, signal));
    if (!remote) throw new Error(`R2 HEAD/GET race for ${expected.key}`);
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

function sameBaseline(left: Observation, right: Observation): boolean {
    return left.status === right.status
        && left.remote?.etag === right.remote?.etag
        && left.remote?.sizeBytes === right.remote?.sizeBytes
        && left.remote?.sha256 === right.remote?.sha256
        && left.remote?.contentType === right.remote?.contentType
        && left.remote?.contentEncoding === right.remote?.contentEncoding
        && left.remote?.cacheControl === right.remote?.cacheControl
        && left.remote?.sha256Metadata === right.remote?.sha256Metadata;
}

function failureCode(error: unknown): NonNullable<SkillOrbPublisherReport["failure"]>["code"] {
    const message = error instanceof Error ? error.message : "";
    if (/baseline raced/.test(message)) return "BASELINE_CHANGED";
    if (/bucket ceiling/i.test(message)) return "BUCKET_CEILING_REACHED";
    if (/readback|immutable object is not ready/.test(message)) return "READBACK_FAILED";
    if (/candidate changed|source object changed/.test(message)) return "SOURCE_CHANGED";
    return "REMOTE_OPERATION_FAILED";
}

function plannedObject(observation: Observation): PlannedObject {
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

async function buildRemoteReport(
    candidate: ValidatedSkillOrbCandidate,
    store: SkillOrbObjectStore,
    options: SkillOrbPublisherOptions,
    telemetry: PublisherTelemetry,
    delay: (ms: number) => Promise<void>,
): Promise<{ report: SkillOrbPublisherReport, observations: Observation[], inventory: Awaited<ReturnType<typeof readBucketInventory>> }> {
    const inventory = await readBucketInventory(store, options, telemetry, delay);
    const observations = await mapConcurrent(candidate.objects, options.concurrency,
        expected => observeObject(expected, inventory.entries, store, options, telemetry, delay));
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

async function assertCandidateStable(
    candidate: ValidatedSkillOrbCandidate,
    validateCandidate: (candidateDir: string) => Promise<ValidatedSkillOrbCandidate>,
): Promise<ValidatedSkillOrbCandidate> {
    const current = await validateCandidate(candidate.root);
    if (current.sourceFingerprint !== candidate.sourceFingerprint) throw new Error("Skill Orb candidate changed during publication");
    return current;
}

async function readExpectedBytes(candidate: ValidatedSkillOrbCandidate, expected: ExpectedObject): Promise<Buffer> {
    const max = expected.kind === "manifest" ? LIMITS.manifestBytes
        : expected.kind === "payload" ? LIMITS.compressedPayloadBytes : LIMITS.individualAssetBytes;
    const bytes = await readStrictFile(candidate.root, expected.relativePath, max);
    if (bytes.byteLength !== expected.sizeBytes || sha256(bytes) !== expected.sha256) {
        throw new Error(`Skill Orb source object changed before write: ${expected.key}`);
    }
    return bytes;
}

async function putAndVerify(
    candidate: ValidatedSkillOrbCandidate,
    expected: ExpectedObject,
    condition: ConditionalPut,
    store: SkillOrbObjectStore,
    options: SkillOrbPublisherOptions,
    telemetry: PublisherTelemetry,
    delay: (ms: number) => Promise<void>,
): Promise<void> {
    const bytes = await readExpectedBytes(candidate, expected);
    const metadata = {
        contentType: expected.contentType,
        contentEncoding: expected.contentEncoding,
        cacheControl: expected.cacheControl,
        sha256Metadata: expected.sha256Metadata,
    };
    const result = await boundedCall("put", options, telemetry, delay,
        signal => store.put(expected.key, bytes, metadata, condition, signal));
    if (result === "precondition-failed") telemetry.conditionalFailures += 1;
    else {
        telemetry.bytesWritten += bytes.byteLength;
    }
    const head = await boundedCall("head", options, telemetry, delay, signal => store.head(expected.key, signal));
    const remote = await boundedCall("get", options, telemetry, delay, signal => store.get(expected.key, LIMITS.remoteObjectBytes, signal));
    if (!head || !remote) throw new Error(`Skill Orb write readback missing: ${expected.key}`);
    telemetry.bytesRead += remote.bytes.byteLength;
    if (remote.bytes.byteLength !== expected.sizeBytes || sha256(remote.bytes) !== expected.sha256
        || !metadataMatches(expected, head) || !metadataMatches(expected, remote)) {
        throw new Error(`Skill Orb write readback mismatch: ${expected.key}`);
    }
}

async function publishRemote(
    candidate: ValidatedSkillOrbCandidate,
    initial: Awaited<ReturnType<typeof buildRemoteReport>>,
    store: SkillOrbObjectStore,
    options: SkillOrbPublisherOptions,
    telemetry: PublisherTelemetry,
    delay: (ms: number) => Promise<void>,
    validateCandidate: (candidateDir: string) => Promise<ValidatedSkillOrbCandidate>,
): Promise<SkillOrbPublisherReport> {
    if (initial.report.decision !== "GO") return initial.report;
    await assertCandidateStable(candidate, validateCandidate);
    const initialManifest = initial.observations.find(value => value.expected.kind === "manifest")!;
    const freshInventory = await readBucketInventory(store, options, telemetry, delay);
    const prospective = initial.report.remote!.futureWriteBytes;
    const freshProjectedBytes = freshInventory.bytes + prospective;
    if (!Number.isSafeInteger(freshProjectedBytes) || freshProjectedBytes >= BUCKET_CEILING_BYTES) {
        initial.report.decision = "NO-GO";
        initial.report.failure = { phase: "publication", code: "BUCKET_CEILING_REACHED" };
        initial.report.remote!.inventoryPages = freshInventory.pages;
        initial.report.remote!.currentObjectCount = freshInventory.entries.size;
        initial.report.remote!.currentBucketBytes = freshInventory.bytes;
        initial.report.remote!.projectedBucketBytes = freshProjectedBytes;
        initial.report.remote!.belowBucketCeiling = false;
        return initial.report;
    }
    const manifestBeforeFirstWrite = await observeObject(
        initialManifest.expected, freshInventory.entries, store, options, telemetry, delay,
    );
    if (!sameBaseline(initialManifest, manifestBeforeFirstWrite)) {
        throw new Error("Skill Orb manifest baseline raced before the first write");
    }
    const creates = initial.observations.filter(value => value.expected.immutable && value.status === "missing");
    await mapConcurrent(creates, options.concurrency, value => putAndVerify(
        candidate, value.expected, { ifNoneMatch: true }, store, options, telemetry, delay,
    ));
    await assertCandidateStable(candidate, validateCandidate);

    const beforeManifestInventory = await readBucketInventory(store, options, telemetry, delay);
    const immutable = candidate.objects.filter(value => value.immutable);
    const immutableProofs = await mapConcurrent(immutable, options.concurrency,
        expected => observeObject(expected, beforeManifestInventory.entries, store, options, telemetry, delay));
    const badImmutable = immutableProofs.find(value => value.status !== "matching");
    if (badImmutable) throw new Error(`Skill Orb immutable object is not ready before manifest: ${badImmutable.expected.key}`);
    const manifestBeforePromotion = await observeObject(
        initialManifest.expected, beforeManifestInventory.entries, store, options, telemetry, delay,
    );
    if (!sameBaseline(initialManifest, manifestBeforePromotion)) {
        throw new Error("Skill Orb manifest baseline raced before manifest promotion");
    }
    const manifestNetBytes = initialManifest.status === "matching" ? 0
        : initialManifest.expected.sizeBytes - (manifestBeforePromotion.remote?.sizeBytes ?? 0);
    const finalProjectedBytes = beforeManifestInventory.bytes + manifestNetBytes;
    if (!Number.isSafeInteger(finalProjectedBytes) || finalProjectedBytes >= BUCKET_CEILING_BYTES) {
        initial.report.remote!.currentObjectCount = beforeManifestInventory.entries.size;
        initial.report.remote!.currentBucketBytes = beforeManifestInventory.bytes;
        initial.report.remote!.projectedBucketBytes = finalProjectedBytes;
        initial.report.remote!.belowBucketCeiling = false;
        throw new Error("Skill Orb bucket ceiling reached before manifest promotion");
    }
    if (initialManifest.status !== "matching") {
        const condition: ConditionalPut = initialManifest.status === "missing"
            ? { ifNoneMatch: true }
            : { ifMatch: initialManifest.remote!.etag! };
        await putAndVerify(candidate, initialManifest.expected, condition, store, options, telemetry, delay);
    }
    await assertCandidateStable(candidate, validateCandidate);
    return initial.report;
}

function validateOptions(options: SkillOrbPublisherOptions): void {
    if (options.mode !== "local-validate" && options.mode !== "dry-run-staging-v2" && options.mode !== "publish-staging-v2") {
        throw new Error("Invalid Skill Orb publisher mode");
    }
    if (!options.candidateDir || !Number.isSafeInteger(options.concurrency) || options.concurrency < 1 || options.concurrency > 16
        || !Number.isSafeInteger(options.timeoutMs) || options.timeoutMs < 1_000 || options.timeoutMs > 60_000
        || !Number.isSafeInteger(options.retryAttempts) || options.retryAttempts < 1 || options.retryAttempts > 5
        || !Number.isSafeInteger(options.retryBaseDelayMs) || options.retryBaseDelayMs < 0 || options.retryBaseDelayMs > 5_000) {
        throw new Error("Invalid bounded Skill Orb publisher options");
    }
    if (options.mode === "publish-staging-v2" && options.confirmDatasetVersion !== SKO02_PIN.datasetVersion) {
        throw new Error(`Live staging publication requires --confirm-dataset-version ${SKO02_PIN.datasetVersion}`);
    }
    if (options.mode !== "publish-staging-v2" && options.confirmDatasetVersion !== undefined) {
        throw new Error("Dataset confirmation is accepted only with --publish-staging-v2");
    }
}

async function executeSkillOrbPublisherEngine(
    options: SkillOrbPublisherOptions,
    dependencies: SkillOrbPublisherTestDependencies,
): Promise<SkillOrbPublisherReport> {
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
            } catch (error) {
                return {
                    schemaVersion: 1, mode: options.mode, target: "staging/v2", decision: "NO-GO",
                    candidate: candidateReport(candidate),
                    failure: { phase: "remote-preflight", code: failureCode(error) }, telemetry,
                };
            }
            if (options.mode === "dry-run-staging-v2") return initial.report;
            try {
                return await publishRemote(candidate, initial, store, options, telemetry, dependencies.delay, validateCandidate);
            } catch (error) {
                initial.report.decision = "NO-GO";
                initial.report.failure = { phase: "publication", code: failureCode(error) };
                return initial.report;
            }
        }
        default:
            throw new Error("Invalid Skill Orb publisher mode");
    }
}

export async function executeSkillOrbPublisher(options: SkillOrbPublisherOptions): Promise<SkillOrbPublisherReport> {
    return executeSkillOrbPublisherEngine(options, {
        createRemoteStore: () => createRemoteSkillOrbObjectStore(),
        delay: ms => new Promise(resolveDelay => setTimeout(resolveDelay, ms)),
    });
}

export async function executeSkillOrbPublisherTestHarness(
    options: SkillOrbPublisherOptions,
    dependencies: SkillOrbPublisherTestDependencies,
): Promise<SkillOrbPublisherTestHarnessResult> {
    return {
        authority: "TEST_ONLY_NON_AUTHORITATIVE",
        report: await executeSkillOrbPublisherEngine(options, dependencies),
    };
}

function integer(value: string | undefined, fallback: number, name: string): number {
    if (value === undefined) return fallback;
    if (!/^\d+$/.test(value)) throw new Error(`Invalid ${name}`);
    return Number(value);
}

export function parseSkillOrbPublisherArgs(argv: string[]): SkillOrbPublisherOptions {
    const values = new Map<string, string>();
    const modes = new Set<SkillOrbPublisherMode>();
    const valueFlags = new Set(["--candidate", "--confirm-dataset-version", "--concurrency", "--timeout-ms", "--retry-attempts", "--retry-base-delay-ms"]);
    const modeFlags = new Map<string, SkillOrbPublisherMode>([
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
            if (separator >= 0 || modes.has(mode)) throw new Error(`Invalid duplicate Skill Orb publisher mode: ${name}`);
            modes.add(mode);
            continue;
        }
        if (!valueFlags.has(name)) throw new Error("Unexpected Skill Orb publisher argument");
        const value = separator >= 0 ? token.slice(separator + 1) : argv[++index];
        if (!value || values.has(name)) throw new Error(`Missing or duplicate Skill Orb publisher argument: ${name}`);
        values.set(name, value);
    }
    if (modes.size !== 1) throw new Error("Choose exactly one of --local-validate, --dry-run-staging-v2 or --publish-staging-v2");
    const candidate = values.get("--candidate");
    if (!candidate) throw new Error("Skill Orb publisher requires --candidate");
    const options: SkillOrbPublisherOptions = {
        candidateDir: resolve(candidate), mode: [...modes][0],
        confirmDatasetVersion: values.get("--confirm-dataset-version"),
        concurrency: integer(values.get("--concurrency"), 4, "--concurrency"),
        timeoutMs: integer(values.get("--timeout-ms"), 30_000, "--timeout-ms"),
        retryAttempts: integer(values.get("--retry-attempts"), 4, "--retry-attempts"),
        retryBaseDelayMs: integer(values.get("--retry-base-delay-ms"), 250, "--retry-base-delay-ms"),
    };
    validateOptions(options);
    return options;
}

function missingObject(error: unknown): boolean {
    const record = error as { name?: string, $metadata?: { httpStatusCode?: number } };
    return record?.name === "NotFound" || record?.name === "NoSuchKey" || record?.$metadata?.httpStatusCode === 404;
}

function preconditionFailed(error: unknown): boolean {
    const record = error as { name?: string, $metadata?: { httpStatusCode?: number } };
    return record?.name === "PreconditionFailed" || record?.$metadata?.httpStatusCode === 409 || record?.$metadata?.httpStatusCode === 412;
}

async function readS3Body(body: unknown, contentLength: unknown, maxBytes: number): Promise<Buffer> {
    if (!Number.isSafeInteger(contentLength) || (contentLength as number) < 0 || (contentLength as number) > maxBytes) {
        throw new Error("R2 GET returned an invalid or oversized Content-Length");
    }
    if (!body || !(Symbol.asyncIterator in Object(body))) throw new Error("R2 GET returned a non-streaming body");
    const chunks: Buffer[] = [];
    let total = 0;
    for await (const chunk of body as AsyncIterable<Uint8Array>) {
        const bytes = Buffer.from(chunk);
        total += bytes.byteLength;
        if (total > (contentLength as number) || total > maxBytes) throw new Error("R2 GET exceeded its bounded length");
        chunks.push(bytes);
    }
    if (total !== contentLength) throw new Error("R2 GET body length mismatch");
    return Buffer.concat(chunks, total);
}

function createRemoteSkillOrbObjectStore(): SkillOrbObjectStore {
    const accountId = process.env.CLOUDFLARE_ACCOUNT_ID ?? "";
    const accessKeyId = process.env.R2_ACCESS_KEY_ID ?? "";
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY ?? "";
    if (!/^[a-f0-9]{32}$/.test(accountId) || !accessKeyId || !secretAccessKey || /[\r\n]/.test(accessKeyId + secretAccessKey)) {
        throw new Error("R2 S3 credentials are missing or invalid");
    }
    const client = new S3Client({
        region: "auto",
        endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
        credentials: { accessKeyId, secretAccessKey },
        maxAttempts: 1,
    });
    return {
        async listPage(continuationToken, signal) {
            const output = await client.send(new ListObjectsV2Command({
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
                const output = await client.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }), { abortSignal: signal });
                return {
                    sizeBytes: output.ContentLength ?? -1, etag: output.ETag,
                    contentType: output.ContentType, contentEncoding: output.ContentEncoding,
                    cacheControl: output.CacheControl, sha256Metadata: output.Metadata?.sha256,
                };
            } catch (error) {
                if (missingObject(error)) return undefined;
                throw error;
            }
        },
        async get(key, maxBytes, signal) {
            try {
                const output = await client.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }), { abortSignal: signal });
                const bytes = await readS3Body(output.Body, output.ContentLength, maxBytes);
                return {
                    bytes, sizeBytes: output.ContentLength as number, etag: output.ETag,
                    contentType: output.ContentType, contentEncoding: output.ContentEncoding,
                    cacheControl: output.CacheControl, sha256Metadata: output.Metadata?.sha256,
                };
            } catch (error) {
                if (missingObject(error)) return undefined;
                throw error;
            }
        },
        async put(key, bytes, metadata, condition, signal) {
            try {
                await client.send(new PutObjectCommand({
                    Bucket: BUCKET, Key: key, Body: bytes,
                    ContentType: metadata.contentType, ContentEncoding: metadata.contentEncoding,
                    CacheControl: metadata.cacheControl,
                    Metadata: metadata.sha256Metadata ? { sha256: metadata.sha256Metadata } : undefined,
                    ...("ifNoneMatch" in condition ? { IfNoneMatch: "*" } : { IfMatch: condition.ifMatch }),
                }), { abortSignal: signal });
                return "written";
            } catch (error) {
                if (preconditionFailed(error)) return "precondition-failed";
                throw error;
            }
        },
    };
}

async function main(): Promise<void> {
    const options = parseSkillOrbPublisherArgs(process.argv.slice(2));
    const report = await executeSkillOrbPublisher(options);
    console.log(JSON.stringify(report, null, 2));
    if (report.decision !== "GO") process.exitCode = 2;
}

if (require.main === module) main().catch(error => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
});
