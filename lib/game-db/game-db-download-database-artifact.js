"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runDownloadDatabaseArtifact = exports.acquireDatabaseArtifact = exports.validateAcquiredDatabaseArtifact = exports.readAndValidateDatabaseDescriptor = exports.validateClientAssetsDatabaseDescriptor = exports.parseDownloadDatabaseArtifactArgs = exports.DEFAULT_DATABASE_ARTIFACT_TIMEOUT_MS = exports.DEFAULT_DATABASE_ARTIFACT_MAX_BYTES = void 0;
const crypto_1 = require("crypto");
const promises_1 = require("fs/promises");
const https_1 = require("https");
const path_1 = require("path");
const OFFICIAL_CDN_HOST = "cf.ishin-global.aktsk.com";
const LOGICAL_FILE_PATH = "sqlite/current/en/database.db";
const SQLITE_HEADER = Buffer.from("SQLite format 3\u0000", "utf8");
const DEFAULT_STORE_ROOT = (0, path_1.resolve)(process.cwd(), "game-db", "data", "game-db-acquisition", "database-artifacts");
exports.DEFAULT_DATABASE_ARTIFACT_MAX_BYTES = 128 * 1024 * 1024;
exports.DEFAULT_DATABASE_ARTIFACT_TIMEOUT_MS = 120000;
const LOCAL_ARTIFACT_HISTORY_MAX_BYTES = 256 * 1024 * 1024;
const POINTER_RECORD_MAX_BYTES = 16 * 1024;
function requiredValue(argv, index, inline, token) {
    const value = inline ?? argv[index + 1];
    if (!value || value.includes("\0"))
        throw new Error(`Missing or invalid value for ${token}`);
    return value;
}
function parseDownloadDatabaseArtifactArgs(argv) {
    let descriptorJson;
    let artifactPath;
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
            if (inline === undefined)
                index += 1;
            if (name === "--descriptor-json")
                descriptorJson = (0, path_1.resolve)(value);
            else if (name === "--artifact-path")
                artifactPath = (0, path_1.resolve)(value);
            else
                storeRoot = (0, path_1.resolve)(value);
            continue;
        }
        if (name === "--authorize-download" && inline === undefined) {
            authorizeDownload = true;
            continue;
        }
        if (name === "--dry-run" && inline === undefined) {
            dryRun = true;
            continue;
        }
        if (name === "--database-url" || name === "--client-assets-json" || name === "--output-dir" || name === "--output-file-name") {
            throw new Error(`${name} is disabled; use --descriptor-json or --artifact-path`);
        }
        throw new Error(`Unexpected argument: ${token}`);
    }
    if (!descriptorJson)
        throw new Error("--descriptor-json is required for descriptor lineage");
    if (authorizeDownload && artifactPath)
        throw new Error("--authorize-download cannot be combined with --artifact-path");
    if (authorizeDownload && dryRun)
        throw new Error("--authorize-download and --dry-run are mutually exclusive");
    if (artifactPath && dryRun)
        throw new Error("--artifact-path already performs offline validation and cannot be combined with --dry-run");
    return { descriptorJson, artifactPath, storeRoot, authorizeDownload, dryRun };
}
exports.parseDownloadDatabaseArtifactArgs = parseDownloadDatabaseArtifactArgs;
function isJsonObject(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value);
}
function deliveryTimestampForVersion(version) {
    const date = new Date(version * 1000);
    if (!Number.isFinite(date.getTime()))
        throw new Error("Descriptor version is outside the supported timestamp range");
    const year = date.getUTCFullYear();
    if (!Number.isInteger(year) || year < 0 || year > 9999)
        throw new Error("Descriptor version UTC year must use exactly four digits");
    const digits = [year.toString().padStart(4, "0"), (date.getUTCMonth() + 1).toString().padStart(2, "0"), date.getUTCDate().toString().padStart(2, "0")].join("");
    const time = [date.getUTCHours(), date.getUTCMinutes(), date.getUTCSeconds()].map(value => value.toString().padStart(2, "0")).join("");
    const timestamp = `${digits}-${time}`;
    if (!/^\d{8}-\d{6}$/.test(timestamp))
        throw new Error("Descriptor version timestamp is not canonical UTC");
    return timestamp;
}
function validateClientAssetsDatabaseDescriptor(value) {
    if (!isJsonObject(value))
        throw new Error("Database descriptor must be a JSON object");
    const expectedKeys = ["algorithm", "file_path", "hash", "patch", "patch_hash", "url", "version"];
    const actualKeys = Object.keys(value).sort();
    if (JSON.stringify(actualKeys) !== JSON.stringify(expectedKeys))
        throw new Error("Database descriptor fields do not match the strict contract");
    if (!Number.isSafeInteger(value.version) || value.version <= 0)
        throw new Error("Database descriptor version must be a positive safe integer");
    const version = value.version;
    if (value.file_path !== LOGICAL_FILE_PATH)
        throw new Error("Database descriptor file_path is not the Global EN logical path");
    if (value.algorithm !== "version")
        throw new Error("Database descriptor algorithm is not allowlisted");
    if (typeof value.hash !== "string" || !/^[1-9][0-9]*$/.test(value.hash) || value.hash !== String(version))
        throw new Error("Database descriptor version hash is invalid");
    if (value.patch !== null || value.patch_hash !== null)
        throw new Error("Non-null database patch fields are not supported");
    if (typeof value.url !== "string" || value.url.length === 0 || value.url.length > 2048 || value.url.includes("\0"))
        throw new Error("Database descriptor URL is invalid");
    let parsed;
    try {
        parsed = new URL(value.url);
    }
    catch {
        throw new Error("Database descriptor URL is invalid");
    }
    if (parsed.protocol !== "https:")
        throw new Error("Database descriptor URL must use HTTPS");
    if (parsed.hostname !== OFFICIAL_CDN_HOST)
        throw new Error("Database descriptor URL host is not the exact official CDN host");
    if (parsed.port !== "")
        throw new Error("Database descriptor URL must use the default HTTPS port");
    if (parsed.username || parsed.password)
        throw new Error("Database descriptor URL must not contain credentials");
    if (parsed.search)
        throw new Error("Database descriptor URL query is not allowlisted");
    if (parsed.hash)
        throw new Error("Database descriptor URL fragment is not allowed");
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
exports.validateClientAssetsDatabaseDescriptor = validateClientAssetsDatabaseDescriptor;
async function readAndValidateDatabaseDescriptor(filePath) {
    const text = await readStableOpenFile(undefined, filePath, undefined, "Descriptor input", handle => handle.readFile("utf8"));
    let parsed;
    try {
        parsed = JSON.parse(text);
    }
    catch {
        throw new Error("Database descriptor JSON is malformed");
    }
    return validateClientAssetsDatabaseDescriptor(parsed);
}
exports.readAndValidateDatabaseDescriptor = readAndValidateDatabaseDescriptor;
const ARTIFACT_MEMBER_NAMES = ["database.db", "metadata.json", "commit-marker.json"];
class ArtifactDestinationOccupiedError extends Error {
    constructor() { super("Artifact destination was introduced before create-only promotion"); }
}
function samePath(left, right) {
    return process.platform === "win32" ? (0, path_1.resolve)(left).toLowerCase() === (0, path_1.resolve)(right).toLowerCase() : (0, path_1.resolve)(left) === (0, path_1.resolve)(right);
}
async function captureDirectoryIdentity(path, label) {
    const resolved = (0, path_1.resolve)(path);
    let metadata, canonical;
    try {
        metadata = await (0, promises_1.lstat)(resolved, { bigint: true });
        canonical = await (0, promises_1.realpath)(resolved);
    }
    catch {
        throw new Error(`${label} must be a real directory`);
    }
    if (!metadata.isDirectory() || metadata.isSymbolicLink() || !samePath(canonical, resolved)) {
        throw new Error(`${label} must be a regular real directory, not a symlink, junction or reparse point`);
    }
    return { path: resolved, realPath: (0, path_1.resolve)(canonical), dev: BigInt(metadata.dev).toString(), ino: BigInt(metadata.ino).toString(), mode: Number(metadata.mode) };
}
async function sameDirectoryIdentity(expected) {
    try {
        const actual = await captureDirectoryIdentity(expected.path, "Controlled directory");
        return samePath(actual.realPath, expected.realPath) && actual.dev === expected.dev && actual.ino === expected.ino && actual.mode === expected.mode;
    }
    catch {
        return false;
    }
}
function directoryChain(path) {
    const paths = [];
    let current = (0, path_1.resolve)(path);
    while (true) {
        paths.unshift(current);
        const parent = (0, path_1.dirname)(current);
        if (parent === current)
            return paths;
        current = parent;
    }
}
function fileIdentityFromStats(path, metadata) {
    if (!metadata.isFile())
        throw new Error("not a regular file");
    return {
        path: (0, path_1.resolve)(path),
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
function sameFileIdentity(left, right, includeMutableAttributes = true) {
    return left.dev === right.dev && left.ino === right.ino && left.nlink === right.nlink && left.mode === right.mode
        && (!includeMutableAttributes || (left.size === right.size && left.birthtimeNs === right.birthtimeNs && left.mtimeNs === right.mtimeNs && left.ctimeNs === right.ctimeNs));
}
function assertSingleLink(identity, label) {
    if (identity.nlink !== "1")
        throw new Error(`${label} must have exactly one hard link`);
}
function assertReadOnlyMode(identity, label) {
    if ((identity.mode & 0o222) !== 0)
        throw new Error(`${label} must be read-only`);
}
async function syncDirectoryIfSupported(directory) {
    let handle;
    try {
        handle = await (0, promises_1.open)(directory, "r");
        await handle.sync();
    }
    catch (error) {
        if (!["EINVAL", "ENOTSUP", "EISDIR", "EBADF", "EPERM", "EACCES"].includes(error?.code))
            throw error;
    }
    finally {
        await handle?.close().catch(() => undefined);
    }
}
async function captureHandleFileIdentity(handle, path, label) {
    try {
        return fileIdentityFromStats(path, await handle.stat({ bigint: true }));
    }
    catch {
        throw new Error(`${label} must be a regular real file`);
    }
}
async function capturePathFileIdentity(path, label) {
    const target = (0, path_1.resolve)(path);
    try {
        const metadata = await (0, promises_1.lstat)(target, { bigint: true });
        const canonical = await (0, promises_1.realpath)(target);
        if (metadata.isSymbolicLink() || !samePath(canonical, target))
            throw new Error("rejected");
        return fileIdentityFromStats(target, metadata);
    }
    catch {
        throw new Error(`${label} pathname no longer points to the validated regular-file identity`);
    }
}
async function assertPathMatchesFileIdentity(path, expected, label) {
    const target = (0, path_1.resolve)(path);
    const actual = await capturePathFileIdentity(target, label);
    if (!samePath(target, expected.path) || !sameFileIdentity(actual, expected))
        throw new Error(`${label} pathname no longer points to the validated regular-file identity`);
}
async function readStableOpenFile(guard, filePath, parent, label, reader, signal) {
    const target = guard && parent ? await guard.assertParent(filePath, parent) : (0, path_1.resolve)(filePath);
    let handle;
    try {
        handle = await (0, promises_1.open)(target, "r");
    }
    catch {
        throw new Error(`${label} must be a regular real file, not a symlink or junction`);
    }
    try {
        const before = await captureHandleFileIdentity(handle, target, label);
        await assertPathMatchesFileIdentity(target, before, label);
        if (signal)
            throwIfCancelled(signal);
        await assertPathMatchesFileIdentity(target, before, label);
        const value = await reader(handle, before);
        const after = await captureHandleFileIdentity(handle, target, label);
        if (!sameFileIdentity(before, after))
            throw new Error(`${label} changed during validation`);
        await assertPathMatchesFileIdentity(target, after, label);
        if (guard) {
            guard.trackRegularFile(target, after);
            await guard.assertStable();
        }
        return value;
    }
    finally {
        await handle.close();
    }
}
async function writeHandleFully(handle, bytes) {
    let offset = 0;
    while (offset < bytes.byteLength) {
        const { bytesWritten } = await handle.write(bytes, offset, bytes.byteLength - offset, null);
        if (bytesWritten <= 0)
            throw new Error("Artifact store file write made no progress");
        offset += bytesWritten;
    }
}
async function copyHandleFully(source, destination, size, hash) {
    if (!Number.isSafeInteger(size) || size < 0)
        throw new Error("Artifact store copy size is invalid");
    const buffer = Buffer.allocUnsafe(64 * 1024);
    let offset = 0;
    while (offset < size) {
        const { bytesRead } = await source.read(buffer, 0, Math.min(buffer.byteLength, size - offset), offset);
        if (bytesRead <= 0)
            throw new Error("Artifact store source changed or copy made no progress");
        const chunk = buffer.subarray(0, bytesRead);
        hash?.update(chunk);
        let written = 0;
        while (written < bytesRead) {
            const result = await destination.write(chunk, written, bytesRead - written, offset + written);
            if (result.bytesWritten <= 0)
                throw new Error("Artifact store destination copy made no progress");
            written += result.bytesWritten;
        }
        offset += bytesRead;
    }
}
async function writeExclusiveStableFile(guard, filePath, parent, contents, label) {
    const target = await guard.assertParent(filePath, parent);
    let handle;
    try {
        handle = await (0, promises_1.open)(target, "wx");
    }
    catch (error) {
        throw error;
    }
    let identity;
    try {
        identity = await captureHandleFileIdentity(handle, target, label);
        await assertPathMatchesFileIdentity(target, identity, label);
        guard.trackRegularFile(target, identity);
        await guard.assertStable();
        await writeHandleFully(handle, Buffer.isBuffer(contents) ? contents : Buffer.from(contents, "utf8"));
        await handle.sync();
        const written = await captureHandleFileIdentity(handle, target, label);
        if (!sameFileIdentity(identity, written, false))
            throw new Error(`${label} identity changed during creation`);
        await assertPathMatchesFileIdentity(target, written, label);
        guard.trackRegularFile(target, written);
        await guard.assertStable();
        return written;
    }
    finally {
        await handle.close();
    }
}
async function writeExclusiveReadOnlyStableFile(guard, filePath, parent, contents, label) {
    const target = await guard.assertParent(filePath, parent);
    const handle = await (0, promises_1.open)(target, "wx", 0o600);
    try {
        const created = await captureHandleFileIdentity(handle, target, label);
        assertSingleLink(created, label);
        await assertPathMatchesFileIdentity(target, created, label);
        await writeHandleFully(handle, Buffer.isBuffer(contents) ? contents : Buffer.from(contents, "utf8"));
        await handle.sync();
        await handle.chmod(0o444);
        await handle.sync();
        const completed = await captureHandleFileIdentity(handle, target, label);
        if (created.dev !== completed.dev || created.ino !== completed.ino || created.nlink !== completed.nlink)
            throw new Error(`${label} identity changed during creation`);
        assertSingleLink(completed, label);
        assertReadOnlyMode(completed, label);
        await assertPathMatchesFileIdentity(target, completed, label);
        guard.trackRegularFile(target, completed);
        await syncDirectoryIfSupported(parent);
        await guard.assertStable();
        return completed;
    }
    finally {
        await handle.close();
    }
}
class ArtifactStoreGuard {
    root;
    directories = new Map();
    files = new Map();
    constructor(root) {
        this.root = root;
    }
    static async open(storeRoot, signal) {
        const resolved = (0, path_1.resolve)(storeRoot);
        if (!(0, path_1.isAbsolute)(resolved) || resolved.includes("\0"))
            throw new Error("Artifact store root is invalid");
        const chain = directoryChain(resolved);
        const guard = new ArtifactStoreGuard(resolved);
        let existing = chain.length - 1;
        while (existing >= 0) {
            try {
                await (0, promises_1.lstat)(chain[existing]);
                break;
            }
            catch (error) {
                if (error?.code !== "ENOENT")
                    throw error;
                existing -= 1;
            }
        }
        if (existing < 0)
            throw new Error("Artifact store root has no existing filesystem ancestor");
        for (let index = 0; index <= existing; index += 1) {
            const path = chain[index];
            guard.directories.set(path, await captureDirectoryIdentity(path, "Artifact store parent"));
        }
        const created = [];
        try {
            await guard.assertStable();
            for (let index = existing + 1; index < chain.length; index += 1) {
                const path = chain[index];
                await guard.assertStable();
                if (signal)
                    throwIfCancelled(signal);
                await guard.assertStable();
                await (0, promises_1.mkdir)(path);
                const identity = await captureDirectoryIdentity(path, path === resolved ? "Artifact store root" : "Artifact store parent");
                guard.directories.set(path, identity);
                created.push(identity);
                await guard.assertStable();
            }
            await guard.assertStable();
            return guard;
        }
        catch (error) {
            for (const identity of created.reverse()) {
                await guard.removeDirectory(identity.path, identity, []).catch(() => undefined);
            }
            throw error;
        }
    }
    ensureContained(candidate, allowRoot = false) {
        const target = (0, path_1.resolve)(candidate);
        if (allowRoot && samePath(target, this.root))
            return target;
        const relation = (0, path_1.relative)(this.root, target);
        if (!relation || relation === ".." || relation.startsWith(`..${path_1.sep}`) || (0, path_1.isAbsolute)(relation))
            throw new Error("Artifact store path escaped containment");
        return target;
    }
    async assertStable() {
        for (const identity of this.directories.values()) {
            if (!await sameDirectoryIdentity(identity))
                throw new Error(`Artifact store directory identity changed: ${identity.path}`);
        }
    }
    async trackExistingDirectory(path, label) {
        await this.assertStable();
        const target = this.ensureContained(path);
        const identity = await captureDirectoryIdentity(target, label);
        this.directories.set(target, identity);
        await this.assertStable();
        return target;
    }
    async ensureDirectory(path, label) {
        await this.assertStable();
        const target = this.ensureContained(path);
        try {
            await (0, promises_1.mkdir)(target);
        }
        catch (error) {
            if (error?.code !== "EEXIST")
                throw error;
        }
        return this.trackExistingDirectory(target, label);
    }
    async createExclusiveDirectory(path, label) {
        await this.assertStable();
        const target = this.ensureContained(path);
        await (0, promises_1.mkdir)(target);
        const identity = await captureDirectoryIdentity(target, label);
        this.directories.set(target, identity);
        await this.assertStable();
        return { path: target, identity };
    }
    async promoteArtifactDirectoryCreateOnly(snapshot, to, signal) {
        await this.assertStable();
        const source = this.ensureContained(snapshot.directory.path), target = this.ensureContained(to);
        const trackedSource = this.directories.get(source);
        if (!trackedSource || trackedSource.dev !== snapshot.directory.dev || trackedSource.ino !== snapshot.directory.ino
            || !await sameDirectoryIdentity(snapshot.directory))
            throw new Error("Pending artifact directory identity changed");
        // Node has no portable rename-no-replace for directories. Reserve the
        // final content-addressed name with exclusive mkdir, then copy each
        // already-open member into an exclusive file, marker last. No final
        // member shares an inode with mutable pending state.
        throwIfCancelled(signal);
        let reservation;
        try {
            reservation = await this.createExclusiveDirectory(target, "Reserved committed artifact directory");
        }
        catch (error) {
            if (error?.code === "EEXIST")
                throw new ArtifactDestinationOccupiedError();
            throw error;
        }
        try {
            for (const name of ARTIFACT_MEMBER_NAMES) {
                const member = snapshot.members.get(name);
                if (!member)
                    throw new Error(`Pending artifact snapshot is missing ${name}`);
                await assertPathMatchesFileIdentity(member.sourcePath, member.identity, `Pending artifact ${name}`);
                const beforeCopy = await captureHandleFileIdentity(member.handle, member.sourcePath, `Pending artifact ${name}`);
                if (!sameFileIdentity(member.identity, beforeCopy))
                    throw new Error(`Pending artifact ${name} changed before promotion`);
                throwIfCancelled(signal);
                const installedPath = (0, path_1.resolve)(reservation.path, name);
                await this.assertParent(installedPath, reservation.path);
                const installedHandle = await (0, promises_1.open)(installedPath, "wx", 0o600);
                try {
                    const created = await captureHandleFileIdentity(installedHandle, installedPath, `Committed artifact ${name}`);
                    assertSingleLink(created, `Committed artifact ${name}`);
                    await assertPathMatchesFileIdentity(installedPath, created, `Committed artifact ${name}`);
                    const hash = (0, crypto_1.createHash)("sha256");
                    await copyHandleFully(member.handle, installedHandle, Number(member.identity.size), hash);
                    await installedHandle.sync();
                    if (hash.digest("hex") !== member.sha256)
                        throw new Error(`Pending artifact ${name} changed during copy`);
                    const sourceAfter = await captureHandleFileIdentity(member.handle, member.sourcePath, `Pending artifact ${name} after copy`);
                    if (!sameFileIdentity(member.identity, sourceAfter))
                        throw new Error(`Pending artifact ${name} changed during copy`);
                    await assertPathMatchesFileIdentity(member.sourcePath, sourceAfter, `Pending artifact ${name} after copy`);
                    const copied = await captureHandleFileIdentity(installedHandle, installedPath, `Committed artifact ${name}`);
                    if (!sameFileIdentity(created, copied, false) || copied.size !== member.identity.size)
                        throw new Error(`Committed artifact ${name} identity or size changed during copy`);
                    assertSingleLink(copied, `Committed artifact ${name}`);
                    await installedHandle.chmod(0o444);
                    await installedHandle.sync();
                    const readOnly = await captureHandleFileIdentity(installedHandle, installedPath, `Committed artifact ${name}`);
                    assertSingleLink(readOnly, `Committed artifact ${name}`);
                    assertReadOnlyMode(readOnly, `Committed artifact ${name}`);
                    await assertPathMatchesFileIdentity(installedPath, readOnly, `Committed artifact ${name}`);
                    if (readOnly.dev === sourceAfter.dev && readOnly.ino === sourceAfter.ino)
                        throw new Error(`Committed artifact ${name} shares the pending inode`);
                    this.files.set(installedPath, readOnly);
                }
                finally {
                    await installedHandle.close();
                }
            }
            await assertExactArtifactDirectoryMembers(reservation.path, "Reserved committed artifact directory");
            await syncDirectoryIfSupported(reservation.path);
            await syncDirectoryIfSupported((0, path_1.dirname)(reservation.path));
            await assertPromotedArtifactSnapshot(this, reservation.path, reservation.identity, snapshot, signal);
            for (const name of ARTIFACT_MEMBER_NAMES) {
                const member = snapshot.members.get(name);
                await this.removeRegularFile(member.sourcePath, source);
            }
            await this.removeDirectory(source, snapshot.directory, []);
            await syncDirectoryIfSupported((0, path_1.dirname)(reservation.path));
        }
        catch (error) {
            try {
                await this.quarantineControlledDirectory(reservation.path, reservation.identity, "Failed committed artifact quarantine");
            }
            catch (recoveryError) {
                throw new AggregateError([error, recoveryError], "Artifact promotion failed and its reserved destination could not be safely quarantined");
            }
            throw error;
        }
    }
    static async openExisting(storeRoot) {
        const resolved = (0, path_1.resolve)(storeRoot);
        if (!(0, path_1.isAbsolute)(resolved) || resolved.includes("\0"))
            throw new Error("Artifact store root is invalid");
        const guard = new ArtifactStoreGuard(resolved);
        for (const path of directoryChain(resolved)) {
            guard.directories.set(path, await captureDirectoryIdentity(path, path === resolved ? "Artifact store root" : "Artifact store parent"));
        }
        await guard.assertStable();
        return guard;
    }
    async quarantineControlledDirectory(path, identity, label) {
        await this.assertStable();
        const target = this.ensureContained(path);
        if (!samePath(target, identity.path) || !await sameDirectoryIdentity(identity))
            throw new Error("Refusing to quarantine a replaced artifact directory");
        const container = await this.createExclusiveDirectory((0, path_1.resolve)((0, path_1.dirname)(target), `.quarantine-${process.pid}-${(0, crypto_1.randomBytes)(12).toString("hex")}`), label);
        const quarantinedPath = (0, path_1.resolve)(container.path, "artifact");
        await this.assertParent(quarantinedPath, container.path);
        if (!await sameDirectoryIdentity(identity))
            throw new Error("Refusing to quarantine a replaced artifact directory");
        await (0, promises_1.rename)(target, quarantinedPath);
        this.directories.delete(target);
        const moved = await captureDirectoryIdentity(quarantinedPath, label);
        if (moved.dev !== identity.dev || moved.ino !== identity.ino)
            throw new Error("Quarantine moved a replacement artifact directory");
        this.directories.set(quarantinedPath, moved);
        await this.assertStable();
    }
    async assertParent(path, parent) {
        await this.assertStable();
        const target = this.ensureContained(path);
        const expectedParent = (0, path_1.resolve)(parent);
        if (!samePath((0, path_1.dirname)(target), expectedParent) || !this.directories.has(expectedParent))
            throw new Error("Artifact store parent is not controlled");
        return target;
    }
    trackRegularFile(path, identity) {
        const target = this.ensureContained(path);
        if (!samePath(target, identity.path))
            throw new Error("Artifact store file identity path is invalid");
        this.files.set(target, identity);
    }
    trackedRegularFile(path) {
        return this.files.get((0, path_1.resolve)(path));
    }
    async retainedHistoryBytes() {
        await this.assertStable();
        let total = 0;
        for (const entry of await (0, promises_1.readdir)(this.root, { withFileTypes: true })) {
            if (!entry.name.startsWith(".file-history-") && !entry.name.startsWith(".latest-history-"))
                continue;
            if (!entry.isDirectory() || entry.isSymbolicLink())
                throw new Error("Artifact store retained history must be a real directory");
            const directory = (0, path_1.resolve)(this.root, entry.name);
            const identity = await captureDirectoryIdentity(directory, "Artifact store retained history");
            this.directories.set(directory, identity);
            const members = await (0, promises_1.readdir)(directory, { withFileTypes: true });
            if (members.length !== 1 || members[0].name !== "latest.json" || !members[0].isFile() || members[0].isSymbolicLink())
                throw new Error("Artifact store retained history has unexpected content");
            const member = (0, path_1.resolve)(directory, "latest.json");
            const fileIdentity = await capturePathFileIdentity(member, "Artifact store retained history file");
            this.files.set(member, fileIdentity);
            const size = Number(fileIdentity.size);
            if (!Number.isSafeInteger(size) || size < 0 || total > LOCAL_ARTIFACT_HISTORY_MAX_BYTES - size)
                throw new Error("Artifact store retained history exceeds the local storage budget");
            total += size;
        }
        await this.assertStable();
        return total;
    }
    async assertHistoryBudget(reservedBytes) {
        if (!Number.isSafeInteger(reservedBytes) || reservedBytes < 0 || reservedBytes > LOCAL_ARTIFACT_HISTORY_MAX_BYTES)
            throw new Error("Artifact store history reservation is invalid");
        const retained = await this.retainedHistoryBytes();
        if (retained > LOCAL_ARTIFACT_HISTORY_MAX_BYTES - reservedBytes)
            throw new Error("Artifact store retained history would exceed the 256 MiB local storage budget");
    }
    async copyTrackedRegularFileCreateOnly(from, fromParent, to, toParent, signal) {
        const source = await this.assertParent(from, fromParent);
        const target = await this.assertParent(to, toParent);
        const identity = this.files.get(source);
        if (!identity)
            throw new Error("Artifact store source file identity is not controlled");
        await assertPathMatchesFileIdentity(source, identity, "Artifact store source file");
        if (signal)
            throwIfCancelled(signal);
        await assertPathMatchesFileIdentity(source, identity, "Artifact store source file");
        await this.assertStable();
        let sourceHandle;
        let destinationHandle;
        try {
            sourceHandle = await (0, promises_1.open)(source, "r");
            destinationHandle = await (0, promises_1.open)(target, "wx", identity.mode & 0o777);
            const openedSource = await captureHandleFileIdentity(sourceHandle, source, "Artifact store source file");
            if (!sameFileIdentity(identity, openedSource))
                throw new Error("Artifact store source file changed before create-only copy");
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
            if (installed.dev === sourceAfter.dev && installed.ino === sourceAfter.ino)
                throw new Error("Installed artifact store file unexpectedly shares the source inode");
            this.files.set(target, installed);
        }
        finally {
            await Promise.all([sourceHandle?.close(), destinationHandle?.close()]);
        }
        await this.assertStable();
        return this.files.get(target);
    }
    async moveTrackedRegularFileToHistory(from, fromParent, historyLabel, signal, enforceCancellation = true, historyPrefix = ".file-history") {
        const source = await this.assertParent(from, fromParent);
        const expected = this.files.get(source);
        if (!expected)
            throw new Error("Artifact store source file identity is not controlled");
        if (historyPrefix !== ".discard")
            await this.assertHistoryBudget(Number(expected.size));
        const history = await this.createExclusiveDirectory((0, path_1.resolve)(this.root, `${historyPrefix}-${process.pid}-${(0, crypto_1.randomBytes)(12).toString("hex")}`), historyLabel);
        const target = (0, path_1.resolve)(history.path, "latest.json");
        await this.assertParent(target, history.path);
        // This read is also the deterministic concurrency boundary used by the
        // productive AbortSignal.  Rollback observes it without allowing an
        // already-aborted signal to suppress recovery.
        if (signal) {
            if (enforceCancellation)
                throwIfCancelled(signal);
            else
                void signal.aborted;
        }
        await this.assertStable();
        // Rename moves whichever pathname identity exists at the atomic call;
        // it never deletes that identity.  The exclusive history directory
        // makes the target a controlled, previously unreachable pathname.
        await (0, promises_1.rename)(source, target);
        const moved = await capturePathFileIdentity(target, historyLabel);
        this.files.delete(source);
        this.files.set(target, moved);
        if (!sameFileIdentity(expected, moved, false)) {
            throw new Error(`${historyLabel} moved a replacement identity; the moved file was retained for recovery`);
        }
        await this.assertStable();
        return { path: target, identity: moved };
    }
    async discardTrackedRegularFile(from, fromParent, label, signal) {
        const moved = await this.moveTrackedRegularFileToHistory(from, fromParent, label, signal, true, ".discard");
        const directory = (0, path_1.dirname)(moved.path);
        const directoryIdentity = this.directories.get(directory);
        if (!directoryIdentity)
            throw new Error("Artifact store discard directory identity is unavailable");
        await this.removeDirectory(directory, directoryIdentity, ["latest.json"]);
    }
    async removeRegularFile(path, parent, signal) {
        const target = await this.assertParent(path, parent);
        const identity = this.files.get(target);
        if (!identity)
            return;
        await assertPathMatchesFileIdentity(target, identity, "Temporary artifact store file");
        if (signal)
            throwIfCancelled(signal);
        await assertPathMatchesFileIdentity(target, identity, "Temporary artifact store file");
        await (0, promises_1.rm)(target, { force: true });
        this.files.delete(target);
        await this.assertStable();
    }
    async removeDirectory(path, identity, allowedFiles) {
        await this.assertStable();
        const target = this.ensureContained(path);
        if (!samePath(target, identity.path) || !await sameDirectoryIdentity(identity))
            throw new Error("Refusing to clean a replaced controlled directory");
        const entries = await (0, promises_1.readdir)(target, { withFileTypes: true });
        for (const entry of entries) {
            if (!allowedFiles.includes(entry.name) || !entry.isFile() || entry.isSymbolicLink())
                throw new Error("Refusing to clean unexpected pending-directory content");
            const member = (0, path_1.resolve)(target, entry.name);
            const identity = this.files.get(member);
            if (!identity)
                throw new Error("Refusing to clean an untracked pending-directory member");
            await assertPathMatchesFileIdentity(member, identity, "Pending artifact member");
        }
        for (const entry of entries)
            await this.removeRegularFile((0, path_1.resolve)(target, entry.name), target);
        if (!await sameDirectoryIdentity(identity))
            throw new Error("Refusing to clean a replaced controlled directory");
        this.directories.delete(target);
        await (0, promises_1.rmdir)(target);
        await this.assertStable();
    }
}
async function assertExactArtifactDirectoryMembers(directory, label) {
    let entries;
    try {
        entries = await (0, promises_1.readdir)(directory, { withFileTypes: true });
    }
    catch {
        throw new Error(`${label} members could not be enumerated`);
    }
    const names = entries.map(entry => entry.name).sort();
    const expected = [...ARTIFACT_MEMBER_NAMES].sort();
    if (JSON.stringify(names) !== JSON.stringify(expected)
        || entries.some(entry => !entry.isFile() || entry.isSymbolicLink())) {
        throw new Error(`${label} members are incomplete, unexpected or not regular files`);
    }
}
async function digestOpenArtifactMember(handle, identity, retainText) {
    const size = Number(identity.size);
    if (!Number.isSafeInteger(size) || size <= 0 || size > exports.DEFAULT_DATABASE_ARTIFACT_MAX_BYTES)
        throw new Error("Artifact member size is outside the allowed range");
    if (retainText && size > 1024 * 1024)
        throw new Error("Artifact JSON member exceeds the allowed size");
    const hash = (0, crypto_1.createHash)("sha256");
    const prefix = Buffer.alloc(Math.min(SQLITE_HEADER.byteLength, size));
    const retained = [];
    const buffer = Buffer.allocUnsafe(64 * 1024);
    let offset = 0;
    while (offset < size) {
        const { bytesRead } = await handle.read(buffer, 0, Math.min(buffer.byteLength, size - offset), offset);
        if (bytesRead <= 0)
            break;
        const chunk = buffer.subarray(0, bytesRead);
        hash.update(chunk);
        if (offset < prefix.byteLength)
            chunk.copy(prefix, offset, 0, Math.min(bytesRead, prefix.byteLength - offset));
        if (retainText)
            retained.push(Buffer.from(chunk));
        offset += bytesRead;
    }
    if (offset !== size)
        throw new Error("Artifact member changed while hashing");
    return { sha256: hash.digest("hex"), prefix, ...(retainText ? { text: Buffer.concat(retained).toString("utf8") } : {}) };
}
async function openArtifactMaterialSnapshot(guard, pending, identity, expectedMetadata, signal) {
    await guard.assertStable();
    if (!await sameDirectoryIdentity(pending.identity))
        throw new Error("Pending artifact directory identity changed before material snapshot");
    await assertExactArtifactDirectoryMembers(pending.path, "Pending artifact directory");
    const members = new Map();
    const values = new Map();
    try {
        for (const name of ARTIFACT_MEMBER_NAMES) {
            throwIfCancelled(signal);
            const path = await guard.assertParent((0, path_1.resolve)(pending.path, name), pending.path);
            const pathIdentity = await capturePathFileIdentity(path, `Pending artifact ${name}`);
            let handle;
            try {
                handle = await (0, promises_1.open)(path, "r");
            }
            catch {
                throw new Error(`Pending artifact ${name} must be a regular real file`);
            }
            try {
                const opened = await captureHandleFileIdentity(handle, path, `Pending artifact ${name}`);
                assertSingleLink(opened, `Pending artifact ${name}`);
                if (!sameFileIdentity(pathIdentity, opened))
                    throw new Error(`Pending artifact ${name} pathname does not match its opened identity`);
                await assertPathMatchesFileIdentity(path, opened, `Pending artifact ${name}`);
                const canonical = (0, path_1.resolve)(await (0, promises_1.realpath)(path));
                if (!samePath(canonical, path) || !samePath((0, path_1.dirname)(canonical), pending.path))
                    throw new Error(`Pending artifact ${name} escaped containment`);
                const value = await digestOpenArtifactMember(handle, opened, name !== "database.db");
                const after = await captureHandleFileIdentity(handle, path, `Pending artifact ${name}`);
                if (!sameFileIdentity(opened, after))
                    throw new Error(`Pending artifact ${name} changed during material snapshot`);
                await assertPathMatchesFileIdentity(path, after, `Pending artifact ${name}`);
                guard.trackRegularFile(path, after);
                members.set(name, { relativePath: name, sourcePath: path, realPath: canonical, identity: after, sha256: value.sha256, handle });
                values.set(name, value);
            }
            catch (error) {
                await handle.close();
                throw error;
            }
        }
        await assertExactArtifactDirectoryMembers(pending.path, "Pending artifact directory");
        if (!await sameDirectoryIdentity(pending.identity))
            throw new Error("Pending artifact directory identity changed during material snapshot");
        await guard.assertStable();
        const metadataText = values.get("metadata.json")?.text;
        const markerText = values.get("commit-marker.json")?.text;
        if (metadataText === undefined || markerText === undefined)
            throw new Error("Pending artifact JSON members were not retained");
        let metadataValue;
        try {
            metadataValue = JSON.parse(metadataText);
        }
        catch {
            throw new Error("Pending artifact metadata JSON is malformed");
        }
        const metadata = parseCommittedMetadata(metadataValue);
        if (metadataText !== canonicalJson(metadata) || canonicalJson(metadata) !== canonicalJson(expectedMetadata) || artifactIdentity(metadata) !== identity) {
            throw new Error("Pending artifact metadata does not match its content identity");
        }
        const database = values.get("database.db");
        const databaseState = database.prefix.equals(SQLITE_HEADER) ? "readable_sqlite" : "encrypted_or_packaged";
        if (Number(members.get("database.db").identity.size) !== metadata.observedSizeBytes
            || database.sha256 !== metadata.localSha256 || databaseState !== metadata.artifactState) {
            throw new Error("Pending database member does not match committed metadata");
        }
        const expectedMarker = canonicalJson({ schemaVersion: 1, contract: "dokkan-game-db-artifact-commit", contractVersion: "1.0.0", identity, metadataSha256: values.get("metadata.json").sha256 });
        if (markerText !== expectedMarker)
            throw new Error("Pending artifact commit marker does not validate");
        return { directory: pending.identity, metadata, members };
    }
    catch (error) {
        await Promise.all([...members.values()].map(member => member.handle.close().catch(() => undefined)));
        throw error;
    }
}
async function assertPromotedArtifactSnapshot(guard, directory, directoryIdentity, snapshot, signal) {
    if (!await sameDirectoryIdentity(directoryIdentity))
        throw new Error("Reserved committed artifact directory identity changed after promotion");
    await assertExactArtifactDirectoryMembers(directory, "Committed artifact directory");
    for (const name of ARTIFACT_MEMBER_NAMES) {
        throwIfCancelled(signal);
        const member = snapshot.members.get(name);
        const target = await guard.assertParent((0, path_1.resolve)(directory, member.relativePath), directory);
        const sourceBefore = await captureHandleFileIdentity(member.handle, member.sourcePath, `Pending artifact ${name}`);
        if (!sameFileIdentity(member.identity, sourceBefore))
            throw new Error(`Pending artifact ${name} changed after copy`);
        await assertPathMatchesFileIdentity(member.sourcePath, sourceBefore, `Pending artifact ${name}`);
        const sourceValue = await digestOpenArtifactMember(member.handle, sourceBefore, false);
        const sourceAfter = await captureHandleFileIdentity(member.handle, member.sourcePath, `Pending artifact ${name}`);
        if (sourceValue.sha256 !== member.sha256 || !sameFileIdentity(sourceBefore, sourceAfter))
            throw new Error(`Pending artifact ${name} changed after copy`);
        const finalHandle = await (0, promises_1.open)(target, "r");
        try {
            const opened = await captureHandleFileIdentity(finalHandle, target, `Committed artifact ${name}`);
            assertSingleLink(opened, `Committed artifact ${name}`);
            assertReadOnlyMode(opened, `Committed artifact ${name}`);
            const canonical = (0, path_1.resolve)(await (0, promises_1.realpath)(target));
            if (!samePath(canonical, target) || !samePath((0, path_1.dirname)(canonical), directory)
                || (opened.dev === sourceAfter.dev && opened.ino === sourceAfter.ino)
                || opened.size !== member.identity.size) {
                throw new Error(`Committed artifact ${name} is not an independent copy of its material snapshot`);
            }
            await assertPathMatchesFileIdentity(target, opened, `Committed artifact ${name}`);
            const value = await digestOpenArtifactMember(finalHandle, opened, false);
            const after = await captureHandleFileIdentity(finalHandle, target, `Committed artifact ${name}`);
            if (value.sha256 !== member.sha256 || !sameFileIdentity(opened, after))
                throw new Error(`Committed artifact ${name} changed during post-promotion validation`);
            await assertPathMatchesFileIdentity(target, after, `Committed artifact ${name}`);
            guard.trackRegularFile(target, after);
        }
        finally {
            await finalHandle.close();
        }
    }
    await assertExactArtifactDirectoryMembers(directory, "Committed artifact directory");
    if (!await sameDirectoryIdentity(directoryIdentity))
        throw new Error("Reserved committed artifact directory identity changed during post-promotion validation");
    await guard.assertStable();
}
async function closeArtifactMaterialSnapshot(snapshot) {
    await Promise.all([...snapshot.members.values()].map(member => member.handle.close().catch(() => undefined)));
}
function headerValues(headers, name) {
    const values = [];
    for (const [key, value] of Object.entries(headers)) {
        if (key.toLowerCase() !== name || value === undefined)
            continue;
        if (Array.isArray(value))
            values.push(...value);
        else
            values.push(value);
    }
    return values;
}
async function inspectStreamToFile(input) {
    const target = await input.guard.assertParent(input.temporaryPath, input.guard.root);
    const handle = await (0, promises_1.open)(target, "wx");
    const hash = (0, crypto_1.createHash)("sha256");
    let observedSizeBytes = 0;
    let header = Buffer.alloc(0);
    let initialIdentity;
    let finalIdentity;
    try {
        initialIdentity = await captureHandleFileIdentity(handle, target, "Downloaded artifact temporary");
        await assertPathMatchesFileIdentity(target, initialIdentity, "Downloaded artifact temporary");
        input.guard.trackRegularFile(target, initialIdentity);
        await input.guard.assertStable();
        for await (const value of input.body) {
            if (input.signal.aborted)
                throw new Error("Database artifact acquisition cancelled");
            const chunk = Buffer.isBuffer(value) ? value : Buffer.from(value);
            observedSizeBytes += chunk.byteLength;
            if (observedSizeBytes > input.maxBytes || observedSizeBytes > input.expectedSizeBytes)
                throw new Error("Database artifact stream exceeds the allowed size");
            hash.update(chunk);
            if (header.byteLength < SQLITE_HEADER.byteLength)
                header = Buffer.concat([header, chunk.subarray(0, SQLITE_HEADER.byteLength - header.byteLength)]);
            await writeHandleFully(handle, chunk);
        }
        if (input.signal.aborted)
            throw new Error("Database artifact acquisition cancelled");
        if (observedSizeBytes !== input.expectedSizeBytes)
            throw new Error("Database artifact stream is truncated or size-divergent");
        await handle.sync();
        finalIdentity = await captureHandleFileIdentity(handle, target, "Downloaded artifact temporary");
        if (!sameFileIdentity(initialIdentity, finalIdentity, false))
            throw new Error("Downloaded artifact temporary identity changed during creation");
        await assertPathMatchesFileIdentity(target, finalIdentity, "Downloaded artifact temporary");
        input.guard.trackRegularFile(target, finalIdentity);
        await input.guard.assertStable();
    }
    finally {
        if (initialIdentity && !finalIdentity) {
            try {
                const current = await captureHandleFileIdentity(handle, target, "Downloaded artifact temporary");
                if (sameFileIdentity(initialIdentity, current, false)) {
                    await assertPathMatchesFileIdentity(target, current, "Downloaded artifact temporary");
                    input.guard.trackRegularFile(target, current);
                }
            }
            catch { /* leave an unproved path untouched during outer cleanup */ }
        }
        await handle.close();
    }
    if (!finalIdentity)
        throw new Error("Downloaded artifact temporary identity was not validated");
    return {
        inspection: {
            observedSizeBytes,
            localSha256: hash.digest("hex"),
            artifactState: header.equals(SQLITE_HEADER) ? "readable_sqlite" : "encrypted_or_packaged",
        },
        identity: finalIdentity,
    };
}
async function inspectRegularArtifact(filePath, maxBytes, guard, parent, signal) {
    return readStableOpenFile(guard, filePath, parent, "Artifact input", async (handle, identity) => {
        const expectedSize = Number(identity.size);
        if (!Number.isSafeInteger(expectedSize) || expectedSize <= 0 || expectedSize > maxBytes)
            throw new Error("Artifact input size is outside the allowed range");
        const hash = (0, crypto_1.createHash)("sha256");
        let observedSizeBytes = 0;
        let header = Buffer.alloc(0);
        const buffer = Buffer.allocUnsafe(64 * 1024);
        while (observedSizeBytes < expectedSize) {
            const { bytesRead } = await handle.read(buffer, 0, Math.min(buffer.byteLength, expectedSize - observedSizeBytes), observedSizeBytes);
            if (bytesRead <= 0)
                break;
            const chunk = buffer.subarray(0, bytesRead);
            observedSizeBytes += bytesRead;
            if (observedSizeBytes > maxBytes)
                throw new Error("Artifact input exceeds the allowed size");
            hash.update(chunk);
            if (header.byteLength < SQLITE_HEADER.byteLength)
                header = Buffer.concat([header, chunk.subarray(0, SQLITE_HEADER.byteLength - header.byteLength)]);
        }
        if (observedSizeBytes !== expectedSize)
            throw new Error("Artifact input changed during validation");
        return { observedSizeBytes, localSha256: hash.digest("hex"), artifactState: header.equals(SQLITE_HEADER) ? "readable_sqlite" : "encrypted_or_packaged" };
    }, signal);
}
async function inspectDownloadedDatabaseArtifact(filePath, maxBytes = exports.DEFAULT_DATABASE_ARTIFACT_MAX_BYTES) {
    if (!Number.isSafeInteger(maxBytes) || maxBytes <= 0)
        throw new Error("Invalid artifact byte limit");
    return inspectRegularArtifact(filePath, maxBytes);
}
function metadataFor(descriptor, inspection) {
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
function canonicalJson(value) { return `${JSON.stringify(value, null, 2)}\n`; }
function artifactIdentity(metadata) {
    return (0, crypto_1.createHash)("sha256").update(JSON.stringify({
        region: metadata.region,
        locale: metadata.locale,
        logicalFilePath: metadata.logicalFilePath,
        databaseVersion: metadata.databaseVersion,
        declaredIntegrity: metadata.declaredIntegrity,
        observedSizeBytes: metadata.observedSizeBytes,
        localSha256: metadata.localSha256,
    })).digest("hex");
}
function operationTimestamp(now) {
    const value = (now ?? (() => new Date()))();
    if (!(value instanceof Date) || Number.isNaN(value.getTime()))
        throw new Error("Operational receipt timestamp is invalid");
    return value.toISOString();
}
function receiptBase(descriptor, metadata, identity) {
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
function exactKeys(value, expected) {
    return JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...expected].sort());
}
function parseCommittedMetadata(value) {
    if (!isJsonObject(value) || !exactKeys(value, ["schemaVersion", "contract", "contractVersion", "region", "locale", "databaseVersion", "logicalFilePath", "declaredIntegrity", "observedSizeBytes", "localSha256", "artifactState", "descriptorLineage", "nextPermittedStep"]))
        throw new Error("Committed artifact metadata contract is invalid");
    if (value.schemaVersion !== 1 || value.contract !== "dokkan-game-db-acquired-artifact" || value.contractVersion !== "1.0.0" || value.region !== "global" || value.locale !== "en"
        || !Number.isSafeInteger(value.databaseVersion) || value.databaseVersion <= 0 || value.logicalFilePath !== LOGICAL_FILE_PATH
        || !Number.isSafeInteger(value.observedSizeBytes) || value.observedSizeBytes <= 0 || typeof value.localSha256 !== "string" || !/^[a-f0-9]{64}$/.test(value.localSha256)
        || (value.artifactState !== "readable_sqlite" && value.artifactState !== "encrypted_or_packaged"))
        throw new Error("Committed artifact metadata fields are invalid");
    if (!isJsonObject(value.declaredIntegrity) || !exactKeys(value.declaredIntegrity, ["algorithm", "hash"]) || value.declaredIntegrity.algorithm !== "version"
        || typeof value.declaredIntegrity.hash !== "string" || !/^[1-9][0-9]*$/.test(value.declaredIntegrity.hash) || value.declaredIntegrity.hash !== String(value.databaseVersion))
        throw new Error("Committed artifact declared integrity is invalid");
    if (!isJsonObject(value.descriptorLineage) || !exactKeys(value.descriptorLineage, ["source", "deliveryFamily", "patchState", "patchHashState"])
        || value.descriptorLineage.source !== "externally_supplied_client_assets_database" || value.descriptorLineage.deliveryFamily !== "official_global_en_versioned_sqlite"
        || value.descriptorLineage.patchState !== "observed_null" || value.descriptorLineage.patchHashState !== "observed_null")
        throw new Error("Committed artifact descriptor lineage is invalid");
    const expectedNext = value.artifactState === "readable_sqlite" ? "run_read_only_sqlite_compatibility" : "decrypt_locally_then_validate_read_only_sqlite";
    if (value.nextPermittedStep !== expectedNext)
        throw new Error("Committed artifact next step is invalid");
    return value;
}
async function readStableTextFile(guard, filePath, parent, label, signal) {
    return readStableOpenFile(guard, filePath, parent, label, handle => handle.readFile("utf8"), signal);
}
async function validateCommittedArtifact(guard, artifactsRoot, identity, expectedMetadata, signal) {
    if (!/^[a-f0-9]{64}$/.test(identity))
        throw new Error("Committed artifact identity syntax is invalid");
    const directory = await guard.trackExistingDirectory((0, path_1.resolve)(artifactsRoot, identity), "Committed artifact directory");
    const directoryIdentity = await captureDirectoryIdentity(directory, "Committed artifact directory");
    await assertExactArtifactDirectoryMembers(directory, "Committed artifact directory");
    const opened = new Map();
    try {
        for (const name of ARTIFACT_MEMBER_NAMES) {
            if (signal)
                throwIfCancelled(signal);
            const path = await guard.assertParent((0, path_1.resolve)(directory, name), directory);
            const pathIdentity = await capturePathFileIdentity(path, `Committed artifact ${name}`);
            assertSingleLink(pathIdentity, `Committed artifact ${name}`);
            assertReadOnlyMode(pathIdentity, `Committed artifact ${name}`);
            const handle = await (0, promises_1.open)(path, "r");
            try {
                const handleIdentity = await captureHandleFileIdentity(handle, path, `Committed artifact ${name}`);
                assertSingleLink(handleIdentity, `Committed artifact ${name}`);
                assertReadOnlyMode(handleIdentity, `Committed artifact ${name}`);
                const canonical = (0, path_1.resolve)(await (0, promises_1.realpath)(path));
                if (!sameFileIdentity(pathIdentity, handleIdentity) || !samePath(canonical, path) || !samePath((0, path_1.dirname)(canonical), directory)) {
                    throw new Error(`Committed artifact ${name} containment or identity does not validate`);
                }
                const value = await digestOpenArtifactMember(handle, handleIdentity, name !== "database.db");
                const after = await captureHandleFileIdentity(handle, path, `Committed artifact ${name}`);
                if (!sameFileIdentity(handleIdentity, after))
                    throw new Error(`Committed artifact ${name} changed during validation`);
                await assertPathMatchesFileIdentity(path, after, `Committed artifact ${name}`);
                guard.trackRegularFile(path, after);
                opened.set(name, { path, handle, identity: after, value });
            }
            catch (error) {
                await handle.close();
                throw error;
            }
        }
        const database = opened.get("database.db");
        const storedMetadataText = opened.get("metadata.json").value.text;
        const markerText = opened.get("commit-marker.json").value.text;
        let storedMetadataValue;
        try {
            storedMetadataValue = JSON.parse(storedMetadataText);
        }
        catch {
            throw new Error("Committed artifact metadata JSON is malformed");
        }
        const metadata = parseCommittedMetadata(storedMetadataValue);
        if (storedMetadataText !== canonicalJson(metadata) || artifactIdentity(metadata) !== identity || (expectedMetadata && canonicalJson(metadata) !== canonicalJson(expectedMetadata))) {
            throw new Error("Existing immutable artifact identity does not validate");
        }
        const databaseState = database.value.prefix.equals(SQLITE_HEADER) ? "readable_sqlite" : "encrypted_or_packaged";
        if (Number(database.identity.size) !== metadata.observedSizeBytes || database.value.sha256 !== metadata.localSha256 || databaseState !== metadata.artifactState) {
            throw new Error("Existing immutable artifact identity does not validate");
        }
        const expectedMarker = canonicalJson({ schemaVersion: 1, contract: "dokkan-game-db-artifact-commit", contractVersion: "1.0.0", identity, metadataSha256: opened.get("metadata.json").value.sha256 });
        if (markerText !== expectedMarker)
            throw new Error("Existing immutable artifact commit marker does not validate");
        await assertExactArtifactDirectoryMembers(directory, "Committed artifact directory");
        if (!await sameDirectoryIdentity(directoryIdentity))
            throw new Error("Committed artifact directory identity changed during validation");
        for (const [name, member] of opened) {
            const after = await captureHandleFileIdentity(member.handle, member.path, `Committed artifact ${name}`);
            if (!sameFileIdentity(member.identity, after))
                throw new Error(`Committed artifact ${name} changed during validation`);
            await assertPathMatchesFileIdentity(member.path, after, `Committed artifact ${name}`);
        }
        await guard.assertStable();
        return metadata;
    }
    finally {
        await Promise.all([...opened.values()].map(member => member.handle.close().catch(() => undefined)));
    }
}
function throwIfCancelled(signal) {
    if (signal.aborted)
        throw new Error("Database artifact acquisition cancelled");
}
function parseArtifactPointerRecord(text) {
    let value;
    try {
        value = JSON.parse(text);
    }
    catch {
        throw new Error("Artifact pointer record JSON is malformed");
    }
    if (!isJsonObject(value) || !exactKeys(value, ["schemaVersion", "contract", "contractVersion", "identity", "predecessorIdentity", "order"])
        || value.schemaVersion !== 1 || value.contract !== "dokkan-game-db-pointer-record" || value.contractVersion !== "1.0.0"
        || typeof value.identity !== "string" || !/^[a-f0-9]{64}$/.test(value.identity)
        || !(value.predecessorIdentity === null || (typeof value.predecessorIdentity === "string" && /^[a-f0-9]{64}$/.test(value.predecessorIdentity)))
        || value.identity === value.predecessorIdentity || !isJsonObject(value.order) || !exactKeys(value.order, ["databaseVersion", "artifactIdentity"])
        || !Number.isSafeInteger(value.order.databaseVersion) || value.order.databaseVersion <= 0 || value.order.artifactIdentity !== value.identity) {
        throw new Error("Artifact pointer record contract is invalid");
    }
    const record = value;
    if (text !== canonicalJson(record))
        throw new Error("Artifact pointer record is not canonical JSON");
    return record;
}
function comparePointerRecords(left, right) {
    if (left.record.order.databaseVersion !== right.record.order.databaseVersion)
        return left.record.order.databaseVersion - right.record.order.databaseVersion;
    const compareText = (a, b) => a === b ? 0 : a < b ? -1 : 1;
    const identity = compareText(left.record.order.artifactIdentity, right.record.order.artifactIdentity);
    if (identity !== 0)
        return identity;
    const predecessor = compareText(left.record.predecessorIdentity ?? "", right.record.predecessorIdentity ?? "");
    return predecessor !== 0 ? predecessor : compareText(left.sha256, right.sha256);
}
async function loadArtifactPointerJournal(guard, artifactsRoot, options) {
    const requested = (0, path_1.resolve)(guard.root, "pointers");
    const directory = options.create
        ? await guard.ensureDirectory(requested, "Artifact pointer journal directory")
        : await guard.trackExistingDirectory(requested, "Artifact pointer journal directory");
    const entries = await (0, promises_1.readdir)(directory, { withFileTypes: true });
    if (entries.some(entry => !/^[a-f0-9]{64}\.json$/.test(entry.name) || !entry.isFile() || entry.isSymbolicLink())) {
        throw new Error("Artifact pointer journal contains an unexpected or non-regular member");
    }
    const candidates = [];
    for (const entry of entries.sort((left, right) => left.name === right.name ? 0 : left.name < right.name ? -1 : 1)) {
        try {
            const path = (0, path_1.resolve)(directory, entry.name);
            const result = await readStableOpenFile(guard, path, directory, "Artifact pointer record", async (handle, fileIdentity) => {
                assertSingleLink(fileIdentity, "Artifact pointer record");
                assertReadOnlyMode(fileIdentity, "Artifact pointer record");
                const size = Number(fileIdentity.size);
                if (!Number.isSafeInteger(size) || size <= 0 || size > POINTER_RECORD_MAX_BYTES)
                    throw new Error("Artifact pointer record size is invalid");
                return handle.readFile("utf8");
            }, options.signal);
            const sha256 = (0, crypto_1.createHash)("sha256").update(result).digest("hex");
            if (entry.name !== `${sha256}.json`)
                throw new Error("Artifact pointer record filename does not match its bytes");
            const record = parseArtifactPointerRecord(result);
            const metadata = await validateCommittedArtifact(guard, artifactsRoot, record.identity, undefined, options.signal);
            if (metadata.databaseVersion !== record.order.databaseVersion || artifactIdentity(metadata) !== record.order.artifactIdentity) {
                throw new Error("Artifact pointer record order does not match its commit");
            }
            candidates.push({ path, fileName: entry.name, sha256, record, metadata });
        }
        catch { /* Invalid journal records are never authority and are ignored. */ }
    }
    candidates.sort(comparePointerRecords);
    const accepted = [];
    for (const candidate of candidates) {
        if (candidate.record.predecessorIdentity === null) {
            accepted.push(candidate);
            continue;
        }
        const predecessor = accepted.filter(record => record.record.identity === candidate.record.predecessorIdentity).sort(comparePointerRecords).pop();
        if (predecessor && comparePointerRecords(predecessor, candidate) < 0)
            accepted.push(candidate);
    }
    const uniqueAccepted = [];
    for (const candidate of accepted) {
        const existingIndex = uniqueAccepted.findIndex(existing => existing.record.identity === candidate.record.identity);
        if (existingIndex < 0)
            uniqueAccepted.push(candidate);
        else if (comparePointerRecords(uniqueAccepted[existingIndex], candidate) < 0)
            uniqueAccepted[existingIndex] = candidate;
    }
    uniqueAccepted.sort(comparePointerRecords);
    if (accepted.length === 0) {
        if (options.allowEmpty && entries.length === 0)
            return { directory, validRecords: [] };
        throw new Error("Artifact pointer journal has no valid materialized record");
    }
    const current = uniqueAccepted[uniqueAccepted.length - 1];
    // Rollback is the deterministic next-lower materialized record, not arrival
    // order. Concurrent roots may both have null predecessors because neither
    // writer had observed the other when it created its own record.
    const previous = uniqueAccepted.length > 1 ? uniqueAccepted[uniqueAccepted.length - 2] : null;
    return { directory, validRecords: uniqueAccepted, current, previous };
}
async function appendArtifactPointerRecord(guard, artifactsRoot, identity, signal) {
    const metadata = await validateCommittedArtifact(guard, artifactsRoot, identity, undefined, signal);
    const before = await loadArtifactPointerJournal(guard, artifactsRoot, { create: true, allowEmpty: true, signal });
    const beforeRecords = [...before.validRecords];
    const existing = beforeRecords.filter(candidate => candidate.record.identity === identity).sort(comparePointerRecords).pop();
    if (existing) {
        if (!("current" in before))
            throw new Error("Artifact pointer journal selection is inconsistent");
        return { recordPath: existing.path, selection: before };
    }
    const orderProbe = {
        path: "", fileName: "", sha256: "",
        record: { schemaVersion: 1, contract: "dokkan-game-db-pointer-record", contractVersion: "1.0.0", identity, predecessorIdentity: null, order: { databaseVersion: metadata.databaseVersion, artifactIdentity: identity } },
        metadata,
    };
    const predecessor = before.validRecords.filter(candidate => comparePointerRecords(candidate, orderProbe) < 0).sort(comparePointerRecords).pop() ?? null;
    const record = {
        schemaVersion: 1,
        contract: "dokkan-game-db-pointer-record",
        contractVersion: "1.0.0",
        identity,
        predecessorIdentity: predecessor?.record.identity ?? null,
        order: { databaseVersion: metadata.databaseVersion, artifactIdentity: identity },
    };
    const text = canonicalJson(record);
    const sha256 = (0, crypto_1.createHash)("sha256").update(text).digest("hex");
    const recordPath = (0, path_1.resolve)(before.directory, `${sha256}.json`);
    throwIfCancelled(signal);
    try {
        await writeExclusiveReadOnlyStableFile(guard, recordPath, before.directory, text, "Artifact pointer journal record");
    }
    catch (error) {
        if (error?.code !== "EEXIST")
            throw error;
    }
    // The append is the commit boundary. Observe (but do not throw on)
    // cancellation once more so deterministic race tests and callers can act
    // before the mandatory post-append materialized-commit validation.
    void signal.aborted;
    const after = await loadArtifactPointerJournal(guard, artifactsRoot, { create: false, allowEmpty: false });
    if (!("current" in after) || !after.validRecords.some(candidate => candidate.fileName === `${sha256}.json` && candidate.record.identity === identity)) {
        throw new Error("Artifact pointer journal record was not installed as the exact valid create-only record");
    }
    return { recordPath, selection: after };
}
async function validateAcquiredDatabaseArtifact(options) {
    if (arguments.length !== 1 || !isJsonObject(options))
        throw new Error("Acquired artifact validation options are invalid");
    const keys = Object.keys(options).sort();
    const explicitIdentity = exactKeys(options, ["storeRoot", "artifactIdentity"]);
    const explicitLatest = exactKeys(options, ["storeRoot", "useLatest"]);
    if (!explicitIdentity && !explicitLatest)
        throw new Error("Acquired artifact validation requires storeRoot and exactly one artifact identity selector");
    if (typeof options.storeRoot !== "string" || !options.storeRoot || options.storeRoot.includes("\0"))
        throw new Error("Acquired artifact storeRoot is invalid");
    if (explicitIdentity && (typeof options.artifactIdentity !== "string" || !/^[a-f0-9]{64}$/.test(options.artifactIdentity)))
        throw new Error("Acquired artifact identity is invalid");
    if (explicitLatest && options.useLatest !== true)
        throw new Error("Acquired artifact latest selector must be true");
    const guard = await ArtifactStoreGuard.openExisting(options.storeRoot);
    const artifactsRoot = await guard.trackExistingDirectory((0, path_1.resolve)(guard.root, "artifacts"), "Artifact objects directory");
    let identity;
    let metadata;
    if (explicitLatest) {
        const selection = await loadArtifactPointerJournal(guard, artifactsRoot, { create: false, allowEmpty: false });
        if (!("current" in selection))
            throw new Error("Artifact pointer journal has no current record");
        identity = selection.current.record.identity;
        metadata = await validateCommittedArtifact(guard, artifactsRoot, identity, selection.current.metadata);
        const artifactDirectory = (0, path_1.resolve)(artifactsRoot, identity);
        return {
            identity,
            artifactDirectory,
            artifactPath: (0, path_1.resolve)(artifactDirectory, "database.db"),
            metadataPath: (0, path_1.resolve)(artifactDirectory, "metadata.json"),
            commitMarkerPath: (0, path_1.resolve)(artifactDirectory, "commit-marker.json"),
            metadata,
            resolvedFromLatest: true,
            pointerJournalDirectory: selection.directory,
            pointerRecordPath: selection.current.path,
            previousIdentity: selection.previous?.record.identity ?? null,
        };
    }
    else {
        identity = options.artifactIdentity;
        metadata = await validateCommittedArtifact(guard, artifactsRoot, identity);
    }
    const artifactDirectory = (0, path_1.resolve)(artifactsRoot, identity);
    return {
        identity,
        artifactDirectory,
        artifactPath: (0, path_1.resolve)(artifactDirectory, "database.db"),
        metadataPath: (0, path_1.resolve)(artifactDirectory, "metadata.json"),
        commitMarkerPath: (0, path_1.resolve)(artifactDirectory, "commit-marker.json"),
        metadata,
        resolvedFromLatest: explicitLatest,
    };
}
exports.validateAcquiredDatabaseArtifact = validateAcquiredDatabaseArtifact;
async function writeOperationalReceipt(guard, receipt, signal) {
    const receiptsRoot = await guard.ensureDirectory((0, path_1.resolve)(guard.root, "receipts"), "Artifact receipts directory");
    const occurredAt = "acquiredAt" in receipt ? receipt.acquiredAt : receipt.validatedAt;
    const timestamp = occurredAt.replace(/[^0-9A-Za-z]/g, "");
    const fileName = `${receipt.mode}-${timestamp}-${(0, crypto_1.randomBytes)(6).toString("hex")}.json`;
    const target = (0, path_1.resolve)(receiptsRoot, fileName);
    const temporary = (0, path_1.resolve)(receiptsRoot, `.${fileName}.${process.pid}.tmp`);
    if (signal)
        throwIfCancelled(signal);
    await guard.assertParent(temporary, receiptsRoot);
    try {
        await writeExclusiveStableFile(guard, temporary, receiptsRoot, canonicalJson(receipt), "Operational receipt temporary");
        if (signal)
            throwIfCancelled(signal);
        await guard.copyTrackedRegularFileCreateOnly(temporary, receiptsRoot, target, receiptsRoot, signal);
        await guard.discardTrackedRegularFile(temporary, receiptsRoot, "Receipt staging discard", signal);
        if (signal)
            throwIfCancelled(signal);
        return target;
    }
    catch (error) {
        if (guard.trackedRegularFile(temporary)) {
            try {
                await guard.moveTrackedRegularFileToHistory(temporary, receiptsRoot, "Failed receipt staging history");
            }
            catch {
                if (guard.trackedRegularFile(temporary))
                    await guard.discardTrackedRegularFile(temporary, receiptsRoot, "Failed receipt staging discard").catch(() => undefined);
            }
        }
        throw error;
    }
}
async function withTimeout(promise, timeoutMs, controller) {
    let timer;
    const timeout = new Promise((_resolve, reject) => {
        timer = setTimeout(() => { controller.abort(); reject(new Error("Database artifact transport timed out")); }, timeoutMs);
    });
    try {
        return await Promise.race([promise, timeout]);
    }
    finally {
        if (timer)
            clearTimeout(timer);
    }
}
const httpsDatabaseArtifactTransport = {
    get(url, options) {
        return new Promise((resolvePromise, rejectPromise) => {
            const req = (0, https_1.request)(url, { method: "GET", headers: { Accept: "application/octet-stream" } }, response => {
                const headers = {};
                for (const [key, value] of Object.entries(response.headers))
                    headers[key] = value;
                resolvePromise({ statusCode: response.statusCode ?? 0, headers, body: response });
            });
            const abort = () => req.destroy(new Error("Database artifact acquisition cancelled"));
            if (options.signal.aborted)
                abort();
            else
                options.signal.addEventListener("abort", abort, { once: true });
            req.on("error", rejectPromise);
            req.end();
        });
    },
};
async function acquireDatabaseArtifact(options) {
    // This is a runtime trust boundary. Callers of the compiled JavaScript can
    // fabricate TypeScript-shaped objects, so no field (especially URL) is used
    // until the complete raw descriptor has passed the same strict validator.
    const descriptor = validateClientAssetsDatabaseDescriptor(options.descriptor);
    const maxBytes = options.maxBytes ?? exports.DEFAULT_DATABASE_ARTIFACT_MAX_BYTES;
    const timeoutMs = options.timeoutMs ?? exports.DEFAULT_DATABASE_ARTIFACT_TIMEOUT_MS;
    if (!Number.isSafeInteger(maxBytes) || maxBytes <= 0 || !Number.isSafeInteger(timeoutMs) || timeoutMs <= 0)
        throw new Error("Invalid acquisition limits");
    const guard = await ArtifactStoreGuard.open(options.storeRoot, options.signal);
    const controller = new AbortController();
    const onAbort = () => controller.abort();
    options.signal?.addEventListener("abort", onAbort, { once: true });
    if (options.signal?.aborted)
        controller.abort();
    const cancellationSignal = {
        get aborted() {
            const externallyAborted = Boolean(options.signal?.aborted);
            return controller.signal.aborted || externallyAborted;
        },
    };
    const temporaryPath = (0, path_1.resolve)(guard.root, `.download-${process.pid}-${(0, crypto_1.randomBytes)(6).toString("hex")}.tmp`);
    let pending;
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
            if (response.statusCode >= 300 && response.statusCode <= 399)
                throw new Error("Database artifact redirects are blocked");
            throw new Error(`Database artifact response was not successful: status must be exactly 200, received ${response.statusCode}`);
        }
        if (headerValues(response.headers, "content-range").length > 0) {
            response.body.destroy();
            throw new Error("Database artifact Content-Range is forbidden");
        }
        const contentEncodings = headerValues(response.headers, "content-encoding");
        if (contentEncodings.length > 1 || (contentEncodings.length === 1 && contentEncodings[0].trim().toLowerCase() !== "identity")) {
            response.body.destroy();
            throw new Error("Database artifact Content-Encoding must be absent or identity");
        }
        const contentLengths = headerValues(response.headers, "content-length");
        if (contentLengths.length !== 1 || !/^[1-9][0-9]*$/.test(contentLengths[0])) {
            response.body.destroy();
            throw new Error("Database artifact Content-Length must be one valid canonical value");
        }
        const contentLength = contentLengths[0];
        const expectedSizeBytes = Number(contentLength);
        if (!Number.isSafeInteger(expectedSizeBytes) || expectedSizeBytes > maxBytes) {
            response.body.destroy();
            throw new Error("Database artifact Content-Length exceeds the allowed size");
        }
        const destroyBody = (error) => {
            response.body.once("error", () => undefined);
            response.body.destroy(error);
        };
        const abortBody = () => destroyBody(new Error("Database artifact acquisition cancelled"));
        controller.signal.addEventListener("abort", abortBody, { once: true });
        const timer = setTimeout(() => { controller.abort(); destroyBody(new Error("Database artifact stream timed out")); }, timeoutMs);
        let inspection;
        await guard.assertParent(temporaryPath, guard.root);
        throwIfCancelled(cancellationSignal);
        try {
            ({ inspection } = await inspectStreamToFile({ body: response.body, temporaryPath, expectedSizeBytes, maxBytes, signal: controller.signal, guard }));
        }
        finally {
            clearTimeout(timer);
            controller.signal.removeEventListener("abort", abortBody);
        }
        await guard.assertStable();
        throwIfCancelled(cancellationSignal);
        const metadata = metadataFor(descriptor, inspection);
        const identity = artifactIdentity(metadata);
        const artifactsRoot = await guard.ensureDirectory((0, path_1.resolve)(guard.root, "artifacts"), "Artifact objects directory");
        const finalDirectory = (0, path_1.resolve)(artifactsRoot, identity);
        let reused = false;
        let finalExists = false;
        try {
            await (0, promises_1.lstat)(finalDirectory);
            finalExists = true;
        }
        catch (error) {
            if (error?.code !== "ENOENT")
                throw error;
        }
        if (finalExists) {
            await validateCommittedArtifact(guard, artifactsRoot, identity, metadata, cancellationSignal);
            throwIfCancelled(cancellationSignal);
            await guard.discardTrackedRegularFile(temporaryPath, guard.root, "Reused download staging discard");
            reused = true;
        }
        else {
            pending = await guard.createExclusiveDirectory((0, path_1.resolve)(artifactsRoot, `.pending-${process.pid}-${(0, crypto_1.randomBytes)(6).toString("hex")}`), "Pending artifact directory");
            const artifactPath = (0, path_1.resolve)(pending.path, "database.db");
            throwIfCancelled(cancellationSignal);
            await guard.copyTrackedRegularFileCreateOnly(temporaryPath, guard.root, artifactPath, pending.path, cancellationSignal);
            await guard.discardTrackedRegularFile(temporaryPath, guard.root, "Downloaded artifact staging discard", cancellationSignal);
            throwIfCancelled(cancellationSignal);
            const metadataText = canonicalJson(metadata);
            const metadataPath = (0, path_1.resolve)(pending.path, "metadata.json");
            throwIfCancelled(cancellationSignal);
            await writeExclusiveStableFile(guard, metadataPath, pending.path, metadataText, "Pending artifact metadata");
            throwIfCancelled(cancellationSignal);
            const marker = { schemaVersion: 1, contract: "dokkan-game-db-artifact-commit", contractVersion: "1.0.0", identity, metadataSha256: (0, crypto_1.createHash)("sha256").update(metadataText).digest("hex") };
            const markerPath = (0, path_1.resolve)(pending.path, "commit-marker.json");
            throwIfCancelled(cancellationSignal);
            await writeExclusiveStableFile(guard, markerPath, pending.path, canonicalJson(marker), "Pending artifact commit marker");
            throwIfCancelled(cancellationSignal);
            const snapshot = await openArtifactMaterialSnapshot(guard, pending, identity, metadata, cancellationSignal);
            try {
                try {
                    await guard.promoteArtifactDirectoryCreateOnly(snapshot, finalDirectory, cancellationSignal);
                    pending = undefined;
                }
                catch (error) {
                    if (!(error instanceof ArtifactDestinationOccupiedError))
                        throw error;
                    // An externally introduced destination is never replaced or
                    // removed. It may win only when it independently validates
                    // as the complete immutable commit for this exact identity.
                    await validateCommittedArtifact(guard, artifactsRoot, identity, metadata, cancellationSignal);
                    await guard.removeDirectory(pending.path, pending.identity, [...ARTIFACT_MEMBER_NAMES]);
                    pending = undefined;
                    reused = true;
                }
            }
            finally {
                await closeArtifactMaterialSnapshot(snapshot);
            }
            throwIfCancelled(cancellationSignal);
        }
        await validateCommittedArtifact(guard, artifactsRoot, identity, metadata, cancellationSignal);
        throwIfCancelled(cancellationSignal);
        const receipt = {
            ...receiptBase(descriptor, metadata, identity),
            mode: "official_descriptor_download",
            acquiredAt: operationTimestamp(options.now),
            result: reused ? "reused" : "acquired",
        };
        throwIfCancelled(cancellationSignal);
        const receiptPath = await writeOperationalReceipt(guard, receipt, cancellationSignal);
        throwIfCancelled(cancellationSignal);
        const journalCommit = await appendArtifactPointerRecord(guard, artifactsRoot, identity, cancellationSignal);
        return {
            identity,
            artifactPath: (0, path_1.resolve)(finalDirectory, "database.db"),
            metadataPath: (0, path_1.resolve)(finalDirectory, "metadata.json"),
            commitMarkerPath: (0, path_1.resolve)(finalDirectory, "commit-marker.json"),
            pointerJournalDirectory: journalCommit.selection.directory,
            pointerRecordPath: journalCommit.recordPath,
            journalCurrentIdentity: journalCommit.selection.current.record.identity,
            journalPreviousIdentity: journalCommit.selection.previous?.record.identity ?? null,
            metadata,
            reused,
            receiptPath,
            receipt,
        };
    }
    catch (error) {
        controller.abort();
        if (guard.trackedRegularFile(temporaryPath)) {
            try {
                await guard.moveTrackedRegularFileToHistory(temporaryPath, guard.root, "Failed download staging history");
            }
            catch {
                if (guard.trackedRegularFile(temporaryPath))
                    await guard.discardTrackedRegularFile(temporaryPath, guard.root, "Failed download staging discard").catch(() => undefined);
            }
        }
        if (pending)
            await guard.removeDirectory(pending.path, pending.identity, ["database.db", "metadata.json", "commit-marker.json"]).catch(() => undefined);
        throw error;
    }
    finally {
        options.signal?.removeEventListener("abort", onAbort);
    }
}
exports.acquireDatabaseArtifact = acquireDatabaseArtifact;
async function runDownloadDatabaseArtifact(options, dependencies = {}) {
    if (!options.descriptorJson)
        throw new Error("Descriptor input is required");
    const descriptor = await readAndValidateDatabaseDescriptor(options.descriptorJson);
    const { url: _url, ...sanitized } = descriptor;
    if (options.artifactPath) {
        const inspection = await inspectDownloadedDatabaseArtifact(options.artifactPath);
        const metadata = metadataFor(descriptor, inspection);
        const identity = artifactIdentity(metadata);
        const guard = await ArtifactStoreGuard.open(options.storeRoot);
        const receipt = {
            ...receiptBase(descriptor, metadata, identity),
            mode: "offline_existing_artifact_validation",
            validatedAt: operationTimestamp(dependencies.now),
            result: "validated",
        };
        const receiptPath = await writeOperationalReceipt(guard, receipt);
        return { mode: "artifact_validation", descriptor: sanitized, inspection, identity, receiptPath, receipt };
    }
    if (!options.authorizeDownload || options.dryRun) {
        return { mode: "descriptor_validation", descriptor: sanitized };
    }
    const rawDescriptor = {
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
exports.runDownloadDatabaseArtifact = runDownloadDatabaseArtifact;
async function main() {
    const options = parseDownloadDatabaseArtifactArgs(process.argv.slice(2));
    const result = await runDownloadDatabaseArtifact(options);
    if (result.mode === "authorized_download") {
        console.log(`Acquired immutable database artifact ${result.result.identity}`);
        console.log(`Artifact state: ${result.result.metadata.artifactState}`);
        console.log(`Wrote operational receipt to ${result.result.receiptPath}`);
    }
    else if (result.mode === "artifact_validation") {
        console.log(JSON.stringify({ mode: result.mode, descriptor: result.descriptor, inspection: result.inspection, identity: result.identity, receipt: result.receipt }, null, 2));
        console.log(`Wrote operational receipt to ${result.receiptPath}`);
    }
    else {
        console.log(JSON.stringify(result, null, 2));
    }
}
if (require.main === module) {
    main().catch(error => { console.error(error); process.exitCode = 1; });
}
//# sourceMappingURL=game-db-download-database-artifact.js.map