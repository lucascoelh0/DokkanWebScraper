import { deepEqual, equal, throws } from "assert";
import { describe, it } from "mocha";
import { buildGameDbDokkanFieldSidecar, DOKKAN_FIELD_SIDECAR_TABLES } from "./game-db-dokkan-field-sidecar";

describe("buildGameDbDokkanFieldSidecar", function () {
    it("preserves raw rows and exposes associations without claiming Domain ownership", () => {
        const sidecar = buildGameDbDokkanFieldSidecar("glb-db-2026-08-20", {
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

        equal(sidecar.includedTableIntegrity.scope, "included-tables-only");
        equal(sidecar.includedTableIntegrity.status, "complete");
        deepEqual(sidecar.relatedFieldIdsByActiveSkillSet, { "42": ["10"] });
        deepEqual(sidecar.relatedFieldIdsByPassiveSkill, { "80": ["10"] });
        equal(sidecar.rows.dokkan_fields[0].values.description, " raw description ");
        deepEqual(sidecar.source.tables, [...DOKKAN_FIELD_SIDECAR_TABLES]);
        equal("createdDomain" in sidecar, false);
    });

    it("reports unresolved structural joins instead of dropping rows", () => {
        const sidecar = buildGameDbDokkanFieldSidecar("snapshot", {
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

        equal(sidecar.includedTableIntegrity.status, "incomplete");
        deepEqual(sidecar.includedTableIntegrity.unresolvedFieldEfficacySetIds, ["404"]);
        deepEqual(sidecar.includedTableIntegrity.unresolvedEfficacySetIds, ["405"]);
        deepEqual(sidecar.includedTableIntegrity.unresolvedActiveRelationFieldIds, ["11"]);
        deepEqual(sidecar.includedTableIntegrity.unresolvedPassiveRelationFieldIds, ["12"]);
    });

    it("fails closed for ambiguous source identity or duplicate row ids", () => {
        const emptyTables = {
            dokkan_fields: [],
            dokkan_field_efficacy_sets: [],
            dokkan_field_efficacies: [],
            dokkan_field_active_skill_set_relations: [],
            dokkan_field_passive_skill_relations: [],
        };
        throws(() => buildGameDbDokkanFieldSidecar("", emptyTables), /source snapshot id/);
        throws(() => buildGameDbDokkanFieldSidecar("snapshot", {
            ...emptyTables,
            dokkan_fields: [
                { id: "1", dokkan_field_efficacy_set_id: "2" },
                { id: "1", dokkan_field_efficacy_set_id: "2" },
            ],
        }), /duplicate row id 1/);
    });

    it("normalizes source identity and does not claim integrity for external relation targets", () => {
        const sidecar = buildGameDbDokkanFieldSidecar("  snapshot  ", {
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

        equal(sidecar.source.snapshotId, "snapshot");
        equal(sidecar.includedTableIntegrity.status, "complete");
        equal("unresolvedActiveSkillSetIds" in sidecar.includedTableIntegrity, false);
    });
});
