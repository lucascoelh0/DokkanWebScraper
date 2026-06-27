import { mkdir } from "fs/promises";
import { resolve } from "path";
import { writeFormattedJson } from "./format-json";
import {
    SupportMemory,
    SupportMemoryDataset,
    SupportMemoryEffect,
    SupportMemoryEnhancementStep,
    SupportMemoryFilm,
} from "./support-memory";

const DOKKAN_FYI_BASE_URL = "https://dokkan.fyi";

interface FyiSupportMemoriesPagePayload {
    props: {
        supportMemories: FyiSupportMemory[],
    },
}

interface FyiSupportMemory {
    id: number,
    name?: string | null,
    description?: string | null,
    support_film_id?: number | null,
    support_film?: FyiSupportFilm | null,
    cost?: number | null,
    lasts_entire_battle?: boolean | null,
    unlock_quantity?: number | null,
    released_at?: string | null,
    root_enhancement_levels?: FyiSupportMemoryEnhancementLevel[] | null,
    support_memory_skills?: FyiSupportMemorySkill[] | null,
    effects?: FyiSupportMemorySkill[] | null,
}

interface FyiSupportFilm {
    id?: number | null,
    name?: string | null,
    description?: string | null,
}

interface FyiSupportMemoryEnhancementLevel {
    id?: number | null,
    level?: number | null,
    support_memory_id?: number | null,
    enhanced_support_memory_id?: number | null,
    root_support_memory_id?: number | null,
}

interface FyiSupportMemorySkill {
    id?: number | null,
    support_memory_id?: number | null,
    type?: number | null,
    values?: Array<number | null> | null,
    target?: number | null,
    calculation?: number | null,
    turns?: number | null,
    chance?: number | null,
    transformation?: {
        description?: string | null,
    } | null,
    script_name?: string | null,
}

export async function getDokkanFyiSupportMemories(): Promise<SupportMemoryDataset> {
    const payload = await fetchSupportMemoriesPayload();
    const supportMemories = payload.props.supportMemories
        .map(mapSupportMemoryFromFyi)
        .sort((left, right) => left.name.localeCompare(right.name) || left.id.localeCompare(right.id));

    return buildSupportMemoryDataset(supportMemories);
}

export async function writeDokkanFyiSupportMemories(): Promise<string> {
    const dataset = await getDokkanFyiSupportMemories();
    const outputDir = resolve(__dirname, "data/support-memories/latest");
    const outputPath = resolve(outputDir, "support-memories.json");

    await mkdir(outputDir, { recursive: true });
    await writeFormattedJson(outputPath, dataset);

    return outputPath;
}

export function buildSupportMemoryDataset(supportMemories: SupportMemory[]): SupportMemoryDataset {
    const filmsById = new Map<string, SupportMemoryFilm>();

    for (const supportMemory of supportMemories) {
        if (!supportMemory.film?.id) {
            continue;
        }

        filmsById.set(supportMemory.film.id, supportMemory.film);
    }

    return {
        generatedAt: new Date().toISOString(),
        source: "dokkan.fyi",
        count: supportMemories.length,
        films: Array.from(filmsById.values()).sort((left, right) => left.name.localeCompare(right.name) || left.id.localeCompare(right.id)),
        supportMemories,
    };
}

export function mapSupportMemoryFromFyi(memory: FyiSupportMemory): SupportMemory {
    const film = supportFilmFromFyi(memory.support_film);
    const enhancementChain = enhancementChainFromFyi(memory.root_enhancement_levels);
    const effects = supportMemoryEffectsFromFyi(memory.support_memory_skills ?? memory.effects);

    return {
        id: memory.id.toString(),
        name: cleanInlineText(memory.name),
        description: cleanMultilineText(memory.description),
        filmId: memory.support_film_id?.toString(),
        film,
        cost: toOptionalNumber(memory.cost),
        unlockQuantity: toOptionalNumber(memory.unlock_quantity),
        lastsEntireBattle: Boolean(memory.lasts_entire_battle),
        releaseDate: releaseDate(memory.released_at),
        maxLevel: maxSupportMemoryLevel(enhancementChain),
        enhancementChain,
        effects,
    };
}

export function supportFilmFromFyi(film: FyiSupportFilm | null | undefined): SupportMemoryFilm | undefined {
    if (!film?.id) {
        return undefined;
    }

    return {
        id: film.id.toString(),
        name: cleanInlineText(film.name),
        description: cleanMultilineText(film.description),
    };
}

export function enhancementChainFromFyi(
    levels: FyiSupportMemoryEnhancementLevel[] | null | undefined,
): SupportMemoryEnhancementStep[] {
    return (levels ?? [])
        .map(level => ({
            id: level.id?.toString(),
            level: toNumber(level.level),
            supportMemoryId: toNumber(level.support_memory_id).toString(),
            enhancedSupportMemoryId: toNumber(level.enhanced_support_memory_id).toString(),
            rootSupportMemoryId: toNumber(level.root_support_memory_id).toString(),
        }))
        .filter(step => step.level > 0 && step.supportMemoryId !== "0" && step.enhancedSupportMemoryId !== "0");
}

export function supportMemoryEffectsFromFyi(
    effects: FyiSupportMemorySkill[] | null | undefined,
): SupportMemoryEffect[] {
    return (effects ?? []).map(effect => ({
        id: effect.id?.toString(),
        effectType: toOptionalNumber(effect.type),
        values: (effect.values ?? [])
            .map(value => toOptionalNumber(value))
            .filter((value): value is number => value !== undefined),
        target: toOptionalNumber(effect.target),
        calculation: toOptionalNumber(effect.calculation),
        turns: toOptionalNumber(effect.turns),
        chance: toOptionalNumber(effect.chance),
        transformationDescription: cleanMultilineText(effect.transformation?.description),
        scriptName: cleanInlineText(effect.script_name),
    }));
}

async function fetchSupportMemoriesPayload(): Promise<FyiSupportMemoriesPagePayload> {
    const response = await fetch(`${DOKKAN_FYI_BASE_URL}/support-memories`, {
        headers: browserHeaders(),
    });

    if (!response.ok) {
        throw new Error(`Could not fetch dokkan.fyi support memories: ${response.status}`);
    }

    const html = await response.text();
    const payload = extractPagePayload(html);
    if (!Array.isArray(payload.props.supportMemories)) {
        throw new Error("dokkan.fyi support memories payload did not include supportMemories.");
    }

    return payload;
}

function extractPagePayload(html: string): FyiSupportMemoriesPagePayload {
    const match = html.match(/<script data-page="app" type="application\/json">([\s\S]*?)<\/script>/);
    if (!match?.[1]) {
        throw new Error("Could not find dokkan.fyi support memories page payload.");
    }

    return JSON.parse(match[1]) as FyiSupportMemoriesPagePayload;
}

function browserHeaders(): Record<string, string> {
    return {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9",
        "Cache-Control": "no-cache",
        "Pragma": "no-cache",
    };
}

function maxSupportMemoryLevel(enhancementChain: SupportMemoryEnhancementStep[]): number {
    const maxEnhancedLevel = enhancementChain.reduce((maxLevel, step) => Math.max(maxLevel, step.level), 1);
    return Math.max(1, maxEnhancedLevel);
}

function releaseDate(value: string | null | undefined): string | undefined {
    const normalized = cleanInlineText(value);
    if (!normalized) {
        return undefined;
    }

    const parsed = new Date(normalized);
    if (Number.isNaN(parsed.getTime())) {
        return undefined;
    }

    return parsed.toISOString();
}

function cleanMultilineText(value: string | null | undefined): string {
    if (!value) {
        return "";
    }

    return value
        .replace(/\{[^}]+\}/g, "")
        .replace(/\r/g, "")
        .split("\n")
        .map(line => line.trim().replace(/^\*\s*/, "").replace(/\s*\*$/, "").trim())
        .filter(Boolean)
        .join("\n")
        .trim();
}

function cleanInlineText(value: string | null | undefined): string {
    return cleanMultilineText(value).replace(/\s*\n\s*/g, " ").trim();
}

function toNumber(value: number | string | null | undefined): number {
    if (typeof value === "number") {
        return Number.isFinite(value) ? value : 0;
    }

    if (typeof value === "string") {
        const parsed = parseInt(value, 10);
        return Number.isFinite(parsed) ? parsed : 0;
    }

    return 0;
}

function toOptionalNumber(value: number | string | null | undefined): number | undefined {
    const parsed = toNumber(value);
    return parsed === 0 && value !== 0 && value !== "0" ? undefined : parsed;
}
