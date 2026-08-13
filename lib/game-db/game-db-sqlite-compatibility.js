"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseGameDbSqliteCompatibilityArgs = exports.buildGameDbSqliteCompatibility = void 0;
const crypto_1 = require("crypto");
const fs_1 = require("fs");
const promises_1 = require("fs/promises");
const path_1 = require("path");
const sqlite_readonly_adapter_1 = require("../database-experiment/sqlite-readonly-adapter");
const integration_c4_builder_1 = require("../database-integration/integration-c4-builder");
const game_db_download_database_artifact_1 = require("./game-db-download-database-artifact");
const SQLITE_HEADER = Buffer.from("SQLite format 3\u0000", "utf8");
const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const CANONICAL_C4_BASELINE_SHA256 = "c46ccbfe6581e2c1f681c3527420cc432fa7f0b91ca32d52a24b4df6e79999a1";
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
        contractVersion: "1.1.0",
        status,
        acquiredArtifactState: input.acquiredArtifactState,
        acquiredArtifact: input.acquiredArtifact,
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
async function sha256File(filePath) {
    const hash = (0, crypto_1.createHash)("sha256");
    await new Promise((done, reject) => {
        const stream = (0, fs_1.createReadStream)(filePath);
        stream.on("data", chunk => hash.update(chunk));
        stream.on("error", reject);
        stream.on("end", done);
    });
    return hash.digest("hex");
}
async function hasReadableSqliteHeader(filePath) {
    const handle = await (0, promises_1.open)(filePath, "r");
    try {
        const header = Buffer.alloc(SQLITE_HEADER.length);
        const { bytesRead } = await handle.read(header, 0, header.length, 0);
        return bytesRead === header.length && header.equals(SQLITE_HEADER);
    }
    finally {
        await handle.close();
    }
}
function fileIdentity(metadata) {
    if (!metadata?.isFile?.() || metadata?.isSymbolicLink?.())
        throw new Error("SQLite input must be a regular file");
    const size = BigInt(metadata.size);
    if (size <= 0n || size > BigInt(Number.MAX_SAFE_INTEGER))
        throw new Error("SQLite input size is invalid");
    return {
        dev: BigInt(metadata.dev).toString(),
        ino: BigInt(metadata.ino).toString(),
        sizeBytes: Number(size),
        mtimeNs: BigInt(metadata.mtimeNs).toString(),
        ctimeNs: BigInt(metadata.ctimeNs).toString(),
    };
}
function sameIdentity(left, right) {
    return JSON.stringify(left) === JSON.stringify(right);
}
function sameCanonicalPath(left, right) {
    return process.platform === "win32" ? (0, path_1.resolve)(left).toLowerCase() === (0, path_1.resolve)(right).toLowerCase() : (0, path_1.resolve)(left) === (0, path_1.resolve)(right);
}
async function canonicalSqliteInput(inputPath) {
    const requestedPath = (0, path_1.resolve)(inputPath);
    let initial;
    try {
        initial = await (0, promises_1.lstat)(requestedPath, { bigint: true });
    }
    catch {
        throw new Error("SQLite input must resolve to a regular file");
    }
    const initialIdentity = fileIdentity(initial);
    let canonicalPath;
    try {
        canonicalPath = await (0, promises_1.realpath)(requestedPath);
    }
    catch {
        throw new Error("SQLite input realpath resolution failed");
    }
    let currentRequested, currentCanonical, currentRealpath;
    try {
        currentRequested = await (0, promises_1.lstat)(requestedPath, { bigint: true });
        currentCanonical = await (0, promises_1.lstat)(canonicalPath, { bigint: true });
        currentRealpath = await (0, promises_1.realpath)(requestedPath);
    }
    catch {
        throw new Error("SQLite input target changed during canonical resolution");
    }
    const requestedIdentity = fileIdentity(currentRequested), canonicalIdentity = fileIdentity(currentCanonical);
    if (!sameCanonicalPath(currentRealpath, canonicalPath)
        || !sameIdentity(initialIdentity, requestedIdentity)
        || !sameIdentity(initialIdentity, canonicalIdentity)) {
        throw new Error("SQLite input target changed during canonical resolution");
    }
    return { requestedPath, canonicalPath, initialIdentity };
}
async function fingerprintCanonicalSqlite(canonicalPath, expectedIdentity) {
    const before = fileIdentity(await (0, promises_1.stat)(canonicalPath, { bigint: true }));
    if (!sameIdentity(before, expectedIdentity))
        throw new Error("SQLite input identity changed before fingerprinting");
    const readableSqliteHeader = await hasReadableSqliteHeader(canonicalPath);
    const afterHeader = fileIdentity(await (0, promises_1.stat)(canonicalPath, { bigint: true }));
    if (!sameIdentity(before, afterHeader))
        throw new Error("SQLite input changed during header validation");
    const sha256 = await sha256File(canonicalPath);
    const afterHash = fileIdentity(await (0, promises_1.stat)(canonicalPath, { bigint: true }));
    if (!sameIdentity(before, afterHash))
        throw new Error("SQLite input changed during hashing");
    return { identity: before, sha256, readableSqliteHeader };
}
async function verifyCanonicalSqliteUnchanged(input) {
    let requestedMetadata, canonicalMetadata, currentRealpath;
    try {
        requestedMetadata = await (0, promises_1.lstat)(input.requestedPath, { bigint: true });
        canonicalMetadata = await (0, promises_1.lstat)(input.canonicalPath, { bigint: true });
        currentRealpath = await (0, promises_1.realpath)(input.requestedPath);
    }
    catch {
        throw new Error("SQLite input target changed after inspection");
    }
    if (!sameCanonicalPath(currentRealpath, input.canonicalPath)
        || !sameIdentity(fileIdentity(requestedMetadata), input.fingerprint.identity)
        || !sameIdentity(fileIdentity(canonicalMetadata), input.fingerprint.identity)) {
        throw new Error("SQLite input target changed after inspection");
    }
    const after = await fingerprintCanonicalSqlite(input.canonicalPath, input.fingerprint.identity);
    if (after.sha256 !== input.fingerprint.sha256 || after.readableSqliteHeader !== input.fingerprint.readableSqliteHeader) {
        throw new Error("SQLite input bytes changed during inspection");
    }
}
async function buildGameDbSqliteCompatibility(options) {
    if (arguments.length !== 1 || !options || typeof options !== "object" || Array.isArray(options))
        throw new Error("SQLite compatibility options are invalid");
    const keys = Object.keys(options).sort();
    const explicitIdentity = JSON.stringify(keys) === JSON.stringify(["artifactIdentity", "storeRoot"]);
    const explicitLatest = JSON.stringify(keys) === JSON.stringify(["storeRoot", "useLatest"]);
    if (!explicitIdentity && !explicitLatest)
        throw new Error("SQLite compatibility requires storeRoot and exactly one AQ artifact selector");
    if (typeof options.storeRoot !== "string" || !options.storeRoot || options.storeRoot.includes("\0"))
        throw new Error("SQLite compatibility storeRoot is invalid");
    if (explicitIdentity && (typeof options.artifactIdentity !== "string" || !SHA256_PATTERN.test(options.artifactIdentity)))
        throw new Error("SQLite compatibility artifactIdentity is invalid");
    if (explicitLatest && options.useLatest !== true)
        throw new Error("SQLite compatibility useLatest selector must be true");
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
    const canonical = await canonicalSqliteInput(acquired.artifactPath);
    const fingerprint = await fingerprintCanonicalSqlite(canonical.canonicalPath, canonical.initialIdentity);
    let inspection;
    if (fingerprint.readableSqliteHeader) {
        inspection = await new sqlite_readonly_adapter_1.ReadOnlySqliteAdapter(canonical.canonicalPath).inspect();
    }
    await verifyCanonicalSqliteUnchanged({ requestedPath: canonical.requestedPath, canonicalPath: canonical.canonicalPath, fingerprint });
    const revalidated = await (0, game_db_download_database_artifact_1.validateAcquiredDatabaseArtifact)(explicitLatest
        ? { storeRoot: options.storeRoot, useLatest: true }
        : { storeRoot: options.storeRoot, artifactIdentity: acquired.identity });
    if (revalidated.identity !== acquired.identity || JSON.stringify(revalidated.metadata) !== JSON.stringify(acquired.metadata))
        throw new Error("AQ artifact identity changed during C4 compatibility inspection");
    if (!fingerprint.readableSqliteHeader)
        return evaluateGameDbSqliteCompatibility({ baseline, acquiredArtifactState: "encrypted_or_packaged", acquiredArtifact });
    if (!inspection)
        throw new Error("SQLite inspection result is missing");
    return evaluateGameDbSqliteCompatibility({
        baseline,
        acquiredArtifactState: "readable_sqlite",
        acquiredArtifact,
        sourceDatabase: { sha256: fingerprint.sha256, sizeBytes: fingerprint.identity.sizeBytes, inspection },
    });
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