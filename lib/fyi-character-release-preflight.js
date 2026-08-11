"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runFyiCharacterRemotePreflightK24 = exports.createFyiCharacterWranglerBucketSizeReader = exports.createFyiCharacterPublicHttpsReader = exports.parseFyiCharacterRemotePreflightCli = exports.parseFyiCharacterBucketSize = exports.FYI_CHARACTER_K24_CONCURRENCY = exports.FYI_CHARACTER_K24_MAX_AGGREGATE_BYTES = exports.FYI_CHARACTER_K24_MAX_RESPONSE_BYTES = exports.FYI_CHARACTER_K24_REPORT = exports.FYI_CHARACTER_K24_OUTPUT_ROOT = exports.FYI_CHARACTER_K24_BUCKET = exports.FYI_CHARACTER_K24_PUBLIC_BASE_URL = exports.FYI_CHARACTER_K24_CONTRACT_VERSION = exports.FYI_CHARACTER_K24_CONTRACT = void 0;
const crypto_1 = require("crypto");
const child_process_1 = require("child_process");
const fs_1 = require("fs");
const promises_1 = require("fs/promises");
const https_1 = require("https");
const path_1 = require("path");
const fyi_character_release_1 = require("./fyi-character-release");
exports.FYI_CHARACTER_K24_CONTRACT = "dokkan-fyi-character-remote-preflight-k24";
exports.FYI_CHARACTER_K24_CONTRACT_VERSION = "1.0.0";
exports.FYI_CHARACTER_K24_PUBLIC_BASE_URL = "https://assets.dkbcompanion.com/";
exports.FYI_CHARACTER_K24_BUCKET = "dokkanpanion-data";
exports.FYI_CHARACTER_K24_OUTPUT_ROOT = "preflight-k24";
exports.FYI_CHARACTER_K24_REPORT = "remote-preflight-k24.json";
exports.FYI_CHARACTER_K24_MAX_RESPONSE_BYTES = 5000000;
exports.FYI_CHARACTER_K24_MAX_AGGREGATE_BYTES = 50000000;
exports.FYI_CHARACTER_K24_CONCURRENCY = 12;
const RELEASE_ID = /^[a-f0-9]{64}-[a-f0-9]{64}$/;
const IMMUTABLE_KEY = /^(?:releases\/[A-Za-z0-9._-]+\/[a-f0-9]{64}\/characters\.json\.gz|images\/v2\/portrait_\d+\.png|images\/v3\/portrait_\d+\.[a-f0-9]{64}\.png)$/;
const SHA256 = /^[a-f0-9]{64}$/;
const JSON_BYTES = (value) => Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8");
const sha256 = (value) => (0, crypto_1.createHash)("sha256").update(value).digest("hex");
function assertImmutablePlanObject(object) {
    if ((object.kind !== "payload" && object.kind !== "portrait")
        || !IMMUTABLE_KEY.test(object.objectKey)
        || !SHA256.test(object.sha256)
        || !Number.isSafeInteger(object.sizeBytes)
        || object.sizeBytes <= 0
        || object.cacheControl !== "public, max-age=31536000, immutable") {
        throw new Error(`K24 immutable object rejected: ${object.objectKey}`);
    }
}
function parseFyiCharacterBucketSize(reported) {
    const match = /^\s*(\d+(?:\.\d+)?)\s*(B|kB|MB|GB|TB)\s*$/.exec(reported);
    if (!match)
        throw new Error(`K24 unsupported Wrangler bucket size: ${reported}`);
    const units = { B: 1, kB: 1000, MB: 1000000, GB: 1000000000, TB: 1000000000000 };
    const decimals = match[1].split(".")[1]?.length ?? 0;
    const displayResolution = 10 ** -decimals;
    const upperBound = Math.ceil((Number(match[1]) + displayResolution) * units[match[2]]);
    if (!Number.isSafeInteger(upperBound))
        throw new Error("K24 bucket size outside safe integer range");
    return { reported, conservativeUpperBoundBytes: upperBound };
}
exports.parseFyiCharacterBucketSize = parseFyiCharacterBucketSize;
function parseFyiCharacterRemotePreflightCli(args) {
    if (args.length !== 4 || args[0] !== "--opt-in-k24" || args[1] !== "--release-id"
        || !RELEASE_ID.test(args[2]) || args[3] !== "--remote") {
        throw new Error("K24 requires exactly --opt-in-k24 --release-id <release-id> --remote");
    }
    return { releaseId: args[2] };
}
exports.parseFyiCharacterRemotePreflightCli = parseFyiCharacterRemotePreflightCli;
function createFyiCharacterPublicHttpsReader() {
    return {
        read: (objectKey, maxBytes, consumeBytes) => new Promise((resolvePromise, rejectPromise) => {
            if (objectKey !== "characters-manifest.json" && !IMMUTABLE_KEY.test(objectKey)) {
                rejectPromise(new Error("K24 remote object key rejected"));
                return;
            }
            const encodedPath = objectKey.split("/").map(encodeURIComponent).join("/");
            const url = new URL(encodedPath, exports.FYI_CHARACTER_K24_PUBLIC_BASE_URL);
            let settled = false;
            const settleReject = (error) => {
                if (!settled) {
                    settled = true;
                    rejectPromise(error);
                }
            };
            const req = (0, https_1.request)(url, {
                method: "GET",
                headers: { Accept: "application/octet-stream, application/json", "Accept-Encoding": "identity" },
            }, response => {
                const statusCode = response.statusCode ?? 0;
                const contentEncoding = response.headers["content-encoding"];
                if (statusCode >= 300 && statusCode < 400) {
                    response.resume();
                    settleReject(new Error(`K24 redirect rejected (${statusCode})`));
                    return;
                }
                if (contentEncoding && contentEncoding !== "identity") {
                    response.resume();
                    settleReject(new Error(`K24 content encoding rejected (${contentEncoding})`));
                    return;
                }
                const chunks = [];
                let size = 0;
                response.on("data", chunkValue => {
                    if (settled)
                        return;
                    const chunk = Buffer.isBuffer(chunkValue) ? chunkValue : Buffer.from(chunkValue);
                    size += chunk.length;
                    try {
                        if (size > maxBytes)
                            throw new Error("K24 response byte limit exceeded");
                        consumeBytes(chunk.length);
                        chunks.push(chunk);
                    }
                    catch (error) {
                        response.destroy();
                        settleReject(error instanceof Error ? error : new Error(String(error)));
                    }
                });
                response.on("end", () => {
                    if (!settled) {
                        settled = true;
                        resolvePromise({ statusCode, bytes: Buffer.concat(chunks), contentEncoding });
                    }
                });
                response.on("error", error => settleReject(error));
            });
            req.setTimeout(30000, () => req.destroy(new Error("K24 request timeout")));
            req.on("error", error => settleReject(error));
            req.end();
        }),
    };
}
exports.createFyiCharacterPublicHttpsReader = createFyiCharacterPublicHttpsReader;
function resolveWranglerEntrypoint() {
    const candidates = [
        (0, path_1.resolve)(__dirname, "node_modules", "wrangler", "bin", "wrangler.js"),
        (0, path_1.resolve)(__dirname, "node_modules", "wrangler", "wrangler-dist", "cli.js"),
        (0, path_1.resolve)(__dirname, "..", "node_modules", "wrangler", "bin", "wrangler.js"),
        (0, path_1.resolve)(__dirname, "..", "node_modules", "wrangler", "wrangler-dist", "cli.js"),
    ];
    const found = candidates.find(fs_1.existsSync);
    if (!found)
        throw new Error("K24 Wrangler entrypoint not found");
    return found;
}
function createFyiCharacterWranglerBucketSizeReader() {
    return {
        read: () => new Promise((resolvePromise, rejectPromise) => {
            (0, child_process_1.execFile)(process.execPath, [resolveWranglerEntrypoint(), "r2", "bucket", "info", exports.FYI_CHARACTER_K24_BUCKET, "--json"], { maxBuffer: 1024 * 1024 }, (error, stdout, stderr) => {
                if (error) {
                    rejectPromise(new Error(`K24 Wrangler bucket info failed: ${stderr.trim() || error.message}`));
                    return;
                }
                try {
                    const value = JSON.parse(stdout);
                    if (typeof value.bucket_size !== "string")
                        throw new Error("missing bucket_size");
                    resolvePromise(parseFyiCharacterBucketSize(value.bucket_size));
                }
                catch (parseError) {
                    rejectPromise(new Error(`K24 Wrangler bucket info rejected: ${parseError instanceof Error ? parseError.message : String(parseError)}`));
                }
            });
        }),
    };
}
exports.createFyiCharacterWranglerBucketSizeReader = createFyiCharacterWranglerBucketSizeReader;
async function mapConcurrent(values, concurrency, mapper) {
    const output = new Array(values.length);
    let nextIndex = 0;
    const workers = Array.from({ length: Math.min(concurrency, values.length) }, async () => {
        while (true) {
            const index = nextIndex++;
            if (index >= values.length)
                return;
            output[index] = await mapper(values[index]);
        }
    });
    await Promise.all(workers);
    return output;
}
async function inspectImmutableObject(object, reader, consumeBytes) {
    try {
        const remote = await reader.read(object.objectKey, exports.FYI_CHARACTER_K24_MAX_RESPONSE_BYTES, consumeBytes);
        if (remote.statusCode === 404) {
            return { kind: object.kind, objectKey: object.objectKey, status: "missing", expectedSha256: object.sha256, expectedSizeBytes: object.sizeBytes };
        }
        if (remote.statusCode !== 200)
            throw new Error(`unexpected HTTP ${remote.statusCode}`);
        const actualSha256 = sha256(remote.bytes);
        const matching = remote.bytes.length === object.sizeBytes && actualSha256 === object.sha256;
        return {
            kind: object.kind, objectKey: object.objectKey,
            status: matching ? "matching" : "conflict", expectedSha256: object.sha256,
            expectedSizeBytes: object.sizeBytes, actualSha256, actualSizeBytes: remote.bytes.length,
        };
    }
    catch (error) {
        return {
            kind: object.kind, objectKey: object.objectKey, status: "failed",
            expectedSha256: object.sha256, expectedSizeBytes: object.sizeBytes,
            failure: error instanceof Error ? error.message : String(error),
        };
    }
}
async function inspectManifest(expected, reader, consumeBytes) {
    try {
        const remote = await reader.read(expected.objectKey, 1000000, consumeBytes);
        if (remote.statusCode === 404) {
            return { objectKey: "characters-manifest.json", status: "missing", expectedSha256: expected.sha256, expectedSizeBytes: expected.sizeBytes };
        }
        if (remote.statusCode !== 200)
            throw new Error(`unexpected HTTP ${remote.statusCode}`);
        const actualSha256 = sha256(remote.bytes);
        const result = {
            objectKey: "characters-manifest.json",
            status: remote.bytes.length === expected.sizeBytes && actualSha256 === expected.sha256 ? "matching" : "different",
            expectedSha256: expected.sha256, expectedSizeBytes: expected.sizeBytes,
            actualSha256, actualSizeBytes: remote.bytes.length,
        };
        try {
            const current = JSON.parse(remote.bytes.toString("utf8"));
            if (typeof current.datasetVersion === "string")
                result.currentDatasetVersion = current.datasetVersion;
            if (typeof current.fileName === "string")
                result.currentPayloadKey = current.fileName;
        }
        catch { /* A different mutable manifest remains observable but is never trusted. */ }
        return result;
    }
    catch (error) {
        return {
            objectKey: "characters-manifest.json", status: "failed",
            expectedSha256: expected.sha256, expectedSizeBytes: expected.sizeBytes,
            failure: error instanceof Error ? error.message : String(error),
        };
    }
}
function assertContainedPath(root, path) {
    const remainder = (0, path_1.relative)(root, path);
    if (!remainder || remainder === ".." || remainder.startsWith(`..${path_1.sep}`) || (0, path_1.resolve)(root, remainder) !== path) {
        if (remainder)
            throw new Error("K24 report path escaped root");
    }
}
async function captureOwnedDirectory(path) {
    const metadata = await (0, promises_1.lstat)(path);
    if (!metadata.isDirectory() || metadata.isSymbolicLink() || await (0, promises_1.realpath)(path) !== path) {
        throw new Error("K24 report directory rejected");
    }
    return { path, dev: metadata.dev, ino: metadata.ino };
}
async function assertOwnedDirectory(identity) {
    const metadata = await (0, promises_1.lstat)(identity.path);
    if (!metadata.isDirectory() || metadata.isSymbolicLink() || metadata.dev !== identity.dev
        || metadata.ino !== identity.ino || await (0, promises_1.realpath)(identity.path) !== identity.path) {
        throw new Error("K24 report directory identity changed");
    }
}
async function createOrValidateDirectory(parent, name) {
    if ((0, path_1.basename)(name) !== name)
        throw new Error("K24 report directory name rejected");
    await assertOwnedDirectory(parent);
    const path = (0, path_1.resolve)(parent.path, name);
    assertContainedPath(parent.path, path);
    try {
        await (0, promises_1.mkdir)(path, { mode: 0o700 });
    }
    catch (error) {
        if (error?.code !== "EEXIST")
            throw error;
    }
    const identity = await captureOwnedDirectory(path);
    await assertOwnedDirectory(parent);
    return identity;
}
async function writeExclusiveReport(directory, report) {
    const bytes = JSON_BYTES(report);
    const path = (0, path_1.join)(directory.path, exports.FYI_CHARACTER_K24_REPORT);
    await assertOwnedDirectory(directory);
    try {
        const handle = await (0, promises_1.open)(path, fs_1.constants.O_CREAT | fs_1.constants.O_EXCL | fs_1.constants.O_WRONLY | (fs_1.constants.O_NOFOLLOW ?? 0), 0o600);
        try {
            await handle.writeFile(bytes);
            await handle.sync();
            const metadata = await handle.stat();
            if (!metadata.isFile() || metadata.nlink !== 1 || metadata.size !== bytes.length)
                throw new Error("K24 report file identity rejected");
        }
        finally {
            await handle.close();
        }
    }
    catch (error) {
        if (error?.code !== "EEXIST")
            throw error;
        const pathMetadata = await (0, promises_1.lstat)(path);
        if (!pathMetadata.isFile() || pathMetadata.isSymbolicLink() || pathMetadata.nlink !== 1 || await (0, promises_1.realpath)(path) !== path) {
            throw new Error("K24 existing report identity rejected");
        }
        const handle = await (0, promises_1.open)(path, fs_1.constants.O_RDONLY | (fs_1.constants.O_NOFOLLOW ?? 0));
        try {
            const metadata = await handle.stat();
            if (!metadata.isFile() || metadata.nlink !== 1 || metadata.dev !== pathMetadata.dev || metadata.ino !== pathMetadata.ino) {
                throw new Error("K24 existing report identity rejected");
            }
            const existing = await handle.readFile();
            if (!existing.equals(bytes))
                throw new Error("K24 existing report differs");
            const after = await (0, promises_1.lstat)(path);
            if (!after.isFile() || after.isSymbolicLink() || after.nlink !== 1
                || after.dev !== metadata.dev || after.ino !== metadata.ino || await (0, promises_1.realpath)(path) !== path) {
                throw new Error("K24 existing report identity changed");
            }
        }
        finally {
            await handle.close();
        }
    }
    await assertOwnedDirectory(directory);
}
async function writeReportSafely(fyiRoot, releaseId, report) {
    const root = await captureOwnedDirectory((0, path_1.resolve)(fyiRoot));
    const outputRoot = await createOrValidateDirectory(root, exports.FYI_CHARACTER_K24_OUTPUT_ROOT);
    const releaseRoot = await createOrValidateDirectory(outputRoot, releaseId);
    const reportDirectory = await createOrValidateDirectory(releaseRoot, sha256(JSON_BYTES(report)));
    await writeExclusiveReport(reportDirectory, report);
    await assertOwnedDirectory(root);
    await assertOwnedDirectory(outputRoot);
    await assertOwnedDirectory(releaseRoot);
}
async function runFyiCharacterRemotePreflightK24(options) {
    if (!RELEASE_ID.test(options.releaseId))
        throw new Error("K24 release ID rejected");
    const validated = await (0, fyi_character_release_1.readValidatedFyiCharacterRelease)(options.fyiRoot, options.releaseId);
    const rebuiltPlan = validated.plan;
    const immutableObjects = rebuiltPlan.objects.filter(object => object.kind !== "manifest");
    immutableObjects.forEach(assertImmutablePlanObject);
    const manifestObject = rebuiltPlan.objects.find(object => object.kind === "manifest");
    if (!manifestObject || manifestObject.objectKey !== "characters-manifest.json"
        || manifestObject.cacheControl !== "no-store" || !SHA256.test(manifestObject.sha256)) {
        throw new Error("K24 manifest plan rejected");
    }
    const reader = options.reader ?? createFyiCharacterPublicHttpsReader();
    let bytesRead = 0;
    const consumeBytes = (count) => {
        bytesRead += count;
        if (bytesRead > exports.FYI_CHARACTER_K24_MAX_AGGREGATE_BYTES)
            throw new Error("K24 aggregate response byte limit exceeded");
    };
    const objects = await mapConcurrent(immutableObjects, exports.FYI_CHARACTER_K24_CONCURRENCY, object => inspectImmutableObject(object, reader, consumeBytes));
    const manifest = await inspectManifest(manifestObject, reader, consumeBytes);
    const bucketSize = await (options.bucketSizeReader ?? createFyiCharacterWranglerBucketSizeReader()).read();
    const reparsedBucketSize = parseFyiCharacterBucketSize(bucketSize.reported);
    if (bucketSize.conservativeUpperBoundBytes !== reparsedBucketSize.conservativeUpperBoundBytes) {
        throw new Error("K24 bucket size reader result rejected");
    }
    const objectSummary = objects.reduce((summary, object) => {
        summary[object.status] += 1;
        return summary;
    }, { matching: 0, missing: 0, conflict: 0, failed: 0, total: objects.length });
    const bytesNewIfPublished = objects.filter(object => object.status === "missing")
        .reduce((total, object) => total + object.expectedSizeBytes, 0)
        + (manifest.status === "matching" ? 0 : manifest.expectedSizeBytes);
    const projectedBucketUpperBoundBytes = bucketSize.conservativeUpperBoundBytes + bytesNewIfPublished;
    const withinNamespaceLimit = bytesNewIfPublished <= fyi_character_release_1.FYI_CHARACTER_RELEASE_MAX_BYTES;
    const withinBucketLimit = projectedBucketUpperBoundBytes < fyi_character_release_1.FYI_CHARACTER_BUCKET_MAX_BYTES;
    const everyImmutableObjectInspected = objects.length === immutableObjects.length;
    const noImmutableConflicts = objectSummary.conflict === 0;
    const noRemoteReadFailures = objectSummary.failed === 0 && manifest.status !== "failed";
    const stablePortraitHashesProvenOrMissing = objects
        .filter(object => object.kind === "portrait")
        .every(object => object.status === "matching" || object.status === "missing");
    const go = everyImmutableObjectInspected && noImmutableConflicts && noRemoteReadFailures
        && stablePortraitHashesProvenOrMissing && withinNamespaceLimit && withinBucketLimit;
    const report = {
        schemaVersion: 1,
        contract: exports.FYI_CHARACTER_K24_CONTRACT,
        contractVersion: exports.FYI_CHARACTER_K24_CONTRACT_VERSION,
        checkedAt: options.checkedAt ?? new Date().toISOString(),
        releaseId: options.releaseId,
        remote: {
            publicBaseUrl: exports.FYI_CHARACTER_K24_PUBLIC_BASE_URL,
            bucket: exports.FYI_CHARACTER_K24_BUCKET,
            target: "remote",
            transport: "public_https_get_and_wrangler_bucket_info",
        },
        source: {
            releaseReportSha256: sha256(JSON_BYTES(validated.release)),
            planSha256: sha256(JSON_BYTES(validated.plan)),
            receiptSha256: sha256(JSON_BYTES(validated.receipt)),
        },
        objects,
        objectSummary,
        manifest,
        budget: {
            namespaceLimitBytes: fyi_character_release_1.FYI_CHARACTER_RELEASE_MAX_BYTES,
            bucketLimitBytes: fyi_character_release_1.FYI_CHARACTER_BUCKET_MAX_BYTES,
            aggregateResponseLimitBytes: exports.FYI_CHARACTER_K24_MAX_AGGREGATE_BYTES,
            bytesRead,
            bytesNewIfPublished,
            bucketSize,
            projectedBucketUpperBoundBytes,
            withinNamespaceLimit,
            withinBucketLimit,
        },
        checks: {
            localReleaseRevalidated: true,
            everyImmutableObjectInspected,
            noImmutableConflicts,
            noRemoteReadFailures,
            stablePortraitHashesProvenOrMissing,
            bucketUsageKnown: true,
            readOnlyTransport: true,
            noRemoteMutation: true,
            noPublisherImported: true,
        },
        readiness: {
            remoteReadOnlyPreflight: go ? "GO" : "NO-GO",
            publicationAuthorization: "REQUIRED",
            publication: "NO-GO",
            production: "NO-GO",
            android: "NO-GO",
            r2Mutation: "NO-GO",
        },
    };
    if (options.writeReport !== false) {
        await writeReportSafely(options.fyiRoot, options.releaseId, report);
    }
    return report;
}
exports.runFyiCharacterRemotePreflightK24 = runFyiCharacterRemotePreflightK24;
async function main() {
    const { releaseId } = parseFyiCharacterRemotePreflightCli(process.argv.slice(2));
    const fyiRoot = (0, path_1.resolve)(__dirname, "data/fyi-characters");
    const report = await runFyiCharacterRemotePreflightK24({ fyiRoot, releaseId });
    console.log(JSON.stringify({
        releaseId: report.releaseId,
        objectSummary: report.objectSummary,
        manifest: report.manifest,
        budget: report.budget,
        readiness: report.readiness,
    }, null, 2));
    if (report.readiness.remoteReadOnlyPreflight !== "GO")
        process.exitCode = 2;
}
if (require.main === module)
    main().catch(error => { console.error(error); process.exitCode = 1; });
//# sourceMappingURL=fyi-character-release-preflight.js.map