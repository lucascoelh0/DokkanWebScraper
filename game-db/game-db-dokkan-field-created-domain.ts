import { createHash } from "crypto";
import {
    GameDbDokkanFieldSidecarManifestV1,
    validateGameDbDokkanFieldSidecarArtifact,
} from "./game-db-dokkan-field-sidecar-artifact";
import type { Character } from "../character";
import {
    buildGameDbDokkanFieldSidecar,
    GameDbDokkanFieldSidecarTables,
    GameDbDokkanFieldSidecarV1,
} from "./game-db-dokkan-field-sidecar";
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
    { relationRowId: "15", activeSkillSetId: "376", fieldId: "13", fieldName: "New Red Ribbon Army's Base (Ruined)", resourceId: "3012" },
];

const PINNED_CREATED_DOMAIN_LINKS = AUDITED_CREATED_DOMAIN_LINKS.slice(0, 14);
const FIFTEENTH_CREATED_DOMAIN_FIRST_AUDITED_DB_VERSION = BigInt("1787282006");

export interface GameDbSnapshotAuditedCreatedDomain {
    semanticStatus: "snapshot-audited",
    sourceSnapshotId: string,
    activeSkillSetId: string,
    field: {
        id: string,
        name: string,
        resourceId: string,
        description: string,
    },
    provenance: {
        activeSkillSet: { table: "active_skill_sets", rowId: string },
        relation: { table: "dokkan_field_active_skill_set_relations", rowId: string },
        field: { table: "dokkan_fields", rowId: string },
    },
}

export interface GameDbSnapshotAuditedCreatedDomainProjectionV1 {
    schemaVersion: "game-db-created-domain-projection-v1",
    sourceSnapshotId: string,
    semanticStatus: "snapshot-audited",
    scope: "active-skills-only",
    excludedSemantics: ["duration", "structured-field-efficacies", "passive-created-domain"],
    byActiveSkillSetId: Record<string, GameDbSnapshotAuditedCreatedDomain>,
}

export interface GameDbUntrustedCreatedDomainProjectionForTest {
    schemaVersion: "game-db-created-domain-projection-test-only-v1",
    sourceSnapshotId: string,
    semanticStatus: "test-only-untrusted",
    scope: "active-skills-only",
    excludedSemantics: ["duration", "structured-field-efficacies", "passive-created-domain"],
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
    auditedLinks: AuditedCreatedDomainLink[],
    requireExactInventory: boolean,
): GameDbSnapshotAuditedCreatedDomainProjectionV1 {
    if (sidecar.source.kind !== "first-party-game-db-snapshot"
        || !sidecar.source.snapshotId.trim()
        || sidecar.includedTableIntegrity.status !== "complete") {
        throw new Error("Created Domain projection requires a complete identified first-party snapshot");
    }

    const activeSkillSetsById = uniqueRowsById(activeSkillSetRows, "active_skill_sets");
    const fieldsById = new Map(sidecar.rows.dokkan_fields.map(row => [row.id, row]));
    const relationsById = new Map(sidecar.rows.dokkan_field_active_skill_set_relations.map(row => [row.id, row]));
    if ((requireExactInventory && relationsById.size !== auditedLinks.length)
        || relationsById.size < auditedLinks.length) {
        throw new Error("Created Domain active relation inventory drift");
    }

    for (const audited of auditedLinks) {
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

    }

    const byActiveSkillSetId: Record<string, GameDbSnapshotAuditedCreatedDomain> = {};
    for (const relation of sidecar.rows.dokkan_field_active_skill_set_relations) {
        const activeSkillSetId = normalizeDbId(relation.values.active_skill_set_id);
        const fieldId = normalizeDbId(relation.values.dokkan_field_id);
        const field = fieldId ? fieldsById.get(fieldId) : undefined;
        const activeSkillSet = activeSkillSetId ? activeSkillSetsById.get(activeSkillSetId) : undefined;
        const fieldName = field?.values.name?.trim();
        const resourceId = normalizeDbId(field?.values.resource_id);
        if (!activeSkillSetId || !fieldId || !field || !activeSkillSet || !fieldName || !resourceId) {
            throw new Error(`Created Domain relation ${relation.id} has unresolved first-party references`);
        }

        const expectedPhrase = normalizeDisplayText(`creates the Domain "${fieldName}"`);
        if (!normalizeDisplayText(activeSkillSet.effect_description).includes(expectedPhrase)) {
            throw new Error(`Created Domain description proof drift for active skill set ${activeSkillSetId}`);
        }
        const fieldDescription = field.values.description?.trim();
        if (!fieldDescription) {
            throw new Error(`Created Domain field description drift for active skill set ${activeSkillSetId}`);
        }
        if (byActiveSkillSetId[activeSkillSetId]) {
            throw new Error(`Created Domain duplicate active skill set ${activeSkillSetId}`);
        }

        byActiveSkillSetId[activeSkillSetId] = {
            semanticStatus: "snapshot-audited",
            sourceSnapshotId: sidecar.source.snapshotId,
            activeSkillSetId,
            field: {
                id: fieldId,
                name: fieldName,
                resourceId,
                description: fieldDescription,
            },
            provenance: {
                activeSkillSet: { table: "active_skill_sets", rowId: activeSkillSetId },
                relation: {
                    table: "dokkan_field_active_skill_set_relations",
                    rowId: relation.id,
                },
                field: { table: "dokkan_fields", rowId: fieldId },
            },
        };
    }

    return {
        schemaVersion: "game-db-created-domain-projection-v1",
        sourceSnapshotId: sidecar.source.snapshotId,
        semanticStatus: "snapshot-audited",
        scope: "active-skills-only",
        excludedSemantics: ["duration", "structured-field-efficacies", "passive-created-domain"],
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
    return buildSnapshotAuditedCreatedDomainProjectionFromParsedSources(
        sidecar,
        activeSkillSetRows,
        PINNED_CREATED_DOMAIN_LINKS,
        true,
    );
}

export function buildCurrentSnapshotAuditedCreatedDomainProjection(options: {
    sourceSnapshotId: string,
    fieldTables: GameDbDokkanFieldSidecarTables,
    activeSkillSetRows: GameDbRow[],
}): GameDbSnapshotAuditedCreatedDomainProjectionV1 {
    const numericVersion = /^glb-db-(\d+)$/.exec(options.sourceSnapshotId)?.[1];
    const auditedLinks = numericVersion
        && BigInt(numericVersion) < FIFTEENTH_CREATED_DOMAIN_FIRST_AUDITED_DB_VERSION
        ? PINNED_CREATED_DOMAIN_LINKS
        : AUDITED_CREATED_DOMAIN_LINKS;
    return buildSnapshotAuditedCreatedDomainProjectionFromParsedSources(
        buildGameDbDokkanFieldSidecar(options.sourceSnapshotId, options.fieldTables),
        options.activeSkillSetRows,
        auditedLinks,
        false,
    );
}

export function enrichGameDbCharacterSnapshotsWithCreatedDomains(
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

export interface CreatedDomainCharacterPatch {
    characterId: string,
    activeSkillSetId: string,
    fieldId: string,
}

export function applySnapshotAuditedCreatedDomainsToCharacters(
    characters: Character[],
    projection: GameDbSnapshotAuditedCreatedDomainProjectionV1,
): { characters: Character[], patches: CreatedDomainCharacterPatch[] } {
    const patches: CreatedDomainCharacterPatch[] = [];
    const updatedCharacters = characters.map(character => {
        const matches = (character.activeSkillDetails ?? [])
            .map(activeSkill => projection.byActiveSkillSetId[activeSkill.id])
            .filter((value): value is GameDbSnapshotAuditedCreatedDomain => Boolean(value));
        const distinctMatches = [...new Map(matches.map(value => [value.activeSkillSetId, value])).values()];
        if (distinctMatches.length === 0) {
            return character;
        }
        if (distinctMatches.length > 1) {
            throw new Error(`Character ${character.id} has multiple Created Domains in a singular field contract`);
        }

        const createdDomain = distinctMatches[0];
        if (character.createdDomain
            && (character.createdDomain.activeSkillSetId !== createdDomain.activeSkillSetId
                || character.createdDomain.field.id !== createdDomain.field.id)) {
            throw new Error(`Character ${character.id} has conflicting Created Domain data`);
        }
        const legacyDomain = `${createdDomain.field.name}: ${createdDomain.field.description}`;
        const existingLegacyDomain = character.domain?.trim() ?? "";
        if (existingLegacyDomain
            && existingLegacyDomain !== createdDomain.field.name
            && !existingLegacyDomain.startsWith(`${createdDomain.field.name}:`)) {
            throw new Error(`Character ${character.id} has conflicting legacy Domain data`);
        }
        const completeLegacyDomain = existingLegacyDomain.startsWith(`${createdDomain.field.name}:`)
            ? character.domain
            : legacyDomain;
        const alreadyCurrent = JSON.stringify(character.createdDomain) === JSON.stringify(createdDomain)
            && completeLegacyDomain === character.domain;
        if (alreadyCurrent) {
            return character;
        }

        patches.push({
            characterId: character.id,
            activeSkillSetId: createdDomain.activeSkillSetId,
            fieldId: createdDomain.field.id,
        });
        return {
            ...character,
            createdDomain,
            domain: completeLegacyDomain,
        };
    });
    return { characters: updatedCharacters, patches };
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
    const projection = buildSnapshotAuditedCreatedDomainProjectionFromParsedSources(
        sidecar,
        activeSkillSetRows,
        AUDITED_CREATED_DOMAIN_LINKS,
        false,
    );
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
