"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mapFrontierBattleDetail = exports.mapFrontierEpisode = exports.mapFrontierSeries = exports.mapFrontierIndex = exports.writeDokkanInfoFrontier = exports.getDokkanInfoFrontier = void 0;
const promises_1 = require("fs/promises");
const path_1 = require("path");
const dokkaninfo_db_stories_1 = require("./dokkaninfo-db-stories");
const dokkaninfo_special_events_common_1 = require("./dokkaninfo-special-events-common");
const format_json_1 = require("./format-json");
const scraper_1 = require("./scraper");
const INDEX_URL = `${dokkaninfo_special_events_common_1.DOKKAN_INFO_BASE_URL}/events/dokkanfrontier`;
const CACHE_DIR = "data/dokkaninfo-frontier/cache";
const OUTPUT_DIR = "data/dokkaninfo-frontier/latest";
const OUTPUT_FILE = "frontier.json";
const ENV_PREFIX = "DOKKANINFO_FRONTIER";
async function getDokkanInfoFrontier() {
    const summaries = await fetchFrontierIndex();
    const failedSeriesIds = [];
    const failedEpisodeIds = [];
    const failedBattleIds = [];
    let completedSeries = 0;
    const seriesShells = (await (0, dokkaninfo_special_events_common_1.mapWithConcurrency)(summaries, (0, dokkaninfo_special_events_common_1.requestedConcurrency)(ENV_PREFIX), async (summary) => {
        try {
            const episodes = await fetchFrontierSeries(summary);
            completedSeries += 1;
            console.log(`[DOKKANINFO-FRONTIER] Series ${completedSeries}/${summaries.length}: ${summary.id} (${episodes.length} episodes)`);
            return { summary, episodes };
        }
        catch (error) {
            failedSeriesIds.push(summary.id);
            completedSeries += 1;
            console.error(`[DOKKANINFO-FRONTIER] Failed series ${summary.id}: ${errorMessage(error)}`);
            return undefined;
        }
    })).filter((value) => Boolean(value));
    const episodeSummaries = seriesShells.flatMap(value => value.episodes);
    let completedEpisodes = 0;
    const episodeShells = (await (0, dokkaninfo_special_events_common_1.mapWithConcurrency)(episodeSummaries, (0, dokkaninfo_special_events_common_1.requestedConcurrency)(ENV_PREFIX), async (summary) => {
        try {
            const episode = await fetchFrontierEpisode(summary);
            completedEpisodes += 1;
            console.log(`[DOKKANINFO-FRONTIER] Episodes ${completedEpisodes}/${episodeSummaries.length}: ${summary.id} (${episode.battles.length} battles)`);
            return episode;
        }
        catch (error) {
            failedEpisodeIds.push(summary.id);
            completedEpisodes += 1;
            console.error(`[DOKKANINFO-FRONTIER] Failed episode ${summary.id}: ${errorMessage(error)}`);
            return undefined;
        }
    })).filter((value) => Boolean(value));
    const allBattles = episodeShells.flatMap(episode => episode.battles);
    let completedBattles = 0;
    const enrichedBattles = await (0, dokkaninfo_special_events_common_1.mapWithConcurrency)(allBattles, (0, dokkaninfo_special_events_common_1.requestedConcurrency)(ENV_PREFIX), async (battle) => {
        try {
            const detail = await fetchFrontierBattleDetail(battle);
            return { ...battle, ...detail };
        }
        catch (error) {
            failedBattleIds.push(battle.id);
            console.error(`[DOKKANINFO-FRONTIER] Failed battle ${battle.id}: ${errorMessage(error)}`);
            return { ...battle, enemyDataStatus: "fetch-failed" };
        }
        finally {
            completedBattles += 1;
            if (completedBattles === 1 || completedBattles % 25 === 0 || completedBattles === allBattles.length) {
                console.log(`[DOKKANINFO-FRONTIER] Battles ${completedBattles}/${allBattles.length}`);
            }
        }
    });
    const battleById = new Map(enrichedBattles.map(battle => [battle.id, battle]));
    const episodeById = new Map(episodeShells.map(episode => [episode.id, {
            ...episode,
            battles: episode.battles.map(battle => battleById.get(battle.id) ?? battle),
        }]));
    const series = seriesShells.map(shell => ({
        ...shell.summary,
        episodes: shell.episodes.map(episode => episodeById.get(episode.id)).filter((value) => Boolean(value)),
    })).sort((left, right) => (0, dokkaninfo_special_events_common_1.compareIds)(left.id, right.id));
    return (0, dokkaninfo_special_events_common_1.withoutUndefined)({
        schemaVersion: "1.0.0",
        generatedAt: new Date().toISOString(),
        source: "dokkaninfo",
        sourcePath: INDEX_URL,
        seriesCount: series.length,
        episodeCount: series.reduce((sum, value) => sum + value.episodes.length, 0),
        battleCount: series.reduce((sum, value) => sum + value.episodes.reduce((episodeSum, episode) => episodeSum + episode.battles.length, 0), 0),
        enemyCount: series.reduce((sum, value) => sum + value.episodes.reduce((episodeSum, episode) => episodeSum + episode.battles.reduce((battleSum, battle) => battleSum + battle.enemies.length, 0), 0), 0),
        failedSeriesIds: failedSeriesIds.length ? failedSeriesIds.sort(dokkaninfo_special_events_common_1.compareIds) : undefined,
        failedEpisodeIds: failedEpisodeIds.length ? failedEpisodeIds.sort(dokkaninfo_special_events_common_1.compareIds) : undefined,
        failedBattleIds: failedBattleIds.length ? failedBattleIds.sort(dokkaninfo_special_events_common_1.compareIds) : undefined,
        series,
    });
}
exports.getDokkanInfoFrontier = getDokkanInfoFrontier;
async function writeDokkanInfoFrontier(dataset) {
    const outputPath = (0, path_1.resolve)(__dirname, OUTPUT_DIR, OUTPUT_FILE);
    await (0, promises_1.mkdir)((0, path_1.resolve)(__dirname, OUTPUT_DIR), { recursive: true });
    await (0, format_json_1.writeFormattedJson)(outputPath, dataset ?? await getDokkanInfoFrontier());
    return outputPath;
}
exports.writeDokkanInfoFrontier = writeDokkanInfoFrontier;
function mapFrontierIndex(document) {
    (0, dokkaninfo_special_events_common_1.assertUsablePage)(document, "Dokkan Frontier index");
    const summaries = Array.from(document.querySelectorAll('a[href^="/events/dokkanfrontier/"]'))
        .map((anchor) => {
        const sourcePath = (0, dokkaninfo_special_events_common_1.absoluteUrl)(anchor.getAttribute("href"));
        const id = sourcePath.match(/\/events\/dokkanfrontier\/(\d+)$/)?.[1];
        if (!id)
            return undefined;
        return (0, dokkaninfo_special_events_common_1.withoutUndefined)({
            id,
            name: (0, dokkaninfo_special_events_common_1.cleanText)(anchor.querySelector(".font-size-2_5")?.textContent) || `Frontier Series ${id}`,
            sourcePath,
            bannerPath: (0, dokkaninfo_special_events_common_1.absoluteOptionalUrl)(anchor.querySelector("img[src]")?.getAttribute("src")),
        });
    })
        .filter((value) => Boolean(value));
    const unique = [...new Map(summaries.map(value => [value.id, value])).values()].sort((left, right) => (0, dokkaninfo_special_events_common_1.compareIds)(left.id, right.id));
    if (!unique.length)
        throw new Error("DokkanInfo exposed no Dokkan Frontier series.");
    return unique;
}
exports.mapFrontierIndex = mapFrontierIndex;
function mapFrontierSeries(document, series) {
    (0, dokkaninfo_special_events_common_1.assertUsablePage)(document, `Dokkan Frontier series ${series.id}`);
    const episodes = Array.from(document.querySelectorAll("a[href]"))
        .map((anchor) => {
        const sourcePath = (0, dokkaninfo_special_events_common_1.absoluteUrl)(anchor.getAttribute("href"));
        const match = sourcePath.match(new RegExp(`/events/dokkanfrontier/${series.id}/(\\d+)$`));
        if (!match)
            return undefined;
        return (0, dokkaninfo_special_events_common_1.withoutUndefined)({
            id: match[1],
            seriesId: series.id,
            title: (0, dokkaninfo_special_events_common_1.cleanText)(anchor.querySelector(".font-size-2_5")?.textContent) || `Frontier Episode ${match[1]}`,
            sourcePath,
            bannerPath: (0, dokkaninfo_special_events_common_1.absoluteOptionalUrl)(anchor.querySelector("img[src]")?.getAttribute("src")),
        });
    })
        .filter((value) => Boolean(value));
    const unique = [...new Map(episodes.map(value => [value.id, value])).values()].sort((left, right) => (0, dokkaninfo_special_events_common_1.compareIds)(left.id, right.id));
    if (!unique.length)
        throw new Error(`DokkanInfo Frontier series ${series.id} exposed no episodes.`);
    return unique;
}
exports.mapFrontierSeries = mapFrontierSeries;
function mapFrontierEpisode(document, summary) {
    (0, dokkaninfo_special_events_common_1.assertUsablePage)(document, `Dokkan Frontier episode ${summary.id}`);
    const battles = Array.from(document.querySelectorAll("a[href]"))
        .map(anchor => mapFrontierBattleAnchor(anchor, summary))
        .filter((value) => Boolean(value));
    const unique = [...new Map(battles.map(value => [value.id, value])).values()]
        .sort((left, right) => compareBattleNumbers(left.number, right.number) || (0, dokkaninfo_special_events_common_1.compareIds)(left.id, right.id));
    if (!unique.length)
        throw new Error(`DokkanInfo Frontier episode ${summary.id} exposed no battles.`);
    return { ...summary, title: (0, dokkaninfo_special_events_common_1.stripDokkanInfoTitle)(document).replace(/\s*-\s*Dokkan Frontier$/i, "") || summary.title, battles: unique };
}
exports.mapFrontierEpisode = mapFrontierEpisode;
function mapFrontierBattleDetail(document, battle) {
    (0, dokkaninfo_special_events_common_1.assertUsablePage)(document, `Dokkan Frontier battle ${battle.id}`);
    const stage = {
        id: battle.id,
        title: battle.title,
        sourcePath: battle.sourcePath,
        enemyDataStatus: "not-provided",
        enemies: [],
    };
    const mapped = (0, dokkaninfo_db_stories_1.mapDbStoryStageDetail)(document, stage);
    const bonusGroup = Array.from(document.querySelectorAll(".row.margin-5.border.border-1.border-main-box-darker.bg-main"))
        .find(group => /Bonus Passive/i.test((0, dokkaninfo_special_events_common_1.cleanText)(group.textContent)));
    const bonusPassiveCards = bonusGroup
        ? Array.from(bonusGroup.querySelectorAll("card-icon[v-bind\\:card]")).map(mapCardElement)
        : [];
    return {
        bonusPassiveCards,
        enemyDataStatus: mapped.enemyDataStatus,
        enemies: mapped.enemies,
    };
}
exports.mapFrontierBattleDetail = mapFrontierBattleDetail;
function mapFrontierBattleAnchor(anchor, summary) {
    const sourcePath = (0, dokkaninfo_special_events_common_1.absoluteUrl)(anchor.getAttribute("href"));
    const match = sourcePath.match(new RegExp(`/events/dokkanfrontier/${summary.seriesId}/${summary.id}/(\\d+)/(\\d+)$`));
    if (!match)
        return undefined;
    const number = labelledValue(anchor, "Number") || match[2];
    const title = labelledValue(anchor, "Title") || `Frontier Battle ${match[2]}`;
    return {
        id: match[2],
        pageId: match[1],
        number,
        title,
        stamina: (0, dokkaninfo_special_events_common_1.optionalNumber)(labelledValue(anchor, "STA")),
        userExp: (0, dokkaninfo_special_events_common_1.optionalNumber)(labelledValue(anchor, "User Exp")),
        zeni: (0, dokkaninfo_special_events_common_1.optionalNumber)(labelledValue(anchor, "Zeni")),
        linkLevelRate: (0, dokkaninfo_special_events_common_1.optionalNumber)(labelledValue(anchor, "Link Level Rate")),
        displayEnemyPortraitPath: (0, dokkaninfo_special_events_common_1.absoluteOptionalUrl)(anchor.querySelector('img[src*="/character/thumb/"]')?.getAttribute("src")),
        clearRewards: Array.from(anchor.querySelectorAll("reward[v-bind\\:reward]")).map(mapRewardElement),
        sourcePath,
        bonusPassiveCards: [],
        enemyDataStatus: "not-provided",
        enemies: [],
    };
}
function labelledValue(element, label) {
    const heading = Array.from(element.querySelectorAll("b")).find(value => (0, dokkaninfo_special_events_common_1.cleanText)(value.textContent).replace(/:$/, "") === label);
    const cell = heading?.closest(".col-sm, .col-sm-2");
    const rows = cell ? Array.from(cell.children).filter(value => value.classList.contains("row")) : [];
    return (0, dokkaninfo_special_events_common_1.cleanText)(rows[1]?.textContent) || undefined;
}
function mapRewardElement(element) {
    const raw = (0, dokkaninfo_special_events_common_1.parseJsonAttribute)(element.getAttribute("v-bind:reward"), "Frontier reward");
    return (0, dokkaninfo_special_events_common_1.withoutUndefined)({
        id: raw.id === undefined ? undefined : String(raw.id),
        itemId: raw.item_id === undefined ? undefined : String(raw.item_id),
        itemType: (0, dokkaninfo_special_events_common_1.cleanText)(raw.item_type) || "unknown",
        quantity: (0, dokkaninfo_special_events_common_1.optionalNumber)(raw.quantity) ?? 0,
        description: (0, dokkaninfo_special_events_common_1.cleanText)(raw.description) || undefined,
        giftDescription: (0, dokkaninfo_special_events_common_1.cleanText)(raw.gift_description) || undefined,
    });
}
function mapCardElement(element) {
    const raw = (0, dokkaninfo_special_events_common_1.parseJsonAttribute)(element.getAttribute("v-bind:card"), "Frontier card");
    const id = (0, dokkaninfo_special_events_common_1.toId)(raw.id, "Frontier card ID");
    const iconId = raw.icon_id === undefined ? undefined : String(raw.icon_id);
    return (0, dokkaninfo_special_events_common_1.withoutUndefined)({
        id,
        name: (0, dokkaninfo_special_events_common_1.cleanText)(raw.name) || undefined,
        elementRaw: raw.element === undefined ? undefined : String(raw.element),
        rarityRaw: (0, dokkaninfo_special_events_common_1.optionalNumber)(raw.rarity),
        iconId,
        resourceId: raw.resource_id === null || raw.resource_id === undefined ? undefined : String(raw.resource_id),
        sourcePath: (0, dokkaninfo_special_events_common_1.absoluteOptionalUrl)(element.closest("a[href]")?.getAttribute("href")),
        portraitPath: iconId ? `${dokkaninfo_special_events_common_1.DOKKAN_INFO_BASE_URL}/assets/global/en/character/thumb/card_${iconId}_thumb/card_${iconId}_thumb.png` : undefined,
    });
}
async function fetchFrontierIndex() {
    const cached = await (0, dokkaninfo_special_events_common_1.readSpecialCache)(CACHE_DIR, ENV_PREFIX, "index.json");
    if (cached)
        return cached;
    const value = mapFrontierIndex(await (0, scraper_1.fetchFromWeb)(INDEX_URL));
    await (0, dokkaninfo_special_events_common_1.writeSpecialCache)(CACHE_DIR, "index.json", value);
    return value;
}
async function fetchFrontierSeries(summary) {
    const path = `series/${summary.id}.json`;
    const cached = await (0, dokkaninfo_special_events_common_1.readSpecialCache)(CACHE_DIR, ENV_PREFIX, path);
    if (cached)
        return cached;
    await (0, dokkaninfo_special_events_common_1.delay)((0, dokkaninfo_special_events_common_1.requestedDelayMs)(ENV_PREFIX));
    const value = mapFrontierSeries(await (0, scraper_1.fetchFromWeb)(summary.sourcePath), summary);
    await (0, dokkaninfo_special_events_common_1.writeSpecialCache)(CACHE_DIR, path, value);
    return value;
}
async function fetchFrontierEpisode(summary) {
    const path = `episodes/${summary.id}.json`;
    const cached = await (0, dokkaninfo_special_events_common_1.readSpecialCache)(CACHE_DIR, ENV_PREFIX, path);
    if (cached)
        return cached;
    await (0, dokkaninfo_special_events_common_1.delay)((0, dokkaninfo_special_events_common_1.requestedDelayMs)(ENV_PREFIX));
    const value = mapFrontierEpisode(await (0, scraper_1.fetchFromWeb)(summary.sourcePath), summary);
    await (0, dokkaninfo_special_events_common_1.writeSpecialCache)(CACHE_DIR, path, value);
    return value;
}
async function fetchFrontierBattleDetail(battle) {
    const path = `battles/${battle.id}.json`;
    const cached = await (0, dokkaninfo_special_events_common_1.readSpecialCache)(CACHE_DIR, ENV_PREFIX, path);
    if (cached)
        return cached;
    await (0, dokkaninfo_special_events_common_1.delay)((0, dokkaninfo_special_events_common_1.requestedDelayMs)(ENV_PREFIX));
    const value = mapFrontierBattleDetail(await (0, scraper_1.fetchFromWeb)(battle.sourcePath), battle);
    await (0, dokkaninfo_special_events_common_1.writeSpecialCache)(CACHE_DIR, path, value);
    return value;
}
function compareBattleNumbers(left, right) {
    const leftParts = left.split("-").map(Number);
    const rightParts = right.split("-").map(Number);
    return (leftParts[0] || 0) - (rightParts[0] || 0) || (leftParts[1] || 0) - (rightParts[1] || 0);
}
function errorMessage(error) {
    return error instanceof Error ? error.message : String(error);
}
//# sourceMappingURL=dokkaninfo-frontier.js.map