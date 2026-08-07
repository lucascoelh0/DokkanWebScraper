import { EventsE1Dataset } from "./events-e1-contract";
import { EventsE2Dataset } from "./events-e2-contract";
import { buildEventsE5Coverage, buildEventsE5Dataset, countEventsE5ItemReferences } from "./events-e5-builder";
import { EventsE5Dataset, EventsE5Observation, EventsE5Validation } from "./events-e5-contract";

const str = (value: unknown) => String(value);

export function validateEventsE5Dataset(dataset: EventsE5Dataset, observation: EventsE5Observation, e2: EventsE2Dataset, e1: EventsE1Dataset, expected?: { generatedAt: string; sourceSnapshotVersion: string; sourceDatabaseSha256: string; sourceE4Sha256: string; sourceE2Sha256: string; sourceE1Sha256: string }): EventsE5Validation {
    const failures: string[] = [];
    if (dataset.schemaVersion !== 1 || dataset.contract !== "dokkan-events-database-first-rewards" || dataset.contractVersion !== "0.6.0" || dataset.generatedAtPolicy !== "pinned_to_source_snapshot_for_reproducible_bytes") failures.push("contract identity");
    const rebuilt = buildEventsE5Dataset({ observation, e2, e1, generatedAt: dataset.generatedAt, sourceSnapshotVersion: dataset.sourceSnapshotVersion, sourceDatabaseSha256: dataset.sourceDatabaseSha256, sourceE4Sha256: dataset.sourceE4.sha256, sourceE2Sha256: dataset.sourceE2.sha256, sourceE1Sha256: dataset.sourceE1.sha256 });
    const exactProjection = JSON.stringify(dataset) === JSON.stringify(rebuilt); if (!exactProjection) failures.push("exact source projection");
    if (expected && (dataset.generatedAt !== expected.generatedAt || dataset.sourceSnapshotVersion !== expected.sourceSnapshotVersion || dataset.sourceDatabaseSha256 !== expected.sourceDatabaseSha256 || dataset.sourceE4.sha256 !== expected.sourceE4Sha256 || dataset.sourceE2.sha256 !== expected.sourceE2Sha256 || dataset.sourceE1.sha256 !== expected.sourceE1Sha256)) failures.push("source lineage");
    const finite = (value: unknown): boolean => typeof value === "number" ? Number.isFinite(value) : Array.isArray(value) ? value.every(finite) : value !== null && typeof value === "object" ? Object.values(value).every(finite) : true; if (!finite(dataset)) failures.push("non-finite numeric value");
    const coverage = buildEventsE5Coverage(dataset, e2, e1, observation); if (coverage.danglingIdCount !== 0) failures.push(`dangling ids ${coverage.danglingIdCount}`);
    const projectedRewardIds = [
        ...dataset.questBossDrops.map(value => `boss:${value.identity.id}`),
        ...dataset.zBattleFirstRewardSets.flatMap(value => value.rewards.map(reward => `z_first:${reward.sourceRowId}`)),
        ...dataset.zBattleNormalRewardTables.flatMap(value => value.rewards.map(reward => `z_normal:${reward.sourceRowId}`)),
        ...dataset.linkedEventMissions.flatMap(value => value.rewards.map(reward => `mission:${reward.sourceRowId}`)),
        ...dataset.budokai.missions.flatMap(value => value.rewards.map(reward => `budokai_mission:${reward.sourceRowId}`)),
        ...dataset.budokai.rankingGiftSets.flatMap(value => value.rewards.map(reward => `budokai_ranking:${reward.sourceRowId}`)),
        ...dataset.budokai.boxRankings.flatMap(value => value.ranges.flatMap(range => range.rewards.map(reward => `budokai_box:${reward.sourceRowId}`))),
        ...dataset.budokai.orphanBoxRewardRanges.flatMap(value => value.rewards.map(reward => `budokai_box:${reward.sourceRowId}`)),
        ...dataset.rmbattleMissions.flatMap(value => value.rewards.map(reward => `rmbattle:${reward.sourceRowId}`)),
    ];
    const sourceRewardIds = [
        ...observation.bossDrops.map(row => `boss:${str(row.id)}`), ...observation.zFirstRewards.map(row => `z_first:${str(row.id)}`), ...observation.zNormalRewards.map(row => `z_normal:${str(row.id)}`), ...observation.linkedMissionRewards.map(row => `mission:${str(row.id)}`),
        ...observation.budokaiMissionRewards.map(row => `budokai_mission:${str(row.id)}`), ...observation.budokaiRankingGifts.map(row => `budokai_ranking:${str(row.id)}`), ...observation.budokaiBoxRewards.map(row => `budokai_box:${str(row.id)}`), ...observation.rmbattleMissionRewards.map(row => `rmbattle:${str(row.id)}`),
    ];
    projectedRewardIds.sort(); sourceRewardIds.sort();
    if (JSON.stringify(projectedRewardIds) !== JSON.stringify(sourceRewardIds)) failures.push("lossless reward rows");
    if (new Set(projectedRewardIds).size !== projectedRewardIds.length) failures.push("duplicate reward source identity across families");
    const previewSourceCount = observation.questDropPreviews.reduce((sum, row) => sum + Array.from({ length: 6 }, (_, index) => row[`item${index + 1}_type`]).filter(value => value !== null).length, 0) + observation.linkedMissionCategoryPreviews.reduce((sum, row) => sum + Array.from({ length: 4 }, (_, index) => row[`item${index + 1}_type`]).filter(value => value !== null).length, 0);
    const previewProjectedCount = dataset.questDropPreviews.reduce((sum, value) => sum + value.items.length, 0) + dataset.missionCategoryPreviews.reduce((sum, value) => sum + value.items.length, 0);
    if (previewProjectedCount !== previewSourceCount) failures.push("lossless preview items");
    for (const value of dataset.questDropPreviews) if (new Set(value.items.map(slot => slot.slot)).size !== value.items.length || value.items.some(slot => slot.slot < 1 || slot.slot > 6)) failures.push(`quest preview slots ${value.identity.id}`);
    for (const value of dataset.missionCategoryPreviews) if (new Set(value.items.map(slot => slot.slot)).size !== value.items.length || value.items.some(slot => slot.slot < 1 || slot.slot > 4)) failures.push(`mission preview slots ${value.sourceRowId}`);
    const unique = (values: string[]) => new Set(values).size === values.length;
    if (!unique(dataset.questBossDrops.map(value => value.identity.id)) || !unique(dataset.zBattleFirstRewardAnchors.map(value => value.rangeId)) || !unique(dataset.zBattleFirstRewardSets.map(value => value.rewardSetId)) || !unique(dataset.zBattleNormalRewardTables.map(value => value.tableId)) || !unique(dataset.linkedEventMissions.map(value => value.identity.id))) failures.push("duplicate structural identity");
    for (const value of countEventsE5ItemReferences(dataset)) if (value.catalogJoin.status === "supported" && value.catalogJoin.targetId !== value.itemId) failures.push(`item target identity ${value.rawType}/${value.itemId}`);
    for (const value of dataset.questBossDrops) if (value.reward.quantity !== null || value.reward.chance.rawValue !== null || value.repeatability.status !== "unknown") failures.push(`boss drop inference ${value.identity.id}`);
    for (const value of [...dataset.questDropPreviews, ...dataset.missionCategoryPreviews]) if (value.status !== "partial") failures.push("preview semantic promotion");
    if (dataset.zBattleFirstRewardAnchors.some(value => value.repeatability.status !== "partial") || dataset.zBattleNormalRewardGroups.some(value => value.repeatability.status !== "unknown") || dataset.linkedEventMissions.some(value => value.repeatability.status !== "unknown")) failures.push("repeatability semantic promotion");
    if (dataset.unboundRewardSurfaces.some(value => value.status !== "unknown")) failures.push("unbound reward semantic promotion");
    const e2QuestCosts = e2.questStages.reduce((sum, stage) => sum + stage.levels.length, 0), e2ZCosts = e2.zBattleTopologies.reduce((sum, stage) => sum + stage.checkpoints.length, 0);
    if (dataset.costAndRequirementReferences.questLevels.length !== e2QuestCosts || dataset.costAndRequirementReferences.zBattleCheckpoints.length !== e2ZCosts || dataset.costAndRequirementReferences.originBattles.length !== e2.originBattles.length || dataset.costAndRequirementReferences.areaRequirementSourceRowIds.length !== e2.areaRequirements.length) failures.push("E2 cost and requirement accounting");
    return { schemaVersion: 1, valid: failures.length === 0, exactProjection, losslessRewardRowCount: sourceRewardIds.length, losslessPreviewItemCount: previewSourceCount, failures };
}
