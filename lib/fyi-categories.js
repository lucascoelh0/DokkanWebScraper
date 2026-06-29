"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mapCategorySupportMemoryRefFromFyi = exports.mapCategoryCharacterRefFromFyi = exports.buildFallbackCategoryEntry = exports.mapCategoryFromFyi = exports.buildCategoryDataset = exports.writeDokkanFyiCategories = exports.getDokkanFyiCategories = void 0;
const promises_1 = require("fs/promises");
const path_1 = require("path");
const character_1 = require("./character");
const format_json_1 = require("./format-json");
const DOKKAN_FYI_BASE_URL = "https://dokkan.fyi";
const EXISTING_CATEGORY_DATASET_RELATIVE_PATH = "data/categories/latest/categories.json";
class DokkanFyiCategoryClient {
    async fetchCategories(limit, existingCategoriesById = new Map()) {
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
        const limitedCategories = limit ? categories.slice(0, limit) : categories;
        return mapWithConcurrency(limitedCategories, requestedCategoryDetailConcurrency(), async (category) => this.fetchCategoryDetailSafe(category, existingCategoriesById.get(category.id.toString())));
    }
    async fetchCategoryPage(page) {
        const query = new URLSearchParams({ page: page.toString() });
        const html = await fetchDokkanFyiHtml(`${DOKKAN_FYI_BASE_URL}/categories?${query.toString()}`, `categories page ${page}`);
        return extractPagePayload(html);
    }
    async fetchCategoryDetail(categoryId) {
        const firstPage = await this.fetchCategoryDetailPage(categoryId, 1);
        const category = firstPage.props.category;
        const members = [...(firstPage.props.characters?.data ?? [])];
        const lastPage = toOptionalNumber(firstPage.props.characters?.meta?.last_page) ?? 1;
        for (let page = 2; page <= lastPage; page++) {
            const nextPage = await this.fetchCategoryDetailPage(categoryId, page);
            members.push(...(nextPage.props.characters?.data ?? []));
        }
        return {
            category,
            members: uniqueCategoryMembers(members),
        };
    }
    async fetchCategoryDetailSafe(category, existingCategory) {
        try {
            const detail = await this.fetchCategoryDetail(category.id);
            return mapCategoryFromFyi(detail);
        }
        catch (error) {
            console.warn(`Falling back to cached category roster for ${category.id} (${cleanInlineText(category.name) || category.id.toString()}): ${formatErrorMessage(error)}`);
            return buildFallbackCategoryEntry(category, existingCategory);
        }
    }
    async fetchCategoryDetailPage(categoryId, page) {
        const query = page > 1 ? `?page=${page}` : "";
        const html = await fetchDokkanFyiHtml(`${DOKKAN_FYI_BASE_URL}/categories/${categoryId}${query}`, `category ${categoryId} page ${page}`);
        return extractPagePayload(html);
    }
}
async function getDokkanFyiCategories() {
    const client = new DokkanFyiCategoryClient();
    const existingDataset = await readExistingCategoryDataset();
    const existingCategoriesById = new Map((existingDataset?.categories ?? []).map(category => [category.id, category]));
    const categories = await client.fetchCategories(requestedCategoryLimit(), existingCategoriesById);
    return buildCategoryDataset(categories);
}
exports.getDokkanFyiCategories = getDokkanFyiCategories;
async function writeDokkanFyiCategories() {
    const dataset = await getDokkanFyiCategories();
    const outputDir = (0, path_1.resolve)(__dirname, "data/categories/latest");
    const outputPath = (0, path_1.resolve)(outputDir, "categories.json");
    await (0, promises_1.mkdir)(outputDir, { recursive: true });
    await (0, format_json_1.writeFormattedJson)(outputPath, dataset);
    return outputPath;
}
exports.writeDokkanFyiCategories = writeDokkanFyiCategories;
function buildCategoryDataset(categories) {
    return {
        generatedAt: new Date().toISOString(),
        source: "dokkan.fyi",
        count: categories.length,
        categories: [...categories].sort((left, right) => left.name.localeCompare(right.name) || left.id.localeCompare(right.id)),
    };
}
exports.buildCategoryDataset = buildCategoryDataset;
function mapCategoryFromFyi(input) {
    const category = "category" in input ? input.category : input;
    const members = "members" in input ? input.members : [];
    return {
        id: category.id.toString(),
        name: cleanInlineText(category.name),
        leaders: (category.characters?.leaders ?? []).map(mapCategoryCharacterRefFromFyi),
        support: (category.characters?.support ?? []).map(mapCategoryCharacterRefFromFyi),
        supportMemories: (category.support_memories ?? []).map(mapCategorySupportMemoryRefFromFyi),
        members: members.map(mapCategoryCharacterRefFromFyi),
    };
}
exports.mapCategoryFromFyi = mapCategoryFromFyi;
function buildFallbackCategoryEntry(category, existingCategory) {
    const mapped = mapCategoryFromFyi(category);
    const fallbackMembers = mergeFallbackMembers(existingCategory, mapped);
    return {
        ...mapped,
        members: fallbackMembers,
    };
}
exports.buildFallbackCategoryEntry = buildFallbackCategoryEntry;
function mapCategoryCharacterRefFromFyi(character) {
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
exports.mapCategoryCharacterRefFromFyi = mapCategoryCharacterRefFromFyi;
function mapCategorySupportMemoryRefFromFyi(memory) {
    return {
        id: memory.id.toString(),
        name: cleanInlineText(memory.name),
        description: cleanMultilineText(memory.description),
        supportFilmId: toStringOrUndefined(memory.support_film_id),
        cost: toOptionalNumber(memory.cost),
        unlockQuantity: toOptionalNumber(memory.unlock_quantity),
    };
}
exports.mapCategorySupportMemoryRefFromFyi = mapCategorySupportMemoryRefFromFyi;
function requestedCategoryLimit() {
    const value = parseInt(process.env.DOKKAN_FYI_CATEGORY_LIMIT ?? "", 10);
    return Number.isFinite(value) && value > 0 ? value : undefined;
}
function requestedCategoryDetailConcurrency() {
    const value = parseInt(process.env.DOKKAN_FYI_CATEGORY_DETAIL_CONCURRENCY ?? "", 10);
    return Number.isFinite(value) && value > 0 ? value : 4;
}
function extractPagePayload(html) {
    const match = html.match(/<script data-page="app" type="application\/json">([\s\S]*?)<\/script>/);
    if (!match?.[1]) {
        throw new Error("Could not find dokkan.fyi page payload.");
    }
    return JSON.parse(match[1]);
}
function browserHeaders() {
    return {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9",
        "Cache-Control": "no-cache",
        "Pragma": "no-cache",
    };
}
async function fetchDokkanFyiHtml(url, label, retries = 3) {
    const response = await fetch(url, {
        headers: browserHeaders(),
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
async function readExistingCategoryDataset() {
    const filePath = (0, path_1.resolve)(__dirname, EXISTING_CATEGORY_DATASET_RELATIVE_PATH);
    try {
        const raw = await (0, promises_1.readFile)(filePath, { encoding: "utf8" });
        return JSON.parse(raw);
    }
    catch (error) {
        return undefined;
    }
}
function isRetryableStatus(status) {
    return status === 408 || status === 425 || status === 429 || status >= 500;
}
function retryDelayMs(retriesRemaining) {
    return (4 - retriesRemaining) * 1500;
}
async function delay(ms) {
    await new Promise(resolve => setTimeout(resolve, ms));
}
function uniqueCategoryMembers(values) {
    const byId = new Map();
    for (const value of values) {
        byId.set(String(value.id), value);
    }
    return [...byId.values()];
}
function mergeFallbackMembers(existingCategory, mappedCategory) {
    const values = [
        ...(existingCategory?.members ?? []),
        ...mappedCategory.leaders,
        ...mappedCategory.support,
    ];
    const byId = new Map();
    for (const value of values) {
        byId.set(value.id, value);
    }
    return [...byId.values()].sort((left, right) => left.name.localeCompare(right.name) || left.id.localeCompare(right.id));
}
function formatErrorMessage(error) {
    if (error instanceof Error) {
        return error.message;
    }
    return String(error);
}
async function mapWithConcurrency(items, concurrency, mapper) {
    const results = new Array(items.length);
    let nextIndex = 0;
    async function worker() {
        while (true) {
            const currentIndex = nextIndex++;
            if (currentIndex >= items.length) {
                return;
            }
            results[currentIndex] = await mapper(items[currentIndex], currentIndex);
        }
    }
    await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()));
    return results;
}
function portraitUrl(thumbnailId) {
    const id = toOptionalNumber(thumbnailId);
    if (!id) {
        return undefined;
    }
    return `https://cdn.dokkan.fyi/assets/en/character/thumb/card_${id}_thumb/card_${id}_thumb.png`;
}
function rarityFromInput(text, value) {
    const normalized = cleanInlineText(text).toUpperCase();
    switch (normalized) {
        case "LR":
            return character_1.Rarities.LR;
        case "UR":
            return character_1.Rarities.UR;
        case "SSR":
            return character_1.Rarities.SSR;
        case "SR":
            return character_1.Rarities.SR;
        case "R":
            return character_1.Rarities.R;
        case "N":
            return character_1.Rarities.N;
        default:
            break;
    }
    switch (toNumber(value)) {
        case 5:
            return character_1.Rarities.LR;
        case 4:
            return character_1.Rarities.UR;
        case 3:
            return character_1.Rarities.SSR;
        case 2:
            return character_1.Rarities.SR;
        case 1:
            return character_1.Rarities.R;
        default:
            return undefined;
    }
}
function typeFromInput(text, value) {
    const normalized = cleanInlineText(text).toUpperCase();
    switch (normalized) {
        case "AGL":
            return character_1.Types.AGL;
        case "TEQ":
            return character_1.Types.TEQ;
        case "INT":
            return character_1.Types.INT;
        case "STR":
            return character_1.Types.STR;
        case "PHY":
            return character_1.Types.PHY;
        default:
            break;
    }
    switch (toNumber(value)) {
        case 0:
            return character_1.Types.AGL;
        case 1:
            return character_1.Types.TEQ;
        case 2:
            return character_1.Types.INT;
        case 3:
            return character_1.Types.STR;
        case 4:
            return character_1.Types.PHY;
        default:
            return undefined;
    }
}
function classFromInput(text, value) {
    const normalized = cleanInlineText(text).toLowerCase();
    if (normalized === "super") {
        return character_1.Classes.Super;
    }
    if (normalized === "extreme") {
        return character_1.Classes.Extreme;
    }
    switch (toNumber(value)) {
        case 1:
            return character_1.Classes.Super;
        case 2:
            return character_1.Classes.Extreme;
        default:
            return undefined;
    }
}
function cleanMultilineText(value) {
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
function cleanInlineText(value) {
    return cleanMultilineText(value).replace(/\s*\n\s*/g, " ").trim();
}
function toNumber(value) {
    if (typeof value === "number") {
        return Number.isFinite(value) ? value : 0;
    }
    if (typeof value === "string") {
        const parsed = parseInt(value, 10);
        return Number.isFinite(parsed) ? parsed : 0;
    }
    return 0;
}
function toOptionalNumber(value) {
    const parsed = toNumber(value);
    return parsed === 0 && value !== 0 && value !== "0" ? undefined : parsed;
}
function toOptionalBoolean(value) {
    return typeof value === "boolean" ? value : undefined;
}
function toStringOrUndefined(value) {
    if (typeof value === "number") {
        return Number.isFinite(value) ? value.toString() : undefined;
    }
    if (typeof value === "string") {
        const normalized = value.trim();
        return normalized ? normalized : undefined;
    }
    return undefined;
}
//# sourceMappingURL=fyi-categories.js.map