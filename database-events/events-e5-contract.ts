import { EventsE3RawRow } from "./events-e3-contract";

export interface EventsE5ItemCatalogTargetObservation {
    rawItemType: string;
    targetKind: string | null;
    targetTable: string | null;
    referencedIds: Array<number | string>;
    joinedIds: Array<number | string>;
}

export interface EventsE5Observation {
    bossDrops: EventsE3RawRow[];
    questDropPreviews: EventsE3RawRow[];
    zFirstRewardRanges: EventsE3RawRow[];
    zFirstRewards: EventsE3RawRow[];
    zNormalRewardTables: EventsE3RawRow[];
    zNormalRewards: EventsE3RawRow[];
    zRewardCheckpoints: EventsE3RawRow[];
    linkedMissions: EventsE3RawRow[];
    linkedMissionRewards: EventsE3RawRow[];
    linkedMissionCategoryPreviews: EventsE3RawRow[];
    budokaiMissions: EventsE3RawRow[];
    budokaiMissionRewards: EventsE3RawRow[];
    budokaiRankingGiftSets: EventsE3RawRow[];
    budokaiRankingGifts: EventsE3RawRow[];
    budokaiBoxRankings: EventsE3RawRow[];
    budokaiBoxRewardRanges: EventsE3RawRow[];
    budokaiBoxRewards: EventsE3RawRow[];
    rmbattleMissions: EventsE3RawRow[];
    rmbattleMissionRewards: EventsE3RawRow[];
    opaqueRewardBindings: { questMapRewardGroups: EventsE3RawRow[]; originBattleRewardSets: EventsE3RawRow[] };
    unboundRewardSurfaces: Array<{ table: string; rowCount: number; consumerStatus: "unknown" }>;
    itemCatalogTargets: EventsE5ItemCatalogTargetObservation[];
}

export interface EventsE5ItemReference {
    rawType: string;
    itemId: string;
    catalogJoin: { status: "supported"; targetKind: string; targetId: string } | { status: "unknown"; missing: "catalog_target" };
}

export interface EventsE5RewardValue {
    item: EventsE5ItemReference;
    quantity: number | null;
    cardExpInit: number | null;
    chance: { status: "unknown"; rawValue: null };
}

export interface EventsE5Dataset {
    schemaVersion: 1;
    contract: "dokkan-events-database-first-rewards";
    contractVersion: "0.6.0";
    generatedAt: string;
    generatedAtPolicy: "pinned_to_source_snapshot_for_reproducible_bytes";
    sourceSnapshotVersion: string;
    sourceDatabaseSha256: string;
    sourceE4: { contractVersion: "0.5.0"; sha256: string };
    sourceE2: { contractVersion: "0.3.0"; sha256: string };
    sourceE1: { contractVersion: "0.2.0"; sha256: string };
    itemCatalogBindings: Array<{ rawItemType: string; status: "supported" | "unknown"; targetKind: string | null; targetTable: string | null; referencedIdCount: number; joinedIdCount: number }>;
    questBossDrops: Array<{ identity: { kind: "quest_boss_drop"; id: string }; mapId: string; questId: string; rawDropType: number; reward: EventsE5RewardValue; repeatability: { status: "unknown"; rawValue: null }; condition: { status: "partial"; boundary: "map_and_quest_binding_supported_drop_type_semantics_unknown" } }>;
    questDropPreviews: Array<{ identity: { kind: "quest_drop_preview"; id: string }; questId: string; rawDifficultiesJson: string; status: "partial"; items: Array<{ slot: number; item: EventsE5ItemReference }>; missing: ["quantity", "chance", "drop_condition", "repeatability"] }>;
    zBattleFirstRewardAnchors: Array<{ rangeId: string; stageId: string; level: number; rewardSetId: string; mainRewardIdRaw: string | null; repeatability: { status: "partial"; sourceFamily: "z_battle_first_reward"; boundary: "first_reward_grouping_supported_runtime_claim_frequency_unverified" } }>;
    zBattleFirstRewardSets: Array<{ rewardSetId: string; rewards: Array<{ sourceRowId: string; value: EventsE5RewardValue }> }>;
    zBattleNormalRewardGroups: Array<{ checkpointId: string; stageId: string; level: number; rewardTableGroupId: string | null; mainRewardIdRaw: string | null; repeatability: { status: "unknown"; rawValue: null } }>;
    zBattleNormalRewardTables: Array<{ tableId: string; rewardTableGroupId: string; rewards: Array<{ sourceRowId: string; value: EventsE5RewardValue }> }>;
    linkedEventMissions: Array<{ identity: { kind: "mission"; id: string }; rawType: string; missionCategoryId: string; targets: { areaId: string | null; zBattleStageId: string | null; originEpisodeId: string | null; originBattleId: string | null }; rawRequirements: { targetValue: number; displayTargetValue: number; target100Value: number | null; conditionsJson: string | null; linkTo: string | null }; availabilityHint: { startAt: string | null; endAt: string | null; endAtHidden: string | null; boundary: "database_embedded_schedule_hint_not_server_current_availability" }; rewards: Array<{ sourceRowId: string; value: EventsE5RewardValue }>; repeatability: { status: "unknown"; rawValue: null } }>;
    missionCategoryPreviews: Array<{ sourceRowId: string; missionCategoryId: string; status: "partial"; items: Array<{ slot: number; item: EventsE5ItemReference }>; missing: ["quantity", "condition", "repeatability"] }>;
    budokai: { missions: Array<{ missionId: string; budokaiId: string; rootStatus: "supported" | "unknown"; rawMissionType: string; targetValue: number; rewards: Array<{ sourceRowId: string; value: EventsE5RewardValue }> }>; rankingGiftSets: Array<{ giftSetId: string; budokaiId: string; rootStatus: "supported" | "unknown"; rawOrder: number; rawRanking: string; rewards: Array<{ sourceRowId: string; value: EventsE5RewardValue }> }>; boxRankings: Array<{ boxRankingId: string; budokaiId: string; previousBudokaiId: string | null; previousBoxRankingId: string | null; rawLimits: { playerMaxCount: number; boxMaxCount: number }; availabilityHint: { startAt: string; endAt: string; collectingEndAt: string; boundary: "database_embedded_schedule_hint_not_server_current_availability" }; ranges: Array<{ rangeId: string; rawStartValue: number; rawEndValue: number; rewards: Array<{ sourceRowId: string; value: EventsE5RewardValue }> }> }>; orphanBoxRewardRanges: Array<{ rangeId: string; boxRankingIdRaw: string; rawStartValue: number; rawEndValue: number; rootStatus: "unknown"; rewards: Array<{ sourceRowId: string; value: EventsE5RewardValue }> }> };
    rmbattleMissions: Array<{ missionId: string; rmbattleId: string; rawType: string; targetValue: number; conditionsJson: string | null; rewards: Array<{ sourceRowId: string; value: EventsE5RewardValue }>; rootStatus: "partial" }>;
    costAndRequirementReferences: { questLevels: Array<{ levelId: string; act: number; eventKeyCount: number }>; zBattleCheckpoints: Array<{ stageId: string; checkpointId: string; level: number; act: number; eventKeyCount: number }>; originBattles: Array<{ battleId: string; act: number }>; areaRequirementSourceRowIds: string[]; source: "events-e2-topology" };
    opaqueRewardBindings: { questMapRewardGroups: Array<{ mapId: string; questId: string; rewardGroupId: string | null; status: "partial"; missing: "reward_group_target_table" }>; originBattleRewardSets: Array<{ battleId: string; rewardSetId: string | null; status: "partial"; missing: "reward_set_target_table" }> };
    unboundRewardSurfaces: Array<{ table: string; rowCount: number; status: "unknown"; missing: "event_or_stage_consumer" }>;
}

export interface EventsE5Coverage {
    schemaVersion: 1;
    questBossDropCount: number;
    questDropPreviewCount: number;
    zFirstRangeCount: number;
    zFirstRewardCount: number;
    zNormalCheckpointCount: number;
    zNormalRewardCount: number;
    linkedMissionCount: number;
    linkedMissionRewardCount: number;
    budokaiMissionRewardCount: number;
    budokaiRankingGiftCount: number;
    budokaiBoxRewardCount: number;
    rmbattleMissionRewardCount: number;
    supportedCatalogTypeCount: number;
    unknownCatalogTypeCount: number;
    supportedItemReferenceCount: number;
    unknownItemReferenceCount: number;
    historicalUnknownRootCount: number;
    danglingIdCount: number;
}

export interface EventsE5Validation { schemaVersion: 1; valid: boolean; exactProjection: boolean; losslessRewardRowCount: number; losslessPreviewItemCount: number; failures: string[] }
export interface EventsE5Manifest { schemaVersion: 1; contractVersion: "0.6.0"; generatedAt: string; generatedAtPolicy: "pinned_to_source_snapshot_for_reproducible_bytes"; sourceSnapshotVersion: string; fileName: "events-e5-rewards.json"; compression: "none"; sha256: string; sizeBytes: number; sourceDatabaseSha256: string; sourceE4Sha256: string; sourceE2Sha256: string; sourceE1Sha256: string; coverage: { fileName: "events-e5-coverage.json"; sha256: string; sizeBytes: number }; validation: { fileName: "events-e5-validation.json"; sha256: string; sizeBytes: number } }
