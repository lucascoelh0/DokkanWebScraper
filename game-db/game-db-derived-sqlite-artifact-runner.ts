import { createHash, randomBytes } from "crypto";
import { FileHandle, chmod, lstat, mkdir, open, realpath, rename, rm } from "fs/promises";
import { dirname, isAbsolute, relative, resolve } from "path";
import {
    canonicalDerivedJson,
    DERIVED_SQLITE_HEADER,
    DERIVED_SQLITE_MAX_BYTES,
    derivedSqliteArtifactIdentity,
    DerivedTransformSpecification,
    GameDbDerivedSqliteArtifactMetadata,
    GameDbDerivedSqliteCommitMarker,
    GameDbDerivedSqliteOperationalReceipt,
    validateDerivedTransformSpecification,
} from "./game-db-derived-sqlite-artifact-contract";
import {
    DEFAULT_DATABASE_ARTIFACT_MAX_BYTES,
    validateAcquiredDatabaseArtifact,
    ValidateAcquiredDatabaseArtifactOptions,
    ValidatedAcquiredDatabaseArtifact,
} from "./game-db-download-database-artifact";
import { validateDerivedSqliteArtifact, ValidatedDerivedSqliteArtifact } from "./game-db-derived-sqlite-artifact-validator";

export const DEFAULT_DERIVED_TRANSFORM_TIMEOUT_MS = 120_000;
export const MAX_DERIVED_TRANSFORM_TIMEOUT_MS = 120_000;

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

interface DirectoryIdentity {
    path: string,
    realPath: string,
    dev: string,
    ino: string,
    mode: number,
}

export interface DerivedSqliteTransformerResult {
    declaredSizeBytes: number,
    declaredSha256: string,
}

export interface DerivedSqliteOutputSink {
    write(chunk: Uint8Array): Promise<void>,
}

export interface DerivedSqliteTransformer {
    kind: "sqlcipher_decrypt",
    implementation: DerivedTransformSpecification["implementation"],
    nonSecretParameters: DerivedTransformSpecification["nonSecretParameters"],
    transform(context: { source: FileHandle, output: DerivedSqliteOutputSink, secret: Uint8Array, signal: AbortSignal }): Promise<DerivedSqliteTransformerResult>,
}

export interface DerivedSqliteSecretProvider {
    provideSecret(): Promise<Uint8Array>,
}

export interface DeriveSqliteArtifactOptions {
    source: ValidateAcquiredDatabaseArtifactOptions,
    derivedStoreRoot: string,
    transformer: DerivedSqliteTransformer,
    secretProvider: DerivedSqliteSecretProvider,
    now?: () => Date,
    timeoutMs?: number,
    signal?: AbortSignal,
}

export interface DerivedSqliteArtifactResult {
    identity: string,
    metadata: GameDbDerivedSqliteArtifactMetadata,
    reused: boolean,
    receiptFileName: string,
    receipt: GameDbDerivedSqliteOperationalReceipt,
}

function isObject(value: unknown): value is Record<string, unknown> {
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

function identityFromStats(path: string, metadata: any): FileIdentity {
    if (!metadata.isFile() || metadata.isSymbolicLink()) throw new Error("Derived operation member must be a regular file");
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

async function captureHandle(handle: FileHandle, path: string, label: string): Promise<FileIdentity> {
    try { return identityFromStats(path, await handle.stat({ bigint: true })); }
    catch { throw new Error(`${label} must remain a regular file`); }
}

async function capturePath(path: string, parent: string, label: string): Promise<FileIdentity> {
    const target = resolve(path);
    if (!isContained(parent, target) || !samePath(dirname(target), parent)) throw new Error(`${label} escapes its controlled directory`);
    let metadata: any;
    let canonical: string;
    try {
        metadata = await lstat(target, { bigint: true });
        canonical = resolve(await realpath(target));
    } catch { throw new Error(`${label} must be a regular real file`); }
    if (!samePath(canonical, target) || !samePath(dirname(canonical), parent)) throw new Error(`${label} is a symlink or reparse escape`);
    return identityFromStats(target, metadata);
}

async function captureDirectory(path: string, label: string): Promise<DirectoryIdentity> {
    const target = resolve(path);
    let metadata: any;
    let canonical: string;
    try {
        metadata = await lstat(target, { bigint: true });
        canonical = resolve(await realpath(target));
    } catch { throw new Error(`${label} must be a real directory`); }
    if (!metadata.isDirectory() || metadata.isSymbolicLink() || !samePath(canonical, target)) throw new Error(`${label} must not be a symlink, junction or reparse escape`);
    return { path: target, realPath: canonical, dev: BigInt(metadata.dev).toString(), ino: BigInt(metadata.ino).toString(), mode: Number(metadata.mode) };
}

async function assertDirectoryIdentity(expected: DirectoryIdentity, label: string): Promise<void> {
    const actual = await captureDirectory(expected.path, label);
    if (!samePath(actual.realPath, expected.realPath) || actual.dev !== expected.dev || actual.ino !== expected.ino || actual.mode !== expected.mode) throw new Error(`${label} changed during operation`);
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

async function ensureDirectoryChain(path: string, label: string): Promise<DirectoryIdentity[]> {
    const identities: DirectoryIdentity[] = [];
    for (const segment of directoryChain(path)) {
        try {
            identities.push(await captureDirectory(segment, label));
        } catch (error: any) {
            let missing = false;
            try { await lstat(segment); }
            catch (statError: any) { missing = statError?.code === "ENOENT"; }
            if (!missing) throw error;
            const parent = dirname(segment);
            if (parent === segment || identities.length === 0 || !samePath(identities[identities.length - 1].path, parent)) throw new Error(`${label} has an invalid creation boundary`);
            await assertDirectoryIdentity(identities[identities.length - 1], label);
            await mkdir(segment, { mode: 0o700 });
            identities.push(await captureDirectory(segment, label));
        }
    }
    for (const identity of identities) await assertDirectoryIdentity(identity, label);
    return identities;
}

async function ensureChildDirectory(parent: DirectoryIdentity, name: string, label: string): Promise<DirectoryIdentity> {
    if (!/^[a-z][a-z0-9-]*$/.test(name)) throw new Error(`${label} name is invalid`);
    await assertDirectoryIdentity(parent, label);
    const path = resolve(parent.path, name);
    if (!isContained(parent.path, path) || !samePath(dirname(path), parent.path)) throw new Error(`${label} escapes its parent`);
    try { await mkdir(path, { mode: 0o700 }); }
    catch (error: any) { if (error?.code !== "EEXIST") throw error; }
    const child = await captureDirectory(path, label);
    await assertDirectoryIdentity(parent, label);
    return child;
}

async function createExclusiveChildDirectory(parent: DirectoryIdentity, name: string, label: string): Promise<DirectoryIdentity> {
    await assertDirectoryIdentity(parent, label);
    const path = resolve(parent.path, name);
    if (!isContained(parent.path, path) || !samePath(dirname(path), parent.path)) throw new Error(`${label} escapes its parent`);
    await mkdir(path, { mode: 0o700 });
    const child = await captureDirectory(path, label);
    await assertDirectoryIdentity(parent, label);
    return child;
}

async function writeHandleFully(handle: FileHandle, bytes: Buffer): Promise<void> {
    let offset = 0;
    while (offset < bytes.length) {
        const result = await handle.write(bytes, offset, bytes.length - offset, offset);
        if (result.bytesWritten <= 0) throw new Error("Derived operation write made no progress");
        offset += result.bytesWritten;
    }
}

const OUTPUT_SINK_CLOSED_ERROR = "Derived transformer output sink is closed";
const OUTPUT_SINK_QUOTA_ERROR = "Derived transformer output exceeds the byte limit";
const OUTPUT_SINK_WRITE_ERROR = "Derived transformer output sink write failed";

function actualUint8ArrayByteLength(value: Uint8Array): number {
    const getter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(Uint8Array.prototype), "byteLength")?.get;
    if (!getter) throw new Error("Derived transformer output chunk is invalid");
    return getter.call(value);
}

class ControlledDerivedSqliteOutputSink implements DerivedSqliteOutputSink {
    private accepting = true;
    private revoked = false;
    private reservedBytes = 0;
    private failureMessage: string | undefined;
    private tail: Promise<void> = Promise.resolve();

    constructor(private readonly handle: FileHandle) {}

    write(chunk: Uint8Array): Promise<void> {
        if (!this.accepting || this.revoked) return this.handledRejection(OUTPUT_SINK_CLOSED_ERROR);
        let size: number;
        let bytes: Buffer;
        try {
            if (!(chunk instanceof Uint8Array)) throw new Error("invalid");
            size = actualUint8ArrayByteLength(chunk);
            if (!Number.isSafeInteger(size) || size < 0) throw new Error("invalid");
            if (size === 0) return Promise.resolve();
            if (this.reservedBytes > DERIVED_SQLITE_MAX_BYTES - size) {
                this.failureMessage = OUTPUT_SINK_QUOTA_ERROR;
                this.accepting = false;
                this.revoked = true;
                return this.handledRejection(OUTPUT_SINK_QUOTA_ERROR);
            }
            bytes = Buffer.from(chunk);
            if (bytes.length !== size) throw new Error("invalid");
        } catch {
            this.failureMessage = "Derived transformer output chunk is invalid";
            this.accepting = false;
            this.revoked = true;
            return this.handledRejection(this.failureMessage);
        }

        const offset = this.reservedBytes;
        this.reservedBytes += size;
        const task = this.tail.then(async () => {
            if (this.revoked) throw new Error(OUTPUT_SINK_CLOSED_ERROR);
            let written = 0;
            while (written < bytes.length) {
                const result = await this.handle.write(bytes, written, bytes.length - written, offset + written);
                if (result.bytesWritten <= 0) throw new Error(OUTPUT_SINK_WRITE_ERROR);
                written += result.bytesWritten;
            }
        });
        task.catch(() => {
            if (!this.failureMessage) this.failureMessage = OUTPUT_SINK_WRITE_ERROR;
            this.accepting = false;
            this.revoked = true;
        });
        this.tail = task.catch(() => undefined);
        return task;
    }

    async seal(): Promise<void> {
        this.accepting = false;
        await this.tail;
        if (this.failureMessage) throw new Error(this.failureMessage);
    }

    revoke(): void {
        this.accepting = false;
        this.revoked = true;
    }

    async settle(): Promise<void> {
        await this.tail.catch(() => undefined);
    }

    failure(): string | undefined { return this.failureMessage; }

    private handledRejection(message: string): Promise<void> {
        const result = Promise.reject<void>(new Error(message));
        result.catch(() => undefined);
        return result;
    }
}

async function writeExclusiveReadOnly(parent: DirectoryIdentity, name: string, bytes: Buffer, label: string): Promise<FileIdentity> {
    const path = resolve(parent.path, name);
    if (!isContained(parent.path, path) || !samePath(dirname(path), parent.path)) throw new Error(`${label} escapes its controlled directory`);
    await assertDirectoryIdentity(parent, label);
    const handle = await open(path, "wx", 0o600);
    try {
        await writeHandleFully(handle, bytes);
        await handle.sync();
    } finally { await handle.close(); }
    await chmod(path, 0o444);
    const identity = await capturePath(path, parent.path, label);
    if (identity.nlink !== "1" || (identity.mode & 0o222) !== 0 || Number(identity.size) !== bytes.length) throw new Error(`${label} immutable installation failed`);
    await assertDirectoryIdentity(parent, label);
    return identity;
}

async function copyHandleCreateOnly(source: FileHandle, sourceIdentity: FileIdentity, parent: DirectoryIdentity, name: string, label: string): Promise<FileIdentity> {
    const size = Number(sourceIdentity.size);
    if (!Number.isSafeInteger(size) || size <= 0 || size > DERIVED_SQLITE_MAX_BYTES) throw new Error(`${label} source size is invalid`);
    const path = resolve(parent.path, name);
    if (!isContained(parent.path, path) || !samePath(dirname(path), parent.path)) throw new Error(`${label} escapes its controlled directory`);
    const destination = await open(path, "wx", 0o600);
    const buffer = Buffer.allocUnsafe(64 * 1024);
    let offset = 0;
    try {
        while (offset < size) {
            const length = Math.min(buffer.length, size - offset);
            const read = await source.read(buffer, 0, length, offset);
            if (read.bytesRead <= 0) throw new Error(`${label} source ended early`);
            let written = 0;
            while (written < read.bytesRead) {
                const result = await destination.write(buffer, written, read.bytesRead - written, offset + written);
                if (result.bytesWritten <= 0) throw new Error(`${label} destination write made no progress`);
                written += result.bytesWritten;
            }
            offset += read.bytesRead;
        }
        await destination.sync();
    } finally { await destination.close(); }
    await chmod(path, 0o444);
    const copied = await capturePath(path, parent.path, label);
    if (copied.nlink !== "1" || (copied.mode & 0o222) !== 0 || copied.size !== sourceIdentity.size || (copied.dev === sourceIdentity.dev && copied.ino === sourceIdentity.ino)) {
        throw new Error(`${label} was not installed as an independent immutable copy`);
    }
    return copied;
}

async function hashOpenFile(handle: FileHandle, identity: FileIdentity, maxBytes: number): Promise<{ sha256: string, sizeBytes: number, header: Buffer }> {
    const sizeBytes = Number(identity.size);
    if (!Number.isSafeInteger(sizeBytes) || sizeBytes <= 0 || sizeBytes > maxBytes) throw new Error("Derived operation file size is invalid");
    const hash = createHash("sha256");
    const header = Buffer.alloc(112);
    const buffer = Buffer.allocUnsafe(64 * 1024);
    let offset = 0;
    while (offset < sizeBytes) {
        const result = await handle.read(buffer, 0, Math.min(buffer.length, sizeBytes - offset), offset);
        if (result.bytesRead <= 0) throw new Error("Derived operation file ended early");
        if (offset < header.length) buffer.copy(header, offset, 0, Math.min(result.bytesRead, header.length - offset));
        hash.update(buffer.subarray(0, result.bytesRead));
        offset += result.bytesRead;
    }
    return { sha256: hash.digest("hex"), sizeBytes, header };
}

function validatePlainSqlite(inspection: { sizeBytes: number, header: Buffer }): void {
    if (inspection.sizeBytes < 512 || !inspection.header.subarray(0, DERIVED_SQLITE_HEADER.length).equals(DERIVED_SQLITE_HEADER)) throw new Error("Derived transform output is not plain SQLite");
    const encodedPageSize = inspection.header.readUInt16BE(16);
    const pageSize = encodedPageSize === 1 ? 65_536 : encodedPageSize;
    if (pageSize < 512 || pageSize > 65_536 || (pageSize & (pageSize - 1)) !== 0 || inspection.sizeBytes % pageSize !== 0
        || ![1, 2].includes(inspection.header[18]) || ![1, 2].includes(inspection.header[19])
        || inspection.header[21] !== 64 || inspection.header[22] !== 32 || inspection.header[23] !== 32
        || inspection.header.readUInt32BE(44) < 1 || inspection.header.readUInt32BE(44) > 4
        || inspection.header.readUInt32BE(56) < 1 || inspection.header.readUInt32BE(56) > 3
        || ![5, 13].includes(inspection.header[100])) {
        throw new Error("Derived transform output has an invalid plain SQLite header");
    }
}

function validateTransformResult(value: unknown): DerivedSqliteTransformerResult {
    if (!isObject(value) || !exactKeys(value, ["declaredSizeBytes", "declaredSha256"])
        || !Number.isSafeInteger(value.declaredSizeBytes) || (value.declaredSizeBytes as number) <= 0 || (value.declaredSizeBytes as number) > DERIVED_SQLITE_MAX_BYTES
        || typeof value.declaredSha256 !== "string" || !/^[a-f0-9]{64}$/.test(value.declaredSha256)) {
        throw new Error("Derived transformer result is invalid");
    }
    return value as unknown as DerivedSqliteTransformerResult;
}

function validateOptions(value: unknown): { options: DeriveSqliteArtifactOptions, specification: DerivedTransformSpecification, timeoutMs: number } {
    if (!isObject(value)) throw new Error("Derived artifact options are invalid");
    const allowed = ["source", "derivedStoreRoot", "transformer", "secretProvider"];
    for (const optional of ["now", "timeoutMs", "signal"]) if (Object.prototype.hasOwnProperty.call(value, optional)) allowed.push(optional);
    if (!exactKeys(value, allowed) || !isObject(value.source) || typeof value.derivedStoreRoot !== "string" || value.derivedStoreRoot.length === 0 || value.derivedStoreRoot.includes("\0")) {
        throw new Error("Derived artifact options are invalid");
    }
    if (!isObject(value.transformer) || !exactKeys(value.transformer, ["kind", "implementation", "nonSecretParameters", "transform"]) || typeof value.transformer.transform !== "function") {
        throw new Error("Derived artifact transformer is invalid");
    }
    if (!isObject(value.secretProvider) || !exactKeys(value.secretProvider, ["provideSecret"]) || typeof value.secretProvider.provideSecret !== "function") {
        throw new Error("Derived artifact secret provider is invalid");
    }
    if (typeof value.now !== "undefined" && typeof value.now !== "function") throw new Error("Derived artifact clock is invalid");
    const timeoutMs = Object.prototype.hasOwnProperty.call(value, "timeoutMs") ? value.timeoutMs : DEFAULT_DERIVED_TRANSFORM_TIMEOUT_MS;
    if (!Number.isSafeInteger(timeoutMs) || (timeoutMs as number) <= 0 || (timeoutMs as number) > MAX_DERIVED_TRANSFORM_TIMEOUT_MS) throw new Error("Derived transform timeout is invalid");
    if (Object.prototype.hasOwnProperty.call(value, "signal") && (typeof value.signal !== "object" || value.signal === null
        || typeof (value.signal as any).aborted !== "boolean" || typeof (value.signal as any).addEventListener !== "function"
        || typeof (value.signal as any).removeEventListener !== "function")) throw new Error("Derived transform AbortSignal is invalid");
    const specification = validateDerivedTransformSpecification({
        kind: value.transformer.kind,
        implementation: value.transformer.implementation,
        nonSecretParameters: value.transformer.nonSecretParameters,
    });
    return { options: value as unknown as DeriveSqliteArtifactOptions, specification, timeoutMs: timeoutMs as number };
}

const TRANSFORM_TIMEOUT_ERROR = "Derived transformer timed out";
const TRANSFORM_CANCELLED_ERROR = "Derived transformation was cancelled";

async function runBoundedTransformer(
    transformer: DerivedSqliteTransformer,
    context: { source: FileHandle, output: ControlledDerivedSqliteOutputSink, secret: Uint8Array },
    timeoutMs: number,
    externalSignal?: AbortSignal,
): Promise<unknown> {
    const controller = new AbortController();
    let boundary: "timeout" | "cancelled" | undefined;
    let rejectBoundary!: (error: Error) => void;
    const boundaryPromise = new Promise<never>((_resolve, reject) => { rejectBoundary = reject; });
    const stop = (kind: "timeout" | "cancelled") => {
        if (boundary) return;
        boundary = kind;
        context.output.revoke();
        controller.abort();
        rejectBoundary(new Error(kind === "timeout" ? TRANSFORM_TIMEOUT_ERROR : TRANSFORM_CANCELLED_ERROR));
    };
    const onExternalAbort = () => stop("cancelled");
    externalSignal?.addEventListener("abort", onExternalAbort, { once: true });
    const timer = setTimeout(() => stop("timeout"), timeoutMs);
    if (externalSignal?.aborted) stop("cancelled");

    let transformPromise: Promise<unknown> | undefined;
    try {
        if (boundary) return await boundaryPromise;
        transformPromise = Promise.resolve().then(() => transformer.transform({ ...context, signal: controller.signal }));
        transformPromise.catch(() => undefined);
        const value = await Promise.race([transformPromise, boundaryPromise]);
        await context.output.seal();
        return value;
    } catch {
        if (boundary === "timeout") throw new Error(TRANSFORM_TIMEOUT_ERROR);
        if (boundary === "cancelled") throw new Error(TRANSFORM_CANCELLED_ERROR);
        const sinkFailure = context.output.failure();
        controller.abort();
        context.output.revoke();
        if (sinkFailure) throw new Error(sinkFailure);
        throw new Error("Derived transformer failed");
    } finally {
        clearTimeout(timer);
        externalSignal?.removeEventListener("abort", onExternalAbort);
    }
}

function operationTimestamp(now: (() => Date) | undefined): string {
    let date: Date;
    try { date = now ? now() : new Date(); }
    catch { throw new Error("Derived operation timestamp provider failed"); }
    if (!(date instanceof Date) || !Number.isFinite(date.getTime())) throw new Error("Derived operation timestamp is invalid");
    return date.toISOString();
}

function secretProbes(secret: Uint8Array): Buffer[] {
    const raw = Buffer.from(secret);
    const probes = [raw, Buffer.from(raw.toString("hex"), "utf8"), Buffer.from(raw.toString("base64"), "utf8")];
    const utf8 = raw.toString("utf8");
    if (!utf8.includes("\ufffd")) probes.push(Buffer.from(utf8, "utf8"));
    return probes.filter(probe => probe.length >= 8);
}

function assertSecretAbsent(secret: Uint8Array, values: Array<string | Buffer>): void {
    const probes = secretProbes(secret);
    for (const value of values) {
        const bytes = Buffer.isBuffer(value) ? value : Buffer.from(value, "utf8");
        if (probes.some(probe => bytes.includes(probe))) throw new Error("Derived operation rejected sensitive material outside the transformer boundary");
    }
}

async function assertSecretAbsentFromOpenFile(handle: FileHandle, sizeBytes: number, secret: Uint8Array): Promise<void> {
    const probes = secretProbes(secret);
    const overlap = Math.max(0, ...probes.map(probe => probe.length - 1));
    const buffer = Buffer.allocUnsafe(64 * 1024);
    let carry = Buffer.alloc(0);
    let offset = 0;
    while (offset < sizeBytes) {
        const result = await handle.read(buffer, 0, Math.min(buffer.length, sizeBytes - offset), offset);
        if (result.bytesRead <= 0) throw new Error("Derived transform output ended during sensitive-material validation");
        const current = Buffer.concat([carry, buffer.subarray(0, result.bytesRead)]);
        if (probes.some(probe => current.includes(probe))) throw new Error("Derived operation rejected sensitive material outside the transformer boundary");
        carry = overlap > 0 ? Buffer.from(current.subarray(Math.max(0, current.length - overlap))) : Buffer.alloc(0);
        offset += result.bytesRead;
    }
}

async function openValidatedSource(parent: ValidatedAcquiredDatabaseArtifact): Promise<{ handle: FileHandle, identity: FileIdentity }> {
    const pathIdentity = await capturePath(parent.artifactPath, parent.artifactDirectory, "AQ source artifact");
    if (pathIdentity.nlink !== "1" || (pathIdentity.mode & 0o222) !== 0) throw new Error("AQ source artifact is not immutable");
    const handle = await open(parent.artifactPath, "r");
    try {
        const handleIdentity = await captureHandle(handle, parent.artifactPath, "AQ source artifact");
        if (!sameFileIdentity(pathIdentity, handleIdentity)) throw new Error("AQ source artifact changed before opening");
        return { handle, identity: handleIdentity };
    } catch (error) {
        await handle.close();
        throw error;
    }
}

async function verifySource(handle: FileHandle, identity: FileIdentity, parent: ValidatedAcquiredDatabaseArtifact): Promise<void> {
    const inspection = await hashOpenFile(handle, identity, DEFAULT_DATABASE_ARTIFACT_MAX_BYTES);
    const after = await captureHandle(handle, parent.artifactPath, "AQ source artifact");
    const pathAfter = await capturePath(parent.artifactPath, parent.artifactDirectory, "AQ source artifact");
    if (!sameFileIdentity(identity, after) || !sameFileIdentity(after, pathAfter)
        || inspection.sizeBytes !== parent.metadata.observedSizeBytes || inspection.sha256 !== parent.metadata.localSha256) {
        throw new Error("AQ source artifact does not match its fully validated commit");
    }
}

async function quarantineOwnedDirectory(directory: DirectoryIdentity, quarantineRoot: DirectoryIdentity): Promise<void> {
    await assertDirectoryIdentity(directory, "Owned derived destination");
    const container = await createExclusiveChildDirectory(quarantineRoot, `failed-${randomBytes(12).toString("hex")}`, "Derived quarantine container");
    const target = resolve(container.path, "commit");
    await rename(directory.path, target);
    const moved = await captureDirectory(target, "Quarantined derived destination");
    if (moved.dev !== directory.dev || moved.ino !== directory.ino) throw new Error("Owned derived destination quarantine identity failed");
}

async function removeOwnedWorkDirectory(directory: DirectoryIdentity, workRoot: DirectoryIdentity): Promise<void> {
    if (!isContained(workRoot.path, directory.path)) throw new Error("Derived work cleanup containment failed");
    await assertDirectoryIdentity(directory, "Derived work directory");
    await assertDirectoryIdentity(workRoot, "Derived work root");
    await rm(directory.path, { recursive: true, force: false });
}

async function writeReceipt(receiptsRoot: DirectoryIdentity, receipt: GameDbDerivedSqliteOperationalReceipt, secret: Uint8Array): Promise<string> {
    const text = canonicalDerivedJson(receipt);
    const name = `${createHash("sha256").update(text).digest("hex")}.json`;
    assertSecretAbsent(secret, [text, name]);
    const path = resolve(receiptsRoot.path, name);
    try { await writeExclusiveReadOnly(receiptsRoot, name, Buffer.from(text, "utf8"), "Derived operational receipt"); }
    catch (error: any) {
        if (error?.code !== "EEXIST") throw error;
        const existing = await capturePath(path, receiptsRoot.path, "Derived operational receipt");
        const handle = await open(path, "r");
        try {
            const textBytes = await handle.readFile();
            const after = await captureHandle(handle, path, "Derived operational receipt");
            if (!sameFileIdentity(existing, after) || !textBytes.equals(Buffer.from(text, "utf8"))) throw new Error("Existing derived operational receipt conflicts");
        } finally { await handle.close(); }
    }
    if (!/^[a-f0-9]{64}\.json$/.test(name)) throw new Error("Derived operational receipt identity is invalid");
    return name;
}

export async function deriveSqliteArtifact(value: DeriveSqliteArtifactOptions): Promise<DerivedSqliteArtifactResult> {
    if (arguments.length !== 1) throw new Error("Derived artifact options are invalid");
    const { options, specification, timeoutMs } = validateOptions(value);
    if (options.signal?.aborted) throw new Error(TRANSFORM_CANCELLED_ERROR);
    const parent = await validateAcquiredDatabaseArtifact(options.source as ValidateAcquiredDatabaseArtifactOptions);
    if (parent.metadata.artifactState !== "encrypted_or_packaged") throw new Error("Derived SQLCipher transform requires an encrypted_or_packaged AQ parent");
    const sourceRoot = resolve((options.source as any).storeRoot);
    const derivedRootPath = resolve(options.derivedStoreRoot);
    if (pathsOverlap(sourceRoot, derivedRootPath)) throw new Error("AQ and derived stores must use separate non-overlapping roots");

    const source = await openValidatedSource(parent);
    let workDirectory: DirectoryIdentity | undefined;
    let secret: Uint8Array | undefined;
    let outputHandle: FileHandle | undefined;
    const clearAndCloseOutput = async () => {
        const handle = outputHandle;
        if (!handle) return;
        outputHandle = undefined;
        try {
            await handle.truncate(0);
            await handle.sync();
        } finally { await handle.close().catch(() => undefined); }
    };
    try {
        await verifySource(source.handle, source.identity, parent);
        const storeChain = await ensureDirectoryChain(derivedRootPath, "Derived artifact store path");
        const storeRoot = storeChain[storeChain.length - 1];
        const artifactsRoot = await ensureChildDirectory(storeRoot, "artifacts", "Derived artifact objects directory");
        const workRoot = await ensureChildDirectory(storeRoot, "work", "Derived operation work directory");
        const receiptsRoot = await ensureChildDirectory(storeRoot, "receipts", "Derived receipts directory");
        const quarantineRoot = await ensureChildDirectory(storeRoot, "quarantine", "Derived quarantine directory");
        workDirectory = await createExclusiveChildDirectory(workRoot, `operation-${randomBytes(12).toString("hex")}`, "Derived operation directory");
        const outputPath = resolve(workDirectory.path, "transform-output.sqlite");
        outputHandle = await open(outputPath, "wx+", 0o600);
        const outputInitial = await captureHandle(outputHandle, outputPath, "Derived transform output");
        if (outputInitial.nlink !== "1" || outputInitial.size !== "0") throw new Error("Derived transform output staging is invalid");
        const outputSink = new ControlledDerivedSqliteOutputSink(outputHandle);

        let provided: unknown;
        try { provided = await options.secretProvider.provideSecret(); }
        catch { throw new Error("Derived secret provider failed"); }
        try {
            if (!(provided instanceof Uint8Array) || provided.byteLength < 8 || provided.byteLength > 64 * 1024) throw new Error("invalid");
            secret = new Uint8Array(provided);
        } catch { throw new Error("Derived secret provider returned invalid secret material"); }

        let transformValue: unknown;
        const transformerSecret = new Uint8Array(secret);
        try {
            try { transformValue = await runBoundedTransformer(options.transformer, { source: source.handle, output: outputSink, secret: transformerSecret }, timeoutMs, options.signal); }
            catch (error) {
                outputSink.revoke();
                await outputSink.settle();
                try { await clearAndCloseOutput(); }
                catch { throw new Error("Derived transform staging could not be securely cleared"); }
                throw error;
            }
        } finally { transformerSecret.fill(0); }
        let declaration: DerivedSqliteTransformerResult;
        try { declaration = validateTransformResult(transformValue); }
        catch { throw new Error("Derived transformer result is invalid"); }
        await outputHandle.sync();
        const outputIdentity = await captureHandle(outputHandle, outputPath, "Derived transform output");
        const outputPathIdentity = await capturePath(outputPath, workDirectory.path, "Derived transform output");
        if (!sameFileIdentity(outputIdentity, outputPathIdentity) || outputIdentity.nlink !== "1") throw new Error("Derived transform output pathname does not match its open file");
        const output = await hashOpenFile(outputHandle, outputIdentity, DERIVED_SQLITE_MAX_BYTES);
        validatePlainSqlite(output);
        if (declaration.declaredSizeBytes !== output.sizeBytes || declaration.declaredSha256 !== output.sha256) throw new Error("Derived transformer declaration does not match output bytes");
        await assertSecretAbsentFromOpenFile(outputHandle, output.sizeBytes, secret);

        await verifySource(source.handle, source.identity, parent);
        const parentAfter = await validateAcquiredDatabaseArtifact({ storeRoot: sourceRoot, artifactIdentity: parent.identity });
        if (parentAfter.identity !== parent.identity || canonicalDerivedJson(parentAfter.metadata) !== canonicalDerivedJson(parent.metadata)) throw new Error("AQ parent commit changed during derivation");

        const metadata: GameDbDerivedSqliteArtifactMetadata = {
            schemaVersion: 1,
            contract: "dokkan-game-db-derived-sqlite-artifact",
            contractVersion: "1.0.0",
            parent: {
                contract: "dokkan-game-db-acquired-artifact",
                artifactIdentity: parent.identity,
                sourceSha256: parent.metadata.localSha256,
                sourceSizeBytes: parent.metadata.observedSizeBytes,
                sourceState: parent.metadata.artifactState,
            },
            transform: specification,
            output: { sha256: output.sha256, sizeBytes: output.sizeBytes, state: "readable_sqlite" },
        };
        const metadataText = canonicalDerivedJson(metadata);
        const identity = derivedSqliteArtifactIdentity(metadata);
        const marker: GameDbDerivedSqliteCommitMarker = {
            schemaVersion: 1,
            contract: "dokkan-game-db-derived-sqlite-artifact-commit",
            contractVersion: "1.0.0",
            identity,
            metadataSha256: createHash("sha256").update(metadataText).digest("hex"),
        };
        const markerText = canonicalDerivedJson(marker);
        assertSecretAbsent(secret, [metadataText, identity, markerText]);

        const pending = await createExclusiveChildDirectory(workDirectory, "pending", "Derived pending commit directory");
        const pendingDatabase = await copyHandleCreateOnly(outputHandle, outputIdentity, pending, "database.sqlite", "Pending derived SQLite");
        await writeExclusiveReadOnly(pending, "metadata.json", Buffer.from(metadataText, "utf8"), "Pending derived metadata");
        await writeExclusiveReadOnly(pending, "commit-marker.json", Buffer.from(markerText, "utf8"), "Pending derived commit marker");

        let reused = false;
        let ownedFinal: DirectoryIdentity | undefined;
        let validated: ValidatedDerivedSqliteArtifact;
        try {
            try { ownedFinal = await createExclusiveChildDirectory(artifactsRoot, identity, "Derived final commit directory"); }
            catch (error: any) {
                if (error?.code !== "EEXIST") throw error;
                const existing = await validateDerivedSqliteArtifact({ storeRoot: derivedRootPath, sourceStoreRoot: sourceRoot, artifactIdentity: identity });
                if (canonicalDerivedJson(existing.metadata) !== metadataText) throw new Error("Existing derived destination conflicts with expected metadata");
                reused = true;
            }
            if (ownedFinal) {
                const pendingDatabaseHandle = await open(resolve(pending.path, "database.sqlite"), "r");
                try { await copyHandleCreateOnly(pendingDatabaseHandle, pendingDatabase, ownedFinal, "database.sqlite", "Final derived SQLite"); }
                finally { await pendingDatabaseHandle.close(); }
                await writeExclusiveReadOnly(ownedFinal, "metadata.json", Buffer.from(metadataText, "utf8"), "Final derived metadata");
                // Marker installation is the derived commit boundary and is last.
                await writeExclusiveReadOnly(ownedFinal, "commit-marker.json", Buffer.from(markerText, "utf8"), "Final derived commit marker");
            }
            validated = await validateDerivedSqliteArtifact({ storeRoot: derivedRootPath, sourceStoreRoot: sourceRoot, artifactIdentity: identity });
            if (canonicalDerivedJson(validated.metadata) !== metadataText) throw new Error("Committed derived artifact does not match expected metadata");
        } catch (error) {
            if (ownedFinal) {
                try { await quarantineOwnedDirectory(ownedFinal, quarantineRoot); }
                catch { throw new Error("Derived destination failed and could not be safely quarantined"); }
            }
            throw error;
        }

        // Material authority is complete after the full two-root validation
        // above. Operational evidence failure must not remove that valid commit.
        const receipt: GameDbDerivedSqliteOperationalReceipt = {
            schemaVersion: 1,
            contract: "dokkan-game-db-derived-sqlite-operation",
            contractVersion: "1.0.0",
            mode: "derived_sqlite_transform",
            completedAt: operationTimestamp(options.now),
            result: reused ? "reused" : "created",
            artifactIdentity: identity,
            parentArtifactIdentity: parent.identity,
            transformKind: specification.kind,
            transformImplementationIdentity: specification.implementation.identity,
        };
        const receiptFileName = await writeReceipt(receiptsRoot, receipt, secret);
        assertSecretAbsent(secret, [receiptFileName, canonicalDerivedJson(receipt)]);
        return { identity: validated.identity, metadata: validated.metadata, reused, receiptFileName, receipt };
    } finally {
        if (secret) secret.fill(0);
        let cleanupFailed = false;
        if (outputHandle) {
            try { await clearAndCloseOutput(); }
            catch { cleanupFailed = true; }
        }
        await source.handle.close().catch(() => undefined);
        if (workDirectory) {
            try { await removeOwnedWorkDirectory(workDirectory, await captureDirectory(dirname(workDirectory.path), "Derived work root")); }
            catch { cleanupFailed = true; }
        }
        if (cleanupFailed) throw new Error("Derived transform staging could not be securely cleared");
    }
}
