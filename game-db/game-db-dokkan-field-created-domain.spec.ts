import { deepEqual, equal, throws } from "assert";
import { describe, it } from "mocha";
import {
    AUDITED_CREATED_DOMAIN_LINKS,
    applySnapshotAuditedCreatedDomainsToCharacters,
    buildCurrentSnapshotAuditedCreatedDomainProjection,
    buildSnapshotAuditedCreatedDomainEnrichedCharacters,
    buildSnapshotAuditedCreatedDomainProjection,
    buildSnapshotAuditedCreatedDomainProjectionForTest,
} from "./game-db-dokkan-field-created-domain";
import {
    buildGameDbDokkanFieldSidecar,
    GameDbDokkanFieldSidecarTables,
} from "./game-db-dokkan-field-sidecar";
import { GameDbRow } from "./game-db-source";
import type { Character } from "../character";

function fixture(snapshotId = "glb-db-1787900894") {
    const fields = [...new Map(AUDITED_CREATED_DOMAIN_LINKS.map(link => [link.fieldId, link])).values()];
    const fieldTables: GameDbDokkanFieldSidecarTables = {
        dokkan_fields: fields.map(link => ({
            id: link.fieldId,
            dokkan_field_efficacy_set_id: link.fieldId,
            name: link.fieldName,
            resource_id: link.resourceId,
            description: `${link.fieldName} field effect`,
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
    };
    const sidecar = buildGameDbDokkanFieldSidecar(snapshotId, fieldTables);
    const activeSkillSets: GameDbRow[] = AUDITED_CREATED_DOMAIN_LINKS.map(link => ({
        id: link.activeSkillSetId,
        effect_description: `Other effect;\n creates the Domain \"${link.fieldName}\" for an unprojected duration`,
        turn: "999",
    }));
    return { sidecar, fieldTables, activeSkillSets };
}

describe("buildSnapshotAuditedCreatedDomainProjection", function () {
    it("emits all 15 currently audited Active Skill links without lifecycle claims", () => {
        const { sidecar, activeSkillSets } = fixture();
        const projection = buildSnapshotAuditedCreatedDomainProjectionForTest(sidecar, activeSkillSets);

        equal(Object.keys(projection.byActiveSkillSetId).length, 15);
        equal(projection.semanticStatus, "test-only-untrusted");
        deepEqual(
            projection.excludedSemantics,
            ["duration", "structured-field-efficacies", "passive-created-domain"],
        );
        equal("duration" in projection.byActiveSkillSetId["323"], false);
        equal(
            projection.byActiveSkillSetId["323"].field.description,
            "Earth Shrouded in Minus Energy field effect",
        );
        deepEqual(projection.byActiveSkillSetId["323"], {
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
        equal(
            projection.byActiveSkillSetId["376"].field.name,
            "New Red Ribbon Army's Base (Ruined)",
        );
        equal("999" in projection.byActiveSkillSetId, false);
    });

    it("accepts a future relation only when its first-party joins and explicit description prove it", () => {
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

        const projection = buildCurrentSnapshotAuditedCreatedDomainProjection({
            sourceSnapshotId: "glb-db-future",
            fieldTables: future.fieldTables,
            activeSkillSetRows: future.activeSkillSets,
        });
        equal(Object.keys(projection.byActiveSkillSetId).length, 16);
        equal(projection.byActiveSkillSetId["400"].field.name, "Future Domain");

        future.activeSkillSets[future.activeSkillSets.length - 1].effect_description = "Raises ATK only";
        throws(() => buildCurrentSnapshotAuditedCreatedDomainProjection({
            sourceSnapshotId: "glb-db-future",
            fieldTables: future.fieldTables,
            activeSkillSetRows: future.activeSkillSets,
        }), /description proof drift/);
    });

    it("supports older identified snapshots with the 14-link inventory and rejects its removal later", () => {
        const older = fixture("glb-db-1785000000");
        older.fieldTables.dokkan_field_active_skill_set_relations.pop();
        older.fieldTables.dokkan_fields.pop();
        older.fieldTables.dokkan_field_efficacy_sets.pop();
        older.activeSkillSets.pop();

        const projection = buildCurrentSnapshotAuditedCreatedDomainProjection({
            sourceSnapshotId: "glb-db-1785000000",
            fieldTables: older.fieldTables,
            activeSkillSetRows: older.activeSkillSets,
        });
        equal(Object.keys(projection.byActiveSkillSetId).length, 14);

        const boundary = fixture("glb-db-1787282006");
        equal(Object.keys(buildCurrentSnapshotAuditedCreatedDomainProjection({
            sourceSnapshotId: "glb-db-1787282006",
            fieldTables: boundary.fieldTables,
            activeSkillSetRows: boundary.activeSkillSets,
        }).byActiveSkillSetId).length, 15);

        throws(() => buildCurrentSnapshotAuditedCreatedDomainProjection({
            sourceSnapshotId: "glb-db-1787900894",
            fieldTables: older.fieldTables,
            activeSkillSetRows: older.activeSkillSets,
        }), /active relation inventory drift/);
    });

    it("fails closed for unidentified snapshot, relation, field, or description drift", () => {
        const snapshotDrift = fixture();
        snapshotDrift.sidecar.source.snapshotId = "";
        throws(
            () => buildSnapshotAuditedCreatedDomainProjectionForTest(snapshotDrift.sidecar, snapshotDrift.activeSkillSets),
            /complete identified first-party snapshot/,
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

        const fieldDescriptionDrift = fixture();
        fieldDescriptionDrift.sidecar.rows.dokkan_fields[0].values.description = "";
        throws(
            () => buildSnapshotAuditedCreatedDomainProjectionForTest(
                fieldDescriptionDrift.sidecar,
                fieldDescriptionDrift.activeSkillSets,
            ),
            /field description drift/,
        );

        const descriptionDrift = fixture();
        descriptionDrift.activeSkillSets[0].effect_description = "Raises ATK only";
        throws(
            () => buildSnapshotAuditedCreatedDomainProjectionForTest(descriptionDrift.sidecar, descriptionDrift.activeSkillSets),
            /description proof drift/,
        );
    });

    it("repairs an inherited Omega baseline entry while preserving a richer legacy fallback", () => {
        const current = fixture();
        const projection = buildCurrentSnapshotAuditedCreatedDomainProjection({
            sourceSnapshotId: "glb-db-1787900894",
            fieldTables: current.fieldTables,
            activeSkillSetRows: current.activeSkillSets,
        });
        const omega = {
            id: "1031501",
            activeSkillDetails: [{ id: "323" }],
            domain: "Earth Shrouded in Minus Energy: Legacy full Domain effect",
        } as unknown as Character;

        const result = applySnapshotAuditedCreatedDomainsToCharacters([omega], projection);

        equal(result.characters[0].createdDomain?.activeSkillSetId, "323");
        equal(result.characters[0].createdDomain?.field.name, "Earth Shrouded in Minus Energy");
        equal(result.characters[0].domain, "Earth Shrouded in Minus Energy: Legacy full Domain effect");
        deepEqual(result.patches, [{ characterId: "1031501", activeSkillSetId: "323", fieldId: "11" }]);
        equal(omega.createdDomain, undefined);

        const blankFallback = applySnapshotAuditedCreatedDomainsToCharacters([{
            ...omega,
            domain: "",
        }], projection);
        equal(
            blankFallback.characters[0].domain,
            "Earth Shrouded in Minus Energy: Earth Shrouded in Minus Energy field effect",
        );
        deepEqual(
            applySnapshotAuditedCreatedDomainsToCharacters(blankFallback.characters, projection).patches,
            [],
        );
    });

    it("rejects conflicting baseline Domain identity and singular-contract ambiguity", () => {
        const current = fixture();
        const projection = buildCurrentSnapshotAuditedCreatedDomainProjection({
            sourceSnapshotId: "glb-db-1787900894",
            fieldTables: current.fieldTables,
            activeSkillSetRows: current.activeSkillSets,
        });
        throws(() => applySnapshotAuditedCreatedDomainsToCharacters([{
            id: "1031501",
            activeSkillDetails: [{ id: "323" }],
            createdDomain: { activeSkillSetId: "999", field: { id: "999" } },
            domain: "Wrong",
        } as unknown as Character], projection), /conflicting Created Domain data/);
        throws(() => applySnapshotAuditedCreatedDomainsToCharacters([{
            id: "future",
            activeSkillDetails: [{ id: "323" }, { id: "376" }],
            domain: "",
        } as unknown as Character], projection), /multiple Created Domains/);
        throws(() => applySnapshotAuditedCreatedDomainsToCharacters([{
            id: "1031501",
            activeSkillDetails: [{ id: "323" }],
            domain: "Wrong legacy Domain",
        } as unknown as Character], projection), /conflicting legacy Domain data/);
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
        throws(
            () => buildSnapshotAuditedCreatedDomainEnrichedCharacters({
                characters: [],
                sidecarPayload: Buffer.from("synthetic"),
                sidecarManifest: {} as never,
                activeSkillSetsCsv: Buffer.from("id,effect_description\n198,synthetic\n"),
            }),
            /sidecar payload source identity drift/,
        );
    });

});
