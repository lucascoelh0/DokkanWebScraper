"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mapAwakeningMedalWorldTournamentSourceFromFyi = exports.mapAwakeningMedalBabaShopSaleFromFyi = exports.mapAwakeningMedalZBattleSourceFromFyi = exports.mapAwakeningMedalStageSourceFromFyi = exports.mapAwakeningMedalAwakeningUsageFromFyi = exports.mapAwakeningMedalUsageFromFyi = exports.mapAwakeningMedalFromFyi = exports.mapAwakeningPathCharacterRefFromFyi = exports.mapAwakeningMedalRefFromFyi = exports.mapAwakeningPathRequirementFromFyi = exports.mapAwakeningPathStepFromFyi = exports.mapCharacterAwakeningPathFromFyi = exports.buildAwakeningMedalDataset = exports.buildAwakeningPathDataset = exports.writeDokkanFyiAwakeningDatasets = exports.getDokkanFyiAwakeningDatasets = void 0;
const promises_1 = require("fs/promises");
const path_1 = require("path");
const character_1 = require("./character");
const format_json_1 = require("./format-json");
const DOKKAN_FYI_BASE_URL = "https://dokkan.fyi";
class DokkanFyiAwakeningClient {
    version;
    async fetchCharacterIndex(limit) {
        const firstPage = await this.fetchCharacterIndexPage(1);
        const characters = [...(firstPage.props.characters?.data ?? [])];
        const lastPage = toOptionalNumber(firstPage.props.characters?.meta?.last_page) ?? 1;
        this.version = firstPage.version ?? this.version;
        for (let page = 2; page <= lastPage; page++) {
            const nextPage = await this.fetchCharacterIndexPage(page);
            this.version = nextPage.version ?? this.version;
            characters.push(...(nextPage.props.characters?.data ?? []));
            if (limit && characters.length >= limit) {
                break;
            }
        }
        return limit ? characters.slice(0, limit) : characters;
    }
    async fetchAwakeningPath(characterId) {
        const version = this.version ?? await this.fetchCurrentVersion(characterId);
        const response = await fetch(`${DOKKAN_FYI_BASE_URL}/characters/${characterId}`, {
            headers: {
                ...browserHeaders(),
                "X-Inertia": "true",
                "X-Requested-With": "XMLHttpRequest",
                "X-Inertia-Version": version,
                "X-Inertia-Partial-Component": "Character/CharacterShow",
                "X-Inertia-Partial-Data": "awakeningPath",
                "Accept": "application/json, text/plain, */*",
            },
        });
        if (response.status === 409) {
            this.version = await this.fetchCurrentVersion(characterId);
            return this.fetchAwakeningPath(characterId);
        }
        if (!response.ok) {
            throw new Error(`Could not fetch dokkan.fyi awakening path for ${characterId}: ${response.status}`);
        }
        const payload = JSON.parse(await response.text());
        return payload.props.awakeningPath ?? [];
    }
    async fetchAwakeningMedal(medalId) {
        const response = await fetch(`${DOKKAN_FYI_BASE_URL}/awakening-medals/${medalId}`, {
            headers: browserHeaders(),
        });
        if (!response.ok) {
            throw new Error(`Could not fetch dokkan.fyi awakening medal ${medalId}: ${response.status}`);
        }
        const html = await response.text();
        return extractPagePayload(html).props.awakening_medal;
    }
    async fetchCharacterIndexPage(page) {
        const query = new URLSearchParams({
            compact: "true",
            fully_awakened: "true",
            page: page.toString(),
        });
        const response = await fetch(`${DOKKAN_FYI_BASE_URL}/characters?${query.toString()}`, {
            headers: browserHeaders(),
        });
        if (!response.ok) {
            throw new Error(`Could not fetch dokkan.fyi character index page ${page}: ${response.status}`);
        }
        const html = await response.text();
        return extractPagePayload(html);
    }
    async fetchCurrentVersion(characterId) {
        const response = await fetch(`${DOKKAN_FYI_BASE_URL}/characters/${characterId}`, {
            headers: browserHeaders(),
        });
        if (!response.ok) {
            throw new Error(`Could not fetch dokkan.fyi character page ${characterId}: ${response.status}`);
        }
        const html = await response.text();
        const payload = extractPagePayload(html);
        if (!payload.version) {
            throw new Error(`Could not extract dokkan.fyi inertia version for character ${characterId}.`);
        }
        this.version = payload.version;
        return payload.version;
    }
}
async function getDokkanFyiAwakeningDatasets() {
    const client = new DokkanFyiAwakeningClient();
    const characters = await client.fetchCharacterIndex(requestedCharacterLimit());
    const paths = [];
    const medalIds = new Set();
    for (const character of characters) {
        const awakeningPath = await client.fetchAwakeningPath(character.id);
        if (awakeningPath.length === 0) {
            continue;
        }
        const mappedPath = mapCharacterAwakeningPathFromFyi(character, awakeningPath);
        for (const step of mappedPath.steps) {
            for (const requirement of step.requirements) {
                const medalId = toOptionalNumber(requirement.awakeningMedalId);
                if (medalId) {
                    medalIds.add(medalId);
                }
            }
        }
        paths.push(mappedPath);
    }
    const medalLimit = requestedMedalLimit();
    const limitedMedalIds = [...medalIds].sort((left, right) => left - right).slice(0, medalLimit ?? medalIds.size);
    const medals = [];
    for (const medalId of limitedMedalIds) {
        medals.push(mapAwakeningMedalFromFyi(await client.fetchAwakeningMedal(medalId)));
    }
    return {
        awakeningPaths: buildAwakeningPathDataset(paths),
        awakeningMedals: buildAwakeningMedalDataset(medals),
    };
}
exports.getDokkanFyiAwakeningDatasets = getDokkanFyiAwakeningDatasets;
async function writeDokkanFyiAwakeningDatasets() {
    const { awakeningPaths, awakeningMedals } = await getDokkanFyiAwakeningDatasets();
    const outputDir = (0, path_1.resolve)(__dirname, "data/awakening/latest");
    const pathsPath = (0, path_1.resolve)(outputDir, "awakening-paths.json");
    const medalsPath = (0, path_1.resolve)(outputDir, "awakening-medals.json");
    await (0, promises_1.mkdir)(outputDir, { recursive: true });
    await (0, format_json_1.writeFormattedJson)(pathsPath, awakeningPaths);
    await (0, format_json_1.writeFormattedJson)(medalsPath, awakeningMedals);
    return { pathsPath, medalsPath };
}
exports.writeDokkanFyiAwakeningDatasets = writeDokkanFyiAwakeningDatasets;
function buildAwakeningPathDataset(paths) {
    return {
        generatedAt: new Date().toISOString(),
        source: "dokkan.fyi",
        count: paths.length,
        paths: [...paths].sort((left, right) => left.name.localeCompare(right.name) || left.characterId.localeCompare(right.characterId)),
    };
}
exports.buildAwakeningPathDataset = buildAwakeningPathDataset;
function buildAwakeningMedalDataset(medals) {
    return {
        generatedAt: new Date().toISOString(),
        source: "dokkan.fyi",
        count: medals.length,
        medals: [...medals].sort((left, right) => left.name.localeCompare(right.name) || left.id.localeCompare(right.id)),
    };
}
exports.buildAwakeningMedalDataset = buildAwakeningMedalDataset;
function mapCharacterAwakeningPathFromFyi(character, awakeningPath) {
    return {
        characterId: character.id.toString(),
        canonicalId: toStringOrUndefined(character.canonical_id),
        baseCharacterId: toStringOrUndefined(character.base_character_id),
        name: cleanInlineText(character.name),
        rarity: rarityFromInput(character.rarity_text, character.rarity),
        type: typeFromInput(character.type_text, character.type),
        characterClass: classFromInput(character.awakening_type_text, character.awakening_type),
        hasEza: toOptionalBoolean(character.has_eza),
        hasSeza: toOptionalBoolean(character.has_seza),
        steps: awakeningPath.map(mapAwakeningPathStepFromFyi),
    };
}
exports.mapCharacterAwakeningPathFromFyi = mapCharacterAwakeningPathFromFyi;
function mapAwakeningPathStepFromFyi(step) {
    return {
        id: step.id.toString(),
        type: cleanInlineText(step.type) || undefined,
        ezaType: toOptionalNumber(step.eza_type),
        ezaStep: toOptionalNumber(step.eza_step),
        characterId: toStringOrUndefined(step.character_id),
        character: step.character ? mapAwakeningPathCharacterRefFromFyi(step.character) : undefined,
        awakenedCharacterId: toStringOrUndefined(step.awakened_character_id),
        awakenedCharacter: step.awakened_character ? mapAwakeningPathCharacterRefFromFyi(step.awakened_character) : undefined,
        requirements: (step.requirements ?? []).map(mapAwakeningPathRequirementFromFyi),
    };
}
exports.mapAwakeningPathStepFromFyi = mapAwakeningPathStepFromFyi;
function mapAwakeningPathRequirementFromFyi(requirement) {
    return {
        id: toStringOrUndefined(requirement.id) ?? "",
        awakeningMedalId: toStringOrUndefined(requirement.awakening_medal_id),
        quantity: toNumber(requirement.quantity),
        order: toOptionalNumber(requirement.order),
        awakeningMedal: requirement.awakening_medal ? mapAwakeningMedalRefFromFyi(requirement.awakening_medal) : undefined,
    };
}
exports.mapAwakeningPathRequirementFromFyi = mapAwakeningPathRequirementFromFyi;
function mapAwakeningMedalRefFromFyi(medal) {
    return {
        id: toStringOrUndefined(medal.id) ?? "",
        name: cleanInlineText(medal.name),
        description: cleanMultilineText(medal.description) || undefined,
        rarity: toOptionalNumber(medal.rarity),
        zeni: toOptionalNumber(medal.zeni),
        tradePoints: toOptionalNumber(medal.trade_points),
    };
}
exports.mapAwakeningMedalRefFromFyi = mapAwakeningMedalRefFromFyi;
function mapAwakeningPathCharacterRefFromFyi(character) {
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
exports.mapAwakeningPathCharacterRefFromFyi = mapAwakeningPathCharacterRefFromFyi;
function mapAwakeningMedalFromFyi(medal) {
    return {
        id: toStringOrUndefined(medal.id) ?? "",
        name: cleanInlineText(medal.name),
        description: cleanMultilineText(medal.description) || undefined,
        rarity: toOptionalNumber(medal.rarity),
        zeni: toOptionalNumber(medal.zeni),
        tradePoints: toOptionalNumber(medal.trade_points),
        usages: (medal.awakenings_awakening_items ?? []).map(mapAwakeningMedalUsageFromFyi),
        stages: (medal.stages ?? []).map(mapAwakeningMedalStageSourceFromFyi),
        zBattle: medal.z_battle ? mapAwakeningMedalZBattleSourceFromFyi(medal.z_battle) : undefined,
        babaShopSales: (medal.baba_shop_sales ?? []).map(mapAwakeningMedalBabaShopSaleFromFyi),
        worldTournaments: (medal.world_tournaments ?? []).map(mapAwakeningMedalWorldTournamentSourceFromFyi),
    };
}
exports.mapAwakeningMedalFromFyi = mapAwakeningMedalFromFyi;
function mapAwakeningMedalUsageFromFyi(usage) {
    return {
        id: toStringOrUndefined(usage.id) ?? "",
        itemId: toStringOrUndefined(usage.item_id),
        quantity: toNumber(usage.quantity),
        order: toOptionalNumber(usage.order),
        awakenings: (usage.awakenings ?? []).map(mapAwakeningMedalAwakeningUsageFromFyi),
    };
}
exports.mapAwakeningMedalUsageFromFyi = mapAwakeningMedalUsageFromFyi;
function mapAwakeningMedalAwakeningUsageFromFyi(usage) {
    return {
        id: toStringOrUndefined(usage.id) ?? "",
        characterId: toStringOrUndefined(usage.character_id),
        character: usage.character ? mapAwakeningPathCharacterRefFromFyi(usage.character) : undefined,
        awakenedCharacterId: toStringOrUndefined(usage.awakened_character_id),
        type: cleanInlineText(usage.type) || undefined,
        ezaType: toOptionalNumber(usage.eza_type),
        ezaStep: toOptionalNumber(usage.eza_step),
    };
}
exports.mapAwakeningMedalAwakeningUsageFromFyi = mapAwakeningMedalAwakeningUsageFromFyi;
function mapAwakeningMedalStageSourceFromFyi(stage) {
    return {
        id: toStringOrUndefined(stage.id) ?? "",
        difficulty: cleanInlineText(stage.difficulty) || undefined,
        stamina: toOptionalNumber(stage.stamina),
        requiredKeys: toOptionalNumber(stage.required_keys),
        rankExp: toOptionalNumber(stage.rank_exp),
        zeni: toOptionalNumber(stage.zeni),
        linkSkillLevelUpRate: toOptionalNumber(stage.link_skill_level_up_rate),
        questId: toStringOrUndefined(stage.quest_id),
        quest: stage.quest?.id ? {
            id: stage.quest.id.toString(),
            name: cleanInlineText(stage.quest.name),
            maxAttempts: toOptionalNumber(stage.quest.max_attempts),
            attemptsResetDays: toOptionalNumber(stage.quest.attempts_reset_days),
            isBoostable: toOptionalBoolean(stage.quest.is_boostable),
            startDate: cleanInlineText(stage.quest.start_date) || undefined,
            areaId: toStringOrUndefined(stage.quest.area_id),
            area: stage.quest.area?.id ? {
                id: stage.quest.area.id.toString(),
                name: cleanInlineText(stage.quest.area.name),
                type: cleanInlineText(stage.quest.area.type) || undefined,
                chapterId: toStringOrUndefined(stage.quest.area.chapter?.id),
                images: stage.quest.area.images ? {
                    header: cleanInlineText(stage.quest.area.images.header) || undefined,
                    banner: cleanInlineText(stage.quest.area.images.banner) || undefined,
                    button: cleanInlineText(stage.quest.area.images.button) || undefined,
                } : undefined,
            } : undefined,
        } : undefined,
    };
}
exports.mapAwakeningMedalStageSourceFromFyi = mapAwakeningMedalStageSourceFromFyi;
function mapAwakeningMedalZBattleSourceFromFyi(zBattle) {
    return {
        id: toStringOrUndefined(zBattle.id) ?? "",
        name: cleanInlineText(zBattle.name) || undefined,
        type: cleanInlineText(zBattle.type) || undefined,
        chapterId: toStringOrUndefined(zBattle.chapter?.id),
        images: zBattle.images ? {
            header: cleanInlineText(zBattle.images.header) || undefined,
            banner: cleanInlineText(zBattle.images.banner) || undefined,
            button: cleanInlineText(zBattle.images.button) || undefined,
        } : undefined,
    };
}
exports.mapAwakeningMedalZBattleSourceFromFyi = mapAwakeningMedalZBattleSourceFromFyi;
function mapAwakeningMedalBabaShopSaleFromFyi(sale) {
    return {
        id: toStringOrUndefined(sale.id) ?? "",
        discountedPrice: toOptionalNumber(sale.discounted_price),
        isSale: toOptionalBooleanFlag(sale.is_sale),
        isPremium: toOptionalBooleanFlag(sale.is_premium),
        buyable: toOptionalBooleanFlag(sale.buyable),
        buyableNum: toOptionalNumber(sale.buyable_num),
        currencyId: toStringOrUndefined(sale.currency_id),
        currencyType: cleanInlineText(sale.currency_type) || undefined,
        price: toOptionalNumber(sale.price),
        itemId: toStringOrUndefined(sale.item_id),
        itemType: cleanInlineText(sale.item_type) || undefined,
        itemQuantity: toOptionalNumber(sale.item_quantity),
        startAt: releaseDate(sale.start_at),
        endAt: releaseDate(sale.end_at),
        isDisplayRemainingTime: toOptionalBooleanFlag(sale.is_display_remaining_time),
    };
}
exports.mapAwakeningMedalBabaShopSaleFromFyi = mapAwakeningMedalBabaShopSaleFromFyi;
function mapAwakeningMedalWorldTournamentSourceFromFyi(source) {
    return {
        id: toStringOrUndefined(source.id) ?? "",
        budokaiRankingGiftSetId: toStringOrUndefined(source.budokai_ranking_gift_set_id),
        description: cleanMultilineText(source.description) || undefined,
        itemType: cleanInlineText(source.item_type) || undefined,
        itemId: toStringOrUndefined(source.item_id),
        quantity: toOptionalNumber(source.quantity),
        cardExpInit: toOptionalNumber(source.card_exp_init),
        budokaiRankingGiftSet: source.budokai_ranking_gift_set?.id ? {
            id: source.budokai_ranking_gift_set.id.toString(),
            budokaiId: toStringOrUndefined(source.budokai_ranking_gift_set.budokai_id),
            order: toOptionalNumber(source.budokai_ranking_gift_set.order),
            ranking: cleanInlineText(source.budokai_ranking_gift_set.ranking) || undefined,
        } : undefined,
    };
}
exports.mapAwakeningMedalWorldTournamentSourceFromFyi = mapAwakeningMedalWorldTournamentSourceFromFyi;
function requestedCharacterLimit() {
    return parseOptionalPositiveInt(process.env.DOKKAN_FYI_AWAKENING_PATH_CHARACTER_LIMIT);
}
function requestedMedalLimit() {
    return parseOptionalPositiveInt(process.env.DOKKAN_FYI_AWAKENING_MEDAL_LIMIT);
}
function parseOptionalPositiveInt(input) {
    const value = parseInt(input ?? "", 10);
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
function toOptionalBooleanFlag(value) {
    if (typeof value === "boolean") {
        return value;
    }
    if (typeof value === "number") {
        return value !== 0;
    }
    return undefined;
}
function toStringOrUndefined(value) {
    if (value === null || value === undefined) {
        return undefined;
    }
    const normalized = String(value).trim();
    return normalized ? normalized : undefined;
}
//# sourceMappingURL=fyi-awakening-paths.js.map