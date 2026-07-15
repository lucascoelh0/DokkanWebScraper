"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mapEventMissionCharacterRefFromFyi = exports.mapEventMissionRewardSkillFromFyi = exports.mapEventMissionRewardFromFyi = exports.mapEventMissionEntryFromFyi = exports.mapEventMissionCategoryFromFyi = exports.buildEventMissionDataset = exports.writeDokkanFyiEventMissions = exports.getDokkanFyiEventMissions = void 0;
const promises_1 = require("fs/promises");
const path_1 = require("path");
const character_1 = require("./character");
const format_json_1 = require("./format-json");
const DOKKAN_FYI_BASE_URL = "https://dokkan.fyi";
const EVENT_MISSION_CACHE_DIR = "data/event-missions/cache";
const DEFAULT_REQUEST_TIMEOUT_MS = 30000;
const DEFAULT_CACHE_TTL_HOURS = 24;
class DokkanFyiEventMissionClient {
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
    async fetchCategory(categoryId) {
        const cached = await readCachedPayload(`category-${categoryId}.json`);
        if (cached) {
            return cached;
        }
        const html = await fetchDokkanFyiText(`${DOKKAN_FYI_BASE_URL}/missions/${categoryId}`, `event mission category ${categoryId}`);
        const category = extractPagePayload(html).props.category;
        await writeCachedPayload(`category-${categoryId}.json`, category);
        return category;
    }
    async fetchCategoryPage(page) {
        const cacheFile = `index-page-${page}.json`;
        const cached = await readCachedPayload(cacheFile);
        if (cached) {
            return cached;
        }
        const html = await fetchDokkanFyiText(`${DOKKAN_FYI_BASE_URL}/missions/event?page=${page}`, `event mission index page ${page}`);
        const payload = extractPagePayload(html);
        await writeCachedPayload(cacheFile, payload);
        return payload;
    }
}
async function getDokkanFyiEventMissions() {
    const client = new DokkanFyiEventMissionClient();
    const summaries = await client.fetchCategories(requestedEventMissionCategoryLimit());
    let completedCategoryCount = 0;
    const failedCategoryIds = [];
    const categories = (await mapWithConcurrency(summaries, requestedEventMissionConcurrency(), async (summary) => {
        try {
            const detail = await client.fetchCategory(summary.id);
            return mapEventMissionCategoryFromFyi(detail, summary);
        }
        catch (error) {
            failedCategoryIds.push(summary.id.toString());
            console.error(`[EVENT-MISSIONS] Failed category ${summary.id}: ${errorMessage(error)}`);
            return undefined;
        }
        finally {
            completedCategoryCount += 1;
            if (completedCategoryCount === 1 || completedCategoryCount % 25 === 0 || completedCategoryCount === summaries.length) {
                console.log(`[EVENT-MISSIONS] Categories ${completedCategoryCount}/${summaries.length}`);
            }
        }
    })).filter((category) => Boolean(category));
    return buildEventMissionDataset(categories, failedCategoryIds);
}
exports.getDokkanFyiEventMissions = getDokkanFyiEventMissions;
async function writeDokkanFyiEventMissions() {
    const dataset = await getDokkanFyiEventMissions();
    const outputDir = (0, path_1.resolve)(__dirname, "data/event-missions/latest");
    const outputPath = (0, path_1.resolve)(outputDir, "event-missions.json");
    await (0, promises_1.mkdir)(outputDir, { recursive: true });
    await (0, format_json_1.writeFormattedJson)(outputPath, dataset);
    return outputPath;
}
exports.writeDokkanFyiEventMissions = writeDokkanFyiEventMissions;
function buildEventMissionDataset(categories, failedCategoryIds = []) {
    const missionCount = categories.flatMap(category => category.missions).length;
    return {
        generatedAt: new Date().toISOString(),
        source: "dokkan.fyi",
        count: categories.length,
        missionCount,
        failedCategoryIds: failedCategoryIds.length ? [...new Set(failedCategoryIds)].sort() : undefined,
        categories: [...categories].sort((left, right) => (right.priority ?? 0) - (left.priority ?? 0) || left.id.localeCompare(right.id)),
    };
}
exports.buildEventMissionDataset = buildEventMissionDataset;
function mapEventMissionCategoryFromFyi(detail, summary) {
    return {
        id: detail.id.toString(),
        type: cleanInlineText(detail.type ?? summary?.type) || undefined,
        endsAt: releaseDate(detail.ends_at ?? summary?.ends_at),
        isIndefinite: toOptionalBooleanFlag(detail.is_indefinite ?? summary?.is_indefinite),
        priority: toOptionalNumber(detail.priority ?? summary?.priority),
        imageUrl: cleanInlineText(detail.img ?? summary?.img) || undefined,
        missionsCount: toOptionalNumber(detail.missions_count ?? summary?.missions_count),
        completedCount: toOptionalNumber(detail.completed_count ?? summary?.completed_count),
        previewRewards: mapRewardSummaryFromFyi(summary?.reward),
        missions: (detail.missions ?? []).map(mapEventMissionEntryFromFyi),
    };
}
exports.mapEventMissionCategoryFromFyi = mapEventMissionCategoryFromFyi;
function mapEventMissionEntryFromFyi(mission) {
    return {
        id: mission.id.toString(),
        type: cleanInlineText(mission.type) || undefined,
        name: cleanMultilineText(mission.name),
        description: htmlToText(mission.description),
        priority: toOptionalNumber(mission.priority),
        startsAt: releaseDate(mission.starts_at),
        endsAt: releaseDate(mission.ends_at),
        categoryId: toStringOrUndefined(mission.category_id),
        completed: toOptionalBoolean(mission.completed),
        rewards: (mission.rewards ?? []).map(mapEventMissionRewardFromFyi),
        characters: (mission.characters ?? []).map(mapEventMissionCharacterRefFromFyi),
    };
}
exports.mapEventMissionEntryFromFyi = mapEventMissionEntryFromFyi;
function mapEventMissionRewardFromFyi(reward) {
    return {
        id: toStringOrUndefined(reward.id),
        missionId: toStringOrUndefined(reward.mission_id),
        itemId: toStringOrUndefined(reward.item_id ?? reward.item?.id),
        itemType: cleanInlineText(reward.item_type) || undefined,
        quantity: toNumber(reward.quantity),
        name: cleanInlineText(reward.item?.name) || undefined,
        description: cleanMultilineText(reward.item?.description) || undefined,
        rarity: toOptionalNumber(reward.item?.rarity),
        zeni: toOptionalNumber(reward.item?.zeni),
        tradePoints: toOptionalNumber(reward.item?.trade_points),
        rewardType: cleanInlineText(reward.item?.type) || undefined,
        amount: toOptionalNumber(reward.item?.amount),
        grade: cleanInlineText(reward.item?.grade) || undefined,
        isReusable: toOptionalBoolean(reward.item?.is_reusable),
        imageId: cleanInlineText(reward.item?.img_id) || undefined,
        skills: (reward.item?.skills ?? []).map(mapEventMissionRewardSkillFromFyi),
    };
}
exports.mapEventMissionRewardFromFyi = mapEventMissionRewardFromFyi;
function mapEventMissionRewardSkillFromFyi(skill) {
    return {
        id: toStringOrUndefined(skill.id),
        attribute: cleanInlineText(skill.attribute) || undefined,
        level: toOptionalNumber(skill.level),
        hiddenPotentialSkillId: toOptionalNumber(skill.hidden_potential_skill_id),
    };
}
exports.mapEventMissionRewardSkillFromFyi = mapEventMissionRewardSkillFromFyi;
function mapEventMissionCharacterRefFromFyi(character) {
    return {
        id: character.id.toString(),
        canonicalId: toStringOrUndefined(character.canonical_id),
        baseCharacterId: toStringOrUndefined(character.base_character_id),
        characterId: toStringOrUndefined(character.character_id),
        name: cleanInlineText(character.name),
        rarity: rarityFromInput(character.rarity_text, character.rarity),
        type: typeFromInput(character.type_text, character.type),
        characterClass: classFromInput(character.awakening_type_text, character.awakening_type),
        thumbnailId: toStringOrUndefined(character.thumbnail_id),
        portraitUrl: portraitUrl(character.thumbnail_id),
        latestReleaseType: cleanInlineText(character.release_dates?.latest_type) || undefined,
        hasEza: toOptionalBoolean(character.has_eza),
        hasSeza: toOptionalBoolean(character.has_seza),
        isReversiblyExchanged: toOptionalBoolean(character.is_reversibly_exchanged),
        isFreelyObtainable: toOptionalBoolean(character.is_freely_obtainable),
    };
}
exports.mapEventMissionCharacterRefFromFyi = mapEventMissionCharacterRefFromFyi;
function mapRewardSummaryFromFyi(summary) {
    if (!summary) {
        return [];
    }
    return [
        mapRewardSummaryItem(summary.id, summary.item1_id, summary.item1_type, summary.item1, 1),
        mapRewardSummaryItem(summary.id, summary.item2_id, summary.item2_type, summary.item2, 1),
        mapRewardSummaryItem(summary.id, summary.item3_id, summary.item3_type, summary.item3, 1),
        mapRewardSummaryItem(summary.id, summary.item4_id, summary.item4_type, summary.item4, 1),
    ].filter((reward) => Boolean(reward));
}
function mapRewardSummaryItem(rewardId, itemId, itemType, item, quantity) {
    const normalizedItemId = toStringOrUndefined(itemId ?? item?.id);
    if (!normalizedItemId) {
        return undefined;
    }
    return {
        id: toStringOrUndefined(rewardId),
        itemId: normalizedItemId,
        itemType: cleanInlineText(itemType) || undefined,
        quantity,
        name: cleanInlineText(item?.name) || undefined,
        description: cleanMultilineText(item?.description) || undefined,
        rarity: toOptionalNumber(item?.rarity),
        zeni: toOptionalNumber(item?.zeni),
        tradePoints: toOptionalNumber(item?.trade_points),
        rewardType: cleanInlineText(item?.type) || undefined,
        amount: toOptionalNumber(item?.amount),
        grade: cleanInlineText(item?.grade) || undefined,
        isReusable: toOptionalBoolean(item?.is_reusable),
        imageId: cleanInlineText(item?.img_id) || undefined,
        skills: (item?.skills ?? []).map(mapEventMissionRewardSkillFromFyi),
    };
}
function requestedEventMissionCategoryLimit() {
    const value = parseInt(process.env.DOKKAN_FYI_EVENT_MISSION_CATEGORY_LIMIT ?? "", 10);
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
function cleanInlineText(value) {
    if (value === null || value === undefined) {
        return "";
    }
    return String(value).replace(/\s+/g, " ").trim();
}
function cleanMultilineText(value) {
    return String(value ?? "")
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/\r/g, "")
        .split("\n")
        .map(line => cleanInlineText(line))
        .filter(Boolean)
        .join("\n");
}
function htmlToText(value) {
    return cleanMultilineText(String(value ?? "")
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<\/p>/gi, "\n")
        .replace(/<[^>]+>/g, ""));
}
function releaseDate(value) {
    const normalized = cleanInlineText(value);
    return normalized ? new Date(normalized).toISOString() : undefined;
}
function portraitUrl(thumbnailId) {
    const id = toOptionalNumber(thumbnailId);
    if (!id) {
        return undefined;
    }
    return `https://cdn.dokkan.fyi/assets/en/character/thumb/card_${id}_thumb/card_${id}_thumb.png`;
}
function rarityFromInput(text, value) {
    switch (cleanInlineText(text).toUpperCase()) {
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
    switch (cleanInlineText(text).toUpperCase()) {
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
    switch (cleanInlineText(text).toUpperCase()) {
        case "SUPER":
            return character_1.Classes.Super;
        case "EXTREME":
            return character_1.Classes.Extreme;
        default:
            break;
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
function toNumber(value) {
    if (typeof value === "number" && Number.isFinite(value)) {
        return value;
    }
    if (typeof value === "string") {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : 0;
    }
    return 0;
}
function toOptionalNumber(value) {
    if (typeof value === "number") {
        return Number.isFinite(value) ? value : undefined;
    }
    if (typeof value === "string") {
        const normalized = value.trim();
        if (!normalized) {
            return undefined;
        }
        const parsed = Number(normalized);
        return Number.isFinite(parsed) ? parsed : undefined;
    }
    return undefined;
}
function toOptionalBoolean(value) {
    return typeof value === "boolean" ? value : undefined;
}
function toOptionalBooleanFlag(value) {
    if (typeof value === "boolean") {
        return value;
    }
    if (typeof value === "number") {
        return value !== 0;
    }
    return undefined;
}
function toStringOrUndefined(value) {
    if (value === null || value === undefined) {
        return undefined;
    }
    const normalized = String(value).trim();
    return normalized ? normalized : undefined;
}
async function fetchDokkanFyiText(url, label, retries = requestedEventMissionRetries()) {
    let response;
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), requestedEventMissionTimeoutMs());
        try {
            response = await fetch(url, {
                headers: browserHeaders(),
                signal: controller.signal,
            });
        }
        finally {
            clearTimeout(timeout);
        }
    }
    catch (error) {
        if (retries > 1) {
            await delay(500 + (requestedEventMissionRetries() - retries) * 500);
            return fetchDokkanFyiText(url, label, retries - 1);
        }
        throw new Error(`Could not fetch dokkan.fyi ${label}: ${errorMessage(error)}`);
    }
    if (response.ok) {
        return response.text();
    }
    if (retries > 1 && shouldRetryStatus(response.status)) {
        await delay(500 + (requestedEventMissionRetries() - retries) * 500);
        return fetchDokkanFyiText(url, label, retries - 1);
    }
    throw new Error(`Could not fetch dokkan.fyi ${label}: ${response.status}`);
}
async function readCachedPayload(fileName) {
    if (/^(1|true|yes)$/i.test(process.env.DOKKAN_FYI_EVENT_MISSION_REFRESH ?? "")) {
        return undefined;
    }
    const cachePath = (0, path_1.resolve)(__dirname, EVENT_MISSION_CACHE_DIR, fileName);
    try {
        const raw = await (0, promises_1.readFile)(cachePath, "utf8");
        const entry = JSON.parse(raw);
        const fetchedAt = Date.parse(entry.fetchedAt);
        if (!entry.payload || !Number.isFinite(fetchedAt)) {
            return undefined;
        }
        const ttlHours = parseFloat(process.env.DOKKAN_FYI_EVENT_MISSION_CACHE_TTL_HOURS ?? "");
        const cacheTtlHours = Number.isFinite(ttlHours) && ttlHours >= 0 ? ttlHours : DEFAULT_CACHE_TTL_HOURS;
        if (Date.now() - fetchedAt > cacheTtlHours * 60 * 60 * 1000) {
            return undefined;
        }
        return entry.payload;
    }
    catch {
        return undefined;
    }
}
async function writeCachedPayload(fileName, payload) {
    const cacheDir = (0, path_1.resolve)(__dirname, EVENT_MISSION_CACHE_DIR);
    const cachePath = (0, path_1.resolve)(cacheDir, fileName);
    const temporaryPath = `${cachePath}.tmp`;
    await (0, promises_1.mkdir)(cacheDir, { recursive: true });
    await (0, promises_1.writeFile)(temporaryPath, JSON.stringify({
        fetchedAt: new Date().toISOString(),
        payload,
    }));
    await (0, promises_1.rename)(temporaryPath, cachePath);
}
function requestedEventMissionConcurrency() {
    const value = parseInt(process.env.DOKKAN_FYI_EVENT_MISSION_CONCURRENCY ?? "", 10);
    return Number.isFinite(value) && value > 0 ? value : 4;
}
function requestedEventMissionTimeoutMs() {
    const value = parseInt(process.env.DOKKAN_FYI_EVENT_MISSION_TIMEOUT_MS ?? "", 10);
    return Number.isFinite(value) && value > 0 ? value : DEFAULT_REQUEST_TIMEOUT_MS;
}
function requestedEventMissionRetries() {
    const value = parseInt(process.env.DOKKAN_FYI_EVENT_MISSION_RETRIES ?? "", 10);
    return Number.isFinite(value) && value > 0 ? value : 3;
}
function shouldRetryStatus(status) {
    return status === 409 || status === 429 || status >= 500;
}
function errorMessage(error) {
    if (error instanceof Error) {
        return error.name === "AbortError"
            ? `request timed out after ${requestedEventMissionTimeoutMs()}ms`
            : error.message;
    }
    return String(error);
}
function delay(ms) {
    return new Promise(resolveDelay => setTimeout(resolveDelay, ms));
}
async function mapWithConcurrency(input, concurrency, mapper) {
    const results = new Array(input.length);
    let cursor = 0;
    async function worker() {
        while (true) {
            const index = cursor++;
            if (index >= input.length) {
                return;
            }
            results[index] = await mapper(input[index], index);
        }
    }
    const workerCount = Math.max(1, Math.min(concurrency, input.length || 1));
    await Promise.all(Array.from({ length: workerCount }, () => worker()));
    return results;
}
//# sourceMappingURL=fyi-event-missions.js.map