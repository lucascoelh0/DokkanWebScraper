import { CARD_SCOPE_SOURCE_PIN } from "./card-scope-contract";
import { CHARACTER_STRUCTURAL_SIDECAR_SOURCE_PIN } from "./structural-sidecar-contract";

export const TAXONOMY_PROJECTION_SCHEMA_VERSION = 1 as const;
export const TAXONOMY_PROJECTION_CONTRACT_VERSION = "1.0.0" as const;
export const TAXONOMY_PROJECTION_RAW_LIMIT_BYTES = 8 * 1024 * 1024;
export const TAXONOMY_PROJECTION_GZIP_LIMIT_BYTES = 1024 * 1024;
export const TAXONOMY_PROJECTION_RSS_LIMIT_BYTES = 1024 * 1024 * 1024;
export const TAXONOMY_PROJECTION_MAX_EXAMPLES = 5;

export const TAXONOMY_PROJECTION_FILES = {
    manifest: "database-characters-k35-taxonomy-projection-manifest.json",
    coverage: "database-characters-k35-taxonomy-projection-coverage.json",
    validation: "database-characters-k35-taxonomy-projection-validation.json",
} as const;

export const TAXONOMY_PROJECTION_SOURCE_PIN = {
    profileId: "global-6.4.0-v338-2026-08-05-taxonomy-projection-k35-v1",
    datasetVersion: "global-6.4.0-v338-2026-08-05-k35-taxonomy-projection-v1",
    generatedAt: CHARACTER_STRUCTURAL_SIDECAR_SOURCE_PIN.k2.generatedAt,
    k32: {
        contractVersion: "1.0.0",
        manifestSha256: "91c2d76f38fd3a0b5eddd5e0db9651af5f7df852065a0fea7a1fc804dec3ae21",
        manifestSizeBytes: 2_358,
        payloadSha256: "241b135ac88aad2a242a6abb81ab22b099ff25257cb0c8f0f5f7e82f888cb718",
        payloadSizeBytes: 706_128,
        rawSha256: "a910cc5b2363f24326b58174c18ce8dc85669d26e73c54544a101ffecfdfd403",
        rawSizeBytes: 24_686_675,
        coverageSha256: "9fdee8e1929d42e2e6f6e46ece395800789e52ba0fb0b5ae16776f99a6ff189a",
        coverageSizeBytes: 1_158,
        validationSha256: "6b881d06412be466b5f7527fbba12107730583f3739063e63b26a862534fe4e6",
        validationSizeBytes: 1_163,
    },
    k2: { ...CHARACTER_STRUCTURAL_SIDECAR_SOURCE_PIN.k2 },
    k34: {
        contractVersion: "1.0.0",
        profileId: CARD_SCOPE_SOURCE_PIN.profileId,
        reportSha256: "a34afd7895d40dbdfd085c7c1b5af1304247b4e7476e89bec6c81e17758f638a",
        reportSizeBytes: 7_140,
    },
    sqlite: { ...CARD_SCOPE_SOURCE_PIN.sqlite },
    db1: { ...CARD_SCOPE_SOURCE_PIN.db1 },
    elf: { ...CARD_SCOPE_SOURCE_PIN.elf },
    nativeLayout: { ...CARD_SCOPE_SOURCE_PIN.nativeLayout },
    expected: {
        cardCount: 5_759,
        characterClassIncludedCardCount: 5_759,
        categoryIncludedCardCount: 5_729,
        categoryUnknownCardCount: 30,
        categoryAssignmentCount: 54_072,
        linkIncludedCardCount: 5_620,
        linkUnknownCardCount: 139,
        linkEntryCount: 34_018,
    },
    release: {
        payloadSha256: "7e5c9fa501c8401489e8e6c0a057b1ecf01037d7969091ed88c0df73547f19e8",
        payloadSizeBytes: 247_261,
        rawSha256: "c740d4874118c65f94588594f6b745146c506dd78a73fd605bbf40abf28d168a",
        rawSizeBytes: 4_228_101,
        coverageSha256: "e734cd83c3bcecbc978caac50f5e49f4914a060bf486d9752177c853e4b269ec",
        coverageSizeBytes: 1_492,
        validationSha256: "e4719f02dc9f30ae90a97212ef7a5e1d94218e8299311f148b8422caa5fe4664",
        validationSizeBytes: 1_424,
        manifestSha256: "a157c322f6d246c817e2af998ef908f17b39978282ced9ccda5a304d6298445c",
        manifestSizeBytes: 3_558,
    },
} as const;

export type TaxonomyProjectionDimension = "characterClass" | "categories" | "links";
export type TaxonomyProjectionExclusionReason = "partial" | "unknown" | "unjoinable";

export interface TaxonomyProjectionLineage {
    profileId: typeof TAXONOMY_PROJECTION_SOURCE_PIN.profileId;
    k32: {
        contractVersion: string;
        manifestSha256: string;
        manifestSizeBytes: number;
        payloadSha256: string;
        payloadSizeBytes: number;
        rawSha256: string;
        rawSizeBytes: number;
        coverageSha256: string;
        coverageSizeBytes: number;
        validationSha256: string;
        validationSizeBytes: number;
        sourceBoundValidation: "GO";
        productiveManifestSha256: string;
        productivePayloadSha256: string;
    };
    k2: {
        contractVersion: string;
        manifestSha256: string;
        manifestSizeBytes: number;
        payloadSha256: string;
        payloadSizeBytes: number;
        uncompressedSizeBytes: number;
        coverageSha256: string;
        coverageSizeBytes: number;
        validationSha256: string;
        validationSizeBytes: number;
    };
    k34: { contractVersion: string; profileId: string; reportSha256: string; reportSizeBytes: number; inProcessValidation: "GO" };
    sqlite: { sha256: string; sizeBytes: number };
    db1: { sha256: string; sizeBytes: number; uncompressedSizeBytes: number };
    elf: { sha256: string; sizeBytes: number; format: string };
    nativeLayout: { sha256: string; sizeBytes: number };
}

export interface TaxonomyProjectionRecord {
    cardId: string;
    characterClass?: { raw: unknown; normalized: string };
    categories?: Array<{ categoryId: string; relationRowId: string }>;
    links?: Array<{ slot: number; linkSkillId: string }>;
}

export interface TaxonomyProjectionDataset {
    schemaVersion: 1;
    contract: "dokkan-database-character-taxonomy-projection";
    contractVersion: typeof TAXONOMY_PROJECTION_CONTRACT_VERSION;
    generatedAt: string;
    datasetVersion: string;
    mode: "explicit_opt_in_offline_generation_validation_only";
    source: TaxonomyProjectionLineage;
    policy: {
        recordKey: "cardId";
        records: "card_scoped";
        dimensions: "supported_only";
        labelsOrPresentationIncluded: false;
        labelsAsAuthority: false;
        categoryOrder: "numeric_category_id_then_relation_row_id";
        linkOrder: "slot";
        missingRowEvidence: "omit_dimension_without_empty_invention";
        characterShapeReadOrWritten: false;
        applyOrOverlayApiImplemented: false;
        consumerImplemented: false;
        publisherImplemented: false;
        androidImplemented: false;
    };
    records: TaxonomyProjectionRecord[];
}

export interface TaxonomyProjectionDimensionCoverage {
    includedCardCount: number;
    includedFactCount: number;
    excludedCardCount: number;
    excludedFactCount: number;
    exclusions: Record<TaxonomyProjectionExclusionReason, number>;
    examples: Record<TaxonomyProjectionExclusionReason, string[]>;
}

export interface TaxonomyProjectionCoverage {
    schemaVersion: 1;
    contract: "dokkan-database-character-taxonomy-projection-coverage";
    contractVersion: typeof TAXONOMY_PROJECTION_CONTRACT_VERSION;
    sourceCardCount: number;
    projectedCardCount: number;
    dimensions: Record<TaxonomyProjectionDimension, TaxonomyProjectionDimensionCoverage>;
}

export interface TaxonomyProjectionValidation {
    schemaVersion: 1;
    contract: "dokkan-database-character-taxonomy-projection-validation";
    contractVersion: typeof TAXONOMY_PROJECTION_CONTRACT_VERSION;
    valid: boolean;
    failureCount: number;
    failures: string[];
    failuresTruncated: boolean;
    sizes: {
        rawMaximumBytes: number;
        gzipMaximumBytes: number;
        rawSizeBytes: number;
        gzipSizeBytes: number;
    };
    safety: {
        duplicateCardIdCount: number;
        unstableCardOrderCount: number;
        invalidCategoryOrderCount: number;
        invalidLinkOrderOrSlotCount: number;
        unsupportedDimensionIncludedCount: number;
        inventedEmptyDimensionCount: number;
        labelOrPresentationFieldCount: number;
        extraRecordFieldCount: number;
        networkRequestCount: 0;
        characterReadOrWriteCount: 0;
        outputNamespaceThreatModel: "caller_controlled_stable_during_operation";
    };
    sourceGates: {
        k32SourceBoundBeforeAndAfter: "REQUIRED";
        k34InProcessAgainstPinnedRoots: "REQUIRED";
        acceptedK34Conclusion: "stable_for_exact_pinned_profile";
        acceptedK34ProductiveGates: "NO-GO_ONLY";
    };
    readiness: {
        offlineGeneration: "GO";
        offlineSourceBoundValidation: "GO";
        consumption: "NO-GO";
        publication: "NO-GO";
        production: "NO-GO";
        authorityPromotion: "NO-GO";
        applyOrOverlay: "NO-GO";
        characterMutation: "NO-GO";
        r2: "NO-GO";
        android: "NO-GO";
        fyiRemoval: "NO-GO";
        dokkanInfoRemoval: "NO-GO";
    };
}

export interface TaxonomyProjectionManifest {
    schemaVersion: 1;
    contract: "dokkan-database-character-taxonomy-projection-manifest";
    contractVersion: typeof TAXONOMY_PROJECTION_CONTRACT_VERSION;
    generatedAt: string;
    datasetVersion: string;
    fileName: string;
    compression: "gzip";
    sha256: string;
    sizeBytes: number;
    uncompressedSha256: string;
    uncompressedSizeBytes: number;
    recordCount: number;
    source: TaxonomyProjectionLineage;
    coverageFile: typeof TAXONOMY_PROJECTION_FILES.coverage;
    coverageSha256: string;
    coverageSizeBytes: number;
    validationFile: typeof TAXONOMY_PROJECTION_FILES.validation;
    validationSha256: string;
    validationSizeBytes: number;
}
