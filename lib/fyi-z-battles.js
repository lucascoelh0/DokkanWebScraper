"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.missionRewardsFromFyi = exports.mapMissionCategoryFromFyi = exports.mapNamedRefFromFyi = exports.mapBeneficialItemFromFyi = exports.mapRewardFromFyi = exports.mapRewardCheckpointFromFyi = exports.mapEnemySkillFromFyi = exports.mapZBattleLevelFromFyi = exports.mapValueEscalationFromFyi = exports.mapSkillEscalationFromFyi = exports.mapCardEscalationFromFyi = exports.mapEnemyProfileFromFyi = exports.mapCharacterRefFromFyi = exports.mapZBattleImagesFromFyi = exports.mapZBattlePhaseFromFyi = exports.mapZBattleFromFyi = exports.buildZBattleDataset = exports.writeDokkanFyiZBattles = exports.getDokkanFyiZBattles = void 0;
const promises_1 = require("fs/promises");
const path_1 = require("path");
const character_1 = require("./character");
const format_json_1 = require("./format-json");
const DOKKAN_FYI_BASE_URL = "https://dokkan.fyi";
const DOKKAN_FYI_CDN_BASE_URL = "https://cdn.dokkan.fyi/assets";
class DokkanFyiZBattleClient {
    async fetchIndexBattleIds(limit) {
        const firstPage = await this.fetchIndexPage(1);
        const ids = [...(firstPage.props.stages?.data ?? []).map(stage => stage.id)];
        const lastPage = toOptionalNumber(firstPage.props.stages?.meta?.last_page) ?? 1;
        for (let page = 2; page <= lastPage; page++) {
            const nextPage = await this.fetchIndexPage(page);
            ids.push(...(nextPage.props.stages?.data ?? []).map(stage => stage.id));
            if (limit && ids.length >= limit) {
                break;
            }
        }
        const uniqueIds = Array.from(new Set(ids));
        return limit ? uniqueIds.slice(0, limit) : uniqueIds;
    }
    async fetchBattle(battleId) {
        const basePayload = await this.fetchBattlePage(battleId, 1);
        const mergedPayload = await this.expandBattleCharacterPages(battleId, basePayload);
        return mapZBattleFromFyi(mergedPayload, battleId);
    }
    async expandBattleCharacterPages(battleId, page) {
        const normalLastPage = toOptionalNumber(page.props.beneficialCharacters?.meta?.last_page) ?? 1;
        const superLastPage = toOptionalNumber(page.props.superBeneficialCharacters?.meta?.last_page) ?? 1;
        const lastPage = Math.max(normalLastPage, superLastPage);
        if (lastPage <= 1) {
            return page;
        }
        const normalCharacters = [...(page.props.beneficialCharacters?.data ?? [])];
        const superCharacters = [...(page.props.superBeneficialCharacters?.data ?? [])];
        for (let characterPage = 2; characterPage <= lastPage; characterPage++) {
            const nextPage = await this.fetchBattlePage(battleId, characterPage);
            normalCharacters.push(...(nextPage.props.beneficialCharacters?.data ?? []));
            superCharacters.push(...(nextPage.props.superBeneficialCharacters?.data ?? []));
        }
        if (page.props.beneficialCharacters) {
            page.props.beneficialCharacters.data = dedupeCharacters(normalCharacters);
        }
        if (page.props.superBeneficialCharacters) {
            page.props.superBeneficialCharacters.data = dedupeCharacters(superCharacters);
        }
        return page;
    }
    async fetchIndexPage(page) {
        const query = new URLSearchParams({ page: page.toString() });
        const response = await fetch(`${DOKKAN_FYI_BASE_URL}/z-battles?${query.toString()}`, {
            headers: browserHeaders(),
        });
        if (!response.ok) {
            throw new Error(`Could not fetch dokkan.fyi z-battles index page ${page}: ${response.status}`);
        }
        const html = await response.text();
        return extractPagePayload(html);
    }
    async fetchBattlePage(battleId, characterPage) {
        const query = characterPage > 1
            ? `?${new URLSearchParams({ characters: characterPage.toString() }).toString()}`
            : "";
        const response = await fetch(`${DOKKAN_FYI_BASE_URL}/z-battles/${battleId}${query}`, {
            headers: browserHeaders(),
        });
        if (!response.ok) {
            throw new Error(`Could not fetch dokkan.fyi z-battle ${battleId}: ${response.status}`);
        }
        const html = await response.text();
        return extractPagePayload(html);
    }
}
async function getDokkanFyiZBattles() {
    const client = new DokkanFyiZBattleClient();
    const requestedIds = requestedBattleIds();
    const limit = requestedBattleLimit();
    const battleIds = requestedIds.length > 0
        ? requestedIds
        : await client.fetchIndexBattleIds(limit);
    const battles = [];
    for (const battleId of battleIds) {
        battles.push(await client.fetchBattle(battleId));
    }
    return buildZBattleDataset(battles);
}
exports.getDokkanFyiZBattles = getDokkanFyiZBattles;
async function writeDokkanFyiZBattles() {
    const dataset = await getDokkanFyiZBattles();
    const outputDir = (0, path_1.resolve)(__dirname, "data/z-battles/latest");
    const outputPath = (0, path_1.resolve)(outputDir, "z-battles.json");
    await (0, promises_1.mkdir)(outputDir, { recursive: true });
    await (0, format_json_1.writeFormattedJson)(outputPath, dataset);
    return outputPath;
}
exports.writeDokkanFyiZBattles = writeDokkanFyiZBattles;
function buildZBattleDataset(battles) {
    return {
        generatedAt: new Date().toISOString(),
        source: "dokkan.fyi",
        count: battles.length,
        battles: [...battles].sort((left, right) => toNumber(right.id) - toNumber(left.id)),
    };
}
exports.buildZBattleDataset = buildZBattleDataset;
function mapZBattleFromFyi(payload, battleId) {
    const phases = [
        mapZBattlePhaseFromFyi({
            phase: payload.props.stage,
            levels: payload.props.levels,
            beneficialCharacters: payload.props.beneficialCharacters?.data ?? [],
            missionCategories: payload.props.missionCategories ?? [],
            kind: "normal",
        }),
    ];
    if (payload.props.superStage) {
        phases.push(mapZBattlePhaseFromFyi({
            phase: payload.props.superStage,
            levels: payload.props.superLevels ?? [],
            beneficialCharacters: payload.props.superBeneficialCharacters?.data ?? [],
            missionCategories: payload.props.superMissionCategories ?? [],
            kind: "super",
        }));
    }
    return {
        id: payload.props.stage.id.toString(),
        name: cleanInlineText(payload.props.stage.name),
        nickname: cleanInlineText(payload.props.stage.nickname),
        sourceUrl: `${DOKKAN_FYI_BASE_URL}/z-battles/${battleId}`,
        hasSuperStage: Boolean(payload.props.superStage),
        phases,
    };
}
exports.mapZBattleFromFyi = mapZBattleFromFyi;
function mapZBattlePhaseFromFyi(input) {
    return {
        id: toNumber(input.phase.id).toString(),
        kind: input.kind,
        type: cleanInlineText(input.phase.type),
        images: mapZBattleImagesFromFyi(input.phase.images),
        enemies: (input.phase.enemies ?? []).map(mapEnemyProfileFromFyi),
        beneficialItems: (input.phase.beneficial_items ?? []).map(mapBeneficialItemFromFyi),
        ezaCharacters: (input.phase.eza_characters ?? []).map(mapCharacterRefFromFyi),
        beneficialCharacters: input.beneficialCharacters.map(mapCharacterRefFromFyi),
        levels: input.levels.map(mapZBattleLevelFromFyi),
        rewardCheckpoints: (input.phase.check_points ?? []).map(mapRewardCheckpointFromFyi),
        missionCategories: input.missionCategories.map(mapMissionCategoryFromFyi),
    };
}
exports.mapZBattlePhaseFromFyi = mapZBattlePhaseFromFyi;
function mapZBattleImagesFromFyi(images) {
    const bannerPath = cleanInlineText(images?.banner);
    const buttonPath = cleanInlineText(images?.button);
    return {
        bannerPath: bannerPath || undefined,
        bannerUrl: assetUrl(bannerPath),
        buttonPath: buttonPath || undefined,
        buttonUrl: assetUrl(buttonPath),
    };
}
exports.mapZBattleImagesFromFyi = mapZBattleImagesFromFyi;
function mapCharacterRefFromFyi(character) {
    return {
        id: toNumber(character?.id).toString(),
        canonicalId: toStringOrUndefined(character?.canonical_id),
        baseCharacterId: toStringOrUndefined(character?.base_character_id),
        characterId: toStringOrUndefined(character?.character_id),
        name: cleanInlineText(character?.name),
        rarity: rarityFromInput(character?.rarity_text, character?.rarity),
        type: typeFromInput(character?.type_text, character?.type),
        characterClass: classFromInput(character?.awakening_type_text, character?.awakening_type),
        thumbnailId: toStringOrUndefined(character?.thumbnail_id),
        portraitUrl: portraitUrl(character?.thumbnail_id),
        leaderSkillName: cleanInlineText(character?.leader_skill?.name),
        latestReleaseType: cleanInlineText(character?.release_dates?.latest_type),
        hasEza: toOptionalBoolean(character?.has_eza),
        hasSeza: toOptionalBoolean(character?.has_seza),
        isReversiblyExchanged: toOptionalBoolean(character?.is_reversibly_exchanged),
        isFreelyObtainable: toOptionalBoolean(character?.is_freely_obtainable),
    };
}
exports.mapCharacterRefFromFyi = mapCharacterRefFromFyi;
function mapEnemyProfileFromFyi(enemy) {
    return {
        id: toNumber(enemy.id).toString(),
        baseHp: toOptionalNumber(enemy.base_hp),
        baseAttack: toOptionalNumber(enemy.base_attack),
        baseDefence: toOptionalNumber(enemy.base_defence),
        cardEscalations: (enemy.card_escalations ?? []).map(mapCardEscalationFromFyi),
        skillEscalations: (enemy.skill_escalations ?? []).map(mapSkillEscalationFromFyi),
        hpEscalations: (enemy.hp_escalations ?? []).map(mapValueEscalationFromFyi),
        attackEscalations: (enemy.attack_escalations ?? []).map(mapValueEscalationFromFyi),
        defenceEscalations: (enemy.defence_escalations ?? []).map(mapValueEscalationFromFyi),
    };
}
exports.mapEnemyProfileFromFyi = mapEnemyProfileFromFyi;
function mapCardEscalationFromFyi(escalation) {
    return {
        id: toStringOrUndefined(escalation.id),
        level: toNumber(escalation.level),
        card: escalation.card ? mapCharacterRefFromFyi(escalation.card) : undefined,
    };
}
exports.mapCardEscalationFromFyi = mapCardEscalationFromFyi;
function mapSkillEscalationFromFyi(escalation) {
    return {
        id: toStringOrUndefined(escalation.id),
        level: toNumber(escalation.level),
        skill: escalation.enemy_skill ? mapEnemySkillFromFyi(escalation.enemy_skill) : undefined,
    };
}
exports.mapSkillEscalationFromFyi = mapSkillEscalationFromFyi;
function mapValueEscalationFromFyi(escalation) {
    return {
        id: toStringOrUndefined(escalation.id),
        level: toNumber(escalation.level),
        value: toNumber(escalation.escalation_value),
    };
}
exports.mapValueEscalationFromFyi = mapValueEscalationFromFyi;
function mapZBattleLevelFromFyi(level) {
    return {
        level: toNumber(level.level),
        enemyCard: level.enemy_card ? mapCharacterRefFromFyi(level.enemy_card) : undefined,
        hp: toOptionalNumber(level.hp),
        attack: toOptionalNumber(level.atk),
        defence: toOptionalNumber(level.def),
        skills: (level.skills ?? []).map(mapEnemySkillFromFyi),
        firstRewards: rewardsFromFyi(level.first_rewards),
    };
}
exports.mapZBattleLevelFromFyi = mapZBattleLevelFromFyi;
function mapEnemySkillFromFyi(skill) {
    return {
        id: toStringOrUndefined(skill.id),
        effectType: toOptionalNumber(skill.type),
        name: cleanInlineText(skill.name),
        description: cleanMultilineText(skill.description),
        values: (skill.values ?? [])
            .map(value => toOptionalNumber(value))
            .filter((value) => value !== undefined),
        target: toOptionalNumber(skill.target),
        calculation: toOptionalNumber(skill.calculation),
        turns: toOptionalNumber(skill.turns),
        chance: toOptionalNumber(skill.chance),
        transformationDescription: cleanMultilineText(skill.transformation?.description),
        scriptName: cleanInlineText(skill.script_name),
    };
}
exports.mapEnemySkillFromFyi = mapEnemySkillFromFyi;
function mapRewardCheckpointFromFyi(checkpoint) {
    const rewards = (checkpoint.normal_reward_tables ?? [])
        .flatMap(table => rewardsFromFyi(table.normal_rewards));
    return {
        id: toStringOrUndefined(checkpoint.id),
        level: toNumber(checkpoint.level),
        rewards,
    };
}
exports.mapRewardCheckpointFromFyi = mapRewardCheckpointFromFyi;
function mapRewardFromFyi(reward) {
    return {
        id: toStringOrUndefined(reward.id),
        itemType: cleanInlineText(reward.item_type),
        itemId: toStringOrUndefined(reward.item?.id),
        quantity: toNumber(reward.quantity),
        name: cleanInlineText(reward.item?.name),
        description: cleanMultilineText(reward.item?.description),
        rewardType: cleanInlineText(reward.item?.type),
        amount: toOptionalNumber(reward.item?.amount),
        rarity: toOptionalNumber(reward.item?.rarity),
        zeni: toOptionalNumber(reward.item?.zeni),
    };
}
exports.mapRewardFromFyi = mapRewardFromFyi;
function mapBeneficialItemFromFyi(item) {
    return {
        efficacyType: toOptionalNumber(item.efficacy_type),
        label: cleanInlineText(item.label),
        categories: (item.categories ?? []).map(mapNamedRefFromFyi),
        linkSkills: (item.link_skills ?? []).map(mapNamedRefFromFyi),
    };
}
exports.mapBeneficialItemFromFyi = mapBeneficialItemFromFyi;
function mapNamedRefFromFyi(item) {
    return {
        id: toStringOrUndefined(item.id),
        name: cleanInlineText(item.name),
    };
}
exports.mapNamedRefFromFyi = mapNamedRefFromFyi;
function mapMissionCategoryFromFyi(category) {
    return {
        id: toNumber(category.id).toString(),
        type: cleanInlineText(category.type),
        endsAt: releaseDate(category.ends_at),
        isIndefinite: Boolean(category.is_indefinite),
        priority: toOptionalNumber(category.priority),
        imageUrl: cleanInlineText(category.img) || undefined,
        missionsCount: toOptionalNumber(category.missions_count),
        completedCount: toOptionalNumber(category.completed_count),
        rewards: missionRewardsFromFyi(category.reward),
    };
}
exports.mapMissionCategoryFromFyi = mapMissionCategoryFromFyi;
function missionRewardsFromFyi(reward) {
    if (!reward) {
        return [];
    }
    const rewards = [];
    for (const index of [1, 2, 3, 4]) {
        const item = reward[`item${index}`];
        const itemType = reward[`item${index}_type`];
        if (!itemType || !item) {
            continue;
        }
        rewards.push({
            itemType: cleanInlineText(itemType),
            itemId: toStringOrUndefined(item.id),
            quantity: item.amount ?? 1,
            name: cleanInlineText(item.name),
            description: cleanMultilineText(item.description),
            rewardType: cleanInlineText(item.type),
            amount: toOptionalNumber(item.amount),
            rarity: toOptionalNumber(item.rarity),
            zeni: toOptionalNumber(item.zeni),
        });
    }
    return rewards;
}
exports.missionRewardsFromFyi = missionRewardsFromFyi;
function rewardsFromFyi(rewards) {
    return (rewards ?? []).map(mapRewardFromFyi);
}
function requestedBattleIds() {
    return (process.env.DOKKAN_FYI_Z_BATTLE_IDS ?? "")
        .split(",")
        .map(value => parseInt(value.trim(), 10))
        .filter(Number.isFinite);
}
function requestedBattleLimit() {
    const value = parseInt(process.env.DOKKAN_FYI_Z_BATTLE_LIMIT ?? "", 10);
    return Number.isFinite(value) && value > 0 ? value : undefined;
}
function dedupeCharacters(characters) {
    const byId = new Map();
    for (const character of characters) {
        if (!character?.id) {
            continue;
        }
        byId.set(character.id, character);
    }
    return Array.from(byId.values());
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
            return undefined;
        case 1:
            return character_1.Types.AGL;
        case 2:
            return character_1.Types.TEQ;
        case 3:
            return character_1.Types.STR;
        case 4:
            return character_1.Types.PHY;
        case 5:
            return character_1.Types.INT;
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
        .map(line => line.trim().replace(/^\*\s*/, "").replace(/\s*\*$/, "").trim())
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
//# sourceMappingURL=fyi-z-battles.js.map