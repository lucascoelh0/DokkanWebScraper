"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createCharacterLeaderSupportedShadow = exports.assertCharacterLeaderSupportedShadowReportBound = exports.assertCharacterLeaderSupportedShadowReferenceIdentitiesUnique = exports.assertExactCharacterLeaderSupportedShadowK56Identity = exports.hasExactCharacterLeaderSupportedShadowK56Identity = exports.characterLeaderSupportedShadowMemberIdentities = exports.characterLeaderSupportedShadowLineageFingerprint = exports.characterLeaderSupportedShadowArtifactFingerprint = void 0;
const crypto_1 = require("crypto");
const zlib_1 = require("zlib");
const leader_supported_projection_contract_1 = require("./leader-supported-projection-contract");
const leader_supported_projection_1 = require("./leader-supported-projection");
const leader_supported_shadow_contract_1 = require("./leader-supported-shadow-contract");
const hash = (bytes) => (0, crypto_1.createHash)("sha256").update(bytes).digest("hex");
const json = (value) => JSON.stringify(value);
const memberIdentity = (bytes) => ({ sizeBytes: bytes.length, sha256: hash(bytes) });
function deepFreeze(value) {
    if (value && typeof value === "object" && !Object.isFrozen(value)) {
        for (const child of Object.values(value))
            deepFreeze(child);
        Object.freeze(value);
    }
    return value;
}
function frozenClone(value) {
    return deepFreeze(JSON.parse(JSON.stringify(value)));
}
function parseExact(bytes, expected, label) {
    let parsed;
    try {
        parsed = JSON.parse(bytes.toString("utf8"));
    }
    catch {
        throw new Error(`K57 ${label} JSON rejected`);
    }
    if (json(parsed) !== json(expected))
        throw new Error(`K57 ${label} object/bytes mismatch`);
}
function characterLeaderSupportedShadowArtifactFingerprint(artifacts) {
    const digest = (0, crypto_1.createHash)("sha256");
    for (const [label, bytes] of [
        ["raw", artifacts.raw], ["payload", artifacts.gzip], ["coverage", artifacts.coverageBytes],
        ["validation", artifacts.validationBytes], ["manifest", artifacts.manifestBytes],
    ]) {
        digest.update(`${label}:${bytes.length}:`, "utf8");
        digest.update(bytes);
        digest.update("\0", "utf8");
    }
    return digest.digest("hex");
}
exports.characterLeaderSupportedShadowArtifactFingerprint = characterLeaderSupportedShadowArtifactFingerprint;
function characterLeaderSupportedShadowLineageFingerprint(artifacts) {
    return hash(json({ dataset: artifacts.dataset.source, manifest: artifacts.manifest.source }));
}
exports.characterLeaderSupportedShadowLineageFingerprint = characterLeaderSupportedShadowLineageFingerprint;
function characterLeaderSupportedShadowMemberIdentities(artifacts) {
    return {
        raw: memberIdentity(artifacts.raw), payload: memberIdentity(artifacts.gzip),
        coverage: memberIdentity(artifacts.coverageBytes), validation: memberIdentity(artifacts.validationBytes),
        manifest: memberIdentity(artifacts.manifestBytes),
    };
}
exports.characterLeaderSupportedShadowMemberIdentities = characterLeaderSupportedShadowMemberIdentities;
function hasExactCharacterLeaderSupportedShadowK56Identity(artifacts) {
    return json(characterLeaderSupportedShadowMemberIdentities(artifacts)) === json({
        raw: leader_supported_shadow_contract_1.CHARACTER_LEADER_SUPPORTED_SHADOW_PIN.raw,
        payload: leader_supported_shadow_contract_1.CHARACTER_LEADER_SUPPORTED_SHADOW_PIN.payload,
        coverage: leader_supported_shadow_contract_1.CHARACTER_LEADER_SUPPORTED_SHADOW_PIN.coverage,
        validation: leader_supported_shadow_contract_1.CHARACTER_LEADER_SUPPORTED_SHADOW_PIN.validation,
        manifest: leader_supported_shadow_contract_1.CHARACTER_LEADER_SUPPORTED_SHADOW_PIN.manifest,
    });
}
exports.hasExactCharacterLeaderSupportedShadowK56Identity = hasExactCharacterLeaderSupportedShadowK56Identity;
function assertExactCharacterLeaderSupportedShadowK56Identity(artifacts) {
    if (!hasExactCharacterLeaderSupportedShadowK56Identity(artifacts)
        || artifacts.manifest.sha256 !== leader_supported_shadow_contract_1.CHARACTER_LEADER_SUPPORTED_SHADOW_PIN.payload.sha256
        || artifacts.manifest.sizeBytes !== leader_supported_shadow_contract_1.CHARACTER_LEADER_SUPPORTED_SHADOW_PIN.payload.sizeBytes
        || artifacts.manifest.uncompressedSha256 !== leader_supported_shadow_contract_1.CHARACTER_LEADER_SUPPORTED_SHADOW_PIN.raw.sha256
        || artifacts.manifest.uncompressedSizeBytes !== leader_supported_shadow_contract_1.CHARACTER_LEADER_SUPPORTED_SHADOW_PIN.raw.sizeBytes
        || artifacts.manifest.coverageSha256 !== leader_supported_shadow_contract_1.CHARACTER_LEADER_SUPPORTED_SHADOW_PIN.coverage.sha256
        || artifacts.manifest.coverageSizeBytes !== leader_supported_shadow_contract_1.CHARACTER_LEADER_SUPPORTED_SHADOW_PIN.coverage.sizeBytes
        || artifacts.manifest.validationSha256 !== leader_supported_shadow_contract_1.CHARACTER_LEADER_SUPPORTED_SHADOW_PIN.validation.sha256
        || artifacts.manifest.validationSizeBytes !== leader_supported_shadow_contract_1.CHARACTER_LEADER_SUPPORTED_SHADOW_PIN.validation.sizeBytes) {
        throw new Error("K57 exact real K56 artifact identity rejected");
    }
}
exports.assertExactCharacterLeaderSupportedShadowK56Identity = assertExactCharacterLeaderSupportedShadowK56Identity;
function assertK56Boundary(artifacts) {
    if (artifacts.raw.length >= leader_supported_projection_contract_1.CHARACTER_LEADER_SUPPORTED_PROJECTION_RAW_LIMIT_BYTES
        || artifacts.gzip.length >= leader_supported_projection_contract_1.CHARACTER_LEADER_SUPPORTED_PROJECTION_GZIP_LIMIT_BYTES
        || artifacts.coverageBytes.length + artifacts.validationBytes.length + artifacts.manifestBytes.length
            >= leader_supported_projection_contract_1.CHARACTER_LEADER_SUPPORTED_PROJECTION_METADATA_LIMIT_BYTES)
        throw new Error("K57 K56 artifact byte budget rejected");
    parseExact(artifacts.raw, artifacts.dataset, "raw dataset");
    if (!(0, zlib_1.gunzipSync)(artifacts.gzip, { maxOutputLength: leader_supported_projection_contract_1.CHARACTER_LEADER_SUPPORTED_PROJECTION_RAW_LIMIT_BYTES }).equals(artifacts.raw)) {
        throw new Error("K57 K56 payload/raw mismatch");
    }
    parseExact(artifacts.coverageBytes, artifacts.coverage, "coverage");
    parseExact(artifacts.validationBytes, artifacts.validation, "validation");
    parseExact(artifacts.manifestBytes, artifacts.manifest, "manifest");
    if (artifacts.manifest.sha256 !== hash(artifacts.gzip) || artifacts.manifest.sizeBytes !== artifacts.gzip.length
        || artifacts.manifest.uncompressedSha256 !== hash(artifacts.raw) || artifacts.manifest.uncompressedSizeBytes !== artifacts.raw.length
        || artifacts.manifest.coverageSha256 !== hash(artifacts.coverageBytes) || artifacts.manifest.coverageSizeBytes !== artifacts.coverageBytes.length
        || artifacts.manifest.validationSha256 !== hash(artifacts.validationBytes) || artifacts.manifest.validationSizeBytes !== artifacts.validationBytes.length
        || json(artifacts.manifest.source) !== json(artifacts.dataset.source)
        || json(artifacts.manifest.counts) !== json(artifacts.coverage.counts))
        throw new Error("K57 K56 self-contained identity rejected");
    const recomputed = (0, leader_supported_projection_1.validateCharacterLeaderSupportedProjection)(artifacts.dataset, artifacts.coverage, {
        rawSizeBytes: artifacts.raw.length,
        gzipSizeBytes: artifacts.gzip.length,
        metadataSizeBytes: artifacts.coverageBytes.length + artifacts.validationBytes.length + artifacts.manifestBytes.length,
    });
    if (!recomputed.valid || json(recomputed) !== json(artifacts.validation) || artifacts.validation.failures.length !== 0
        || artifacts.validation.readiness.offlineSupportedOnlyProjection !== "GO"
        || artifacts.validation.readiness.sourceBoundValidation !== "NOT_EXECUTED"
        || artifacts.validation.readiness.localShadowAuditDefaultOff !== "NOT_EXECUTED") {
        throw new Error("K57 K56 validation boundary rejected");
    }
    const dataset = artifacts.dataset, coverage = artifacts.coverage;
    if (dataset.contract !== "dokkan-database-character-leader-supported-only-projection" || dataset.contractVersion !== "1.0.0"
        || dataset.policy.supportedOnly !== true || dataset.policy.structuralIdsOnly !== true
        || dataset.policy.sourceOrderAndMultiplicityPreserved !== true || dataset.policy.conditionalEffectsIncluded !== false
        || dataset.policy.authoritySelected !== false || dataset.policy.patchOrApplyImplemented !== false
        || dataset.policy.productionModified !== false || dataset.policy.publisherImplemented !== false
        || dataset.policy.networkEnabled !== false || dataset.policy.r2Enabled !== false || dataset.policy.androidImplemented !== false
        || coverage.counts.totalEffects !== leader_supported_shadow_contract_1.CHARACTER_LEADER_SUPPORTED_SHADOW_PIN.totalEffects
        || coverage.counts.totalReferences !== leader_supported_shadow_contract_1.CHARACTER_LEADER_SUPPORTED_SHADOW_PIN.totalReferences
        || coverage.counts.projectedEffects !== leader_supported_shadow_contract_1.CHARACTER_LEADER_SUPPORTED_SHADOW_PIN.distinctEffectRowIds
        || coverage.counts.projectedReferences !== leader_supported_shadow_contract_1.CHARACTER_LEADER_SUPPORTED_SHADOW_PIN.references
        || coverage.counts.excludedEffects !== leader_supported_shadow_contract_1.CHARACTER_LEADER_SUPPORTED_SHADOW_PIN.excludedEffects
        || coverage.counts.excludedReferences !== leader_supported_shadow_contract_1.CHARACTER_LEADER_SUPPORTED_SHADOW_PIN.excludedReferences
        || json(coverage.excluded.map(item => item.effectRowId)) !== json(leader_supported_projection_contract_1.CHARACTER_LEADER_SUPPORTED_PROJECTION_PIN.conditionalEffectRowIds)
        || coverage.excluded.reduce((total, item) => total + item.affectedReferences.length, 0) !== leader_supported_shadow_contract_1.CHARACTER_LEADER_SUPPORTED_SHADOW_PIN.excludedReferences
        || coverage.excluded.some(item => item.reason !== "runtime_deck_index_unresolved"
            || item.corroborativeRule.ruleId !== "k56-conditional-domain-rule-v1"
            || item.corroborativeRule.provenance !== "user_confirmed_domain_rule"
            || item.corroborativeRule.usedToAuthorizeSupportedProjection !== false)
        || coverage.corroborativeDomainRules.length !== 1
        || coverage.corroborativeDomainRules[0].ruleId !== "k56-conditional-domain-rule-v1"
        || coverage.corroborativeDomainRules[0].firstPartyRuntimeDeckIndexEvidence !== false
        || coverage.corroborativeDomainRules[0].usedToAuthorizeSupportedProjection !== false
        || coverage.corroborativeDomainRules[0].appliesToExcludedConditionalEffectsOnly !== true
        || json(dataset).includes("k56-conditional-domain-rule-v1"))
        throw new Error("K57 K56 supported-only boundary rejected");
}
function add(map, key, serializedRecord) {
    const records = map.get(key);
    if (records)
        records.push(serializedRecord);
    else
        map.set(key, [serializedRecord]);
}
function assertCharacterLeaderSupportedShadowReferenceIdentitiesUnique(records) {
    const seen = new Set();
    for (const record of records) {
        const key = json([record.stateId, record.sourceEffectOccurrenceIndex]);
        if (seen.has(key))
            throw new Error(`K57 duplicate reference identity ${key}`);
        seen.add(key);
    }
}
exports.assertCharacterLeaderSupportedShadowReferenceIdentitiesUnique = assertCharacterLeaderSupportedShadowReferenceIdentitiesUnique;
class CharacterLeaderSupportedShadowConsumerImpl {
    #byReference = new Map();
    #byStateId = new Map();
    #byCardId = new Map();
    #byEffectRowId = new Map();
    #inventory;
    #directReport;
    constructor(artifacts) {
        assertCharacterLeaderSupportedShadowReferenceIdentitiesUnique(artifacts.dataset.records);
        assertK56Boundary(artifacts);
        const stateSamples = [], cardSamples = [], effectSamples = [];
        for (const record of artifacts.dataset.records) {
            const referenceKey = json([record.stateId, record.sourceEffectOccurrenceIndex]);
            if (this.#byReference.has(referenceKey))
                throw new Error(`K57 duplicate reference identity ${referenceKey}`);
            const serializedRecord = json(record);
            this.#byReference.set(referenceKey, serializedRecord);
            if (!this.#byStateId.has(record.stateId) && stateSamples.length < 5)
                stateSamples.push(record.stateId);
            if (!this.#byCardId.has(record.cardId) && cardSamples.length < 5)
                cardSamples.push(record.cardId);
            if (!this.#byEffectRowId.has(record.effectRowId) && effectSamples.length < 5)
                effectSamples.push(record.effectRowId);
            add(this.#byStateId, record.stateId, serializedRecord);
            add(this.#byCardId, record.cardId, serializedRecord);
            add(this.#byEffectRowId, record.effectRowId, serializedRecord);
        }
        if (this.#byReference.size !== leader_supported_shadow_contract_1.CHARACTER_LEADER_SUPPORTED_SHADOW_PIN.references
            || this.#byStateId.size !== leader_supported_shadow_contract_1.CHARACTER_LEADER_SUPPORTED_SHADOW_PIN.distinctStateIds
            || this.#byCardId.size !== leader_supported_shadow_contract_1.CHARACTER_LEADER_SUPPORTED_SHADOW_PIN.distinctCardIds
            || this.#byEffectRowId.size !== leader_supported_shadow_contract_1.CHARACTER_LEADER_SUPPORTED_SHADOW_PIN.distinctEffectRowIds) {
            throw new Error("K57 exact index inventory pin changed");
        }
        this.#inventory = deepFreeze({
            references: leader_supported_shadow_contract_1.CHARACTER_LEADER_SUPPORTED_SHADOW_PIN.references,
            distinctStateIds: leader_supported_shadow_contract_1.CHARACTER_LEADER_SUPPORTED_SHADOW_PIN.distinctStateIds,
            distinctCardIds: leader_supported_shadow_contract_1.CHARACTER_LEADER_SUPPORTED_SHADOW_PIN.distinctCardIds,
            distinctEffectRowIds: leader_supported_shadow_contract_1.CHARACTER_LEADER_SUPPORTED_SHADOW_PIN.distinctEffectRowIds,
            samples: {
                stateIds: stateSamples, cardIds: cardSamples, effectRowIds: effectSamples,
                references: artifacts.dataset.records.slice(0, 5).map(record => ({
                    stateId: record.stateId, sourceEffectOccurrenceIndex: record.sourceEffectOccurrenceIndex,
                })),
            },
        });
        this.#directReport = deepFreeze(createDirectReport(artifacts, this.#inventory));
    }
    lookupReference(stateId, sourceEffectOccurrenceIndex) {
        if (!stateId || !Number.isSafeInteger(sourceEffectOccurrenceIndex) || sourceEffectOccurrenceIndex < 0)
            throw new Error("K57 reference lookup rejected");
        const record = this.#byReference.get(json([stateId, sourceEffectOccurrenceIndex]));
        return record ? deepFreeze(JSON.parse(record)) : undefined;
    }
    lookupStateId(stateId) {
        if (!stateId)
            throw new Error("K57 stateId lookup rejected");
        return deepFreeze((this.#byStateId.get(stateId) ?? []).map(record => JSON.parse(record)));
    }
    lookupCardId(cardId) {
        if (!cardId)
            throw new Error("K57 cardId lookup rejected");
        return deepFreeze((this.#byCardId.get(cardId) ?? []).map(record => JSON.parse(record)));
    }
    lookupEffectRowId(effectRowId) {
        if (!effectRowId)
            throw new Error("K57 effectRowId lookup rejected");
        return deepFreeze((this.#byEffectRowId.get(effectRowId) ?? []).map(record => JSON.parse(record)));
    }
    inventory() { return frozenClone(this.#inventory); }
    report() { return frozenClone(this.#directReport); }
}
function createDirectReport(artifacts, inventory) {
    return {
        schemaVersion: 1,
        contract: "dokkan-database-character-leader-supported-shadow-consumer",
        contractVersion: leader_supported_shadow_contract_1.CHARACTER_LEADER_SUPPORTED_SHADOW_CONTRACT_VERSION,
        mode: "explicit_opt_in_offline_local_stdout_only_timestamp_free",
        inventory: frozenClone(inventory),
        source: {
            members: characterLeaderSupportedShadowMemberIdentities(artifacts),
            fullArtifactFingerprintSha256: characterLeaderSupportedShadowArtifactFingerprint(artifacts),
            lineageFingerprintSha256: characterLeaderSupportedShadowLineageFingerprint(artifacts),
            exactRealK56Identity: hasExactCharacterLeaderSupportedShadowK56Identity(artifacts),
            sourceBoundValidationBefore: "NOT_EXECUTED", sourceBoundValidationAfter: "NOT_EXECUTED",
            fullArtifactStableAcrossLookup: "NOT_EXECUTED", fullLineageStableAcrossLookup: "NOT_EXECUTED",
        },
        boundaries: {
            supportedOnly: true, structuralIdsOnly: true, sourceOrderAndMultiplicityPreserved: true,
            conditionalEffectsIncluded: false, excludedConditionalEffects: 17, excludedConditionalReferences: 45,
            excludedReason: "runtime_deck_index_unresolved", corroborativeRuleId: "k56-conditional-domain-rule-v1",
            corroborativeRuleCoverageOnly: true, firstPartyRuntimeDeckIndexEvidence: false,
            corroborativeRuleUsedToAuthorizeSupportedProjection: false, corroborativeRulePresentInDataset: false,
            persistedConsumer: false, writerOrOutputArtifact: false, applyOrOverlay: false,
            authoritySelected: false, productionModified: false, networkEnabled: false,
        },
        rssAccounting: { scope: "per_process_not_process_tree", measurements: null },
        readiness: directReadiness(),
    };
}
function directReadiness() {
    return {
        consumerShadow: "NOT_EXECUTED", sourceBoundValidation: "NOT_EXECUTED", perProcessRssUnder1GiB: "NOT_EXECUTED",
        processTreeRssUnder1GiB: "NO-GO", persistedConsumer: "NO-GO", writerOrOutputArtifact: "NO-GO",
        applyOrOverlay: "NO-GO", combinedLeaderFriendOrEffectiveValue: "NO-GO", finalCombatCalculation: "NO-GO",
        conditional17: "NO-GO", deckFallback: "NO-GO", authority: "NO-GO", production: "NO-GO",
        publisher: "NO-GO", network: "NO-GO", r2: "NO-GO", android: "NO-GO", ui: "NO-GO",
        fyiRemoval: "NO-GO", dynamicInstrumentation: "NO-GO",
    };
}
function assertCharacterLeaderSupportedShadowReportBound(report) {
    const bytes = Buffer.byteLength(`${JSON.stringify(report, null, 2)}\n`, "utf8");
    if (bytes >= leader_supported_shadow_contract_1.CHARACTER_LEADER_SUPPORTED_SHADOW_REPORT_LIMIT_BYTES)
        throw new Error(`K57 report byte limit reached: ${bytes}`);
    const serialized = json(report);
    if (/"records"|description|presentation|Character\[\]|sourceText|label|nameText/i.test(serialized)) {
        throw new Error("K57 report exposed unsupported record or presentation fields");
    }
}
exports.assertCharacterLeaderSupportedShadowReportBound = assertCharacterLeaderSupportedShadowReportBound;
function createCharacterLeaderSupportedShadow(artifacts) {
    const consumer = new CharacterLeaderSupportedShadowConsumerImpl(artifacts);
    assertCharacterLeaderSupportedShadowReportBound(consumer.report());
    return Object.freeze(consumer);
}
exports.createCharacterLeaderSupportedShadow = createCharacterLeaderSupportedShadow;
//# sourceMappingURL=leader-supported-shadow.js.map