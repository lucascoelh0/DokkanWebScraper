import { createHash, randomBytes } from "crypto";
import { createReadStream } from "fs";
import { lstat, mkdir, open, readFile, readdir, realpath, rename, rm, rmdir, stat, writeFile } from "fs/promises";
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
    const year = date.getUTCFullYear();
    if (!Number.isInteger(year) || year < 0 || year > 9999) throw new Error("Descriptor version UTC year must use exactly four digits");
    const digits = [year.toString().padStart(4, "0"), (date.getUTCMonth() + 1).toString().padStart(2, "0"), date.getUTCDate().toString().padStart(2, "0")].join("");
    const time = [date.getUTCHours(), date.getUTCMinutes(), date.getUTCSeconds()].map(value => value.toString().padStart(2, "0")).join("");
    const timestamp = `${digits}-${time}`;
    if (!/^\d{8}-\d{6}$/.test(timestamp)) throw new Error("Descriptor version timestamp is not canonical UTC");
    return timestamp;
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

interface DirectoryIdentity { path: string, dev: string, ino: string }

function samePath(left: string, right: string): boolean {
    return process.platform === "win32" ? resolve(left).toLowerCase() === resolve(right).toLowerCase() : resolve(left) === resolve(right);
}

async function captureDirectoryIdentity(path: string, label: string): Promise<DirectoryIdentity> {
    const resolved = resolve(path);
    let metadata: any, canonical: string;
    try {
        metadata = await lstat(resolved, { bigint: true });
        canonical = await realpath(resolved);
    } catch { throw new Error(`${label} must be a real directory`); }
    if (!metadata.isDirectory() || metadata.isSymbolicLink() || !samePath(canonical, resolved)) {
        throw new Error(`${label} must be a regular real directory, not a symlink, junction or reparse point`);
    }
    return { path: resolved, dev: BigInt(metadata.dev).toString(), ino: BigInt(metadata.ino).toString() };
}

async function sameDirectoryIdentity(expected: DirectoryIdentity): Promise<boolean> {
    try {
        const actual = await captureDirectoryIdentity(expected.path, "Controlled directory");
        return actual.dev === expected.dev && actual.ino === expected.ino;
    } catch { return false; }
}

function directoryChain(path: string): string[] {
    const paths: string[] = [];
    let current = resolve(path);
    while (true) {
        paths.unshift(current);
        const parent = dirname(current);
        if (parent === current) return paths;
        current = parent;
    }
}

class ArtifactStoreGuard {
    private readonly directories = new Map<string, DirectoryIdentity>();

    private constructor(readonly root: string) {}

    static async open(storeRoot: string): Promise<ArtifactStoreGuard> {
        const resolved = resolve(storeRoot);
        if (!isAbsolute(resolved) || resolved.includes("\0")) throw new Error("Artifact store root is invalid");
        const chain = directoryChain(resolved);
        let existing = chain.length - 1;
        while (existing >= 0) {
            try { await lstat(chain[existing]); break; }
            catch { existing -= 1; }
        }
        if (existing < 0) throw new Error("Artifact store root has no existing filesystem ancestor");
        for (let index = 0; index <= existing; index += 1) await captureDirectoryIdentity(chain[index], "Artifact store parent");
        await mkdir(resolved, { recursive: true });
        const guard = new ArtifactStoreGuard(resolved);
        for (const path of chain) guard.directories.set(path, await captureDirectoryIdentity(path, path === resolved ? "Artifact store root" : "Artifact store parent"));
        await guard.assertStable();
        return guard;
    }

    ensureContained(candidate: string, allowRoot = false): string {
        const target = resolve(candidate);
        if (allowRoot && samePath(target, this.root)) return target;
        const relation = relative(this.root, target);
        if (!relation || relation === ".." || relation.startsWith(`..${sep}`) || isAbsolute(relation)) throw new Error("Artifact store path escaped containment");
        return target;
    }

    async assertStable(): Promise<void> {
        for (const identity of this.directories.values()) {
            if (!await sameDirectoryIdentity(identity)) throw new Error(`Artifact store directory identity changed: ${identity.path}`);
        }
    }

    async trackExistingDirectory(path: string, label: string): Promise<string> {
        await this.assertStable();
        const target = this.ensureContained(path);
        const identity = await captureDirectoryIdentity(target, label);
        this.directories.set(target, identity);
        await this.assertStable();
        return target;
    }

    async ensureDirectory(path: string, label: string): Promise<string> {
        await this.assertStable();
        const target = this.ensureContained(path);
        try { await mkdir(target); }
        catch (error: any) { if (error?.code !== "EEXIST") throw error; }
        return this.trackExistingDirectory(target, label);
    }

    async createExclusiveDirectory(path: string, label: string): Promise<{ path: string, identity: DirectoryIdentity }> {
        await this.assertStable();
        const target = this.ensureContained(path);
        await mkdir(target);
        const identity = await captureDirectoryIdentity(target, label);
        this.directories.set(target, identity);
        await this.assertStable();
        return { path: target, identity };
    }

    async promoteDirectory(from: string, to: string): Promise<void> {
        await this.assertStable();
        const source = this.ensureContained(from), target = this.ensureContained(to);
        const identity = this.directories.get(source);
        if (!identity || !await sameDirectoryIdentity(identity)) throw new Error("Pending artifact directory identity changed");
        await rename(source, target);
        this.directories.delete(source);
        const promoted = await captureDirectoryIdentity(target, "Committed artifact directory");
        if (promoted.dev !== identity.dev || promoted.ino !== identity.ino) throw new Error("Artifact directory identity changed during promotion");
        this.directories.set(target, promoted);
        await this.assertStable();
    }

    async assertParent(path: string, parent: string): Promise<string> {
        await this.assertStable();
        const target = this.ensureContained(path);
        const expectedParent = resolve(parent);
        if (!samePath(dirname(target), expectedParent) || !this.directories.has(expectedParent)) throw new Error("Artifact store parent is not controlled");
        return target;
    }

    async removeRegularFile(path: string, parent: string): Promise<void> {
        const target = await this.assertParent(path, parent);
        let metadata: any;
        try { metadata = await lstat(target); }
        catch (error: any) { if (error?.code === "ENOENT") return; throw error; }
        const canonical = await realpath(target);
        if (!metadata.isFile() || metadata.isSymbolicLink() || !samePath(canonical, target)) throw new Error("Refusing to clean a replaced temporary file");
        await rm(target, { force: true });
        await this.assertStable();
    }

    async removeDirectory(path: string, identity: DirectoryIdentity, allowedFiles: string[]): Promise<void> {
        await this.assertStable();
        const target = this.ensureContained(path);
        if (!samePath(target, identity.path) || !await sameDirectoryIdentity(identity)) throw new Error("Refusing to clean a replaced controlled directory");
        const entries = await readdir(target, { withFileTypes: true });
        for (const entry of entries) {
            if (!allowedFiles.includes(entry.name) || !entry.isFile() || entry.isSymbolicLink()) throw new Error("Refusing to clean unexpected pending-directory content");
            await assertRegularRealFile(resolve(target, entry.name), "Pending artifact member");
        }
        this.directories.delete(target);
        if (entries.length === 0) await rmdir(target); else await rm(target, { recursive: true });
        await this.assertStable();
    }
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

async function inspectRegularArtifact(filePath: string, maxBytes: number, guard?: ArtifactStoreGuard, parent?: string): Promise<GameDbArtifactInspection> {
    if (guard && parent) await guard.assertParent(filePath, parent);
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
    if (guard) await guard.assertStable();
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

function exactKeys(value: Record<string, unknown>, expected: string[]): boolean {
    return JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...expected].sort());
}

function parseCommittedMetadata(value: unknown): GameDbAcquiredArtifactMetadata {
    if (!isJsonObject(value) || !exactKeys(value, ["schemaVersion", "contract", "contractVersion", "region", "locale", "databaseVersion", "logicalFilePath", "declaredIntegrity", "observedSizeBytes", "localSha256", "artifactState", "descriptorLineage", "nextPermittedStep"])) throw new Error("Committed artifact metadata contract is invalid");
    if (value.schemaVersion !== 1 || value.contract !== "dokkan-game-db-acquired-artifact" || value.contractVersion !== "1.0.0" || value.region !== "global" || value.locale !== "en"
        || !Number.isSafeInteger(value.databaseVersion) || (value.databaseVersion as number) <= 0 || value.logicalFilePath !== LOGICAL_FILE_PATH
        || !Number.isSafeInteger(value.observedSizeBytes) || (value.observedSizeBytes as number) <= 0 || typeof value.localSha256 !== "string" || !/^[a-f0-9]{64}$/.test(value.localSha256)
        || (value.artifactState !== "readable_sqlite" && value.artifactState !== "encrypted_or_packaged")) throw new Error("Committed artifact metadata fields are invalid");
    if (!isJsonObject(value.declaredIntegrity) || !exactKeys(value.declaredIntegrity, ["algorithm", "hash"]) || value.declaredIntegrity.algorithm !== "version"
        || typeof value.declaredIntegrity.hash !== "string" || !/^[1-9][0-9]*$/.test(value.declaredIntegrity.hash) || value.declaredIntegrity.hash !== String(value.databaseVersion)) throw new Error("Committed artifact declared integrity is invalid");
    if (!isJsonObject(value.descriptorLineage) || !exactKeys(value.descriptorLineage, ["source", "deliveryFamily", "patchState", "patchHashState"])
        || value.descriptorLineage.source !== "externally_supplied_client_assets_database" || value.descriptorLineage.deliveryFamily !== "official_global_en_versioned_sqlite"
        || value.descriptorLineage.patchState !== "observed_null" || value.descriptorLineage.patchHashState !== "observed_null") throw new Error("Committed artifact descriptor lineage is invalid");
    const expectedNext = value.artifactState === "readable_sqlite" ? "run_read_only_sqlite_compatibility" : "decrypt_locally_then_validate_read_only_sqlite";
    if (value.nextPermittedStep !== expectedNext) throw new Error("Committed artifact next step is invalid");
    return value as unknown as GameDbAcquiredArtifactMetadata;
}

async function readStableTextFile(guard: ArtifactStoreGuard, filePath: string, parent: string, label: string): Promise<string> {
    await guard.assertParent(filePath, parent);
    const canonical = await assertRegularRealFile(filePath, label);
    const before: any = await stat(canonical, { bigint: true });
    const text = await readFile(canonical, "utf8");
    const after: any = await stat(canonical, { bigint: true });
    if (before.dev !== after.dev || before.ino !== after.ino || before.size !== after.size || before.mtimeNs !== after.mtimeNs || before.ctimeNs !== after.ctimeNs) throw new Error(`${label} changed during validation`);
    await guard.assertStable();
    return text;
}

async function validateCommittedArtifact(guard: ArtifactStoreGuard, artifactsRoot: string, identity: string, expectedMetadata?: GameDbAcquiredArtifactMetadata): Promise<GameDbAcquiredArtifactMetadata> {
    if (!/^[a-f0-9]{64}$/.test(identity)) throw new Error("Committed artifact identity syntax is invalid");
    const directory = await guard.trackExistingDirectory(resolve(artifactsRoot, identity), "Committed artifact directory");
    const entries = (await readdir(directory, { withFileTypes: true })).map(value => value.name).sort();
    if (JSON.stringify(entries) !== JSON.stringify(["commit-marker.json", "database.db", "metadata.json"])) throw new Error("Committed artifact members are incomplete or unexpected");
    const artifactPath = resolve(directory, "database.db");
    const metadataPath = resolve(directory, "metadata.json");
    const markerPath = resolve(directory, "commit-marker.json");
    for (const path of [artifactPath, metadataPath, markerPath]) await assertRegularRealFile(path, "Committed artifact member");
    const storedMetadataText = await readStableTextFile(guard, metadataPath, directory, "Committed artifact metadata");
    let storedMetadataValue: unknown;
    try { storedMetadataValue = JSON.parse(storedMetadataText); } catch { throw new Error("Committed artifact metadata JSON is malformed"); }
    const metadata = parseCommittedMetadata(storedMetadataValue);
    if (storedMetadataText !== canonicalJson(metadata) || artifactIdentity(metadata) !== identity || (expectedMetadata && canonicalJson(metadata) !== canonicalJson(expectedMetadata))) {
        throw new Error("Existing immutable artifact identity does not validate");
    }
    const inspection = await inspectRegularArtifact(artifactPath, DEFAULT_DATABASE_ARTIFACT_MAX_BYTES, guard, directory);
    if (JSON.stringify(inspection) !== JSON.stringify({ observedSizeBytes: metadata.observedSizeBytes, localSha256: metadata.localSha256, artifactState: metadata.artifactState })) throw new Error("Existing immutable artifact identity does not validate");
    const markerText = await readStableTextFile(guard, markerPath, directory, "Committed artifact marker");
    const expectedMarker = canonicalJson({ schemaVersion: 1, contract: "dokkan-game-db-artifact-commit", contractVersion: "1.0.0", identity, metadataSha256: createHash("sha256").update(storedMetadataText).digest("hex") });
    if (markerText !== expectedMarker) throw new Error("Existing immutable artifact commit marker does not validate");
    await guard.assertStable();
    return metadata;
}

interface LatestPointer { schemaVersion: 1, contract: "dokkan-game-db-local-latest", contractVersion: "1.0.0", currentIdentity: string, previousIdentity: string | null }

function parseLatestPointer(text: string): LatestPointer {
    let value: unknown;
    try { value = JSON.parse(text); } catch { throw new Error("Existing latest pointer is invalid"); }
    if (!isJsonObject(value) || !exactKeys(value, ["schemaVersion", "contract", "contractVersion", "currentIdentity", "previousIdentity"])
        || value.schemaVersion !== 1 || value.contract !== "dokkan-game-db-local-latest" || value.contractVersion !== "1.0.0"
        || typeof value.currentIdentity !== "string" || !/^[a-f0-9]{64}$/.test(value.currentIdentity)
        || !(value.previousIdentity === null || (typeof value.previousIdentity === "string" && /^[a-f0-9]{64}$/.test(value.previousIdentity)))
        || value.currentIdentity === value.previousIdentity) throw new Error("Existing latest pointer is invalid or cyclic");
    return value as unknown as LatestPointer;
}

function throwIfCancelled(signal: AbortSignal): void {
    if (signal.aborted) throw new Error("Database artifact acquisition cancelled");
}

async function promoteLatest(guard: ArtifactStoreGuard, artifactsRoot: string, identity: string, signal: AbortSignal): Promise<{ path: string, rollback: () => Promise<void> }> {
    const latestPath = resolve(guard.root, "latest.json");
    await validateCommittedArtifact(guard, artifactsRoot, identity);
    let originalText: string | null = null;
    let previousIdentity: string | null = null;
    let latestExists = false;
    try { await lstat(latestPath); latestExists = true; }
    catch (error: any) { if (error?.code !== "ENOENT") throw error; }
    if (latestExists) {
        originalText = await readStableTextFile(guard, latestPath, guard.root, "Existing latest pointer");
        const current = parseLatestPointer(originalText);
        await validateCommittedArtifact(guard, artifactsRoot, current.currentIdentity);
        if (current.previousIdentity) await validateCommittedArtifact(guard, artifactsRoot, current.previousIdentity);
        previousIdentity = current.currentIdentity === identity
            ? current.previousIdentity
            : current.currentIdentity;
    }
    if (previousIdentity === identity) throw new Error("Latest pointer would create an identity cycle");
    const pointer = { schemaVersion: 1, contract: "dokkan-game-db-local-latest", contractVersion: "1.0.0", currentIdentity: identity, previousIdentity };
    const temporary = resolve(guard.root, `.latest-${process.pid}-${randomBytes(6).toString("hex")}.tmp`);
    throwIfCancelled(signal);
    await guard.assertParent(temporary, guard.root);
    try {
        await writeFile(temporary, canonicalJson(pointer), { flag: "wx" });
        await assertRegularRealFile(temporary, "Latest temporary");
        await guard.assertStable();
        throwIfCancelled(signal);
        await rename(temporary, latestPath);
        await guard.assertStable();
        const rollback = async () => {
            await guard.assertStable();
            if (originalText === null) await guard.removeRegularFile(latestPath, guard.root);
            else {
                const rollbackTemporary = resolve(guard.root, `.latest-rollback-${process.pid}-${randomBytes(6).toString("hex")}.tmp`);
                await writeFile(rollbackTemporary, originalText, { flag: "wx" });
                await assertRegularRealFile(rollbackTemporary, "Latest rollback temporary");
                await rename(rollbackTemporary, latestPath);
                await guard.assertStable();
            }
        };
        try { throwIfCancelled(signal); } catch (error) { await rollback(); throw error; }
        return { path: latestPath, rollback };
    } catch (error) {
        await guard.removeRegularFile(temporary, guard.root).catch(() => undefined);
        throw error;
    }
}

async function writeOperationalReceipt(guard: ArtifactStoreGuard, receipt: GameDbOperationalReceipt, signal?: AbortSignal): Promise<string> {
    const receiptsRoot = await guard.ensureDirectory(resolve(guard.root, "receipts"), "Artifact receipts directory");
    const occurredAt = "acquiredAt" in receipt ? receipt.acquiredAt : receipt.validatedAt;
    const timestamp = occurredAt.replace(/[^0-9A-Za-z]/g, "");
    const fileName = `${receipt.mode}-${timestamp}-${randomBytes(6).toString("hex")}.json`;
    const target = resolve(receiptsRoot, fileName);
    const temporary = resolve(receiptsRoot, `.${fileName}.${process.pid}.tmp`);
    if (signal) throwIfCancelled(signal);
    await guard.assertParent(temporary, receiptsRoot);
    try {
        await writeFile(temporary, canonicalJson(receipt), { flag: "wx" });
        await assertRegularRealFile(temporary, "Operational receipt temporary");
        await guard.assertStable();
        if (signal) throwIfCancelled(signal);
        await rename(temporary, target);
        await assertRegularRealFile(target, "Operational receipt");
        await guard.assertStable();
        if (signal) throwIfCancelled(signal);
        return target;
    } catch (error) {
        await guard.removeRegularFile(temporary, receiptsRoot).catch(() => undefined);
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
    const guard = await ArtifactStoreGuard.open(options.storeRoot);
    const lockPath = resolve(guard.root, ".acquisition.lock");
    let lock: { path: string, identity: DirectoryIdentity };
    try { lock = await guard.createExclusiveDirectory(lockPath, "Artifact store writer lock"); }
    catch { throw new Error("Database artifact acquisition already has an active writer or unsafe lock path"); }
    const controller = new AbortController();
    const onAbort = () => controller.abort();
    options.signal?.addEventListener("abort", onAbort, { once: true });
    if (options.signal?.aborted) controller.abort();
    const cancellationSignal = {
        get aborted() { return controller.signal.aborted || Boolean(options.signal?.aborted); },
    } as AbortSignal;
    const temporaryPath = resolve(guard.root, `.download-${process.pid}-${randomBytes(6).toString("hex")}.tmp`);
    let pending: { path: string, identity: DirectoryIdentity } | undefined;
    let latestCommit: { path: string, rollback: () => Promise<void> } | undefined;
    try {
        throwIfCancelled(cancellationSignal);
        await guard.assertStable();
        // The transport is the first external side effect and is never called
        // until descriptor, limits, root identity and cancellation validate.
        throwIfCancelled(cancellationSignal);
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
        const destroyBody = (error: Error) => {
            response.body.once("error", () => undefined);
            response.body.destroy(error);
        };
        const abortBody = () => destroyBody(new Error("Database artifact acquisition cancelled"));
        controller.signal.addEventListener("abort", abortBody, { once: true });
        const timer = setTimeout(() => { controller.abort(); destroyBody(new Error("Database artifact stream timed out")); }, timeoutMs);
        let inspection: GameDbArtifactInspection;
        await guard.assertParent(temporaryPath, guard.root);
        throwIfCancelled(cancellationSignal);
        try { inspection = await inspectStreamToFile({ body: response.body, temporaryPath, expectedSizeBytes, maxBytes, signal: controller.signal }); }
        finally { clearTimeout(timer); controller.signal.removeEventListener("abort", abortBody); }
        await guard.assertParent(temporaryPath, guard.root);
        await assertRegularRealFile(temporaryPath, "Downloaded artifact temporary");
        await guard.assertStable();
        throwIfCancelled(cancellationSignal);
        const metadata = metadataFor(descriptor, inspection);
        const identity = artifactIdentity(metadata);
        const artifactsRoot = await guard.ensureDirectory(resolve(guard.root, "artifacts"), "Artifact objects directory");
        const finalDirectory = resolve(artifactsRoot, identity);
        let reused = false;
        let finalExists = false;
        try { await lstat(finalDirectory); finalExists = true; }
        catch (error: any) { if (error?.code !== "ENOENT") throw error; }
        if (finalExists) {
            await validateCommittedArtifact(guard, artifactsRoot, identity, metadata);
            throwIfCancelled(cancellationSignal);
            await guard.removeRegularFile(temporaryPath, guard.root);
            reused = true;
        } else {
            pending = await guard.createExclusiveDirectory(resolve(artifactsRoot, `.pending-${process.pid}-${randomBytes(6).toString("hex")}`), "Pending artifact directory");
            const artifactPath = resolve(pending.path, "database.db");
            throwIfCancelled(cancellationSignal);
            await guard.assertParent(temporaryPath, guard.root);
            await guard.assertParent(artifactPath, pending.path);
            await rename(temporaryPath, artifactPath);
            await assertRegularRealFile(artifactPath, "Pending database artifact");
            await guard.assertStable();
            throwIfCancelled(cancellationSignal);
            const metadataText = canonicalJson(metadata);
            const metadataPath = resolve(pending.path, "metadata.json");
            throwIfCancelled(cancellationSignal);
            await guard.assertParent(metadataPath, pending.path);
            await writeFile(metadataPath, metadataText, { flag: "wx" });
            await assertRegularRealFile(metadataPath, "Pending artifact metadata");
            await guard.assertStable();
            throwIfCancelled(cancellationSignal);
            const marker = { schemaVersion: 1, contract: "dokkan-game-db-artifact-commit", contractVersion: "1.0.0", identity, metadataSha256: createHash("sha256").update(metadataText).digest("hex") };
            const markerPath = resolve(pending.path, "commit-marker.json");
            throwIfCancelled(cancellationSignal);
            await guard.assertParent(markerPath, pending.path);
            await writeFile(markerPath, canonicalJson(marker), { flag: "wx" });
            await assertRegularRealFile(markerPath, "Pending artifact commit marker");
            await guard.assertStable();
            throwIfCancelled(cancellationSignal);
            await guard.promoteDirectory(pending.path, finalDirectory);
            pending = undefined;
            throwIfCancelled(cancellationSignal);
        }
        await validateCommittedArtifact(guard, artifactsRoot, identity, metadata);
        throwIfCancelled(cancellationSignal);
        const receipt: GameDbOperationalReceipt = {
            ...receiptBase(descriptor, metadata, identity),
            mode: "official_descriptor_download",
            acquiredAt: operationTimestamp(options.now),
            result: reused ? "reused" : "acquired",
        };
        throwIfCancelled(cancellationSignal);
        const receiptPath = await writeOperationalReceipt(guard, receipt, cancellationSignal);
        throwIfCancelled(cancellationSignal);
        latestCommit = await promoteLatest(guard, artifactsRoot, identity, cancellationSignal);
        throwIfCancelled(cancellationSignal);
        return {
            identity,
            artifactPath: resolve(finalDirectory, "database.db"),
            metadataPath: resolve(finalDirectory, "metadata.json"),
            commitMarkerPath: resolve(finalDirectory, "commit-marker.json"),
            latestPointerPath: latestCommit.path,
            metadata,
            reused,
            receiptPath,
            receipt,
        };
    } catch (error) {
        controller.abort();
        if (latestCommit) await latestCommit.rollback().catch(() => undefined);
        await guard.removeRegularFile(temporaryPath, guard.root).catch(() => undefined);
        if (pending) await guard.removeDirectory(pending.path, pending.identity, ["database.db", "metadata.json", "commit-marker.json"]).catch(() => undefined);
        throw error;
    } finally {
        options.signal?.removeEventListener("abort", onAbort);
        await guard.removeDirectory(lock.path, lock.identity, []);
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
        const guard = await ArtifactStoreGuard.open(options.storeRoot);
        const lockPath = resolve(guard.root, ".acquisition.lock");
        let lock: { path: string, identity: DirectoryIdentity };
        try { lock = await guard.createExclusiveDirectory(lockPath, "Artifact store writer lock"); }
        catch { throw new Error("Database artifact acquisition already has an active writer or unsafe lock path"); }
        const receipt: GameDbOperationalReceipt = {
            ...receiptBase(descriptor, metadata, identity),
            mode: "offline_existing_artifact_validation",
            validatedAt: operationTimestamp(dependencies.now),
            result: "validated",
        };
        try {
            const receiptPath = await writeOperationalReceipt(guard, receipt);
            return { mode: "artifact_validation", descriptor: sanitized, inspection, identity, receiptPath, receipt };
        } finally { await guard.removeDirectory(lock.path, lock.identity, []); }
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
