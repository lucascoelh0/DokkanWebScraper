import { mkdir } from "fs/promises";
import { resolve } from "path";
import { JSDOM } from "jsdom";
import { writeFormattedJson } from "./format-json";
import {
    delay,
    readSpecialCache,
    requestedDelayMs,
    writeSpecialCache,
} from "./dokkaninfo-special-events-common";

const BASE_URL = "https://dokkanstats.com";
const ASSET_BASE_URL = "https://assets.dokkanstats.com/assets/global/en/";
const ENV_PREFIX = "DOKKANSTATS_SUPPORT_MEMORIES";
const CACHE_DIR = "data/dokkanstats-support-memories/cache";
const OUTPUT_PATH = "data/dokkanstats-support-memories/latest/support-memories.json";

interface RawSupportMemory {
    id: number,
    name?: string | null,
    description?: string | null,
    max_exec_count?: number | null,
    priority?: number | null,
    support_film_id?: number | null,
    cost?: number | null,
    unlock_quantity?: number | null,
    script_name?: string | null,
    open_at?: string | null,
    close_at?: string | null,
    is_base?: boolean | null,
    enhanced_versions?: RawEnhancedSupportMemory[] | null,
}

interface RawEnhancedSupportMemory {
    id: number,
    level: number,
    name?: string | null,
    description?: string | null,
    cost?: number | null,
}

interface RawMissionSource {
    kind: "mission",
    mission_id: number,
    mission?: string | null,
    category?: string | null,
    image?: string | null,
    category_id: number,
    category_type?: string | null,
    sort_at?: string | null,
    end_at?: string | null,
    area_id?: number | null,
    z_battle_stage_id?: number | null,
    quantity: number,
    url?: string | null,
}

interface RawStageDropSource {
    kind: "stage_drop",
    area_id: number,
    area?: string | null,
    quest_id: number,
    quest?: string | null,
    difficulty: number,
    smap_id: number,
    drop_type: number,
    route?: string | null,
    image?: string | null,
    sort_at?: string | null,
    end_at?: string | null,
    url?: string | null,
}

type RawAcquisitionSource = RawMissionSource | RawStageDropSource;

export interface DokkanStatsSupportMemoryDataset {
    schemaVersion: 1,
    contract: "dokkanstats-support-memory-enrichment",
    contractVersion: "1.0.0",
    generatedAt: string,
    source: "dokkanstats.com",
    rootMemoryCount: number,
    memoryLevelCount: number,
    acquisitionMemoryCount: number,
    acquisitionSourceCount: number,
    missionSourceCount: number,
    stageDropSourceCount: number,
    entries: DokkanStatsSupportMemoryEntry[],
}

export interface DokkanStatsSupportMemoryEntry {
    id: string,
    name: string,
    description?: string,
    supportFilmId?: string,
    cost?: number,
    unlockQuantity?: number,
    maxExecCount?: number,
    priority?: number,
    scriptName?: string,
    opensAt?: string,
    closesAt?: string,
    maxLevel: number,
    levels: DokkanStatsSupportMemoryLevel[],
    acquisitionSources: DokkanStatsSupportMemoryAcquisitionSource[],
    sourceUrl: string,
}

export interface DokkanStatsSupportMemoryLevel {
    level: number,
    memoryId: string,
    name: string,
    description?: string,
    cost?: number,
}

export type DokkanStatsSupportMemoryAcquisitionSource =
    | DokkanStatsSupportMemoryMissionSource
    | DokkanStatsSupportMemoryStageDropSource;

export interface DokkanStatsSupportMemoryMissionSource {
    key: string,
    kind: "mission",
    missionId: string,
    title: string,
    categoryId: string,
    categoryTitle?: string,
    categoryType?: string,
    quantity: number,
    imageUrl?: string,
    areaId?: string,
    zBattleStageId?: string,
    startsAt?: string,
    endsAt?: string,
    sourceUrl?: string,
}

export interface DokkanStatsSupportMemoryStageDropSource {
    key: string,
    kind: "stage-drop",
    areaId: string,
    areaTitle: string,
    questId: string,
    questTitle: string,
    difficulty: number,
    mapId: string,
    dropType: number,
    route?: string,
    imageUrl?: string,
    startsAt?: string,
    endsAt?: string,
    sourceUrl?: string,
}

export async function getDokkanStatsSupportMemoryDataset(): Promise<DokkanStatsSupportMemoryDataset> {
    const catalog = await getCatalog();
    const entries: DokkanStatsSupportMemoryEntry[] = [];
    const wait = requestedDelayMs(ENV_PREFIX, 500);

    for (const [index, catalogEntry] of [...catalog.values()].entries()) {
        if (index > 0) await delay(wait);
        entries.push(await getDetail(catalogEntry));
    }

    return buildDokkanStatsSupportMemoryDataset(entries);
}

export async function writeDokkanStatsSupportMemoryDataset(
    dataset?: DokkanStatsSupportMemoryDataset,
): Promise<{ outputPath: string, dataset: DokkanStatsSupportMemoryDataset }> {
    const value = dataset ?? await getDokkanStatsSupportMemoryDataset();
    const outputPath = resolve(process.cwd(), OUTPUT_PATH);
    await mkdir(resolve(outputPath, ".."), { recursive: true });
    await writeFormattedJson(outputPath, value);
    return { outputPath, dataset: value };
}

export function buildDokkanStatsSupportMemoryDataset(
    entries: DokkanStatsSupportMemoryEntry[],
    generatedAt = new Date().toISOString(),
): DokkanStatsSupportMemoryDataset {
    assertUnique(entries, value => value.id, "DokkanStats Support Memory");
    const sorted = [...entries].sort((left, right) => compareIds(left.id, right.id));
    for (const entry of sorted) {
        if (entry.levels.length !== entry.maxLevel) {
            throw new Error(`DokkanStats Support Memory ${entry.id} level count does not match maxLevel.`);
        }
        assertUnique(entry.levels, value => value.memoryId, `DokkanStats Support Memory ${entry.id} level`);
        assertUnique(entry.acquisitionSources, value => value.key, `DokkanStats Support Memory ${entry.id} acquisition source`);
    }
    const sources = sorted.flatMap(value => value.acquisitionSources);
    return {
        schemaVersion: 1,
        contract: "dokkanstats-support-memory-enrichment",
        contractVersion: "1.0.0",
        generatedAt,
        source: "dokkanstats.com",
        rootMemoryCount: sorted.length,
        memoryLevelCount: sorted.reduce((sum, value) => sum + value.levels.length, 0),
        acquisitionMemoryCount: sorted.filter(value => value.acquisitionSources.length > 0).length,
        acquisitionSourceCount: sources.length,
        missionSourceCount: sources.filter(value => value.kind === "mission").length,
        stageDropSourceCount: sources.filter(value => value.kind === "stage-drop").length,
        entries: sorted,
    };
}

export function parseDokkanStatsSupportMemoryCatalog(html: string): Map<string, DokkanStatsSupportMemoryEntry> {
    const script = payloadScript(html, "DokkanStats Support Memory catalog");
    const category = extractJsonValue<string>(script, "const category = ", ";\nconst skinCardMap", "Support Memory category");
    if (category !== "support-memories") throw new Error(`Unexpected DokkanStats item category: ${category}`);
    const items = extractJsonValue<RawSupportMemory[]>(script, "const items = ", ";\nconst category", "Support Memory items");
    assertUnique(items, value => requiredId(value.id, "DokkanStats Support Memory item ID"), "DokkanStats Support Memory item");

    const roots = items.filter(value => value.is_base === true).map(mapCatalogEntry);
    const allIds = new Set(items.map(value => requiredId(value.id, "DokkanStats Support Memory item ID")));
    const projectedIds = roots.flatMap(value => value.levels.map(level => level.memoryId));
    assertUnique(projectedIds, value => value, "DokkanStats Support Memory projected level");
    if (projectedIds.length !== items.length || projectedIds.some(id => !allIds.has(id))) {
        throw new Error("DokkanStats Support Memory roots and enhanced levels do not cover the catalog exactly.");
    }
    return new Map(roots.sort((left, right) => compareIds(left.id, right.id)).map(value => [value.id, value]));
}

export function parseDokkanStatsSupportMemoryDetail(
    html: string,
    catalogEntry: DokkanStatsSupportMemoryEntry,
): DokkanStatsSupportMemoryEntry {
    const script = payloadScript(html, `DokkanStats Support Memory ${catalogEntry.id}`);
    const item = extractJsonValue<RawSupportMemory>(script, "const item = ", ";\nconst category", `Support Memory ${catalogEntry.id} item`);
    const category = extractJsonValue<string>(script, "const category = ", ";\nconst sources", `Support Memory ${catalogEntry.id} category`);
    if (category !== "support-memories") throw new Error(`Unexpected DokkanStats item category: ${category}`);
    const detailEntry = mapCatalogEntry(item);
    if (JSON.stringify(withoutAcquisition(detailEntry)) !== JSON.stringify(withoutAcquisition(catalogEntry))) {
        throw new Error(`DokkanStats Support Memory ${catalogEntry.id} detail does not match the catalog.`);
    }
    const rawSources = extractJsonValue<RawAcquisitionSource[] | null>(
        script,
        "const sources = ",
        ";\nconst usage",
        `Support Memory ${catalogEntry.id} acquisition sources`,
    );
    if (rawSources !== null && !Array.isArray(rawSources)) {
        throw new Error(`DokkanStats Support Memory ${catalogEntry.id} acquisition sources are invalid.`);
    }
    const acquisitionSources = (rawSources ?? []).map((source, index) => mapAcquisitionSource(source, catalogEntry.id, index));
    assertUnique(acquisitionSources, value => value.key, `DokkanStats Support Memory ${catalogEntry.id} acquisition source`);
    return { ...catalogEntry, acquisitionSources };
}

function mapCatalogEntry(item: RawSupportMemory): DokkanStatsSupportMemoryEntry {
    const id = requiredId(item.id, "DokkanStats Support Memory ID");
    if (item.is_base !== true) throw new Error(`DokkanStats Support Memory ${id} is not a root memory.`);
    const rootLevel: DokkanStatsSupportMemoryLevel = {
        level: 1,
        memoryId: id,
        name: requiredText(item.name, `DokkanStats Support Memory ${id} name`),
        description: optionalMultilineText(item.description),
        cost: optionalNonNegativeInt(item.cost, `DokkanStats Support Memory ${id} cost`),
    };
    const enhanced = (item.enhanced_versions ?? []).map(value => ({
        level: requiredPositiveInt(value.level, `DokkanStats Support Memory ${id} enhanced level`),
        memoryId: requiredId(value.id, `DokkanStats Support Memory ${id} enhanced ID`),
        name: requiredText(value.name, `DokkanStats Support Memory ${id} enhanced name`),
        description: optionalMultilineText(value.description),
        cost: optionalNonNegativeInt(value.cost, `DokkanStats Support Memory ${id} enhanced cost`),
    })).sort((left, right) => left.level - right.level);
    const levels = [rootLevel, ...enhanced];
    levels.forEach((value, index) => {
        if (value.level !== index + 1) throw new Error(`DokkanStats Support Memory ${id} has a non-contiguous enhancement chain.`);
    });
    return {
        id,
        name: rootLevel.name,
        description: rootLevel.description,
        supportFilmId: optionalId(item.support_film_id, `DokkanStats Support Memory ${id} film ID`),
        cost: rootLevel.cost,
        unlockQuantity: optionalPositiveInt(item.unlock_quantity, `DokkanStats Support Memory ${id} unlock quantity`),
        maxExecCount: optionalPositiveInt(item.max_exec_count, `DokkanStats Support Memory ${id} max execution count`),
        priority: optionalNonNegativeInt(item.priority, `DokkanStats Support Memory ${id} priority`),
        scriptName: optionalText(item.script_name),
        opensAt: optionalText(item.open_at),
        closesAt: optionalText(item.close_at),
        maxLevel: levels.length,
        levels,
        acquisitionSources: [],
        sourceUrl: `${BASE_URL}/en/items/support-memories/${id}/`,
    };
}

function mapAcquisitionSource(
    source: RawAcquisitionSource,
    memoryId: string,
    index: number,
): DokkanStatsSupportMemoryAcquisitionSource {
    if (!source || typeof source !== "object") {
        throw new Error(`DokkanStats Support Memory ${memoryId} acquisition source ${index + 1} is invalid.`);
    }
    if (source.kind === "mission") {
        const missionId = requiredId(source.mission_id, `DokkanStats Support Memory ${memoryId} mission ID`);
        const categoryId = requiredId(source.category_id, `DokkanStats Support Memory ${memoryId} mission category ID`);
        return {
            key: `mission:${missionId}`,
            kind: "mission",
            missionId,
            title: requiredText(source.mission, `DokkanStats Support Memory ${memoryId} mission title`),
            categoryId,
            categoryTitle: optionalText(source.category),
            categoryType: optionalText(source.category_type),
            quantity: requiredPositiveInt(source.quantity, `DokkanStats Support Memory ${memoryId} mission quantity`),
            imageUrl: assetOptionalUrl(source.image),
            areaId: optionalId(source.area_id, `DokkanStats Support Memory ${memoryId} mission area ID`),
            zBattleStageId: optionalId(source.z_battle_stage_id, `DokkanStats Support Memory ${memoryId} mission Z-Battle ID`),
            startsAt: optionalText(source.sort_at),
            endsAt: optionalText(source.end_at),
            sourceUrl: absoluteOptionalUrl(source.url),
        };
    }
    if (source.kind === "stage_drop") {
        const mapId = requiredId(source.smap_id, `DokkanStats Support Memory ${memoryId} stage map ID`);
        return {
            key: `stage-drop:${mapId}:${requiredNonNegativeInt(source.drop_type, `DokkanStats Support Memory ${memoryId} drop type`)}`,
            kind: "stage-drop",
            areaId: requiredId(source.area_id, `DokkanStats Support Memory ${memoryId} stage area ID`),
            areaTitle: requiredText(source.area, `DokkanStats Support Memory ${memoryId} stage area title`),
            questId: requiredId(source.quest_id, `DokkanStats Support Memory ${memoryId} stage quest ID`),
            questTitle: requiredText(source.quest, `DokkanStats Support Memory ${memoryId} stage quest title`),
            difficulty: requiredNonNegativeInt(source.difficulty, `DokkanStats Support Memory ${memoryId} stage difficulty`),
            mapId,
            dropType: requiredNonNegativeInt(source.drop_type, `DokkanStats Support Memory ${memoryId} drop type`),
            route: optionalText(source.route),
            imageUrl: assetOptionalUrl(source.image),
            startsAt: optionalText(source.sort_at),
            endsAt: optionalText(source.end_at),
            sourceUrl: absoluteOptionalUrl(source.url),
        };
    }
    throw new Error(`DokkanStats Support Memory ${memoryId} has unsupported acquisition source kind: ${String((source as { kind?: unknown }).kind)}`);
}

async function getCatalog(): Promise<Map<string, DokkanStatsSupportMemoryEntry>> {
    const path = "catalog.json";
    const cached = await readSpecialCache<DokkanStatsSupportMemoryEntry[]>(CACHE_DIR, ENV_PREFIX, path);
    if (cached) return new Map(cached.map(value => [value.id, value]));
    const value = parseDokkanStatsSupportMemoryCatalog(await fetchHtml(`${BASE_URL}/en/items/support-memories/`, "Support Memory catalog"));
    await writeSpecialCache(CACHE_DIR, path, [...value.values()]);
    return value;
}

async function getDetail(catalogEntry: DokkanStatsSupportMemoryEntry): Promise<DokkanStatsSupportMemoryEntry> {
    const path = `details/${catalogEntry.id}.json`;
    const cached = await readSpecialCache<DokkanStatsSupportMemoryEntry>(CACHE_DIR, ENV_PREFIX, path);
    if (cached) {
        if (JSON.stringify(withoutAcquisition(cached)) !== JSON.stringify(withoutAcquisition(catalogEntry))) {
            throw new Error(`Cached DokkanStats Support Memory ${catalogEntry.id} does not match the catalog.`);
        }
        return cached;
    }
    const value = parseDokkanStatsSupportMemoryDetail(
        await fetchHtml(catalogEntry.sourceUrl, `Support Memory ${catalogEntry.id}`),
        catalogEntry,
    );
    await writeSpecialCache(CACHE_DIR, path, value);
    return value;
}

async function fetchHtml(url: string, label: string): Promise<string> {
    const response = await fetch(url, { headers: browserHeaders(), redirect: "error" });
    if (!response.ok) throw new Error(`Could not fetch DokkanStats ${label}: ${response.status}`);
    const html = await response.text();
    if (html.length < 1_000) throw new Error(`DokkanStats ${label} returned an unexpectedly small page.`);
    return html;
}

function payloadScript(html: string, label: string): string {
    const document: Document = new JSDOM(html).window.document;
    const body = cleanText(document.body?.textContent);
    if (!body || /Sorry, you have been blocked/i.test(body)) throw new Error(`${label} is unavailable or blocked.`);
    const script = Array.from(document.scripts).map(value => value.textContent ?? "")
        .find(value => value.includes("window.__ITEMS_DATA__") || value.includes("window.__ITEM__"));
    if (!script) throw new Error(`${label} payload is missing.`);
    return script;
}

function extractJsonValue<T>(script: string, prefix: string, suffix: string, label: string): T {
    const start = script.indexOf(prefix);
    if (start < 0) throw new Error(`DokkanStats ${label} prefix is missing.`);
    const valueStart = start + prefix.length;
    const end = script.indexOf(suffix, valueStart);
    if (end < 0) throw new Error(`DokkanStats ${label} suffix is missing.`);
    try {
        return JSON.parse(script.slice(valueStart, end)) as T;
    } catch {
        throw new Error(`DokkanStats ${label} is invalid JSON.`);
    }
}

function withoutAcquisition(entry: DokkanStatsSupportMemoryEntry): unknown {
    const { acquisitionSources: _sources, ...identity } = entry;
    return identity;
}

function absoluteOptionalUrl(value: unknown): string | undefined {
    const normalized = optionalText(value);
    return normalized ? new URL(normalized, `${BASE_URL}/`).toString() : undefined;
}

function assetOptionalUrl(value: unknown): string | undefined {
    const normalized = optionalText(value);
    return normalized ? new URL(normalized, ASSET_BASE_URL).toString() : undefined;
}

function browserHeaders(): Record<string, string> {
    return {
        "User-Agent": "DokkanpanionDataPipeline/1.0 (+authorized DokkanStats enrichment)",
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9",
    };
}

function cleanText(value: unknown): string {
    return String(value ?? "").replace(/\s+/g, " ").trim();
}

function optionalText(value: unknown): string | undefined {
    return cleanText(value) || undefined;
}

function optionalMultilineText(value: unknown): string | undefined {
    const normalized = String(value ?? "").replace(/\r\n/g, "\n").replace(/[ \t]+\n/g, "\n").trim();
    return normalized || undefined;
}

function requiredText(value: unknown, label: string): string {
    const normalized = cleanText(value);
    if (!normalized) throw new Error(`${label} is missing.`);
    return normalized;
}

function requiredId(value: unknown, label: string): string {
    const normalized = cleanText(value);
    if (!/^\d+$/.test(normalized)) throw new Error(`${label} is missing or invalid.`);
    return normalized;
}

function optionalId(value: unknown, label: string): string | undefined {
    if (value === null || value === undefined || cleanText(value) === "") return undefined;
    return requiredId(value, label);
}

function requiredPositiveInt(value: unknown, label: string): number {
    const parsed = Number(cleanText(value).replace(/,/g, ""));
    if (!Number.isInteger(parsed) || parsed <= 0) throw new Error(`${label} is missing or invalid.`);
    return parsed;
}

function optionalPositiveInt(value: unknown, label: string): number | undefined {
    if (value === null || value === undefined || cleanText(value) === "") return undefined;
    return requiredPositiveInt(value, label);
}

function requiredNonNegativeInt(value: unknown, label: string): number {
    const parsed = Number(cleanText(value).replace(/,/g, ""));
    if (!Number.isInteger(parsed) || parsed < 0) throw new Error(`${label} is missing or invalid.`);
    return parsed;
}

function optionalNonNegativeInt(value: unknown, label: string): number | undefined {
    if (value === null || value === undefined || cleanText(value) === "") return undefined;
    return requiredNonNegativeInt(value, label);
}

function compareIds(left: string, right: string): number {
    return left.localeCompare(right, "en", { numeric: true });
}

function assertUnique<T>(values: T[], key: (value: T) => string, label: string): void {
    const seen = new Set<string>();
    values.forEach(value => {
        const id = key(value);
        if (seen.has(id)) throw new Error(`${label} ${id} is duplicated.`);
        seen.add(id);
    });
}
