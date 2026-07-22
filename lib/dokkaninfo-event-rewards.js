"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mapEventMissionReferences = exports.mapEventStages = exports.buildDokkanInfoEventRewardDataset = exports.writeDokkanInfoEventRewards = exports.getDokkanInfoEventRewards = void 0;
const promises_1 = require("fs/promises");
const path_1 = require("path");
const scraper_1 = require("./scraper");
const format_json_1 = require("./format-json");
const DOKKAN_INFO_BASE_URL = "https://dokkaninfo.com";
const EVENT_CACHE_DIR = "data/dokkaninfo-events/cache";
const EVENT_OUTPUT_DIR = "data/dokkaninfo-events/latest";
const DEFAULT_CONCURRENCY = 4;
const DEFAULT_EVENT_TYPES = [
    "bonus",
    "challenge",
    "dbstories",
    "growth",
    "limited",
    "quest",
    "story",
    "zbattle",
    "dokkanfrontier",
    "sdbattle",
];
async function getDokkanInfoEventRewards() {
    const summaries = await collectEventSummaries(requestedEventTypes());
    const limitedSummaries = requestedEventLimit()
        ? summaries.slice(0, requestedEventLimit())
        : summaries;
    const failedEventIds = [];
    let completed = 0;
    const events = (await mapWithConcurrency(limitedSummaries, requestedEventConcurrency(), async (summary) => {
        try {
            return await fetchAndMapEvent(summary);
        }
        catch (error) {
            failedEventIds.push(`${summary.type}:${summary.id}`);
            console.error(`[DOKKANINFO-EVENTS] Failed ${summary.type}:${summary.id}: ${errorMessage(error)}`);
            return undefined;
        }
        finally {
            completed += 1;
            if (completed === 1 || completed % 25 === 0 || completed === limitedSummaries.length) {
                console.log(`[DOKKANINFO-EVENTS] Events ${completed}/${limitedSummaries.length}`);
            }
        }
    })).filter((event) => Boolean(event));
    return buildDokkanInfoEventRewardDataset(events, failedEventIds);
}
exports.getDokkanInfoEventRewards = getDokkanInfoEventRewards;
async function writeDokkanInfoEventRewards(dataset) {
    const resolvedDataset = dataset ?? await getDokkanInfoEventRewards();
    const outputDir = (0, path_1.resolve)(__dirname, EVENT_OUTPUT_DIR);
    const outputPath = (0, path_1.resolve)(outputDir, "event-rewards.json");
    await (0, promises_1.mkdir)(outputDir, { recursive: true });
    await (0, format_json_1.writeFormattedJson)(outputPath, resolvedDataset);
    return outputPath;
}
exports.writeDokkanInfoEventRewards = writeDokkanInfoEventRewards;
function buildDokkanInfoEventRewardDataset(events, failedEventIds = []) {
    const normalizedEvents = events
        .map(event => ({
        ...event,
        stages: [...(event.stages ?? [])].sort(compareStages),
        missions: [...(event.missions ?? [])].sort(compareMissionReferences),
        rewards: [...event.rewards].sort(compareRewards),
    }))
        .sort((left, right) => left.type.localeCompare(right.type) || left.id.localeCompare(right.id));
    return {
        generatedAt: new Date().toISOString(),
        source: "dokkaninfo",
        eventCount: normalizedEvents.length,
        rewardCount: normalizedEvents.reduce((sum, event) => sum + event.rewards.length, 0),
        failedEventIds: failedEventIds.length ? [...new Set(failedEventIds)].sort() : undefined,
        events: normalizedEvents,
    };
}
exports.buildDokkanInfoEventRewardDataset = buildDokkanInfoEventRewardDataset;
async function collectEventSummaries(types) {
    const summaries = [];
    for (const type of types) {
        try {
            const document = await (0, scraper_1.fetchFromWeb)(`${DOKKAN_INFO_BASE_URL}/events/${type}`);
            summaries.push(...eventSummariesFromIndex(document, type));
        }
        catch (error) {
            console.error(`[DOKKANINFO-EVENTS] Failed index ${type}: ${errorMessage(error)}`);
        }
    }
    return summaries.filter((summary, index, rows) => rows.findIndex(candidate => candidate.type === summary.type && candidate.id === summary.id) === index);
}
function eventSummariesFromIndex(document, type) {
    const eventComponent = document.querySelector("events");
    const eventJson = parseJsonAttribute(eventComponent?.getAttribute("v-bind:eventjson"));
    if (eventJson?.length) {
        return eventJson.map(event => ({
            id: toString(event.id),
            type,
            name: cleanText(event.name),
            startAt: normalizeDate(event.start_at),
            endAt: normalizeDate(event.end_at),
            imagePath: cleanText(event.banner_image_path || event.listbutton_image_path),
        })).filter(event => event.id);
    }
    const prefix = `/events/${type}/`;
    return Array.from(document.querySelectorAll("a[href]"))
        .map(anchor => {
        const href = cleanText(anchor.getAttribute("href"));
        const match = href.match(new RegExp(`(?:https?://[^/]+)?${escapeRegExp(prefix)}(\\d+)$`));
        if (!match) {
            return undefined;
        }
        return {
            id: match[1],
            type,
            name: cleanText(anchor.textContent),
            imagePath: cleanText(anchor.querySelector("img")?.getAttribute("src")),
        };
    })
        .filter((summary) => Boolean(summary));
}
async function fetchAndMapEvent(summary) {
    const cacheName = `${summary.type}-${summary.id}.json`;
    const cached = await readCachedEvent(cacheName);
    if (cached) {
        return cached;
    }
    const sourcePath = `${DOKKAN_INFO_BASE_URL}/events/${summary.type}/${summary.id}`;
    const document = await (0, scraper_1.fetchFromWeb)(sourcePath);
    const title = cleanText(document.title).replace(/\s*\|\s*Dokkan Info!?$/i, "");
    const eventName = summary.name || title || `${summary.type} ${summary.id}`;
    const event = {
        id: summary.id,
        type: summary.type,
        name: eventName,
        sourcePath,
        startAt: summary.startAt,
        endAt: summary.endAt,
        imagePath: summary.imagePath,
        stages: mapEventStages(document, summary),
        missions: mapEventMissionReferences(document),
        rewards: mapEventRewards(document, summary, eventName, sourcePath),
    };
    await writeCachedEvent(cacheName, event);
    return event;
}
function mapEventRewards(document, summary, eventName, eventPath) {
    const rewards = [];
    Array.from(document.querySelectorAll("reward[v-bind\\:reward]"))
        .forEach((element, index) => {
        const payload = parseJsonAttribute(element.getAttribute("v-bind:reward"));
        if (!payload) {
            return;
        }
        const itemId = toString(payload.item_id ?? payload.item?.id ?? payload.potential_item?.id ?? payload.card?.id);
        const itemType = cleanText(payload.item_type);
        if (!itemId || !itemType) {
            return;
        }
        const stage = stageContext(element, summary.type, summary.id);
        const rewardId = toString(payload.id) || index.toString();
        const key = [
            "dokkaninfo-event-reward",
            summary.type,
            summary.id,
            stage?.id || "event",
            rewardId,
            itemType,
            itemId,
        ].join(":");
        const item = payload.item || payload.potential_item || payload.card;
        rewards.push({
            key,
            itemId,
            itemType,
            quantity: toNumber(payload.quantity ?? payload.amount ?? item?.amount ?? 1),
            name: cleanText(item?.name),
            description: cleanMultilineText(item?.description),
            rarity: toOptionalNumber(item?.rarity),
            zeni: toOptionalNumber(item?.zeni),
            tradePoints: toOptionalNumber(item?.selling_exchange_point),
            rewardType: cleanText(item?.type),
            amount: toOptionalNumber(item?.amount),
            eventId: summary.id,
            eventType: summary.type,
            eventName,
            eventPath,
            stageId: stage?.id,
            stagePath: stage?.path,
        });
    });
    const unique = new Map();
    for (const reward of rewards) {
        unique.set(reward.key, reward);
    }
    return [...unique.values()];
}
function mapEventStages(document, summary) {
    const stages = Array.from(document.querySelectorAll("a[href]"))
        .map((anchor) => {
        const href = cleanText(anchor.getAttribute("href"));
        const match = href.match(new RegExp(`(?:https?://[^/]+)?/events/${escapeRegExp(summary.type)}/${escapeRegExp(summary.id)}/(\\d+)$`));
        if (!match) {
            return undefined;
        }
        const stageContainer = anchor.closest(".col-sm") || anchor.parentElement;
        const heading = cleanText(stageContainer?.querySelector(".font-size-1_5")?.textContent);
        const title = heading || `Stage ${match[1]}`;
        const levelMatch = title.match(/\bLevel\s+(\d+)\s*:/i);
        const difficulty = cleanText(anchor.textContent).match(/\b(SUPER\s*\d*|Z-HARD|HARD|NORMAL)\b/i)?.[1];
        return {
            id: match[1],
            title,
            level: levelMatch ? Number(levelMatch[1]) : undefined,
            difficulty: difficulty ? cleanText(difficulty) : undefined,
            sourcePath: href.startsWith("http") ? href : `${DOKKAN_INFO_BASE_URL}${href}`,
        };
    })
        .filter((stage) => Boolean(stage));
    return [...new Map(stages.map(stage => [stage.id, stage])).values()]
        .sort((left, right) => (left.level ?? Number.MAX_SAFE_INTEGER) - (right.level ?? Number.MAX_SAFE_INTEGER) || left.id.localeCompare(right.id));
}
exports.mapEventStages = mapEventStages;
function mapEventMissionReferences(document) {
    const category = document.querySelector("mission-category");
    const payload = parseJsonAttribute(category?.getAttribute("v-bind:missioncategory"));
    return (payload?.missions ?? [])
        .map(mission => {
        const conditions = parseJsonAttribute(mission.conditions);
        const stageIds = (conditions?.sugoroku_map_ids ?? [])
            .map(toString)
            .filter(Boolean);
        const id = toString(mission.id);
        return id && stageIds.length ? { id, stageIds } : undefined;
    })
        .filter((mission) => Boolean(mission));
}
exports.mapEventMissionReferences = mapEventMissionReferences;
function stageContext(element, type, eventId) {
    const href = cleanText(element.closest("a")?.getAttribute("href"));
    const match = href.match(new RegExp(`(?:https?://[^/]+)?/events/${escapeRegExp(type)}/${escapeRegExp(eventId)}/(\\d+)$`));
    if (!match) {
        return undefined;
    }
    return {
        id: match[1],
        path: href.startsWith("http") ? href : `${DOKKAN_INFO_BASE_URL}${href}`,
    };
}
async function readCachedEvent(fileName) {
    if (/^(1|true|yes)$/i.test(process.env.DOKKANINFO_EVENT_REWARD_REFRESH ?? "")) {
        return undefined;
    }
    try {
        const raw = await (0, promises_1.readFile)((0, path_1.resolve)(__dirname, EVENT_CACHE_DIR, fileName), "utf8");
        const entry = JSON.parse(raw);
        const ttlHours = parseFloat(process.env.DOKKANINFO_EVENT_REWARD_CACHE_TTL_HOURS ?? "");
        const ttl = Number.isFinite(ttlHours) && ttlHours >= 0 ? ttlHours : 24;
        if (!entry.event || Date.now() - Date.parse(entry.fetchedAt) > ttl * 60 * 60 * 1000 || !hasStageMetadata(entry.event)) {
            return undefined;
        }
        return entry.event;
    }
    catch {
        return undefined;
    }
}
function hasStageMetadata(event) {
    return Array.isArray(event.stages) && Array.isArray(event.missions);
}
async function writeCachedEvent(fileName, event) {
    const cacheDir = (0, path_1.resolve)(__dirname, EVENT_CACHE_DIR);
    const cachePath = (0, path_1.resolve)(cacheDir, fileName);
    await (0, promises_1.mkdir)(cacheDir, { recursive: true });
    await (0, promises_1.writeFile)(`${cachePath}.tmp`, JSON.stringify({
        fetchedAt: new Date().toISOString(),
        event,
    }));
    await (0, promises_1.rename)(`${cachePath}.tmp`, cachePath);
}
function requestedEventTypes() {
    const configured = (process.env.DOKKANINFO_EVENT_REWARD_TYPES ?? "")
        .split(",")
        .map(cleanText)
        .filter(Boolean);
    return configured.length ? configured : DEFAULT_EVENT_TYPES;
}
function requestedEventLimit() {
    const value = parseInt(process.env.DOKKANINFO_EVENT_REWARD_LIMIT ?? "", 10);
    return Number.isFinite(value) && value > 0 ? value : undefined;
}
function requestedEventConcurrency() {
    const value = parseInt(process.env.DOKKANINFO_EVENT_REWARD_CONCURRENCY ?? "", 10);
    return Number.isFinite(value) && value > 0 ? value : DEFAULT_CONCURRENCY;
}
function compareRewards(left, right) {
    return left.itemType.localeCompare(right.itemType)
        || left.itemId.localeCompare(right.itemId)
        || left.key.localeCompare(right.key);
}
function compareStages(left, right) {
    return (left.level ?? Number.MAX_SAFE_INTEGER) - (right.level ?? Number.MAX_SAFE_INTEGER)
        || left.id.localeCompare(right.id);
}
function compareMissionReferences(left, right) {
    return left.id.localeCompare(right.id);
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
function cleanMultilineText(value) {
    const normalized = String(value ?? "")
        .replace(/\r/g, "")
        .split("\n")
        .map(line => cleanText(line))
        .filter(Boolean)
        .join("\n");
    return normalized || undefined;
}
function normalizeDate(value) {
    const normalized = cleanText(value);
    if (!normalized) {
        return undefined;
    }
    const parsed = new Date(normalized.replace(" ", "T") + (normalized.includes("Z") ? "" : "Z"));
    return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
}
function toString(value) {
    return value === null || value === undefined ? "" : String(value).trim();
}
function toNumber(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
}
function toOptionalNumber(value) {
    const parsed = Number(value);
    return value === null || value === undefined || value === "" || !Number.isFinite(parsed) ? undefined : parsed;
}
function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function errorMessage(error) {
    return error instanceof Error ? error.message : String(error);
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
//# sourceMappingURL=dokkaninfo-event-rewards.js.map