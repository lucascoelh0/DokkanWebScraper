export interface EventsE2Observation {
    quests: Array<Record<string, unknown>>;
    maps: Array<Record<string, unknown>>;
    areaConditions: Array<Record<string, unknown>>;
    zBattleStages: Array<Record<string, unknown>>;
    zBattleEnemyRanges: Array<Record<string, unknown>>;
    zBattleCheckPoints: Array<Record<string, unknown>>;
    zBattleRewardLevelAnchors: Array<Record<string, unknown>>;
    originBattles: Array<Record<string, unknown>>;
    sdMaps: Array<Record<string, unknown>>;
    sdArenas: Array<Record<string, unknown>>;
    sdStages: Array<Record<string, unknown>>;
}

export interface EventsE2QuestLevel {
    identity: { kind: "quest_level"; id: string };
    source: { table: "sugoroku_maps"; rowId: string };
    deepLinkKey: string;
    rawDifficulty: number;
    costs: { act: number; eventKeyCount: number };
    outcomes: { rankExp: number; zeni: number; rewardGroupId: string | null };
    rawAttributes: { cpuOnly: boolean; linkSkillLevelUpProbabilityRate: number; cpuFriendListId: string | null };
}

export interface EventsE2QuestStage {
    identity: { kind: "quest_stage"; id: string };
    source: { table: "quests"; rowId: string };
    areaId: string;
    deepLinkKey: string;
    title: { value: string; locale: "snapshot_embedded_unverified" };
    previousStageId: string | null;
    clearBonusStones: { anyDifficulty: number | null; allDifficulties: number | null };
    attempts: { maxVisits: number | null; resetIntervalDays: number | null };
    rules: { canIgnoreDifficultyOrder: boolean; limitationAnnouncementId: string | null; boostable: boolean; sugorokuAuto: boolean; battleAuto: boolean; enemyInfoDisplayTypeRaw: string };
    availabilityHint: { startAt: string | null; boundary: "database_embedded_schedule_hint_not_server_current_availability" };
    levels: EventsE2QuestLevel[];
}

export interface EventsE2ZBattleTopology {
    identity: { kind: "z_battle_topology"; stageId: string };
    deepLinkPrefix: string;
    unlockConditions: { status: "partial"; rawJson: string };
    enemyRanges: Array<{ sourceRowId: string; ordinal: number; startLevel: number; endLevel: number | null }>;
    checkpoints: Array<{ sourceRowId: string; level: number; act: number; eventKeyCount: number }>;
    rewardLevelAnchors: Array<{ sourceRowId: string; level: number }>;
}

export interface EventsE2OriginBattle {
    identity: { kind: "origin_battle"; id: string };
    source: { table: "origin_battles"; rowId: string };
    status: "partial";
    originSpotIdRaw: string;
    deepLinkKey: string;
    costsAndOutcomes: { act: number; rankExp: number; zeni: number; firstClearBonusStones: number; linkSkillLevelUpProbabilityRate: number };
    rules: { battleAuto: boolean; unlockMissionIdsRaw: string | null; limitationAnnouncementId: string | null };
    missing: ["origin_spot_root_table", "catalog_page_join"];
}

export interface EventsE2SdMapTopology {
    identity: { kind: "sd_map_topology"; mapId: string };
    status: "partial";
    deepLinkPrefix: string;
    arenas: Array<{ identity: { arenaId: string }; sourceRowId: string; position: { x: number; y: number }; symbolItem: { rawType: string; itemId: string }; stages: Array<{ identity: { stageId: string }; sourceRowId: string; deepLinkKey: string; enemyTableIdRaw: string; respawnMinutes: number; position: { x: number; y: number } }> }>;
    missing: ["sd_product_family_label", "sd_enemy_table_target"];
}

export interface EventsE2Dataset {
    schemaVersion: 1;
    contract: "dokkan-events-database-first-topology";
    contractVersion: "0.3.0";
    generatedAt: string;
    generatedAtPolicy: "pinned_to_source_snapshot_for_reproducible_bytes";
    sourceSnapshotVersion: string;
    sourceDatabaseSha256: string;
    sourceE1: { contractVersion: "0.2.0"; sha256: string };
    questStages: EventsE2QuestStage[];
    unboundQuestLevels: Array<EventsE2QuestLevel & { status: "unknown"; missing: ["quest_id"] }>;
    areaRequirements: Array<{ sourceRowId: string; areaId: string; status: "partial"; rawType: string; conditionsRawJson: string; comment: string }>;
    zBattleTopologies: EventsE2ZBattleTopology[];
    originBattles: EventsE2OriginBattle[];
    sdTopologies: EventsE2SdMapTopology[];
    nonTraditionalBoundaries: Array<{ family: "budokai" | "rmbattle"; status: "partial"; rootCount: number; missing: string[] }>;
}

export interface EventsE2Coverage { schemaVersion: 1; questStageCount: number; questLevelCount: number; rawDifficultyCounts: Record<string, number>; unboundQuestLevelCount: number; areaRequirementCount: number; zBattleStageCount: number; zBattleEnemyRangeCount: number; zBattleCheckpointCount: number; zBattleRewardLevelAnchorCount: number; originBattleCount: number; sdMapCount: number; sdArenaCount: number; sdStageCount: number; danglingIdCount: number }
export interface EventsE2Validation { schemaVersion: 1; valid: boolean; exactProjection: boolean; questStageCount: number; questLevelCount: number; zBattleStageCount: number; sdStageCount: number; failures: string[] }
export interface EventsE2Manifest { schemaVersion: 1; contractVersion: "0.3.0"; generatedAt: string; generatedAtPolicy: "pinned_to_source_snapshot_for_reproducible_bytes"; sourceSnapshotVersion: string; fileName: "events-e2-topology.json"; compression: "none"; sha256: string; sizeBytes: number; sourceDatabaseSha256: string; sourceE1Sha256: string; coverage: { fileName: "events-e2-coverage.json"; sha256: string; sizeBytes: number }; validation: { fileName: "events-e2-validation.json"; sha256: string; sizeBytes: number } }
