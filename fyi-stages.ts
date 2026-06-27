import { mkdir } from "fs/promises";
import { resolve } from "path";
import { writeFormattedJson } from "./format-json";
import {
    EventStagesDataset,
    QuestStoryStagesDataset,
    StageArea,
    StageChapter,
    StageDifficulty,
    StageImages,
    StageQuest,
    StageTab,
} from "./stage";

const DOKKAN_FYI_BASE_URL = "https://dokkan.fyi";
const DOKKAN_FYI_CDN_BASE_URL = "https://cdn.dokkan.fyi/assets";

interface FyiPaginated<T> {
    data: T[],
    meta?: {
        current_page?: number | null,
        last_page?: number | null,
    },
}

interface FyiQuestStoryPagePayload {
    component: string,
    props: {
        chapters: FyiStageChapter[],
    },
}

interface FyiEventStagesPagePayload {
    component: string,
    props: {
        areas: FyiPaginated<FyiStageArea>,
        tabs: FyiStageTab[],
    },
}

interface FyiStageChapter {
    id: number,
    name?: string | null,
    areas?: FyiStageArea[] | null,
}

interface FyiStageArea {
    id: number,
    name?: string | null,
    type?: string | null,
    chapter?: number | null,
    images?: FyiStageImages | null,
    quests?: FyiStageQuest[] | null,
}

interface FyiStageImages {
    header?: string | null,
    banner?: string | null,
    button?: string | null,
}

interface FyiStageQuest {
    id: number,
    name?: string | null,
    max_attempts?: number | null,
    attempts_reset_days?: number | null,
    boostable?: boolean | null,
    start_date?: string | null,
    area_id?: number | null,
    stages?: FyiDifficultyStage[] | null,
}

interface FyiDifficultyStage {
    id: number,
    difficulty?: string | null,
    stamina?: number | null,
    required_keys?: number | null,
    rank_exp?: number | null,
    zeni?: number | null,
    link_skill_level_up_rate?: number | null,
    quest_id?: number | null,
}

interface FyiStageTab {
    id: number,
    name?: string | null,
    limited?: boolean | null,
}

class DokkanFyiStageClient {
    async fetchQuestStoryChapters(): Promise<FyiStageChapter[]> {
        const response = await fetch(`${DOKKAN_FYI_BASE_URL}/stages/quest-dokkan-story`, {
            headers: browserHeaders(),
        });

        if (!response.ok) {
            throw new Error(`Could not fetch dokkan.fyi quest story stages: ${response.status}`);
        }

        const html = await response.text();
        const payload = extractPagePayload<FyiQuestStoryPagePayload>(html);
        return payload.props.chapters ?? [];
    }

    async fetchEventAreas(limit?: number): Promise<{
        tabs: FyiStageTab[],
        areas: FyiStageArea[],
    }> {
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

    private async fetchEventAreaPage(page: number): Promise<FyiEventStagesPagePayload> {
        const query = new URLSearchParams({ page: page.toString() });
        const response = await fetch(`${DOKKAN_FYI_BASE_URL}/stages/events?${query.toString()}`, {
            headers: browserHeaders(),
        });

        if (!response.ok) {
            throw new Error(`Could not fetch dokkan.fyi event stages page ${page}: ${response.status}`);
        }

        const html = await response.text();
        return extractPagePayload<FyiEventStagesPagePayload>(html);
    }
}

export async function getDokkanFyiQuestStoryStages(): Promise<QuestStoryStagesDataset> {
    const client = new DokkanFyiStageClient();
    const chapters = client
        .fetchQuestStoryChapters()
        .then(rows => rows.map(mapStageChapterFromFyi));

    return buildQuestStoryStagesDataset(await chapters);
}

export async function getDokkanFyiEventStages(): Promise<EventStagesDataset> {
    const client = new DokkanFyiStageClient();
    const { tabs, areas } = await client.fetchEventAreas(requestedEventAreaLimit());

    return buildEventStagesDataset(
        areas.map(mapStageAreaFromFyi),
        tabs.map(mapStageTabFromFyi),
    );
}

export async function writeDokkanFyiStageDatasets(): Promise<{
    questStoryPath: string,
    eventStagesPath: string,
}> {
    const [questStory, eventStages] = await Promise.all([
        getDokkanFyiQuestStoryStages(),
        getDokkanFyiEventStages(),
    ]);

    const outputDir = resolve(__dirname, "data/stages/latest");
    const questStoryPath = resolve(outputDir, "quest-story-stages.json");
    const eventStagesPath = resolve(outputDir, "event-stages.json");

    await mkdir(outputDir, { recursive: true });
    await writeFormattedJson(questStoryPath, questStory);
    await writeFormattedJson(eventStagesPath, eventStages);

    return {
        questStoryPath,
        eventStagesPath,
    };
}

export function buildQuestStoryStagesDataset(chapters: StageChapter[]): QuestStoryStagesDataset {
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

export function buildEventStagesDataset(areas: StageArea[], tabs: StageTab[]): EventStagesDataset {
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

export function mapStageChapterFromFyi(chapter: FyiStageChapter): StageChapter {
    return {
        id: chapter.id.toString(),
        name: cleanInlineText(chapter.name),
        areas: (chapter.areas ?? []).map(mapStageAreaFromFyi),
    };
}

export function mapStageAreaFromFyi(area: FyiStageArea): StageArea {
    return {
        id: area.id.toString(),
        name: cleanInlineText(area.name),
        type: cleanInlineText(area.type),
        chapter: toOptionalNumber(area.chapter),
        images: mapStageImagesFromFyi(area.images),
        quests: (area.quests ?? []).map(mapStageQuestFromFyi),
    };
}

export function mapStageImagesFromFyi(images: FyiStageImages | null | undefined): StageImages {
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

export function mapStageQuestFromFyi(quest: FyiStageQuest): StageQuest {
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

export function mapDifficultyStageFromFyi(stage: FyiDifficultyStage): StageDifficulty {
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

export function mapStageTabFromFyi(tab: FyiStageTab): StageTab {
    return {
        id: tab.id.toString(),
        name: cleanInlineText(tab.name),
        limited: Boolean(tab.limited),
    };
}

function requestedEventAreaLimit(): number | undefined {
    const value = parseInt(process.env.DOKKAN_FYI_EVENT_STAGE_AREA_LIMIT ?? "", 10);
    return Number.isFinite(value) && value > 0 ? value : undefined;
}

function extractPagePayload<T>(html: string): T {
    const match = html.match(/<script data-page="app" type="application\/json">([\s\S]*?)<\/script>/);
    if (!match?.[1]) {
        throw new Error("Could not find dokkan.fyi page payload.");
    }

    return JSON.parse(match[1]) as T;
}

function browserHeaders(): Record<string, string> {
    return {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9",
        "Cache-Control": "no-cache",
        "Pragma": "no-cache",
    };
}

function assetUrl(value: string | null | undefined): string | undefined {
    const normalized = cleanInlineText(value);
    if (!normalized) {
        return undefined;
    }

    if (/^https?:\/\//i.test(normalized)) {
        return normalized;
    }

    return `${DOKKAN_FYI_CDN_BASE_URL}/${normalized.replace(/^\/+/, "")}`;
}

function releaseDate(value: string | null | undefined): string | undefined {
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

function cleanMultilineText(value: string | number | null | undefined): string {
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

function cleanInlineText(value: string | number | null | undefined): string {
    return cleanMultilineText(value).replace(/\s*\n\s*/g, " ").trim();
}

function toNumber(value: number | string | null | undefined): number {
    if (typeof value === "number") {
        return Number.isFinite(value) ? value : 0;
    }

    if (typeof value === "string") {
        const parsed = parseInt(value, 10);
        return Number.isFinite(parsed) ? parsed : 0;
    }

    return 0;
}

function toOptionalNumber(value: number | string | null | undefined): number | undefined {
    const parsed = toNumber(value);
    return parsed === 0 && value !== 0 && value !== "0" ? undefined : parsed;
}

function toFloat(value: number | string | null | undefined): number {
    if (typeof value === "number") {
        return Number.isFinite(value) ? value : 0;
    }

    if (typeof value === "string") {
        const parsed = parseFloat(value);
        return Number.isFinite(parsed) ? parsed : 0;
    }

    return 0;
}
