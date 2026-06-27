import { mkdir } from "fs/promises";
import { resolve } from "path";
import { Classes, Rarities, Types } from "./character";
import { writeFormattedJson } from "./format-json";
import {
    SummonBannerDetail,
    SummonBannerSummary,
    SummonCategoryFilter,
    SummonDetailsDataset,
    SummonFeaturedCharacter,
    SummonIndexDataset,
    SummonRate,
    SummonRateRarity,
    SummonStep,
} from "./summon";

const DOKKAN_FYI_BASE_URL = "https://dokkan.fyi";
const DEFAULT_SUMMON_CATEGORY_FILTERS: SummonCategoryFilter[] = [
    { id: 1, label: "Recommended" },
    { id: 2, label: "Dragon Stone" },
    { id: 3, label: "Ticket" },
    { id: 4, label: "Friend Pts." },
];

interface FyiSummonIndexPagePayload {
    props: {
        summons: FyiPaginated<FyiSummonSummary>,
    },
}

interface FyiSummonShowPagePayload {
    props: {
        summon: FyiSummonDetail,
    },
}

interface FyiPaginated<T> {
    data: T[],
}

interface FyiSummonSummary {
    id: number,
    name?: string | null,
    description?: string | null,
    category?: string | null,
    starts_at?: string | null,
    ends_at?: string | null,
    banner?: string | null,
}

interface FyiSummonDetail extends FyiSummonSummary {
    featured_characters?: FyiSummonFeaturedCharacterEntry[] | null,
    steps?: FyiSummonStep[] | null,
}

interface FyiSummonFeaturedCharacterEntry {
    character_id?: number | null,
    character?: FyiFeaturedCharacterSummary | null,
    new?: number | null,
    dokkan_fest?: number | null,
    carnival?: number | null,
    type?: string | null,
}

interface FyiFeaturedCharacterSummary {
    id: number,
    canonical_id?: number | null,
    base_character_id?: number | null,
    name?: string | null,
    rarity_text?: string | null,
    type_text?: string | null,
    awakening_type_text?: string | null,
    thumbnail_id?: number | null,
}

interface FyiSummonStep {
    id?: number | null,
    step?: number | null,
    name?: string | null,
    rates?: FyiSummonRate[] | null,
}

interface FyiSummonRate {
    type?: string | null,
    name?: string | null,
    position?: number | null,
    amount?: number | null,
    rarities?: FyiSummonRateRarity[] | null,
}

interface FyiSummonRateRarity {
    rarity?: number | null,
    total_amount?: number | null,
    total_rate?: string | null,
    featured_amount?: number | null,
    featured_rate?: string | null,
    normal_amount?: number | null,
    normal_rate?: string | null,
}

class DokkanFyiSummonClient {
    private readonly detailCache = new Map<number, Promise<FyiSummonDetail>>();

    async fetchActiveSummonSummaries(categories: SummonCategoryFilter[]): Promise<SummonBannerSummary[]> {
        const rows: SummonBannerSummary[] = [];
        const seen = new Set<number>();

        for (const category of categories) {
            const pageRows = await this.fetchSummonSummaryPage(category.id, 1);
            for (const row of pageRows) {
                if (seen.has(row.id)) {
                    continue;
                }

                seen.add(row.id);
                rows.push(mapSummonSummaryFromFyi(row));
            }
        }

        return rows.sort((left, right) => {
            const leftTime = left.startsAt ? Date.parse(left.startsAt) : 0;
            const rightTime = right.startsAt ? Date.parse(right.startsAt) : 0;
            return rightTime - leftTime || left.name.localeCompare(right.name) || left.id.localeCompare(right.id);
        });
    }

    async fetchSummonDetails(summonIds: string[]): Promise<SummonBannerDetail[]> {
        const details: SummonBannerDetail[] = [];

        for (const summonId of summonIds) {
            details.push(mapSummonDetailFromFyi(await this.fetchSummonDetail(toNumber(summonId))));
        }

        return details.sort((left, right) => {
            const leftTime = left.startsAt ? Date.parse(left.startsAt) : 0;
            const rightTime = right.startsAt ? Date.parse(right.startsAt) : 0;
            return rightTime - leftTime || left.name.localeCompare(right.name) || left.id.localeCompare(right.id);
        });
    }

    private async fetchSummonSummaryPage(categoryId: number, page: number): Promise<FyiSummonSummary[]> {
        const query = new URLSearchParams({
            active: "true",
            category: categoryId.toString(),
            page: page.toString(),
        });

        const response = await fetch(`${DOKKAN_FYI_BASE_URL}/summons?${query.toString()}`, {
            headers: browserHeaders(),
        });

        if (!response.ok) {
            throw new Error(`Could not fetch dokkan.fyi summons index for category ${categoryId}: ${response.status}`);
        }

        const html = await response.text();
        const payload = extractPagePayload<FyiSummonIndexPagePayload>(html);
        return payload.props.summons?.data ?? [];
    }

    private async fetchSummonDetail(summonId: number): Promise<FyiSummonDetail> {
        const cached = this.detailCache.get(summonId);
        if (cached) {
            return cached;
        }

        const promise = this.fetchSummonDetailUncached(summonId);
        this.detailCache.set(summonId, promise);
        return promise;
    }

    private async fetchSummonDetailUncached(summonId: number): Promise<FyiSummonDetail> {
        const response = await fetch(`${DOKKAN_FYI_BASE_URL}/summons/${summonId}`, {
            headers: browserHeaders(),
        });

        if (!response.ok) {
            throw new Error(`Could not fetch dokkan.fyi summon ${summonId}: ${response.status}`);
        }

        const html = await response.text();
        const payload = extractPagePayload<FyiSummonShowPagePayload>(html);
        return payload.props.summon;
    }
}

export async function getDokkanFyiSummons(): Promise<{
    index: SummonIndexDataset,
    details: SummonDetailsDataset,
}> {
    const client = new DokkanFyiSummonClient();
    const categories = activeSummonCategoryFilters();
    const summaries = await client.fetchActiveSummonSummaries(categories);
    const details = await client.fetchSummonDetails(summaries.map(summon => summon.id));

    return {
        index: buildSummonIndexDataset(summaries, categories),
        details: buildSummonDetailsDataset(details),
    };
}

export async function writeDokkanFyiSummons(): Promise<{
    indexPath: string,
    detailsPath: string,
}> {
    const { index, details } = await getDokkanFyiSummons();
    const outputDir = resolve(__dirname, "data/summons/latest");
    const indexPath = resolve(outputDir, "summons-index.json");
    const detailsPath = resolve(outputDir, "summons-details.json");

    await mkdir(outputDir, { recursive: true });
    await writeFormattedJson(indexPath, index);
    await writeFormattedJson(detailsPath, details);

    return {
        indexPath,
        detailsPath,
    };
}

export function buildSummonIndexDataset(
    summons: SummonBannerSummary[],
    categories: SummonCategoryFilter[] = DEFAULT_SUMMON_CATEGORY_FILTERS,
): SummonIndexDataset {
    return {
        generatedAt: new Date().toISOString(),
        source: "dokkan.fyi",
        activeOnly: true,
        categories,
        count: summons.length,
        summons,
    };
}

export function buildSummonDetailsDataset(summons: SummonBannerDetail[]): SummonDetailsDataset {
    return {
        generatedAt: new Date().toISOString(),
        source: "dokkan.fyi",
        activeOnly: true,
        count: summons.length,
        summons,
    };
}

export function mapSummonSummaryFromFyi(summon: FyiSummonSummary): SummonBannerSummary {
    return {
        id: summon.id.toString(),
        name: cleanInlineText(summon.name),
        description: htmlToText(summon.description),
        descriptionHtml: cleanHtmlText(summon.description),
        category: cleanInlineText(summon.category),
        startsAt: releaseDate(summon.starts_at),
        endsAt: releaseDate(summon.ends_at),
        bannerUrl: cleanInlineText(summon.banner),
        isCurrentlyActive: isCurrentlyActive(summon.starts_at, summon.ends_at),
    };
}

export function mapSummonDetailFromFyi(summon: FyiSummonDetail): SummonBannerDetail {
    return {
        ...mapSummonSummaryFromFyi(summon),
        featuredCharacters: (summon.featured_characters ?? []).map(mapSummonFeaturedCharacterFromFyi),
        steps: (summon.steps ?? []).map(mapSummonStepFromFyi),
    };
}

export function mapSummonFeaturedCharacterFromFyi(
    entry: FyiSummonFeaturedCharacterEntry,
): SummonFeaturedCharacter {
    const character = entry.character;
    return {
        id: toNumber(character?.id ?? entry.character_id).toString(),
        canonicalId: character?.canonical_id?.toString(),
        baseCharacterId: character?.base_character_id?.toString(),
        name: cleanInlineText(character?.name),
        rarity: rarityFromText(character?.rarity_text),
        type: typeFromText(character?.type_text),
        characterClass: classFromAwakeningType(character?.awakening_type_text),
        portraitUrl: portraitUrl(character?.thumbnail_id),
        isNew: toNumber(entry.new) > 0,
        isDokkanFestFeatured: toNumber(entry.dokkan_fest) > 0,
        isCarnivalFeatured: toNumber(entry.carnival) > 0,
        entryType: cleanInlineText(entry.type),
    };
}

export function mapSummonStepFromFyi(step: FyiSummonStep): SummonStep {
    return {
        id: toNumber(step.id).toString(),
        step: toNumber(step.step),
        name: htmlToText(step.name),
        rates: (step.rates ?? []).map(mapSummonRateFromFyi),
    };
}

export function mapSummonRateFromFyi(rate: FyiSummonRate): SummonRate {
    return {
        type: cleanInlineText(rate.type),
        name: htmlToText(rate.name),
        position: toOptionalNumber(rate.position),
        amount: toOptionalNumber(rate.amount),
        rarities: (rate.rarities ?? []).map(mapSummonRateRarityFromFyi),
    };
}

export function mapSummonRateRarityFromFyi(rate: FyiSummonRateRarity): SummonRateRarity {
    return {
        rarity: rarityFromNumber(rate.rarity),
        totalAmount: toOptionalNumber(rate.total_amount),
        totalRate: toOptionalFloat(rate.total_rate),
        featuredAmount: toOptionalNumber(rate.featured_amount),
        featuredRate: toOptionalFloat(rate.featured_rate),
        normalAmount: toOptionalNumber(rate.normal_amount),
        normalRate: toOptionalFloat(rate.normal_rate),
    };
}

function activeSummonCategoryFilters(): SummonCategoryFilter[] {
    const categoryIds = (process.env.DOKKAN_FYI_SUMMON_CATEGORY_IDS ?? "")
        .split(",")
        .map(value => parseInt(value.trim(), 10))
        .filter(Number.isFinite);

    if (categoryIds.length === 0) {
        return DEFAULT_SUMMON_CATEGORY_FILTERS;
    }

    return categoryIds.map(id => DEFAULT_SUMMON_CATEGORY_FILTERS.find(filter => filter.id === id) ?? {
        id,
        label: `Category ${id}`,
    });
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

function rarityFromText(value: string | null | undefined): Rarities {
    const normalized = cleanInlineText(value).toUpperCase();
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
        default:
            return Rarities.N;
    }
}

function rarityFromNumber(value: number | null | undefined): Rarities {
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
            return Rarities.N;
    }
}

function typeFromText(value: string | null | undefined): Types {
    const normalized = cleanInlineText(value).toUpperCase();
    switch (normalized) {
        case "PHY":
            return Types.PHY;
        case "STR":
            return Types.STR;
        case "INT":
            return Types.INT;
        case "TEQ":
            return Types.TEQ;
        default:
            return Types.AGL;
    }
}

function classFromAwakeningType(value: string | null | undefined): Classes {
    return cleanInlineText(value).toLowerCase() === "extreme"
        ? Classes.Extreme
        : Classes.Super;
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

function isCurrentlyActive(startsAt: string | null | undefined, endsAt: string | null | undefined): boolean {
    const now = Date.now();
    const starts = releaseDate(startsAt);
    const ends = releaseDate(endsAt);

    if (!starts || !ends) {
        return false;
    }

    return Date.parse(starts) <= now && now <= Date.parse(ends);
}

function cleanMultilineText(value: string | null | undefined): string {
    if (!value) {
        return "";
    }

    return value
        .replace(/\{[^}]+\}/g, "")
        .replace(/\r/g, "")
        .split("\n")
        .map(line => line.trim())
        .filter(Boolean)
        .join("\n")
        .trim();
}

function cleanInlineText(value: string | null | undefined): string {
    return cleanMultilineText(value)
        .replace(/&#039;/g, "'")
        .replace(/&quot;/g, "\"")
        .replace(/&amp;/g, "&")
        .replace(/\s*\n\s*/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function cleanHtmlText(value: string | null | undefined): string {
    return value?.trim() ?? "";
}

function htmlToText(value: string | null | undefined): string {
    if (!value) {
        return "";
    }

    return value
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<\/div>/gi, "\n")
        .replace(/<[^>]+>/g, " ")
        .replace(/&#039;/g, "'")
        .replace(/&quot;/g, "\"")
        .replace(/&amp;/g, "&")
        .split("\n")
        .map(line => line.replace(/\s+/g, " ").trim())
        .filter(Boolean)
        .join("\n")
        .trim();
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

function toOptionalFloat(value: string | number | null | undefined): number | undefined {
    if (typeof value === "number") {
        return Number.isFinite(value) ? value : undefined;
    }

    if (typeof value === "string") {
        const parsed = parseFloat(value);
        return Number.isFinite(parsed) ? parsed : undefined;
    }

    return undefined;
}
