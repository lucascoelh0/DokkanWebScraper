"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mapStageTabFromFyi = exports.mapDifficultyStageFromFyi = exports.mapStageQuestFromFyi = exports.mapStageImagesFromFyi = exports.mapStageAreaFromFyi = exports.mapStageChapterFromFyi = exports.buildEventStagesDataset = exports.buildQuestStoryStagesDataset = exports.writeDokkanFyiStageDatasets = exports.getDokkanFyiEventStages = exports.getDokkanFyiQuestStoryStages = void 0;
const promises_1 = require("fs/promises");
const path_1 = require("path");
const format_json_1 = require("./format-json");
const DOKKAN_FYI_BASE_URL = "https://dokkan.fyi";
const DOKKAN_FYI_CDN_BASE_URL = "https://cdn.dokkan.fyi/assets";
class DokkanFyiStageClient {
    async fetchQuestStoryChapters() {
        const response = await fetch(`${DOKKAN_FYI_BASE_URL}/stages/quest-dokkan-story`, {
            headers: browserHeaders(),
        });
        if (!response.ok) {
            throw new Error(`Could not fetch dokkan.fyi quest story stages: ${response.status}`);
        }
        const html = await response.text();
        const payload = extractPagePayload(html);
        return payload.props.chapters ?? [];
    }
    async fetchEventAreas(limit) {
        const firstPage = await this.fetchEventAreaPage(1);
        const tabs = firstPage.props.tabs ?? [];
        const areas = [...(firstPage.props.areas?.data ?? [])];
        const lastPage = toOptionalNumber(firstPage.props.areas?.meta?.last_page) ?? 1;
        for (let page = 2; page <= lastPage; page++) {
            const nextPage = await this.fetchEventAreaPage(page);
            areas.push(...(nextPage.props.areas?.data ?? []));
            if (limit && areas.length >= limit) {
                break;
            }
        }
        return {
            tabs,
            areas: limit ? areas.slice(0, limit) : areas,
        };
    }
    async fetchEventAreaPage(page) {
        const query = new URLSearchParams({ page: page.toString() });
        const response = await fetch(`${DOKKAN_FYI_BASE_URL}/stages/events?${query.toString()}`, {
            headers: browserHeaders(),
        });
        if (!response.ok) {
            throw new Error(`Could not fetch dokkan.fyi event stages page ${page}: ${response.status}`);
        }
        const html = await response.text();
        return extractPagePayload(html);
    }
}
async function getDokkanFyiQuestStoryStages() {
    const client = new DokkanFyiStageClient();
    const chapters = client
        .fetchQuestStoryChapters()
        .then(rows => rows.map(mapStageChapterFromFyi));
    return buildQuestStoryStagesDataset(await chapters);
}
exports.getDokkanFyiQuestStoryStages = getDokkanFyiQuestStoryStages;
async function getDokkanFyiEventStages() {
    const client = new DokkanFyiStageClient();
    const { tabs, areas } = await client.fetchEventAreas(requestedEventAreaLimit());
    return buildEventStagesDataset(areas.map(mapStageAreaFromFyi), tabs.map(mapStageTabFromFyi));
}
exports.getDokkanFyiEventStages = getDokkanFyiEventStages;
async function writeDokkanFyiStageDatasets() {
    const [questStory, eventStages] = await Promise.all([
        getDokkanFyiQuestStoryStages(),
        getDokkanFyiEventStages(),
    ]);
    const outputDir = (0, path_1.resolve)(__dirname, "data/stages/latest");
    const questStoryPath = (0, path_1.resolve)(outputDir, "quest-story-stages.json");
    const eventStagesPath = (0, path_1.resolve)(outputDir, "event-stages.json");
    await (0, promises_1.mkdir)(outputDir, { recursive: true });
    await (0, format_json_1.writeFormattedJson)(questStoryPath, questStory);
    await (0, format_json_1.writeFormattedJson)(eventStagesPath, eventStages);
    return {
        questStoryPath,
        eventStagesPath,
    };
}
exports.writeDokkanFyiStageDatasets = writeDokkanFyiStageDatasets;
function buildQuestStoryStagesDataset(chapters) {
    const areas = chapters.flatMap(chapter => chapter.areas);
    const quests = areas.flatMap(area => area.quests);
    const stages = quests.flatMap(quest => quest.stages);
    return {
        generatedAt: new Date().toISOString(),
        source: "dokkan.fyi",
        chapterCount: chapters.length,
        areaCount: areas.length,
        questCount: quests.length,
        stageCount: stages.length,
        chapters,
    };
}
exports.buildQuestStoryStagesDataset = buildQuestStoryStagesDataset;
function buildEventStagesDataset(areas, tabs) {
    const quests = areas.flatMap(area => area.quests);
    const stages = quests.flatMap(quest => quest.stages);
    return {
        generatedAt: new Date().toISOString(),
        source: "dokkan.fyi",
        areaCount: areas.length,
        questCount: quests.length,
        stageCount: stages.length,
        tabs,
        areas,
    };
}
exports.buildEventStagesDataset = buildEventStagesDataset;
function mapStageChapterFromFyi(chapter) {
    return {
        id: chapter.id.toString(),
        name: cleanInlineText(chapter.name),
        areas: (chapter.areas ?? []).map(mapStageAreaFromFyi),
    };
}
exports.mapStageChapterFromFyi = mapStageChapterFromFyi;
function mapStageAreaFromFyi(area) {
    return {
        id: area.id.toString(),
        name: cleanInlineText(area.name),
        type: cleanInlineText(area.type),
        chapter: toOptionalNumber(area.chapter),
        images: mapStageImagesFromFyi(area.images),
        quests: (area.quests ?? []).map(mapStageQuestFromFyi),
    };
}
exports.mapStageAreaFromFyi = mapStageAreaFromFyi;
function mapStageImagesFromFyi(images) {
    const headerPath = cleanInlineText(images?.header);
    const bannerPath = cleanInlineText(images?.banner);
    const buttonPath = cleanInlineText(images?.button);
    return {
        headerPath: headerPath || undefined,
        headerUrl: assetUrl(headerPath),
        bannerPath: bannerPath || undefined,
        bannerUrl: assetUrl(bannerPath),
        buttonPath: buttonPath || undefined,
        buttonUrl: assetUrl(buttonPath),
    };
}
exports.mapStageImagesFromFyi = mapStageImagesFromFyi;
function mapStageQuestFromFyi(quest) {
    return {
        id: quest.id.toString(),
        name: cleanInlineText(quest.name),
        maxAttempts: toOptionalNumber(quest.max_attempts),
        attemptsResetDays: toOptionalNumber(quest.attempts_reset_days),
        boostable: Boolean(quest.boostable),
        startDate: releaseDate(quest.start_date),
        areaId: toNumber(quest.area_id).toString(),
        stages: (quest.stages ?? []).map(mapDifficultyStageFromFyi),
    };
}
exports.mapStageQuestFromFyi = mapStageQuestFromFyi;
function mapDifficultyStageFromFyi(stage) {
    return {
        id: stage.id.toString(),
        difficulty: cleanInlineText(stage.difficulty),
        stamina: toNumber(stage.stamina),
        requiredKeys: toNumber(stage.required_keys),
        rankExp: toNumber(stage.rank_exp),
        zeni: toNumber(stage.zeni),
        linkSkillLevelUpRate: toFloat(stage.link_skill_level_up_rate),
        questId: toNumber(stage.quest_id).toString(),
    };
}
exports.mapDifficultyStageFromFyi = mapDifficultyStageFromFyi;
function mapStageTabFromFyi(tab) {
    return {
        id: tab.id.toString(),
        name: cleanInlineText(tab.name),
        limited: Boolean(tab.limited),
    };
}
exports.mapStageTabFromFyi = mapStageTabFromFyi;
function requestedEventAreaLimit() {
    const value = parseInt(process.env.DOKKAN_FYI_EVENT_STAGE_AREA_LIMIT ?? "", 10);
    return Number.isFinite(value) && value > 0 ? value : undefined;
}
function extractPagePayload(html) {
    const match = html.match(/<script data-page="app" type="application\/json">([\s\S]*?)<\/script>/);
    if (!match?.[1]) {
        throw new Error("Could not find dokkan.fyi page payload.");
    }
    return JSON.parse(match[1]);
}
function browserHeaders() {
    return {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9",
        "Cache-Control": "no-cache",
        "Pragma": "no-cache",
    };
}
function assetUrl(value) {
    const normalized = cleanInlineText(value);
    if (!normalized) {
        return undefined;
    }
    if (/^https?:\/\//i.test(normalized)) {
        return normalized;
    }
    return `${DOKKAN_FYI_CDN_BASE_URL}/${normalized.replace(/^\/+/, "")}`;
}
function releaseDate(value) {
    let normalized = cleanInlineText(value);
    if (!normalized) {
        return undefined;
    }
    if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(normalized)) {
        normalized = `${normalized.replace(" ", "T")}Z`;
    }
    const parsed = new Date(normalized);
    if (Number.isNaN(parsed.getTime())) {
        return undefined;
    }
    return parsed.toISOString();
}
function cleanMultilineText(value) {
    if (value === null || value === undefined || value === "") {
        return "";
    }
    const normalized = typeof value === "string"
        ? value
        : value.toString();
    return normalized
        .replace(/\{[^}]+\}/g, "")
        .replace(/\r/g, "")
        .replace(/&#039;/g, "'")
        .replace(/&quot;/g, "\"")
        .replace(/&amp;/g, "&")
        .split("\n")
        .map(line => line.trim())
        .filter(Boolean)
        .join("\n")
        .trim();
}
function cleanInlineText(value) {
    return cleanMultilineText(value).replace(/\s*\n\s*/g, " ").trim();
}
function toNumber(value) {
    if (typeof value === "number") {
        return Number.isFinite(value) ? value : 0;
    }
    if (typeof value === "string") {
        const parsed = parseInt(value, 10);
        return Number.isFinite(parsed) ? parsed : 0;
    }
    return 0;
}
function toOptionalNumber(value) {
    const parsed = toNumber(value);
    return parsed === 0 && value !== 0 && value !== "0" ? undefined : parsed;
}
function toFloat(value) {
    if (typeof value === "number") {
        return Number.isFinite(value) ? value : 0;
    }
    if (typeof value === "string") {
        const parsed = parseFloat(value);
        return Number.isFinite(parsed) ? parsed : 0;
    }
    return 0;
}
//# sourceMappingURL=fyi-stages.js.map