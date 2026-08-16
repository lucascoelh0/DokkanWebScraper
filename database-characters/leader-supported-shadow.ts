import { createHash } from "crypto";
import { gunzipSync } from "zlib";
import {
    CHARACTER_LEADER_SUPPORTED_PROJECTION_GZIP_LIMIT_BYTES,
    CHARACTER_LEADER_SUPPORTED_PROJECTION_METADATA_LIMIT_BYTES,
    CHARACTER_LEADER_SUPPORTED_PROJECTION_PIN,
    CHARACTER_LEADER_SUPPORTED_PROJECTION_RAW_LIMIT_BYTES,
    CharacterLeaderSupportedProjectionArtifactSet,
    CharacterLeaderSupportedProjectionRecord,
} from "./leader-supported-projection-contract";
import { validateCharacterLeaderSupportedProjection } from "./leader-supported-projection";
import {
    CHARACTER_LEADER_SUPPORTED_SHADOW_CONTRACT_VERSION,
    CHARACTER_LEADER_SUPPORTED_SHADOW_PIN,
    CHARACTER_LEADER_SUPPORTED_SHADOW_REPORT_LIMIT_BYTES,
    CharacterLeaderSupportedShadowInventory,
    CharacterLeaderSupportedShadowMemberIdentity,
    CharacterLeaderSupportedShadowRecord,
    CharacterLeaderSupportedShadowReport,
} from "./leader-supported-shadow-contract";

const hash = (bytes: Buffer | string): string => createHash("sha256").update(bytes).digest("hex");
const json = (value: unknown): string => JSON.stringify(value);
const memberIdentity = (bytes: Buffer): CharacterLeaderSupportedShadowMemberIdentity => ({ sizeBytes: bytes.length, sha256: hash(bytes) });

function deepFreeze<T>(value: T): T {
    if (value && typeof value === "object" && !Object.isFrozen(value)) {
        for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
        Object.freeze(value);
    }
    return value;
}

function frozenClone<T>(value: T): T {
    return deepFreeze(JSON.parse(JSON.stringify(value)) as T);
}

function parseExact(bytes: Buffer, expected: unknown, label: string): void {
    let parsed: unknown;
    try { parsed = JSON.parse(bytes.toString("utf8")); }
    catch { throw new Error(`K57 ${label} JSON rejected`); }
    if (json(parsed) !== json(expected)) throw new Error(`K57 ${label} object/bytes mismatch`);
}

export function characterLeaderSupportedShadowArtifactFingerprint(
    artifacts: CharacterLeaderSupportedProjectionArtifactSet,
): string {
    const digest = createHash("sha256");
    for (const [label, bytes] of [
        ["raw", artifacts.raw], ["payload", artifacts.gzip], ["coverage", artifacts.coverageBytes],
        ["validation", artifacts.validationBytes], ["manifest", artifacts.manifestBytes],
    ] as const) {
        digest.update(`${label}:${bytes.length}:`, "utf8");
        digest.update(bytes);
        digest.update("\0", "utf8");
    }
    return digest.digest("hex");
}

export function characterLeaderSupportedShadowLineageFingerprint(
    artifacts: CharacterLeaderSupportedProjectionArtifactSet,
): string {
    return hash(json({ dataset: artifacts.dataset.source, manifest: artifacts.manifest.source }));
}

export function characterLeaderSupportedShadowMemberIdentities(
    artifacts: CharacterLeaderSupportedProjectionArtifactSet,
): CharacterLeaderSupportedShadowReport["source"]["members"] {
    return {
        raw: memberIdentity(artifacts.raw), payload: memberIdentity(artifacts.gzip),
        coverage: memberIdentity(artifacts.coverageBytes), validation: memberIdentity(artifacts.validationBytes),
        manifest: memberIdentity(artifacts.manifestBytes),
    };
}

export function hasExactCharacterLeaderSupportedShadowK56Identity(
    artifacts: CharacterLeaderSupportedProjectionArtifactSet,
): boolean {
    return json(characterLeaderSupportedShadowMemberIdentities(artifacts)) === json({
        raw: CHARACTER_LEADER_SUPPORTED_SHADOW_PIN.raw,
        payload: CHARACTER_LEADER_SUPPORTED_SHADOW_PIN.payload,
        coverage: CHARACTER_LEADER_SUPPORTED_SHADOW_PIN.coverage,
        validation: CHARACTER_LEADER_SUPPORTED_SHADOW_PIN.validation,
        manifest: CHARACTER_LEADER_SUPPORTED_SHADOW_PIN.manifest,
    });
}

export function assertExactCharacterLeaderSupportedShadowK56Identity(
    artifacts: CharacterLeaderSupportedProjectionArtifactSet,
): void {
    if (!hasExactCharacterLeaderSupportedShadowK56Identity(artifacts)
        || artifacts.manifest.sha256 !== CHARACTER_LEADER_SUPPORTED_SHADOW_PIN.payload.sha256
        || artifacts.manifest.sizeBytes !== CHARACTER_LEADER_SUPPORTED_SHADOW_PIN.payload.sizeBytes
        || artifacts.manifest.uncompressedSha256 !== CHARACTER_LEADER_SUPPORTED_SHADOW_PIN.raw.sha256
        || artifacts.manifest.uncompressedSizeBytes !== CHARACTER_LEADER_SUPPORTED_SHADOW_PIN.raw.sizeBytes
        || artifacts.manifest.coverageSha256 !== CHARACTER_LEADER_SUPPORTED_SHADOW_PIN.coverage.sha256
        || artifacts.manifest.coverageSizeBytes !== CHARACTER_LEADER_SUPPORTED_SHADOW_PIN.coverage.sizeBytes
        || artifacts.manifest.validationSha256 !== CHARACTER_LEADER_SUPPORTED_SHADOW_PIN.validation.sha256
        || artifacts.manifest.validationSizeBytes !== CHARACTER_LEADER_SUPPORTED_SHADOW_PIN.validation.sizeBytes) {
        throw new Error("K57 exact real K56 artifact identity rejected");
    }
}

function assertK56Boundary(artifacts: CharacterLeaderSupportedProjectionArtifactSet): void {
    if (artifacts.raw.length >= CHARACTER_LEADER_SUPPORTED_PROJECTION_RAW_LIMIT_BYTES
        || artifacts.gzip.length >= CHARACTER_LEADER_SUPPORTED_PROJECTION_GZIP_LIMIT_BYTES
        || artifacts.coverageBytes.length + artifacts.validationBytes.length + artifacts.manifestBytes.length
            >= CHARACTER_LEADER_SUPPORTED_PROJECTION_METADATA_LIMIT_BYTES) throw new Error("K57 K56 artifact byte budget rejected");
    parseExact(artifacts.raw, artifacts.dataset, "raw dataset");
    if (!gunzipSync(artifacts.gzip, { maxOutputLength: CHARACTER_LEADER_SUPPORTED_PROJECTION_RAW_LIMIT_BYTES }).equals(artifacts.raw)) {
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
        || json(artifacts.manifest.counts) !== json(artifacts.coverage.counts)) throw new Error("K57 K56 self-contained identity rejected");

    const recomputed = validateCharacterLeaderSupportedProjection(artifacts.dataset, artifacts.coverage, {
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
        || coverage.counts.totalEffects !== CHARACTER_LEADER_SUPPORTED_SHADOW_PIN.totalEffects
        || coverage.counts.totalReferences !== CHARACTER_LEADER_SUPPORTED_SHADOW_PIN.totalReferences
        || coverage.counts.projectedEffects !== CHARACTER_LEADER_SUPPORTED_SHADOW_PIN.distinctEffectRowIds
        || coverage.counts.projectedReferences !== CHARACTER_LEADER_SUPPORTED_SHADOW_PIN.references
        || coverage.counts.excludedEffects !== CHARACTER_LEADER_SUPPORTED_SHADOW_PIN.excludedEffects
        || coverage.counts.excludedReferences !== CHARACTER_LEADER_SUPPORTED_SHADOW_PIN.excludedReferences
        || json(coverage.excluded.map(item => item.effectRowId)) !== json(CHARACTER_LEADER_SUPPORTED_PROJECTION_PIN.conditionalEffectRowIds)
        || coverage.excluded.reduce((total, item) => total + item.affectedReferences.length, 0) !== CHARACTER_LEADER_SUPPORTED_SHADOW_PIN.excludedReferences
        || coverage.excluded.some(item => item.reason !== "runtime_deck_index_unresolved"
            || item.corroborativeRule.ruleId !== "k56-conditional-domain-rule-v1"
            || item.corroborativeRule.provenance !== "user_confirmed_domain_rule"
            || item.corroborativeRule.usedToAuthorizeSupportedProjection !== false)
        || coverage.corroborativeDomainRules.length !== 1
        || coverage.corroborativeDomainRules[0].ruleId !== "k56-conditional-domain-rule-v1"
        || coverage.corroborativeDomainRules[0].firstPartyRuntimeDeckIndexEvidence !== false
        || coverage.corroborativeDomainRules[0].usedToAuthorizeSupportedProjection !== false
        || coverage.corroborativeDomainRules[0].appliesToExcludedConditionalEffectsOnly !== true
        || json(dataset).includes("k56-conditional-domain-rule-v1")) throw new Error("K57 K56 supported-only boundary rejected");
}

function add<K>(map: Map<K, string[]>, key: K, serializedRecord: string): void {
    const records = map.get(key);
    if (records) records.push(serializedRecord); else map.set(key, [serializedRecord]);
}

export function assertCharacterLeaderSupportedShadowReferenceIdentitiesUnique(
    records: ReadonlyArray<CharacterLeaderSupportedProjectionRecord>,
): void {
    const seen = new Set<string>();
    for (const record of records) {
        const key = json([record.stateId, record.sourceEffectOccurrenceIndex]);
        if (seen.has(key)) throw new Error(`K57 duplicate reference identity ${key}`);
        seen.add(key);
    }
}

export interface CharacterLeaderSupportedShadowConsumer {
    lookupReference(stateId: string, sourceEffectOccurrenceIndex: number): CharacterLeaderSupportedShadowRecord | undefined;
    lookupStateId(stateId: string): ReadonlyArray<CharacterLeaderSupportedShadowRecord>;
    lookupCardId(cardId: string): ReadonlyArray<CharacterLeaderSupportedShadowRecord>;
    lookupEffectRowId(effectRowId: string): ReadonlyArray<CharacterLeaderSupportedShadowRecord>;
    inventory(): Readonly<CharacterLeaderSupportedShadowInventory>;
    report(): Readonly<CharacterLeaderSupportedShadowReport>;
}

class CharacterLeaderSupportedShadowConsumerImpl implements CharacterLeaderSupportedShadowConsumer {
    readonly #byReference = new Map<string, string>();
    readonly #byStateId = new Map<string, string[]>();
    readonly #byCardId = new Map<string, string[]>();
    readonly #byEffectRowId = new Map<string, string[]>();
    readonly #inventory: CharacterLeaderSupportedShadowInventory;
    readonly #directReport: CharacterLeaderSupportedShadowReport;

    constructor(artifacts: CharacterLeaderSupportedProjectionArtifactSet) {
        assertCharacterLeaderSupportedShadowReferenceIdentitiesUnique(artifacts.dataset.records);
        assertK56Boundary(artifacts);
        const stateSamples: string[] = [], cardSamples: string[] = [], effectSamples: string[] = [];
        for (const record of artifacts.dataset.records) {
            const referenceKey = json([record.stateId, record.sourceEffectOccurrenceIndex]);
            if (this.#byReference.has(referenceKey)) throw new Error(`K57 duplicate reference identity ${referenceKey}`);
            const serializedRecord = json(record);
            this.#byReference.set(referenceKey, serializedRecord);
            if (!this.#byStateId.has(record.stateId) && stateSamples.length < 5) stateSamples.push(record.stateId);
            if (!this.#byCardId.has(record.cardId) && cardSamples.length < 5) cardSamples.push(record.cardId);
            if (!this.#byEffectRowId.has(record.effectRowId) && effectSamples.length < 5) effectSamples.push(record.effectRowId);
            add(this.#byStateId, record.stateId, serializedRecord);
            add(this.#byCardId, record.cardId, serializedRecord);
            add(this.#byEffectRowId, record.effectRowId, serializedRecord);
        }
        if (this.#byReference.size !== CHARACTER_LEADER_SUPPORTED_SHADOW_PIN.references
            || this.#byStateId.size !== CHARACTER_LEADER_SUPPORTED_SHADOW_PIN.distinctStateIds
            || this.#byCardId.size !== CHARACTER_LEADER_SUPPORTED_SHADOW_PIN.distinctCardIds
            || this.#byEffectRowId.size !== CHARACTER_LEADER_SUPPORTED_SHADOW_PIN.distinctEffectRowIds) {
            throw new Error("K57 exact index inventory pin changed");
        }
        this.#inventory = deepFreeze({
            references: CHARACTER_LEADER_SUPPORTED_SHADOW_PIN.references,
            distinctStateIds: CHARACTER_LEADER_SUPPORTED_SHADOW_PIN.distinctStateIds,
            distinctCardIds: CHARACTER_LEADER_SUPPORTED_SHADOW_PIN.distinctCardIds,
            distinctEffectRowIds: CHARACTER_LEADER_SUPPORTED_SHADOW_PIN.distinctEffectRowIds,
            samples: {
                stateIds: stateSamples, cardIds: cardSamples, effectRowIds: effectSamples,
                references: artifacts.dataset.records.slice(0, 5).map(record => ({
                    stateId: record.stateId, sourceEffectOccurrenceIndex: record.sourceEffectOccurrenceIndex,
                })),
            },
        });
        this.#directReport = deepFreeze(createDirectReport(artifacts, this.#inventory));
    }

    lookupReference(stateId: string, sourceEffectOccurrenceIndex: number): CharacterLeaderSupportedShadowRecord | undefined {
        if (!stateId || !Number.isSafeInteger(sourceEffectOccurrenceIndex) || sourceEffectOccurrenceIndex < 0) throw new Error("K57 reference lookup rejected");
        const record = this.#byReference.get(json([stateId, sourceEffectOccurrenceIndex]));
        return record ? deepFreeze(JSON.parse(record) as CharacterLeaderSupportedProjectionRecord) : undefined;
    }
    lookupStateId(stateId: string): ReadonlyArray<CharacterLeaderSupportedShadowRecord> {
        if (!stateId) throw new Error("K57 stateId lookup rejected");
        return deepFreeze((this.#byStateId.get(stateId) ?? []).map(record => JSON.parse(record) as CharacterLeaderSupportedProjectionRecord));
    }
    lookupCardId(cardId: string): ReadonlyArray<CharacterLeaderSupportedShadowRecord> {
        if (!cardId) throw new Error("K57 cardId lookup rejected");
        return deepFreeze((this.#byCardId.get(cardId) ?? []).map(record => JSON.parse(record) as CharacterLeaderSupportedProjectionRecord));
    }
    lookupEffectRowId(effectRowId: string): ReadonlyArray<CharacterLeaderSupportedShadowRecord> {
        if (!effectRowId) throw new Error("K57 effectRowId lookup rejected");
        return deepFreeze((this.#byEffectRowId.get(effectRowId) ?? []).map(record => JSON.parse(record) as CharacterLeaderSupportedProjectionRecord));
    }
    inventory(): Readonly<CharacterLeaderSupportedShadowInventory> { return frozenClone(this.#inventory); }
    report(): Readonly<CharacterLeaderSupportedShadowReport> { return frozenClone(this.#directReport); }
}

function createDirectReport(
    artifacts: CharacterLeaderSupportedProjectionArtifactSet,
    inventory: CharacterLeaderSupportedShadowInventory,
): CharacterLeaderSupportedShadowReport {
    return {
        schemaVersion: 1,
        contract: "dokkan-database-character-leader-supported-shadow-consumer",
        contractVersion: CHARACTER_LEADER_SUPPORTED_SHADOW_CONTRACT_VERSION,
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

function directReadiness(): CharacterLeaderSupportedShadowReport["readiness"] {
    return {
        consumerShadow: "NOT_EXECUTED", sourceBoundValidation: "NOT_EXECUTED", perProcessRssUnder1GiB: "NOT_EXECUTED",
        processTreeRssUnder1GiB: "NO-GO", persistedConsumer: "NO-GO", writerOrOutputArtifact: "NO-GO",
        applyOrOverlay: "NO-GO", combinedLeaderFriendOrEffectiveValue: "NO-GO", finalCombatCalculation: "NO-GO",
        conditional17: "NO-GO", deckFallback: "NO-GO", authority: "NO-GO", production: "NO-GO",
        publisher: "NO-GO", network: "NO-GO", r2: "NO-GO", android: "NO-GO", ui: "NO-GO",
        fyiRemoval: "NO-GO", dynamicInstrumentation: "NO-GO",
    };
}

export function assertCharacterLeaderSupportedShadowReportBound(report: CharacterLeaderSupportedShadowReport): void {
    const bytes = Buffer.byteLength(`${JSON.stringify(report, null, 2)}\n`, "utf8");
    if (bytes >= CHARACTER_LEADER_SUPPORTED_SHADOW_REPORT_LIMIT_BYTES) throw new Error(`K57 report byte limit reached: ${bytes}`);
    const serialized = json(report);
    if (/"records"|description|presentation|Character\[\]|sourceText|label|nameText/i.test(serialized)) {
        throw new Error("K57 report exposed unsupported record or presentation fields");
    }
}

export function createCharacterLeaderSupportedShadow(
    artifacts: CharacterLeaderSupportedProjectionArtifactSet,
): Readonly<CharacterLeaderSupportedShadowConsumer> {
    const consumer = new CharacterLeaderSupportedShadowConsumerImpl(artifacts);
    assertCharacterLeaderSupportedShadowReportBound(consumer.report() as CharacterLeaderSupportedShadowReport);
    return Object.freeze(consumer);
}
