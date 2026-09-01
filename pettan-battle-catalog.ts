import { createHash } from "crypto";
import { createReadStream } from "fs";
import { mkdir, readFile, rename, stat, writeFile } from "fs/promises";
import { basename, resolve } from "path";
import { runEventsSqliteBridge } from "./database-events/events-sqlite-adapter";
import { writeFormattedJson } from "./format-json";
import {
    DokkanInfoPettanSeriesSummary,
    DokkanInfoPettanStickerVisual,
    PettanBattleAudit,
    PettanBattleDataset,
    PettanBattleOfficialPayload,
    PettanBattleOfficialStickerRow,
    PettanBattleSeries,
    PettanBattleSticker,
} from "./pettan-battle";
import { fetchFromWeb } from "./scraper";

const DOKKAN_INFO_BASE_URL = "https://dokkaninfo.com";
const INDEX_URL = `${DOKKAN_INFO_BASE_URL}/events/sdbattle`;
const DEFAULT_DATABASE = "D:/Dokkan/database/decrypted/dokkan-global-current.db";
const CACHE_DIR = "data/pettan-battle/cache";
const OUTPUT_DIR = "data/pettan-battle/latest";
const OUTPUT_FILE = "pettan-battle.json";
const CACHE_SCHEMA_VERSION = "2.0.0";
const DEFAULT_CACHE_TTL_HOURS = 168;
const DEFAULT_CONCURRENCY = 3;
const DEFAULT_DELAY_MS = 150;

interface CachedValue<T> {
    schemaVersion: string,
    fetchedAt: string,
    value: T,
}

interface SourceFingerprint {
    sha256: string,
    sizeBytes: number,
}

export async function getPettanBattleCatalog(options: { databasePath?: string } = {}): Promise<PettanBattleDataset> {
    const databasePath = resolve(options.databasePath ?? process.env.PETTAN_BATTLE_DATABASE ?? DEFAULT_DATABASE);
    const before = await fingerprint(databasePath);
    const official = await runEventsSqliteBridge<PettanBattleOfficialPayload>("pettan", databasePath);
    const summaries = await fetchPettanIndex();
    let completed = 0;
    const visualSeries = await mapWithConcurrency(summaries, requestedConcurrency(), async summary => {
        await delay(requestedDelayMs());
        const stickers = await fetchPettanSeries(summary);
        completed += 1;
        console.log(`[PETTAN-BATTLE] Series ${completed}/${summaries.length}: ${summary.id} (${stickers.length} stickers)`);
        return { summary, stickers };
    });
    const after = await fingerprint(databasePath);
    if (before.sha256 !== after.sha256 || before.sizeBytes !== after.sizeBytes) {
        throw new Error("Pettan Battle source database changed during collection.");
    }

    return buildPettanBattleDataset(official.stickers, visualSeries, {
        fileName: basename(databasePath),
        ...before,
    });
}

export async function writePettanBattleCatalog(dataset?: PettanBattleDataset): Promise<string> {
    const outputDirectory = resolve(__dirname, OUTPUT_DIR);
    const outputPath = resolve(outputDirectory, OUTPUT_FILE);
    await mkdir(outputDirectory, { recursive: true });
    await writeFormattedJson(outputPath, dataset ?? await getPettanBattleCatalog());
    return outputPath;
}

export function mapPettanBattleIndex(document: Document): DokkanInfoPettanSeriesSummary[] {
    assertUsablePage(document);
    const summaries = Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href*="/events/sdbattle/"]'))
        .map((anchor): DokkanInfoPettanSeriesSummary | undefined => {
            const sourcePath = absoluteUrl(anchor.getAttribute("href"));
            const id = sourcePath.match(/\/events\/sdbattle\/(\d+)$/)?.[1];
            if (!id) return undefined;
            const name = cleanText(anchor.querySelector(".sd-series-text")?.textContent) || `Series ${id}`;
            const advertisedStickerCount = requiredNumber(anchor.querySelector(".sd-total")?.textContent, `Pettan series ${id} sticker count`);
            return {
                id,
                name,
                sourcePath,
                binderImagePath: absoluteOptionalUrl(anchor.querySelector<HTMLImageElement>(".sd-binder img")?.getAttribute("src")),
                advertisedStickerCount,
            };
        })
        .filter((summary): summary is DokkanInfoPettanSeriesSummary => Boolean(summary));
    const unique = [...new Map(summaries.map(summary => [summary.id, summary])).values()]
        .sort((left, right) => Number(left.id) - Number(right.id));
    if (!unique.length) throw new Error("DokkanInfo Pettan Battle index exposed no series.");
    return unique;
}

export function mapPettanBattleSeries(
    document: Document,
    summary: DokkanInfoPettanSeriesSummary,
): DokkanInfoPettanStickerVisual[] {
    assertUsablePage(document);
    const stickers = Array.from(document.querySelectorAll<HTMLElement>(".col-lg"))
        .filter(container => Boolean(container.querySelector(".sd-number") && container.querySelector(".flip-card")))
        .map(container => mapPettanSticker(container, summary));
    const unique = [...new Map(stickers.map(sticker => [sticker.cardId, sticker])).values()]
        .sort((left, right) => left.number - right.number || compareIds(left.cardId, right.cardId));
    if (unique.length !== summary.advertisedStickerCount) {
        throw new Error(`DokkanInfo Pettan series ${summary.id} advertised ${summary.advertisedStickerCount} stickers but exposed ${unique.length}.`);
    }
    return unique;
}

export function buildPettanBattleDataset(
    officialRows: PettanBattleOfficialStickerRow[],
    visualSeries: Array<{ summary: DokkanInfoPettanSeriesSummary, stickers: DokkanInfoPettanStickerVisual[] }>,
    sourceDatabase: { fileName: string, sha256: string, sizeBytes: number },
): PettanBattleDataset {
    const official = officialRows.map(normalizeOfficialSticker)
        .sort((left, right) => left.series - right.series || left.number - right.number || compareIds(left.id, right.id));
    const visuals = visualSeries.flatMap(value => value.stickers);
    const officialById = new Map(official.map(sticker => [sticker.id, sticker]));
    const visualById = new Map(visuals.map(sticker => [sticker.cardId, sticker]));
    const mismatches: PettanBattleAudit["mismatches"] = [];
    const observedPrintedTypeLabels = new Set<string>();

    const stickers: PettanBattleSticker[] = official.map(sticker => {
        const visual = visualById.get(sticker.cardId);
        if (!visual) return sticker;
        compareField(mismatches, sticker.id, "series", sticker.series, visual.series);
        compareField(mismatches, sticker.id, "number", sticker.number, visual.number);
        compareField(mismatches, sticker.id, "attack/displayedPower", sticker.attack, visual.displayedPower);
        compareField(mismatches, sticker.id, "rarityRaw", sticker.rarityRaw, visual.rarityFrameRaw);
        compareField(mismatches, sticker.id, "description", normalizedText(sticker.description), normalizedText(visual.description));
        compareField(mismatches, sticker.id, "availableDate", sticker.availableAt.slice(0, 10), normalizeVisualDate(visual.availableDate));
        compareField(mismatches, sticker.id, "cardName", normalizedText(sticker.cardName), normalizedText(visual.cardName));
        compareField(mismatches, sticker.id, "leaderSkillName", normalizedText(sticker.leaderSkillName), normalizedText(visual.leaderSkillName));
        observedPrintedTypeLabels.add(`${sticker.elementRaw}\u0000${sticker.cardElementRaw}\u0000${visual.printedTypeLabel}`);
        return {
            ...sticker,
            visualSourcePath: visual.sourcePath,
            visual: {
                displayedPower: visual.displayedPower,
                printedTypeLabel: visual.printedTypeLabel,
                rarityFrameRaw: visual.rarityFrameRaw,
                front: visual.front,
                back: visual.back,
            },
        };
    });

    const officialOnlyStickerIds = official.filter(sticker => !visualById.has(sticker.id)).map(sticker => sticker.id);
    const visualOnlyStickerIds = visuals.filter(sticker => !officialById.has(sticker.cardId)).map(sticker => sticker.cardId).sort(compareIds);
    const summariesById = new Map(visualSeries.map(value => [value.summary.id, value.summary]));
    const grouped = new Map<number, PettanBattleSticker[]>();
    for (const sticker of stickers) grouped.set(sticker.series, [...(grouped.get(sticker.series) ?? []), sticker]);
    const series: PettanBattleSeries[] = [...grouped.entries()]
        .sort(([left], [right]) => left - right)
        .map(([id, values]) => {
            const summary = summariesById.get(String(id));
            if (summary) compareField(mismatches, `series:${id}`, "advertisedStickerCount", values.length, summary.advertisedStickerCount);
            return {
                id: String(id),
                name: summary?.name ?? `Series ${id}`,
                sourcePath: summary?.sourcePath ?? `${INDEX_URL}/${id}`,
                binderImagePath: summary?.binderImagePath,
                stickerCount: values.length,
                stickers: values,
            };
        });

    return {
        schemaVersion: "1.0.0",
        generatedAt: new Date().toISOString(),
        sources: {
            catalog: "game-db",
            visuals: "dokkaninfo",
            visualIndexPath: INDEX_URL,
        },
        sourceDatabase: { ...sourceDatabase, readOnly: true },
        seriesCount: series.length,
        stickerCount: official.length,
        visualStickerCount: visuals.length,
        joinedStickerCount: official.length - officialOnlyStickerIds.length,
        audit: {
            officialOnlyStickerIds,
            visualOnlyStickerIds,
            mismatchCount: mismatches.length,
            mismatches,
            observedPrintedTypeLabels: [...observedPrintedTypeLabels]
                .map(value => {
                    const [elementRaw, cardElementRaw, printedTypeLabel] = value.split("\u0000");
                    return { elementRaw: Number(elementRaw), cardElementRaw: Number(cardElementRaw), printedTypeLabel };
                })
                .sort((left, right) => left.elementRaw - right.elementRaw
                    || left.cardElementRaw - right.cardElementRaw
                    || left.printedTypeLabel.localeCompare(right.printedTypeLabel)),
        },
        series,
    };
}

function mapPettanSticker(container: HTMLElement, summary: DokkanInfoPettanSeriesSummary): DokkanInfoPettanStickerVisual {
    const imagePaths = Array.from(container.querySelectorAll<HTMLImageElement>("img"))
        .map(image => absoluteOptionalUrl(image.getAttribute("src")))
        .filter((path): path is string => Boolean(path));
    const cardId = imagePaths.map(path => path.match(/\/sd_card\/(\d+)\//)?.[1]).find(Boolean);
    if (!cardId) throw new Error(`DokkanInfo Pettan series ${summary.id} exposed a sticker without card identity.`);
    const path = (pattern: RegExp, label: string): string => {
        const value = imagePaths.find(candidate => pattern.test(candidate));
        if (!value) throw new Error(`DokkanInfo Pettan sticker ${cardId} omitted ${label}.`);
        return value;
    };
    const optionalPath = (pattern: RegExp): string | undefined => imagePaths.find(candidate => pattern.test(candidate));
    const rarityFramePath = path(/\/sd_card_frame\/sd_card_frame_rarity_\d+\.png$/, "rarity frame");
    const rarityFrameRaw = requiredNumber(rarityFramePath.match(/rarity_(\d+)\.png$/)?.[1], `Pettan sticker ${cardId} rarity`);
    return {
        cardId,
        series: requiredNumber(container.querySelector(".sd-series")?.textContent, `Pettan sticker ${cardId} series`),
        number: requiredNumber(container.querySelector(".sd-number")?.textContent, `Pettan sticker ${cardId} number`),
        displayedPower: requiredNumber(container.querySelector(".icon-power-front")?.textContent, `Pettan sticker ${cardId} power`),
        printedTypeLabel: requiredText(container.querySelector(".icon-type-back")?.textContent, `Pettan sticker ${cardId} printed type label`),
        description: requiredText(container.querySelector(".icon-character-details")?.textContent, `Pettan sticker ${cardId} description`),
        availableDate: requiredText(container.querySelector(".icon-open-date")?.textContent, `Pettan sticker ${cardId} date`),
        cardName: requiredText(container.querySelector(".sd-card-name")?.textContent, `Pettan sticker ${cardId} card name`),
        leaderSkillName: requiredText(container.querySelector(".sd-leader-skill-name")?.textContent, `Pettan sticker ${cardId} leader name`),
        rarityFrameRaw,
        sourcePath: summary.sourcePath,
        front: {
            backgroundPath: path(new RegExp(`/sd_card/${cardId}/sd_card_${cardId}_bg\\.png$`), "front background"),
            characterPath: path(new RegExp(`/sd_card/${cardId}/sd_card_${cardId}\\.png$`), "front character"),
            effectPath: optionalPath(new RegExp(`/sd_card/${cardId}/sd_card_${cardId}_effect\\.png$`)),
            typeFramePath: path(/\/sd_card_frame\/sd_card_frame_type_\d+\.png$/, "type frame"),
            rarityFramePath,
        },
        back: {
            backgroundPath: path(/\/sd_battle\/sdb_seal_back_bg\.png$/, "back background"),
            facePath: path(new RegExp(`/sd_card/${cardId}/sd_card_${cardId}_face\\.png$`), "back face"),
            framePath: path(/\/sd_battle\/sdb_seal_back_face_frame\.png$/, "back frame"),
        },
    };
}

function normalizeOfficialSticker(row: PettanBattleOfficialStickerRow): PettanBattleSticker {
    return {
        id: String(row.id),
        cardId: String(row.card_id),
        series: Number(row.series),
        number: Number(row.number),
        attack: Number(row.attack),
        hp: Number(row.hp),
        elementRaw: Number(row.element),
        cardElementRaw: Number(row.card_element),
        rarityRaw: Number(row.rarity),
        description: normalizedText(row.description),
        availableAt: normalizeOfficialDate(row.open_at),
        cardName: normalizedText(row.card_name),
        leaderSkillName: optionalText(row.leader_skill_name),
    };
}

async function fetchPettanIndex(): Promise<DokkanInfoPettanSeriesSummary[]> {
    const cached = await readCache<DokkanInfoPettanSeriesSummary[]>("index.json");
    if (cached) return cached;
    const value = mapPettanBattleIndex(await fetchFromWeb(INDEX_URL));
    await writeCache("index.json", value);
    return value;
}

async function fetchPettanSeries(summary: DokkanInfoPettanSeriesSummary): Promise<DokkanInfoPettanStickerVisual[]> {
    const cached = await readCache<DokkanInfoPettanStickerVisual[]>(`series/${summary.id}.json`);
    if (cached) return cached;
    const value = mapPettanBattleSeries(await fetchFromWeb(summary.sourcePath), summary);
    await writeCache(`series/${summary.id}.json`, value);
    return value;
}

async function readCache<T>(relativePath: string): Promise<T | undefined> {
    if (refreshRequested()) return undefined;
    try {
        const value = JSON.parse(await readFile(resolve(__dirname, CACHE_DIR, relativePath), "utf8")) as CachedValue<T>;
        const ageMs = Date.now() - Date.parse(value.fetchedAt);
        if (value.schemaVersion !== CACHE_SCHEMA_VERSION || !Number.isFinite(ageMs) || ageMs > cacheTtlHours() * 3_600_000) return undefined;
        return value.value;
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
        throw error;
    }
}

async function writeCache<T>(relativePath: string, value: T): Promise<void> {
    const path = resolve(__dirname, CACHE_DIR, relativePath);
    await mkdir(resolve(path, ".."), { recursive: true });
    const temporary = `${path}.${process.pid}.${Date.now()}.tmp`;
    await writeFile(temporary, JSON.stringify({ schemaVersion: CACHE_SCHEMA_VERSION, fetchedAt: new Date().toISOString(), value }));
    await rename(temporary, path);
}

async function fingerprint(path: string): Promise<SourceFingerprint> {
    const metadata = await stat(path);
    const hash = createHash("sha256");
    await new Promise<void>((done, reject) => {
        const stream = createReadStream(path);
        stream.on("data", chunk => hash.update(chunk));
        stream.on("error", reject);
        stream.on("end", done);
    });
    return { sha256: hash.digest("hex"), sizeBytes: metadata.size };
}

async function mapWithConcurrency<T, R>(values: T[], concurrency: number, mapper: (value: T) => Promise<R>): Promise<R[]> {
    const results = new Array<R>(values.length);
    let next = 0;
    async function worker(): Promise<void> {
        while (next < values.length) {
            const index = next++;
            results[index] = await mapper(values[index]);
        }
    }
    await Promise.all(Array.from({ length: Math.min(concurrency, values.length) }, worker));
    return results;
}

function compareField(
    mismatches: PettanBattleAudit["mismatches"],
    stickerId: string,
    field: string,
    official: string | number | undefined,
    visual: string | number | undefined,
): void {
    const left = official ?? "";
    const right = visual ?? "";
    if (left !== right) mismatches.push({ stickerId, field, official: left, visual: right });
}

function normalizeOfficialDate(value: string): string {
    const parsed = new Date(`${value.replace(" ", "T")}Z`);
    if (!Number.isFinite(parsed.getTime())) throw new Error(`Invalid Pettan Battle official date: ${value}`);
    return parsed.toISOString();
}

function normalizeVisualDate(value: string): string {
    const match = value.match(/(\d{4})\/(\d{2})\/(\d{2})/);
    if (!match) return value;
    return `${match[1]}-${match[2]}-${match[3]}`;
}

function normalizedText(value: string | null | undefined): string {
    return cleanText(value);
}

function optionalText(value: string | null | undefined): string | undefined {
    return cleanText(value) || undefined;
}

function requiredText(value: string | null | undefined, label: string): string {
    const normalized = cleanText(value);
    if (!normalized) throw new Error(`${label} is missing.`);
    return normalized;
}

function requiredNumber(value: string | null | undefined, label: string): number {
    const match = cleanText(value).match(/[\d,]+/);
    if (!match) throw new Error(`${label} is missing.`);
    const parsed = Number(match[0].replace(/,/g, ""));
    if (!Number.isFinite(parsed)) throw new Error(`${label} is invalid.`);
    return parsed;
}

function cleanText(value: string | null | undefined): string {
    return String(value ?? "").replace(/\s+/g, " ").trim();
}

function absoluteUrl(value: string | null): string {
    return absoluteOptionalUrl(value) ?? INDEX_URL;
}

function absoluteOptionalUrl(value: string | null | undefined): string | undefined {
    if (!value) return undefined;
    const url = new URL(value, DOKKAN_INFO_BASE_URL);
    url.pathname = url.pathname.replace(/\/{2,}/g, "/");
    return url.toString();
}

function assertUsablePage(document: Document): void {
    const text = cleanText(document.body?.textContent);
    if (/Sorry, you have been blocked/i.test(text)) throw new Error("DokkanInfo blocked the Pettan Battle request.");
    if (/General server error/i.test(text)) throw new Error("DokkanInfo returned a Pettan Battle server error page.");
}

function refreshRequested(): boolean {
    return /^(?:1|true|yes)$/i.test(process.env.PETTAN_BATTLE_REFRESH ?? "");
}

function requestedConcurrency(): number {
    return positiveInteger(process.env.PETTAN_BATTLE_CONCURRENCY, DEFAULT_CONCURRENCY);
}

function requestedDelayMs(): number {
    return nonNegativeNumber(process.env.PETTAN_BATTLE_DELAY_MS, DEFAULT_DELAY_MS);
}

function cacheTtlHours(): number {
    return nonNegativeNumber(process.env.PETTAN_BATTLE_CACHE_TTL_HOURS, DEFAULT_CACHE_TTL_HOURS);
}

function positiveInteger(value: string | undefined, fallback: number): number {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function nonNegativeNumber(value: string | undefined, fallback: number): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function compareIds(left: string, right: string): number {
    return left.localeCompare(right, "en", { numeric: true });
}

function delay(milliseconds: number): Promise<void> {
    return milliseconds > 0 ? new Promise(resolveDelay => setTimeout(resolveDelay, milliseconds)) : Promise.resolve();
}
