"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildSnapshotAuditedCreatedDomainProjectionForTest = exports.buildSnapshotAuditedCreatedDomainEnrichedCharacters = exports.applySnapshotAuditedCreatedDomainsToCharacters = exports.enrichGameDbCharacterSnapshotsWithCreatedDomains = exports.buildCurrentSnapshotAuditedCreatedDomainProjection = exports.buildSnapshotAuditedCreatedDomainProjection = exports.AUDITED_CREATED_DOMAIN_LINKS = exports.CREATED_DOMAIN_AUDITED_SOURCE_PIN = exports.CREATED_DOMAIN_AUDITED_SNAPSHOT_ID = void 0;
const crypto_1 = require("crypto");
const game_db_dokkan_field_sidecar_artifact_1 = require("./game-db-dokkan-field-sidecar-artifact");
const game_db_dokkan_field_sidecar_1 = require("./game-db-dokkan-field-sidecar");
const game_db_source_1 = require("./game-db-source");
exports.CREATED_DOMAIN_AUDITED_SNAPSHOT_ID = "glb-db-1782367825";
exports.CREATED_DOMAIN_AUDITED_SOURCE_PIN = {
    sidecarPayload: {
        sha256: "df51aa8998d0bd2f22af00221e9a99dcf750558147d23a58f88ec8dbb8ee05e1",
        sizeBytes: 3088,
    },
    activeSkillSetsCsv: {
        sha256: "bfef7168869a05d3c1142e251111b8ba13a59575e44d182d188231d73183a1f3",
        sizeBytes: 120462,
    },
};
exports.AUDITED_CREATED_DOMAIN_LINKS = [
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
const PINNED_CREATED_DOMAIN_LINKS = exports.AUDITED_CREATED_DOMAIN_LINKS.slice(0, 14);
const FIFTEENTH_CREATED_DOMAIN_FIRST_AUDITED_DB_VERSION = BigInt("1787282006");
function normalizeDisplayText(value) {
    return (value ?? "").split(/\s+/).filter(Boolean).join(" ").toLowerCase();
}
function uniqueRowsById(rows, table) {
    const byId = new Map();
    for (const row of rows) {
        const id = (0, game_db_source_1.normalizeDbId)(row.id);
        if (!id || byId.has(id)) {
            throw new Error(`${table} has a missing or duplicate id`);
        }
        byId.set(id, row);
    }
    return byId;
}
function buildSnapshotAuditedCreatedDomainProjectionFromParsedSources(sidecar, activeSkillSetRows, auditedLinks, requireExactInventory) {
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
            || (0, game_db_source_1.normalizeDbId)(relation.values.active_skill_set_id) !== audited.activeSkillSetId
            || (0, game_db_source_1.normalizeDbId)(relation.values.dokkan_field_id) !== audited.fieldId
            || !field
            || field.values.name !== audited.fieldName
            || (0, game_db_source_1.normalizeDbId)(field.values.resource_id) !== audited.resourceId
            || !activeSkillSet) {
            throw new Error(`Created Domain audited link drift for active skill set ${audited.activeSkillSetId}`);
        }
    }
    const byActiveSkillSetId = {};
    for (const relation of sidecar.rows.dokkan_field_active_skill_set_relations) {
        const activeSkillSetId = (0, game_db_source_1.normalizeDbId)(relation.values.active_skill_set_id);
        const fieldId = (0, game_db_source_1.normalizeDbId)(relation.values.dokkan_field_id);
        const field = fieldId ? fieldsById.get(fieldId) : undefined;
        const activeSkillSet = activeSkillSetId ? activeSkillSetsById.get(activeSkillSetId) : undefined;
        const fieldName = field?.values.name?.trim();
        const resourceId = (0, game_db_source_1.normalizeDbId)(field?.values.resource_id);
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
function sha256(bytes) {
    return (0, crypto_1.createHash)("sha256").update(bytes).digest("hex");
}
function assertPinnedBytes(bytes, pin, label) {
    if (bytes.byteLength !== pin.sizeBytes || sha256(bytes) !== pin.sha256) {
        throw new Error(`Created Domain ${label} source identity drift`);
    }
}
function buildSnapshotAuditedCreatedDomainProjection(options) {
    assertPinnedBytes(options.sidecarPayload, exports.CREATED_DOMAIN_AUDITED_SOURCE_PIN.sidecarPayload, "sidecar payload");
    assertPinnedBytes(options.activeSkillSetsCsv, exports.CREATED_DOMAIN_AUDITED_SOURCE_PIN.activeSkillSetsCsv, "active_skill_sets.csv");
    const sidecar = (0, game_db_dokkan_field_sidecar_artifact_1.validateGameDbDokkanFieldSidecarArtifact)(options.sidecarPayload, options.sidecarManifest);
    const activeSkillSetRows = (0, game_db_source_1.parseGameDbTableCsvText)(options.activeSkillSetsCsv.toString("utf8"));
    return buildSnapshotAuditedCreatedDomainProjectionFromParsedSources(sidecar, activeSkillSetRows, PINNED_CREATED_DOMAIN_LINKS, true);
}
exports.buildSnapshotAuditedCreatedDomainProjection = buildSnapshotAuditedCreatedDomainProjection;
function buildCurrentSnapshotAuditedCreatedDomainProjection(options) {
    const numericVersion = /^glb-db-(\d+)$/.exec(options.sourceSnapshotId)?.[1];
    const auditedLinks = numericVersion
        && BigInt(numericVersion) < FIFTEENTH_CREATED_DOMAIN_FIRST_AUDITED_DB_VERSION
        ? PINNED_CREATED_DOMAIN_LINKS
        : exports.AUDITED_CREATED_DOMAIN_LINKS;
    return buildSnapshotAuditedCreatedDomainProjectionFromParsedSources((0, game_db_dokkan_field_sidecar_1.buildGameDbDokkanFieldSidecar)(options.sourceSnapshotId, options.fieldTables), options.activeSkillSetRows, auditedLinks, false);
}
exports.buildCurrentSnapshotAuditedCreatedDomainProjection = buildCurrentSnapshotAuditedCreatedDomainProjection;
function enrichGameDbCharacterSnapshotsWithCreatedDomains(characters, projection) {
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
exports.enrichGameDbCharacterSnapshotsWithCreatedDomains = enrichGameDbCharacterSnapshotsWithCreatedDomains;
function applySnapshotAuditedCreatedDomainsToCharacters(characters, projection) {
    const patches = [];
    const updatedCharacters = characters.map(character => {
        const matches = (character.activeSkillDetails ?? [])
            .map(activeSkill => projection.byActiveSkillSetId[activeSkill.id])
            .filter((value) => Boolean(value));
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
exports.applySnapshotAuditedCreatedDomainsToCharacters = applySnapshotAuditedCreatedDomainsToCharacters;
function buildSnapshotAuditedCreatedDomainEnrichedCharacters(options) {
    const projection = buildSnapshotAuditedCreatedDomainProjection(options);
    return {
        characters: enrichGameDbCharacterSnapshotsWithCreatedDomains(options.characters, projection),
        projection,
    };
}
exports.buildSnapshotAuditedCreatedDomainEnrichedCharacters = buildSnapshotAuditedCreatedDomainEnrichedCharacters;
function buildSnapshotAuditedCreatedDomainProjectionForTest(sidecar, activeSkillSetRows) {
    const projection = buildSnapshotAuditedCreatedDomainProjectionFromParsedSources(sidecar, activeSkillSetRows, exports.AUDITED_CREATED_DOMAIN_LINKS, false);
    return {
        schemaVersion: "game-db-created-domain-projection-test-only-v1",
        sourceSnapshotId: projection.sourceSnapshotId,
        semanticStatus: "test-only-untrusted",
        scope: projection.scope,
        excludedSemantics: projection.excludedSemantics,
        byActiveSkillSetId: Object.fromEntries(Object.entries(projection.byActiveSkillSetId).map(([id, value]) => [
            id,
            { ...value, semanticStatus: "test-only-untrusted" },
        ])),
    };
}
exports.buildSnapshotAuditedCreatedDomainProjectionForTest = buildSnapshotAuditedCreatedDomainProjectionForTest;
//# sourceMappingURL=game-db-dokkan-field-created-domain.js.map