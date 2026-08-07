import { deepEqual, equal } from "assert";
import { buildEventsE0Coverage, buildEventsE0Dataset, classifyEventsE0Table } from "./events-e0-builder";
import { EventsE0Observation } from "./events-e0-contract";
import { validateEventsE0Dataset } from "./events-e0-validator";

const observation: EventsE0Observation = {
    tableCount: 2,
    tables: [
        { name: "areas", rowCount: 1, columns: [{ name: "id", declaredType: "INTEGER", notNull: false, primaryKeyOrdinal: 1 }], declaredForeignKeys: [] },
        { name: "opaque", rowCount: 0, columns: [{ name: "id", declaredType: "INTEGER", notNull: false, primaryKeyOrdinal: 1 }], declaredForeignKeys: [] },
    ],
    relationships: [{ key: "self", fromTable: "areas", fromColumn: "id", toTable: "areas", toColumn: "id", sourceRowCount: 1, nonNullSourceCount: 1, joinedSourceCount: 1, danglingNonNullCount: 0 }],
    areaFamilies: [{ rawAreaType: "raw", rawCategory: 7, areaCount: 1, questCount: 2, mapCount: 3, encounterMapCount: 3 }],
    encounters: [{ sourceTable: "sugoroku_map_enemy_informations", sourceCount: 1, parsedCount: 1, topLevelShapes: [["battles", "display_type"]], battleShapes: [["rounds"]], roundShapes: [["comment", "enemies", "round_no"]], enemyShapes: [["card_id", "enemy_round_skill_set_id", "enemy_skill_ids"]], displayTypeCounts: { normal: 1 }, battleCount: 1, roundCount: 1, enemyCount: 1, uniqueCardIdCount: 1, joinedCardIdCount: 1, uniqueEnemySkillIdCount: 0, joinedEnemySkillIdCount: 0, uniqueEnemyRoundSkillSetIdCount: 0, joinedEnemyRoundSkillSetIdCount: 0 }],
};

describe("events E0 inventory", () => {
    it("classifies only validated structural tables as supported", () => {
        equal(classifyEventsE0Table("areas").status, "supported");
        equal(classifyEventsE0Table("missions").status, "partial");
        equal(classifyEventsE0Table("opaque").status, "unknown");
    });
    it("reconstructs the complete observation and accounts coverage", () => {
        const dataset = buildEventsE0Dataset({ observation, generatedAt: "time", sourceSnapshotVersion: "snapshot", sourceDatabase: { fileName: "db", sha256: "a", sizeBytes: 1 } });
        const validation = validateEventsE0Dataset(dataset, observation);
        equal(validation.valid, true);
        deepEqual(buildEventsE0Coverage(dataset).tableStatusCounts, { supported: 1, partial: 0, unknown: 1 });
    });
    it("rejects a dangling structural relationship", () => {
        const changed = JSON.parse(JSON.stringify(observation)) as EventsE0Observation;
        changed.relationships[0].nonNullSourceCount = 2;
        changed.relationships[0].danglingNonNullCount = 1;
        const dataset = buildEventsE0Dataset({ observation: changed, generatedAt: "time", sourceSnapshotVersion: "snapshot", sourceDatabase: { fileName: "db", sha256: "a", sizeBytes: 1 } });
        equal(validateEventsE0Dataset(dataset, changed).valid, false);
    });
    it("rejects omitted topology collections", () => {
        const dataset = buildEventsE0Dataset({ observation, generatedAt: "time", sourceSnapshotVersion: "snapshot", sourceDatabase: { fileName: "db", sha256: "a", sizeBytes: 1 } });
        dataset.relationships = [];
        dataset.areaFamilies = [];
        dataset.encounters = [];
        const validation = validateEventsE0Dataset(dataset, observation);
        equal(validation.valid, false);
        equal(validation.failures.includes("relationship reconstruction"), true);
        equal(validation.failures.includes("area family reconstruction"), true);
        equal(validation.failures.includes("encounter source reconstruction"), true);
    });
    it("binds the deterministic timestamp to the source baseline", () => {
        const dataset = buildEventsE0Dataset({ observation, generatedAt: "time", sourceSnapshotVersion: "snapshot", sourceDatabase: { fileName: "db", sha256: "a", sizeBytes: 1 } });
        const validation = validateEventsE0Dataset(dataset, observation, { schemaVersion: 1, contractVersion: "0.1.0", snapshotVersion: "snapshot", generatedAt: "other", sourceDatabase: { sha256: "a", sizeBytes: 1, tableCount: 2, schemaSha256: dataset.sourceDatabase.schemaSha256 } });
        equal(validation.valid, false);
        equal(validation.failures.includes("pinned source identity"), true);
    });
});
