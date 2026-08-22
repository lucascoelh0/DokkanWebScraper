import type { CharacterLeaderCompatibilityAndroidSourceIdentity } from "./leader-supported-compatibility-git-source";

export const CHARACTER_LEADER_ANDROID_SHADOW_CONTRACT_VERSION = "1.0.0" as const;
export const CHARACTER_LEADER_ANDROID_SHADOW_RAW_LIMIT_BYTES = 8 * 1024 * 1024;
export const CHARACTER_LEADER_ANDROID_SHADOW_GZIP_LIMIT_BYTES = 2 * 1024 * 1024;
export const CHARACTER_LEADER_ANDROID_SHADOW_MANIFEST_LIMIT_BYTES = 64 * 1024;
export const CHARACTER_LEADER_ANDROID_SHADOW_METADATA_LIMIT_BYTES = 256 * 1024;
export const CHARACTER_LEADER_ANDROID_SHADOW_RSS_LIMIT_BYTES = 1024 * 1024 * 1024;
export const CHARACTER_LEADER_ANDROID_SHADOW_FILES = {
    manifest: "leader-shadow-manifest.json",
    validation: "database-characters-k64-leader-android-shadow-validation.json",
    provenancePin: "database-characters-k64-leader-android-shadow-provenance-pin.json",
} as const;
export const CHARACTER_LEADER_ANDROID_SHADOW_ACCEPTED_PROVENANCE_PIN_SHA256 =
    "88a62688150ece1f06bc91bfd2832c78780e392be7622cfe560bf1a9148d4e8d" as const;

export const CHARACTER_LEADER_ANDROID_SHADOW_SOURCE_PIN = {
    k56: {
        fullArtifactFingerprintSha256: "807a98ae37cd17a68a7f3f3544c1f14b4f4bfab9f75c9b627cca23cbab41e3b3",
        lineageFingerprintSha256: "132c1e858ed5fdb6bdc97f3c5e0313c865c7bf0ee7367e1ad1453b89e280fa5f",
    },
    k60: {
        publicationReceiptSha256: "d56dd4bdb6a46570d687709acc687ae67a270908c1666c3f495e5ca29b901a68",
    },
    k62_1: {
        compatibilityAuditSha256: "1ba112d7b4e08ceebeb590976b8d1b7c1d726064cba094ef050db237aadaef4f",
    },
    android: {
        repositoryUrl: "https://github.com/lucascoelh0/Dokkanpanion.git",
        commit: "f148a66d9911c2667caafd47bbd522b5fe00c4e6",
        files: [
            {
                path: "domain/src/main/java/com/luminay/domain/leadershadow/LeaderShadowModels.kt",
                blobId: "4205062ae01667aff812b484a06c77b7f2f70954",
                sizeBytes: 4_802,
                sha256: "56b44edf8883d78963effac2e7d80c616fcaeb1fda942b708da0476235180fa8",
            },
            {
                path: "domain/src/main/java/com/luminay/domain/leadershadow/LeaderShadowLoader.kt",
                blobId: "a8198edc7d05044100e13b2e7ab45e7da0e4a833",
                sizeBytes: 32_275,
                sha256: "14016508974d223e168bcb2290c0bdef459821e0681894be22667cf11fa61d39",
            },
            {
                path: "domain/src/main/java/com/luminay/domain/leadershadow/LeaderShadowRepository.kt",
                blobId: "f5e54d54f7d8c8d5c1c58e3f61f607474373f985",
                sizeBytes: 1_608,
                sha256: "088ca40a60f02bc53d4aa1afb92aa10a26bb0295e2c937a95fa905bc8f3dccba",
            },
        ],
    },
    output: {
        recordCount: 7_248,
        occurrenceCount: 12_265,
        filterCount: 31_478,
        scopeFilterCounts: { team: 11_971, superClass: 161, extremeClass: 133 },
        categoryFilterCounts: { include: 9_736, exclude: 6_250 },
        emptyIdentityFilterCount: 3_227,
        percentageOccurrenceCount: 12_253,
        flatOccurrenceCount: 12,
    },
} as const;

export type CharacterLeaderAndroidShadowReleaseState = "INITIAL" | "EZA" | "SEZA";
export type CharacterLeaderAndroidShadowStat = "HP" | "ATK" | "DEF";
export type CharacterLeaderAndroidShadowFilterType =
    | "TARGET_TEAM"
    | "TARGET_SUPER_CLASS"
    | "TARGET_EXTREME_CLASS"
    | "CATEGORY_INCLUDE"
    | "CATEGORY_EXCLUDE"
    | "EMPTY_IDENTITY";

export interface CharacterLeaderAndroidShadowProvenance {
    sourceContract: "dokkan-database-character-leader-supported-only-projection";
    sourceContractVersion: "1.0.0";
    sourceCheckpoint: "K62.1";
    sourceArtifactSha256: string;
    sourceLineageSha256: string;
    sourceReceiptSha256: string;
}

export interface CharacterLeaderAndroidShadowFilter {
    filterIndex: number;
    filterId: string;
    type: CharacterLeaderAndroidShadowFilterType;
    valueId: string | null;
}

export interface CharacterLeaderAndroidShadowStatValue {
    statIndex: number;
    stat: CharacterLeaderAndroidShadowStat;
    value: number;
}

export interface CharacterLeaderAndroidShadowOperation {
    kind: "PERCENTAGE" | "FLAT_POINTS";
    commonModifier: number;
    stats: CharacterLeaderAndroidShadowStatValue[];
}

export interface CharacterLeaderAndroidShadowOccurrence {
    occurrenceIndex: number;
    occurrenceId: string;
    effectId: string;
    structuralMask: string;
    operation: CharacterLeaderAndroidShadowOperation;
    filters: CharacterLeaderAndroidShadowFilter[];
}

export interface CharacterLeaderAndroidShadowRecord {
    recordIndex: number;
    stateId: string;
    sourceStateKey: string;
    cardId: string;
    releaseState: CharacterLeaderAndroidShadowReleaseState;
    leaderSetId: string;
    occurrences: CharacterLeaderAndroidShadowOccurrence[];
}

export interface CharacterLeaderAndroidShadowDataset {
    schemaVersion: 1;
    contract: "dokkan-leader-shadow";
    contractVersion: typeof CHARACTER_LEADER_ANDROID_SHADOW_CONTRACT_VERSION;
    recordCount: number;
    occurrenceCount: number;
    filterCount: number;
    provenance: CharacterLeaderAndroidShadowProvenance;
    runtimeUnknowns: {
        lifecycleReevaluationUnknown: true;
        durationUnknown: true;
        removalOutcomeUnknown: true;
        leaderFriendCompositionUnknown: true;
        finalStackingUnknown: true;
        finalRoundingUnknown: true;
        transformationDeathReviveExchangeStandbyUnknown: true;
    };
    semantics: {
        targetFiltersCombinedSequentially: true;
        emptyFilterIdentityIsMatch: true;
        duplicateFiltersPreservedAndReapplied: true;
        recordOrderPreserved: true;
        filterOrderAndMultiplicityPreserved: true;
    };
    records: CharacterLeaderAndroidShadowRecord[];
}

export interface CharacterLeaderAndroidShadowManifest {
    schemaVersion: 1;
    contract: "dokkan-leader-shadow";
    contractVersion: typeof CHARACTER_LEADER_ANDROID_SHADOW_CONTRACT_VERSION;
    fileName: string;
    compression: "gzip";
    sha256: string;
    sizeBytes: number;
    uncompressedSha256: string;
    uncompressedSizeBytes: number;
    recordCount: number;
    occurrenceCount: number;
    filterCount: number;
    provenance: CharacterLeaderAndroidShadowProvenance;
}

export interface CharacterLeaderAndroidShadowProvenancePin {
    schemaVersion: 1;
    contract: "dokkan-leader-shadow-external-provenance-pin";
    contractVersion: typeof CHARACTER_LEADER_ANDROID_SHADOW_CONTRACT_VERSION;
    manifestSha256: string;
    payloadSha256: string;
    provenance: CharacterLeaderAndroidShadowProvenance;
    compatibilityAudit: {
        checkpoint: "K62.1";
        reportSha256: string;
        decision: "K63_ADDITIVE_DESIGN_GO";
    };
    androidSource: CharacterLeaderCompatibilityAndroidSourceIdentity;
    policy: {
        distributeOutOfBandFromArtifact: true;
        artifactCannotSelfAuthorize: true;
        authoritySelected: false;
        productionEnabled: false;
    };
}

export interface CharacterLeaderAndroidShadowValidation {
    schemaVersion: 1;
    contract: "dokkan-leader-shadow-producer-validation";
    contractVersion: typeof CHARACTER_LEADER_ANDROID_SHADOW_CONTRACT_VERSION;
    valid: boolean;
    failures: string[];
    counts: {
        records: number;
        occurrences: number;
        filters: number;
        filterTypes: Record<CharacterLeaderAndroidShadowFilterType, number>;
        operations: { percentage: number; flatPoints: number };
    };
    sizes: {
        rawSizeBytes: number;
        gzipSizeBytes: number;
        manifestSizeBytes: number;
        provenancePinSizeBytes: number;
        rawMaximumBytesExclusive: number;
        gzipMaximumBytesExclusive: number;
        manifestMaximumBytesExclusive: number;
        metadataMaximumBytesExclusive: number;
    };
    checks: {
        exactAndroidWireShape: boolean;
        globalOrderAndMultiplicityPreserved: boolean;
        sourceOccurrenceIdentityPreserved: boolean;
        commonModifierPreserved: boolean;
        sequentialFiltersPreserved: boolean;
        provenancePinnedExternally: boolean;
        androidGitObjectSourcePinned: boolean;
        noUnknownMaterializedAsZeroOrFalse: boolean;
        noEffectiveValueOrCombatCalculation: boolean;
    };
    safety: {
        createOnly: true;
        manifestWrittenLast: true;
        automaticCleanupAttempted: false;
        outputNamespaceThreatModel: "caller_controlled_stable_during_operation";
        concurrentSameUserAncestorReplacementProtected: false;
        networkRequestCount: 0;
        authenticatedRequestCount: 0;
        r2MutationCount: 0;
    };
    readiness: {
        offlineProducer: "GO" | "NOT_EXECUTED";
        androidWireCompatibility: "GO" | "NOT_EXECUTED";
        externalProvenancePinCandidate: "GO" | "NOT_EXECUTED";
        androidRuntimeConsumption: "NO-GO";
        authority: "NO-GO";
        production: "NO-GO";
        publisher: "NO-GO";
        network: "NO-GO";
        r2: "NO-GO";
        ui: "NO-GO";
        combatCalculation: "NO-GO";
        concurrentOutputAncestorReplacement: "NO-GO";
    };
}

export interface CharacterLeaderAndroidShadowArtifactSet {
    dataset: CharacterLeaderAndroidShadowDataset;
    manifest: CharacterLeaderAndroidShadowManifest;
    provenancePin: CharacterLeaderAndroidShadowProvenancePin;
    validation: CharacterLeaderAndroidShadowValidation;
    raw: Buffer;
    gzip: Buffer;
    manifestBytes: Buffer;
    provenancePinBytes: Buffer;
    validationBytes: Buffer;
}
