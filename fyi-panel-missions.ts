import { mkdir } from "fs/promises";
import { resolve } from "path";
import { Classes, Rarities, Types } from "./character";
import { writeFormattedJson } from "./format-json";
import {
    PanelMissionBoard,
    PanelMissionCampaign,
    PanelMissionCharacterRef,
    PanelMissionDataset,
    PanelMissionEntry,
    PanelMissionReward,
} from "./panel-mission";

const DOKKAN_FYI_BASE_URL = "https://dokkan.fyi";

interface FyiPanelMissionsPagePayload {
    component: string,
    props: {
        campaigns: FyiPanelCampaign[],
    },
}

interface FyiMissionShowPagePayload {
    component: string,
    props: {
        category: FyiMissionCategoryDetail,
    },
}

interface FyiPanelCampaign {
    id: number,
    name?: string | null,
    ends_at?: string | null,
    is_indefinite?: boolean | null,
    img?: string | null,
    category_ids?: number[] | null,
    categories?: FyiMissionCategorySummary[] | null,
}

interface FyiMissionCategorySummary {
    id: number,
    type?: string | null,
    ends_at?: string | null,
    is_indefinite?: boolean | null,
    priority?: number | null,
    img?: string | null,
    missions_count?: number | null,
    completed_count?: number | null,
}

interface FyiMissionCategoryDetail extends FyiMissionCategorySummary {
    mission_ids?: number[] | null,
    missions?: FyiMission[] | null,
    campaign?: FyiPanelCampaign | null,
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
    item?: {
        id?: number | null,
        name?: string | null,
        description?: string | null,
        rarity?: number | null,
        zeni?: number | null,
        trade_points?: number | null,
        type?: string | null,
        amount?: number | null,
    } | null,
    quantity?: number | null,
    mission_id?: number | null,
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

class DokkanFyiPanelMissionClient {
    async fetchCampaigns(): Promise<FyiPanelCampaign[]> {
        const response = await fetch(`${DOKKAN_FYI_BASE_URL}/missions/panel`, {
            headers: browserHeaders(),
        });

        if (!response.ok) {
            throw new Error(`Could not fetch dokkan.fyi panel missions: ${response.status}`);
        }

        const html = await response.text();
        const payload = extractPagePayload<FyiPanelMissionsPagePayload>(html);
        return payload.props.campaigns ?? [];
    }

    async fetchBoard(boardId: number): Promise<FyiMissionCategoryDetail> {
        const response = await fetch(`${DOKKAN_FYI_BASE_URL}/missions/${boardId}`, {
            headers: browserHeaders(),
        });

        if (!response.ok) {
            throw new Error(`Could not fetch dokkan.fyi mission board ${boardId}: ${response.status}`);
        }

        const html = await response.text();
        const payload = extractPagePayload<FyiMissionShowPagePayload>(html);
        return payload.props.category;
    }
}

export async function getDokkanFyiPanelMissions(): Promise<PanelMissionDataset> {
    const client = new DokkanFyiPanelMissionClient();
    const campaigns = await client.fetchCampaigns();
    const categoryLimit = requestedPanelMissionBoardLimit();

    const normalizedCampaigns: PanelMissionCampaign[] = [];

    for (const campaign of campaigns.slice(0, requestedPanelMissionCampaignLimit() ?? campaigns.length)) {
        const boardIds = (campaign.category_ids ?? []).slice(0, categoryLimit ?? undefined);
        const boardSummaries = new Map((campaign.categories ?? []).map(category => [category.id, category]));
        const boards: PanelMissionBoard[] = [];

        for (const boardId of boardIds) {
            const detail = await client.fetchBoard(boardId);
            boards.push(mapPanelMissionBoardFromFyi(detail, boardSummaries.get(boardId)));
        }

        normalizedCampaigns.push(mapPanelMissionCampaignFromFyi(campaign, boards));
    }

    return buildPanelMissionDataset(normalizedCampaigns);
}

export async function writeDokkanFyiPanelMissions(): Promise<string> {
    const dataset = await getDokkanFyiPanelMissions();
    const outputDir = resolve(__dirname, "data/panel-missions/latest");
    const outputPath = resolve(outputDir, "panel-missions.json");

    await mkdir(outputDir, { recursive: true });
    await writeFormattedJson(outputPath, dataset);

    return outputPath;
}

export function buildPanelMissionDataset(campaigns: PanelMissionCampaign[]): PanelMissionDataset {
    const boards = campaigns.flatMap(campaign => campaign.boards);
    const missions = boards.flatMap(board => board.missions);

    return {
        generatedAt: new Date().toISOString(),
        source: "dokkan.fyi",
        campaignCount: campaigns.length,
        boardCount: boards.length,
        missionCount: missions.length,
        campaigns: [...campaigns].sort((left, right) => left.name.localeCompare(right.name) || left.id.localeCompare(right.id)),
    };
}

export function mapPanelMissionCampaignFromFyi(
    campaign: FyiPanelCampaign,
    boards: PanelMissionBoard[],
): PanelMissionCampaign {
    return {
        id: campaign.id.toString(),
        name: cleanInlineText(campaign.name),
        endsAt: releaseDate(campaign.ends_at),
        isIndefinite: Boolean(campaign.is_indefinite),
        imageUrl: cleanInlineText(campaign.img) || undefined,
        categoryIds: (campaign.category_ids ?? []).map(id => id.toString()),
        boards,
    };
}

export function mapPanelMissionBoardFromFyi(
    detail: FyiMissionCategoryDetail,
    summary?: FyiMissionCategorySummary,
): PanelMissionBoard {
    return {
        id: detail.id.toString(),
        type: cleanInlineText(detail.type ?? summary?.type),
        endsAt: releaseDate(detail.ends_at ?? summary?.ends_at),
        isIndefinite: toOptionalBoolean(detail.is_indefinite ?? summary?.is_indefinite),
        priority: toOptionalNumber(detail.priority ?? summary?.priority),
        imageUrl: cleanInlineText(detail.img ?? summary?.img) || undefined,
        missionsCount: toOptionalNumber(detail.missions_count ?? summary?.missions_count),
        completedCount: toOptionalNumber(detail.completed_count ?? summary?.completed_count),
        missions: (detail.missions ?? []).map(mapPanelMissionEntryFromFyi),
    };
}

export function mapPanelMissionEntryFromFyi(mission: FyiMission): PanelMissionEntry {
    return {
        id: mission.id.toString(),
        type: cleanInlineText(mission.type),
        name: cleanMultilineText(mission.name),
        description: htmlToText(mission.description),
        priority: toOptionalNumber(mission.priority),
        startsAt: releaseDate(mission.starts_at),
        endsAt: releaseDate(mission.ends_at),
        categoryId: toStringOrUndefined(mission.category_id),
        completed: toOptionalBoolean(mission.completed),
        rewards: (mission.rewards ?? []).map(mapPanelMissionRewardFromFyi),
        characters: (mission.characters ?? []).map(mapPanelMissionCharacterRefFromFyi),
    };
}

export function mapPanelMissionRewardFromFyi(reward: FyiMissionRewardPayload): PanelMissionReward {
    return {
        id: toStringOrUndefined(reward.id),
        missionId: toStringOrUndefined(reward.mission_id),
        itemId: toStringOrUndefined(reward.item_id ?? reward.item?.id),
        itemType: cleanInlineText(reward.item_type),
        quantity: toNumber(reward.quantity),
        name: cleanInlineText(reward.item?.name),
        description: cleanMultilineText(reward.item?.description),
        rarity: toOptionalNumber(reward.item?.rarity),
        zeni: toOptionalNumber(reward.item?.zeni),
        tradePoints: toOptionalNumber(reward.item?.trade_points),
        rewardType: cleanInlineText(reward.item?.type),
        amount: toOptionalNumber(reward.item?.amount),
    };
}

export function mapPanelMissionCharacterRefFromFyi(character: FyiCharacterSummary): PanelMissionCharacterRef {
    return {
        id: toNumber(character.id).toString(),
        canonicalId: toStringOrUndefined(character.canonical_id),
        baseCharacterId: toStringOrUndefined(character.base_character_id),
        characterId: toStringOrUndefined(character.character_id),
        name: cleanInlineText(character.name),
        rarity: rarityFromInput(character.rarity_text, character.rarity),
        type: typeFromInput(character.type_text, character.type),
        characterClass: classFromInput(character.awakening_type_text, character.awakening_type),
        thumbnailId: toStringOrUndefined(character.thumbnail_id),
        portraitUrl: portraitUrl(character.thumbnail_id),
        latestReleaseType: cleanInlineText(character.release_dates?.latest_type),
        hasEza: toOptionalBoolean(character.has_eza),
        hasSeza: toOptionalBoolean(character.has_seza),
        isReversiblyExchanged: toOptionalBoolean(character.is_reversibly_exchanged),
        isFreelyObtainable: toOptionalBoolean(character.is_freely_obtainable),
    };
}

function requestedPanelMissionCampaignLimit(): number | undefined {
    const value = parseInt(process.env.DOKKAN_FYI_PANEL_MISSION_CAMPAIGN_LIMIT ?? "", 10);
    return Number.isFinite(value) && value > 0 ? value : undefined;
}

function requestedPanelMissionBoardLimit(): number | undefined {
    const value = parseInt(process.env.DOKKAN_FYI_PANEL_MISSION_BOARD_LIMIT ?? "", 10);
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

function portraitUrl(thumbnailId: number | null | undefined): string | undefined {
    const id = toOptionalNumber(thumbnailId);
    if (!id) {
        return undefined;
    }

    return `https://cdn.dokkan.fyi/assets/en/character/thumb/card_${id}_thumb/card_${id}_thumb.png`;
}

function rarityFromInput(text: string | null | undefined, value: number | null | undefined): Rarities | undefined {
    const normalized = cleanInlineText(text).toUpperCase();
    switch (normalized) {
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
    const normalized = cleanInlineText(text).toUpperCase();
    switch (normalized) {
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
    const normalized = cleanInlineText(text).toLowerCase();
    if (normalized === "super") {
        return Classes.Super;
    }

    if (normalized === "extreme") {
        return Classes.Extreme;
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

function releaseDate(value: string | null | undefined): string | undefined {
    const normalized = cleanInlineText(value);
    if (!normalized) {
        return undefined;
    }

    const parsed = new Date(normalized);
    if (Number.isNaN(parsed.getTime())) {
        return undefined;
    }

    return parsed.toISOString();
}

function htmlToText(value: string | null | undefined): string {
    if (!value) {
        return "";
    }

    return value
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<\/div>/gi, "\n")
        .replace(/<[^>]+>/g, " ")
        .replace(/&#039;/g, "'")
        .replace(/&quot;/g, "\"")
        .replace(/&amp;/g, "&")
        .split("\n")
        .map(line => line.replace(/\s+/g, " ").trim())
        .filter(Boolean)
        .join("\n")
        .trim();
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

function toOptionalNumber(value: number | string | boolean | null | undefined): number | undefined {
    if (typeof value === "boolean") {
        return value ? 1 : 0;
    }

    const parsed = toNumber(value);
    return parsed === 0 && value !== 0 && value !== "0" ? undefined : parsed;
}

function toOptionalBoolean(value: boolean | null | undefined): boolean | undefined {
    return typeof value === "boolean" ? value : undefined;
}

function toStringOrUndefined(value: number | string | null | undefined): string | undefined {
    if (typeof value === "number") {
        return Number.isFinite(value) ? value.toString() : undefined;
    }

    if (typeof value === "string") {
        const normalized = value.trim();
        return normalized ? normalized : undefined;
    }

    return undefined;
}
