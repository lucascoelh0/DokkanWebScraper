"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mapSummonRateRarityFromFyi = exports.mapSummonRateFromFyi = exports.mapSummonStepFromFyi = exports.mapSummonFeaturedCharacterFromFyi = exports.mapSummonDetailFromFyi = exports.mapSummonSummaryFromFyi = exports.buildSummonDetailsDataset = exports.buildSummonIndexDataset = exports.writeDokkanFyiSummons = exports.getDokkanFyiSummons = void 0;
const promises_1 = require("fs/promises");
const path_1 = require("path");
const character_1 = require("./character");
const format_json_1 = require("./format-json");
const DOKKAN_FYI_BASE_URL = "https://dokkan.fyi";
const DEFAULT_SUMMON_CATEGORY_FILTERS = [
    { id: 1, label: "Recommended" },
    { id: 2, label: "Dragon Stone" },
    { id: 3, label: "Ticket" },
    { id: 4, label: "Friend Pts." },
];
class DokkanFyiSummonClient {
    detailCache = new Map();
    async fetchActiveSummonSummaries(categories) {
        const rows = [];
        const seen = new Set();
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
    async fetchSummonDetails(summonIds) {
        const details = [];
        for (const summonId of summonIds) {
            details.push(mapSummonDetailFromFyi(await this.fetchSummonDetail(toNumber(summonId))));
        }
        return details.sort((left, right) => {
            const leftTime = left.startsAt ? Date.parse(left.startsAt) : 0;
            const rightTime = right.startsAt ? Date.parse(right.startsAt) : 0;
            return rightTime - leftTime || left.name.localeCompare(right.name) || left.id.localeCompare(right.id);
        });
    }
    async fetchSummonSummaryPage(categoryId, page) {
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
        const payload = extractPagePayload(html);
        return payload.props.summons?.data ?? [];
    }
    async fetchSummonDetail(summonId) {
        const cached = this.detailCache.get(summonId);
        if (cached) {
            return cached;
        }
        const promise = this.fetchSummonDetailUncached(summonId);
        this.detailCache.set(summonId, promise);
        return promise;
    }
    async fetchSummonDetailUncached(summonId) {
        const response = await fetch(`${DOKKAN_FYI_BASE_URL}/summons/${summonId}`, {
            headers: browserHeaders(),
        });
        if (!response.ok) {
            throw new Error(`Could not fetch dokkan.fyi summon ${summonId}: ${response.status}`);
        }
        const html = await response.text();
        const payload = extractPagePayload(html);
        return payload.props.summon;
    }
}
async function getDokkanFyiSummons() {
    const client = new DokkanFyiSummonClient();
    const categories = activeSummonCategoryFilters();
    const summaries = await client.fetchActiveSummonSummaries(categories);
    const details = await client.fetchSummonDetails(summaries.map(summon => summon.id));
    return {
        index: buildSummonIndexDataset(summaries, categories),
        details: buildSummonDetailsDataset(details),
    };
}
exports.getDokkanFyiSummons = getDokkanFyiSummons;
async function writeDokkanFyiSummons() {
    const { index, details } = await getDokkanFyiSummons();
    const outputDir = (0, path_1.resolve)(__dirname, "data/summons/latest");
    const indexPath = (0, path_1.resolve)(outputDir, "summons-index.json");
    const detailsPath = (0, path_1.resolve)(outputDir, "summons-details.json");
    await (0, promises_1.mkdir)(outputDir, { recursive: true });
    await (0, format_json_1.writeFormattedJson)(indexPath, index);
    await (0, format_json_1.writeFormattedJson)(detailsPath, details);
    return {
        indexPath,
        detailsPath,
    };
}
exports.writeDokkanFyiSummons = writeDokkanFyiSummons;
function buildSummonIndexDataset(summons, categories = DEFAULT_SUMMON_CATEGORY_FILTERS) {
    return {
        generatedAt: new Date().toISOString(),
        source: "dokkan.fyi",
        activeOnly: true,
        categories,
        count: summons.length,
        summons,
    };
}
exports.buildSummonIndexDataset = buildSummonIndexDataset;
function buildSummonDetailsDataset(summons) {
    return {
        generatedAt: new Date().toISOString(),
        source: "dokkan.fyi",
        activeOnly: true,
        count: summons.length,
        summons,
    };
}
exports.buildSummonDetailsDataset = buildSummonDetailsDataset;
function mapSummonSummaryFromFyi(summon) {
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
exports.mapSummonSummaryFromFyi = mapSummonSummaryFromFyi;
function mapSummonDetailFromFyi(summon) {
    return {
        ...mapSummonSummaryFromFyi(summon),
        featuredCharacters: (summon.featured_characters ?? []).map(mapSummonFeaturedCharacterFromFyi),
        steps: (summon.steps ?? []).map(mapSummonStepFromFyi),
    };
}
exports.mapSummonDetailFromFyi = mapSummonDetailFromFyi;
function mapSummonFeaturedCharacterFromFyi(entry) {
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
exports.mapSummonFeaturedCharacterFromFyi = mapSummonFeaturedCharacterFromFyi;
function mapSummonStepFromFyi(step) {
    return {
        id: toNumber(step.id).toString(),
        step: toNumber(step.step),
        name: htmlToText(step.name),
        rates: (step.rates ?? []).map(mapSummonRateFromFyi),
    };
}
exports.mapSummonStepFromFyi = mapSummonStepFromFyi;
function mapSummonRateFromFyi(rate) {
    return {
        type: cleanInlineText(rate.type),
        name: htmlToText(rate.name),
        position: toOptionalNumber(rate.position),
        amount: toOptionalNumber(rate.amount),
        rarities: (rate.rarities ?? []).map(mapSummonRateRarityFromFyi),
    };
}
exports.mapSummonRateFromFyi = mapSummonRateFromFyi;
function mapSummonRateRarityFromFyi(rate) {
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
exports.mapSummonRateRarityFromFyi = mapSummonRateRarityFromFyi;
function activeSummonCategoryFilters() {
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
function rarityFromText(value) {
    const normalized = cleanInlineText(value).toUpperCase();
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
        default:
            return character_1.Rarities.N;
    }
}
function rarityFromNumber(value) {
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
            return character_1.Rarities.N;
    }
}
function typeFromText(value) {
    const normalized = cleanInlineText(value).toUpperCase();
    switch (normalized) {
        case "PHY":
            return character_1.Types.PHY;
        case "STR":
            return character_1.Types.STR;
        case "INT":
            return character_1.Types.INT;
        case "TEQ":
            return character_1.Types.TEQ;
        default:
            return character_1.Types.AGL;
    }
}
function classFromAwakeningType(value) {
    return cleanInlineText(value).toLowerCase() === "extreme"
        ? character_1.Classes.Extreme
        : character_1.Classes.Super;
}
function releaseDate(value) {
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
function isCurrentlyActive(startsAt, endsAt) {
    const now = Date.now();
    const starts = releaseDate(startsAt);
    const ends = releaseDate(endsAt);
    if (!starts || !ends) {
        return false;
    }
    return Date.parse(starts) <= now && now <= Date.parse(ends);
}
function cleanMultilineText(value) {
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
function cleanInlineText(value) {
    return cleanMultilineText(value)
        .replace(/&#039;/g, "'")
        .replace(/&quot;/g, "\"")
        .replace(/&amp;/g, "&")
        .replace(/\s*\n\s*/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}
function cleanHtmlText(value) {
    return value?.trim() ?? "";
}
function htmlToText(value) {
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
function toOptionalFloat(value) {
    if (typeof value === "number") {
        return Number.isFinite(value) ? value : undefined;
    }
    if (typeof value === "string") {
        const parsed = parseFloat(value);
        return Number.isFinite(parsed) ? parsed : undefined;
    }
    return undefined;
}
//# sourceMappingURL=fyi-summons.js.map