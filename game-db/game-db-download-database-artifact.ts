import { createHash, randomBytes } from "crypto";
import { createReadStream, existsSync } from "fs";
import { lstat, mkdir, open, readFile, realpath, rename, rm, stat, writeFile } from "fs/promises";
import { request } from "https";
import { basename, dirname, isAbsolute, relative, resolve, sep } from "path";
import { Readable } from "stream";

const OFFICIAL_CDN_HOST = "cf.ishin-global.aktsk.com";
const LOGICAL_FILE_PATH = "sqlite/current/en/database.db";
const SQLITE_HEADER = Buffer.from("SQLite format 3\u0000", "utf8");
const DEFAULT_STORE_ROOT = resolve(process.cwd(), "game-db", "data", "game-db-acquisition", "database-artifacts");
export const DEFAULT_DATABASE_ARTIFACT_MAX_BYTES = 128 * 1024 * 1024;
export const DEFAULT_DATABASE_ARTIFACT_TIMEOUT_MS = 120_000;

export interface ClientAssetsDatabasePayload {
    url: string,
    file_path: string,
    algorithm: "version",
    hash: string,
    version: number,
    patch: null,
    patch_hash: null,
}

export interface ValidatedDatabaseDescriptor {
    readonly region: "global",
    readonly locale: "en",
    readonly url: string,
    readonly logicalFilePath: typeof LOGICAL_FILE_PATH,
    readonly algorithm: "version",
    readonly declaredHash: string,
    readonly databaseVersion: number,
    readonly deliveryTimestamp: string,
    readonly patchState: "observed_null",
    readonly patchHashState: "observed_null",
}

export interface GameDbDownloadDatabaseArtifactOptions {
    descriptorJson?: string,
    artifactPath?: string,
    storeRoot: string,
    authorizeDownload: boolean,
    dryRun: boolean,
}

export interface GameDbAcquiredArtifactMetadata {
    schemaVersion: 1,
    contract: "dokkan-game-db-acquired-artifact",
    contractVersion: "1.0.0",
    region: "global",
    locale: "en",
    databaseVersion: number,
    logicalFilePath: typeof LOGICAL_FILE_PATH,
    declaredIntegrity: { algorithm: "version", hash: string },
    observedSizeBytes: number,
    localSha256: string,
    artifactState: "readable_sqlite" | "encrypted_or_packaged",
    descriptorLineage: {
        source: "externally_supplied_client_assets_database",
        deliveryFamily: "official_global_en_versioned_sqlite",
        patchState: "observed_null",
        patchHashState: "observed_null",
    },
    nextPermittedStep: "run_read_only_sqlite_compatibility" | "decrypt_locally_then_validate_read_only_sqlite",
}

export interface GameDbArtifactInspection {
    observedSizeBytes: number,
    localSha256: string,
    artifactState: "readable_sqlite" | "encrypted_or_packaged",
}

export interface GameDbOperationalReceiptLineage {
    region: "global",
    locale: "en",
    databaseVersion: number,
    logicalFilePath: typeof LOGICAL_FILE_PATH,
    declaredIntegrity: { algorithm: "version", hash: string },
}

interface GameDbOperationalReceiptBase {
    schemaVersion: 1,
    contract: "dokkan-game-db-acquisition-operation",
    contractVersion: "1.0.0",
    artifactIdentity: string,
    artifactState: "readable_sqlite" | "encrypted_or_packaged",
    lineage: GameDbOperationalReceiptLineage,
}

export type GameDbOperationalReceipt =
    | (GameDbOperationalReceiptBase & {
        mode: "official_descriptor_download",
        acquiredAt: string,
        result: "acquired" | "reused",
    })
    | (GameDbOperationalReceiptBase & {
        mode: "offline_existing_artifact_validation",
        validatedAt: string,
        result: "validated",
    });

export interface DatabaseArtifactTransportResponse {
    statusCode: number,
    headers: Record<string, string | string[] | undefined>,
    body: Readable,
}

export interface DatabaseArtifactTransport {
    get(url: URL, options: { signal: AbortSignal }): Promise<DatabaseArtifactTransportResponse>,
}

export interface AcquireDatabaseArtifactOptions {
    descriptor: unknown,
    storeRoot: string,
    transport: DatabaseArtifactTransport,
    maxBytes?: number,
    timeoutMs?: number,
    signal?: AbortSignal,
    now?: () => Date,
}

export interface AcquiredDatabaseArtifactResult {
    identity: string,
    artifactPath: string,
    metadataPath: string,
    commitMarkerPath: string,
    latestPointerPath: string,
    metadata: GameDbAcquiredArtifactMetadata,
    reused: boolean,
    receiptPath: string,
    receipt: GameDbOperationalReceipt,
}

function requiredValue(argv: string[], index: number, inline: string | undefined, token: string): string {
    const value = inline ?? argv[index + 1];
    if (!value || value.includes("\0")) throw new Error(`Missing or invalid value for ${token}`);
    return value;
}

export function parseDownloadDatabaseArtifactArgs(argv: string[]): GameDbDownloadDatabaseArtifactOptions {
    let descriptorJson: string | undefined;
    let artifactPath: string | undefined;
    let storeRoot = DEFAULT_STORE_ROOT;
    let authorizeDownload = false;
    let dryRun = false;
    for (let index = 0; index < argv.length; index += 1) {
        const token = argv[index];
        const equals = token.indexOf("=");
        const name = equals >= 0 ? token.slice(0, equals) : token;
        const inline = equals >= 0 ? token.slice(equals + 1) : undefined;
        if (name === "--descriptor-json" || name === "--artifact-path" || name === "--store-root") {
            const value = requiredValue(argv, index, inline, name);
            if (inline === undefined) index += 1;
            if (name === "--descriptor-json") descriptorJson = resolve(value);
            else if (name === "--artifact-path") artifactPath = resolve(value);
            else storeRoot = resolve(value);
            continue;
        }
        if (name === "--authorize-download" && inline === undefined) { authorizeDownload = true; continue; }
        if (name === "--dry-run" && inline === undefined) { dryRun = true; continue; }
        if (name === "--database-url" || name === "--client-assets-json" || name === "--output-dir" || name === "--output-file-name") {
            throw new Error(`${name} is disabled; use --descriptor-json or --artifact-path`);
        }
        throw new Error(`Unexpected argument: ${token}`);
    }
    if (!descriptorJson) throw new Error("--descriptor-json is required for descriptor lineage");
    if (authorizeDownload && artifactPath) throw new Error("--authorize-download cannot be combined with --artifact-path");
    if (authorizeDownload && dryRun) throw new Error("--authorize-download and --dry-run are mutually exclusive");
    if (artifactPath && dryRun) throw new Error("--artifact-path already performs offline validation and cannot be combined with --dry-run");
    return { descriptorJson, artifactPath, storeRoot, authorizeDownload, dryRun };
}

function isJsonObject(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === "object" && !Array.isArray(value);
}

function deliveryTimestampForVersion(version: number): string {
    const date = new Date(version * 1000);
    if (!Number.isFinite(date.getTime())) throw new Error("Descriptor version is outside the supported timestamp range");
    const digits = [date.getUTCFullYear().toString().padStart(4, "0"), (date.getUTCMonth() + 1).toString().padStart(2, "0"), date.getUTCDate().toString().padStart(2, "0")].join("");
    const time = [date.getUTCHours(), date.getUTCMinutes(), date.getUTCSeconds()].map(value => value.toString().padStart(2, "0")).join("");
    return `${digits}-${time}`;
}

export function validateClientAssetsDatabaseDescriptor(value: unknown): ValidatedDatabaseDescriptor {
    if (!isJsonObject(value)) throw new Error("Database descriptor must be a JSON object");
    const expectedKeys = ["algorithm", "file_path", "hash", "patch", "patch_hash", "url", "version"];
    const actualKeys = Object.keys(value).sort();
    if (JSON.stringify(actualKeys) !== JSON.stringify(expectedKeys)) throw new Error("Database descriptor fields do not match the strict contract");
    if (!Number.isSafeInteger(value.version) || (value.version as number) <= 0) throw new Error("Database descriptor version must be a positive safe integer");
    const version = value.version as number;
    if (value.file_path !== LOGICAL_FILE_PATH) throw new Error("Database descriptor file_path is not the Global EN logical path");
    if (value.algorithm !== "version") throw new Error("Database descriptor algorithm is not allowlisted");
    if (typeof value.hash !== "string" || !/^[1-9][0-9]*$/.test(value.hash) || value.hash !== String(version)) throw new Error("Database descriptor version hash is invalid");
    if (value.patch !== null || value.patch_hash !== null) throw new Error("Non-null database patch fields are not supported");
    if (typeof value.url !== "string" || value.url.length === 0 || value.url.length > 2048 || value.url.includes("\0")) throw new Error("Database descriptor URL is invalid");
    let parsed: URL;
    try { parsed = new URL(value.url); }
    catch { throw new Error("Database descriptor URL is invalid"); }
    if (parsed.protocol !== "https:") throw new Error("Database descriptor URL must use HTTPS");
    if (parsed.hostname !== OFFICIAL_CDN_HOST) throw new Error("Database descriptor URL host is not the exact official CDN host");
    if (parsed.port !== "") throw new Error("Database descriptor URL must use the default HTTPS port");
    if (parsed.username || parsed.password) throw new Error("Database descriptor URL must not contain credentials");
    if (parsed.search) throw new Error("Database descriptor URL query is not allowlisted");
    if (parsed.hash) throw new Error("Database descriptor URL fragment is not allowed");
    const deliveryTimestamp = deliveryTimestampForVersion(version);
    const expectedUrl = `https://${OFFICIAL_CDN_HOST}/sqlite/current/en/${deliveryTimestamp}/database.db`;
    if (value.url !== expectedUrl || parsed.pathname !== `/sqlite/current/en/${deliveryTimestamp}/database.db`) {
        throw new Error("Database descriptor CDN path does not match Global EN version lineage");
    }
    return Object.freeze({
        region: "global",
        locale: "en",
        url: expectedUrl,
        logicalFilePath: LOGICAL_FILE_PATH,
        algorithm: "version",
        declaredHash: value.hash,
        databaseVersion: version,
        deliveryTimestamp,
        patchState: "observed_null",
        patchHashState: "observed_null",
    });
}

async function assertRegularRealFile(filePath: string, label: string): Promise<string> {
    const resolved = resolve(filePath);
    try {
        const link = await lstat(resolved);
        if (!link.isFile() || link.isSymbolicLink()) throw new Error("rejected");
        const real = await realpath(resolved);
        if (resolve(real).toLowerCase() !== resolved.toLowerCase()) throw new Error("rejected");
        return real;
    } catch {
        throw new Error(`${label} must be a regular real file, not a symlink or junction`);
    }
}

export async function readAndValidateDatabaseDescriptor(filePath: string): Promise<ValidatedDatabaseDescriptor> {
    const realFile = await assertRegularRealFile(filePath, "Descriptor input");
    let parsed: unknown;
    try { parsed = JSON.parse(await readFile(realFile, "utf8")); }
    catch { throw new Error("Database descriptor JSON is malformed"); }
    return validateClientAssetsDatabaseDescriptor(parsed);
}

async function assertStoreRoot(storeRoot: string): Promise<string> {
    const resolved = resolve(storeRoot);
    if (!isAbsolute(resolved) || resolved.includes("\0")) throw new Error("Artifact store root is invalid");
    await mkdir(resolved, { recursive: true });
    const link = await lstat(resolved);
    const real = await realpath(resolved);
    if (!link.isDirectory() || link.isSymbolicLink() || resolve(real).toLowerCase() !== resolved.toLowerCase()) {
        throw new Error("Artifact store root must be a regular real directory, not a symlink or junction");
    }
    return real;
}

function normalizedHeader(headers: DatabaseArtifactTransportResponse["headers"], name: string): string | undefined {
    const found = Object.entries(headers).find(([key]) => key.toLowerCase() === name)?.[1];
    if (Array.isArray(found)) return found.length === 1 ? found[0] : undefined;
    return found;
}

async function inspectStreamToFile(input: {
    body: Readable,
    temporaryPath: string,
    expectedSizeBytes: number,
    maxBytes: number,
    signal: AbortSignal,
}): Promise<GameDbArtifactInspection> {
    const handle = await open(input.temporaryPath, "wx");
    const hash = createHash("sha256");
    let observedSizeBytes = 0;
    let header = Buffer.alloc(0);
    try {
        for await (const value of input.body) {
            if (input.signal.aborted) throw new Error("Database artifact acquisition cancelled");
            const chunk = Buffer.isBuffer(value) ? value : Buffer.from(value);
            observedSizeBytes += chunk.byteLength;
            if (observedSizeBytes > input.maxBytes || observedSizeBytes > input.expectedSizeBytes) throw new Error("Database artifact stream exceeds the allowed size");
            hash.update(chunk);
            if (header.byteLength < SQLITE_HEADER.byteLength) header = Buffer.concat([header, chunk.subarray(0, SQLITE_HEADER.byteLength - header.byteLength)]);
            await handle.write(chunk);
        }
        if (input.signal.aborted) throw new Error("Database artifact acquisition cancelled");
        if (observedSizeBytes !== input.expectedSizeBytes) throw new Error("Database artifact stream is truncated or size-divergent");
        await handle.sync();
    } finally {
        await handle.close();
    }
    return {
        observedSizeBytes,
        localSha256: hash.digest("hex"),
        artifactState: header.equals(SQLITE_HEADER) ? "readable_sqlite" : "encrypted_or_packaged",
    };
}

async function inspectRegularArtifact(filePath: string, maxBytes: number): Promise<GameDbArtifactInspection> {
    const realFile = await assertRegularRealFile(filePath, "Artifact input");
    const before = await stat(realFile);
    if (before.size <= 0 || before.size > maxBytes) throw new Error("Artifact input size is outside the allowed range");
    const hash = createHash("sha256");
    let observedSizeBytes = 0;
    let header = Buffer.alloc(0);
    for await (const value of createReadStream(realFile)) {
        const chunk = Buffer.isBuffer(value) ? value : Buffer.from(value);
        observedSizeBytes += chunk.byteLength;
        if (observedSizeBytes > maxBytes) throw new Error("Artifact input exceeds the allowed size");
        hash.update(chunk);
        if (header.byteLength < SQLITE_HEADER.byteLength) header = Buffer.concat([header, chunk.subarray(0, SQLITE_HEADER.byteLength - header.byteLength)]);
    }
    const after = await stat(realFile);
    if (before.dev !== after.dev || before.ino !== after.ino || before.size !== after.size || before.mtimeMs !== after.mtimeMs || observedSizeBytes !== after.size) {
        throw new Error("Artifact input changed during validation");
    }
    return { observedSizeBytes, localSha256: hash.digest("hex"), artifactState: header.equals(SQLITE_HEADER) ? "readable_sqlite" : "encrypted_or_packaged" };
}

async function inspectDownloadedDatabaseArtifact(filePath: string, maxBytes = DEFAULT_DATABASE_ARTIFACT_MAX_BYTES): Promise<GameDbArtifactInspection> {
    if (!Number.isSafeInteger(maxBytes) || maxBytes <= 0) throw new Error("Invalid artifact byte limit");
    return inspectRegularArtifact(filePath, maxBytes);
}

function metadataFor(descriptor: ValidatedDatabaseDescriptor, inspection: GameDbArtifactInspection): GameDbAcquiredArtifactMetadata {
    return {
        schemaVersion: 1,
        contract: "dokkan-game-db-acquired-artifact",
        contractVersion: "1.0.0",
        region: "global",
        locale: "en",
        databaseVersion: descriptor.databaseVersion,
        logicalFilePath: descriptor.logicalFilePath,
        declaredIntegrity: { algorithm: descriptor.algorithm, hash: descriptor.declaredHash },
        observedSizeBytes: inspection.observedSizeBytes,
        localSha256: inspection.localSha256,
        artifactState: inspection.artifactState,
        descriptorLineage: {
            source: "externally_supplied_client_assets_database",
            deliveryFamily: "official_global_en_versioned_sqlite",
            patchState: descriptor.patchState,
            patchHashState: descriptor.patchHashState,
        },
        nextPermittedStep: inspection.artifactState === "readable_sqlite"
            ? "run_read_only_sqlite_compatibility"
            : "decrypt_locally_then_validate_read_only_sqlite",
    };
}

function canonicalJson(value: unknown): string { return `${JSON.stringify(value, null, 2)}\n`; }

function artifactIdentity(metadata: GameDbAcquiredArtifactMetadata): string {
    return createHash("sha256").update(JSON.stringify({
        region: metadata.region,
        locale: metadata.locale,
        logicalFilePath: metadata.logicalFilePath,
        databaseVersion: metadata.databaseVersion,
        declaredIntegrity: metadata.declaredIntegrity,
        observedSizeBytes: metadata.observedSizeBytes,
        localSha256: metadata.localSha256,
    })).digest("hex");
}

function operationTimestamp(now: (() => Date) | undefined): string {
    const value = (now ?? (() => new Date()))();
    if (!(value instanceof Date) || Number.isNaN(value.getTime())) throw new Error("Operational receipt timestamp is invalid");
    return value.toISOString();
}

function receiptBase(descriptor: ValidatedDatabaseDescriptor, metadata: GameDbAcquiredArtifactMetadata, identity: string): GameDbOperationalReceiptBase {
    return {
        schemaVersion: 1,
        contract: "dokkan-game-db-acquisition-operation",
        contractVersion: "1.0.0",
        artifactIdentity: identity,
        artifactState: metadata.artifactState,
        lineage: {
            region: descriptor.region,
            locale: descriptor.locale,
            databaseVersion: descriptor.databaseVersion,
            logicalFilePath: descriptor.logicalFilePath,
            declaredIntegrity: { algorithm: descriptor.algorithm, hash: descriptor.declaredHash },
        },
    };
}

function ensureContained(root: string, candidate: string): void {
    const relation = relative(root, candidate);
    if (!relation || relation === ".." || relation.startsWith(`..${sep}`) || isAbsolute(relation)) throw new Error("Artifact store path escaped containment");
}

async function validateCommittedArtifact(directory: string, identity: string, metadata: GameDbAcquiredArtifactMetadata): Promise<void> {
    const artifactPath = resolve(directory, "database.db");
    const metadataPath = resolve(directory, "metadata.json");
    const markerPath = resolve(directory, "commit-marker.json");
    for (const path of [artifactPath, metadataPath, markerPath]) await assertRegularRealFile(path, "Committed artifact member");
    const [storedMetadataText, markerText, inspection] = await Promise.all([
        readFile(metadataPath, "utf8"),
        readFile(markerPath, "utf8"),
        inspectRegularArtifact(artifactPath, DEFAULT_DATABASE_ARTIFACT_MAX_BYTES),
    ]);
    if (storedMetadataText !== canonicalJson(metadata) || JSON.stringify(inspection) !== JSON.stringify({ observedSizeBytes: metadata.observedSizeBytes, localSha256: metadata.localSha256, artifactState: metadata.artifactState })) {
        throw new Error("Existing immutable artifact identity does not validate");
    }
    const expectedMarker = canonicalJson({ schemaVersion: 1, contract: "dokkan-game-db-artifact-commit", contractVersion: "1.0.0", identity, metadataSha256: createHash("sha256").update(storedMetadataText).digest("hex") });
    if (markerText !== expectedMarker) throw new Error("Existing immutable artifact commit marker does not validate");
}

async function promoteLatest(root: string, identity: string): Promise<string> {
    const latestPath = resolve(root, "latest.json");
    let previousIdentity: string | null = null;
    if (existsSync(latestPath)) {
        const current = JSON.parse(await readFile(latestPath, "utf8")) as Record<string, unknown>;
        if (current.schemaVersion !== 1 || typeof current.currentIdentity !== "string" || !/^[a-f0-9]{64}$/.test(current.currentIdentity)) throw new Error("Existing latest pointer is invalid");
        previousIdentity = current.currentIdentity === identity
            ? (typeof current.previousIdentity === "string" ? current.previousIdentity : null)
            : current.currentIdentity;
    }
    const pointer = { schemaVersion: 1, contract: "dokkan-game-db-local-latest", contractVersion: "1.0.0", currentIdentity: identity, previousIdentity };
    const temporary = resolve(root, `.latest-${process.pid}-${randomBytes(6).toString("hex")}.tmp`);
    await writeFile(temporary, canonicalJson(pointer), { flag: "wx" });
    await rename(temporary, latestPath);
    return latestPath;
}

async function writeOperationalReceipt(root: string, receipt: GameDbOperationalReceipt): Promise<string> {
    const receiptsRoot = await assertStoreRoot(resolve(root, "receipts"));
    const occurredAt = "acquiredAt" in receipt ? receipt.acquiredAt : receipt.validatedAt;
    const timestamp = occurredAt.replace(/[^0-9A-Za-z]/g, "");
    const fileName = `${receipt.mode}-${timestamp}-${randomBytes(6).toString("hex")}.json`;
    const target = resolve(receiptsRoot, fileName);
    ensureContained(receiptsRoot, target);
    const temporary = resolve(receiptsRoot, `.${fileName}.${process.pid}.tmp`);
    ensureContained(receiptsRoot, temporary);
    try {
        await writeFile(temporary, canonicalJson(receipt), { flag: "wx" });
        await rename(temporary, target);
        return target;
    } catch (error) {
        await rm(temporary, { force: true }).catch(() => undefined);
        throw error;
    }
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, controller: AbortController): Promise<T> {
    let timer: NodeJS.Timeout | undefined;
    const timeout = new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => { controller.abort(); reject(new Error("Database artifact transport timed out")); }, timeoutMs);
    });
    try { return await Promise.race([promise, timeout]); }
    finally { if (timer) clearTimeout(timer); }
}

const httpsDatabaseArtifactTransport: DatabaseArtifactTransport = {
    get(url, options) {
        return new Promise((resolvePromise, rejectPromise) => {
            const req = request(url, { method: "GET", headers: { Accept: "application/octet-stream" } }, response => {
                const headers: Record<string, string | string[] | undefined> = {};
                for (const [key, value] of Object.entries(response.headers)) headers[key] = value;
                resolvePromise({ statusCode: response.statusCode ?? 0, headers, body: response });
            });
            const abort = () => req.destroy(new Error("Database artifact acquisition cancelled"));
            if (options.signal.aborted) abort();
            else options.signal.addEventListener("abort", abort, { once: true });
            req.on("error", rejectPromise);
            req.end();
        });
    },
};

export async function acquireDatabaseArtifact(options: AcquireDatabaseArtifactOptions): Promise<AcquiredDatabaseArtifactResult> {
    // This is a runtime trust boundary. Callers of the compiled JavaScript can
    // fabricate TypeScript-shaped objects, so no field (especially URL) is used
    // until the complete raw descriptor has passed the same strict validator.
    const descriptor = validateClientAssetsDatabaseDescriptor(options.descriptor);
    const maxBytes = options.maxBytes ?? DEFAULT_DATABASE_ARTIFACT_MAX_BYTES;
    const timeoutMs = options.timeoutMs ?? DEFAULT_DATABASE_ARTIFACT_TIMEOUT_MS;
    if (!Number.isSafeInteger(maxBytes) || maxBytes <= 0 || !Number.isSafeInteger(timeoutMs) || timeoutMs <= 0) throw new Error("Invalid acquisition limits");
    const root = await assertStoreRoot(options.storeRoot);
    const lockPath = resolve(root, ".acquisition.lock");
    try { await mkdir(lockPath); }
    catch { throw new Error("Database artifact acquisition already has an active writer"); }
    const controller = new AbortController();
    const onAbort = () => controller.abort();
    options.signal?.addEventListener("abort", onAbort, { once: true });
    const temporaryPath = resolve(root, `.download-${process.pid}-${randomBytes(6).toString("hex")}.tmp`);
    let pendingDirectory: string | undefined;
    try {
        if (options.signal?.aborted) throw new Error("Database artifact acquisition cancelled");
        const response = await withTimeout(options.transport.get(new URL(descriptor.url), { signal: controller.signal }), timeoutMs, controller);
        if (response.statusCode < 200 || response.statusCode > 299) {
            response.body.destroy();
            if (response.statusCode >= 300 && response.statusCode <= 399) throw new Error("Database artifact redirects are blocked");
            throw new Error(`Database artifact response was not successful: ${response.statusCode}`);
        }
        const contentLength = normalizedHeader(response.headers, "content-length");
        if (!contentLength || !/^[1-9][0-9]*$/.test(contentLength)) { response.body.destroy(); throw new Error("Database artifact Content-Length is required and invalid"); }
        const expectedSizeBytes = Number(contentLength);
        if (!Number.isSafeInteger(expectedSizeBytes) || expectedSizeBytes > maxBytes) { response.body.destroy(); throw new Error("Database artifact Content-Length exceeds the allowed size"); }
        const abortBody = () => response.body.destroy(new Error("Database artifact acquisition cancelled"));
        controller.signal.addEventListener("abort", abortBody, { once: true });
        const timer = setTimeout(() => { controller.abort(); response.body.destroy(new Error("Database artifact stream timed out")); }, timeoutMs);
        let inspection: GameDbArtifactInspection;
        try { inspection = await inspectStreamToFile({ body: response.body, temporaryPath, expectedSizeBytes, maxBytes, signal: controller.signal }); }
        finally { clearTimeout(timer); controller.signal.removeEventListener("abort", abortBody); }
        const metadata = metadataFor(descriptor, inspection);
        const identity = artifactIdentity(metadata);
        const artifactsRoot = resolve(root, "artifacts");
        await mkdir(artifactsRoot, { recursive: true });
        const finalDirectory = resolve(artifactsRoot, identity);
        ensureContained(artifactsRoot, finalDirectory);
        let reused = false;
        if (existsSync(finalDirectory)) {
            await validateCommittedArtifact(finalDirectory, identity, metadata);
            await rm(temporaryPath, { force: true });
            reused = true;
        } else {
            pendingDirectory = resolve(artifactsRoot, `.pending-${process.pid}-${randomBytes(6).toString("hex")}`);
            ensureContained(artifactsRoot, pendingDirectory);
            await mkdir(pendingDirectory);
            const artifactPath = resolve(pendingDirectory, "database.db");
            await rename(temporaryPath, artifactPath);
            const metadataText = canonicalJson(metadata);
            await writeFile(resolve(pendingDirectory, "metadata.json"), metadataText, { flag: "wx" });
            const marker = { schemaVersion: 1, contract: "dokkan-game-db-artifact-commit", contractVersion: "1.0.0", identity, metadataSha256: createHash("sha256").update(metadataText).digest("hex") };
            await writeFile(resolve(pendingDirectory, "commit-marker.json"), canonicalJson(marker), { flag: "wx" });
            await rename(pendingDirectory, finalDirectory);
            pendingDirectory = undefined;
        }
        await validateCommittedArtifact(finalDirectory, identity, metadata);
        const receipt: GameDbOperationalReceipt = {
            ...receiptBase(descriptor, metadata, identity),
            mode: "official_descriptor_download",
            acquiredAt: operationTimestamp(options.now),
            result: reused ? "reused" : "acquired",
        };
        const receiptPath = await writeOperationalReceipt(root, receipt);
        const latestPointerPath = await promoteLatest(root, identity);
        return {
            identity,
            artifactPath: resolve(finalDirectory, "database.db"),
            metadataPath: resolve(finalDirectory, "metadata.json"),
            commitMarkerPath: resolve(finalDirectory, "commit-marker.json"),
            latestPointerPath,
            metadata,
            reused,
            receiptPath,
            receipt,
        };
    } catch (error) {
        controller.abort();
        await rm(temporaryPath, { force: true }).catch(() => undefined);
        if (pendingDirectory) await rm(pendingDirectory, { recursive: true, force: true }).catch(() => undefined);
        throw error;
    } finally {
        options.signal?.removeEventListener("abort", onAbort);
        await rm(lockPath, { recursive: true, force: true });
    }
}

export async function runDownloadDatabaseArtifact(options: GameDbDownloadDatabaseArtifactOptions, dependencies: { transport?: DatabaseArtifactTransport, now?: () => Date } = {}): Promise<
    | { mode: "descriptor_validation", descriptor: Omit<ValidatedDatabaseDescriptor, "url"> }
    | { mode: "artifact_validation", descriptor: Omit<ValidatedDatabaseDescriptor, "url">, inspection: GameDbArtifactInspection, identity: string, receiptPath: string, receipt: GameDbOperationalReceipt }
    | { mode: "authorized_download", result: AcquiredDatabaseArtifactResult }
> {
    if (!options.descriptorJson) throw new Error("Descriptor input is required");
    const descriptor = await readAndValidateDatabaseDescriptor(options.descriptorJson);
    const { url: _url, ...sanitized } = descriptor;
    if (options.artifactPath) {
        const inspection = await inspectDownloadedDatabaseArtifact(options.artifactPath);
        const metadata = metadataFor(descriptor, inspection);
        const identity = artifactIdentity(metadata);
        const root = await assertStoreRoot(options.storeRoot);
        const receipt: GameDbOperationalReceipt = {
            ...receiptBase(descriptor, metadata, identity),
            mode: "offline_existing_artifact_validation",
            validatedAt: operationTimestamp(dependencies.now),
            result: "validated",
        };
        const receiptPath = await writeOperationalReceipt(root, receipt);
        return { mode: "artifact_validation", descriptor: sanitized, inspection, identity, receiptPath, receipt };
    }
    if (!options.authorizeDownload || options.dryRun) {
        return { mode: "descriptor_validation", descriptor: sanitized };
    }
    const rawDescriptor: ClientAssetsDatabasePayload = {
        url: descriptor.url,
        file_path: descriptor.logicalFilePath,
        algorithm: descriptor.algorithm,
        hash: descriptor.declaredHash,
        version: descriptor.databaseVersion,
        patch: null,
        patch_hash: null,
    };
    const result = await acquireDatabaseArtifact({ descriptor: rawDescriptor, storeRoot: options.storeRoot, transport: dependencies.transport ?? httpsDatabaseArtifactTransport, now: dependencies.now });
    return { mode: "authorized_download", result };
}

async function main(): Promise<void> {
    const options = parseDownloadDatabaseArtifactArgs(process.argv.slice(2));
    const result = await runDownloadDatabaseArtifact(options);
    if (result.mode === "authorized_download") {
        console.log(`Acquired immutable database artifact ${result.result.identity}`);
        console.log(`Artifact state: ${result.result.metadata.artifactState}`);
        console.log(`Wrote operational receipt to ${result.result.receiptPath}`);
    } else if (result.mode === "artifact_validation") {
        console.log(JSON.stringify({ mode: result.mode, descriptor: result.descriptor, inspection: result.inspection, identity: result.identity, receipt: result.receipt }, null, 2));
        console.log(`Wrote operational receipt to ${result.receiptPath}`);
    } else {
        console.log(JSON.stringify(result, null, 2));
    }
}

if (require.main === module) {
    main().catch(error => { console.error(error); process.exitCode = 1; });
}
