"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mapCategorySupportMemoryRefFromFyi = exports.mapCategoryCharacterRefFromFyi = exports.mapCategoryFromFyi = exports.buildCategoryDataset = exports.writeDokkanFyiCategories = exports.getDokkanFyiCategories = void 0;
const promises_1 = require("fs/promises");
const path_1 = require("path");
const character_1 = require("./character");
const format_json_1 = require("./format-json");
const DOKKAN_FYI_BASE_URL = "https://dokkan.fyi";
class DokkanFyiCategoryClient {
    async fetchCategories(limit) {
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
    async fetchCategoryPage(page) {
        const query = new URLSearchParams({ page: page.toString() });
        const response = await fetch(`${DOKKAN_FYI_BASE_URL}/categories?${query.toString()}`, {
            headers: browserHeaders(),
        });
        if (!response.ok) {
            throw new Error(`Could not fetch dokkan.fyi categories page ${page}: ${response.status}`);
        }
        const html = await response.text();
        return extractPagePayload(html);
    }
}
async function getDokkanFyiCategories() {
    const client = new DokkanFyiCategoryClient();
    const categories = await client.fetchCategories(requestedCategoryLimit());
    return buildCategoryDataset(categories.map(mapCategoryFromFyi));
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
function mapCategoryFromFyi(category) {
    return {
        id: category.id.toString(),
        name: cleanInlineText(category.name),
        leaders: (category.characters?.leaders ?? []).map(mapCategoryCharacterRefFromFyi),
        support: (category.characters?.support ?? []).map(mapCategoryCharacterRefFromFyi),
        supportMemories: (category.support_memories ?? []).map(mapCategorySupportMemoryRefFromFyi),
    };
}
exports.mapCategoryFromFyi = mapCategoryFromFyi;
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