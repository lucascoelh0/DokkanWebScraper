export type EventsE3Status = "supported" | "partial" | "unknown";
export type EventsE3RawRow = Record<string, unknown>;

export interface EventsE3RawEnemy {
    position: number;
    cardId: number;
    enemySkillIds: number[];
    enemyRoundSkillSetId: number | null;
}

export interface EventsE3RawEncounter {
    sourceId: number;
    displayTypeRaw: string;
    battles: Array<{ position: number; rounds: Array<{ position: number; roundNoRaw: number; commentRaw: string | null; enemies: EventsE3RawEnemy[] }> }>;
}

export interface EventsE3Observation {
    questEncounters: EventsE3RawEncounter[];
    originEncounters: EventsE3RawEncounter[];
    referencedCards: EventsE3RawRow[];
    referencedCharacters: EventsE3RawRow[];
    referencedEnemySkills: EventsE3RawRow[];
    referencedRoundSkillSets: EventsE3RawRow[];
    referencedRoundSkillSetRelations: EventsE3RawRow[];
    referencedRoundSkills: EventsE3RawRow[];
    zBattleEnemies: EventsE3RawRow[];
    zBattleCardEscalations: EventsE3RawRow[];
    zBattleSkillEscalations: EventsE3RawRow[];
    zBattleStatusEscalations: EventsE3RawRow[];
    zBattlePowerupThresholds: EventsE3RawRow[];
    sdStageEnemyReferences: EventsE3RawRow[];
}

export interface EventsE3Encounter {
    identity: { kind: "quest_level_encounter" | "origin_battle_encounter"; sourceId: string };
    source: { table: "sugoroku_map_enemy_informations" | "origin_battle_enemy_informations"; rowId: string; columns: ["enemy_info"] };
    status: "supported" | "partial";
    displayTypeRaw: string;
    battles: Array<{ ordinal: number; rounds: Array<{ ordinal: number; roundNoRaw: number; commentRaw: string | null; enemies: Array<{ ordinal: number; cardId: string; enemySkillIds: string[]; enemyRoundSkillSetId: string | null }> }> }>;
    semanticBoundary: { battleArrayOrder: "supported"; roundArrayOrder: "supported"; enemyArrayOrder: "supported"; runtimeStats: "unknown" };
}

export interface EventsE3CardReference {
    identity: { kind: "card"; id: string };
    characterId: string;
    cardUniqueInfoId: string | null;
    resourceId: string;
    rawCatalogClassification: { rarity: number; element: number; maxLevel: number };
    rawCatalogStats: { hpInitial: number; hpMax: number; attackInitial: number; attackMax: number; defenceInitial: number; defenceMax: number };
    enemyRuntimeApplication: { status: "unknown"; warning: "card_catalog_stats_are_not_enemy_runtime_stats" };
    source: { table: "cards"; rowId: string };
}

export interface EventsE3ZBattleEnemyRange {
    identity: { kind: "z_battle_enemy_range"; id: string };
    stageId: string;
    ordinalRaw: number;
    levels: { start: number; end: number | null };
    stats: {
        status: "partial";
        rawBase: { hp: number; attack: number; defence: number };
        unknowns: ["units", "application_formula", "precedence", "runtime_modifiers"];
    };
    cardEscalations: EventsE3RawRow[];
    skillEscalations: EventsE3RawRow[];
    rawEscalationTypeIds: { hp: string; attack: string; defence: string; specialAttack: string; performance: string; card: string; skill: string };
    source: { table: "z_battle_enemies"; rowId: string };
}

export interface EventsE3Dataset {
    schemaVersion: 1;
    contract: "dokkan-events-database-first-encounters";
    contractVersion: "0.4.0";
    generatedAt: string;
    generatedAtPolicy: "pinned_to_source_snapshot_for_reproducible_bytes";
    sourceSnapshotVersion: string;
    sourceDatabaseSha256: string;
    sourceE2: { contractVersion: "0.3.0"; sha256: string };
    questEncounters: EventsE3Encounter[];
    originEncounters: EventsE3Encounter[];
    cardReferences: EventsE3CardReference[];
    characterReferences: Array<{ identity: { kind: "master_character"; id: string }; rawClassification: { race: number; sex: number; size: number }; source: { table: "characters"; rowId: string } }>;
    enemySkills: Array<{ identity: { kind: "enemy_skill"; id: string }; status: "partial"; raw: EventsE3RawRow; semanticBoundary: "mechanics_deferred_to_e4" }>;
    enemyRoundSkillSets: Array<{ identity: { kind: "enemy_round_skill_set"; id: string }; status: "partial"; effectDescriptionRaw: string; cancelDescriptionRaw: string; relationIds: string[]; enemyRoundSkillIds: string[] }>;
    enemyRoundSkills: Array<{ identity: { kind: "enemy_round_skill"; id: string }; status: "partial"; raw: EventsE3RawRow; semanticBoundary: "mechanics_deferred_to_e4" }>;
    zBattleEnemyRanges: EventsE3ZBattleEnemyRange[];
    zBattleStatusCurves: Array<{ escalationTypeId: string; status: "partial"; points: EventsE3RawRow[]; semanticBoundary: "raw_level_value_pairs_without_application_formula_or_units" }>;
    zBattlePowerupThresholds: Array<{ stageId: string; sourceRowId: string; status: "partial"; raw: { hp: number; attack: number; defence: number; specialAttack: number }; semanticBoundary: "threshold_units_and_runtime_application_unknown" }>;
    sdEncounterBoundary: Array<{ stageId: string; enemyTableIdRaw: string; status: "partial"; missing: ["sd_enemy_table_target"] }>;
    nonTraditionalBoundaries: Array<{ family: "rmbattle" | "budokai"; status: "partial"; missing: string[] }>;
}

export interface EventsE3Coverage {
    schemaVersion: 1;
    questEncounterCount: number; battleCount: number; roundCount: number; enemyPositionCount: number;
    originEncounterCount: number; originEnemyPositionCount: number;
    referencedCardCount: number; referencedCharacterCount: number; enemySkillCount: number; roundSkillSetCount: number; roundSkillCount: number;
    zBattleEnemyRangeCount: number; zCardEscalationCount: number; zSkillEscalationCount: number; zStatusEscalationReferenceCount: number;
    sdOpaqueEnemyReferenceCount: number; danglingIdCount: number;
    statusCounts: { supported: number; partial: number; unknown: number };
}

export interface EventsE3Goldens { schemaVersion: 1; representatives: Array<{ kind: string; sourceId: string; structuralSha256: string }> }
export interface EventsE3Baseline { snapshotVersion: string; sourceE2Sha256: string; goldens: EventsE3Goldens }
export interface EventsE3Validation { schemaVersion: 1; valid: boolean; exactProjection: boolean; losslessEncounterCount: number; losslessEnemyPositionCount: number; joinCount: number; failures: string[] }
export interface EventsE3Manifest { schemaVersion: 1; contractVersion: "0.4.0"; generatedAt: string; generatedAtPolicy: "pinned_to_source_snapshot_for_reproducible_bytes"; sourceSnapshotVersion: string; fileName: "events-e3-encounters.json"; compression: "none"; sha256: string; sizeBytes: number; sourceDatabaseSha256: string; sourceE2Sha256: string; coverage: { fileName: "events-e3-coverage.json"; sha256: string; sizeBytes: number }; validation: { fileName: "events-e3-validation.json"; sha256: string; sizeBytes: number }; goldens: { fileName: "events-e3-goldens.json"; sha256: string; sizeBytes: number } }
