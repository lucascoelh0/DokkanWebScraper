import type { CharacterLeaderValueK3Identity, CharacterLeaderValueK48Identity } from "./leader-value-scope-contract";

export const CHARACTER_LEADER_SUPPORTED_PROJECTION_CONTRACT_VERSION = "1.0.0" as const;
export const CHARACTER_LEADER_SUPPORTED_PROJECTION_RAW_LIMIT_BYTES = 16 * 1024 * 1024;
export const CHARACTER_LEADER_SUPPORTED_PROJECTION_GZIP_LIMIT_BYTES = 2 * 1024 * 1024;
export const CHARACTER_LEADER_SUPPORTED_PROJECTION_METADATA_LIMIT_BYTES = 64 * 1024;
export const CHARACTER_LEADER_SUPPORTED_PROJECTION_RSS_LIMIT_BYTES = 1024 * 1024 * 1024;
export const CHARACTER_LEADER_SUPPORTED_PROJECTION_FILES = {
    coverage: "database-characters-k56-leader-supported-projection-coverage.json",
    validation: "database-characters-k56-leader-supported-projection-validation.json",
    manifest: "database-characters-k56-leader-supported-projection-manifest.json",
} as const;
export const CHARACTER_LEADER_SUPPORTED_PROJECTION_PIN = {
    totalEffects: 3_853,
    totalReferences: 12_310,
    projectedEffects: 3_836,
    projectedReferences: 12_265,
    excludedEffects: 17,
    excludedReferences: 45,
    conditionalEffectRowIds: [
        "5266", "5271", "5276", "5281", "5986", "5991", "5996", "6001", "8071", "10036", "11861", "11863",
        "10326202", "10326302", "10326402", "10326502", "10326602",
    ],
    productiveFileName: "characters.json",
    productiveSha256: "421c8fec6f7ba22e270af19b2278da4fbba19b6299205a54cc3d1ed570319dbc",
    productiveSizeBytes: 121_390_313,
    productiveTopLevelCount: 4_090,
} as const;

export type CharacterLeaderSupportedTargetScope = "team_allies" | "super_class_allies" | "extreme_class_allies";
export type CharacterLeaderSupportedCalculation =
    | { kind: "flat_points"; value: number; integerConversion: "at_handler" }
    | { kind: "proportional_percent_divided_by_100"; numerator: number; divisor: 100 };

export interface CharacterLeaderSupportedProjectionRecord {
    stateId: string;
    sourceStateKey: string;
    cardId: string;
    releaseState: "initial" | "eza" | "seza";
    leaderSetRowId: string;
    effectRowId: string;
    sourceEffectOccurrenceIndex: number;
    selector: { kind: "structural_mask"; mask: number };
    commonModifier: number;
    stats: ["hp", "atk", "def"];
    calculation: CharacterLeaderSupportedCalculation;
    targetScope: CharacterLeaderSupportedTargetScope;
    targetFilters: Array<{
        sourceTargetOccurrenceIndex: number;
        operation: "include" | "exclude";
        selector: "card_category_id";
        categoryId: string;
    }>;
    targetFilterComposition: {
        operator: "and_sequential";
        emptyBehavior: "identity";
        duplicateBehavior: "preserved_and_reapplied";
    };
}

export interface CharacterLeaderSupportedProjectionLineage {
    k48: CharacterLeaderValueK48Identity;
    k3Value: CharacterLeaderValueK3Identity;
    k3Target: { artifactSha256: string; targetInputFingerprintSha256: string };
    k3Causality: { causalityInputFingerprintSha256: string };
    causalityDatabase: { sha256: string; sizeBytes: number; rowsFingerprintSha256: string };
    native: {
        elfSha256: string;
        k50EvidenceSha256: string;
        k52EvidenceSha256: string;
        k53EvidenceSha256: string;
        k54EvidenceSha256: string;
        k55EvidenceSha256: string;
    };
    productive: { fileName: "characters.json"; sha256: string; sizeBytes: number; topLevelCount: number };
}

export interface CharacterLeaderSupportedProjectionDataset {
    schemaVersion: 1;
    contract: "dokkan-database-character-leader-supported-only-projection";
    contractVersion: typeof CHARACTER_LEADER_SUPPORTED_PROJECTION_CONTRACT_VERSION;
    mode: "explicit_opt_in_offline_local_supported_only_default_off";
    source: CharacterLeaderSupportedProjectionLineage;
    policy: {
        supportedOnly: true;
        structuralIdsOnly: true;
        sourceOrderAndMultiplicityPreserved: true;
        outputNamespaceThreatModel: "caller_controlled_stable_during_operation";
        concurrentSameUserAncestorReplacementProtected: false;
        conditionalEffectsIncluded: false;
        unknownValuesMaterialized: false;
        execTimingTypeIncluded: false;
        causalityIncluded: false;
        ignoredPosition2Included: false;
        textOrDescriptionIncluded: false;
        aggregateOrFinalValueIncluded: false;
        primarySecondaryOrHybridInvented: false;
        characterArrayIncluded: false;
        patchOrApplyImplemented: false;
        authoritySelected: false;
        productionModified: false;
        publisherImplemented: false;
        networkEnabled: false;
        r2Enabled: false;
        androidImplemented: false;
    };
    records: CharacterLeaderSupportedProjectionRecord[];
}

export interface CharacterLeaderSupportedProjectionExclusion {
    effectRowId: string;
    affectedReferences: Array<{ stateId: string; sourceEffectOccurrenceIndex: number }>;
    expression: number | ["&", number, number];
    reason: "runtime_deck_index_unresolved";
    provenance: {
        k52NativeEvidenceSha256: string;
        k53NativeEvidenceSha256: string;
        k54NativeEvidenceSha256: string;
    };
    corroborativeRule: {
        ruleId: "k56-conditional-domain-rule-v1";
        provenance: "user_confirmed_domain_rule";
        usedToAuthorizeSupportedProjection: false;
    };
}

export interface CharacterLeaderSupportedProjectionCorroborativeDomainRule {
    ruleId: "k56-conditional-domain-rule-v1";
    provenance: "user_confirmed_domain_rule";
    communityCorroboration: "user_reported_not_independently_source_bound";
    firstPartyRuntimeDeckIndexEvidence: false;
    usedToAuthorizeSupportedProjection: false;
    appliesToExcludedConditionalEffectsOnly: true;
    elementTypeDomain: ["agl", "teq", "int", "str", "phy"];
    battleClassDomain: ["super", "extreme", "none"];
    awakeningState: {
        source: "selected_card_state";
        preZBattleClass: "none";
        postZBattleClass: "acquired_after_z_awakening";
    };
    condition: {
        scope: "team_including_friend";
        ownUnitSlots: 6;
        friendUnitSlots: 1;
        effectTarget: "eligible_matching_units";
        currentElementTypeRequired: true;
        currentBattleClassRequired: true;
    };
    friend: {
        conditionParticipation: "may_satisfy_condition";
        effectReceipt: "only_if_effect_target_matches";
    };
    passiveCrossScope: {
        allFiveElementTypesScope: "team_including_friend";
        authority: "corroborative_only";
    };
    dualSuperExtremeClause: {
        proofComposition: "separate_required_proofs";
        requiredProofs: ["super_class_presence", "extreme_class_presence", "all_five_element_types"];
    };
}

export interface CharacterLeaderSupportedProjectionCoverage {
    schemaVersion: 1;
    contract: "dokkan-database-character-leader-supported-only-projection-coverage";
    contractVersion: typeof CHARACTER_LEADER_SUPPORTED_PROJECTION_CONTRACT_VERSION;
    counts: {
        totalEffects: 3_853;
        totalReferences: 12_310;
        projectedEffects: 3_836;
        projectedReferences: 12_265;
        excludedEffects: 17;
        excludedReferences: 45;
    };
    projected: { effects: 3_836; references: 12_265; classification: "supported" };
    excluded: CharacterLeaderSupportedProjectionExclusion[];
    corroborativeDomainRules: [CharacterLeaderSupportedProjectionCorroborativeDomainRule];
    partial: {
        creation: "factory_per_source_row";
        application: "shared_start_turn_execution_invocation";
        deactivation: "apis_invoked_outcome_unbound";
    };
    unknown: {
        recurrence: "unknown";
        duration: "unknown";
        removalOutcome: "unknown";
        enterExitLifecycle: "unknown";
        leaderFriendComposition: "unknown";
        finalStackingOrComposition: "unknown";
        operationOrderingOutsideHandler: "unknown";
        finalRounding: "unknown";
        transformationDeathReviveExchangeStandby: "unknown";
        effectiveConditionalBranch: "unknown";
    };
    unjoinable: {
        scope: "productive_card_id";
        distinctCardIds: number;
        references: number;
    };
    shadowParity: {
        comparisonMode: "card_id_only_no_value_authority";
        cardIdCoverage: {
            projectedDistinctCardIds: number;
            productiveJoinedCardIds: number;
            productiveUnjoinableCardIds: number;
        };
        structuralRepresentationGainReferences: number;
        comparableValueReferences: 0;
        representationMismatchComparableReferences: 0;
        comparableAgreementCardIds: number;
        confirmedConflictComparableValues: 0;
        unknownValueReferences: number;
        unjoinableReferences: number;
        zeroConflictIsCompleteness: false;
        authoritySelected: false;
    };
    provenance: {
        k52CausalityInputFingerprintSha256: string;
        k52DatabaseSha256: string;
        k52DatabaseRowsFingerprintSha256: string;
        k52NativeEvidenceSha256: string;
        k53NativeEvidenceSha256: string;
        k54NativeEvidenceSha256: string;
        k55NativeEvidenceSha256: string;
    };
}

export interface CharacterLeaderSupportedProjectionValidation {
    schemaVersion: 1;
    contract: "dokkan-database-character-leader-supported-only-projection-validation";
    contractVersion: typeof CHARACTER_LEADER_SUPPORTED_PROJECTION_CONTRACT_VERSION;
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
    safety: {
        conditionalLeakageCount: number;
        unsupportedOrExtraFieldCount: number;
        sourceOrderOrOccurrenceMismatchCount: number;
        duplicateReferencesPreserved: true;
        unknownMaterializedCount: number;
        characterArrayRecordCount: 0;
        applyCount: 0;
        networkRequestCount: 0;
        automaticCleanupAttempted: false;
        outputNamespaceThreatModel: "caller_controlled_stable_during_operation";
        concurrentSameUserAncestorReplacementProtected: false;
    };
    readiness: {
        offlineSupportedOnlyProjection: "GO" | "NOT_EXECUTED";
        sourceBoundValidation: "NOT_EXECUTED";
        localShadowAuditDefaultOff: "GO" | "NOT_EXECUTED";
        conditional17: "NO-GO";
        deckFallback: "NO-GO";
        effectiveCombinedLeaderValue: "NO-GO";
        authority: "NO-GO";
        apply: "NO-GO";
        production: "NO-GO";
        publisher: "NO-GO";
        network: "NO-GO";
        r2: "NO-GO";
        android: "NO-GO";
        ui: "NO-GO";
        fyiRemoval: "NO-GO";
        combatCalculation: "NO-GO";
        dynamicInstrumentation: "NO-GO";
        concurrentOutputAncestorReplacement: "NO-GO";
    };
}

export interface CharacterLeaderSupportedProjectionManifest {
    schemaVersion: 1;
    contract: "dokkan-database-character-leader-supported-only-projection-manifest";
    contractVersion: typeof CHARACTER_LEADER_SUPPORTED_PROJECTION_CONTRACT_VERSION;
    fileName: string;
    compression: "gzip";
    sha256: string;
    sizeBytes: number;
    uncompressedSha256: string;
    uncompressedSizeBytes: number;
    counts: CharacterLeaderSupportedProjectionCoverage["counts"];
    source: CharacterLeaderSupportedProjectionLineage;
    outputNamespaceThreatModel: "caller_controlled_stable_during_operation";
    concurrentSameUserAncestorReplacementProtected: false;
    coverageFile: typeof CHARACTER_LEADER_SUPPORTED_PROJECTION_FILES.coverage;
    coverageSha256: string;
    coverageSizeBytes: number;
    validationFile: typeof CHARACTER_LEADER_SUPPORTED_PROJECTION_FILES.validation;
    validationSha256: string;
    validationSizeBytes: number;
}

export interface CharacterLeaderSupportedProjectionArtifactSet {
    dataset: CharacterLeaderSupportedProjectionDataset;
    coverage: CharacterLeaderSupportedProjectionCoverage;
    validation: CharacterLeaderSupportedProjectionValidation;
    manifest: CharacterLeaderSupportedProjectionManifest;
    raw: Buffer;
    gzip: Buffer;
    coverageBytes: Buffer;
    validationBytes: Buffer;
    manifestBytes: Buffer;
}
