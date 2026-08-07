"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateEventsE2Dataset = void 0;
const events_e2_builder_1 = require("./events-e2-builder");
function validateEventsE2Dataset(dataset, observation, e1, expected) {
    const failures = [], budokaiRootCount = e1.catalog.filter(value => value.identity.kind === "budokai").length, rmbattleRootCount = e1.opaqueRootFamilies.find(value => value.family === "rmbattle")?.identities.length ?? 0;
    if (dataset.schemaVersion !== 1 || dataset.contract !== "dokkan-events-database-first-topology" || dataset.contractVersion !== "0.3.0" || dataset.generatedAtPolicy !== "pinned_to_source_snapshot_for_reproducible_bytes")
        failures.push("contract identity");
    const rebuilt = (0, events_e2_builder_1.buildEventsE2Dataset)({ observation, generatedAt: dataset.generatedAt, sourceSnapshotVersion: dataset.sourceSnapshotVersion, sourceDatabaseSha256: dataset.sourceDatabaseSha256, sourceE1Sha256: dataset.sourceE1.sha256, budokaiRootCount, rmbattleRootCount }), exactProjection = JSON.stringify(dataset) === JSON.stringify(rebuilt);
    if (!exactProjection)
        failures.push("exact source projection");
    if (expected && (dataset.generatedAt !== expected.generatedAt || dataset.sourceSnapshotVersion !== expected.sourceSnapshotVersion || dataset.sourceDatabaseSha256 !== expected.sourceDatabaseSha256 || dataset.sourceE1.sha256 !== expected.sourceE1Sha256))
        failures.push("source lineage");
    const visit = (value) => typeof value === "number" ? Number.isFinite(value) : Array.isArray(value) ? value.every(visit) : value !== null && typeof value === "object" ? Object.values(value).every(visit) : true;
    if (!visit(dataset))
        failures.push("non-finite numeric value");
    const areaIds = new Set(e1.catalog.filter(value => value.identity.kind === "area").map(value => value.identity.id)), zIds = new Set(e1.catalog.filter(value => value.identity.kind === "z_battle_stage").map(value => value.identity.id)), sdMapIds = new Set(e1.catalog.filter(value => value.identity.kind === "sd_map").map(value => value.identity.id));
    const questIds = new Set(dataset.questStages.map(value => value.identity.id));
    if (questIds.size !== dataset.questStages.length)
        failures.push("duplicate quest stage");
    for (const stage of dataset.questStages) {
        if (!areaIds.has(stage.areaId))
            failures.push(`dangling area ${stage.identity.id}`);
        if (stage.previousStageId !== null && !questIds.has(stage.previousStageId))
            failures.push(`dangling previous quest ${stage.identity.id}`);
        if (stage.levels.length === 0)
            failures.push(`quest without level ${stage.identity.id}`);
    }
    const questLevelCount = dataset.questStages.reduce((sum, value) => sum + value.levels.length, 0);
    if (questLevelCount + dataset.unboundQuestLevels.length !== observation.maps.length)
        failures.push("map accounting");
    if (new Set(dataset.questStages.flatMap(value => value.levels).concat(dataset.unboundQuestLevels).map(value => value.identity.id)).size !== observation.maps.length)
        failures.push("map identity");
    if (dataset.areaRequirements.some(value => !areaIds.has(value.areaId)))
        failures.push("dangling area requirement");
    for (const value of dataset.areaRequirements)
        try {
            JSON.parse(value.conditionsRawJson);
        }
        catch {
            failures.push(`area requirement json ${value.sourceRowId}`);
        }
    const zStageIds = new Set(dataset.zBattleTopologies.map(value => value.identity.stageId));
    if (zStageIds.size !== dataset.zBattleTopologies.length || zStageIds.size !== zIds.size || [...zIds].some(value => !zStageIds.has(value)))
        failures.push("z stage identity");
    if (dataset.zBattleTopologies.reduce((sum, value) => sum + value.enemyRanges.length, 0) !== observation.zBattleEnemyRanges.length || dataset.zBattleTopologies.reduce((sum, value) => sum + value.checkpoints.length, 0) !== observation.zBattleCheckPoints.length || dataset.zBattleTopologies.reduce((sum, value) => sum + value.rewardLevelAnchors.length, 0) !== observation.zBattleRewardLevelAnchors.length)
        failures.push("z topology accounting");
    for (const value of dataset.zBattleTopologies)
        try {
            JSON.parse(value.unlockConditions.rawJson);
        }
        catch {
            failures.push(`z unlock json ${value.identity.stageId}`);
        }
    const sdIds = new Set(dataset.sdTopologies.map(value => value.identity.mapId));
    if (sdIds.size !== sdMapIds.size || [...sdMapIds].some(value => !sdIds.has(value)))
        failures.push("sd map identity");
    const sdArenaCount = dataset.sdTopologies.reduce((sum, value) => sum + value.arenas.length, 0), sdStageCount = dataset.sdTopologies.reduce((sum, value) => sum + value.arenas.reduce((inner, arena) => inner + arena.stages.length, 0), 0);
    if (sdArenaCount !== observation.sdArenas.length || sdStageCount !== observation.sdStages.length)
        failures.push("sd topology accounting");
    for (const battle of dataset.originBattles)
        if (battle.rules.unlockMissionIdsRaw !== null)
            try {
                JSON.parse(battle.rules.unlockMissionIdsRaw);
            }
            catch {
                failures.push(`origin unlock json ${battle.identity.id}`);
            }
    return { schemaVersion: 1, valid: failures.length === 0, exactProjection, questStageCount: dataset.questStages.length, questLevelCount, zBattleStageCount: dataset.zBattleTopologies.length, sdStageCount, failures };
}
exports.validateEventsE2Dataset = validateEventsE2Dataset;
//# sourceMappingURL=events-e2-validator.js.map