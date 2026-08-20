import { GameDbRow, normalizeDbId } from "./game-db-source";

export const DOKKAN_FIELD_SIDECAR_TABLES = [
    "dokkan_fields",
    "dokkan_field_efficacy_sets",
    "dokkan_field_efficacies",
    "dokkan_field_active_skill_set_relations",
    "dokkan_field_passive_skill_relations",
] as const;

export type GameDbDokkanFieldTable = typeof DOKKAN_FIELD_SIDECAR_TABLES[number];

export interface GameDbDokkanFieldRawRow {
    id: string,
    values: GameDbRow,
    provenance: {
        table: GameDbDokkanFieldTable,
        rowId: string,
    },
}

export interface GameDbDokkanFieldSidecarV1 {
    schemaVersion: "game-db-dokkan-field-sidecar-v1",
    source: {
        kind: "first-party-game-db-snapshot",
        snapshotId: string,
        tables: GameDbDokkanFieldTable[],
    },
    rows: Record<GameDbDokkanFieldTable, GameDbDokkanFieldRawRow[]>,
    relatedFieldIdsByActiveSkillSet: Record<string, string[]>,
    relatedFieldIdsByPassiveSkill: Record<string, string[]>,
    includedTableIntegrity: {
        scope: "included-tables-only",
        status: "complete" | "incomplete",
        unresolvedFieldEfficacySetIds: string[],
        unresolvedEfficacySetIds: string[],
        unresolvedActiveRelationFieldIds: string[],
        unresolvedPassiveRelationFieldIds: string[],
    },
}

type SidecarTables = Record<GameDbDokkanFieldTable, GameDbRow[]>;

function compareIds(left: string, right: string): number {
    if (/^\d+$/.test(left) && /^\d+$/.test(right)) {
        const numericLeft = BigInt(left);
        const numericRight = BigInt(right);
        return numericLeft < numericRight ? -1 : numericLeft > numericRight ? 1 : 0;
    }

    return left < right ? -1 : left > right ? 1 : 0;
}

function materializeRows(table: GameDbDokkanFieldTable, rows: GameDbRow[]): GameDbDokkanFieldRawRow[] {
    const seenIds = new Set<string>();
    return rows.map(row => {
        const id = normalizeDbId(row.id);
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

function relatedFieldIds(
    rows: GameDbDokkanFieldRawRow[],
    relationColumn: "active_skill_set_id" | "passive_skill_id",
): Record<string, string[]> {
    const related = new Map<string, Set<string>>();
    for (const row of rows) {
        const relationId = normalizeDbId(row.values[relationColumn]);
        const fieldId = normalizeDbId(row.values.dokkan_field_id);
        if (!relationId || !fieldId) {
            throw new Error(`${row.provenance.table} row ${row.id} is missing ${relationColumn} or dokkan_field_id`);
        }
        const fieldIds = related.get(relationId) ?? new Set<string>();
        fieldIds.add(fieldId);
        related.set(relationId, fieldIds);
    }

    return Object.fromEntries(
        [...related.entries()]
            .sort(([left], [right]) => compareIds(left, right))
            .map(([id, fieldIds]) => [id, [...fieldIds].sort(compareIds)]),
    );
}

function unresolvedReferences(sourceIds: string[], availableIds: Set<string>): string[] {
    return [...new Set(sourceIds.filter(id => !availableIds.has(id)))].sort(compareIds);
}

export function buildGameDbDokkanFieldSidecar(
    snapshotId: string,
    tables: SidecarTables,
): GameDbDokkanFieldSidecarV1 {
    const normalizedSnapshotId = snapshotId.trim();
    if (normalizedSnapshotId.length === 0) {
        throw new Error("Dokkan field sidecar requires a non-empty source snapshot id");
    }

    const rows = Object.fromEntries(DOKKAN_FIELD_SIDECAR_TABLES.map(table => [
        table,
        materializeRows(table, tables[table]),
    ])) as Record<GameDbDokkanFieldTable, GameDbDokkanFieldRawRow[]>;

    const fieldIds = new Set(rows.dokkan_fields.map(row => row.id));
    const efficacySetIds = new Set(rows.dokkan_field_efficacy_sets.map(row => row.id));
    const requiredIds = (table: GameDbDokkanFieldTable, column: string): string[] => rows[table].map(row => {
        const id = normalizeDbId(row.values[column]);
        if (!id) {
            throw new Error(`${table} row ${row.id} is missing ${column}`);
        }
        return id;
    });

    const includedTableIntegrity = {
        scope: "included-tables-only" as const,
        status: "complete" as "complete" | "incomplete",
        unresolvedFieldEfficacySetIds: unresolvedReferences(
            requiredIds("dokkan_fields", "dokkan_field_efficacy_set_id"),
            efficacySetIds,
        ),
        unresolvedEfficacySetIds: unresolvedReferences(
            requiredIds("dokkan_field_efficacies", "dokkan_field_efficacy_set_id"),
            efficacySetIds,
        ),
        unresolvedActiveRelationFieldIds: unresolvedReferences(
            requiredIds("dokkan_field_active_skill_set_relations", "dokkan_field_id"),
            fieldIds,
        ),
        unresolvedPassiveRelationFieldIds: unresolvedReferences(
            requiredIds("dokkan_field_passive_skill_relations", "dokkan_field_id"),
            fieldIds,
        ),
    };
    includedTableIntegrity.status = Object.entries(includedTableIntegrity)
        .filter(([key]) => key !== "status" && key !== "scope")
        .every(([, value]) => (value as string[]).length === 0)
        ? "complete"
        : "incomplete";

    return {
        schemaVersion: "game-db-dokkan-field-sidecar-v1",
        source: {
            kind: "first-party-game-db-snapshot",
            snapshotId: normalizedSnapshotId,
            tables: [...DOKKAN_FIELD_SIDECAR_TABLES],
        },
        rows,
        relatedFieldIdsByActiveSkillSet: relatedFieldIds(
            rows.dokkan_field_active_skill_set_relations,
            "active_skill_set_id",
        ),
        relatedFieldIdsByPassiveSkill: relatedFieldIds(
            rows.dokkan_field_passive_skill_relations,
            "passive_skill_id",
        ),
        includedTableIntegrity,
    };
}
