import { createHash } from "crypto";
import { FileHandle, lstat, open, readdir, realpath } from "fs/promises";
import { dirname, isAbsolute, relative, resolve } from "path";
import {
    canonicalDerivedJson,
    DERIVED_SQLITE_HEADER,
    DERIVED_SQLITE_MAX_BYTES,
    derivedSqliteArtifactIdentity,
    GameDbDerivedSqliteArtifactMetadata,
    parseDerivedSqliteArtifactMetadata,
    parseDerivedSqliteCommitMarker,
} from "./game-db-derived-sqlite-artifact-contract";
import { validateAcquiredDatabaseArtifact } from "./game-db-download-database-artifact";

const DERIVED_MEMBER_NAMES = ["database.sqlite", "metadata.json", "commit-marker.json"] as const;
const JSON_MEMBER_MAX_BYTES = 64 * 1024;

interface DirectoryIdentity {
    path: string,
    realPath: string,
    dev: string,
    ino: string,
    mode: number,
}

interface FileIdentity {
    path: string,
    dev: string,
    ino: string,
    nlink: string,
    size: string,
    mode: number,
    birthtimeNs: string,
    mtimeNs: string,
    ctimeNs: string,
}

export interface ValidateDerivedSqliteArtifactOptions {
    storeRoot: string,
    sourceStoreRoot: string,
    artifactIdentity: string,
}

export interface ValidatedDerivedSqliteArtifact {
    identity: string,
    artifactDirectory: string,
    artifactPath: string,
    metadataPath: string,
    commitMarkerPath: string,
    metadata: GameDbDerivedSqliteArtifactMetadata,
}

function isJsonObject(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === "object" && !Array.isArray(value);
}

function exactKeys(value: Record<string, unknown>, expected: string[]): boolean {
    return JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...expected].sort());
}

function samePath(left: string, right: string): boolean {
    return process.platform === "win32" ? resolve(left).toLowerCase() === resolve(right).toLowerCase() : resolve(left) === resolve(right);
}

function isContained(parent: string, child: string): boolean {
    const value = relative(resolve(parent), resolve(child));
    return value !== "" && !value.startsWith("..") && !isAbsolute(value);
}

function pathsOverlap(left: string, right: string): boolean {
    return samePath(left, right) || isContained(left, right) || isContained(right, left);
}

function fileIdentity(path: string, metadata: any): FileIdentity {
    if (!metadata.isFile() || metadata.isSymbolicLink()) throw new Error("Derived artifact member must be a regular file");
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

function sameFileIdentity(left: FileIdentity, right: FileIdentity): boolean {
    return left.dev === right.dev && left.ino === right.ino && left.nlink === right.nlink && left.size === right.size && left.mode === right.mode
        && left.birthtimeNs === right.birthtimeNs && left.mtimeNs === right.mtimeNs && left.ctimeNs === right.ctimeNs;
}

async function captureDirectory(path: string, label: string): Promise<DirectoryIdentity> {
    const target = resolve(path);
    let metadata: any;
    let canonical: string;
    try {
        metadata = await lstat(target, { bigint: true });
        canonical = resolve(await realpath(target));
    } catch { throw new Error(`${label} must be an existing real directory`); }
    if (!metadata.isDirectory() || metadata.isSymbolicLink() || !samePath(canonical, target)) {
        throw new Error(`${label} must not be a symlink, junction or reparse escape`);
    }
    return { path: target, realPath: canonical, dev: BigInt(metadata.dev).toString(), ino: BigInt(metadata.ino).toString(), mode: Number(metadata.mode) };
}

async function assertSameDirectory(expected: DirectoryIdentity, label: string): Promise<void> {
    const actual = await captureDirectory(expected.path, label);
    if (!samePath(actual.realPath, expected.realPath) || actual.dev !== expected.dev || actual.ino !== expected.ino || actual.mode !== expected.mode) {
        throw new Error(`${label} changed during validation`);
    }
}

function directoryChain(path: string): string[] {
    const result: string[] = [];
    let current = resolve(path);
    while (true) {
        result.unshift(current);
        const parent = dirname(current);
        if (parent === current) return result;
        current = parent;
    }
}

async function captureExistingDirectoryChain(path: string): Promise<DirectoryIdentity[]> {
    const identities: DirectoryIdentity[] = [];
    for (const segment of directoryChain(path)) identities.push(await captureDirectory(segment, "Derived artifact store path"));
    return identities;
}

async function capturePathFile(path: string, parent: string, label: string): Promise<FileIdentity> {
    const target = resolve(path);
    if (!isContained(parent, target) || !samePath(dirname(target), parent)) throw new Error(`${label} escapes its controlled directory`);
    let metadata: any;
    let canonical: string;
    try {
        metadata = await lstat(target, { bigint: true });
        canonical = resolve(await realpath(target));
    } catch { throw new Error(`${label} must be an existing regular file`); }
    if (!samePath(canonical, target) || !samePath(dirname(canonical), parent)) throw new Error(`${label} is a symlink or reparse escape`);
    return fileIdentity(target, metadata);
}

async function captureHandleFile(handle: FileHandle, path: string, label: string): Promise<FileIdentity> {
    try { return fileIdentity(path, await handle.stat({ bigint: true })); }
    catch { throw new Error(`${label} must remain a regular file`); }
}

function assertImmutableMember(identity: FileIdentity, label: string): void {
    if (identity.nlink !== "1") throw new Error(`${label} must have exactly one hard link`);
    if ((identity.mode & 0o222) !== 0) throw new Error(`${label} must be read-only`);
}

async function readBoundedText(handle: FileHandle, identity: FileIdentity, label: string): Promise<string> {
    const size = Number(identity.size);
    if (!Number.isSafeInteger(size) || size <= 0 || size > JSON_MEMBER_MAX_BYTES) throw new Error(`${label} size is invalid`);
    const buffer = Buffer.alloc(size);
    let offset = 0;
    while (offset < size) {
        const result = await handle.read(buffer, offset, size - offset, offset);
        if (result.bytesRead <= 0) throw new Error(`${label} ended before its declared size`);
        offset += result.bytesRead;
    }
    return buffer.toString("utf8");
}

async function inspectSqlite(handle: FileHandle, identity: FileIdentity): Promise<{ sha256: string, sizeBytes: number }> {
    const sizeBytes = Number(identity.size);
    if (!Number.isSafeInteger(sizeBytes) || sizeBytes <= 0 || sizeBytes > DERIVED_SQLITE_MAX_BYTES) throw new Error("Derived SQLite size is outside the allowed range");
    const hash = createHash("sha256");
    const buffer = Buffer.allocUnsafe(64 * 1024);
    const header = Buffer.alloc(112);
    let offset = 0;
    while (offset < sizeBytes) {
        const length = Math.min(buffer.length, sizeBytes - offset);
        const result = await handle.read(buffer, 0, length, offset);
        if (result.bytesRead <= 0) throw new Error("Derived SQLite ended before its declared size");
        if (offset < header.length) buffer.copy(header, offset, 0, Math.min(result.bytesRead, header.length - offset));
        hash.update(buffer.subarray(0, result.bytesRead));
        offset += result.bytesRead;
    }
    if (sizeBytes < 512 || !header.subarray(0, DERIVED_SQLITE_HEADER.length).equals(DERIVED_SQLITE_HEADER)) throw new Error("Derived output is not plain SQLite");
    const encodedPageSize = header.readUInt16BE(16);
    const pageSize = encodedPageSize === 1 ? 65_536 : encodedPageSize;
    if (pageSize < 512 || pageSize > 65_536 || (pageSize & (pageSize - 1)) !== 0 || sizeBytes % pageSize !== 0
        || ![1, 2].includes(header[18]) || ![1, 2].includes(header[19]) || header[21] !== 64 || header[22] !== 32 || header[23] !== 32
        || header.readUInt32BE(44) < 1 || header.readUInt32BE(44) > 4 || header.readUInt32BE(56) < 1 || header.readUInt32BE(56) > 3
        || ![5, 13].includes(header[100])) {
        throw new Error("Derived output does not have a valid plain SQLite header");
    }
    return { sha256: hash.digest("hex"), sizeBytes };
}

export async function validateDerivedSqliteArtifact(options: ValidateDerivedSqliteArtifactOptions): Promise<ValidatedDerivedSqliteArtifact> {
    if (arguments.length !== 1 || !isJsonObject(options) || !exactKeys(options, ["storeRoot", "sourceStoreRoot", "artifactIdentity"])) throw new Error("Derived artifact validation options are invalid");
    if (typeof options.storeRoot !== "string" || options.storeRoot.length === 0 || options.storeRoot.includes("\0")) throw new Error("Derived artifact storeRoot is invalid");
    if (typeof options.sourceStoreRoot !== "string" || options.sourceStoreRoot.length === 0 || options.sourceStoreRoot.includes("\0")) throw new Error("Derived artifact sourceStoreRoot is invalid");
    if (typeof options.artifactIdentity !== "string" || !/^[a-f0-9]{64}$/.test(options.artifactIdentity)) throw new Error("Derived artifact identity is invalid");

    const storeRoot = resolve(options.storeRoot);
    const sourceStoreRoot = resolve(options.sourceStoreRoot);
    if (pathsOverlap(storeRoot, sourceStoreRoot)) throw new Error("AQ and derived validation roots must be separate and non-overlapping");
    const chain = await captureExistingDirectoryChain(storeRoot);
    const root = chain[chain.length - 1];
    const artifactsRootPath = resolve(storeRoot, "artifacts");
    if (!isContained(storeRoot, artifactsRootPath)) throw new Error("Derived artifact namespace containment is invalid");
    const artifactsRoot = await captureDirectory(artifactsRootPath, "Derived artifact objects directory");
    const artifactDirectoryPath = resolve(artifactsRoot.path, options.artifactIdentity);
    if (!isContained(artifactsRoot.path, artifactDirectoryPath)) throw new Error("Derived artifact directory escapes the object namespace");
    const artifactDirectory = await captureDirectory(artifactDirectoryPath, "Derived artifact commit directory");
    const entries = await readdir(artifactDirectory.path, { withFileTypes: true });
    if (entries.length !== DERIVED_MEMBER_NAMES.length || entries.some(entry => !DERIVED_MEMBER_NAMES.includes(entry.name as any) || !entry.isFile() || entry.isSymbolicLink())) {
        throw new Error("Derived artifact commit members do not match the exact contract");
    }

    const opened = new Map<string, { path: string, handle: FileHandle, identity: FileIdentity, text?: string, sqlite?: { sha256: string, sizeBytes: number } }>();
    try {
        for (const name of DERIVED_MEMBER_NAMES) {
            const path = resolve(artifactDirectory.path, name);
            const pathIdentity = await capturePathFile(path, artifactDirectory.path, `Derived artifact ${name}`);
            assertImmutableMember(pathIdentity, `Derived artifact ${name}`);
            const handle = await open(path, "r");
            try {
                const handleIdentity = await captureHandleFile(handle, path, `Derived artifact ${name}`);
                assertImmutableMember(handleIdentity, `Derived artifact ${name}`);
                if (!sameFileIdentity(pathIdentity, handleIdentity)) throw new Error(`Derived artifact ${name} pathname changed before opening`);
                const member: { path: string, handle: FileHandle, identity: FileIdentity, text?: string, sqlite?: { sha256: string, sizeBytes: number } } = { path, handle, identity: handleIdentity };
                if (name === "database.sqlite") member.sqlite = await inspectSqlite(handle, handleIdentity);
                else member.text = await readBoundedText(handle, handleIdentity, `Derived artifact ${name}`);
                opened.set(name, member);
            } catch (error) {
                await handle.close();
                throw error;
            }
        }

        const metadataText = opened.get("metadata.json")!.text!;
        let metadataValue: unknown;
        try { metadataValue = JSON.parse(metadataText); }
        catch { throw new Error("Derived artifact metadata JSON is malformed"); }
        const metadata = parseDerivedSqliteArtifactMetadata(metadataValue);
        if (metadataText !== canonicalDerivedJson(metadata) || derivedSqliteArtifactIdentity(metadata) !== options.artifactIdentity) throw new Error("Derived artifact metadata identity does not validate");
        const sqlite = opened.get("database.sqlite")!.sqlite!;
        if (sqlite.sizeBytes !== metadata.output.sizeBytes || sqlite.sha256 !== metadata.output.sha256 || metadata.output.state !== "readable_sqlite") {
            throw new Error("Derived artifact output bytes do not match metadata");
        }

        const markerText = opened.get("commit-marker.json")!.text!;
        let markerValue: unknown;
        try { markerValue = JSON.parse(markerText); }
        catch { throw new Error("Derived artifact commit marker JSON is malformed"); }
        const marker = parseDerivedSqliteCommitMarker(markerValue);
        const metadataSha256 = createHash("sha256").update(metadataText).digest("hex");
        if (markerText !== canonicalDerivedJson(marker) || marker.identity !== options.artifactIdentity || marker.metadataSha256 !== metadataSha256) {
            throw new Error("Derived artifact commit marker does not validate");
        }

        const parent = await validateAcquiredDatabaseArtifact({ storeRoot: sourceStoreRoot, artifactIdentity: metadata.parent.artifactIdentity });
        if (parent.identity !== metadata.parent.artifactIdentity || parent.metadata.localSha256 !== metadata.parent.sourceSha256
            || parent.metadata.observedSizeBytes !== metadata.parent.sourceSizeBytes || parent.metadata.artifactState !== metadata.parent.sourceState) {
            throw new Error("Derived artifact AQ parent lineage does not validate materially");
        }

        for (const member of opened.values()) {
            const after = await captureHandleFile(member.handle, member.path, "Derived artifact member");
            const pathAfter = await capturePathFile(member.path, artifactDirectory.path, "Derived artifact member");
            if (!sameFileIdentity(member.identity, after) || !sameFileIdentity(after, pathAfter)) throw new Error("Derived artifact member changed during validation");
        }
        await assertSameDirectory(artifactDirectory, "Derived artifact commit directory");
        await assertSameDirectory(artifactsRoot, "Derived artifact objects directory");
        await assertSameDirectory(root, "Derived artifact store root");
        for (const identity of chain) await assertSameDirectory(identity, "Derived artifact store path");

        return {
            identity: options.artifactIdentity,
            artifactDirectory: artifactDirectory.path,
            artifactPath: resolve(artifactDirectory.path, "database.sqlite"),
            metadataPath: resolve(artifactDirectory.path, "metadata.json"),
            commitMarkerPath: resolve(artifactDirectory.path, "commit-marker.json"),
            metadata,
        };
    } finally {
        await Promise.all([...opened.values()].map(member => member.handle.close().catch(() => undefined)));
    }
}
