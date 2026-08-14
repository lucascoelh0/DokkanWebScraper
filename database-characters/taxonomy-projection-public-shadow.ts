import { createHash } from "crypto";
import { request as httpsRequest } from "https";
import { gzipSync, gunzipSync } from "zlib";
import {
    TAXONOMY_PROJECTION_SOURCE_PIN,
    TaxonomyProjectionCoverage,
    TaxonomyProjectionDataset,
    TaxonomyProjectionManifest,
    TaxonomyProjectionRecord,
    TaxonomyProjectionValidation,
} from "./taxonomy-projection-contract";
import { TaxonomyProjectionRemoteManifestCandidate } from "./taxonomy-projection-object-plan-contract";
import { materializeTaxonomyProjection } from "./taxonomy-projection-validator";
import {
    TAXONOMY_PROJECTION_PUBLIC_SHADOW_BASE_URL,
    TAXONOMY_PROJECTION_PUBLIC_SHADOW_CONTRACT_VERSION,
    TAXONOMY_PROJECTION_PUBLIC_SHADOW_MANIFEST_KEY,
    TAXONOMY_PROJECTION_PUBLIC_SHADOW_MANIFEST_SHA256,
    TAXONOMY_PROJECTION_PUBLIC_SHADOW_MANIFEST_SIZE_BYTES,
    TAXONOMY_PROJECTION_PUBLIC_SHADOW_MAX_AGGREGATE_BYTES,
    TAXONOMY_PROJECTION_PUBLIC_SHADOW_MAX_ERROR_LENGTH,
    TAXONOMY_PROJECTION_PUBLIC_SHADOW_MAX_RESPONSE_BYTES,
    TAXONOMY_PROJECTION_PUBLIC_SHADOW_REQUEST_TIMEOUT_MS,
    TAXONOMY_PROJECTION_PUBLIC_SHADOW_SCHEMA_VERSION,
    TaxonomyProjectionPublicShadow,
    TaxonomyProjectionPublicShadowReport,
} from "./taxonomy-projection-public-shadow-contract";

export interface TaxonomyProjectionPublicShadowOptions {
    optInK41: true;
    remoteReadOnly: true;
    checkedAt: string;
}

interface RemoteResponse { bytes: Buffer; contentType?: string; cacheControl?: string }
interface Transport { get(objectKey: string, limitBytes: number): Promise<RemoteResponse> }

const TRANSPORT_HOOK = Symbol.for("dokkan.k41.taxonomy-projection-public-shadow.transport");
const CHECKED_AT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const HASH = /^[a-f0-9]{64}$/;
const EXPECTED_KINDS = ["payload", "coverage", "validation", "manifest"];
const hash = (value: Buffer | string): string => createHash("sha256").update(value).digest("hex");
const jsonBytes = (value: unknown): Buffer => Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8");

function fail(message: string): never {
    throw new Error(`K41 public shadow failed: ${message}`.slice(0, TAXONOMY_PROJECTION_PUBLIC_SHADOW_MAX_ERROR_LENGTH));
}

function assertCheckedAt(value: string): void {
    if (!CHECKED_AT.test(value) || Number.isNaN(Date.parse(value)) || new Date(value).toISOString() !== value) {
        fail("explicit canonical UTC checkedAt required");
    }
}

function assertSafeObjectKey(value: string): void {
    if (!value.startsWith("database-characters/taxonomy-projection/v1/objects/sha256/")
        || value.includes("\\") || value.split("/").some(part => !part || part === "." || part === "..")) {
        fail("remote object key rejected");
    }
}

function cloneRecord(record: TaxonomyProjectionRecord): TaxonomyProjectionRecord {
    return JSON.parse(JSON.stringify(record)) as TaxonomyProjectionRecord;
}

export function verifyTaxonomyProjectionPublicShadowBytes(
    bytes: Buffer, expectedSize: number, expectedSha256: string,
): void {
    if (!Number.isInteger(expectedSize) || expectedSize < 0 || expectedSize >= TAXONOMY_PROJECTION_PUBLIC_SHADOW_MAX_RESPONSE_BYTES
        || !HASH.test(expectedSha256) || bytes.length !== expectedSize || hash(bytes) !== expectedSha256) {
        fail("immutable object hash or size mismatch");
    }
}

export function createTaxonomyProjectionPublicShadowLookup(records: TaxonomyProjectionRecord[]):
    (cardId: string) => TaxonomyProjectionRecord | undefined {
    const byCardId = new Map<string, TaxonomyProjectionRecord>();
    for (const record of records) {
        if (!/^\d+$/.test(record.cardId) || byCardId.has(record.cardId)) fail("lookup cardId uniqueness rejected");
        byCardId.set(record.cardId, record);
    }
    return cardId => {
        if (!/^\d+$/.test(cardId)) return undefined;
        const record = byCardId.get(cardId);
        return record ? cloneRecord(record) : undefined;
    };
}

function defaultTransport(): Transport {
    return {
        get(objectKey, limitBytes) {
            const target = new URL(objectKey, TAXONOMY_PROJECTION_PUBLIC_SHADOW_BASE_URL);
            if (target.origin !== new URL(TAXONOMY_PROJECTION_PUBLIC_SHADOW_BASE_URL).origin) fail("remote origin rejected");
            return new Promise((resolve, reject) => {
                const request = httpsRequest(target, {
                    method: "GET", headers: { "Accept-Encoding": "identity" },
                }, response => {
                    if (response.statusCode !== 200) {
                        response.resume();
                        reject(new Error(`HTTP ${response.statusCode ?? "unknown"}`));
                        return;
                    }
                    const chunks: Buffer[] = [];
                    let total = 0;
                    response.on("data", chunk => {
                        total += chunk.length;
                        if (total >= limitBytes) request.destroy(new Error("response byte limit reached"));
                        else chunks.push(Buffer.from(chunk));
                    });
                    response.on("end", () => resolve({
                        bytes: Buffer.concat(chunks),
                        contentType: String(response.headers["content-type"] ?? "").split(";", 1)[0].toLowerCase(),
                        cacheControl: String(response.headers["cache-control"] ?? "").toLowerCase(),
                    }));
                });
                request.setTimeout(TAXONOMY_PROJECTION_PUBLIC_SHADOW_REQUEST_TIMEOUT_MS,
                    () => request.destroy(new Error("request timeout")));
                request.on("error", reject);
                request.end();
            });
        },
    };
}

function transport(): Transport {
    return (globalThis as any)[TRANSPORT_HOOK] ?? defaultTransport();
}

function parseJson<T>(bytes: Buffer, label: string): T {
    try { return JSON.parse(bytes.toString("utf8")) as T; }
    catch { return fail(`${label} JSON rejected`); }
}

function validateRemoteManifest(bytes: Buffer): TaxonomyProjectionRemoteManifestCandidate {
    if (bytes.length !== TAXONOMY_PROJECTION_PUBLIC_SHADOW_MANIFEST_SIZE_BYTES
        || hash(bytes) !== TAXONOMY_PROJECTION_PUBLIC_SHADOW_MANIFEST_SHA256) fail("mutable manifest pin mismatch");
    const manifest = parseJson<TaxonomyProjectionRemoteManifestCandidate>(bytes, "mutable manifest");
    if (manifest.contract !== "dokkan-database-character-taxonomy-projection-remote-manifest-candidate-k37"
        || manifest.contractVersion !== "1.0.0" || manifest.releaseId !== "4a6dcfa4b8818abbd070bad2a1318eec5df9a2b1b306286adfec5fadee8ddfe4"
        || manifest.datasetVersion !== TAXONOMY_PROJECTION_SOURCE_PIN.datasetVersion
        || manifest.inventory?.closed !== true || manifest.inventory.artifactCount !== 4
        || JSON.stringify(manifest.inventory.objects?.map(object => object.kind)) !== JSON.stringify(EXPECTED_KINDS)
        || manifest.cacheControl !== "no-store" || manifest.state !== "MUTABLE_REMOTE_MANIFEST_CANDIDATE_ONLY"
        || JSON.stringify(manifest.readiness) !== JSON.stringify({ consumer: "NO-GO", authority: "NO-GO", publication: "NO-GO", production: "NO-GO" })) {
        fail("mutable manifest contract or safety state rejected");
    }
    for (const object of manifest.inventory.objects) {
        assertSafeObjectKey(object.objectKey);
        const path = object.objectKey.split("/");
        if (!HASH.test(object.sha256) || object.sizeBytes <= 0 || object.sizeBytes >= TAXONOMY_PROJECTION_PUBLIC_SHADOW_MAX_RESPONSE_BYTES
            || path[path.length - 2] !== object.sha256 || object.contentAddressed !== true
            || object.remoteHashProofRequiredBeforeReuse !== true
            || object.cacheControl !== "public, max-age=31536000, immutable") fail("immutable inventory rejected");
    }
    return manifest;
}

function assertArtifactMetadata(kind: string, response: RemoteResponse): void {
    const expectedType = kind === "payload" ? "application/gzip" : "application/json";
    if (response.contentType && response.contentType !== expectedType) fail(`${kind} content type rejected`);
    if (response.cacheControl && response.cacheControl !== "public, max-age=31536000, immutable") {
        fail(`${kind} cache control rejected`);
    }
}

export async function loadTaxonomyProjectionPublicShadow(
    options: TaxonomyProjectionPublicShadowOptions,
): Promise<TaxonomyProjectionPublicShadow> {
    if (options.optInK41 !== true || options.remoteReadOnly !== true) fail("explicit opt-in and remote read-only mode required");
    assertCheckedAt(options.checkedAt);
    const remote = transport();
    let bytesRead = 0;
    const read = async (key: string, expectedSize?: number, expectedHash?: string): Promise<RemoteResponse> => {
        const response = await remote.get(key, TAXONOMY_PROJECTION_PUBLIC_SHADOW_MAX_RESPONSE_BYTES);
        bytesRead += response.bytes.length;
        if (bytesRead >= TAXONOMY_PROJECTION_PUBLIC_SHADOW_MAX_AGGREGATE_BYTES) fail("aggregate byte limit reached");
        if (expectedSize !== undefined) verifyTaxonomyProjectionPublicShadowBytes(response.bytes, expectedSize, expectedHash!);
        return response;
    };

    const remoteManifestResponse = await read(TAXONOMY_PROJECTION_PUBLIC_SHADOW_MANIFEST_KEY);
    if (remoteManifestResponse.contentType && remoteManifestResponse.contentType !== "application/json") fail("manifest content type rejected");
    if (remoteManifestResponse.cacheControl && remoteManifestResponse.cacheControl !== "no-store") fail("manifest cache control rejected");
    const remoteManifest = validateRemoteManifest(remoteManifestResponse.bytes);
    const responses = new Map<string, RemoteResponse>();
    for (const object of remoteManifest.inventory.objects) {
        const response = await read(object.objectKey, object.sizeBytes, object.sha256);
        assertArtifactMetadata(object.kind, response);
        responses.set(object.kind, response);
    }
    const payloadBytes = responses.get("payload")!.bytes;
    let raw: Buffer;
    try { raw = gunzipSync(payloadBytes, { maxOutputLength: TAXONOMY_PROJECTION_SOURCE_PIN.release.rawSizeBytes + 1 }); }
    catch { return fail("bounded gzip decode rejected"); }
    if (raw.length !== TAXONOMY_PROJECTION_SOURCE_PIN.release.rawSizeBytes || hash(raw) !== TAXONOMY_PROJECTION_SOURCE_PIN.release.rawSha256) {
        fail("raw payload hash or size mismatch");
    }
    const projection = parseJson<TaxonomyProjectionDataset>(raw, "payload");
    const coverage = parseJson<TaxonomyProjectionCoverage>(responses.get("coverage")!.bytes, "coverage");
    const validation = parseJson<TaxonomyProjectionValidation>(responses.get("validation")!.bytes, "validation");
    const manifest = parseJson<TaxonomyProjectionManifest>(responses.get("manifest")!.bytes, "K35 manifest");
    const rebuilt = materializeTaxonomyProjection(projection, coverage);
    if (!rebuilt.raw.equals(raw) || !rebuilt.gzip.equals(payloadBytes)
        || !rebuilt.coverageBytes.equals(responses.get("coverage")!.bytes)
        || !rebuilt.validationBytes.equals(responses.get("validation")!.bytes)
        || !rebuilt.manifestBytes.equals(responses.get("manifest")!.bytes)
        || !jsonBytes(validation).equals(rebuilt.validationBytes) || !jsonBytes(manifest).equals(rebuilt.manifestBytes)
        || !gzipSync(raw, { level: 9 }).equals(payloadBytes)) fail("exact K35 artifact reproduction rejected");
    if (!validation.valid || validation.failureCount !== 0 || projection.records.length !== 5759) fail("K35 supported-only validation rejected");
    const lookup = createTaxonomyProjectionPublicShadowLookup(projection.records);
    const expected = TAXONOMY_PROJECTION_SOURCE_PIN.expected;
    const report: TaxonomyProjectionPublicShadowReport = {
        schemaVersion: TAXONOMY_PROJECTION_PUBLIC_SHADOW_SCHEMA_VERSION,
        contract: "dokkan-database-character-taxonomy-projection-public-shadow-k41",
        contractVersion: TAXONOMY_PROJECTION_PUBLIC_SHADOW_CONTRACT_VERSION,
        checkedAt: options.checkedAt,
        mode: "explicit_opt_in_remote_read_only_shadow",
        remote: {
            publicBaseUrl: TAXONOMY_PROJECTION_PUBLIC_SHADOW_BASE_URL,
            mutableManifestKey: TAXONOMY_PROJECTION_PUBLIC_SHADOW_MANIFEST_KEY,
            objectMethod: "GET", requestCount: 5, redirects: "BLOCKED", acceptEncoding: "identity",
            requestTimeoutMs: TAXONOMY_PROJECTION_PUBLIC_SHADOW_REQUEST_TIMEOUT_MS,
            responseLimitBytesExclusive: TAXONOMY_PROJECTION_PUBLIC_SHADOW_MAX_RESPONSE_BYTES,
            aggregateLimitBytesExclusive: TAXONOMY_PROJECTION_PUBLIC_SHADOW_MAX_AGGREGATE_BYTES, bytesRead,
        },
        release: {
            remoteManifestSha256: TAXONOMY_PROJECTION_PUBLIC_SHADOW_MANIFEST_SHA256,
            remoteManifestSizeBytes: TAXONOMY_PROJECTION_PUBLIC_SHADOW_MANIFEST_SIZE_BYTES,
            releaseId: "4a6dcfa4b8818abbd070bad2a1318eec5df9a2b1b306286adfec5fadee8ddfe4",
            datasetVersion: TAXONOMY_PROJECTION_SOURCE_PIN.datasetVersion,
            payloadSha256: TAXONOMY_PROJECTION_SOURCE_PIN.release.payloadSha256,
            payloadSizeBytes: TAXONOMY_PROJECTION_SOURCE_PIN.release.payloadSizeBytes,
            rawSha256: TAXONOMY_PROJECTION_SOURCE_PIN.release.rawSha256,
            rawSizeBytes: TAXONOMY_PROJECTION_SOURCE_PIN.release.rawSizeBytes,
        },
        projection: {
            recordCount: expected.cardCount,
            characterClassIncludedCardCount: expected.characterClassIncludedCardCount,
            categoryIncludedCardCount: expected.categoryIncludedCardCount,
            categoryUnknownCardCount: expected.categoryUnknownCardCount,
            categoryAssignmentCount: expected.categoryAssignmentCount,
            linkIncludedCardCount: expected.linkIncludedCardCount,
            linkUnknownCardCount: expected.linkUnknownCardCount,
            linkEntryCount: expected.linkEntryCount,
        },
        checks: {
            remoteManifestPinned: true, closedOrderedInventory: true, everyObjectHashAndSizeVerified: true,
            exactK35BytesReproduced: true, canonicalPayloadAndDeterministicGzip: true,
            supportedOnlyValidationValid: true, lookupKeyOnlyCardId: true, omittedDimensionsPreserved: true,
            labelsOrPresentationAbsent: true, characterArrayReadCount: 0, applyCount: 0, remoteMutationCount: 0,
        },
        readiness: {
            publicDelivery: "GO", remoteShadowLookup: "GO", persistedConsumer: "NO-GO", characterArray: "NO-GO",
            applyOrOverlay: "NO-GO", android: "NO-GO", authority: "NO-GO", production: "NO-GO",
            fyiRemoval: "NO-GO", dokkanInfoRemoval: "NO-GO",
        },
    };
    return { report, lookup };
}

export const __taxonomyProjectionPublicShadowTestHook = TRANSPORT_HOOK;
