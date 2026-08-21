"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = require("assert");
const mocha_1 = require("mocha");
const game_db_dokkan_field_created_domain_1 = require("./game-db-dokkan-field-created-domain");
const game_db_dokkan_field_sidecar_1 = require("./game-db-dokkan-field-sidecar");
function fixture() {
    const fields = [...new Map(game_db_dokkan_field_created_domain_1.AUDITED_CREATED_DOMAIN_LINKS.map(link => [link.fieldId, link])).values()];
    const sidecar = (0, game_db_dokkan_field_sidecar_1.buildGameDbDokkanFieldSidecar)(game_db_dokkan_field_created_domain_1.CREATED_DOMAIN_AUDITED_SNAPSHOT_ID, {
        dokkan_fields: fields.map(link => ({
            id: link.fieldId,
            dokkan_field_efficacy_set_id: link.fieldId,
            name: link.fieldName,
            resource_id: link.resourceId,
        })),
        dokkan_field_efficacy_sets: fields.map(link => ({ id: link.fieldId })),
        dokkan_field_efficacies: [],
        dokkan_field_active_skill_set_relations: game_db_dokkan_field_created_domain_1.AUDITED_CREATED_DOMAIN_LINKS.map(link => ({
            id: link.relationRowId,
            dokkan_field_id: link.fieldId,
            active_skill_set_id: link.activeSkillSetId,
        })),
        dokkan_field_passive_skill_relations: [{
                id: "1",
                dokkan_field_id: fields[0].fieldId,
                passive_skill_id: "999",
            }],
    });
    const activeSkillSets = game_db_dokkan_field_created_domain_1.AUDITED_CREATED_DOMAIN_LINKS.map(link => ({
        id: link.activeSkillSetId,
        effect_description: `Other effect;\n creates the Domain \"${link.fieldName}\" for an unprojected duration`,
        turn: "999",
    }));
    return { sidecar, activeSkillSets };
}
(0, mocha_1.describe)("buildSnapshotAuditedCreatedDomainProjection", function () {
    (0, mocha_1.it)("emits the exact 14 snapshot-audited Active Skill links without lifecycle claims", () => {
        const { sidecar, activeSkillSets } = fixture();
        const projection = (0, game_db_dokkan_field_created_domain_1.buildSnapshotAuditedCreatedDomainProjectionForTest)(sidecar, activeSkillSets);
        (0, assert_1.equal)(Object.keys(projection.byActiveSkillSetId).length, 14);
        (0, assert_1.equal)(projection.semanticStatus, "test-only-untrusted");
        (0, assert_1.deepEqual)(projection.excludedSemantics, ["duration", "field-effects", "passive-created-domain"]);
        (0, assert_1.equal)("duration" in projection.byActiveSkillSetId["323"], false);
        (0, assert_1.equal)("description" in projection.byActiveSkillSetId["323"].field, false);
        (0, assert_1.deepEqual)(projection.byActiveSkillSetId["323"], {
            semanticStatus: "test-only-untrusted",
            sourceSnapshotId: game_db_dokkan_field_created_domain_1.CREATED_DOMAIN_AUDITED_SNAPSHOT_ID,
            activeSkillSetId: "323",
            field: { id: "11", name: "Earth Shrouded in Minus Energy", resourceId: "3010" },
            provenance: {
                activeSkillSet: { table: "active_skill_sets", rowId: "323" },
                relation: { table: "dokkan_field_active_skill_set_relations", rowId: "13" },
                field: { table: "dokkan_fields", rowId: "11" },
            },
        });
        (0, assert_1.equal)("999" in projection.byActiveSkillSetId, false);
    });
    (0, mocha_1.it)("fails closed for snapshot, relation, field, or description drift", () => {
        const snapshotDrift = fixture();
        snapshotDrift.sidecar.source.snapshotId = "glb-db-future";
        (0, assert_1.throws)(() => (0, game_db_dokkan_field_created_domain_1.buildSnapshotAuditedCreatedDomainProjectionForTest)(snapshotDrift.sidecar, snapshotDrift.activeSkillSets), /exact complete audited snapshot/);
        const relationDrift = fixture();
        relationDrift.sidecar.rows.dokkan_field_active_skill_set_relations[0].values.dokkan_field_id = "2";
        (0, assert_1.throws)(() => (0, game_db_dokkan_field_created_domain_1.buildSnapshotAuditedCreatedDomainProjectionForTest)(relationDrift.sidecar, relationDrift.activeSkillSets), /audited link drift/);
        const fieldDrift = fixture();
        fieldDrift.sidecar.rows.dokkan_fields[0].values.resource_id = "9999";
        (0, assert_1.throws)(() => (0, game_db_dokkan_field_created_domain_1.buildSnapshotAuditedCreatedDomainProjectionForTest)(fieldDrift.sidecar, fieldDrift.activeSkillSets), /audited link drift/);
        const descriptionDrift = fixture();
        descriptionDrift.activeSkillSets[0].effect_description = "Raises ATK only";
        (0, assert_1.throws)(() => (0, game_db_dokkan_field_created_domain_1.buildSnapshotAuditedCreatedDomainProjectionForTest)(descriptionDrift.sidecar, descriptionDrift.activeSkillSets), /description proof drift/);
    });
    (0, mocha_1.it)("rejects caller-supplied sources that are not the exact audited bytes", () => {
        (0, assert_1.throws)(() => (0, game_db_dokkan_field_created_domain_1.buildSnapshotAuditedCreatedDomainProjection)({
            sidecarPayload: Buffer.from("synthetic"),
            sidecarManifest: {},
            activeSkillSetsCsv: Buffer.from("id,effect_description\n198,synthetic\n"),
        }), /sidecar payload source identity drift/);
    });
});
//# sourceMappingURL=game-db-dokkan-field-created-domain.spec.js.map