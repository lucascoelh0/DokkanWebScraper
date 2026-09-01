import { mkdir } from "fs/promises";
import { resolve } from "path";
import { DokkanInfoBurstMode, DokkanInfoBurstModeDataset } from "./dokkaninfo-special-event";
import {
    DOKKAN_INFO_BASE_URL,
    absoluteOptionalUrl,
    assertUsablePage,
    cleanText,
    compareIds,
    delay,
    mapWithConcurrency,
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

const INDEX_URL = `${DOKKAN_INFO_BASE_URL}/events/burstmode`;
const CACHE_DIR = "data/dokkaninfo-burst-mode/cache";
const OUTPUT_DIR = "data/dokkaninfo-burst-mode/latest";
const OUTPUT_FILE = "burst-mode.json";
const ENV_PREFIX = "DOKKANINFO_BURST_MODE";

interface RawBurstMode {
    id?: string | number,
    sugoroku_map_id?: string | number,
    area_id?: string | number,
    start_at?: string | number,
    end_at?: string | number,
    genkai_battle_schedule_id?: string | number,
    listbutton_image?: string,
}

interface RawBurstPage {
    current_page?: number,
    data?: RawBurstMode[],
    last_page?: number,
    total?: number,
}

interface BurstIndexPage {
    page: number,
    lastPage: number,
    total: number,
    modes: DokkanInfoBurstMode[],
}

export async function getDokkanInfoBurstModes(): Promise<DokkanInfoBurstModeDataset> {
    const first = await fetchBurstIndexPage(1);
    const remainingPages = Array.from({ length: Math.max(0, first.lastPage - 1) }, (_, index) => index + 2);
    const pages = [first, ...await mapWithConcurrency(remainingPages, requestedConcurrency(ENV_PREFIX), page => fetchBurstIndexPage(page))];
    const summaries = [...new Map(pages.flatMap(page => page.modes).map(mode => [mode.id, mode])).values()]
        .sort((left, right) => compareIds(left.id, right.id));
    if (summaries.length !== first.total) {
        throw new Error(`DokkanInfo Burst Mode advertised ${first.total} editions but exposed ${summaries.length}.`);
    }

    const failedModeIds: string[] = [];
    let completed = 0;
    const modes = (await mapWithConcurrency(summaries, requestedConcurrency(ENV_PREFIX), async summary => {
        try {
            const mode = await fetchBurstDetail(summary);
            completed += 1;
            console.log(`[DOKKANINFO-BURST] Modes ${completed}/${summaries.length}: ${summary.id} (${mode.modifierGroups.length} groups)`);
            return mode;
        } catch (error) {
            failedModeIds.push(summary.id);
            completed += 1;
            console.error(`[DOKKANINFO-BURST] Failed mode ${summary.id}: ${errorMessage(error)}`);
            return undefined;
        }
    })).filter((mode): mode is DokkanInfoBurstMode => Boolean(mode));

    return withoutUndefined({
        schemaVersion: "1.0.0",
        generatedAt: new Date().toISOString(),
        source: "dokkaninfo",
        sourcePath: INDEX_URL,
        modeCount: modes.length,
        modifierGroupCount: modes.reduce((sum, mode) => sum + mode.modifierGroups.length, 0),
        modifierOptionCount: modes.reduce((sum, mode) => sum + mode.modifierGroups.reduce((groupSum, group) => groupSum + group.options.length, 0), 0),
        failedModeIds: failedModeIds.length ? failedModeIds.sort(compareIds) : undefined,
        modes,
    }) as DokkanInfoBurstModeDataset;
}

export async function writeDokkanInfoBurstModes(dataset?: DokkanInfoBurstModeDataset): Promise<string> {
    const outputPath = resolve(__dirname, OUTPUT_DIR, OUTPUT_FILE);
    await mkdir(resolve(__dirname, OUTPUT_DIR), { recursive: true });
    await writeFormattedJson(outputPath, dataset ?? await getDokkanInfoBurstModes());
    return outputPath;
}

export function mapBurstIndexPage(document: Document): BurstIndexPage {
    assertUsablePage(document, "Burst Mode index");
    const payload = parseJsonAttribute<RawBurstPage>(
        document.querySelector("genkai-battles")?.getAttribute("v-bind:genkai_battles_json"),
        "Burst Mode index payload",
    );
    const page = requiredNumber(payload.current_page, "Burst Mode current page");
    const modes = (payload.data ?? []).map(raw => mapBurstSummary(raw));
    return {
        page,
        lastPage: requiredNumber(payload.last_page, "Burst Mode last page"),
        total: requiredNumber(payload.total, "Burst Mode total"),
        modes,
    };
}

export function mapBurstDetail(document: Document, summary: DokkanInfoBurstMode): DokkanInfoBurstMode {
    assertUsablePage(document, `Burst Mode ${summary.id}`);
    const timestamps = Array.from(document.querySelectorAll("unix-to-date"))
        .map(element => requiredNumber(element.getAttribute("timestamp") ?? element.getAttribute("v-bind:timestamp"), `Burst Mode ${summary.id} timestamp`));
    if (timestamps.length >= 2 && (timestamps[0] !== summary.startAt || timestamps[1] !== summary.endAt)) {
        throw new Error(`Burst Mode ${summary.id} schedule differs between index and detail.`);
    }
    const modifierGroups = Array.from(document.querySelectorAll<HTMLElement>(".row.margin-top-5.border-radius-10.bg-main-box.margin-3.bg-main"))
        .map((group, groupIndex) => ({
            groupIndex: groupIndex + 1,
            options: Array.from(group.querySelectorAll<HTMLElement>(".row.font-size-1_5.container-text-light.padding-top-bottom-5"))
                .map((option, optionIndex) => {
                    const rawLabel = cleanText(option.querySelector(".col-sm-10")?.textContent);
                    const selectedInSource = /^\[Selection\]\s*/i.test(rawLabel);
                    return {
                        optionIndex: optionIndex + 1,
                        label: rawLabel.replace(/^\[Selection\]\s*/i, ""),
                        points: requiredNumber(option.querySelector(".col-sm:not(.col-sm-10)")?.textContent, `Burst Mode ${summary.id} option points`),
                        selectedInSource,
                    };
                }),
        }))
        .filter(group => group.options.length > 0);
    if (!modifierGroups.length) throw new Error(`Burst Mode ${summary.id} exposed no modifier groups.`);
    return {
        ...summary,
        title: stripDokkanInfoTitle(document) || `Burst Mode ${summary.id}`,
        bannerPath: absoluteOptionalUrl(document.querySelector<HTMLImageElement>('img[src*="/genkaibattle/"]')?.getAttribute("src")) ?? summary.bannerPath,
        modifierGroups,
    };
}

function mapBurstSummary(raw: RawBurstMode): DokkanInfoBurstMode {
    const id = toId(raw.id, "Burst Mode ID");
    return withoutUndefined({
        id,
        title: `Burst Mode ${id}`,
        sourcePath: `${INDEX_URL}/${id}`,
        areaId: toId(raw.area_id, `Burst Mode ${id} area ID`),
        sugorokuMapId: toId(raw.sugoroku_map_id, `Burst Mode ${id} map ID`),
        scheduleId: toId(raw.genkai_battle_schedule_id, `Burst Mode ${id} schedule ID`),
        startAt: requiredNumber(raw.start_at, `Burst Mode ${id} start`),
        endAt: requiredNumber(raw.end_at, `Burst Mode ${id} end`),
        bannerPath: raw.listbutton_image
            ? `${DOKKAN_INFO_BASE_URL}/assets/global/en/ingame/genkaibattle/${raw.listbutton_image}`
            : undefined,
        modifierGroups: [],
    });
}

async function fetchBurstIndexPage(page: number): Promise<BurstIndexPage> {
    const path = `index/page-${page}.json`;
    const cached = await readSpecialCache<BurstIndexPage>(CACHE_DIR, ENV_PREFIX, path);
    if (cached) return cached;
    await delay(requestedDelayMs(ENV_PREFIX));
    const value = mapBurstIndexPage(await fetchFromWeb(`${INDEX_URL}?page=${page}`));
    if (value.page !== page) throw new Error(`Burst Mode requested page ${page} but received page ${value.page}.`);
    await writeSpecialCache(CACHE_DIR, path, value);
    return value;
}

async function fetchBurstDetail(summary: DokkanInfoBurstMode): Promise<DokkanInfoBurstMode> {
    const path = `modes/${summary.id}.json`;
    const cached = await readSpecialCache<DokkanInfoBurstMode>(CACHE_DIR, ENV_PREFIX, path);
    if (cached) return cached;
    await delay(requestedDelayMs(ENV_PREFIX));
    const value = mapBurstDetail(await fetchFromWeb(summary.sourcePath), summary);
    await writeSpecialCache(CACHE_DIR, path, value);
    return value;
}

function errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}
