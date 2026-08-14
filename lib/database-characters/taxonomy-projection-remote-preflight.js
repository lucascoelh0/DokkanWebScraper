"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runTaxonomyProjectionRemotePreflight = void 0;
const child_process_1 = require("child_process");
const crypto_1 = require("crypto");
const fs_1 = require("fs");
const promises_1 = require("fs/promises");
const https_1 = require("https");
const path_1 = require("path");
const taxonomy_projection_delivery_contract_1 = require("./taxonomy-projection-delivery-contract");
const taxonomy_projection_object_plan_contract_1 = require("./taxonomy-projection-object-plan-contract");
const taxonomy_projection_object_plan_1 = require("./taxonomy-projection-object-plan");
const taxonomy_projection_remote_preflight_contract_1 = require("./taxonomy-projection-remote-preflight-contract");
const taxonomy_projection_contract_1 = require("./taxonomy-projection-contract");
const ID = /^[a-f0-9]{64}$/;
const HASH = /^[a-f0-9]{64}$/;
const CHECKED_AT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const PAYLOAD_NAME = /^database-characters-k35-taxonomy-projection\.[a-f0-9]{64}\.json\.gz$/;
const EXPECTED_KINDS = ["payload", "coverage", "validation", "manifest"];
const hash = (value) => (0, crypto_1.createHash)("sha256").update(value).digest("hex");
const jsonBytes = (value) => Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8");
const samePath = (left, right) => process.platform === "win32"
    ? (0, path_1.resolve)(left).toLowerCase() === (0, path_1.resolve)(right).toLowerCase()
    : (0, path_1.resolve)(left) === (0, path_1.resolve)(right);
const sameFile = (left, right) => left.dev === right.dev && left.ino === right.ino;
class RssGuard {
    peak = Math.max(process.memoryUsage().rss, process.resourceUsage().maxRSS * 1024);
    exceeded = false;
    timer = setInterval(() => this.observe(), 10);
    constructor() { this.timer.unref(); }
    observe() {
        this.peak = Math.max(this.peak, process.memoryUsage().rss, process.resourceUsage().maxRSS * 1024);
        this.exceeded ||= this.peak >= taxonomy_projection_remote_preflight_contract_1.TAXONOMY_PROJECTION_REMOTE_PREFLIGHT_RSS_LIMIT_BYTES;
    }
    sample(nestedPeak = 0, reservedHeadroom = 0) {
        this.observe();
        this.peak = Math.max(this.peak, nestedPeak);
        this.exceeded ||= this.peak >= taxonomy_projection_remote_preflight_contract_1.TAXONOMY_PROJECTION_REMOTE_PREFLIGHT_RSS_LIMIT_BYTES
            || this.peak + reservedHeadroom >= taxonomy_projection_remote_preflight_contract_1.TAXONOMY_PROJECTION_REMOTE_PREFLIGHT_RSS_LIMIT_BYTES;
        if (this.exceeded)
            throw new Error(`K38 RSS limit reached: ${this.peak}`);
        return this.peak;
    }
    stop() { clearInterval(this.timer); return this.sample(); }
    dispose() { clearInterval(this.timer); }
}
function boundedError(error) {
    const message = sanitizedFailure(error);
    return new Error(`K38 remote preflight failed: ${message}`.slice(0, taxonomy_projection_remote_preflight_contract_1.TAXONOMY_PROJECTION_REMOTE_PREFLIGHT_MAX_ERROR_LENGTH));
}
function sanitizedFailure(error) {
    const source = error instanceof Error ? error.message : String(error);
    return source
        .replace(/[\u0000-\u001f\u007f]+/g, " ")
        .replace(/https?:\/\/\S+/gi, "[remote-url]")
        .replace(/[A-Za-z]:\\[^\s]+/g, "[local-path]")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, taxonomy_projection_remote_preflight_contract_1.TAXONOMY_PROJECTION_REMOTE_PREFLIGHT_MAX_FAILURE_LENGTH) || "K38 read failed";
}
function assertCheckedAt(value) {
    if (!CHECKED_AT.test(value) || Number.isNaN(Date.parse(value)) || new Date(value).toISOString() !== value) {
        throw new Error("K38 requires an explicit canonical UTC checkedAt");
    }
}
function assertContained(parent, child) {
    const remainder = (0, path_1.relative)((0, path_1.resolve)(parent), (0, path_1.resolve)(child));
    if (!remainder || remainder === ".." || remainder.startsWith(`..${path_1.sep}`) || (0, path_1.isAbsolute)(remainder)) {
        throw new Error("K38 report path containment rejected");
    }
}
function isSameOrDescendant(parent, candidate) {
    const remainder = (0, path_1.relative)((0, path_1.resolve)(parent), (0, path_1.resolve)(candidate));
    return remainder === "" || (!remainder.startsWith(`..${path_1.sep}`) && remainder !== ".." && !(0, path_1.isAbsolute)(remainder));
}
function assertOutputSeparatedFromClosedSources(outputRoot, source, options) {
    const closedSources = [
        source.validated.planDirectory,
        (0, path_1.join)((0, path_1.resolve)(options.k36OutputRoot), taxonomy_projection_delivery_contract_1.TAXONOMY_PROJECTION_DELIVERY_NAMESPACE, options.k36ReleaseId),
    ];
    if (closedSources.some(sourcePath => isSameOrDescendant(sourcePath, outputRoot.path))) {
        throw new Error("K38 output root must not alias or descend from a closed K37/K36 source artifact");
    }
}
async function inspectDirectory(pathValue, label) {
    const path = (0, path_1.resolve)(pathValue);
    const before = await (0, promises_1.lstat)(path);
    if (!before.isDirectory() || before.isSymbolicLink())
        throw new Error(`K38 ${label} must be a regular directory`);
    const realPath = await (0, promises_1.realpath)(path);
    if (!samePath(realPath, path))
        throw new Error(`K38 ${label} link or junction rejected`);
    const after = await (0, promises_1.lstat)(path);
    if (!after.isDirectory() || after.isSymbolicLink() || !sameFile(before, after)) {
        throw new Error(`K38 ${label} identity changed`);
    }
    return { path, realPath, dev: after.dev, ino: after.ino };
}
async function checkpoint(expected, label) {
    const actual = await inspectDirectory(expected.path, label);
    if (!samePath(actual.realPath, expected.realPath) || actual.dev !== expected.dev || actual.ino !== expected.ino) {
        throw new Error(`K38 ${label} identity changed`);
    }
}
function sourceReadOptions(options) {
    const roots = [options.k37OutputRoot, options.k36OutputRoot, options.k32Root, options.k2Root,
        options.productiveRoot, options.sqliteRoot, options.db1Root, options.elfRoot, options.nativeEvidenceRoot];
    if (roots.some(root => typeof root !== "string" || !root)
        || !ID.test(options.k37PlanId) || (0, path_1.isAbsolute)(options.k37PlanId)
        || !ID.test(options.k36ReleaseId) || (0, path_1.isAbsolute)(options.k36ReleaseId)) {
        throw new Error("K38 requires canonical K37/K36 IDs and every explicit source root");
    }
    return {
        outputRoot: options.k37OutputRoot,
        planId: options.k37PlanId,
        k36OutputRoot: options.k36OutputRoot,
        k36ReleaseId: options.k36ReleaseId,
        k32Root: options.k32Root,
        k2Root: options.k2Root,
        productiveRoot: options.productiveRoot,
        sqliteRoot: options.sqliteRoot,
        db1Root: options.db1Root,
        elfRoot: options.elfRoot,
        nativeEvidenceRoot: options.nativeEvidenceRoot,
    };
}
function expectedFileNames(objects) {
    return [objects[0]?.sourceFileName, taxonomy_projection_contract_1.TAXONOMY_PROJECTION_FILES.coverage,
        taxonomy_projection_contract_1.TAXONOMY_PROJECTION_FILES.validation, taxonomy_projection_contract_1.TAXONOMY_PROJECTION_FILES.manifest];
}
function validateSource(validated, options) {
    const { plan, manifestCandidate } = validated;
    if (validated.sourceBoundK36Validation !== "GO" || validated.planId !== options.k37PlanId
        || plan.planId !== options.k37PlanId || plan.source.k36.releaseId !== options.k36ReleaseId
        || plan.remoteNamespace !== taxonomy_projection_object_plan_contract_1.TAXONOMY_PROJECTION_REMOTE_NAMESPACE || plan.objects.length !== 4
        || JSON.stringify(plan.objects.map(object => object.kind)) !== JSON.stringify(EXPECTED_KINDS)) {
        throw new Error("K38 source-bound K37 identity or ordered inventory rejected");
    }
    const names = expectedFileNames(plan.objects);
    if (!PAYLOAD_NAME.test(names[0]) || new Set(names).size !== 4
        || JSON.stringify(plan.objects.map(object => object.sourceFileName)) !== JSON.stringify(names)) {
        throw new Error("K38 exact K35 file inventory rejected");
    }
    for (const object of plan.objects) {
        const exactKey = `${taxonomy_projection_object_plan_contract_1.TAXONOMY_PROJECTION_REMOTE_NAMESPACE}/objects/sha256/${object.sha256}/${object.sourceFileName}`;
        if (!HASH.test(object.sha256) || !Number.isSafeInteger(object.sizeBytes) || object.sizeBytes <= 0
            || object.objectKey !== exactKey || object.sourceFileName.includes("/") || object.sourceFileName.includes("\\")
            || object.cacheControl !== "public, max-age=31536000, immutable"
            || object.contentAddressed !== true || object.remoteHashProofRequiredBeforeReuse !== true) {
            throw new Error("K38 immutable remote object contract rejected");
        }
    }
    if (new Set(plan.objects.map(object => object.objectKey)).size !== 4
        || manifestCandidate.inventory.closed !== true || manifestCandidate.inventory.artifactCount !== 4
        || JSON.stringify(manifestCandidate.inventory.objects) !== JSON.stringify(plan.objects)
        || manifestCandidate.releaseId !== options.k36ReleaseId
        || manifestCandidate.cacheControl !== "no-store") {
        throw new Error("K38 K37 manifest candidate inventory rejected");
    }
    const manifestCandidateBytes = jsonBytes(manifestCandidate);
    if (plan.mutableManifest.objectKey !== taxonomy_projection_object_plan_contract_1.TAXONOMY_PROJECTION_REMOTE_MANIFEST_KEY
        || plan.mutableManifest.cacheControl !== "no-store"
        || plan.mutableManifest.sha256 !== hash(manifestCandidateBytes)
        || plan.mutableManifest.sizeBytes !== manifestCandidateBytes.length
        || manifestCandidateBytes.length >= taxonomy_projection_remote_preflight_contract_1.TAXONOMY_PROJECTION_REMOTE_PREFLIGHT_MAX_RESPONSE_BYTES) {
        throw new Error("K38 mutable manifest candidate contract rejected");
    }
    const immutableBytes = plan.objects.reduce((total, object) => total + object.sizeBytes, 0);
    const namespacePlanBytes = immutableBytes + taxonomy_projection_object_plan_contract_1.TAXONOMY_PROJECTION_OBJECT_PLAN_MANIFEST_RESERVATION_BYTES;
    if (!Number.isSafeInteger(immutableBytes) || plan.budget.namespaceLimitBytes !== taxonomy_projection_object_plan_contract_1.TAXONOMY_PROJECTION_OBJECT_PLAN_NAMESPACE_MAX_BYTES
        || plan.budget.immutableObjectBytes !== immutableBytes
        || plan.budget.mutableManifestReservationBytes !== taxonomy_projection_object_plan_contract_1.TAXONOMY_PROJECTION_OBJECT_PLAN_MANIFEST_RESERVATION_BYTES
        || plan.budget.worstCaseNewBytes !== namespacePlanBytes || plan.budget.withinNamespaceLimit !== true
        || plan.budget.bucketCeilingBytes !== taxonomy_projection_object_plan_contract_1.TAXONOMY_PROJECTION_OBJECT_PLAN_BUCKET_CEILING_BYTES) {
        throw new Error("K38 K37 conservative budget contract rejected");
    }
    const planBytes = jsonBytes(plan);
    const receiptBytes = jsonBytes(validated.receipt);
    const markerBytes = jsonBytes(validated.marker);
    const fingerprint = hash(Buffer.concat([planBytes, manifestCandidateBytes, receiptBytes, markerBytes]));
    return {
        validated, fingerprint, planBytes, manifestCandidateBytes, receiptBytes, markerBytes,
        namespacePlanStrictlyWithinLimit: namespacePlanBytes < taxonomy_projection_object_plan_contract_1.TAXONOMY_PROJECTION_OBJECT_PLAN_NAMESPACE_MAX_BYTES,
    };
}
function createAggregateCounter() {
    return {
        bytesRead: 0,
        consume(count) {
            if (!Number.isSafeInteger(count) || count < 0)
                throw new Error("K38 response byte count rejected");
            this.bytesRead += count;
            if (!Number.isSafeInteger(this.bytesRead)
                || this.bytesRead >= taxonomy_projection_remote_preflight_contract_1.TAXONOMY_PROJECTION_REMOTE_PREFLIGHT_MAX_AGGREGATE_BYTES) {
                throw new Error("K38 aggregate response byte limit reached");
            }
        },
    };
}
function isAllowedRemoteKey(objectKey) {
    return objectKey === taxonomy_projection_object_plan_contract_1.TAXONOMY_PROJECTION_REMOTE_MANIFEST_KEY
        || /^database-characters\/taxonomy-projection\/v1\/objects\/sha256\/[a-f0-9]{64}\/database-characters-k35-taxonomy-projection(?:\.[a-f0-9]{64}\.json\.gz|-coverage\.json|-validation\.json|-manifest\.json)$/.test(objectKey);
}
function readRemoteObject(objectKey, aggregate) {
    return new Promise((resolvePromise, rejectPromise) => {
        if (!isAllowedRemoteKey(objectKey)) {
            rejectPromise(new Error("K38 remote object key rejected"));
            return;
        }
        const encodedPath = objectKey.split("/").map(encodeURIComponent).join("/");
        const url = new URL(encodedPath, taxonomy_projection_remote_preflight_contract_1.TAXONOMY_PROJECTION_REMOTE_PREFLIGHT_PUBLIC_BASE_URL);
        let settled = false;
        let deadline;
        const rejectOnce = (error) => {
            if (!settled) {
                settled = true;
                if (deadline)
                    clearTimeout(deadline);
                rejectPromise(error);
            }
        };
        const request = (0, https_1.request)(url, {
            method: "GET",
            headers: {
                Accept: "application/octet-stream, application/json",
                "Accept-Encoding": "identity",
            },
        }, response => {
            const statusCode = response.statusCode ?? 0;
            const contentEncodingValue = response.headers["content-encoding"];
            const contentEncoding = Array.isArray(contentEncodingValue) ? contentEncodingValue.join(",") : contentEncodingValue;
            if (statusCode >= 300 && statusCode < 400) {
                response.resume();
                rejectOnce(new Error(`K38 redirect blocked (${statusCode})`));
                return;
            }
            if (statusCode !== 200 && statusCode !== 404) {
                response.resume();
                rejectOnce(new Error(`K38 unexpected HTTP status ${statusCode}`));
                return;
            }
            if (contentEncoding !== undefined && contentEncoding.toLowerCase() !== "identity") {
                response.resume();
                rejectOnce(new Error("K38 non-identity content encoding blocked"));
                return;
            }
            const contentLengthValue = response.headers["content-length"];
            const contentLength = Array.isArray(contentLengthValue) ? contentLengthValue[0] : contentLengthValue;
            if (contentLength !== undefined && (!/^\d+$/.test(contentLength)
                || Number(contentLength) >= taxonomy_projection_remote_preflight_contract_1.TAXONOMY_PROJECTION_REMOTE_PREFLIGHT_MAX_RESPONSE_BYTES)) {
                response.resume();
                rejectOnce(new Error("K38 response byte limit reached"));
                return;
            }
            const chunks = [];
            let responseBytes = 0;
            response.on("data", chunkValue => {
                if (settled)
                    return;
                const chunk = Buffer.isBuffer(chunkValue) ? chunkValue : Buffer.from(chunkValue);
                responseBytes += chunk.length;
                try {
                    if (responseBytes >= taxonomy_projection_remote_preflight_contract_1.TAXONOMY_PROJECTION_REMOTE_PREFLIGHT_MAX_RESPONSE_BYTES) {
                        throw new Error("K38 response byte limit reached");
                    }
                    aggregate.consume(chunk.length);
                    chunks.push(chunk);
                }
                catch (error) {
                    response.destroy();
                    rejectOnce(error instanceof Error ? error : new Error("K38 bounded response read failed"));
                }
            });
            response.on("end", () => {
                if (!settled) {
                    settled = true;
                    if (deadline)
                        clearTimeout(deadline);
                    resolvePromise({ statusCode, bytes: Buffer.concat(chunks) });
                }
            });
            response.on("error", () => rejectOnce(new Error("K38 HTTPS response failed")));
            response.on("aborted", () => rejectOnce(new Error("K38 HTTPS response aborted")));
        });
        request.setTimeout(taxonomy_projection_remote_preflight_contract_1.TAXONOMY_PROJECTION_REMOTE_PREFLIGHT_REQUEST_TIMEOUT_MS, () => request.destroy(new Error("K38 HTTPS request timeout")));
        deadline = setTimeout(() => request.destroy(new Error("K38 HTTPS request timeout")), taxonomy_projection_remote_preflight_contract_1.TAXONOMY_PROJECTION_REMOTE_PREFLIGHT_REQUEST_TIMEOUT_MS);
        deadline.unref();
        request.on("error", error => rejectOnce(error.message.includes("timeout")
            ? new Error("K38 HTTPS request timeout") : new Error("K38 HTTPS request failed")));
        request.end();
    });
}
async function mapConcurrent(values, concurrency, mapper) {
    const output = new Array(values.length);
    let next = 0;
    await Promise.all(Array.from({ length: Math.min(concurrency, values.length) }, async () => {
        while (true) {
            const index = next++;
            if (index >= values.length)
                return;
            output[index] = await mapper(values[index]);
        }
    }));
    return output;
}
async function inspectImmutableObject(object, aggregate) {
    try {
        const remote = await readRemoteObject(object.objectKey, aggregate);
        if (remote.statusCode === 404) {
            return { kind: object.kind, objectKey: object.objectKey, status: "missing",
                expectedSha256: object.sha256, expectedSizeBytes: object.sizeBytes };
        }
        const actualSha256 = hash(remote.bytes);
        return {
            kind: object.kind,
            objectKey: object.objectKey,
            status: actualSha256 === object.sha256 && remote.bytes.length === object.sizeBytes ? "matching" : "conflict",
            expectedSha256: object.sha256,
            expectedSizeBytes: object.sizeBytes,
            actualSha256,
            actualSizeBytes: remote.bytes.length,
        };
    }
    catch (error) {
        return { kind: object.kind, objectKey: object.objectKey, status: "failed",
            expectedSha256: object.sha256, expectedSizeBytes: object.sizeBytes, failure: sanitizedFailure(error) };
    }
}
async function inspectMutableManifest(source, aggregate) {
    const expectedSha256 = hash(source.manifestCandidateBytes);
    const expectedSizeBytes = source.manifestCandidateBytes.length;
    try {
        const remote = await readRemoteObject(taxonomy_projection_object_plan_contract_1.TAXONOMY_PROJECTION_REMOTE_MANIFEST_KEY, aggregate);
        if (remote.statusCode === 404) {
            return { objectKey: taxonomy_projection_object_plan_contract_1.TAXONOMY_PROJECTION_REMOTE_MANIFEST_KEY, status: "missing", expectedSha256, expectedSizeBytes };
        }
        const actualSha256 = hash(remote.bytes);
        const observation = {
            objectKey: taxonomy_projection_object_plan_contract_1.TAXONOMY_PROJECTION_REMOTE_MANIFEST_KEY,
            status: actualSha256 === expectedSha256 && remote.bytes.length === expectedSizeBytes ? "matching" : "different",
            expectedSha256,
            expectedSizeBytes,
            actualSha256,
            actualSizeBytes: remote.bytes.length,
        };
        try {
            const parsed = JSON.parse(remote.bytes.toString("utf8"));
            if (typeof parsed.datasetVersion === "string")
                observation.observedDatasetVersion = parsed.datasetVersion.slice(0, 128);
            if (typeof parsed.releaseId === "string")
                observation.observedReleaseId = parsed.releaseId.slice(0, 128);
        }
        catch { /* Mutable remote bytes are observations only. */ }
        return observation;
    }
    catch (error) {
        return { objectKey: taxonomy_projection_object_plan_contract_1.TAXONOMY_PROJECTION_REMOTE_MANIFEST_KEY, status: "failed",
            expectedSha256, expectedSizeBytes, failure: sanitizedFailure(error) };
    }
}
function resolveWranglerEntrypoint() {
    const candidates = [
        (0, path_1.resolve)(__dirname, "..", "node_modules", "wrangler", "bin", "wrangler.js"),
        (0, path_1.resolve)(__dirname, "..", "node_modules", "wrangler", "wrangler-dist", "cli.js"),
        (0, path_1.resolve)(__dirname, "..", "..", "node_modules", "wrangler", "bin", "wrangler.js"),
        (0, path_1.resolve)(__dirname, "..", "..", "node_modules", "wrangler", "wrangler-dist", "cli.js"),
    ];
    const found = candidates.find(fs_1.existsSync);
    if (!found)
        throw new Error("K38 Wrangler entrypoint unavailable");
    return found;
}
function conservativeBucketUpperBound(reported) {
    if (typeof reported === "number") {
        if (!Number.isSafeInteger(reported) || reported < 0 || reported === Number.MAX_SAFE_INTEGER) {
            throw new Error("K38 Wrangler bucket size rejected");
        }
        return { reported: String(reported), conservativeUpperBoundBytes: reported + 1 };
    }
    if (typeof reported !== "string")
        throw new Error("K38 Wrangler bucket size missing");
    const match = /^\s*(\d+(?:\.\d+)?)\s*(B|kB|MB|GB|TB)\s*$/.exec(reported);
    if (!match)
        throw new Error("K38 Wrangler bucket size format rejected");
    const unit = { B: 1, kB: 1000, MB: 1000000, GB: 1000000000, TB: 1000000000000 };
    const decimals = match[1].split(".")[1]?.length ?? 0;
    const upperBound = Math.ceil((Number(match[1]) + 10 ** -decimals) * unit[match[2]]);
    if (!Number.isSafeInteger(upperBound) || upperBound < 0)
        throw new Error("K38 Wrangler bucket size range rejected");
    return { reported, conservativeUpperBoundBytes: upperBound };
}
function readBucketUsage() {
    return new Promise(resolvePromise => {
        let entrypoint;
        try {
            entrypoint = resolveWranglerEntrypoint();
        }
        catch (error) {
            resolvePromise({ status: "failed", failure: sanitizedFailure(error) });
            return;
        }
        (0, child_process_1.execFile)(process.execPath, [entrypoint, "r2", "bucket", "info", taxonomy_projection_remote_preflight_contract_1.TAXONOMY_PROJECTION_REMOTE_PREFLIGHT_BUCKET, "--json"], {
            encoding: "utf8",
            timeout: taxonomy_projection_remote_preflight_contract_1.TAXONOMY_PROJECTION_REMOTE_PREFLIGHT_BUCKET_TIMEOUT_MS,
            maxBuffer: taxonomy_projection_remote_preflight_contract_1.TAXONOMY_PROJECTION_REMOTE_PREFLIGHT_BUCKET_MAX_BUFFER_BYTES,
            killSignal: "SIGKILL",
            windowsHide: true,
        }, (error, stdout) => {
            if (error) {
                resolvePromise({ status: "failed", failure: "K38 Wrangler bucket info failed" });
                return;
            }
            try {
                const parsed = JSON.parse(stdout);
                const known = conservativeBucketUpperBound(parsed.bucket_size);
                resolvePromise({ status: "known", ...known });
            }
            catch (parseError) {
                resolvePromise({ status: "failed", failure: sanitizedFailure(parseError) });
            }
        });
    });
}
async function ensureChildDirectory(parent, name, label) {
    if (!name || name.includes("/") || name.includes("\\") || (0, path_1.isAbsolute)(name))
        throw new Error(`K38 ${label} name rejected`);
    const path = (0, path_1.join)(parent.path, name);
    assertContained(parent.path, path);
    await checkpoint(parent, `${label} parent`);
    try {
        await (0, promises_1.mkdir)(path, { mode: 0o700 });
    }
    catch (error) {
        if (error?.code !== "EEXIST")
            throw error;
    }
    await checkpoint(parent, `${label} parent`);
    return inspectDirectory(path, label);
}
async function assertExistingReportParentsSafe(outputRoot, planId) {
    const namespacePath = (0, path_1.join)(outputRoot.path, taxonomy_projection_remote_preflight_contract_1.TAXONOMY_PROJECTION_REMOTE_PREFLIGHT_NAMESPACE);
    assertContained(outputRoot.path, namespacePath);
    let namespace;
    try {
        namespace = await inspectDirectory(namespacePath, "existing report namespace");
    }
    catch (error) {
        if (error?.code === "ENOENT")
            return;
        throw error;
    }
    const planPath = (0, path_1.join)(namespace.path, planId);
    assertContained(namespace.path, planPath);
    try {
        await inspectDirectory(planPath, "existing report plan directory");
    }
    catch (error) {
        if (error?.code !== "ENOENT")
            throw error;
    }
    await checkpoint(outputRoot, "output root");
    await checkpoint(namespace, "existing report namespace");
}
async function rejectExistingReport(directoryPath) {
    const directory = await inspectDirectory(directoryPath, "existing report directory");
    const entries = await (0, promises_1.readdir)(directory.path, { withFileTypes: true });
    if (entries.length !== 1 || entries[0].name !== taxonomy_projection_remote_preflight_contract_1.TAXONOMY_PROJECTION_REMOTE_PREFLIGHT_REPORT_FILE
        || !entries[0].isFile() || entries[0].isSymbolicLink()) {
        throw new Error("K38 existing report inventory rejected");
    }
    const path = (0, path_1.join)(directory.path, taxonomy_projection_remote_preflight_contract_1.TAXONOMY_PROJECTION_REMOTE_PREFLIGHT_REPORT_FILE);
    const metadata = await (0, promises_1.lstat)(path);
    if (!metadata.isFile() || metadata.isSymbolicLink() || metadata.nlink !== 1 || !samePath(await (0, promises_1.realpath)(path), path)) {
        throw new Error("K38 existing report file identity rejected");
    }
    throw new Error("K38 create-only report already exists");
}
async function persistReport(outputRoot, planId, report) {
    const bytes = jsonBytes(report);
    if (bytes.length >= taxonomy_projection_remote_preflight_contract_1.TAXONOMY_PROJECTION_REMOTE_PREFLIGHT_MAX_REPORT_BYTES) {
        throw new Error("K38 report byte limit reached");
    }
    const reportSha256 = hash(bytes);
    const namespace = await ensureChildDirectory(outputRoot, taxonomy_projection_remote_preflight_contract_1.TAXONOMY_PROJECTION_REMOTE_PREFLIGHT_NAMESPACE, "report namespace");
    const planDirectory = await ensureChildDirectory(namespace, planId, "report plan directory");
    const reportDirectoryPath = (0, path_1.join)(planDirectory.path, reportSha256);
    assertContained(planDirectory.path, reportDirectoryPath);
    await checkpoint(planDirectory, "report plan directory");
    try {
        await (0, promises_1.mkdir)(reportDirectoryPath, { mode: 0o700 });
    }
    catch (error) {
        if (error?.code === "EEXIST")
            return rejectExistingReport(reportDirectoryPath);
        throw error;
    }
    await checkpoint(planDirectory, "report plan directory");
    const reportDirectory = await inspectDirectory(reportDirectoryPath, "report directory");
    const reportPath = (0, path_1.join)(reportDirectory.path, taxonomy_projection_remote_preflight_contract_1.TAXONOMY_PROJECTION_REMOTE_PREFLIGHT_REPORT_FILE);
    assertContained(reportDirectory.path, reportPath);
    await checkpoint(reportDirectory, "report directory");
    const handle = await (0, promises_1.open)(reportPath, fs_1.constants.O_CREAT | fs_1.constants.O_EXCL | fs_1.constants.O_WRONLY | (fs_1.constants.O_NOFOLLOW ?? 0), 0o600);
    try {
        await checkpoint(reportDirectory, "report directory");
        await handle.writeFile(bytes);
        await handle.sync();
        const metadata = await handle.stat();
        if (!metadata.isFile() || metadata.nlink !== 1 || metadata.size !== bytes.length) {
            throw new Error("K38 created report identity rejected");
        }
    }
    finally {
        await handle.close();
    }
    const before = await (0, promises_1.lstat)(reportPath);
    if (!before.isFile() || before.isSymbolicLink() || before.nlink !== 1 || !samePath(await (0, promises_1.realpath)(reportPath), reportPath)) {
        throw new Error("K38 report identity rejected after create");
    }
    const readHandle = await (0, promises_1.open)(reportPath, fs_1.constants.O_RDONLY | (fs_1.constants.O_NOFOLLOW ?? 0));
    try {
        const opened = await readHandle.stat();
        const reopenedBytes = await readHandle.readFile();
        const after = await readHandle.stat();
        if (!sameFile(before, opened) || !sameFile(opened, after) || after.nlink !== 1 || !reopenedBytes.equals(bytes)) {
            throw new Error("K38 report changed while reopening");
        }
    }
    finally {
        await readHandle.close();
    }
    const inventory = await (0, promises_1.readdir)(reportDirectory.path, { withFileTypes: true });
    if (inventory.length !== 1 || inventory[0].name !== taxonomy_projection_remote_preflight_contract_1.TAXONOMY_PROJECTION_REMOTE_PREFLIGHT_REPORT_FILE
        || !inventory[0].isFile() || inventory[0].isSymbolicLink()) {
        throw new Error("K38 created report closed inventory rejected");
    }
    await checkpoint(outputRoot, "output root");
    await checkpoint(namespace, "report namespace");
    await checkpoint(planDirectory, "report plan directory");
    await checkpoint(reportDirectory, "report directory");
    return { reportDirectory: reportDirectory.path, reportPath, reportSha256 };
}
async function runTaxonomyProjectionRemotePreflight(options) {
    const rss = new RssGuard();
    try {
        if (options?.optInK38 !== true)
            throw new Error("K38 requires exact --opt-in-k38 authorization");
        if (options.remoteReadOnly !== true)
            throw new Error("K38 requires exact --remote-read-only mode");
        if (!options.outputRoot)
            throw new Error("K38 requires an explicit output root");
        assertCheckedAt(options.checkedAt);
        const readOptions = sourceReadOptions(options);
        const outputRoot = await inspectDirectory(options.outputRoot, "output root");
        const before = validateSource(await (0, taxonomy_projection_object_plan_1.readValidatedTaxonomyProjectionObjectPlan)(readOptions), options);
        rss.sample(before.validated.peakRssBytes, taxonomy_projection_remote_preflight_contract_1.TAXONOMY_PROJECTION_REMOTE_PREFLIGHT_RSS_REMOTE_RESERVE_BYTES);
        assertOutputSeparatedFromClosedSources(outputRoot, before, options);
        await assertExistingReportParentsSafe(outputRoot, options.k37PlanId);
        const aggregate = createAggregateCounter();
        const objects = await mapConcurrent(before.validated.plan.objects, taxonomy_projection_remote_preflight_contract_1.TAXONOMY_PROJECTION_REMOTE_PREFLIGHT_CONCURRENCY, object => inspectImmutableObject(object, aggregate));
        const manifest = await inspectMutableManifest(before, aggregate);
        rss.sample(0, taxonomy_projection_remote_preflight_contract_1.TAXONOMY_PROJECTION_REMOTE_PREFLIGHT_RSS_REPORT_RESERVE_BYTES);
        const bucketUsage = await readBucketUsage();
        rss.sample(0, taxonomy_projection_remote_preflight_contract_1.TAXONOMY_PROJECTION_REMOTE_PREFLIGHT_RSS_REPORT_RESERVE_BYTES);
        const after = validateSource(await (0, taxonomy_projection_object_plan_1.readValidatedTaxonomyProjectionObjectPlan)(readOptions), options);
        rss.sample(after.validated.peakRssBytes, taxonomy_projection_remote_preflight_contract_1.TAXONOMY_PROJECTION_REMOTE_PREFLIGHT_RSS_REPORT_RESERVE_BYTES);
        if (before.fingerprint !== after.fingerprint)
            throw new Error("K38 K37 source drifted during remote reads");
        const objectSummary = objects.reduce((summary, object) => {
            summary[object.status]++;
            return summary;
        }, { matching: 0, missing: 0, conflict: 0, failed: 0, total: 4 });
        const missingImmutableBytes = objects.filter(object => object.status === "missing")
            .reduce((total, object) => total + object.expectedSizeBytes, 0);
        const bytesNewIfPublished = missingImmutableBytes + before.manifestCandidateBytes.length;
        const bucketUpperBound = bucketUsage.status === "known" ? bucketUsage.conservativeUpperBoundBytes : "UNKNOWN";
        const projectedCandidate = bucketUpperBound === "UNKNOWN" ? undefined : bucketUpperBound + bytesNewIfPublished;
        const projectedBucketUpperBoundBytes = projectedCandidate === undefined || !Number.isSafeInteger(projectedCandidate)
            ? "UNKNOWN" : projectedCandidate;
        const withinBucketCeiling = projectedBucketUpperBoundBytes === "UNKNOWN"
            ? "UNKNOWN" : Number.isSafeInteger(projectedBucketUpperBoundBytes)
            && projectedBucketUpperBoundBytes < taxonomy_projection_object_plan_contract_1.TAXONOMY_PROJECTION_OBJECT_PLAN_BUCKET_CEILING_BYTES;
        const exactRemoteKeysOnly = JSON.stringify(objects.map(object => object.objectKey))
            === JSON.stringify(before.validated.plan.objects.map(object => object.objectKey))
            && manifest.objectKey === taxonomy_projection_object_plan_contract_1.TAXONOMY_PROJECTION_REMOTE_MANIFEST_KEY;
        const everyImmutableObjectInspected = objects.length === 4;
        const noImmutableConflict = objectSummary.conflict === 0;
        const noRemoteReadFailure = objectSummary.failed === 0 && manifest.status !== "failed";
        const mutableManifestPlanningStateAcceptable = manifest.status === "matching"
            || manifest.status === "different" || manifest.status === "missing";
        const bucketProjectionStrictlyWithinLimit = withinBucketCeiling === true;
        const go = exactRemoteKeysOnly && everyImmutableObjectInspected && noImmutableConflict && noRemoteReadFailure
            && mutableManifestPlanningStateAcceptable && bucketUsage.status === "known"
            && before.namespacePlanStrictlyWithinLimit && bucketProjectionStrictlyWithinLimit;
        const report = {
            schemaVersion: taxonomy_projection_remote_preflight_contract_1.TAXONOMY_PROJECTION_REMOTE_PREFLIGHT_SCHEMA_VERSION,
            contract: "dokkan-database-character-taxonomy-projection-remote-preflight-k38",
            contractVersion: taxonomy_projection_remote_preflight_contract_1.TAXONOMY_PROJECTION_REMOTE_PREFLIGHT_CONTRACT_VERSION,
            checkedAt: options.checkedAt,
            planId: options.k37PlanId,
            k36ReleaseId: options.k36ReleaseId,
            mode: "explicit_opt_in_remote_read_only",
            remote: {
                publicBaseUrl: taxonomy_projection_remote_preflight_contract_1.TAXONOMY_PROJECTION_REMOTE_PREFLIGHT_PUBLIC_BASE_URL,
                bucket: taxonomy_projection_remote_preflight_contract_1.TAXONOMY_PROJECTION_REMOTE_PREFLIGHT_BUCKET,
                objectMethod: "GET",
                redirects: "BLOCKED",
                acceptEncoding: "identity",
                immutableConcurrency: taxonomy_projection_remote_preflight_contract_1.TAXONOMY_PROJECTION_REMOTE_PREFLIGHT_CONCURRENCY,
                requestTimeoutMs: taxonomy_projection_remote_preflight_contract_1.TAXONOMY_PROJECTION_REMOTE_PREFLIGHT_REQUEST_TIMEOUT_MS,
                bucketCommand: "r2 bucket info dokkanpanion-data --json",
                bucketTimeoutMs: taxonomy_projection_remote_preflight_contract_1.TAXONOMY_PROJECTION_REMOTE_PREFLIGHT_BUCKET_TIMEOUT_MS,
                bucketMaxBufferBytes: taxonomy_projection_remote_preflight_contract_1.TAXONOMY_PROJECTION_REMOTE_PREFLIGHT_BUCKET_MAX_BUFFER_BYTES,
                bucketKillSignal: "SIGKILL",
                rssLimitBytesExclusive: taxonomy_projection_remote_preflight_contract_1.TAXONOMY_PROJECTION_REMOTE_PREFLIGHT_RSS_LIMIT_BYTES,
                rssRemoteAndReportReserveBytes: taxonomy_projection_remote_preflight_contract_1.TAXONOMY_PROJECTION_REMOTE_PREFLIGHT_RSS_REMOTE_RESERVE_BYTES,
            },
            source: {
                k37PlanSha256: hash(before.planBytes),
                k37PlanSizeBytes: before.planBytes.length,
                k37ManifestCandidateSha256: hash(before.manifestCandidateBytes),
                k37ManifestCandidateSizeBytes: before.manifestCandidateBytes.length,
                k37ReceiptSha256: hash(before.receiptBytes),
                k37ReceiptSizeBytes: before.receiptBytes.length,
                k37MarkerSha256: hash(before.markerBytes),
                k37MarkerSizeBytes: before.markerBytes.length,
                sourceBoundBeforeTransport: "GO",
                sourceBoundAfterRemoteReads: "GO",
                sourceUnchanged: true,
            },
            objects,
            objectSummary,
            manifest,
            bucketUsage,
            budget: {
                responseLimitBytesExclusive: taxonomy_projection_remote_preflight_contract_1.TAXONOMY_PROJECTION_REMOTE_PREFLIGHT_MAX_RESPONSE_BYTES,
                aggregateLimitBytesExclusive: taxonomy_projection_remote_preflight_contract_1.TAXONOMY_PROJECTION_REMOTE_PREFLIGHT_MAX_AGGREGATE_BYTES,
                bytesRead: aggregate.bytesRead,
                namespaceLimitBytesExclusive: taxonomy_projection_object_plan_contract_1.TAXONOMY_PROJECTION_OBJECT_PLAN_NAMESPACE_MAX_BYTES,
                namespacePlanBytes: before.validated.plan.budget.worstCaseNewBytes,
                namespacePlanStrictlyWithinLimit: before.namespacePlanStrictlyWithinLimit,
                missingImmutableBytes,
                manifestCandidateBytes: before.manifestCandidateBytes.length,
                bytesNewIfPublished,
                bucketCeilingBytesExclusive: taxonomy_projection_object_plan_contract_1.TAXONOMY_PROJECTION_OBJECT_PLAN_BUCKET_CEILING_BYTES,
                bucketConservativeUpperBoundBytes: bucketUpperBound,
                projectedBucketUpperBoundBytes,
                withinBucketCeiling,
            },
            checks: {
                exactImmutableObjectCount: objects.length === 4,
                exactRemoteKeysOnly,
                everyImmutableObjectInspected,
                noImmutableConflict,
                noRemoteReadFailure,
                mutableManifestPlanningStateAcceptable,
                bucketUsageKnown: bucketUsage.status === "known",
                namespacePlanStrictlyWithinLimit: before.namespacePlanStrictlyWithinLimit,
                bucketProjectionStrictlyWithinLimit,
                readOnlyTransport: true,
                noRemoteMutation: true,
                savedReportIsNotPublicationAuthority: true,
                futurePublisherMustRerunK38: true,
                callerControlledStableOutputNamespaceRequired: true,
                rssStrictlyWithinLimitWithReservedHeadroom: true,
            },
            readiness: {
                readOnlyRemotePreflight: go ? "GO" : "NO-GO",
                publicationAuthorization: "REQUIRED",
                publication: "NO-GO",
                r2Mutation: "NO-GO",
                android: "NO-GO",
                consumer: "NO-GO",
                authority: "NO-GO",
                production: "NO-GO",
            },
            state: "OPERATIONAL_OBSERVATION_ONLY_FUTURE_PUBLISHER_MUST_RERUN_K38",
        };
        const persisted = await persistReport(outputRoot, options.k37PlanId, report);
        rss.stop();
        return { ...persisted, report };
    }
    catch (error) {
        throw boundedError(error);
    }
    finally {
        rss.dispose();
    }
}
exports.runTaxonomyProjectionRemotePreflight = runTaxonomyProjectionRemotePreflight;
//# sourceMappingURL=taxonomy-projection-remote-preflight.js.map