import { mkdir, readFile, writeFile } from "fs/promises";
import { resolve } from "path";
import { writeFormattedJson } from "./format-json";

const DOKKAN_FYI_BASE_URL = "https://dokkan.fyi";
const CHARACTER_INDEX_PATH = "/characters";
const DEFAULT_PAGE_SIZE = 96;
const DEFAULT_MAX_PAGES = 1000;
const DEFAULT_CACHE_TTL_HOURS = 24;

export interface FyiCharacterCatalogEntry {
    id: string,
    canonicalId?: string,
    characterId?: string,
    baseCharacterId: string,
    name: string,
    rarity?: string,
    rarityValue?: number,
    type?: string,
    typeValue?: number,
    characterClass?: string,
    characterClassValue?: number,
    thumbnailId?: string,
    releaseDates?: {
        initial?: string,
        latest?: string,
        latestType?: string,
        eza?: string,
        seza?: string,
    },
    hasEza: boolean,
    hasSeza: boolean,
    isReversiblyExchanged: boolean,
    isFreelyObtainable: boolean,
    isStageDropReward: boolean,
    isWorldTournamentReward: boolean,
    hasBattleMotion: boolean,
    sourceUrl: string,
}

export interface FyiCharacterCatalogDataset {
    generatedAt: string,
    source: "dokkan.fyi",
    request: {
        compact: true,
        fullyAwakened: true,
    },
    pageSize: number,
    pageCount: number,
    isComplete: boolean,
    candidateCount: number,
    characterCount: number,
    awakeningLineCount: number,
    duplicateGroupCount: number,
    failedPages: number[],
    characters: FyiCharacterCatalogEntry[],
}

interface FyiCharacterIndexPagePayload {
    component?: string,
    props?: {
        characters?: FyiPaginated<FyiCharacterCatalogSourceEntry>,
    },
}

interface FyiPaginated<T> {
    data?: T[],
    links?: {
        next?: string | null,
    },
    meta?: {
        current_page?: number | null,
        per_page?: number | null,
    },
}

interface FyiCharacterCatalogSourceEntry {
    id: number,
    canonical_id?: number | null,
    character_id?: number | null,
    name?: string | null,
    rarity?: number | null,
    rarity_text?: string | null,
    type?: number | null,
    type_text?: string | null,
    awakening_type?: number | null,
    awakening_type_text?: string | null,
    thumbnail_id?: number | null,
    release_dates?: {
        initial?: string | null,
        latest?: string | null,
        latest_type?: string | null,
        eza?: string | null,
        seza?: string | null,
    } | null,
    has_eza?: boolean | null,
    has_seza?: boolean | null,
    is_reversibly_exchanged?: boolean | null,
    is_freely_obtainable?: boolean | null,
    is_stage_drop_reward?: boolean | null,
    is_world_tournament_reward?: boolean | null,
    has_battle_motion?: boolean | null,
    base_character_id?: number | null,
}

interface CachedCharacterCatalogPage {
    fetchedAt: string,
    page: number,
    nextUrl?: string,
    payload: FyiCharacterIndexPagePayload,
}

class DokkanFyiCharacterCatalogClient {
    private readonly cacheDir = resolve(__dirname, "data/fyi-character-catalog/cache");
    private readonly refresh = process.env.DOKKAN_FYI_CHARACTER_CATALOG_REFRESH === "true";
    private readonly cacheTtlMs = cacheTtlMsFromEnvironment();
    private readonly maxPages = positiveIntegerFromEnvironment(
        "DOKKAN_FYI_CHARACTER_CATALOG_MAX_PAGES",
        DEFAULT_MAX_PAGES,
    );
    private readonly pageLimit = optionalPositiveIntegerFromEnvironment(
        "DOKKAN_FYI_CHARACTER_CATALOG_PAGE_LIMIT",
    );

    async fetchCatalog(): Promise<{
        pages: CachedCharacterCatalogPage[],
        failedPages: number[],
    }> {
        const pages: CachedCharacterCatalogPage[] = [];
        const failedPages: number[] = [];
        const seenUrls = new Set<string>();
        let nextUrl = this.buildPageUrl(1);
        const pageLimit = this.pageLimit ?? this.maxPages;

        while (nextUrl && pages.length < pageLimit) {
            if (seenUrls.has(nextUrl)) {
                throw new Error(`Character catalog pagination loop detected at ${nextUrl}`);
            }

            seenUrls.add(nextUrl);
            const pageNumber = pageNumberFromUrl(nextUrl, pages.length + 1);

            try {
                const page = await this.fetchPage(pageNumber, nextUrl);
                pages.push(page);
                nextUrl = page.nextUrl ?? "";
                console.log(`[FYI catalog] page=${pageNumber} entries=${page.payload.props?.characters?.data?.length ?? 0}`);
            } catch (error) {
                failedPages.push(pageNumber);
                throw new Error(`Could not fetch dokkan.fyi character catalog page ${pageNumber}: ${formatErrorMessage(error)}`);
            }
        }

        if (nextUrl && !this.pageLimit) {
            throw new Error(`Character catalog exceeded the ${this.maxPages}-page safety limit.`);
        }

        return { pages, failedPages };
    }

    private async fetchPage(pageNumber: number, url: string): Promise<CachedCharacterCatalogPage> {
        const cachePath = resolve(this.cacheDir, `page-${pageNumber}.json`);

        if (!this.refresh) {
            const cached = await readCachedPage(cachePath, this.cacheTtlMs);
            if (cached && cached.payload.props?.characters) {
                return cached;
            }
        }

        const html = await fetchDokkanFyiHtml(url, `character catalog page ${pageNumber}`);
        const payload = extractPagePayload(html);
        const nextUrl = payload.props?.characters?.links?.next ?? undefined;
        const page: CachedCharacterCatalogPage = {
            fetchedAt: new Date().toISOString(),
            page: pageNumber,
            nextUrl,
            payload,
        };

        await mkdir(this.cacheDir, { recursive: true });
        await writeFile(cachePath, JSON.stringify(page), "utf8");
        return page;
    }

    private buildPageUrl(page: number): string {
        const query = new URLSearchParams({
            compact: "true",
            fully_awakened: "true",
            page: page.toString(),
        });

        return `${DOKKAN_FYI_BASE_URL}${CHARACTER_INDEX_PATH}?${query.toString()}`;
    }
}

export async function getDokkanFyiCharacterCatalog(): Promise<FyiCharacterCatalogDataset> {
    const client = new DokkanFyiCharacterCatalogClient();
    const { pages, failedPages } = await client.fetchCatalog();
    const entries = pages.flatMap(page => page.payload.props?.characters?.data ?? [])
        .map(mapCharacterCatalogEntryFromFyi);
    const characters = uniqueCatalogEntries(entries);
    const duplicateGroups = duplicateGroupsByAwakeningLine(characters);
    const pageSize = pages
        .map(page => page.payload.props?.characters?.meta?.per_page)
        .find(value => typeof value === "number" && value > 0) ?? DEFAULT_PAGE_SIZE;

    return {
        generatedAt: new Date().toISOString(),
        source: "dokkan.fyi",
        request: {
            compact: true,
            fullyAwakened: true,
        },
        pageSize,
        pageCount: pages.length,
        isComplete: !pages.at(-1)?.nextUrl,
        candidateCount: entries.length,
        characterCount: characters.length,
        awakeningLineCount: new Set(characters.map(character => character.baseCharacterId)).size,
        duplicateGroupCount: duplicateGroups.length,
        failedPages,
        characters: characters.sort(compareCatalogEntries),
    };
}

export async function writeDokkanFyiCharacterCatalog(): Promise<{
    outputPath: string,
    dataset: FyiCharacterCatalogDataset,
}> {
    const dataset = await getDokkanFyiCharacterCatalog();
    const outputDir = resolve(__dirname, "data/fyi-character-catalog/latest");
    const outputPath = resolve(outputDir, "character-catalog.json");

    await mkdir(outputDir, { recursive: true });
    await writeFormattedJson(outputPath, dataset);
    return { outputPath, dataset };
}

export function mapCharacterCatalogEntryFromFyi(
    character: FyiCharacterCatalogSourceEntry,
): FyiCharacterCatalogEntry {
    const id = toNumber(character.id).toString();
    return {
        id,
        canonicalId: toOptionalString(character.canonical_id),
        characterId: toOptionalString(character.character_id),
        baseCharacterId: toNumber(character.base_character_id ?? character.id).toString(),
        name: cleanInlineText(character.name),
        rarity: cleanInlineText(character.rarity_text),
        rarityValue: toOptionalNumber(character.rarity),
        type: cleanInlineText(character.type_text),
        typeValue: toOptionalNumber(character.type),
        characterClass: cleanInlineText(character.awakening_type_text),
        characterClassValue: toOptionalNumber(character.awakening_type),
        thumbnailId: toOptionalString(character.thumbnail_id),
        releaseDates: mapReleaseDates(character.release_dates),
        hasEza: Boolean(character.has_eza),
        hasSeza: Boolean(character.has_seza),
        isReversiblyExchanged: Boolean(character.is_reversibly_exchanged),
        isFreelyObtainable: Boolean(character.is_freely_obtainable),
        isStageDropReward: Boolean(character.is_stage_drop_reward),
        isWorldTournamentReward: Boolean(character.is_world_tournament_reward),
        hasBattleMotion: Boolean(character.has_battle_motion),
        sourceUrl: `${DOKKAN_FYI_BASE_URL}/characters/${id}`,
    };
}

export function uniqueCatalogEntries(entries: FyiCharacterCatalogEntry[]): FyiCharacterCatalogEntry[] {
    const byId = new Map<string, FyiCharacterCatalogEntry>();

    for (const entry of entries) {
        const existing = byId.get(entry.id);
        if (!existing || compareCatalogEntries(entry, existing) < 0) {
            byId.set(entry.id, entry);
        }
    }

    return [...byId.values()];
}

export function duplicateGroupsByAwakeningLine(
    entries: FyiCharacterCatalogEntry[],
): string[][] {
    const groups = new Map<string, string[]>();

    for (const entry of entries) {
        const group = groups.get(entry.baseCharacterId) ?? [];
        group.push(entry.id);
        groups.set(entry.baseCharacterId, group);
    }

    return [...groups.values()]
        .filter(group => group.length > 1)
        .map(group => group.sort((left, right) => left.localeCompare(right)))
        .sort((left, right) => left[0].localeCompare(right[0]));
}

function compareCatalogEntries(left: FyiCharacterCatalogEntry, right: FyiCharacterCatalogEntry): number {
    return left.id.localeCompare(right.id);
}

function mapReleaseDates(
    dates: FyiCharacterCatalogSourceEntry["release_dates"],
): FyiCharacterCatalogEntry["releaseDates"] {
    if (!dates) {
        return undefined;
    }

    return {
        initial: toOptionalString(dates.initial),
        latest: toOptionalString(dates.latest),
        latestType: cleanInlineText(dates.latest_type),
        eza: toOptionalString(dates.eza),
        seza: toOptionalString(dates.seza),
    };
}

async function readCachedPage(path: string, ttlMs: number): Promise<CachedCharacterCatalogPage | undefined> {
    try {
        const raw = await readFile(path, "utf8");
        const page = JSON.parse(raw) as CachedCharacterCatalogPage;
        const fetchedAt = Date.parse(page.fetchedAt);
        if (!Number.isFinite(fetchedAt) || Date.now() - fetchedAt > ttlMs) {
            return undefined;
        }

        return page;
    } catch {
        return undefined;
    }
}

async function fetchDokkanFyiHtml(url: string, label: string, retries = 3): Promise<string> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), requestTimeoutMs());

    try {
        const response = await fetch(url, {
            headers: browserHeaders(),
            signal: controller.signal,
        });

        if (!response.ok) {
            if (retries > 0 && isRetryableStatus(response.status)) {
                await delay(retryDelayMs(retries));
                return fetchDokkanFyiHtml(url, label, retries - 1);
            }

            throw new Error(`Could not fetch dokkan.fyi ${label}: ${response.status}`);
        }

        return response.text();
    } catch (error) {
        if (retries > 0) {
            await delay(retryDelayMs(retries));
            return fetchDokkanFyiHtml(url, label, retries - 1);
        }

        throw error;
    } finally {
        clearTimeout(timeout);
    }
}

function extractPagePayload(html: string): FyiCharacterIndexPagePayload {
    const match = html.match(/<script data-page="app" type="application\/json">([\s\S]*?)<\/script>/);
    if (!match?.[1]) {
        throw new Error("Could not find dokkan.fyi character catalog payload.");
    }

    return JSON.parse(match[1]) as FyiCharacterIndexPagePayload;
}

function browserHeaders(): Record<string, string> {
    return {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Cache-Control": "no-cache",
        "Pragma": "no-cache",
    };
}

function pageNumberFromUrl(url: string, fallback: number): number {
    const value = new URL(url).searchParams.get("page");
    const page = Number(value);
    return Number.isFinite(page) && page > 0 ? page : fallback;
}

function isRetryableStatus(status: number): boolean {
    return status === 408 || status === 425 || status === 429 || status >= 500;
}

function retryDelayMs(retriesRemaining: number): number {
    return (4 - retriesRemaining) * 1500;
}

function requestTimeoutMs(): number {
    return positiveIntegerFromEnvironment("DOKKAN_FYI_CHARACTER_CATALOG_TIMEOUT_MS", 30000);
}

function cacheTtlMsFromEnvironment(): number {
    const hours = positiveIntegerFromEnvironment("DOKKAN_FYI_CHARACTER_CATALOG_CACHE_TTL_HOURS", DEFAULT_CACHE_TTL_HOURS);
    return hours * 60 * 60 * 1000;
}

function positiveIntegerFromEnvironment(name: string, fallback: number): number {
    const value = Number.parseInt(process.env[name] ?? "", 10);
    return Number.isFinite(value) && value > 0 ? value : fallback;
}

function optionalPositiveIntegerFromEnvironment(name: string): number | undefined {
    const value = Number.parseInt(process.env[name] ?? "", 10);
    return Number.isFinite(value) && value > 0 ? value : undefined;
}

function cleanInlineText(value: string | null | undefined): string {
    return (value ?? "").replace(/\s+/g, " ").trim();
}

function toNumber(value: number | null | undefined): number {
    return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function toOptionalNumber(value: number | null | undefined): number | undefined {
    return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function toOptionalString(value: number | string | null | undefined): string | undefined {
    if (value === null || value === undefined || value === "") {
        return undefined;
    }

    return String(value);
}

function delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function formatErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}
