"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runCharacterLeaderSupportedPublicShadow = exports.assertCharacterLeaderSupportedPublicShadowReportBound = exports.assertCharacterLeaderSupportedPublicShadowK58Stable = exports.verifyCharacterLeaderSupportedPublicShadowResponse = exports.assertCharacterLeaderSupportedPublicShadowObjectKey = void 0;
const crypto_1 = require("crypto");
const https_1 = require("https");
const zlib_1 = require("zlib");
const leader_supported_projection_contract_1 = require("./leader-supported-projection-contract");
const leader_supported_publisher_dry_run_1 = require("./leader-supported-publisher-dry-run");
const leader_supported_shadow_1 = require("./leader-supported-shadow");
const leader_supported_public_shadow_contract_1 = require("./leader-supported-public-shadow-contract");
const HASH = /^[a-f0-9]{64}$/;
const CHECKED_AT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const hash = (bytes) => (0, crypto_1.createHash)("sha256").update(bytes).digest("hex");
const json = (value) => JSON.stringify(value);
const jsonBytes = (value) => Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8");
function assertCharacterLeaderSupportedPublicShadowObjectKey(key, manifest = false) {
    const prefix = "database-characters/leader-supported/v1/";
    if (!key.startsWith(prefix) || key.includes("\\") || key.split("/").some(part => !part || part === "." || part === "..")
        || (manifest ? key !== leader_supported_public_shadow_contract_1.CHARACTER_LEADER_SUPPORTED_PUBLIC_SHADOW_MANIFEST_KEY
            : !key.startsWith(`${prefix}objects/sha256/`)))
        throw new Error("K61 public object key rejected");
}
exports.assertCharacterLeaderSupportedPublicShadowObjectKey = assertCharacterLeaderSupportedPublicShadowObjectKey;
function verifyCharacterLeaderSupportedPublicShadowResponse(response, expected) {
    if (!HASH.test(expected.sha256) || !Number.isSafeInteger(expected.sizeBytes) || expected.sizeBytes <= 0
        || expected.sizeBytes >= leader_supported_public_shadow_contract_1.CHARACTER_LEADER_SUPPORTED_PUBLIC_SHADOW_RESPONSE_LIMIT_BYTES
        || response.bytes.length !== expected.sizeBytes || hash(response.bytes) !== expected.sha256
        || response.contentType !== expected.contentType || response.cacheControl !== expected.cacheControl) {
        throw new Error("K61 public response identity or metadata rejected");
    }
}
exports.verifyCharacterLeaderSupportedPublicShadowResponse = verifyCharacterLeaderSupportedPublicShadowResponse;
function getPublic(key, manifest = false) {
    assertCharacterLeaderSupportedPublicShadowObjectKey(key, manifest);
    const target = new URL(key, leader_supported_public_shadow_contract_1.CHARACTER_LEADER_SUPPORTED_PUBLIC_SHADOW_BASE_URL);
    if (target.origin !== new URL(leader_supported_public_shadow_contract_1.CHARACTER_LEADER_SUPPORTED_PUBLIC_SHADOW_BASE_URL).origin) {
        throw new Error("K61 public origin rejected");
    }
    return new Promise((resolve, reject) => {
        const request = (0, https_1.request)(target, { method: "GET", headers: { "Accept-Encoding": "identity" } }, response => {
            if (response.statusCode !== 200 || response.headers.location) {
                response.resume();
                reject(new Error(`K61 public HTTP status rejected: ${response.statusCode ?? "unknown"}`));
                return;
            }
            const contentEncoding = String(response.headers["content-encoding"] ?? "").toLowerCase();
            if (contentEncoding && contentEncoding !== "identity") {
                response.resume();
                reject(new Error("K61 public content encoding rejected"));
                return;
            }
            const chunks = [];
            let total = 0;
            response.on("data", value => {
                const bytes = Buffer.from(value);
                total += bytes.length;
                if (total >= leader_supported_public_shadow_contract_1.CHARACTER_LEADER_SUPPORTED_PUBLIC_SHADOW_RESPONSE_LIMIT_BYTES) {
                    request.destroy(new Error("K61 public response limit reached"));
                }
                else
                    chunks.push(bytes);
            });
            response.on("end", () => resolve({
                bytes: Buffer.concat(chunks, total),
                contentType: String(response.headers["content-type"] ?? "").split(";", 1)[0].trim().toLowerCase(),
                cacheControl: String(response.headers["cache-control"] ?? "").trim().toLowerCase(),
            }));
        });
        request.setTimeout(leader_supported_public_shadow_contract_1.CHARACTER_LEADER_SUPPORTED_PUBLIC_SHADOW_REQUEST_TIMEOUT_MS, () => request.destroy(new Error("K61 public request timeout")));
        request.on("error", reject);
        request.end();
    });
}
function parseCanonical(bytes, label) {
    let value;
    try {
        value = JSON.parse(bytes.toString("utf8"));
    }
    catch {
        throw new Error(`K61 ${label} JSON rejected`);
    }
    if (!jsonBytes(value).equals(bytes))
        throw new Error(`K61 ${label} canonical bytes rejected`);
    return value;
}
function assertCandidateManifest(artifacts) {
    const candidate = artifacts.candidateManifest;
    if (artifacts.candidateManifestBytes.length !== leader_supported_public_shadow_contract_1.CHARACTER_LEADER_SUPPORTED_PUBLIC_SHADOW_MANIFEST_SIZE_BYTES
        || hash(artifacts.candidateManifestBytes) !== leader_supported_public_shadow_contract_1.CHARACTER_LEADER_SUPPORTED_PUBLIC_SHADOW_MANIFEST_SHA256
        || candidate.contract !== "dokkan-database-character-leader-supported-publisher-candidate-manifest"
        || candidate.contractVersion !== "1.0.0" || candidate.namespace !== "database-characters/leader-supported/v1"
        || candidate.immutableObjects.length !== 4
        || json(candidate.immutableObjects.map(item => [item.order, item.kind])) !== json([[1, "payload"], [2, "coverage"], [3, "validation"], [4, "manifest"]])
        || candidate.policy.candidateOnly !== true || candidate.policy.remotePreflight !== "NOT_EXECUTED"
        || candidate.policy.mutationExecuted !== false || candidate.policy.unconditionalWrite !== "FORBIDDEN"
        || candidate.policy.delete !== "FORBIDDEN")
        throw new Error("K61 candidate-only public manifest boundary rejected");
}
function assertCharacterLeaderSupportedPublicShadowK58Stable(before, after) {
    for (const [label, left, right] of [
        ["candidate", before.candidateManifestBytes, after.candidateManifestBytes],
        ["plan", before.planBytes, after.planBytes], ["receipt", before.receiptBytes, after.receiptBytes],
        ["marker", before.markerBytes, after.markerBytes],
    ])
        if (!left.equals(right))
            throw new Error(`K61 K58 ${label} drifted across public shadow`);
}
exports.assertCharacterLeaderSupportedPublicShadowK58Stable = assertCharacterLeaderSupportedPublicShadowK58Stable;
function publicArtifactSet(responses) {
    const gzip = responses.get("payload").bytes;
    let raw;
    try {
        raw = (0, zlib_1.gunzipSync)(gzip, { maxOutputLength: leader_supported_projection_contract_1.CHARACTER_LEADER_SUPPORTED_PROJECTION_RAW_LIMIT_BYTES });
    }
    catch {
        throw new Error("K61 bounded public payload gunzip rejected");
    }
    const artifacts = {
        dataset: parseCanonical(raw, "dataset"),
        coverage: parseCanonical(responses.get("coverage").bytes, "coverage"),
        validation: parseCanonical(responses.get("validation").bytes, "validation"),
        manifest: parseCanonical(responses.get("manifest").bytes, "source manifest"),
        raw, gzip, coverageBytes: responses.get("coverage").bytes,
        validationBytes: responses.get("validation").bytes, manifestBytes: responses.get("manifest").bytes,
    };
    (0, leader_supported_shadow_1.assertExactCharacterLeaderSupportedShadowK56Identity)(artifacts);
    return artifacts;
}
class RssGuard {
    peak = Math.max(process.memoryUsage().rss, process.resourceUsage().maxRSS * 1024);
    timer = setInterval(() => this.observe(), 10);
    constructor() { this.timer.unref(); }
    observe() { this.peak = Math.max(this.peak, process.memoryUsage().rss, process.resourceUsage().maxRSS * 1024); }
    sample() { this.observe(); if (this.peak >= leader_supported_public_shadow_contract_1.CHARACTER_LEADER_SUPPORTED_PUBLIC_SHADOW_RSS_LIMIT_BYTES)
        throw new Error("K61 parent RSS limit reached"); }
    stop() { clearInterval(this.timer); this.sample(); return this.peak; }
    dispose() { clearInterval(this.timer); }
}
function assertCharacterLeaderSupportedPublicShadowReportBound(report) {
    const text = `${JSON.stringify(report, null, 2)}\n`;
    if (Buffer.byteLength(text) >= leader_supported_public_shadow_contract_1.CHARACTER_LEADER_SUPPORTED_PUBLIC_SHADOW_REPORT_LIMIT_BYTES)
        throw new Error("K61 report limit reached");
    if (/"records"|description|presentation|Character\[\]|sourceText|credential|secret|accessKey|outputRoot/i.test(text)) {
        throw new Error("K61 report exposed records, presentation, path, or credential material");
    }
}
exports.assertCharacterLeaderSupportedPublicShadowReportBound = assertCharacterLeaderSupportedPublicShadowReportBound;
const validateK58FromSources = leader_supported_publisher_dry_run_1.validateCharacterLeaderSupportedPublisherDryRunArtifact;
async function runCharacterLeaderSupportedPublicShadow(options) {
    if (options?.optIn !== true || options.remoteReadOnly !== true)
        throw new Error("K61 explicit opt-in and public read-only mode required");
    if (!CHECKED_AT.test(options.checkedAt) || new Date(options.checkedAt).toISOString() !== options.checkedAt)
        throw new Error("K61 checkedAt rejected");
    if (typeof global.gc !== "function")
        throw new Error("K61 requires Node --expose-gc");
    const rss = new RssGuard();
    try {
        const sourceOptions = {
            sidecarRoot: options.sidecarRoot, productionRoot: options.productionRoot, fyiRoot: options.fyiRoot,
            k43Root: options.k43Root, k46Root: options.k46Root, k48Root: options.k48Root,
            k56Root: options.k56Root, artifactRoot: options.k58Root,
            nativeRuntime: options.nativeRuntime, database: options.database,
        };
        let before = await validateK58FromSources(sourceOptions);
        if (before.sourceBoundValidation !== "GO")
            throw new Error("K61 requires K58 source-bound GO before public reads");
        assertCandidateManifest(before.artifacts);
        let bytesRead = 0;
        const read = async (key, manifest = false) => {
            const response = await getPublic(key, manifest);
            bytesRead += response.bytes.length;
            if (bytesRead >= leader_supported_public_shadow_contract_1.CHARACTER_LEADER_SUPPORTED_PUBLIC_SHADOW_AGGREGATE_LIMIT_BYTES)
                throw new Error("K61 aggregate public byte limit reached");
            return response;
        };
        const manifestBefore = await read(leader_supported_public_shadow_contract_1.CHARACTER_LEADER_SUPPORTED_PUBLIC_SHADOW_MANIFEST_KEY, true);
        verifyCharacterLeaderSupportedPublicShadowResponse(manifestBefore, {
            sha256: leader_supported_public_shadow_contract_1.CHARACTER_LEADER_SUPPORTED_PUBLIC_SHADOW_MANIFEST_SHA256,
            sizeBytes: leader_supported_public_shadow_contract_1.CHARACTER_LEADER_SUPPORTED_PUBLIC_SHADOW_MANIFEST_SIZE_BYTES,
            contentType: "application/json", cacheControl: "no-store",
        });
        if (!manifestBefore.bytes.equals(before.artifacts.candidateManifestBytes))
            throw new Error("K61 public manifest/source-bound candidate mismatch");
        const responses = new Map();
        for (const object of before.artifacts.candidateManifest.immutableObjects) {
            const response = await read(object.objectKey);
            verifyCharacterLeaderSupportedPublicShadowResponse(response, object);
            responses.set(object.kind, response);
        }
        let publicArtifacts = publicArtifactSet(responses);
        if ((0, leader_supported_shadow_1.characterLeaderSupportedShadowArtifactFingerprint)(publicArtifacts) !== before.artifacts.candidateManifest.source.fullArtifactFingerprintSha256
            || (0, leader_supported_shadow_1.characterLeaderSupportedShadowLineageFingerprint)(publicArtifacts) !== before.artifacts.candidateManifest.source.lineageFingerprintSha256) {
            throw new Error("K61 public K56 fingerprint or lineage rejected");
        }
        let consumer = (0, leader_supported_shadow_1.createCharacterLeaderSupportedShadow)(publicArtifacts);
        const inventory = consumer.inventory();
        const samples = inventory.samples;
        for (const reference of samples.references)
            if (!consumer.lookupReference(reference.stateId, reference.sourceEffectOccurrenceIndex))
                throw new Error("K61 reference lookup failed");
        for (const stateId of samples.stateIds)
            if (!consumer.lookupStateId(stateId).length)
                throw new Error("K61 state lookup failed");
        for (const cardId of samples.cardIds)
            if (!consumer.lookupCardId(cardId).length)
                throw new Error("K61 card lookup failed");
        for (const effectRowId of samples.effectRowIds)
            if (!consumer.lookupEffectRowId(effectRowId).length)
                throw new Error("K61 effect lookup failed");
        const frozenProbe = consumer.lookupReference(samples.references[0].stateId, samples.references[0].sourceEffectOccurrenceIndex);
        if (!Object.isFrozen(frozenProbe) || !Object.isFrozen(frozenProbe.targetFilters))
            throw new Error("K61 lookup clone freeze rejected");
        const sourceFingerprint = before.artifacts.candidateManifest.source.fullArtifactFingerprintSha256;
        const lineageFingerprint = before.artifacts.candidateManifest.source.lineageFingerprintSha256;
        const beforePeak = before.k55ValidationProcessPeakRssBytes;
        consumer = undefined;
        publicArtifacts = undefined;
        responses.clear();
        global.gc();
        rss.sample();
        const after = await validateK58FromSources(sourceOptions);
        if (after.sourceBoundValidation !== "GO")
            throw new Error("K61 requires K58 source-bound GO after public reads");
        assertCandidateManifest(after.artifacts);
        assertCharacterLeaderSupportedPublicShadowK58Stable(before.artifacts, after.artifacts);
        const manifestAfter = await read(leader_supported_public_shadow_contract_1.CHARACTER_LEADER_SUPPORTED_PUBLIC_SHADOW_MANIFEST_KEY, true);
        verifyCharacterLeaderSupportedPublicShadowResponse(manifestAfter, {
            sha256: leader_supported_public_shadow_contract_1.CHARACTER_LEADER_SUPPORTED_PUBLIC_SHADOW_MANIFEST_SHA256,
            sizeBytes: leader_supported_public_shadow_contract_1.CHARACTER_LEADER_SUPPORTED_PUBLIC_SHADOW_MANIFEST_SIZE_BYTES,
            contentType: "application/json", cacheControl: "no-store",
        });
        if (!manifestAfter.bytes.equals(manifestBefore.bytes))
            throw new Error("K61 public manifest drifted across shadow");
        const afterPeak = after.k55ValidationProcessPeakRssBytes;
        before = undefined;
        global.gc();
        const parentPeak = rss.stop();
        const maximum = Math.max(beforePeak, afterPeak, parentPeak);
        if (maximum >= leader_supported_public_shadow_contract_1.CHARACTER_LEADER_SUPPORTED_PUBLIC_SHADOW_RSS_LIMIT_BYTES)
            throw new Error("K61 per-process RSS limit reached");
        const report = {
            schemaVersion: 1, contract: "dokkan-database-character-leader-supported-public-shadow",
            contractVersion: leader_supported_public_shadow_contract_1.CHARACTER_LEADER_SUPPORTED_PUBLIC_SHADOW_CONTRACT_VERSION,
            checkedAt: options.checkedAt, mode: "explicit_opt_in_public_read_only_candidate_shadow",
            remote: {
                publicBaseUrl: leader_supported_public_shadow_contract_1.CHARACTER_LEADER_SUPPORTED_PUBLIC_SHADOW_BASE_URL,
                manifestKey: leader_supported_public_shadow_contract_1.CHARACTER_LEADER_SUPPORTED_PUBLIC_SHADOW_MANIFEST_KEY, method: "GET", requestCount: 6,
                order: ["manifest_before", "payload", "coverage", "validation", "source_manifest", "manifest_after"],
                redirects: "BLOCKED", acceptEncoding: "identity",
                requestTimeoutMs: leader_supported_public_shadow_contract_1.CHARACTER_LEADER_SUPPORTED_PUBLIC_SHADOW_REQUEST_TIMEOUT_MS, bytesRead,
            },
            source: {
                publicManifest: { sha256: leader_supported_public_shadow_contract_1.CHARACTER_LEADER_SUPPORTED_PUBLIC_SHADOW_MANIFEST_SHA256, sizeBytes: 11561 },
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
        assertCharacterLeaderSupportedPublicShadowReportBound(report);
        return report;
    }
    finally {
        rss.dispose();
    }
}
exports.runCharacterLeaderSupportedPublicShadow = runCharacterLeaderSupportedPublicShadow;
//# sourceMappingURL=leader-supported-public-shadow.js.map