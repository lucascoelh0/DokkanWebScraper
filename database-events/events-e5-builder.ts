import { EventsE1Dataset } from "./events-e1-contract";
import { EventsE2Dataset } from "./events-e2-contract";
import { EventsE3RawRow } from "./events-e3-contract";
import { EventsE5Coverage, EventsE5Dataset, EventsE5ItemReference, EventsE5Observation, EventsE5RewardValue } from "./events-e5-contract";

const str = (value: unknown) => String(value);
const nullableId = (value: unknown) => value === null ? null : str(value);
const nullableString = (value: unknown) => value === null ? null : str(value);
const num = (value: unknown) => Number(value);
const group = (rows: EventsE3RawRow[], column: string) => { const result = new Map<string, EventsE3RawRow[]>(); for (const row of rows) { const key = str(row[column]); result.set(key, [...(result.get(key) ?? []), row]); } return result; };

function itemResolver(observation: EventsE5Observation) {
    const targets = new Map(observation.itemCatalogTargets.map(value => [value.rawItemType, value]));
    const joined = new Map(observation.itemCatalogTargets.map(value => [value.rawItemType, new Set(value.joinedIds.map(str))]));
    return (rawTypeValue: unknown, itemIdValue: unknown): EventsE5ItemReference => {
        const rawType = str(rawTypeValue), itemId = str(itemIdValue), target = targets.get(rawType);
        return { rawType, itemId, catalogJoin: target?.targetKind && joined.get(rawType)?.has(itemId) ? { status: "supported", targetKind: target.targetKind, targetId: itemId } : { status: "unknown", missing: "catalog_target" } };
    };
}

function rewardValue(row: EventsE3RawRow, resolveItem: ReturnType<typeof itemResolver>): EventsE5RewardValue {
    return { item: resolveItem(row.item_type, row.item_id), quantity: row.quantity === undefined || row.quantity === null ? null : num(row.quantity), cardExpInit: row.card_exp_init === undefined || row.card_exp_init === null ? null : num(row.card_exp_init), chance: { status: "unknown", rawValue: null } };
}

function previewItems(row: EventsE3RawRow, maximum: number, resolveItem: ReturnType<typeof itemResolver>) {
    const result: Array<{ slot: number; item: EventsE5ItemReference }> = [];
    for (let index = 1; index <= maximum; index += 1) if (row[`item${index}_type`] !== null) result.push({ slot: index, item: resolveItem(row[`item${index}_type`], row[`item${index}_id`]) });
    return result;
}

function sameIdSet(left: Array<number | string>, right: Array<number | string>) {
    const leftSet = new Set(left.map(str)), rightSet = new Set(right.map(str));
    return leftSet.size === rightSet.size && [...leftSet].every(value => rightSet.has(value));
}

export function buildEventsE5Dataset(options: { observation: EventsE5Observation; e2: EventsE2Dataset; e1: EventsE1Dataset; generatedAt: string; sourceSnapshotVersion: string; sourceDatabaseSha256: string; sourceE4Sha256: string; sourceE2Sha256: string; sourceE1Sha256: string }): EventsE5Dataset {
    const { observation: o, e2, e1 } = options, resolveItem = itemResolver(o);
    const budokaiIds = new Set(e1.catalog.filter(value => value.identity.kind === "budokai").map(value => value.identity.id));
    const firstRewards = group(o.zFirstRewards, "z_battle_first_reward_set_id"), normalRewards = group(o.zNormalRewards, "z_battle_normal_reward_table_id"), missionRewards = group(o.linkedMissionRewards, "mission_id"), budokaiMissionRewards = group(o.budokaiMissionRewards, "budokai_mission_id"), rankingGifts = group(o.budokaiRankingGifts, "budokai_ranking_gift_set_id"), boxRanges = group(o.budokaiBoxRewardRanges, "budokai_box_ranking_id"), boxRewards = group(o.budokaiBoxRewards, "budokai_box_ranking_reward_range_id"), rmbattleRewards = group(o.rmbattleMissionRewards, "rmbattle_mission_id");
    const mapReward = (row: EventsE3RawRow) => ({ sourceRowId: str(row.id), value: rewardValue(row, resolveItem) });
    return {
        schemaVersion: 1, contract: "dokkan-events-database-first-rewards", contractVersion: "0.6.0", generatedAt: options.generatedAt, generatedAtPolicy: "pinned_to_source_snapshot_for_reproducible_bytes", sourceSnapshotVersion: options.sourceSnapshotVersion, sourceDatabaseSha256: options.sourceDatabaseSha256,
        sourceE4: { contractVersion: "0.5.0", sha256: options.sourceE4Sha256 }, sourceE2: { contractVersion: "0.3.0", sha256: options.sourceE2Sha256 }, sourceE1: { contractVersion: "0.2.0", sha256: options.sourceE1Sha256 },
        itemCatalogBindings: o.itemCatalogTargets.map(value => ({ rawItemType: value.rawItemType, status: value.targetKind !== null && sameIdSet(value.referencedIds, value.joinedIds) ? "supported" : "unknown", targetKind: value.targetKind, targetTable: value.targetTable, referencedIdCount: new Set(value.referencedIds.map(str)).size, joinedIdCount: new Set(value.joinedIds.map(str)).size })),
        questBossDrops: o.bossDrops.map(row => ({ identity: { kind: "quest_boss_drop", id: str(row.id) }, mapId: str(row.sugoroku_map_id), questId: str(row.quest_id), rawDropType: num(row.drop_type), reward: rewardValue(row, resolveItem), repeatability: { status: "unknown", rawValue: null }, condition: { status: "partial", boundary: "map_and_quest_binding_supported_drop_type_semantics_unknown" } })),
        questDropPreviews: o.questDropPreviews.map(row => ({ identity: { kind: "quest_drop_preview", id: str(row.id) }, questId: str(row.quest_id), rawDifficultiesJson: str(row.difficulties), status: "partial", items: previewItems(row, 6, resolveItem), missing: ["quantity", "chance", "drop_condition", "repeatability"] })),
        zBattleFirstRewardAnchors: o.zFirstRewardRanges.map(row => ({ rangeId: str(row.id), stageId: str(row.z_battle_stage_id), level: num(row.level), rewardSetId: str(row.z_battle_first_reward_set_id), mainRewardIdRaw: nullableId(row.main_reward_id), repeatability: { status: "partial", sourceFamily: "z_battle_first_reward", boundary: "first_reward_grouping_supported_runtime_claim_frequency_unverified" } })),
        zBattleFirstRewardSets: [...firstRewards].sort((a, b) => Number(a[0]) - Number(b[0])).map(([rewardSetId, rows]) => ({ rewardSetId, rewards: rows.map(mapReward) })),
        zBattleNormalRewardGroups: o.zRewardCheckpoints.map(row => ({ checkpointId: str(row.id), stageId: str(row.z_battle_stage_id), level: num(row.level), rewardTableGroupId: nullableId(row.z_battle_normal_reward_table_group_id), mainRewardIdRaw: nullableId(row.main_reward_id), repeatability: { status: "unknown", rawValue: null } })),
        zBattleNormalRewardTables: o.zNormalRewardTables.map(table => ({ tableId: str(table.id), rewardTableGroupId: str(table.z_battle_normal_reward_table_group_id), rewards: (normalRewards.get(str(table.id)) ?? []).map(mapReward) })),
        linkedEventMissions: o.linkedMissions.map(row => ({ identity: { kind: "mission", id: str(row.id) }, rawType: str(row.type), missionCategoryId: str(row.mission_category_id), targets: { areaId: nullableId(row.area_id), zBattleStageId: nullableId(row.z_battle_stage_id), originEpisodeId: nullableId(row.origin_episode_id), originBattleId: nullableId(row.origin_battle_id) }, rawRequirements: { targetValue: num(row.target_value), displayTargetValue: num(row.display_target_value), target100Value: row.target_100_value === null ? null : num(row.target_100_value), conditionsJson: nullableString(row.conditions), linkTo: nullableString(row.link_to) }, availabilityHint: { startAt: nullableString(row.start_at), endAt: nullableString(row.end_at), endAtHidden: nullableString(row.end_at_hidden), boundary: "database_embedded_schedule_hint_not_server_current_availability" }, rewards: (missionRewards.get(str(row.id)) ?? []).map(mapReward), repeatability: { status: "unknown", rawValue: null } })),
        missionCategoryPreviews: o.linkedMissionCategoryPreviews.map(row => ({ sourceRowId: str(row.id), missionCategoryId: str(row.mission_category_id), status: "partial", items: previewItems(row, 4, resolveItem), missing: ["quantity", "condition", "repeatability"] })),
        budokai: {
            missions: o.budokaiMissions.map(row => ({ missionId: str(row.id), budokaiId: str(row.budokai_id), rootStatus: budokaiIds.has(str(row.budokai_id)) ? "supported" : "unknown", rawMissionType: str(row.mission_type), targetValue: num(row.target_value), rewards: (budokaiMissionRewards.get(str(row.id)) ?? []).map(mapReward) })),
            rankingGiftSets: o.budokaiRankingGiftSets.map(row => ({ giftSetId: str(row.id), budokaiId: str(row.budokai_id), rootStatus: budokaiIds.has(str(row.budokai_id)) ? "supported" : "unknown", rawOrder: num(row.order), rawRanking: str(row.ranking), rewards: (rankingGifts.get(str(row.id)) ?? []).map(mapReward) })),
            boxRankings: o.budokaiBoxRankings.map(row => ({ boxRankingId: str(row.id), budokaiId: str(row.budokai_id), previousBudokaiId: nullableId(row.prev_budokai_id), previousBoxRankingId: nullableId(row.prev_budokai_box_ranking_id), rawLimits: { playerMaxCount: num(row.player_max_count), boxMaxCount: num(row.box_max_count) }, availabilityHint: { startAt: str(row.start_at), endAt: str(row.end_at), collectingEndAt: str(row.collecting_end_at), boundary: "database_embedded_schedule_hint_not_server_current_availability" }, ranges: (boxRanges.get(str(row.id)) ?? []).map(range => ({ rangeId: str(range.id), rawStartValue: num(range.start_value), rawEndValue: num(range.end_value), rewards: (boxRewards.get(str(range.id)) ?? []).map(mapReward) })) })),
            orphanBoxRewardRanges: o.budokaiBoxRewardRanges.filter(row => !o.budokaiBoxRankings.some(ranking => str(ranking.id) === str(row.budokai_box_ranking_id))).map(row => ({ rangeId: str(row.id), boxRankingIdRaw: str(row.budokai_box_ranking_id), rawStartValue: num(row.start_value), rawEndValue: num(row.end_value), rootStatus: "unknown", rewards: (boxRewards.get(str(row.id)) ?? []).map(mapReward) })),
        },
        rmbattleMissions: o.rmbattleMissions.map(row => ({ missionId: str(row.id), rmbattleId: str(row.rmbattle_id), rawType: str(row.type), targetValue: num(row.target_value), conditionsJson: nullableString(row.conditions), rewards: (rmbattleRewards.get(str(row.id)) ?? []).map(mapReward), rootStatus: "partial" })),
        costAndRequirementReferences: { questLevels: e2.questStages.flatMap(stage => stage.levels.map(level => ({ levelId: level.identity.id, act: level.costs.act, eventKeyCount: level.costs.eventKeyCount }))), zBattleCheckpoints: e2.zBattleTopologies.flatMap(stage => stage.checkpoints.map(value => ({ stageId: stage.identity.stageId, checkpointId: value.sourceRowId, level: value.level, act: value.act, eventKeyCount: value.eventKeyCount }))), originBattles: e2.originBattles.map(value => ({ battleId: value.identity.id, act: value.costsAndOutcomes.act })), areaRequirementSourceRowIds: e2.areaRequirements.map(value => value.sourceRowId), source: "events-e2-topology" },
        opaqueRewardBindings: { questMapRewardGroups: o.opaqueRewardBindings.questMapRewardGroups.map(row => ({ mapId: str(row.id), questId: str(row.quest_id), rewardGroupId: nullableId(row.sugoroku_map_reward_group_id), status: "partial", missing: "reward_group_target_table" })), originBattleRewardSets: o.opaqueRewardBindings.originBattleRewardSets.map(row => ({ battleId: str(row.id), rewardSetId: nullableId(row.origin_battle_reward_set_id), status: "partial", missing: "reward_set_target_table" })) },
        unboundRewardSurfaces: o.unboundRewardSurfaces.map(value => ({ table: value.table, rowCount: value.rowCount, status: "unknown", missing: "event_or_stage_consumer" })),
    };
}

function allItemReferences(dataset: EventsE5Dataset): EventsE5ItemReference[] {
    return [
        ...dataset.questBossDrops.map(value => value.reward.item), ...dataset.questDropPreviews.flatMap(value => value.items.map(slot => slot.item)),
        ...dataset.zBattleFirstRewardSets.flatMap(value => value.rewards.map(reward => reward.value.item)), ...dataset.zBattleNormalRewardTables.flatMap(value => value.rewards.map(reward => reward.value.item)),
        ...dataset.linkedEventMissions.flatMap(value => value.rewards.map(reward => reward.value.item)), ...dataset.missionCategoryPreviews.flatMap(value => value.items.map(slot => slot.item)),
        ...dataset.budokai.missions.flatMap(value => value.rewards.map(reward => reward.value.item)), ...dataset.budokai.rankingGiftSets.flatMap(value => value.rewards.map(reward => reward.value.item)), ...dataset.budokai.boxRankings.flatMap(value => value.ranges.flatMap(range => range.rewards.map(reward => reward.value.item))), ...dataset.budokai.orphanBoxRewardRanges.flatMap(value => value.rewards.map(reward => reward.value.item)),
        ...dataset.rmbattleMissions.flatMap(value => value.rewards.map(reward => reward.value.item)),
    ];
}

export function buildEventsE5Coverage(dataset: EventsE5Dataset, e2: EventsE2Dataset, e1: EventsE1Dataset, observation: EventsE5Observation): EventsE5Coverage {
    const questIds = new Set(e2.questStages.map(value => value.identity.id)), mapIds = new Set(e2.questStages.flatMap(value => value.levels.map(level => level.identity.id))), mapQuestPairs = new Set(e2.questStages.flatMap(stage => stage.levels.map(level => `${level.identity.id}:${stage.identity.id}`))), zIds = new Set(e2.zBattleTopologies.map(value => value.identity.stageId)), originBattleIds = new Set(e2.originBattles.map(value => value.identity.id)), areaIds = new Set(e1.catalog.filter(value => value.identity.kind === "area").map(value => value.identity.id)), originEpisodeIds = new Set(e1.catalog.filter(value => value.identity.kind === "origin_episode").map(value => value.identity.id)), budokaiIds = new Set(e1.catalog.filter(value => value.identity.kind === "budokai").map(value => value.identity.id)), rmbattleIds = new Set(e1.opaqueRootFamilies.flatMap(value => value.identities));
    const itemReferences = allItemReferences(dataset);
    let danglingIdCount = 0;
    for (const value of dataset.questBossDrops) danglingIdCount += Number(!mapIds.has(value.mapId)) + Number(!questIds.has(value.questId)) + Number(mapIds.has(value.mapId) && questIds.has(value.questId) && !mapQuestPairs.has(`${value.mapId}:${value.questId}`));
    for (const value of dataset.questDropPreviews) danglingIdCount += Number(!questIds.has(value.questId));
    for (const value of dataset.zBattleFirstRewardAnchors) danglingIdCount += Number(!zIds.has(value.stageId));
    for (const value of dataset.zBattleNormalRewardGroups) danglingIdCount += Number(!zIds.has(value.stageId));
    for (const value of dataset.linkedEventMissions) { const targets = value.targets; danglingIdCount += Number(targets.areaId !== null && !areaIds.has(targets.areaId)) + Number(targets.zBattleStageId !== null && !zIds.has(targets.zBattleStageId)) + Number(targets.originEpisodeId !== null && !originEpisodeIds.has(targets.originEpisodeId)) + Number(targets.originBattleId !== null && !originBattleIds.has(targets.originBattleId)); }
    for (const value of dataset.budokai.missions) danglingIdCount += Number(value.rootStatus === "supported" && !budokaiIds.has(value.budokaiId));
    for (const value of dataset.budokai.rankingGiftSets) danglingIdCount += Number(value.rootStatus === "supported" && !budokaiIds.has(value.budokaiId));
    for (const value of dataset.budokai.boxRankings) danglingIdCount += Number(!budokaiIds.has(value.budokaiId));
    for (const value of dataset.rmbattleMissions) danglingIdCount += Number(!rmbattleIds.has(value.rmbattleId));
    for (const value of observation.itemCatalogTargets) if (value.targetKind !== null) { const referenced = new Set(value.referencedIds.map(str)), joined = new Set(value.joinedIds.map(str)); danglingIdCount += [...referenced].filter(id => !joined.has(id)).length + [...joined].filter(id => !referenced.has(id)).length; }
    const supported = itemReferences.filter(value => value.catalogJoin.status === "supported").length;
    return { schemaVersion: 1, questBossDropCount: dataset.questBossDrops.length, questDropPreviewCount: dataset.questDropPreviews.length, zFirstRangeCount: dataset.zBattleFirstRewardAnchors.length, zFirstRewardCount: dataset.zBattleFirstRewardSets.reduce((sum, value) => sum + value.rewards.length, 0), zNormalCheckpointCount: dataset.zBattleNormalRewardGroups.length, zNormalRewardCount: dataset.zBattleNormalRewardTables.reduce((sum, value) => sum + value.rewards.length, 0), linkedMissionCount: dataset.linkedEventMissions.length, linkedMissionRewardCount: dataset.linkedEventMissions.reduce((sum, value) => sum + value.rewards.length, 0), budokaiMissionRewardCount: dataset.budokai.missions.reduce((sum, value) => sum + value.rewards.length, 0), budokaiRankingGiftCount: dataset.budokai.rankingGiftSets.reduce((sum, value) => sum + value.rewards.length, 0), budokaiBoxRewardCount: dataset.budokai.boxRankings.reduce((sum, value) => sum + value.ranges.reduce((rangeSum, range) => rangeSum + range.rewards.length, 0), 0) + dataset.budokai.orphanBoxRewardRanges.reduce((sum, value) => sum + value.rewards.length, 0), rmbattleMissionRewardCount: dataset.rmbattleMissions.reduce((sum, value) => sum + value.rewards.length, 0), supportedCatalogTypeCount: dataset.itemCatalogBindings.filter(value => value.status === "supported").length, unknownCatalogTypeCount: dataset.itemCatalogBindings.filter(value => value.status === "unknown").length, supportedItemReferenceCount: supported, unknownItemReferenceCount: itemReferences.length - supported, historicalUnknownRootCount: dataset.budokai.missions.filter(value => value.rootStatus === "unknown").length + dataset.budokai.rankingGiftSets.filter(value => value.rootStatus === "unknown").length + dataset.budokai.orphanBoxRewardRanges.length, danglingIdCount };
}

export const countEventsE5ItemReferences = allItemReferences;
