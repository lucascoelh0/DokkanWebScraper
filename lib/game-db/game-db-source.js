"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.readGameDbTable = exports.resolveGameDbSourceConfig = exports.parseDbJsonArray = exports.parseDbDate = exports.parseDbInt = exports.normalizeDbId = exports.parseGameDbTableCsvText = exports.parseCsv = void 0;
const fs_1 = require("fs");
const promises_1 = require("fs/promises");
const path_1 = require("path");
function parseCsv(text) {
    const rows = [];
    let currentRow = [];
    let currentCell = "";
    let inQuotes = false;
    for (let index = 0; index < text.length; index += 1) {
        const character = text[index];
        const nextCharacter = text[index + 1];
        if (character === "\"") {
            if (inQuotes && nextCharacter === "\"") {
                currentCell += "\"";
                index += 1;
                continue;
            }
            inQuotes = !inQuotes;
            continue;
        }
        if (!inQuotes && character === ",") {
            currentRow.push(currentCell);
            currentCell = "";
            continue;
        }
        if (!inQuotes && (character === "\n" || character === "\r")) {
            if (character === "\r" && nextCharacter === "\n") {
                index += 1;
            }
            currentRow.push(currentCell);
            rows.push(currentRow);
            currentRow = [];
            currentCell = "";
            continue;
        }
        currentCell += character;
    }
    if (currentCell.length > 0 || currentRow.length > 0) {
        currentRow.push(currentCell);
        rows.push(currentRow);
    }
    return rows.filter(row => row.length > 1 || row[0] !== "");
}
exports.parseCsv = parseCsv;
function parseGameDbTableCsvText(csvText) {
    const rows = parseCsv(csvText);
    if (rows.length === 0) {
        return [];
    }
    const [headerRow, ...valueRows] = rows;
    if (!headerRow || headerRow.length === 0) {
        return [];
    }
    const headers = headerRow.map((header, index) => {
        const normalizedHeader = index === 0 ? header.replace(/^\uFEFF/, "") : header;
        return normalizedHeader.trim();
    });
    return valueRows
        .filter(row => row.some(cell => cell.trim().length > 0))
        .map(row => {
        const mappedRow = {};
        headers.forEach((header, index) => {
            mappedRow[header] = row[index] ?? "";
        });
        return mappedRow;
    });
}
exports.parseGameDbTableCsvText = parseGameDbTableCsvText;
function normalizeDbId(value) {
    if (!value) {
        return undefined;
    }
    const trimmed = value.trim();
    if (trimmed.length === 0) {
        return undefined;
    }
    if (/^-?\d+\.0+$/.test(trimmed)) {
        return trimmed.slice(0, trimmed.indexOf("."));
    }
    return trimmed;
}
exports.normalizeDbId = normalizeDbId;
function parseDbInt(value) {
    if (!value) {
        return undefined;
    }
    const trimmed = value.trim();
    if (trimmed.length === 0) {
        return undefined;
    }
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? Math.trunc(parsed) : undefined;
}
exports.parseDbInt = parseDbInt;
function parseDbDate(value) {
    if (!value) {
        return undefined;
    }
    const trimmed = value.trim();
    if (trimmed.length === 0) {
        return undefined;
    }
    const parsed = new Date(trimmed.replace(" ", "T").concat("Z"));
    return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
}
exports.parseDbDate = parseDbDate;
function parseDbJsonArray(value) {
    if (!value) {
        return [];
    }
    const trimmed = value.trim();
    if (trimmed.length === 0) {
        return [];
    }
    try {
        const parsed = JSON.parse(trimmed);
        return Array.isArray(parsed) ? parsed : [];
    }
    catch {
        return [];
    }
}
exports.parseDbJsonArray = parseDbJsonArray;
function resolveGameDbSourceConfig(sourceRootOverride) {
    const envRoot = process.env.DOKKAN_GAME_DB_SOURCE_ROOT;
    const envDataDir = process.env.DOKKAN_GAME_DB_SOURCE_DATA_DIR;
    const candidates = [
        sourceRootOverride,
        envRoot,
        envDataDir,
        (0, path_1.resolve)(__dirname, "data", "game-db-source"),
    ].filter((candidate) => Boolean(candidate));
    for (const candidate of candidates) {
        const resolvedCandidate = (0, path_1.resolve)(candidate);
        const asRepoDataDir = (0, path_1.resolve)(resolvedCandidate, "data");
        const asRepoSettings = (0, path_1.resolve)(resolvedCandidate, "Dokkan_Asset_Downloader", "settings.json");
        const asRepoCards = (0, path_1.resolve)(asRepoDataDir, "cards.csv");
        const asDirectCards = (0, path_1.resolve)(resolvedCandidate, "cards.csv");
        if ((0, fs_1.existsSync)(asRepoDataDir) && (0, fs_1.existsSync)(asRepoCards)) {
            return {
                sourceRoot: resolvedCandidate,
                dataDir: asRepoDataDir,
                settingsPath: (0, fs_1.existsSync)(asRepoSettings) ? asRepoSettings : undefined,
            };
        }
        if ((0, fs_1.existsSync)(asDirectCards)) {
            return {
                sourceRoot: (0, path_1.dirname)(resolvedCandidate),
                dataDir: resolvedCandidate,
            };
        }
    }
    throw new Error("Unable to resolve a game DB source. Set DOKKAN_GAME_DB_SOURCE_ROOT to a dokkan-backend-style repo root " +
        "or DOKKAN_GAME_DB_SOURCE_DATA_DIR to a directory containing cards.csv.");
}
exports.resolveGameDbSourceConfig = resolveGameDbSourceConfig;
async function readGameDbTable(config, tableName) {
    const tablePath = (0, path_1.resolve)(config.dataDir, `${tableName}.csv`);
    const csvText = await (0, promises_1.readFile)(tablePath, { encoding: "utf8" });
    return parseGameDbTableCsvText(csvText);
}
exports.readGameDbTable = readGameDbTable;
//# sourceMappingURL=game-db-source.js.map