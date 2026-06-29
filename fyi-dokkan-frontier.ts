import { mkdir } from "fs/promises";
import { resolve } from "path";
import { Classes, Rarities, Types } from "./character";
import {
    DokkanFrontierChapter,
    DokkanFrontierChapterSummary,
    DokkanFrontierChaptersDataset,
    DokkanFrontierCharacterRef,
    DokkanFrontierEnemy,
    DokkanFrontierEnemyRound,
    DokkanFrontierGroupExchangeStep,
    DokkanFrontierIntensityEffect,
    DokkanFrontierMission,
    DokkanFrontierNamedEffect,
    DokkanFrontierNode,
    DokkanFrontierPage,
    DokkanFrontierReward,
    DokkanFrontierSeriesDataset,
    DokkanFrontierSeriesSummary,
    DokkanFrontierSkill,
    DokkanFrontierUnlockMission,
} from "./dokkan-frontier";
import { writeFormattedJson } from "./format-json";

const DOKKAN_FYI_BASE_URL = "https://dokkan.fyi";

interface FyiFrontierIndexPagePayload {
    component: string,
    props: {
        series: FyiFrontierSeries[],
    },
}

interface FyiFrontierChapterPagePayload {
    component: string,
    props: {
        series: FyiFrontierSeries,
        chapter: FyiFrontierChapterDetail,
        group_exchange?: FyiGroupExchangeStep[] | null,
        chapter_missions?: FyiMission[] | null,
    },
}

interface FyiFrontierSeries {
    id: number,
    name?: string | null,
    banner_image_path?: string | null,
    priority?: number | null,
    chapters?: FyiFrontierChapterSummary[] | null,
}

interface FyiFrontierChapterSummary {
    id: number,
    name?: string | null,
    banner_image_path?: string | null,
    priority?: number | null,
}

interface FyiFrontierChapterDetail {
    id: number,
    name?: string | null,
    banner_image_path?: string | null,
    priority?: number | null,
    pages?: FyiFrontierPage[] | null,
}

interface FyiFrontierPage {
    id: number,
    page_number?: number | null,
    background_image_path?: string | null,
    nodes?: FyiFrontierNode[] | null,
}

interface FyiFrontierNode {
    id: number,
    stamina?: number | null,
    user_exp?: number | null,
    zeni?: number | null,
    auto_enabled?: boolean | null,
    link_skill_level_up_rate?: number | null,
    is_special_node?: boolean | null,
    unlock_missions?: FyiUnlockMission[] | null,
    required_characters?: FyiCharacterSummary[] | null,
    enemy_information?: {
        rounds?: FyiEnemyRound[] | null,
    } | null,
    intensity_effects?: FyiIntensityEffect[] | null,
    missions?: FyiMission[] | null,
}

interface FyiUnlockMission {
    id?: number | null,
    description?: string | null,
}

interface FyiIntensityEffect {
    level?: number | null,
    skill?: FyiNamedEffectPayload | null,
}

interface FyiNamedEffectPayload {
    id?: number | null,
    name?: string | null,
    description?: string | null,
    efficacy_type?: number | null,
    eff_value1?: number | null,
}

interface FyiEnemyRound {
    round_no?: number | null,
    enemies?: FyiEnemy[] | null,
}

interface FyiEnemy {
    card?: FyiCharacterSummary | null,
    skills?: FyiSkillPayload[] | null,
}

interface FyiSkillPayload {
    id?: number | null,
    name?: string | null,
    description?: string | null,
}

interface FyiMission {
    id: number,
    type?: string | null,
    name?: string | null,
    description?: string | null,
    rewards?: FyiMissionRewardPayload[] | null,
    characters?: FyiCharacterSummary[] | null,
    priority?: number | null,
    starts_at?: string | null,
    ends_at?: string | null,
    category_id?: number | null,
}

interface FyiMissionRewardPayload {
    id?: number | null,
    item_id?: number | null,
    item_type?: string | null,
    item?: {
        id?: number | null,
        name?: string | null,
        description?: string | null,
        rarity?: number | null,
        zeni?: number | null,
        trade_points?: number | null,
        type?: string | null,
        amount?: number | null,
        card_id?: number | null,
        step?: number | null,
        link_to?: string | null,
        bgm_id?: number | null,
    } | null,
    quantity?: number | null,
    mission_id?: number | null,
}

interface FyiGroupExchangeStep {
    charge?: number | null,
    description?: string | null,
}

interface FyiCharacterSummary {
    id: number,
    canonical_id?: number | null,
    base_character_id?: number | null,
    character_id?: number | null,
    name?: string | null,
    rarity?: number | null,
    rarity_text?: string | null,
    type?: number | null,
    type_text?: string | null,
    awakening_type?: number | null,
    awakening_type_text?: string | null,
    thumbnail_id?: number | null,
    has_eza?: boolean | null,
    has_seza?: boolean | null,
    is_reversibly_exchanged?: boolean | null,
    is_freely_obtainable?: boolean | null,
    release_dates?: {
        latest_type?: string | null,
    } | null,
}

class DokkanFyiFrontierClient {
    async fetchSeries(): Promise<FyiFrontierSeries[]> {
        const response = await fetch(`${DOKKAN_FYI_BASE_URL}/dokkan-frontier`, {
            headers: browserHeaders(),
        });

        if (!response.ok) {
            throw new Error(`Could not fetch dokkan.fyi frontier index: ${response.status}`);
        }

        const html = await response.text();
        const payload = extractPagePayload<FyiFrontierIndexPagePayload>(html);
        return payload.props.series ?? [];
    }

    async fetchChapter(seriesId: number, chapterId: number): Promise<FyiFrontierChapterPagePayload> {
        const response = await fetch(`${DOKKAN_FYI_BASE_URL}/dokkan-frontier/${seriesId}/chapters/${chapterId}`, {
            headers: browserHeaders(),
        });

        if (!response.ok) {
            throw new Error(`Could not fetch dokkan.fyi frontier chapter ${seriesId}/${chapterId}: ${response.status}`);
        }

        const html = await response.text();
        return extractPagePayload<FyiFrontierChapterPagePayload>(html);
    }
}

export async function getDokkanFyiFrontierSeriesDataset(): Promise<DokkanFrontierSeriesDataset> {
    const client = new DokkanFyiFrontierClient();
    const series = await client.fetchSeries();
    const limited = applyLimit(series, requestedSeriesLimit());

    return buildDokkanFrontierSeriesDataset(limited.map(mapFrontierSeriesSummaryFromFyi));
}

export async function getDokkanFyiFrontierChaptersDataset(): Promise<DokkanFrontierChaptersDataset> {
    const client = new DokkanFyiFrontierClient();
    const series = applyLimit(await client.fetchSeries(), requestedSeriesLimit());
    const chapterLimit = requestedChapterLimit();
    const chapters: DokkanFrontierChapter[] = [];

    for (const entry of series) {
        const chapterIds = applyLimit(entry.chapters ?? [], chapterLimit);
        for (const chapter of chapterIds) {
            const payload = await client.fetchChapter(entry.id, chapter.id);
            chapters.push(mapFrontierChapterFromFyi(payload));
        }
    }

    return buildDokkanFrontierChaptersDataset(chapters);
}

export async function writeDokkanFyiFrontierDatasets(): Promise<{ seriesPath: string, chaptersPath: string }> {
    const [seriesDataset, chaptersDataset] = await Promise.all([
        getDokkanFyiFrontierSeriesDataset(),
        getDokkanFyiFrontierChaptersDataset(),
    ]);

    const outputDir = resolve(__dirname, "data/dokkan-frontier/latest");
    const seriesPath = resolve(outputDir, "dokkan-frontier-series.json");
    const chaptersPath = resolve(outputDir, "dokkan-frontier-chapters.json");

    await mkdir(outputDir, { recursive: true });
    await writeFormattedJson(seriesPath, seriesDataset);
    await writeFormattedJson(chaptersPath, chaptersDataset);

    return { seriesPath, chaptersPath };
}

export function buildDokkanFrontierSeriesDataset(series: DokkanFrontierSeriesSummary[]): DokkanFrontierSeriesDataset {
    return {
        generatedAt: new Date().toISOString(),
        source: "dokkan.fyi",
        count: series.length,
        series: [...series].sort((left, right) => (right.priority ?? 0) - (left.priority ?? 0) || left.id.localeCompare(right.id)),
    };
}

export function buildDokkanFrontierChaptersDataset(chapters: DokkanFrontierChapter[]): DokkanFrontierChaptersDataset {
    const pages = chapters.flatMap(chapter => chapter.pages);
    const nodes = pages.flatMap(page => page.nodes);
    const missions = [
        ...chapters.flatMap(chapter => chapter.chapterMissions),
        ...nodes.flatMap(node => node.missions),
    ];

    return {
        generatedAt: new Date().toISOString(),
        source: "dokkan.fyi",
        chapterCount: chapters.length,
        pageCount: pages.length,
        nodeCount: nodes.length,
        missionCount: missions.length,
        chapters: [...chapters].sort((left, right) => left.seriesId.localeCompare(right.seriesId) || (left.priority ?? 0) - (right.priority ?? 0) || left.id.localeCompare(right.id)),
    };
}

export function mapFrontierSeriesSummaryFromFyi(series: FyiFrontierSeries): DokkanFrontierSeriesSummary {
    const chapters = (series.chapters ?? []).map(mapFrontierChapterSummaryFromFyi);

    return {
        id: series.id.toString(),
        name: cleanInlineText(series.name),
        bannerImagePath: cleanInlineText(series.banner_image_path) || undefined,
        priority: toOptionalNumber(series.priority),
        chapterCount: chapters.length,
        chapters,
    };
}

export function mapFrontierChapterSummaryFromFyi(chapter: FyiFrontierChapterSummary): DokkanFrontierChapterSummary {
    return {
        id: chapter.id.toString(),
        name: cleanInlineText(chapter.name),
        bannerImagePath: cleanInlineText(chapter.banner_image_path) || undefined,
        priority: toOptionalNumber(chapter.priority),
    };
}

export function mapFrontierChapterFromFyi(payload: FyiFrontierChapterPagePayload): DokkanFrontierChapter {
    return {
        id: payload.props.chapter.id.toString(),
        seriesId: payload.props.series.id.toString(),
        seriesName: cleanInlineText(payload.props.series.name),
        name: cleanInlineText(payload.props.chapter.name),
        bannerImagePath: cleanInlineText(payload.props.chapter.banner_image_path) || undefined,
        priority: toOptionalNumber(payload.props.chapter.priority),
        pages: (payload.props.chapter.pages ?? []).map(mapFrontierPageFromFyi),
        groupExchange: (payload.props.group_exchange ?? []).map(mapFrontierGroupExchangeStepFromFyi),
        chapterMissions: (payload.props.chapter_missions ?? []).map(mapFrontierMissionFromFyi),
    };
}

export function mapFrontierPageFromFyi(page: FyiFrontierPage): DokkanFrontierPage {
    return {
        id: page.id.toString(),
        pageNumber: toOptionalNumber(page.page_number),
        backgroundImagePath: cleanInlineText(page.background_image_path) || undefined,
        nodes: (page.nodes ?? []).map(mapFrontierNodeFromFyi),
    };
}

export function mapFrontierNodeFromFyi(node: FyiFrontierNode): DokkanFrontierNode {
    return {
        id: node.id.toString(),
        stamina: toOptionalNumber(node.stamina),
        userExp: toOptionalNumber(node.user_exp),
        zeni: toOptionalNumber(node.zeni),
        autoEnabled: toOptionalBoolean(node.auto_enabled),
        linkSkillLevelUpRate: toOptionalNumber(node.link_skill_level_up_rate),
        isSpecialNode: toOptionalBoolean(node.is_special_node),
        unlockMissions: (node.unlock_missions ?? []).map(mapFrontierUnlockMissionFromFyi),
        requiredCharacters: (node.required_characters ?? []).map(mapFrontierCharacterRefFromFyi),
        intensityEffects: (node.intensity_effects ?? []).map(mapFrontierIntensityEffectFromFyi),
        rounds: (node.enemy_information?.rounds ?? []).map(mapFrontierEnemyRoundFromFyi),
        missions: (node.missions ?? []).map(mapFrontierMissionFromFyi),
    };
}

export function mapFrontierUnlockMissionFromFyi(mission: FyiUnlockMission): DokkanFrontierUnlockMission {
    return {
        id: toStringOrUndefined(mission.id) ?? "",
        description: cleanMultilineText(mission.description),
    };
}

export function mapFrontierIntensityEffectFromFyi(effect: FyiIntensityEffect): DokkanFrontierIntensityEffect {
    return {
        level: toOptionalNumber(effect.level),
        skill: mapFrontierNamedEffectFromFyi(effect.skill),
    };
}

export function mapFrontierNamedEffectFromFyi(effect: FyiNamedEffectPayload | null | undefined): DokkanFrontierNamedEffect | undefined {
    if (!effect) {
        return undefined;
    }

    return {
        id: toStringOrUndefined(effect.id),
        name: cleanInlineText(effect.name) || undefined,
        description: cleanMultilineText(effect.description) || undefined,
        efficacyType: toOptionalNumber(effect.efficacy_type),
        effectValue1: toOptionalNumber(effect.eff_value1),
    };
}

export function mapFrontierEnemyRoundFromFyi(round: FyiEnemyRound): DokkanFrontierEnemyRound {
    return {
        roundNumber: toOptionalNumber(round.round_no),
        enemies: (round.enemies ?? []).map(mapFrontierEnemyFromFyi),
    };
}

export function mapFrontierEnemyFromFyi(enemy: FyiEnemy): DokkanFrontierEnemy {
    return {
        character: enemy.card ? mapFrontierCharacterRefFromFyi(enemy.card) : undefined,
        skills: (enemy.skills ?? []).map(mapFrontierSkillFromFyi),
    };
}

export function mapFrontierSkillFromFyi(skill: FyiSkillPayload): DokkanFrontierSkill {
    return {
        id: toStringOrUndefined(skill.id),
        name: cleanInlineText(skill.name) || undefined,
        description: cleanMultilineText(skill.description) || undefined,
    };
}

export function mapFrontierMissionFromFyi(mission: FyiMission): DokkanFrontierMission {
    return {
        id: mission.id.toString(),
        type: cleanInlineText(mission.type) || undefined,
        name: cleanMultilineText(mission.name),
        description: htmlToText(mission.description),
        priority: toOptionalNumber(mission.priority),
        startsAt: releaseDate(mission.starts_at),
        endsAt: releaseDate(mission.ends_at),
        categoryId: toStringOrUndefined(mission.category_id),
        rewards: (mission.rewards ?? []).map(mapFrontierRewardFromFyi),
        characters: (mission.characters ?? []).map(mapFrontierCharacterRefFromFyi),
    };
}

export function mapFrontierRewardFromFyi(reward: FyiMissionRewardPayload): DokkanFrontierReward {
    return {
        id: toStringOrUndefined(reward.id),
        missionId: toStringOrUndefined(reward.mission_id),
        itemId: toStringOrUndefined(reward.item_id ?? reward.item?.id),
        itemType: cleanInlineText(reward.item_type) || undefined,
        quantity: toNumber(reward.quantity),
        name: cleanInlineText(reward.item?.name) || undefined,
        description: cleanMultilineText(reward.item?.description) || undefined,
        rarity: toOptionalNumber(reward.item?.rarity),
        zeni: toOptionalNumber(reward.item?.zeni),
        tradePoints: toOptionalNumber(reward.item?.trade_points),
        rewardType: cleanInlineText(reward.item?.type) || undefined,
        amount: toOptionalNumber(reward.item?.amount),
        cardId: toStringOrUndefined(reward.item?.card_id),
        step: toOptionalNumber(reward.item?.step),
        linkTo: cleanInlineText(reward.item?.link_to) || undefined,
        bgmId: toStringOrUndefined(reward.item?.bgm_id),
    };
}

export function mapFrontierGroupExchangeStepFromFyi(step: FyiGroupExchangeStep): DokkanFrontierGroupExchangeStep {
    return {
        charge: toOptionalNumber(step.charge),
        description: cleanMultilineText(step.description),
    };
}

export function mapFrontierCharacterRefFromFyi(character: FyiCharacterSummary): DokkanFrontierCharacterRef {
    return {
        id: character.id.toString(),
        canonicalId: toStringOrUndefined(character.canonical_id),
        baseCharacterId: toStringOrUndefined(character.base_character_id),
        characterId: toStringOrUndefined(character.character_id),
        name: cleanInlineText(character.name),
        rarity: rarityFromInput(character.rarity_text, character.rarity),
        type: typeFromInput(character.type_text, character.type),
        characterClass: classFromInput(character.awakening_type_text, character.awakening_type),
        thumbnailId: toStringOrUndefined(character.thumbnail_id),
        portraitUrl: portraitUrl(character.thumbnail_id),
        latestReleaseType: cleanInlineText(character.release_dates?.latest_type) || undefined,
        hasEza: toOptionalBoolean(character.has_eza),
        hasSeza: toOptionalBoolean(character.has_seza),
        isReversiblyExchanged: toOptionalBoolean(character.is_reversibly_exchanged),
        isFreelyObtainable: toOptionalBoolean(character.is_freely_obtainable),
    };
}

function requestedSeriesLimit(): number | undefined {
    return parseOptionalPositiveInt(process.env.DOKKAN_FYI_FRONTIER_SERIES_LIMIT);
}

function requestedChapterLimit(): number | undefined {
    return parseOptionalPositiveInt(process.env.DOKKAN_FYI_FRONTIER_CHAPTER_LIMIT);
}

function parseOptionalPositiveInt(input: string | undefined): number | undefined {
    const value = parseInt(input ?? "", 10);
    return Number.isFinite(value) && value > 0 ? value : undefined;
}

function applyLimit<T>(values: T[], limit?: number): T[] {
    return limit ? values.slice(0, limit) : values;
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

function cleanInlineText(value: unknown): string {
    if (value === null || value === undefined) {
        return "";
    }

    return String(value).replace(/\s+/g, " ").trim();
}

function cleanMultilineText(value: unknown): string {
    return String(value ?? "")
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/\r/g, "")
        .split("\n")
        .map(line => cleanInlineText(line))
        .filter(Boolean)
        .join("\n");
}

function htmlToText(value: unknown): string {
    return cleanMultilineText(
        String(value ?? "")
            .replace(/<br\s*\/?>/gi, "\n")
            .replace(/<\/p>/gi, "\n")
            .replace(/<[^>]+>/g, ""),
    );
}

function releaseDate(value: string | null | undefined): string | undefined {
    const normalized = cleanInlineText(value);
    return normalized ? new Date(normalized).toISOString() : undefined;
}

function portraitUrl(thumbnailId: number | null | undefined): string | undefined {
    const id = toOptionalNumber(thumbnailId);
    if (!id) {
        return undefined;
    }

    return `https://cdn.dokkan.fyi/assets/en/character/thumb/card_${id}_thumb/card_${id}_thumb.png`;
}

function rarityFromInput(text: string | null | undefined, value: number | null | undefined): Rarities | undefined {
    switch (cleanInlineText(text).toUpperCase()) {
        case "LR":
            return Rarities.LR;
        case "UR":
            return Rarities.UR;
        case "SSR":
            return Rarities.SSR;
        case "SR":
            return Rarities.SR;
        case "R":
            return Rarities.R;
        case "N":
            return Rarities.N;
        default:
            break;
    }

    switch (toNumber(value)) {
        case 5:
            return Rarities.LR;
        case 4:
            return Rarities.UR;
        case 3:
            return Rarities.SSR;
        case 2:
            return Rarities.SR;
        case 1:
            return Rarities.R;
        default:
            return undefined;
    }
}

function typeFromInput(text: string | null | undefined, value: number | null | undefined): Types | undefined {
    switch (cleanInlineText(text).toUpperCase()) {
        case "AGL":
            return Types.AGL;
        case "TEQ":
            return Types.TEQ;
        case "INT":
            return Types.INT;
        case "STR":
            return Types.STR;
        case "PHY":
            return Types.PHY;
        default:
            break;
    }

    switch (toNumber(value)) {
        case 0:
            return Types.AGL;
        case 1:
            return Types.TEQ;
        case 2:
            return Types.INT;
        case 3:
            return Types.STR;
        case 4:
            return Types.PHY;
        default:
            return undefined;
    }
}

function classFromInput(text: string | null | undefined, value: number | null | undefined): Classes | undefined {
    switch (cleanInlineText(text).toUpperCase()) {
        case "SUPER":
            return Classes.Super;
        case "EXTREME":
            return Classes.Extreme;
        default:
            break;
    }

    switch (toNumber(value)) {
        case 1:
            return Classes.Super;
        case 2:
            return Classes.Extreme;
        default:
            return undefined;
    }
}

function toNumber(value: number | string | null | undefined): number {
    if (typeof value === "number" && Number.isFinite(value)) {
        return value;
    }

    if (typeof value === "string") {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : 0;
    }

    return 0;
}

function toOptionalNumber(value: number | string | null | undefined): number | undefined {
    if (typeof value === "number") {
        return Number.isFinite(value) ? value : undefined;
    }

    if (typeof value === "string") {
        const normalized = value.trim();
        if (!normalized) {
            return undefined;
        }

        const parsed = Number(normalized);
        return Number.isFinite(parsed) ? parsed : undefined;
    }

    return undefined;
}

function toOptionalBoolean(value: boolean | null | undefined): boolean | undefined {
    return typeof value === "boolean" ? value : undefined;
}

function toStringOrUndefined(value: number | string | null | undefined): string | undefined {
    if (value === null || value === undefined) {
        return undefined;
    }

    const normalized = String(value).trim();
    return normalized ? normalized : undefined;
}
