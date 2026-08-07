import { EventsE2Dataset } from "./events-e2-contract";
import { EventsE3Coverage, EventsE3Dataset, EventsE3Encounter, EventsE3Goldens, EventsE3Observation, EventsE3RawRow } from "./events-e3-contract";

const str = (value: unknown) => String(value);
const num = (row: EventsE3RawRow, key: string) => Number(row[key]);
const nullableId = (value: unknown) => value === null ? null : str(value);

function encounter(value: EventsE3Observation["questEncounters"][number], family: "quest" | "origin"): EventsE3Encounter {
    return {
        identity: { kind: family === "quest" ? "quest_level_encounter" : "origin_battle_encounter", sourceId: str(value.sourceId) },
        source: { table: family === "quest" ? "sugoroku_map_enemy_informations" : "origin_battle_enemy_informations", rowId: str(value.sourceId), columns: ["enemy_info"] },
        status: family === "quest" ? "supported" : "partial",
        displayTypeRaw: value.displayTypeRaw,
        battles: value.battles.map(battle => ({ ordinal: battle.position, rounds: battle.rounds.map(round => ({ ordinal: round.position, roundNoRaw: round.roundNoRaw, commentRaw: round.commentRaw, enemies: round.enemies.map(enemy => ({ ordinal: enemy.position, cardId: str(enemy.cardId), enemySkillIds: enemy.enemySkillIds.map(str), enemyRoundSkillSetId: nullableId(enemy.enemyRoundSkillSetId) })) })) })),
        semanticBoundary: { battleArrayOrder: "supported", roundArrayOrder: "supported", enemyArrayOrder: "supported", runtimeStats: "unknown" },
    };
}

function group<T extends EventsE3RawRow>(rows: T[], column: string): Map<string, T[]> {
    const result = new Map<string, T[]>();
    for (const row of rows) { const key = str(row[column]); result.set(key, [...(result.get(key) ?? []), row]); }
    return result;
}

export function buildEventsE3Dataset(options: { observation: EventsE3Observation; generatedAt: string; sourceSnapshotVersion: string; sourceDatabaseSha256: string; sourceE2Sha256: string }): EventsE3Dataset {
    const o = options.observation;
    const relations = group(o.referencedRoundSkillSetRelations, "enemy_round_skill_set_id"), cardEscalations = group(o.zBattleCardEscalations, "escalation_type"), skillEscalations = group(o.zBattleSkillEscalations, "escalation_type"), statusEscalations = group(o.zBattleStatusEscalations, "escalation_type");
    const statusTypeIds = [...statusEscalations.keys()].sort((a, b) => Number(a) - Number(b));
    return {
        schemaVersion: 1,
        contract: "dokkan-events-database-first-encounters",
        contractVersion: "0.4.0",
        generatedAt: options.generatedAt,
        generatedAtPolicy: "pinned_to_source_snapshot_for_reproducible_bytes",
        sourceSnapshotVersion: options.sourceSnapshotVersion,
        sourceDatabaseSha256: options.sourceDatabaseSha256,
        sourceE2: { contractVersion: "0.3.0", sha256: options.sourceE2Sha256 },
        questEncounters: o.questEncounters.map(value => encounter(value, "quest")),
        originEncounters: o.originEncounters.map(value => encounter(value, "origin")),
        cardReferences: o.referencedCards.map(row => ({
            identity: { kind: "card", id: str(row.id) }, characterId: str(row.character_id), cardUniqueInfoId: nullableId(row.card_unique_info_id), resourceId: str(row.resource_id),
            rawCatalogClassification: { rarity: num(row, "rarity"), element: num(row, "element"), maxLevel: num(row, "lv_max") },
            rawCatalogStats: { hpInitial: num(row, "hp_init"), hpMax: num(row, "hp_max"), attackInitial: num(row, "atk_init"), attackMax: num(row, "atk_max"), defenceInitial: num(row, "def_init"), defenceMax: num(row, "def_max") },
            enemyRuntimeApplication: { status: "unknown", warning: "card_catalog_stats_are_not_enemy_runtime_stats" }, source: { table: "cards", rowId: str(row.id) },
        })),
        characterReferences: o.referencedCharacters.map(row => ({ identity: { kind: "master_character", id: str(row.id) }, rawClassification: { race: num(row, "race"), sex: num(row, "sex"), size: num(row, "size") }, source: { table: "characters", rowId: str(row.id) } })),
        enemySkills: o.referencedEnemySkills.map(row => ({ identity: { kind: "enemy_skill", id: str(row.id) }, status: "partial", raw: row, semanticBoundary: "mechanics_deferred_to_e4" })),
        enemyRoundSkillSets: o.referencedRoundSkillSets.map(row => { const values = relations.get(str(row.id)) ?? []; return { identity: { kind: "enemy_round_skill_set", id: str(row.id) }, status: "partial", effectDescriptionRaw: str(row.effect_description), cancelDescriptionRaw: str(row.cancel_description), relationIds: values.map(value => str(value.id)), enemyRoundSkillIds: values.map(value => str(value.enemy_round_skill_id)) }; }),
        enemyRoundSkills: o.referencedRoundSkills.map(row => ({ identity: { kind: "enemy_round_skill", id: str(row.id) }, status: "partial", raw: row, semanticBoundary: "mechanics_deferred_to_e4" })),
        zBattleEnemyRanges: o.zBattleEnemies.map(row => {
            const type = (column: string) => str(row[column]);
            return {
                identity: { kind: "z_battle_enemy_range", id: str(row.id) }, stageId: str(row.z_battle_stage_id), ordinalRaw: num(row, "ordinal_num"), levels: { start: num(row, "start_level"), end: row.end_level === null ? null : num(row, "end_level") },
                stats: { status: "partial", rawBase: { hp: num(row, "base_hp"), attack: num(row, "base_attack"), defence: num(row, "base_defence") }, unknowns: ["units", "application_formula", "precedence", "runtime_modifiers"] },
                cardEscalations: cardEscalations.get(type("card_escalation_type")) ?? [], skillEscalations: skillEscalations.get(type("skill_escalation_type")) ?? [],
                rawEscalationTypeIds: { hp: type("hp_escalation_type"), attack: type("attack_escalation_type"), defence: type("defence_escalation_type"), specialAttack: type("special_attack_escalation_type"), performance: type("performance_escalation_type"), card: type("card_escalation_type"), skill: type("skill_escalation_type") }, source: { table: "z_battle_enemies", rowId: str(row.id) },
            };
        }),
        zBattleStatusCurves: statusTypeIds.map(escalationTypeId => ({ escalationTypeId, status: "partial", points: statusEscalations.get(escalationTypeId) ?? [], semanticBoundary: "raw_level_value_pairs_without_application_formula_or_units" })),
        zBattlePowerupThresholds: o.zBattlePowerupThresholds.map(row => ({ stageId: str(row.z_battle_stage_id), sourceRowId: str(row.id), status: "partial", raw: { hp: num(row, "hp"), attack: num(row, "atk"), defence: num(row, "def"), specialAttack: num(row, "special_atk") }, semanticBoundary: "threshold_units_and_runtime_application_unknown" })),
        sdEncounterBoundary: o.sdStageEnemyReferences.map(row => ({ stageId: str(row.id), enemyTableIdRaw: str(row.sd_enemy_table_id), status: "partial", missing: ["sd_enemy_table_target"] })),
        nonTraditionalBoundaries: [{ family: "rmbattle", status: "partial", missing: ["root_table", "encounter_source", "server_runtime_topology"] }, { family: "budokai", status: "partial", missing: ["encounter_source", "server_match_topology"] }],
    };
}

const encounterCounts = (values: EventsE3Encounter[]) => ({ battles: values.reduce((n, value) => n + value.battles.length, 0), rounds: values.reduce((n, value) => n + value.battles.reduce((m, battle) => m + battle.rounds.length, 0), 0), enemies: values.reduce((n, value) => n + value.battles.reduce((m, battle) => m + battle.rounds.reduce((p, round) => p + round.enemies.length, 0), 0), 0) });

export function buildEventsE3Coverage(dataset: EventsE3Dataset, e2: EventsE2Dataset): EventsE3Coverage {
    const quest = encounterCounts(dataset.questEncounters), origin = encounterCounts(dataset.originEncounters), cards = new Set(dataset.cardReferences.map(value => value.identity.id)), characters = new Set(dataset.characterReferences.map(value => value.identity.id)), skills = new Set(dataset.enemySkills.map(value => value.identity.id)), roundSets = new Set(dataset.enemyRoundSkillSets.map(value => value.identity.id)), roundSkills = new Set(dataset.enemyRoundSkills.map(value => value.identity.id));
    const mapIds = new Set(e2.questStages.flatMap(value => value.levels).concat(e2.unboundQuestLevels).map(value => value.identity.id)), originIds = new Set(e2.originBattles.map(value => value.identity.id)), zStageIds = new Set(e2.zBattleTopologies.map(value => value.identity.stageId)), sdStageIds = new Set(e2.sdTopologies.flatMap(value => value.arenas.flatMap(arena => arena.stages)).map(value => value.identity.stageId));
    let danglingIdCount = dataset.questEncounters.filter(value => !mapIds.has(value.identity.sourceId)).length + dataset.originEncounters.filter(value => !originIds.has(value.identity.sourceId)).length + dataset.zBattleEnemyRanges.filter(value => !zStageIds.has(value.stageId)).length + dataset.zBattlePowerupThresholds.filter(value => !zStageIds.has(value.stageId)).length + dataset.sdEncounterBoundary.filter(value => !sdStageIds.has(value.stageId)).length;
    for (const value of [...dataset.questEncounters, ...dataset.originEncounters]) for (const battle of value.battles) for (const round of battle.rounds) for (const enemy of round.enemies) danglingIdCount += Number(!cards.has(enemy.cardId)) + enemy.enemySkillIds.filter(id => !skills.has(id)).length + Number(enemy.enemyRoundSkillSetId !== null && !roundSets.has(enemy.enemyRoundSkillSetId));
    danglingIdCount += dataset.cardReferences.filter(value => !characters.has(value.characterId)).length;
    for (const value of dataset.enemyRoundSkillSets) danglingIdCount += value.enemyRoundSkillIds.filter(id => !roundSkills.has(id)).length;
    for (const value of dataset.zBattleEnemyRanges) danglingIdCount += value.cardEscalations.filter(row => !cards.has(str(row.card_id))).length + value.skillEscalations.filter(row => !skills.has(str(row.enemy_skill_id))).length;
    return { schemaVersion: 1, questEncounterCount: dataset.questEncounters.length, battleCount: quest.battles, roundCount: quest.rounds, enemyPositionCount: quest.enemies, originEncounterCount: dataset.originEncounters.length, originEnemyPositionCount: origin.enemies, referencedCardCount: dataset.cardReferences.length, referencedCharacterCount: dataset.characterReferences.length, enemySkillCount: dataset.enemySkills.length, roundSkillSetCount: dataset.enemyRoundSkillSets.length, roundSkillCount: dataset.enemyRoundSkills.length, zBattleEnemyRangeCount: dataset.zBattleEnemyRanges.length, zCardEscalationCount: dataset.zBattleEnemyRanges.reduce((n, value) => n + value.cardEscalations.length, 0), zSkillEscalationCount: dataset.zBattleEnemyRanges.reduce((n, value) => n + value.skillEscalations.length, 0), zStatusEscalationReferenceCount: dataset.zBattleStatusCurves.reduce((n, value) => n + value.points.length, 0), sdOpaqueEnemyReferenceCount: dataset.sdEncounterBoundary.length, danglingIdCount, statusCounts: { supported: dataset.questEncounters.length, partial: dataset.originEncounters.length + dataset.enemySkills.length + dataset.enemyRoundSkillSets.length + dataset.enemyRoundSkills.length + dataset.zBattleEnemyRanges.length + dataset.zBattleStatusCurves.length + dataset.zBattlePowerupThresholds.length + dataset.sdEncounterBoundary.length + dataset.nonTraditionalBoundaries.length, unknown: dataset.cardReferences.length } };
}

export function buildEventsE3Goldens(dataset: EventsE3Dataset): EventsE3Goldens {
    const signature = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
    const representatives: EventsE3Goldens["representatives"] = [];
    const addEncounter = (kind: string, value: EventsE3Encounter | undefined) => { if (value) representatives.push({ kind, sourceId: value.identity.sourceId, structuralSha256: signature(value.battles) }); };
    addEncounter("quest_multi_battle", dataset.questEncounters.find(value => value.battles.length > 1));
    addEncounter("quest_multi_round", dataset.questEncounters.find(value => value.battles.some(battle => battle.rounds.length > 1)));
    addEncounter("quest_multi_enemy", dataset.questEncounters.find(value => value.battles.some(battle => battle.rounds.some(round => round.enemies.length > 1))));
    addEncounter("origin_multi_round", dataset.originEncounters.find(value => value.battles.some(battle => battle.rounds.length > 1)));
    const z = dataset.zBattleEnemyRanges.find(value => value.cardEscalations.length > 0 && value.skillEscalations.length > 0); if (z) representatives.push({ kind: "z_range_with_card_and_skill_curves", sourceId: z.identity.id, structuralSha256: signature({ stageId: z.stageId, levels: z.levels, rawEscalationTypeIds: z.rawEscalationTypeIds, cardEscalations: z.cardEscalations, skillEscalations: z.skillEscalations }) });
    const sd = dataset.sdEncounterBoundary[0]; if (sd) representatives.push({ kind: "sd_opaque_enemy_reference", sourceId: sd.stageId, structuralSha256: signature(sd) });
    return { schemaVersion: 1, representatives };
}
import { createHash } from "crypto";
