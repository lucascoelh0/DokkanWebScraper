import { mkdir, readFile, rename, writeFile } from "fs/promises";
import { resolve } from "path";
import { fetchFromWeb } from "./scraper";
import {
    DokkanInfoEventMissionReference,
    DokkanInfoEventReward,
    DokkanInfoEventRewardDataset,
    DokkanInfoEventRewardEvent,
    DokkanInfoEventStage,
} from "./dokkaninfo-event-reward";
import { writeFormattedJson } from "./format-json";

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

interface DokkanInfoEventSummary {
    id: string,
    type: string,
    name: string,
    startAt?: string,
    endAt?: string,
    imagePath?: string,
}

interface DokkanInfoRewardPayload {
    id?: number | string | null,
    item_id?: number | string | null,
    item_type?: string | null,
    quantity?: number | string | null,
    amount?: number | string | null,
    item?: DokkanInfoRewardItem | null,
    potential_item?: DokkanInfoRewardItem | null,
    card?: DokkanInfoRewardItem | null,
}

interface DokkanInfoRewardItem {
    id?: number | string | null,
    name?: string | null,
    description?: string | null,
    rarity?: number | null,
    zeni?: number | null,
    selling_exchange_point?: number | null,
    type?: string | null,
    amount?: number | null,
}

interface CachedEventEntry {
    fetchedAt: string,
    event: DokkanInfoEventRewardEvent,
}

export async function getDokkanInfoEventRewards(): Promise<DokkanInfoEventRewardDataset> {
    const summaries = await collectEventSummaries(requestedEventTypes());
    const limitedSummaries = requestedEventLimit()
        ? summaries.slice(0, requestedEventLimit())
        : summaries;
    const failedEventIds: string[] = [];
    let completed = 0;

    const events = (
        await mapWithConcurrency(limitedSummaries, requestedEventConcurrency(), async summary => {
            try {
                return await fetchAndMapEvent(summary);
            } catch (error) {
                failedEventIds.push(`${summary.type}:${summary.id}`);
                console.error(`[DOKKANINFO-EVENTS] Failed ${summary.type}:${summary.id}: ${errorMessage(error)}`);
                return undefined;
            } finally {
                completed += 1;
                if (completed === 1 || completed % 25 === 0 || completed === limitedSummaries.length) {
                    console.log(`[DOKKANINFO-EVENTS] Events ${completed}/${limitedSummaries.length}`);
                }
            }
        })
    ).filter((event): event is DokkanInfoEventRewardEvent => Boolean(event));

    return buildDokkanInfoEventRewardDataset(events, failedEventIds);
}

export async function writeDokkanInfoEventRewards(
    dataset?: DokkanInfoEventRewardDataset,
): Promise<string> {
    const resolvedDataset = dataset ?? await getDokkanInfoEventRewards();
    const outputDir = resolve(__dirname, EVENT_OUTPUT_DIR);
    const outputPath = resolve(outputDir, "event-rewards.json");

    await mkdir(outputDir, { recursive: true });
    await writeFormattedJson(outputPath, resolvedDataset);
    return outputPath;
}

export function buildDokkanInfoEventRewardDataset(
    events: DokkanInfoEventRewardEvent[],
    failedEventIds: string[] = [],
): DokkanInfoEventRewardDataset {
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

async function collectEventSummaries(types: string[]): Promise<DokkanInfoEventSummary[]> {
    const summaries: DokkanInfoEventSummary[] = [];

    for (const type of types) {
        try {
            const document = await fetchFromWeb(`${DOKKAN_INFO_BASE_URL}/events/${type}`);
            summaries.push(...eventSummariesFromIndex(document, type));
        } catch (error) {
            console.error(`[DOKKANINFO-EVENTS] Failed index ${type}: ${errorMessage(error)}`);
        }
    }

    return summaries.filter((summary, index, rows) => rows.findIndex(candidate => candidate.type === summary.type && candidate.id === summary.id) === index);
}

function eventSummariesFromIndex(document: Document, type: string): DokkanInfoEventSummary[] {
    const eventComponent = document.querySelector("events");
    const eventJson = parseJsonAttribute<DokkanInfoEventSummaryPayload[]>(eventComponent?.getAttribute("v-bind:eventjson"));

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
            } as DokkanInfoEventSummary;
        })
        .filter((summary): summary is DokkanInfoEventSummary => Boolean(summary));
}

interface DokkanInfoEventSummaryPayload {
    id?: number | string | null,
    type?: string | null,
    name?: string | null,
    start_at?: string | null,
    end_at?: string | null,
    banner_image_path?: string | null,
    listbutton_image_path?: string | null,
}

async function fetchAndMapEvent(summary: DokkanInfoEventSummary): Promise<DokkanInfoEventRewardEvent> {
    const cacheName = `${summary.type}-${summary.id}.json`;
    const cached = await readCachedEvent(cacheName);
    if (cached) {
        return cached;
    }

    const sourcePath = `${DOKKAN_INFO_BASE_URL}/events/${summary.type}/${summary.id}`;
    const document = await fetchFromWeb(sourcePath);
    const title = cleanText(document.title).replace(/\s*\|\s*Dokkan Info!?$/i, "");
    const eventName = summary.name || title || `${summary.type} ${summary.id}`;
    const event: DokkanInfoEventRewardEvent = {
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

function mapEventRewards(
    document: Document,
    summary: DokkanInfoEventSummary,
    eventName: string,
    eventPath: string,
): DokkanInfoEventReward[] {
    const rewards: DokkanInfoEventReward[] = [];

    Array.from(document.querySelectorAll("reward[v-bind\\:reward]"))
        .forEach((element, index) => {
            const payload = parseJsonAttribute<DokkanInfoRewardPayload>(element.getAttribute("v-bind:reward"));
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

    const unique = new Map<string, DokkanInfoEventReward>();
    for (const reward of rewards) {
        unique.set(reward.key, reward);
    }

    return [...unique.values()];
}

export function mapEventStages(document: Document, summary: DokkanInfoEventSummary): DokkanInfoEventStage[] {
    const stages = Array.from(document.querySelectorAll("a[href]"))
        .map((anchor): DokkanInfoEventStage | undefined => {
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
        .filter((stage): stage is DokkanInfoEventStage => Boolean(stage));

    return [...new Map(stages.map(stage => [stage.id, stage])).values()]
        .sort((left, right) => (left.level ?? Number.MAX_SAFE_INTEGER) - (right.level ?? Number.MAX_SAFE_INTEGER) || left.id.localeCompare(right.id));
}

export function mapEventMissionReferences(document: Document): DokkanInfoEventMissionReference[] {
    const category = document.querySelector("mission-category");
    const payload = parseJsonAttribute<{ missions?: Array<{ id?: number | string | null, conditions?: string | null }> }>(
        category?.getAttribute("v-bind:missioncategory"),
    );

    return (payload?.missions ?? [])
        .map(mission => {
            const conditions = parseJsonAttribute<{ sugoroku_map_ids?: Array<number | string | null> }>(mission.conditions);
            const stageIds = (conditions?.sugoroku_map_ids ?? [])
                .map(toString)
                .filter(Boolean);
            const id = toString(mission.id);
            return id && stageIds.length ? { id, stageIds } : undefined;
        })
        .filter((mission): mission is DokkanInfoEventMissionReference => Boolean(mission));
}

function stageContext(element: Element, type: string, eventId: string): { id: string, path: string } | undefined {
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

async function readCachedEvent(fileName: string): Promise<DokkanInfoEventRewardEvent | undefined> {
    if (/^(1|true|yes)$/i.test(process.env.DOKKANINFO_EVENT_REWARD_REFRESH ?? "")) {
        return undefined;
    }

    try {
        const raw = await readFile(resolve(__dirname, EVENT_CACHE_DIR, fileName), "utf8");
        const entry = JSON.parse(raw) as CachedEventEntry;
        const ttlHours = parseFloat(process.env.DOKKANINFO_EVENT_REWARD_CACHE_TTL_HOURS ?? "");
        const ttl = Number.isFinite(ttlHours) && ttlHours >= 0 ? ttlHours : 24;
        if (!entry.event || Date.now() - Date.parse(entry.fetchedAt) > ttl * 60 * 60 * 1000 || !hasStageMetadata(entry.event)) {
            return undefined;
        }

        return entry.event;
    } catch {
        return undefined;
    }
}

function hasStageMetadata(event: DokkanInfoEventRewardEvent): boolean {
    return Array.isArray(event.stages) && Array.isArray(event.missions);
}

async function writeCachedEvent(fileName: string, event: DokkanInfoEventRewardEvent): Promise<void> {
    const cacheDir = resolve(__dirname, EVENT_CACHE_DIR);
    const cachePath = resolve(cacheDir, fileName);
    await mkdir(cacheDir, { recursive: true });
    await writeFile(`${cachePath}.tmp`, JSON.stringify({
        fetchedAt: new Date().toISOString(),
        event,
    } as CachedEventEntry));
    await rename(`${cachePath}.tmp`, cachePath);
}

function requestedEventTypes(): string[] {
    const configured = (process.env.DOKKANINFO_EVENT_REWARD_TYPES ?? "")
        .split(",")
        .map(cleanText)
        .filter(Boolean);
    return configured.length ? configured : DEFAULT_EVENT_TYPES;
}

function requestedEventLimit(): number | undefined {
    const value = parseInt(process.env.DOKKANINFO_EVENT_REWARD_LIMIT ?? "", 10);
    return Number.isFinite(value) && value > 0 ? value : undefined;
}

function requestedEventConcurrency(): number {
    const value = parseInt(process.env.DOKKANINFO_EVENT_REWARD_CONCURRENCY ?? "", 10);
    return Number.isFinite(value) && value > 0 ? value : DEFAULT_CONCURRENCY;
}

function compareRewards(left: DokkanInfoEventReward, right: DokkanInfoEventReward): number {
    return left.itemType.localeCompare(right.itemType)
        || left.itemId.localeCompare(right.itemId)
        || left.key.localeCompare(right.key);
}

function compareStages(left: DokkanInfoEventStage, right: DokkanInfoEventStage): number {
    return (left.level ?? Number.MAX_SAFE_INTEGER) - (right.level ?? Number.MAX_SAFE_INTEGER)
        || left.id.localeCompare(right.id);
}

function compareMissionReferences(left: DokkanInfoEventMissionReference, right: DokkanInfoEventMissionReference): number {
    return left.id.localeCompare(right.id);
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

function cleanMultilineText(value: string | null | undefined): string | undefined {
    const normalized = String(value ?? "")
        .replace(/\r/g, "")
        .split("\n")
        .map(line => cleanText(line))
        .filter(Boolean)
        .join("\n");
    return normalized || undefined;
}

function normalizeDate(value: string | null | undefined): string | undefined {
    const normalized = cleanText(value);
    if (!normalized) {
        return undefined;
    }

    const parsed = new Date(normalized.replace(" ", "T") + (normalized.includes("Z") ? "" : "Z"));
    return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
}

function toString(value: number | string | null | undefined): string {
    return value === null || value === undefined ? "" : String(value).trim();
}

function toNumber(value: number | string | null | undefined): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
}

function toOptionalNumber(value: number | string | null | undefined): number | undefined {
    const parsed = Number(value);
    return value === null || value === undefined || value === "" || !Number.isFinite(parsed) ? undefined : parsed;
}

function escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}

async function mapWithConcurrency<TInput, TOutput>(
    input: TInput[],
    concurrency: number,
    mapper: (value: TInput, index: number) => Promise<TOutput>,
): Promise<TOutput[]> {
    const results: TOutput[] = new Array(input.length);
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
