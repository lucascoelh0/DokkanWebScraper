"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runDownloadDatabaseArtifact = exports.acquireDatabaseArtifact = exports.readAndValidateDatabaseDescriptor = exports.validateClientAssetsDatabaseDescriptor = exports.parseDownloadDatabaseArtifactArgs = exports.DEFAULT_DATABASE_ARTIFACT_TIMEOUT_MS = exports.DEFAULT_DATABASE_ARTIFACT_MAX_BYTES = void 0;
const crypto_1 = require("crypto");
const fs_1 = require("fs");
const promises_1 = require("fs/promises");
const https_1 = require("https");
const path_1 = require("path");
const OFFICIAL_CDN_HOST = "cf.ishin-global.aktsk.com";
const LOGICAL_FILE_PATH = "sqlite/current/en/database.db";
const SQLITE_HEADER = Buffer.from("SQLite format 3\u0000", "utf8");
const DEFAULT_STORE_ROOT = (0, path_1.resolve)(process.cwd(), "game-db", "data", "game-db-acquisition", "database-artifacts");
exports.DEFAULT_DATABASE_ARTIFACT_MAX_BYTES = 128 * 1024 * 1024;
exports.DEFAULT_DATABASE_ARTIFACT_TIMEOUT_MS = 120000;
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
    const digits = [date.getUTCFullYear().toString().padStart(4, "0"), (date.getUTCMonth() + 1).toString().padStart(2, "0"), date.getUTCDate().toString().padStart(2, "0")].join("");
    const time = [date.getUTCHours(), date.getUTCMinutes(), date.getUTCSeconds()].map(value => value.toString().padStart(2, "0")).join("");
    return `${digits}-${time}`;
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
async function assertRegularRealFile(filePath, label) {
    const resolved = (0, path_1.resolve)(filePath);
    try {
        const link = await (0, promises_1.lstat)(resolved);
        if (!link.isFile() || link.isSymbolicLink())
            throw new Error("rejected");
        const real = await (0, promises_1.realpath)(resolved);
        if ((0, path_1.resolve)(real).toLowerCase() !== resolved.toLowerCase())
            throw new Error("rejected");
        return real;
    }
    catch {
        throw new Error(`${label} must be a regular real file, not a symlink or junction`);
    }
}
async function readAndValidateDatabaseDescriptor(filePath) {
    const realFile = await assertRegularRealFile(filePath, "Descriptor input");
    let parsed;
    try {
        parsed = JSON.parse(await (0, promises_1.readFile)(realFile, "utf8"));
    }
    catch {
        throw new Error("Database descriptor JSON is malformed");
    }
    return validateClientAssetsDatabaseDescriptor(parsed);
}
exports.readAndValidateDatabaseDescriptor = readAndValidateDatabaseDescriptor;
async function assertStoreRoot(storeRoot) {
    const resolved = (0, path_1.resolve)(storeRoot);
    if (!(0, path_1.isAbsolute)(resolved) || resolved.includes("\0"))
        throw new Error("Artifact store root is invalid");
    await (0, promises_1.mkdir)(resolved, { recursive: true });
    const link = await (0, promises_1.lstat)(resolved);
    const real = await (0, promises_1.realpath)(resolved);
    if (!link.isDirectory() || link.isSymbolicLink() || (0, path_1.resolve)(real).toLowerCase() !== resolved.toLowerCase()) {
        throw new Error("Artifact store root must be a regular real directory, not a symlink or junction");
    }
    return real;
}
function normalizedHeader(headers, name) {
    const found = Object.entries(headers).find(([key]) => key.toLowerCase() === name)?.[1];
    if (Array.isArray(found))
        return found.length === 1 ? found[0] : undefined;
    return found;
}
async function inspectStreamToFile(input) {
    const handle = await (0, promises_1.open)(input.temporaryPath, "wx");
    const hash = (0, crypto_1.createHash)("sha256");
    let observedSizeBytes = 0;
    let header = Buffer.alloc(0);
    try {
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
            await handle.write(chunk);
        }
        if (input.signal.aborted)
            throw new Error("Database artifact acquisition cancelled");
        if (observedSizeBytes !== input.expectedSizeBytes)
            throw new Error("Database artifact stream is truncated or size-divergent");
        await handle.sync();
    }
    finally {
        await handle.close();
    }
    return {
        observedSizeBytes,
        localSha256: hash.digest("hex"),
        artifactState: header.equals(SQLITE_HEADER) ? "readable_sqlite" : "encrypted_or_packaged",
    };
}
async function inspectRegularArtifact(filePath, maxBytes) {
    const realFile = await assertRegularRealFile(filePath, "Artifact input");
    const before = await (0, promises_1.stat)(realFile);
    if (before.size <= 0 || before.size > maxBytes)
        throw new Error("Artifact input size is outside the allowed range");
    const hash = (0, crypto_1.createHash)("sha256");
    let observedSizeBytes = 0;
    let header = Buffer.alloc(0);
    for await (const value of (0, fs_1.createReadStream)(realFile)) {
        const chunk = Buffer.isBuffer(value) ? value : Buffer.from(value);
        observedSizeBytes += chunk.byteLength;
        if (observedSizeBytes > maxBytes)
            throw new Error("Artifact input exceeds the allowed size");
        hash.update(chunk);
        if (header.byteLength < SQLITE_HEADER.byteLength)
            header = Buffer.concat([header, chunk.subarray(0, SQLITE_HEADER.byteLength - header.byteLength)]);
    }
    const after = await (0, promises_1.stat)(realFile);
    if (before.dev !== after.dev || before.ino !== after.ino || before.size !== after.size || before.mtimeMs !== after.mtimeMs || observedSizeBytes !== after.size) {
        throw new Error("Artifact input changed during validation");
    }
    return { observedSizeBytes, localSha256: hash.digest("hex"), artifactState: header.equals(SQLITE_HEADER) ? "readable_sqlite" : "encrypted_or_packaged" };
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
function ensureContained(root, candidate) {
    const relation = (0, path_1.relative)(root, candidate);
    if (!relation || relation === ".." || relation.startsWith(`..${path_1.sep}`) || (0, path_1.isAbsolute)(relation))
        throw new Error("Artifact store path escaped containment");
}
async function validateCommittedArtifact(directory, identity, metadata) {
    const artifactPath = (0, path_1.resolve)(directory, "database.db");
    const metadataPath = (0, path_1.resolve)(directory, "metadata.json");
    const markerPath = (0, path_1.resolve)(directory, "commit-marker.json");
    for (const path of [artifactPath, metadataPath, markerPath])
        await assertRegularRealFile(path, "Committed artifact member");
    const [storedMetadataText, markerText, inspection] = await Promise.all([
        (0, promises_1.readFile)(metadataPath, "utf8"),
        (0, promises_1.readFile)(markerPath, "utf8"),
        inspectRegularArtifact(artifactPath, exports.DEFAULT_DATABASE_ARTIFACT_MAX_BYTES),
    ]);
    if (storedMetadataText !== canonicalJson(metadata) || JSON.stringify(inspection) !== JSON.stringify({ observedSizeBytes: metadata.observedSizeBytes, localSha256: metadata.localSha256, artifactState: metadata.artifactState })) {
        throw new Error("Existing immutable artifact identity does not validate");
    }
    const expectedMarker = canonicalJson({ schemaVersion: 1, contract: "dokkan-game-db-artifact-commit", contractVersion: "1.0.0", identity, metadataSha256: (0, crypto_1.createHash)("sha256").update(storedMetadataText).digest("hex") });
    if (markerText !== expectedMarker)
        throw new Error("Existing immutable artifact commit marker does not validate");
}
async function promoteLatest(root, identity) {
    const latestPath = (0, path_1.resolve)(root, "latest.json");
    let previousIdentity = null;
    if ((0, fs_1.existsSync)(latestPath)) {
        const current = JSON.parse(await (0, promises_1.readFile)(latestPath, "utf8"));
        if (current.schemaVersion !== 1 || typeof current.currentIdentity !== "string" || !/^[a-f0-9]{64}$/.test(current.currentIdentity))
            throw new Error("Existing latest pointer is invalid");
        previousIdentity = current.currentIdentity === identity
            ? (typeof current.previousIdentity === "string" ? current.previousIdentity : null)
            : current.currentIdentity;
    }
    const pointer = { schemaVersion: 1, contract: "dokkan-game-db-local-latest", contractVersion: "1.0.0", currentIdentity: identity, previousIdentity };
    const temporary = (0, path_1.resolve)(root, `.latest-${process.pid}-${(0, crypto_1.randomBytes)(6).toString("hex")}.tmp`);
    await (0, promises_1.writeFile)(temporary, canonicalJson(pointer), { flag: "wx" });
    await (0, promises_1.rename)(temporary, latestPath);
    return latestPath;
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
    const root = await assertStoreRoot(options.storeRoot);
    const lockPath = (0, path_1.resolve)(root, ".acquisition.lock");
    try {
        await (0, promises_1.mkdir)(lockPath);
    }
    catch {
        throw new Error("Database artifact acquisition already has an active writer");
    }
    const controller = new AbortController();
    const onAbort = () => controller.abort();
    options.signal?.addEventListener("abort", onAbort, { once: true });
    const temporaryPath = (0, path_1.resolve)(root, `.download-${process.pid}-${(0, crypto_1.randomBytes)(6).toString("hex")}.tmp`);
    let pendingDirectory;
    try {
        if (options.signal?.aborted)
            throw new Error("Database artifact acquisition cancelled");
        const response = await withTimeout(options.transport.get(new URL(descriptor.url), { signal: controller.signal }), timeoutMs, controller);
        if (response.statusCode < 200 || response.statusCode > 299) {
            response.body.destroy();
            if (response.statusCode >= 300 && response.statusCode <= 399)
                throw new Error("Database artifact redirects are blocked");
            throw new Error(`Database artifact response was not successful: ${response.statusCode}`);
        }
        const contentLength = normalizedHeader(response.headers, "content-length");
        if (!contentLength || !/^[1-9][0-9]*$/.test(contentLength)) {
            response.body.destroy();
            throw new Error("Database artifact Content-Length is required and invalid");
        }
        const expectedSizeBytes = Number(contentLength);
        if (!Number.isSafeInteger(expectedSizeBytes) || expectedSizeBytes > maxBytes) {
            response.body.destroy();
            throw new Error("Database artifact Content-Length exceeds the allowed size");
        }
        const abortBody = () => response.body.destroy(new Error("Database artifact acquisition cancelled"));
        controller.signal.addEventListener("abort", abortBody, { once: true });
        const timer = setTimeout(() => { controller.abort(); response.body.destroy(new Error("Database artifact stream timed out")); }, timeoutMs);
        let inspection;
        try {
            inspection = await inspectStreamToFile({ body: response.body, temporaryPath, expectedSizeBytes, maxBytes, signal: controller.signal });
        }
        finally {
            clearTimeout(timer);
            controller.signal.removeEventListener("abort", abortBody);
        }
        const metadata = metadataFor(descriptor, inspection);
        const identity = artifactIdentity(metadata);
        const artifactsRoot = (0, path_1.resolve)(root, "artifacts");
        await (0, promises_1.mkdir)(artifactsRoot, { recursive: true });
        const finalDirectory = (0, path_1.resolve)(artifactsRoot, identity);
        ensureContained(artifactsRoot, finalDirectory);
        let reused = false;
        if ((0, fs_1.existsSync)(finalDirectory)) {
            await validateCommittedArtifact(finalDirectory, identity, metadata);
            await (0, promises_1.rm)(temporaryPath, { force: true });
            reused = true;
        }
        else {
            pendingDirectory = (0, path_1.resolve)(artifactsRoot, `.pending-${process.pid}-${(0, crypto_1.randomBytes)(6).toString("hex")}`);
            ensureContained(artifactsRoot, pendingDirectory);
            await (0, promises_1.mkdir)(pendingDirectory);
            const artifactPath = (0, path_1.resolve)(pendingDirectory, "database.db");
            await (0, promises_1.rename)(temporaryPath, artifactPath);
            const metadataText = canonicalJson(metadata);
            await (0, promises_1.writeFile)((0, path_1.resolve)(pendingDirectory, "metadata.json"), metadataText, { flag: "wx" });
            const marker = { schemaVersion: 1, contract: "dokkan-game-db-artifact-commit", contractVersion: "1.0.0", identity, metadataSha256: (0, crypto_1.createHash)("sha256").update(metadataText).digest("hex") };
            await (0, promises_1.writeFile)((0, path_1.resolve)(pendingDirectory, "commit-marker.json"), canonicalJson(marker), { flag: "wx" });
            await (0, promises_1.rename)(pendingDirectory, finalDirectory);
            pendingDirectory = undefined;
        }
        await validateCommittedArtifact(finalDirectory, identity, metadata);
        const latestPointerPath = await promoteLatest(root, identity);
        return {
            identity,
            artifactPath: (0, path_1.resolve)(finalDirectory, "database.db"),
            metadataPath: (0, path_1.resolve)(finalDirectory, "metadata.json"),
            commitMarkerPath: (0, path_1.resolve)(finalDirectory, "commit-marker.json"),
            latestPointerPath,
            metadata,
            reused,
        };
    }
    catch (error) {
        controller.abort();
        await (0, promises_1.rm)(temporaryPath, { force: true }).catch(() => undefined);
        if (pendingDirectory)
            await (0, promises_1.rm)(pendingDirectory, { recursive: true, force: true }).catch(() => undefined);
        throw error;
    }
    finally {
        options.signal?.removeEventListener("abort", onAbort);
        await (0, promises_1.rm)(lockPath, { recursive: true, force: true });
    }
}
exports.acquireDatabaseArtifact = acquireDatabaseArtifact;
async function runDownloadDatabaseArtifact(options, dependencies = {}) {
    if (!options.descriptorJson)
        throw new Error("Descriptor input is required");
    const descriptor = await readAndValidateDatabaseDescriptor(options.descriptorJson);
    const { url: _url, ...sanitized } = descriptor;
    if (options.artifactPath)
        return { mode: "artifact_validation", descriptor: sanitized, inspection: await inspectDownloadedDatabaseArtifact(options.artifactPath) };
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
    const result = await acquireDatabaseArtifact({ descriptor: rawDescriptor, storeRoot: options.storeRoot, transport: dependencies.transport ?? httpsDatabaseArtifactTransport });
    return { mode: "authorized_download", result };
}
exports.runDownloadDatabaseArtifact = runDownloadDatabaseArtifact;
async function main() {
    const options = parseDownloadDatabaseArtifactArgs(process.argv.slice(2));
    const result = await runDownloadDatabaseArtifact(options);
    if (result.mode === "authorized_download") {
        console.log(`Acquired immutable database artifact ${result.result.identity}`);
        console.log(`Artifact state: ${result.result.metadata.artifactState}`);
    }
    else {
        console.log(JSON.stringify(result, null, 2));
    }
}
if (require.main === module) {
    main().catch(error => { console.error(error); process.exitCode = 1; });
}
//# sourceMappingURL=game-db-download-database-artifact.js.map