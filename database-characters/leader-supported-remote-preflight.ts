import { execFile } from "child_process";
import { createHash } from "crypto";
import { constants, existsSync, Stats } from "fs";
import { lstat, open, realpath } from "fs/promises";
import { request as httpsRequest } from "https";
import { isAbsolute, join, relative, resolve, sep } from "path";
import type { CharacterLeaderSupportedProjectionSourceOptions } from "./leader-supported-projection-source";
import {
    assertCharacterLeaderSupportedPublisherDryRunArtifacts,
    validateCharacterLeaderSupportedPublisherDryRunArtifact,
} from "./leader-supported-publisher-dry-run";
import type { CharacterLeaderSupportedPublisherDryRunArtifactSet } from "./leader-supported-publisher-dry-run-contract";
import {
    CHARACTER_LEADER_SUPPORTED_PUBLISHER_IMMUTABLE_CACHE_CONTROL,
    CHARACTER_LEADER_SUPPORTED_PUBLISHER_MANIFEST_KEY,
    CHARACTER_LEADER_SUPPORTED_PUBLISHER_NAMESPACE,
} from "./leader-supported-publisher-dry-run-contract";
import {
    CHARACTER_LEADER_SUPPORTED_REMOTE_PREFLIGHT_AGGREGATE_LIMIT_BYTES,
    CHARACTER_LEADER_SUPPORTED_REMOTE_PREFLIGHT_BUCKET,
    CHARACTER_LEADER_SUPPORTED_REMOTE_PREFLIGHT_BUCKET_CEILING_BYTES,
    CHARACTER_LEADER_SUPPORTED_REMOTE_PREFLIGHT_BUCKET_MAX_BUFFER_BYTES,
    CHARACTER_LEADER_SUPPORTED_REMOTE_PREFLIGHT_BUCKET_TIMEOUT_MS,
    CHARACTER_LEADER_SUPPORTED_REMOTE_PREFLIGHT_CONTRACT_VERSION,
    CHARACTER_LEADER_SUPPORTED_REMOTE_PREFLIGHT_MAX_FAILURE_LENGTH,
    CHARACTER_LEADER_SUPPORTED_REMOTE_PREFLIGHT_PUBLIC_BASE_URL,
    CHARACTER_LEADER_SUPPORTED_REMOTE_PREFLIGHT_REPORT_FILE,
    CHARACTER_LEADER_SUPPORTED_REMOTE_PREFLIGHT_REPORT_LIMIT_BYTES,
    CHARACTER_LEADER_SUPPORTED_REMOTE_PREFLIGHT_REQUEST_TIMEOUT_MS,
    CHARACTER_LEADER_SUPPORTED_REMOTE_PREFLIGHT_RESPONSE_LIMIT_BYTES,
    CHARACTER_LEADER_SUPPORTED_REMOTE_PREFLIGHT_RSS_LIMIT_BYTES,
    CharacterLeaderSupportedBucketUsageObservation,
    CharacterLeaderSupportedRemoteImmutableObservation,
    CharacterLeaderSupportedRemoteManifestObservation,
    CharacterLeaderSupportedRemotePreflightReport,
    CharacterLeaderSupportedRemotePreflightResult,
} from "./leader-supported-remote-preflight-contract";

export interface CharacterLeaderSupportedRemotePreflightOptions extends CharacterLeaderSupportedProjectionSourceOptions {
    optIn: true;
    remoteReadOnly: true;
    k56Root: string;
    k58Root: string;
    outputRoot: string;
    checkedAt: string;
}

interface RootIdentity { path: string; realPath: string; dev: number; ino: number }
interface AggregateCounter { bytesRead: number; consume(bytes: number): void }
interface RemoteRead {
    statusCode: 200 | 404;
    bytes: Buffer;
    contentType?: string;
    cacheControl?: string;
    etag?: string;
}
interface SourceSnapshot {
    artifacts: CharacterLeaderSupportedPublisherDryRunArtifactSet;
    fingerprint: string;
    k55Peak: number;
}

const CHECKED_AT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const HASH = /^[a-f0-9]{64}$/;
const hash = (bytes: Buffer | string): string => createHash("sha256").update(bytes).digest("hex");
const jsonBytes = (value: unknown): Buffer => Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8");
const json = (value: unknown): string => JSON.stringify(value);
const samePath = (left: string, right: string): boolean => process.platform === "win32"
    ? resolve(left).toLowerCase() === resolve(right).toLowerCase() : resolve(left) === resolve(right);
const sameFile = (left: Stats, right: Stats): boolean => left.dev === right.dev && left.ino === right.ino;
const containsPath = (parent: string, child: string): boolean => {
    const rel = relative(parent, child);
    return rel === "" || (!rel.startsWith(`..${sep}`) && rel !== ".." && !isAbsolute(rel));
};

function sanitizedFailure(error: unknown): string {
    return (error instanceof Error ? error.message : String(error))
        .replace(/[\u0000-\u001f\u007f]+/g, " ")
        .replace(/https?:\/\/\S+/gi, "[remote-url]")
        .replace(/[A-Za-z]:\\[^\s]+/g, "[local-path]")
        .replace(/\s+/g, " ").trim().slice(0, CHARACTER_LEADER_SUPPORTED_REMOTE_PREFLIGHT_MAX_FAILURE_LENGTH)
        || "K59 read failed";
}

function assertCheckedAt(value: string): void {
    if (!CHECKED_AT.test(value) || Number.isNaN(Date.parse(value)) || new Date(value).toISOString() !== value) {
        throw new Error("K59 requires an explicit canonical UTC checkedAt");
    }
}

function artifactFingerprint(artifacts: CharacterLeaderSupportedPublisherDryRunArtifactSet): string {
    const digest = createHash("sha256");
    for (const [name, bytes] of [
        ["candidate", artifacts.candidateManifestBytes], ["plan", artifacts.planBytes],
        ["receipt", artifacts.receiptBytes], ["marker", artifacts.markerBytes],
    ] as const) {
        digest.update(`${name}:${bytes.length}:`); digest.update(bytes); digest.update("\0");
    }
    return digest.digest("hex");
}

function validateSource(result: any): SourceSnapshot {
    if (!result || result.sourceBoundValidation !== "GO" || !Number.isSafeInteger(result.k55ValidationProcessPeakRssBytes)
        || result.k55ValidationProcessPeakRssBytes <= 0
        || result.k55ValidationProcessPeakRssBytes >= CHARACTER_LEADER_SUPPORTED_REMOTE_PREFLIGHT_RSS_LIMIT_BYTES) {
        throw new Error("K59 requires K58 source-bound GO with bounded K55 peak");
    }
    const artifacts = result.artifacts as CharacterLeaderSupportedPublisherDryRunArtifactSet;
    assertCharacterLeaderSupportedPublisherDryRunArtifacts(artifacts);
    const plan = artifacts.plan;
    if (plan.readiness.dryRun !== "GO" || plan.readiness.sourceBoundValidation !== "GO"
        || plan.readiness.remotePreflight !== "NOT_EXECUTED" || plan.readiness.publication !== "NO-GO"
        || plan.readiness.r2Mutation !== "NO-GO" || plan.namespace !== CHARACTER_LEADER_SUPPORTED_PUBLISHER_NAMESPACE
        || plan.immutableObjects.length !== 4
        || json(plan.immutableObjects.map(object => object.kind)) !== json(["payload", "coverage", "validation", "manifest"])
        || !HASH.test(plan.source.rawIdentity.sha256) || !Number.isSafeInteger(plan.source.rawIdentity.sizeBytes)
        || plan.source.rawIdentity.sizeBytes <= 0 || plan.source.rawIdentity.persistedOrRemoteObject !== false
        || plan.mutableManifest.objectKey !== CHARACTER_LEADER_SUPPORTED_PUBLISHER_MANIFEST_KEY
        || plan.mutableManifest.candidateSha256 !== hash(artifacts.candidateManifestBytes)
        || plan.mutableManifest.candidateSizeBytes !== artifacts.candidateManifestBytes.length) {
        throw new Error("K59 K58 source plan boundary rejected");
    }
    for (let index = 0; index < 4; index++) {
        const object = plan.immutableObjects[index];
        if (!HASH.test(object.sha256) || !Number.isSafeInteger(object.sizeBytes) || object.sizeBytes <= 0
            || object.objectKey !== `${CHARACTER_LEADER_SUPPORTED_PUBLISHER_NAMESPACE}/objects/sha256/${object.sha256}/${object.sourceFileName}`
            || object.remotePreflight !== "NOT_EXECUTED" || object.action !== "NOT_EXECUTED") {
            throw new Error("K59 exact K56 immutable identity rejected");
        }
    }
    return { artifacts, fingerprint: artifactFingerprint(artifacts), k55Peak: result.k55ValidationProcessPeakRssBytes };
}

async function sourceRead(options: CharacterLeaderSupportedRemotePreflightOptions): Promise<SourceSnapshot> {
    const result = await validateCharacterLeaderSupportedPublisherDryRunArtifact({
        artifactRoot: options.k58Root, k56Root: options.k56Root,
        sidecarRoot: options.sidecarRoot, productionRoot: options.productionRoot, fyiRoot: options.fyiRoot,
        k43Root: options.k43Root, k46Root: options.k46Root, k48Root: options.k48Root,
        nativeRuntime: options.nativeRuntime, database: options.database,
    });
    return validateSource(result);
}

function createAggregateCounter(): AggregateCounter {
    return {
        bytesRead: 0,
        consume(bytes: number): void {
            if (!Number.isSafeInteger(bytes) || bytes < 0) throw new Error("K59 response byte count rejected");
            this.bytesRead += bytes;
            if (!Number.isSafeInteger(this.bytesRead)
                || this.bytesRead >= CHARACTER_LEADER_SUPPORTED_REMOTE_PREFLIGHT_AGGREGATE_LIMIT_BYTES) {
                throw new Error("K59 aggregate response byte limit reached");
            }
        },
    };
}

function allowedKey(key: string): boolean {
    return key === CHARACTER_LEADER_SUPPORTED_PUBLISHER_MANIFEST_KEY
        || /^database-characters\/leader-supported\/v1\/objects\/sha256\/[a-f0-9]{64}\/database-characters-k56-leader-supported-projection(?:\.[a-f0-9]{64}\.json\.gz|-coverage\.json|-validation\.json|-manifest\.json)$/.test(key);
}

function header(value: string | string[] | undefined): string | undefined {
    return Array.isArray(value) ? value.join(",") : value;
}

function readRemote(key: string, aggregate: AggregateCounter): Promise<RemoteRead> {
    return new Promise((resolvePromise, rejectPromise) => {
        if (!allowedKey(key)) { rejectPromise(new Error("K59 remote key rejected")); return; }
        const url = new URL(key.split("/").map(encodeURIComponent).join("/"), CHARACTER_LEADER_SUPPORTED_REMOTE_PREFLIGHT_PUBLIC_BASE_URL);
        let settled = false;
        let deadline: NodeJS.Timeout | undefined;
        const rejectOnce = (error: Error): void => {
            if (settled) return;
            settled = true; if (deadline) clearTimeout(deadline); rejectPromise(error);
        };
        const request = httpsRequest(url, {
            method: "GET",
            headers: { Accept: "application/octet-stream, application/json", "Accept-Encoding": "identity" },
        }, (response: any) => {
            const statusCode = response.statusCode ?? 0;
            if (statusCode >= 300 && statusCode < 400) { response.resume(); rejectOnce(new Error(`K59 redirect blocked (${statusCode})`)); return; }
            if (statusCode !== 200 && statusCode !== 404) { response.resume(); rejectOnce(new Error(`K59 unexpected HTTP status ${statusCode}`)); return; }
            const encoding = header(response.headers["content-encoding"]);
            if (encoding !== undefined && encoding.toLowerCase() !== "identity") {
                response.resume(); rejectOnce(new Error("K59 non-identity content encoding blocked")); return;
            }
            const contentLength = header(response.headers["content-length"]);
            if (contentLength !== undefined && (!/^\d+$/.test(contentLength)
                || Number(contentLength) >= CHARACTER_LEADER_SUPPORTED_REMOTE_PREFLIGHT_RESPONSE_LIMIT_BYTES)) {
                response.resume(); rejectOnce(new Error("K59 response byte limit reached")); return;
            }
            const chunks: Buffer[] = [];
            let bytes = 0;
            response.on("data", (chunkValue: Buffer | string) => {
                if (settled) return;
                const chunk = Buffer.isBuffer(chunkValue) ? chunkValue : Buffer.from(chunkValue);
                bytes += chunk.length;
                try {
                    if (bytes >= CHARACTER_LEADER_SUPPORTED_REMOTE_PREFLIGHT_RESPONSE_LIMIT_BYTES) {
                        throw new Error("K59 response byte limit reached");
                    }
                    aggregate.consume(chunk.length); chunks.push(chunk);
                } catch (error) {
                    response.destroy(); rejectOnce(error instanceof Error ? error : new Error("K59 bounded response failed"));
                }
            });
            response.on("end", () => {
                if (settled) return;
                settled = true; if (deadline) clearTimeout(deadline);
                resolvePromise({
                    statusCode, bytes: Buffer.concat(chunks), contentType: header(response.headers["content-type"]),
                    cacheControl: header(response.headers["cache-control"]), etag: header(response.headers.etag),
                } as RemoteRead);
            });
            response.on("error", () => rejectOnce(new Error("K59 HTTPS response failed")));
            response.on("aborted", () => rejectOnce(new Error("K59 HTTPS response aborted")));
        });
        request.setTimeout(CHARACTER_LEADER_SUPPORTED_REMOTE_PREFLIGHT_REQUEST_TIMEOUT_MS,
            () => request.destroy(new Error("K59 HTTPS request timeout")));
        deadline = setTimeout(() => request.destroy(new Error("K59 HTTPS request timeout")),
            CHARACTER_LEADER_SUPPORTED_REMOTE_PREFLIGHT_REQUEST_TIMEOUT_MS);
        deadline.unref();
        request.on("error", (error: Error) => rejectOnce(error.message.includes("timeout")
            ? new Error("K59 HTTPS request timeout") : new Error("K59 HTTPS request failed")));
        request.end();
    });
}

async function inspectImmutable(object: any, aggregate: AggregateCounter): Promise<CharacterLeaderSupportedRemoteImmutableObservation> {
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
    } catch (error) {
        return { ...base, status: "failed", futureAction: "BLOCKED", futurePrecondition: "BLOCKED", failure: sanitizedFailure(error) };
    }
}

function validEtag(value: string | undefined): value is string {
    return typeof value === "string" && value.length <= 256 && /^"[\x21\x23-\x7e\x80-\xff]+"$/.test(value);
}

async function inspectManifest(source: SourceSnapshot, aggregate: AggregateCounter): Promise<CharacterLeaderSupportedRemoteManifestObservation> {
    const bytes = source.artifacts.candidateManifestBytes;
    const base = {
        objectKey: CHARACTER_LEADER_SUPPORTED_PUBLISHER_MANIFEST_KEY,
        expectedSha256: hash(bytes), expectedSizeBytes: bytes.length,
        unconditionalWrite: "FORBIDDEN" as const, delete: "FORBIDDEN" as const,
    };
    try {
        const remote = await readRemote(CHARACTER_LEADER_SUPPORTED_PUBLISHER_MANIFEST_KEY, aggregate);
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
        if (!validEtag(remote.etag)) throw new Error("K59 different mutable manifest requires a fresh nonempty HTTP ETag");
        return {
            ...base, status: "different", actualSha256, actualSizeBytes: remote.bytes.length,
            observedContentType: remote.contentType, observedCacheControl: remote.cacheControl, observedEtag: remote.etag,
            futureAction: "replace_if_match", futurePrecondition: "If-Match: OBSERVED_FRESH_ETAG",
        };
    } catch (error) {
        return { ...base, status: "failed", futureAction: "BLOCKED", futurePrecondition: "BLOCKED", failure: sanitizedFailure(error) };
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
    if (!found) throw new Error("K59 local Wrangler entrypoint unavailable");
    return found;
}

function conservativeBucketUpperBound(reported: unknown): { reported: string; conservativeUpperBoundBytes: number } {
    if (typeof reported === "number") {
        if (!Number.isSafeInteger(reported) || reported < 0 || reported === Number.MAX_SAFE_INTEGER) throw new Error("K59 Wrangler bucket size rejected");
        return { reported: String(reported), conservativeUpperBoundBytes: reported + 1 };
    }
    if (typeof reported !== "string") throw new Error("K59 Wrangler bucket size missing");
    const match = /^\s*(\d+(?:\.\d+)?)\s*(B|kB|MB|GB|TB)\s*$/.exec(reported);
    if (!match) throw new Error("K59 Wrangler bucket size format rejected");
    const units: Record<string, number> = { B: 1, kB: 1_000, MB: 1_000_000, GB: 1_000_000_000, TB: 1_000_000_000_000 };
    const decimals = match[1].split(".")[1]?.length ?? 0;
    const upper = Math.ceil((Number(match[1]) + 10 ** -decimals) * units[match[2]]);
    if (!Number.isSafeInteger(upper) || upper < 0) throw new Error("K59 Wrangler bucket size range rejected");
    return { reported, conservativeUpperBoundBytes: upper };
}

function readBucketUsage(): Promise<CharacterLeaderSupportedBucketUsageObservation> {
    return new Promise(resolvePromise => {
        let entrypoint: string;
        try { entrypoint = resolveWranglerEntrypoint(); }
        catch (error) { resolvePromise({ status: "failed", failure: sanitizedFailure(error) }); return; }
        execFile(process.execPath,
            [entrypoint, "r2", "bucket", "info", CHARACTER_LEADER_SUPPORTED_REMOTE_PREFLIGHT_BUCKET, "--json"],
            {
                encoding: "utf8", timeout: CHARACTER_LEADER_SUPPORTED_REMOTE_PREFLIGHT_BUCKET_TIMEOUT_MS,
                maxBuffer: CHARACTER_LEADER_SUPPORTED_REMOTE_PREFLIGHT_BUCKET_MAX_BUFFER_BYTES,
                killSignal: "SIGKILL", windowsHide: true, shell: false,
            },
            (error: Error | null, stdout: string, stderr: string) => {
                if (error || stderr) { resolvePromise({ status: "failed", failure: "K59 Wrangler bucket info failed" }); return; }
                try {
                    const parsed = JSON.parse(stdout) as { bucket_size?: unknown };
                    resolvePromise({ status: "known", ...conservativeBucketUpperBound(parsed.bucket_size) });
                } catch (parseError) { resolvePromise({ status: "failed", failure: sanitizedFailure(parseError) }); }
            });
    });
}

async function inspectRoot(value: string, label: string): Promise<RootIdentity> {
    const path = resolve(value), before = await lstat(path);
    if (!before.isDirectory() || before.isSymbolicLink()) throw new Error(`K59 ${label} must be a regular non-link directory`);
    const canonical = await realpath(path), after = await lstat(path);
    if (!samePath(path, canonical) || !sameFile(before, after) || after.isSymbolicLink()) throw new Error(`K59 ${label} link, junction or drift rejected`);
    return { path, realPath: canonical, dev: after.dev, ino: after.ino };
}

async function checkpoint(root: RootIdentity): Promise<void> {
    const actual = await inspectRoot(root.path, "output root");
    if (actual.dev !== root.dev || actual.ino !== root.ino || !samePath(actual.realPath, root.realPath)) throw new Error("K59 output root identity changed");
}

async function rejectExistingReport(root: RootIdentity): Promise<void> {
    const path = join(root.path, CHARACTER_LEADER_SUPPORTED_REMOTE_PREFLIGHT_REPORT_FILE);
    try {
        const metadata = await lstat(path);
        if (!metadata.isFile() || metadata.isSymbolicLink() || metadata.nlink !== 1 || !samePath(path, await realpath(path))) {
            throw new Error("K59 existing report link or hardlink rejected");
        }
        throw new Error("K59 create-only report already exists");
    } catch (error: any) { if (error?.code !== "ENOENT") throw error; }
}

async function persistReport(root: RootIdentity, report: CharacterLeaderSupportedRemotePreflightReport): Promise<{ reportPath: string; reportSha256: string }> {
    const bytes = jsonBytes(report);
    if (bytes.length >= CHARACTER_LEADER_SUPPORTED_REMOTE_PREFLIGHT_REPORT_LIMIT_BYTES) throw new Error("K59 report byte limit reached");
    await checkpoint(root); await rejectExistingReport(root);
    const path = join(root.path, CHARACTER_LEADER_SUPPORTED_REMOTE_PREFLIGHT_REPORT_FILE);
    const handle = await open(path, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY | (constants.O_NOFOLLOW ?? 0), 0o600);
    try {
        await handle.writeFile(bytes); await handle.sync();
        const metadata = await handle.stat();
        if (!metadata.isFile() || metadata.nlink !== 1 || metadata.size !== bytes.length) throw new Error("K59 created report identity rejected");
    } finally { await handle.close(); }
    const before = await lstat(path);
    if (!before.isFile() || before.isSymbolicLink() || before.nlink !== 1 || !samePath(path, await realpath(path))) {
        throw new Error("K59 report identity rejected after create");
    }
    const readHandle = await open(path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
    try {
        const opened = await readHandle.stat(), reopened = await readHandle.readFile(), after = await readHandle.stat();
        if (!sameFile(before, opened) || !sameFile(opened, after) || after.nlink !== 1 || !reopened.equals(bytes)) {
            throw new Error("K59 report changed while reopening");
        }
    } finally { await readHandle.close(); }
    await checkpoint(root);
    return { reportPath: path, reportSha256: hash(bytes) };
}

class RssGuard {
    private peak = Math.max(process.memoryUsage().rss, process.resourceUsage().maxRSS * 1024);
    private exceeded = false;
    private readonly timer = setInterval(() => this.observe(), 10);
    constructor() { this.timer.unref(); }
    private observe(): void { this.peak = Math.max(this.peak, process.memoryUsage().rss, process.resourceUsage().maxRSS * 1024); this.exceeded ||= this.peak >= CHARACTER_LEADER_SUPPORTED_REMOTE_PREFLIGHT_RSS_LIMIT_BYTES; }
    sample(reserve = 0): void {
        this.observe();
        if (this.exceeded || this.peak + reserve >= CHARACTER_LEADER_SUPPORTED_REMOTE_PREFLIGHT_RSS_LIMIT_BYTES) throw new Error(`K59 parent per-process RSS limit reached: ${this.peak}`);
    }
    stop(): number { clearInterval(this.timer); this.sample(); return this.peak; }
    dispose(): void { clearInterval(this.timer); }
}

export async function runCharacterLeaderSupportedRemotePreflight(
    options: CharacterLeaderSupportedRemotePreflightOptions,
): Promise<CharacterLeaderSupportedRemotePreflightResult> {
    const rss = new RssGuard();
    try {
        if (options?.optIn !== true) throw new Error("K59 requires exact --opt-in-k59");
        if (options.remoteReadOnly !== true) throw new Error("K59 requires exact --remote-read-only");
        if (!options.k56Root || !options.k58Root || !options.outputRoot) throw new Error("K59 requires explicit K56, K58 and output roots");
        if (typeof (global as any).gc !== "function") throw new Error("K59 requires Node --expose-gc");
        assertCheckedAt(options.checkedAt);
        const output = await inspectRoot(options.outputRoot, "output root");
        for (const [label, path] of [
            ["sidecar root", options.sidecarRoot], ["production root", options.productionRoot], ["FYI root", options.fyiRoot],
            ["K43 root", options.k43Root], ["K46 root", options.k46Root], ["K48 root", options.k48Root],
            ["K56 root", options.k56Root], ["K58 root", options.k58Root],
        ] as const) {
            const source = await inspectRoot(path, label);
            if (containsPath(output.realPath, source.realPath) || containsPath(source.realPath, output.realPath)) {
                throw new Error(`K59 output root must be separate from ${label}`);
            }
        }
        for (const [label, path] of [["native runtime", options.nativeRuntime], ["database", options.database]] as const) {
            const metadata = await lstat(resolve(path)), canonical = await realpath(resolve(path));
            if (!metadata.isFile() || metadata.isSymbolicLink() || metadata.nlink !== 1
                || containsPath(output.realPath, canonical)) throw new Error(`K59 output root must be separate from regular single-link ${label}`);
        }
        await rejectExistingReport(output);
        const observedSequence: string[] = [];
        const before = await sourceRead(options);
        observedSequence.push("source-before");
        rss.sample(CHARACTER_LEADER_SUPPORTED_REMOTE_PREFLIGHT_AGGREGATE_LIMIT_BYTES
            + CHARACTER_LEADER_SUPPORTED_REMOTE_PREFLIGHT_REPORT_LIMIT_BYTES * 4);
        const aggregate = createAggregateCounter();
        const objects: CharacterLeaderSupportedRemoteImmutableObservation[] = [];
        for (const object of before.artifacts.plan.immutableObjects) {
            observedSequence.push(`get:${object.objectKey}`); objects.push(await inspectImmutable(object, aggregate));
        }
        observedSequence.push(`get:${CHARACTER_LEADER_SUPPORTED_PUBLISHER_MANIFEST_KEY}`);
        const manifest = await inspectManifest(before, aggregate);
        observedSequence.push("bucket");
        const bucketUsage = await readBucketUsage();
        const after = await sourceRead(options);
        observedSequence.push("source-after");
        rss.sample(CHARACTER_LEADER_SUPPORTED_REMOTE_PREFLIGHT_REPORT_LIMIT_BYTES * 4);
        if (before.fingerprint !== after.fingerprint) throw new Error("K59 K58 source drifted during remote reads");

        const summary = objects.reduce((value, object) => { value[object.status]++; return value; },
            { matching: 0, missing: 0, conflict: 0, failed: 0, total: 4 as const });
        const missingImmutableBytes = objects.filter(object => object.status === "missing")
            .reduce((sum, object) => sum + object.expectedSizeBytes, 0);
        const candidateReservation = before.artifacts.candidateManifestBytes.length;
        const prospectiveAdditionalBytes = missingImmutableBytes + candidateReservation;
        const bucketUpper = bucketUsage.status === "known" ? bucketUsage.conservativeUpperBoundBytes! : "UNKNOWN" as const;
        const projectedValue = bucketUpper === "UNKNOWN" ? undefined : bucketUpper + prospectiveAdditionalBytes;
        const projected = projectedValue === undefined || !Number.isSafeInteger(projectedValue) ? "UNKNOWN" as const : projectedValue;
        const within = projected === "UNKNOWN" ? "UNKNOWN" as const : projected < CHARACTER_LEADER_SUPPORTED_REMOTE_PREFLIGHT_BUCKET_CEILING_BYTES;
        const noReadFailure = summary.failed === 0 && manifest.status !== "failed";
        const noConflict = summary.conflict === 0;
        const manifestSafe = manifest.status === "matching" || manifest.status === "missing" || manifest.status === "different";
        const exactSequence = json(observedSequence) === json([
            "source-before", ...before.artifacts.plan.immutableObjects.map(object => `get:${object.objectKey}`),
            `get:${CHARACTER_LEADER_SUPPORTED_PUBLISHER_MANIFEST_KEY}`, "bucket", "source-after",
        ]);
        const go = exactSequence && objects.length === 4 && noReadFailure && noConflict && manifestSafe
            && bucketUsage.status === "known" && within === true;
        const report: CharacterLeaderSupportedRemotePreflightReport = {
            schemaVersion: 1, contract: "dokkan-database-character-leader-supported-remote-preflight",
            contractVersion: CHARACTER_LEADER_SUPPORTED_REMOTE_PREFLIGHT_CONTRACT_VERSION,
            checkedAt: options.checkedAt, mode: "explicit_opt_in_public_http_and_bucket_read_only",
            remote: {
                publicBaseUrl: CHARACTER_LEADER_SUPPORTED_REMOTE_PREFLIGHT_PUBLIC_BASE_URL,
                bucket: CHARACTER_LEADER_SUPPORTED_REMOTE_PREFLIGHT_BUCKET, exactGetCount: 5, method: "GET",
                redirects: "BLOCKED", acceptEncoding: "identity", requestTimeoutMs: CHARACTER_LEADER_SUPPORTED_REMOTE_PREFLIGHT_REQUEST_TIMEOUT_MS,
                bucketCommand: "r2 bucket info dokkanpanion-data --json", bucketTimeoutMs: CHARACTER_LEADER_SUPPORTED_REMOTE_PREFLIGHT_BUCKET_TIMEOUT_MS,
                bucketMaxBufferBytes: CHARACTER_LEADER_SUPPORTED_REMOTE_PREFLIGHT_BUCKET_MAX_BUFFER_BYTES,
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
                responseLimitBytesExclusive: CHARACTER_LEADER_SUPPORTED_REMOTE_PREFLIGHT_RESPONSE_LIMIT_BYTES,
                aggregateLimitBytesExclusive: CHARACTER_LEADER_SUPPORTED_REMOTE_PREFLIGHT_AGGREGATE_LIMIT_BYTES,
                bytesRead: aggregate.bytesRead, missingImmutableBytes, candidateManifestReservationBytes: candidateReservation,
                prospectiveAdditionalBytes, bucketCeilingBytesExclusive: CHARACTER_LEADER_SUPPORTED_REMOTE_PREFLIGHT_BUCKET_CEILING_BYTES,
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
    } finally { rss.dispose(); }
}
