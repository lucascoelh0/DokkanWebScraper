import { Rarities, Types } from "../character";

export const CHARACTER_COMPACT_SCHEMA_VERSION = 1 as const;
export const CHARACTER_COMPACT_CONTRACT_VERSION = "1.0.0" as const;
export const CHARACTER_COMPACT_POLICY_ID = "database-character-compact-supported-only" as const;
export const CHARACTER_COMPACT_POLICY_VERSION = "1.0.0" as const;
export const CHARACTER_COMPACT_RAW_BUDGET_BYTES = 4 * 1024 * 1024;
export const CHARACTER_COMPACT_GZIP_BUDGET_BYTES = 1024 * 1024;

export const CHARACTER_COMPACT_EXPECTATIONS = {
    databaseCardCount: 5_759,
    recordCount: 4_296,
    productionUnjoinableCount: 1_463,
    rarityAgreements: 4_085,
    rarityRepresentationGains: 211,
    typeAgreements: 4_296,
    idAgreements: 4_296,
} as const;

/** Exact K15 release authorized for standalone validation and future K15-only consumers. */
export const CHARACTER_COMPACT_PINNED_RELEASE = {
    manifestFile: "database-characters-k15-manifest.json",
    manifestSha256: "490573185c487306958c272b1c7b3658f0c38643a64b0d5e146b51f35cb73793",
    manifestSizeBytes: 3_115,
    payloadFile: "database-characters-k15-compact-supported.803346fc61a7e659ccb8aeea62c273fcdf24ef3d66d3d03564a6fad29627c81f.json.gz",
    payloadSha256: "803346fc61a7e659ccb8aeea62c273fcdf24ef3d66d3d03564a6fad29627c81f",
    payloadSizeBytes: 29_902,
    rawSha256: "5866b075e1cfc2d45eacb6e2055dd975b885accc05379423aac3d7d45b1f793a",
    rawSizeBytes: 558_190,
    recordCount: 4_296,
    coverageFile: "database-characters-k15-coverage.json",
    coverageSha256: "13eb0e44a0010de3a7a708ec9444b284aec0a0b89ab8e938e6ccff7166166d63",
    coverageSizeBytes: 766,
    validationFile: "database-characters-k15-validation.json",
    validationSha256: "3ff2ec37d9dd3f035a5dfa159d78b7917778b936a41a0d045850d66851d046b0",
    validationSizeBytes: 612,
    readinessFile: "database-characters-k15-readiness.json",
    readinessSha256: "a6481aa20445c56bfd1c3a61defd973d3a2f68fe57feca0ba543974776b00748",
    readinessSizeBytes: 771,
} as const;

export interface CharacterCompactLineageEntry {
    contractVersion: string;
    sha256: string;
    sizeBytes: number;
}

export interface CharacterCompactSourceLineage {
    profileId: string;
    snapshotVersion: string;
    database: { sha256: string; sizeBytes: number };
    db1: { sha256: string; sizeBytes: number; uncompressedSizeBytes: number; cardCount: number };
    k0: CharacterCompactLineageEntry;
    k1: CharacterCompactLineageEntry;
    k2: CharacterCompactLineageEntry;
    k11: CharacterCompactLineageEntry & { uncompressedSha256: string; uncompressedSizeBytes: number };
    k12: CharacterCompactLineageEntry;
    k13: CharacterCompactLineageEntry;
    k14: CharacterCompactLineageEntry;
    productionCharacters: { sha256: string; sizeBytes: number; characterCount: number };
}

export interface CharacterCompactRecord {
    /** Structural join key to Character.id. */
    cardId: string;
    /** Minimum state binding selected and proved by K11/K14. */
    stateId: string;
    rarity: Rarities;
    type: Types;
}

export interface CharacterCompactProjection {
    schemaVersion: 1;
    contract: "dokkan-database-character-compact-shadow";
    contractVersion: "1.0.0";
    generatedAt: string;
    datasetVersion: string;
    source: CharacterCompactSourceLineage;
    policy: {
        id: "database-character-compact-supported-only";
        version: "1.0.0";
        approvedBy: { contract: "dokkan-database-character-field-shadow-readiness"; contractVersion: "1.0.1" };
        records: "supported_only";
        fields: ["id", "rarity", "type"];
        allowedComparisons: ["agreement", "representation_gain"];
        structuralJoinOnly: true;
        externalFallbackIncluded: false;
        auditFieldsIncluded: false;
        productionModified: false;
        consumerImplemented: false;
        publisherEnabled: false;
        androidEnabled: false;
    };
    records: CharacterCompactRecord[];
}

export interface CharacterCompactCoverage {
    schemaVersion: 1;
    contract: "dokkan-database-character-compact-shadow-coverage";
    contractVersion: "1.0.0";
    databaseCardCount: number;
    recordCount: number;
    excludedCardCount: number;
    exclusions: {
        unjoinable: number;
        partial: number;
        unknown: number;
        mismatch: number;
        conflict: number;
        invalidEnum: number;
        ambiguousBinding: number;
        incomplete: number;
    };
    comparisons: {
        id: { agreements: number; representationGains: number };
        rarity: { agreements: number; representationGains: number };
        type: { agreements: number; representationGains: number };
    };
    catalogImpact: { charactersCreated: 0; charactersRemoved: 0; productionModified: false };
}

export interface CharacterCompactValidation {
    schemaVersion: 1;
    contract: "dokkan-database-character-compact-shadow-validation";
    contractVersion: "1.0.0";
    valid: boolean;
    failures: string[];
    budgets: {
        gzipMaximumBytes: number;
        rawMaximumBytes: number;
        gzipSizeBytes: number;
        rawSizeBytes: number;
    };
    safety: {
        duplicateCardIdCount: number;
        unstableOrderCount: number;
        invalidEnumCount: number;
        extraFieldCount: number;
        missingBindingCount: number;
        externalFallbackCount: 0;
        productionFilesWritten: false;
        characterMergeApiImplemented: false;
        runtimeK11ReadImplemented: false;
    };
}

export interface CharacterCompactReadiness {
    schemaVersion: 1;
    contract: "dokkan-database-character-compact-shadow-readiness";
    contractVersion: "1.0.0";
    generatedAt: string;
    status: "offline_artifact_ready_consumers_disabled";
    gates: {
        offlineGeneration: "GO";
        artifactValidation: "GO";
        inMemoryConsumer: "NO-GO";
        characterMutation: "NO-GO";
        android: "NO-GO";
        r2Publication: "NO-GO";
        production: "NO-GO";
        authorityPromotion: "NO-GO";
        fyiRemoval: "NO-GO";
        dokkanInfoRemoval: "NO-GO";
    };
    nextGate: {
        gate: "K16";
        action: "opt_in_k15_shadow_consumer";
        constraint: "compare_only_without_changing_effective_character_values";
        k11ConsumerInput: false;
        k15ConsumerInput: true;
    };
}

export interface CharacterCompactManifest {
    schemaVersion: 1;
    contract: "dokkan-database-character-compact-shadow-manifest";
    contractVersion: "1.0.0";
    generatedAt: string;
    datasetVersion: string;
    fileName: string;
    compression: "gzip";
    sha256: string;
    sizeBytes: number;
    uncompressedSha256: string;
    uncompressedSizeBytes: number;
    recordCount: number;
    lineage: CharacterCompactSourceLineage;
    coverageFile: "database-characters-k15-coverage.json";
    coverageSha256: string;
    coverageSizeBytes: number;
    validationFile: "database-characters-k15-validation.json";
    validationSha256: string;
    validationSizeBytes: number;
    readinessFile: "database-characters-k15-readiness.json";
    readinessSha256: string;
    readinessSizeBytes: number;
}
