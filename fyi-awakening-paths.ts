import { mkdir } from "fs/promises";
import { resolve } from "path";
import { Classes, Rarities, Types } from "./character";
import { writeFormattedJson } from "./format-json";
import {
    AwakeningMedal,
    AwakeningMedalAwakeningUsage,
    AwakeningMedalBabaShopSale,
    AwakeningMedalDataset,
    AwakeningMedalRef,
    AwakeningMedalStageSource,
    AwakeningMedalUsage,
    AwakeningMedalWorldTournamentSource,
    AwakeningMedalZBattleSource,
    AwakeningPathCharacterRef,
    AwakeningPathDataset,
    AwakeningPathRequirement,
    AwakeningPathStep,
    CharacterAwakeningPath,
} from "./awakening-path";

const DOKKAN_FYI_BASE_URL = "https://dokkan.fyi";

interface FyiCharacterIndexPagePayload {
    component: string,
    version?: string,
    props: {
        characters: FyiPaginated<FyiCharacterSummary>,
    },
}

interface FyiPaginated<T> {
    data: T[],
    meta?: {
        current_page?: number | null,
        last_page?: number | null,
        next_page_url?: string | null,
    },
}

interface FyiCharacterPagePayload {
    component: string,
    version?: string,
    props: {
        awakeningPath?: FyiAwakeningPathEntry[],
    },
}

interface FyiAwakeningMedalShowPagePayload {
    component: string,
    props: {
        awakening_medal: FyiAwakeningMedal,
    },
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

interface FyiAwakeningPathEntry {
    id: number,
    character_id?: number | null,
    character?: FyiCharacterSummary | null,
    awakened_character_id?: number | null,
    awakened_character?: FyiCharacterSummary | null,
    type?: string | null,
    eza_type?: number | null,
    eza_step?: number | null,
    requirements?: FyiAwakeningRequirement[] | null,
}

interface FyiAwakeningRequirement {
    id?: number | null,
    quantity?: number | null,
    order?: number | null,
    awakening_medal_id?: number | null,
    awakening_medal?: FyiAwakeningMedalRef | null,
}

interface FyiAwakeningMedalRef {
    id?: number | null,
    name?: string | null,
    description?: string | null,
    rarity?: number | null,
    zeni?: number | null,
    trade_points?: number | null,
}

interface FyiAwakeningMedal extends FyiAwakeningMedalRef {
    awakenings_awakening_items?: FyiAwakeningMedalUsage[] | null,
    stages?: FyiAwakeningMedalStage[] | null,
    z_battle?: FyiAwakeningMedalZBattle | null,
    baba_shop_sales?: FyiAwakeningMedalBabaShopSale[] | null,
    world_tournaments?: FyiAwakeningMedalWorldTournamentSource[] | null,
}

interface FyiAwakeningMedalUsage {
    id?: number | null,
    item_id?: number | null,
    quantity?: number | null,
    order?: number | null,
    awakenings?: FyiMedalAwakeningUsage[] | null,
}

interface FyiMedalAwakeningUsage {
    id?: number | null,
    character_id?: number | null,
    character?: FyiCharacterSummary | null,
    awakened_character_id?: number | null,
    type?: string | null,
    eza_type?: number | null,
    eza_step?: number | null,
}

interface FyiAwakeningMedalStage {
    id?: number | null,
    difficulty?: string | null,
    stamina?: number | null,
    required_keys?: number | null,
    rank_exp?: number | null,
    zeni?: number | null,
    link_skill_level_up_rate?: number | null,
    quest_id?: number | null,
    quest?: {
        id?: number | null,
        name?: string | null,
        max_attempts?: number | null,
        attempts_reset_days?: number | null,
        is_boostable?: boolean | null,
        start_date?: string | null,
        area_id?: number | null,
        area?: {
            id?: number | null,
            name?: string | null,
            type?: string | null,
            chapter?: {
                id?: number | null,
            } | null,
            images?: {
                header?: string | null,
                banner?: string | null,
                button?: string | null,
            } | null,
        } | null,
    } | null,
}

interface FyiAwakeningMedalZBattle {
    id?: number | null,
    name?: string | null,
    type?: string | null,
    chapter?: {
        id?: number | null,
    } | null,
    images?: {
        header?: string | null,
        banner?: string | null,
        button?: string | null,
    } | null,
}

interface FyiAwakeningMedalBabaShopSale {
    id?: number | null,
    discounted_price?: number | null,
    is_sale?: number | boolean | null,
    is_premium?: number | boolean | null,
    buyable?: number | boolean | null,
    buyable_num?: number | null,
    currency_id?: number | null,
    currency_type?: string | null,
    price?: number | null,
    item_id?: number | null,
    item_type?: string | null,
    item_quantity?: number | null,
    start_at?: string | null,
    end_at?: string | null,
    is_display_remaining_time?: number | boolean | null,
}

interface FyiAwakeningMedalWorldTournamentSource {
    id?: number | null,
    budokai_ranking_gift_set_id?: number | null,
    description?: string | null,
    item_type?: string | null,
    item_id?: number | null,
    quantity?: number | null,
    card_exp_init?: number | null,
    budokai_ranking_gift_set?: {
        id?: number | null,
        budokai_id?: number | null,
        order?: number | null,
        ranking?: string | null,
    } | null,
}

class DokkanFyiAwakeningClient {
    private version?: string;

    async fetchCharacterIndex(limit?: number): Promise<FyiCharacterSummary[]> {
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

    async fetchAwakeningPath(characterId: number): Promise<FyiAwakeningPathEntry[]> {
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

        const payload = JSON.parse(await response.text()) as FyiCharacterPagePayload;
        return payload.props.awakeningPath ?? [];
    }

    async fetchAwakeningMedal(medalId: number): Promise<FyiAwakeningMedal> {
        const response = await fetch(`${DOKKAN_FYI_BASE_URL}/awakening-medals/${medalId}`, {
            headers: browserHeaders(),
        });

        if (!response.ok) {
            throw new Error(`Could not fetch dokkan.fyi awakening medal ${medalId}: ${response.status}`);
        }

        const html = await response.text();
        return extractPagePayload<FyiAwakeningMedalShowPagePayload>(html).props.awakening_medal;
    }

    private async fetchCharacterIndexPage(page: number): Promise<FyiCharacterIndexPagePayload> {
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
        return extractPagePayload<FyiCharacterIndexPagePayload>(html);
    }

    private async fetchCurrentVersion(characterId: number): Promise<string> {
        const response = await fetch(`${DOKKAN_FYI_BASE_URL}/characters/${characterId}`, {
            headers: browserHeaders(),
        });

        if (!response.ok) {
            throw new Error(`Could not fetch dokkan.fyi character page ${characterId}: ${response.status}`);
        }

        const html = await response.text();
        const payload = extractPagePayload<{ version?: string }>(html);
        if (!payload.version) {
            throw new Error(`Could not extract dokkan.fyi inertia version for character ${characterId}.`);
        }

        this.version = payload.version;
        return payload.version;
    }
}

export async function getDokkanFyiAwakeningDatasets(): Promise<{
    awakeningPaths: AwakeningPathDataset,
    awakeningMedals: AwakeningMedalDataset,
}> {
    const client = new DokkanFyiAwakeningClient();
    const characters = await client.fetchCharacterIndex(requestedCharacterLimit());
    const paths: CharacterAwakeningPath[] = [];
    const medalIds = new Set<number>();

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
    const medals: AwakeningMedal[] = [];

    for (const medalId of limitedMedalIds) {
        medals.push(mapAwakeningMedalFromFyi(await client.fetchAwakeningMedal(medalId)));
    }

    return {
        awakeningPaths: buildAwakeningPathDataset(paths),
        awakeningMedals: buildAwakeningMedalDataset(medals),
    };
}

export async function writeDokkanFyiAwakeningDatasets(): Promise<{ pathsPath: string, medalsPath: string }> {
    const { awakeningPaths, awakeningMedals } = await getDokkanFyiAwakeningDatasets();
    const outputDir = resolve(__dirname, "data/awakening/latest");
    const pathsPath = resolve(outputDir, "awakening-paths.json");
    const medalsPath = resolve(outputDir, "awakening-medals.json");

    await mkdir(outputDir, { recursive: true });
    await writeFormattedJson(pathsPath, awakeningPaths);
    await writeFormattedJson(medalsPath, awakeningMedals);

    return { pathsPath, medalsPath };
}

export function buildAwakeningPathDataset(paths: CharacterAwakeningPath[]): AwakeningPathDataset {
    return {
        generatedAt: new Date().toISOString(),
        source: "dokkan.fyi",
        count: paths.length,
        paths: [...paths].sort((left, right) => left.name.localeCompare(right.name) || left.characterId.localeCompare(right.characterId)),
    };
}

export function buildAwakeningMedalDataset(medals: AwakeningMedal[]): AwakeningMedalDataset {
    return {
        generatedAt: new Date().toISOString(),
        source: "dokkan.fyi",
        count: medals.length,
        medals: [...medals].sort((left, right) => left.name.localeCompare(right.name) || left.id.localeCompare(right.id)),
    };
}

export function mapCharacterAwakeningPathFromFyi(
    character: FyiCharacterSummary,
    awakeningPath: FyiAwakeningPathEntry[],
): CharacterAwakeningPath {
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

export function mapAwakeningPathStepFromFyi(step: FyiAwakeningPathEntry): AwakeningPathStep {
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

export function mapAwakeningPathRequirementFromFyi(requirement: FyiAwakeningRequirement): AwakeningPathRequirement {
    return {
        id: toStringOrUndefined(requirement.id) ?? "",
        awakeningMedalId: toStringOrUndefined(requirement.awakening_medal_id),
        quantity: toNumber(requirement.quantity),
        order: toOptionalNumber(requirement.order),
        awakeningMedal: requirement.awakening_medal ? mapAwakeningMedalRefFromFyi(requirement.awakening_medal) : undefined,
    };
}

export function mapAwakeningMedalRefFromFyi(medal: FyiAwakeningMedalRef): AwakeningMedalRef {
    return {
        id: toStringOrUndefined(medal.id) ?? "",
        name: cleanInlineText(medal.name),
        description: cleanMultilineText(medal.description) || undefined,
        rarity: toOptionalNumber(medal.rarity),
        zeni: toOptionalNumber(medal.zeni),
        tradePoints: toOptionalNumber(medal.trade_points),
    };
}

export function mapAwakeningPathCharacterRefFromFyi(character: FyiCharacterSummary): AwakeningPathCharacterRef {
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

export function mapAwakeningMedalFromFyi(medal: FyiAwakeningMedal): AwakeningMedal {
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

export function mapAwakeningMedalUsageFromFyi(usage: FyiAwakeningMedalUsage): AwakeningMedalUsage {
    return {
        id: toStringOrUndefined(usage.id) ?? "",
        itemId: toStringOrUndefined(usage.item_id),
        quantity: toNumber(usage.quantity),
        order: toOptionalNumber(usage.order),
        awakenings: (usage.awakenings ?? []).map(mapAwakeningMedalAwakeningUsageFromFyi),
    };
}

export function mapAwakeningMedalAwakeningUsageFromFyi(usage: FyiMedalAwakeningUsage): AwakeningMedalAwakeningUsage {
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

export function mapAwakeningMedalStageSourceFromFyi(stage: FyiAwakeningMedalStage): AwakeningMedalStageSource {
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

export function mapAwakeningMedalZBattleSourceFromFyi(zBattle: FyiAwakeningMedalZBattle): AwakeningMedalZBattleSource {
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

export function mapAwakeningMedalBabaShopSaleFromFyi(sale: FyiAwakeningMedalBabaShopSale): AwakeningMedalBabaShopSale {
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

export function mapAwakeningMedalWorldTournamentSourceFromFyi(source: FyiAwakeningMedalWorldTournamentSource): AwakeningMedalWorldTournamentSource {
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

function requestedCharacterLimit(): number | undefined {
    return parseOptionalPositiveInt(process.env.DOKKAN_FYI_AWAKENING_PATH_CHARACTER_LIMIT);
}

function requestedMedalLimit(): number | undefined {
    return parseOptionalPositiveInt(process.env.DOKKAN_FYI_AWAKENING_MEDAL_LIMIT);
}

function parseOptionalPositiveInt(input: string | undefined): number | undefined {
    const value = parseInt(input ?? "", 10);
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
