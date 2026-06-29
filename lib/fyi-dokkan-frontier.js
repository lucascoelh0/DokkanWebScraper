"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mapFrontierCharacterRefFromFyi = exports.mapFrontierGroupExchangeStepFromFyi = exports.mapFrontierRewardFromFyi = exports.mapFrontierMissionFromFyi = exports.mapFrontierSkillFromFyi = exports.mapFrontierEnemyFromFyi = exports.mapFrontierEnemyRoundFromFyi = exports.mapFrontierNamedEffectFromFyi = exports.mapFrontierIntensityEffectFromFyi = exports.mapFrontierUnlockMissionFromFyi = exports.mapFrontierNodeFromFyi = exports.mapFrontierPageFromFyi = exports.mapFrontierChapterFromFyi = exports.mapFrontierChapterSummaryFromFyi = exports.mapFrontierSeriesSummaryFromFyi = exports.buildDokkanFrontierChaptersDataset = exports.buildDokkanFrontierSeriesDataset = exports.writeDokkanFyiFrontierDatasets = exports.getDokkanFyiFrontierChaptersDataset = exports.getDokkanFyiFrontierSeriesDataset = void 0;
const promises_1 = require("fs/promises");
const path_1 = require("path");
const character_1 = require("./character");
const format_json_1 = require("./format-json");
const DOKKAN_FYI_BASE_URL = "https://dokkan.fyi";
class DokkanFyiFrontierClient {
    async fetchSeries() {
        const response = await fetch(`${DOKKAN_FYI_BASE_URL}/dokkan-frontier`, {
            headers: browserHeaders(),
        });
        if (!response.ok) {
            throw new Error(`Could not fetch dokkan.fyi frontier index: ${response.status}`);
        }
        const html = await response.text();
        const payload = extractPagePayload(html);
        return payload.props.series ?? [];
    }
    async fetchChapter(seriesId, chapterId) {
        const response = await fetch(`${DOKKAN_FYI_BASE_URL}/dokkan-frontier/${seriesId}/chapters/${chapterId}`, {
            headers: browserHeaders(),
        });
        if (!response.ok) {
            throw new Error(`Could not fetch dokkan.fyi frontier chapter ${seriesId}/${chapterId}: ${response.status}`);
        }
        const html = await response.text();
        return extractPagePayload(html);
    }
}
async function getDokkanFyiFrontierSeriesDataset() {
    const client = new DokkanFyiFrontierClient();
    const series = await client.fetchSeries();
    const limited = applyLimit(series, requestedSeriesLimit());
    return buildDokkanFrontierSeriesDataset(limited.map(mapFrontierSeriesSummaryFromFyi));
}
exports.getDokkanFyiFrontierSeriesDataset = getDokkanFyiFrontierSeriesDataset;
async function getDokkanFyiFrontierChaptersDataset() {
    const client = new DokkanFyiFrontierClient();
    const series = applyLimit(await client.fetchSeries(), requestedSeriesLimit());
    const chapterLimit = requestedChapterLimit();
    const chapters = [];
    for (const entry of series) {
        const chapterIds = applyLimit(entry.chapters ?? [], chapterLimit);
        for (const chapter of chapterIds) {
            const payload = await client.fetchChapter(entry.id, chapter.id);
            chapters.push(mapFrontierChapterFromFyi(payload));
        }
    }
    return buildDokkanFrontierChaptersDataset(chapters);
}
exports.getDokkanFyiFrontierChaptersDataset = getDokkanFyiFrontierChaptersDataset;
async function writeDokkanFyiFrontierDatasets() {
    const [seriesDataset, chaptersDataset] = await Promise.all([
        getDokkanFyiFrontierSeriesDataset(),
        getDokkanFyiFrontierChaptersDataset(),
    ]);
    const outputDir = (0, path_1.resolve)(__dirname, "data/dokkan-frontier/latest");
    const seriesPath = (0, path_1.resolve)(outputDir, "dokkan-frontier-series.json");
    const chaptersPath = (0, path_1.resolve)(outputDir, "dokkan-frontier-chapters.json");
    await (0, promises_1.mkdir)(outputDir, { recursive: true });
    await (0, format_json_1.writeFormattedJson)(seriesPath, seriesDataset);
    await (0, format_json_1.writeFormattedJson)(chaptersPath, chaptersDataset);
    return { seriesPath, chaptersPath };
}
exports.writeDokkanFyiFrontierDatasets = writeDokkanFyiFrontierDatasets;
function buildDokkanFrontierSeriesDataset(series) {
    return {
        generatedAt: new Date().toISOString(),
        source: "dokkan.fyi",
        count: series.length,
        series: [...series].sort((left, right) => (right.priority ?? 0) - (left.priority ?? 0) || left.id.localeCompare(right.id)),
    };
}
exports.buildDokkanFrontierSeriesDataset = buildDokkanFrontierSeriesDataset;
function buildDokkanFrontierChaptersDataset(chapters) {
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
exports.buildDokkanFrontierChaptersDataset = buildDokkanFrontierChaptersDataset;
function mapFrontierSeriesSummaryFromFyi(series) {
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
exports.mapFrontierSeriesSummaryFromFyi = mapFrontierSeriesSummaryFromFyi;
function mapFrontierChapterSummaryFromFyi(chapter) {
    return {
        id: chapter.id.toString(),
        name: cleanInlineText(chapter.name),
        bannerImagePath: cleanInlineText(chapter.banner_image_path) || undefined,
        priority: toOptionalNumber(chapter.priority),
    };
}
exports.mapFrontierChapterSummaryFromFyi = mapFrontierChapterSummaryFromFyi;
function mapFrontierChapterFromFyi(payload) {
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
exports.mapFrontierChapterFromFyi = mapFrontierChapterFromFyi;
function mapFrontierPageFromFyi(page) {
    return {
        id: page.id.toString(),
        pageNumber: toOptionalNumber(page.page_number),
        backgroundImagePath: cleanInlineText(page.background_image_path) || undefined,
        nodes: (page.nodes ?? []).map(mapFrontierNodeFromFyi),
    };
}
exports.mapFrontierPageFromFyi = mapFrontierPageFromFyi;
function mapFrontierNodeFromFyi(node) {
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
exports.mapFrontierNodeFromFyi = mapFrontierNodeFromFyi;
function mapFrontierUnlockMissionFromFyi(mission) {
    return {
        id: toStringOrUndefined(mission.id) ?? "",
        description: cleanMultilineText(mission.description),
    };
}
exports.mapFrontierUnlockMissionFromFyi = mapFrontierUnlockMissionFromFyi;
function mapFrontierIntensityEffectFromFyi(effect) {
    return {
        level: toOptionalNumber(effect.level),
        skill: mapFrontierNamedEffectFromFyi(effect.skill),
    };
}
exports.mapFrontierIntensityEffectFromFyi = mapFrontierIntensityEffectFromFyi;
function mapFrontierNamedEffectFromFyi(effect) {
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
exports.mapFrontierNamedEffectFromFyi = mapFrontierNamedEffectFromFyi;
function mapFrontierEnemyRoundFromFyi(round) {
    return {
        roundNumber: toOptionalNumber(round.round_no),
        enemies: (round.enemies ?? []).map(mapFrontierEnemyFromFyi),
    };
}
exports.mapFrontierEnemyRoundFromFyi = mapFrontierEnemyRoundFromFyi;
function mapFrontierEnemyFromFyi(enemy) {
    return {
        character: enemy.card ? mapFrontierCharacterRefFromFyi(enemy.card) : undefined,
        skills: (enemy.skills ?? []).map(mapFrontierSkillFromFyi),
    };
}
exports.mapFrontierEnemyFromFyi = mapFrontierEnemyFromFyi;
function mapFrontierSkillFromFyi(skill) {
    return {
        id: toStringOrUndefined(skill.id),
        name: cleanInlineText(skill.name) || undefined,
        description: cleanMultilineText(skill.description) || undefined,
    };
}
exports.mapFrontierSkillFromFyi = mapFrontierSkillFromFyi;
function mapFrontierMissionFromFyi(mission) {
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
exports.mapFrontierMissionFromFyi = mapFrontierMissionFromFyi;
function mapFrontierRewardFromFyi(reward) {
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
exports.mapFrontierRewardFromFyi = mapFrontierRewardFromFyi;
function mapFrontierGroupExchangeStepFromFyi(step) {
    return {
        charge: toOptionalNumber(step.charge),
        description: cleanMultilineText(step.description),
    };
}
exports.mapFrontierGroupExchangeStepFromFyi = mapFrontierGroupExchangeStepFromFyi;
function mapFrontierCharacterRefFromFyi(character) {
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
exports.mapFrontierCharacterRefFromFyi = mapFrontierCharacterRefFromFyi;
function requestedSeriesLimit() {
    return parseOptionalPositiveInt(process.env.DOKKAN_FYI_FRONTIER_SERIES_LIMIT);
}
function requestedChapterLimit() {
    return parseOptionalPositiveInt(process.env.DOKKAN_FYI_FRONTIER_CHAPTER_LIMIT);
}
function parseOptionalPositiveInt(input) {
    const value = parseInt(input ?? "", 10);
    return Number.isFinite(value) && value > 0 ? value : undefined;
}
function applyLimit(values, limit) {
    return limit ? values.slice(0, limit) : values;
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
function cleanInlineText(value) {
    if (value === null || value === undefined) {
        return "";
    }
    return String(value).replace(/\s+/g, " ").trim();
}
function cleanMultilineText(value) {
    return String(value ?? "")
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/\r/g, "")
        .split("\n")
        .map(line => cleanInlineText(line))
        .filter(Boolean)
        .join("\n");
}
function htmlToText(value) {
    return cleanMultilineText(String(value ?? "")
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<\/p>/gi, "\n")
        .replace(/<[^>]+>/g, ""));
}
function releaseDate(value) {
    const normalized = cleanInlineText(value);
    return normalized ? new Date(normalized).toISOString() : undefined;
}
function portraitUrl(thumbnailId) {
    const id = toOptionalNumber(thumbnailId);
    if (!id) {
        return undefined;
    }
    return `https://cdn.dokkan.fyi/assets/en/character/thumb/card_${id}_thumb/card_${id}_thumb.png`;
}
function rarityFromInput(text, value) {
    switch (cleanInlineText(text).toUpperCase()) {
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
    switch (cleanInlineText(text).toUpperCase()) {
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
    switch (cleanInlineText(text).toUpperCase()) {
        case "SUPER":
            return character_1.Classes.Super;
        case "EXTREME":
            return character_1.Classes.Extreme;
        default:
            break;
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
function toNumber(value) {
    if (typeof value === "number" && Number.isFinite(value)) {
        return value;
    }
    if (typeof value === "string") {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : 0;
    }
    return 0;
}
function toOptionalNumber(value) {
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
function toOptionalBoolean(value) {
    return typeof value === "boolean" ? value : undefined;
}
function toStringOrUndefined(value) {
    if (value === null || value === undefined) {
        return undefined;
    }
    const normalized = String(value).trim();
    return normalized ? normalized : undefined;
}
//# sourceMappingURL=fyi-dokkan-frontier.js.map