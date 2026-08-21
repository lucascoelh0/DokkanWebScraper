import { createHash } from "crypto";
import {
    GameDbDokkanFieldSidecarManifestV1,
    validateGameDbDokkanFieldSidecarArtifact,
} from "./game-db-dokkan-field-sidecar-artifact";
import { GameDbDokkanFieldSidecarV1 } from "./game-db-dokkan-field-sidecar";
import type { GameDbCharacterSnapshot } from "./game-db-contract";
import { GameDbRow, normalizeDbId, parseGameDbTableCsvText } from "./game-db-source";

export const CREATED_DOMAIN_AUDITED_SNAPSHOT_ID = "glb-db-1782367825";
export const CREATED_DOMAIN_AUDITED_SOURCE_PIN = {
    sidecarPayload: {
        sha256: "df51aa8998d0bd2f22af00221e9a99dcf750558147d23a58f88ec8dbb8ee05e1",
        sizeBytes: 3_088,
    },
    activeSkillSetsCsv: {
        sha256: "bfef7168869a05d3c1142e251111b8ba13a59575e44d182d188231d73183a1f3",
        sizeBytes: 120_462,
    },
} as const;

export interface AuditedCreatedDomainLink {
    relationRowId: string,
    activeSkillSetId: string,
    fieldId: string,
    fieldName: string,
    resourceId: string,
}

export const AUDITED_CREATED_DOMAIN_LINKS: AuditedCreatedDomainLink[] = [
    { relationRowId: "1", activeSkillSetId: "198", fieldId: "1", fieldName: "Wasteland (Future)", resourceId: "3001" },
    { relationRowId: "2", activeSkillSetId: "202", fieldId: "2", fieldName: "Infinite Zamasu", resourceId: "3000" },
    { relationRowId: "3", activeSkillSetId: "203", fieldId: "2", fieldName: "Infinite Zamasu", resourceId: "3000" },
    { relationRowId: "4", activeSkillSetId: "219", fieldId: "4", fieldName: "City (Future) (Rift in Time)", resourceId: "3003" },
    { relationRowId: "5", activeSkillSetId: "228", fieldId: "4", fieldName: "City (Future) (Rift in Time)", resourceId: "3003" },
    { relationRowId: "6", activeSkillSetId: "223", fieldId: "5", fieldName: "Extradimensional Space", resourceId: "3004" },
    { relationRowId: "7", activeSkillSetId: "224", fieldId: "5", fieldName: "Extradimensional Space", resourceId: "3004" },
    { relationRowId: "8", activeSkillSetId: "245", fieldId: "6", fieldName: "Illuminated World of Void", resourceId: "3005" },
    { relationRowId: "9", activeSkillSetId: "246", fieldId: "6", fieldName: "Illuminated World of Void", resourceId: "3005" },
    { relationRowId: "10", activeSkillSetId: "253", fieldId: "7", fieldName: "Molten Lava of Natade Village", resourceId: "3006" },
    { relationRowId: "11", activeSkillSetId: "269", fieldId: "8", fieldName: "Inside Majin Buu", resourceId: "3008" },
    { relationRowId: "12", activeSkillSetId: "280", fieldId: "8", fieldName: "Inside Majin Buu", resourceId: "3008" },
    { relationRowId: "13", activeSkillSetId: "323", fieldId: "11", fieldName: "Earth Shrouded in Minus Energy", resourceId: "3010" },
    { relationRowId: "14", activeSkillSetId: "373", fieldId: "12", fieldName: "Tree of Might", resourceId: "3011" },
];

export interface GameDbSnapshotAuditedCreatedDomain {
    semanticStatus: "snapshot-audited",
    sourceSnapshotId: typeof CREATED_DOMAIN_AUDITED_SNAPSHOT_ID,
    activeSkillSetId: string,
    field: {
        id: string,
        name: string,
        resourceId: string,
    },
    provenance: {
        activeSkillSet: { table: "active_skill_sets", rowId: string },
        relation: { table: "dokkan_field_active_skill_set_relations", rowId: string },
        field: { table: "dokkan_fields", rowId: string },
    },
}

export interface GameDbSnapshotAuditedCreatedDomainProjectionV1 {
    schemaVersion: "game-db-created-domain-projection-v1",
    sourceSnapshotId: typeof CREATED_DOMAIN_AUDITED_SNAPSHOT_ID,
    semanticStatus: "snapshot-audited",
    scope: "active-skills-only",
    excludedSemantics: ["duration", "field-effects", "passive-created-domain"],
    byActiveSkillSetId: Record<string, GameDbSnapshotAuditedCreatedDomain>,
}

export interface GameDbUntrustedCreatedDomainProjectionForTest {
    schemaVersion: "game-db-created-domain-projection-test-only-v1",
    sourceSnapshotId: string,
    semanticStatus: "test-only-untrusted",
    scope: "active-skills-only",
    excludedSemantics: ["duration", "field-effects", "passive-created-domain"],
    byActiveSkillSetId: Record<string, Omit<GameDbSnapshotAuditedCreatedDomain, "semanticStatus"> & {
        semanticStatus: "test-only-untrusted",
    }>,
}

function normalizeDisplayText(value?: string): string {
    return (value ?? "").split(/\s+/).filter(Boolean).join(" ").toLowerCase();
}

function uniqueRowsById(rows: GameDbRow[], table: string): Map<string, GameDbRow> {
    const byId = new Map<string, GameDbRow>();
    for (const row of rows) {
        const id = normalizeDbId(row.id);
        if (!id || byId.has(id)) {
            throw new Error(`${table} has a missing or duplicate id`);
        }
        byId.set(id, row);
    }
    return byId;
}

function buildSnapshotAuditedCreatedDomainProjectionFromParsedSources(
    sidecar: GameDbDokkanFieldSidecarV1,
    activeSkillSetRows: GameDbRow[],
): GameDbSnapshotAuditedCreatedDomainProjectionV1 {
    if (sidecar.source.snapshotId !== CREATED_DOMAIN_AUDITED_SNAPSHOT_ID
        || sidecar.source.kind !== "first-party-game-db-snapshot"
        || sidecar.includedTableIntegrity.status !== "complete") {
        throw new Error("Created Domain projection requires the exact complete audited snapshot");
    }

    const activeSkillSetsById = uniqueRowsById(activeSkillSetRows, "active_skill_sets");
    const fieldsById = new Map(sidecar.rows.dokkan_fields.map(row => [row.id, row]));
    const relationsById = new Map(sidecar.rows.dokkan_field_active_skill_set_relations.map(row => [row.id, row]));
    if (relationsById.size !== AUDITED_CREATED_DOMAIN_LINKS.length) {
        throw new Error("Created Domain active relation inventory drift");
    }

    const byActiveSkillSetId: Record<string, GameDbSnapshotAuditedCreatedDomain> = {};
    for (const audited of AUDITED_CREATED_DOMAIN_LINKS) {
        const relation = relationsById.get(audited.relationRowId);
        const field = fieldsById.get(audited.fieldId);
        const activeSkillSet = activeSkillSetsById.get(audited.activeSkillSetId);
        if (!relation
            || normalizeDbId(relation.values.active_skill_set_id) !== audited.activeSkillSetId
            || normalizeDbId(relation.values.dokkan_field_id) !== audited.fieldId
            || !field
            || field.values.name !== audited.fieldName
            || normalizeDbId(field.values.resource_id) !== audited.resourceId
            || !activeSkillSet) {
            throw new Error(`Created Domain audited link drift for active skill set ${audited.activeSkillSetId}`);
        }

        const expectedPhrase = normalizeDisplayText(`creates the Domain "${audited.fieldName}"`);
        if (!normalizeDisplayText(activeSkillSet.effect_description).includes(expectedPhrase)) {
            throw new Error(`Created Domain description proof drift for active skill set ${audited.activeSkillSetId}`);
        }
        if (byActiveSkillSetId[audited.activeSkillSetId]) {
            throw new Error(`Created Domain duplicate active skill set ${audited.activeSkillSetId}`);
        }

        byActiveSkillSetId[audited.activeSkillSetId] = {
            semanticStatus: "snapshot-audited",
            sourceSnapshotId: CREATED_DOMAIN_AUDITED_SNAPSHOT_ID,
            activeSkillSetId: audited.activeSkillSetId,
            field: {
                id: audited.fieldId,
                name: audited.fieldName,
                resourceId: audited.resourceId,
            },
            provenance: {
                activeSkillSet: { table: "active_skill_sets", rowId: audited.activeSkillSetId },
                relation: {
                    table: "dokkan_field_active_skill_set_relations",
                    rowId: audited.relationRowId,
                },
                field: { table: "dokkan_fields", rowId: audited.fieldId },
            },
        };
    }

    return {
        schemaVersion: "game-db-created-domain-projection-v1",
        sourceSnapshotId: CREATED_DOMAIN_AUDITED_SNAPSHOT_ID,
        semanticStatus: "snapshot-audited",
        scope: "active-skills-only",
        excludedSemantics: ["duration", "field-effects", "passive-created-domain"],
        byActiveSkillSetId,
    };
}

function sha256(bytes: Buffer): string {
    return createHash("sha256").update(bytes).digest("hex");
}

function assertPinnedBytes(bytes: Buffer, pin: { sha256: string, sizeBytes: number }, label: string): void {
    if (bytes.byteLength !== pin.sizeBytes || sha256(bytes) !== pin.sha256) {
        throw new Error(`Created Domain ${label} source identity drift`);
    }
}

export function buildSnapshotAuditedCreatedDomainProjection(options: {
    sidecarPayload: Buffer,
    sidecarManifest: GameDbDokkanFieldSidecarManifestV1,
    activeSkillSetsCsv: Buffer,
}): GameDbSnapshotAuditedCreatedDomainProjectionV1 {
    assertPinnedBytes(options.sidecarPayload, CREATED_DOMAIN_AUDITED_SOURCE_PIN.sidecarPayload, "sidecar payload");
    assertPinnedBytes(
        options.activeSkillSetsCsv,
        CREATED_DOMAIN_AUDITED_SOURCE_PIN.activeSkillSetsCsv,
        "active_skill_sets.csv",
    );
    const sidecar = validateGameDbDokkanFieldSidecarArtifact(options.sidecarPayload, options.sidecarManifest);
    const activeSkillSetRows = parseGameDbTableCsvText(options.activeSkillSetsCsv.toString("utf8"));
    return buildSnapshotAuditedCreatedDomainProjectionFromParsedSources(sidecar, activeSkillSetRows);
}

function enrichGameDbCharacterSnapshotsWithCreatedDomains(
    characters: GameDbCharacterSnapshot[],
    projection: GameDbSnapshotAuditedCreatedDomainProjectionV1,
): GameDbCharacterSnapshot[] {
    return characters.map(character => {
        let changed = false;
        const activeSkillSets = character.activeSkillSets.map(activeSkillSet => {
            const createdDomain = projection.byActiveSkillSetId[activeSkillSet.id];
            if (!createdDomain) {
                return activeSkillSet;
            }
            changed = true;
            return { ...activeSkillSet, createdDomain };
        });
        return changed ? { ...character, activeSkillSets } : character;
    });
}

export function buildSnapshotAuditedCreatedDomainEnrichedCharacters(options: {
    characters: GameDbCharacterSnapshot[],
    sidecarPayload: Buffer,
    sidecarManifest: GameDbDokkanFieldSidecarManifestV1,
    activeSkillSetsCsv: Buffer,
}): {
    characters: GameDbCharacterSnapshot[],
    projection: GameDbSnapshotAuditedCreatedDomainProjectionV1,
} {
    const projection = buildSnapshotAuditedCreatedDomainProjection(options);
    return {
        characters: enrichGameDbCharacterSnapshotsWithCreatedDomains(options.characters, projection),
        projection,
    };
}

export function buildSnapshotAuditedCreatedDomainProjectionForTest(
    sidecar: GameDbDokkanFieldSidecarV1,
    activeSkillSetRows: GameDbRow[],
): GameDbUntrustedCreatedDomainProjectionForTest {
    const projection = buildSnapshotAuditedCreatedDomainProjectionFromParsedSources(sidecar, activeSkillSetRows);
    return {
        schemaVersion: "game-db-created-domain-projection-test-only-v1",
        sourceSnapshotId: projection.sourceSnapshotId,
        semanticStatus: "test-only-untrusted",
        scope: projection.scope,
        excludedSemantics: projection.excludedSemantics,
        byActiveSkillSetId: Object.fromEntries(Object.entries(projection.byActiveSkillSetId).map(([id, value]) => [
            id,
            { ...value, semanticStatus: "test-only-untrusted" as const },
        ])),
    };
}
