export type SqliteScalar = string | number | null;

export interface RowProvenance {
    table: string,
    rowId: string,
    columns: string[],
}

export interface SourcedRow {
    values: Record<string, SqliteScalar>,
    provenance: RowProvenance,
}

export type EvidenceKind =
    | "first-party-string-enum"
    | "first-party-labeled-enum"
    | "current-dataset-exact-id-parity"
    | "first-party-row-join"
    | "cross-source-golden"
    | "unknown";

export interface MappedValue<T extends string> {
    raw: SqliteScalar,
    value: T | "unknown",
    evidence: EvidenceKind,
}

export type ReleaseState = "initial" | "eza" | "seza" | "unknown";
export type AttackVariant = "super" | "ultra" | "unit" | "ex" | "unknown";
export type FormRelationKind = "transformation" | "giant-or-rage" | "reversible-exchange" | "unknown";

export interface DatabaseExperimentSourceManifest {
    schemaVersion: 1,
    sourceKind: "first-party-global-sqlite",
    snapshotVersion: string,
    appVersion: string,
    versionCode: number,
    snapshotDate: string,
    databaseFile: string,
    sizeBytes: number,
    sha256: string,
    tableCount: number,
    readOnlyMode: "sqlite-uri-mode-ro+immutable+query-only",
    consumedTables: Array<{
        table: string,
        columns: string[],
        rowCount: number,
    }>,
}

export interface DatabaseSkillState {
    stateKey: string,
    releaseState: ReleaseState,
    releaseStateEvidence: EvidenceKind,
    release: {
        availableAt: string | null,
        availableAtSnapshot: boolean | null,
        routes: SourcedRow[],
    },
    growthStep?: SourcedRow,
    maxLevel: number | null,
    maxSuperAttackLevel: number | null,
    leaderSkill?: {
        set: SourcedRow,
        effects: SourcedRow[],
        targetRows: SourcedRow[],
        structuredPercentValues: number[],
    },
    passiveSkill?: {
        set: SourcedRow,
        relations: Array<{
            relation: SourcedRow,
            skill?: SourcedRow,
            effect?: SourcedRow,
            causalities: SourcedRow[],
        }>,
    },
    attacks: DatabaseAttack[],
}

export interface DatabaseAttack {
    cardSpecial: SourcedRow,
    specialSet?: SourcedRow,
    effects: SourcedRow[],
    extraOption?: SourcedRow,
    variant: MappedValue<AttackVariant>,
    availableFromSuperAttackLevel: number | null,
}

export interface DatabaseFormRelation {
    sourceCardId: string,
    targetCardId?: string,
    kind: MappedValue<FormRelationKind>,
    channel: "passive" | "active" | "standby" | "finish",
    sourceSkillId: string,
    sourceSkillSetId?: string,
    description?: SourcedRow,
    provenance: RowProvenance,
}

export interface DatabaseCardRecord {
    cardId: string,
    recordKind: "collectable" | "form",
    ids: {
        characterId?: string,
        cardUniqueInfoId?: string,
        resourceId?: string,
        potentialBoardId?: string,
    },
    localizedText: {
        name: string,
        characterName?: string,
        cardUniqueInfoName?: string,
    },
    rarity: MappedValue<"N" | "R" | "SR" | "SSR" | "UR" | "LR">,
    type: MappedValue<"AGL" | "TEQ" | "INT" | "STR" | "PHY">,
    characterClass: MappedValue<"Super" | "Extreme" | "unawakened">,
    stats: {
        hpInitial: number | null,
        hpMax: number | null,
        atkInitial: number | null,
        atkMax: number | null,
        defInitial: number | null,
        defMax: number | null,
    },
    dates: {
        openAt: string | null,
        createdAt: string | null,
        updatedAt: string | null,
    },
    grouping: {
        hardDuplicateGroupId: string,
        awakeningFamilyId: string,
        variantGroupId?: string,
    },
    catalog: {
        collectionEntries: SourcedRow[],
        collectionUniques: SourcedRow[],
        downstreamCollectionCardIds: string[],
        isCollectionListed: boolean,
        isProjectedPrimary: boolean,
        projectionEvidence: EvidenceKind,
    },
    card: SourcedRow,
    character?: SourcedRow,
    cardUniqueInfo?: SourcedRow,
    links: Array<{ slot: number, skill?: SourcedRow }>,
    categories: Array<{ relation: SourcedRow, category?: SourcedRow }>,
    awakeningPaths: {
        incoming: SourcedRow[],
        outgoing: SourcedRow[],
    },
    skillStates: DatabaseSkillState[],
    activeSkills: Array<{ relation: SourcedRow, set?: SourcedRow, effects: SourcedRow[] }>,
    standbySkills: Array<{ relation: SourcedRow, set?: SourcedRow, effects: SourcedRow[], finishSkillSetIds: string[] }>,
    finishSkills: Array<{ relation?: SourcedRow, set?: SourcedRow, effects: SourcedRow[], standbySkillSetIds: string[] }>,
    formRelations: DatabaseFormRelation[],
    unknowns: string[],
}

export interface DatabaseCharacterExperimentDataset {
    schemaVersion: 1,
    contract: "dokkan-character-database-experiment",
    contractVersion: "1.1.0",
    generatedAt: string,
    sourceSnapshotVersion: string,
    sourceSha256: string,
    releaseStateEnumEvidence: {
        eza: SourcedRow[],
        seza: SourcedRow[],
    },
    selection: {
        collectableCardIdMaxExclusive: number,
        includeReferencedForms: true,
        releasedAtOrBefore: string,
        collectableTypeRaw: 1,
        sellingOnlyRaw: 0,
        catalogProjectionRule: "terminal-first-party-collection-card-by-awakening-reachability",
    },
    cards: DatabaseCardRecord[],
}

export interface DatabaseExperimentCoverage {
    schemaVersion: 1,
    cardCount: number,
    collectableCardCount: number,
    formCardCount: number,
    collectionListedCardCount: number,
    projectedPrimaryCardCount: number,
    nonTerminalCollectionCardCount: number,
    uniqueCardIds: number,
    characterRowCoverage: number,
    cardUniqueInfoRowCoverage: number,
    leaderSkillStateCount: number,
    passiveSkillStateCount: number,
    attackCounts: Record<AttackVariant, number>,
    activeSkillCardCount: number,
    standbySkillCardCount: number,
    finishSkillCardCount: number,
    formRelationCounts: Record<FormRelationKind, number>,
    cardsWithGrowthSteps: number,
    confirmedEzaStateCount: number,
    confirmedSezaStateCount: number,
    futureReleaseStateCount: number,
    unknownReleaseStateCount: number,
    projectedPrimaryFutureReleaseStateCount: number,
    projectedPrimaryUnknownReleaseStateCount: number,
    unknownEnumCounts: Record<string, number>,
    enumEvidence: Record<string, {
        confirmed: SqliteScalar[],
        unknown: SqliteScalar[],
        note: string,
    }>,
    danglingJoinCounts: Record<string, number>,
}

export interface DatabaseExperimentArtifactManifest {
    schemaVersion: 1,
    contractVersion: "1.1.0",
    datasetVersion: string,
    generatedAt: string,
    fileName: "characters-db-experiment.json.gz",
    compression: "gzip",
    sha256: string,
    sizeBytes: number,
    uncompressedSizeBytes: number,
    cardCount: number,
    sourceSha256: string,
    sourceManifestFile: "source-manifest.json",
    coverageFile: "coverage.json",
    parityReportFile: "parity-report.md",
    siteAuditFile: "site-audit.json",
}
