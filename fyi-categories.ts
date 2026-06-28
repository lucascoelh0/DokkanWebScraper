import { mkdir } from "fs/promises";
import { resolve } from "path";
import { Classes, Rarities, Types } from "./character";
import { CategoryCharacterRef, CategoryDataset, CategoryEntry, CategorySupportMemoryRef } from "./category";
import { writeFormattedJson } from "./format-json";

const DOKKAN_FYI_BASE_URL = "https://dokkan.fyi";

interface FyiPaginated<T> {
    data: T[],
    meta?: {
        last_page?: number | null,
    },
}

interface FyiCategoriesPagePayload {
    component: string,
    props: {
        categories: FyiPaginated<FyiCategory>,
    },
}

interface FyiCategory {
    id: number,
    name?: string | null,
    characters?: {
        leaders?: FyiCharacterSummary[] | null,
        support?: FyiCharacterSummary[] | null,
    } | null,
    support_memories?: FyiSupportMemorySummary[] | null,
}

interface FyiCharacterSummary {
    id: number,
    canonical_id?: number | null,
    base_character_id?: number | null,
    character_id?: number | null,
    name?: string | null,
    rarity?: number | null,
    rarity_text?: string | null,
    type?: number | null,
    type_text?: string | null,
    awakening_type?: number | null,
    awakening_type_text?: string | null,
    thumbnail_id?: number | null,
    has_eza?: boolean | null,
    has_seza?: boolean | null,
    is_reversibly_exchanged?: boolean | null,
    is_freely_obtainable?: boolean | null,
    release_dates?: {
        latest_type?: string | null,
    } | null,
    leader_skill_id?: number | null,
    leader_skill?: {
        id?: number | null,
        name?: string | null,
        description?: string | null,
    } | null,
}

interface FyiSupportMemorySummary {
    id: number,
    name?: string | null,
    description?: string | null,
    support_film_id?: number | null,
    cost?: number | null,
    unlock_quantity?: number | null,
}

class DokkanFyiCategoryClient {
    async fetchCategories(limit?: number): Promise<FyiCategory[]> {
        const firstPage = await this.fetchCategoryPage(1);
        const categories = [...(firstPage.props.categories?.data ?? [])];
        const lastPage = toOptionalNumber(firstPage.props.categories?.meta?.last_page) ?? 1;

        for (let page = 2; page <= lastPage; page++) {
            const nextPage = await this.fetchCategoryPage(page);
            categories.push(...(nextPage.props.categories?.data ?? []));

            if (limit && categories.length >= limit) {
                break;
            }
        }

        return limit ? categories.slice(0, limit) : categories;
    }

    private async fetchCategoryPage(page: number): Promise<FyiCategoriesPagePayload> {
        const query = new URLSearchParams({ page: page.toString() });
        const response = await fetch(`${DOKKAN_FYI_BASE_URL}/categories?${query.toString()}`, {
            headers: browserHeaders(),
        });

        if (!response.ok) {
            throw new Error(`Could not fetch dokkan.fyi categories page ${page}: ${response.status}`);
        }

        const html = await response.text();
        return extractPagePayload<FyiCategoriesPagePayload>(html);
    }
}

export async function getDokkanFyiCategories(): Promise<CategoryDataset> {
    const client = new DokkanFyiCategoryClient();
    const categories = await client.fetchCategories(requestedCategoryLimit());

    return buildCategoryDataset(categories.map(mapCategoryFromFyi));
}

export async function writeDokkanFyiCategories(): Promise<string> {
    const dataset = await getDokkanFyiCategories();
    const outputDir = resolve(__dirname, "data/categories/latest");
    const outputPath = resolve(outputDir, "categories.json");

    await mkdir(outputDir, { recursive: true });
    await writeFormattedJson(outputPath, dataset);

    return outputPath;
}

export function buildCategoryDataset(categories: CategoryEntry[]): CategoryDataset {
    return {
        generatedAt: new Date().toISOString(),
        source: "dokkan.fyi",
        count: categories.length,
        categories: [...categories].sort((left, right) => left.name.localeCompare(right.name) || left.id.localeCompare(right.id)),
    };
}

export function mapCategoryFromFyi(category: FyiCategory): CategoryEntry {
    return {
        id: category.id.toString(),
        name: cleanInlineText(category.name),
        leaders: (category.characters?.leaders ?? []).map(mapCategoryCharacterRefFromFyi),
        support: (category.characters?.support ?? []).map(mapCategoryCharacterRefFromFyi),
        supportMemories: (category.support_memories ?? []).map(mapCategorySupportMemoryRefFromFyi),
    };
}

export function mapCategoryCharacterRefFromFyi(character: FyiCharacterSummary): CategoryCharacterRef {
    return {
        id: toNumber(character.id).toString(),
        canonicalId: toStringOrUndefined(character.canonical_id),
        baseCharacterId: toStringOrUndefined(character.base_character_id),
        characterId: toStringOrUndefined(character.character_id),
        name: cleanInlineText(character.name),
        rarity: rarityFromInput(character.rarity_text, character.rarity),
        type: typeFromInput(character.type_text, character.type),
        characterClass: classFromInput(character.awakening_type_text, character.awakening_type),
        thumbnailId: toStringOrUndefined(character.thumbnail_id),
        portraitUrl: portraitUrl(character.thumbnail_id),
        latestReleaseType: cleanInlineText(character.release_dates?.latest_type),
        hasEza: toOptionalBoolean(character.has_eza),
        hasSeza: toOptionalBoolean(character.has_seza),
        isReversiblyExchanged: toOptionalBoolean(character.is_reversibly_exchanged),
        isFreelyObtainable: toOptionalBoolean(character.is_freely_obtainable),
        leaderSkillId: toStringOrUndefined(character.leader_skill_id ?? character.leader_skill?.id),
        leaderSkillName: cleanInlineText(character.leader_skill?.name),
        leaderSkillDescription: cleanMultilineText(character.leader_skill?.description),
    };
}

export function mapCategorySupportMemoryRefFromFyi(memory: FyiSupportMemorySummary): CategorySupportMemoryRef {
    return {
        id: memory.id.toString(),
        name: cleanInlineText(memory.name),
        description: cleanMultilineText(memory.description),
        supportFilmId: toStringOrUndefined(memory.support_film_id),
        cost: toOptionalNumber(memory.cost),
        unlockQuantity: toOptionalNumber(memory.unlock_quantity),
    };
}

function requestedCategoryLimit(): number | undefined {
    const value = parseInt(process.env.DOKKAN_FYI_CATEGORY_LIMIT ?? "", 10);
    return Number.isFinite(value) && value > 0 ? value : undefined;
}

function extractPagePayload<T>(html: string): T {
    const match = html.match(/<script data-page="app" type="application\/json">([\s\S]*?)<\/script>/);
    if (!match?.[1]) {
        throw new Error("Could not find dokkan.fyi page payload.");
    }

    return JSON.parse(match[1]) as T;
}

function browserHeaders(): Record<string, string> {
    return {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9",
        "Cache-Control": "no-cache",
        "Pragma": "no-cache",
    };
}

function portraitUrl(thumbnailId: number | null | undefined): string | undefined {
    const id = toOptionalNumber(thumbnailId);
    if (!id) {
        return undefined;
    }

    return `https://cdn.dokkan.fyi/assets/en/character/thumb/card_${id}_thumb/card_${id}_thumb.png`;
}

function rarityFromInput(text: string | null | undefined, value: number | null | undefined): Rarities | undefined {
    const normalized = cleanInlineText(text).toUpperCase();
    switch (normalized) {
        case "LR":
            return Rarities.LR;
        case "UR":
            return Rarities.UR;
        case "SSR":
            return Rarities.SSR;
        case "SR":
            return Rarities.SR;
        case "R":
            return Rarities.R;
        case "N":
            return Rarities.N;
        default:
            break;
    }

    switch (toNumber(value)) {
        case 5:
            return Rarities.LR;
        case 4:
            return Rarities.UR;
        case 3:
            return Rarities.SSR;
        case 2:
            return Rarities.SR;
        case 1:
            return Rarities.R;
        default:
            return undefined;
    }
}

function typeFromInput(text: string | null | undefined, value: number | null | undefined): Types | undefined {
    const normalized = cleanInlineText(text).toUpperCase();
    switch (normalized) {
        case "AGL":
            return Types.AGL;
        case "TEQ":
            return Types.TEQ;
        case "INT":
            return Types.INT;
        case "STR":
            return Types.STR;
        case "PHY":
            return Types.PHY;
        default:
            break;
    }

    switch (toNumber(value)) {
        case 0:
            return Types.AGL;
        case 1:
            return Types.TEQ;
        case 2:
            return Types.INT;
        case 3:
            return Types.STR;
        case 4:
            return Types.PHY;
        default:
            return undefined;
    }
}

function classFromInput(text: string | null | undefined, value: number | null | undefined): Classes | undefined {
    const normalized = cleanInlineText(text).toLowerCase();
    if (normalized === "super") {
        return Classes.Super;
    }

    if (normalized === "extreme") {
        return Classes.Extreme;
    }

    switch (toNumber(value)) {
        case 1:
            return Classes.Super;
        case 2:
            return Classes.Extreme;
        default:
            return undefined;
    }
}

function cleanMultilineText(value: string | number | null | undefined): string {
    if (value === null || value === undefined || value === "") {
        return "";
    }

    const normalized = typeof value === "string"
        ? value
        : value.toString();

    return normalized
        .replace(/\{[^}]+\}/g, "")
        .replace(/\r/g, "")
        .replace(/&#039;/g, "'")
        .replace(/&quot;/g, "\"")
        .replace(/&amp;/g, "&")
        .split("\n")
        .map(line => line.trim())
        .filter(Boolean)
        .join("\n")
        .trim();
}

function cleanInlineText(value: string | number | null | undefined): string {
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

function toOptionalBoolean(value: boolean | null | undefined): boolean | undefined {
    return typeof value === "boolean" ? value : undefined;
}

function toStringOrUndefined(value: number | string | null | undefined): string | undefined {
    if (typeof value === "number") {
        return Number.isFinite(value) ? value.toString() : undefined;
    }

    if (typeof value === "string") {
        const normalized = value.trim();
        return normalized ? normalized : undefined;
    }

    return undefined;
}
