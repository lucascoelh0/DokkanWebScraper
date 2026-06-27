import { mkdir } from "fs/promises";
import { resolve } from "path";
import { Classes, Rarities, Types } from "./character";
import { writeFormattedJson } from "./format-json";
import {
    ZBattle,
    ZBattleBeneficialItem,
    ZBattleCardEscalation,
    ZBattleCharacterRef,
    ZBattleDataset,
    ZBattleEnemyProfile,
    ZBattleEnemySkill,
    ZBattleImages,
    ZBattleLevel,
    ZBattleMissionCategory,
    ZBattleNamedRef,
    ZBattlePhase,
    ZBattleRewardCheckpoint,
    ZBattleRewardItem,
    ZBattleSkillEscalation,
    ZBattleValueEscalation,
} from "./z-battle";

const DOKKAN_FYI_BASE_URL = "https://dokkan.fyi";
const DOKKAN_FYI_CDN_BASE_URL = "https://cdn.dokkan.fyi/assets";

interface FyiPaginated<T> {
    data: T[],
    meta?: {
        current_page?: number | null,
        last_page?: number | null,
        total?: number | null,
        per_page?: number | null,
    },
}

interface FyiZBattleIndexPagePayload {
    component: string,
    props: {
        stages: FyiPaginated<FyiZBattleStageSummary>,
    },
}

interface FyiZBattleShowPagePayload {
    component: string,
    props: {
        stage: FyiZBattleStageDetail,
        levels: FyiZBattleLevel[],
        beneficialCharacters?: FyiPaginated<FyiCharacterSummary>,
        superStage?: FyiZBattleStageDetail | null,
        superLevels?: FyiZBattleLevel[] | null,
        superBeneficialCharacters?: FyiPaginated<FyiCharacterSummary> | null,
        missionCategories?: FyiMissionCategory[] | null,
        superMissionCategories?: FyiMissionCategory[] | null,
    },
}

interface FyiZBattleStageSummary {
    id: number,
    name?: string | null,
    nickname?: string | null,
    type?: string | null,
    has_super?: boolean | null,
    images?: FyiZBattleImages | null,
    beneficial_items?: FyiBeneficialItem[] | null,
    eza_characters?: FyiCharacterSummary[] | null,
}

interface FyiZBattleStageDetail extends FyiZBattleStageSummary {
    enemies?: FyiEnemyProfile[] | null,
    check_points?: FyiRewardCheckpoint[] | null,
    first_reward_level_ranges?: FyiFirstRewardLevelRange[] | null,
}

interface FyiZBattleImages {
    banner?: string | null,
    button?: string | null,
}

interface FyiEnemyProfile {
    id?: number | null,
    base_hp?: number | null,
    base_attack?: number | null,
    base_defence?: number | null,
    card_escalations?: FyiCardEscalation[] | null,
    skill_escalations?: FyiSkillEscalation[] | null,
    hp_escalations?: FyiValueEscalation[] | null,
    attack_escalations?: FyiValueEscalation[] | null,
    defence_escalations?: FyiValueEscalation[] | null,
}

interface FyiCardEscalation {
    id?: number | null,
    level?: number | null,
    card?: FyiCharacterSummary | null,
}

interface FyiSkillEscalation {
    id?: number | null,
    level?: number | null,
    enemy_skill?: FyiEnemySkill | null,
}

interface FyiValueEscalation {
    id?: number | null,
    level?: number | null,
    escalation_value?: number | null,
}

interface FyiZBattleLevel {
    level?: number | null,
    enemy_card?: FyiCharacterSummary | null,
    hp?: number | null,
    atk?: number | null,
    def?: number | null,
    skills?: FyiEnemySkill[] | null,
    first_rewards?: FyiReward[] | null,
}

interface FyiEnemySkill {
    id?: number | null,
    type?: number | null,
    values?: Array<number | null> | null,
    target?: number | null,
    calculation?: number | null,
    turns?: number | null,
    chance?: number | null,
    transformation?: {
        description?: string | null,
    } | null,
    script_name?: string | null,
    name?: string | null,
    description?: string | null,
}

interface FyiRewardCheckpoint {
    id?: number | null,
    level?: number | null,
    normal_reward_tables?: FyiRewardTable[] | null,
}

interface FyiRewardTable {
    id?: number | null,
    normal_rewards?: FyiReward[] | null,
}

interface FyiFirstRewardLevelRange {
    id?: number | null,
    level?: number | null,
    first_rewards?: FyiReward[] | null,
}

interface FyiReward {
    id?: number | null,
    item_type?: string | null,
    quantity?: number | null,
    item?: FyiRewardPayload | null,
}

interface FyiRewardPayload {
    id?: number | null,
    name?: string | null,
    description?: string | null,
    rarity?: number | null,
    zeni?: number | null,
    type?: string | null,
    amount?: number | null,
}

interface FyiBeneficialItem {
    efficacy_type?: number | null,
    label?: string | null,
    categories?: FyiNamedRef[] | null,
    link_skills?: FyiNamedRef[] | null,
}

interface FyiNamedRef {
    id?: number | null,
    name?: string | null,
}

interface FyiMissionCategory {
    id?: number | null,
    type?: string | null,
    ends_at?: string | null,
    is_indefinite?: number | boolean | null,
    reward?: FyiMissionReward | null,
    priority?: number | null,
    img?: string | null,
    missions_count?: number | null,
    completed_count?: number | null,
}

interface FyiMissionReward {
    id?: number | null,
    item1?: FyiRewardPayload | null,
    item1_type?: string | null,
    item2?: FyiRewardPayload | null,
    item2_type?: string | null,
    item3?: FyiRewardPayload | null,
    item3_type?: string | null,
    item4?: FyiRewardPayload | null,
    item4_type?: string | null,
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
    leader_skill?: {
        name?: string | null,
    } | null,
}

class DokkanFyiZBattleClient {
    async fetchIndexBattleIds(limit?: number): Promise<number[]> {
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

    async fetchBattle(battleId: number): Promise<ZBattle> {
        const basePayload = await this.fetchBattlePage(battleId, 1);
        const mergedPayload = await this.expandBattleCharacterPages(battleId, basePayload);
        return mapZBattleFromFyi(mergedPayload, battleId);
    }

    private async expandBattleCharacterPages(
        battleId: number,
        page: FyiZBattleShowPagePayload,
    ): Promise<FyiZBattleShowPagePayload> {
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

    private async fetchIndexPage(page: number): Promise<FyiZBattleIndexPagePayload> {
        const query = new URLSearchParams({ page: page.toString() });
        const response = await fetch(`${DOKKAN_FYI_BASE_URL}/z-battles?${query.toString()}`, {
            headers: browserHeaders(),
        });

        if (!response.ok) {
            throw new Error(`Could not fetch dokkan.fyi z-battles index page ${page}: ${response.status}`);
        }

        const html = await response.text();
        return extractPagePayload<FyiZBattleIndexPagePayload>(html);
    }

    private async fetchBattlePage(battleId: number, characterPage: number): Promise<FyiZBattleShowPagePayload> {
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
        return extractPagePayload<FyiZBattleShowPagePayload>(html);
    }
}

export async function getDokkanFyiZBattles(): Promise<ZBattleDataset> {
    const client = new DokkanFyiZBattleClient();
    const requestedIds = requestedBattleIds();
    const limit = requestedBattleLimit();
    const battleIds = requestedIds.length > 0
        ? requestedIds
        : await client.fetchIndexBattleIds(limit);

    const battles: ZBattle[] = [];
    for (const battleId of battleIds) {
        battles.push(await client.fetchBattle(battleId));
    }

    return buildZBattleDataset(battles);
}

export async function writeDokkanFyiZBattles(): Promise<string> {
    const dataset = await getDokkanFyiZBattles();
    const outputDir = resolve(__dirname, "data/z-battles/latest");
    const outputPath = resolve(outputDir, "z-battles.json");

    await mkdir(outputDir, { recursive: true });
    await writeFormattedJson(outputPath, dataset);

    return outputPath;
}

export function buildZBattleDataset(battles: ZBattle[]): ZBattleDataset {
    return {
        generatedAt: new Date().toISOString(),
        source: "dokkan.fyi",
        count: battles.length,
        battles: [...battles].sort((left, right) => toNumber(right.id) - toNumber(left.id)),
    };
}

export function mapZBattleFromFyi(payload: FyiZBattleShowPagePayload, battleId: number): ZBattle {
    const phases: ZBattlePhase[] = [
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

export function mapZBattlePhaseFromFyi(input: {
    phase: FyiZBattleStageDetail,
    levels: FyiZBattleLevel[],
    beneficialCharacters: FyiCharacterSummary[],
    missionCategories: FyiMissionCategory[],
    kind: "normal" | "super",
}): ZBattlePhase {
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

export function mapZBattleImagesFromFyi(images: FyiZBattleImages | null | undefined): ZBattleImages {
    const bannerPath = cleanInlineText(images?.banner);
    const buttonPath = cleanInlineText(images?.button);

    return {
        bannerPath: bannerPath || undefined,
        bannerUrl: assetUrl(bannerPath),
        buttonPath: buttonPath || undefined,
        buttonUrl: assetUrl(buttonPath),
    };
}

export function mapCharacterRefFromFyi(character: FyiCharacterSummary | null | undefined): ZBattleCharacterRef {
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

export function mapEnemyProfileFromFyi(enemy: FyiEnemyProfile): ZBattleEnemyProfile {
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

export function mapCardEscalationFromFyi(escalation: FyiCardEscalation): ZBattleCardEscalation {
    return {
        id: toStringOrUndefined(escalation.id),
        level: toNumber(escalation.level),
        card: escalation.card ? mapCharacterRefFromFyi(escalation.card) : undefined,
    };
}

export function mapSkillEscalationFromFyi(escalation: FyiSkillEscalation): ZBattleSkillEscalation {
    return {
        id: toStringOrUndefined(escalation.id),
        level: toNumber(escalation.level),
        skill: escalation.enemy_skill ? mapEnemySkillFromFyi(escalation.enemy_skill) : undefined,
    };
}

export function mapValueEscalationFromFyi(escalation: FyiValueEscalation): ZBattleValueEscalation {
    return {
        id: toStringOrUndefined(escalation.id),
        level: toNumber(escalation.level),
        value: toNumber(escalation.escalation_value),
    };
}

export function mapZBattleLevelFromFyi(level: FyiZBattleLevel): ZBattleLevel {
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

export function mapEnemySkillFromFyi(skill: FyiEnemySkill): ZBattleEnemySkill {
    return {
        id: toStringOrUndefined(skill.id),
        effectType: toOptionalNumber(skill.type),
        name: cleanInlineText(skill.name),
        description: cleanMultilineText(skill.description),
        values: (skill.values ?? [])
            .map(value => toOptionalNumber(value))
            .filter((value): value is number => value !== undefined),
        target: toOptionalNumber(skill.target),
        calculation: toOptionalNumber(skill.calculation),
        turns: toOptionalNumber(skill.turns),
        chance: toOptionalNumber(skill.chance),
        transformationDescription: cleanMultilineText(skill.transformation?.description),
        scriptName: cleanInlineText(skill.script_name),
    };
}

export function mapRewardCheckpointFromFyi(checkpoint: FyiRewardCheckpoint): ZBattleRewardCheckpoint {
    const rewards = (checkpoint.normal_reward_tables ?? [])
        .flatMap(table => rewardsFromFyi(table.normal_rewards));

    return {
        id: toStringOrUndefined(checkpoint.id),
        level: toNumber(checkpoint.level),
        rewards,
    };
}

export function mapRewardFromFyi(reward: FyiReward): ZBattleRewardItem {
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

export function mapBeneficialItemFromFyi(item: FyiBeneficialItem): ZBattleBeneficialItem {
    return {
        efficacyType: toOptionalNumber(item.efficacy_type),
        label: cleanInlineText(item.label),
        categories: (item.categories ?? []).map(mapNamedRefFromFyi),
        linkSkills: (item.link_skills ?? []).map(mapNamedRefFromFyi),
    };
}

export function mapNamedRefFromFyi(item: FyiNamedRef): ZBattleNamedRef {
    return {
        id: toStringOrUndefined(item.id),
        name: cleanInlineText(item.name),
    };
}

export function mapMissionCategoryFromFyi(category: FyiMissionCategory): ZBattleMissionCategory {
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

export function missionRewardsFromFyi(reward: FyiMissionReward | null | undefined): ZBattleRewardItem[] {
    if (!reward) {
        return [];
    }

    const rewards: ZBattleRewardItem[] = [];
    for (const index of [1, 2, 3, 4]) {
        const item = reward[`item${index}` as keyof FyiMissionReward] as FyiRewardPayload | null | undefined;
        const itemType = reward[`item${index}_type` as keyof FyiMissionReward] as string | null | undefined;

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

function rewardsFromFyi(rewards: FyiReward[] | null | undefined): ZBattleRewardItem[] {
    return (rewards ?? []).map(mapRewardFromFyi);
}

function requestedBattleIds(): number[] {
    return (process.env.DOKKAN_FYI_Z_BATTLE_IDS ?? "")
        .split(",")
        .map(value => parseInt(value.trim(), 10))
        .filter(Number.isFinite);
}

function requestedBattleLimit(): number | undefined {
    const value = parseInt(process.env.DOKKAN_FYI_Z_BATTLE_LIMIT ?? "", 10);
    return Number.isFinite(value) && value > 0 ? value : undefined;
}

function dedupeCharacters(characters: FyiCharacterSummary[]): FyiCharacterSummary[] {
    const byId = new Map<number, FyiCharacterSummary>();

    for (const character of characters) {
        if (!character?.id) {
            continue;
        }

        byId.set(character.id, character);
    }

    return Array.from(byId.values());
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
            return undefined;
        case 1:
            return Types.AGL;
        case 2:
            return Types.TEQ;
        case 3:
            return Types.STR;
        case 4:
            return Types.PHY;
        case 5:
            return Types.INT;
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
        .map(line => line.trim().replace(/^\*\s*/, "").replace(/\s*\*$/, "").trim())
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
