"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseGameDbSqliteCompatibilityArgs = exports.buildGameDbSqliteCompatibility = void 0;
const crypto_1 = require("crypto");
const promises_1 = require("fs/promises");
const path_1 = require("path");
const sqlite_readonly_adapter_1 = require("../database-experiment/sqlite-readonly-adapter");
const integration_c4_builder_1 = require("../database-integration/integration-c4-builder");
const game_db_download_database_artifact_1 = require("./game-db-download-database-artifact");
const SQLITE_HEADER = Buffer.from("SQLite format 3\u0000", "utf8");
const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const CANONICAL_C4_BASELINE_SHA256 = "c46ccbfe6581e2c1f681c3527420cc432fa7f0b91ca32d52a24b4df6e79999a1";
const C4_MAX_SQLITE_BYTES = 112 * 1024 * 1024;
const C4_BRIDGE_TIMEOUT_MS = 120000;
const C4_BRIDGE_KILL_GRACE_MS = 1000;
const C4_BRIDGE_STDOUT_LIMIT_BYTES = 8 * 1024 * 1024;
const C4_BRIDGE_STDERR_LIMIT_BYTES = 1 * 1024 * 1024;
async function canonicalBaselinePath() {
    let directory = (0, path_1.resolve)(__dirname);
    while (true) {
        const candidate = (0, path_1.resolve)(directory, "database-integration", "integration-c4-baseline.json");
        const packageFile = (0, path_1.resolve)(directory, "package.json");
        try {
            const packageReal = await (0, promises_1.realpath)(packageFile);
            const candidateReal = await (0, promises_1.realpath)(candidate);
            if (sameCanonicalPath(packageReal, packageFile) && sameCanonicalPath(candidateReal, candidate))
                return candidateReal;
        }
        catch { /* keep walking to the repository root */ }
        const parent = (0, path_1.dirname)(directory);
        if (parent === directory)
            throw new Error("Canonical C4 baseline is unavailable");
        directory = parent;
    }
}
function assertBaseline(value) {
    const baseline = value;
    if (!baseline || baseline.schemaVersion !== 1 || baseline.contractVersion !== "1.0.0") {
        throw new Error("Invalid C4 baseline contract");
    }
    if (!baseline.sourceDatabase || !SHA256_PATTERN.test(baseline.sourceDatabase.sha256)
        || !SHA256_PATTERN.test(baseline.sourceDatabase.schemaSha256)
        || !Number.isSafeInteger(baseline.sourceDatabase.sizeBytes) || baseline.sourceDatabase.sizeBytes <= 0
        || !Number.isSafeInteger(baseline.sourceDatabase.tableCount) || baseline.sourceDatabase.tableCount <= 0
        || !baseline.sourceDatabase.requiredTables || typeof baseline.sourceDatabase.requiredTables !== "object") {
        throw new Error("Invalid C4 SQLite profile");
    }
    if (!baseline.nativeRuntime || !SHA256_PATTERN.test(baseline.nativeRuntime.sha256)
        || !Number.isSafeInteger(baseline.nativeRuntime.sizeBytes) || baseline.nativeRuntime.sizeBytes <= 0) {
        throw new Error("Invalid C4 native profile");
    }
    for (const gate of ["DB48", "DB49", "DB50"]) {
        if (!baseline.semanticInputs?.[gate] || !SHA256_PATTERN.test(baseline.semanticInputs[gate].sha256)) {
            throw new Error(`Invalid C4 ${gate} evidence profile`);
        }
    }
}
function missingRequiredColumns(baseline, inspection) {
    const actual = new Map(inspection.tables.map(table => [table.name, new Set(table.columns)]));
    const missing = [];
    for (const table of Object.keys(baseline.sourceDatabase.requiredTables).sort()) {
        for (const column of [...baseline.sourceDatabase.requiredTables[table]].sort()) {
            if (!actual.get(table)?.has(column))
                missing.push(`${table}.${column}`);
        }
    }
    return missing;
}
function evaluateGameDbSqliteCompatibility(input) {
    assertBaseline(input.baseline);
    if (input.acquiredArtifactState !== "readable_sqlite" && input.acquiredArtifactState !== "encrypted_or_packaged") {
        throw new Error("Invalid acquired artifact state");
    }
    const source = input.sourceDatabase;
    if (input.acquiredArtifactState === "readable_sqlite" && !source) {
        throw new Error("Readable SQLite compatibility requires a source inspection");
    }
    if (source && (!SHA256_PATTERN.test(source.sha256) || !Number.isSafeInteger(source.sizeBytes) || source.sizeBytes <= 0)) {
        throw new Error("Invalid observed SQLite identity");
    }
    if (input.inspectionSnapshot.acquiredArtifactIdentity !== input.acquiredArtifact.identity
        || input.inspectionSnapshot.sha256 !== input.acquiredArtifact.sha256
        || input.inspectionSnapshot.sizeBytes !== input.acquiredArtifact.sizeBytes) {
        throw new Error("C4 inspection snapshot identity diverges from the acquired AQ artifact");
    }
    const schemaSha256 = source ? (0, integration_c4_builder_1.integrationC4SchemaSha256)(source.inspection) : null;
    const missing = source ? missingRequiredColumns(input.baseline, source.inspection) : [];
    const exact = Boolean(source
        && source.sha256 === input.baseline.sourceDatabase.sha256
        && source.sizeBytes === input.baseline.sourceDatabase.sizeBytes
        && source.inspection.tableCount === input.baseline.sourceDatabase.tableCount
        && schemaSha256 === input.baseline.sourceDatabase.schemaSha256);
    const status = input.acquiredArtifactState === "encrypted_or_packaged"
        ? "unknown"
        : missing.length > 0
            ? "incompatible"
            : exact
                ? "exact_profile_match"
                : "schema_compatible_but_evidence_refresh_required";
    const nextPermittedStep = status === "unknown"
        ? "decrypt_locally_then_repeat_read_only_compatibility"
        : status === "exact_profile_match"
            ? "run_c4_with_exact_pinned_elf_and_semantic_artifacts"
            : status === "schema_compatible_but_evidence_refresh_required"
                ? "refresh_bounded_native_evidence_then_review_c4_baseline"
                : "stop_incompatible_sqlite";
    return {
        schemaVersion: 1,
        contract: "dokkan-game-db-sqlite-compatibility",
        contractVersion: "1.2.0",
        status,
        acquiredArtifactState: input.acquiredArtifactState,
        acquiredArtifact: input.acquiredArtifact,
        inspectionSnapshot: input.inspectionSnapshot,
        c4Profile: {
            snapshotVersion: input.baseline.snapshotVersion,
            sourceDatabase: {
                expectedSha256: input.baseline.sourceDatabase.sha256,
                expectedSizeBytes: input.baseline.sourceDatabase.sizeBytes,
                expectedTableCount: input.baseline.sourceDatabase.tableCount,
                expectedSchemaSha256: input.baseline.sourceDatabase.schemaSha256,
                actualSha256: source?.sha256 ?? null,
                actualSizeBytes: source?.sizeBytes ?? null,
                actualTableCount: source?.inspection.tableCount ?? null,
                actualSchemaSha256: schemaSha256,
            },
            missingRequiredColumns: missing,
        },
        pinnedNativeEvidence: {
            nativeRuntimeSha256: input.baseline.nativeRuntime.sha256,
            nativeRuntimeSizeBytes: input.baseline.nativeRuntime.sizeBytes,
            semanticInputs: input.baseline.semanticInputs,
            evaluatedInThisStep: false,
            automaticReuseAuthorized: false,
        },
        nextPermittedStep,
    };
}
function fileIdentity(metadata, allowEmpty = false) {
    if (!metadata?.isFile?.() || metadata?.isSymbolicLink?.())
        throw new Error("SQLite input must be a regular file");
    const size = BigInt(metadata.size);
    if ((!allowEmpty && size <= 0n) || size < 0n || size > BigInt(Number.MAX_SAFE_INTEGER))
        throw new Error("SQLite input size is invalid");
    return {
        dev: BigInt(metadata.dev).toString(),
        ino: BigInt(metadata.ino).toString(),
        sizeBytes: Number(size),
        mtimeNs: BigInt(metadata.mtimeNs).toString(),
        ctimeNs: BigInt(metadata.ctimeNs).toString(),
        nlink: BigInt(metadata.nlink).toString(),
        mode: Number(metadata.mode),
    };
}
function assertContained(child, parent, label) {
    const rel = (0, path_1.relative)((0, path_1.resolve)(parent), (0, path_1.resolve)(child));
    if (!rel || rel === ".." || rel.startsWith(`..${path_1.sep}`) || (0, path_1.resolve)(rel) === rel)
        throw new Error(`${label} is not strictly contained`);
}
function assertSnapshotFileIdentity(identity, label) {
    if (identity.nlink !== "1")
        throw new Error(`${label} must have exactly one hard link`);
    if ((identity.mode & 0o222) !== 0)
        throw new Error(`${label} must be read-only`);
}
async function pathIdentity(path, label, allowEmpty = false) {
    let metadata, canonical;
    try {
        metadata = await (0, promises_1.lstat)(path, { bigint: true });
        canonical = await (0, promises_1.realpath)(path);
    }
    catch {
        throw new Error(`${label} must be a contained regular file`);
    }
    if (!sameCanonicalPath(canonical, path))
        throw new Error(`${label} must not be a symlink or reparse alias`);
    return fileIdentity(metadata, allowEmpty);
}
async function handleIdentity(handle, label, allowEmpty = false) {
    try {
        return fileIdentity(await handle.stat({ bigint: true }), allowEmpty);
    }
    catch {
        throw new Error(`${label} handle is not a regular file`);
    }
}
async function hashHandle(handle, expectedSize) {
    const hash = (0, crypto_1.createHash)("sha256");
    const buffer = Buffer.allocUnsafe(64 * 1024);
    let offset = 0;
    let prefix = Buffer.alloc(0);
    while (offset < expectedSize) {
        const { bytesRead } = await handle.read(buffer, 0, Math.min(buffer.length, expectedSize - offset), offset);
        if (bytesRead <= 0)
            throw new Error("C4 snapshot ended before the committed AQ size");
        const chunk = buffer.subarray(0, bytesRead);
        if (prefix.length < SQLITE_HEADER.length)
            prefix = Buffer.concat([prefix, chunk.subarray(0, SQLITE_HEADER.length - prefix.length)]);
        hash.update(chunk);
        offset += bytesRead;
    }
    const extra = Buffer.alloc(1);
    if ((await handle.read(extra, 0, 1, expectedSize)).bytesRead !== 0)
        throw new Error("C4 snapshot exceeds the committed AQ size");
    return { sha256: hash.digest("hex"), readableSqliteHeader: prefix.equals(SQLITE_HEADER) };
}
async function copyHandle(source, destination, expectedSize) {
    const hash = (0, crypto_1.createHash)("sha256");
    const buffer = Buffer.allocUnsafe(64 * 1024);
    let offset = 0;
    while (offset < expectedSize) {
        const { bytesRead } = await source.read(buffer, 0, Math.min(buffer.length, expectedSize - offset), offset);
        if (bytesRead <= 0)
            throw new Error("AQ source ended during C4 snapshot creation");
        const chunk = buffer.subarray(0, bytesRead);
        hash.update(chunk);
        let written = 0;
        while (written < bytesRead) {
            const result = await destination.write(chunk, written, bytesRead - written, offset + written);
            if (result.bytesWritten <= 0)
                throw new Error("C4 snapshot write made no progress");
            written += result.bytesWritten;
        }
        offset += bytesRead;
    }
    const extra = Buffer.alloc(1);
    if ((await source.read(extra, 0, 1, expectedSize)).bytesRead !== 0)
        throw new Error("AQ source exceeds committed size during C4 snapshot creation");
    return hash.digest("hex");
}
async function retireOwnedSnapshotToQuarantine(input) {
    const sourceDirectoryStat = await (0, promises_1.lstat)(input.directory, { bigint: true });
    if (!sourceDirectoryStat.isDirectory() || sourceDirectoryStat.isSymbolicLink()
        || BigInt(sourceDirectoryStat.dev).toString() !== input.directoryDev || BigInt(sourceDirectoryStat.ino).toString() !== input.directoryIno
        || !sameCanonicalPath(await (0, promises_1.realpath)(input.directory), input.directory)) {
        throw new Error("Refusing to clean a replaced C4 snapshot directory");
    }
    const openIdentity = await handleIdentity(input.handle, "C4 snapshot cleanup", true);
    const pathnameIdentity = await pathIdentity(input.path, "C4 snapshot cleanup", true);
    if (!sameObjectIdentity(input.fileIdentity, openIdentity) || !sameObjectIdentity(openIdentity, pathnameIdentity)) {
        throw new Error("Refusing to clean a replaced C4 snapshot file");
    }
    await input.handle.chmod(0o600);
    await input.handle.truncate(0);
    await input.handle.sync();
    const retiredIdentity = await handleIdentity(input.handle, "C4 retired snapshot", true);
    if (!sameObjectIdentity(input.fileIdentity, retiredIdentity) || retiredIdentity.sizeBytes !== 0) {
        throw new Error("C4 snapshot bytes were not retired through the owned descriptor");
    }
    const retiredPathIdentity = await pathIdentity(input.path, "C4 retired snapshot", true);
    if (!sameObjectIdentity(retiredIdentity, retiredPathIdentity)) {
        throw new Error("C4 snapshot pathname changed while its owned bytes were retired");
    }
    await input.handle.close();
    const parent = (0, path_1.dirname)(input.directory);
    const container = (0, path_1.resolve)(parent, `.c4-snapshot-tombstone-${process.pid}-${(0, crypto_1.randomBytes)(12).toString("hex")}`);
    await (0, promises_1.mkdir)(container, { recursive: false, mode: 0o700 });
    const containerStat = await (0, promises_1.lstat)(container, { bigint: true });
    if (!containerStat.isDirectory() || containerStat.isSymbolicLink() || !sameCanonicalPath(await (0, promises_1.realpath)(container), container)) {
        throw new Error("C4 cleanup quarantine container identity is invalid");
    }
    const movedDirectory = (0, path_1.resolve)(container, "snapshot");
    const containerBeforeMove = await (0, promises_1.lstat)(container, { bigint: true });
    if (!containerBeforeMove.isDirectory() || containerBeforeMove.isSymbolicLink()
        || BigInt(containerBeforeMove.dev).toString() !== BigInt(containerStat.dev).toString()
        || BigInt(containerBeforeMove.ino).toString() !== BigInt(containerStat.ino).toString()
        || !sameCanonicalPath(await (0, promises_1.realpath)(container), container)) {
        throw new Error("C4 cleanup quarantine container changed before retirement");
    }
    await (0, promises_1.rename)(input.directory, movedDirectory);
    const movedDirectoryStat = await (0, promises_1.lstat)(movedDirectory, { bigint: true });
    if (!movedDirectoryStat.isDirectory() || movedDirectoryStat.isSymbolicLink()
        || BigInt(movedDirectoryStat.dev).toString() !== input.directoryDev || BigInt(movedDirectoryStat.ino).toString() !== input.directoryIno
        || !sameCanonicalPath(await (0, promises_1.realpath)(movedDirectory), movedDirectory)) {
        throw new Error("C4 cleanup quarantined a replacement directory; it was retained");
    }
    const movedPath = (0, path_1.resolve)(movedDirectory, "database.db");
    const movedIdentity = await pathIdentity(movedPath, "Quarantined C4 snapshot", true);
    if (!sameObjectIdentity(retiredIdentity, movedIdentity) || movedIdentity.sizeBytes !== 0) {
        throw new Error("C4 cleanup quarantined a replacement file; it was retained");
    }
}
async function createPrivateInspectionSnapshot(storeRoot, artifactPath, expectedSize, expectedSha256) {
    const root = (0, path_1.resolve)(storeRoot);
    const rootReal = (0, path_1.resolve)(await (0, promises_1.realpath)(root));
    if (!sameCanonicalPath(root, rootReal))
        throw new Error("C4 store root must be a real directory");
    const source = await (0, promises_1.open)(artifactPath, "r");
    let directory = "";
    let destination;
    let ownedDirectory;
    let ownedFile;
    try {
        const sourceIdentity = await handleIdentity(source, "AQ source database");
        const sourcePathIdentity = await pathIdentity(artifactPath, "AQ source database");
        if (!sameIdentity(sourceIdentity, sourcePathIdentity))
            throw new Error("AQ source pathname does not match its opened descriptor");
        assertSnapshotFileIdentity(sourceIdentity, "AQ source database");
        if (sourceIdentity.sizeBytes !== expectedSize)
            throw new Error("AQ source observed size does not match deterministic metadata");
        assertContained(artifactPath, root, "AQ source database");
        directory = (0, path_1.resolve)(root, `.c4-snapshot-${process.pid}-${(0, crypto_1.randomBytes)(12).toString("hex")}`);
        assertContained(directory, root, "C4 snapshot directory");
        await (0, promises_1.mkdir)(directory, { recursive: false, mode: 0o700 });
        const directoryStat = await (0, promises_1.lstat)(directory, { bigint: true });
        const directoryReal = (0, path_1.resolve)(await (0, promises_1.realpath)(directory));
        if (!directoryStat.isDirectory() || directoryStat.isSymbolicLink() || !sameCanonicalPath(directoryReal, directory))
            throw new Error("C4 snapshot directory identity is invalid");
        ownedDirectory = { dev: BigInt(directoryStat.dev).toString(), ino: BigInt(directoryStat.ino).toString() };
        const snapshotPath = (0, path_1.resolve)(directory, "database.db");
        assertContained(snapshotPath, directory, "C4 snapshot file");
        destination = await (0, promises_1.open)(snapshotPath, "wx+", 0o600);
        const createdIdentity = await handleIdentity(destination, "C4 snapshot", true);
        ownedFile = createdIdentity;
        if (createdIdentity.nlink !== "1")
            throw new Error("C4 snapshot must have exactly one hard link");
        if (!sameIdentity(createdIdentity, await pathIdentity(snapshotPath, "C4 snapshot", true)))
            throw new Error("C4 snapshot pathname does not match its descriptor");
        const copiedSha256 = await copyHandle(source, destination, expectedSize);
        await destination.sync();
        await destination.chmod(0o444);
        await destination.sync();
        const completedIdentity = await handleIdentity(destination, "C4 snapshot");
        assertSnapshotFileIdentity(completedIdentity, "C4 snapshot");
        if (!sameIdentity(completedIdentity, await pathIdentity(snapshotPath, "C4 snapshot")))
            throw new Error("C4 snapshot pathname changed during creation");
        const sourceAfter = await handleIdentity(source, "AQ source database");
        if (!sameIdentity(sourceIdentity, sourceAfter) || copiedSha256 !== expectedSha256 || completedIdentity.sizeBytes !== expectedSize) {
            throw new Error("C4 snapshot does not match the committed AQ bytes");
        }
        const verified = await hashHandle(destination, expectedSize);
        if (verified.sha256 !== expectedSha256)
            throw new Error("C4 snapshot hash does not match AQ metadata");
        await source.close();
        return {
            directory,
            directoryDev: BigInt(directoryStat.dev).toString(),
            directoryIno: BigInt(directoryStat.ino).toString(),
            path: snapshotPath,
            handle: destination,
            identity: completedIdentity,
            sha256: verified.sha256,
            readableSqliteHeader: verified.readableSqliteHeader,
        };
    }
    catch (error) {
        await source.close().catch(() => undefined);
        if (directory && destination && ownedDirectory && ownedFile) {
            try {
                await retireOwnedSnapshotToQuarantine({ directory, directoryDev: ownedDirectory.dev, directoryIno: ownedDirectory.ino, path: (0, path_1.resolve)(directory, "database.db"), handle: destination, fileIdentity: ownedFile });
            }
            catch (cleanupError) {
                await destination.close().catch(() => undefined);
                throw new AggregateError([error, cleanupError], "C4 snapshot creation failed and owned cleanup could not be completed safely");
            }
        }
        else {
            await destination?.close().catch(() => undefined);
        }
        throw error;
    }
}
async function verifyPrivateInspectionSnapshot(snapshot, expectedSize, expectedSha256) {
    const directoryStat = await (0, promises_1.lstat)(snapshot.directory, { bigint: true });
    if (!directoryStat.isDirectory() || directoryStat.isSymbolicLink()
        || BigInt(directoryStat.dev).toString() !== snapshot.directoryDev || BigInt(directoryStat.ino).toString() !== snapshot.directoryIno
        || !sameCanonicalPath(await (0, promises_1.realpath)(snapshot.directory), snapshot.directory))
        throw new Error("C4 snapshot directory changed during inspection");
    const descriptorIdentity = await handleIdentity(snapshot.handle, "C4 snapshot");
    const pathnameIdentity = await pathIdentity(snapshot.path, "C4 snapshot");
    assertSnapshotFileIdentity(descriptorIdentity, "C4 snapshot");
    if (!sameIdentity(snapshot.identity, descriptorIdentity) || !sameIdentity(descriptorIdentity, pathnameIdentity))
        throw new Error("C4 snapshot identity changed during inspection");
    const verified = await hashHandle(snapshot.handle, expectedSize);
    if (verified.sha256 !== expectedSha256 || verified.sha256 !== snapshot.sha256)
        throw new Error("C4 snapshot bytes changed during inspection");
}
async function removePrivateInspectionSnapshot(snapshot) {
    try {
        await verifyPrivateInspectionSnapshot(snapshot, snapshot.identity.sizeBytes, snapshot.sha256);
    }
    catch (error) {
        await snapshot.handle.close().catch(() => undefined);
        throw error;
    }
    await retireOwnedSnapshotToQuarantine({
        directory: snapshot.directory,
        directoryDev: snapshot.directoryDev,
        directoryIno: snapshot.directoryIno,
        path: snapshot.path,
        handle: snapshot.handle,
        fileIdentity: snapshot.identity,
    });
}
async function quarantineSnapshotAfterUnconfirmedBridgeTermination(snapshot) {
    await verifyPrivateInspectionSnapshot(snapshot, snapshot.identity.sizeBytes, snapshot.sha256);
    await snapshot.handle.close();
    const parent = (0, path_1.dirname)(snapshot.directory);
    const container = (0, path_1.resolve)(parent, `.c4-bridge-quarantine-${process.pid}-${(0, crypto_1.randomBytes)(12).toString("hex")}`);
    await (0, promises_1.mkdir)(container, { recursive: false, mode: 0o700 });
    const containerStat = await (0, promises_1.lstat)(container, { bigint: true });
    if (!containerStat.isDirectory() || containerStat.isSymbolicLink() || !sameCanonicalPath(await (0, promises_1.realpath)(container), container)) {
        throw new Error("C4 unconfirmed-bridge quarantine container identity is invalid");
    }
    const containerBeforeMove = await (0, promises_1.lstat)(container, { bigint: true });
    if (BigInt(containerBeforeMove.dev).toString() !== BigInt(containerStat.dev).toString()
        || BigInt(containerBeforeMove.ino).toString() !== BigInt(containerStat.ino).toString()
        || !sameCanonicalPath(await (0, promises_1.realpath)(container), container)) {
        throw new Error("C4 unconfirmed-bridge quarantine container changed before preservation");
    }
    const movedDirectory = (0, path_1.resolve)(container, "snapshot");
    await (0, promises_1.rename)(snapshot.directory, movedDirectory);
    const movedDirectoryStat = await (0, promises_1.lstat)(movedDirectory, { bigint: true });
    if (!movedDirectoryStat.isDirectory() || movedDirectoryStat.isSymbolicLink()
        || BigInt(movedDirectoryStat.dev).toString() !== snapshot.directoryDev
        || BigInt(movedDirectoryStat.ino).toString() !== snapshot.directoryIno
        || !sameCanonicalPath(await (0, promises_1.realpath)(movedDirectory), movedDirectory)) {
        throw new Error("C4 unconfirmed-bridge quarantine moved a replacement directory");
    }
    const movedIdentity = await pathIdentity((0, path_1.resolve)(movedDirectory, "database.db"), "Quarantined unconfirmed-bridge C4 snapshot");
    if (!sameIdentity(snapshot.identity, movedIdentity))
        throw new Error("C4 unconfirmed-bridge quarantine moved a replacement file");
}
function sameIdentity(left, right) {
    return JSON.stringify(left) === JSON.stringify(right);
}
function sameObjectIdentity(left, right) {
    return left.dev === right.dev && left.ino === right.ino && left.nlink === right.nlink;
}
function sameCanonicalPath(left, right) {
    return process.platform === "win32" ? (0, path_1.resolve)(left).toLowerCase() === (0, path_1.resolve)(right).toLowerCase() : (0, path_1.resolve)(left) === (0, path_1.resolve)(right);
}
async function buildGameDbSqliteCompatibility(options) {
    if (arguments.length !== 1 || !options || typeof options !== "object" || Array.isArray(options))
        throw new Error("SQLite compatibility options are invalid");
    const keys = Object.keys(options).sort();
    const explicitIdentity = JSON.stringify(keys) === JSON.stringify(["artifactIdentity", "storeRoot"])
        || JSON.stringify(keys) === JSON.stringify(["artifactIdentity", "signal", "storeRoot"]);
    const explicitLatest = JSON.stringify(keys) === JSON.stringify(["storeRoot", "useLatest"])
        || JSON.stringify(keys) === JSON.stringify(["signal", "storeRoot", "useLatest"]);
    if (!explicitIdentity && !explicitLatest)
        throw new Error("SQLite compatibility requires storeRoot and exactly one AQ artifact selector");
    if (typeof options.storeRoot !== "string" || !options.storeRoot || options.storeRoot.includes("\0"))
        throw new Error("SQLite compatibility storeRoot is invalid");
    if (explicitIdentity && (typeof options.artifactIdentity !== "string" || !SHA256_PATTERN.test(options.artifactIdentity)))
        throw new Error("SQLite compatibility artifactIdentity is invalid");
    if (explicitLatest && options.useLatest !== true)
        throw new Error("SQLite compatibility useLatest selector must be true");
    if ("signal" in options && (typeof options.signal !== "object" || options.signal === null
        || typeof options.signal.aborted !== "boolean" || typeof options.signal.addEventListener !== "function"
        || typeof options.signal.removeEventListener !== "function"))
        throw new Error("SQLite compatibility AbortSignal is invalid");
    if (options.signal?.aborted)
        throw new Error("SQLite compatibility was cancelled");
    const baselineText = await (0, promises_1.readFile)(await canonicalBaselinePath(), "utf8");
    if ((0, crypto_1.createHash)("sha256").update(baselineText.replace(/\r\n/g, "\n")).digest("hex") !== CANONICAL_C4_BASELINE_SHA256)
        throw new Error("Canonical C4 baseline identity is invalid");
    const baseline = JSON.parse(baselineText);
    assertBaseline(baseline);
    const acquired = await (0, game_db_download_database_artifact_1.validateAcquiredDatabaseArtifact)(explicitLatest
        ? { storeRoot: options.storeRoot, useLatest: true }
        : { storeRoot: options.storeRoot, artifactIdentity: options.artifactIdentity });
    const acquiredArtifact = {
        identity: acquired.identity,
        databaseVersion: acquired.metadata.databaseVersion,
        sha256: acquired.metadata.localSha256,
        sizeBytes: acquired.metadata.observedSizeBytes,
        resolvedFromLatest: acquired.resolvedFromLatest,
    };
    const inspectionSize = acquired.metadata.observedSizeBytes;
    if (!Number.isSafeInteger(inspectionSize) || inspectionSize <= 0)
        throw new Error("C4 SQLite size must be a positive safe integer");
    if (inspectionSize > C4_MAX_SQLITE_BYTES)
        throw new Error("C4 SQLite exceeds the pinned 112 MiB inspection limit");
    if (options.signal?.aborted)
        throw new Error("SQLite compatibility was cancelled");
    const snapshot = await createPrivateInspectionSnapshot(options.storeRoot, acquired.artifactPath, inspectionSize, acquired.metadata.localSha256);
    let report;
    let bridgeTerminationUnconfirmed = false;
    try {
        await verifyPrivateInspectionSnapshot(snapshot, acquired.metadata.observedSizeBytes, acquired.metadata.localSha256);
        if (options.signal?.aborted)
            throw new Error("SQLite compatibility was cancelled");
        let inspection;
        if (snapshot.readableSqliteHeader) {
            inspection = await sqlite_readonly_adapter_1.ReadOnlySqliteAdapter.fromDescriptorBoundHandle(snapshot.path, snapshot.handle, inspectionSize, acquired.metadata.localSha256, {
                signal: options.signal,
                timeoutMs: C4_BRIDGE_TIMEOUT_MS,
                killGraceMs: C4_BRIDGE_KILL_GRACE_MS,
                inputLimitBytes: C4_MAX_SQLITE_BYTES,
                stdoutLimitBytes: C4_BRIDGE_STDOUT_LIMIT_BYTES,
                stderrLimitBytes: C4_BRIDGE_STDERR_LIMIT_BYTES,
            }).inspect();
        }
        if (options.signal?.aborted)
            throw new Error("SQLite compatibility was cancelled");
        await verifyPrivateInspectionSnapshot(snapshot, acquired.metadata.observedSizeBytes, acquired.metadata.localSha256);
        const revalidated = await (0, game_db_download_database_artifact_1.validateAcquiredDatabaseArtifact)(explicitLatest
            ? { storeRoot: options.storeRoot, useLatest: true }
            : { storeRoot: options.storeRoot, artifactIdentity: acquired.identity });
        if (revalidated.identity !== acquired.identity || JSON.stringify(revalidated.metadata) !== JSON.stringify(acquired.metadata)) {
            throw new Error("AQ artifact identity changed during C4 compatibility inspection");
        }
        const inspectionSnapshot = {
            acquiredArtifactIdentity: acquired.identity,
            sha256: snapshot.sha256,
            sizeBytes: snapshot.identity.sizeBytes,
        };
        if (!snapshot.readableSqliteHeader) {
            report = evaluateGameDbSqliteCompatibility({ baseline, acquiredArtifactState: "encrypted_or_packaged", acquiredArtifact, inspectionSnapshot });
        }
        else {
            if (!inspection)
                throw new Error("SQLite inspection result is missing");
            report = evaluateGameDbSqliteCompatibility({
                baseline,
                acquiredArtifactState: "readable_sqlite",
                acquiredArtifact,
                inspectionSnapshot,
                sourceDatabase: { sha256: snapshot.sha256, sizeBytes: snapshot.identity.sizeBytes, inspection },
            });
        }
    }
    catch (error) {
        bridgeTerminationUnconfirmed = error instanceof sqlite_readonly_adapter_1.SqliteBridgeTerminationUnconfirmedError;
        throw error;
    }
    finally {
        if (bridgeTerminationUnconfirmed)
            await quarantineSnapshotAfterUnconfirmedBridgeTermination(snapshot);
        else
            await removePrivateInspectionSnapshot(snapshot);
    }
    return report;
}
exports.buildGameDbSqliteCompatibility = buildGameDbSqliteCompatibility;
function parseGameDbSqliteCompatibilityArgs(argv) {
    let storeRoot;
    let artifactIdentity;
    let useLatest = false;
    let outputFile;
    for (let index = 0; index < argv.length; index += 1) {
        const token = argv[index];
        if (token === "--latest") {
            if (useLatest)
                throw new Error("Duplicate --latest");
            useLatest = true;
            continue;
        }
        const name = token.includes("=") ? token.slice(0, token.indexOf("=")) : token;
        const value = token.includes("=") ? token.slice(token.indexOf("=") + 1) : argv[++index];
        if (!value)
            throw new Error(`Missing value for ${name}`);
        if (name === "--store-root")
            storeRoot = value;
        else if (name === "--artifact-identity")
            artifactIdentity = value;
        else if (name === "--output-file")
            outputFile = value;
        else
            throw new Error(`Unexpected argument: ${name}`);
    }
    if (!storeRoot)
        throw new Error("Missing --store-root");
    if (Boolean(artifactIdentity) === useLatest)
        throw new Error("Choose exactly one of --artifact-identity or --latest");
    const selector = useLatest ? { storeRoot, useLatest: true } : { storeRoot, artifactIdentity: artifactIdentity };
    return outputFile ? { ...selector, outputFile } : selector;
}
exports.parseGameDbSqliteCompatibilityArgs = parseGameDbSqliteCompatibilityArgs;
async function writeReportAtomic(outputFile, report) {
    const target = (0, path_1.resolve)(outputFile);
    const temporary = `${target}.tmp-${process.pid}`;
    await (0, promises_1.mkdir)((0, path_1.dirname)(target), { recursive: true });
    try {
        await (0, promises_1.writeFile)(temporary, `${JSON.stringify(report, null, 2)}\n`, { flag: "wx" });
        await (0, promises_1.rename)(temporary, target);
    }
    catch (error) {
        await (0, promises_1.unlink)(temporary).catch(() => undefined);
        throw error;
    }
}
async function main() {
    const options = parseGameDbSqliteCompatibilityArgs(process.argv.slice(2));
    const report = await buildGameDbSqliteCompatibility("useLatest" in options
        ? { storeRoot: options.storeRoot, useLatest: true }
        : { storeRoot: options.storeRoot, artifactIdentity: options.artifactIdentity });
    if (options.outputFile)
        await writeReportAtomic(options.outputFile, report);
    console.log(JSON.stringify(report, null, 2));
}
if (require.main === module) {
    main().catch(error => {
        console.error(error);
        process.exitCode = 1;
    });
}
//# sourceMappingURL=game-db-sqlite-compatibility.js.map