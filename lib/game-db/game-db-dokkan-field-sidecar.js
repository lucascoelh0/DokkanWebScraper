"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildGameDbDokkanFieldSidecar = exports.DOKKAN_FIELD_SIDECAR_TABLES = void 0;
const game_db_source_1 = require("./game-db-source");
exports.DOKKAN_FIELD_SIDECAR_TABLES = [
    "dokkan_fields",
    "dokkan_field_efficacy_sets",
    "dokkan_field_efficacies",
    "dokkan_field_active_skill_set_relations",
    "dokkan_field_passive_skill_relations",
];
function compareIds(left, right) {
    if (/^\d+$/.test(left) && /^\d+$/.test(right)) {
        const numericLeft = BigInt(left);
        const numericRight = BigInt(right);
        return numericLeft < numericRight ? -1 : numericLeft > numericRight ? 1 : 0;
    }
    return left < right ? -1 : left > right ? 1 : 0;
}
function materializeRows(table, rows) {
    const seenIds = new Set();
    return rows.map(row => {
        const id = (0, game_db_source_1.normalizeDbId)(row.id);
        if (!id) {
            throw new Error(`${table} contains a row without an id`);
        }
        if (seenIds.has(id)) {
            throw new Error(`${table} contains duplicate row id ${id}`);
        }
        seenIds.add(id);
        return {
            id,
            values: { ...row },
            provenance: { table, rowId: id },
        };
    }).sort((left, right) => compareIds(left.id, right.id));
}
function relatedFieldIds(rows, relationColumn) {
    const related = new Map();
    for (const row of rows) {
        const relationId = (0, game_db_source_1.normalizeDbId)(row.values[relationColumn]);
        const fieldId = (0, game_db_source_1.normalizeDbId)(row.values.dokkan_field_id);
        if (!relationId || !fieldId) {
            throw new Error(`${row.provenance.table} row ${row.id} is missing ${relationColumn} or dokkan_field_id`);
        }
        const fieldIds = related.get(relationId) ?? new Set();
        fieldIds.add(fieldId);
        related.set(relationId, fieldIds);
    }
    return Object.fromEntries([...related.entries()]
        .sort(([left], [right]) => compareIds(left, right))
        .map(([id, fieldIds]) => [id, [...fieldIds].sort(compareIds)]));
}
function unresolvedReferences(sourceIds, availableIds) {
    return [...new Set(sourceIds.filter(id => !availableIds.has(id)))].sort(compareIds);
}
function buildGameDbDokkanFieldSidecar(snapshotId, tables) {
    const normalizedSnapshotId = snapshotId.trim();
    if (normalizedSnapshotId.length === 0) {
        throw new Error("Dokkan field sidecar requires a non-empty source snapshot id");
    }
    const rows = Object.fromEntries(exports.DOKKAN_FIELD_SIDECAR_TABLES.map(table => [
        table,
        materializeRows(table, tables[table]),
    ]));
    const fieldIds = new Set(rows.dokkan_fields.map(row => row.id));
    const efficacySetIds = new Set(rows.dokkan_field_efficacy_sets.map(row => row.id));
    const requiredIds = (table, column) => rows[table].map(row => {
        const id = (0, game_db_source_1.normalizeDbId)(row.values[column]);
        if (!id) {
            throw new Error(`${table} row ${row.id} is missing ${column}`);
        }
        return id;
    });
    const includedTableIntegrity = {
        scope: "included-tables-only",
        status: "complete",
        unresolvedFieldEfficacySetIds: unresolvedReferences(requiredIds("dokkan_fields", "dokkan_field_efficacy_set_id"), efficacySetIds),
        unresolvedEfficacySetIds: unresolvedReferences(requiredIds("dokkan_field_efficacies", "dokkan_field_efficacy_set_id"), efficacySetIds),
        unresolvedActiveRelationFieldIds: unresolvedReferences(requiredIds("dokkan_field_active_skill_set_relations", "dokkan_field_id"), fieldIds),
        unresolvedPassiveRelationFieldIds: unresolvedReferences(requiredIds("dokkan_field_passive_skill_relations", "dokkan_field_id"), fieldIds),
    };
    includedTableIntegrity.status = Object.entries(includedTableIntegrity)
        .filter(([key]) => key !== "status" && key !== "scope")
        .every(([, value]) => value.length === 0)
        ? "complete"
        : "incomplete";
    return {
        schemaVersion: "game-db-dokkan-field-sidecar-v1",
        source: {
            kind: "first-party-game-db-snapshot",
            snapshotId: normalizedSnapshotId,
            tables: [...exports.DOKKAN_FIELD_SIDECAR_TABLES],
        },
        rows,
        relatedFieldIdsByActiveSkillSet: relatedFieldIds(rows.dokkan_field_active_skill_set_relations, "active_skill_set_id"),
        relatedFieldIdsByPassiveSkill: relatedFieldIds(rows.dokkan_field_passive_skill_relations, "passive_skill_id"),
        includedTableIntegrity,
    };
}
exports.buildGameDbDokkanFieldSidecar = buildGameDbDokkanFieldSidecar;
//# sourceMappingURL=game-db-dokkan-field-sidecar.js.map