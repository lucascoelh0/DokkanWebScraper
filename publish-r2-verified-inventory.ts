import {
    GetObjectCommand,
    ListObjectsV2Command,
    PutObjectCommand,
    S3Client,
} from "@aws-sdk/client-s3";
import { createHash } from "crypto";
import { DatasetManifest } from "./dataset-artifacts";
import {
    assertDatasetPublicationWriteAuthorized,
    contractLaneObjectKey,
    DatasetContractLane,
    DatasetPublicationChannel,
} from "./dataset-publication-channel";

export type PortraitVerificationMethod = "full-get-sha256" | "post-upload-sha256";

export interface DatasetPublishStateV1 {
    schemaVersion: 1,
    bucket: string,
    target: "remote" | "local",
    channel?: DatasetPublicationChannel,
    contractLane?: DatasetContractLane,
    datasetVersion: string,
    datasetObjectKey: string,
    manifestSha256: string,
    publishedAt: string,
    portraits: Record<string, string>,
}

export interface VerifiedPortraitReceipt {
    key: string,
    sha256: string,
    sizeBytes: number,
    etag: string,
    lastModified: string,
    contentType: string,
    cacheControl: string,
    verificationMethod: PortraitVerificationMethod,
}

export interface DatasetPublishStateV2 {
    schemaVersion: 2,
    bucket: string,
    target: "remote" | "local",
    channel: DatasetPublicationChannel,
    contractLane: DatasetContractLane,
    manifestObjectKey: string,
    manifestSha256: string,
    datasetVersion: string,
    datasetObjectKey: string,
    datasetSha256: string,
    datasetSizeBytes: number,
    portraitInventorySha256: string,
    verifiedAt: string,
    portraits: Record<string, VerifiedPortraitReceipt>,
}

export type DatasetPublishState = DatasetPublishStateV1 | DatasetPublishStateV2;

export interface VerifiedPortraitEntry {
    objectKey: string,
    filePath: string,
    sha256: string,
    sizeBytes: number,
    loadBytes: () => Promise<Buffer>,
}

export interface RemoteInventoryObject {
    key: string,
    sizeBytes: number,
    etag: string,
    lastModified: string,
}

export interface RemoteInventoryPage {
    objects: RemoteInventoryObject[],
    isTruncated: boolean,
    nextContinuationToken?: string,
}

export interface RemoteObjectRead {
    bytes: Buffer,
    sizeBytes: number,
    etag: string,
    lastModified: string,
    contentType: string,
    cacheControl: string,
    release?: () => void,
}

type RemoteObjectProof = Omit<RemoteObjectRead, "bytes" | "release">;

export interface RemoteGetOptions {
    maxBytes: number,
    expectedSizeBytes?: number,
}

export type ConditionalPutResult = "written" | "precondition-failed";

export interface CharacterObjectStore {
    readonly supportsInventory: boolean,
    listPage(prefix: string, continuationToken?: string, signal?: AbortSignal): Promise<RemoteInventoryPage>,
    get(key: string, options: RemoteGetOptions, signal?: AbortSignal): Promise<RemoteObjectRead | undefined>,
    put(
        key: string,
        bytes: Buffer,
        contentType: string,
        cacheControl: string,
        condition: { ifNoneMatch: true } | { ifMatch: string },
        signal?: AbortSignal,
    ): Promise<ConditionalPutResult>,
}

export interface PublisherTelemetry {
    list: number,
    head: number,
    get: number,
    put: number,
    retries: number,
    bytesRead: number,
    bytesPutAttempted: number,
    reasons: Record<string, number>,
}

export interface RetryPolicy {
    delaysMs: readonly number[],
    maxBackoffMs: number,
    jitter: () => number,
    sleep: (milliseconds: number) => Promise<void>,
    attemptTimeoutMs?: number,
    setTimer?: (callback: () => void, milliseconds: number) => unknown,
    clearTimer?: (handle: unknown) => void,
}

export const DEFAULT_R2_RETRY_POLICY: RetryPolicy = {
    delaysMs: [250, 500, 1_000, 2_000, 4_000],
    maxBackoffMs: 5_000,
    jitter: Math.random,
    sleep: milliseconds => new Promise(resolveDelay => setTimeout(resolveDelay, milliseconds)),
    attemptTimeoutMs: 30_000,
    setTimer: (callback, milliseconds) => setTimeout(callback, milliseconds),
    clearTimer: handle => clearTimeout(handle as NodeJS.Timeout),
};

export const CHARACTER_BODY_LIMITS = {
    manifest: 1_048_576,
    dataset: 1_073_741_824,
    portrait: 67_108_864,
} as const;

const IMMUTABLE_CACHE_CONTROL = "public, max-age=31536000, immutable";
const PORTRAIT_CONTENT_TYPE = "image/png";
const DATASET_CONTENT_TYPE = "application/gzip";
const MANIFEST_CONTENT_TYPE = "application/json";
const MANIFEST_CACHE_CONTROL = "no-store";

export interface VerifiedPublicationInput {
    bucket: string,
    target: "remote" | "local",
    channel: DatasetPublicationChannel,
    contractLane: DatasetContractLane,
    manifestObjectKey: string,
    candidateManifest: DatasetManifest,
    candidateManifestBytes: Buffer,
    datasetObjectKey: string,
    datasetBytes: Buffer,
    portraits: VerifiedPortraitEntry[],
    previousState?: unknown,
    expectedRemoteBaselineSha256?: string,
    expectRemoteManifestAbsent: boolean,
    skipRemoteManifestCheck: boolean,
    skipPortraits: boolean,
    fullAudit: boolean,
    dryRun: boolean,
    verificationOnly: boolean,
    promoteProduction: boolean,
    concurrency: number,
    retryPolicy?: RetryPolicy,
    now?: () => string,
    validatePlan?: (plan: VerifiedPublicationPlan) => Promise<void> | void,
    writeState?: (state: DatasetPublishStateV2) => Promise<void>,
}

export interface VerifiedPublicationDecision {
    key: string,
    decision: "reuse-receipt" | "reuse-full-get" | "upload-create-only" | "conflict",
    reason: string,
}

export interface VerifiedPublicationPlan {
    stateTrust: "trusted-schema-2" | "full-audit" | "untrusted",
    stateReason: string,
    portraitReferencedCount: number,
    portraitReuseCount: number,
    portraitFullGetCount: number,
    portraitUploadCount: number,
    portraitConflictCount: number,
    datasetUploadCount: number,
    manifestUploadCount: number,
    prospectiveUploadBytes: number,
    decisions: VerifiedPublicationDecision[],
    telemetry: PublisherTelemetry,
}

export interface VerifiedPublicationResult {
    plan: VerifiedPublicationPlan,
    state?: DatasetPublishStateV2,
}

interface StateAssessment {
    trusted?: DatasetPublishStateV2,
    stateTrust: VerifiedPublicationPlan["stateTrust"],
    reason: string,
    legacySchema1: boolean,
}

interface BaselineObservation {
    object?: RemoteObjectRead,
    manifest?: DatasetManifest,
}

function hash(bytes: Buffer): string {
    return createHash("sha256").update(bytes).digest("hex");
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isSha256(value: unknown): value is string {
    return typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
}

function isSafeSize(value: unknown): value is number {
    return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function isOpaqueEtag(value: unknown): value is string {
    return typeof value === "string" && value.length > 0 && value.length <= 2_048 && !/[\r\n\0]/.test(value);
}

function isRemoteTimestamp(value: unknown): value is string {
    if (typeof value !== "string" || value.length === 0 || value.length > 128) return false;
    const parsed = new Date(value);
    return !Number.isNaN(parsed.valueOf()) && parsed.toISOString() === value;
}

function isSafeMetadata(value: unknown): value is string {
    return typeof value === "string" && value.length > 0 && value.length <= 2_048 && !/[\r\n\0]/.test(value);
}

function canonicalJson(value: unknown): string {
    if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
    if (value && typeof value === "object") {
        const record = value as Record<string, unknown>;
        return `{${Object.keys(record).sort().map(key => `${JSON.stringify(key)}:${canonicalJson(record[key])}`).join(",")}}`;
    }
    return JSON.stringify(value);
}

function manifestsMatch(left: DatasetManifest, right?: DatasetManifest): boolean {
    return Boolean(right) && canonicalJson(left) === canonicalJson(right);
}

function cloneTelemetry(telemetry: PublisherTelemetry): PublisherTelemetry {
    return { ...telemetry, reasons: Object.fromEntries(Object.entries(telemetry.reasons).sort()) };
}

function newTelemetry(): PublisherTelemetry {
    return { list: 0, head: 0, get: 0, put: 0, retries: 0, bytesRead: 0, bytesPutAttempted: 0, reasons: {} };
}

function recordReason(telemetry: PublisherTelemetry, operation: "LIST" | "GET" | "PUT" | "RETRY", reason: string): void {
    const key = `${operation}:${reason}`;
    telemetry.reasons[key] = (telemetry.reasons[key] ?? 0) + 1;
}

function retryReason(error: unknown): string {
    const status = errorStatus(error);
    if (status === 429) return "http-429";
    if (status !== undefined && status >= 500 && status <= 599) return "http-5xx";
    const name = String((error as any)?.name ?? "");
    const code = String((error as any)?.code ?? "");
    if (/(?:Throttl|SlowDown)/i.test(`${name} ${code}`)) return "throttling";
    if (/(?:Timeout|RequestTimeout|ETIMEDOUT)/i.test(`${name} ${code}`)) return "timeout";
    return "network-transient";
}

function errorStatus(error: unknown): number | undefined {
    const status = (error as any)?.$metadata?.httpStatusCode ?? (error as any)?.statusCode ?? (error as any)?.status;
    return typeof status === "number" ? status : undefined;
}

export function isMissingS3ObjectError(error: unknown): boolean {
    const name = String((error as any)?.name ?? "");
    return errorStatus(error) === 404 || /^(?:NoSuchKey|NotFound)$/.test(name);
}

export function isPreconditionS3Error(error: unknown): boolean {
    const name = String((error as any)?.name ?? "");
    return errorStatus(error) === 409 || errorStatus(error) === 412
        || /^(?:ConditionalRequestConflict|PreconditionFailed)$/.test(name);
}

export function isRetryableS3Error(error: unknown): boolean {
    const status = errorStatus(error);
    if (status === 429 || (status !== undefined && status >= 500 && status <= 599)) return true;
    const name = String((error as any)?.name ?? "");
    const code = String((error as any)?.code ?? "");
    const message = error instanceof Error ? error.message : String(error);
    return /(?:Timeout|Throttl|SlowDown|RequestTimeout|NetworkingError)/i.test(`${name} ${code}`)
        || /(?:ECONNRESET|ECONNREFUSED|ETIMEDOUT|EAI_AGAIN|ENETUNREACH|fetch failed|socket hang up)/i.test(message)
        || /cloudflarestatus\.com for issues or contact customer support/i.test(message);
}

export async function withBoundedR2Retry<T>(
    operation: (signal: AbortSignal) => Promise<T>,
    telemetry: PublisherTelemetry,
    policy: RetryPolicy = DEFAULT_R2_RETRY_POLICY,
    retryResult?: (value: T) => boolean,
): Promise<T> {
    const attemptTimeoutMs = policy.attemptTimeoutMs ?? DEFAULT_R2_RETRY_POLICY.attemptTimeoutMs!;
    const setTimer = policy.setTimer ?? DEFAULT_R2_RETRY_POLICY.setTimer!;
    const clearTimer = policy.clearTimer ?? DEFAULT_R2_RETRY_POLICY.clearTimer!;
    if (!Number.isSafeInteger(attemptTimeoutMs) || attemptTimeoutMs < 1 || attemptTimeoutMs > 60_000
        || policy.delaysMs.length > DEFAULT_R2_RETRY_POLICY.delaysMs.length
        || policy.delaysMs.some(delay => !Number.isSafeInteger(delay) || delay < 0 || delay > 5_000)
        || !Number.isSafeInteger(policy.maxBackoffMs) || policy.maxBackoffMs < 0 || policy.maxBackoffMs > 5_000) {
        throw new Error("R2 retry/timeout policy exceeds the explicit safety ceiling.");
    }
    for (let attempt = 0; ; attempt += 1) {
        let reason: string | undefined;
        try {
            const controller = new AbortController();
            let timerHandle: unknown;
            const timeout = new Promise<never>((_resolve, reject) => {
                timerHandle = setTimer(() => {
                    const error = Object.assign(new Error(`R2 attempt timed out after ${attemptTimeoutMs} ms.`), {
                        name: "RequestTimeout",
                        code: "ETIMEDOUT",
                    });
                    reject(error);
                    controller.abort();
                }, attemptTimeoutMs);
            });
            let value: T;
            try {
                value = await Promise.race([operation(controller.signal), timeout]);
            } finally {
                clearTimer(timerHandle);
            }
            if (!retryResult?.(value) || attempt >= policy.delaysMs.length) return value;
            reason = "transient-result";
        } catch (error) {
            if (!isRetryableS3Error(error) || attempt >= policy.delaysMs.length) throw error;
            reason = retryReason(error);
        }
        telemetry.retries += 1;
        recordReason(telemetry, "RETRY", reason!);
        const base = policy.delaysMs[attempt];
        const jitterWindow = Math.min(250, Math.max(1, base));
        const jitter = Math.floor(Math.max(0, Math.min(0.999999, policy.jitter())) * jitterWindow);
        await policy.sleep(Math.min(policy.maxBackoffMs, base + jitter));
    }
}

function assertExecutorAuthorization(input: VerifiedPublicationInput): void {
    if (input.verificationOnly) {
        if (!input.fullAudit
            || input.target !== "remote"
            || input.dryRun
            || input.skipRemoteManifestCheck
            || input.promoteProduction) {
            throw new Error(
                "Receipt bootstrap requires remote --full-audit with an active baseline check, "
                + "without dry-run or production promotion.",
            );
        }
    }
    assertDatasetPublicationWriteAuthorized({
        channel: input.channel,
        target: input.target,
        dryRun: input.dryRun || input.verificationOnly,
        promoteProduction: input.promoteProduction,
    });
    if (!Number.isSafeInteger(input.concurrency) || input.concurrency < 1 || input.concurrency > 64) {
        throw new Error("Character publication concurrency must be an integer from 1 through 64.");
    }
    if (input.target !== "remote" || (input.dryRun && !input.verificationOnly)) return;
    if (input.skipRemoteManifestCheck) {
        throw new Error("Remote Character publication cannot skip the baseline manifest check.");
    }
    if (Boolean(input.expectedRemoteBaselineSha256) === input.expectRemoteManifestAbsent) {
        throw new Error("Remote Character publication requires exactly one baseline pin.");
    }
    if (input.expectedRemoteBaselineSha256 && !isSha256(input.expectedRemoteBaselineSha256)) {
        throw new Error("Remote Character publication baseline SHA-256 is invalid.");
    }
}

function datasetVersionSlug(datasetVersion: string): string {
    return datasetVersion
        .trim()
        .replace(/[:]/g, "-")
        .replace(/[^\w./-]/g, "_");
}

export function canonicalCharacterDatasetObjectKey(
    manifest: Pick<DatasetManifest, "datasetVersion" | "sha256">,
    channel: DatasetPublicationChannel,
    contractLane: DatasetContractLane,
): string {
    return contractLaneObjectKey(
        channel,
        contractLane,
        `releases/${datasetVersionSlug(manifest.datasetVersion)}/${manifest.sha256.toLowerCase()}/characters.json.gz`,
    );
}

function assertCandidateManifestBinding(input: VerifiedPublicationInput): void {
    const expectedManifestObjectKey = contractLaneObjectKey(
        input.channel,
        input.contractLane,
        "characters-manifest.json",
    );
    const expectedDatasetObjectKey = canonicalCharacterDatasetObjectKey(
        input.candidateManifest,
        input.channel,
        input.contractLane,
    );
    if (input.manifestObjectKey !== expectedManifestObjectKey
        || input.datasetObjectKey !== expectedDatasetObjectKey) {
        throw new Error("Character manifest or payload key is not canonical for the selected publication lane.");
    }
    let parsed: unknown;
    try {
        parsed = JSON.parse(input.candidateManifestBytes.toString("utf8")) as unknown;
    } catch {
        throw new Error("Character candidate manifest bytes are not valid JSON.");
    }
    if (!isRecord(parsed) || canonicalJson(parsed) !== canonicalJson(input.candidateManifest)) {
        throw new Error("Character candidate manifest bytes do not match the candidate manifest object.");
    }
    if (input.candidateManifest.fileName !== input.datasetObjectKey
        || input.candidateManifest.sha256 !== hash(input.datasetBytes)
        || input.candidateManifest.sizeBytes !== input.datasetBytes.byteLength) {
        throw new Error("Character candidate manifest is not bound to the exact immutable payload key and bytes.");
    }
    if (input.candidateManifestBytes.byteLength > CHARACTER_BODY_LIMITS.manifest
        || input.datasetBytes.byteLength > CHARACTER_BODY_LIMITS.dataset) {
        throw new Error("Character manifest or payload exceeds its explicit body limit.");
    }
}

async function getObject(
    store: CharacterObjectStore,
    key: string,
    reason: string,
    telemetry: PublisherTelemetry,
    policy: RetryPolicy,
    options: RemoteGetOptions,
    retryMissing = false,
): Promise<RemoteObjectRead | undefined> {
    try {
        return await withBoundedR2Retry(async signal => {
            telemetry.get += 1;
            recordReason(telemetry, "GET", reason);
            const value = await store.get(key, options, signal);
            if (value) {
                if (!isSafeSize(value.sizeBytes)
                    || value.sizeBytes !== value.bytes.byteLength
                    || value.sizeBytes > options.maxBytes
                    || (options.expectedSizeBytes !== undefined && value.sizeBytes > options.expectedSizeBytes)
                    || !isOpaqueEtag(value.etag)
                    || !isRemoteTimestamp(value.lastModified)
                    || !isSafeMetadata(value.contentType)
                    || !isSafeMetadata(value.cacheControl)) {
                    value.release?.();
                    throw new Error(`Malformed R2 GET metadata for ${key}.`);
                }
                telemetry.bytesRead += value.bytes.byteLength;
            }
            return value;
        }, telemetry, policy, retryMissing ? value => value === undefined : undefined);
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`R2 GET failed for ${key} (${reason}): ${message}`, { cause: error });
    }
}

async function putObject(
    store: CharacterObjectStore,
    key: string,
    bytes: Buffer,
    contentType: string,
    cacheControl: string,
    condition: { ifNoneMatch: true } | { ifMatch: string },
    reason: string,
    telemetry: PublisherTelemetry,
    policy: RetryPolicy,
): Promise<ConditionalPutResult> {
    return withBoundedR2Retry(async signal => {
        telemetry.put += 1;
        telemetry.bytesPutAttempted += bytes.byteLength;
        recordReason(telemetry, "PUT", reason);
        return store.put(key, bytes, contentType, cacheControl, condition, signal);
    }, telemetry, policy);
}

function parseRemoteManifest(value: RemoteObjectRead | undefined, key: string): BaselineObservation {
    if (!value) return {};
    try {
        if (!metadataMatches(value, MANIFEST_CONTENT_TYPE, MANIFEST_CACHE_CONTROL)) {
            throw new Error("Content-Type or Cache-Control is invalid");
        }
        const parsed = JSON.parse(value.bytes.toString("utf8")) as unknown;
        if (!isRecord(parsed) || !isSha256(parsed.sha256) || typeof parsed.datasetVersion !== "string"
            || typeof parsed.fileName !== "string" || !isSafeSize(parsed.sizeBytes)) {
            throw new Error("required fields are missing or invalid");
        }
        return { object: value, manifest: parsed as unknown as DatasetManifest };
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`Character remote manifest ${key} is invalid: ${message}`);
    }
}

function assertBaselinePin(input: VerifiedPublicationInput, baseline: BaselineObservation): void {
    if (input.skipRemoteManifestCheck) return;
    if (input.expectedRemoteBaselineSha256 && input.expectRemoteManifestAbsent) {
        throw new Error("Choose exactly one remote manifest baseline pin.");
    }
    if (input.expectRemoteManifestAbsent) {
        if (baseline.manifest) throw new Error(`Character remote manifest was expected to be absent but now points to ${baseline.manifest.sha256}.`);
        return;
    }
    if (!input.expectedRemoteBaselineSha256) return;
    if (!baseline.manifest) throw new Error("Cannot prove the expected remote baseline without the remote manifest.");
    if (baseline.manifest.sha256.toLowerCase() !== input.expectedRemoteBaselineSha256) {
        throw new Error(`Remote Character baseline changed: expected ${input.expectedRemoteBaselineSha256}, found ${baseline.manifest.sha256.toLowerCase()}.`);
    }
}

function sameObservation(left: BaselineObservation, right: BaselineObservation): boolean {
    if (!left.object || !right.object) return !left.object && !right.object;
    return left.object.etag === right.object.etag
        && left.object.lastModified === right.object.lastModified
        && left.object.contentType === right.object.contentType
        && left.object.cacheControl === right.object.cacheControl
        && left.object.bytes.equals(right.object.bytes);
}

function assessState(input: VerifiedPublicationInput, baseline: BaselineObservation): StateAssessment {
    if (input.fullAudit) return { stateTrust: "full-audit", reason: "explicit-full-audit", legacySchema1: false };
    if (input.previousState === undefined) return { stateTrust: "untrusted", reason: "state-missing", legacySchema1: false };
    if (!isRecord(input.previousState)) return { stateTrust: "untrusted", reason: "state-malformed", legacySchema1: false };
    if (input.previousState.schemaVersion === 1) {
        return { stateTrust: "untrusted", reason: "schema-1-requires-full-audit", legacySchema1: true };
    }
    if (input.previousState.schemaVersion !== 2) {
        return { stateTrust: "untrusted", reason: "state-schema-unsupported", legacySchema1: false };
    }
    const state = input.previousState as unknown as DatasetPublishStateV2;
    const expected = [
        state.bucket === input.bucket,
        state.target === input.target,
        state.channel === input.channel,
        state.contractLane === input.contractLane,
        state.manifestObjectKey === input.manifestObjectKey,
        baseline.object !== undefined,
        state.manifestSha256 === (baseline.object ? hash(baseline.object.bytes) : ""),
        state.datasetVersion === baseline.manifest?.datasetVersion,
        state.datasetObjectKey === baseline.manifest?.fileName,
        state.datasetSha256 === baseline.manifest?.sha256,
        state.datasetSizeBytes === baseline.manifest?.sizeBytes,
        isSha256(state.portraitInventorySha256),
        isRecord(state.portraits),
    ];
    if (expected.some(matches => !matches)) {
        return { stateTrust: "untrusted", reason: "schema-2-binding-mismatch", legacySchema1: false };
    }
    for (const [key, receiptValue] of Object.entries(state.portraits)) {
        if (!isRecord(receiptValue)) return { stateTrust: "untrusted", reason: "schema-2-portrait-malformed", legacySchema1: false };
        const receipt = receiptValue as unknown as VerifiedPortraitReceipt;
        if (receipt.key !== key || !isSha256(receipt.sha256) || !isSafeSize(receipt.sizeBytes)
            || !isOpaqueEtag(receipt.etag)
            || !isRemoteTimestamp(receipt.lastModified)
            || receipt.contentType !== PORTRAIT_CONTENT_TYPE
            || receipt.cacheControl !== IMMUTABLE_CACHE_CONTROL
            || !["full-get-sha256", "post-upload-sha256"].includes(receipt.verificationMethod)) {
            return { stateTrust: "untrusted", reason: "schema-2-portrait-malformed", legacySchema1: false };
        }
    }
    const receiptInventoryDigest = portraitInventorySha256(Object.values(state.portraits).map(receipt => ({
        key: receipt.key,
        sizeBytes: receipt.sizeBytes,
        etag: receipt.etag,
        lastModified: receipt.lastModified,
    })));
    if (receiptInventoryDigest !== state.portraitInventorySha256) {
        return { stateTrust: "untrusted", reason: "schema-2-inventory-digest-mismatch", legacySchema1: false };
    }
    return { trusted: state, stateTrust: "trusted-schema-2", reason: "schema-2-bound-to-verified-baseline", legacySchema1: false };
}

function portraitPrefixForKey(key: string, channel: DatasetPublicationChannel, lane: DatasetContractLane): string {
    const escapedLaneRoot = channel === "staging" ? `staging/${lane}` : lane;
    if (key.startsWith(`${escapedLaneRoot}/images/`)) return `${escapedLaneRoot}/images/`;
    if (channel === "production" && lane === "v1") {
        if (/^images\/portrait_[0-9]+\.png$/.test(key)) return "images/portrait_";
        if (/^images\/v2\/portrait_[0-9]+\.png$/.test(key)) return "images/v2/";
        if (/^images\/v3\/portrait_[0-9]+\.[a-f0-9]{64}\.png$/.test(key)) return "images/v3/";
    }
    throw new Error(`Portrait object key does not belong to requested ${channel}/${lane}: ${key}`);
}

function assertManagedInventoryKey(key: string, prefix: string, channel: DatasetPublicationChannel, lane: DatasetContractLane): void {
    if (!key.startsWith(prefix) || key.includes("\\") || key.includes("//") || key.split("/").includes("..")) {
        throw new Error(`R2 inventory returned an out-of-prefix or unsafe key for ${prefix}: ${key}`);
    }
    const laneRoot = channel === "staging" ? `staging/${lane}` : lane;
    const valid = prefix === "images/portrait_"
        ? /^images\/portrait_[0-9]+\.png$/.test(key)
        : prefix === "images/v2/"
            ? /^images\/v2\/portrait_[0-9]+\.png$/.test(key)
            : prefix === "images/v3/"
                ? /^images\/v3\/portrait_[0-9]+\.[a-f0-9]{64}\.png$/.test(key)
                : new RegExp(`^${laneRoot.replace("/", "\\/")}\\/images\\/(?:v4\\/portrait_[0-9]+\\.[a-f0-9]{64}\\.png|v5\\/layers\\/(?:background|thumb|overlay)\\.[a-f0-9]{64}\\.png)$`).test(key);
    if (!valid) throw new Error(`R2 inventory returned a malformed managed portrait key: ${key}`);
}

export function portraitInventorySha256(inventory: Iterable<RemoteInventoryObject>): string {
    const canonical = Array.from(inventory)
        .sort((left, right) => left.key.localeCompare(right.key))
        .map(value => `${JSON.stringify(value.key)}\t${value.sizeBytes}\t${JSON.stringify(value.etag)}\n`)
        .join("");
    return hash(Buffer.from(canonical, "utf8"));
}

async function collectInventory(
    store: CharacterObjectStore,
    portraits: VerifiedPortraitEntry[],
    input: VerifiedPublicationInput,
    telemetry: PublisherTelemetry,
    policy: RetryPolicy,
): Promise<Map<string, RemoteInventoryObject>> {
    const inventory = new Map<string, RemoteInventoryObject>();
    if (!store.supportsInventory || input.skipPortraits) return inventory;
    const prefixes = Array.from(new Set(portraits.map(entry => portraitPrefixForKey(entry.objectKey, input.channel, input.contractLane))).values()).sort();
    for (const prefix of prefixes) {
        let continuationToken: string | undefined;
        const seenTokens = new Set<string>();
        for (;;) {
            const page = await withBoundedR2Retry(async signal => {
                telemetry.list += 1;
                recordReason(telemetry, "LIST", `portrait-inventory:${prefix}`);
                return store.listPage(prefix, continuationToken, signal);
            }, telemetry, policy);
            for (const value of page.objects) {
                assertManagedInventoryKey(value.key, prefix, input.channel, input.contractLane);
                if (!isSafeSize(value.sizeBytes) || !isOpaqueEtag(value.etag) || !isRemoteTimestamp(value.lastModified)) {
                    throw new Error(`R2 inventory returned malformed metadata for ${value.key}.`);
                }
                if (inventory.has(value.key)) throw new Error(`R2 inventory returned duplicate key: ${value.key}`);
                inventory.set(value.key, { ...value });
            }
            if (!page.isTruncated) break;
            if (!page.nextContinuationToken || seenTokens.has(page.nextContinuationToken)) {
                throw new Error(`R2 inventory pagination for ${prefix} returned an invalid continuation token.`);
            }
            seenTokens.add(page.nextContinuationToken);
            continuationToken = page.nextContinuationToken;
        }
    }
    return inventory;
}

function receiptMatches(entry: VerifiedPortraitEntry, remote: RemoteInventoryObject, receipt?: VerifiedPortraitReceipt): boolean {
    return Boolean(receipt
        && receipt.key === entry.objectKey
        && receipt.sha256 === entry.sha256
        && receipt.sizeBytes === entry.sizeBytes
        && remote.sizeBytes === entry.sizeBytes
        && remote.etag === receipt.etag
        && Math.floor(Date.parse(remote.lastModified) / 1_000) === Math.floor(Date.parse(receipt.lastModified) / 1_000)
        && receipt.contentType === PORTRAIT_CONTENT_TYPE
        && receipt.cacheControl === IMMUTABLE_CACHE_CONTROL);
}

function metadataMatches(value: RemoteObjectRead, contentType: string, cacheControl: string): boolean {
    return value.contentType === contentType && value.cacheControl === cacheControl;
}

function exactRemote(
    value: RemoteObjectRead | undefined,
    bytes: Buffer,
    expectedSha256: string,
    contentType: string,
    cacheControl: string,
): boolean {
    return Boolean(value
        && value.sizeBytes === bytes.byteLength
        && hash(value.bytes) === expectedSha256
        && value.bytes.equals(bytes)
        && metadataMatches(value, contentType, cacheControl));
}

function exactRemotePortrait(value: RemoteObjectRead | undefined, entry: VerifiedPortraitEntry): boolean {
    return Boolean(value
        && value.sizeBytes === entry.sizeBytes
        && hash(value.bytes) === entry.sha256
        && metadataMatches(value, PORTRAIT_CONTENT_TYPE, IMMUTABLE_CACHE_CONTROL));
}

async function verifyCreateOnlyObject(
    store: CharacterObjectStore,
    key: string,
    bytes: Buffer,
    expectedSha256: string,
    contentType: string,
    cacheControl: string,
    label: "dataset" | "portrait",
    telemetry: PublisherTelemetry,
    policy: RetryPolicy,
): Promise<{ proof: RemoteObjectProof, method: PortraitVerificationMethod }> {
    const putResult = await putObject(store, key, bytes, contentType, cacheControl, { ifNoneMatch: true }, `${label}-create-only`, telemetry, policy);
    let readback: RemoteObjectRead | undefined;
    try {
        readback = await getObject(
            store,
            key,
            `${label}-post-upload-readback`,
            telemetry,
            policy,
            {
                maxBytes: label === "portrait" ? CHARACTER_BODY_LIMITS.portrait : CHARACTER_BODY_LIMITS.dataset,
                expectedSizeBytes: bytes.byteLength,
            },
            putResult === "written",
        );
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`${label === "portrait" ? "Uploaded portrait" : "Uploaded Character payload"} failed bounded readback: ${key}: ${message}`);
    }
    try {
        if (!exactRemote(readback, bytes, expectedSha256, contentType, cacheControl)) {
            throw new Error(`${label === "portrait" ? "Uploaded portrait" : "Uploaded Character payload"} failed exact size/SHA-256/metadata readback: ${key}`);
        }
        const { sizeBytes, etag, lastModified, contentType: verifiedContentType, cacheControl: verifiedCacheControl } = readback!;
        return {
            proof: {
                sizeBytes,
                etag,
                lastModified,
                contentType: verifiedContentType,
                cacheControl: verifiedCacheControl,
            },
            method: putResult === "written" ? "post-upload-sha256" : "full-get-sha256",
        };
    } finally {
        readback?.release?.();
    }
}

function buildState(
    input: VerifiedPublicationInput,
    manifestProof: RemoteObjectRead,
    receipts: Map<string, VerifiedPortraitReceipt>,
): DatasetPublishStateV2 {
    const portraits = Object.fromEntries(Array.from(receipts.entries()).sort(([left], [right]) => left.localeCompare(right)));
    return {
        schemaVersion: 2,
        bucket: input.bucket,
        target: input.target,
        channel: input.channel,
        contractLane: input.contractLane,
        manifestObjectKey: input.manifestObjectKey,
        manifestSha256: hash(manifestProof.bytes),
        datasetVersion: input.candidateManifest.datasetVersion,
        datasetObjectKey: input.datasetObjectKey,
        datasetSha256: input.candidateManifest.sha256,
        datasetSizeBytes: input.datasetBytes.byteLength,
        portraitInventorySha256: portraitInventorySha256(Array.from(receipts.values()).map(receipt => ({
            key: receipt.key,
            sizeBytes: receipt.sizeBytes,
            etag: receipt.etag,
            lastModified: receipt.lastModified,
        }))),
        verifiedAt: (input.now ?? (() => new Date().toISOString()))(),
        portraits,
    };
}

async function mapWithConcurrency<T, R>(
    items: readonly T[],
    concurrency: number,
    task: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
    const results = new Array<R>(items.length);
    let nextIndex = 0;
    const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
        for (;;) {
            const index = nextIndex;
            if (index >= items.length) return;
            nextIndex += 1;
            results[index] = await task(items[index], index);
        }
    });
    await Promise.all(workers);
    return results;
}

function receiptFromObservation(
    entry: VerifiedPortraitEntry,
    observed: RemoteObjectProof,
    verificationMethod: PortraitVerificationMethod,
): VerifiedPortraitReceipt {
    return {
        key: entry.objectKey,
        sha256: entry.sha256,
        sizeBytes: entry.sizeBytes,
        etag: observed.etag,
        lastModified: observed.lastModified,
        contentType: observed.contentType,
        cacheControl: observed.cacheControl,
        verificationMethod,
    };
}

async function loadVerifiedPortraitBytes(entry: VerifiedPortraitEntry): Promise<Buffer> {
    const bytes = await entry.loadBytes();
    if (!Buffer.isBuffer(bytes)
        || bytes.byteLength !== entry.sizeBytes
        || bytes.byteLength > CHARACTER_BODY_LIMITS.portrait
        || hash(bytes) !== entry.sha256) {
        throw new Error(`Local portrait changed after validation: ${entry.objectKey}`);
    }
    return bytes;
}

interface PortraitAssessment {
    entry: VerifiedPortraitEntry,
    decision: VerifiedPublicationDecision,
    receipt?: VerifiedPortraitReceipt,
    upload: boolean,
    fullGet: boolean,
    witness?: RemoteInventoryObject,
}

export async function executeVerifiedCharacterPublication(
    input: VerifiedPublicationInput,
    store: CharacterObjectStore,
): Promise<VerifiedPublicationResult> {
    assertExecutorAuthorization(input);
    assertCandidateManifestBinding(input);
    const telemetry = newTelemetry();
    const policy = input.retryPolicy ?? DEFAULT_R2_RETRY_POLICY;
    const portraits = [...input.portraits].sort((left, right) => left.objectKey.localeCompare(right.objectKey));
    if (new Set(portraits.map(entry => entry.objectKey)).size !== portraits.length) throw new Error("Duplicate local portrait object key.");
    for (const entry of portraits) {
        portraitPrefixForKey(entry.objectKey, input.channel, input.contractLane);
        if (!isSha256(entry.sha256)
            || !isSafeSize(entry.sizeBytes)
            || entry.sizeBytes > CHARACTER_BODY_LIMITS.portrait
            || typeof entry.loadBytes !== "function") {
            throw new Error(`Local portrait descriptor is invalid: ${entry.objectKey}`);
        }
    }
    if (hash(input.datasetBytes) !== input.candidateManifest.sha256 || input.datasetBytes.byteLength !== input.candidateManifest.sizeBytes) {
        throw new Error("Local Character payload is not bound to its manifest.");
    }

    const manifestGetOptions = { maxBytes: CHARACTER_BODY_LIMITS.manifest };
    const initialBaseline = parseRemoteManifest(
        await getObject(store, input.manifestObjectKey, "baseline-initial", telemetry, policy, manifestGetOptions),
        input.manifestObjectKey,
    );
    assertBaselinePin(input, initialBaseline);
    const stateAssessment = assessState(input, initialBaseline);
    if (stateAssessment.legacySchema1 && !input.fullAudit) {
        throw new Error("Character publication state schema 1 requires an explicit --full-audit bootstrap before schema 2 reuse.");
    }

    const inventory = await collectInventory(store, portraits, input, telemetry, policy);
    const datasetGetOptions = {
        maxBytes: CHARACTER_BODY_LIMITS.dataset,
        expectedSizeBytes: input.datasetBytes.byteLength,
    };
    const datasetRemote = await getObject(store, input.datasetObjectKey, "dataset-preflight", telemetry, policy, datasetGetOptions);
    if (datasetRemote && !exactRemote(
        datasetRemote,
        input.datasetBytes,
        input.candidateManifest.sha256,
        DATASET_CONTENT_TYPE,
        IMMUTABLE_CACHE_CONTROL,
    )) {
        throw new Error(`Immutable Character payload conflict: ${input.datasetObjectKey}`);
    }
    const datasetNeedsUpload = datasetRemote === undefined;
    const manifestNeedsUpload = !manifestsMatch(input.candidateManifest, initialBaseline.manifest);

    const assessments = input.skipPortraits ? [] : await mapWithConcurrency(
        portraits,
        input.concurrency,
        async (entry): Promise<PortraitAssessment> => {
            let remote = inventory.get(entry.objectKey);
            if (store.supportsInventory && !remote) {
                return {
                    entry,
                    decision: { key: entry.objectKey, decision: "upload-create-only", reason: "object-missing" },
                    upload: true,
                    fullGet: false,
                };
            }
            if (store.supportsInventory) {
                const previousReceipt = stateAssessment.trusted?.portraits[entry.objectKey];
                if (!input.fullAudit && receiptMatches(entry, remote!, previousReceipt)) {
                    return {
                        entry,
                        decision: { key: entry.objectKey, decision: "reuse-receipt", reason: "schema-2-remote-witness-match" },
                        receipt: previousReceipt,
                        upload: false,
                        fullGet: false,
                    };
                }
            }

            const reason = !store.supportsInventory
                ? "portrait-local-full-audit"
                : input.fullAudit
                    ? "portrait-full-audit"
                    : stateAssessment.trusted
                        ? "portrait-inventory-drift"
                        : "portrait-untrusted-state";
            const observed = await getObject(
                store,
                entry.objectKey,
                reason,
                telemetry,
                policy,
                {
                    maxBytes: CHARACTER_BODY_LIMITS.portrait,
                    expectedSizeBytes: remote?.sizeBytes ?? entry.sizeBytes,
                },
            );
            if (!observed) {
                if (!store.supportsInventory) {
                    return {
                        entry,
                        decision: { key: entry.objectKey, decision: "upload-create-only", reason: "object-missing" },
                        upload: true,
                        fullGet: true,
                    };
                }
                return {
                    entry,
                    decision: { key: entry.objectKey, decision: "conflict", reason: "inventory-get-race" },
                    upload: false,
                    fullGet: true,
                };
            }
            try {
                if (!exactRemotePortrait(observed, entry)) {
                    return {
                        entry,
                        decision: { key: entry.objectKey, decision: "conflict", reason: "remote-bytes-or-metadata-differ" },
                        upload: false,
                        fullGet: true,
                    };
                }
                return {
                    entry,
                    decision: { key: entry.objectKey, decision: "reuse-full-get", reason },
                    receipt: receiptFromObservation(entry, observed, "full-get-sha256"),
                    upload: false,
                    fullGet: true,
                    witness: {
                        key: entry.objectKey,
                        sizeBytes: observed.sizeBytes,
                        etag: observed.etag,
                        lastModified: observed.lastModified,
                    },
                };
            } finally {
                observed.release?.();
            }
        },
    );

    const receipts = new Map<string, VerifiedPortraitReceipt>();
    for (const assessment of assessments) {
        if (assessment.receipt) receipts.set(assessment.entry.objectKey, assessment.receipt);
        if (assessment.witness) inventory.set(assessment.entry.objectKey, assessment.witness);
    }
    const uploads = assessments.filter(value => value.upload).map(value => value.entry);
    const decisions = assessments.map(value => value.decision);
    const conflicts = decisions.filter(decision => decision.decision === "conflict");
    const plan: VerifiedPublicationPlan = {
        stateTrust: stateAssessment.stateTrust,
        stateReason: stateAssessment.reason,
        portraitReferencedCount: portraits.length,
        portraitReuseCount: assessments.filter(value => value.receipt).length,
        portraitFullGetCount: assessments.filter(value => value.fullGet).length,
        portraitUploadCount: uploads.length,
        portraitConflictCount: conflicts.length,
        datasetUploadCount: datasetNeedsUpload ? 1 : 0,
        manifestUploadCount: manifestNeedsUpload ? 1 : 0,
        prospectiveUploadBytes: (datasetNeedsUpload ? input.datasetBytes.byteLength : 0)
            + uploads.reduce((total, entry) => total + entry.sizeBytes, 0)
            + (manifestNeedsUpload ? input.candidateManifestBytes.byteLength : 0),
        decisions,
        telemetry,
    };
    if (conflicts.length > 0) {
        const error = new Error(`Immutable portrait conflict(s): ${conflicts.map(value => value.key).join(", ")}`);
        (error as any).plan = { ...plan, telemetry: cloneTelemetry(telemetry) };
        throw error;
    }
    if (input.verificationOnly
        && (plan.datasetUploadCount > 0 || plan.portraitUploadCount > 0 || plan.manifestUploadCount > 0)) {
        const error = new Error(
            "Receipt bootstrap requires an exact remote snapshot with zero planned dataset, portrait, or manifest writes.",
        );
        (error as any).plan = { ...plan, telemetry: cloneTelemetry(telemetry) };
        throw error;
    }
    await input.validatePlan?.({ ...plan, telemetry: cloneTelemetry(telemetry) });
    if (input.dryRun) return { plan: { ...plan, telemetry: cloneTelemetry(telemetry) } };

    if (input.verificationOnly) {
        const finalBaseline = parseRemoteManifest(
            await getObject(
                store,
                input.manifestObjectKey,
                "baseline-before-receipt-bootstrap",
                telemetry,
                policy,
                manifestGetOptions,
            ),
            input.manifestObjectKey,
        );
        assertBaselinePin(input, finalBaseline);
        if (!sameObservation(initialBaseline, finalBaseline)) {
            throw new Error("Character manifest baseline raced before receipt bootstrap.");
        }
        if (!finalBaseline.object || telemetry.put !== 0) {
            throw new Error("Receipt bootstrap cannot write state without a final zero-PUT baseline proof.");
        }
        const state = buildState(input, finalBaseline.object, receipts);
        await input.writeState?.(state);
        plan.telemetry = cloneTelemetry(telemetry);
        return { plan, state };
    }

    const hasWrites = datasetNeedsUpload || uploads.length > 0 || manifestNeedsUpload;
    if (hasWrites) {
        const beforeWrites = parseRemoteManifest(
            await getObject(store, input.manifestObjectKey, "baseline-before-first-write", telemetry, policy, manifestGetOptions),
            input.manifestObjectKey,
        );
        assertBaselinePin(input, beforeWrites);
        if (!sameObservation(initialBaseline, beforeWrites)) throw new Error("Character manifest baseline raced before the first write.");
    }

    if (datasetNeedsUpload) {
        await verifyCreateOnlyObject(
            store,
            input.datasetObjectKey,
            input.datasetBytes,
            input.candidateManifest.sha256,
            DATASET_CONTENT_TYPE,
            IMMUTABLE_CACHE_CONTROL,
            "dataset",
            telemetry,
            policy,
        );
    }

    const uploadedPortraits = await mapWithConcurrency(uploads, input.concurrency, async entry => {
        const bytes = await loadVerifiedPortraitBytes(entry);
        const verified = await verifyCreateOnlyObject(
            store,
            entry.objectKey,
            bytes,
            entry.sha256,
            PORTRAIT_CONTENT_TYPE,
            IMMUTABLE_CACHE_CONTROL,
            "portrait",
            telemetry,
            policy,
        );
        return {
            entry,
            witness: {
                key: entry.objectKey,
                sizeBytes: verified.proof.sizeBytes,
                etag: verified.proof.etag,
                lastModified: verified.proof.lastModified,
            } as RemoteInventoryObject,
            receipt: receiptFromObservation(entry, verified.proof, verified.method),
        };
    });
    for (const { entry, witness, receipt } of uploadedPortraits) {
        inventory.set(entry.objectKey, witness);
        receipts.set(entry.objectKey, receipt);
    }

    let manifestProof = initialBaseline.object;
    if (manifestNeedsUpload) {
        const datasetBeforeManifest = await getObject(
            store,
            input.datasetObjectKey,
            "dataset-before-manifest",
            telemetry,
            policy,
            datasetGetOptions,
        );
        if (!exactRemote(
            datasetBeforeManifest,
            input.datasetBytes,
            input.candidateManifest.sha256,
            DATASET_CONTENT_TYPE,
            IMMUTABLE_CACHE_CONTROL,
        )) {
            throw new Error(`Character payload changed before manifest promotion: ${input.datasetObjectKey}`);
        }
        const beforeManifest = parseRemoteManifest(
            await getObject(store, input.manifestObjectKey, "baseline-before-manifest", telemetry, policy, manifestGetOptions),
            input.manifestObjectKey,
        );
        assertBaselinePin(input, beforeManifest);
        if (!sameObservation(initialBaseline, beforeManifest)) throw new Error("Character manifest baseline raced before manifest promotion.");
        const condition = initialBaseline.object
            ? { ifMatch: initialBaseline.object.etag } as const
            : { ifNoneMatch: true } as const;
        const result = await putObject(
            store,
            input.manifestObjectKey,
            input.candidateManifestBytes,
            MANIFEST_CONTENT_TYPE,
            MANIFEST_CACHE_CONTROL,
            condition,
            "manifest-last",
            telemetry,
            policy,
        );
        if (result !== "written") throw new Error("Character manifest conditional promotion lost a baseline race.");
        manifestProof = await getObject(
            store,
            input.manifestObjectKey,
            "manifest-exact-readback",
            telemetry,
            policy,
            { maxBytes: CHARACTER_BODY_LIMITS.manifest, expectedSizeBytes: input.candidateManifestBytes.byteLength },
            true,
        );
        if (!manifestProof
            || !manifestProof.bytes.equals(input.candidateManifestBytes)
            || !metadataMatches(manifestProof, MANIFEST_CONTENT_TYPE, MANIFEST_CACHE_CONTROL)) {
            throw new Error("Uploaded Character manifest failed exact byte-for-byte/metadata readback.");
        }
    }
    if (!manifestProof) throw new Error("Character manifest verification is unavailable after publication.");

    const state = buildState(input, manifestProof, receipts);
    await input.writeState?.(state);
    plan.telemetry = cloneTelemetry(telemetry);
    return { plan, state };
}

export async function readBoundedS3Body(
    body: unknown,
    contentLength: unknown,
    maxBytes: number,
    expectedSizeBytes?: number,
    signal?: AbortSignal,
): Promise<Buffer> {
    if (!Number.isSafeInteger(maxBytes) || maxBytes < 0) throw new Error("R2 GET body limit is invalid.");
    if (!isSafeSize(contentLength)) throw new Error("R2 GET ContentLength is missing or invalid.");
    if (contentLength > maxBytes || (expectedSizeBytes !== undefined && contentLength > expectedSizeBytes)) {
        throw new Error("R2 GET ContentLength exceeds the allowed body limit.");
    }
    if (!body || !(Symbol.asyncIterator in Object(body))) throw new Error("R2 GET returned a non-streaming body.");
    const chunks: Buffer[] = [];
    let total = 0;
    for await (const chunk of body as AsyncIterable<Uint8Array>) {
        if (signal?.aborted) throw Object.assign(new Error("R2 GET body streaming was aborted."), { name: "AbortError" });
        if (!(chunk instanceof Uint8Array)) throw new Error("R2 GET stream returned a non-binary chunk.");
        const nextTotal = total + chunk.byteLength;
        if (nextTotal > maxBytes || nextTotal > contentLength || (expectedSizeBytes !== undefined && nextTotal > expectedSizeBytes)) {
            throw new Error("R2 GET stream exceeded its declared or allowed body limit.");
        }
        const bytes = Buffer.from(chunk);
        total = nextTotal;
        chunks.push(bytes);
    }
    if (total !== contentLength) throw new Error("R2 GET stream length does not match ContentLength.");
    return Buffer.concat(chunks, total);
}

export function createRemoteCharacterObjectStore(bucket: string): CharacterObjectStore {
    const accountId = process.env.CLOUDFLARE_ACCOUNT_ID ?? "";
    const accessKeyId = process.env.R2_ACCESS_KEY_ID ?? "";
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY ?? "";
    if (!/^[a-f0-9]{32}$/.test(accountId) || !accessKeyId || !secretAccessKey || /[\r\n]/.test(accessKeyId + secretAccessKey)) {
        throw new Error("Character R2 S3 credentials are missing or invalid.");
    }
    const client = new S3Client({
        region: "auto",
        endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
        credentials: { accessKeyId, secretAccessKey },
        maxAttempts: 1,
    });
    return {
        supportsInventory: true,
        async listPage(prefix, continuationToken, signal) {
            const output = await client.send(new ListObjectsV2Command({
                Bucket: bucket,
                Prefix: prefix,
                ContinuationToken: continuationToken,
            }), { abortSignal: signal });
            return {
                objects: (output.Contents ?? []).map(value => ({
                    key: value.Key as string,
                    sizeBytes: value.Size as number,
                    etag: value.ETag as string,
                    lastModified: value.LastModified?.toISOString() as string,
                })),
                isTruncated: output.IsTruncated === true,
                nextContinuationToken: output.NextContinuationToken,
            };
        },
        async get(key, options, signal) {
            try {
                const output = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }), { abortSignal: signal });
                const bytes = await readBoundedS3Body(
                    output.Body,
                    output.ContentLength,
                    options.maxBytes,
                    options.expectedSizeBytes,
                    signal,
                );
                return {
                    bytes,
                    sizeBytes: output.ContentLength as number,
                    etag: output.ETag as string,
                    lastModified: output.LastModified?.toISOString() as string,
                    contentType: output.ContentType as string,
                    cacheControl: output.CacheControl as string,
                };
            } catch (error) {
                if (isMissingS3ObjectError(error)) return undefined;
                throw error;
            }
        },
        async put(key, bytes, contentType, cacheControl, condition, signal) {
            try {
                await client.send(new PutObjectCommand({
                    Bucket: bucket,
                    Key: key,
                    Body: bytes,
                    ContentType: contentType,
                    CacheControl: cacheControl,
                    ...("ifNoneMatch" in condition ? { IfNoneMatch: "*" } : { IfMatch: condition.ifMatch }),
                }), { abortSignal: signal });
                return "written";
            } catch (error) {
                if (isPreconditionS3Error(error)) return "precondition-failed";
                throw error;
            }
        },
    };
}
