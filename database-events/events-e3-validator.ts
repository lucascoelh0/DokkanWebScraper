import { EventsE2Dataset } from "./events-e2-contract";
import { buildEventsE3Coverage, buildEventsE3Dataset, buildEventsE3Goldens } from "./events-e3-builder";
import { EventsE3Dataset, EventsE3Goldens, EventsE3Observation, EventsE3Validation } from "./events-e3-contract";

const id = (value: unknown) => String(value);
const isJsonOrNull = (value: unknown) => { if (value === null) return true; try { JSON.parse(String(value)); return true; } catch { return false; } };

export function validateEventsE3Dataset(dataset: EventsE3Dataset, observation: EventsE3Observation, e2: EventsE2Dataset, goldens: EventsE3Goldens, expectedGoldens: EventsE3Goldens, expected?: { generatedAt: string; sourceSnapshotVersion: string; sourceDatabaseSha256: string; sourceE2Sha256: string }): EventsE3Validation {
    const failures: string[] = [];
    if (dataset.schemaVersion !== 1 || dataset.contract !== "dokkan-events-database-first-encounters" || dataset.contractVersion !== "0.4.0" || dataset.generatedAtPolicy !== "pinned_to_source_snapshot_for_reproducible_bytes") failures.push("contract identity");
    const rebuilt = buildEventsE3Dataset({ observation, generatedAt: dataset.generatedAt, sourceSnapshotVersion: dataset.sourceSnapshotVersion, sourceDatabaseSha256: dataset.sourceDatabaseSha256, sourceE2Sha256: dataset.sourceE2.sha256 }), exactProjection = JSON.stringify(dataset) === JSON.stringify(rebuilt);
    if (!exactProjection) failures.push("exact source projection");
    if (JSON.stringify(goldens) !== JSON.stringify(buildEventsE3Goldens(dataset)) || JSON.stringify(goldens) !== JSON.stringify(expectedGoldens) || goldens.representatives.length < 6) failures.push("pinned representative goldens");
    if (expected && (dataset.generatedAt !== expected.generatedAt || dataset.sourceSnapshotVersion !== expected.sourceSnapshotVersion || dataset.sourceDatabaseSha256 !== expected.sourceDatabaseSha256 || dataset.sourceE2.sha256 !== expected.sourceE2Sha256)) failures.push("source lineage");
    const finite = (value: unknown): boolean => typeof value === "number" ? Number.isFinite(value) : Array.isArray(value) ? value.every(finite) : value !== null && typeof value === "object" ? Object.values(value).every(finite) : true; if (!finite(dataset)) failures.push("non-finite numeric value");
    const coverage = buildEventsE3Coverage(dataset, e2); if (coverage.danglingIdCount !== 0) failures.push(`dangling ids ${coverage.danglingIdCount}`);
    const cardIds = new Set(dataset.cardReferences.map(value => value.identity.id)), characterIds = new Set(dataset.characterReferences.map(value => value.identity.id)), skillIds = new Set(dataset.enemySkills.map(value => value.identity.id)), roundSetIds = new Set(dataset.enemyRoundSkillSets.map(value => value.identity.id)), roundSkillIds = new Set(dataset.enemyRoundSkills.map(value => value.identity.id));
    if (cardIds.size !== dataset.cardReferences.length || characterIds.size !== dataset.characterReferences.length || skillIds.size !== dataset.enemySkills.length || roundSetIds.size !== dataset.enemyRoundSkillSets.length || roundSkillIds.size !== dataset.enemyRoundSkills.length) failures.push("duplicate referenced identity");
    let losslessEncounterCount = 0, losslessEnemyPositionCount = 0, joinCount = 0;
    const checkEncounters = (values: EventsE3Dataset["questEncounters"], source: EventsE3Observation["questEncounters"], kind: string) => {
        if (values.length !== source.length) failures.push(`${kind} encounter accounting`);
        for (const value of values) {
            const raw = source.find(candidate => id(candidate.sourceId) === value.identity.sourceId); if (!raw) { failures.push(`${kind} source ${value.identity.sourceId}`); continue; }
            losslessEncounterCount += 1;
            if (value.battles.some((battle, battleIndex) => battle.ordinal !== battleIndex || battle.rounds.some((round, roundIndex) => round.ordinal !== roundIndex || round.enemies.some((enemy, enemyIndex) => enemy.ordinal !== enemyIndex)))) failures.push(`${kind} ordering ${value.identity.sourceId}`);
            for (const battle of value.battles) for (const round of battle.rounds) for (const enemy of round.enemies) { losslessEnemyPositionCount += 1; joinCount += Number(cardIds.has(enemy.cardId)) + enemy.enemySkillIds.filter(skillId => skillIds.has(skillId)).length + Number(enemy.enemyRoundSkillSetId !== null && roundSetIds.has(enemy.enemyRoundSkillSetId)); }
        }
    };
    checkEncounters(dataset.questEncounters, observation.questEncounters, "quest");
    checkEncounters(dataset.originEncounters as EventsE3Dataset["questEncounters"], observation.originEncounters, "origin");
    for (const value of dataset.cardReferences) { if (!characterIds.has(value.characterId)) failures.push(`card character ${value.identity.id}`); else joinCount += 1; if (value.enemyRuntimeApplication.status !== "unknown") failures.push(`card runtime status ${value.identity.id}`); }
    for (const value of dataset.enemySkills) if (!isJsonOrNull(value.raw.causality_conditions) || !isJsonOrNull(value.raw.efficacy_values)) failures.push(`enemy skill raw json ${value.identity.id}`);
    for (const value of dataset.enemyRoundSkills) if (!isJsonOrNull(value.raw.causality_conditions)) failures.push(`round skill raw json ${value.identity.id}`);
    for (const value of dataset.enemyRoundSkillSets) for (const skillId of value.enemyRoundSkillIds) { if (!roundSkillIds.has(skillId)) failures.push(`round skill relation ${value.identity.id}/${skillId}`); else joinCount += 1; }
    const statusPointCount = dataset.zBattleStatusCurves.reduce((sum, value) => sum + value.points.length, 0); if (statusPointCount !== observation.zBattleStatusEscalations.length) failures.push("z status curve accounting");
    if (dataset.zBattleEnemyRanges.length !== observation.zBattleEnemies.length || dataset.zBattlePowerupThresholds.length !== observation.zBattlePowerupThresholds.length || dataset.sdEncounterBoundary.length !== observation.sdStageEnemyReferences.length) failures.push("family accounting");
    for (const value of dataset.zBattleEnemyRanges) { for (const row of value.cardEscalations) { if (!cardIds.has(id(row.card_id))) failures.push(`z card ${value.identity.id}/${id(row.card_id)}`); else joinCount += 1; } for (const row of value.skillEscalations) { if (!skillIds.has(id(row.enemy_skill_id))) failures.push(`z skill ${value.identity.id}/${id(row.enemy_skill_id)}`); else joinCount += 1; } if (value.stats.status !== "partial" || value.stats.unknowns.length !== 4) failures.push(`z stats boundary ${value.identity.id}`); }
    return { schemaVersion: 1, valid: failures.length === 0, exactProjection, losslessEncounterCount, losslessEnemyPositionCount, joinCount, failures };
}
