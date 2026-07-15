import { existsSync } from "fs";
import { readFile } from "fs/promises";
import { dirname, resolve } from "path";

export interface GameDbSourceConfig {
    sourceRoot: string,
    dataDir: string,
    settingsPath?: string,
}

export type GameDbRow = Record<string, string>;

export function parseCsv(text: string): string[][] {
    const rows: string[][] = [];
    let currentRow: string[] = [];
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

export function normalizeDbId(value?: string | null): string | undefined {
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

export function parseDbInt(value?: string | null): number | undefined {
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

export function parseDbDate(value?: string | null): string | undefined {
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

export function parseDbJsonArray(value?: string | null): Array<number | string | null> {
    if (!value) {
        return [];
    }

    const trimmed = value.trim();
    if (trimmed.length === 0) {
        return [];
    }

    try {
        const parsed = JSON.parse(trimmed);
        return Array.isArray(parsed) ? parsed as Array<number | string | null> : [];
    } catch {
        return [];
    }
}

export function resolveGameDbSourceConfig(sourceRootOverride?: string): GameDbSourceConfig {
    const envRoot = process.env.DOKKAN_GAME_DB_SOURCE_ROOT;
    const envDataDir = process.env.DOKKAN_GAME_DB_SOURCE_DATA_DIR;

    const candidates = [
        sourceRootOverride,
        envRoot,
        envDataDir,
        resolve(__dirname, "data", "game-db-source"),
    ].filter((candidate): candidate is string => Boolean(candidate));

    for (const candidate of candidates) {
        const resolvedCandidate = resolve(candidate);
        const asRepoDataDir = resolve(resolvedCandidate, "data");
        const asRepoSettings = resolve(resolvedCandidate, "Dokkan_Asset_Downloader", "settings.json");
        const asRepoCards = resolve(asRepoDataDir, "cards.csv");
        const asDirectCards = resolve(resolvedCandidate, "cards.csv");

        if (existsSync(asRepoDataDir) && existsSync(asRepoCards)) {
            return {
                sourceRoot: resolvedCandidate,
                dataDir: asRepoDataDir,
                settingsPath: existsSync(asRepoSettings) ? asRepoSettings : undefined,
            };
        }

        if (existsSync(asDirectCards)) {
            return {
                sourceRoot: dirname(resolvedCandidate),
                dataDir: resolvedCandidate,
            };
        }
    }

    throw new Error(
        "Unable to resolve a game DB source. Set DOKKAN_GAME_DB_SOURCE_ROOT to a dokkan-backend-style repo root " +
        "or DOKKAN_GAME_DB_SOURCE_DATA_DIR to a directory containing cards.csv.",
    );
}

export async function readGameDbTable(config: GameDbSourceConfig, tableName: string): Promise<GameDbRow[]> {
    const tablePath = resolve(config.dataDir, `${tableName}.csv`);
    const csvText = await readFile(tablePath, { encoding: "utf8" });
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
            const mappedRow: GameDbRow = {};
            headers.forEach((header, index) => {
                mappedRow[header] = row[index] ?? "";
            });
            return mappedRow;
        });
}

