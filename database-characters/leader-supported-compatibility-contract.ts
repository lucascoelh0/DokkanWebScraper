import type { CharacterLeaderSupportedProjectionLineage } from "./leader-supported-projection-contract";
import type { CharacterLeaderCompatibilityAndroidSourceIdentity } from "./leader-supported-compatibility-git-source";

export const CHARACTER_LEADER_SUPPORTED_COMPATIBILITY_CONTRACT_VERSION = "1.2.0" as const;
export const CHARACTER_LEADER_SUPPORTED_COMPATIBILITY_RAW_LIMIT_BYTES = 4 * 1024 * 1024;
export const CHARACTER_LEADER_SUPPORTED_COMPATIBILITY_GZIP_LIMIT_BYTES = 1024 * 1024;
export const CHARACTER_LEADER_SUPPORTED_COMPATIBILITY_METADATA_LIMIT_BYTES = 256 * 1024;
export const CHARACTER_LEADER_SUPPORTED_COMPATIBILITY_RSS_LIMIT_BYTES = 1024 * 1024 * 1024;
export const CHARACTER_LEADER_SUPPORTED_COMPATIBILITY_FILES = {
    coverage: "database-characters-k62-leader-supported-compatibility-coverage.json",
    validation: "database-characters-k62-leader-supported-compatibility-validation.json",
    manifest: "database-characters-k62-leader-supported-compatibility-manifest.json",
} as const;

export const CHARACTER_LEADER_SUPPORTED_COMPATIBILITY_PIN = {
    effects: 3_836,
    references: 12_265,
    states: 7_248,
    cards: 3_434,
    publicIndexes: 4,
    excludedEffects: 17,
    excludedReferences: 45,
    publicManifest: {
        sizeBytes: 11_561,
        sha256: "370dc7026c4523d509a403a2fbfa91009d1bb9452f7ab277f9c6aaebb8a1441e",
    },
    fullArtifactFingerprintSha256: "807a98ae37cd17a68a7f3f3544c1f14b4f4bfab9f75c9b627cca23cbab41e3b3",
    lineageFingerprintSha256: "132c1e858ed5fdb6bdc97f3c5e0313c865c7bf0ee7367e1ad1453b89e280fa5f",
    productive: {
        sizeBytes: 121_390_313,
        sha256: "421c8fec6f7ba22e270af19b2278da4fbba19b6299205a54cc3d1ed570319dbc",
        topLevelCount: 4_090,
    },
    reports: {
        k57: { sizeBytes: 4_291, sha256: "626a35554a48d7d7c55c95452332bfb9b61add8420e5fc14870a43db367e99f4" },
        k59: { sizeBytes: 5_951, sha256: "bc8f09d0bc6a75bafe3e77524e0d6e4b838eddd462ac12fb6e7aa95756a9355d" },
        k60: { sizeBytes: 7_575, sha256: "ba6a5d86bffc2f7fbfd1076dacff3ec057ec9bd6a1a3fb0abdd8b96d90dfaa29" },
        k60Receipt: { sizeBytes: 1_596, sha256: "d56dd4bdb6a46570d687709acc687ae67a270908c1666c3f495e5ca29b901a68" },
        k61: { sizeBytes: 4_364, sha256: "4b2a5ed42ab5cf4d73cb40d5a40818a19e3eeab6daef01ab5755cf700bd71838" },
    },
} as const;

export type CharacterLeaderCompatibilityClassification =
    | "directly_representable"
    | "additive_contract_required"
    | "current_model_lossy"
    | "runtime_context_required"
    | "blocked_unknown";

export type CharacterLeaderCompatibilityDimension =
    | "state_card_release_identity"
    | "leader_set_effect_occurrence_identity"
    | "structural_mask"
    | "operation"
    | "common_modifier"
    | "flat_points"
    | "proportional_percent"
    | "target_team"
    | "target_super_class"
    | "target_extreme_class"
    | "included_categories"
    | "excluded_categories"
    | "sequential_and_composition"
    | "order"
    | "multiplicity"
    | "provenance"
    | "lifecycle_timing"
    | "missing_runtime_dimensions";

export interface CharacterLeaderCompatibilityDimensionAssessment {
    dimension: CharacterLeaderCompatibilityDimension;
    classification: CharacterLeaderCompatibilityClassification;
    reason: string;
    affectedReferences: number;
}

export interface CharacterLeaderCompatibilityMetrics {
    joinableReferences: number;
    unjoinableReferences: number;
    identityAgreementReferences: number;
    representationGainReferences: number;
    representationMismatchReferences: number;
    comparableValueReferences: number;
    confirmedConflictReferences: number;
    unknownValueReferences: number;
    zeroConflictIsCompleteness: false;
}

export interface CharacterLeaderSupportedCompatibilityReport {
    schemaVersion: 1;
    contract: "dokkan-database-character-leader-supported-compatibility-audit";
    contractVersion: typeof CHARACTER_LEADER_SUPPORTED_COMPATIBILITY_CONTRACT_VERSION;
    checkpoint: "K62.1";
    mode: "explicit_opt_in_offline_default_off_non_authoritative";
    lineage: {
        k56: {
            source: CharacterLeaderSupportedProjectionLineage;
            fullArtifactFingerprintSha256: string;
            lineageFingerprintSha256: string;
            sourceBoundViaK58: "GO";
        };
        k57: { reportSha256: string; localShadowIndexes: 4; lookupReadiness: "GO" };
        k58: { candidateManifestSha256: string; candidateOnly: true; sourceBoundValidation: "GO" };
        k59: { reportSha256: string; remotePreflightAtPublication: "GO"; mutationCount: 0 };
        k60: {
            reportSha256: string;
            receiptSha256: string;
            publicationId: string;
            finalManifestVerified: true;
            authority: "NO-GO";
            production: "NO-GO";
        };
        k61: {
            reportSha256: string;
            publicManifestSha256: string;
            publicManifestCandidateOnly: true;
            sourceBoundValidation: "GO";
            requestReuseOnly: true;
        };
        sourceStability: "CHECKPOINTED_PERSISTENT_DRIFT_ONLY";
        transientABADriftDetection: "NO-GO";
    };
    inventory: {
        effects: 3_836;
        references: 12_265;
        states: 7_248;
        cards: 3_434;
        publicIndexes: 4;
        excludedEffects: 17;
        excludedReferences: 45;
        excludedReason: "runtime_deck_index_unresolved";
    };
    comparison: {
        productiveCharacterDataset: CharacterLeaderCompatibilityMetrics & {
            distinctJoinableCards: number;
            distinctUnjoinableCards: number;
            textBaselinePresentReferences: number;
            structuredLeaderDetailsPresentReferences: number;
            identityOnlyNoTextAuthority: true;
        };
        scraperLeaderContract: {
            currentTextFieldsAreBaselineOnly: true;
            structuredClauseContractExists: true;
            currentPinnedDatasetStructuredLeaderRecords: number;
            firstPartyEffectIdentityFieldsPresent: false;
            exclusionsAndOrderedMultiplicityPresent: false;
        };
        teamAnalysisContract: {
            cardAndReleaseIdentityFieldsPresent: true;
            k61StateIdentityDirectlyPresent: false;
            leaderChannelPresent: false;
            genericProvenanceAndUnknownPatternsReusable: true;
            valueComparisonAuthority: false;
        };
        android: {
            source: CharacterLeaderCompatibilityAndroidSourceIdentity;
            wireAndDomainSourceFingerprintSha256: string;
            leaderStructuredModelPresent: true;
            absentStructuredDetailsFallbackPresent: true;
            supportedBoostForms: ["percentage", "flat"];
            categoryExclusionPresent: false;
            firstPartyEffectIdentityPresent: false;
            orderAndMultiplicityPreservedByEvaluator: false;
            evaluatorProducesEffectiveValues: true;
            safeAsK61AuthorityWithoutAdditiveBoundary: false;
        };
    };
    dimensionMatrix: CharacterLeaderCompatibilityDimensionAssessment[];
    effectCompatibility: {
        counts: Record<CharacterLeaderCompatibilityClassification, number>;
        effects: Array<{
            effectRowId: string;
            referenceCount: number;
            classification: CharacterLeaderCompatibilityClassification;
            reason: "lossless_supported_shadow_requires_separate_additive_contract";
        }>;
    };
    k63Proposal: {
        decision: "GO";
        scope: "document_only_future_shadow_opt_in";
        architecture: "separate_optional_data_sidecar_mapped_to_separate_domain_evidence";
        absentManifestMeans: "use_existing_fallback_unchanged";
        oldCacheBehavior: "preserved_and_readable";
        existingFallback: "byte_and_semantically_identical";
        supportedOnly: true;
        provenanceExposed: true;
        unknownExplicit: true;
        replacesEffectiveValues: false;
        modifiesUi: false;
        modifiesCharacterEntity: false;
        modifiesTeamAnalysisPayload: false;
    };
    boundaries: {
        conditional17Included: false;
        deckIndex: "unknown";
        leaderFriendComposition: "unknown";
        finalStacking: "unknown";
        finalRounding: "unknown";
        transformationsDeathReviveExchangeStandby: "unknown";
        combatCalculation: "NOT_EXECUTED";
        runtimeInstrumentation: "NOT_EXECUTED";
        newTextParsing: "NOT_EXECUTED";
        authoritySelected: false;
        productionModified: false;
        androidModified: false;
        uiModified: false;
        networkRequestCount: 0;
        authenticatedRequestCount: 0;
        r2MutationCount: 0;
        publisherExecuted: false;
        androidSourceBytesReadFromGitObjectDatabaseOnly: true;
        androidCheckoutBytesRead: false;
        androidSourceCanAuthorizeMaterializedBytes: false;
    };
    readiness: {
        offlineCompatibilityAudit: "GO";
        lineageK56ThroughK61: "GO";
        losslessK62Reconstruction: "GO" | "NOT_EXECUTED";
        k63AdditiveShadowContract: "GO";
        currentContractDirectConsumption: "NO-GO";
        authority: "NO-GO";
        production: "NO-GO";
        androidImplementation: "NO-GO";
        ui: "NO-GO";
        runtimeContext: "NO-GO";
        processTreeRssUnder1GiB: "NOT_EXECUTED";
        concurrentOutputAncestorReplacement: "NO-GO";
    };
}

export interface CharacterLeaderSupportedCompatibilityCoverage {
    schemaVersion: 1;
    contract: "dokkan-database-character-leader-supported-compatibility-coverage";
    contractVersion: typeof CHARACTER_LEADER_SUPPORTED_COMPATIBILITY_CONTRACT_VERSION;
    inventory: CharacterLeaderSupportedCompatibilityReport["inventory"];
    parity: CharacterLeaderSupportedCompatibilityReport["comparison"];
    classificationCounts: Record<CharacterLeaderCompatibilityClassification, number>;
    dimensionClassificationCounts: Record<CharacterLeaderCompatibilityClassification, number>;
    zeroConflictIsCompleteness: false;
}

export interface CharacterLeaderSupportedCompatibilityValidation {
    schemaVersion: 1;
    contract: "dokkan-database-character-leader-supported-compatibility-validation";
    contractVersion: typeof CHARACTER_LEADER_SUPPORTED_COMPATIBILITY_CONTRACT_VERSION;
    valid: boolean;
    failures: string[];
    sizes: {
        rawSizeBytes: number;
        gzipSizeBytes: number;
        metadataSizeBytes: number;
        rawMaximumBytesExclusive: number;
        gzipMaximumBytesExclusive: number;
        metadataMaximumBytesExclusive: number;
    };
    checks: {
        exactDimensionSet: boolean;
        exactlyOneClassificationPerDimension: boolean;
        exactlyOneClassificationPerEffect: boolean;
        lineageComplete: boolean;
        losslessReconstruction: boolean;
        noConditionalLeakage: boolean;
        noUnknownMaterializedAsZeroOrFalse: boolean;
        noNamesTitlesOrTextUsedAsIdentity: boolean;
        androidGitObjectSourcePinned: boolean;
        androidCheckoutExcluded: boolean;
        androidSourceDoesNotAuthorizeMaterializedBytes: boolean;
        zeroConflictIsNotCompleteness: true;
        noNetworkOrPublisher: true;
    };
}

export interface CharacterLeaderSupportedCompatibilityManifest {
    schemaVersion: 1;
    contract: "dokkan-database-character-leader-supported-compatibility-manifest";
    contractVersion: typeof CHARACTER_LEADER_SUPPORTED_COMPATIBILITY_CONTRACT_VERSION;
    candidateOnly: true;
    fileName: string;
    compression: "gzip";
    sha256: string;
    sizeBytes: number;
    uncompressedSha256: string;
    uncompressedSizeBytes: number;
    coverageFile: typeof CHARACTER_LEADER_SUPPORTED_COMPATIBILITY_FILES.coverage;
    coverageSha256: string;
    coverageSizeBytes: number;
    validationFile: typeof CHARACTER_LEADER_SUPPORTED_COMPATIBILITY_FILES.validation;
    validationSha256: string;
    validationSizeBytes: number;
    lineageFingerprintSha256: string;
    outputNamespaceThreatModel: "caller_controlled_stable_during_operation";
    concurrentSameUserAncestorReplacementProtected: false;
}

export interface CharacterLeaderSupportedCompatibilityArtifactSet {
    report: CharacterLeaderSupportedCompatibilityReport;
    coverage: CharacterLeaderSupportedCompatibilityCoverage;
    validation: CharacterLeaderSupportedCompatibilityValidation;
    manifest: CharacterLeaderSupportedCompatibilityManifest;
    raw: Buffer;
    gzip: Buffer;
    coverageBytes: Buffer;
    validationBytes: Buffer;
    manifestBytes: Buffer;
}
