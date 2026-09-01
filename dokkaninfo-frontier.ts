import { mkdir } from "fs/promises";
import { resolve } from "path";
import { DokkanInfoDbStoryStage } from "./dokkaninfo-db-story";
import { mapDbStoryStageDetail } from "./dokkaninfo-db-stories";
import {
    DokkanInfoFrontierBattle,
    DokkanInfoFrontierDataset,
    DokkanInfoFrontierEpisode,
    DokkanInfoFrontierSeries,
    DokkanInfoSpecialCardReference,
    DokkanInfoSpecialReward,
} from "./dokkaninfo-special-event";
import {
    DOKKAN_INFO_BASE_URL,
    absoluteOptionalUrl,
    absoluteUrl,
    assertUsablePage,
    cleanText,
    compareIds,
    delay,
    mapWithConcurrency,
    optionalNumber,
    parseJsonAttribute,
    readSpecialCache,
    requestedConcurrency,
    requestedDelayMs,
    stripDokkanInfoTitle,
    toId,
    withoutUndefined,
    writeSpecialCache,
} from "./dokkaninfo-special-events-common";
import { writeFormattedJson } from "./format-json";
import { fetchFromWeb } from "./scraper";

const INDEX_URL = `${DOKKAN_INFO_BASE_URL}/events/dokkanfrontier`;
const CACHE_DIR = "data/dokkaninfo-frontier/cache";
const OUTPUT_DIR = "data/dokkaninfo-frontier/latest";
const OUTPUT_FILE = "frontier.json";
const ENV_PREFIX = "DOKKANINFO_FRONTIER";

interface FrontierSeriesSummary {
    id: string,
    name: string,
    sourcePath: string,
    bannerPath?: string,
}

interface FrontierEpisodeSummary {
    id: string,
    seriesId: string,
    title: string,
    sourcePath: string,
    bannerPath?: string,
}

interface FrontierBattleDetail {
    bonusPassiveCards: DokkanInfoSpecialCardReference[],
    enemyDataStatus: DokkanInfoFrontierBattle["enemyDataStatus"],
    enemies: DokkanInfoFrontierBattle["enemies"],
}

interface RawCard {
    id?: string | number,
    name?: string,
    element?: string | number,
    rarity?: string | number,
    icon_id?: string | number,
    resource_id?: string | number | null,
}

interface RawReward {
    id?: string | number,
    item_id?: string | number,
    item_type?: string,
    quantity?: string | number,
    description?: string,
    gift_description?: string,
}

export async function getDokkanInfoFrontier(): Promise<DokkanInfoFrontierDataset> {
    const summaries = await fetchFrontierIndex();
    const failedSeriesIds: string[] = [];
    const failedEpisodeIds: string[] = [];
    const failedBattleIds: string[] = [];
    let completedSeries = 0;

    const seriesShells = (await mapWithConcurrency(summaries, requestedConcurrency(ENV_PREFIX), async summary => {
        try {
            const episodes = await fetchFrontierSeries(summary);
            completedSeries += 1;
            console.log(`[DOKKANINFO-FRONTIER] Series ${completedSeries}/${summaries.length}: ${summary.id} (${episodes.length} episodes)`);
            return { summary, episodes };
        } catch (error) {
            failedSeriesIds.push(summary.id);
            completedSeries += 1;
            console.error(`[DOKKANINFO-FRONTIER] Failed series ${summary.id}: ${errorMessage(error)}`);
            return undefined;
        }
    })).filter((value): value is { summary: FrontierSeriesSummary, episodes: FrontierEpisodeSummary[] } => Boolean(value));

    const episodeSummaries = seriesShells.flatMap(value => value.episodes);
    let completedEpisodes = 0;
    const episodeShells = (await mapWithConcurrency(episodeSummaries, requestedConcurrency(ENV_PREFIX), async summary => {
        try {
            const episode = await fetchFrontierEpisode(summary);
            completedEpisodes += 1;
            console.log(`[DOKKANINFO-FRONTIER] Episodes ${completedEpisodes}/${episodeSummaries.length}: ${summary.id} (${episode.battles.length} battles)`);
            return episode;
        } catch (error) {
            failedEpisodeIds.push(summary.id);
            completedEpisodes += 1;
            console.error(`[DOKKANINFO-FRONTIER] Failed episode ${summary.id}: ${errorMessage(error)}`);
            return undefined;
        }
    })).filter((value): value is DokkanInfoFrontierEpisode => Boolean(value));

    const allBattles = episodeShells.flatMap(episode => episode.battles);
    let completedBattles = 0;
    const enrichedBattles = await mapWithConcurrency(allBattles, requestedConcurrency(ENV_PREFIX), async battle => {
        try {
            const detail = await fetchFrontierBattleDetail(battle);
            return { ...battle, ...detail };
        } catch (error) {
            failedBattleIds.push(battle.id);
            console.error(`[DOKKANINFO-FRONTIER] Failed battle ${battle.id}: ${errorMessage(error)}`);
            return { ...battle, enemyDataStatus: "fetch-failed" as const };
        } finally {
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

    const series: DokkanInfoFrontierSeries[] = seriesShells.map(shell => ({
        ...shell.summary,
        episodes: shell.episodes.map(episode => episodeById.get(episode.id)).filter((value): value is DokkanInfoFrontierEpisode => Boolean(value)),
    })).sort((left, right) => compareIds(left.id, right.id));

    return withoutUndefined({
        schemaVersion: "1.0.0",
        generatedAt: new Date().toISOString(),
        source: "dokkaninfo",
        sourcePath: INDEX_URL,
        seriesCount: series.length,
        episodeCount: series.reduce((sum, value) => sum + value.episodes.length, 0),
        battleCount: series.reduce((sum, value) => sum + value.episodes.reduce((episodeSum, episode) => episodeSum + episode.battles.length, 0), 0),
        enemyCount: series.reduce((sum, value) => sum + value.episodes.reduce((episodeSum, episode) => episodeSum + episode.battles.reduce((battleSum, battle) => battleSum + battle.enemies.length, 0), 0), 0),
        failedSeriesIds: failedSeriesIds.length ? failedSeriesIds.sort(compareIds) : undefined,
        failedEpisodeIds: failedEpisodeIds.length ? failedEpisodeIds.sort(compareIds) : undefined,
        failedBattleIds: failedBattleIds.length ? failedBattleIds.sort(compareIds) : undefined,
        series,
    }) as DokkanInfoFrontierDataset;
}

export async function writeDokkanInfoFrontier(dataset?: DokkanInfoFrontierDataset): Promise<string> {
    const outputPath = resolve(__dirname, OUTPUT_DIR, OUTPUT_FILE);
    await mkdir(resolve(__dirname, OUTPUT_DIR), { recursive: true });
    await writeFormattedJson(outputPath, dataset ?? await getDokkanInfoFrontier());
    return outputPath;
}

export function mapFrontierIndex(document: Document): FrontierSeriesSummary[] {
    assertUsablePage(document, "Dokkan Frontier index");
    const summaries = Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href^="/events/dokkanfrontier/"]'))
        .map((anchor): FrontierSeriesSummary | undefined => {
            const sourcePath = absoluteUrl(anchor.getAttribute("href"));
            const id = sourcePath.match(/\/events\/dokkanfrontier\/(\d+)$/)?.[1];
            if (!id) return undefined;
            return withoutUndefined({
                id,
                name: cleanText(anchor.querySelector(".font-size-2_5")?.textContent) || `Frontier Series ${id}`,
                sourcePath,
                bannerPath: absoluteOptionalUrl(anchor.querySelector<HTMLImageElement>("img[src]")?.getAttribute("src")),
            });
        })
        .filter((value): value is FrontierSeriesSummary => Boolean(value));
    const unique = [...new Map(summaries.map(value => [value.id, value])).values()].sort((left, right) => compareIds(left.id, right.id));
    if (!unique.length) throw new Error("DokkanInfo exposed no Dokkan Frontier series.");
    return unique;
}

export function mapFrontierSeries(document: Document, series: FrontierSeriesSummary): FrontierEpisodeSummary[] {
    assertUsablePage(document, `Dokkan Frontier series ${series.id}`);
    const episodes = Array.from(document.querySelectorAll<HTMLAnchorElement>("a[href]"))
        .map((anchor): FrontierEpisodeSummary | undefined => {
            const sourcePath = absoluteUrl(anchor.getAttribute("href"));
            const match = sourcePath.match(new RegExp(`/events/dokkanfrontier/${series.id}/(\\d+)$`));
            if (!match) return undefined;
            return withoutUndefined({
                id: match[1],
                seriesId: series.id,
                title: cleanText(anchor.querySelector(".font-size-2_5")?.textContent) || `Frontier Episode ${match[1]}`,
                sourcePath,
                bannerPath: absoluteOptionalUrl(anchor.querySelector<HTMLImageElement>("img[src]")?.getAttribute("src")),
            });
        })
        .filter((value): value is FrontierEpisodeSummary => Boolean(value));
    const unique = [...new Map(episodes.map(value => [value.id, value])).values()].sort((left, right) => compareIds(left.id, right.id));
    if (!unique.length) throw new Error(`DokkanInfo Frontier series ${series.id} exposed no episodes.`);
    return unique;
}

export function mapFrontierEpisode(document: Document, summary: FrontierEpisodeSummary): DokkanInfoFrontierEpisode {
    assertUsablePage(document, `Dokkan Frontier episode ${summary.id}`);
    const battles = Array.from(document.querySelectorAll<HTMLAnchorElement>("a[href]"))
        .map(anchor => mapFrontierBattleAnchor(anchor, summary))
        .filter((value): value is DokkanInfoFrontierBattle => Boolean(value));
    const unique = [...new Map(battles.map(value => [value.id, value])).values()]
        .sort((left, right) => compareBattleNumbers(left.number, right.number) || compareIds(left.id, right.id));
    if (!unique.length) throw new Error(`DokkanInfo Frontier episode ${summary.id} exposed no battles.`);
    return { ...summary, title: stripDokkanInfoTitle(document).replace(/\s*-\s*Dokkan Frontier$/i, "") || summary.title, battles: unique };
}

export function mapFrontierBattleDetail(document: Document, battle: DokkanInfoFrontierBattle): FrontierBattleDetail {
    assertUsablePage(document, `Dokkan Frontier battle ${battle.id}`);
    const stage: DokkanInfoDbStoryStage = {
        id: battle.id,
        title: battle.title,
        sourcePath: battle.sourcePath,
        enemyDataStatus: "not-provided",
        enemies: [],
    };
    const mapped = mapDbStoryStageDetail(document, stage);
    const bonusGroup = Array.from(document.querySelectorAll(".row.margin-5.border.border-1.border-main-box-darker.bg-main"))
        .find(group => /Bonus Passive/i.test(cleanText(group.textContent)));
    const bonusPassiveCards = bonusGroup
        ? Array.from(bonusGroup.querySelectorAll("card-icon[v-bind\\:card]")).map(mapCardElement)
        : [];
    return {
        bonusPassiveCards,
        enemyDataStatus: mapped.enemyDataStatus,
        enemies: mapped.enemies,
    };
}

function mapFrontierBattleAnchor(anchor: HTMLAnchorElement, summary: FrontierEpisodeSummary): DokkanInfoFrontierBattle | undefined {
    const sourcePath = absoluteUrl(anchor.getAttribute("href"));
    const match = sourcePath.match(new RegExp(`/events/dokkanfrontier/${summary.seriesId}/${summary.id}/(\\d+)/(\\d+)$`));
    if (!match) return undefined;
    const number = labelledValue(anchor, "Number") || match[2];
    const title = labelledValue(anchor, "Title") || `Frontier Battle ${match[2]}`;
    return {
        id: match[2],
        pageId: match[1],
        number,
        title,
        stamina: optionalNumber(labelledValue(anchor, "STA")),
        userExp: optionalNumber(labelledValue(anchor, "User Exp")),
        zeni: optionalNumber(labelledValue(anchor, "Zeni")),
        linkLevelRate: optionalNumber(labelledValue(anchor, "Link Level Rate")),
        displayEnemyPortraitPath: absoluteOptionalUrl(anchor.querySelector<HTMLImageElement>('img[src*="/character/thumb/"]')?.getAttribute("src")),
        clearRewards: Array.from(anchor.querySelectorAll("reward[v-bind\\:reward]")).map(mapRewardElement),
        sourcePath,
        bonusPassiveCards: [],
        enemyDataStatus: "not-provided",
        enemies: [],
    };
}

function labelledValue(element: Element, label: string): string | undefined {
    const heading = Array.from(element.querySelectorAll("b")).find(value => cleanText(value.textContent).replace(/:$/, "") === label);
    const cell = heading?.closest(".col-sm, .col-sm-2");
    const rows = cell ? Array.from(cell.children).filter(value => value.classList.contains("row")) : [];
    return cleanText(rows[1]?.textContent) || undefined;
}

function mapRewardElement(element: Element): DokkanInfoSpecialReward {
    const raw = parseJsonAttribute<RawReward>(element.getAttribute("v-bind:reward"), "Frontier reward");
    return withoutUndefined({
        id: raw.id === undefined ? undefined : String(raw.id),
        itemId: raw.item_id === undefined ? undefined : String(raw.item_id),
        itemType: cleanText(raw.item_type) || "unknown",
        quantity: optionalNumber(raw.quantity) ?? 0,
        description: cleanText(raw.description) || undefined,
        giftDescription: cleanText(raw.gift_description) || undefined,
    });
}

function mapCardElement(element: Element): DokkanInfoSpecialCardReference {
    const raw = parseJsonAttribute<RawCard>(element.getAttribute("v-bind:card"), "Frontier card");
    const id = toId(raw.id, "Frontier card ID");
    const iconId = raw.icon_id === undefined ? undefined : String(raw.icon_id);
    return withoutUndefined({
        id,
        name: cleanText(raw.name) || undefined,
        elementRaw: raw.element === undefined ? undefined : String(raw.element),
        rarityRaw: optionalNumber(raw.rarity),
        iconId,
        resourceId: raw.resource_id === null || raw.resource_id === undefined ? undefined : String(raw.resource_id),
        sourcePath: absoluteOptionalUrl(element.closest<HTMLAnchorElement>("a[href]")?.getAttribute("href")),
        portraitPath: iconId ? `${DOKKAN_INFO_BASE_URL}/assets/global/en/character/thumb/card_${iconId}_thumb/card_${iconId}_thumb.png` : undefined,
    });
}

async function fetchFrontierIndex(): Promise<FrontierSeriesSummary[]> {
    const cached = await readSpecialCache<FrontierSeriesSummary[]>(CACHE_DIR, ENV_PREFIX, "index.json");
    if (cached) return cached;
    const value = mapFrontierIndex(await fetchFromWeb(INDEX_URL));
    await writeSpecialCache(CACHE_DIR, "index.json", value);
    return value;
}

async function fetchFrontierSeries(summary: FrontierSeriesSummary): Promise<FrontierEpisodeSummary[]> {
    const path = `series/${summary.id}.json`;
    const cached = await readSpecialCache<FrontierEpisodeSummary[]>(CACHE_DIR, ENV_PREFIX, path);
    if (cached) return cached;
    await delay(requestedDelayMs(ENV_PREFIX));
    const value = mapFrontierSeries(await fetchFromWeb(summary.sourcePath), summary);
    await writeSpecialCache(CACHE_DIR, path, value);
    return value;
}

async function fetchFrontierEpisode(summary: FrontierEpisodeSummary): Promise<DokkanInfoFrontierEpisode> {
    const path = `episodes/${summary.id}.json`;
    const cached = await readSpecialCache<DokkanInfoFrontierEpisode>(CACHE_DIR, ENV_PREFIX, path);
    if (cached) return cached;
    await delay(requestedDelayMs(ENV_PREFIX));
    const value = mapFrontierEpisode(await fetchFromWeb(summary.sourcePath), summary);
    await writeSpecialCache(CACHE_DIR, path, value);
    return value;
}

async function fetchFrontierBattleDetail(battle: DokkanInfoFrontierBattle): Promise<FrontierBattleDetail> {
    const path = `battles/${battle.id}.json`;
    const cached = await readSpecialCache<FrontierBattleDetail>(CACHE_DIR, ENV_PREFIX, path);
    if (cached) return cached;
    await delay(requestedDelayMs(ENV_PREFIX));
    const value = mapFrontierBattleDetail(await fetchFromWeb(battle.sourcePath), battle);
    await writeSpecialCache(CACHE_DIR, path, value);
    return value;
}

function compareBattleNumbers(left: string, right: string): number {
    const leftParts = left.split("-").map(Number);
    const rightParts = right.split("-").map(Number);
    return (leftParts[0] || 0) - (rightParts[0] || 0) || (leftParts[1] || 0) - (rightParts[1] || 0);
}

function errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}
