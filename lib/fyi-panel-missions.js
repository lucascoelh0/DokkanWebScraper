"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mapPanelMissionCharacterRefFromFyi = exports.mapPanelMissionRewardFromFyi = exports.mapPanelMissionEntryFromFyi = exports.mapPanelMissionBoardFromFyi = exports.mapPanelMissionCampaignFromFyi = exports.buildPanelMissionDataset = exports.writeDokkanFyiPanelMissions = exports.getDokkanFyiPanelMissions = void 0;
const promises_1 = require("fs/promises");
const path_1 = require("path");
const character_1 = require("./character");
const format_json_1 = require("./format-json");
const DOKKAN_FYI_BASE_URL = "https://dokkan.fyi";
class DokkanFyiPanelMissionClient {
    async fetchCampaigns() {
        const response = await fetch(`${DOKKAN_FYI_BASE_URL}/missions/panel`, {
            headers: browserHeaders(),
        });
        if (!response.ok) {
            throw new Error(`Could not fetch dokkan.fyi panel missions: ${response.status}`);
        }
        const html = await response.text();
        const payload = extractPagePayload(html);
        return payload.props.campaigns ?? [];
    }
    async fetchBoard(boardId) {
        const response = await fetch(`${DOKKAN_FYI_BASE_URL}/missions/${boardId}`, {
            headers: browserHeaders(),
        });
        if (!response.ok) {
            throw new Error(`Could not fetch dokkan.fyi mission board ${boardId}: ${response.status}`);
        }
        const html = await response.text();
        const payload = extractPagePayload(html);
        return payload.props.category;
    }
}
async function getDokkanFyiPanelMissions() {
    const client = new DokkanFyiPanelMissionClient();
    const campaigns = await client.fetchCampaigns();
    const categoryLimit = requestedPanelMissionBoardLimit();
    const normalizedCampaigns = [];
    for (const campaign of campaigns.slice(0, requestedPanelMissionCampaignLimit() ?? campaigns.length)) {
        const boardIds = (campaign.category_ids ?? []).slice(0, categoryLimit ?? undefined);
        const boardSummaries = new Map((campaign.categories ?? []).map(category => [category.id, category]));
        const boards = [];
        for (const boardId of boardIds) {
            const detail = await client.fetchBoard(boardId);
            boards.push(mapPanelMissionBoardFromFyi(detail, boardSummaries.get(boardId)));
        }
        normalizedCampaigns.push(mapPanelMissionCampaignFromFyi(campaign, boards));
    }
    return buildPanelMissionDataset(normalizedCampaigns);
}
exports.getDokkanFyiPanelMissions = getDokkanFyiPanelMissions;
async function writeDokkanFyiPanelMissions() {
    const dataset = await getDokkanFyiPanelMissions();
    const outputDir = (0, path_1.resolve)(__dirname, "data/panel-missions/latest");
    const outputPath = (0, path_1.resolve)(outputDir, "panel-missions.json");
    await (0, promises_1.mkdir)(outputDir, { recursive: true });
    await (0, format_json_1.writeFormattedJson)(outputPath, dataset);
    return outputPath;
}
exports.writeDokkanFyiPanelMissions = writeDokkanFyiPanelMissions;
function buildPanelMissionDataset(campaigns) {
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
exports.buildPanelMissionDataset = buildPanelMissionDataset;
function mapPanelMissionCampaignFromFyi(campaign, boards) {
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
exports.mapPanelMissionCampaignFromFyi = mapPanelMissionCampaignFromFyi;
function mapPanelMissionBoardFromFyi(detail, summary) {
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
exports.mapPanelMissionBoardFromFyi = mapPanelMissionBoardFromFyi;
function mapPanelMissionEntryFromFyi(mission) {
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
exports.mapPanelMissionEntryFromFyi = mapPanelMissionEntryFromFyi;
function mapPanelMissionRewardFromFyi(reward) {
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
exports.mapPanelMissionRewardFromFyi = mapPanelMissionRewardFromFyi;
function mapPanelMissionCharacterRefFromFyi(character) {
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
exports.mapPanelMissionCharacterRefFromFyi = mapPanelMissionCharacterRefFromFyi;
function requestedPanelMissionCampaignLimit() {
    const value = parseInt(process.env.DOKKAN_FYI_PANEL_MISSION_CAMPAIGN_LIMIT ?? "", 10);
    return Number.isFinite(value) && value > 0 ? value : undefined;
}
function requestedPanelMissionBoardLimit() {
    const value = parseInt(process.env.DOKKAN_FYI_PANEL_MISSION_BOARD_LIMIT ?? "", 10);
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
function portraitUrl(thumbnailId) {
    const id = toOptionalNumber(thumbnailId);
    if (!id) {
        return undefined;
    }
    return `https://cdn.dokkan.fyi/assets/en/character/thumb/card_${id}_thumb/card_${id}_thumb.png`;
}
function rarityFromInput(text, value) {
    const normalized = cleanInlineText(text).toUpperCase();
    switch (normalized) {
        case "LR":
            return character_1.Rarities.LR;
        case "UR":
            return character_1.Rarities.UR;
        case "SSR":
            return character_1.Rarities.SSR;
        case "SR":
            return character_1.Rarities.SR;
        case "R":
            return character_1.Rarities.R;
        case "N":
            return character_1.Rarities.N;
        default:
            break;
    }
    switch (toNumber(value)) {
        case 5:
            return character_1.Rarities.LR;
        case 4:
            return character_1.Rarities.UR;
        case 3:
            return character_1.Rarities.SSR;
        case 2:
            return character_1.Rarities.SR;
        case 1:
            return character_1.Rarities.R;
        default:
            return undefined;
    }
}
function typeFromInput(text, value) {
    const normalized = cleanInlineText(text).toUpperCase();
    switch (normalized) {
        case "AGL":
            return character_1.Types.AGL;
        case "TEQ":
            return character_1.Types.TEQ;
        case "INT":
            return character_1.Types.INT;
        case "STR":
            return character_1.Types.STR;
        case "PHY":
            return character_1.Types.PHY;
        default:
            break;
    }
    switch (toNumber(value)) {
        case 0:
            return character_1.Types.AGL;
        case 1:
            return character_1.Types.TEQ;
        case 2:
            return character_1.Types.INT;
        case 3:
            return character_1.Types.STR;
        case 4:
            return character_1.Types.PHY;
        default:
            return undefined;
    }
}
function classFromInput(text, value) {
    const normalized = cleanInlineText(text).toLowerCase();
    if (normalized === "super") {
        return character_1.Classes.Super;
    }
    if (normalized === "extreme") {
        return character_1.Classes.Extreme;
    }
    switch (toNumber(value)) {
        case 1:
            return character_1.Classes.Super;
        case 2:
            return character_1.Classes.Extreme;
        default:
            return undefined;
    }
}
function releaseDate(value) {
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
function htmlToText(value) {
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
    if (typeof value === "boolean") {
        return value ? 1 : 0;
    }
    const parsed = toNumber(value);
    return parsed === 0 && value !== 0 && value !== "0" ? undefined : parsed;
}
function toOptionalBoolean(value) {
    return typeof value === "boolean" ? value : undefined;
}
function toStringOrUndefined(value) {
    if (typeof value === "number") {
        return Number.isFinite(value) ? value.toString() : undefined;
    }
    if (typeof value === "string") {
        const normalized = value.trim();
        return normalized ? normalized : undefined;
    }
    return undefined;
}
//# sourceMappingURL=fyi-panel-missions.js.map