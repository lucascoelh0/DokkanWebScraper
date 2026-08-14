"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateDerivedSqliteArtifact = void 0;
const crypto_1 = require("crypto");
const promises_1 = require("fs/promises");
const path_1 = require("path");
const game_db_derived_sqlite_artifact_contract_1 = require("./game-db-derived-sqlite-artifact-contract");
const game_db_download_database_artifact_1 = require("./game-db-download-database-artifact");
const DERIVED_MEMBER_NAMES = ["database.sqlite", "metadata.json", "commit-marker.json"];
const JSON_MEMBER_MAX_BYTES = 64 * 1024;
function isJsonObject(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value);
}
function exactKeys(value, expected) {
    return JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...expected].sort());
}
function samePath(left, right) {
    return process.platform === "win32" ? (0, path_1.resolve)(left).toLowerCase() === (0, path_1.resolve)(right).toLowerCase() : (0, path_1.resolve)(left) === (0, path_1.resolve)(right);
}
function isContained(parent, child) {
    const value = (0, path_1.relative)((0, path_1.resolve)(parent), (0, path_1.resolve)(child));
    return value !== "" && !value.startsWith("..") && !(0, path_1.isAbsolute)(value);
}
function pathsOverlap(left, right) {
    return samePath(left, right) || isContained(left, right) || isContained(right, left);
}
function fileIdentity(path, metadata) {
    if (!metadata.isFile() || metadata.isSymbolicLink())
        throw new Error("Derived artifact member must be a regular file");
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
function sameFileIdentity(left, right) {
    return left.dev === right.dev && left.ino === right.ino && left.nlink === right.nlink && left.size === right.size && left.mode === right.mode
        && left.birthtimeNs === right.birthtimeNs && left.mtimeNs === right.mtimeNs && left.ctimeNs === right.ctimeNs;
}
async function captureDirectory(path, label) {
    const target = (0, path_1.resolve)(path);
    let metadata;
    let canonical;
    try {
        metadata = await (0, promises_1.lstat)(target, { bigint: true });
        canonical = (0, path_1.resolve)(await (0, promises_1.realpath)(target));
    }
    catch {
        throw new Error(`${label} must be an existing real directory`);
    }
    if (!metadata.isDirectory() || metadata.isSymbolicLink() || !samePath(canonical, target)) {
        throw new Error(`${label} must not be a symlink, junction or reparse escape`);
    }
    return {
        path: target,
        realPath: canonical,
        dev: BigInt(metadata.dev).toString(),
        ino: BigInt(metadata.ino).toString(),
        mode: Number(metadata.mode),
        birthtimeNs: BigInt(metadata.birthtimeNs).toString(),
        mtimeNs: BigInt(metadata.mtimeNs).toString(),
        ctimeNs: BigInt(metadata.ctimeNs).toString(),
    };
}
async function assertSameDirectory(expected, label) {
    const actual = await captureDirectory(expected.path, label);
    if (!samePath(actual.realPath, expected.realPath) || actual.dev !== expected.dev || actual.ino !== expected.ino || actual.mode !== expected.mode) {
        throw new Error(`${label} changed during validation`);
    }
}
function directoryBinding(identity, includeMutableTimes = true) {
    return {
        dev: identity.dev,
        ino: identity.ino,
        mode: identity.mode,
        ...(includeMutableTimes ? { birthtimeNs: identity.birthtimeNs, mtimeNs: identity.mtimeNs, ctimeNs: identity.ctimeNs } : {}),
    };
}
function memberBinding(identity) {
    return {
        dev: identity.dev,
        ino: identity.ino,
        nlink: identity.nlink,
        size: identity.size,
        mode: identity.mode,
        birthtimeNs: identity.birthtimeNs,
        mtimeNs: identity.mtimeNs,
        ctimeNs: identity.ctimeNs,
    };
}
async function captureAqParentBinding(sourceStoreRoot, parent) {
    const sourceRoot = await captureDirectory(sourceStoreRoot, "Derived artifact AQ source store root");
    const sourceRootParent = samePath((0, path_1.dirname)(sourceRoot.path), sourceRoot.path)
        ? sourceRoot
        : await captureDirectory((0, path_1.dirname)(sourceRoot.path), "Derived artifact AQ source store parent");
    const artifactsRoot = await captureDirectory((0, path_1.dirname)(parent.artifactDirectory), "Derived artifact AQ objects directory");
    const artifactDirectory = await captureDirectory(parent.artifactDirectory, "Derived artifact AQ parent commit directory");
    const members = {};
    for (const [name, path] of Object.entries({
        "database.db": parent.artifactPath,
        "metadata.json": parent.metadataPath,
        "commit-marker.json": parent.commitMarkerPath,
    })) {
        const identity = await capturePathFile(path, artifactDirectory.path, `Derived artifact AQ parent ${name}`);
        assertImmutableMember(identity, `Derived artifact AQ parent ${name}`);
        members[name] = memberBinding(identity);
    }
    return {
        sourceRootParent: directoryBinding(sourceRootParent),
        sourceRoot: directoryBinding(sourceRoot),
        artifactsRoot: directoryBinding(artifactsRoot),
        artifactDirectory: directoryBinding(artifactDirectory),
        members,
    };
}
function directoryChain(path) {
    const result = [];
    let current = (0, path_1.resolve)(path);
    while (true) {
        result.unshift(current);
        const parent = (0, path_1.dirname)(current);
        if (parent === current)
            return result;
        current = parent;
    }
}
async function captureExistingDirectoryChain(path) {
    const identities = [];
    for (const segment of directoryChain(path))
        identities.push(await captureDirectory(segment, "Derived artifact store path"));
    return identities;
}
async function capturePathFile(path, parent, label) {
    const target = (0, path_1.resolve)(path);
    if (!isContained(parent, target) || !samePath((0, path_1.dirname)(target), parent))
        throw new Error(`${label} escapes its controlled directory`);
    let metadata;
    let canonical;
    try {
        metadata = await (0, promises_1.lstat)(target, { bigint: true });
        canonical = (0, path_1.resolve)(await (0, promises_1.realpath)(target));
    }
    catch {
        throw new Error(`${label} must be an existing regular file`);
    }
    if (!samePath(canonical, target) || !samePath((0, path_1.dirname)(canonical), parent))
        throw new Error(`${label} is a symlink or reparse escape`);
    return fileIdentity(target, metadata);
}
async function captureHandleFile(handle, path, label) {
    try {
        return fileIdentity(path, await handle.stat({ bigint: true }));
    }
    catch {
        throw new Error(`${label} must remain a regular file`);
    }
}
function assertImmutableMember(identity, label) {
    if (identity.nlink !== "1")
        throw new Error(`${label} must have exactly one hard link`);
    if ((identity.mode & 0o222) !== 0)
        throw new Error(`${label} must be read-only`);
}
async function readBoundedText(handle, identity, label) {
    const size = Number(identity.size);
    if (!Number.isSafeInteger(size) || size <= 0 || size > JSON_MEMBER_MAX_BYTES)
        throw new Error(`${label} size is invalid`);
    const buffer = Buffer.alloc(size);
    let offset = 0;
    while (offset < size) {
        const result = await handle.read(buffer, offset, size - offset, offset);
        if (result.bytesRead <= 0)
            throw new Error(`${label} ended before its declared size`);
        offset += result.bytesRead;
    }
    return buffer.toString("utf8");
}
async function inspectSqlite(handle, identity) {
    const sizeBytes = Number(identity.size);
    if (!Number.isSafeInteger(sizeBytes) || sizeBytes <= 0 || sizeBytes > game_db_derived_sqlite_artifact_contract_1.DERIVED_SQLITE_MAX_BYTES)
        throw new Error("Derived SQLite size is outside the allowed range");
    const hash = (0, crypto_1.createHash)("sha256");
    const buffer = Buffer.allocUnsafe(64 * 1024);
    const header = Buffer.alloc(112);
    let offset = 0;
    while (offset < sizeBytes) {
        const length = Math.min(buffer.length, sizeBytes - offset);
        const result = await handle.read(buffer, 0, length, offset);
        if (result.bytesRead <= 0)
            throw new Error("Derived SQLite ended before its declared size");
        if (offset < header.length)
            buffer.copy(header, offset, 0, Math.min(result.bytesRead, header.length - offset));
        hash.update(buffer.subarray(0, result.bytesRead));
        offset += result.bytesRead;
    }
    if (sizeBytes < 512 || !header.subarray(0, game_db_derived_sqlite_artifact_contract_1.DERIVED_SQLITE_HEADER.length).equals(game_db_derived_sqlite_artifact_contract_1.DERIVED_SQLITE_HEADER))
        throw new Error("Derived output is not plain SQLite");
    const encodedPageSize = header.readUInt16BE(16);
    const pageSize = encodedPageSize === 1 ? 65536 : encodedPageSize;
    if (pageSize < 512 || pageSize > 65536 || (pageSize & (pageSize - 1)) !== 0 || sizeBytes % pageSize !== 0
        || ![1, 2].includes(header[18]) || ![1, 2].includes(header[19]) || header[21] !== 64 || header[22] !== 32 || header[23] !== 32
        || header.readUInt32BE(44) < 1 || header.readUInt32BE(44) > 4 || header.readUInt32BE(56) < 1 || header.readUInt32BE(56) > 3
        || ![5, 13].includes(header[100])) {
        throw new Error("Derived output does not have a valid plain SQLite header");
    }
    return { sha256: hash.digest("hex"), sizeBytes };
}
async function validateDerivedSqliteArtifact(options) {
    if (arguments.length !== 1 || !isJsonObject(options) || !exactKeys(options, ["storeRoot", "sourceStoreRoot", "artifactIdentity"]))
        throw new Error("Derived artifact validation options are invalid");
    if (typeof options.storeRoot !== "string" || options.storeRoot.length === 0 || options.storeRoot.includes("\0"))
        throw new Error("Derived artifact storeRoot is invalid");
    if (typeof options.sourceStoreRoot !== "string" || options.sourceStoreRoot.length === 0 || options.sourceStoreRoot.includes("\0"))
        throw new Error("Derived artifact sourceStoreRoot is invalid");
    if (typeof options.artifactIdentity !== "string" || !/^[a-f0-9]{64}$/.test(options.artifactIdentity))
        throw new Error("Derived artifact identity is invalid");
    const storeRoot = (0, path_1.resolve)(options.storeRoot);
    const sourceStoreRoot = (0, path_1.resolve)(options.sourceStoreRoot);
    if (pathsOverlap(storeRoot, sourceStoreRoot))
        throw new Error("AQ and derived validation roots must be separate and non-overlapping");
    const chain = await captureExistingDirectoryChain(storeRoot);
    const root = chain[chain.length - 1];
    const rootParent = chain.length > 1 ? chain[chain.length - 2] : root;
    const artifactsRootPath = (0, path_1.resolve)(storeRoot, "artifacts");
    if (!isContained(storeRoot, artifactsRootPath))
        throw new Error("Derived artifact namespace containment is invalid");
    const artifactsRoot = await captureDirectory(artifactsRootPath, "Derived artifact objects directory");
    const artifactDirectoryPath = (0, path_1.resolve)(artifactsRoot.path, options.artifactIdentity);
    if (!isContained(artifactsRoot.path, artifactDirectoryPath))
        throw new Error("Derived artifact directory escapes the object namespace");
    const artifactDirectory = await captureDirectory(artifactDirectoryPath, "Derived artifact commit directory");
    const entries = await (0, promises_1.readdir)(artifactDirectory.path, { withFileTypes: true });
    if (entries.length !== DERIVED_MEMBER_NAMES.length || entries.some(entry => !DERIVED_MEMBER_NAMES.includes(entry.name) || !entry.isFile() || entry.isSymbolicLink())) {
        throw new Error("Derived artifact commit members do not match the exact contract");
    }
    const opened = new Map();
    try {
        for (const name of DERIVED_MEMBER_NAMES) {
            const path = (0, path_1.resolve)(artifactDirectory.path, name);
            const pathIdentity = await capturePathFile(path, artifactDirectory.path, `Derived artifact ${name}`);
            assertImmutableMember(pathIdentity, `Derived artifact ${name}`);
            const handle = await (0, promises_1.open)(path, "r");
            try {
                const handleIdentity = await captureHandleFile(handle, path, `Derived artifact ${name}`);
                assertImmutableMember(handleIdentity, `Derived artifact ${name}`);
                if (!sameFileIdentity(pathIdentity, handleIdentity))
                    throw new Error(`Derived artifact ${name} pathname changed before opening`);
                const member = { path, handle, identity: handleIdentity };
                if (name === "database.sqlite")
                    member.sqlite = await inspectSqlite(handle, handleIdentity);
                else
                    member.text = await readBoundedText(handle, handleIdentity, `Derived artifact ${name}`);
                opened.set(name, member);
            }
            catch (error) {
                await handle.close();
                throw error;
            }
        }
        const metadataText = opened.get("metadata.json").text;
        let metadataValue;
        try {
            metadataValue = JSON.parse(metadataText);
        }
        catch {
            throw new Error("Derived artifact metadata JSON is malformed");
        }
        const metadata = (0, game_db_derived_sqlite_artifact_contract_1.parseDerivedSqliteArtifactMetadata)(metadataValue);
        if (metadataText !== (0, game_db_derived_sqlite_artifact_contract_1.canonicalDerivedJson)(metadata) || (0, game_db_derived_sqlite_artifact_contract_1.derivedSqliteArtifactIdentity)(metadata) !== options.artifactIdentity)
            throw new Error("Derived artifact metadata identity does not validate");
        const sqlite = opened.get("database.sqlite").sqlite;
        if (sqlite.sizeBytes !== metadata.output.sizeBytes || sqlite.sha256 !== metadata.output.sha256 || metadata.output.state !== "readable_sqlite") {
            throw new Error("Derived artifact output bytes do not match metadata");
        }
        const markerText = opened.get("commit-marker.json").text;
        let markerValue;
        try {
            markerValue = JSON.parse(markerText);
        }
        catch {
            throw new Error("Derived artifact commit marker JSON is malformed");
        }
        const marker = (0, game_db_derived_sqlite_artifact_contract_1.parseDerivedSqliteCommitMarker)(markerValue);
        const metadataSha256 = (0, crypto_1.createHash)("sha256").update(metadataText).digest("hex");
        if (markerText !== (0, game_db_derived_sqlite_artifact_contract_1.canonicalDerivedJson)(marker) || marker.identity !== options.artifactIdentity || marker.metadataSha256 !== metadataSha256) {
            throw new Error("Derived artifact commit marker does not validate");
        }
        const parent = await (0, game_db_download_database_artifact_1.validateAcquiredDatabaseArtifact)({ storeRoot: sourceStoreRoot, artifactIdentity: metadata.parent.artifactIdentity });
        if (parent.identity !== metadata.parent.artifactIdentity || parent.metadata.localSha256 !== metadata.parent.sourceSha256
            || parent.metadata.observedSizeBytes !== metadata.parent.sourceSizeBytes || parent.metadata.artifactState !== metadata.parent.sourceState) {
            throw new Error("Derived artifact AQ parent lineage does not validate materially");
        }
        const aqParentBinding = await captureAqParentBinding(sourceStoreRoot, parent);
        for (const member of opened.values()) {
            const after = await captureHandleFile(member.handle, member.path, "Derived artifact member");
            const pathAfter = await capturePathFile(member.path, artifactDirectory.path, "Derived artifact member");
            if (!sameFileIdentity(member.identity, after) || !sameFileIdentity(after, pathAfter))
                throw new Error("Derived artifact member changed during validation");
        }
        await assertSameDirectory(artifactDirectory, "Derived artifact commit directory");
        await assertSameDirectory(artifactsRoot, "Derived artifact objects directory");
        await assertSameDirectory(root, "Derived artifact store root");
        for (const identity of chain)
            await assertSameDirectory(identity, "Derived artifact store path");
        const revalidatedParent = await (0, game_db_download_database_artifact_1.validateAcquiredDatabaseArtifact)({ storeRoot: sourceStoreRoot, artifactIdentity: metadata.parent.artifactIdentity });
        if (revalidatedParent.identity !== parent.identity || JSON.stringify(revalidatedParent.metadata) !== JSON.stringify(parent.metadata)) {
            throw new Error("Derived artifact AQ parent changed during validation");
        }
        const revalidatedAqParentBinding = await captureAqParentBinding(sourceStoreRoot, revalidatedParent);
        if (JSON.stringify(revalidatedAqParentBinding) !== JSON.stringify(aqParentBinding)) {
            throw new Error("Derived artifact AQ parent material changed during validation");
        }
        const derivedMembers = {};
        for (const name of DERIVED_MEMBER_NAMES)
            derivedMembers[name] = memberBinding(opened.get(name).identity);
        const binding = {
            rootParent: directoryBinding(rootParent),
            artifactsRoot: directoryBinding(artifactsRoot),
            artifactDirectory: directoryBinding(artifactDirectory),
            members: derivedMembers,
            aqParent: aqParentBinding,
        };
        const materialBinding = (0, crypto_1.createHash)("sha256").update(JSON.stringify({ ...binding, root: directoryBinding(root, false) })).digest("hex");
        const operationBinding = (0, crypto_1.createHash)("sha256").update(JSON.stringify({ ...binding, root: directoryBinding(root) })).digest("hex");
        return {
            identity: options.artifactIdentity,
            artifactDirectory: artifactDirectory.path,
            artifactPath: (0, path_1.resolve)(artifactDirectory.path, "database.sqlite"),
            metadataPath: (0, path_1.resolve)(artifactDirectory.path, "metadata.json"),
            commitMarkerPath: (0, path_1.resolve)(artifactDirectory.path, "commit-marker.json"),
            metadata,
            materialBinding,
            operationBinding,
        };
    }
    finally {
        await Promise.all([...opened.values()].map(member => member.handle.close().catch(() => undefined)));
    }
}
exports.validateDerivedSqliteArtifact = validateDerivedSqliteArtifact;
//# sourceMappingURL=game-db-derived-sqlite-artifact-validator.js.map