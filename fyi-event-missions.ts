import { mkdir } from "fs/promises";
import { resolve } from "path";
import { Classes, Rarities, Types } from "./character";
import { EventMissionCategory, EventMissionCharacterRef, EventMissionDataset, EventMissionEntry, EventMissionReward, EventMissionRewardSkill } from "./event-mission";
import { writeFormattedJson } from "./format-json";

const DOKKAN_FYI_BASE_URL = "https://dokkan.fyi";

interface FyiPaginated<T> {
    data: T[],
    meta?: {
        last_page?: number | null,
    },
}

interface FyiMissionEventIndexPagePayload {
    component: string,
    props: {
        categories: FyiPaginated<FyiMissionCategorySummary>,
        rewardTypes?: Record<string, string>,
    },
}

interface FyiMissionShowPagePayload {
    component: string,
    props: {
        category: FyiMissionCategoryDetail,
    },
}

interface FyiMissionCategorySummary {
    id: number,
    type?: string | null,
    ends_at?: string | null,
    is_indefinite?: number | boolean | null,
    reward?: FyiMissionRewardSummary | null,
    priority?: number | null,
    img?: string | null,
    missions_count?: number | null,
    completed_count?: number | null,
}

interface FyiMissionRewardSummary {
    id?: number | null,
    item1_id?: number | null,
    item1_type?: string | null,
    item1?: FyiRewardItemPayload | null,
    item2_id?: number | null,
    item2_type?: string | null,
    item2?: FyiRewardItemPayload | null,
    item3_id?: number | null,
    item3_type?: string | null,
    item3?: FyiRewardItemPayload | null,
    item4_id?: number | null,
    item4_type?: string | null,
    item4?: FyiRewardItemPayload | null,
}

interface FyiMissionCategoryDetail extends FyiMissionCategorySummary {
    mission_ids?: number[] | null,
    missions?: FyiMission[] | null,
    campaign?: unknown,
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
    completed?: boolean | null,
}

interface FyiMissionRewardPayload {
    id?: number | null,
    item_id?: number | null,
    item_type?: string | null,
    item?: FyiRewardItemPayload | null,
    quantity?: number | null,
    mission_id?: number | null,
}

interface FyiRewardItemPayload {
    id?: number | null,
    name?: string | null,
    description?: string | null,
    rarity?: number | null,
    zeni?: number | null,
    trade_points?: number | null,
    type?: string | null,
    amount?: number | null,
    grade?: string | null,
    is_reusable?: boolean | null,
    img_id?: string | null,
    skills?: FyiRewardSkillPayload[] | null,
}

interface FyiRewardSkillPayload {
    id?: number | null,
    attribute?: string | null,
    level?: number | null,
    hidden_potential_skill_id?: number | null,
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

class DokkanFyiEventMissionClient {
    async fetchCategories(limit?: number): Promise<FyiMissionCategorySummary[]> {
        const firstPage = await this.fetchCategoryPage(1);
        const categories = [...(firstPage.props.categories?.data ?? [])];
        const lastPage = toOptionalNumber(firstPage.props.categories?.meta?.last_page) ?? 1;

        for (let page = 2; page <= lastPage; page++) {
            const nextPage = await this.fetchCategoryPage(page);
            categories.push(...(nextPage.props.categories?.data ?? []));

            if (limit && categories.length >= limit) {
                break;
            }
        }

        return limit ? categories.slice(0, limit) : categories;
    }

    async fetchCategory(categoryId: number): Promise<FyiMissionCategoryDetail> {
        const response = await fetch(`${DOKKAN_FYI_BASE_URL}/missions/${categoryId}`, {
            headers: browserHeaders(),
        });

        if (!response.ok) {
            throw new Error(`Could not fetch dokkan.fyi event mission category ${categoryId}: ${response.status}`);
        }

        const html = await response.text();
        return extractPagePayload<FyiMissionShowPagePayload>(html).props.category;
    }

    private async fetchCategoryPage(page: number): Promise<FyiMissionEventIndexPagePayload> {
        const response = await fetch(`${DOKKAN_FYI_BASE_URL}/missions/event?page=${page}`, {
            headers: browserHeaders(),
        });

        if (!response.ok) {
            throw new Error(`Could not fetch dokkan.fyi event missions page ${page}: ${response.status}`);
        }

        const html = await response.text();
        return extractPagePayload<FyiMissionEventIndexPagePayload>(html);
    }
}

export async function getDokkanFyiEventMissions(): Promise<EventMissionDataset> {
    const client = new DokkanFyiEventMissionClient();
    const summaries = await client.fetchCategories(requestedEventMissionCategoryLimit());
    const categories: EventMissionCategory[] = [];

    for (const summary of summaries) {
        const detail = await client.fetchCategory(summary.id);
        categories.push(mapEventMissionCategoryFromFyi(detail, summary));
    }

    return buildEventMissionDataset(categories);
}

export async function writeDokkanFyiEventMissions(): Promise<string> {
    const dataset = await getDokkanFyiEventMissions();
    const outputDir = resolve(__dirname, "data/event-missions/latest");
    const outputPath = resolve(outputDir, "event-missions.json");

    await mkdir(outputDir, { recursive: true });
    await writeFormattedJson(outputPath, dataset);

    return outputPath;
}

export function buildEventMissionDataset(categories: EventMissionCategory[]): EventMissionDataset {
    const missionCount = categories.flatMap(category => category.missions).length;

    return {
        generatedAt: new Date().toISOString(),
        source: "dokkan.fyi",
        count: categories.length,
        missionCount,
        categories: [...categories].sort((left, right) => (right.priority ?? 0) - (left.priority ?? 0) || left.id.localeCompare(right.id)),
    };
}

export function mapEventMissionCategoryFromFyi(
    detail: FyiMissionCategoryDetail,
    summary?: FyiMissionCategorySummary,
): EventMissionCategory {
    return {
        id: detail.id.toString(),
        type: cleanInlineText(detail.type ?? summary?.type) || undefined,
        endsAt: releaseDate(detail.ends_at ?? summary?.ends_at),
        isIndefinite: toOptionalBooleanFlag(detail.is_indefinite ?? summary?.is_indefinite),
        priority: toOptionalNumber(detail.priority ?? summary?.priority),
        imageUrl: cleanInlineText(detail.img ?? summary?.img) || undefined,
        missionsCount: toOptionalNumber(detail.missions_count ?? summary?.missions_count),
        completedCount: toOptionalNumber(detail.completed_count ?? summary?.completed_count),
        previewRewards: mapRewardSummaryFromFyi(summary?.reward),
        missions: (detail.missions ?? []).map(mapEventMissionEntryFromFyi),
    };
}

export function mapEventMissionEntryFromFyi(mission: FyiMission): EventMissionEntry {
    return {
        id: mission.id.toString(),
        type: cleanInlineText(mission.type) || undefined,
        name: cleanMultilineText(mission.name),
        description: htmlToText(mission.description),
        priority: toOptionalNumber(mission.priority),
        startsAt: releaseDate(mission.starts_at),
        endsAt: releaseDate(mission.ends_at),
        categoryId: toStringOrUndefined(mission.category_id),
        completed: toOptionalBoolean(mission.completed),
        rewards: (mission.rewards ?? []).map(mapEventMissionRewardFromFyi),
        characters: (mission.characters ?? []).map(mapEventMissionCharacterRefFromFyi),
    };
}

export function mapEventMissionRewardFromFyi(reward: FyiMissionRewardPayload): EventMissionReward {
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
        grade: cleanInlineText(reward.item?.grade) || undefined,
        isReusable: toOptionalBoolean(reward.item?.is_reusable),
        imageId: cleanInlineText(reward.item?.img_id) || undefined,
        skills: (reward.item?.skills ?? []).map(mapEventMissionRewardSkillFromFyi),
    };
}

export function mapEventMissionRewardSkillFromFyi(skill: FyiRewardSkillPayload): EventMissionRewardSkill {
    return {
        id: toStringOrUndefined(skill.id),
        attribute: cleanInlineText(skill.attribute) || undefined,
        level: toOptionalNumber(skill.level),
        hiddenPotentialSkillId: toOptionalNumber(skill.hidden_potential_skill_id),
    };
}

export function mapEventMissionCharacterRefFromFyi(character: FyiCharacterSummary): EventMissionCharacterRef {
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

function mapRewardSummaryFromFyi(summary?: FyiMissionRewardSummary | null): EventMissionReward[] {
    if (!summary) {
        return [];
    }

    return [
        mapRewardSummaryItem(summary.id, summary.item1_id, summary.item1_type, summary.item1, 1),
        mapRewardSummaryItem(summary.id, summary.item2_id, summary.item2_type, summary.item2, 1),
        mapRewardSummaryItem(summary.id, summary.item3_id, summary.item3_type, summary.item3, 1),
        mapRewardSummaryItem(summary.id, summary.item4_id, summary.item4_type, summary.item4, 1),
    ].filter((reward): reward is EventMissionReward => Boolean(reward));
}

function mapRewardSummaryItem(
    rewardId: number | null | undefined,
    itemId: number | null | undefined,
    itemType: string | null | undefined,
    item: FyiRewardItemPayload | null | undefined,
    quantity: number,
): EventMissionReward | undefined {
    const normalizedItemId = toStringOrUndefined(itemId ?? item?.id);
    if (!normalizedItemId) {
        return undefined;
    }

    return {
        id: toStringOrUndefined(rewardId),
        itemId: normalizedItemId,
        itemType: cleanInlineText(itemType) || undefined,
        quantity,
        name: cleanInlineText(item?.name) || undefined,
        description: cleanMultilineText(item?.description) || undefined,
        rarity: toOptionalNumber(item?.rarity),
        zeni: toOptionalNumber(item?.zeni),
        tradePoints: toOptionalNumber(item?.trade_points),
        rewardType: cleanInlineText(item?.type) || undefined,
        amount: toOptionalNumber(item?.amount),
        grade: cleanInlineText(item?.grade) || undefined,
        isReusable: toOptionalBoolean(item?.is_reusable),
        imageId: cleanInlineText(item?.img_id) || undefined,
        skills: (item?.skills ?? []).map(mapEventMissionRewardSkillFromFyi),
    };
}

function requestedEventMissionCategoryLimit(): number | undefined {
    const value = parseInt(process.env.DOKKAN_FYI_EVENT_MISSION_CATEGORY_LIMIT ?? "", 10);
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

function releaseDate(value: unknown): string | undefined {
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

function toOptionalBooleanFlag(value: number | boolean | null | undefined): boolean | undefined {
    if (typeof value === "boolean") {
        return value;
    }

    if (typeof value === "number") {
        return value !== 0;
    }

    return undefined;
}

function toStringOrUndefined(value: number | string | null | undefined): string | undefined {
    if (value === null || value === undefined) {
        return undefined;
    }

    const normalized = String(value).trim();
    return normalized ? normalized : undefined;
}
