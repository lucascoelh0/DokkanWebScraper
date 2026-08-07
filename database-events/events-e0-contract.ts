export type EventsEvidenceStatus = "supported" | "partial" | "unknown";

export interface EventsE0Column {
    name: string;
    declaredType: string;
    notNull: boolean;
    primaryKeyOrdinal: number;
}

export interface EventsE0TableObservation {
    name: string;
    rowCount: number;
    columns: EventsE0Column[];
    declaredForeignKeys: Array<{
        id: number;
        sequence: number;
        targetTable: string;
        fromColumn: string;
        toColumn: string;
    }>;
}

export interface EventsE0RelationshipObservation {
    key: string;
    fromTable: string;
    fromColumn: string;
    toTable: string;
    toColumn: string;
    sourceRowCount: number;
    nonNullSourceCount: number;
    joinedSourceCount: number;
    danglingNonNullCount: number;
}

export interface EventsE0AreaFamilyObservation {
    rawAreaType: string;
    rawCategory: number;
    areaCount: number;
    questCount: number;
    mapCount: number;
    encounterMapCount: number;
}

export interface EventsE0EncounterObservation {
    sourceTable: "sugoroku_map_enemy_informations" | "origin_battle_enemy_informations";
    sourceCount: number;
    parsedCount: number;
    topLevelShapes: string[][];
    battleShapes: string[][];
    roundShapes: string[][];
    enemyShapes: string[][];
    displayTypeCounts: Record<string, number>;
    battleCount: number;
    roundCount: number;
    enemyCount: number;
    uniqueCardIdCount: number;
    joinedCardIdCount: number;
    uniqueEnemySkillIdCount: number;
    joinedEnemySkillIdCount: number;
    uniqueEnemyRoundSkillSetIdCount: number;
    joinedEnemyRoundSkillSetIdCount: number;
}

export interface EventsE0Observation {
    tableCount: number;
    tables: EventsE0TableObservation[];
    relationships: EventsE0RelationshipObservation[];
    areaFamilies: EventsE0AreaFamilyObservation[];
    encounters: EventsE0EncounterObservation[];
}

export interface EventsE0TableInventory extends EventsE0TableObservation {
    domain: {
        status: EventsEvidenceStatus;
        families: string[];
        role: string;
        basis: "validated_structural_join" | "bounded_schema_candidate" | "not_yet_classified";
    };
}

export interface EventsE0Dataset {
    schemaVersion: 1;
    contract: "dokkan-events-database-first-inventory";
    contractVersion: "0.1.0";
    generatedAt: string;
    generatedAtPolicy: "pinned_to_source_snapshot_for_reproducible_bytes";
    sourceSnapshotVersion: string;
    sourceDatabase: {
        fileName: string;
        sha256: string;
        sizeBytes: number;
        schemaSha256: string;
        tableCount: number;
        readOnly: true;
    };
    identityPolicy: "numeric_structural_ids_only_names_and_text_are_presentation";
    scheduleBoundary: "static_catalog_fields_are_separate_from_server_availability";
    tables: EventsE0TableInventory[];
    relationships: EventsE0RelationshipObservation[];
    areaFamilies: EventsE0AreaFamilyObservation[];
    encounters: EventsE0EncounterObservation[];
}

export interface EventsE0Coverage {
    schemaVersion: 1;
    tableCount: number;
    tableStatusCounts: Record<EventsEvidenceStatus, number>;
    declaredForeignKeyCount: number;
    declaredPrimaryKeyCount: number;
    validatedRelationshipCount: number;
    danglingNonNullRelationshipCount: number;
    rawAreaFamilyCount: number;
    areaCount: number;
    questCount: number;
    mapCount: number;
    encounterSourceCount: number;
    encounterCount: number;
    roundCount: number;
    enemyCount: number;
}

export interface EventsE0Validation {
    schemaVersion: 1;
    valid: boolean;
    tableCount: number;
    losslessTableCount: number;
    relationshipCount: number;
    losslessEncounterSourceCount: number;
    failures: string[];
}

export interface EventsE0Manifest {
    schemaVersion: 1;
    contractVersion: "0.1.0";
    generatedAt: string;
    generatedAtPolicy: "pinned_to_source_snapshot_for_reproducible_bytes";
    fileName: "events-e0-inventory.json";
    compression: "none";
    sha256: string;
    sizeBytes: number;
    tableCount: number;
    sourceSnapshotVersion: string;
    sourceDatabaseSha256: string;
    coverage: { fileName: "events-e0-coverage.json"; sha256: string; sizeBytes: number };
    validation: { fileName: "events-e0-validation.json"; sha256: string; sizeBytes: number };
}

export interface EventsE0Baseline {
    schemaVersion: 1;
    contractVersion: "0.1.0";
    snapshotVersion: string;
    generatedAt: string;
    sourceDatabase: {
        sha256: string;
        sizeBytes: number;
        tableCount: number;
        schemaSha256: string;
    };
}
