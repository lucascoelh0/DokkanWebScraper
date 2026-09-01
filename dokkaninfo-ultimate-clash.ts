import { mkdir } from "fs/promises";
import { resolve } from "path";
import {
    DokkanInfoLabelledValue,
    DokkanInfoSpecialCardReference,
    DokkanInfoSpecialReward,
    DokkanInfoUltimateClash,
    DokkanInfoUltimateClashDataset,
    DokkanInfoUltimateClashEnemy,
    DokkanInfoUltimateClashLevel,
    DokkanInfoUltimateClashMission,
    DokkanInfoUltimateClashMechanic,
    DokkanInfoVisualReward,
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
    requiredNumber,
    stripDokkanInfoTitle,
    toId,
    withoutUndefined,
    writeSpecialCache,
} from "./dokkaninfo-special-events-common";
import { writeFormattedJson } from "./format-json";
import { fetchFromWeb } from "./scraper";

const INDEX_URL = `${DOKKAN_INFO_BASE_URL}/events/rmbattle`;
const CACHE_DIR = "data/dokkaninfo-ultimate-clash/cache-v2";
const OUTPUT_DIR = "data/dokkaninfo-ultimate-clash/latest";
const OUTPUT_FILE = "ultimate-clash.json";
const ENV_PREFIX = "DOKKANINFO_ULTIMATE_CLASH";

interface RawClash {
    id?: string | number,
    start_at?: string | number,
    end_at?: string | number,
    card_count_limit?: string | number,
    banner_image?: string,
    mission_reward_image?: string,
    announcement_id?: string | number,
}

interface RawClashPage {
    current_page?: number,
    data?: RawClash[],
    last_page?: number,
    total?: number,
}

interface ClashIndexPage {
    page: number,
    lastPage: number,
    total: number,
    clashes: DokkanInfoUltimateClash[],
}

interface RawCard {
    id?: string | number,
    name?: string,
    element?: string | number,
    rarity?: string | number,
    icon_id?: string | number,
    resource_id?: string | number | null,
}

interface RawMission {
    id?: string | number,
    type?: string,
    name?: string,
    description?: string,
    priority?: string | number,
    target_value?: string | number,
    conditions?: string | Record<string, unknown>,
    mission_rewards?: RawMissionReward[] | Record<string, RawMissionReward>,
}

interface RawMissionReward {
    id?: string | number,
    item_id?: string | number,
    item_type?: string,
    quantity?: string | number,
    card_exp_init?: string | number,
    description?: string,
    gift_description?: string,
}

export async function getDokkanInfoUltimateClashes(): Promise<DokkanInfoUltimateClashDataset> {
    const first = await fetchClashIndexPage(1);
    const remainingPages = Array.from({ length: Math.max(0, first.lastPage - 1) }, (_, index) => index + 2);
    const pages = [first, ...await mapWithConcurrency(remainingPages, requestedConcurrency(ENV_PREFIX), page => fetchClashIndexPage(page))];
    const summaries = [...new Map(pages.flatMap(page => page.clashes).map(clash => [clash.id, clash])).values()]
        .sort((left, right) => compareIds(left.id, right.id));
    if (summaries.length !== first.total) {
        throw new Error(`DokkanInfo Ultimate Clash advertised ${first.total} editions but exposed ${summaries.length}.`);
    }

    const failedClashIds: string[] = [];
    let completed = 0;
    const clashes = (await mapWithConcurrency(summaries, requestedConcurrency(ENV_PREFIX, 2), async summary => {
        try {
            const clash = await fetchClashDetail(summary);
            completed += 1;
            console.log(`[DOKKANINFO-CLASH] Editions ${completed}/${summaries.length}: ${summary.id} (${clash.levels.length} levels)`);
            return clash;
        } catch (error) {
            failedClashIds.push(summary.id);
            completed += 1;
            console.error(`[DOKKANINFO-CLASH] Failed edition ${summary.id}: ${errorMessage(error)}`);
            return undefined;
        }
    })).filter((clash): clash is DokkanInfoUltimateClash => Boolean(clash));

    return withoutUndefined({
        schemaVersion: "1.0.0",
        generatedAt: new Date().toISOString(),
        source: "dokkaninfo",
        sourcePath: INDEX_URL,
        clashCount: clashes.length,
        levelCount: clashes.reduce((sum, clash) => sum + clash.levels.length, 0),
        enemyCount: clashes.reduce((sum, clash) => sum + clash.levels.reduce((levelSum, level) => levelSum + level.enemies.length, 0), 0),
        missionCount: clashes.reduce((sum, clash) => sum + clash.missions.length, 0),
        failedClashIds: failedClashIds.length ? failedClashIds.sort(compareIds) : undefined,
        clashes,
    }) as DokkanInfoUltimateClashDataset;
}

export async function writeDokkanInfoUltimateClashes(dataset?: DokkanInfoUltimateClashDataset): Promise<string> {
    const outputPath = resolve(__dirname, OUTPUT_DIR, OUTPUT_FILE);
    await mkdir(resolve(__dirname, OUTPUT_DIR), { recursive: true });
    await writeFormattedJson(outputPath, dataset ?? await getDokkanInfoUltimateClashes());
    return outputPath;
}

export function mapUltimateClashIndexPage(document: Document): ClashIndexPage {
    assertUsablePage(document, "Ultimate Clash index");
    const payload = parseJsonAttribute<RawClashPage>(
        document.querySelector("rm-battles")?.getAttribute("v-bind:rmbattles_json"),
        "Ultimate Clash index payload",
    );
    const page = requiredNumber(payload.current_page, "Ultimate Clash current page");
    return {
        page,
        lastPage: requiredNumber(payload.last_page, "Ultimate Clash last page"),
        total: requiredNumber(payload.total, "Ultimate Clash total"),
        clashes: (payload.data ?? []).map(mapClashSummary),
    };
}

export function mapUltimateClashDetail(document: Document, summary: DokkanInfoUltimateClash): DokkanInfoUltimateClash {
    assertUsablePage(document, `Ultimate Clash ${summary.id}`);
    const timestamps = Array.from(document.querySelectorAll("unix-to-date"))
        .map(element => requiredNumber(element.getAttribute("timestamp") ?? element.getAttribute("v-bind:timestamp"), `Ultimate Clash ${summary.id} timestamp`));
    if (timestamps.length >= 2 && (timestamps[0] !== summary.startAt || timestamps[1] !== summary.endAt)) {
        throw new Error(`Ultimate Clash ${summary.id} schedule differs between index and detail.`);
    }
    const levels = mapClashLevels(document, summary.id);
    const missions = Array.from(document.querySelectorAll("mission[v-bind\\:mission]"))
        .map(element => mapClashMission(element, summary.id))
        .sort((left, right) => right.priority - left.priority || compareIds(left.id, right.id));
    if (!levels.length) throw new Error(`Ultimate Clash ${summary.id} exposed no battle levels.`);
    return withoutUndefined({
        ...summary,
        title: stripDokkanInfoTitle(document) || `Ultimate Clash ${summary.id}`,
        bannerPath: absoluteOptionalUrl(document.querySelector<HTMLImageElement>('img[src*="/ingame/news/"]')?.getAttribute("src")) ?? summary.bannerPath,
        missionRewardBannerPath: absoluteOptionalUrl(document.querySelector<HTMLImageElement>('img[src*="/ingame/rmbattles/"]')?.getAttribute("src")) ?? summary.missionRewardBannerPath,
        levels,
        missions,
    });
}

function mapClashLevels(document: Document, clashId: string): DokkanInfoUltimateClashLevel[] {
    const firstCard = document.querySelector("card-icon[v-bind\\:card]");
    const root = firstCard?.closest(".col-sm.bg-main");
    if (!root) return [];
    const levels: DokkanInfoUltimateClashLevel[] = [];
    let current: DokkanInfoUltimateClashLevel | undefined;
    for (const child of Array.from(root.children)) {
        if (child.classList.contains("border-bottom") && child.classList.contains("bg-third")) {
            const levelImage = Array.from(child.querySelectorAll<HTMLImageElement>("img[alt]"))
                .find(image => /^\d+$/.test(cleanText(image.getAttribute("alt"))));
            const level = requiredNumber(levelImage?.getAttribute("alt"), `Ultimate Clash ${clashId} level`);
            current = {
                level,
                headerImagePath: absoluteOptionalUrl(levelImage?.getAttribute("src")),
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

function mapClashEnemy(row: Element, level: number, clashId: string, sequence: number): DokkanInfoUltimateClashEnemy {
    const cardElement = row.querySelector("card-icon[v-bind\\:card]");
    const card = mapCardElement(cardElement, `Ultimate Clash ${clashId} level ${level}`);
    const battleRow = cardElement?.closest(".row.padding-top-bottom-10.align-items-center");
    const columns = battleRow ? Array.from(battleRow.children) : [];
    const statsColumn = columns.find(column => column.classList.contains("col-sm-2"));
    const mechanicsColumn = columns.find(column => column.classList.contains("col-sm-8"));
    const statLines = labelledLines(statsColumn);
    const fields = new Map(statLines.map(value => [value.label, value.value]));
    const topColumns = Array.from(row.children);
    const displayLabel = topColumns[0]?.querySelector<HTMLImageElement>('img[src]');
    const displayLabelPath = displayLabel?.getAttribute("src");
    return withoutUndefined({
        sequence,
        displayLabelKind: displayLabelPath?.includes("dai_boss_label") ? "boss" : displayLabelPath ? "number" : undefined,
        displayLabelRaw: cleanText(displayLabel?.getAttribute("alt")) || undefined,
        displayLabelImagePath: absoluteOptionalUrl(displayLabelPath),
        card,
        healthBars: optionalNumber(fields.get("Health Bars")),
        hp: optionalNumber(fields.get("HP")),
        atk: optionalNumber(fields.get("ATK")),
        def: optionalNumber(fields.get("DEF")),
        damageReductionPercent: optionalNumber(fields.get("DR")),
        superAttackStats: statLines.filter(value => !["Health Bars", "HP", "ATK", "DEF", "DR"].includes(value.label)),
        mechanics: mapMechanics(mechanicsColumn),
        rewards: mapVisualRewards(topColumns[2]),
    });
}

function mapMechanics(element: Element | undefined): DokkanInfoUltimateClashMechanic[] {
    if (!element) return [];
    return Array.from(element.children)
        .filter(child => child.classList.contains("row"))
        .map((row, index) => {
            const columns = Array.from(row.children);
            const text = cleanText(columns[0]?.textContent) || undefined;
            const values = cleanText(columns.slice(1).map(column => column.textContent).join(" ")) || undefined;
            return withoutUndefined({
                sequence: index + 1,
                text,
                values,
                icons: Array.from(row.querySelectorAll<HTMLImageElement>("img[src]")).map(image => withoutUndefined({
                    alt: cleanText(image.getAttribute("alt")) || undefined,
                    path: absoluteUrl(image.getAttribute("src")),
                })),
            });
        })
        .filter(value => value.text || value.values || value.icons.length);
}

function mapVisualRewards(element: Element | undefined): DokkanInfoVisualReward[] {
    if (!element) return [];
    const images = Array.from(element.querySelectorAll<HTMLImageElement>("img[src]"));
    return images.map(image => {
        let container: Element | null = image.parentElement;
        while (container && container.parentElement !== element && !/\bx\s*[\d,]+\b/i.test(cleanText(container.textContent))) {
            container = container.parentElement;
        }
        return withoutUndefined({
            quantity: optionalNumber(cleanText(container?.textContent).match(/\bx\s*([\d,]+)/i)?.[1]),
            label: cleanText(image.getAttribute("alt")) || undefined,
            imagePath: absoluteUrl(image.getAttribute("src")),
        });
    });
}

function mapClashMission(element: Element, clashId: string): DokkanInfoUltimateClashMission {
    const raw = parseJsonAttribute<RawMission>(element.getAttribute("v-bind:mission"), `Ultimate Clash ${clashId} mission`);
    const id = toId(raw.id, `Ultimate Clash ${clashId} mission ID`);
    const rewardValues = Array.isArray(raw.mission_rewards)
        ? raw.mission_rewards
        : Object.values(raw.mission_rewards ?? {});
    return {
        id,
        type: cleanText(raw.type) || "unknown",
        name: cleanText(raw.name) || `Mission ${id}`,
        description: cleanText(raw.description),
        priority: optionalNumber(raw.priority) ?? 0,
        targetValue: optionalNumber(raw.target_value) ?? 0,
        conditions: parseConditions(raw.conditions),
        rewards: rewardValues.map(mapMissionReward).sort((left, right) => compareIds(left.id ?? "", right.id ?? "")),
    };
}

function mapMissionReward(raw: RawMissionReward): DokkanInfoSpecialReward {
    return withoutUndefined({
        id: raw.id === undefined ? undefined : String(raw.id),
        itemId: raw.item_id === undefined ? undefined : String(raw.item_id),
        itemType: cleanText(raw.item_type) || "unknown",
        quantity: optionalNumber(raw.quantity) ?? 0,
        description: cleanText(raw.description) || undefined,
        giftDescription: cleanText(raw.gift_description) || undefined,
    });
}

function mapCardElement(element: Element | null | undefined, label: string): DokkanInfoSpecialCardReference {
    const raw = parseJsonAttribute<RawCard>(element?.getAttribute("v-bind:card"), `${label} enemy card`);
    const id = toId(raw.id, `${label} enemy card ID`);
    const iconId = raw.icon_id === undefined ? undefined : String(raw.icon_id);
    return withoutUndefined({
        id,
        name: cleanText(raw.name) || undefined,
        elementRaw: raw.element === undefined ? undefined : String(raw.element),
        rarityRaw: optionalNumber(raw.rarity),
        iconId,
        resourceId: raw.resource_id === null || raw.resource_id === undefined ? undefined : String(raw.resource_id),
        sourcePath: `${DOKKAN_INFO_BASE_URL}/cards/${id}`,
        portraitPath: iconId ? `${DOKKAN_INFO_BASE_URL}/assets/global/en/character/thumb/card_${iconId}_thumb/card_${iconId}_thumb.png` : undefined,
    });
}

function labelledLines(element: Element | undefined): DokkanInfoLabelledValue[] {
    if (!element) return [];
    return Array.from(element.children)
        .filter(child => child.classList.contains("row"))
        .map((row): DokkanInfoLabelledValue | undefined => {
            const heading = row.querySelector("b");
            const label = cleanText(heading?.textContent).replace(/:$/, "");
            if (!label) return undefined;
            const text = cleanText(row.textContent);
            const value = cleanText(text.slice(cleanText(heading?.textContent).length)).replace(/^:\s*/, "") || undefined;
            return withoutUndefined({ label, value }) as DokkanInfoLabelledValue;
        })
        .filter((value): value is DokkanInfoLabelledValue => Boolean(value));
}

function parseConditions(value: RawMission["conditions"]): Record<string, unknown> {
    if (value && typeof value === "object") return value;
    if (!value) return {};
    try {
        const parsed = JSON.parse(String(value));
        return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : { value: parsed };
    } catch {
        return { raw: String(value) };
    }
}

function mapClashSummary(raw: RawClash): DokkanInfoUltimateClash {
    const id = toId(raw.id, "Ultimate Clash ID");
    return withoutUndefined({
        id,
        title: `Ultimate Clash ${id}`,
        sourcePath: `${INDEX_URL}/${id}`,
        startAt: requiredNumber(raw.start_at, `Ultimate Clash ${id} start`),
        endAt: requiredNumber(raw.end_at, `Ultimate Clash ${id} end`),
        cardCountLimit: requiredNumber(raw.card_count_limit, `Ultimate Clash ${id} card limit`),
        announcementId: raw.announcement_id === undefined ? undefined : String(raw.announcement_id),
        bannerFileName: cleanText(raw.banner_image) || undefined,
        missionRewardBannerFileName: cleanText(raw.mission_reward_image) || undefined,
        levels: [],
        missions: [],
    });
}

async function fetchClashIndexPage(page: number): Promise<ClashIndexPage> {
    const path = `index/page-${page}.json`;
    const cached = await readSpecialCache<ClashIndexPage>(CACHE_DIR, ENV_PREFIX, path);
    if (cached) return cached;
    await delay(requestedDelayMs(ENV_PREFIX));
    const value = mapUltimateClashIndexPage(await fetchFromWeb(`${INDEX_URL}?page=${page}`));
    if (value.page !== page) throw new Error(`Ultimate Clash requested page ${page} but received page ${value.page}.`);
    await writeSpecialCache(CACHE_DIR, path, value);
    return value;
}

async function fetchClashDetail(summary: DokkanInfoUltimateClash): Promise<DokkanInfoUltimateClash> {
    const path = `clashes/${summary.id}.json`;
    const cached = await readSpecialCache<DokkanInfoUltimateClash>(CACHE_DIR, ENV_PREFIX, path);
    if (cached) return cached;
    await delay(requestedDelayMs(ENV_PREFIX));
    const value = mapUltimateClashDetail(await fetchFromWeb(summary.sourcePath), summary);
    await writeSpecialCache(CACHE_DIR, path, value);
    return value;
}

function errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}
