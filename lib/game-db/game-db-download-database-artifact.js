"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runDownloadDatabaseArtifact = exports.acquireDatabaseArtifact = exports.readAndValidateDatabaseDescriptor = exports.validateClientAssetsDatabaseDescriptor = exports.parseDownloadDatabaseArtifactArgs = exports.DEFAULT_DATABASE_ARTIFACT_TIMEOUT_MS = exports.DEFAULT_DATABASE_ARTIFACT_MAX_BYTES = void 0;
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
    return { path: resolved, realPath: (0, path_1.resolve)(canonical), dev: BigInt(metadata.dev).toString(), ino: BigInt(metadata.ino).toString(), mode: metadata.mode };
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
        size: BigInt(metadata.size).toString(),
        mode: metadata.mode,
        mtimeNs: BigInt(metadata.mtimeNs).toString(),
        ctimeNs: BigInt(metadata.ctimeNs).toString(),
    };
}
function sameFileIdentity(left, right, includeMutableAttributes = true) {
    return left.dev === right.dev && left.ino === right.ino && left.mode === right.mode
        && (!includeMutableAttributes || (left.size === right.size && left.mtimeNs === right.mtimeNs && left.ctimeNs === right.ctimeNs));
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
    async promoteDirectory(from, to) {
        await this.assertStable();
        const source = this.ensureContained(from), target = this.ensureContained(to);
        const identity = this.directories.get(source);
        if (!identity || !await sameDirectoryIdentity(identity))
            throw new Error("Pending artifact directory identity changed");
        await (0, promises_1.rename)(source, target);
        this.directories.delete(source);
        const promoted = await captureDirectoryIdentity(target, "Committed artifact directory");
        if (promoted.dev !== identity.dev || promoted.ino !== identity.ino)
            throw new Error("Artifact directory identity changed during promotion");
        this.directories.set(target, promoted);
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
    async cloneTrackedRegularFileCreateOnly(from, fromParent, to, toParent, signal) {
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
        // link(2) is create-only: unlike rename(), it cannot overwrite a target
        // that appears after validation.  The source is retained until the new
        // pathname has independently proved the same inode and attributes.
        await (0, promises_1.link)(source, target);
        const linkedSource = await capturePathFileIdentity(source, "Artifact store source file after link");
        const installed = await capturePathFileIdentity(target, "Installed artifact store file");
        if (!sameFileIdentity(linkedSource, installed) || !sameFileIdentity(identity, linkedSource, false)) {
            throw new Error("Installed artifact store file identity changed during create-only promotion");
        }
        this.files.set(source, linkedSource);
        this.files.set(target, installed);
        await this.assertStable();
        return installed;
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
    const entries = (await (0, promises_1.readdir)(directory, { withFileTypes: true })).map(value => value.name).sort();
    if (JSON.stringify(entries) !== JSON.stringify(["commit-marker.json", "database.db", "metadata.json"]))
        throw new Error("Committed artifact members are incomplete or unexpected");
    const artifactPath = (0, path_1.resolve)(directory, "database.db");
    const metadataPath = (0, path_1.resolve)(directory, "metadata.json");
    const markerPath = (0, path_1.resolve)(directory, "commit-marker.json");
    const storedMetadataText = await readStableTextFile(guard, metadataPath, directory, "Committed artifact metadata", signal);
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
    const inspection = await inspectRegularArtifact(artifactPath, exports.DEFAULT_DATABASE_ARTIFACT_MAX_BYTES, guard, directory, signal);
    if (JSON.stringify(inspection) !== JSON.stringify({ observedSizeBytes: metadata.observedSizeBytes, localSha256: metadata.localSha256, artifactState: metadata.artifactState }))
        throw new Error("Existing immutable artifact identity does not validate");
    const markerText = await readStableTextFile(guard, markerPath, directory, "Committed artifact marker", signal);
    const expectedMarker = canonicalJson({ schemaVersion: 1, contract: "dokkan-game-db-artifact-commit", contractVersion: "1.0.0", identity, metadataSha256: (0, crypto_1.createHash)("sha256").update(storedMetadataText).digest("hex") });
    if (markerText !== expectedMarker)
        throw new Error("Existing immutable artifact commit marker does not validate");
    await guard.assertStable();
    return metadata;
}
function parseLatestPointer(text) {
    let value;
    try {
        value = JSON.parse(text);
    }
    catch {
        throw new Error("Existing latest pointer is invalid");
    }
    if (!isJsonObject(value) || !exactKeys(value, ["schemaVersion", "contract", "contractVersion", "currentIdentity", "previousIdentity"])
        || value.schemaVersion !== 1 || value.contract !== "dokkan-game-db-local-latest" || value.contractVersion !== "1.0.0"
        || typeof value.currentIdentity !== "string" || !/^[a-f0-9]{64}$/.test(value.currentIdentity)
        || !(value.previousIdentity === null || (typeof value.previousIdentity === "string" && /^[a-f0-9]{64}$/.test(value.previousIdentity)))
        || value.currentIdentity === value.previousIdentity)
        throw new Error("Existing latest pointer is invalid or cyclic");
    return value;
}
function throwIfCancelled(signal) {
    if (signal.aborted)
        throw new Error("Database artifact acquisition cancelled");
}
async function promoteLatest(guard, artifactsRoot, identity, signal) {
    const latestPath = (0, path_1.resolve)(guard.root, "latest.json");
    await validateCommittedArtifact(guard, artifactsRoot, identity, undefined, signal);
    let originalText = null;
    let originalIdentity;
    let previousIdentity = null;
    let latestExists = false;
    try {
        await (0, promises_1.lstat)(latestPath);
        latestExists = true;
    }
    catch (error) {
        if (error?.code !== "ENOENT")
            throw error;
    }
    if (latestExists) {
        originalText = await readStableTextFile(guard, latestPath, guard.root, "Existing latest pointer", signal);
        originalIdentity = guard.trackedRegularFile(latestPath);
        if (!originalIdentity)
            throw new Error("Existing latest pointer identity was not retained");
        const current = parseLatestPointer(originalText);
        await validateCommittedArtifact(guard, artifactsRoot, current.currentIdentity, undefined, signal);
        if (current.previousIdentity)
            await validateCommittedArtifact(guard, artifactsRoot, current.previousIdentity, undefined, signal);
        previousIdentity = current.currentIdentity === identity
            ? current.previousIdentity
            : current.currentIdentity;
    }
    if (previousIdentity === identity)
        throw new Error("Latest pointer would create an identity cycle");
    const pointer = { schemaVersion: 1, contract: "dokkan-game-db-local-latest", contractVersion: "1.0.0", currentIdentity: identity, previousIdentity };
    let priorHistory;
    let promotedIdentity;
    throwIfCancelled(signal);
    try {
        if (originalIdentity) {
            priorHistory = await guard.moveTrackedRegularFileToHistory(latestPath, guard.root, "Prior latest pointer history", signal, true, ".latest-history");
            if (!sameFileIdentity(originalIdentity, priorHistory.identity, false))
                throw new Error("Prior latest pointer history did not retain the validated identity");
        }
        promotedIdentity = await writeExclusiveStableFile(guard, latestPath, guard.root, canonicalJson(pointer), "Latest pointer");
        const rollback = async () => {
            await guard.assertStable();
            if (!promotedIdentity)
                throw new Error("Promoted latest pointer identity is unavailable for rollback");
            const movedCurrent = await guard.moveTrackedRegularFileToHistory(latestPath, guard.root, "Rolled-back latest pointer history", signal, false, ".latest-history");
            if (!sameFileIdentity(promotedIdentity, movedCurrent.identity, false))
                throw new Error("Rollback moved a replacement latest pointer; it was retained for recovery");
            if (originalText !== null) {
                if (!priorHistory || !guard.trackedRegularFile(priorHistory.path))
                    throw new Error("Validated prior latest pointer history is unavailable for rollback");
                await guard.cloneTrackedRegularFileCreateOnly(priorHistory.path, (0, path_1.dirname)(priorHistory.path), latestPath, guard.root);
            }
        };
        try {
            throwIfCancelled(signal);
        }
        catch (error) {
            await rollback();
            throw error;
        }
        return { path: latestPath, rollback };
    }
    catch (error) {
        if (!promotedIdentity && priorHistory && guard.trackedRegularFile(priorHistory.path)) {
            try {
                await guard.cloneTrackedRegularFileCreateOnly(priorHistory.path, (0, path_1.dirname)(priorHistory.path), latestPath, guard.root);
            }
            catch { /* retain validated history; never overwrite an occupied latest pathname */ }
        }
        throw error;
    }
}
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
        await guard.cloneTrackedRegularFileCreateOnly(temporary, receiptsRoot, target, receiptsRoot, signal);
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
    const lockPath = (0, path_1.resolve)(guard.root, ".acquisition.lock");
    let lock;
    try {
        lock = await guard.createExclusiveDirectory(lockPath, "Artifact store writer lock");
    }
    catch {
        throw new Error("Database artifact acquisition already has an active writer or unsafe lock path");
    }
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
    let latestCommit;
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
            await guard.cloneTrackedRegularFileCreateOnly(temporaryPath, guard.root, artifactPath, pending.path, cancellationSignal);
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
            await guard.promoteDirectory(pending.path, finalDirectory);
            pending = undefined;
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
        latestCommit = await promoteLatest(guard, artifactsRoot, identity, cancellationSignal);
        throwIfCancelled(cancellationSignal);
        return {
            identity,
            artifactPath: (0, path_1.resolve)(finalDirectory, "database.db"),
            metadataPath: (0, path_1.resolve)(finalDirectory, "metadata.json"),
            commitMarkerPath: (0, path_1.resolve)(finalDirectory, "commit-marker.json"),
            latestPointerPath: latestCommit.path,
            metadata,
            reused,
            receiptPath,
            receipt,
        };
    }
    catch (error) {
        controller.abort();
        if (latestCommit)
            await latestCommit.rollback().catch(() => undefined);
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
        await guard.removeDirectory(lock.path, lock.identity, []);
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
        const lockPath = (0, path_1.resolve)(guard.root, ".acquisition.lock");
        let lock;
        try {
            lock = await guard.createExclusiveDirectory(lockPath, "Artifact store writer lock");
        }
        catch {
            throw new Error("Database artifact acquisition already has an active writer or unsafe lock path");
        }
        const receipt = {
            ...receiptBase(descriptor, metadata, identity),
            mode: "offline_existing_artifact_validation",
            validatedAt: operationTimestamp(dependencies.now),
            result: "validated",
        };
        try {
            const receiptPath = await writeOperationalReceipt(guard, receipt);
            return { mode: "artifact_validation", descriptor: sanitized, inspection, identity, receiptPath, receipt };
        }
        finally {
            await guard.removeDirectory(lock.path, lock.identity, []);
        }
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