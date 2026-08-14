export const CHARACTER_STRUCTURAL_SIDECAR_SCHEMA_VERSION = 1 as const;
export const CHARACTER_STRUCTURAL_SIDECAR_CONTRACT_VERSION = "1.0.0" as const;
export const CHARACTER_STRUCTURAL_SIDECAR_RAW_BUDGET_BYTES = 32 * 1024 * 1024;
export const CHARACTER_STRUCTURAL_SIDECAR_GZIP_BUDGET_BYTES = 4 * 1024 * 1024;

export const CHARACTER_STRUCTURAL_SIDECAR_FILES = {
    payload: "database-characters-k32-structural-identity.json.gz",
    manifest: "database-characters-k32-manifest.json",
    coverage: "database-characters-k32-coverage.json",
    validation: "database-characters-k32-validation.json",
} as const;

export const CHARACTER_STRUCTURAL_SIDECAR_SOURCE_PIN = {
    profileId: "global-6.4.0-v338-2026-08-05-character-sidecars-v1",
    snapshotVersion: "global-6.4.0-v338-2026-08-05",
    k2: {
        contractVersion: "1.0.0",
        generatedAt: "2026-08-05T00:00:00.000Z",
        manifestFile: "database-characters-k2-manifest.json",
        manifestSha256: "c5b15d2aff4e18d866d42e5036001300daf8db7ae708af179ba9ecf045e88f24",
        manifestSizeBytes: 927,
        payloadFile: "database-characters-k2-taxonomy.json.gz",
        payloadSha256: "af1c84eb0d030fbf389ea0f1f5590e5f643234e2d6348bcc64fe2ffab4718b37",
        payloadSizeBytes: 511_837,
        uncompressedSizeBytes: 12_566_626,
        coverageFile: "database-characters-k2-coverage.json",
        coverageSha256: "f82d599b5507fa01cd83c1079779eb504ee739ea892037e279294ba77f65eba9",
        coverageSizeBytes: 687,
        validationFile: "database-characters-k2-validation.json",
        validationSha256: "dc814b9a0a2cde835fcb00e86b3cc4ea9eb486e0a1148d528b6cabf849163fac",
        validationSizeBytes: 60,
        databaseSha256: "3654eb7db9e18dfe4c238abd02bcc06a688ffa6f30aa1ad93fd108dcfeb78265",
        db1ArtifactSha256: "0afae38e1a80e55bc5d8a137f945727149f44403bf1670e830d3ef6f3650e547",
        cardCount: 5_759,
        categoryCount: 98,
        linkCount: 133,
        categoryAssignmentCount: 54_072,
        linkAssignmentCount: 34_018,
    },
    productiveCharacters: {
        contract: "Character[]" as const,
        datasetVersion: "2026-08-13T03:49:01.219Z",
        manifestFile: "characters-manifest.json",
        manifestSha256: "ae634968dd3349cec2b6ac16d7df2bcdcf9306afaf897cb475011fbd8f22c610",
        manifestSizeBytes: 445,
        manifestPayloadFile: "releases/2026-08-13T03-49-01.219Z/de6268219039f0bbafda7b01b473e957e0cd5442682caab361a32470a2a2e899/characters.json.gz",
        localPayloadFile: "characters.json.gz",
        payloadSha256: "de6268219039f0bbafda7b01b473e957e0cd5442682caab361a32470a2a2e899",
        payloadSizeBytes: 1_460_373,
        uncompressedSizeBytes: 15_720_450,
        topLevelCount: 1_436,
        uniqueCardIdCount: 1_627,
        databaseCoveredCardCount: 1_623,
        databaseUncoveredCardCount: 4_136,
        outsideDatabaseCardIds: ["1020411", "1030311", "1034411", "1034431"],
    },
} as const;

export type CharacterStructuralEvidenceStatus = "supported" | "partial" | "unknown";
export type CharacterStructuralCollectionState =
    | "present_with_row_provenance"
    | "empty_with_container_provenance_absence_unproved"
    | "absent_unproved";

export type CharacterStructuralLabelEvidence = {
    status: "supported";
    value: string;
    sourceLocale: "global_snapshot_default";
    source: { table: "card_categories" | "link_skills"; rowId: string; column: "name" };
} | {
    status: "unknown";
    reason: "dictionary_mapping_missing";
};

export interface CharacterStructuralCategoryAssignment {
    categoryId: string;
    relationRowId: string;
    status: CharacterStructuralEvidenceStatus;
    labelEvidence: CharacterStructuralLabelEvidence;
}

export interface CharacterStructuralLinkEntry {
    slot: number;
    linkSkillId: string;
    sourceColumn: string;
    status: CharacterStructuralEvidenceStatus;
    labelEvidence: CharacterStructuralLabelEvidence;
}

export interface CharacterStructuralIdentityRecord {
    cardId: string;
    productiveCardIdCoverage: "covered" | "not_covered";
    characterClass: { raw: unknown; value: string; status: CharacterStructuralEvidenceStatus };
    categories: {
        status: CharacterStructuralEvidenceStatus;
        state: CharacterStructuralCollectionState;
        containerProvenance: { contract: "dokkan-database-characters-taxonomy"; cardId: string; field: "categoryAssignments" } | null;
        assignments: CharacterStructuralCategoryAssignment[];
    };
    links: {
        status: CharacterStructuralEvidenceStatus;
        state: CharacterStructuralCollectionState;
        containerProvenance: { contract: "dokkan-database-characters-taxonomy"; cardId: string; field: "links" } | null;
        entries: CharacterStructuralLinkEntry[];
    };
}

export interface CharacterStructuralSidecarLineage {
    profileId: typeof CHARACTER_STRUCTURAL_SIDECAR_SOURCE_PIN.profileId;
    snapshotVersion: typeof CHARACTER_STRUCTURAL_SIDECAR_SOURCE_PIN.snapshotVersion;
    k2: {
        contractVersion: "1.0.0";
        manifestSha256: string;
        manifestSizeBytes: number;
        payloadSha256: string;
        payloadSizeBytes: number;
        uncompressedSizeBytes: number;
        coverageSha256: string;
        coverageSizeBytes: number;
        validationSha256: string;
        validationSizeBytes: number;
        databaseSha256: string;
        db1ArtifactSha256: string;
    };
    productiveCharacters: {
        contract: "Character[]";
        datasetVersion: string;
        manifestSha256: string;
        manifestSizeBytes: number;
        payloadSha256: string;
        payloadSizeBytes: number;
        uncompressedSizeBytes: number;
        topLevelCount: number;
        uniqueCardIdCount: number;
    };
}

export interface CharacterStructuralIdentitySidecar {
    schemaVersion: 1;
    contract: "dokkan-database-character-structural-identity-sidecar";
    contractVersion: "1.0.0";
    generatedAt: string;
    datasetVersion: string;
    mode: "offline_default_off";
    source: CharacterStructuralSidecarLineage;
    policy: {
        recordKey: "cardId";
        productiveComparison: "card_id_only";
        structuralIdentityFrom: "pinned_k2_taxonomy_only";
        productivePayloadUse: "card_id_coverage_only";
        presentationLabelsAreIdentity: false;
        sourceOrderPreserved: true;
        assignmentsDeduplicated: false;
        assignmentsCanonicalized: false;
        sharedLinksComputed: false;
        activeLinksComputed: false;
        collectionOrderIrrelevanceClaimed: false;
        ezaSezaInvariance: "not_claimed";
        characterPatchesCreated: false;
        consumerImplemented: false;
        publisherImplemented: false;
        androidImplemented: false;
    };
    records: CharacterStructuralIdentityRecord[];
}

export interface CharacterStructuralSidecarCoverage {
    schemaVersion: 1;
    contract: "dokkan-database-character-structural-identity-coverage";
    contractVersion: "1.0.0";
    database: {
        cardCount: number;
        categoryAssignmentCount: number;
        linkEntryCount: number;
        emptyCategoryCollectionCount: number;
        absentCategoryCollectionCount: number;
        emptyLinkCollectionCount: number;
        absentLinkCollectionCount: number;
        missingCategoryLabelMappingCount: number;
        missingLinkLabelMappingCount: number;
        fieldStatuses: Record<"characterClass" | "categories" | "links", Record<CharacterStructuralEvidenceStatus, number>>;
    };
    productiveCardIdCoverage: {
        comparison: "card_id_only";
        topLevelCharacterCount: number;
        uniqueCardIdCount: number;
        ambiguousCardIdCount: 0;
        databaseCoveredCardCount: number;
        databaseUncoveredCardCount: number;
        outsideDatabaseCardIds: string[];
    };
}

export interface CharacterStructuralSidecarValidation {
    schemaVersion: 1;
    contract: "dokkan-database-character-structural-identity-validation";
    contractVersion: "1.0.0";
    valid: boolean;
    failures: string[];
    sizes: {
        rawMaximumBytes: number;
        gzipMaximumBytes: number;
        rawSizeBytes: number;
        gzipSizeBytes: number;
    };
    safety: {
        duplicateCardIdCount: number;
        duplicateCategoryDictionaryIdCount: number;
        duplicateLinkDictionaryIdCount: number;
        invalidCollectionStateCount: number;
        invalidOrderingOrSlotCount: number;
        characterPatchCount: 0;
        networkRequestCount: 0;
        outputNamespaceThreatModel: "caller_controlled_stable_during_operation";
        portableOpenatProtection: "unavailable";
        sameUserNamespaceAttackerResistanceClaimed: false;
        hardLinkAttackerResistanceClaimed: false;
    };
    readiness: {
        offlineGeneration: "GO";
        integrityOnlyValidation: "NON_AUTHORITATIVE";
        sourceBoundArtifactValidation: "REQUIRED_FOR_GO";
        publication: "NO-GO";
        r2: "NO-GO";
        android: "NO-GO";
        authorityPromotion: "NO-GO";
        gameplaySemantics: "NO-GO";
        consumer: "NO-GO";
        characterApply: "NO-GO";
    };
}

export interface CharacterStructuralSidecarManifest {
    schemaVersion: 1;
    contract: "dokkan-database-character-structural-identity-manifest";
    contractVersion: "1.0.0";
    generatedAt: string;
    datasetVersion: string;
    fileName: typeof CHARACTER_STRUCTURAL_SIDECAR_FILES.payload;
    compression: "gzip";
    sha256: string;
    sizeBytes: number;
    uncompressedSha256: string;
    uncompressedSizeBytes: number;
    recordCount: number;
    source: CharacterStructuralSidecarLineage;
    coverageFile: typeof CHARACTER_STRUCTURAL_SIDECAR_FILES.coverage;
    coverageSha256: string;
    coverageSizeBytes: number;
    validationFile: typeof CHARACTER_STRUCTURAL_SIDECAR_FILES.validation;
    validationSha256: string;
    validationSizeBytes: number;
}

export interface CharacterStructuralProductiveCoverage {
    topLevelCount: number;
    occurrenceCount: number;
    cardIds: Set<string>;
}
