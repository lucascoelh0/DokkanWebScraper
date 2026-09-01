"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createMissionStageResolver = void 0;
const game_db_source_1 = require("./game-db-source");
function numericId(value, label) {
    const normalized = (0, game_db_source_1.normalizeDbId)(value);
    if (!normalized || !/^\d+$/.test(normalized))
        throw new Error(`${label} is missing a numeric ID`);
    return normalized;
}
function optionalNumericId(value, label) {
    if (!value?.trim())
        return undefined;
    return numericId(value, label);
}
function jsonObject(raw, label) {
    if (!raw?.trim())
        return {};
    let value;
    try {
        value = JSON.parse(raw);
    }
    catch {
        throw new Error(`${label} contains invalid JSON`);
    }
    if (!value || typeof value !== "object" || Array.isArray(value))
        throw new Error(`${label} must be a JSON object`);
    return value;
}
function jsonIds(value, label) {
    if (value === undefined || value === null)
        return [];
    if (!Array.isArray(value))
        throw new Error(`${label} must be an array`);
    return value.map(item => numericId(item === null || item === undefined ? undefined : String(item), label));
}
function createMissionStageResolver(rows) {
    const missions = new Map();
    for (const row of rows) {
        const missionId = numericId(row.id, "Mission row");
        if (missions.has(missionId))
            throw new Error(`Duplicate mission ${missionId}`);
        missions.set(missionId, row);
    }
    const cache = new Map();
    const resolve = (missionId, stack = new Set()) => {
        const normalizedMissionId = numericId(missionId, "Mission relation");
        const cached = cache.get(normalizedMissionId);
        if (cached)
            return cached;
        if (stack.has(normalizedMissionId))
            throw new Error(`Mission dependency cycle at ${normalizedMissionId}`);
        const mission = missions.get(normalizedMissionId);
        if (!mission)
            throw new Error(`Stage relation references missing mission ${normalizedMissionId}`);
        const conditions = jsonObject(mission.conditions, `Mission ${normalizedMissionId} conditions`);
        const stageIds = new Map();
        for (const stageId of jsonIds(conditions.sugoroku_map_ids, `Mission ${normalizedMissionId} sugoroku_map_ids`)) {
            stageIds.set(stageId, "direct-stage-condition");
        }
        const areaIds = new Map();
        const areaId = optionalNumericId(mission.area_id, `Mission ${normalizedMissionId} area_id`);
        if (areaId)
            areaIds.set(areaId, "mission-owner");
        const zBattleIds = new Map();
        const zBattleId = optionalNumericId(mission.z_battle_stage_id, `Mission ${normalizedMissionId} z_battle_stage_id`);
        if (zBattleId)
            zBattleIds.set(zBattleId, "mission-owner");
        const missionIds = new Set([normalizedMissionId]);
        const nextStack = new Set(stack).add(normalizedMissionId);
        for (const dependencyId of jsonIds(conditions.mission_ids, `Mission ${normalizedMissionId} mission_ids`)) {
            const dependency = resolve(dependencyId, nextStack);
            for (const stageId of dependency.stageIds.keys())
                if (!stageIds.has(stageId))
                    stageIds.set(stageId, "transitive-mission-condition");
            for (const nestedAreaId of dependency.areaIds.keys())
                if (!areaIds.has(nestedAreaId))
                    areaIds.set(nestedAreaId, "transitive-mission-condition");
            for (const nestedZBattleId of dependency.zBattleIds.keys())
                if (!zBattleIds.has(nestedZBattleId))
                    zBattleIds.set(nestedZBattleId, "transitive-mission-condition");
            for (const nestedMissionId of dependency.missionIds)
                missionIds.add(nestedMissionId);
        }
        const result = { stageIds, areaIds, zBattleIds, missionIds };
        cache.set(normalizedMissionId, result);
        return result;
    };
    return missionId => resolve(missionId);
}
exports.createMissionStageResolver = createMissionStageResolver;
//# sourceMappingURL=game-db-mission-stage-relations.js.map