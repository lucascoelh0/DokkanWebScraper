import { mkdir, readFile, rename, writeFile } from "fs/promises";
import { resolve } from "path";
import {
    DokkanInfoZBattleCardReference,
    DokkanInfoZBattleCondition,
    DokkanInfoZBattleDataset,
    DokkanInfoZBattleEvent,
    DokkanInfoZBattleLevel,
    DokkanInfoZBattleRange,
    DokkanInfoZBattleReward,
    DokkanInfoZBattleSkillIcon,
    DokkanInfoZBattleStatsStatus,
    DokkanInfoZBattleWeakness,
} from "./dokkaninfo-z-battle";
import { writeFormattedJson } from "./format-json";
import { fetchFromWeb } from "./scraper";

const DOKKAN_INFO_BASE_URL = "https://dokkaninfo.com";
const INDEX_URL = `${DOKKAN_INFO_BASE_URL}/events/zbattle`;
const CACHE_DIR = "data/dokkaninfo-z-battles/cache";
const OUTPUT_DIR = "data/dokkaninfo-z-battles/latest";
const OUTPUT_FILE = "z-battles.json";
const CACHE_SCHEMA_VERSION = "1.0.0";
const DEFAULT_CONCURRENCY = 2;
const DEFAULT_REQUEST_DELAY_MS = 150;

interface RawZBattleSummary {
    id?: number | string | null,
    type?: string | null,
    z_battle_stage_effect_escalation_type?: number | string | null,
    banner_image_path?: string | null,
    listbutton_image_path?: string | null,
    announcement_id?: number | string | null,
    priority?: number | string | null,
    start_at?: string | null,
    end_at?: string | null,
    eventkagi_start_at?: string | null,
    eventkagi_end_at?: string | null,
    enable_battle_auto?: number | boolean | null,
    cpu_friend_list_id?: number | string | null,
    related_z_battle_stage_id?: number | string | null,
    unlock_conditions?: string | null,
}

export interface DokkanInfoZBattleSummary {
    id: string,
    type: string,
    sourcePath: string,
    escalationTypeId?: string,
    announcementId?: string,
    priority?: number,
    bannerPath?: string,
    buttonPath?: string,
    startsAt?: string,
    endsAt?: string,
    eventKeyStartsAt?: string,
    eventKeyEndsAt?: string,
    enableBattleAuto?: boolean,
    cpuFriendListId?: string,
    relatedZBattleStageId?: string,
    unlockConditionsRawJson?: string,
}

interface RawCardPayload {
    id?: number | string | null,
    name?: string | null,
    element?: number | string | null,
    icon_id?: number | string | null,
    resource_id?: number | string | null,
}

interface RawRewardPayload {
    item_id?: number | string | null,
    item_type?: string | null,
    quantity?: number | string | null,
    item?: {
        name?: string | null,
        type?: string | null,
    } | null,
}

interface CachedValue<T> {
    schemaVersion: string,
    fetchedAt: string,
    value: T,
}

type ZBattleEventShell = Omit<DokkanInfoZBattleEvent, "statsDataStatus" | "levels">;

export async function getDokkanInfoZBattles(): Promise<DokkanInfoZBattleDataset> {
    const allSummaries = await fetchZBattleSummaries();
    const summaries = selectRequestedSummaries(allSummaries);
    const failedEventIds: string[] = [];
    const failedStatsIds: string[] = [];
    let completedEvents = 0;

    const shells = (
        await mapWithConcurrency(summaries, requestedConcurrency(), async summary => {
            try {
                const shell = await fetchZBattleEvent(summary);
                completedEvents += 1;
                console.log(`[DOKKANINFO-Z-BATTLES] Events ${completedEvents}/${summaries.length}: ${summary.id} (${shell.ranges.length} ranges)`);
                return shell;
            } catch (error) {
                completedEvents += 1;
                failedEventIds.push(summary.id);
                console.error(`[DOKKANINFO-Z-BATTLES] Failed event ${summary.id}: ${errorMessage(error)}`);
                return undefined;
            }
        })
    ).filter((shell): shell is ZBattleEventShell => Boolean(shell));

    let completedStats = 0;
    const events = await mapWithConcurrency(shells, requestedConcurrency(), async shell => {
        await delay(requestedDelayMs());
        let statsDataStatus: DokkanInfoZBattleStatsStatus = "not-provided";
        let levels: DokkanInfoZBattleLevel[] = [];
        try {
            const stats = await fetchZBattleStats(shell.id, shell.statsPath);
            statsDataStatus = stats.length ? "available" : "not-provided";
            levels = stats;
        } catch (error) {
            statsDataStatus = "fetch-failed";
            failedStatsIds.push(shell.id);
            console.error(`[DOKKANINFO-Z-BATTLES] Failed stats ${shell.id}: ${errorMessage(error)}`);
        } finally {
            completedStats += 1;
            if (completedStats === 1 || completedStats % 10 === 0 || completedStats === shells.length) {
                console.log(`[DOKKANINFO-Z-BATTLES] Stats ${completedStats}/${shells.length}`);
            }
        }
        return { ...shell, statsDataStatus, levels };
    });

    return buildDokkanInfoZBattleDataset(events, failedEventIds, failedStatsIds);
}

export async function writeDokkanInfoZBattles(dataset?: DokkanInfoZBattleDataset): Promise<string> {
    const outputPath = resolve(__dirname, OUTPUT_DIR, OUTPUT_FILE);
    await mkdir(resolve(__dirname, OUTPUT_DIR), { recursive: true });
    await writeFormattedJson(outputPath, dataset ?? await getDokkanInfoZBattles());
    return outputPath;
}

export function buildDokkanInfoZBattleDataset(
    events: DokkanInfoZBattleEvent[],
    failedEventIds: string[] = [],
    failedStatsIds: string[] = [],
): DokkanInfoZBattleDataset {
    const normalizedEvents = [...events]
        .map(event => ({
            ...event,
            weaknesses: [...event.weaknesses].sort((left, right) => (left.startsAtLevel ?? 0) - (right.startsAtLevel ?? 0) || left.name.localeCompare(right.name)),
            conditions: [...event.conditions].sort((left, right) => (left.startsAtLevel ?? 0) - (right.startsAtLevel ?? 0) || left.text.localeCompare(right.text)),
            ranges: [...event.ranges].sort((left, right) => left.startLevel - right.startLevel || left.label.localeCompare(right.label)),
            levels: [...event.levels].sort((left, right) => left.level - right.level),
        }))
        .sort((left, right) => compareIds(right.id, left.id));

    return {
        schemaVersion: "1.0.0",
        generatedAt: new Date().toISOString(),
        source: "dokkaninfo",
        sourcePath: INDEX_URL,
        eventCount: normalizedEvents.length,
        rangeCount: normalizedEvents.reduce((sum, event) => sum + event.ranges.length, 0),
        levelCount: normalizedEvents.reduce((sum, event) => sum + event.levels.length, 0),
        failedEventIds: uniqueSorted(failedEventIds),
        failedStatsIds: uniqueSorted(failedStatsIds),
        events: normalizedEvents,
    };
}

export function mapDokkanInfoZBattleIndex(document: Document): DokkanInfoZBattleSummary[] {
    assertUsableDokkanInfoPage(document);
    const payload = parseJsonAttribute<RawZBattleSummary[]>(
        document.querySelector("events")?.getAttribute("v-bind:eventjson"),
    ) ?? [];
    const summaries = payload
        .map(mapZBattleSummary)
        .filter((summary): summary is DokkanInfoZBattleSummary => Boolean(summary));
    const unique = [...new Map(summaries.map(summary => [summary.id, summary])).values()]
        .sort((left, right) => compareIds(left.id, right.id));
    if (!unique.length) {
        throw new Error("DokkanInfo Z-Battle index exposed no events.");
    }
    return unique;
}

export function mapDokkanInfoZBattleEvent(
    document: Document,
    summary: DokkanInfoZBattleSummary,
): ZBattleEventShell {
    assertUsableDokkanInfoPage(document);
    const displayName = cleanText(document.title).replace(/\s*\|\s*Dokkan Info!?$/i, "") || `Z-Battle ${summary.id}`;
    const statsPath = absoluteOptionalUrl(
        Array.from(document.querySelectorAll<HTMLAnchorElement>("a[href]"))
            .find(anchor => cleanText(anchor.textContent) === "Stats")
            ?.getAttribute("href"),
    ) ?? `${summary.sourcePath}/stats`;
    const weaknesses = mapWeaknesses(document);
    const tableHeader = Array.from(document.querySelectorAll(".row"))
        .find(row => cleanText(row.textContent).startsWith("Level Enemy Skills Damage Reduction Medals Orbs Cards Replay Drops Stones"));
    const tableContainer = tableHeader?.nextElementSibling?.querySelector(":scope > .col-md");
    if (!tableContainer) {
        throw new Error(`DokkanInfo Z-Battle ${summary.id} exposed no level-range table.`);
    }

    const conditions: DokkanInfoZBattleCondition[] = [];
    const ranges: DokkanInfoZBattleRange[] = [];
    let pendingConditions: string[] = [];
    for (const row of Array.from(tableContainer.children)) {
        const enemyCard = row.children[1]?.querySelector("card-icon[v-bind\\:card]");
        if (!enemyCard) {
            const text = optionalText(row.textContent);
            if (text) {
                pendingConditions.push(text);
            }
            continue;
        }

        const range = mapRangeRow(row);
        if (!range) {
            continue;
        }
        conditions.push(...pendingConditions.map(text => ({ text, startsAtLevel: range.startLevel })));
        pendingConditions = [];
        ranges.push(range);
    }
    conditions.push(...pendingConditions.map(text => ({ text })));
    if (!ranges.length) {
        throw new Error(`DokkanInfo Z-Battle ${summary.id} exposed no level ranges.`);
    }

    return {
        id: summary.id,
        type: summary.type,
        displayName,
        sourcePath: summary.sourcePath,
        statsPath,
        escalationTypeId: summary.escalationTypeId,
        announcementId: summary.announcementId,
        priority: summary.priority,
        images: withoutUndefined({ bannerPath: summary.bannerPath, buttonPath: summary.buttonPath }),
        availability: withoutUndefined({
            startsAt: summary.startsAt,
            endsAt: summary.endsAt,
            eventKeyStartsAt: summary.eventKeyStartsAt,
            eventKeyEndsAt: summary.eventKeyEndsAt,
        }),
        enableBattleAuto: summary.enableBattleAuto,
        cpuFriendListId: summary.cpuFriendListId,
        relatedZBattleStageId: summary.relatedZBattleStageId,
        unlockConditionsRawJson: summary.unlockConditionsRawJson,
        weaknesses,
        conditions,
        ranges,
    };
}

export function mapDokkanInfoZBattleStats(document: Document): DokkanInfoZBattleLevel[] {
    assertUsableDokkanInfoPage(document);
    const tableHeader = Array.from(document.querySelectorAll(".row"))
        .find(row => cleanText(row.textContent) === "Level Enemy HP ATK DEF");
    const rows = tableHeader?.parentElement
        ? Array.from(tableHeader.parentElement.children).slice(1)
        : [];

    return rows
        .map((row): DokkanInfoZBattleLevel | undefined => {
            if (row.children.length < 5) {
                return undefined;
            }
            const level = optionalNumber(row.children[0].textContent);
            if (level === undefined) {
                return undefined;
            }
            const card = mapCardElement(row.children[1].querySelector("card-icon[v-bind\\:card]"));
            return withoutUndefined({
                level,
                enemyCardId: card?.id,
                hp: optionalNumber(row.children[2].textContent),
                atk: optionalNumber(row.children[3].textContent),
                def: optionalNumber(row.children[4].textContent),
            }) as DokkanInfoZBattleLevel;
        })
        .filter((level): level is DokkanInfoZBattleLevel => Boolean(level))
        .sort((left, right) => left.level - right.level);
}

function mapZBattleSummary(raw: RawZBattleSummary): DokkanInfoZBattleSummary | undefined {
    const id = toOptionalString(raw.id);
    if (!id) {
        return undefined;
    }
    return withoutUndefined({
        id,
        type: optionalText(raw.type) ?? "ZBattleStage::Normal",
        sourcePath: `${INDEX_URL}/${id}`,
        escalationTypeId: toOptionalString(raw.z_battle_stage_effect_escalation_type),
        announcementId: toOptionalString(raw.announcement_id),
        priority: optionalNumber(toOptionalString(raw.priority)),
        bannerPath: optionalText(raw.banner_image_path),
        buttonPath: optionalText(raw.listbutton_image_path),
        startsAt: optionalText(raw.start_at),
        endsAt: optionalText(raw.end_at),
        eventKeyStartsAt: optionalText(raw.eventkagi_start_at),
        eventKeyEndsAt: optionalText(raw.eventkagi_end_at),
        enableBattleAuto: toOptionalBoolean(raw.enable_battle_auto),
        cpuFriendListId: toOptionalString(raw.cpu_friend_list_id),
        relatedZBattleStageId: toOptionalString(raw.related_z_battle_stage_id),
        unlockConditionsRawJson: optionalText(raw.unlock_conditions),
    }) as DokkanInfoZBattleSummary;
}

function mapWeaknesses(document: Document): DokkanInfoZBattleWeakness[] {
    return Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href*="/categories/"]'))
        .map((anchor): DokkanInfoZBattleWeakness | undefined => {
            const id = absoluteUrl(anchor.getAttribute("href")).match(/\/categories\/(\d+)$/)?.[1];
            const name = optionalText(anchor.textContent);
            const row = anchor.closest(".row.font-size-1_5");
            const startsAtLevel = optionalNumber(row?.lastElementChild?.textContent);
            return name ? withoutUndefined({ kind: "category", id, name, startsAtLevel }) as DokkanInfoZBattleWeakness : undefined;
        })
        .filter((value): value is DokkanInfoZBattleWeakness => Boolean(value));
}

function mapRangeRow(row: Element): DokkanInfoZBattleRange | undefined {
    const label = cleanText(row.children[0]?.textContent);
    const parsedRange = parseLevelRange(label);
    if (!parsedRange) {
        return undefined;
    }
    return withoutUndefined({
        label,
        startLevel: parsedRange.startLevel,
        endLevel: parsedRange.endLevel,
        enemy: mapCardElement(row.children[1]?.querySelector("card-icon[v-bind\\:card]")),
        skillIcons: mapSkillIcons(row.children[2]),
        damageReductionPercent: optionalNumber(row.children[3]?.textContent),
        medalRewards: mapRewardColumn(row.children[4]),
        orbRewards: mapRewardColumn(row.children[5]),
        cardRewards: mapRewardColumn(row.children[6]),
        replayRewards: mapRewardColumn(row.children[7]),
        stoneRewards: mapRewardColumn(row.children[8]),
    }) as DokkanInfoZBattleRange;
}

function parseLevelRange(label: string): { startLevel: number; endLevel: number | null } | undefined {
    const match = label.match(/^(\d+)(?:\s*-\s*(\d+)|\+)?$/);
    if (!match) {
        return undefined;
    }
    const startLevel = Number(match[1]);
    const endLevel = label.includes("+") ? null : Number(match[2] ?? match[1]);
    return { startLevel, endLevel };
}

function mapSkillIcons(element: Element | undefined): DokkanInfoZBattleSkillIcon[] {
    if (!element) {
        return [];
    }
    return Array.from(element.querySelectorAll<HTMLImageElement>('img[src*="/condition/"]'))
        .map(image => {
            const path = absoluteUrl(image.getAttribute("src"));
            return withoutUndefined({ id: path.match(/\/st_(\d+)\.png$/)?.[1], path });
        });
}

function mapRewardColumn(element: Element | undefined): DokkanInfoZBattleReward[] {
    if (!element) {
        return [];
    }
    const componentRewards = Array.from(element.querySelectorAll("reward[v-bind\\:reward]"))
        .map(reward => parseJsonAttribute<RawRewardPayload>(reward.getAttribute("v-bind:reward")))
        .filter((reward): reward is RawRewardPayload => Boolean(reward))
        .map((reward): DokkanInfoZBattleReward => withoutUndefined({
            itemType: optionalText(reward.item_type) ?? "Unknown",
            itemId: toOptionalString(reward.item_id),
            quantity: optionalNumber(toOptionalString(reward.quantity)) ?? 1,
            name: optionalText(reward.item?.name),
            rewardType: optionalText(reward.item?.type),
        }) as DokkanInfoZBattleReward);
    const quantity = optionalNumber(cleanText(element.textContent).match(/x\s*([\d,]+)/i)?.[1]) ?? 1;
    const cardRewards = Array.from(element.querySelectorAll("card-icon[v-bind\\:card]"))
        .map(mapCardElement)
        .filter((card): card is DokkanInfoZBattleCardReference => Boolean(card))
        .map((card): DokkanInfoZBattleReward => ({
            itemType: "Card",
            itemId: card.id,
            quantity,
            name: card.name,
            card,
        }));
    return [...componentRewards, ...cardRewards];
}

function mapCardElement(element: Element | null | undefined): DokkanInfoZBattleCardReference | undefined {
    const raw = parseJsonAttribute<RawCardPayload>(element?.getAttribute("v-bind:card"));
    const id = toOptionalString(raw?.id);
    if (!id) {
        return undefined;
    }
    const iconId = toOptionalString(raw?.icon_id);
    return withoutUndefined({
        id,
        name: optionalText(raw?.name),
        element: toOptionalString(raw?.element),
        iconId,
        resourceId: toOptionalString(raw?.resource_id),
        portraitPath: iconId
            ? `${DOKKAN_INFO_BASE_URL}/assets/global/en/character/thumb/card_${iconId}_thumb/card_${iconId}_thumb.png`
            : undefined,
    }) as DokkanInfoZBattleCardReference;
}

async function fetchZBattleSummaries(): Promise<DokkanInfoZBattleSummary[]> {
    const cached = await readCache<DokkanInfoZBattleSummary[]>("index.json");
    if (cached) {
        return cached;
    }
    const document = await fetchFromWeb(INDEX_URL);
    const summaries = mapDokkanInfoZBattleIndex(document);
    await writeCache("index.json", summaries);
    return summaries;
}

async function fetchZBattleEvent(summary: DokkanInfoZBattleSummary): Promise<ZBattleEventShell> {
    const cached = await readCache<ZBattleEventShell>(`events/${summary.id}.json`);
    if (cached) {
        return cached;
    }
    await delay(requestedDelayMs());
    const document = await fetchFromWeb(summary.sourcePath);
    const event = mapDokkanInfoZBattleEvent(document, summary);
    await writeCache(`events/${summary.id}.json`, event);
    return event;
}

async function fetchZBattleStats(id: string, statsPath: string): Promise<DokkanInfoZBattleLevel[]> {
    const cached = await readCache<DokkanInfoZBattleLevel[]>(`stats/${id}.json`);
    if (cached) {
        return cached;
    }
    const document = await fetchFromWeb(statsPath);
    const levels = mapDokkanInfoZBattleStats(document);
    await writeCache(`stats/${id}.json`, levels);
    return levels;
}

function selectRequestedSummaries(summaries: DokkanInfoZBattleSummary[]): DokkanInfoZBattleSummary[] {
    const ids = requestedIds();
    if (ids.length) {
        const byId = new Map(summaries.map(summary => [summary.id, summary]));
        const missing = ids.filter(id => !byId.has(id));
        if (missing.length) {
            throw new Error(`Requested DokkanInfo Z-Battle ids were not found: ${missing.join(", ")}.`);
        }
        return ids.map(id => byId.get(id)!);
    }
    const limit = requestedLimit();
    return limit ? summaries.slice(-limit) : summaries;
}

async function readCache<T>(relativePath: string): Promise<T | undefined> {
    if (refreshRequested()) {
        return undefined;
    }
    try {
        const raw = await readFile(resolve(__dirname, CACHE_DIR, relativePath), "utf8");
        const cached = JSON.parse(raw) as CachedValue<T>;
        if (cached.schemaVersion !== CACHE_SCHEMA_VERSION) {
            return undefined;
        }
        return Date.now() - Date.parse(cached.fetchedAt) <= requestedCacheTtlHours() * 60 * 60 * 1000
            ? cached.value
            : undefined;
    } catch {
        return undefined;
    }
}

async function writeCache<T>(relativePath: string, value: T): Promise<void> {
    const path = resolve(__dirname, CACHE_DIR, relativePath);
    await mkdir(resolve(path, ".."), { recursive: true });
    const tempPath = `${path}.tmp-${process.pid}`;
    await writeFile(tempPath, JSON.stringify({
        schemaVersion: CACHE_SCHEMA_VERSION,
        fetchedAt: new Date().toISOString(),
        value,
    } as CachedValue<T>));
    await rename(tempPath, path);
}

function requestedIds(): string[] {
    return [...new Set((process.env.DOKKANINFO_Z_BATTLES_IDS ?? process.env.DOKKANINFO_Z_BATTLE_IDS ?? "")
        .split(",")
        .map(value => value.trim())
        .filter(Boolean))];
}

function requestedLimit(): number | undefined {
    const value = Number(process.env.DOKKANINFO_Z_BATTLES_LIMIT ?? process.env.DOKKANINFO_Z_BATTLE_LIMIT);
    return Number.isInteger(value) && value > 0 ? value : undefined;
}

function refreshRequested(): boolean {
    return /^(?:1|true|yes)$/i.test(process.env.DOKKANINFO_Z_BATTLES_REFRESH ?? "");
}

function requestedConcurrency(): number {
    const value = Number(process.env.DOKKANINFO_Z_BATTLES_CONCURRENCY);
    return Number.isInteger(value) && value > 0 ? value : DEFAULT_CONCURRENCY;
}

function requestedDelayMs(): number {
    const value = Number(process.env.DOKKANINFO_Z_BATTLES_DELAY_MS);
    return Number.isFinite(value) && value >= 0 ? value : DEFAULT_REQUEST_DELAY_MS;
}

function requestedCacheTtlHours(): number {
    const value = Number(process.env.DOKKANINFO_Z_BATTLES_CACHE_TTL_HOURS);
    return Number.isFinite(value) && value >= 0 ? value : 168;
}

function toOptionalBoolean(value: number | boolean | null | undefined): boolean | undefined {
    return value === null || value === undefined ? undefined : Boolean(value);
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

function withoutUndefined<T extends Record<string, unknown>>(value: T): T {
    return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined)) as T;
}

function compareIds(left: string, right: string): number {
    return left.localeCompare(right, "en", { numeric: true });
}

function uniqueSorted(values: string[]): string[] | undefined {
    const unique = [...new Set(values)].sort(compareIds);
    return unique.length ? unique : undefined;
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
