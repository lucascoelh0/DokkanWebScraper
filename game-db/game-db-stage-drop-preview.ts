import { GameDbRow, normalizeDbId } from "./game-db-source";

function text(value?: string | null): string {
    return value?.trim() ?? "";
}

function id(row: GameDbRow): string {
    const value = normalizeDbId(row.id);
    if (!value || !/^-?\d+$/.test(value)) throw new Error("Stage row is missing numeric id");
    return value;
}

function integer(row: GameDbRow, column: string): number {
    const raw = text(row[column]);
    if (!raw) throw new Error(`Stage row ${id(row)} is missing ${column}`);
    const value = Number(raw);
    if (!Number.isFinite(value)) throw new Error(`Stage row ${id(row)} has invalid ${column}`);
    if (!Number.isSafeInteger(value)) throw new Error(`Stage row ${id(row)} has non-integer ${column}`);
    return value;
}

function jsonValue(raw: string | undefined, label: string): unknown {
    if (!text(raw)) return {};
    try {
        return JSON.parse(raw!);
    } catch {
        throw new Error(`Stage ${label} contains invalid JSON`);
    }
}

function jsonIds(value: unknown, label: string): string[] {
    if (value === undefined || value === null) return [];
    if (!Array.isArray(value)) throw new Error(`Stage ${label} must be an array`);
    return value.map(item => {
        const normalized = normalizeDbId(item === null || item === undefined ? undefined : String(item));
        if (!normalized || !/^\d+$/.test(normalized)) throw new Error(`Stage ${label} contains an invalid ID`);
        return normalized;
    });
}

export function stageDropPreviewDifficultiesForMap(dropView: GameDbRow, map: GameDbRow): number[] | undefined {
    const label = `drop view ${id(dropView)} difficulties`;
    const difficultyValues = jsonIds(jsonValue(dropView.difficulties, label), label).map(Number);
    return difficultyValues.includes(integer(map, "difficulty")) ? difficultyValues : undefined;
}
