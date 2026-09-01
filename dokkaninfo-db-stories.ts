import { mkdir, readFile, rename, writeFile } from "fs/promises";
import { resolve } from "path";
import { mapEventMissionReferences, mapEventRewards, DokkanInfoEventSummary } from "./dokkaninfo-event-rewards";
import {
    DokkanInfoDbStory,
    DokkanInfoDbStoryDataset,
    DokkanInfoDbStoryStage,
    DokkanInfoQuestEnemy,
    DokkanInfoQuestEnemySkills,
    DokkanInfoQuestEnemyStats,
    DokkanInfoQuestEnemySuperAttack,
    DokkanInfoQuestEventType,
} from "./dokkaninfo-db-story";
import { writeFormattedJson } from "./format-json";
import { fetchFromWeb } from "./scraper";

const DOKKAN_INFO_BASE_URL = "https://dokkaninfo.com";
const DEFAULT_CONCURRENCY = 3;
const DEFAULT_REQUEST_DELAY_MS = 150;
const CACHE_SCHEMA_VERSION = "3.0.0";

interface QuestEventConfig {
    eventType: DokkanInfoQuestEventType,
    indexUrl: string,
    cacheDir: string,
    outputDir: string,
    outputFile: string,
    envPrefix: string,
    logLabel: string,
}

const DB_STORIES_CONFIG: QuestEventConfig = {
    eventType: "dbstories",
    indexUrl: `${DOKKAN_INFO_BASE_URL}/events/dbstories`,
    cacheDir: "data/dokkaninfo-db-stories/cache",
    outputDir: "data/dokkaninfo-db-stories/latest",
    outputFile: "db-stories.json",
    envPrefix: "DOKKANINFO_DB_STORIES",
    logLabel: "DOKKANINFO-DB-STORIES",
};

const STORIES_CONFIG: QuestEventConfig = {
    eventType: "story",
    indexUrl: `${DOKKAN_INFO_BASE_URL}/events/story`,
    cacheDir: "data/dokkaninfo-stories/cache",
    outputDir: "data/dokkaninfo-stories/latest",
    outputFile: "stories.json",
    envPrefix: "DOKKANINFO_STORIES",
    logLabel: "DOKKANINFO-STORIES",
};

const GROWTH_CONFIG: QuestEventConfig = {
    eventType: "growth",
    indexUrl: `${DOKKAN_INFO_BASE_URL}/events/growth`,
    cacheDir: "data/dokkaninfo-growth/cache",
    outputDir: "data/dokkaninfo-growth/latest",
    outputFile: "growth.json",
    envPrefix: "DOKKANINFO_GROWTH",
    logLabel: "DOKKANINFO-GROWTH",
};

const LIMITED_CONFIG: QuestEventConfig = {
    eventType: "limited",
    indexUrl: `${DOKKAN_INFO_BASE_URL}/events/limited`,
    cacheDir: "data/dokkaninfo-limited/cache",
    outputDir: "data/dokkaninfo-limited/latest",
    outputFile: "limited.json",
    envPrefix: "DOKKANINFO_LIMITED",
    logLabel: "DOKKANINFO-LIMITED",
};

const CHALLENGE_CONFIG: QuestEventConfig = {
    eventType: "challenge",
    indexUrl: `${DOKKAN_INFO_BASE_URL}/events/challenge`,
    cacheDir: "data/dokkaninfo-challenge/cache",
    outputDir: "data/dokkaninfo-challenge/latest",
    outputFile: "challenge.json",
    envPrefix: "DOKKANINFO_CHALLENGE",
    logLabel: "DOKKANINFO-CHALLENGE",
};

const BONUS_CONFIG: QuestEventConfig = {
    eventType: "bonus",
    indexUrl: `${DOKKAN_INFO_BASE_URL}/events/bonus`,
    cacheDir: "data/dokkaninfo-bonus/cache",
    outputDir: "data/dokkaninfo-bonus/latest",
    outputFile: "bonus.json",
    envPrefix: "DOKKANINFO_BONUS",
    logLabel: "DOKKANINFO-BONUS",
};

const QUEST_CONFIG: QuestEventConfig = {
    eventType: "quest",
    indexUrl: `${DOKKAN_INFO_BASE_URL}/events/quest`,
    cacheDir: "data/dokkaninfo-quest/cache",
    outputDir: "data/dokkaninfo-quest/latest",
    outputFile: "quest.json",
    envPrefix: "DOKKANINFO_QUEST",
    logLabel: "DOKKANINFO-QUEST",
};

interface QuestEventSummary {
    id: string,
    sourcePath: string,
}

interface CachedValue<T> {
    schemaVersion: string,
    fetchedAt: string,
    value: T,
}

interface StoryShell {
    story: Omit<DokkanInfoDbStory, "stages">,
    stages: DokkanInfoDbStoryStage[],
}

interface DokkanInfoEnemyCardPayload {
    id?: number | string | null,
    icon_id?: number | string | null,
    name?: string | null,
    element?: number | string | null,
}

export async function getDokkanInfoDbStories(): Promise<DokkanInfoDbStoryDataset> {
    return getDokkanInfoQuestEvents(DB_STORIES_CONFIG);
}

export async function getDokkanInfoStories(): Promise<DokkanInfoDbStoryDataset> {
    return getDokkanInfoQuestEvents(STORIES_CONFIG);
}

export async function getDokkanInfoGrowthEvents(): Promise<DokkanInfoDbStoryDataset> {
    return getDokkanInfoQuestEvents(GROWTH_CONFIG);
}

export async function getDokkanInfoLimitedEvents(): Promise<DokkanInfoDbStoryDataset> {
    return getDokkanInfoQuestEvents(LIMITED_CONFIG);
}

export async function getDokkanInfoChallengeEvents(): Promise<DokkanInfoDbStoryDataset> {
    return getDokkanInfoQuestEvents(CHALLENGE_CONFIG);
}

export async function getDokkanInfoBonusEvents(): Promise<DokkanInfoDbStoryDataset> {
    return getDokkanInfoQuestEvents(BONUS_CONFIG);
}

export async function getDokkanInfoQuestAreas(): Promise<DokkanInfoDbStoryDataset> {
    return getDokkanInfoQuestEvents(QUEST_CONFIG);
}

async function getDokkanInfoQuestEvents(config: QuestEventConfig): Promise<DokkanInfoDbStoryDataset> {
    const summaries = await fetchQuestEventSummaries(config);
    const failedStoryIds: string[] = [];
    const failedStageIds: string[] = [];
    let completedStories = 0;

    const shells = (
        await mapWithConcurrency(summaries, requestedConcurrency(config), async summary => {
            try {
                const shell = await fetchStoryShell(config, summary);
                completedStories += 1;
                console.log(`[${config.logLabel}] Stories ${completedStories}/${summaries.length}: ${summary.id} (${shell.stages.length} stages)`);
                return shell;
            } catch (error) {
                failedStoryIds.push(summary.id);
                completedStories += 1;
                console.error(`[${config.logLabel}] Failed story ${summary.id}: ${errorMessage(error)}`);
                return undefined;
            }
        })
    ).filter((shell): shell is StoryShell => Boolean(shell));

    const allStages = shells.flatMap(shell => shell.stages.map(stage => ({ shell, stage })));
    let completedStages = 0;
    const enrichedStages = await mapWithConcurrency(allStages, requestedConcurrency(config), async ({ stage }) => {
        await delay(requestedDelayMs(config));
        try {
            const detail = await fetchStageDetail(config, stage);
            return detail;
        } catch (error) {
            failedStageIds.push(stage.id);
            console.error(`[${config.logLabel}] Failed stage ${stage.id}: ${errorMessage(error)}`);
            return {
                ...stage,
                enemyDataStatus: "fetch-failed" as const,
                enemies: [],
            };
        } finally {
            completedStages += 1;
            if (completedStages === 1 || completedStages % 50 === 0 || completedStages === allStages.length) {
                console.log(`[${config.logLabel}] Stages ${completedStages}/${allStages.length}`);
            }
        }
    });

    const stagesById = new Map(enrichedStages.map(stage => [stage.id, stage]));
    const stories = shells.map(shell => ({
        ...shell.story,
        stages: shell.stages.map(stage => stagesById.get(stage.id) ?? stage),
    }));

    return buildDokkanInfoQuestEventDataset(config, stories, failedStoryIds, failedStageIds);
}

export async function writeDokkanInfoDbStories(dataset?: DokkanInfoDbStoryDataset): Promise<string> {
    return writeDokkanInfoQuestEvents(DB_STORIES_CONFIG, dataset ?? await getDokkanInfoDbStories());
}

export async function writeDokkanInfoStories(dataset?: DokkanInfoDbStoryDataset): Promise<string> {
    return writeDokkanInfoQuestEvents(STORIES_CONFIG, dataset ?? await getDokkanInfoStories());
}

export async function writeDokkanInfoGrowthEvents(dataset?: DokkanInfoDbStoryDataset): Promise<string> {
    return writeDokkanInfoQuestEvents(GROWTH_CONFIG, dataset ?? await getDokkanInfoGrowthEvents());
}

export async function writeDokkanInfoLimitedEvents(dataset?: DokkanInfoDbStoryDataset): Promise<string> {
    return writeDokkanInfoQuestEvents(LIMITED_CONFIG, dataset ?? await getDokkanInfoLimitedEvents());
}

export async function writeDokkanInfoChallengeEvents(dataset?: DokkanInfoDbStoryDataset): Promise<string> {
    return writeDokkanInfoQuestEvents(CHALLENGE_CONFIG, dataset ?? await getDokkanInfoChallengeEvents());
}

export async function writeDokkanInfoBonusEvents(dataset?: DokkanInfoDbStoryDataset): Promise<string> {
    return writeDokkanInfoQuestEvents(BONUS_CONFIG, dataset ?? await getDokkanInfoBonusEvents());
}

export async function writeDokkanInfoQuestAreas(dataset?: DokkanInfoDbStoryDataset): Promise<string> {
    return writeDokkanInfoQuestEvents(QUEST_CONFIG, dataset ?? await getDokkanInfoQuestAreas());
}

async function writeDokkanInfoQuestEvents(config: QuestEventConfig, dataset: DokkanInfoDbStoryDataset): Promise<string> {
    const outputPath = resolve(__dirname, config.outputDir, config.outputFile);
    await mkdir(resolve(__dirname, config.outputDir), { recursive: true });
    await writeFormattedJson(outputPath, dataset);
    return outputPath;
}

export function buildDokkanInfoDbStoryDataset(
    stories: DokkanInfoDbStory[],
    failedStoryIds: string[] = [],
    failedStageIds: string[] = [],
): DokkanInfoDbStoryDataset {
    return buildDokkanInfoQuestEventDataset(DB_STORIES_CONFIG, stories, failedStoryIds, failedStageIds);
}

function buildDokkanInfoQuestEventDataset(
    config: QuestEventConfig,
    stories: DokkanInfoDbStory[],
    failedStoryIds: string[] = [],
    failedStageIds: string[] = [],
): DokkanInfoDbStoryDataset {
    const normalizedStories = stories
        .map(story => ({
            ...story,
            missions: [...story.missions].sort((left, right) => left.id.localeCompare(right.id)),
            rewards: [...story.rewards].sort((left, right) => left.key.localeCompare(right.key)),
            stages: [...story.stages]
                .map(stage => ({ ...stage, enemies: [...stage.enemies].sort(compareEnemies) }))
                .sort(compareStages),
        }))
        .sort((left, right) => compareIds(left.id, right.id));
    const stages = normalizedStories.flatMap(story => story.stages);

    return {
        schemaVersion: "1.0.0",
        generatedAt: new Date().toISOString(),
        source: "dokkaninfo",
        eventType: config.eventType,
        sourcePath: config.indexUrl,
        storyCount: normalizedStories.length,
        stageCount: stages.length,
        enemyCount: stages.reduce((sum, stage) => sum + stage.enemies.length, 0),
        stagesWithoutEnemyData: stages.filter(stage => stage.enemyDataStatus === "not-provided").length,
        failedStoryIds: uniqueSorted(failedStoryIds),
        failedStageIds: uniqueSorted(failedStageIds),
        stories: normalizedStories,
    };
}

export function mapDbStoryIndex(document: Document): QuestEventSummary[] {
    return mapQuestEventIndex(document, DB_STORIES_CONFIG);
}

export function mapStoryIndex(document: Document): QuestEventSummary[] {
    return mapQuestEventIndex(document, STORIES_CONFIG);
}

export function mapGrowthIndex(document: Document): QuestEventSummary[] {
    return mapQuestEventIndex(document, GROWTH_CONFIG);
}

export function mapLimitedIndex(document: Document): QuestEventSummary[] {
    return mapQuestEventIndex(document, LIMITED_CONFIG);
}

export function mapChallengeIndex(document: Document): QuestEventSummary[] {
    return mapQuestEventIndex(document, CHALLENGE_CONFIG);
}

export function mapBonusIndex(document: Document): QuestEventSummary[] {
    return mapQuestEventIndex(document, BONUS_CONFIG);
}

export function mapQuestIndex(document: Document): QuestEventSummary[] {
    return mapQuestEventIndex(document, QUEST_CONFIG);
}

function mapQuestEventIndex(document: Document, config: QuestEventConfig): QuestEventSummary[] {
    assertUsableDokkanInfoPage(document);
    const componentPayload = parseJsonAttribute<Array<{ id?: number | string | null }>>(
        document.querySelector("events")?.getAttribute("v-bind:eventjson"),
    );
    const componentSummaries = (componentPayload ?? [])
        .map(event => toOptionalString(event.id))
        .filter((id): id is string => Boolean(id))
        .map(id => ({ id, sourcePath: `${config.indexUrl}/${id}` }));
    const anchorSummaries = Array.from(document.querySelectorAll("a[href]"))
        .map(anchor => {
            const sourcePath = absoluteUrl(anchor.getAttribute("href"));
            const match = sourcePath.match(new RegExp(`/events/${config.eventType}/(\\d+)$`));
            return match ? { id: match[1], sourcePath } : undefined;
        })
        .filter((summary): summary is QuestEventSummary => Boolean(summary));

    const summaries = [...new Map([...componentSummaries, ...anchorSummaries].map(summary => [summary.id, summary])).values()]
        .sort((left, right) => compareIds(left.id, right.id));
    if (!summaries.length) {
        throw new Error(`DokkanInfo ${config.eventType} index exposed no events.`);
    }
    return summaries;
}

export function mapDbStoryShell(document: Document, summary: QuestEventSummary): StoryShell {
    return mapQuestEventShell(document, summary, DB_STORIES_CONFIG);
}

function mapQuestEventShell(document: Document, summary: QuestEventSummary, config: QuestEventConfig): StoryShell {
    assertUsableDokkanInfoPage(document);
    const name = cleanText(document.title).replace(/\s*\|\s*Dokkan Info!?$/i, "")
        || `${eventFallbackLabel(config.eventType)} ${summary.id}`;
    const eventSummary: DokkanInfoEventSummary = {
        id: summary.id,
        type: config.eventType,
        name,
    };

    return {
        story: {
            id: summary.id,
            type: config.eventType,
            name,
            sourcePath: summary.sourcePath,
            imagePath: absoluteOptionalUrl(document.querySelector<HTMLImageElement>('img[alt*="quest_top_banner"]')?.getAttribute("src")),
            missions: mapEventMissionReferences(document),
            rewards: mapEventRewards(document, eventSummary, name, summary.sourcePath),
        },
        stages: mapQuestEventStages(document, summary, config),
    };
}

export function mapDbStoryStages(document: Document, summary: QuestEventSummary): DokkanInfoDbStoryStage[] {
    return mapQuestEventStages(document, summary, DB_STORIES_CONFIG);
}

function mapQuestEventStages(document: Document, summary: QuestEventSummary, config: QuestEventConfig): DokkanInfoDbStoryStage[] {
    const stages = Array.from(document.querySelectorAll("a[href]"))
        .map((anchor): DokkanInfoDbStoryStage | undefined => {
            const sourcePath = absoluteUrl(anchor.getAttribute("href"));
            const match = sourcePath.match(new RegExp(`/events/${config.eventType}/${summary.id}/(\\d+)$`));
            if (!match) {
                return undefined;
            }

            const container = anchor.closest(".col-sm") || anchor.parentElement;
            const title = cleanText(container?.querySelector(".font-size-1_5")?.textContent) || `Stage ${match[1]}`;
            const level = optionalNumber(title.match(/\bLevel\s+(\d+)\s*:/i)?.[1]);
            const difficulty = Array.from(anchor.querySelectorAll("b"))
                .map(element => cleanText(element.textContent))
                .find(value => /^(?:NORMAL|HARD|Z-HARD|SUPER\s*\d*)$/i.test(value));

            return {
                id: match[1],
                title,
                level,
                difficulty,
                stamina: labelledNumber(anchor, "STA"),
                userExp: labelledNumber(anchor, "User Exp"),
                zeni: labelledNumber(anchor, "Zeni"),
                linkLevelRate: labelledNumber(anchor, "Link Level Rate"),
                sourcePath,
                enemyDataStatus: "not-provided" as const,
                enemies: [],
            };
        })
        .filter((stage): stage is DokkanInfoDbStoryStage => Boolean(stage));

    return [...new Map(stages.map(stage => [stage.id, stage])).values()]
        .sort(compareStages);
}

export function mapDbStoryStageDetail(document: Document, stage: DokkanInfoDbStoryStage): DokkanInfoDbStoryStage {
    assertUsableDokkanInfoPage(document);
    const enemies: DokkanInfoQuestEnemy[] = [];
    const groups = Array.from(document.querySelectorAll(".row.margin-5.border.border-1.border-main-box-darker.bg-main"));

    groups.forEach((group, groupIndex) => {
        const rows = Array.from(group.querySelectorAll(".row.d-flex.align-items-center"))
            .filter(row => Boolean(row.querySelector(":scope > .col-xl-2")));
        rows.forEach((row, rowIndex) => {
            const columns = Array.from(row.children);
            const identity = columns[0];
            const stats = columns[1];
            const superAttack = columns[2];
            const skills = columns[3];
            const rawCardElement = identity?.matches("card-icon") ? identity : identity?.querySelector("card-icon");
            const rawCard = parseJsonAttribute<DokkanInfoEnemyCardPayload>(rawCardElement?.getAttribute("v-bind:card"));
            const hydratedCardPath = absoluteOptionalUrl(identity?.querySelector<HTMLAnchorElement>('a[href*="/cards/"]')?.getAttribute("href"));
            const cardReferenceId = toOptionalString(rawCard?.id) ?? hydratedCardPath?.match(/\/cards\/(\d+)$/)?.[1];
            const cardReferencePath = cardReferenceId
                ? `${DOKKAN_INFO_BASE_URL}/cards/${cardReferenceId}`
                : hydratedCardPath;
            const hydratedTypeIconPath = absoluteOptionalUrl(identity?.querySelector<HTMLImageElement>(".card-icon-item-type img")?.getAttribute("src"));
            const typeCode = toOptionalString(rawCard?.element)
                ?? hydratedTypeIconPath?.match(/cha_type_icon_(\d+)\.png$/)?.[1];
            const iconId = toOptionalString(rawCard?.icon_id);
            const typeIconPath = rawCard && typeCode
                ? `${DOKKAN_INFO_BASE_URL}/assets/global/en/layout/en/image/character/cha_type_icon_${typeCode}.png`
                : hydratedTypeIconPath;
            const portraitPath = iconId
                ? `${DOKKAN_INFO_BASE_URL}/assets/global/en/character/thumb/card_${iconId}_thumb/card_${iconId}_thumb.png`
                : absoluteOptionalUrl(identity?.querySelector<HTMLImageElement>(".card-info-thumb img")?.getAttribute("src"));

            enemies.push(withoutUndefined({
                source: "dokkaninfo",
                sequence: rowIndex + 1,
                group: groupIndex + 1,
                name: optionalText(rawCard?.name) ?? optionalText(identity?.querySelector(".font-size-1_2 b")?.textContent),
                cardReferenceId,
                cardReferencePath,
                portraitPath,
                typeCode,
                typeIconPath,
                stats: mapEnemyStats(stats),
                superAttack: mapEnemySuperAttack(superAttack),
                skills: mapEnemySkills(skills),
            }) as DokkanInfoQuestEnemy);
        });
    });

    return {
        ...stage,
        enemyDataStatus: enemies.length ? "available" : "not-provided",
        enemies,
    };
}

async function fetchStoryShell(config: QuestEventConfig, summary: QuestEventSummary): Promise<StoryShell> {
    const cached = await readCache<StoryShell>(config, `stories/${summary.id}.json`);
    if (cached) {
        return cached;
    }

    await delay(requestedDelayMs(config));
    const document = await fetchFromWeb(summary.sourcePath);
    const shell = mapQuestEventShell(document, summary, config);
    await writeCache(config, `stories/${summary.id}.json`, shell);
    return shell;
}

async function fetchQuestEventSummaries(config: QuestEventConfig): Promise<QuestEventSummary[]> {
    const cached = await readCache<QuestEventSummary[]>(config, "index.json");
    if (cached) {
        return cached;
    }
    const document = await fetchFromWeb(config.indexUrl);
    const summaries = mapQuestEventIndex(document, config);
    await writeCache(config, "index.json", summaries);
    return summaries;
}

async function fetchStageDetail(config: QuestEventConfig, stage: DokkanInfoDbStoryStage): Promise<DokkanInfoDbStoryStage> {
    const cached = await readCache<DokkanInfoDbStoryStage>(config, `stages/${stage.id}.json`);
    if (cached) {
        return { ...stage, enemyDataStatus: cached.enemyDataStatus, enemies: cached.enemies };
    }

    const document = await fetchFromWeb(stage.sourcePath);
    const detail = mapDbStoryStageDetail(document, stage);
    await writeCache(config, `stages/${stage.id}.json`, detail);
    return detail;
}

function mapEnemyStats(element: Element | undefined): DokkanInfoQuestEnemyStats {
    const fields = labelledFields(element);
    return withoutUndefined({
        hp: optionalNumber(fields.get("HP")),
        atk: optionalNumber(fields.get("ATK")),
        def: optionalNumber(fields.get("DEF")),
        damageReductionPercent: optionalNumber(fields.get("DR")),
        maxAttacksPerTurn: optionalNumber(fields.get("Max ATK/Turn")),
    });
}

function mapEnemySuperAttack(element: Element | undefined): DokkanInfoQuestEnemySuperAttack | undefined {
    if (!element) {
        return undefined;
    }

    const firstRow = Array.from(element.children).find(child => child.classList.contains("row"));
    const name = optionalText(firstRow?.querySelector("b")?.textContent);
    if (!name || ["Type", "Damage", "Percentage", "Max ATK/Turn", "Cooldown"].includes(name)) {
        return undefined;
    }

    const fields = labelledFields(element);
    return withoutUndefined({
        name,
        description: optionalText(firstRow?.querySelector(".row.align-items-center")?.textContent),
        typeCode: optionalText(firstRow?.querySelector<HTMLImageElement>("img[alt]")?.getAttribute("alt")),
        damage: optionalNumber(fields.get("Damage")),
        chancePercent: optionalNumber(fields.get("Percentage")),
        maxPerTurn: optionalNumber(fields.get("Max ATK/Turn")),
        cooldown: optionalNumber(fields.get("Cooldown")),
    }) as DokkanInfoQuestEnemySuperAttack;
}

function mapEnemySkills(element: Element | undefined): DokkanInfoQuestEnemySkills | undefined {
    if (!element) {
        return undefined;
    }

    const text = optionalText(element.textContent);
    const icons = Array.from(element.querySelectorAll<HTMLImageElement>("img[src]"))
        .map(image => ({
            alt: optionalText(image.getAttribute("alt")),
            path: absoluteUrl(image.getAttribute("src")),
        }));
    return text || icons.length ? { text, icons } : undefined;
}

function labelledFields(element: Element | undefined): Map<string, string> {
    const fields = new Map<string, string>();
    if (!element) {
        return fields;
    }

    for (const row of Array.from(element.children).filter(child => child.classList.contains("row"))) {
        const label = cleanText(row.querySelector("b")?.textContent).replace(/:$/, "");
        if (!label) {
            continue;
        }
        fields.set(label, cleanText(row.textContent).replace(new RegExp(`^${escapeRegExp(label)}\\s*:?\\s*`, "i"), ""));
    }
    return fields;
}

function labelledNumber(anchor: Element, label: string): number | undefined {
    const heading = Array.from(anchor.querySelectorAll("b"))
        .find(element => cleanText(element.textContent) === label);
    const cell = heading?.closest(".col-sm");
    const rows = cell ? Array.from(cell.children).filter(child => child.classList.contains("row")) : [];
    return optionalNumber(rows[1]?.textContent);
}

async function readCache<T>(config: QuestEventConfig, relativePath: string): Promise<T | undefined> {
    if (refreshRequested(config)) {
        return undefined;
    }
    try {
        const raw = await readFile(resolve(__dirname, config.cacheDir, relativePath), "utf8");
        const cached = JSON.parse(raw) as CachedValue<T>;
        if (cached.schemaVersion !== CACHE_SCHEMA_VERSION) {
            return undefined;
        }
        const ttlHours = requestedCacheTtlHours(config);
        return Date.now() - Date.parse(cached.fetchedAt) <= ttlHours * 60 * 60 * 1000
            ? cached.value
            : undefined;
    } catch {
        return undefined;
    }
}

async function writeCache<T>(config: QuestEventConfig, relativePath: string, value: T): Promise<void> {
    const path = resolve(__dirname, config.cacheDir, relativePath);
    await mkdir(resolve(path, ".."), { recursive: true });
    const tempPath = `${path}.tmp-${process.pid}`;
    await writeFile(tempPath, JSON.stringify({
        schemaVersion: CACHE_SCHEMA_VERSION,
        fetchedAt: new Date().toISOString(),
        value,
    } as CachedValue<T>));
    await rename(tempPath, path);
}

function configValue(config: QuestEventConfig, suffix: string): string | undefined {
    return process.env[`${config.envPrefix}_${suffix}`]
        ?? process.env[`DOKKANINFO_QUEST_EVENTS_${suffix}`];
}

function refreshRequested(config: QuestEventConfig): boolean {
    return /^(?:1|true|yes)$/i.test(configValue(config, "REFRESH") ?? "");
}

function requestedConcurrency(config: QuestEventConfig): number {
    const value = Number(configValue(config, "CONCURRENCY"));
    return Number.isInteger(value) && value > 0 ? value : DEFAULT_CONCURRENCY;
}

function requestedDelayMs(config: QuestEventConfig): number {
    const value = Number(configValue(config, "DELAY_MS"));
    return Number.isFinite(value) && value >= 0 ? value : DEFAULT_REQUEST_DELAY_MS;
}

function requestedCacheTtlHours(config: QuestEventConfig): number {
    const value = Number(configValue(config, "CACHE_TTL_HOURS"));
    return Number.isFinite(value) && value >= 0 ? value : 168;
}

function compareStages(left: DokkanInfoDbStoryStage, right: DokkanInfoDbStoryStage): number {
    return (left.level ?? Number.MAX_SAFE_INTEGER) - (right.level ?? Number.MAX_SAFE_INTEGER)
        || compareIds(left.id, right.id);
}

function compareEnemies(left: DokkanInfoQuestEnemy, right: DokkanInfoQuestEnemy): number {
    return left.group - right.group || left.sequence - right.sequence;
}

function compareIds(left: string, right: string): number {
    return left.localeCompare(right, "en", { numeric: true });
}

function eventFallbackLabel(eventType: DokkanInfoQuestEventType): string {
    switch (eventType) {
        case "dbstories": return "DB Story";
        case "growth": return "Growth Event";
        case "limited": return "Limited Event";
        case "challenge": return "Challenge Event";
        case "bonus": return "Bonus Event";
        case "quest": return "Quest Area";
        default: return "Story";
    }
}

function uniqueSorted(values: string[]): string[] | undefined {
    const unique = [...new Set(values)].sort(compareIds);
    return unique.length ? unique : undefined;
}

function optionalNumber(value: string | null | undefined): number | undefined {
    const match = cleanText(value).match(/-?[\d,.]+/);
    if (!match) {
        return undefined;
    }
    const parsed = Number(match[0].replace(/,/g, ""));
    return Number.isFinite(parsed) ? parsed : undefined;
}

function optionalText(value: string | null | undefined): string | undefined {
    return cleanText(value) || undefined;
}

function toOptionalString(value: number | string | null | undefined): string | undefined {
    const normalized = String(value ?? "").trim();
    return normalized || undefined;
}

function parseJsonAttribute<T>(value: string | null | undefined): T | undefined {
    if (!value) {
        return undefined;
    }
    try {
        return JSON.parse(value) as T;
    } catch {
        return undefined;
    }
}

function cleanText(value: string | null | undefined): string {
    return String(value ?? "").replace(/\s+/g, " ").trim();
}

function absoluteUrl(value: string | null | undefined): string {
    return new URL(cleanText(value), DOKKAN_INFO_BASE_URL).toString();
}

function absoluteOptionalUrl(value: string | null | undefined): string | undefined {
    return value ? absoluteUrl(value) : undefined;
}

function escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function withoutUndefined<T extends Record<string, unknown>>(value: T): T {
    return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined)) as T;
}

function errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}

function assertUsableDokkanInfoPage(document: Document): void {
    const title = cleanText(document.title);
    if (/general server error|internal server error|service unavailable/i.test(title)) {
        throw new Error(`DokkanInfo returned an error page: ${title}.`);
    }
}

function delay(milliseconds: number): Promise<void> {
    return milliseconds > 0 ? new Promise(resolveDelay => setTimeout(resolveDelay, milliseconds)) : Promise.resolve();
}

async function mapWithConcurrency<TInput, TOutput>(
    input: TInput[],
    concurrency: number,
    mapper: (value: TInput, index: number) => Promise<TOutput>,
): Promise<TOutput[]> {
    const output = new Array<TOutput>(input.length);
    let cursor = 0;
    async function worker(): Promise<void> {
        while (true) {
            const index = cursor++;
            if (index >= input.length) {
                return;
            }
            output[index] = await mapper(input[index], index);
        }
    }
    await Promise.all(Array.from({ length: Math.max(1, Math.min(concurrency, input.length || 1)) }, () => worker()));
    return output;
}
