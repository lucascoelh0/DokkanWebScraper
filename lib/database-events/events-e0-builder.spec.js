"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = require("assert");
const events_e0_builder_1 = require("./events-e0-builder");
const events_e0_validator_1 = require("./events-e0-validator");
const observation = {
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
        (0, assert_1.equal)((0, events_e0_builder_1.classifyEventsE0Table)("areas").status, "supported");
        (0, assert_1.equal)((0, events_e0_builder_1.classifyEventsE0Table)("missions").status, "partial");
        (0, assert_1.equal)((0, events_e0_builder_1.classifyEventsE0Table)("opaque").status, "unknown");
    });
    it("reconstructs the complete observation and accounts coverage", () => {
        const dataset = (0, events_e0_builder_1.buildEventsE0Dataset)({ observation, generatedAt: "time", sourceSnapshotVersion: "snapshot", sourceDatabase: { fileName: "db", sha256: "a", sizeBytes: 1 } });
        const validation = (0, events_e0_validator_1.validateEventsE0Dataset)(dataset, observation);
        (0, assert_1.equal)(validation.valid, true);
        (0, assert_1.deepEqual)((0, events_e0_builder_1.buildEventsE0Coverage)(dataset).tableStatusCounts, { supported: 1, partial: 0, unknown: 1 });
    });
    it("rejects a dangling structural relationship", () => {
        const changed = JSON.parse(JSON.stringify(observation));
        changed.relationships[0].nonNullSourceCount = 2;
        changed.relationships[0].danglingNonNullCount = 1;
        const dataset = (0, events_e0_builder_1.buildEventsE0Dataset)({ observation: changed, generatedAt: "time", sourceSnapshotVersion: "snapshot", sourceDatabase: { fileName: "db", sha256: "a", sizeBytes: 1 } });
        (0, assert_1.equal)((0, events_e0_validator_1.validateEventsE0Dataset)(dataset, changed).valid, false);
    });
    it("rejects omitted topology collections", () => {
        const dataset = (0, events_e0_builder_1.buildEventsE0Dataset)({ observation, generatedAt: "time", sourceSnapshotVersion: "snapshot", sourceDatabase: { fileName: "db", sha256: "a", sizeBytes: 1 } });
        dataset.relationships = [];
        dataset.areaFamilies = [];
        dataset.encounters = [];
        const validation = (0, events_e0_validator_1.validateEventsE0Dataset)(dataset, observation);
        (0, assert_1.equal)(validation.valid, false);
        (0, assert_1.equal)(validation.failures.includes("relationship reconstruction"), true);
        (0, assert_1.equal)(validation.failures.includes("area family reconstruction"), true);
        (0, assert_1.equal)(validation.failures.includes("encounter source reconstruction"), true);
    });
    it("binds the deterministic timestamp to the source baseline", () => {
        const dataset = (0, events_e0_builder_1.buildEventsE0Dataset)({ observation, generatedAt: "time", sourceSnapshotVersion: "snapshot", sourceDatabase: { fileName: "db", sha256: "a", sizeBytes: 1 } });
        const validation = (0, events_e0_validator_1.validateEventsE0Dataset)(dataset, observation, { schemaVersion: 1, contractVersion: "0.1.0", snapshotVersion: "snapshot", generatedAt: "other", sourceDatabase: { sha256: "a", sizeBytes: 1, tableCount: 2, schemaSha256: dataset.sourceDatabase.schemaSha256 } });
        (0, assert_1.equal)(validation.valid, false);
        (0, assert_1.equal)(validation.failures.includes("pinned source identity"), true);
    });
});
//# sourceMappingURL=events-e0-builder.spec.js.map