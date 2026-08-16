"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runCharacterLeaderSupportedRemotePreflight = void 0;
const child_process_1 = require("child_process");
const crypto_1 = require("crypto");
const fs_1 = require("fs");
const promises_1 = require("fs/promises");
const https_1 = require("https");
const path_1 = require("path");
const leader_supported_publisher_dry_run_1 = require("./leader-supported-publisher-dry-run");
const leader_supported_publisher_dry_run_contract_1 = require("./leader-supported-publisher-dry-run-contract");
const leader_supported_remote_preflight_contract_1 = require("./leader-supported-remote-preflight-contract");
const CHECKED_AT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const HASH = /^[a-f0-9]{64}$/;
const hash = (bytes) => (0, crypto_1.createHash)("sha256").update(bytes).digest("hex");
const jsonBytes = (value) => Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8");
const json = (value) => JSON.stringify(value);
const samePath = (left, right) => process.platform === "win32"
    ? (0, path_1.resolve)(left).toLowerCase() === (0, path_1.resolve)(right).toLowerCase() : (0, path_1.resolve)(left) === (0, path_1.resolve)(right);
const sameFile = (left, right) => left.dev === right.dev && left.ino === right.ino;
const containsPath = (parent, child) => {
    const rel = (0, path_1.relative)(parent, child);
    return rel === "" || (!rel.startsWith(`..${path_1.sep}`) && rel !== ".." && !(0, path_1.isAbsolute)(rel));
};
function sanitizedFailure(error) {
    return (error instanceof Error ? error.message : String(error))
        .replace(/[\u0000-\u001f\u007f]+/g, " ")
        .replace(/https?:\/\/\S+/gi, "[remote-url]")
        .replace(/[A-Za-z]:\\[^\s]+/g, "[local-path]")
        .replace(/\s+/g, " ").trim().slice(0, leader_supported_remote_preflight_contract_1.CHARACTER_LEADER_SUPPORTED_REMOTE_PREFLIGHT_MAX_FAILURE_LENGTH)
        || "K59 read failed";
}
function assertCheckedAt(value) {
    if (!CHECKED_AT.test(value) || Number.isNaN(Date.parse(value)) || new Date(value).toISOString() !== value) {
        throw new Error("K59 requires an explicit canonical UTC checkedAt");
    }
}
function artifactFingerprint(artifacts) {
    const digest = (0, crypto_1.createHash)("sha256");
    for (const [name, bytes] of [
        ["candidate", artifacts.candidateManifestBytes], ["plan", artifacts.planBytes],
        ["receipt", artifacts.receiptBytes], ["marker", artifacts.markerBytes],
    ]) {
        digest.update(`${name}:${bytes.length}:`);
        digest.update(bytes);
        digest.update("\0");
    }
    return digest.digest("hex");
}
function validateSource(result) {
    if (!result || result.sourceBoundValidation !== "GO" || !Number.isSafeInteger(result.k55ValidationProcessPeakRssBytes)
        || result.k55ValidationProcessPeakRssBytes <= 0
        || result.k55ValidationProcessPeakRssBytes >= leader_supported_remote_preflight_contract_1.CHARACTER_LEADER_SUPPORTED_REMOTE_PREFLIGHT_RSS_LIMIT_BYTES) {
        throw new Error("K59 requires K58 source-bound GO with bounded K55 peak");
    }
    const artifacts = result.artifacts;
    (0, leader_supported_publisher_dry_run_1.assertCharacterLeaderSupportedPublisherDryRunArtifacts)(artifacts);
    const plan = artifacts.plan;
    if (plan.readiness.dryRun !== "GO" || plan.readiness.sourceBoundValidation !== "GO"
        || plan.readiness.remotePreflight !== "NOT_EXECUTED" || plan.readiness.publication !== "NO-GO"
        || plan.readiness.r2Mutation !== "NO-GO" || plan.namespace !== leader_supported_publisher_dry_run_contract_1.CHARACTER_LEADER_SUPPORTED_PUBLISHER_NAMESPACE
        || plan.immutableObjects.length !== 4
        || json(plan.immutableObjects.map(object => object.kind)) !== json(["payload", "coverage", "validation", "manifest"])
        || !HASH.test(plan.source.rawIdentity.sha256) || !Number.isSafeInteger(plan.source.rawIdentity.sizeBytes)
        || plan.source.rawIdentity.sizeBytes <= 0 || plan.source.rawIdentity.persistedOrRemoteObject !== false
        || plan.mutableManifest.objectKey !== leader_supported_publisher_dry_run_contract_1.CHARACTER_LEADER_SUPPORTED_PUBLISHER_MANIFEST_KEY
        || plan.mutableManifest.candidateSha256 !== hash(artifacts.candidateManifestBytes)
        || plan.mutableManifest.candidateSizeBytes !== artifacts.candidateManifestBytes.length) {
        throw new Error("K59 K58 source plan boundary rejected");
    }
    for (let index = 0; index < 4; index++) {
        const object = plan.immutableObjects[index];
        if (!HASH.test(object.sha256) || !Number.isSafeInteger(object.sizeBytes) || object.sizeBytes <= 0
            || object.objectKey !== `${leader_supported_publisher_dry_run_contract_1.CHARACTER_LEADER_SUPPORTED_PUBLISHER_NAMESPACE}/objects/sha256/${object.sha256}/${object.sourceFileName}`
            || object.remotePreflight !== "NOT_EXECUTED" || object.action !== "NOT_EXECUTED") {
            throw new Error("K59 exact K56 immutable identity rejected");
        }
    }
    return { artifacts, fingerprint: artifactFingerprint(artifacts), k55Peak: result.k55ValidationProcessPeakRssBytes };
}
async function sourceRead(options) {
    const result = await (0, leader_supported_publisher_dry_run_1.validateCharacterLeaderSupportedPublisherDryRunArtifact)({
        artifactRoot: options.k58Root, k56Root: options.k56Root,
        sidecarRoot: options.sidecarRoot, productionRoot: options.productionRoot, fyiRoot: options.fyiRoot,
        k43Root: options.k43Root, k46Root: options.k46Root, k48Root: options.k48Root,
        nativeRuntime: options.nativeRuntime, database: options.database,
    });
    return validateSource(result);
}
function createAggregateCounter() {
    return {
        bytesRead: 0,
        consume(bytes) {
            if (!Number.isSafeInteger(bytes) || bytes < 0)
                throw new Error("K59 response byte count rejected");
            this.bytesRead += bytes;
            if (!Number.isSafeInteger(this.bytesRead)
                || this.bytesRead >= leader_supported_remote_preflight_contract_1.CHARACTER_LEADER_SUPPORTED_REMOTE_PREFLIGHT_AGGREGATE_LIMIT_BYTES) {
                throw new Error("K59 aggregate response byte limit reached");
            }
        },
    };
}
function allowedKey(key) {
    return key === leader_supported_publisher_dry_run_contract_1.CHARACTER_LEADER_SUPPORTED_PUBLISHER_MANIFEST_KEY
        || /^database-characters\/leader-supported\/v1\/objects\/sha256\/[a-f0-9]{64}\/database-characters-k56-leader-supported-projection(?:\.[a-f0-9]{64}\.json\.gz|-coverage\.json|-validation\.json|-manifest\.json)$/.test(key);
}
function header(value) {
    return Array.isArray(value) ? value.join(",") : value;
}
function readRemote(key, aggregate) {
    return new Promise((resolvePromise, rejectPromise) => {
        if (!allowedKey(key)) {
            rejectPromise(new Error("K59 remote key rejected"));
            return;
        }
        const url = new URL(key.split("/").map(encodeURIComponent).join("/"), leader_supported_remote_preflight_contract_1.CHARACTER_LEADER_SUPPORTED_REMOTE_PREFLIGHT_PUBLIC_BASE_URL);
        let settled = false;
        let deadline;
        const rejectOnce = (error) => {
            if (settled)
                return;
            settled = true;
            if (deadline)
                clearTimeout(deadline);
            rejectPromise(error);
        };
        const request = (0, https_1.request)(url, {
            method: "GET",
            headers: { Accept: "application/octet-stream, application/json", "Accept-Encoding": "identity" },
        }, (response) => {
            const statusCode = response.statusCode ?? 0;
            if (statusCode >= 300 && statusCode < 400) {
                response.resume();
                rejectOnce(new Error(`K59 redirect blocked (${statusCode})`));
                return;
            }
            if (statusCode !== 200 && statusCode !== 404) {
                response.resume();
                rejectOnce(new Error(`K59 unexpected HTTP status ${statusCode}`));
                return;
            }
            const encoding = header(response.headers["content-encoding"]);
            if (encoding !== undefined && encoding.toLowerCase() !== "identity") {
                response.resume();
                rejectOnce(new Error("K59 non-identity content encoding blocked"));
                return;
            }
            const contentLength = header(response.headers["content-length"]);
            if (contentLength !== undefined && (!/^\d+$/.test(contentLength)
                || Number(contentLength) >= leader_supported_remote_preflight_contract_1.CHARACTER_LEADER_SUPPORTED_REMOTE_PREFLIGHT_RESPONSE_LIMIT_BYTES)) {
                response.resume();
                rejectOnce(new Error("K59 response byte limit reached"));
                return;
            }
            const chunks = [];
            let bytes = 0;
            response.on("data", (chunkValue) => {
                if (settled)
                    return;
                const chunk = Buffer.isBuffer(chunkValue) ? chunkValue : Buffer.from(chunkValue);
                bytes += chunk.length;
                try {
                    if (bytes >= leader_supported_remote_preflight_contract_1.CHARACTER_LEADER_SUPPORTED_REMOTE_PREFLIGHT_RESPONSE_LIMIT_BYTES) {
                        throw new Error("K59 response byte limit reached");
                    }
                    aggregate.consume(chunk.length);
                    chunks.push(chunk);
                }
                catch (error) {
                    response.destroy();
                    rejectOnce(error instanceof Error ? error : new Error("K59 bounded response failed"));
                }
            });
            response.on("end", () => {
                if (settled)
                    return;
                settled = true;
                if (deadline)
                    clearTimeout(deadline);
                resolvePromise({
                    statusCode, bytes: Buffer.concat(chunks), contentType: header(response.headers["content-type"]),
                    cacheControl: header(response.headers["cache-control"]), etag: header(response.headers.etag),
                });
            });
            response.on("error", () => rejectOnce(new Error("K59 HTTPS response failed")));
            response.on("aborted", () => rejectOnce(new Error("K59 HTTPS response aborted")));
        });
        request.setTimeout(leader_supported_remote_preflight_contract_1.CHARACTER_LEADER_SUPPORTED_REMOTE_PREFLIGHT_REQUEST_TIMEOUT_MS, () => request.destroy(new Error("K59 HTTPS request timeout")));
        deadline = setTimeout(() => request.destroy(new Error("K59 HTTPS request timeout")), leader_supported_remote_preflight_contract_1.CHARACTER_LEADER_SUPPORTED_REMOTE_PREFLIGHT_REQUEST_TIMEOUT_MS);
        deadline.unref();
        request.on("error", (error) => rejectOnce(error.message.includes("timeout")
            ? new Error("K59 HTTPS request timeout") : new Error("K59 HTTPS request failed")));
        request.end();
    });
}
async function inspectImmutable(object, aggregate) {
    const base = {
        order: object.order, kind: object.kind, objectKey: object.objectKey,
        expectedSha256: object.sha256, expectedSizeBytes: object.sizeBytes,
        expectedContentType: object.contentType, expectedCacheControl: object.cacheControl,
    };
    try {
        const remote = await readRemote(object.objectKey, aggregate);
        if (remote.statusCode === 404) {
            return { ...base, status: "missing", futureAction: "create_if_absent", futurePrecondition: "If-None-Match: *" };
        }
        const actualSha256 = hash(remote.bytes);
        const matching = actualSha256 === object.sha256 && remote.bytes.length === object.sizeBytes
            && remote.contentType === object.contentType && remote.cacheControl === object.cacheControl;
        return {
            ...base, status: matching ? "matching" : "conflict", actualSha256, actualSizeBytes: remote.bytes.length,
            observedContentType: remote.contentType, observedCacheControl: remote.cacheControl,
            futureAction: matching ? "verified_reuse" : "BLOCKED",
            futurePrecondition: matching ? "NO_WRITE_VERIFIED_REUSE" : "BLOCKED",
            ...(matching ? {} : { failure: "K59 immutable byte or metadata mismatch" }),
        };
    }
    catch (error) {
        return { ...base, status: "failed", futureAction: "BLOCKED", futurePrecondition: "BLOCKED", failure: sanitizedFailure(error) };
    }
}
function validEtag(value) {
    return typeof value === "string" && value.length <= 256 && /^"[\x21\x23-\x7e\x80-\xff]+"$/.test(value);
}
async function inspectManifest(source, aggregate) {
    const bytes = source.artifacts.candidateManifestBytes;
    const base = {
        objectKey: leader_supported_publisher_dry_run_contract_1.CHARACTER_LEADER_SUPPORTED_PUBLISHER_MANIFEST_KEY,
        expectedSha256: hash(bytes), expectedSizeBytes: bytes.length,
        unconditionalWrite: "FORBIDDEN", delete: "FORBIDDEN",
    };
    try {
        const remote = await readRemote(leader_supported_publisher_dry_run_contract_1.CHARACTER_LEADER_SUPPORTED_PUBLISHER_MANIFEST_KEY, aggregate);
        if (remote.statusCode === 404) {
            return { ...base, status: "missing", futureAction: "create_if_absent", futurePrecondition: "If-None-Match: *" };
        }
        if (remote.contentType !== "application/json" || remote.cacheControl !== "no-store") {
            throw new Error("K59 mutable manifest metadata mismatch");
        }
        const actualSha256 = hash(remote.bytes);
        if (actualSha256 === base.expectedSha256 && remote.bytes.length === base.expectedSizeBytes) {
            return {
                ...base, status: "matching", actualSha256, actualSizeBytes: remote.bytes.length,
                observedContentType: remote.contentType, observedCacheControl: remote.cacheControl,
                futureAction: "no_op_already_current", futurePrecondition: "NO_WRITE_ALREADY_CURRENT",
            };
        }
        if (!validEtag(remote.etag))
            throw new Error("K59 different mutable manifest requires a fresh nonempty HTTP ETag");
        return {
            ...base, status: "different", actualSha256, actualSizeBytes: remote.bytes.length,
            observedContentType: remote.contentType, observedCacheControl: remote.cacheControl, observedEtag: remote.etag,
            futureAction: "replace_if_match", futurePrecondition: "If-Match: OBSERVED_FRESH_ETAG",
        };
    }
    catch (error) {
        return { ...base, status: "failed", futureAction: "BLOCKED", futurePrecondition: "BLOCKED", failure: sanitizedFailure(error) };
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
        throw new Error("K59 local Wrangler entrypoint unavailable");
    return found;
}
function conservativeBucketUpperBound(reported) {
    if (typeof reported === "number") {
        if (!Number.isSafeInteger(reported) || reported < 0 || reported === Number.MAX_SAFE_INTEGER)
            throw new Error("K59 Wrangler bucket size rejected");
        return { reported: String(reported), conservativeUpperBoundBytes: reported + 1 };
    }
    if (typeof reported !== "string")
        throw new Error("K59 Wrangler bucket size missing");
    const match = /^\s*(\d+(?:\.\d+)?)\s*(B|kB|MB|GB|TB)\s*$/.exec(reported);
    if (!match)
        throw new Error("K59 Wrangler bucket size format rejected");
    const units = { B: 1, kB: 1000, MB: 1000000, GB: 1000000000, TB: 1000000000000 };
    const decimals = match[1].split(".")[1]?.length ?? 0;
    const upper = Math.ceil((Number(match[1]) + 10 ** -decimals) * units[match[2]]);
    if (!Number.isSafeInteger(upper) || upper < 0)
        throw new Error("K59 Wrangler bucket size range rejected");
    return { reported, conservativeUpperBoundBytes: upper };
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
        (0, child_process_1.execFile)(process.execPath, [entrypoint, "r2", "bucket", "info", leader_supported_remote_preflight_contract_1.CHARACTER_LEADER_SUPPORTED_REMOTE_PREFLIGHT_BUCKET, "--json"], {
            encoding: "utf8", timeout: leader_supported_remote_preflight_contract_1.CHARACTER_LEADER_SUPPORTED_REMOTE_PREFLIGHT_BUCKET_TIMEOUT_MS,
            maxBuffer: leader_supported_remote_preflight_contract_1.CHARACTER_LEADER_SUPPORTED_REMOTE_PREFLIGHT_BUCKET_MAX_BUFFER_BYTES,
            killSignal: "SIGKILL", windowsHide: true, shell: false,
        }, (error, stdout, stderr) => {
            if (error || stderr) {
                resolvePromise({ status: "failed", failure: "K59 Wrangler bucket info failed" });
                return;
            }
            try {
                const parsed = JSON.parse(stdout);
                resolvePromise({ status: "known", ...conservativeBucketUpperBound(parsed.bucket_size) });
            }
            catch (parseError) {
                resolvePromise({ status: "failed", failure: sanitizedFailure(parseError) });
            }
        });
    });
}
async function inspectRoot(value, label) {
    const path = (0, path_1.resolve)(value), before = await (0, promises_1.lstat)(path);
    if (!before.isDirectory() || before.isSymbolicLink())
        throw new Error(`K59 ${label} must be a regular non-link directory`);
    const canonical = await (0, promises_1.realpath)(path), after = await (0, promises_1.lstat)(path);
    if (!samePath(path, canonical) || !sameFile(before, after) || after.isSymbolicLink())
        throw new Error(`K59 ${label} link, junction or drift rejected`);
    return { path, realPath: canonical, dev: after.dev, ino: after.ino };
}
async function checkpoint(root) {
    const actual = await inspectRoot(root.path, "output root");
    if (actual.dev !== root.dev || actual.ino !== root.ino || !samePath(actual.realPath, root.realPath))
        throw new Error("K59 output root identity changed");
}
async function rejectExistingReport(root) {
    const path = (0, path_1.join)(root.path, leader_supported_remote_preflight_contract_1.CHARACTER_LEADER_SUPPORTED_REMOTE_PREFLIGHT_REPORT_FILE);
    try {
        const metadata = await (0, promises_1.lstat)(path);
        if (!metadata.isFile() || metadata.isSymbolicLink() || metadata.nlink !== 1 || !samePath(path, await (0, promises_1.realpath)(path))) {
            throw new Error("K59 existing report link or hardlink rejected");
        }
        throw new Error("K59 create-only report already exists");
    }
    catch (error) {
        if (error?.code !== "ENOENT")
            throw error;
    }
}
async function persistReport(root, report) {
    const bytes = jsonBytes(report);
    if (bytes.length >= leader_supported_remote_preflight_contract_1.CHARACTER_LEADER_SUPPORTED_REMOTE_PREFLIGHT_REPORT_LIMIT_BYTES)
        throw new Error("K59 report byte limit reached");
    await checkpoint(root);
    await rejectExistingReport(root);
    const path = (0, path_1.join)(root.path, leader_supported_remote_preflight_contract_1.CHARACTER_LEADER_SUPPORTED_REMOTE_PREFLIGHT_REPORT_FILE);
    const handle = await (0, promises_1.open)(path, fs_1.constants.O_CREAT | fs_1.constants.O_EXCL | fs_1.constants.O_WRONLY | (fs_1.constants.O_NOFOLLOW ?? 0), 0o600);
    try {
        await handle.writeFile(bytes);
        await handle.sync();
        const metadata = await handle.stat();
        if (!metadata.isFile() || metadata.nlink !== 1 || metadata.size !== bytes.length)
            throw new Error("K59 created report identity rejected");
    }
    finally {
        await handle.close();
    }
    const before = await (0, promises_1.lstat)(path);
    if (!before.isFile() || before.isSymbolicLink() || before.nlink !== 1 || !samePath(path, await (0, promises_1.realpath)(path))) {
        throw new Error("K59 report identity rejected after create");
    }
    const readHandle = await (0, promises_1.open)(path, fs_1.constants.O_RDONLY | (fs_1.constants.O_NOFOLLOW ?? 0));
    try {
        const opened = await readHandle.stat(), reopened = await readHandle.readFile(), after = await readHandle.stat();
        if (!sameFile(before, opened) || !sameFile(opened, after) || after.nlink !== 1 || !reopened.equals(bytes)) {
            throw new Error("K59 report changed while reopening");
        }
    }
    finally {
        await readHandle.close();
    }
    await checkpoint(root);
    return { reportPath: path, reportSha256: hash(bytes) };
}
class RssGuard {
    peak = Math.max(process.memoryUsage().rss, process.resourceUsage().maxRSS * 1024);
    exceeded = false;
    timer = setInterval(() => this.observe(), 10);
    constructor() { this.timer.unref(); }
    observe() { this.peak = Math.max(this.peak, process.memoryUsage().rss, process.resourceUsage().maxRSS * 1024); this.exceeded ||= this.peak >= leader_supported_remote_preflight_contract_1.CHARACTER_LEADER_SUPPORTED_REMOTE_PREFLIGHT_RSS_LIMIT_BYTES; }
    sample(reserve = 0) {
        this.observe();
        if (this.exceeded || this.peak + reserve >= leader_supported_remote_preflight_contract_1.CHARACTER_LEADER_SUPPORTED_REMOTE_PREFLIGHT_RSS_LIMIT_BYTES)
            throw new Error(`K59 parent per-process RSS limit reached: ${this.peak}`);
    }
    stop() { clearInterval(this.timer); this.sample(); return this.peak; }
    dispose() { clearInterval(this.timer); }
}
async function runCharacterLeaderSupportedRemotePreflight(options) {
    const rss = new RssGuard();
    try {
        if (options?.optIn !== true)
            throw new Error("K59 requires exact --opt-in-k59");
        if (options.remoteReadOnly !== true)
            throw new Error("K59 requires exact --remote-read-only");
        if (!options.k56Root || !options.k58Root || !options.outputRoot)
            throw new Error("K59 requires explicit K56, K58 and output roots");
        if (typeof global.gc !== "function")
            throw new Error("K59 requires Node --expose-gc");
        assertCheckedAt(options.checkedAt);
        const output = await inspectRoot(options.outputRoot, "output root");
        for (const [label, path] of [
            ["sidecar root", options.sidecarRoot], ["production root", options.productionRoot], ["FYI root", options.fyiRoot],
            ["K43 root", options.k43Root], ["K46 root", options.k46Root], ["K48 root", options.k48Root],
            ["K56 root", options.k56Root], ["K58 root", options.k58Root],
        ]) {
            const source = await inspectRoot(path, label);
            if (containsPath(output.realPath, source.realPath) || containsPath(source.realPath, output.realPath)) {
                throw new Error(`K59 output root must be separate from ${label}`);
            }
        }
        for (const [label, path] of [["native runtime", options.nativeRuntime], ["database", options.database]]) {
            const metadata = await (0, promises_1.lstat)((0, path_1.resolve)(path)), canonical = await (0, promises_1.realpath)((0, path_1.resolve)(path));
            if (!metadata.isFile() || metadata.isSymbolicLink() || metadata.nlink !== 1
                || containsPath(output.realPath, canonical))
                throw new Error(`K59 output root must be separate from regular single-link ${label}`);
        }
        await rejectExistingReport(output);
        const observedSequence = [];
        const before = await sourceRead(options);
        observedSequence.push("source-before");
        rss.sample(leader_supported_remote_preflight_contract_1.CHARACTER_LEADER_SUPPORTED_REMOTE_PREFLIGHT_AGGREGATE_LIMIT_BYTES
            + leader_supported_remote_preflight_contract_1.CHARACTER_LEADER_SUPPORTED_REMOTE_PREFLIGHT_REPORT_LIMIT_BYTES * 4);
        const aggregate = createAggregateCounter();
        const objects = [];
        for (const object of before.artifacts.plan.immutableObjects) {
            observedSequence.push(`get:${object.objectKey}`);
            objects.push(await inspectImmutable(object, aggregate));
        }
        observedSequence.push(`get:${leader_supported_publisher_dry_run_contract_1.CHARACTER_LEADER_SUPPORTED_PUBLISHER_MANIFEST_KEY}`);
        const manifest = await inspectManifest(before, aggregate);
        observedSequence.push("bucket");
        const bucketUsage = await readBucketUsage();
        const after = await sourceRead(options);
        observedSequence.push("source-after");
        rss.sample(leader_supported_remote_preflight_contract_1.CHARACTER_LEADER_SUPPORTED_REMOTE_PREFLIGHT_REPORT_LIMIT_BYTES * 4);
        if (before.fingerprint !== after.fingerprint)
            throw new Error("K59 K58 source drifted during remote reads");
        const summary = objects.reduce((value, object) => { value[object.status]++; return value; }, { matching: 0, missing: 0, conflict: 0, failed: 0, total: 4 });
        const missingImmutableBytes = objects.filter(object => object.status === "missing")
            .reduce((sum, object) => sum + object.expectedSizeBytes, 0);
        const candidateReservation = before.artifacts.candidateManifestBytes.length;
        const prospectiveAdditionalBytes = missingImmutableBytes + candidateReservation;
        const bucketUpper = bucketUsage.status === "known" ? bucketUsage.conservativeUpperBoundBytes : "UNKNOWN";
        const projectedValue = bucketUpper === "UNKNOWN" ? undefined : bucketUpper + prospectiveAdditionalBytes;
        const projected = projectedValue === undefined || !Number.isSafeInteger(projectedValue) ? "UNKNOWN" : projectedValue;
        const within = projected === "UNKNOWN" ? "UNKNOWN" : projected < leader_supported_remote_preflight_contract_1.CHARACTER_LEADER_SUPPORTED_REMOTE_PREFLIGHT_BUCKET_CEILING_BYTES;
        const noReadFailure = summary.failed === 0 && manifest.status !== "failed";
        const noConflict = summary.conflict === 0;
        const manifestSafe = manifest.status === "matching" || manifest.status === "missing" || manifest.status === "different";
        const exactSequence = json(observedSequence) === json([
            "source-before", ...before.artifacts.plan.immutableObjects.map(object => `get:${object.objectKey}`),
            `get:${leader_supported_publisher_dry_run_contract_1.CHARACTER_LEADER_SUPPORTED_PUBLISHER_MANIFEST_KEY}`, "bucket", "source-after",
        ]);
        const go = exactSequence && objects.length === 4 && noReadFailure && noConflict && manifestSafe
            && bucketUsage.status === "known" && within === true;
        const report = {
            schemaVersion: 1, contract: "dokkan-database-character-leader-supported-remote-preflight",
            contractVersion: leader_supported_remote_preflight_contract_1.CHARACTER_LEADER_SUPPORTED_REMOTE_PREFLIGHT_CONTRACT_VERSION,
            checkedAt: options.checkedAt, mode: "explicit_opt_in_public_http_and_bucket_read_only",
            remote: {
                publicBaseUrl: leader_supported_remote_preflight_contract_1.CHARACTER_LEADER_SUPPORTED_REMOTE_PREFLIGHT_PUBLIC_BASE_URL,
                bucket: leader_supported_remote_preflight_contract_1.CHARACTER_LEADER_SUPPORTED_REMOTE_PREFLIGHT_BUCKET, exactGetCount: 5, method: "GET",
                redirects: "BLOCKED", acceptEncoding: "identity", requestTimeoutMs: leader_supported_remote_preflight_contract_1.CHARACTER_LEADER_SUPPORTED_REMOTE_PREFLIGHT_REQUEST_TIMEOUT_MS,
                bucketCommand: "r2 bucket info dokkanpanion-data --json", bucketTimeoutMs: leader_supported_remote_preflight_contract_1.CHARACTER_LEADER_SUPPORTED_REMOTE_PREFLIGHT_BUCKET_TIMEOUT_MS,
                bucketMaxBufferBytes: leader_supported_remote_preflight_contract_1.CHARACTER_LEADER_SUPPORTED_REMOTE_PREFLIGHT_BUCKET_MAX_BUFFER_BYTES,
            },
            source: {
                candidateManifestSha256: hash(before.artifacts.candidateManifestBytes), candidateManifestSizeBytes: before.artifacts.candidateManifestBytes.length,
                planSha256: hash(before.artifacts.planBytes), planSizeBytes: before.artifacts.planBytes.length,
                receiptSha256: hash(before.artifacts.receiptBytes), receiptSizeBytes: before.artifacts.receiptBytes.length,
                markerSha256: hash(before.artifacts.markerBytes), markerSizeBytes: before.artifacts.markerBytes.length,
                fullArtifactFingerprintSha256: before.artifacts.plan.source.fullArtifactFingerprintSha256,
                lineageFingerprintSha256: before.artifacts.plan.source.lineageFingerprintSha256,
                sourceBoundBeforeReads: "GO", sourceBoundAfterReads: "GO", sourceUnchanged: true,
            },
            objects, objectSummary: summary, manifest, bucketUsage,
            budget: {
                responseLimitBytesExclusive: leader_supported_remote_preflight_contract_1.CHARACTER_LEADER_SUPPORTED_REMOTE_PREFLIGHT_RESPONSE_LIMIT_BYTES,
                aggregateLimitBytesExclusive: leader_supported_remote_preflight_contract_1.CHARACTER_LEADER_SUPPORTED_REMOTE_PREFLIGHT_AGGREGATE_LIMIT_BYTES,
                bytesRead: aggregate.bytesRead, missingImmutableBytes, candidateManifestReservationBytes: candidateReservation,
                prospectiveAdditionalBytes, bucketCeilingBytesExclusive: leader_supported_remote_preflight_contract_1.CHARACTER_LEADER_SUPPORTED_REMOTE_PREFLIGHT_BUCKET_CEILING_BYTES,
                bucketConservativeUpperBoundBytes: bucketUpper, projectedBucketUpperBoundBytes: projected, withinBucketCeiling: within,
            },
            checks: {
                exactFiveOrderedGets: exactSequence, everyImmutableInspected: objects.length === 4, noImmutableConflict: noConflict,
                noReadFailure, mutableManifestSafe: manifestSafe, bucketUsageKnown: bucketUsage.status === "known",
                projectedBucketStrictlyBelowCeiling: within === true, sourceRevalidatedAfterAllReads: true,
                noRemoteMutation: true, noUnconditionalWriteModel: true, callerControlledStableOutputRootRequired: true,
                concurrentSameUserOutputAncestorReplacementProtected: false,
                perProcessRssUnder1GiB: true, processTreeRssUnder1GiB: false,
            },
            readiness: {
                remotePreflight: go ? "GO" : "NO-GO", publication: "NO-GO", r2Mutation: "NO-GO",
                authority: "NO-GO", production: "NO-GO", android: "NO-GO",
                perProcessRssUnder1GiB: "GO", processTreeRssUnder1GiB: "NO-GO",
                concurrentOutputAncestorReplacement: "NO-GO",
            },
        };
        const persisted = await persistReport(output, report);
        const parentPeak = rss.stop();
        const maximumIndividualProcessPeakRssBytes = Math.max(before.k55Peak, after.k55Peak, parentPeak);
        return {
            ...persisted, report, rssAccountingScope: "per_process_not_process_tree",
            k55BeforeProcessPeakRssBytes: before.k55Peak, k55AfterProcessPeakRssBytes: after.k55Peak,
            k59ParentProcessPeakRssBytes: parentPeak, maximumIndividualProcessPeakRssBytes,
        };
    }
    finally {
        rss.dispose();
    }
}
exports.runCharacterLeaderSupportedRemotePreflight = runCharacterLeaderSupportedRemotePreflight;
//# sourceMappingURL=leader-supported-remote-preflight.js.map