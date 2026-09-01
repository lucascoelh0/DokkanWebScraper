import { GameDbRow, normalizeDbId } from "./game-db-source";

export type MissionStageRelation = "direct-stage-condition" | "transitive-mission-condition" | "mission-owner";

export interface MissionStageResolution {
    stageIds: Map<string, MissionStageRelation>,
    areaIds: Map<string, MissionStageRelation>,
    zBattleIds: Map<string, MissionStageRelation>,
    missionIds: Set<string>,
}

function numericId(value: string | undefined, label: string): string {
    const normalized = normalizeDbId(value);
    if (!normalized || !/^\d+$/.test(normalized)) throw new Error(`${label} is missing a numeric ID`);
    return normalized;
}

function optionalNumericId(value: string | undefined, label: string): string | undefined {
    if (!value?.trim()) return undefined;
    return numericId(value, label);
}

function jsonObject(raw: string | undefined, label: string): Record<string, unknown> {
    if (!raw?.trim()) return {};
    let value: unknown;
    try {
        value = JSON.parse(raw);
    } catch {
        throw new Error(`${label} contains invalid JSON`);
    }
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be a JSON object`);
    return value as Record<string, unknown>;
}

function jsonIds(value: unknown, label: string): string[] {
    if (value === undefined || value === null) return [];
    if (!Array.isArray(value)) throw new Error(`${label} must be an array`);
    return value.map(item => numericId(item === null || item === undefined ? undefined : String(item), label));
}

export function createMissionStageResolver(rows: GameDbRow[]): (missionId: string) => MissionStageResolution {
    const missions = new Map<string, GameDbRow>();
    for (const row of rows) {
        const missionId = numericId(row.id, "Mission row");
        if (missions.has(missionId)) throw new Error(`Duplicate mission ${missionId}`);
        missions.set(missionId, row);
    }
    const cache = new Map<string, MissionStageResolution>();

    const resolve = (missionId: string, stack = new Set<string>()): MissionStageResolution => {
        const normalizedMissionId = numericId(missionId, "Mission relation");
        const cached = cache.get(normalizedMissionId);
        if (cached) return cached;
        if (stack.has(normalizedMissionId)) throw new Error(`Mission dependency cycle at ${normalizedMissionId}`);
        const mission = missions.get(normalizedMissionId);
        if (!mission) throw new Error(`Stage relation references missing mission ${normalizedMissionId}`);

        const conditions = jsonObject(mission.conditions, `Mission ${normalizedMissionId} conditions`);
        const stageIds = new Map<string, MissionStageRelation>();
        for (const stageId of jsonIds(conditions.sugoroku_map_ids, `Mission ${normalizedMissionId} sugoroku_map_ids`)) {
            stageIds.set(stageId, "direct-stage-condition");
        }
        const areaIds = new Map<string, MissionStageRelation>();
        const areaId = optionalNumericId(mission.area_id, `Mission ${normalizedMissionId} area_id`);
        if (areaId) areaIds.set(areaId, "mission-owner");
        const zBattleIds = new Map<string, MissionStageRelation>();
        const zBattleId = optionalNumericId(mission.z_battle_stage_id, `Mission ${normalizedMissionId} z_battle_stage_id`);
        if (zBattleId) zBattleIds.set(zBattleId, "mission-owner");
        const missionIds = new Set<string>([normalizedMissionId]);

        const nextStack = new Set(stack).add(normalizedMissionId);
        for (const dependencyId of jsonIds(conditions.mission_ids, `Mission ${normalizedMissionId} mission_ids`)) {
            const dependency = resolve(dependencyId, nextStack);
            for (const stageId of dependency.stageIds.keys()) if (!stageIds.has(stageId)) stageIds.set(stageId, "transitive-mission-condition");
            for (const nestedAreaId of dependency.areaIds.keys()) if (!areaIds.has(nestedAreaId)) areaIds.set(nestedAreaId, "transitive-mission-condition");
            for (const nestedZBattleId of dependency.zBattleIds.keys()) if (!zBattleIds.has(nestedZBattleId)) zBattleIds.set(nestedZBattleId, "transitive-mission-condition");
            for (const nestedMissionId of dependency.missionIds) missionIds.add(nestedMissionId);
        }

        const result = { stageIds, areaIds, zBattleIds, missionIds };
        cache.set(normalizedMissionId, result);
        return result;
    };
    return missionId => resolve(missionId);
}
