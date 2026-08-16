import { createHash } from "crypto";
import { request as httpsRequest } from "https";
import { gunzipSync } from "zlib";
import type { CharacterLeaderSupportedProjectionSourceOptions } from "./leader-supported-projection-source";
import type {
    CharacterLeaderSupportedProjectionArtifactSet,
    CharacterLeaderSupportedProjectionCoverage,
    CharacterLeaderSupportedProjectionDataset,
    CharacterLeaderSupportedProjectionManifest,
    CharacterLeaderSupportedProjectionValidation,
} from "./leader-supported-projection-contract";
import { CHARACTER_LEADER_SUPPORTED_PROJECTION_RAW_LIMIT_BYTES } from "./leader-supported-projection-contract";
import { validateCharacterLeaderSupportedPublisherDryRunArtifact } from "./leader-supported-publisher-dry-run";
import type { CharacterLeaderSupportedPublisherDryRunArtifactSet } from "./leader-supported-publisher-dry-run-contract";
import {
    assertExactCharacterLeaderSupportedShadowK56Identity,
    characterLeaderSupportedShadowArtifactFingerprint,
    characterLeaderSupportedShadowLineageFingerprint,
    createCharacterLeaderSupportedShadow,
} from "./leader-supported-shadow";
import {
    CHARACTER_LEADER_SUPPORTED_PUBLIC_SHADOW_AGGREGATE_LIMIT_BYTES,
    CHARACTER_LEADER_SUPPORTED_PUBLIC_SHADOW_BASE_URL,
    CHARACTER_LEADER_SUPPORTED_PUBLIC_SHADOW_CONTRACT_VERSION,
    CHARACTER_LEADER_SUPPORTED_PUBLIC_SHADOW_MANIFEST_KEY,
    CHARACTER_LEADER_SUPPORTED_PUBLIC_SHADOW_MANIFEST_SHA256,
    CHARACTER_LEADER_SUPPORTED_PUBLIC_SHADOW_MANIFEST_SIZE_BYTES,
    CHARACTER_LEADER_SUPPORTED_PUBLIC_SHADOW_REPORT_LIMIT_BYTES,
    CHARACTER_LEADER_SUPPORTED_PUBLIC_SHADOW_REQUEST_TIMEOUT_MS,
    CHARACTER_LEADER_SUPPORTED_PUBLIC_SHADOW_RESPONSE_LIMIT_BYTES,
    CHARACTER_LEADER_SUPPORTED_PUBLIC_SHADOW_RSS_LIMIT_BYTES,
    CharacterLeaderSupportedPublicShadowReport,
} from "./leader-supported-public-shadow-contract";

export interface CharacterLeaderSupportedPublicShadowOptions extends CharacterLeaderSupportedProjectionSourceOptions {
    optIn: true;
    remoteReadOnly: true;
    k56Root: string;
    k58Root: string;
    checkedAt: string;
}
interface PublicResponse { bytes: Buffer; contentType: string; cacheControl: string }
const HASH = /^[a-f0-9]{64}$/;
const CHECKED_AT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const hash = (bytes: Buffer | string): string => createHash("sha256").update(bytes).digest("hex");
const json = (value: unknown): string => JSON.stringify(value);
const jsonBytes = (value: unknown): Buffer => Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8");

export function assertCharacterLeaderSupportedPublicShadowObjectKey(key: string, manifest = false): void {
    const prefix = "database-characters/leader-supported/v1/";
    if (!key.startsWith(prefix) || key.includes("\\") || key.split("/").some(part => !part || part === "." || part === "..")
        || (manifest ? key !== CHARACTER_LEADER_SUPPORTED_PUBLIC_SHADOW_MANIFEST_KEY
            : !key.startsWith(`${prefix}objects/sha256/`))) throw new Error("K61 public object key rejected");
}

export function verifyCharacterLeaderSupportedPublicShadowResponse(
    response: PublicResponse, expected: { sha256: string; sizeBytes: number; contentType: string; cacheControl: string },
): void {
    if (!HASH.test(expected.sha256) || !Number.isSafeInteger(expected.sizeBytes) || expected.sizeBytes <= 0
        || expected.sizeBytes >= CHARACTER_LEADER_SUPPORTED_PUBLIC_SHADOW_RESPONSE_LIMIT_BYTES
        || response.bytes.length !== expected.sizeBytes || hash(response.bytes) !== expected.sha256
        || response.contentType !== expected.contentType || response.cacheControl !== expected.cacheControl) {
        throw new Error("K61 public response identity or metadata rejected");
    }
}

function getPublic(key: string, manifest = false): Promise<PublicResponse> {
    assertCharacterLeaderSupportedPublicShadowObjectKey(key, manifest);
    const target = new URL(key, CHARACTER_LEADER_SUPPORTED_PUBLIC_SHADOW_BASE_URL);
    if (target.origin !== new URL(CHARACTER_LEADER_SUPPORTED_PUBLIC_SHADOW_BASE_URL).origin) {
        throw new Error("K61 public origin rejected");
    }
    return new Promise((resolve, reject) => {
        const request = httpsRequest(target, { method: "GET", headers: { "Accept-Encoding": "identity" } }, response => {
            if (response.statusCode !== 200 || response.headers.location) {
                response.resume(); reject(new Error(`K61 public HTTP status rejected: ${response.statusCode ?? "unknown"}`)); return;
            }
            const contentEncoding = String(response.headers["content-encoding"] ?? "").toLowerCase();
            if (contentEncoding && contentEncoding !== "identity") {
                response.resume(); reject(new Error("K61 public content encoding rejected")); return;
            }
            const chunks: Buffer[] = []; let total = 0;
            response.on("data", value => {
                const bytes = Buffer.from(value); total += bytes.length;
                if (total >= CHARACTER_LEADER_SUPPORTED_PUBLIC_SHADOW_RESPONSE_LIMIT_BYTES) {
                    request.destroy(new Error("K61 public response limit reached"));
                } else chunks.push(bytes);
            });
            response.on("end", () => resolve({
                bytes: Buffer.concat(chunks, total),
                contentType: String(response.headers["content-type"] ?? "").split(";", 1)[0].trim().toLowerCase(),
                cacheControl: String(response.headers["cache-control"] ?? "").trim().toLowerCase(),
            }));
        });
        request.setTimeout(CHARACTER_LEADER_SUPPORTED_PUBLIC_SHADOW_REQUEST_TIMEOUT_MS,
            () => request.destroy(new Error("K61 public request timeout")));
        request.on("error", reject); request.end();
    });
}

function parseCanonical<T>(bytes: Buffer, label: string): T {
    let value: T;
    try { value = JSON.parse(bytes.toString("utf8")) as T; }
    catch { throw new Error(`K61 ${label} JSON rejected`); }
    if (!jsonBytes(value).equals(bytes)) throw new Error(`K61 ${label} canonical bytes rejected`);
    return value;
}

function assertCandidateManifest(artifacts: CharacterLeaderSupportedPublisherDryRunArtifactSet): void {
    const candidate = artifacts.candidateManifest;
    if (artifacts.candidateManifestBytes.length !== CHARACTER_LEADER_SUPPORTED_PUBLIC_SHADOW_MANIFEST_SIZE_BYTES
        || hash(artifacts.candidateManifestBytes) !== CHARACTER_LEADER_SUPPORTED_PUBLIC_SHADOW_MANIFEST_SHA256
        || candidate.contract !== "dokkan-database-character-leader-supported-publisher-candidate-manifest"
        || candidate.contractVersion !== "1.0.0" || candidate.namespace !== "database-characters/leader-supported/v1"
        || candidate.immutableObjects.length !== 4
        || json(candidate.immutableObjects.map(item => [item.order, item.kind])) !== json([[1, "payload"], [2, "coverage"], [3, "validation"], [4, "manifest"]])
        || candidate.policy.candidateOnly !== true || candidate.policy.remotePreflight !== "NOT_EXECUTED"
        || candidate.policy.mutationExecuted !== false || candidate.policy.unconditionalWrite !== "FORBIDDEN"
        || candidate.policy.delete !== "FORBIDDEN") throw new Error("K61 candidate-only public manifest boundary rejected");
}

export function assertCharacterLeaderSupportedPublicShadowK58Stable(
    before: CharacterLeaderSupportedPublisherDryRunArtifactSet,
    after: CharacterLeaderSupportedPublisherDryRunArtifactSet,
): void {
    for (const [label, left, right] of [
        ["candidate", before.candidateManifestBytes, after.candidateManifestBytes],
        ["plan", before.planBytes, after.planBytes], ["receipt", before.receiptBytes, after.receiptBytes],
        ["marker", before.markerBytes, after.markerBytes],
    ] as Array<[string, Buffer, Buffer]>) if (!left.equals(right)) throw new Error(`K61 K58 ${label} drifted across public shadow`);
}

function publicArtifactSet(responses: Map<string, PublicResponse>): CharacterLeaderSupportedProjectionArtifactSet {
    const gzip = responses.get("payload")!.bytes;
    let raw: Buffer;
    try { raw = gunzipSync(gzip, { maxOutputLength: CHARACTER_LEADER_SUPPORTED_PROJECTION_RAW_LIMIT_BYTES }); }
    catch { throw new Error("K61 bounded public payload gunzip rejected"); }
    const artifacts: CharacterLeaderSupportedProjectionArtifactSet = {
        dataset: parseCanonical<CharacterLeaderSupportedProjectionDataset>(raw, "dataset"),
        coverage: parseCanonical<CharacterLeaderSupportedProjectionCoverage>(responses.get("coverage")!.bytes, "coverage"),
        validation: parseCanonical<CharacterLeaderSupportedProjectionValidation>(responses.get("validation")!.bytes, "validation"),
        manifest: parseCanonical<CharacterLeaderSupportedProjectionManifest>(responses.get("manifest")!.bytes, "source manifest"),
        raw, gzip, coverageBytes: responses.get("coverage")!.bytes,
        validationBytes: responses.get("validation")!.bytes, manifestBytes: responses.get("manifest")!.bytes,
    };
    assertExactCharacterLeaderSupportedShadowK56Identity(artifacts);
    return artifacts;
}

class RssGuard {
    private peak = Math.max(process.memoryUsage().rss, process.resourceUsage().maxRSS * 1024);
    private readonly timer = setInterval(() => this.observe(), 10);
    constructor() { this.timer.unref(); }
    private observe(): void { this.peak = Math.max(this.peak, process.memoryUsage().rss, process.resourceUsage().maxRSS * 1024); }
    sample(): void { this.observe(); if (this.peak >= CHARACTER_LEADER_SUPPORTED_PUBLIC_SHADOW_RSS_LIMIT_BYTES) throw new Error("K61 parent RSS limit reached"); }
    stop(): number { clearInterval(this.timer); this.sample(); return this.peak; }
    dispose(): void { clearInterval(this.timer); }
}

export function assertCharacterLeaderSupportedPublicShadowReportBound(report: CharacterLeaderSupportedPublicShadowReport): void {
    const text = `${JSON.stringify(report, null, 2)}\n`;
    if (Buffer.byteLength(text) >= CHARACTER_LEADER_SUPPORTED_PUBLIC_SHADOW_REPORT_LIMIT_BYTES) throw new Error("K61 report limit reached");
    if (/"records"|description|presentation|Character\[\]|sourceText|credential|secret|accessKey|outputRoot/i.test(text)) {
        throw new Error("K61 report exposed records, presentation, path, or credential material");
    }
}

const validateK58FromSources = validateCharacterLeaderSupportedPublisherDryRunArtifact;

export async function runCharacterLeaderSupportedPublicShadow(
    options: CharacterLeaderSupportedPublicShadowOptions,
): Promise<CharacterLeaderSupportedPublicShadowReport> {
    if (options?.optIn !== true || options.remoteReadOnly !== true) throw new Error("K61 explicit opt-in and public read-only mode required");
    if (!CHECKED_AT.test(options.checkedAt) || new Date(options.checkedAt).toISOString() !== options.checkedAt) throw new Error("K61 checkedAt rejected");
    if (typeof (global as any).gc !== "function") throw new Error("K61 requires Node --expose-gc");
    const rss = new RssGuard();
    try {
        const sourceOptions = {
            sidecarRoot: options.sidecarRoot, productionRoot: options.productionRoot, fyiRoot: options.fyiRoot,
            k43Root: options.k43Root, k46Root: options.k46Root, k48Root: options.k48Root,
            k56Root: options.k56Root, artifactRoot: options.k58Root,
            nativeRuntime: options.nativeRuntime, database: options.database,
        };
        let before = await validateK58FromSources(sourceOptions);
        if (before.sourceBoundValidation !== "GO") throw new Error("K61 requires K58 source-bound GO before public reads");
        assertCandidateManifest(before.artifacts);
        let bytesRead = 0;
        const read = async (key: string, manifest = false): Promise<PublicResponse> => {
            const response = await getPublic(key, manifest); bytesRead += response.bytes.length;
            if (bytesRead >= CHARACTER_LEADER_SUPPORTED_PUBLIC_SHADOW_AGGREGATE_LIMIT_BYTES) throw new Error("K61 aggregate public byte limit reached");
            return response;
        };
        const manifestBefore = await read(CHARACTER_LEADER_SUPPORTED_PUBLIC_SHADOW_MANIFEST_KEY, true);
        verifyCharacterLeaderSupportedPublicShadowResponse(manifestBefore, {
            sha256: CHARACTER_LEADER_SUPPORTED_PUBLIC_SHADOW_MANIFEST_SHA256,
            sizeBytes: CHARACTER_LEADER_SUPPORTED_PUBLIC_SHADOW_MANIFEST_SIZE_BYTES,
            contentType: "application/json", cacheControl: "no-store",
        });
        if (!manifestBefore.bytes.equals(before.artifacts.candidateManifestBytes)) throw new Error("K61 public manifest/source-bound candidate mismatch");
        const responses = new Map<string, PublicResponse>();
        for (const object of before.artifacts.candidateManifest.immutableObjects) {
            const response = await read(object.objectKey);
            verifyCharacterLeaderSupportedPublicShadowResponse(response, object);
            responses.set(object.kind, response);
        }
        let publicArtifacts: CharacterLeaderSupportedProjectionArtifactSet | undefined = publicArtifactSet(responses);
        if (characterLeaderSupportedShadowArtifactFingerprint(publicArtifacts) !== before.artifacts.candidateManifest.source.fullArtifactFingerprintSha256
            || characterLeaderSupportedShadowLineageFingerprint(publicArtifacts) !== before.artifacts.candidateManifest.source.lineageFingerprintSha256) {
            throw new Error("K61 public K56 fingerprint or lineage rejected");
        }
        let consumer: ReturnType<typeof createCharacterLeaderSupportedShadow> | undefined = createCharacterLeaderSupportedShadow(publicArtifacts);
        const inventory = consumer.inventory();
        const samples = inventory.samples;
        for (const reference of samples.references) if (!consumer.lookupReference(reference.stateId, reference.sourceEffectOccurrenceIndex)) throw new Error("K61 reference lookup failed");
        for (const stateId of samples.stateIds) if (!consumer.lookupStateId(stateId).length) throw new Error("K61 state lookup failed");
        for (const cardId of samples.cardIds) if (!consumer.lookupCardId(cardId).length) throw new Error("K61 card lookup failed");
        for (const effectRowId of samples.effectRowIds) if (!consumer.lookupEffectRowId(effectRowId).length) throw new Error("K61 effect lookup failed");
        const frozenProbe = consumer.lookupReference(samples.references[0].stateId, samples.references[0].sourceEffectOccurrenceIndex)!;
        if (!Object.isFrozen(frozenProbe) || !Object.isFrozen(frozenProbe.targetFilters)) throw new Error("K61 lookup clone freeze rejected");
        const sourceFingerprint = before.artifacts.candidateManifest.source.fullArtifactFingerprintSha256;
        const lineageFingerprint = before.artifacts.candidateManifest.source.lineageFingerprintSha256;
        const beforePeak = before.k55ValidationProcessPeakRssBytes;
        consumer = undefined; publicArtifacts = undefined; responses.clear();
        (global as any).gc(); rss.sample();
        const after = await validateK58FromSources(sourceOptions);
        if (after.sourceBoundValidation !== "GO") throw new Error("K61 requires K58 source-bound GO after public reads");
        assertCandidateManifest(after.artifacts); assertCharacterLeaderSupportedPublicShadowK58Stable(before.artifacts, after.artifacts);
        const manifestAfter = await read(CHARACTER_LEADER_SUPPORTED_PUBLIC_SHADOW_MANIFEST_KEY, true);
        verifyCharacterLeaderSupportedPublicShadowResponse(manifestAfter, {
            sha256: CHARACTER_LEADER_SUPPORTED_PUBLIC_SHADOW_MANIFEST_SHA256,
            sizeBytes: CHARACTER_LEADER_SUPPORTED_PUBLIC_SHADOW_MANIFEST_SIZE_BYTES,
            contentType: "application/json", cacheControl: "no-store",
        });
        if (!manifestAfter.bytes.equals(manifestBefore.bytes)) throw new Error("K61 public manifest drifted across shadow");
        const afterPeak = after.k55ValidationProcessPeakRssBytes;
        before = undefined as any; (global as any).gc();
        const parentPeak = rss.stop();
        const maximum = Math.max(beforePeak, afterPeak, parentPeak);
        if (maximum >= CHARACTER_LEADER_SUPPORTED_PUBLIC_SHADOW_RSS_LIMIT_BYTES) throw new Error("K61 per-process RSS limit reached");
        const report: CharacterLeaderSupportedPublicShadowReport = {
            schemaVersion: 1, contract: "dokkan-database-character-leader-supported-public-shadow",
            contractVersion: CHARACTER_LEADER_SUPPORTED_PUBLIC_SHADOW_CONTRACT_VERSION,
            checkedAt: options.checkedAt, mode: "explicit_opt_in_public_read_only_candidate_shadow",
            remote: {
                publicBaseUrl: CHARACTER_LEADER_SUPPORTED_PUBLIC_SHADOW_BASE_URL,
                manifestKey: CHARACTER_LEADER_SUPPORTED_PUBLIC_SHADOW_MANIFEST_KEY, method: "GET", requestCount: 6,
                order: ["manifest_before", "payload", "coverage", "validation", "source_manifest", "manifest_after"],
                redirects: "BLOCKED", acceptEncoding: "identity",
                requestTimeoutMs: CHARACTER_LEADER_SUPPORTED_PUBLIC_SHADOW_REQUEST_TIMEOUT_MS, bytesRead,
            },
            source: {
                publicManifest: { sha256: CHARACTER_LEADER_SUPPORTED_PUBLIC_SHADOW_MANIFEST_SHA256, sizeBytes: 11_561 },
                fullArtifactFingerprintSha256: sourceFingerprint, lineageFingerprintSha256: lineageFingerprint,
                k58SourceBoundBefore: "GO", k58SourceBoundAfter: "GO", k58StableAcrossShadow: true,
                publicManifestStableAcrossShadow: true, everyPublicMemberExact: true,
            },
            inventory,
            lookupAudit: {
                referenceSamples: samples.references.length, stateSamples: samples.stateIds.length,
                cardSamples: samples.cardIds.length, effectSamples: samples.effectRowIds.length,
                exactReferenceLookupPassed: true, stateLookupPassed: true, cardLookupPassed: true,
                effectLookupPassed: true, returnedClonesDeepFrozen: true,
            },
            boundaries: {
                candidateOnlyPublicManifest: true, publicManifestRemotePreflightField: "NOT_EXECUTED",
                publicManifestMutationExecutedField: false, supportedOnly: true, conditionalEffectsIncluded: false,
                excludedConditionalEffects: 17, excludedConditionalReferences: 45,
                excludedReason: "runtime_deck_index_unresolved", userConfirmedRuleCoverageOnly: true,
                firstPartyRuntimeDeckIndexEvidence: false, userConfirmedRuleUsedToAuthorizeProjection: false,
                persistedConsumer: false, writerOrOutputArtifact: false, authenticatedRequestCount: 0,
                remoteMutationCount: 0, characterArrayReadCount: 0, applyCount: 0,
            },
            rssAccounting: {
                scope: "per_process_not_process_tree", k58BeforeK55ProcessPeakRssBytes: beforePeak,
                k58AfterK55ProcessPeakRssBytes: afterPeak, k61ParentProcessPeakRssBytes: parentPeak,
                maximumIndividualProcessPeakRssBytes: maximum,
            },
            readiness: {
                publicDelivery: "GO", publicShadowLookup: "GO", sourceBoundValidation: "GO", candidateOnlyBoundary: "GO",
                perProcessRssUnder1GiB: "GO", processTreeRssUnder1GiB: "NO-GO", persistedConsumer: "NO-GO",
                writerOrOutputArtifact: "NO-GO", authenticatedNetwork: "NO-GO", r2Mutation: "NO-GO",
                conditional17: "NO-GO", combinedLeaderFriendOrEffectiveValue: "NO-GO", finalCombatCalculation: "NO-GO",
                authority: "NO-GO", production: "NO-GO", android: "NO-GO", ui: "NO-GO", dynamicInstrumentation: "NO-GO",
            },
        };
        assertCharacterLeaderSupportedPublicShadowReportBound(report); return report;
    } finally { rss.dispose(); }
}
