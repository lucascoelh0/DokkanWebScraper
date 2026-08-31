"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = require("assert");
const mocha_1 = require("mocha");
const game_db_dokkan_field_created_domain_1 = require("./game-db-dokkan-field-created-domain");
const game_db_dokkan_field_sidecar_1 = require("./game-db-dokkan-field-sidecar");
function fixture(snapshotId = "glb-db-1787900894") {
    const fields = [...new Map(game_db_dokkan_field_created_domain_1.AUDITED_CREATED_DOMAIN_LINKS.map(link => [link.fieldId, link])).values()];
    const fieldTables = {
        dokkan_fields: fields.map(link => ({
            id: link.fieldId,
            dokkan_field_efficacy_set_id: link.fieldId,
            name: link.fieldName,
            resource_id: link.resourceId,
            description: `${link.fieldName} field effect`,
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
    };
    const sidecar = (0, game_db_dokkan_field_sidecar_1.buildGameDbDokkanFieldSidecar)(snapshotId, fieldTables);
    const activeSkillSets = game_db_dokkan_field_created_domain_1.AUDITED_CREATED_DOMAIN_LINKS.map(link => ({
        id: link.activeSkillSetId,
        effect_description: `Other effect;\n creates the Domain \"${link.fieldName}\" for an unprojected duration`,
        turn: "999",
    }));
    return { sidecar, fieldTables, activeSkillSets };
}
(0, mocha_1.describe)("buildSnapshotAuditedCreatedDomainProjection", function () {
    (0, mocha_1.it)("emits all 15 currently audited Active Skill links without lifecycle claims", () => {
        const { sidecar, activeSkillSets } = fixture();
        const projection = (0, game_db_dokkan_field_created_domain_1.buildSnapshotAuditedCreatedDomainProjectionForTest)(sidecar, activeSkillSets);
        (0, assert_1.equal)(Object.keys(projection.byActiveSkillSetId).length, 15);
        (0, assert_1.equal)(projection.semanticStatus, "test-only-untrusted");
        (0, assert_1.deepEqual)(projection.excludedSemantics, ["duration", "structured-field-efficacies", "passive-created-domain"]);
        (0, assert_1.equal)("duration" in projection.byActiveSkillSetId["323"], false);
        (0, assert_1.equal)(projection.byActiveSkillSetId["323"].field.description, "Earth Shrouded in Minus Energy field effect");
        (0, assert_1.deepEqual)(projection.byActiveSkillSetId["323"], {
            semanticStatus: "test-only-untrusted",
            sourceSnapshotId: "glb-db-1787900894",
            activeSkillSetId: "323",
            field: {
                id: "11",
                name: "Earth Shrouded in Minus Energy",
                resourceId: "3010",
                description: "Earth Shrouded in Minus Energy field effect",
            },
            provenance: {
                activeSkillSet: { table: "active_skill_sets", rowId: "323" },
                relation: { table: "dokkan_field_active_skill_set_relations", rowId: "13" },
                field: { table: "dokkan_fields", rowId: "11" },
            },
        });
        (0, assert_1.equal)(projection.byActiveSkillSetId["376"].field.name, "New Red Ribbon Army's Base (Ruined)");
        (0, assert_1.equal)("999" in projection.byActiveSkillSetId, false);
    });
    (0, mocha_1.it)("accepts a future relation only when its first-party joins and explicit description prove it", () => {
        const future = fixture("glb-db-future");
        future.fieldTables.dokkan_field_efficacy_sets.push({ id: "14" });
        future.fieldTables.dokkan_fields.push({
            id: "14",
            dokkan_field_efficacy_set_id: "14",
            name: "Future Domain",
            resource_id: "3013",
            description: "Future field effect",
        });
        future.fieldTables.dokkan_field_active_skill_set_relations.push({
            id: "16",
            dokkan_field_id: "14",
            active_skill_set_id: "400",
        });
        future.activeSkillSets.push({
            id: "400",
            effect_description: "Creates the Domain \"Future Domain\" for 3 turns",
        });
        const projection = (0, game_db_dokkan_field_created_domain_1.buildCurrentSnapshotAuditedCreatedDomainProjection)({
            sourceSnapshotId: "glb-db-future",
            fieldTables: future.fieldTables,
            activeSkillSetRows: future.activeSkillSets,
        });
        (0, assert_1.equal)(Object.keys(projection.byActiveSkillSetId).length, 16);
        (0, assert_1.equal)(projection.byActiveSkillSetId["400"].field.name, "Future Domain");
        future.activeSkillSets[future.activeSkillSets.length - 1].effect_description = "Raises ATK only";
        (0, assert_1.throws)(() => (0, game_db_dokkan_field_created_domain_1.buildCurrentSnapshotAuditedCreatedDomainProjection)({
            sourceSnapshotId: "glb-db-future",
            fieldTables: future.fieldTables,
            activeSkillSetRows: future.activeSkillSets,
        }), /description proof drift/);
    });
    (0, mocha_1.it)("supports older identified snapshots with the 14-link inventory and rejects its removal later", () => {
        const older = fixture("glb-db-1785000000");
        older.fieldTables.dokkan_field_active_skill_set_relations.pop();
        older.fieldTables.dokkan_fields.pop();
        older.fieldTables.dokkan_field_efficacy_sets.pop();
        older.activeSkillSets.pop();
        const projection = (0, game_db_dokkan_field_created_domain_1.buildCurrentSnapshotAuditedCreatedDomainProjection)({
            sourceSnapshotId: "glb-db-1785000000",
            fieldTables: older.fieldTables,
            activeSkillSetRows: older.activeSkillSets,
        });
        (0, assert_1.equal)(Object.keys(projection.byActiveSkillSetId).length, 14);
        const boundary = fixture("glb-db-1787282006");
        (0, assert_1.equal)(Object.keys((0, game_db_dokkan_field_created_domain_1.buildCurrentSnapshotAuditedCreatedDomainProjection)({
            sourceSnapshotId: "glb-db-1787282006",
            fieldTables: boundary.fieldTables,
            activeSkillSetRows: boundary.activeSkillSets,
        }).byActiveSkillSetId).length, 15);
        (0, assert_1.throws)(() => (0, game_db_dokkan_field_created_domain_1.buildCurrentSnapshotAuditedCreatedDomainProjection)({
            sourceSnapshotId: "glb-db-1787900894",
            fieldTables: older.fieldTables,
            activeSkillSetRows: older.activeSkillSets,
        }), /active relation inventory drift/);
    });
    (0, mocha_1.it)("fails closed for unidentified snapshot, relation, field, or description drift", () => {
        const snapshotDrift = fixture();
        snapshotDrift.sidecar.source.snapshotId = "";
        (0, assert_1.throws)(() => (0, game_db_dokkan_field_created_domain_1.buildSnapshotAuditedCreatedDomainProjectionForTest)(snapshotDrift.sidecar, snapshotDrift.activeSkillSets), /complete identified first-party snapshot/);
        const relationDrift = fixture();
        relationDrift.sidecar.rows.dokkan_field_active_skill_set_relations[0].values.dokkan_field_id = "2";
        (0, assert_1.throws)(() => (0, game_db_dokkan_field_created_domain_1.buildSnapshotAuditedCreatedDomainProjectionForTest)(relationDrift.sidecar, relationDrift.activeSkillSets), /audited link drift/);
        const fieldDrift = fixture();
        fieldDrift.sidecar.rows.dokkan_fields[0].values.resource_id = "9999";
        (0, assert_1.throws)(() => (0, game_db_dokkan_field_created_domain_1.buildSnapshotAuditedCreatedDomainProjectionForTest)(fieldDrift.sidecar, fieldDrift.activeSkillSets), /audited link drift/);
        const fieldDescriptionDrift = fixture();
        fieldDescriptionDrift.sidecar.rows.dokkan_fields[0].values.description = "";
        (0, assert_1.throws)(() => (0, game_db_dokkan_field_created_domain_1.buildSnapshotAuditedCreatedDomainProjectionForTest)(fieldDescriptionDrift.sidecar, fieldDescriptionDrift.activeSkillSets), /field description drift/);
        const descriptionDrift = fixture();
        descriptionDrift.activeSkillSets[0].effect_description = "Raises ATK only";
        (0, assert_1.throws)(() => (0, game_db_dokkan_field_created_domain_1.buildSnapshotAuditedCreatedDomainProjectionForTest)(descriptionDrift.sidecar, descriptionDrift.activeSkillSets), /description proof drift/);
    });
    (0, mocha_1.it)("repairs an inherited Omega baseline entry while preserving a richer legacy fallback", () => {
        const current = fixture();
        const projection = (0, game_db_dokkan_field_created_domain_1.buildCurrentSnapshotAuditedCreatedDomainProjection)({
            sourceSnapshotId: "glb-db-1787900894",
            fieldTables: current.fieldTables,
            activeSkillSetRows: current.activeSkillSets,
        });
        const omega = {
            id: "1031501",
            activeSkillDetails: [{ id: "323" }],
            domain: "Earth Shrouded in Minus Energy: Legacy full Domain effect",
        };
        const result = (0, game_db_dokkan_field_created_domain_1.applySnapshotAuditedCreatedDomainsToCharacters)([omega], projection);
        (0, assert_1.equal)(result.characters[0].createdDomain?.activeSkillSetId, "323");
        (0, assert_1.equal)(result.characters[0].createdDomain?.field.name, "Earth Shrouded in Minus Energy");
        (0, assert_1.equal)(result.characters[0].domain, "Earth Shrouded in Minus Energy: Legacy full Domain effect");
        (0, assert_1.deepEqual)(result.patches, [{ characterId: "1031501", activeSkillSetId: "323", fieldId: "11" }]);
        (0, assert_1.equal)(omega.createdDomain, undefined);
        const blankFallback = (0, game_db_dokkan_field_created_domain_1.applySnapshotAuditedCreatedDomainsToCharacters)([{
                ...omega,
                domain: "",
            }], projection);
        (0, assert_1.equal)(blankFallback.characters[0].domain, "Earth Shrouded in Minus Energy: Earth Shrouded in Minus Energy field effect");
        (0, assert_1.deepEqual)((0, game_db_dokkan_field_created_domain_1.applySnapshotAuditedCreatedDomainsToCharacters)(blankFallback.characters, projection).patches, []);
    });
    (0, mocha_1.it)("rejects conflicting baseline Domain identity and singular-contract ambiguity", () => {
        const current = fixture();
        const projection = (0, game_db_dokkan_field_created_domain_1.buildCurrentSnapshotAuditedCreatedDomainProjection)({
            sourceSnapshotId: "glb-db-1787900894",
            fieldTables: current.fieldTables,
            activeSkillSetRows: current.activeSkillSets,
        });
        (0, assert_1.throws)(() => (0, game_db_dokkan_field_created_domain_1.applySnapshotAuditedCreatedDomainsToCharacters)([{
                id: "1031501",
                activeSkillDetails: [{ id: "323" }],
                createdDomain: { activeSkillSetId: "999", field: { id: "999" } },
                domain: "Wrong",
            }], projection), /conflicting Created Domain data/);
        (0, assert_1.throws)(() => (0, game_db_dokkan_field_created_domain_1.applySnapshotAuditedCreatedDomainsToCharacters)([{
                id: "future",
                activeSkillDetails: [{ id: "323" }, { id: "376" }],
                domain: "",
            }], projection), /multiple Created Domains/);
        (0, assert_1.throws)(() => (0, game_db_dokkan_field_created_domain_1.applySnapshotAuditedCreatedDomainsToCharacters)([{
                id: "1031501",
                activeSkillDetails: [{ id: "323" }],
                domain: "Wrong legacy Domain",
            }], projection), /conflicting legacy Domain data/);
    });
    (0, mocha_1.it)("rejects caller-supplied sources that are not the exact audited bytes", () => {
        (0, assert_1.throws)(() => (0, game_db_dokkan_field_created_domain_1.buildSnapshotAuditedCreatedDomainProjection)({
            sidecarPayload: Buffer.from("synthetic"),
            sidecarManifest: {},
            activeSkillSetsCsv: Buffer.from("id,effect_description\n198,synthetic\n"),
        }), /sidecar payload source identity drift/);
        (0, assert_1.throws)(() => (0, game_db_dokkan_field_created_domain_1.buildSnapshotAuditedCreatedDomainEnrichedCharacters)({
            characters: [],
            sidecarPayload: Buffer.from("synthetic"),
            sidecarManifest: {},
            activeSkillSetsCsv: Buffer.from("id,effect_description\n198,synthetic\n"),
        }), /sidecar payload source identity drift/);
    });
});
//# sourceMappingURL=game-db-dokkan-field-created-domain.spec.js.map