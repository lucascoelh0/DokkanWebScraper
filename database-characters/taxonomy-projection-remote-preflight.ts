import { execFile } from "child_process";
import { createHash } from "crypto";
import { constants, existsSync, Stats } from "fs";
import { lstat, mkdir, open, readdir, realpath } from "fs/promises";
import { request as httpsRequest } from "https";
import { isAbsolute, join, relative, resolve, sep } from "path";
import {
    TAXONOMY_PROJECTION_DELIVERY_NAMESPACE,
} from "./taxonomy-projection-delivery-contract";
import {
    TAXONOMY_PROJECTION_OBJECT_PLAN_BUCKET_CEILING_BYTES,
    TAXONOMY_PROJECTION_OBJECT_PLAN_MANIFEST_RESERVATION_BYTES,
    TAXONOMY_PROJECTION_OBJECT_PLAN_NAMESPACE_MAX_BYTES,
    TAXONOMY_PROJECTION_REMOTE_MANIFEST_KEY,
    TAXONOMY_PROJECTION_REMOTE_NAMESPACE,
    TaxonomyProjectionRemoteObject,
} from "./taxonomy-projection-object-plan-contract";
import {
    TaxonomyProjectionObjectPlanReadOptions,
    ValidatedTaxonomyProjectionObjectPlan,
    readValidatedTaxonomyProjectionObjectPlan,
} from "./taxonomy-projection-object-plan";
import {
    TAXONOMY_PROJECTION_REMOTE_PREFLIGHT_BUCKET,
    TAXONOMY_PROJECTION_REMOTE_PREFLIGHT_BUCKET_MAX_BUFFER_BYTES,
    TAXONOMY_PROJECTION_REMOTE_PREFLIGHT_BUCKET_TIMEOUT_MS,
    TAXONOMY_PROJECTION_REMOTE_PREFLIGHT_CONCURRENCY,
    TAXONOMY_PROJECTION_REMOTE_PREFLIGHT_CONTRACT_VERSION,
    TAXONOMY_PROJECTION_REMOTE_PREFLIGHT_MAX_AGGREGATE_BYTES,
    TAXONOMY_PROJECTION_REMOTE_PREFLIGHT_MAX_ERROR_LENGTH,
    TAXONOMY_PROJECTION_REMOTE_PREFLIGHT_MAX_FAILURE_LENGTH,
    TAXONOMY_PROJECTION_REMOTE_PREFLIGHT_MAX_REPORT_BYTES,
    TAXONOMY_PROJECTION_REMOTE_PREFLIGHT_MAX_RESPONSE_BYTES,
    TAXONOMY_PROJECTION_REMOTE_PREFLIGHT_NAMESPACE,
    TAXONOMY_PROJECTION_REMOTE_PREFLIGHT_PUBLIC_BASE_URL,
    TAXONOMY_PROJECTION_REMOTE_PREFLIGHT_REPORT_FILE,
    TAXONOMY_PROJECTION_REMOTE_PREFLIGHT_REQUEST_TIMEOUT_MS,
    TAXONOMY_PROJECTION_REMOTE_PREFLIGHT_RSS_LIMIT_BYTES,
    TAXONOMY_PROJECTION_REMOTE_PREFLIGHT_RSS_REMOTE_RESERVE_BYTES,
    TAXONOMY_PROJECTION_REMOTE_PREFLIGHT_RSS_REPORT_RESERVE_BYTES,
    TAXONOMY_PROJECTION_REMOTE_PREFLIGHT_SCHEMA_VERSION,
    TaxonomyProjectionBucketUsageObservation,
    TaxonomyProjectionRemoteManifestObservation,
    TaxonomyProjectionRemoteObjectObservation,
    TaxonomyProjectionRemotePreflightReport,
} from "./taxonomy-projection-remote-preflight-contract";
import { TAXONOMY_PROJECTION_FILES } from "./taxonomy-projection-contract";

export interface TaxonomyProjectionRemotePreflightRunOptions {
    optInK38: true;
    remoteReadOnly: true;
    k37OutputRoot: string;
    k37PlanId: string;
    k36OutputRoot: string;
    k36ReleaseId: string;
    k32Root: string;
    k2Root: string;
    productiveRoot: string;
    sqliteRoot: string;
    db1Root: string;
    elfRoot: string;
    nativeEvidenceRoot: string;
    outputRoot: string;
    checkedAt: string;
}

export interface TaxonomyProjectionRemotePreflightRunResult {
    reportDirectory: string;
    reportPath: string;
    reportSha256: string;
    report: TaxonomyProjectionRemotePreflightReport;
}

interface DirectoryIdentity { path: string; realPath: string; dev: number; ino: number }
interface RemoteReadResult { statusCode: 200 | 404; bytes: Buffer }
interface AggregateCounter { bytesRead: number; consume(count: number): void }
interface SourceSnapshot {
    validated: ValidatedTaxonomyProjectionObjectPlan;
    fingerprint: string;
    planBytes: Buffer;
    manifestCandidateBytes: Buffer;
    receiptBytes: Buffer;
    markerBytes: Buffer;
    namespacePlanStrictlyWithinLimit: boolean;
}

const ID = /^[a-f0-9]{64}$/;
const HASH = /^[a-f0-9]{64}$/;
const CHECKED_AT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const PAYLOAD_NAME = /^database-characters-k35-taxonomy-projection\.[a-f0-9]{64}\.json\.gz$/;
const EXPECTED_KINDS = ["payload", "coverage", "validation", "manifest"] as const;
const hash = (value: Buffer | string): string => createHash("sha256").update(value).digest("hex");
const jsonBytes = (value: unknown): Buffer => Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8");
const samePath = (left: string, right: string): boolean => process.platform === "win32"
    ? resolve(left).toLowerCase() === resolve(right).toLowerCase()
    : resolve(left) === resolve(right);
const sameFile = (left: Stats, right: Stats): boolean => left.dev === right.dev && left.ino === right.ino;

class RssGuard {
    private peak = Math.max(process.memoryUsage().rss, process.resourceUsage().maxRSS * 1024);
    private exceeded = false;
    private readonly timer = setInterval(() => this.observe(), 10);
    constructor() { this.timer.unref(); }
    private observe(): void {
        this.peak = Math.max(this.peak, process.memoryUsage().rss, process.resourceUsage().maxRSS * 1024);
        this.exceeded ||= this.peak >= TAXONOMY_PROJECTION_REMOTE_PREFLIGHT_RSS_LIMIT_BYTES;
    }
    sample(nestedPeak = 0, reservedHeadroom = 0): number {
        this.observe();
        this.peak = Math.max(this.peak, nestedPeak);
        this.exceeded ||= this.peak >= TAXONOMY_PROJECTION_REMOTE_PREFLIGHT_RSS_LIMIT_BYTES
            || this.peak + reservedHeadroom >= TAXONOMY_PROJECTION_REMOTE_PREFLIGHT_RSS_LIMIT_BYTES;
        if (this.exceeded) throw new Error(`K38 RSS limit reached: ${this.peak}`);
        return this.peak;
    }
    stop(): number { clearInterval(this.timer); return this.sample(); }
    dispose(): void { clearInterval(this.timer); }
}

function boundedError(error: unknown): Error {
    const message = sanitizedFailure(error);
    return new Error(`K38 remote preflight failed: ${message}`.slice(0, TAXONOMY_PROJECTION_REMOTE_PREFLIGHT_MAX_ERROR_LENGTH));
}

function sanitizedFailure(error: unknown): string {
    const source = error instanceof Error ? error.message : String(error);
    return source
        .replace(/[\u0000-\u001f\u007f]+/g, " ")
        .replace(/https?:\/\/\S+/gi, "[remote-url]")
        .replace(/[A-Za-z]:\\[^\s]+/g, "[local-path]")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, TAXONOMY_PROJECTION_REMOTE_PREFLIGHT_MAX_FAILURE_LENGTH) || "K38 read failed";
}

function assertCheckedAt(value: string): void {
    if (!CHECKED_AT.test(value) || Number.isNaN(Date.parse(value)) || new Date(value).toISOString() !== value) {
        throw new Error("K38 requires an explicit canonical UTC checkedAt");
    }
}

function assertContained(parent: string, child: string): void {
    const remainder = relative(resolve(parent), resolve(child));
    if (!remainder || remainder === ".." || remainder.startsWith(`..${sep}`) || isAbsolute(remainder)) {
        throw new Error("K38 report path containment rejected");
    }
}

function isSameOrDescendant(parent: string, candidate: string): boolean {
    const remainder = relative(resolve(parent), resolve(candidate));
    return remainder === "" || (!remainder.startsWith(`..${sep}`) && remainder !== ".." && !isAbsolute(remainder));
}

function assertOutputSeparatedFromClosedSources(outputRoot: DirectoryIdentity, source: SourceSnapshot,
    options: TaxonomyProjectionRemotePreflightRunOptions): void {
    const closedSources = [
        source.validated.planDirectory,
        join(resolve(options.k36OutputRoot), TAXONOMY_PROJECTION_DELIVERY_NAMESPACE, options.k36ReleaseId),
    ];
    if (closedSources.some(sourcePath => isSameOrDescendant(sourcePath, outputRoot.path))) {
        throw new Error("K38 output root must not alias or descend from a closed K37/K36 source artifact");
    }
}

async function inspectDirectory(pathValue: string, label: string): Promise<DirectoryIdentity> {
    const path = resolve(pathValue);
    const before = await lstat(path);
    if (!before.isDirectory() || before.isSymbolicLink()) throw new Error(`K38 ${label} must be a regular directory`);
    const realPath = await realpath(path);
    if (!samePath(realPath, path)) throw new Error(`K38 ${label} link or junction rejected`);
    const after = await lstat(path);
    if (!after.isDirectory() || after.isSymbolicLink() || !sameFile(before, after)) {
        throw new Error(`K38 ${label} identity changed`);
    }
    return { path, realPath, dev: after.dev, ino: after.ino };
}

async function checkpoint(expected: DirectoryIdentity, label: string): Promise<void> {
    const actual = await inspectDirectory(expected.path, label);
    if (!samePath(actual.realPath, expected.realPath) || actual.dev !== expected.dev || actual.ino !== expected.ino) {
        throw new Error(`K38 ${label} identity changed`);
    }
}

function sourceReadOptions(options: TaxonomyProjectionRemotePreflightRunOptions): TaxonomyProjectionObjectPlanReadOptions {
    const roots = [options.k37OutputRoot, options.k36OutputRoot, options.k32Root, options.k2Root,
        options.productiveRoot, options.sqliteRoot, options.db1Root, options.elfRoot, options.nativeEvidenceRoot];
    if (roots.some(root => typeof root !== "string" || !root)
        || !ID.test(options.k37PlanId) || isAbsolute(options.k37PlanId)
        || !ID.test(options.k36ReleaseId) || isAbsolute(options.k36ReleaseId)) {
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

function expectedFileNames(objects: TaxonomyProjectionRemoteObject[]): string[] {
    return [objects[0]?.sourceFileName, TAXONOMY_PROJECTION_FILES.coverage,
        TAXONOMY_PROJECTION_FILES.validation, TAXONOMY_PROJECTION_FILES.manifest];
}

function validateSource(validated: ValidatedTaxonomyProjectionObjectPlan,
    options: TaxonomyProjectionRemotePreflightRunOptions): SourceSnapshot {
    const { plan, manifestCandidate } = validated;
    if (validated.sourceBoundK36Validation !== "GO" || validated.planId !== options.k37PlanId
        || plan.planId !== options.k37PlanId || plan.source.k36.releaseId !== options.k36ReleaseId
        || plan.remoteNamespace !== TAXONOMY_PROJECTION_REMOTE_NAMESPACE || plan.objects.length !== 4
        || JSON.stringify(plan.objects.map(object => object.kind)) !== JSON.stringify(EXPECTED_KINDS)) {
        throw new Error("K38 source-bound K37 identity or ordered inventory rejected");
    }
    const names = expectedFileNames(plan.objects);
    if (!PAYLOAD_NAME.test(names[0]) || new Set(names).size !== 4
        || JSON.stringify(plan.objects.map(object => object.sourceFileName)) !== JSON.stringify(names)) {
        throw new Error("K38 exact K35 file inventory rejected");
    }
    for (const object of plan.objects) {
        const exactKey = `${TAXONOMY_PROJECTION_REMOTE_NAMESPACE}/objects/sha256/${object.sha256}/${object.sourceFileName}`;
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
    if (plan.mutableManifest.objectKey !== TAXONOMY_PROJECTION_REMOTE_MANIFEST_KEY
        || plan.mutableManifest.cacheControl !== "no-store"
        || plan.mutableManifest.sha256 !== hash(manifestCandidateBytes)
        || plan.mutableManifest.sizeBytes !== manifestCandidateBytes.length
        || manifestCandidateBytes.length >= TAXONOMY_PROJECTION_REMOTE_PREFLIGHT_MAX_RESPONSE_BYTES) {
        throw new Error("K38 mutable manifest candidate contract rejected");
    }
    const immutableBytes = plan.objects.reduce((total, object) => total + object.sizeBytes, 0);
    const namespacePlanBytes = immutableBytes + TAXONOMY_PROJECTION_OBJECT_PLAN_MANIFEST_RESERVATION_BYTES;
    if (!Number.isSafeInteger(immutableBytes) || plan.budget.namespaceLimitBytes !== TAXONOMY_PROJECTION_OBJECT_PLAN_NAMESPACE_MAX_BYTES
        || plan.budget.immutableObjectBytes !== immutableBytes
        || plan.budget.mutableManifestReservationBytes !== TAXONOMY_PROJECTION_OBJECT_PLAN_MANIFEST_RESERVATION_BYTES
        || plan.budget.worstCaseNewBytes !== namespacePlanBytes || plan.budget.withinNamespaceLimit !== true
        || plan.budget.bucketCeilingBytes !== TAXONOMY_PROJECTION_OBJECT_PLAN_BUCKET_CEILING_BYTES) {
        throw new Error("K38 K37 conservative budget contract rejected");
    }
    const planBytes = jsonBytes(plan);
    const receiptBytes = jsonBytes(validated.receipt);
    const markerBytes = jsonBytes(validated.marker);
    const fingerprint = hash(Buffer.concat([planBytes, manifestCandidateBytes, receiptBytes, markerBytes]));
    return {
        validated, fingerprint, planBytes, manifestCandidateBytes, receiptBytes, markerBytes,
        namespacePlanStrictlyWithinLimit: namespacePlanBytes < TAXONOMY_PROJECTION_OBJECT_PLAN_NAMESPACE_MAX_BYTES,
    };
}

function createAggregateCounter(): AggregateCounter {
    return {
        bytesRead: 0,
        consume(count: number): void {
            if (!Number.isSafeInteger(count) || count < 0) throw new Error("K38 response byte count rejected");
            this.bytesRead += count;
            if (!Number.isSafeInteger(this.bytesRead)
                || this.bytesRead >= TAXONOMY_PROJECTION_REMOTE_PREFLIGHT_MAX_AGGREGATE_BYTES) {
                throw new Error("K38 aggregate response byte limit reached");
            }
        },
    };
}

function isAllowedRemoteKey(objectKey: string): boolean {
    return objectKey === TAXONOMY_PROJECTION_REMOTE_MANIFEST_KEY
        || /^database-characters\/taxonomy-projection\/v1\/objects\/sha256\/[a-f0-9]{64}\/database-characters-k35-taxonomy-projection(?:\.[a-f0-9]{64}\.json\.gz|-coverage\.json|-validation\.json|-manifest\.json)$/.test(objectKey);
}

function readRemoteObject(objectKey: string, aggregate: AggregateCounter): Promise<RemoteReadResult> {
    return new Promise((resolvePromise, rejectPromise) => {
        if (!isAllowedRemoteKey(objectKey)) {
            rejectPromise(new Error("K38 remote object key rejected"));
            return;
        }
        const encodedPath = objectKey.split("/").map(encodeURIComponent).join("/");
        const url = new URL(encodedPath, TAXONOMY_PROJECTION_REMOTE_PREFLIGHT_PUBLIC_BASE_URL);
        let settled = false;
        let deadline: NodeJS.Timeout | undefined;
        const rejectOnce = (error: Error) => {
            if (!settled) {
                settled = true;
                if (deadline) clearTimeout(deadline);
                rejectPromise(error);
            }
        };
        const request = httpsRequest(url, {
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
                || Number(contentLength) >= TAXONOMY_PROJECTION_REMOTE_PREFLIGHT_MAX_RESPONSE_BYTES)) {
                response.resume();
                rejectOnce(new Error("K38 response byte limit reached"));
                return;
            }
            const chunks: Buffer[] = [];
            let responseBytes = 0;
            response.on("data", chunkValue => {
                if (settled) return;
                const chunk = Buffer.isBuffer(chunkValue) ? chunkValue : Buffer.from(chunkValue);
                responseBytes += chunk.length;
                try {
                    if (responseBytes >= TAXONOMY_PROJECTION_REMOTE_PREFLIGHT_MAX_RESPONSE_BYTES) {
                        throw new Error("K38 response byte limit reached");
                    }
                    aggregate.consume(chunk.length);
                    chunks.push(chunk);
                } catch (error) {
                    response.destroy();
                    rejectOnce(error instanceof Error ? error : new Error("K38 bounded response read failed"));
                }
            });
            response.on("end", () => {
                if (!settled) {
                    settled = true;
                    if (deadline) clearTimeout(deadline);
                    resolvePromise({ statusCode, bytes: Buffer.concat(chunks) } as RemoteReadResult);
                }
            });
            response.on("error", () => rejectOnce(new Error("K38 HTTPS response failed")));
            response.on("aborted", () => rejectOnce(new Error("K38 HTTPS response aborted")));
        });
        request.setTimeout(TAXONOMY_PROJECTION_REMOTE_PREFLIGHT_REQUEST_TIMEOUT_MS,
            () => request.destroy(new Error("K38 HTTPS request timeout")));
        deadline = setTimeout(() => request.destroy(new Error("K38 HTTPS request timeout")),
            TAXONOMY_PROJECTION_REMOTE_PREFLIGHT_REQUEST_TIMEOUT_MS);
        deadline.unref();
        request.on("error", error => rejectOnce(error.message.includes("timeout")
            ? new Error("K38 HTTPS request timeout") : new Error("K38 HTTPS request failed")));
        request.end();
    });
}

async function mapConcurrent<T, R>(values: T[], concurrency: number,
    mapper: (value: T) => Promise<R>): Promise<R[]> {
    const output = new Array<R>(values.length);
    let next = 0;
    await Promise.all(Array.from({ length: Math.min(concurrency, values.length) }, async () => {
        while (true) {
            const index = next++;
            if (index >= values.length) return;
            output[index] = await mapper(values[index]);
        }
    }));
    return output;
}

async function inspectImmutableObject(object: TaxonomyProjectionRemoteObject,
    aggregate: AggregateCounter): Promise<TaxonomyProjectionRemoteObjectObservation> {
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
    } catch (error) {
        return { kind: object.kind, objectKey: object.objectKey, status: "failed",
            expectedSha256: object.sha256, expectedSizeBytes: object.sizeBytes, failure: sanitizedFailure(error) };
    }
}

async function inspectMutableManifest(source: SourceSnapshot,
    aggregate: AggregateCounter): Promise<TaxonomyProjectionRemoteManifestObservation> {
    const expectedSha256 = hash(source.manifestCandidateBytes);
    const expectedSizeBytes = source.manifestCandidateBytes.length;
    try {
        const remote = await readRemoteObject(TAXONOMY_PROJECTION_REMOTE_MANIFEST_KEY, aggregate);
        if (remote.statusCode === 404) {
            return { objectKey: TAXONOMY_PROJECTION_REMOTE_MANIFEST_KEY, status: "missing", expectedSha256, expectedSizeBytes };
        }
        const actualSha256 = hash(remote.bytes);
        const observation: TaxonomyProjectionRemoteManifestObservation = {
            objectKey: TAXONOMY_PROJECTION_REMOTE_MANIFEST_KEY,
            status: actualSha256 === expectedSha256 && remote.bytes.length === expectedSizeBytes ? "matching" : "different",
            expectedSha256,
            expectedSizeBytes,
            actualSha256,
            actualSizeBytes: remote.bytes.length,
        };
        try {
            const parsed = JSON.parse(remote.bytes.toString("utf8")) as { datasetVersion?: unknown; releaseId?: unknown };
            if (typeof parsed.datasetVersion === "string") observation.observedDatasetVersion = parsed.datasetVersion.slice(0, 128);
            if (typeof parsed.releaseId === "string") observation.observedReleaseId = parsed.releaseId.slice(0, 128);
        } catch { /* Mutable remote bytes are observations only. */ }
        return observation;
    } catch (error) {
        return { objectKey: TAXONOMY_PROJECTION_REMOTE_MANIFEST_KEY, status: "failed",
            expectedSha256, expectedSizeBytes, failure: sanitizedFailure(error) };
    }
}

function resolveWranglerEntrypoint(): string {
    const candidates = [
        resolve(__dirname, "..", "node_modules", "wrangler", "bin", "wrangler.js"),
        resolve(__dirname, "..", "node_modules", "wrangler", "wrangler-dist", "cli.js"),
        resolve(__dirname, "..", "..", "node_modules", "wrangler", "bin", "wrangler.js"),
        resolve(__dirname, "..", "..", "node_modules", "wrangler", "wrangler-dist", "cli.js"),
    ];
    const found = candidates.find(existsSync);
    if (!found) throw new Error("K38 Wrangler entrypoint unavailable");
    return found;
}

function conservativeBucketUpperBound(reported: unknown): { reported: string; conservativeUpperBoundBytes: number } {
    if (typeof reported === "number") {
        if (!Number.isSafeInteger(reported) || reported < 0 || reported === Number.MAX_SAFE_INTEGER) {
            throw new Error("K38 Wrangler bucket size rejected");
        }
        return { reported: String(reported), conservativeUpperBoundBytes: reported + 1 };
    }
    if (typeof reported !== "string") throw new Error("K38 Wrangler bucket size missing");
    const match = /^\s*(\d+(?:\.\d+)?)\s*(B|kB|MB|GB|TB)\s*$/.exec(reported);
    if (!match) throw new Error("K38 Wrangler bucket size format rejected");
    const unit: Record<string, number> = { B: 1, kB: 1_000, MB: 1_000_000, GB: 1_000_000_000, TB: 1_000_000_000_000 };
    const decimals = match[1].split(".")[1]?.length ?? 0;
    const upperBound = Math.ceil((Number(match[1]) + 10 ** -decimals) * unit[match[2]]);
    if (!Number.isSafeInteger(upperBound) || upperBound < 0) throw new Error("K38 Wrangler bucket size range rejected");
    return { reported, conservativeUpperBoundBytes: upperBound };
}

function readBucketUsage(): Promise<TaxonomyProjectionBucketUsageObservation> {
    return new Promise(resolvePromise => {
        let entrypoint: string;
        try { entrypoint = resolveWranglerEntrypoint(); }
        catch (error) {
            resolvePromise({ status: "failed", failure: sanitizedFailure(error) });
            return;
        }
        execFile(process.execPath,
            [entrypoint, "r2", "bucket", "info", TAXONOMY_PROJECTION_REMOTE_PREFLIGHT_BUCKET, "--json"],
            {
                encoding: "utf8",
                timeout: TAXONOMY_PROJECTION_REMOTE_PREFLIGHT_BUCKET_TIMEOUT_MS,
                maxBuffer: TAXONOMY_PROJECTION_REMOTE_PREFLIGHT_BUCKET_MAX_BUFFER_BYTES,
                killSignal: "SIGKILL",
                windowsHide: true,
            },
            (error, stdout) => {
                if (error) {
                    resolvePromise({ status: "failed", failure: "K38 Wrangler bucket info failed" });
                    return;
                }
                try {
                    const parsed = JSON.parse(stdout) as { bucket_size?: unknown };
                    const known = conservativeBucketUpperBound(parsed.bucket_size);
                    resolvePromise({ status: "known", ...known });
                } catch (parseError) {
                    resolvePromise({ status: "failed", failure: sanitizedFailure(parseError) });
                }
            });
    });
}

async function ensureChildDirectory(parent: DirectoryIdentity, name: string, label: string): Promise<DirectoryIdentity> {
    if (!name || name.includes("/") || name.includes("\\") || isAbsolute(name)) throw new Error(`K38 ${label} name rejected`);
    const path = join(parent.path, name);
    assertContained(parent.path, path);
    await checkpoint(parent, `${label} parent`);
    try { await mkdir(path, { mode: 0o700 }); }
    catch (error: any) { if (error?.code !== "EEXIST") throw error; }
    await checkpoint(parent, `${label} parent`);
    return inspectDirectory(path, label);
}

async function assertExistingReportParentsSafe(outputRoot: DirectoryIdentity, planId: string): Promise<void> {
    const namespacePath = join(outputRoot.path, TAXONOMY_PROJECTION_REMOTE_PREFLIGHT_NAMESPACE);
    assertContained(outputRoot.path, namespacePath);
    let namespace: DirectoryIdentity;
    try { namespace = await inspectDirectory(namespacePath, "existing report namespace"); }
    catch (error: any) {
        if (error?.code === "ENOENT") return;
        throw error;
    }
    const planPath = join(namespace.path, planId);
    assertContained(namespace.path, planPath);
    try { await inspectDirectory(planPath, "existing report plan directory"); }
    catch (error: any) { if (error?.code !== "ENOENT") throw error; }
    await checkpoint(outputRoot, "output root");
    await checkpoint(namespace, "existing report namespace");
}

async function rejectExistingReport(directoryPath: string): Promise<never> {
    const directory = await inspectDirectory(directoryPath, "existing report directory");
    const entries = await readdir(directory.path, { withFileTypes: true });
    if (entries.length !== 1 || entries[0].name !== TAXONOMY_PROJECTION_REMOTE_PREFLIGHT_REPORT_FILE
        || !entries[0].isFile() || entries[0].isSymbolicLink()) {
        throw new Error("K38 existing report inventory rejected");
    }
    const path = join(directory.path, TAXONOMY_PROJECTION_REMOTE_PREFLIGHT_REPORT_FILE);
    const metadata = await lstat(path);
    if (!metadata.isFile() || metadata.isSymbolicLink() || metadata.nlink !== 1 || !samePath(await realpath(path), path)) {
        throw new Error("K38 existing report file identity rejected");
    }
    throw new Error("K38 create-only report already exists");
}

async function persistReport(outputRoot: DirectoryIdentity, planId: string,
    report: TaxonomyProjectionRemotePreflightReport): Promise<{ reportDirectory: string; reportPath: string; reportSha256: string }> {
    const bytes = jsonBytes(report);
    if (bytes.length >= TAXONOMY_PROJECTION_REMOTE_PREFLIGHT_MAX_REPORT_BYTES) {
        throw new Error("K38 report byte limit reached");
    }
    const reportSha256 = hash(bytes);
    const namespace = await ensureChildDirectory(outputRoot, TAXONOMY_PROJECTION_REMOTE_PREFLIGHT_NAMESPACE, "report namespace");
    const planDirectory = await ensureChildDirectory(namespace, planId, "report plan directory");
    const reportDirectoryPath = join(planDirectory.path, reportSha256);
    assertContained(planDirectory.path, reportDirectoryPath);
    await checkpoint(planDirectory, "report plan directory");
    try { await mkdir(reportDirectoryPath, { mode: 0o700 }); }
    catch (error: any) {
        if (error?.code === "EEXIST") return rejectExistingReport(reportDirectoryPath);
        throw error;
    }
    await checkpoint(planDirectory, "report plan directory");
    const reportDirectory = await inspectDirectory(reportDirectoryPath, "report directory");
    const reportPath = join(reportDirectory.path, TAXONOMY_PROJECTION_REMOTE_PREFLIGHT_REPORT_FILE);
    assertContained(reportDirectory.path, reportPath);
    await checkpoint(reportDirectory, "report directory");
    const handle = await open(reportPath,
        constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY | (constants.O_NOFOLLOW ?? 0), 0o600);
    try {
        await checkpoint(reportDirectory, "report directory");
        await handle.writeFile(bytes);
        await handle.sync();
        const metadata = await handle.stat();
        if (!metadata.isFile() || metadata.nlink !== 1 || metadata.size !== bytes.length) {
            throw new Error("K38 created report identity rejected");
        }
    } finally { await handle.close(); }
    const before = await lstat(reportPath);
    if (!before.isFile() || before.isSymbolicLink() || before.nlink !== 1 || !samePath(await realpath(reportPath), reportPath)) {
        throw new Error("K38 report identity rejected after create");
    }
    const readHandle = await open(reportPath, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
    try {
        const opened = await readHandle.stat();
        const reopenedBytes = await readHandle.readFile();
        const after = await readHandle.stat();
        if (!sameFile(before, opened) || !sameFile(opened, after) || after.nlink !== 1 || !reopenedBytes.equals(bytes)) {
            throw new Error("K38 report changed while reopening");
        }
    } finally { await readHandle.close(); }
    const inventory = await readdir(reportDirectory.path, { withFileTypes: true });
    if (inventory.length !== 1 || inventory[0].name !== TAXONOMY_PROJECTION_REMOTE_PREFLIGHT_REPORT_FILE
        || !inventory[0].isFile() || inventory[0].isSymbolicLink()) {
        throw new Error("K38 created report closed inventory rejected");
    }
    await checkpoint(outputRoot, "output root");
    await checkpoint(namespace, "report namespace");
    await checkpoint(planDirectory, "report plan directory");
    await checkpoint(reportDirectory, "report directory");
    return { reportDirectory: reportDirectory.path, reportPath, reportSha256 };
}

export async function runTaxonomyProjectionRemotePreflight(
    options: TaxonomyProjectionRemotePreflightRunOptions,
): Promise<TaxonomyProjectionRemotePreflightRunResult> {
    const rss = new RssGuard();
    try {
        if (options?.optInK38 !== true) throw new Error("K38 requires exact --opt-in-k38 authorization");
        if (options.remoteReadOnly !== true) throw new Error("K38 requires exact --remote-read-only mode");
        if (!options.outputRoot) throw new Error("K38 requires an explicit output root");
        assertCheckedAt(options.checkedAt);
        const readOptions = sourceReadOptions(options);
        const outputRoot = await inspectDirectory(options.outputRoot, "output root");

        const before = validateSource(await readValidatedTaxonomyProjectionObjectPlan(readOptions), options);
        rss.sample(before.validated.peakRssBytes, TAXONOMY_PROJECTION_REMOTE_PREFLIGHT_RSS_REMOTE_RESERVE_BYTES);
        assertOutputSeparatedFromClosedSources(outputRoot, before, options);
        await assertExistingReportParentsSafe(outputRoot, options.k37PlanId);
        const aggregate = createAggregateCounter();
        const objects = await mapConcurrent(before.validated.plan.objects,
            TAXONOMY_PROJECTION_REMOTE_PREFLIGHT_CONCURRENCY,
            object => inspectImmutableObject(object, aggregate));
        const manifest = await inspectMutableManifest(before, aggregate);
        rss.sample(0, TAXONOMY_PROJECTION_REMOTE_PREFLIGHT_RSS_REPORT_RESERVE_BYTES);
        const bucketUsage = await readBucketUsage();
        rss.sample(0, TAXONOMY_PROJECTION_REMOTE_PREFLIGHT_RSS_REPORT_RESERVE_BYTES);

        const after = validateSource(await readValidatedTaxonomyProjectionObjectPlan(readOptions), options);
        rss.sample(after.validated.peakRssBytes, TAXONOMY_PROJECTION_REMOTE_PREFLIGHT_RSS_REPORT_RESERVE_BYTES);
        if (before.fingerprint !== after.fingerprint) throw new Error("K38 K37 source drifted during remote reads");

        const objectSummary = objects.reduce((summary, object) => {
            summary[object.status]++;
            return summary;
        }, { matching: 0, missing: 0, conflict: 0, failed: 0, total: 4 as const });
        const missingImmutableBytes = objects.filter(object => object.status === "missing")
            .reduce((total, object) => total + object.expectedSizeBytes, 0);
        const bytesNewIfPublished = missingImmutableBytes + before.manifestCandidateBytes.length;
        const bucketUpperBound = bucketUsage.status === "known" ? bucketUsage.conservativeUpperBoundBytes! : "UNKNOWN" as const;
        const projectedCandidate = bucketUpperBound === "UNKNOWN" ? undefined : bucketUpperBound + bytesNewIfPublished;
        const projectedBucketUpperBoundBytes = projectedCandidate === undefined || !Number.isSafeInteger(projectedCandidate)
            ? "UNKNOWN" as const : projectedCandidate;
        const withinBucketCeiling = projectedBucketUpperBoundBytes === "UNKNOWN"
            ? "UNKNOWN" as const : Number.isSafeInteger(projectedBucketUpperBoundBytes)
                && projectedBucketUpperBoundBytes < TAXONOMY_PROJECTION_OBJECT_PLAN_BUCKET_CEILING_BYTES;
        const exactRemoteKeysOnly = JSON.stringify(objects.map(object => object.objectKey))
            === JSON.stringify(before.validated.plan.objects.map(object => object.objectKey))
            && manifest.objectKey === TAXONOMY_PROJECTION_REMOTE_MANIFEST_KEY;
        const everyImmutableObjectInspected = objects.length === 4;
        const noImmutableConflict = objectSummary.conflict === 0;
        const noRemoteReadFailure = objectSummary.failed === 0 && manifest.status !== "failed";
        const mutableManifestPlanningStateAcceptable = manifest.status === "matching"
            || manifest.status === "different" || manifest.status === "missing";
        const bucketProjectionStrictlyWithinLimit = withinBucketCeiling === true;
        const go = exactRemoteKeysOnly && everyImmutableObjectInspected && noImmutableConflict && noRemoteReadFailure
            && mutableManifestPlanningStateAcceptable && bucketUsage.status === "known"
            && before.namespacePlanStrictlyWithinLimit && bucketProjectionStrictlyWithinLimit;
        const report: TaxonomyProjectionRemotePreflightReport = {
            schemaVersion: TAXONOMY_PROJECTION_REMOTE_PREFLIGHT_SCHEMA_VERSION,
            contract: "dokkan-database-character-taxonomy-projection-remote-preflight-k38",
            contractVersion: TAXONOMY_PROJECTION_REMOTE_PREFLIGHT_CONTRACT_VERSION,
            checkedAt: options.checkedAt,
            planId: options.k37PlanId,
            k36ReleaseId: options.k36ReleaseId,
            mode: "explicit_opt_in_remote_read_only",
            remote: {
                publicBaseUrl: TAXONOMY_PROJECTION_REMOTE_PREFLIGHT_PUBLIC_BASE_URL,
                bucket: TAXONOMY_PROJECTION_REMOTE_PREFLIGHT_BUCKET,
                objectMethod: "GET",
                redirects: "BLOCKED",
                acceptEncoding: "identity",
                immutableConcurrency: TAXONOMY_PROJECTION_REMOTE_PREFLIGHT_CONCURRENCY,
                requestTimeoutMs: TAXONOMY_PROJECTION_REMOTE_PREFLIGHT_REQUEST_TIMEOUT_MS,
                bucketCommand: "r2 bucket info dokkanpanion-data --json",
                bucketTimeoutMs: TAXONOMY_PROJECTION_REMOTE_PREFLIGHT_BUCKET_TIMEOUT_MS,
                bucketMaxBufferBytes: TAXONOMY_PROJECTION_REMOTE_PREFLIGHT_BUCKET_MAX_BUFFER_BYTES,
                bucketKillSignal: "SIGKILL",
                rssLimitBytesExclusive: TAXONOMY_PROJECTION_REMOTE_PREFLIGHT_RSS_LIMIT_BYTES,
                rssRemoteAndReportReserveBytes: TAXONOMY_PROJECTION_REMOTE_PREFLIGHT_RSS_REMOTE_RESERVE_BYTES,
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
                responseLimitBytesExclusive: TAXONOMY_PROJECTION_REMOTE_PREFLIGHT_MAX_RESPONSE_BYTES,
                aggregateLimitBytesExclusive: TAXONOMY_PROJECTION_REMOTE_PREFLIGHT_MAX_AGGREGATE_BYTES,
                bytesRead: aggregate.bytesRead,
                namespaceLimitBytesExclusive: TAXONOMY_PROJECTION_OBJECT_PLAN_NAMESPACE_MAX_BYTES,
                namespacePlanBytes: before.validated.plan.budget.worstCaseNewBytes,
                namespacePlanStrictlyWithinLimit: before.namespacePlanStrictlyWithinLimit,
                missingImmutableBytes,
                manifestCandidateBytes: before.manifestCandidateBytes.length,
                bytesNewIfPublished,
                bucketCeilingBytesExclusive: TAXONOMY_PROJECTION_OBJECT_PLAN_BUCKET_CEILING_BYTES,
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
    } catch (error) {
        throw boundedError(error);
    } finally { rss.dispose(); }
}
