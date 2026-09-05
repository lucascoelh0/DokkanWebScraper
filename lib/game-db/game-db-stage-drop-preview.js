"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.stageDropPreviewDifficultiesForMap = void 0;
const game_db_source_1 = require("./game-db-source");
function text(value) {
    return value?.trim() ?? "";
}
function id(row) {
    const value = (0, game_db_source_1.normalizeDbId)(row.id);
    if (!value || !/^-?\d+$/.test(value))
        throw new Error("Stage row is missing numeric id");
    return value;
}
function integer(row, column) {
    const raw = text(row[column]);
    if (!raw)
        throw new Error(`Stage row ${id(row)} is missing ${column}`);
    const value = Number(raw);
    if (!Number.isFinite(value))
        throw new Error(`Stage row ${id(row)} has invalid ${column}`);
    if (!Number.isSafeInteger(value))
        throw new Error(`Stage row ${id(row)} has non-integer ${column}`);
    return value;
}
function jsonValue(raw, label) {
    if (!text(raw))
        return {};
    try {
        return JSON.parse(raw);
    }
    catch {
        throw new Error(`Stage ${label} contains invalid JSON`);
    }
}
function jsonIds(value, label) {
    if (value === undefined || value === null)
        return [];
    if (!Array.isArray(value))
        throw new Error(`Stage ${label} must be an array`);
    return value.map(item => {
        const normalized = (0, game_db_source_1.normalizeDbId)(item === null || item === undefined ? undefined : String(item));
        if (!normalized || !/^\d+$/.test(normalized))
            throw new Error(`Stage ${label} contains an invalid ID`);
        return normalized;
    });
}
function stageDropPreviewDifficultiesForMap(dropView, map) {
    const label = `drop view ${id(dropView)} difficulties`;
    const difficultyValues = jsonIds(jsonValue(dropView.difficulties, label), label).map(Number);
    return difficultyValues.includes(integer(map, "difficulty")) ? difficultyValues : undefined;
}
exports.stageDropPreviewDifficultiesForMap = stageDropPreviewDifficultiesForMap;
//# sourceMappingURL=game-db-stage-drop-preview.js.map