import { deepEqual, equal, throws } from "assert";
import { describe, it } from "mocha";
import {
    AUDITED_CREATED_DOMAIN_LINKS,
    buildSnapshotAuditedCreatedDomainProjection,
    buildSnapshotAuditedCreatedDomainProjectionForTest,
    CREATED_DOMAIN_AUDITED_SNAPSHOT_ID,
} from "./game-db-dokkan-field-created-domain";
import { buildGameDbDokkanFieldSidecar } from "./game-db-dokkan-field-sidecar";
import { GameDbRow } from "./game-db-source";

function fixture() {
    const fields = [...new Map(AUDITED_CREATED_DOMAIN_LINKS.map(link => [link.fieldId, link])).values()];
    const sidecar = buildGameDbDokkanFieldSidecar(CREATED_DOMAIN_AUDITED_SNAPSHOT_ID, {
        dokkan_fields: fields.map(link => ({
            id: link.fieldId,
            dokkan_field_efficacy_set_id: link.fieldId,
            name: link.fieldName,
            resource_id: link.resourceId,
        })),
        dokkan_field_efficacy_sets: fields.map(link => ({ id: link.fieldId })),
        dokkan_field_efficacies: [],
        dokkan_field_active_skill_set_relations: AUDITED_CREATED_DOMAIN_LINKS.map(link => ({
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
    const activeSkillSets: GameDbRow[] = AUDITED_CREATED_DOMAIN_LINKS.map(link => ({
        id: link.activeSkillSetId,
        effect_description: `Other effect;\n creates the Domain \"${link.fieldName}\" for an unprojected duration`,
        turn: "999",
    }));
    return { sidecar, activeSkillSets };
}

describe("buildSnapshotAuditedCreatedDomainProjection", function () {
    it("emits the exact 14 snapshot-audited Active Skill links without lifecycle claims", () => {
        const { sidecar, activeSkillSets } = fixture();
        const projection = buildSnapshotAuditedCreatedDomainProjectionForTest(sidecar, activeSkillSets);

        equal(Object.keys(projection.byActiveSkillSetId).length, 14);
        equal(projection.semanticStatus, "test-only-untrusted");
        deepEqual(projection.excludedSemantics, ["duration", "field-effects", "passive-created-domain"]);
        equal("duration" in projection.byActiveSkillSetId["323"], false);
        equal("description" in projection.byActiveSkillSetId["323"].field, false);
        deepEqual(projection.byActiveSkillSetId["323"], {
            semanticStatus: "test-only-untrusted",
            sourceSnapshotId: CREATED_DOMAIN_AUDITED_SNAPSHOT_ID,
            activeSkillSetId: "323",
            field: { id: "11", name: "Earth Shrouded in Minus Energy", resourceId: "3010" },
            provenance: {
                activeSkillSet: { table: "active_skill_sets", rowId: "323" },
                relation: { table: "dokkan_field_active_skill_set_relations", rowId: "13" },
                field: { table: "dokkan_fields", rowId: "11" },
            },
        });
        equal("999" in projection.byActiveSkillSetId, false);
    });

    it("fails closed for snapshot, relation, field, or description drift", () => {
        const snapshotDrift = fixture();
        snapshotDrift.sidecar.source.snapshotId = "glb-db-future";
        throws(
            () => buildSnapshotAuditedCreatedDomainProjectionForTest(snapshotDrift.sidecar, snapshotDrift.activeSkillSets),
            /exact complete audited snapshot/,
        );

        const relationDrift = fixture();
        relationDrift.sidecar.rows.dokkan_field_active_skill_set_relations[0].values.dokkan_field_id = "2";
        throws(
            () => buildSnapshotAuditedCreatedDomainProjectionForTest(relationDrift.sidecar, relationDrift.activeSkillSets),
            /audited link drift/,
        );

        const fieldDrift = fixture();
        fieldDrift.sidecar.rows.dokkan_fields[0].values.resource_id = "9999";
        throws(
            () => buildSnapshotAuditedCreatedDomainProjectionForTest(fieldDrift.sidecar, fieldDrift.activeSkillSets),
            /audited link drift/,
        );

        const descriptionDrift = fixture();
        descriptionDrift.activeSkillSets[0].effect_description = "Raises ATK only";
        throws(
            () => buildSnapshotAuditedCreatedDomainProjectionForTest(descriptionDrift.sidecar, descriptionDrift.activeSkillSets),
            /description proof drift/,
        );
    });

    it("rejects caller-supplied sources that are not the exact audited bytes", () => {
        throws(
            () => buildSnapshotAuditedCreatedDomainProjection({
                sidecarPayload: Buffer.from("synthetic"),
                sidecarManifest: {} as never,
                activeSkillSetsCsv: Buffer.from("id,effect_description\n198,synthetic\n"),
            }),
            /sidecar payload source identity drift/,
        );
    });
});
