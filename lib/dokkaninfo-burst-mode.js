"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mapBurstDetail = exports.mapBurstIndexPage = exports.writeDokkanInfoBurstModes = exports.getDokkanInfoBurstModes = void 0;
const promises_1 = require("fs/promises");
const path_1 = require("path");
const dokkaninfo_special_events_common_1 = require("./dokkaninfo-special-events-common");
const format_json_1 = require("./format-json");
const scraper_1 = require("./scraper");
const INDEX_URL = `${dokkaninfo_special_events_common_1.DOKKAN_INFO_BASE_URL}/events/burstmode`;
const CACHE_DIR = "data/dokkaninfo-burst-mode/cache";
const OUTPUT_DIR = "data/dokkaninfo-burst-mode/latest";
const OUTPUT_FILE = "burst-mode.json";
const ENV_PREFIX = "DOKKANINFO_BURST_MODE";
async function getDokkanInfoBurstModes() {
    const first = await fetchBurstIndexPage(1);
    const remainingPages = Array.from({ length: Math.max(0, first.lastPage - 1) }, (_, index) => index + 2);
    const pages = [first, ...await (0, dokkaninfo_special_events_common_1.mapWithConcurrency)(remainingPages, (0, dokkaninfo_special_events_common_1.requestedConcurrency)(ENV_PREFIX), page => fetchBurstIndexPage(page))];
    const summaries = [...new Map(pages.flatMap(page => page.modes).map(mode => [mode.id, mode])).values()]
        .sort((left, right) => (0, dokkaninfo_special_events_common_1.compareIds)(left.id, right.id));
    if (summaries.length !== first.total) {
        throw new Error(`DokkanInfo Burst Mode advertised ${first.total} editions but exposed ${summaries.length}.`);
    }
    const failedModeIds = [];
    let completed = 0;
    const modes = (await (0, dokkaninfo_special_events_common_1.mapWithConcurrency)(summaries, (0, dokkaninfo_special_events_common_1.requestedConcurrency)(ENV_PREFIX), async (summary) => {
        try {
            const mode = await fetchBurstDetail(summary);
            completed += 1;
            console.log(`[DOKKANINFO-BURST] Modes ${completed}/${summaries.length}: ${summary.id} (${mode.modifierGroups.length} groups)`);
            return mode;
        }
        catch (error) {
            failedModeIds.push(summary.id);
            completed += 1;
            console.error(`[DOKKANINFO-BURST] Failed mode ${summary.id}: ${errorMessage(error)}`);
            return undefined;
        }
    })).filter((mode) => Boolean(mode));
    return (0, dokkaninfo_special_events_common_1.withoutUndefined)({
        schemaVersion: "1.0.0",
        generatedAt: new Date().toISOString(),
        source: "dokkaninfo",
        sourcePath: INDEX_URL,
        modeCount: modes.length,
        modifierGroupCount: modes.reduce((sum, mode) => sum + mode.modifierGroups.length, 0),
        modifierOptionCount: modes.reduce((sum, mode) => sum + mode.modifierGroups.reduce((groupSum, group) => groupSum + group.options.length, 0), 0),
        failedModeIds: failedModeIds.length ? failedModeIds.sort(dokkaninfo_special_events_common_1.compareIds) : undefined,
        modes,
    });
}
exports.getDokkanInfoBurstModes = getDokkanInfoBurstModes;
async function writeDokkanInfoBurstModes(dataset) {
    const outputPath = (0, path_1.resolve)(__dirname, OUTPUT_DIR, OUTPUT_FILE);
    await (0, promises_1.mkdir)((0, path_1.resolve)(__dirname, OUTPUT_DIR), { recursive: true });
    await (0, format_json_1.writeFormattedJson)(outputPath, dataset ?? await getDokkanInfoBurstModes());
    return outputPath;
}
exports.writeDokkanInfoBurstModes = writeDokkanInfoBurstModes;
function mapBurstIndexPage(document) {
    (0, dokkaninfo_special_events_common_1.assertUsablePage)(document, "Burst Mode index");
    const payload = (0, dokkaninfo_special_events_common_1.parseJsonAttribute)(document.querySelector("genkai-battles")?.getAttribute("v-bind:genkai_battles_json"), "Burst Mode index payload");
    const page = (0, dokkaninfo_special_events_common_1.requiredNumber)(payload.current_page, "Burst Mode current page");
    const modes = (payload.data ?? []).map(raw => mapBurstSummary(raw));
    return {
        page,
        lastPage: (0, dokkaninfo_special_events_common_1.requiredNumber)(payload.last_page, "Burst Mode last page"),
        total: (0, dokkaninfo_special_events_common_1.requiredNumber)(payload.total, "Burst Mode total"),
        modes,
    };
}
exports.mapBurstIndexPage = mapBurstIndexPage;
function mapBurstDetail(document, summary) {
    (0, dokkaninfo_special_events_common_1.assertUsablePage)(document, `Burst Mode ${summary.id}`);
    const timestamps = Array.from(document.querySelectorAll("unix-to-date"))
        .map(element => (0, dokkaninfo_special_events_common_1.requiredNumber)(element.getAttribute("timestamp") ?? element.getAttribute("v-bind:timestamp"), `Burst Mode ${summary.id} timestamp`));
    if (timestamps.length >= 2 && (timestamps[0] !== summary.startAt || timestamps[1] !== summary.endAt)) {
        throw new Error(`Burst Mode ${summary.id} schedule differs between index and detail.`);
    }
    const modifierGroups = Array.from(document.querySelectorAll(".row.margin-top-5.border-radius-10.bg-main-box.margin-3.bg-main"))
        .map((group, groupIndex) => ({
        groupIndex: groupIndex + 1,
        options: Array.from(group.querySelectorAll(".row.font-size-1_5.container-text-light.padding-top-bottom-5"))
            .map((option, optionIndex) => {
            const rawLabel = (0, dokkaninfo_special_events_common_1.cleanText)(option.querySelector(".col-sm-10")?.textContent);
            const selectedInSource = /^\[Selection\]\s*/i.test(rawLabel);
            return {
                optionIndex: optionIndex + 1,
                label: rawLabel.replace(/^\[Selection\]\s*/i, ""),
                points: (0, dokkaninfo_special_events_common_1.requiredNumber)(option.querySelector(".col-sm:not(.col-sm-10)")?.textContent, `Burst Mode ${summary.id} option points`),
                selectedInSource,
            };
        }),
    }))
        .filter(group => group.options.length > 0);
    if (!modifierGroups.length)
        throw new Error(`Burst Mode ${summary.id} exposed no modifier groups.`);
    return {
        ...summary,
        title: (0, dokkaninfo_special_events_common_1.stripDokkanInfoTitle)(document) || `Burst Mode ${summary.id}`,
        bannerPath: (0, dokkaninfo_special_events_common_1.absoluteOptionalUrl)(document.querySelector('img[src*="/genkaibattle/"]')?.getAttribute("src")) ?? summary.bannerPath,
        modifierGroups,
    };
}
exports.mapBurstDetail = mapBurstDetail;
function mapBurstSummary(raw) {
    const id = (0, dokkaninfo_special_events_common_1.toId)(raw.id, "Burst Mode ID");
    return (0, dokkaninfo_special_events_common_1.withoutUndefined)({
        id,
        title: `Burst Mode ${id}`,
        sourcePath: `${INDEX_URL}/${id}`,
        areaId: (0, dokkaninfo_special_events_common_1.toId)(raw.area_id, `Burst Mode ${id} area ID`),
        sugorokuMapId: (0, dokkaninfo_special_events_common_1.toId)(raw.sugoroku_map_id, `Burst Mode ${id} map ID`),
        scheduleId: (0, dokkaninfo_special_events_common_1.toId)(raw.genkai_battle_schedule_id, `Burst Mode ${id} schedule ID`),
        startAt: (0, dokkaninfo_special_events_common_1.requiredNumber)(raw.start_at, `Burst Mode ${id} start`),
        endAt: (0, dokkaninfo_special_events_common_1.requiredNumber)(raw.end_at, `Burst Mode ${id} end`),
        bannerPath: raw.listbutton_image
            ? `${dokkaninfo_special_events_common_1.DOKKAN_INFO_BASE_URL}/assets/global/en/ingame/genkaibattle/${raw.listbutton_image}`
            : undefined,
        modifierGroups: [],
    });
}
async function fetchBurstIndexPage(page) {
    const path = `index/page-${page}.json`;
    const cached = await (0, dokkaninfo_special_events_common_1.readSpecialCache)(CACHE_DIR, ENV_PREFIX, path);
    if (cached)
        return cached;
    await (0, dokkaninfo_special_events_common_1.delay)((0, dokkaninfo_special_events_common_1.requestedDelayMs)(ENV_PREFIX));
    const value = mapBurstIndexPage(await (0, scraper_1.fetchFromWeb)(`${INDEX_URL}?page=${page}`));
    if (value.page !== page)
        throw new Error(`Burst Mode requested page ${page} but received page ${value.page}.`);
    await (0, dokkaninfo_special_events_common_1.writeSpecialCache)(CACHE_DIR, path, value);
    return value;
}
async function fetchBurstDetail(summary) {
    const path = `modes/${summary.id}.json`;
    const cached = await (0, dokkaninfo_special_events_common_1.readSpecialCache)(CACHE_DIR, ENV_PREFIX, path);
    if (cached)
        return cached;
    await (0, dokkaninfo_special_events_common_1.delay)((0, dokkaninfo_special_events_common_1.requestedDelayMs)(ENV_PREFIX));
    const value = mapBurstDetail(await (0, scraper_1.fetchFromWeb)(summary.sourcePath), summary);
    await (0, dokkaninfo_special_events_common_1.writeSpecialCache)(CACHE_DIR, path, value);
    return value;
}
function errorMessage(error) {
    return error instanceof Error ? error.message : String(error);
}
//# sourceMappingURL=dokkaninfo-burst-mode.js.map