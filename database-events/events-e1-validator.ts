import { buildEventsE1Dataset } from "./events-e1-builder";
import { EventsE1Dataset, EventsE1Observation, EventsE1Validation } from "./events-e1-contract";

export function validateEventsE1Dataset(dataset: EventsE1Dataset, observation: EventsE1Observation, expected?: { generatedAt: string; sourceSnapshotVersion: string; sourceDatabaseSha256: string; sourceE0Sha256: string }): EventsE1Validation {
    const failures: string[] = [];
    if (dataset.schemaVersion !== 1 || dataset.contract !== "dokkan-events-database-first-catalog" || dataset.contractVersion !== "0.2.0" || dataset.generatedAtPolicy !== "pinned_to_source_snapshot_for_reproducible_bytes" || dataset.identityPolicy !== "table_domain_plus_numeric_id_names_never_identity") failures.push("contract identity");
    const rebuilt = buildEventsE1Dataset({ observation, generatedAt: dataset.generatedAt, sourceSnapshotVersion: dataset.sourceSnapshotVersion, sourceDatabaseSha256: dataset.sourceDatabaseSha256, sourceE0Sha256: dataset.sourceE0.sha256 });
    if (JSON.stringify(dataset) !== JSON.stringify(rebuilt)) failures.push("exact source projection");
    if (expected && (dataset.generatedAt !== expected.generatedAt || dataset.sourceSnapshotVersion !== expected.sourceSnapshotVersion || dataset.sourceDatabaseSha256 !== expected.sourceDatabaseSha256 || dataset.sourceE0.sha256 !== expected.sourceE0Sha256)) failures.push("source lineage");
    const zStageIds = new Set(observation.zBattleStages.map(value => value.id)), zViewStageIds = new Set(observation.zBattleStageViews.map(value => value.z_battle_stage_id));
    if (observation.zBattleStageViews.length !== observation.zBattleStages.length || zViewStageIds.size !== observation.zBattleStageViews.length || [...zStageIds].some(value => !zViewStageIds.has(value)) || [...zViewStageIds].some(value => !zStageIds.has(value))) failures.push("z battle view cardinality");
    const identities = dataset.catalog.map(value => `${value.identity.kind}:${value.identity.id}`), identitySet = new Set(identities);
    if (identitySet.size !== identities.length) failures.push("duplicate identity");
    let losslessRelationshipCount = 0;
    for (const entity of dataset.catalog) for (const relation of entity.relations) { if (!identitySet.has(`${relation.targetKind}:${relation.targetId}`)) failures.push(`dangling relation ${entity.identity.kind}:${entity.identity.id}`); else losslessRelationshipCount++; }
    for (const hint of dataset.availabilityHints) if (!identitySet.has(`${hint.identity.entityKind}:${hint.identity.entityId}`)) failures.push(`dangling availability ${hint.identity.entityKind}:${hint.identity.entityId}`);
    if (new Set(dataset.availabilityHints.map(value => `${value.identity.entityKind}:${value.identity.entityId}:${value.identity.sourceTable}:${value.identity.sourceRowId}`)).size !== dataset.availabilityHints.length) failures.push("duplicate availability");
    for (const family of dataset.opaqueRootFamilies) if (new Set(family.identities).size !== family.identities.length || family.identities.some(value => !/^\d+$/.test(value))) failures.push(`opaque identity ${family.family}`);
    return { schemaVersion: 1, valid: failures.length === 0, entityCount: dataset.catalog.length, losslessIdentityCount: identitySet.size, losslessRelationshipCount, availabilityHintCount: dataset.availabilityHints.length, failures };
}
