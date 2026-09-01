"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mapUltimateClashDetail = exports.mapUltimateClashIndexPage = exports.writeDokkanInfoUltimateClashes = exports.getDokkanInfoUltimateClashes = void 0;
const promises_1 = require("fs/promises");
const path_1 = require("path");
const dokkaninfo_special_events_common_1 = require("./dokkaninfo-special-events-common");
const format_json_1 = require("./format-json");
const scraper_1 = require("./scraper");
const INDEX_URL = `${dokkaninfo_special_events_common_1.DOKKAN_INFO_BASE_URL}/events/rmbattle`;
const CACHE_DIR = "data/dokkaninfo-ultimate-clash/cache-v2";
const OUTPUT_DIR = "data/dokkaninfo-ultimate-clash/latest";
const OUTPUT_FILE = "ultimate-clash.json";
const ENV_PREFIX = "DOKKANINFO_ULTIMATE_CLASH";
async function getDokkanInfoUltimateClashes() {
    const first = await fetchClashIndexPage(1);
    const remainingPages = Array.from({ length: Math.max(0, first.lastPage - 1) }, (_, index) => index + 2);
    const pages = [first, ...await (0, dokkaninfo_special_events_common_1.mapWithConcurrency)(remainingPages, (0, dokkaninfo_special_events_common_1.requestedConcurrency)(ENV_PREFIX), page => fetchClashIndexPage(page))];
    const summaries = [...new Map(pages.flatMap(page => page.clashes).map(clash => [clash.id, clash])).values()]
        .sort((left, right) => (0, dokkaninfo_special_events_common_1.compareIds)(left.id, right.id));
    if (summaries.length !== first.total) {
        throw new Error(`DokkanInfo Ultimate Clash advertised ${first.total} editions but exposed ${summaries.length}.`);
    }
    const failedClashIds = [];
    let completed = 0;
    const clashes = (await (0, dokkaninfo_special_events_common_1.mapWithConcurrency)(summaries, (0, dokkaninfo_special_events_common_1.requestedConcurrency)(ENV_PREFIX, 2), async (summary) => {
        try {
            const clash = await fetchClashDetail(summary);
            completed += 1;
            console.log(`[DOKKANINFO-CLASH] Editions ${completed}/${summaries.length}: ${summary.id} (${clash.levels.length} levels)`);
            return clash;
        }
        catch (error) {
            failedClashIds.push(summary.id);
            completed += 1;
            console.error(`[DOKKANINFO-CLASH] Failed edition ${summary.id}: ${errorMessage(error)}`);
            return undefined;
        }
    })).filter((clash) => Boolean(clash));
    return (0, dokkaninfo_special_events_common_1.withoutUndefined)({
        schemaVersion: "1.0.0",
        generatedAt: new Date().toISOString(),
        source: "dokkaninfo",
        sourcePath: INDEX_URL,
        clashCount: clashes.length,
        levelCount: clashes.reduce((sum, clash) => sum + clash.levels.length, 0),
        enemyCount: clashes.reduce((sum, clash) => sum + clash.levels.reduce((levelSum, level) => levelSum + level.enemies.length, 0), 0),
        missionCount: clashes.reduce((sum, clash) => sum + clash.missions.length, 0),
        failedClashIds: failedClashIds.length ? failedClashIds.sort(dokkaninfo_special_events_common_1.compareIds) : undefined,
        clashes,
    });
}
exports.getDokkanInfoUltimateClashes = getDokkanInfoUltimateClashes;
async function writeDokkanInfoUltimateClashes(dataset) {
    const outputPath = (0, path_1.resolve)(__dirname, OUTPUT_DIR, OUTPUT_FILE);
    await (0, promises_1.mkdir)((0, path_1.resolve)(__dirname, OUTPUT_DIR), { recursive: true });
    await (0, format_json_1.writeFormattedJson)(outputPath, dataset ?? await getDokkanInfoUltimateClashes());
    return outputPath;
}
exports.writeDokkanInfoUltimateClashes = writeDokkanInfoUltimateClashes;
function mapUltimateClashIndexPage(document) {
    (0, dokkaninfo_special_events_common_1.assertUsablePage)(document, "Ultimate Clash index");
    const payload = (0, dokkaninfo_special_events_common_1.parseJsonAttribute)(document.querySelector("rm-battles")?.getAttribute("v-bind:rmbattles_json"), "Ultimate Clash index payload");
    const page = (0, dokkaninfo_special_events_common_1.requiredNumber)(payload.current_page, "Ultimate Clash current page");
    return {
        page,
        lastPage: (0, dokkaninfo_special_events_common_1.requiredNumber)(payload.last_page, "Ultimate Clash last page"),
        total: (0, dokkaninfo_special_events_common_1.requiredNumber)(payload.total, "Ultimate Clash total"),
        clashes: (payload.data ?? []).map(mapClashSummary),
    };
}
exports.mapUltimateClashIndexPage = mapUltimateClashIndexPage;
function mapUltimateClashDetail(document, summary) {
    (0, dokkaninfo_special_events_common_1.assertUsablePage)(document, `Ultimate Clash ${summary.id}`);
    const timestamps = Array.from(document.querySelectorAll("unix-to-date"))
        .map(element => (0, dokkaninfo_special_events_common_1.requiredNumber)(element.getAttribute("timestamp") ?? element.getAttribute("v-bind:timestamp"), `Ultimate Clash ${summary.id} timestamp`));
    if (timestamps.length >= 2 && (timestamps[0] !== summary.startAt || timestamps[1] !== summary.endAt)) {
        throw new Error(`Ultimate Clash ${summary.id} schedule differs between index and detail.`);
    }
    const levels = mapClashLevels(document, summary.id);
    const missions = Array.from(document.querySelectorAll("mission[v-bind\\:mission]"))
        .map(element => mapClashMission(element, summary.id))
        .sort((left, right) => right.priority - left.priority || (0, dokkaninfo_special_events_common_1.compareIds)(left.id, right.id));
    if (!levels.length)
        throw new Error(`Ultimate Clash ${summary.id} exposed no battle levels.`);
    return (0, dokkaninfo_special_events_common_1.withoutUndefined)({
        ...summary,
        title: (0, dokkaninfo_special_events_common_1.stripDokkanInfoTitle)(document) || `Ultimate Clash ${summary.id}`,
        bannerPath: (0, dokkaninfo_special_events_common_1.absoluteOptionalUrl)(document.querySelector('img[src*="/ingame/news/"]')?.getAttribute("src")) ?? summary.bannerPath,
        missionRewardBannerPath: (0, dokkaninfo_special_events_common_1.absoluteOptionalUrl)(document.querySelector('img[src*="/ingame/rmbattles/"]')?.getAttribute("src")) ?? summary.missionRewardBannerPath,
        levels,
        missions,
    });
}
exports.mapUltimateClashDetail = mapUltimateClashDetail;
function mapClashLevels(document, clashId) {
    const firstCard = document.querySelector("card-icon[v-bind\\:card]");
    const root = firstCard?.closest(".col-sm.bg-main");
    if (!root)
        return [];
    const levels = [];
    let current;
    for (const child of Array.from(root.children)) {
        if (child.classList.contains("border-bottom") && child.classList.contains("bg-third")) {
            const levelImage = Array.from(child.querySelectorAll("img[alt]"))
                .find(image => /^\d+$/.test((0, dokkaninfo_special_events_common_1.cleanText)(image.getAttribute("alt"))));
            const level = (0, dokkaninfo_special_events_common_1.requiredNumber)(levelImage?.getAttribute("alt"), `Ultimate Clash ${clashId} level`);
            current = {
                level,
                headerImagePath: (0, dokkaninfo_special_events_common_1.absoluteOptionalUrl)(levelImage?.getAttribute("src")),
                enemies: [],
            };
            levels.push(current);
            continue;
        }
        if (current && child.classList.contains("bg-main-box-text") && child.querySelector("card-icon[v-bind\\:card]")) {
            current.enemies.push(mapClashEnemy(child, current.level, clashId, current.enemies.length + 1));
        }
    }
    return levels.filter(level => level.enemies.length > 0);
}
function mapClashEnemy(row, level, clashId, sequence) {
    const cardElement = row.querySelector("card-icon[v-bind\\:card]");
    const card = mapCardElement(cardElement, `Ultimate Clash ${clashId} level ${level}`);
    const battleRow = cardElement?.closest(".row.padding-top-bottom-10.align-items-center");
    const columns = battleRow ? Array.from(battleRow.children) : [];
    const statsColumn = columns.find(column => column.classList.contains("col-sm-2"));
    const mechanicsColumn = columns.find(column => column.classList.contains("col-sm-8"));
    const statLines = labelledLines(statsColumn);
    const fields = new Map(statLines.map(value => [value.label, value.value]));
    const topColumns = Array.from(row.children);
    const displayLabel = topColumns[0]?.querySelector('img[src]');
    const displayLabelPath = displayLabel?.getAttribute("src");
    return (0, dokkaninfo_special_events_common_1.withoutUndefined)({
        sequence,
        displayLabelKind: displayLabelPath?.includes("dai_boss_label") ? "boss" : displayLabelPath ? "number" : undefined,
        displayLabelRaw: (0, dokkaninfo_special_events_common_1.cleanText)(displayLabel?.getAttribute("alt")) || undefined,
        displayLabelImagePath: (0, dokkaninfo_special_events_common_1.absoluteOptionalUrl)(displayLabelPath),
        card,
        healthBars: (0, dokkaninfo_special_events_common_1.optionalNumber)(fields.get("Health Bars")),
        hp: (0, dokkaninfo_special_events_common_1.optionalNumber)(fields.get("HP")),
        atk: (0, dokkaninfo_special_events_common_1.optionalNumber)(fields.get("ATK")),
        def: (0, dokkaninfo_special_events_common_1.optionalNumber)(fields.get("DEF")),
        damageReductionPercent: (0, dokkaninfo_special_events_common_1.optionalNumber)(fields.get("DR")),
        superAttackStats: statLines.filter(value => !["Health Bars", "HP", "ATK", "DEF", "DR"].includes(value.label)),
        mechanics: mapMechanics(mechanicsColumn),
        rewards: mapVisualRewards(topColumns[2]),
    });
}
function mapMechanics(element) {
    if (!element)
        return [];
    return Array.from(element.children)
        .filter(child => child.classList.contains("row"))
        .map((row, index) => {
        const columns = Array.from(row.children);
        const text = (0, dokkaninfo_special_events_common_1.cleanText)(columns[0]?.textContent) || undefined;
        const values = (0, dokkaninfo_special_events_common_1.cleanText)(columns.slice(1).map(column => column.textContent).join(" ")) || undefined;
        return (0, dokkaninfo_special_events_common_1.withoutUndefined)({
            sequence: index + 1,
            text,
            values,
            icons: Array.from(row.querySelectorAll("img[src]")).map(image => (0, dokkaninfo_special_events_common_1.withoutUndefined)({
                alt: (0, dokkaninfo_special_events_common_1.cleanText)(image.getAttribute("alt")) || undefined,
                path: (0, dokkaninfo_special_events_common_1.absoluteUrl)(image.getAttribute("src")),
            })),
        });
    })
        .filter(value => value.text || value.values || value.icons.length);
}
function mapVisualRewards(element) {
    if (!element)
        return [];
    const images = Array.from(element.querySelectorAll("img[src]"));
    return images.map(image => {
        let container = image.parentElement;
        while (container && container.parentElement !== element && !/\bx\s*[\d,]+\b/i.test((0, dokkaninfo_special_events_common_1.cleanText)(container.textContent))) {
            container = container.parentElement;
        }
        return (0, dokkaninfo_special_events_common_1.withoutUndefined)({
            quantity: (0, dokkaninfo_special_events_common_1.optionalNumber)((0, dokkaninfo_special_events_common_1.cleanText)(container?.textContent).match(/\bx\s*([\d,]+)/i)?.[1]),
            label: (0, dokkaninfo_special_events_common_1.cleanText)(image.getAttribute("alt")) || undefined,
            imagePath: (0, dokkaninfo_special_events_common_1.absoluteUrl)(image.getAttribute("src")),
        });
    });
}
function mapClashMission(element, clashId) {
    const raw = (0, dokkaninfo_special_events_common_1.parseJsonAttribute)(element.getAttribute("v-bind:mission"), `Ultimate Clash ${clashId} mission`);
    const id = (0, dokkaninfo_special_events_common_1.toId)(raw.id, `Ultimate Clash ${clashId} mission ID`);
    const rewardValues = Array.isArray(raw.mission_rewards)
        ? raw.mission_rewards
        : Object.values(raw.mission_rewards ?? {});
    return {
        id,
        type: (0, dokkaninfo_special_events_common_1.cleanText)(raw.type) || "unknown",
        name: (0, dokkaninfo_special_events_common_1.cleanText)(raw.name) || `Mission ${id}`,
        description: (0, dokkaninfo_special_events_common_1.cleanText)(raw.description),
        priority: (0, dokkaninfo_special_events_common_1.optionalNumber)(raw.priority) ?? 0,
        targetValue: (0, dokkaninfo_special_events_common_1.optionalNumber)(raw.target_value) ?? 0,
        conditions: parseConditions(raw.conditions),
        rewards: rewardValues.map(mapMissionReward).sort((left, right) => (0, dokkaninfo_special_events_common_1.compareIds)(left.id ?? "", right.id ?? "")),
    };
}
function mapMissionReward(raw) {
    return (0, dokkaninfo_special_events_common_1.withoutUndefined)({
        id: raw.id === undefined ? undefined : String(raw.id),
        itemId: raw.item_id === undefined ? undefined : String(raw.item_id),
        itemType: (0, dokkaninfo_special_events_common_1.cleanText)(raw.item_type) || "unknown",
        quantity: (0, dokkaninfo_special_events_common_1.optionalNumber)(raw.quantity) ?? 0,
        description: (0, dokkaninfo_special_events_common_1.cleanText)(raw.description) || undefined,
        giftDescription: (0, dokkaninfo_special_events_common_1.cleanText)(raw.gift_description) || undefined,
    });
}
function mapCardElement(element, label) {
    const raw = (0, dokkaninfo_special_events_common_1.parseJsonAttribute)(element?.getAttribute("v-bind:card"), `${label} enemy card`);
    const id = (0, dokkaninfo_special_events_common_1.toId)(raw.id, `${label} enemy card ID`);
    const iconId = raw.icon_id === undefined ? undefined : String(raw.icon_id);
    return (0, dokkaninfo_special_events_common_1.withoutUndefined)({
        id,
        name: (0, dokkaninfo_special_events_common_1.cleanText)(raw.name) || undefined,
        elementRaw: raw.element === undefined ? undefined : String(raw.element),
        rarityRaw: (0, dokkaninfo_special_events_common_1.optionalNumber)(raw.rarity),
        iconId,
        resourceId: raw.resource_id === null || raw.resource_id === undefined ? undefined : String(raw.resource_id),
        sourcePath: `${dokkaninfo_special_events_common_1.DOKKAN_INFO_BASE_URL}/cards/${id}`,
        portraitPath: iconId ? `${dokkaninfo_special_events_common_1.DOKKAN_INFO_BASE_URL}/assets/global/en/character/thumb/card_${iconId}_thumb/card_${iconId}_thumb.png` : undefined,
    });
}
function labelledLines(element) {
    if (!element)
        return [];
    return Array.from(element.children)
        .filter(child => child.classList.contains("row"))
        .map((row) => {
        const heading = row.querySelector("b");
        const label = (0, dokkaninfo_special_events_common_1.cleanText)(heading?.textContent).replace(/:$/, "");
        if (!label)
            return undefined;
        const text = (0, dokkaninfo_special_events_common_1.cleanText)(row.textContent);
        const value = (0, dokkaninfo_special_events_common_1.cleanText)(text.slice((0, dokkaninfo_special_events_common_1.cleanText)(heading?.textContent).length)).replace(/^:\s*/, "") || undefined;
        return (0, dokkaninfo_special_events_common_1.withoutUndefined)({ label, value });
    })
        .filter((value) => Boolean(value));
}
function parseConditions(value) {
    if (value && typeof value === "object")
        return value;
    if (!value)
        return {};
    try {
        const parsed = JSON.parse(String(value));
        return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : { value: parsed };
    }
    catch {
        return { raw: String(value) };
    }
}
function mapClashSummary(raw) {
    const id = (0, dokkaninfo_special_events_common_1.toId)(raw.id, "Ultimate Clash ID");
    return (0, dokkaninfo_special_events_common_1.withoutUndefined)({
        id,
        title: `Ultimate Clash ${id}`,
        sourcePath: `${INDEX_URL}/${id}`,
        startAt: (0, dokkaninfo_special_events_common_1.requiredNumber)(raw.start_at, `Ultimate Clash ${id} start`),
        endAt: (0, dokkaninfo_special_events_common_1.requiredNumber)(raw.end_at, `Ultimate Clash ${id} end`),
        cardCountLimit: (0, dokkaninfo_special_events_common_1.requiredNumber)(raw.card_count_limit, `Ultimate Clash ${id} card limit`),
        announcementId: raw.announcement_id === undefined ? undefined : String(raw.announcement_id),
        bannerFileName: (0, dokkaninfo_special_events_common_1.cleanText)(raw.banner_image) || undefined,
        missionRewardBannerFileName: (0, dokkaninfo_special_events_common_1.cleanText)(raw.mission_reward_image) || undefined,
        levels: [],
        missions: [],
    });
}
async function fetchClashIndexPage(page) {
    const path = `index/page-${page}.json`;
    const cached = await (0, dokkaninfo_special_events_common_1.readSpecialCache)(CACHE_DIR, ENV_PREFIX, path);
    if (cached)
        return cached;
    await (0, dokkaninfo_special_events_common_1.delay)((0, dokkaninfo_special_events_common_1.requestedDelayMs)(ENV_PREFIX));
    const value = mapUltimateClashIndexPage(await (0, scraper_1.fetchFromWeb)(`${INDEX_URL}?page=${page}`));
    if (value.page !== page)
        throw new Error(`Ultimate Clash requested page ${page} but received page ${value.page}.`);
    await (0, dokkaninfo_special_events_common_1.writeSpecialCache)(CACHE_DIR, path, value);
    return value;
}
async function fetchClashDetail(summary) {
    const path = `clashes/${summary.id}.json`;
    const cached = await (0, dokkaninfo_special_events_common_1.readSpecialCache)(CACHE_DIR, ENV_PREFIX, path);
    if (cached)
        return cached;
    await (0, dokkaninfo_special_events_common_1.delay)((0, dokkaninfo_special_events_common_1.requestedDelayMs)(ENV_PREFIX));
    const value = mapUltimateClashDetail(await (0, scraper_1.fetchFromWeb)(summary.sourcePath), summary);
    await (0, dokkaninfo_special_events_common_1.writeSpecialCache)(CACHE_DIR, path, value);
    return value;
}
function errorMessage(error) {
    return error instanceof Error ? error.message : String(error);
}
//# sourceMappingURL=dokkaninfo-ultimate-clash.js.map