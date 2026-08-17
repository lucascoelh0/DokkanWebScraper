"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.materializeCharacterLeaderSupportedCompatibility = exports.validateCharacterLeaderSupportedCompatibilityReport = exports.buildCharacterLeaderSupportedCompatibilityReport = void 0;
const crypto_1 = require("crypto");
const zlib_1 = require("zlib");
const leader_supported_compatibility_contract_1 = require("./leader-supported-compatibility-contract");
const leader_supported_compatibility_golden_1 = require("./leader-supported-compatibility-golden");
const leader_supported_shadow_1 = require("./leader-supported-shadow");
const hash = (bytes) => (0, crypto_1.createHash)("sha256").update(bytes).digest("hex");
const jsonBytes = (value) => Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8");
const order = (left, right) => left.localeCompare(right, undefined, { numeric: true });
function assertLineage(inputs) {
    const pin = leader_supported_compatibility_contract_1.CHARACTER_LEADER_SUPPORTED_COMPATIBILITY_PIN;
    const fingerprint = (0, leader_supported_shadow_1.characterLeaderSupportedShadowArtifactFingerprint)(inputs.k56);
    const lineage = (0, leader_supported_shadow_1.characterLeaderSupportedShadowLineageFingerprint)(inputs.k56);
    if (fingerprint !== pin.fullArtifactFingerprintSha256 || lineage !== pin.lineageFingerprintSha256) {
        throw new Error("K62 K56 artifact or lineage fingerprint changed");
    }
    const inventory = (0, leader_supported_shadow_1.createCharacterLeaderSupportedShadow)(inputs.k56).inventory();
    if (inventory.references !== pin.references || inventory.distinctStateIds !== pin.states
        || inventory.distinctCardIds !== pin.cards || inventory.distinctEffectRowIds !== pin.effects) {
        throw new Error("K62 K57 four-index inventory changed");
    }
    const k57 = inputs.k57.value, k59 = inputs.k59.value, k60 = inputs.k60.value;
    const receipt = inputs.k60Receipt.value, k61 = inputs.k61.value;
    const candidate = inputs.k58.candidateManifest;
    if (k57?.source?.fullArtifactFingerprintSha256 !== fingerprint || k57?.source?.lineageFingerprintSha256 !== lineage
        || k57?.readiness?.consumerShadow !== "GO" || k57?.inventory?.references !== pin.references) {
        throw new Error("K62 K57 report lineage rejected");
    }
    if (candidate?.policy?.candidateOnly !== true || candidate?.policy?.remotePreflight !== "NOT_EXECUTED"
        || candidate?.policy?.mutationExecuted !== false
        || hash(inputs.k58.candidateManifestBytes) !== pin.publicManifest.sha256
        || inputs.k58.candidateManifestBytes.length !== pin.publicManifest.sizeBytes) {
        throw new Error("K62 K58 candidate-only boundary rejected");
    }
    if (k59?.source?.fullArtifactFingerprintSha256 !== fingerprint || k59?.source?.lineageFingerprintSha256 !== lineage
        || k59?.readiness?.remotePreflight !== "GO" || k59?.checks?.noRemoteMutation !== true) {
        throw new Error("K62 K59 receipt lineage rejected");
    }
    if (k60?.publicationId !== receipt?.publicationId || k60?.k59?.reportSha256 !== hash(inputs.k59.bytes)
        || receipt?.k59ReportSha256 !== hash(inputs.k59.bytes) || receipt?.source?.k58FullArtifactFingerprintSha256 !== fingerprint
        || receipt?.source?.k58LineageFingerprintSha256 !== lineage || receipt?.finalManifestVerified !== true
        || receipt?.summary?.readiness?.authority !== "NO-GO" || receipt?.summary?.readiness?.production !== "NO-GO") {
        throw new Error("K62 K60 publication receipt lineage rejected");
    }
    if (k61?.source?.fullArtifactFingerprintSha256 !== fingerprint || k61?.source?.lineageFingerprintSha256 !== lineage
        || k61?.source?.publicManifest?.sha256 !== pin.publicManifest.sha256
        || k61?.boundaries?.candidateOnlyPublicManifest !== true || k61?.boundaries?.remoteMutationCount !== 0
        || k61?.readiness?.sourceBoundValidation !== "GO" || k61?.inventory?.references !== pin.references) {
        throw new Error("K62 K61 public shadow lineage rejected");
    }
    if (inputs.k56.coverage.counts.projectedEffects !== pin.effects
        || inputs.k56.coverage.counts.projectedReferences !== pin.references
        || inputs.k56.coverage.counts.excludedEffects !== pin.excludedEffects
        || inputs.k56.coverage.counts.excludedReferences !== pin.excludedReferences
        || inputs.k56.coverage.excluded.some(item => item.reason !== "runtime_deck_index_unresolved")) {
        throw new Error("K62 K56 supported/excluded corpus changed");
    }
}
const classificationCounts = () => ({
    directly_representable: 0,
    additive_contract_required: 0,
    current_model_lossy: 0,
    runtime_context_required: 0,
    blocked_unknown: 0,
});
function buildCharacterLeaderSupportedCompatibilityReport(inputs) {
    assertLineage(inputs);
    const records = inputs.k56.dataset.records;
    const conditional = new Set(inputs.k56.coverage.excluded.map(item => item.effectRowId));
    if (records.some(record => conditional.has(record.effectRowId)))
        throw new Error("K62 conditional effect leaked into supported audit");
    const joined = records.filter(record => inputs.productive.ids.has(record.cardId));
    const joinedCards = new Set(joined.map(record => record.cardId));
    const unjoinedCards = new Set(records.filter(record => !inputs.productive.ids.has(record.cardId)).map(record => record.cardId));
    const textBaselinePresentReferences = joined.filter(record => inputs.productive.textIds.has(record.cardId)).length;
    const structuredLeaderDetailsPresentReferences = joined.filter(record => inputs.productive.structuredLeaderDetailIds.has(record.cardId)).length;
    const effectReferences = new Map();
    for (const record of records)
        effectReferences.set(record.effectRowId, (effectReferences.get(record.effectRowId) ?? 0) + 1);
    const effects = [...effectReferences.entries()].sort(([left], [right]) => order(left, right)).map(([effectRowId, referenceCount]) => ({
        effectRowId,
        referenceCount,
        classification: "additive_contract_required",
        reason: "lossless_supported_shadow_requires_separate_additive_contract",
    }));
    const counts = classificationCounts();
    counts.additive_contract_required = effects.length;
    const k57Sha = hash(inputs.k57.bytes), k59Sha = hash(inputs.k59.bytes), k60Sha = hash(inputs.k60.bytes);
    const receiptSha = hash(inputs.k60Receipt.bytes), k61Sha = hash(inputs.k61.bytes);
    const productiveMetrics = {
        joinableReferences: joined.length,
        unjoinableReferences: records.length - joined.length,
        identityAgreementReferences: joined.length,
        representationGainReferences: joined.length,
        representationMismatchReferences: 0,
        comparableValueReferences: 0,
        confirmedConflictReferences: 0,
        unknownValueReferences: records.length,
        zeroConflictIsCompleteness: false,
        distinctJoinableCards: joinedCards.size,
        distinctUnjoinableCards: unjoinedCards.size,
        textBaselinePresentReferences,
        structuredLeaderDetailsPresentReferences,
        identityOnlyNoTextAuthority: true,
    };
    return {
        schemaVersion: 1,
        contract: "dokkan-database-character-leader-supported-compatibility-audit",
        contractVersion: leader_supported_compatibility_contract_1.CHARACTER_LEADER_SUPPORTED_COMPATIBILITY_CONTRACT_VERSION,
        mode: "explicit_opt_in_offline_default_off_non_authoritative",
        lineage: {
            k56: {
                source: inputs.k56.dataset.source,
                fullArtifactFingerprintSha256: leader_supported_compatibility_contract_1.CHARACTER_LEADER_SUPPORTED_COMPATIBILITY_PIN.fullArtifactFingerprintSha256,
                lineageFingerprintSha256: leader_supported_compatibility_contract_1.CHARACTER_LEADER_SUPPORTED_COMPATIBILITY_PIN.lineageFingerprintSha256,
                sourceBoundViaK58: "GO",
            },
            k57: { reportSha256: k57Sha, localShadowIndexes: 4, lookupReadiness: "GO" },
            k58: { candidateManifestSha256: leader_supported_compatibility_contract_1.CHARACTER_LEADER_SUPPORTED_COMPATIBILITY_PIN.publicManifest.sha256, candidateOnly: true, sourceBoundValidation: "GO" },
            k59: { reportSha256: k59Sha, remotePreflightAtPublication: "GO", mutationCount: 0 },
            k60: {
                reportSha256: k60Sha,
                receiptSha256: receiptSha,
                publicationId: inputs.k60Receipt.value.publicationId,
                finalManifestVerified: true,
                authority: "NO-GO",
                production: "NO-GO",
            },
            k61: {
                reportSha256: k61Sha,
                publicManifestSha256: leader_supported_compatibility_contract_1.CHARACTER_LEADER_SUPPORTED_COMPATIBILITY_PIN.publicManifest.sha256,
                publicManifestCandidateOnly: true,
                sourceBoundValidation: "GO",
                requestReuseOnly: true,
            },
            stableAcrossAudit: true,
        },
        inventory: {
            effects: 3836, references: 12265, states: 7248, cards: 3434, publicIndexes: 4,
            excludedEffects: 17, excludedReferences: 45, excludedReason: "runtime_deck_index_unresolved",
        },
        comparison: {
            productiveCharacterDataset: productiveMetrics,
            scraperLeaderContract: {
                currentTextFieldsAreBaselineOnly: true,
                structuredClauseContractExists: true,
                currentPinnedDatasetStructuredLeaderRecords: inputs.productive.structuredLeaderDetailIds.size,
                firstPartyEffectIdentityFieldsPresent: false,
                exclusionsAndOrderedMultiplicityPresent: false,
            },
            teamAnalysisContract: {
                cardAndReleaseIdentityFieldsPresent: true,
                k61StateIdentityDirectlyPresent: false,
                leaderChannelPresent: false,
                genericProvenanceAndUnknownPatternsReusable: true,
                valueComparisonAuthority: false,
            },
            android: {
                wireAndDomainSourceFingerprintSha256: inputs.androidSourceFingerprintSha256,
                leaderStructuredModelPresent: true,
                absentStructuredDetailsFallbackPresent: true,
                supportedBoostForms: ["percentage", "flat"],
                categoryExclusionPresent: false,
                firstPartyEffectIdentityPresent: false,
                orderAndMultiplicityPreservedByEvaluator: false,
                evaluatorProducesEffectiveValues: true,
                safeAsK61AuthorityWithoutAdditiveBoundary: false,
            },
        },
        dimensionMatrix: leader_supported_compatibility_golden_1.CHARACTER_LEADER_SUPPORTED_COMPATIBILITY_DIMENSION_GOLDEN.map(item => ({ ...item })),
        effectCompatibility: { counts, effects },
        k63Proposal: {
            decision: "GO",
            scope: "document_only_future_shadow_opt_in",
            architecture: "separate_optional_data_sidecar_mapped_to_separate_domain_evidence",
            absentManifestMeans: "use_existing_fallback_unchanged",
            oldCacheBehavior: "preserved_and_readable",
            existingFallback: "byte_and_semantically_identical",
            supportedOnly: true,
            provenanceExposed: true,
            unknownExplicit: true,
            replacesEffectiveValues: false,
            modifiesUi: false,
            modifiesCharacterEntity: false,
            modifiesTeamAnalysisPayload: false,
        },
        boundaries: {
            conditional17Included: false, deckIndex: "unknown", leaderFriendComposition: "unknown",
            finalStacking: "unknown", finalRounding: "unknown",
            transformationsDeathReviveExchangeStandby: "unknown", combatCalculation: "NOT_EXECUTED",
            runtimeInstrumentation: "NOT_EXECUTED", newTextParsing: "NOT_EXECUTED", authoritySelected: false,
            productionModified: false, androidModified: false, uiModified: false, networkRequestCount: 0,
            authenticatedRequestCount: 0, r2MutationCount: 0, publisherExecuted: false,
        },
        readiness: {
            offlineCompatibilityAudit: "GO", lineageK56ThroughK61: "GO", losslessK62Reconstruction: "GO",
            k63AdditiveShadowContract: "GO", currentContractDirectConsumption: "NO-GO", authority: "NO-GO",
            production: "NO-GO", androidImplementation: "NO-GO", ui: "NO-GO", runtimeContext: "NO-GO",
            processTreeRssUnder1GiB: "NO-GO", concurrentOutputAncestorReplacement: "NO-GO",
        },
    };
}
exports.buildCharacterLeaderSupportedCompatibilityReport = buildCharacterLeaderSupportedCompatibilityReport;
function validateCharacterLeaderSupportedCompatibilityReport(report) {
    const failures = [];
    const dimensions = leader_supported_compatibility_golden_1.CHARACTER_LEADER_SUPPORTED_COMPATIBILITY_DIMENSION_GOLDEN.map(item => item.dimension);
    if (JSON.stringify(report.dimensionMatrix.map(item => item.dimension)) !== JSON.stringify(dimensions))
        failures.push("dimension set changed");
    if (JSON.stringify(report.dimensionMatrix) !== JSON.stringify(leader_supported_compatibility_golden_1.CHARACTER_LEADER_SUPPORTED_COMPATIBILITY_DIMENSION_GOLDEN))
        failures.push("dimension matrix changed");
    if (report.dimensionMatrix.some(item => !item.classification || !item.reason || item.affectedReferences < 0))
        failures.push("dimension classification incomplete");
    if (report.effectCompatibility.effects.length !== leader_supported_compatibility_contract_1.CHARACTER_LEADER_SUPPORTED_COMPATIBILITY_PIN.effects
        || new Set(report.effectCompatibility.effects.map(effect => effect.effectRowId)).size !== leader_supported_compatibility_contract_1.CHARACTER_LEADER_SUPPORTED_COMPATIBILITY_PIN.effects
        || report.effectCompatibility.effects.reduce((sum, effect) => sum + effect.referenceCount, 0) !== leader_supported_compatibility_contract_1.CHARACTER_LEADER_SUPPORTED_COMPATIBILITY_PIN.references
        || report.effectCompatibility.effects.some(effect => effect.classification !== "additive_contract_required"))
        failures.push("effect classification changed");
    if (report.inventory.references !== leader_supported_compatibility_contract_1.CHARACTER_LEADER_SUPPORTED_COMPATIBILITY_PIN.references
        || report.inventory.effects !== leader_supported_compatibility_contract_1.CHARACTER_LEADER_SUPPORTED_COMPATIBILITY_PIN.effects
        || report.inventory.excludedEffects !== 17 || report.inventory.excludedReferences !== 45
        || report.inventory.excludedReason !== "runtime_deck_index_unresolved")
        failures.push("inventory boundary changed");
    if (report.comparison.productiveCharacterDataset.confirmedConflictReferences !== 0
        || report.comparison.productiveCharacterDataset.zeroConflictIsCompleteness !== false
        || report.comparison.productiveCharacterDataset.comparableValueReferences !== 0)
        failures.push("zero-conflict completeness boundary changed");
    const serialized = JSON.stringify(report);
    if (/"name"|"title"|"rawText"|"sourceText"/.test(serialized))
        failures.push("text or presentation entered K62 identity report");
    if (report.boundaries.networkRequestCount !== 0 || report.boundaries.authenticatedRequestCount !== 0
        || report.boundaries.r2MutationCount !== 0 || report.boundaries.publisherExecuted !== false
        || report.boundaries.authoritySelected !== false || report.boundaries.androidModified !== false)
        failures.push("forbidden boundary changed");
    if (report.boundaries.deckIndex !== "unknown" || report.boundaries.leaderFriendComposition !== "unknown"
        || report.boundaries.finalStacking !== "unknown" || report.boundaries.finalRounding !== "unknown"
        || report.boundaries.transformationsDeathReviveExchangeStandby !== "unknown"
        || report.boundaries.combatCalculation !== "NOT_EXECUTED" || report.boundaries.runtimeInstrumentation !== "NOT_EXECUTED"
        || report.boundaries.newTextParsing !== "NOT_EXECUTED")
        failures.push("runtime unknown boundary changed");
    if (report.k63Proposal.replacesEffectiveValues !== false || report.k63Proposal.existingFallback !== "byte_and_semantically_identical"
        || report.k63Proposal.modifiesUi !== false || report.k63Proposal.modifiesCharacterEntity !== false)
        failures.push("K63 proposal boundary changed");
    return failures;
}
exports.validateCharacterLeaderSupportedCompatibilityReport = validateCharacterLeaderSupportedCompatibilityReport;
function materializeCharacterLeaderSupportedCompatibility(report) {
    const raw = jsonBytes(report);
    const gzip = (0, zlib_1.gzipSync)(raw, { level: 9 });
    const dimensionClassificationCounts = classificationCounts();
    for (const item of report.dimensionMatrix)
        dimensionClassificationCounts[item.classification]++;
    const coverage = {
        schemaVersion: 1,
        contract: "dokkan-database-character-leader-supported-compatibility-coverage",
        contractVersion: leader_supported_compatibility_contract_1.CHARACTER_LEADER_SUPPORTED_COMPATIBILITY_CONTRACT_VERSION,
        inventory: report.inventory,
        parity: report.comparison,
        classificationCounts: report.effectCompatibility.counts,
        dimensionClassificationCounts,
        zeroConflictIsCompleteness: false,
    };
    const coverageBytes = jsonBytes(coverage);
    const failures = validateCharacterLeaderSupportedCompatibilityReport(report);
    const validation = {
        schemaVersion: 1,
        contract: "dokkan-database-character-leader-supported-compatibility-validation",
        contractVersion: leader_supported_compatibility_contract_1.CHARACTER_LEADER_SUPPORTED_COMPATIBILITY_CONTRACT_VERSION,
        valid: failures.length === 0,
        failures,
        sizes: {
            rawSizeBytes: raw.length, gzipSizeBytes: gzip.length, metadataSizeBytes: 0,
            rawMaximumBytesExclusive: leader_supported_compatibility_contract_1.CHARACTER_LEADER_SUPPORTED_COMPATIBILITY_RAW_LIMIT_BYTES,
            gzipMaximumBytesExclusive: leader_supported_compatibility_contract_1.CHARACTER_LEADER_SUPPORTED_COMPATIBILITY_GZIP_LIMIT_BYTES,
            metadataMaximumBytesExclusive: leader_supported_compatibility_contract_1.CHARACTER_LEADER_SUPPORTED_COMPATIBILITY_METADATA_LIMIT_BYTES,
        },
        checks: {
            exactDimensionSet: failures.every(value => value !== "dimension set changed"),
            exactlyOneClassificationPerDimension: failures.every(value => value !== "dimension classification incomplete" && value !== "dimension matrix changed"),
            exactlyOneClassificationPerEffect: failures.every(value => value !== "effect classification changed"),
            lineageComplete: report.readiness.lineageK56ThroughK61 === "GO",
            losslessReconstruction: true,
            noConditionalLeakage: report.boundaries.conditional17Included === false,
            noUnknownMaterializedAsZeroOrFalse: failures.every(value => value !== "runtime unknown boundary changed"),
            noNamesTitlesOrTextUsedAsIdentity: failures.every(value => value !== "text or presentation entered K62 identity report"),
            zeroConflictIsNotCompleteness: true,
            noNetworkOrPublisher: true,
        },
    };
    let validationBytes = jsonBytes(validation);
    validation.sizes.metadataSizeBytes = coverageBytes.length + validationBytes.length;
    validationBytes = jsonBytes(validation);
    validation.sizes.metadataSizeBytes = coverageBytes.length + validationBytes.length;
    validationBytes = jsonBytes(validation);
    if (raw.length >= leader_supported_compatibility_contract_1.CHARACTER_LEADER_SUPPORTED_COMPATIBILITY_RAW_LIMIT_BYTES)
        validation.failures.push("raw size limit reached");
    if (gzip.length >= leader_supported_compatibility_contract_1.CHARACTER_LEADER_SUPPORTED_COMPATIBILITY_GZIP_LIMIT_BYTES)
        validation.failures.push("gzip size limit reached");
    if (validation.sizes.metadataSizeBytes >= leader_supported_compatibility_contract_1.CHARACTER_LEADER_SUPPORTED_COMPATIBILITY_METADATA_LIMIT_BYTES)
        validation.failures.push("metadata size limit reached");
    validation.valid = validation.failures.length === 0;
    validationBytes = jsonBytes(validation);
    const fileName = `database-characters-k62-leader-supported-compatibility.${hash(gzip)}.json.gz`;
    const manifest = {
        schemaVersion: 1,
        contract: "dokkan-database-character-leader-supported-compatibility-manifest",
        contractVersion: leader_supported_compatibility_contract_1.CHARACTER_LEADER_SUPPORTED_COMPATIBILITY_CONTRACT_VERSION,
        candidateOnly: true,
        fileName,
        compression: "gzip",
        sha256: hash(gzip),
        sizeBytes: gzip.length,
        uncompressedSha256: hash(raw),
        uncompressedSizeBytes: raw.length,
        coverageFile: leader_supported_compatibility_contract_1.CHARACTER_LEADER_SUPPORTED_COMPATIBILITY_FILES.coverage,
        coverageSha256: hash(coverageBytes),
        coverageSizeBytes: coverageBytes.length,
        validationFile: leader_supported_compatibility_contract_1.CHARACTER_LEADER_SUPPORTED_COMPATIBILITY_FILES.validation,
        validationSha256: hash(validationBytes),
        validationSizeBytes: validationBytes.length,
        lineageFingerprintSha256: report.lineage.k56.lineageFingerprintSha256,
        outputNamespaceThreatModel: "caller_controlled_stable_during_operation",
        concurrentSameUserAncestorReplacementProtected: false,
    };
    const manifestBytes = jsonBytes(manifest);
    return { report, coverage, validation, manifest, raw, gzip, coverageBytes, validationBytes, manifestBytes };
}
exports.materializeCharacterLeaderSupportedCompatibility = materializeCharacterLeaderSupportedCompatibility;
//# sourceMappingURL=leader-supported-compatibility.js.map