import { createHash, randomBytes } from "crypto";
import { FileHandle, lstat, mkdir, open, readdir, realpath, rename, rm, rmdir } from "fs/promises";
import { request } from "https";
import { basename, dirname, isAbsolute, relative, resolve, sep } from "path";
import { Readable } from "stream";

const OFFICIAL_CDN_HOST = "cf.ishin-global.aktsk.com";
const LOGICAL_FILE_PATH = "sqlite/current/en/database.db";
const SQLITE_HEADER = Buffer.from("SQLite format 3\u0000", "utf8");
const DEFAULT_STORE_ROOT = resolve(process.cwd(), "game-db", "data", "game-db-acquisition", "database-artifacts");
export const DEFAULT_DATABASE_ARTIFACT_MAX_BYTES = 128 * 1024 * 1024;
export const DEFAULT_DATABASE_ARTIFACT_TIMEOUT_MS = 120_000;
const LOCAL_ARTIFACT_HISTORY_MAX_BYTES = 256 * 1024 * 1024;

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

export async function readAndValidateDatabaseDescriptor(filePath: string): Promise<ValidatedDatabaseDescriptor> {
    const text = await readStableOpenFile(undefined, filePath, undefined, "Descriptor input", handle => handle.readFile("utf8"));
    let parsed: unknown;
    try { parsed = JSON.parse(text); }
    catch { throw new Error("Database descriptor JSON is malformed"); }
    return validateClientAssetsDatabaseDescriptor(parsed);
}

export type ValidateAcquiredDatabaseArtifactOptions =
    | { storeRoot: string, artifactIdentity: string }
    | { storeRoot: string, useLatest: true };

export interface ValidatedAcquiredDatabaseArtifact {
    identity: string,
    artifactDirectory: string,
    artifactPath: string,
    metadataPath: string,
    commitMarkerPath: string,
    metadata: GameDbAcquiredArtifactMetadata,
    resolvedFromLatest: boolean,
}

interface DirectoryIdentity { path: string, realPath: string, dev: string, ino: string, mode: number }
interface FileIdentity { path: string, dev: string, ino: string, nlink: string, size: string, mode: number, birthtimeNs: string, mtimeNs: string, ctimeNs: string }

const ARTIFACT_MEMBER_NAMES = ["database.db", "metadata.json", "commit-marker.json"] as const;
type ArtifactMemberName = typeof ARTIFACT_MEMBER_NAMES[number];

interface ArtifactMemberSnapshot {
    readonly relativePath: ArtifactMemberName,
    readonly sourcePath: string,
    readonly realPath: string,
    readonly identity: FileIdentity,
    readonly sha256: string,
    readonly handle: FileHandle,
}

interface ArtifactMaterialSnapshot {
    readonly directory: DirectoryIdentity,
    readonly metadata: GameDbAcquiredArtifactMetadata,
    readonly members: ReadonlyMap<ArtifactMemberName, ArtifactMemberSnapshot>,
}

class ArtifactDestinationOccupiedError extends Error {
    constructor() { super("Artifact destination was introduced before create-only promotion"); }
}

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
    return { path: resolved, realPath: resolve(canonical), dev: BigInt(metadata.dev).toString(), ino: BigInt(metadata.ino).toString(), mode: Number(metadata.mode) };
}

async function sameDirectoryIdentity(expected: DirectoryIdentity): Promise<boolean> {
    try {
        const actual = await captureDirectoryIdentity(expected.path, "Controlled directory");
        return samePath(actual.realPath, expected.realPath) && actual.dev === expected.dev && actual.ino === expected.ino && actual.mode === expected.mode;
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

function fileIdentityFromStats(path: string, metadata: any): FileIdentity {
    if (!metadata.isFile()) throw new Error("not a regular file");
    return {
        path: resolve(path),
        dev: BigInt(metadata.dev).toString(),
        ino: BigInt(metadata.ino).toString(),
        nlink: BigInt(metadata.nlink).toString(),
        size: BigInt(metadata.size).toString(),
        mode: Number(metadata.mode),
        birthtimeNs: BigInt(metadata.birthtimeNs).toString(),
        mtimeNs: BigInt(metadata.mtimeNs).toString(),
        ctimeNs: BigInt(metadata.ctimeNs).toString(),
    };
}

function sameFileIdentity(left: FileIdentity, right: FileIdentity, includeMutableAttributes = true): boolean {
    return left.dev === right.dev && left.ino === right.ino && left.nlink === right.nlink && left.mode === right.mode
        && (!includeMutableAttributes || (left.size === right.size && left.birthtimeNs === right.birthtimeNs && left.mtimeNs === right.mtimeNs && left.ctimeNs === right.ctimeNs));
}

function assertSingleLink(identity: FileIdentity, label: string): void {
    if (identity.nlink !== "1") throw new Error(`${label} must have exactly one hard link`);
}

function assertReadOnlyMode(identity: FileIdentity, label: string): void {
    if ((identity.mode & 0o222) !== 0) throw new Error(`${label} must be read-only`);
}

async function syncDirectoryIfSupported(directory: string): Promise<void> {
    let handle: FileHandle | undefined;
    try {
        handle = await open(directory, "r");
        await handle.sync();
    } catch (error: any) {
        if (!["EINVAL", "ENOTSUP", "EISDIR", "EBADF", "EPERM", "EACCES"].includes(error?.code)) throw error;
    } finally { await handle?.close().catch(() => undefined); }
}

async function captureHandleFileIdentity(handle: FileHandle, path: string, label: string): Promise<FileIdentity> {
    try { return fileIdentityFromStats(path, await handle.stat({ bigint: true })); }
    catch { throw new Error(`${label} must be a regular real file`); }
}

async function capturePathFileIdentity(path: string, label: string): Promise<FileIdentity> {
    const target = resolve(path);
    try {
        const metadata: any = await lstat(target, { bigint: true });
        const canonical = await realpath(target);
        if (metadata.isSymbolicLink() || !samePath(canonical, target)) throw new Error("rejected");
        return fileIdentityFromStats(target, metadata);
    } catch {
        throw new Error(`${label} pathname no longer points to the validated regular-file identity`);
    }
}

async function assertPathMatchesFileIdentity(path: string, expected: FileIdentity, label: string): Promise<void> {
    const target = resolve(path);
    const actual = await capturePathFileIdentity(target, label);
    if (!samePath(target, expected.path) || !sameFileIdentity(actual, expected)) throw new Error(`${label} pathname no longer points to the validated regular-file identity`);
}

async function readStableOpenFile<T>(guard: ArtifactStoreGuard | undefined, filePath: string, parent: string | undefined, label: string, reader: (handle: FileHandle, identity: FileIdentity) => Promise<T>, signal?: AbortSignal): Promise<T> {
    const target = guard && parent ? await guard.assertParent(filePath, parent) : resolve(filePath);
    let handle: FileHandle;
    try { handle = await open(target, "r"); }
    catch { throw new Error(`${label} must be a regular real file, not a symlink or junction`); }
    try {
        const before = await captureHandleFileIdentity(handle, target, label);
        await assertPathMatchesFileIdentity(target, before, label);
        if (signal) throwIfCancelled(signal);
        await assertPathMatchesFileIdentity(target, before, label);
        const value = await reader(handle, before);
        const after = await captureHandleFileIdentity(handle, target, label);
        if (!sameFileIdentity(before, after)) throw new Error(`${label} changed during validation`);
        await assertPathMatchesFileIdentity(target, after, label);
        if (guard) {
            guard.trackRegularFile(target, after);
            await guard.assertStable();
        }
        return value;
    } finally { await handle.close(); }
}

async function writeHandleFully(handle: FileHandle, bytes: Buffer): Promise<void> {
    let offset = 0;
    while (offset < bytes.byteLength) {
        const { bytesWritten } = await handle.write(bytes, offset, bytes.byteLength - offset, null);
        if (bytesWritten <= 0) throw new Error("Artifact store file write made no progress");
        offset += bytesWritten;
    }
}

async function copyHandleFully(source: FileHandle, destination: FileHandle, size: number, hash?: ReturnType<typeof createHash>): Promise<void> {
    if (!Number.isSafeInteger(size) || size < 0) throw new Error("Artifact store copy size is invalid");
    const buffer = Buffer.allocUnsafe(64 * 1024);
    let offset = 0;
    while (offset < size) {
        const { bytesRead } = await source.read(buffer, 0, Math.min(buffer.byteLength, size - offset), offset);
        if (bytesRead <= 0) throw new Error("Artifact store source changed or copy made no progress");
        const chunk = buffer.subarray(0, bytesRead);
        hash?.update(chunk);
        let written = 0;
        while (written < bytesRead) {
            const result = await destination.write(chunk, written, bytesRead - written, offset + written);
            if (result.bytesWritten <= 0) throw new Error("Artifact store destination copy made no progress");
            written += result.bytesWritten;
        }
        offset += bytesRead;
    }
}

async function writeExclusiveStableFile(guard: ArtifactStoreGuard, filePath: string, parent: string, contents: string | Buffer, label: string): Promise<FileIdentity> {
    const target = await guard.assertParent(filePath, parent);
    let handle: FileHandle;
    try { handle = await open(target, "wx"); }
    catch (error) { throw error; }
    let identity: FileIdentity | undefined;
    try {
        identity = await captureHandleFileIdentity(handle, target, label);
        await assertPathMatchesFileIdentity(target, identity, label);
        guard.trackRegularFile(target, identity);
        await guard.assertStable();
        await writeHandleFully(handle, Buffer.isBuffer(contents) ? contents : Buffer.from(contents, "utf8"));
        await handle.sync();
        const written = await captureHandleFileIdentity(handle, target, label);
        if (!sameFileIdentity(identity, written, false)) throw new Error(`${label} identity changed during creation`);
        await assertPathMatchesFileIdentity(target, written, label);
        guard.trackRegularFile(target, written);
        await guard.assertStable();
        return written;
    } finally { await handle.close(); }
}

class ArtifactStoreGuard {
    private readonly directories = new Map<string, DirectoryIdentity>();
    private readonly files = new Map<string, FileIdentity>();

    private constructor(readonly root: string) {}

    static async open(storeRoot: string, signal?: AbortSignal): Promise<ArtifactStoreGuard> {
        const resolved = resolve(storeRoot);
        if (!isAbsolute(resolved) || resolved.includes("\0")) throw new Error("Artifact store root is invalid");
        const chain = directoryChain(resolved);
        const guard = new ArtifactStoreGuard(resolved);
        let existing = chain.length - 1;
        while (existing >= 0) {
            try { await lstat(chain[existing]); break; }
            catch (error: any) { if (error?.code !== "ENOENT") throw error; existing -= 1; }
        }
        if (existing < 0) throw new Error("Artifact store root has no existing filesystem ancestor");
        for (let index = 0; index <= existing; index += 1) {
            const path = chain[index];
            guard.directories.set(path, await captureDirectoryIdentity(path, "Artifact store parent"));
        }
        const created: DirectoryIdentity[] = [];
        try {
            await guard.assertStable();
            for (let index = existing + 1; index < chain.length; index += 1) {
                const path = chain[index];
                await guard.assertStable();
                if (signal) throwIfCancelled(signal);
                await guard.assertStable();
                await mkdir(path);
                const identity = await captureDirectoryIdentity(path, path === resolved ? "Artifact store root" : "Artifact store parent");
                guard.directories.set(path, identity);
                created.push(identity);
                await guard.assertStable();
            }
            await guard.assertStable();
            return guard;
        } catch (error) {
            for (const identity of created.reverse()) {
                await guard.removeDirectory(identity.path, identity, []).catch(() => undefined);
            }
            throw error;
        }
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

    async promoteArtifactDirectoryCreateOnly(snapshot: ArtifactMaterialSnapshot, to: string, signal: AbortSignal): Promise<void> {
        await this.assertStable();
        const source = this.ensureContained(snapshot.directory.path), target = this.ensureContained(to);
        const trackedSource = this.directories.get(source);
        if (!trackedSource || trackedSource.dev !== snapshot.directory.dev || trackedSource.ino !== snapshot.directory.ino
            || !await sameDirectoryIdentity(snapshot.directory)) throw new Error("Pending artifact directory identity changed");

        // Node has no portable rename-no-replace for directories. Reserve the
        // final content-addressed name with exclusive mkdir, then copy each
        // already-open member into an exclusive file, marker last. No final
        // member shares an inode with mutable pending state.
        throwIfCancelled(signal);
        let reservation: { path: string, identity: DirectoryIdentity };
        try { reservation = await this.createExclusiveDirectory(target, "Reserved committed artifact directory"); }
        catch (error: any) {
            if (error?.code === "EEXIST") throw new ArtifactDestinationOccupiedError();
            throw error;
        }

        try {
            for (const name of ARTIFACT_MEMBER_NAMES) {
                const member = snapshot.members.get(name);
                if (!member) throw new Error(`Pending artifact snapshot is missing ${name}`);
                await assertPathMatchesFileIdentity(member.sourcePath, member.identity, `Pending artifact ${name}`);
                const beforeCopy = await captureHandleFileIdentity(member.handle, member.sourcePath, `Pending artifact ${name}`);
                if (!sameFileIdentity(member.identity, beforeCopy)) throw new Error(`Pending artifact ${name} changed before promotion`);
                throwIfCancelled(signal);
                const installedPath = resolve(reservation.path, name);
                await this.assertParent(installedPath, reservation.path);
                const installedHandle = await open(installedPath, "wx", 0o600);
                try {
                    const created = await captureHandleFileIdentity(installedHandle, installedPath, `Committed artifact ${name}`);
                    assertSingleLink(created, `Committed artifact ${name}`);
                    await assertPathMatchesFileIdentity(installedPath, created, `Committed artifact ${name}`);
                    const hash = createHash("sha256");
                    await copyHandleFully(member.handle, installedHandle, Number(member.identity.size), hash);
                    await installedHandle.sync();
                    if (hash.digest("hex") !== member.sha256) throw new Error(`Pending artifact ${name} changed during copy`);
                    const sourceAfter = await captureHandleFileIdentity(member.handle, member.sourcePath, `Pending artifact ${name} after copy`);
                    if (!sameFileIdentity(member.identity, sourceAfter)) throw new Error(`Pending artifact ${name} changed during copy`);
                    await assertPathMatchesFileIdentity(member.sourcePath, sourceAfter, `Pending artifact ${name} after copy`);
                    const copied = await captureHandleFileIdentity(installedHandle, installedPath, `Committed artifact ${name}`);
                    if (!sameFileIdentity(created, copied, false) || copied.size !== member.identity.size) throw new Error(`Committed artifact ${name} identity or size changed during copy`);
                    assertSingleLink(copied, `Committed artifact ${name}`);
                    await installedHandle.chmod(0o444);
                    await installedHandle.sync();
                    const readOnly = await captureHandleFileIdentity(installedHandle, installedPath, `Committed artifact ${name}`);
                    assertSingleLink(readOnly, `Committed artifact ${name}`);
                    assertReadOnlyMode(readOnly, `Committed artifact ${name}`);
                    await assertPathMatchesFileIdentity(installedPath, readOnly, `Committed artifact ${name}`);
                    if (readOnly.dev === sourceAfter.dev && readOnly.ino === sourceAfter.ino) throw new Error(`Committed artifact ${name} shares the pending inode`);
                    this.files.set(installedPath, readOnly);
                } finally {
                    await installedHandle.close();
                }
            }

            await assertExactArtifactDirectoryMembers(reservation.path, "Reserved committed artifact directory");
            await syncDirectoryIfSupported(reservation.path);
            await syncDirectoryIfSupported(dirname(reservation.path));
            await assertPromotedArtifactSnapshot(this, reservation.path, reservation.identity, snapshot, signal);
            for (const name of ARTIFACT_MEMBER_NAMES) {
                const member = snapshot.members.get(name)!;
                await this.removeRegularFile(member.sourcePath, source);
            }
            await this.removeDirectory(source, snapshot.directory, []);
            await syncDirectoryIfSupported(dirname(reservation.path));
        } catch (error) {
            try { await this.quarantineControlledDirectory(reservation.path, reservation.identity, "Failed committed artifact quarantine"); }
            catch (recoveryError) {
                throw new AggregateError([error, recoveryError], "Artifact promotion failed and its reserved destination could not be safely quarantined");
            }
            throw error;
        }
    }

    static async openExisting(storeRoot: string): Promise<ArtifactStoreGuard> {
        const resolved = resolve(storeRoot);
        if (!isAbsolute(resolved) || resolved.includes("\0")) throw new Error("Artifact store root is invalid");
        const guard = new ArtifactStoreGuard(resolved);
        for (const path of directoryChain(resolved)) {
            guard.directories.set(path, await captureDirectoryIdentity(path, path === resolved ? "Artifact store root" : "Artifact store parent"));
        }
        await guard.assertStable();
        return guard;
    }

    private async quarantineControlledDirectory(path: string, identity: DirectoryIdentity, label: string): Promise<void> {
        await this.assertStable();
        const target = this.ensureContained(path);
        if (!samePath(target, identity.path) || !await sameDirectoryIdentity(identity)) throw new Error("Refusing to quarantine a replaced artifact directory");
        const container = await this.createExclusiveDirectory(resolve(dirname(target), `.quarantine-${process.pid}-${randomBytes(12).toString("hex")}`), label);
        const quarantinedPath = resolve(container.path, "artifact");
        await this.assertParent(quarantinedPath, container.path);
        if (!await sameDirectoryIdentity(identity)) throw new Error("Refusing to quarantine a replaced artifact directory");
        await rename(target, quarantinedPath);
        this.directories.delete(target);
        const moved = await captureDirectoryIdentity(quarantinedPath, label);
        if (moved.dev !== identity.dev || moved.ino !== identity.ino) throw new Error("Quarantine moved a replacement artifact directory");
        this.directories.set(quarantinedPath, moved);
        await this.assertStable();
    }

    async assertParent(path: string, parent: string): Promise<string> {
        await this.assertStable();
        const target = this.ensureContained(path);
        const expectedParent = resolve(parent);
        if (!samePath(dirname(target), expectedParent) || !this.directories.has(expectedParent)) throw new Error("Artifact store parent is not controlled");
        return target;
    }

    trackRegularFile(path: string, identity: FileIdentity): void {
        const target = this.ensureContained(path);
        if (!samePath(target, identity.path)) throw new Error("Artifact store file identity path is invalid");
        this.files.set(target, identity);
    }

    trackedRegularFile(path: string): FileIdentity | undefined {
        return this.files.get(resolve(path));
    }

    private async retainedHistoryBytes(): Promise<number> {
        await this.assertStable();
        let total = 0;
        for (const entry of await readdir(this.root, { withFileTypes: true })) {
            if (!entry.name.startsWith(".file-history-") && !entry.name.startsWith(".latest-history-")) continue;
            if (!entry.isDirectory() || entry.isSymbolicLink()) throw new Error("Artifact store retained history must be a real directory");
            const directory = resolve(this.root, entry.name);
            const identity = await captureDirectoryIdentity(directory, "Artifact store retained history");
            this.directories.set(directory, identity);
            const members = await readdir(directory, { withFileTypes: true });
            if (members.length !== 1 || members[0].name !== "latest.json" || !members[0].isFile() || members[0].isSymbolicLink()) throw new Error("Artifact store retained history has unexpected content");
            const member = resolve(directory, "latest.json");
            const fileIdentity = await capturePathFileIdentity(member, "Artifact store retained history file");
            this.files.set(member, fileIdentity);
            const size = Number(fileIdentity.size);
            if (!Number.isSafeInteger(size) || size < 0 || total > LOCAL_ARTIFACT_HISTORY_MAX_BYTES - size) throw new Error("Artifact store retained history exceeds the local storage budget");
            total += size;
        }
        await this.assertStable();
        return total;
    }

    async assertHistoryBudget(reservedBytes: number): Promise<void> {
        if (!Number.isSafeInteger(reservedBytes) || reservedBytes < 0 || reservedBytes > LOCAL_ARTIFACT_HISTORY_MAX_BYTES) throw new Error("Artifact store history reservation is invalid");
        const retained = await this.retainedHistoryBytes();
        if (retained > LOCAL_ARTIFACT_HISTORY_MAX_BYTES - reservedBytes) throw new Error("Artifact store retained history would exceed the 256 MiB local storage budget");
    }

    async copyTrackedRegularFileCreateOnly(from: string, fromParent: string, to: string, toParent: string, signal?: AbortSignal): Promise<FileIdentity> {
        const source = await this.assertParent(from, fromParent);
        const target = await this.assertParent(to, toParent);
        const identity = this.files.get(source);
        if (!identity) throw new Error("Artifact store source file identity is not controlled");
        await assertPathMatchesFileIdentity(source, identity, "Artifact store source file");
        if (signal) throwIfCancelled(signal);
        await assertPathMatchesFileIdentity(source, identity, "Artifact store source file");
        await this.assertStable();
        let sourceHandle: FileHandle | undefined;
        let destinationHandle: FileHandle | undefined;
        try {
            sourceHandle = await open(source, "r");
            destinationHandle = await open(target, "wx", identity.mode & 0o777);
            const openedSource = await captureHandleFileIdentity(sourceHandle, source, "Artifact store source file");
            if (!sameFileIdentity(identity, openedSource)) throw new Error("Artifact store source file changed before create-only copy");
            const created = await captureHandleFileIdentity(destinationHandle, target, "Installed artifact store file");
            assertSingleLink(created, "Installed artifact store file");
            await copyHandleFully(sourceHandle, destinationHandle, Number(identity.size));
            await destinationHandle.sync();
            const sourceAfter = await captureHandleFileIdentity(sourceHandle, source, "Artifact store source file after copy");
            const installed = await captureHandleFileIdentity(destinationHandle, target, "Installed artifact store file");
            if (!sameFileIdentity(identity, sourceAfter) || !sameFileIdentity(created, installed, false) || installed.size !== identity.size) {
                throw new Error("Installed artifact store file identity changed during create-only copy");
            }
            assertSingleLink(installed, "Installed artifact store file");
            await assertPathMatchesFileIdentity(source, sourceAfter, "Artifact store source file after copy");
            await assertPathMatchesFileIdentity(target, installed, "Installed artifact store file");
            if (installed.dev === sourceAfter.dev && installed.ino === sourceAfter.ino) throw new Error("Installed artifact store file unexpectedly shares the source inode");
            this.files.set(target, installed);
        } finally {
            await Promise.all([sourceHandle?.close(), destinationHandle?.close()]);
        }
        await this.assertStable();
        return this.files.get(target)!;
    }

    async moveTrackedRegularFileToHistory(from: string, fromParent: string, historyLabel: string, signal?: AbortSignal, enforceCancellation = true, historyPrefix = ".file-history"): Promise<{ path: string, identity: FileIdentity }> {
        const source = await this.assertParent(from, fromParent);
        const expected = this.files.get(source);
        if (!expected) throw new Error("Artifact store source file identity is not controlled");
        if (historyPrefix !== ".discard") await this.assertHistoryBudget(Number(expected.size));
        const history = await this.createExclusiveDirectory(resolve(this.root, `${historyPrefix}-${process.pid}-${randomBytes(12).toString("hex")}`), historyLabel);
        const target = resolve(history.path, "latest.json");
        await this.assertParent(target, history.path);
        // This read is also the deterministic concurrency boundary used by the
        // productive AbortSignal.  Rollback observes it without allowing an
        // already-aborted signal to suppress recovery.
        if (signal) {
            if (enforceCancellation) throwIfCancelled(signal);
            else void signal.aborted;
        }
        await this.assertStable();
        // Rename moves whichever pathname identity exists at the atomic call;
        // it never deletes that identity.  The exclusive history directory
        // makes the target a controlled, previously unreachable pathname.
        await rename(source, target);
        const moved = await capturePathFileIdentity(target, historyLabel);
        this.files.delete(source);
        this.files.set(target, moved);
        if (!sameFileIdentity(expected, moved, false)) {
            throw new Error(`${historyLabel} moved a replacement identity; the moved file was retained for recovery`);
        }
        await this.assertStable();
        return { path: target, identity: moved };
    }

    async installTrackedRegularFileAtomic(from: string, fromParent: string, to: string, toParent: string, label: string, signal?: AbortSignal): Promise<FileIdentity> {
        const source = await this.assertParent(from, fromParent);
        const target = await this.assertParent(to, toParent);
        const expected = this.files.get(source);
        if (!expected) throw new Error(`${label} source identity is not controlled`);
        await assertPathMatchesFileIdentity(source, expected, `${label} source`);
        try { await lstat(target); throw new Error(`${label} target was replaced before atomic installation`); }
        catch (error: any) { if (error?.code !== "ENOENT") throw error; }
        if (signal) throwIfCancelled(signal);
        await assertPathMatchesFileIdentity(source, expected, `${label} source`);
        try { await lstat(target); throw new Error(`${label} target was replaced before atomic installation`); }
        catch (error: any) { if (error?.code !== "ENOENT") throw error; }
        await rename(source, target);
        const installed = await capturePathFileIdentity(target, label);
        this.files.delete(source);
        this.files.set(target, installed);
        if (!sameFileIdentity(expected, installed, false)) throw new Error(`${label} atomic installation moved a replacement identity`);
        await syncDirectoryIfSupported(toParent);
        await this.assertStable();
        return installed;
    }

    async discardTrackedRegularFile(from: string, fromParent: string, label: string, signal?: AbortSignal): Promise<void> {
        const moved = await this.moveTrackedRegularFileToHistory(from, fromParent, label, signal, true, ".discard");
        const directory = dirname(moved.path);
        const directoryIdentity = this.directories.get(directory);
        if (!directoryIdentity) throw new Error("Artifact store discard directory identity is unavailable");
        await this.removeDirectory(directory, directoryIdentity, ["latest.json"]);
    }

    async removeRegularFile(path: string, parent: string, signal?: AbortSignal): Promise<void> {
        const target = await this.assertParent(path, parent);
        const identity = this.files.get(target);
        if (!identity) return;
        await assertPathMatchesFileIdentity(target, identity, "Temporary artifact store file");
        if (signal) throwIfCancelled(signal);
        await assertPathMatchesFileIdentity(target, identity, "Temporary artifact store file");
        await rm(target, { force: true });
        this.files.delete(target);
        await this.assertStable();
    }

    async removeDirectory(path: string, identity: DirectoryIdentity, allowedFiles: string[]): Promise<void> {
        await this.assertStable();
        const target = this.ensureContained(path);
        if (!samePath(target, identity.path) || !await sameDirectoryIdentity(identity)) throw new Error("Refusing to clean a replaced controlled directory");
        const entries = await readdir(target, { withFileTypes: true });
        for (const entry of entries) {
            if (!allowedFiles.includes(entry.name) || !entry.isFile() || entry.isSymbolicLink()) throw new Error("Refusing to clean unexpected pending-directory content");
            const member = resolve(target, entry.name);
            const identity = this.files.get(member);
            if (!identity) throw new Error("Refusing to clean an untracked pending-directory member");
            await assertPathMatchesFileIdentity(member, identity, "Pending artifact member");
        }
        for (const entry of entries) await this.removeRegularFile(resolve(target, entry.name), target);
        if (!await sameDirectoryIdentity(identity)) throw new Error("Refusing to clean a replaced controlled directory");
        this.directories.delete(target);
        await rmdir(target);
        await this.assertStable();
    }
}

async function assertExactArtifactDirectoryMembers(directory: string, label: string): Promise<void> {
    let entries;
    try { entries = await readdir(directory, { withFileTypes: true }); }
    catch { throw new Error(`${label} members could not be enumerated`); }
    const names = entries.map(entry => entry.name).sort();
    const expected = [...ARTIFACT_MEMBER_NAMES].sort();
    if (JSON.stringify(names) !== JSON.stringify(expected)
        || entries.some(entry => !entry.isFile() || entry.isSymbolicLink())) {
        throw new Error(`${label} members are incomplete, unexpected or not regular files`);
    }
}

async function digestOpenArtifactMember(handle: FileHandle, identity: FileIdentity, retainText: boolean): Promise<{ sha256: string, prefix: Buffer, text?: string }> {
    const size = Number(identity.size);
    if (!Number.isSafeInteger(size) || size <= 0 || size > DEFAULT_DATABASE_ARTIFACT_MAX_BYTES) throw new Error("Artifact member size is outside the allowed range");
    if (retainText && size > 1024 * 1024) throw new Error("Artifact JSON member exceeds the allowed size");
    const hash = createHash("sha256");
    const prefix = Buffer.alloc(Math.min(SQLITE_HEADER.byteLength, size));
    const retained: Buffer[] = [];
    const buffer = Buffer.allocUnsafe(64 * 1024);
    let offset = 0;
    while (offset < size) {
        const { bytesRead } = await handle.read(buffer, 0, Math.min(buffer.byteLength, size - offset), offset);
        if (bytesRead <= 0) break;
        const chunk = buffer.subarray(0, bytesRead);
        hash.update(chunk);
        if (offset < prefix.byteLength) chunk.copy(prefix, offset, 0, Math.min(bytesRead, prefix.byteLength - offset));
        if (retainText) retained.push(Buffer.from(chunk));
        offset += bytesRead;
    }
    if (offset !== size) throw new Error("Artifact member changed while hashing");
    return { sha256: hash.digest("hex"), prefix, ...(retainText ? { text: Buffer.concat(retained).toString("utf8") } : {}) };
}

async function openArtifactMaterialSnapshot(guard: ArtifactStoreGuard, pending: { path: string, identity: DirectoryIdentity }, identity: string, expectedMetadata: GameDbAcquiredArtifactMetadata, signal: AbortSignal): Promise<ArtifactMaterialSnapshot> {
    await guard.assertStable();
    if (!await sameDirectoryIdentity(pending.identity)) throw new Error("Pending artifact directory identity changed before material snapshot");
    await assertExactArtifactDirectoryMembers(pending.path, "Pending artifact directory");
    const members = new Map<ArtifactMemberName, ArtifactMemberSnapshot>();
    const values = new Map<ArtifactMemberName, { sha256: string, prefix: Buffer, text?: string }>();
    try {
        for (const name of ARTIFACT_MEMBER_NAMES) {
            throwIfCancelled(signal);
            const path = await guard.assertParent(resolve(pending.path, name), pending.path);
            const pathIdentity = await capturePathFileIdentity(path, `Pending artifact ${name}`);
            let handle: FileHandle;
            try { handle = await open(path, "r"); }
            catch { throw new Error(`Pending artifact ${name} must be a regular real file`); }
            try {
                const opened = await captureHandleFileIdentity(handle, path, `Pending artifact ${name}`);
                assertSingleLink(opened, `Pending artifact ${name}`);
                if (!sameFileIdentity(pathIdentity, opened)) throw new Error(`Pending artifact ${name} pathname does not match its opened identity`);
                await assertPathMatchesFileIdentity(path, opened, `Pending artifact ${name}`);
                const canonical = resolve(await realpath(path));
                if (!samePath(canonical, path) || !samePath(dirname(canonical), pending.path)) throw new Error(`Pending artifact ${name} escaped containment`);
                const value = await digestOpenArtifactMember(handle, opened, name !== "database.db");
                const after = await captureHandleFileIdentity(handle, path, `Pending artifact ${name}`);
                if (!sameFileIdentity(opened, after)) throw new Error(`Pending artifact ${name} changed during material snapshot`);
                await assertPathMatchesFileIdentity(path, after, `Pending artifact ${name}`);
                guard.trackRegularFile(path, after);
                members.set(name, { relativePath: name, sourcePath: path, realPath: canonical, identity: after, sha256: value.sha256, handle });
                values.set(name, value);
            } catch (error) {
                await handle.close();
                throw error;
            }
        }
        await assertExactArtifactDirectoryMembers(pending.path, "Pending artifact directory");
        if (!await sameDirectoryIdentity(pending.identity)) throw new Error("Pending artifact directory identity changed during material snapshot");
        await guard.assertStable();

        const metadataText = values.get("metadata.json")?.text;
        const markerText = values.get("commit-marker.json")?.text;
        if (metadataText === undefined || markerText === undefined) throw new Error("Pending artifact JSON members were not retained");
        let metadataValue: unknown;
        try { metadataValue = JSON.parse(metadataText); } catch { throw new Error("Pending artifact metadata JSON is malformed"); }
        const metadata = parseCommittedMetadata(metadataValue);
        if (metadataText !== canonicalJson(metadata) || canonicalJson(metadata) !== canonicalJson(expectedMetadata) || artifactIdentity(metadata) !== identity) {
            throw new Error("Pending artifact metadata does not match its content identity");
        }
        const database = values.get("database.db")!;
        const databaseState = database.prefix.equals(SQLITE_HEADER) ? "readable_sqlite" : "encrypted_or_packaged";
        if (Number(members.get("database.db")!.identity.size) !== metadata.observedSizeBytes
            || database.sha256 !== metadata.localSha256 || databaseState !== metadata.artifactState) {
            throw new Error("Pending database member does not match committed metadata");
        }
        const expectedMarker = canonicalJson({ schemaVersion: 1, contract: "dokkan-game-db-artifact-commit", contractVersion: "1.0.0", identity, metadataSha256: values.get("metadata.json")!.sha256 });
        if (markerText !== expectedMarker) throw new Error("Pending artifact commit marker does not validate");
        return { directory: pending.identity, metadata, members };
    } catch (error) {
        await Promise.all([...members.values()].map(member => member.handle.close().catch(() => undefined)));
        throw error;
    }
}

async function assertPromotedArtifactSnapshot(guard: ArtifactStoreGuard, directory: string, directoryIdentity: DirectoryIdentity, snapshot: ArtifactMaterialSnapshot, signal: AbortSignal): Promise<void> {
    if (!await sameDirectoryIdentity(directoryIdentity)) throw new Error("Reserved committed artifact directory identity changed after promotion");
    await assertExactArtifactDirectoryMembers(directory, "Committed artifact directory");
    for (const name of ARTIFACT_MEMBER_NAMES) {
        throwIfCancelled(signal);
        const member = snapshot.members.get(name)!;
        const target = await guard.assertParent(resolve(directory, member.relativePath), directory);
        const sourceBefore = await captureHandleFileIdentity(member.handle, member.sourcePath, `Pending artifact ${name}`);
        if (!sameFileIdentity(member.identity, sourceBefore)) throw new Error(`Pending artifact ${name} changed after copy`);
        await assertPathMatchesFileIdentity(member.sourcePath, sourceBefore, `Pending artifact ${name}`);
        const sourceValue = await digestOpenArtifactMember(member.handle, sourceBefore, false);
        const sourceAfter = await captureHandleFileIdentity(member.handle, member.sourcePath, `Pending artifact ${name}`);
        if (sourceValue.sha256 !== member.sha256 || !sameFileIdentity(sourceBefore, sourceAfter)) throw new Error(`Pending artifact ${name} changed after copy`);

        const finalHandle = await open(target, "r");
        try {
            const opened = await captureHandleFileIdentity(finalHandle, target, `Committed artifact ${name}`);
            assertSingleLink(opened, `Committed artifact ${name}`);
            assertReadOnlyMode(opened, `Committed artifact ${name}`);
            const canonical = resolve(await realpath(target));
            if (!samePath(canonical, target) || !samePath(dirname(canonical), directory)
                || (opened.dev === sourceAfter.dev && opened.ino === sourceAfter.ino)
                || opened.size !== member.identity.size) {
                throw new Error(`Committed artifact ${name} is not an independent copy of its material snapshot`);
            }
            await assertPathMatchesFileIdentity(target, opened, `Committed artifact ${name}`);
            const value = await digestOpenArtifactMember(finalHandle, opened, false);
            const after = await captureHandleFileIdentity(finalHandle, target, `Committed artifact ${name}`);
            if (value.sha256 !== member.sha256 || !sameFileIdentity(opened, after)) throw new Error(`Committed artifact ${name} changed during post-promotion validation`);
            await assertPathMatchesFileIdentity(target, after, `Committed artifact ${name}`);
            guard.trackRegularFile(target, after);
        } finally { await finalHandle.close(); }
    }
    await assertExactArtifactDirectoryMembers(directory, "Committed artifact directory");
    if (!await sameDirectoryIdentity(directoryIdentity)) throw new Error("Reserved committed artifact directory identity changed during post-promotion validation");
    await guard.assertStable();
}

async function closeArtifactMaterialSnapshot(snapshot: ArtifactMaterialSnapshot): Promise<void> {
    await Promise.all([...snapshot.members.values()].map(member => member.handle.close().catch(() => undefined)));
}

function headerValues(headers: DatabaseArtifactTransportResponse["headers"], name: string): string[] {
    const values: string[] = [];
    for (const [key, value] of Object.entries(headers)) {
        if (key.toLowerCase() !== name || value === undefined) continue;
        if (Array.isArray(value)) values.push(...value);
        else values.push(value);
    }
    return values;
}

async function inspectStreamToFile(input: {
    body: Readable,
    temporaryPath: string,
    expectedSizeBytes: number,
    maxBytes: number,
    signal: AbortSignal,
    guard: ArtifactStoreGuard,
}): Promise<{ inspection: GameDbArtifactInspection, identity: FileIdentity }> {
    const target = await input.guard.assertParent(input.temporaryPath, input.guard.root);
    const handle = await open(target, "wx");
    const hash = createHash("sha256");
    let observedSizeBytes = 0;
    let header = Buffer.alloc(0);
    let initialIdentity: FileIdentity | undefined;
    let finalIdentity: FileIdentity | undefined;
    try {
        initialIdentity = await captureHandleFileIdentity(handle, target, "Downloaded artifact temporary");
        await assertPathMatchesFileIdentity(target, initialIdentity, "Downloaded artifact temporary");
        input.guard.trackRegularFile(target, initialIdentity);
        await input.guard.assertStable();
        for await (const value of input.body) {
            if (input.signal.aborted) throw new Error("Database artifact acquisition cancelled");
            const chunk = Buffer.isBuffer(value) ? value : Buffer.from(value);
            observedSizeBytes += chunk.byteLength;
            if (observedSizeBytes > input.maxBytes || observedSizeBytes > input.expectedSizeBytes) throw new Error("Database artifact stream exceeds the allowed size");
            hash.update(chunk);
            if (header.byteLength < SQLITE_HEADER.byteLength) header = Buffer.concat([header, chunk.subarray(0, SQLITE_HEADER.byteLength - header.byteLength)]);
            await writeHandleFully(handle, chunk);
        }
        if (input.signal.aborted) throw new Error("Database artifact acquisition cancelled");
        if (observedSizeBytes !== input.expectedSizeBytes) throw new Error("Database artifact stream is truncated or size-divergent");
        await handle.sync();
        finalIdentity = await captureHandleFileIdentity(handle, target, "Downloaded artifact temporary");
        if (!sameFileIdentity(initialIdentity, finalIdentity, false)) throw new Error("Downloaded artifact temporary identity changed during creation");
        await assertPathMatchesFileIdentity(target, finalIdentity, "Downloaded artifact temporary");
        input.guard.trackRegularFile(target, finalIdentity);
        await input.guard.assertStable();
    } finally {
        if (initialIdentity && !finalIdentity) {
            try {
                const current = await captureHandleFileIdentity(handle, target, "Downloaded artifact temporary");
                if (sameFileIdentity(initialIdentity, current, false)) {
                    await assertPathMatchesFileIdentity(target, current, "Downloaded artifact temporary");
                    input.guard.trackRegularFile(target, current);
                }
            } catch { /* leave an unproved path untouched during outer cleanup */ }
        }
        await handle.close();
    }
    if (!finalIdentity) throw new Error("Downloaded artifact temporary identity was not validated");
    return {
        inspection: {
            observedSizeBytes,
            localSha256: hash.digest("hex"),
            artifactState: header.equals(SQLITE_HEADER) ? "readable_sqlite" : "encrypted_or_packaged",
        },
        identity: finalIdentity,
    };
}

async function inspectRegularArtifact(filePath: string, maxBytes: number, guard?: ArtifactStoreGuard, parent?: string, signal?: AbortSignal): Promise<GameDbArtifactInspection> {
    return readStableOpenFile(guard, filePath, parent, "Artifact input", async (handle, identity) => {
        const expectedSize = Number(identity.size);
        if (!Number.isSafeInteger(expectedSize) || expectedSize <= 0 || expectedSize > maxBytes) throw new Error("Artifact input size is outside the allowed range");
        const hash = createHash("sha256");
        let observedSizeBytes = 0;
        let header = Buffer.alloc(0);
        const buffer = Buffer.allocUnsafe(64 * 1024);
        while (observedSizeBytes < expectedSize) {
            const { bytesRead } = await handle.read(buffer, 0, Math.min(buffer.byteLength, expectedSize - observedSizeBytes), observedSizeBytes);
            if (bytesRead <= 0) break;
            const chunk = buffer.subarray(0, bytesRead);
            observedSizeBytes += bytesRead;
            if (observedSizeBytes > maxBytes) throw new Error("Artifact input exceeds the allowed size");
            hash.update(chunk);
            if (header.byteLength < SQLITE_HEADER.byteLength) header = Buffer.concat([header, chunk.subarray(0, SQLITE_HEADER.byteLength - header.byteLength)]);
        }
        if (observedSizeBytes !== expectedSize) throw new Error("Artifact input changed during validation");
        return { observedSizeBytes, localSha256: hash.digest("hex"), artifactState: header.equals(SQLITE_HEADER) ? "readable_sqlite" : "encrypted_or_packaged" };
    }, signal);
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

async function readStableTextFile(guard: ArtifactStoreGuard, filePath: string, parent: string, label: string, signal?: AbortSignal): Promise<string> {
    return readStableOpenFile(guard, filePath, parent, label, handle => handle.readFile("utf8"), signal);
}

async function validateCommittedArtifact(guard: ArtifactStoreGuard, artifactsRoot: string, identity: string, expectedMetadata?: GameDbAcquiredArtifactMetadata, signal?: AbortSignal): Promise<GameDbAcquiredArtifactMetadata> {
    if (!/^[a-f0-9]{64}$/.test(identity)) throw new Error("Committed artifact identity syntax is invalid");
    const directory = await guard.trackExistingDirectory(resolve(artifactsRoot, identity), "Committed artifact directory");
    const directoryIdentity = await captureDirectoryIdentity(directory, "Committed artifact directory");
    await assertExactArtifactDirectoryMembers(directory, "Committed artifact directory");
    const opened = new Map<ArtifactMemberName, { path: string, handle: FileHandle, identity: FileIdentity, value: { sha256: string, prefix: Buffer, text?: string } }>();
    try {
        for (const name of ARTIFACT_MEMBER_NAMES) {
            if (signal) throwIfCancelled(signal);
            const path = await guard.assertParent(resolve(directory, name), directory);
            const pathIdentity = await capturePathFileIdentity(path, `Committed artifact ${name}`);
            assertSingleLink(pathIdentity, `Committed artifact ${name}`);
            assertReadOnlyMode(pathIdentity, `Committed artifact ${name}`);
            const handle = await open(path, "r");
            try {
                const handleIdentity = await captureHandleFileIdentity(handle, path, `Committed artifact ${name}`);
                assertSingleLink(handleIdentity, `Committed artifact ${name}`);
                assertReadOnlyMode(handleIdentity, `Committed artifact ${name}`);
                const canonical = resolve(await realpath(path));
                if (!sameFileIdentity(pathIdentity, handleIdentity) || !samePath(canonical, path) || !samePath(dirname(canonical), directory)) {
                    throw new Error(`Committed artifact ${name} containment or identity does not validate`);
                }
                const value = await digestOpenArtifactMember(handle, handleIdentity, name !== "database.db");
                const after = await captureHandleFileIdentity(handle, path, `Committed artifact ${name}`);
                if (!sameFileIdentity(handleIdentity, after)) throw new Error(`Committed artifact ${name} changed during validation`);
                await assertPathMatchesFileIdentity(path, after, `Committed artifact ${name}`);
                guard.trackRegularFile(path, after);
                opened.set(name, { path, handle, identity: after, value });
            } catch (error) {
                await handle.close();
                throw error;
            }
        }
        const database = opened.get("database.db")!;
        const storedMetadataText = opened.get("metadata.json")!.value.text!;
        const markerText = opened.get("commit-marker.json")!.value.text!;
        let storedMetadataValue: unknown;
        try { storedMetadataValue = JSON.parse(storedMetadataText); } catch { throw new Error("Committed artifact metadata JSON is malformed"); }
        const metadata = parseCommittedMetadata(storedMetadataValue);
        if (storedMetadataText !== canonicalJson(metadata) || artifactIdentity(metadata) !== identity || (expectedMetadata && canonicalJson(metadata) !== canonicalJson(expectedMetadata))) {
            throw new Error("Existing immutable artifact identity does not validate");
        }
        const databaseState = database.value.prefix.equals(SQLITE_HEADER) ? "readable_sqlite" : "encrypted_or_packaged";
        if (Number(database.identity.size) !== metadata.observedSizeBytes || database.value.sha256 !== metadata.localSha256 || databaseState !== metadata.artifactState) {
            throw new Error("Existing immutable artifact identity does not validate");
        }
        const expectedMarker = canonicalJson({ schemaVersion: 1, contract: "dokkan-game-db-artifact-commit", contractVersion: "1.0.0", identity, metadataSha256: opened.get("metadata.json")!.value.sha256 });
        if (markerText !== expectedMarker) throw new Error("Existing immutable artifact commit marker does not validate");
        await assertExactArtifactDirectoryMembers(directory, "Committed artifact directory");
        if (!await sameDirectoryIdentity(directoryIdentity)) throw new Error("Committed artifact directory identity changed during validation");
        for (const [name, member] of opened) {
            const after = await captureHandleFileIdentity(member.handle, member.path, `Committed artifact ${name}`);
            if (!sameFileIdentity(member.identity, after)) throw new Error(`Committed artifact ${name} changed during validation`);
            await assertPathMatchesFileIdentity(member.path, after, `Committed artifact ${name}`);
        }
        await guard.assertStable();
        return metadata;
    } finally { await Promise.all([...opened.values()].map(member => member.handle.close().catch(() => undefined))); }
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

async function validateLatestPointerAndCommits(guard: ArtifactStoreGuard, artifactsRoot: string, expectedCurrentIdentity?: string, signal?: AbortSignal): Promise<{ pointer: LatestPointer, metadata: GameDbAcquiredArtifactMetadata }> {
    const latestPath = resolve(guard.root, "latest.json");
    const firstText = await readStableTextFile(guard, latestPath, guard.root, "Latest pointer", signal);
    const firstIdentity = guard.trackedRegularFile(latestPath);
    if (!firstIdentity) throw new Error("Latest pointer identity was not retained");
    const pointer = parseLatestPointer(firstText);
    if (expectedCurrentIdentity && pointer.currentIdentity !== expectedCurrentIdentity) throw new Error("Latest pointer does not reference the expected committed artifact");
    const metadata = await validateCommittedArtifact(guard, artifactsRoot, pointer.currentIdentity, undefined, signal);
    if (pointer.previousIdentity) await validateCommittedArtifact(guard, artifactsRoot, pointer.previousIdentity, undefined, signal);
    const secondText = await readStableTextFile(guard, latestPath, guard.root, "Latest pointer", signal);
    const secondIdentity = guard.trackedRegularFile(latestPath);
    if (!secondIdentity || firstText !== secondText || !sameFileIdentity(firstIdentity, secondIdentity)) throw new Error("Latest pointer changed while its commits were validated");
    return { pointer, metadata };
}

async function promoteLatest(guard: ArtifactStoreGuard, artifactsRoot: string, identity: string, signal: AbortSignal): Promise<{ path: string, rollback: () => Promise<void> }> {
    const latestPath = resolve(guard.root, "latest.json");
    await validateCommittedArtifact(guard, artifactsRoot, identity, undefined, signal);
    let originalText: string | null = null;
    let originalIdentity: FileIdentity | undefined;
    let previousIdentity: string | null = null;
    let latestExists = false;
    try { await lstat(latestPath); latestExists = true; }
    catch (error: any) { if (error?.code !== "ENOENT") throw error; }
    if (latestExists) {
        originalText = await readStableTextFile(guard, latestPath, guard.root, "Existing latest pointer", signal);
        originalIdentity = guard.trackedRegularFile(latestPath);
        if (!originalIdentity) throw new Error("Existing latest pointer identity was not retained");
        const current = parseLatestPointer(originalText);
        await validateCommittedArtifact(guard, artifactsRoot, current.currentIdentity, undefined, signal);
        if (current.previousIdentity) await validateCommittedArtifact(guard, artifactsRoot, current.previousIdentity, undefined, signal);
        previousIdentity = current.currentIdentity === identity
            ? current.previousIdentity
            : current.currentIdentity;
    }
    if (previousIdentity === identity) throw new Error("Latest pointer would create an identity cycle");
    const pointer = { schemaVersion: 1, contract: "dokkan-game-db-local-latest", contractVersion: "1.0.0", currentIdentity: identity, previousIdentity };
    const candidatePath = resolve(guard.root, `.latest-candidate-${process.pid}-${randomBytes(12).toString("hex")}.json`);
    let priorHistory: { path: string, identity: FileIdentity } | undefined;
    let promotedIdentity: FileIdentity | undefined;
    throwIfCancelled(signal);
    try {
        if (originalIdentity) {
            priorHistory = await guard.moveTrackedRegularFileToHistory(latestPath, guard.root, "Prior latest pointer history", signal, true, ".latest-history");
            if (!sameFileIdentity(originalIdentity, priorHistory.identity, false)) throw new Error("Prior latest pointer history did not retain the validated identity");
        }
        await writeExclusiveStableFile(guard, candidatePath, guard.root, canonicalJson(pointer), "Latest pointer candidate");
        await validateCommittedArtifact(guard, artifactsRoot, identity, undefined, signal);
        throwIfCancelled(signal);
        promotedIdentity = await guard.installTrackedRegularFileAtomic(candidatePath, guard.root, latestPath, guard.root, "Latest pointer", signal);
        const rollback = async () => {
            await guard.assertStable();
            if (!promotedIdentity) throw new Error("Promoted latest pointer identity is unavailable for rollback");
            const movedCurrent = await guard.moveTrackedRegularFileToHistory(latestPath, guard.root, "Rolled-back latest pointer history", signal, false, ".latest-history");
            if (!sameFileIdentity(promotedIdentity, movedCurrent.identity, false)) throw new Error("Rollback moved a replacement latest pointer; it was retained for recovery");
            if (originalText !== null) {
                if (!priorHistory || !guard.trackedRegularFile(priorHistory.path)) throw new Error("Validated prior latest pointer history is unavailable for rollback");
                await guard.installTrackedRegularFileAtomic(priorHistory.path, dirname(priorHistory.path), latestPath, guard.root, "Prior latest pointer restoration");
            }
        };
        try {
            throwIfCancelled(signal);
            await validateLatestPointerAndCommits(guard, artifactsRoot, identity, signal);
            throwIfCancelled(signal);
        } catch (error) { await rollback(); throw error; }
        return { path: latestPath, rollback };
    } catch (error) {
        if (guard.trackedRegularFile(candidatePath)) await guard.discardTrackedRegularFile(candidatePath, guard.root, "Failed latest pointer candidate discard").catch(() => undefined);
        if (!promotedIdentity && priorHistory && guard.trackedRegularFile(priorHistory.path)) {
            try { await guard.installTrackedRegularFileAtomic(priorHistory.path, dirname(priorHistory.path), latestPath, guard.root, "Prior latest pointer restoration"); }
            catch { /* retain validated history; never overwrite an occupied latest pathname */ }
        }
        throw error;
    }
}

export async function validateAcquiredDatabaseArtifact(options: ValidateAcquiredDatabaseArtifactOptions): Promise<ValidatedAcquiredDatabaseArtifact> {
    if (arguments.length !== 1 || !isJsonObject(options)) throw new Error("Acquired artifact validation options are invalid");
    const keys = Object.keys(options).sort();
    const explicitIdentity = exactKeys(options, ["storeRoot", "artifactIdentity"]);
    const explicitLatest = exactKeys(options, ["storeRoot", "useLatest"]);
    if (!explicitIdentity && !explicitLatest) throw new Error("Acquired artifact validation requires storeRoot and exactly one artifact identity selector");
    if (typeof options.storeRoot !== "string" || !options.storeRoot || options.storeRoot.includes("\0")) throw new Error("Acquired artifact storeRoot is invalid");
    if (explicitIdentity && (typeof (options as any).artifactIdentity !== "string" || !/^[a-f0-9]{64}$/.test((options as any).artifactIdentity))) throw new Error("Acquired artifact identity is invalid");
    if (explicitLatest && (options as any).useLatest !== true) throw new Error("Acquired artifact latest selector must be true");

    const guard = await ArtifactStoreGuard.openExisting(options.storeRoot);
    const artifactsRoot = await guard.trackExistingDirectory(resolve(guard.root, "artifacts"), "Artifact objects directory");
    let identity: string;
    let metadata: GameDbAcquiredArtifactMetadata;
    if (explicitLatest) {
        const validated = await validateLatestPointerAndCommits(guard, artifactsRoot);
        identity = validated.pointer.currentIdentity;
        metadata = validated.metadata;
    } else {
        identity = (options as { artifactIdentity: string }).artifactIdentity;
        metadata = await validateCommittedArtifact(guard, artifactsRoot, identity);
    }
    const artifactDirectory = resolve(artifactsRoot, identity);
    return {
        identity,
        artifactDirectory,
        artifactPath: resolve(artifactDirectory, "database.db"),
        metadataPath: resolve(artifactDirectory, "metadata.json"),
        commitMarkerPath: resolve(artifactDirectory, "commit-marker.json"),
        metadata,
        resolvedFromLatest: explicitLatest,
    };
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
        await writeExclusiveStableFile(guard, temporary, receiptsRoot, canonicalJson(receipt), "Operational receipt temporary");
        if (signal) throwIfCancelled(signal);
        await guard.copyTrackedRegularFileCreateOnly(temporary, receiptsRoot, target, receiptsRoot, signal);
        await guard.discardTrackedRegularFile(temporary, receiptsRoot, "Receipt staging discard", signal);
        if (signal) throwIfCancelled(signal);
        return target;
    } catch (error) {
        if (guard.trackedRegularFile(temporary)) {
            try { await guard.moveTrackedRegularFileToHistory(temporary, receiptsRoot, "Failed receipt staging history"); }
            catch {
                if (guard.trackedRegularFile(temporary)) await guard.discardTrackedRegularFile(temporary, receiptsRoot, "Failed receipt staging discard").catch(() => undefined);
            }
        }
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
    const guard = await ArtifactStoreGuard.open(options.storeRoot, options.signal);
    const lockPath = resolve(guard.root, ".acquisition.lock");
    let lock: { path: string, identity: DirectoryIdentity };
    try { lock = await guard.createExclusiveDirectory(lockPath, "Artifact store writer lock"); }
    catch { throw new Error("Database artifact acquisition already has an active writer or unsafe lock path"); }
    const controller = new AbortController();
    const onAbort = () => controller.abort();
    options.signal?.addEventListener("abort", onAbort, { once: true });
    if (options.signal?.aborted) controller.abort();
    const cancellationSignal = {
        get aborted() {
            const externallyAborted = Boolean(options.signal?.aborted);
            return controller.signal.aborted || externallyAborted;
        },
    } as AbortSignal;
    const temporaryPath = resolve(guard.root, `.download-${process.pid}-${randomBytes(6).toString("hex")}.tmp`);
    let pending: { path: string, identity: DirectoryIdentity } | undefined;
    let latestCommit: { path: string, rollback: () => Promise<void> } | undefined;
    try {
        throwIfCancelled(cancellationSignal);
        await guard.assertStable();
        await guard.assertHistoryBudget(maxBytes);
        // The transport is the first external side effect and is never called
        // until descriptor, limits, root identity and cancellation validate.
        throwIfCancelled(cancellationSignal);
        const response = await withTimeout(options.transport.get(new URL(descriptor.url), { signal: controller.signal }), timeoutMs, controller);
        if (response.statusCode !== 200) {
            response.body.destroy();
            if (response.statusCode >= 300 && response.statusCode <= 399) throw new Error("Database artifact redirects are blocked");
            throw new Error(`Database artifact response was not successful: status must be exactly 200, received ${response.statusCode}`);
        }
        if (headerValues(response.headers, "content-range").length > 0) { response.body.destroy(); throw new Error("Database artifact Content-Range is forbidden"); }
        const contentEncodings = headerValues(response.headers, "content-encoding");
        if (contentEncodings.length > 1 || (contentEncodings.length === 1 && contentEncodings[0].trim().toLowerCase() !== "identity")) {
            response.body.destroy();
            throw new Error("Database artifact Content-Encoding must be absent or identity");
        }
        const contentLengths = headerValues(response.headers, "content-length");
        if (contentLengths.length !== 1 || !/^[1-9][0-9]*$/.test(contentLengths[0])) { response.body.destroy(); throw new Error("Database artifact Content-Length must be one valid canonical value"); }
        const contentLength = contentLengths[0];
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
        try { ({ inspection } = await inspectStreamToFile({ body: response.body, temporaryPath, expectedSizeBytes, maxBytes, signal: controller.signal, guard })); }
        finally { clearTimeout(timer); controller.signal.removeEventListener("abort", abortBody); }
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
            await validateCommittedArtifact(guard, artifactsRoot, identity, metadata, cancellationSignal);
            throwIfCancelled(cancellationSignal);
            await guard.discardTrackedRegularFile(temporaryPath, guard.root, "Reused download staging discard");
            reused = true;
        } else {
            pending = await guard.createExclusiveDirectory(resolve(artifactsRoot, `.pending-${process.pid}-${randomBytes(6).toString("hex")}`), "Pending artifact directory");
            const artifactPath = resolve(pending.path, "database.db");
            throwIfCancelled(cancellationSignal);
            await guard.copyTrackedRegularFileCreateOnly(temporaryPath, guard.root, artifactPath, pending.path, cancellationSignal);
            await guard.discardTrackedRegularFile(temporaryPath, guard.root, "Downloaded artifact staging discard", cancellationSignal);
            throwIfCancelled(cancellationSignal);
            const metadataText = canonicalJson(metadata);
            const metadataPath = resolve(pending.path, "metadata.json");
            throwIfCancelled(cancellationSignal);
            await writeExclusiveStableFile(guard, metadataPath, pending.path, metadataText, "Pending artifact metadata");
            throwIfCancelled(cancellationSignal);
            const marker = { schemaVersion: 1, contract: "dokkan-game-db-artifact-commit", contractVersion: "1.0.0", identity, metadataSha256: createHash("sha256").update(metadataText).digest("hex") };
            const markerPath = resolve(pending.path, "commit-marker.json");
            throwIfCancelled(cancellationSignal);
            await writeExclusiveStableFile(guard, markerPath, pending.path, canonicalJson(marker), "Pending artifact commit marker");
            throwIfCancelled(cancellationSignal);
            const snapshot = await openArtifactMaterialSnapshot(guard, pending, identity, metadata, cancellationSignal);
            try {
                try {
                    await guard.promoteArtifactDirectoryCreateOnly(snapshot, finalDirectory, cancellationSignal);
                    pending = undefined;
                } catch (error) {
                    if (!(error instanceof ArtifactDestinationOccupiedError)) throw error;
                    // An externally introduced destination is never replaced or
                    // removed. It may win only when it independently validates
                    // as the complete immutable commit for this exact identity.
                    await validateCommittedArtifact(guard, artifactsRoot, identity, metadata, cancellationSignal);
                    await guard.removeDirectory(pending.path, pending.identity, [...ARTIFACT_MEMBER_NAMES]);
                    pending = undefined;
                    reused = true;
                }
            } finally { await closeArtifactMaterialSnapshot(snapshot); }
            throwIfCancelled(cancellationSignal);
        }
        await validateCommittedArtifact(guard, artifactsRoot, identity, metadata, cancellationSignal);
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
        await validateLatestPointerAndCommits(guard, artifactsRoot, identity, cancellationSignal);
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
        if (guard.trackedRegularFile(temporaryPath)) {
            try { await guard.moveTrackedRegularFileToHistory(temporaryPath, guard.root, "Failed download staging history"); }
            catch {
                if (guard.trackedRegularFile(temporaryPath)) await guard.discardTrackedRegularFile(temporaryPath, guard.root, "Failed download staging discard").catch(() => undefined);
            }
        }
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
