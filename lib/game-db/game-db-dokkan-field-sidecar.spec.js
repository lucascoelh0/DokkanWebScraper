"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = require("assert");
const promises_1 = require("fs/promises");
const mocha_1 = require("mocha");
const os_1 = require("os");
const path_1 = require("path");
const game_db_dokkan_field_sidecar_1 = require("./game-db-dokkan-field-sidecar");
const game_db_table_inventory_1 = require("./game-db-table-inventory");
(0, mocha_1.describe)("buildGameDbDokkanFieldSidecar", function () {
    (0, mocha_1.it)("keeps legacy core imports separate from the all-or-none first-party sidecar inventory", () => {
        (0, assert_1.deepEqual)(game_db_table_inventory_1.FIRST_PARTY_EXPORT_GAME_DB_TABLES, [
            ...game_db_table_inventory_1.CORE_GAME_DB_TABLES,
            ...game_db_table_inventory_1.SUPER_ATTACK_EFFECT_GAME_DB_TABLES,
            ...game_db_table_inventory_1.SUPER_ATTACK_CATEGORY_GAME_DB_TABLES,
            ...game_db_dokkan_field_sidecar_1.DOKKAN_FIELD_SIDECAR_TABLES,
        ]);
        (0, assert_1.equal)(new Set(game_db_table_inventory_1.FIRST_PARTY_EXPORT_GAME_DB_TABLES).size, game_db_table_inventory_1.FIRST_PARTY_EXPORT_GAME_DB_TABLES.length);
    });
    (0, mocha_1.it)("preserves raw rows and exposes associations without claiming Domain ownership", () => {
        const sidecar = (0, game_db_dokkan_field_sidecar_1.buildGameDbDokkanFieldSidecar)("glb-db-2026-08-20", {
            dokkan_fields: [{
                    id: "10",
                    dokkan_field_efficacy_set_id: "20",
                    name: "World Shrouded in Evil Power",
                    description: " raw description ",
                    resource_id: "30",
                }],
            dokkan_field_efficacy_sets: [{ id: "20" }],
            dokkan_field_efficacies: [{
                    id: "2",
                    dokkan_field_efficacy_set_id: "20",
                    efficacy_type: "7",
                    eff_value1: "25",
                    efficacy_values: "[25]",
                }],
            dokkan_field_active_skill_set_relations: [
                { id: "101", dokkan_field_id: "10", active_skill_set_id: "42" },
                { id: "100", dokkan_field_id: "10", active_skill_set_id: "42" },
            ],
            dokkan_field_passive_skill_relations: [
                { id: "200", dokkan_field_id: "10", passive_skill_id: "80" },
            ],
        });
        (0, assert_1.equal)(sidecar.includedTableIntegrity.scope, "included-tables-only");
        (0, assert_1.equal)(sidecar.includedTableIntegrity.status, "complete");
        (0, assert_1.deepEqual)(sidecar.relatedFieldIdsByActiveSkillSet, { "42": ["10"] });
        (0, assert_1.deepEqual)(sidecar.relatedFieldIdsByPassiveSkill, { "80": ["10"] });
        (0, assert_1.equal)(sidecar.rows.dokkan_fields[0].values.description, " raw description ");
        (0, assert_1.deepEqual)(sidecar.source.tables, [...game_db_dokkan_field_sidecar_1.DOKKAN_FIELD_SIDECAR_TABLES]);
        (0, assert_1.equal)("createdDomain" in sidecar, false);
    });
    (0, mocha_1.it)("reports unresolved structural joins instead of dropping rows", () => {
        const sidecar = (0, game_db_dokkan_field_sidecar_1.buildGameDbDokkanFieldSidecar)("snapshot", {
            dokkan_fields: [{ id: "10", dokkan_field_efficacy_set_id: "404" }],
            dokkan_field_efficacy_sets: [],
            dokkan_field_efficacies: [{ id: "2", dokkan_field_efficacy_set_id: "405" }],
            dokkan_field_active_skill_set_relations: [{
                    id: "100",
                    dokkan_field_id: "11",
                    active_skill_set_id: "42",
                }],
            dokkan_field_passive_skill_relations: [{
                    id: "200",
                    dokkan_field_id: "12",
                    passive_skill_id: "80",
                }],
        });
        (0, assert_1.equal)(sidecar.includedTableIntegrity.status, "incomplete");
        (0, assert_1.deepEqual)(sidecar.includedTableIntegrity.unresolvedFieldEfficacySetIds, ["404"]);
        (0, assert_1.deepEqual)(sidecar.includedTableIntegrity.unresolvedEfficacySetIds, ["405"]);
        (0, assert_1.deepEqual)(sidecar.includedTableIntegrity.unresolvedActiveRelationFieldIds, ["11"]);
        (0, assert_1.deepEqual)(sidecar.includedTableIntegrity.unresolvedPassiveRelationFieldIds, ["12"]);
    });
    (0, mocha_1.it)("fails closed for ambiguous source identity or duplicate row ids", () => {
        const emptyTables = {
            dokkan_fields: [],
            dokkan_field_efficacy_sets: [],
            dokkan_field_efficacies: [],
            dokkan_field_active_skill_set_relations: [],
            dokkan_field_passive_skill_relations: [],
        };
        (0, assert_1.throws)(() => (0, game_db_dokkan_field_sidecar_1.buildGameDbDokkanFieldSidecar)("", emptyTables), /source snapshot id/);
        (0, assert_1.throws)(() => (0, game_db_dokkan_field_sidecar_1.buildGameDbDokkanFieldSidecar)("snapshot", {
            ...emptyTables,
            dokkan_fields: [
                { id: "1", dokkan_field_efficacy_set_id: "2" },
                { id: "1", dokkan_field_efficacy_set_id: "2" },
            ],
        }), /duplicate row id 1/);
    });
    (0, mocha_1.it)("normalizes source identity and does not claim integrity for external relation targets", () => {
        const sidecar = (0, game_db_dokkan_field_sidecar_1.buildGameDbDokkanFieldSidecar)("  snapshot  ", {
            dokkan_fields: [{ id: "10", dokkan_field_efficacy_set_id: "20" }],
            dokkan_field_efficacy_sets: [{ id: "20" }],
            dokkan_field_efficacies: [],
            dokkan_field_active_skill_set_relations: [{
                    id: "100",
                    dokkan_field_id: "10",
                    active_skill_set_id: "999999",
                }],
            dokkan_field_passive_skill_relations: [],
        });
        (0, assert_1.equal)(sidecar.source.snapshotId, "snapshot");
        (0, assert_1.equal)(sidecar.includedTableIntegrity.status, "complete");
        (0, assert_1.equal)("unresolvedActiveSkillSetIds" in sidecar.includedTableIntegrity, false);
    });
    (0, mocha_1.it)("loads the optional inventory only when all five CSV members are present", async () => {
        const root = await (0, promises_1.mkdtemp)((0, path_1.join)((0, os_1.tmpdir)(), "dokkan-field-sidecar-"));
        const dataDir = (0, path_1.join)(root, "data");
        await (0, promises_1.mkdir)(dataDir);
        try {
            const sourceConfig = { sourceRoot: root, dataDir };
            (0, assert_1.equal)(await (0, game_db_dokkan_field_sidecar_1.loadGameDbDokkanFieldSidecarTablesIfPresent)(sourceConfig), undefined);
            await (0, promises_1.writeFile)((0, path_1.join)(dataDir, `${game_db_dokkan_field_sidecar_1.DOKKAN_FIELD_SIDECAR_TABLES[0]}.csv`), "id\n", "utf8");
            await (0, assert_1.rejects)(() => (0, game_db_dokkan_field_sidecar_1.loadGameDbDokkanFieldSidecarTablesIfPresent)(sourceConfig), /Incomplete Dokkan field sidecar table inventory/);
            await Promise.all(game_db_dokkan_field_sidecar_1.DOKKAN_FIELD_SIDECAR_TABLES.slice(1).map(table => (0, promises_1.writeFile)((0, path_1.join)(dataDir, `${table}.csv`), "id\n", "utf8")));
            const loaded = await (0, game_db_dokkan_field_sidecar_1.loadGameDbDokkanFieldSidecarTablesIfPresent)(sourceConfig);
            (0, assert_1.deepEqual)(Object.keys(loaded ?? {}), [...game_db_dokkan_field_sidecar_1.DOKKAN_FIELD_SIDECAR_TABLES]);
            (0, assert_1.deepEqual)(Object.values(loaded ?? {}), game_db_dokkan_field_sidecar_1.DOKKAN_FIELD_SIDECAR_TABLES.map(() => []));
        }
        finally {
            await (0, promises_1.rm)(root, { recursive: true, force: true });
        }
    });
});
//# sourceMappingURL=game-db-dokkan-field-sidecar.spec.js.map