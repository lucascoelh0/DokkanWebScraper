"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mapDbStoryStageDetail = exports.mapDbStoryStages = exports.mapDbStoryShell = exports.mapQuestIndex = exports.mapBonusIndex = exports.mapChallengeIndex = exports.mapLimitedIndex = exports.mapGrowthIndex = exports.mapStoryIndex = exports.mapDbStoryIndex = exports.buildDokkanInfoDbStoryDataset = exports.writeDokkanInfoQuestAreas = exports.writeDokkanInfoBonusEvents = exports.writeDokkanInfoChallengeEvents = exports.writeDokkanInfoLimitedEvents = exports.writeDokkanInfoGrowthEvents = exports.writeDokkanInfoStories = exports.writeDokkanInfoDbStories = exports.getDokkanInfoQuestAreas = exports.getDokkanInfoBonusEvents = exports.getDokkanInfoChallengeEvents = exports.getDokkanInfoLimitedEvents = exports.getDokkanInfoGrowthEvents = exports.getDokkanInfoStories = exports.getDokkanInfoDbStories = void 0;
const promises_1 = require("fs/promises");
const path_1 = require("path");
const dokkaninfo_event_rewards_1 = require("./dokkaninfo-event-rewards");
const format_json_1 = require("./format-json");
const scraper_1 = require("./scraper");
const DOKKAN_INFO_BASE_URL = "https://dokkaninfo.com";
const DEFAULT_CONCURRENCY = 3;
const DEFAULT_REQUEST_DELAY_MS = 150;
const CACHE_SCHEMA_VERSION = "3.0.0";
const DB_STORIES_CONFIG = {
    eventType: "dbstories",
    indexUrl: `${DOKKAN_INFO_BASE_URL}/events/dbstories`,
    cacheDir: "data/dokkaninfo-db-stories/cache",
    outputDir: "data/dokkaninfo-db-stories/latest",
    outputFile: "db-stories.json",
    envPrefix: "DOKKANINFO_DB_STORIES",
    logLabel: "DOKKANINFO-DB-STORIES",
};
const STORIES_CONFIG = {
    eventType: "story",
    indexUrl: `${DOKKAN_INFO_BASE_URL}/events/story`,
    cacheDir: "data/dokkaninfo-stories/cache",
    outputDir: "data/dokkaninfo-stories/latest",
    outputFile: "stories.json",
    envPrefix: "DOKKANINFO_STORIES",
    logLabel: "DOKKANINFO-STORIES",
};
const GROWTH_CONFIG = {
    eventType: "growth",
    indexUrl: `${DOKKAN_INFO_BASE_URL}/events/growth`,
    cacheDir: "data/dokkaninfo-growth/cache",
    outputDir: "data/dokkaninfo-growth/latest",
    outputFile: "growth.json",
    envPrefix: "DOKKANINFO_GROWTH",
    logLabel: "DOKKANINFO-GROWTH",
};
const LIMITED_CONFIG = {
    eventType: "limited",
    indexUrl: `${DOKKAN_INFO_BASE_URL}/events/limited`,
    cacheDir: "data/dokkaninfo-limited/cache",
    outputDir: "data/dokkaninfo-limited/latest",
    outputFile: "limited.json",
    envPrefix: "DOKKANINFO_LIMITED",
    logLabel: "DOKKANINFO-LIMITED",
};
const CHALLENGE_CONFIG = {
    eventType: "challenge",
    indexUrl: `${DOKKAN_INFO_BASE_URL}/events/challenge`,
    cacheDir: "data/dokkaninfo-challenge/cache",
    outputDir: "data/dokkaninfo-challenge/latest",
    outputFile: "challenge.json",
    envPrefix: "DOKKANINFO_CHALLENGE",
    logLabel: "DOKKANINFO-CHALLENGE",
};
const BONUS_CONFIG = {
    eventType: "bonus",
    indexUrl: `${DOKKAN_INFO_BASE_URL}/events/bonus`,
    cacheDir: "data/dokkaninfo-bonus/cache",
    outputDir: "data/dokkaninfo-bonus/latest",
    outputFile: "bonus.json",
    envPrefix: "DOKKANINFO_BONUS",
    logLabel: "DOKKANINFO-BONUS",
};
const QUEST_CONFIG = {
    eventType: "quest",
    indexUrl: `${DOKKAN_INFO_BASE_URL}/events/quest`,
    cacheDir: "data/dokkaninfo-quest/cache",
    outputDir: "data/dokkaninfo-quest/latest",
    outputFile: "quest.json",
    envPrefix: "DOKKANINFO_QUEST",
    logLabel: "DOKKANINFO-QUEST",
};
async function getDokkanInfoDbStories() {
    return getDokkanInfoQuestEvents(DB_STORIES_CONFIG);
}
exports.getDokkanInfoDbStories = getDokkanInfoDbStories;
async function getDokkanInfoStories() {
    return getDokkanInfoQuestEvents(STORIES_CONFIG);
}
exports.getDokkanInfoStories = getDokkanInfoStories;
async function getDokkanInfoGrowthEvents() {
    return getDokkanInfoQuestEvents(GROWTH_CONFIG);
}
exports.getDokkanInfoGrowthEvents = getDokkanInfoGrowthEvents;
async function getDokkanInfoLimitedEvents() {
    return getDokkanInfoQuestEvents(LIMITED_CONFIG);
}
exports.getDokkanInfoLimitedEvents = getDokkanInfoLimitedEvents;
async function getDokkanInfoChallengeEvents() {
    return getDokkanInfoQuestEvents(CHALLENGE_CONFIG);
}
exports.getDokkanInfoChallengeEvents = getDokkanInfoChallengeEvents;
async function getDokkanInfoBonusEvents() {
    return getDokkanInfoQuestEvents(BONUS_CONFIG);
}
exports.getDokkanInfoBonusEvents = getDokkanInfoBonusEvents;
async function getDokkanInfoQuestAreas() {
    return getDokkanInfoQuestEvents(QUEST_CONFIG);
}
exports.getDokkanInfoQuestAreas = getDokkanInfoQuestAreas;
async function getDokkanInfoQuestEvents(config) {
    const summaries = await fetchQuestEventSummaries(config);
    const failedStoryIds = [];
    const failedStageIds = [];
    let completedStories = 0;
    const shells = (await mapWithConcurrency(summaries, requestedConcurrency(config), async (summary) => {
        try {
            const shell = await fetchStoryShell(config, summary);
            completedStories += 1;
            console.log(`[${config.logLabel}] Stories ${completedStories}/${summaries.length}: ${summary.id} (${shell.stages.length} stages)`);
            return shell;
        }
        catch (error) {
            failedStoryIds.push(summary.id);
            completedStories += 1;
            console.error(`[${config.logLabel}] Failed story ${summary.id}: ${errorMessage(error)}`);
            return undefined;
        }
    })).filter((shell) => Boolean(shell));
    const allStages = shells.flatMap(shell => shell.stages.map(stage => ({ shell, stage })));
    let completedStages = 0;
    const enrichedStages = await mapWithConcurrency(allStages, requestedConcurrency(config), async ({ stage }) => {
        await delay(requestedDelayMs(config));
        try {
            const detail = await fetchStageDetail(config, stage);
            return detail;
        }
        catch (error) {
            failedStageIds.push(stage.id);
            console.error(`[${config.logLabel}] Failed stage ${stage.id}: ${errorMessage(error)}`);
            return {
                ...stage,
                enemyDataStatus: "fetch-failed",
                enemies: [],
            };
        }
        finally {
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
async function writeDokkanInfoDbStories(dataset) {
    return writeDokkanInfoQuestEvents(DB_STORIES_CONFIG, dataset ?? await getDokkanInfoDbStories());
}
exports.writeDokkanInfoDbStories = writeDokkanInfoDbStories;
async function writeDokkanInfoStories(dataset) {
    return writeDokkanInfoQuestEvents(STORIES_CONFIG, dataset ?? await getDokkanInfoStories());
}
exports.writeDokkanInfoStories = writeDokkanInfoStories;
async function writeDokkanInfoGrowthEvents(dataset) {
    return writeDokkanInfoQuestEvents(GROWTH_CONFIG, dataset ?? await getDokkanInfoGrowthEvents());
}
exports.writeDokkanInfoGrowthEvents = writeDokkanInfoGrowthEvents;
async function writeDokkanInfoLimitedEvents(dataset) {
    return writeDokkanInfoQuestEvents(LIMITED_CONFIG, dataset ?? await getDokkanInfoLimitedEvents());
}
exports.writeDokkanInfoLimitedEvents = writeDokkanInfoLimitedEvents;
async function writeDokkanInfoChallengeEvents(dataset) {
    return writeDokkanInfoQuestEvents(CHALLENGE_CONFIG, dataset ?? await getDokkanInfoChallengeEvents());
}
exports.writeDokkanInfoChallengeEvents = writeDokkanInfoChallengeEvents;
async function writeDokkanInfoBonusEvents(dataset) {
    return writeDokkanInfoQuestEvents(BONUS_CONFIG, dataset ?? await getDokkanInfoBonusEvents());
}
exports.writeDokkanInfoBonusEvents = writeDokkanInfoBonusEvents;
async function writeDokkanInfoQuestAreas(dataset) {
    return writeDokkanInfoQuestEvents(QUEST_CONFIG, dataset ?? await getDokkanInfoQuestAreas());
}
exports.writeDokkanInfoQuestAreas = writeDokkanInfoQuestAreas;
async function writeDokkanInfoQuestEvents(config, dataset) {
    const outputPath = (0, path_1.resolve)(__dirname, config.outputDir, config.outputFile);
    await (0, promises_1.mkdir)((0, path_1.resolve)(__dirname, config.outputDir), { recursive: true });
    await (0, format_json_1.writeFormattedJson)(outputPath, dataset);
    return outputPath;
}
function buildDokkanInfoDbStoryDataset(stories, failedStoryIds = [], failedStageIds = []) {
    return buildDokkanInfoQuestEventDataset(DB_STORIES_CONFIG, stories, failedStoryIds, failedStageIds);
}
exports.buildDokkanInfoDbStoryDataset = buildDokkanInfoDbStoryDataset;
function buildDokkanInfoQuestEventDataset(config, stories, failedStoryIds = [], failedStageIds = []) {
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
function mapDbStoryIndex(document) {
    return mapQuestEventIndex(document, DB_STORIES_CONFIG);
}
exports.mapDbStoryIndex = mapDbStoryIndex;
function mapStoryIndex(document) {
    return mapQuestEventIndex(document, STORIES_CONFIG);
}
exports.mapStoryIndex = mapStoryIndex;
function mapGrowthIndex(document) {
    return mapQuestEventIndex(document, GROWTH_CONFIG);
}
exports.mapGrowthIndex = mapGrowthIndex;
function mapLimitedIndex(document) {
    return mapQuestEventIndex(document, LIMITED_CONFIG);
}
exports.mapLimitedIndex = mapLimitedIndex;
function mapChallengeIndex(document) {
    return mapQuestEventIndex(document, CHALLENGE_CONFIG);
}
exports.mapChallengeIndex = mapChallengeIndex;
function mapBonusIndex(document) {
    return mapQuestEventIndex(document, BONUS_CONFIG);
}
exports.mapBonusIndex = mapBonusIndex;
function mapQuestIndex(document) {
    return mapQuestEventIndex(document, QUEST_CONFIG);
}
exports.mapQuestIndex = mapQuestIndex;
function mapQuestEventIndex(document, config) {
    assertUsableDokkanInfoPage(document);
    const componentPayload = parseJsonAttribute(document.querySelector("events")?.getAttribute("v-bind:eventjson"));
    const componentSummaries = (componentPayload ?? [])
        .map(event => toOptionalString(event.id))
        .filter((id) => Boolean(id))
        .map(id => ({ id, sourcePath: `${config.indexUrl}/${id}` }));
    const anchorSummaries = Array.from(document.querySelectorAll("a[href]"))
        .map(anchor => {
        const sourcePath = absoluteUrl(anchor.getAttribute("href"));
        const match = sourcePath.match(new RegExp(`/events/${config.eventType}/(\\d+)$`));
        return match ? { id: match[1], sourcePath } : undefined;
    })
        .filter((summary) => Boolean(summary));
    const summaries = [...new Map([...componentSummaries, ...anchorSummaries].map(summary => [summary.id, summary])).values()]
        .sort((left, right) => compareIds(left.id, right.id));
    if (!summaries.length) {
        throw new Error(`DokkanInfo ${config.eventType} index exposed no events.`);
    }
    return summaries;
}
function mapDbStoryShell(document, summary) {
    return mapQuestEventShell(document, summary, DB_STORIES_CONFIG);
}
exports.mapDbStoryShell = mapDbStoryShell;
function mapQuestEventShell(document, summary, config) {
    assertUsableDokkanInfoPage(document);
    const name = cleanText(document.title).replace(/\s*\|\s*Dokkan Info!?$/i, "")
        || `${eventFallbackLabel(config.eventType)} ${summary.id}`;
    const eventSummary = {
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
            imagePath: absoluteOptionalUrl(document.querySelector('img[alt*="quest_top_banner"]')?.getAttribute("src")),
            missions: (0, dokkaninfo_event_rewards_1.mapEventMissionReferences)(document),
            rewards: (0, dokkaninfo_event_rewards_1.mapEventRewards)(document, eventSummary, name, summary.sourcePath),
        },
        stages: mapQuestEventStages(document, summary, config),
    };
}
function mapDbStoryStages(document, summary) {
    return mapQuestEventStages(document, summary, DB_STORIES_CONFIG);
}
exports.mapDbStoryStages = mapDbStoryStages;
function mapQuestEventStages(document, summary, config) {
    const stages = Array.from(document.querySelectorAll("a[href]"))
        .map((anchor) => {
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
            enemyDataStatus: "not-provided",
            enemies: [],
        };
    })
        .filter((stage) => Boolean(stage));
    return [...new Map(stages.map(stage => [stage.id, stage])).values()]
        .sort(compareStages);
}
function mapDbStoryStageDetail(document, stage) {
    assertUsableDokkanInfoPage(document);
    const enemies = [];
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
            const rawCard = parseJsonAttribute(rawCardElement?.getAttribute("v-bind:card"));
            const hydratedCardPath = absoluteOptionalUrl(identity?.querySelector('a[href*="/cards/"]')?.getAttribute("href"));
            const cardReferenceId = toOptionalString(rawCard?.id) ?? hydratedCardPath?.match(/\/cards\/(\d+)$/)?.[1];
            const cardReferencePath = cardReferenceId
                ? `${DOKKAN_INFO_BASE_URL}/cards/${cardReferenceId}`
                : hydratedCardPath;
            const hydratedTypeIconPath = absoluteOptionalUrl(identity?.querySelector(".card-icon-item-type img")?.getAttribute("src"));
            const typeCode = toOptionalString(rawCard?.element)
                ?? hydratedTypeIconPath?.match(/cha_type_icon_(\d+)\.png$/)?.[1];
            const iconId = toOptionalString(rawCard?.icon_id);
            const typeIconPath = rawCard && typeCode
                ? `${DOKKAN_INFO_BASE_URL}/assets/global/en/layout/en/image/character/cha_type_icon_${typeCode}.png`
                : hydratedTypeIconPath;
            const portraitPath = iconId
                ? `${DOKKAN_INFO_BASE_URL}/assets/global/en/character/thumb/card_${iconId}_thumb/card_${iconId}_thumb.png`
                : absoluteOptionalUrl(identity?.querySelector(".card-info-thumb img")?.getAttribute("src"));
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
            }));
        });
    });
    return {
        ...stage,
        enemyDataStatus: enemies.length ? "available" : "not-provided",
        enemies,
    };
}
exports.mapDbStoryStageDetail = mapDbStoryStageDetail;
async function fetchStoryShell(config, summary) {
    const cached = await readCache(config, `stories/${summary.id}.json`);
    if (cached) {
        return cached;
    }
    await delay(requestedDelayMs(config));
    const document = await (0, scraper_1.fetchFromWeb)(summary.sourcePath);
    const shell = mapQuestEventShell(document, summary, config);
    await writeCache(config, `stories/${summary.id}.json`, shell);
    return shell;
}
async function fetchQuestEventSummaries(config) {
    const cached = await readCache(config, "index.json");
    if (cached) {
        return cached;
    }
    const document = await (0, scraper_1.fetchFromWeb)(config.indexUrl);
    const summaries = mapQuestEventIndex(document, config);
    await writeCache(config, "index.json", summaries);
    return summaries;
}
async function fetchStageDetail(config, stage) {
    const cached = await readCache(config, `stages/${stage.id}.json`);
    if (cached) {
        return { ...stage, enemyDataStatus: cached.enemyDataStatus, enemies: cached.enemies };
    }
    const document = await (0, scraper_1.fetchFromWeb)(stage.sourcePath);
    const detail = mapDbStoryStageDetail(document, stage);
    await writeCache(config, `stages/${stage.id}.json`, detail);
    return detail;
}
function mapEnemyStats(element) {
    const fields = labelledFields(element);
    return withoutUndefined({
        hp: optionalNumber(fields.get("HP")),
        atk: optionalNumber(fields.get("ATK")),
        def: optionalNumber(fields.get("DEF")),
        damageReductionPercent: optionalNumber(fields.get("DR")),
        maxAttacksPerTurn: optionalNumber(fields.get("Max ATK/Turn")),
    });
}
function mapEnemySuperAttack(element) {
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
        typeCode: optionalText(firstRow?.querySelector("img[alt]")?.getAttribute("alt")),
        damage: optionalNumber(fields.get("Damage")),
        chancePercent: optionalNumber(fields.get("Percentage")),
        maxPerTurn: optionalNumber(fields.get("Max ATK/Turn")),
        cooldown: optionalNumber(fields.get("Cooldown")),
    });
}
function mapEnemySkills(element) {
    if (!element) {
        return undefined;
    }
    const text = optionalText(element.textContent);
    const icons = Array.from(element.querySelectorAll("img[src]"))
        .map(image => ({
        alt: optionalText(image.getAttribute("alt")),
        path: absoluteUrl(image.getAttribute("src")),
    }));
    return text || icons.length ? { text, icons } : undefined;
}
function labelledFields(element) {
    const fields = new Map();
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
function labelledNumber(anchor, label) {
    const heading = Array.from(anchor.querySelectorAll("b"))
        .find(element => cleanText(element.textContent) === label);
    const cell = heading?.closest(".col-sm");
    const rows = cell ? Array.from(cell.children).filter(child => child.classList.contains("row")) : [];
    return optionalNumber(rows[1]?.textContent);
}
async function readCache(config, relativePath) {
    if (refreshRequested(config)) {
        return undefined;
    }
    try {
        const raw = await (0, promises_1.readFile)((0, path_1.resolve)(__dirname, config.cacheDir, relativePath), "utf8");
        const cached = JSON.parse(raw);
        if (cached.schemaVersion !== CACHE_SCHEMA_VERSION) {
            return undefined;
        }
        const ttlHours = requestedCacheTtlHours(config);
        return Date.now() - Date.parse(cached.fetchedAt) <= ttlHours * 60 * 60 * 1000
            ? cached.value
            : undefined;
    }
    catch {
        return undefined;
    }
}
async function writeCache(config, relativePath, value) {
    const path = (0, path_1.resolve)(__dirname, config.cacheDir, relativePath);
    await (0, promises_1.mkdir)((0, path_1.resolve)(path, ".."), { recursive: true });
    const tempPath = `${path}.tmp-${process.pid}`;
    await (0, promises_1.writeFile)(tempPath, JSON.stringify({
        schemaVersion: CACHE_SCHEMA_VERSION,
        fetchedAt: new Date().toISOString(),
        value,
    }));
    await (0, promises_1.rename)(tempPath, path);
}
function configValue(config, suffix) {
    return process.env[`${config.envPrefix}_${suffix}`]
        ?? process.env[`DOKKANINFO_QUEST_EVENTS_${suffix}`];
}
function refreshRequested(config) {
    return /^(?:1|true|yes)$/i.test(configValue(config, "REFRESH") ?? "");
}
function requestedConcurrency(config) {
    const value = Number(configValue(config, "CONCURRENCY"));
    return Number.isInteger(value) && value > 0 ? value : DEFAULT_CONCURRENCY;
}
function requestedDelayMs(config) {
    const value = Number(configValue(config, "DELAY_MS"));
    return Number.isFinite(value) && value >= 0 ? value : DEFAULT_REQUEST_DELAY_MS;
}
function requestedCacheTtlHours(config) {
    const value = Number(configValue(config, "CACHE_TTL_HOURS"));
    return Number.isFinite(value) && value >= 0 ? value : 168;
}
function compareStages(left, right) {
    return (left.level ?? Number.MAX_SAFE_INTEGER) - (right.level ?? Number.MAX_SAFE_INTEGER)
        || compareIds(left.id, right.id);
}
function compareEnemies(left, right) {
    return left.group - right.group || left.sequence - right.sequence;
}
function compareIds(left, right) {
    return left.localeCompare(right, "en", { numeric: true });
}
function eventFallbackLabel(eventType) {
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
function uniqueSorted(values) {
    const unique = [...new Set(values)].sort(compareIds);
    return unique.length ? unique : undefined;
}
function optionalNumber(value) {
    const match = cleanText(value).match(/-?[\d,.]+/);
    if (!match) {
        return undefined;
    }
    const parsed = Number(match[0].replace(/,/g, ""));
    return Number.isFinite(parsed) ? parsed : undefined;
}
function optionalText(value) {
    return cleanText(value) || undefined;
}
function toOptionalString(value) {
    const normalized = String(value ?? "").trim();
    return normalized || undefined;
}
function parseJsonAttribute(value) {
    if (!value) {
        return undefined;
    }
    try {
        return JSON.parse(value);
    }
    catch {
        return undefined;
    }
}
function cleanText(value) {
    return String(value ?? "").replace(/\s+/g, " ").trim();
}
function absoluteUrl(value) {
    return new URL(cleanText(value), DOKKAN_INFO_BASE_URL).toString();
}
function absoluteOptionalUrl(value) {
    return value ? absoluteUrl(value) : undefined;
}
function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function withoutUndefined(value) {
    return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined));
}
function errorMessage(error) {
    return error instanceof Error ? error.message : String(error);
}
function assertUsableDokkanInfoPage(document) {
    const title = cleanText(document.title);
    if (/general server error|internal server error|service unavailable/i.test(title)) {
        throw new Error(`DokkanInfo returned an error page: ${title}.`);
    }
}
function delay(milliseconds) {
    return milliseconds > 0 ? new Promise(resolveDelay => setTimeout(resolveDelay, milliseconds)) : Promise.resolve();
}
async function mapWithConcurrency(input, concurrency, mapper) {
    const output = new Array(input.length);
    let cursor = 0;
    async function worker() {
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
//# sourceMappingURL=dokkaninfo-db-stories.js.map