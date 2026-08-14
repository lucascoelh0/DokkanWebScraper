import { createHash, randomBytes } from "crypto";
import { FileHandle, lstat, mkdir, open, readFile, realpath, rename, unlink, writeFile } from "fs/promises";
import { dirname, relative, resolve, sep } from "path";
import { ReadOnlySqliteAdapter, SqliteBridgeTerminationUnconfirmedError, SqliteInspection } from "../database-experiment/sqlite-readonly-adapter";
import { integrationC4SchemaSha256 } from "../database-integration/integration-c4-builder";
import { IntegrationC4Baseline } from "../database-integration/integration-c4-contract";
import { GameDbDerivedSqliteArtifactMetadata } from "./game-db-derived-sqlite-artifact-contract";
import { validateDerivedSqliteArtifact } from "./game-db-derived-sqlite-artifact-validator";
import { validateAcquiredDatabaseArtifact } from "./game-db-download-database-artifact";

const SQLITE_HEADER = Buffer.from("SQLite format 3\u0000", "utf8");
const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const CANONICAL_C4_BASELINE_SHA256 = "c46ccbfe6581e2c1f681c3527420cc432fa7f0b91ca32d52a24b4df6e79999a1";
const C4_MAX_SQLITE_BYTES = 112 * 1024 * 1024;
const C4_BRIDGE_TIMEOUT_MS = 120_000;
const C4_BRIDGE_KILL_GRACE_MS = 1_000;
const C4_BRIDGE_STDOUT_LIMIT_BYTES = 8 * 1024 * 1024;
const C4_BRIDGE_STDERR_LIMIT_BYTES = 1 * 1024 * 1024;

export type GameDbSqliteCompatibilityStatus =
    | "exact_profile_match"
    | "schema_compatible_but_evidence_refresh_required"
    | "incompatible"
    | "unknown";

interface GameDbSqliteCompatibilityProfile {
    snapshotVersion: string,
    sourceDatabase: {
        expectedSha256: string,
        expectedSizeBytes: number,
        expectedTableCount: number,
        expectedSchemaSha256: string,
        actualSha256: string | null,
        actualSizeBytes: number | null,
        actualTableCount: number | null,
        actualSchemaSha256: string | null,
    },
    missingRequiredColumns: string[],
}

interface GameDbSqliteCompatibilityNativeEvidence {
    nativeRuntimeSha256: string,
    nativeRuntimeSizeBytes: number,
    semanticInputs: IntegrationC4Baseline["semanticInputs"],
    evaluatedInThisStep: false,
    automaticReuseAuthorized: false,
}

type GameDbSqliteCompatibilityNextStep =
    | "decrypt_locally_then_repeat_read_only_compatibility"
    | "run_c4_with_exact_pinned_elf_and_semantic_artifacts"
    | "refresh_bounded_native_evidence_then_review_c4_baseline"
    | "stop_incompatible_sqlite";

export interface GameDbSqliteCompatibilityAqReport {
    schemaVersion: 1,
    contract: "dokkan-game-db-sqlite-compatibility",
    contractVersion: "1.2.0",
    status: GameDbSqliteCompatibilityStatus,
    acquiredArtifactState: "readable_sqlite" | "encrypted_or_packaged",
    acquiredArtifact: {
        identity: string,
        databaseVersion: number,
        sha256: string,
        sizeBytes: number,
        resolvedFromLatest: boolean,
    },
    inspectionSnapshot: {
        acquiredArtifactIdentity: string,
        sha256: string,
        sizeBytes: number,
    },
    c4Profile: GameDbSqliteCompatibilityProfile,
    pinnedNativeEvidence: GameDbSqliteCompatibilityNativeEvidence,
    nextPermittedStep: GameDbSqliteCompatibilityNextStep,
}

export interface GameDbSqliteCompatibilityDqReport {
    schemaVersion: 1,
    contract: "dokkan-game-db-sqlite-compatibility",
    contractVersion: "1.3.0",
    sourceKind: "dq_derived",
    status: GameDbSqliteCompatibilityStatus,
    derivedArtifact: {
        identity: string,
        outputSha256: string,
        outputSizeBytes: number,
        outputState: "readable_sqlite",
        parentAcquiredArtifact: {
            identity: string,
            sha256: string,
            sizeBytes: number,
            state: "readable_sqlite" | "encrypted_or_packaged",
        },
    },
    inspectionSnapshot: {
        source: "dq_derived_output",
        derivedArtifactIdentity: string,
        sha256: string,
        sizeBytes: number,
    },
    c4Profile: GameDbSqliteCompatibilityProfile,
    pinnedNativeEvidence: GameDbSqliteCompatibilityNativeEvidence,
    nextPermittedStep: Exclude<GameDbSqliteCompatibilityNextStep, "decrypt_locally_then_repeat_read_only_compatibility">,
}

export type GameDbSqliteCompatibilityReport = GameDbSqliteCompatibilityAqReport | GameDbSqliteCompatibilityDqReport;

export type GameDbSqliteCompatibilityAqOptions =
    | { storeRoot: string, artifactIdentity: string, signal?: AbortSignal }
    | { storeRoot: string, useLatest: true, signal?: AbortSignal };

export type GameDbSqliteCompatibilityDqOptions = {
    derivedStoreRoot: string,
    sourceStoreRoot: string,
    derivedArtifactIdentity: string,
    signal?: AbortSignal,
};

export type GameDbSqliteCompatibilityOptions = GameDbSqliteCompatibilityAqOptions | GameDbSqliteCompatibilityDqOptions;

export type GameDbSqliteCompatibilityCliOptions = (GameDbSqliteCompatibilityAqOptions | GameDbSqliteCompatibilityDqOptions) & { outputFile?: string };

interface GameDbSqliteFileIdentity {
    dev: string,
    ino: string,
    sizeBytes: number,
    mtimeNs: string,
    ctimeNs: string,
    nlink: string,
    mode: number,
}

async function canonicalBaselinePath(): Promise<string> {
    let directory = resolve(__dirname);
    while (true) {
        const candidate = resolve(directory, "database-integration", "integration-c4-baseline.json");
        const packageFile = resolve(directory, "package.json");
        try {
            const packageReal = await realpath(packageFile);
            const candidateReal = await realpath(candidate);
            if (sameCanonicalPath(packageReal, packageFile) && sameCanonicalPath(candidateReal, candidate)) return candidateReal;
        } catch { /* keep walking to the repository root */ }
        const parent = dirname(directory);
        if (parent === directory) throw new Error("Canonical C4 baseline is unavailable");
        directory = parent;
    }
}

function assertBaseline(value: unknown): asserts value is IntegrationC4Baseline {
    const baseline = value as Partial<IntegrationC4Baseline> | null;
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
    for (const gate of ["DB48", "DB49", "DB50"] as const) {
        if (!baseline.semanticInputs?.[gate] || !SHA256_PATTERN.test(baseline.semanticInputs[gate].sha256)) {
            throw new Error(`Invalid C4 ${gate} evidence profile`);
        }
    }
}

function missingRequiredColumns(baseline: IntegrationC4Baseline, inspection: SqliteInspection): string[] {
    const actual = new Map(inspection.tables.map(table => [table.name, new Set(table.columns)]));
    const missing: string[] = [];
    for (const table of Object.keys(baseline.sourceDatabase.requiredTables).sort()) {
        for (const column of [...baseline.sourceDatabase.requiredTables[table]].sort()) {
            if (!actual.get(table)?.has(column)) missing.push(`${table}.${column}`);
        }
    }
    return missing;
}

function evaluateSqliteProfile(input: {
    baseline: IntegrationC4Baseline,
    artifactState: "readable_sqlite" | "encrypted_or_packaged",
    sourceDatabase?: { sha256: string, sizeBytes: number, inspection: SqliteInspection },
}): {
    status: GameDbSqliteCompatibilityStatus,
    c4Profile: GameDbSqliteCompatibilityProfile,
    pinnedNativeEvidence: GameDbSqliteCompatibilityNativeEvidence,
    nextPermittedStep: GameDbSqliteCompatibilityNextStep,
} {
    assertBaseline(input.baseline);
    if (input.artifactState !== "readable_sqlite" && input.artifactState !== "encrypted_or_packaged") {
        throw new Error("Invalid acquired artifact state");
    }
    const source = input.sourceDatabase;
    if (input.artifactState === "readable_sqlite" && !source) {
        throw new Error("Readable SQLite compatibility requires a source inspection");
    }
    if (source && (!SHA256_PATTERN.test(source.sha256) || !Number.isSafeInteger(source.sizeBytes) || source.sizeBytes <= 0)) {
        throw new Error("Invalid observed SQLite identity");
    }
    const schemaSha256 = source ? integrationC4SchemaSha256(source.inspection) : null;
    const missing = source ? missingRequiredColumns(input.baseline, source.inspection) : [];
    const exact = Boolean(source
        && source.sha256 === input.baseline.sourceDatabase.sha256
        && source.sizeBytes === input.baseline.sourceDatabase.sizeBytes
        && source.inspection.tableCount === input.baseline.sourceDatabase.tableCount
        && schemaSha256 === input.baseline.sourceDatabase.schemaSha256);
    const status: GameDbSqliteCompatibilityStatus = input.artifactState === "encrypted_or_packaged"
        ? "unknown"
        : missing.length > 0
            ? "incompatible"
            : exact
                ? "exact_profile_match"
                : "schema_compatible_but_evidence_refresh_required";
    const nextPermittedStep: GameDbSqliteCompatibilityNextStep = status === "unknown"
        ? "decrypt_locally_then_repeat_read_only_compatibility"
        : status === "exact_profile_match"
            ? "run_c4_with_exact_pinned_elf_and_semantic_artifacts"
            : status === "schema_compatible_but_evidence_refresh_required"
                ? "refresh_bounded_native_evidence_then_review_c4_baseline"
                : "stop_incompatible_sqlite";

    return {
        status,
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

function evaluateGameDbSqliteCompatibility(input: {
    baseline: IntegrationC4Baseline,
    acquiredArtifactState: "readable_sqlite" | "encrypted_or_packaged",
    acquiredArtifact: GameDbSqliteCompatibilityAqReport["acquiredArtifact"],
    inspectionSnapshot: GameDbSqliteCompatibilityAqReport["inspectionSnapshot"],
    sourceDatabase?: { sha256: string, sizeBytes: number, inspection: SqliteInspection },
}): GameDbSqliteCompatibilityAqReport {
    if (input.inspectionSnapshot.acquiredArtifactIdentity !== input.acquiredArtifact.identity
        || input.inspectionSnapshot.sha256 !== input.acquiredArtifact.sha256
        || input.inspectionSnapshot.sizeBytes !== input.acquiredArtifact.sizeBytes) {
        throw new Error("C4 inspection snapshot identity diverges from the acquired AQ artifact");
    }
    const evaluation = evaluateSqliteProfile({ baseline: input.baseline, artifactState: input.acquiredArtifactState, sourceDatabase: input.sourceDatabase });
    return {
        schemaVersion: 1,
        contract: "dokkan-game-db-sqlite-compatibility",
        contractVersion: "1.2.0",
        acquiredArtifactState: input.acquiredArtifactState,
        acquiredArtifact: input.acquiredArtifact,
        inspectionSnapshot: input.inspectionSnapshot,
        ...evaluation,
    };
}

function evaluateDerivedGameDbSqliteCompatibility(input: {
    baseline: IntegrationC4Baseline,
    identity: string,
    metadata: GameDbDerivedSqliteArtifactMetadata,
    inspectionSnapshot: GameDbSqliteCompatibilityDqReport["inspectionSnapshot"],
    sourceDatabase: { sha256: string, sizeBytes: number, inspection: SqliteInspection },
}): GameDbSqliteCompatibilityDqReport {
    if (input.inspectionSnapshot.source !== "dq_derived_output"
        || input.inspectionSnapshot.derivedArtifactIdentity !== input.identity
        || input.inspectionSnapshot.sha256 !== input.metadata.output.sha256
        || input.inspectionSnapshot.sizeBytes !== input.metadata.output.sizeBytes) {
        throw new Error("C4 inspection snapshot identity diverges from the derived DQ output");
    }
    const evaluation = evaluateSqliteProfile({ baseline: input.baseline, artifactState: "readable_sqlite", sourceDatabase: input.sourceDatabase });
    const { nextPermittedStep } = evaluation;
    if (nextPermittedStep === "decrypt_locally_then_repeat_read_only_compatibility") {
        throw new Error("Derived readable SQLite produced an invalid C4 next step");
    }
    return {
        schemaVersion: 1,
        contract: "dokkan-game-db-sqlite-compatibility",
        contractVersion: "1.3.0",
        sourceKind: "dq_derived",
        derivedArtifact: {
            identity: input.identity,
            outputSha256: input.metadata.output.sha256,
            outputSizeBytes: input.metadata.output.sizeBytes,
            outputState: "readable_sqlite",
            parentAcquiredArtifact: {
                identity: input.metadata.parent.artifactIdentity,
                sha256: input.metadata.parent.sourceSha256,
                sizeBytes: input.metadata.parent.sourceSizeBytes,
                state: input.metadata.parent.sourceState,
            },
        },
        inspectionSnapshot: input.inspectionSnapshot,
        status: evaluation.status,
        c4Profile: evaluation.c4Profile,
        pinnedNativeEvidence: evaluation.pinnedNativeEvidence,
        nextPermittedStep,
    };
}

function fileIdentity(metadata: any, allowEmpty = false): GameDbSqliteFileIdentity {
    if (!metadata?.isFile?.() || metadata?.isSymbolicLink?.()) throw new Error("SQLite input must be a regular file");
    const size = BigInt(metadata.size);
    if ((!allowEmpty && size <= 0n) || size < 0n || size > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error("SQLite input size is invalid");
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

function assertContained(child: string, parent: string, label: string): void {
    const rel = relative(resolve(parent), resolve(child));
    if (!rel || rel === ".." || rel.startsWith(`..${sep}`) || resolve(rel) === rel) throw new Error(`${label} is not strictly contained`);
}

function assertSnapshotFileIdentity(identity: GameDbSqliteFileIdentity, label: string): void {
    if (identity.nlink !== "1") throw new Error(`${label} must have exactly one hard link`);
    if ((identity.mode & 0o222) !== 0) throw new Error(`${label} must be read-only`);
}

async function pathIdentity(path: string, label: string, allowEmpty = false): Promise<GameDbSqliteFileIdentity> {
    let metadata: any, canonical: string;
    try {
        metadata = await lstat(path, { bigint: true });
        canonical = await realpath(path);
    } catch { throw new Error(`${label} must be a contained regular file`); }
    if (!sameCanonicalPath(canonical, path)) throw new Error(`${label} must not be a symlink or reparse alias`);
    return fileIdentity(metadata, allowEmpty);
}

async function handleIdentity(handle: FileHandle, label: string, allowEmpty = false): Promise<GameDbSqliteFileIdentity> {
    try { return fileIdentity(await handle.stat({ bigint: true }), allowEmpty); }
    catch { throw new Error(`${label} handle is not a regular file`); }
}

async function hashHandle(handle: FileHandle, expectedSize: number): Promise<{ sha256: string, readableSqliteHeader: boolean }> {
    const hash = createHash("sha256");
    const buffer = Buffer.allocUnsafe(64 * 1024);
    let offset = 0;
    let prefix = Buffer.alloc(0);
    while (offset < expectedSize) {
        const { bytesRead } = await handle.read(buffer, 0, Math.min(buffer.length, expectedSize - offset), offset);
        if (bytesRead <= 0) throw new Error("C4 snapshot ended before the committed source size");
        const chunk = buffer.subarray(0, bytesRead);
        if (prefix.length < SQLITE_HEADER.length) prefix = Buffer.concat([prefix, chunk.subarray(0, SQLITE_HEADER.length - prefix.length)]);
        hash.update(chunk);
        offset += bytesRead;
    }
    const extra = Buffer.alloc(1);
    if ((await handle.read(extra, 0, 1, expectedSize)).bytesRead !== 0) throw new Error("C4 snapshot exceeds the committed source size");
    return { sha256: hash.digest("hex"), readableSqliteHeader: prefix.equals(SQLITE_HEADER) };
}

async function copyHandle(source: FileHandle, destination: FileHandle, expectedSize: number): Promise<string> {
    const hash = createHash("sha256");
    const buffer = Buffer.allocUnsafe(64 * 1024);
    let offset = 0;
    while (offset < expectedSize) {
        const { bytesRead } = await source.read(buffer, 0, Math.min(buffer.length, expectedSize - offset), offset);
        if (bytesRead <= 0) throw new Error("Committed source ended during C4 snapshot creation");
        const chunk = buffer.subarray(0, bytesRead);
        hash.update(chunk);
        let written = 0;
        while (written < bytesRead) {
            const result = await destination.write(chunk, written, bytesRead - written, offset + written);
            if (result.bytesWritten <= 0) throw new Error("C4 snapshot write made no progress");
            written += result.bytesWritten;
        }
        offset += bytesRead;
    }
    const extra = Buffer.alloc(1);
    if ((await source.read(extra, 0, 1, expectedSize)).bytesRead !== 0) throw new Error("Committed source exceeds its size during C4 snapshot creation");
    return hash.digest("hex");
}

interface PrivateInspectionSnapshot {
    directory: string,
    directoryDev: string,
    directoryIno: string,
    path: string,
    handle: FileHandle,
    identity: GameDbSqliteFileIdentity,
    sha256: string,
    readableSqliteHeader: boolean,
}

async function retireOwnedSnapshotToQuarantine(input: {
    directory: string,
    directoryDev: string,
    directoryIno: string,
    path: string,
    handle: FileHandle,
    fileIdentity: GameDbSqliteFileIdentity,
}): Promise<void> {
    const sourceDirectoryStat: any = await lstat(input.directory, { bigint: true });
    if (!sourceDirectoryStat.isDirectory() || sourceDirectoryStat.isSymbolicLink()
        || BigInt(sourceDirectoryStat.dev).toString() !== input.directoryDev || BigInt(sourceDirectoryStat.ino).toString() !== input.directoryIno
        || !sameCanonicalPath(await realpath(input.directory), input.directory)) {
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

    const parent = dirname(input.directory);
    const container = resolve(parent, `.c4-snapshot-tombstone-${process.pid}-${randomBytes(12).toString("hex")}`);
    await mkdir(container, { recursive: false, mode: 0o700 });
    const containerStat: any = await lstat(container, { bigint: true });
    if (!containerStat.isDirectory() || containerStat.isSymbolicLink() || !sameCanonicalPath(await realpath(container), container)) {
        throw new Error("C4 cleanup quarantine container identity is invalid");
    }
    const movedDirectory = resolve(container, "snapshot");
    const containerBeforeMove: any = await lstat(container, { bigint: true });
    if (!containerBeforeMove.isDirectory() || containerBeforeMove.isSymbolicLink()
        || BigInt(containerBeforeMove.dev).toString() !== BigInt(containerStat.dev).toString()
        || BigInt(containerBeforeMove.ino).toString() !== BigInt(containerStat.ino).toString()
        || !sameCanonicalPath(await realpath(container), container)) {
        throw new Error("C4 cleanup quarantine container changed before retirement");
    }
    await rename(input.directory, movedDirectory);
    const movedDirectoryStat: any = await lstat(movedDirectory, { bigint: true });
    if (!movedDirectoryStat.isDirectory() || movedDirectoryStat.isSymbolicLink()
        || BigInt(movedDirectoryStat.dev).toString() !== input.directoryDev || BigInt(movedDirectoryStat.ino).toString() !== input.directoryIno
        || !sameCanonicalPath(await realpath(movedDirectory), movedDirectory)) {
        throw new Error("C4 cleanup quarantined a replacement directory; it was retained");
    }
    const movedPath = resolve(movedDirectory, "database.db");
    const movedIdentity = await pathIdentity(movedPath, "Quarantined C4 snapshot", true);
    if (!sameObjectIdentity(retiredIdentity, movedIdentity) || movedIdentity.sizeBytes !== 0) {
        throw new Error("C4 cleanup quarantined a replacement file; it was retained");
    }
}

async function createPrivateInspectionSnapshot(storeRoot: string, artifactPath: string, expectedSize: number, expectedSha256: string): Promise<PrivateInspectionSnapshot> {
    const root = resolve(storeRoot);
    const rootReal = resolve(await realpath(root));
    if (!sameCanonicalPath(root, rootReal)) throw new Error("C4 store root must be a real directory");
    const source = await open(artifactPath, "r");
    let directory = "";
    let destination: FileHandle | undefined;
    let ownedDirectory: { dev: string, ino: string } | undefined;
    let ownedFile: GameDbSqliteFileIdentity | undefined;
    try {
        const sourceIdentity = await handleIdentity(source, "C4 authority source database");
        const sourcePathIdentity = await pathIdentity(artifactPath, "C4 authority source database");
        if (!sameIdentity(sourceIdentity, sourcePathIdentity)) throw new Error("C4 authority source pathname does not match its opened descriptor");
        assertSnapshotFileIdentity(sourceIdentity, "C4 authority source database");
        if (sourceIdentity.sizeBytes !== expectedSize) throw new Error("C4 authority source observed size does not match deterministic metadata");
        assertContained(artifactPath, root, "C4 authority source database");
        directory = resolve(root, `.c4-snapshot-${process.pid}-${randomBytes(12).toString("hex")}`);
        assertContained(directory, root, "C4 snapshot directory");
        await mkdir(directory, { recursive: false, mode: 0o700 });
        const directoryStat: any = await lstat(directory, { bigint: true });
        const directoryReal = resolve(await realpath(directory));
        if (!directoryStat.isDirectory() || directoryStat.isSymbolicLink() || !sameCanonicalPath(directoryReal, directory)) throw new Error("C4 snapshot directory identity is invalid");
        ownedDirectory = { dev: BigInt(directoryStat.dev).toString(), ino: BigInt(directoryStat.ino).toString() };
        const snapshotPath = resolve(directory, "database.db");
        assertContained(snapshotPath, directory, "C4 snapshot file");
        destination = await open(snapshotPath, "wx+", 0o600);
        const createdIdentity = await handleIdentity(destination, "C4 snapshot", true);
        ownedFile = createdIdentity;
        if (createdIdentity.nlink !== "1") throw new Error("C4 snapshot must have exactly one hard link");
        if (!sameIdentity(createdIdentity, await pathIdentity(snapshotPath, "C4 snapshot", true))) throw new Error("C4 snapshot pathname does not match its descriptor");
        const copiedSha256 = await copyHandle(source, destination, expectedSize);
        await destination.sync();
        await destination.chmod(0o444);
        await destination.sync();
        const completedIdentity = await handleIdentity(destination, "C4 snapshot");
        assertSnapshotFileIdentity(completedIdentity, "C4 snapshot");
        if (!sameIdentity(completedIdentity, await pathIdentity(snapshotPath, "C4 snapshot"))) throw new Error("C4 snapshot pathname changed during creation");
        const sourceAfter = await handleIdentity(source, "C4 authority source database");
        if (!sameIdentity(sourceIdentity, sourceAfter) || copiedSha256 !== expectedSha256 || completedIdentity.sizeBytes !== expectedSize) {
            throw new Error("C4 snapshot does not match the committed source bytes");
        }
        const verified = await hashHandle(destination, expectedSize);
        if (verified.sha256 !== expectedSha256) throw new Error("C4 snapshot hash does not match committed metadata");
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
    } catch (error) {
        await source.close().catch(() => undefined);
        if (directory && destination && ownedDirectory && ownedFile) {
            try {
                await retireOwnedSnapshotToQuarantine({ directory, directoryDev: ownedDirectory.dev, directoryIno: ownedDirectory.ino, path: resolve(directory, "database.db"), handle: destination, fileIdentity: ownedFile });
            } catch (cleanupError) {
                await destination.close().catch(() => undefined);
                throw new AggregateError([error, cleanupError], "C4 snapshot creation failed and owned cleanup could not be completed safely");
            }
        } else {
            await destination?.close().catch(() => undefined);
        }
        throw error;
    }
}

async function verifyPrivateInspectionSnapshot(snapshot: PrivateInspectionSnapshot, expectedSize: number, expectedSha256: string): Promise<void> {
    const directoryStat: any = await lstat(snapshot.directory, { bigint: true });
    if (!directoryStat.isDirectory() || directoryStat.isSymbolicLink()
        || BigInt(directoryStat.dev).toString() !== snapshot.directoryDev || BigInt(directoryStat.ino).toString() !== snapshot.directoryIno
        || !sameCanonicalPath(await realpath(snapshot.directory), snapshot.directory)) throw new Error("C4 snapshot directory changed during inspection");
    const descriptorIdentity = await handleIdentity(snapshot.handle, "C4 snapshot");
    const pathnameIdentity = await pathIdentity(snapshot.path, "C4 snapshot");
    assertSnapshotFileIdentity(descriptorIdentity, "C4 snapshot");
    if (!sameIdentity(snapshot.identity, descriptorIdentity) || !sameIdentity(descriptorIdentity, pathnameIdentity)) throw new Error("C4 snapshot identity changed during inspection");
    const verified = await hashHandle(snapshot.handle, expectedSize);
    if (verified.sha256 !== expectedSha256 || verified.sha256 !== snapshot.sha256) throw new Error("C4 snapshot bytes changed during inspection");
}

async function removePrivateInspectionSnapshot(snapshot: PrivateInspectionSnapshot): Promise<void> {
    try { await verifyPrivateInspectionSnapshot(snapshot, snapshot.identity.sizeBytes, snapshot.sha256); }
    catch (error) { await snapshot.handle.close().catch(() => undefined); throw error; }
    await retireOwnedSnapshotToQuarantine({
        directory: snapshot.directory,
        directoryDev: snapshot.directoryDev,
        directoryIno: snapshot.directoryIno,
        path: snapshot.path,
        handle: snapshot.handle,
        fileIdentity: snapshot.identity,
    });
}

async function quarantineSnapshotAfterUnconfirmedBridgeTermination(snapshot: PrivateInspectionSnapshot): Promise<void> {
    await verifyPrivateInspectionSnapshot(snapshot, snapshot.identity.sizeBytes, snapshot.sha256);
    await snapshot.handle.close();
    const parent = dirname(snapshot.directory);
    const container = resolve(parent, `.c4-bridge-quarantine-${process.pid}-${randomBytes(12).toString("hex")}`);
    await mkdir(container, { recursive: false, mode: 0o700 });
    const containerStat: any = await lstat(container, { bigint: true });
    if (!containerStat.isDirectory() || containerStat.isSymbolicLink() || !sameCanonicalPath(await realpath(container), container)) {
        throw new Error("C4 unconfirmed-bridge quarantine container identity is invalid");
    }
    const containerBeforeMove: any = await lstat(container, { bigint: true });
    if (BigInt(containerBeforeMove.dev).toString() !== BigInt(containerStat.dev).toString()
        || BigInt(containerBeforeMove.ino).toString() !== BigInt(containerStat.ino).toString()
        || !sameCanonicalPath(await realpath(container), container)) {
        throw new Error("C4 unconfirmed-bridge quarantine container changed before preservation");
    }
    const movedDirectory = resolve(container, "snapshot");
    await rename(snapshot.directory, movedDirectory);
    const movedDirectoryStat: any = await lstat(movedDirectory, { bigint: true });
    if (!movedDirectoryStat.isDirectory() || movedDirectoryStat.isSymbolicLink()
        || BigInt(movedDirectoryStat.dev).toString() !== snapshot.directoryDev
        || BigInt(movedDirectoryStat.ino).toString() !== snapshot.directoryIno
        || !sameCanonicalPath(await realpath(movedDirectory), movedDirectory)) {
        throw new Error("C4 unconfirmed-bridge quarantine moved a replacement directory");
    }
    const movedIdentity = await pathIdentity(resolve(movedDirectory, "database.db"), "Quarantined unconfirmed-bridge C4 snapshot");
    if (!sameIdentity(snapshot.identity, movedIdentity)) throw new Error("C4 unconfirmed-bridge quarantine moved a replacement file");
}

function sameIdentity(left: GameDbSqliteFileIdentity, right: GameDbSqliteFileIdentity): boolean {
    return JSON.stringify(left) === JSON.stringify(right);
}

function sameObjectIdentity(left: GameDbSqliteFileIdentity, right: GameDbSqliteFileIdentity): boolean {
    return left.dev === right.dev && left.ino === right.ino && left.nlink === right.nlink;
}

function sameCanonicalPath(left: string, right: string): boolean {
    return process.platform === "win32" ? resolve(left).toLowerCase() === resolve(right).toLowerCase() : resolve(left) === resolve(right);
}

function isPlainRuntimeOptions(value: unknown): value is Record<string, unknown> {
    if (!value || typeof value !== "object" || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype || Object.getOwnPropertySymbols(value).length !== 0) return false;
    return Object.values(Object.getOwnPropertyDescriptors(value)).every(descriptor => "value" in descriptor && descriptor.enumerable === true);
}

function assertInspectionSize(size: number): void {
    if (!Number.isSafeInteger(size) || size <= 0) throw new Error("C4 SQLite size must be a positive safe integer");
    if (size > C4_MAX_SQLITE_BYTES) throw new Error("C4 SQLite exceeds the pinned 112 MiB inspection limit");
}

export function buildGameDbSqliteCompatibility(options: GameDbSqliteCompatibilityAqOptions): Promise<GameDbSqliteCompatibilityAqReport>;
export function buildGameDbSqliteCompatibility(options: GameDbSqliteCompatibilityDqOptions): Promise<GameDbSqliteCompatibilityDqReport>;
export function buildGameDbSqliteCompatibility(options: GameDbSqliteCompatibilityOptions): Promise<GameDbSqliteCompatibilityReport>;
export async function buildGameDbSqliteCompatibility(options: GameDbSqliteCompatibilityOptions): Promise<GameDbSqliteCompatibilityReport> {
    if (arguments.length !== 1 || !isPlainRuntimeOptions(options)) throw new Error("SQLite compatibility options are invalid");
    const keys = Object.keys(options).sort();
    const explicitIdentity = JSON.stringify(keys) === JSON.stringify(["artifactIdentity", "storeRoot"])
        || JSON.stringify(keys) === JSON.stringify(["artifactIdentity", "signal", "storeRoot"]);
    const explicitLatest = JSON.stringify(keys) === JSON.stringify(["storeRoot", "useLatest"])
        || JSON.stringify(keys) === JSON.stringify(["signal", "storeRoot", "useLatest"]);
    const explicitDerived = JSON.stringify(keys) === JSON.stringify(["derivedArtifactIdentity", "derivedStoreRoot", "sourceStoreRoot"])
        || JSON.stringify(keys) === JSON.stringify(["derivedArtifactIdentity", "derivedStoreRoot", "signal", "sourceStoreRoot"]);
    if ([explicitIdentity, explicitLatest, explicitDerived].filter(Boolean).length !== 1) {
        throw new Error("SQLite compatibility requires exactly one supported selector: AQ artifact selector or DQ artifact selector");
    }
    if (!explicitDerived && (typeof (options as any).storeRoot !== "string" || !(options as any).storeRoot || (options as any).storeRoot.includes("\0"))) {
        throw new Error("SQLite compatibility storeRoot is invalid");
    }
    if (explicitIdentity && (typeof (options as any).artifactIdentity !== "string" || !SHA256_PATTERN.test((options as any).artifactIdentity))) throw new Error("SQLite compatibility artifactIdentity is invalid");
    if (explicitLatest && (options as any).useLatest !== true) throw new Error("SQLite compatibility useLatest selector must be true");
    if (explicitDerived) {
        const derivedOptions = options as GameDbSqliteCompatibilityDqOptions;
        if (typeof derivedOptions.derivedStoreRoot !== "string" || !derivedOptions.derivedStoreRoot || derivedOptions.derivedStoreRoot.includes("\0")) throw new Error("SQLite compatibility derivedStoreRoot is invalid");
        if (typeof derivedOptions.sourceStoreRoot !== "string" || !derivedOptions.sourceStoreRoot || derivedOptions.sourceStoreRoot.includes("\0")) throw new Error("SQLite compatibility sourceStoreRoot is invalid");
        if (typeof derivedOptions.derivedArtifactIdentity !== "string" || !SHA256_PATTERN.test(derivedOptions.derivedArtifactIdentity)) throw new Error("SQLite compatibility derivedArtifactIdentity is invalid");
    }
    if ("signal" in options && !(options.signal instanceof AbortSignal)) throw new Error("SQLite compatibility AbortSignal is invalid");
    if (options.signal?.aborted) throw new Error("SQLite compatibility was cancelled");
    const baselineText = await readFile(await canonicalBaselinePath(), "utf8");
    if (createHash("sha256").update(baselineText.replace(/\r\n/g, "\n")).digest("hex") !== CANONICAL_C4_BASELINE_SHA256) throw new Error("Canonical C4 baseline identity is invalid");
    const baseline = JSON.parse(baselineText) as unknown;
    assertBaseline(baseline);

    if (explicitDerived) {
        const derivedOptions = options as GameDbSqliteCompatibilityDqOptions;
        const derived = await validateDerivedSqliteArtifact({
            storeRoot: derivedOptions.derivedStoreRoot,
            sourceStoreRoot: derivedOptions.sourceStoreRoot,
            artifactIdentity: derivedOptions.derivedArtifactIdentity,
        });
        const inspectionSize = derived.metadata.output.sizeBytes;
        assertInspectionSize(inspectionSize);
        if (options.signal?.aborted) throw new Error("SQLite compatibility was cancelled");
        const snapshot = await createPrivateInspectionSnapshot(derivedOptions.derivedStoreRoot, derived.artifactPath, inspectionSize, derived.metadata.output.sha256);
        let report!: GameDbSqliteCompatibilityDqReport;
        let bridgeTerminationUnconfirmed = false;
        try {
            const boundDerived = await validateDerivedSqliteArtifact({
                storeRoot: derivedOptions.derivedStoreRoot,
                sourceStoreRoot: derivedOptions.sourceStoreRoot,
                artifactIdentity: derived.identity,
            });
            if (boundDerived.identity !== derived.identity || JSON.stringify(boundDerived.metadata) !== JSON.stringify(derived.metadata)
                || boundDerived.materialBinding !== derived.materialBinding) {
                throw new Error("DQ artifact or its AQ parent changed while C4 bound its private snapshot");
            }
            await verifyPrivateInspectionSnapshot(snapshot, inspectionSize, derived.metadata.output.sha256);
            if (!snapshot.readableSqliteHeader) throw new Error("Validated DQ output is no longer readable SQLite");
            if (options.signal?.aborted) throw new Error("SQLite compatibility was cancelled");
            const inspection = await ReadOnlySqliteAdapter.fromDescriptorBoundHandle(snapshot.path, snapshot.handle, inspectionSize, derived.metadata.output.sha256, {
                signal: options.signal,
                timeoutMs: C4_BRIDGE_TIMEOUT_MS,
                killGraceMs: C4_BRIDGE_KILL_GRACE_MS,
                inputLimitBytes: C4_MAX_SQLITE_BYTES,
                stdoutLimitBytes: C4_BRIDGE_STDOUT_LIMIT_BYTES,
                stderrLimitBytes: C4_BRIDGE_STDERR_LIMIT_BYTES,
            }).inspect();
            if (options.signal?.aborted) throw new Error("SQLite compatibility was cancelled");
            await verifyPrivateInspectionSnapshot(snapshot, inspectionSize, derived.metadata.output.sha256);
            const revalidated = await validateDerivedSqliteArtifact({
                storeRoot: derivedOptions.derivedStoreRoot,
                sourceStoreRoot: derivedOptions.sourceStoreRoot,
                artifactIdentity: derived.identity,
            });
            if (revalidated.identity !== derived.identity || JSON.stringify(revalidated.metadata) !== JSON.stringify(derived.metadata)
                || revalidated.operationBinding !== boundDerived.operationBinding) {
                throw new Error("DQ artifact or its AQ parent changed during C4 compatibility inspection");
            }
            const inspectionSnapshot: GameDbSqliteCompatibilityDqReport["inspectionSnapshot"] = {
                source: "dq_derived_output",
                derivedArtifactIdentity: derived.identity,
                sha256: snapshot.sha256,
                sizeBytes: snapshot.identity.sizeBytes,
            };
            report = evaluateDerivedGameDbSqliteCompatibility({
                baseline,
                identity: derived.identity,
                metadata: derived.metadata,
                inspectionSnapshot,
                sourceDatabase: { sha256: snapshot.sha256, sizeBytes: snapshot.identity.sizeBytes, inspection },
            });
        } catch (error) {
            bridgeTerminationUnconfirmed = error instanceof SqliteBridgeTerminationUnconfirmedError;
            throw error;
        } finally {
            if (bridgeTerminationUnconfirmed) await quarantineSnapshotAfterUnconfirmedBridgeTermination(snapshot);
            else await removePrivateInspectionSnapshot(snapshot);
        }
        return report;
    }

    const aqOptions = options as GameDbSqliteCompatibilityAqOptions;
    const acquired = await validateAcquiredDatabaseArtifact(explicitLatest
        ? { storeRoot: aqOptions.storeRoot, useLatest: true }
        : { storeRoot: aqOptions.storeRoot, artifactIdentity: (aqOptions as any).artifactIdentity });
    const acquiredArtifact: GameDbSqliteCompatibilityAqReport["acquiredArtifact"] = {
        identity: acquired.identity,
        databaseVersion: acquired.metadata.databaseVersion,
        sha256: acquired.metadata.localSha256,
        sizeBytes: acquired.metadata.observedSizeBytes,
        resolvedFromLatest: acquired.resolvedFromLatest,
    };
    const inspectionSize = acquired.metadata.observedSizeBytes;
    assertInspectionSize(inspectionSize);
    if (options.signal?.aborted) throw new Error("SQLite compatibility was cancelled");
    const snapshot = await createPrivateInspectionSnapshot(aqOptions.storeRoot, acquired.artifactPath, inspectionSize, acquired.metadata.localSha256);
    let report!: GameDbSqliteCompatibilityAqReport;
    let bridgeTerminationUnconfirmed = false;
    try {
        await verifyPrivateInspectionSnapshot(snapshot, acquired.metadata.observedSizeBytes, acquired.metadata.localSha256);
        if (options.signal?.aborted) throw new Error("SQLite compatibility was cancelled");
        let inspection: SqliteInspection | undefined;
        if (snapshot.readableSqliteHeader) {
            inspection = await ReadOnlySqliteAdapter.fromDescriptorBoundHandle(snapshot.path, snapshot.handle, inspectionSize, acquired.metadata.localSha256, {
                signal: options.signal,
                timeoutMs: C4_BRIDGE_TIMEOUT_MS,
                killGraceMs: C4_BRIDGE_KILL_GRACE_MS,
                inputLimitBytes: C4_MAX_SQLITE_BYTES,
                stdoutLimitBytes: C4_BRIDGE_STDOUT_LIMIT_BYTES,
                stderrLimitBytes: C4_BRIDGE_STDERR_LIMIT_BYTES,
            }).inspect();
        }
        if (options.signal?.aborted) throw new Error("SQLite compatibility was cancelled");
        await verifyPrivateInspectionSnapshot(snapshot, acquired.metadata.observedSizeBytes, acquired.metadata.localSha256);
        const revalidated = await validateAcquiredDatabaseArtifact(explicitLatest
            ? { storeRoot: aqOptions.storeRoot, useLatest: true }
            : { storeRoot: aqOptions.storeRoot, artifactIdentity: acquired.identity });
        if (revalidated.identity !== acquired.identity || JSON.stringify(revalidated.metadata) !== JSON.stringify(acquired.metadata)) {
            throw new Error("AQ artifact identity changed during C4 compatibility inspection");
        }
        const inspectionSnapshot: GameDbSqliteCompatibilityAqReport["inspectionSnapshot"] = {
            acquiredArtifactIdentity: acquired.identity,
            sha256: snapshot.sha256,
            sizeBytes: snapshot.identity.sizeBytes,
        };
        if (!snapshot.readableSqliteHeader) {
            report = evaluateGameDbSqliteCompatibility({ baseline, acquiredArtifactState: "encrypted_or_packaged", acquiredArtifact, inspectionSnapshot });
        } else {
            if (!inspection) throw new Error("SQLite inspection result is missing");
            report = evaluateGameDbSqliteCompatibility({
                baseline,
                acquiredArtifactState: "readable_sqlite",
                acquiredArtifact,
                inspectionSnapshot,
                sourceDatabase: { sha256: snapshot.sha256, sizeBytes: snapshot.identity.sizeBytes, inspection },
            });
        }
    } catch (error) {
        bridgeTerminationUnconfirmed = error instanceof SqliteBridgeTerminationUnconfirmedError;
        throw error;
    } finally {
        if (bridgeTerminationUnconfirmed) await quarantineSnapshotAfterUnconfirmedBridgeTermination(snapshot);
        else await removePrivateInspectionSnapshot(snapshot);
    }
    return report;
}

export function parseGameDbSqliteCompatibilityArgs(argv: string[]): GameDbSqliteCompatibilityCliOptions {
    let storeRoot: string | undefined;
    let artifactIdentity: string | undefined;
    let useLatest = false;
    let derivedStoreRoot: string | undefined;
    let sourceStoreRoot: string | undefined;
    let derivedArtifactIdentity: string | undefined;
    let outputFile: string | undefined;
    const seen = new Set<string>();
    for (let index = 0; index < argv.length; index += 1) {
        const token = argv[index];
        if (token === "--latest") {
            if (seen.has(token)) throw new Error("Duplicate --latest");
            seen.add(token);
            useLatest = true;
            continue;
        }
        const name = token.includes("=") ? token.slice(0, token.indexOf("=")) : token;
        if (seen.has(name)) throw new Error(`Duplicate ${name}`);
        seen.add(name);
        const value = token.includes("=") ? token.slice(token.indexOf("=") + 1) : argv[++index];
        if (!value) throw new Error(`Missing value for ${name}`);
        if (name === "--store-root") storeRoot = value;
        else if (name === "--artifact-identity") artifactIdentity = value;
        else if (name === "--derived-store-root") derivedStoreRoot = value;
        else if (name === "--source-store-root") sourceStoreRoot = value;
        else if (name === "--derived-artifact-identity") derivedArtifactIdentity = value;
        else if (name === "--output-file") outputFile = value;
        else throw new Error(`Unexpected argument: ${name}`);
    }
    const hasAqSelector = Boolean(storeRoot || artifactIdentity || useLatest);
    const hasDqSelector = Boolean(derivedStoreRoot || sourceStoreRoot || derivedArtifactIdentity);
    if (!hasAqSelector && !hasDqSelector) throw new Error("Missing --store-root or complete DQ selector");
    if (hasAqSelector === hasDqSelector) throw new Error("Choose exactly one AQ or DQ selector");
    let selector: GameDbSqliteCompatibilityAqOptions | GameDbSqliteCompatibilityDqOptions;
    if (hasDqSelector) {
        if (!derivedStoreRoot || !sourceStoreRoot || !derivedArtifactIdentity) {
            throw new Error("DQ compatibility requires --derived-store-root, --source-store-root and --derived-artifact-identity");
        }
        if (!SHA256_PATTERN.test(derivedArtifactIdentity)) throw new Error("DQ derived artifact identity is invalid");
        selector = { derivedStoreRoot, sourceStoreRoot, derivedArtifactIdentity };
    } else {
        if (!storeRoot) throw new Error("Missing --store-root");
        if (Boolean(artifactIdentity) === useLatest) throw new Error("Choose exactly one of --artifact-identity or --latest");
        if (artifactIdentity && !SHA256_PATTERN.test(artifactIdentity)) throw new Error("AQ artifact identity is invalid");
        selector = useLatest ? { storeRoot, useLatest: true as const } : { storeRoot, artifactIdentity: artifactIdentity! };
    }
    return outputFile ? { ...selector, outputFile } : selector;
}

async function writeReportAtomic(outputFile: string, report: GameDbSqliteCompatibilityReport): Promise<void> {
    const target = resolve(outputFile);
    const temporary = `${target}.tmp-${process.pid}`;
    await mkdir(dirname(target), { recursive: true });
    try {
        await writeFile(temporary, `${JSON.stringify(report, null, 2)}\n`, { flag: "wx" });
        await rename(temporary, target);
    } catch (error) {
        await unlink(temporary).catch(() => undefined);
        throw error;
    }
}

async function main(): Promise<void> {
    const options = parseGameDbSqliteCompatibilityArgs(process.argv.slice(2));
    const report = await buildGameDbSqliteCompatibility("derivedArtifactIdentity" in options
        ? {
            derivedStoreRoot: options.derivedStoreRoot,
            sourceStoreRoot: options.sourceStoreRoot,
            derivedArtifactIdentity: options.derivedArtifactIdentity,
        }
        : "useLatest" in options
            ? { storeRoot: options.storeRoot, useLatest: true }
            : { storeRoot: options.storeRoot, artifactIdentity: options.artifactIdentity });
    if (options.outputFile) await writeReportAtomic(options.outputFile, report);
    console.log(JSON.stringify(report, null, 2));
}

if (require.main === module) {
    main().catch(error => {
        console.error(error);
        process.exitCode = 1;
    });
}
