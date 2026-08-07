export type CharacterEvidenceStatus = "supported" | "partial" | "unknown";

export interface CharacterIdentityRecord {
    characterId: string;
    cardIds: string[];
    cardUniqueInfoIds: string[];
    source: { table: "characters"; rowId: string };
}

export interface CardIdentityRecord {
    cardId: string;
    recordKind: "collectable" | "form";
    characterId: string;
    cardUniqueInfoId: string;
    resourceId?: string;
    potentialBoardId?: string;
    hardDuplicateGroupId: string;
    awakeningFamilyId: string;
    variantGroupId?: string;
    uiGrouping: {
        collectionListed: boolean;
        projectedPrimary: boolean;
        downstreamCollectionCardIds: string[];
    };
    source: { table: "cards"; rowId: string };
}

export interface CharacterStateIdentityRecord {
    stateId: string;
    sourceStateKey: string;
    cardId: string;
    formId: string;
    releaseState: "initial" | "eza" | "seza" | "unknown";
    growthRowId?: string;
    evidenceStatus: CharacterEvidenceStatus;
}

export interface CharacterRelationInventory {
    relation: string;
    status: CharacterEvidenceStatus;
    sourceTable: string;
    rowCount: number;
    distinctSourceCount: number;
    distinctTargetCount: number;
    danglingTargetCount: number;
    partialAssignmentCount: number;
    unknownAssignmentCount: number;
    danglingTargetIds: string[];
    note?: string;
    assignments: CharacterRelationAssignment[];
}

export interface CharacterRelationAssignment {
    assignmentId: string;
    sourceId: string;
    targetId?: string;
    status: CharacterEvidenceStatus;
    missing: string[];
    source: { table: string; rowId: string; columns: string[] };
}

export interface DatabaseCharacterIdentityDataset {
    schemaVersion: 1;
    contract: "dokkan-database-characters-identity";
    contractVersion: "1.0.0";
    generatedAt: string;
    source: {
        snapshotVersion: string;
        databaseSha256: string;
        db1DatasetVersion: string;
        db1ArtifactSha256: string;
        lineage: "validated-db1-stream-no-db0-db50-replay";
    };
    identityPolicy: {
        presentationTextAsJoinKey: false;
        cardIdentity: "cards.id";
        characterIdentity: "characters.id";
        formIdentity: "form-card cards.id";
        stateIdentity: "card id plus initial or optimal-awakening growth row id";
        uiGroupingSeparateFromCardIdentity: true;
    };
    characters: CharacterIdentityRecord[];
    cards: CardIdentityRecord[];
    states: CharacterStateIdentityRecord[];
    relations: CharacterRelationInventory[];
}

export interface DatabaseCharacterIdentityCoverage {
    schemaVersion: 1;
    characterCount: number;
    cardCount: number;
    collectableCardCount: number;
    formCardCount: number;
    stateCount: number;
    releaseStateCounts: Record<"initial" | "eza" | "seza" | "unknown", number>;
    projectedPrimaryCardCount: number;
    supportedRelationCount: number;
    partialRelationCount: number;
    unknownRelationCount: number;
    danglingTargetCount: number;
    partialAssignmentCount: number;
    unknownAssignmentCount: number;
    duplicateCardIdentityCount: number;
    duplicateStateIdentityCount: number;
}

export interface DatabaseCharacterIdentityValidation {
    schemaVersion: 1;
    valid: boolean;
    cardCount: number;
    stateCount: number;
    losslessSourceIdentityCount: number;
    failures: string[];
}

export interface DatabaseCharacterIdentityManifest {
    schemaVersion: 1;
    contractVersion: "1.0.0";
    generatedAt: string;
    fileName: "database-characters-k0-identity.json.gz";
    compression: "gzip";
    sha256: string;
    sizeBytes: number;
    uncompressedSizeBytes: number;
    characterCount: number;
    cardCount: number;
    stateCount: number;
    sourceSnapshotVersion: string;
    sourceDatabaseSha256: string;
    sourceDb1ArtifactSha256: string;
    coverageFile: "database-characters-k0-coverage.json";
    coverageSha256: string;
    coverageSizeBytes: number;
    validationFile: "database-characters-k0-validation.json";
    validationSha256: string;
    validationSizeBytes: number;
}
