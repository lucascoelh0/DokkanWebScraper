"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateEventsE0Dataset = void 0;
const events_e0_builder_1 = require("./events-e0-builder");
function validateEventsE0Dataset(dataset, observation, baseline) {
    const failures = [];
    if (dataset.schemaVersion !== 1 || dataset.contract !== "dokkan-events-database-first-inventory" || dataset.contractVersion !== "0.1.0")
        failures.push("contract identity");
    if (dataset.generatedAtPolicy !== "pinned_to_source_snapshot_for_reproducible_bytes")
        failures.push("generation timestamp policy");
    if (dataset.identityPolicy !== "numeric_structural_ids_only_names_and_text_are_presentation")
        failures.push("identity policy");
    if (dataset.scheduleBoundary !== "static_catalog_fields_are_separate_from_server_availability")
        failures.push("schedule boundary");
    if (dataset.tables.length !== observation.tableCount || dataset.sourceDatabase.tableCount !== observation.tableCount)
        failures.push("table cardinality");
    if (new Set(dataset.tables.map(value => value.name)).size !== dataset.tables.length)
        failures.push("duplicate table name");
    const sourceTables = new Map(observation.tables.map(value => [value.name, value]));
    let losslessTableCount = 0;
    for (const table of dataset.tables) {
        const source = sourceTables.get(table.name);
        if (!source || JSON.stringify({ ...table, domain: undefined }) !== JSON.stringify({ ...source, domain: undefined }))
            failures.push(`table reconstruction ${table.name}`);
        else
            losslessTableCount++;
    }
    if (dataset.sourceDatabase.schemaSha256 !== (0, events_e0_builder_1.eventsE0SchemaSha256)(observation))
        failures.push("schema hash");
    const expectedRelationships = [...observation.relationships].sort((a, b) => a.key.localeCompare(b.key));
    const expectedFamilies = [...observation.areaFamilies].sort((a, b) => a.rawAreaType.localeCompare(b.rawAreaType) || a.rawCategory - b.rawCategory);
    const expectedEncounters = [...observation.encounters].sort((a, b) => a.sourceTable.localeCompare(b.sourceTable));
    if (new Set(dataset.relationships.map(value => value.key)).size !== dataset.relationships.length || JSON.stringify(dataset.relationships) !== JSON.stringify(expectedRelationships))
        failures.push("relationship reconstruction");
    if (new Set(dataset.areaFamilies.map(value => `${value.rawAreaType}|${value.rawCategory}`)).size !== dataset.areaFamilies.length || JSON.stringify(dataset.areaFamilies) !== JSON.stringify(expectedFamilies))
        failures.push("area family reconstruction");
    if (new Set(dataset.encounters.map(value => value.sourceTable)).size !== dataset.encounters.length || JSON.stringify(dataset.encounters) !== JSON.stringify(expectedEncounters))
        failures.push("encounter source reconstruction");
    for (const relationship of dataset.relationships) {
        if (relationship.sourceRowCount < relationship.nonNullSourceCount || relationship.nonNullSourceCount < relationship.joinedSourceCount || relationship.danglingNonNullCount !== relationship.nonNullSourceCount - relationship.joinedSourceCount)
            failures.push(`relationship accounting ${relationship.key}`);
        if (relationship.danglingNonNullCount !== 0)
            failures.push(`dangling relationship ${relationship.key}`);
    }
    let losslessEncounterSourceCount = 0;
    for (const encounter of dataset.encounters) {
        if (encounter.sourceCount !== encounter.parsedCount
            || JSON.stringify(encounter.topLevelShapes) !== JSON.stringify([["battles", "display_type"]])
            || JSON.stringify(encounter.battleShapes) !== JSON.stringify([["rounds"]])
            || JSON.stringify(encounter.roundShapes) !== JSON.stringify([["comment", "enemies", "round_no"]])
            || JSON.stringify(encounter.enemyShapes) !== JSON.stringify([["card_id", "enemy_round_skill_set_id", "enemy_skill_ids"]]))
            failures.push(`encounter parse ${encounter.sourceTable}`);
        else if (encounter.uniqueCardIdCount !== encounter.joinedCardIdCount || encounter.uniqueEnemySkillIdCount !== encounter.joinedEnemySkillIdCount || encounter.uniqueEnemyRoundSkillSetIdCount !== encounter.joinedEnemyRoundSkillSetIdCount)
            failures.push(`encounter join ${encounter.sourceTable}`);
        else
            losslessEncounterSourceCount++;
    }
    if (baseline) {
        if (dataset.generatedAt !== baseline.generatedAt || dataset.sourceSnapshotVersion !== baseline.snapshotVersion || dataset.sourceDatabase.sha256 !== baseline.sourceDatabase.sha256 || dataset.sourceDatabase.sizeBytes !== baseline.sourceDatabase.sizeBytes || dataset.sourceDatabase.tableCount !== baseline.sourceDatabase.tableCount || dataset.sourceDatabase.schemaSha256 !== baseline.sourceDatabase.schemaSha256)
            failures.push("pinned source identity");
    }
    return { schemaVersion: 1, valid: failures.length === 0, tableCount: dataset.tables.length, losslessTableCount, relationshipCount: dataset.relationships.length, losslessEncounterSourceCount, failures };
}
exports.validateEventsE0Dataset = validateEventsE0Dataset;
//# sourceMappingURL=events-e0-validator.js.map