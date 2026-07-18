"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.duplicateGroupsByAwakeningLine = exports.uniqueCatalogEntries = exports.mapCharacterCatalogEntryFromFyi = exports.writeDokkanFyiCharacterCatalog = exports.getDokkanFyiCharacterCatalog = void 0;
const promises_1 = require("fs/promises");
const path_1 = require("path");
const format_json_1 = require("./format-json");
const DOKKAN_FYI_BASE_URL = "https://dokkan.fyi";
const CHARACTER_INDEX_PATH = "/characters";
const DEFAULT_PAGE_SIZE = 96;
const DEFAULT_MAX_PAGES = 1000;
const DEFAULT_CACHE_TTL_HOURS = 24;
class DokkanFyiCharacterCatalogClient {
    cacheDir = (0, path_1.resolve)(__dirname, "data/fyi-character-catalog/cache");
    refresh = process.env.DOKKAN_FYI_CHARACTER_CATALOG_REFRESH === "true";
    cacheTtlMs = cacheTtlMsFromEnvironment();
    maxPages = positiveIntegerFromEnvironment("DOKKAN_FYI_CHARACTER_CATALOG_MAX_PAGES", DEFAULT_MAX_PAGES);
    pageLimit = optionalPositiveIntegerFromEnvironment("DOKKAN_FYI_CHARACTER_CATALOG_PAGE_LIMIT");
    async fetchCatalog() {
        const pages = [];
        const failedPages = [];
        const seenUrls = new Set();
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
            }
            catch (error) {
                failedPages.push(pageNumber);
                throw new Error(`Could not fetch dokkan.fyi character catalog page ${pageNumber}: ${formatErrorMessage(error)}`);
            }
        }
        if (nextUrl && !this.pageLimit) {
            throw new Error(`Character catalog exceeded the ${this.maxPages}-page safety limit.`);
        }
        return { pages, failedPages };
    }
    async fetchPage(pageNumber, url) {
        const cachePath = (0, path_1.resolve)(this.cacheDir, `page-${pageNumber}.json`);
        if (!this.refresh) {
            const cached = await readCachedPage(cachePath, this.cacheTtlMs);
            if (cached && cached.payload.props?.characters) {
                return cached;
            }
        }
        const html = await fetchDokkanFyiHtml(url, `character catalog page ${pageNumber}`);
        const payload = extractPagePayload(html);
        const nextUrl = payload.props?.characters?.links?.next ?? undefined;
        const page = {
            fetchedAt: new Date().toISOString(),
            page: pageNumber,
            nextUrl,
            payload,
        };
        await (0, promises_1.mkdir)(this.cacheDir, { recursive: true });
        await (0, promises_1.writeFile)(cachePath, JSON.stringify(page), "utf8");
        return page;
    }
    buildPageUrl(page) {
        const query = new URLSearchParams({
            compact: "true",
            fully_awakened: "true",
            page: page.toString(),
        });
        return `${DOKKAN_FYI_BASE_URL}${CHARACTER_INDEX_PATH}?${query.toString()}`;
    }
}
async function getDokkanFyiCharacterCatalog() {
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
exports.getDokkanFyiCharacterCatalog = getDokkanFyiCharacterCatalog;
async function writeDokkanFyiCharacterCatalog() {
    const dataset = await getDokkanFyiCharacterCatalog();
    const outputDir = (0, path_1.resolve)(__dirname, "data/fyi-character-catalog/latest");
    const outputPath = (0, path_1.resolve)(outputDir, "character-catalog.json");
    await (0, promises_1.mkdir)(outputDir, { recursive: true });
    await (0, format_json_1.writeFormattedJson)(outputPath, dataset);
    return { outputPath, dataset };
}
exports.writeDokkanFyiCharacterCatalog = writeDokkanFyiCharacterCatalog;
function mapCharacterCatalogEntryFromFyi(character) {
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
exports.mapCharacterCatalogEntryFromFyi = mapCharacterCatalogEntryFromFyi;
function uniqueCatalogEntries(entries) {
    const byId = new Map();
    for (const entry of entries) {
        const existing = byId.get(entry.id);
        if (!existing || compareCatalogEntries(entry, existing) < 0) {
            byId.set(entry.id, entry);
        }
    }
    return [...byId.values()];
}
exports.uniqueCatalogEntries = uniqueCatalogEntries;
function duplicateGroupsByAwakeningLine(entries) {
    const groups = new Map();
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
exports.duplicateGroupsByAwakeningLine = duplicateGroupsByAwakeningLine;
function compareCatalogEntries(left, right) {
    return left.id.localeCompare(right.id);
}
function mapReleaseDates(dates) {
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
async function readCachedPage(path, ttlMs) {
    try {
        const raw = await (0, promises_1.readFile)(path, "utf8");
        const page = JSON.parse(raw);
        const fetchedAt = Date.parse(page.fetchedAt);
        if (!Number.isFinite(fetchedAt) || Date.now() - fetchedAt > ttlMs) {
            return undefined;
        }
        return page;
    }
    catch {
        return undefined;
    }
}
async function fetchDokkanFyiHtml(url, label, retries = 3) {
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
    }
    catch (error) {
        if (retries > 0) {
            await delay(retryDelayMs(retries));
            return fetchDokkanFyiHtml(url, label, retries - 1);
        }
        throw error;
    }
    finally {
        clearTimeout(timeout);
    }
}
function extractPagePayload(html) {
    const match = html.match(/<script data-page="app" type="application\/json">([\s\S]*?)<\/script>/);
    if (!match?.[1]) {
        throw new Error("Could not find dokkan.fyi character catalog payload.");
    }
    return JSON.parse(match[1]);
}
function browserHeaders() {
    return {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Cache-Control": "no-cache",
        "Pragma": "no-cache",
    };
}
function pageNumberFromUrl(url, fallback) {
    const value = new URL(url).searchParams.get("page");
    const page = Number(value);
    return Number.isFinite(page) && page > 0 ? page : fallback;
}
function isRetryableStatus(status) {
    return status === 408 || status === 425 || status === 429 || status >= 500;
}
function retryDelayMs(retriesRemaining) {
    return (4 - retriesRemaining) * 1500;
}
function requestTimeoutMs() {
    return positiveIntegerFromEnvironment("DOKKAN_FYI_CHARACTER_CATALOG_TIMEOUT_MS", 30000);
}
function cacheTtlMsFromEnvironment() {
    const hours = positiveIntegerFromEnvironment("DOKKAN_FYI_CHARACTER_CATALOG_CACHE_TTL_HOURS", DEFAULT_CACHE_TTL_HOURS);
    return hours * 60 * 60 * 1000;
}
function positiveIntegerFromEnvironment(name, fallback) {
    const value = Number.parseInt(process.env[name] ?? "", 10);
    return Number.isFinite(value) && value > 0 ? value : fallback;
}
function optionalPositiveIntegerFromEnvironment(name) {
    const value = Number.parseInt(process.env[name] ?? "", 10);
    return Number.isFinite(value) && value > 0 ? value : undefined;
}
function cleanInlineText(value) {
    return (value ?? "").replace(/\s+/g, " ").trim();
}
function toNumber(value) {
    return typeof value === "number" && Number.isFinite(value) ? value : 0;
}
function toOptionalNumber(value) {
    return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}
function toOptionalString(value) {
    if (value === null || value === undefined || value === "") {
        return undefined;
    }
    return String(value);
}
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
function formatErrorMessage(error) {
    return error instanceof Error ? error.message : String(error);
}
//# sourceMappingURL=fyi-character-catalog.js.map