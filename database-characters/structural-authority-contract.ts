export const STRUCTURAL_AUTHORITY_CONTRACT_VERSION = "1.0.0" as const;
export const STRUCTURAL_AUTHORITY_FIELDS = ["characterClass", "categories", "links"] as const;

export type StructuralAuthorityField = typeof STRUCTURAL_AUTHORITY_FIELDS[number];
export type StructuralAuthorityClassification =
    | "agreement"
    | "representation_gain"
    | "representation_mismatch"
    | "confirmed_conflict"
    | "unknown"
    | "unjoinable";

export interface StructuralAuthorityLineage {
    profileId: string;
    snapshotVersion: string;
    k0: { contractVersion: string; sha256: string; sizeBytes: number };
    k2: { contractVersion: string; manifestSha256: string; manifestSizeBytes: number; sha256: string; sizeBytes: number; uncompressedSizeBytes: number };
    k11: { contractVersion: string; manifestSha256: string; manifestSizeBytes: number; sha256: string; sizeBytes: number; uncompressedSha256: string; uncompressedSizeBytes: number };
    productiveCharacters: {
        contract: "Character[]";
        datasetVersion: string;
        manifestFile: "characters-manifest.json";
        manifestSha256: string;
        manifestSizeBytes: number;
        payloadFile: "characters.json.gz";
        payloadSha256: string;
        payloadSizeBytes: number;
        uncompressedSizeBytes: number;
        topLevelCount: number;
    };
}

export interface StructuralAuthorityProductiveRecord {
    cardId: string;
    sourceRecordPath: string;
    recordKind: "top_level" | "nested_transformation";
    characterClass: unknown;
    categories: unknown;
    links: unknown;
    fieldPresence: {
        characterClass: boolean;
        categories: boolean;
        links: boolean;
    };
}

export interface StructuralAuthorityProductiveIndex {
    selected: Map<string, StructuralAuthorityProductiveRecord>;
    ambiguous: Map<string, string[]>;
    topLevelCount: number;
}

export interface StructuralAuthorityCollectionComparison {
    ordered: "equal" | "different" | "unavailable";
    set: "equal" | "different" | "unavailable";
    databaseDuplicateIds: string[];
    databaseDuplicateLabels: string[];
    productiveDuplicateLabels: string[];
}

export interface StructuralAuthorityCandidate {
    representation: "audit_only_unbound";
    structuralIds: string[] | null;
    databaseValue: string | string[];
    projectedCharacterValue: null;
    productiveComparisonBinding: "card_id_only";
    productiveStateBinding: "unavailable";
    authorityEligibility: "ineligible_unproved_productive_state";
    characterPatchable: false;
}

export interface StructuralAuthorityK11Provenance {
    sourceField: "characterClass" | "categoryIds" | "categories" | "linkIds" | "links";
    table: string;
    rowId: string;
    column: string | null;
    stateId: string;
    stateKey: string;
}

export interface StructuralAuthorityFact {
    cardId: string;
    stateId: string;
    stateKey: string;
    evidenceBinding: "card_id_state_id_state_key";
    recordKind: "collectable" | "form";
    field: StructuralAuthorityField;
    evidenceStatus: "supported" | "partial" | "unknown";
    classification: StructuralAuthorityClassification;
    database: {
        rawValue: unknown;
        normalizedValue: unknown;
        structuralIds: string[] | null;
        projectedLabels: string[] | null;
    };
    productive: {
        cardId: string | null;
        comparisonBinding: "card_id_only";
        stateBinding: "unavailable";
        fieldPresent: boolean | null;
        rawValue: unknown;
        sourceRecordPath: string | null;
        recordKind: "top_level" | "nested_transformation" | null;
    };
    collectionComparison: StructuralAuthorityCollectionComparison | null;
    provenance: {
        k11: StructuralAuthorityK11Provenance[];
        k2: Array<{
            role: "scalar" | "assignment" | "dictionary_label";
            structuralId: string | null;
            table: string;
            rowId: string;
            column: string;
        }>;
        productive: { payloadSha256: string; sourceRecordPath: string } | null;
    };
    exclusions: string[];
    candidate: StructuralAuthorityCandidate | null;
}

export interface StructuralAuthorityFieldSummary {
    field: StructuralAuthorityField;
    exclusiveClassifications: Record<StructuralAuthorityClassification, number>;
    supportedCandidateCount: number;
    authorityEligibleCandidateCount: number;
    characterPatchableCandidateCount: number;
    cardIdComparableFactCount: number;
    fullCardIdComparableScopeEvidence: "GO" | "NO-GO";
    authorityPromotion: "NO-GO";
}

export interface StructuralAuthorityCollectionSummary {
    label: "non_exclusive_collection_comparisons";
    orderedEqual: number;
    orderedDifferent: number;
    setEqual: number;
    setDifferent: number;
    sameSetDifferentOrder: number;
    unavailable: number;
}

export interface StructuralAuthorityAudit {
    schemaVersion: 1;
    contract: "dokkan-database-character-structural-authority-audit";
    contractVersion: typeof STRUCTURAL_AUTHORITY_CONTRACT_VERSION;
    generatedAt: string;
    mode: "offline_default_off_audit";
    source: StructuralAuthorityLineage;
    policy: {
        fields: ["characterClass", "categories", "links"];
        structuralIdentityOnly: true;
        k11K2EvidenceBinding: "card_id_state_id_state_key";
        productiveComparisonBinding: "card_id_only";
        productiveStateBinding: "unavailable";
        namesOrLocalizedTextAsJoinIdentity: false;
        fieldScopedProvenanceRequired: true;
        rawValuesAndOrderPreserved: true;
        setEqualitySelectsAuthority: false;
        supportedOnlyCandidates: true;
        productionValuesChanged: false;
        applyImplemented: false;
        writerImplemented: false;
        consumerImplemented: false;
        publisherEnabled: false;
        androidEnabled: false;
    };
    inventory: {
        databaseCards: number;
        productiveTopLevelCharacters: number;
        productiveSelectedCardIds: number;
        productiveAmbiguousCardIds: number;
        productiveCardIdsOutsideDatabase: string[];
        factCount: number;
    };
    fields: StructuralAuthorityFieldSummary[];
    collectionComparisons: Record<"categories" | "links", StructuralAuthorityCollectionSummary>;
    facts: StructuralAuthorityFact[];
    readiness: {
        audit: "GO";
        authorityPromotion: "NO-GO";
        productionMutation: "NO-GO";
        consumer: "NO-GO";
        publisher: "NO-GO";
        r2: "NO-GO";
        android: "NO-GO";
    };
}

export const STRUCTURAL_AUTHORITY_PRODUCTIVE_PIN = {
    manifestFile: "characters-manifest.json",
    manifestSha256: "ae634968dd3349cec2b6ac16d7df2bcdcf9306afaf897cb475011fbd8f22c610",
    manifestSizeBytes: 445,
    payloadFile: "characters.json.gz",
    payloadSha256: "de6268219039f0bbafda7b01b473e957e0cd5442682caab361a32470a2a2e899",
    payloadSizeBytes: 1_460_373,
    uncompressedSizeBytes: 15_720_450,
    characterCount: 1_436,
    datasetVersion: "2026-08-13T03:49:01.219Z",
    remoteFileName: "releases/2026-08-13T03-49-01.219Z/de6268219039f0bbafda7b01b473e957e0cd5442682caab361a32470a2a2e899/characters.json.gz",
} as const;
