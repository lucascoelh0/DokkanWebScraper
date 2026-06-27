import { mkdir } from "fs/promises";
import { resolve } from "path";
import {
    AttackTypes,
    Character,
    CharacterExclusiveSkillOrb,
    CharacterExclusiveSkillOrbAcquisition,
    CharacterObtainability,
    CharacterObtainabilityDetails,
    CharacterExtraInfo,
    Classes,
    FinishSkill,
    FinishSkillEffectKind,
    PassiveDetails,
    PortraitSpec,
    Rarities,
    ReversibleExchangeDetails,
    StandbySkillDetails,
    SuperAttackDetails,
    Transformation,
    TransformationSource,
    Types,
    UnitSuperAttack,
} from "./character";
import { writeFormattedJson } from "./format-json";
import { parseLeaderSkillDetails, splitPassiveSections } from "./scraper";

const DOKKAN_FYI_BASE_URL = "https://dokkan.fyi";
const DOKKAN_FYI_CDN_URL = "https://cdn.dokkan.fyi";

export const DEFAULT_DOKKAN_FYI_EXPERIMENT_CHARACTER_IDS = [
    1032521, 1033761, 1032771, 1026251, 1033941,
    1033841, 1024141, 1033061, 1032921, 1032881,
    1013541, 1025731, 1026131, 1032811, 1032361,
    1023421, 1031121, 1025591, 1030941, 1031181,
];

export const DEFAULT_DOKKAN_FYI_CONTRACT_SAMPLE_CHARACTER_IDS = [
    1029471, // standby + finish skills
    1030431, // reversible exchange + active transformation
    1025591, // exclusive skill orbs with shop acquisition
    1032771, // free-to-play obtainability
];

interface FyiPagePayload {
    props: {
        app?: {
            cdn_url?: string,
        },
        character: FyiCharacter,
        transformationPath?: FyiTransformationPathEntry[],
    },
    version?: string,
    deferredProps?: {
        default?: string[],
    },
}

interface FyiCharacter {
    id: number,
    canonical_id: number,
    character_id: number,
    name: string,
    rarity: number,
    rarity_text: string,
    type: number,
    type_text: string,
    awakening_type: number,
    awakening_type_text: string,
    stats: FyiStats,
    max_level: number,
    cost: number,
    ki_multipliers?: Record<string, number>,
    thumbnail_id: number,
    has_images: boolean,
    release_dates?: FyiReleaseDates,
    max_super_attack_level: number,
    link_skills?: FyiLinkSkill[],
    leader_skill?: FyiSkill,
    super_attacks?: FyiSuperAttack[],
    passive_skill?: FyiSkill,
    reversible_exchange_character_id?: number | null,
    reversible_exchange_character?: FyiCharacter | null,
    active_skills?: FyiActiveSkill[],
    standby_skill?: FyiStandbySkill | null,
    skill_orbs?: FyiSkillOrb[],
    categories?: FyiCategory[],
    has_eza: boolean,
    has_seza: boolean,
    extreme_z_awakening?: FyiExtremeZAwakening | null,
    is_reversibly_exchanged?: boolean,
    is_freely_obtainable?: boolean,
    is_stage_drop_reward?: boolean,
    is_world_tournament_reward?: boolean,
    has_battle_motion?: boolean,
    base_character_id: number,
    transformation_path_characters?: FyiCharacterSummary[],
}

interface FyiCharacterSummary {
    id: number,
    canonical_id: number,
    character_id: number,
    name: string,
    rarity: number,
    rarity_text: string,
    type: number,
    type_text: string,
    awakening_type: number,
    awakening_type_text: string,
    stats: FyiStats,
    max_level: number,
    cost: number,
    ki_multipliers?: Record<string, number>,
    thumbnail_id: number,
    has_images: boolean,
    release_dates?: FyiReleaseDates,
    max_super_attack_level: number,
    link_skill_ids?: number[],
    link_skills?: FyiLinkSkill[],
    leader_skill_id?: number,
    reversible_exchange_character_id?: number | null,
    has_eza?: boolean,
    has_seza?: boolean,
    is_reversibly_exchanged?: boolean,
    is_freely_obtainable?: boolean,
    is_stage_drop_reward?: boolean,
    is_world_tournament_reward?: boolean,
    has_battle_motion?: boolean,
    base_character_id: number,
    transformation_path_characters?: FyiCharacterSummary[],
}

interface FyiTransformationPathEntry {
    character: FyiCharacterSummary,
    description?: string | null,
    source?: string | null,
}

interface FyiStats {
    hp: FyiStatRange,
    atk: FyiStatRange,
    def: FyiStatRange,
}

interface FyiStatRange {
    base?: number,
    max?: number,
    eza?: number,
}

interface FyiReleaseDates {
    initial?: string | null,
    latest?: string | null,
    latest_type?: "initial" | "eza" | "seza" | string | null,
    eza?: string | null,
    seza?: string | null,
}

interface FyiSkill {
    id?: number,
    name?: string,
    description?: string | null,
    condition?: string | null,
}

interface FyiStandbySkill extends FyiSkill {
    effects?: FyiEffect[],
    finish_skills?: FyiFinishSkill[],
}

interface FyiActiveSkill extends FyiSkill {
}

interface FyiFinishSkill extends FyiSkill {
    effects?: FyiEffect[],
}

interface FyiSkillOrb {
    id: number,
    name?: string,
    description?: string | null,
    grade?: string | null,
    is_reusable?: boolean | null,
    img_id?: string | null,
    skills?: FyiSkillOrbSkill[],
    mission_reward?: FyiSkillOrbMissionReward | null,
    shop_items?: FyiSkillOrbShopItem[],
}

interface FyiSkillOrbSkill {
    id?: number,
    attribute?: string | null,
    level?: number | null,
    hidden_potential_skill_id?: number | null,
}

interface FyiSkillOrbMissionReward {
    id?: number,
    item_id?: number,
    item_type?: string | null,
    quantity?: number | null,
    mission_id?: number | null,
    mission_category_id?: number | null,
    mission_category?: {
        id?: number,
        img?: string | null,
        type?: string | null,
    } | null,
}

interface FyiSkillOrbShopItem {
    id?: number,
    price?: number | null,
    discounted_price?: number | null,
    treasure_item_id?: number | null,
    treasure_item?: {
        id?: number,
        name?: string | null,
        description?: string | null,
        image_suffix?: number | null,
    } | null,
    starts_at?: string | null,
    ends_at?: string | null,
    is_indefinite?: boolean | null,
}

interface FyiCategory {
    id: number,
    name: string,
}

interface FyiLinkSkill {
    id: number,
    name: string,
    levels?: {
        level: number,
        description?: string | null,
    }[],
}

interface FyiExtremeZAwakening {
    max_level?: number,
    max_super_attack_level?: number,
    leader_skill?: FyiSkill,
    passive_skill?: FyiSkill,
}

interface FyiEffect {
    id?: number,
    type?: number,
    values?: unknown,
    target?: number,
    calculation?: number | null,
    turns?: number | null,
    chance?: number | null,
    transformation?: {
        character?: FyiCharacterSummary,
        description?: string | null,
    } | null,
    script_name?: string | null,
}

interface FyiSuperAttack {
    id: number,
    name?: string,
    description?: string | null,
    ki?: number,
    style?: string | null,
    condition?: string | null,
    atk_multiplier?: number,
    atk_multiplier_level_bonus?: number,
    level?: number,
    category?: {
        name?: string | null,
        raw_attribute?: number,
    },
}

interface CurrentState {
    latestType: string,
    maxLevel: number,
    maxSuperAttackLevel: number,
    leaderSkill?: FyiSkill,
    passiveSkill?: FyiSkill,
    currentSuperAttacks: FyiSuperAttack[],
}

interface CachedFyiPage {
    payload: FyiPagePayload,
    version: string,
}

interface TransformationBuildEntry {
    entry: FyiTransformationPathEntry,
    sourceCharacterId: number,
}

export interface DokkanFyiCoverageRow {
    id: string,
    name: string,
    latestType: string,
    hasActiveSkill: boolean,
    hasStandbySkill: boolean,
    hasReversibleExchange: boolean,
    hasTransformationPath: boolean,
    mappedTransformationCount: number,
    supportsExSuperAttack: boolean,
    supportsUnitSuperAttack: boolean,
    supportsFinishMove: boolean,
    notes: string[],
}

export interface DokkanFyiCoverageReport {
    generatedAt: string,
    source: string,
    characterIds: string[],
    summary: {
        totalCharacters: number,
        activeSkillCount: number,
        standbySkillCount: number,
        reversibleExchangeCount: number,
        transformationSourceCount: number,
        exSuperAttackCount: number,
        unitSuperAttackCount: number,
        finishMoveCount: number,
    },
    rows: DokkanFyiCoverageRow[],
}

export interface DokkanFyiContractReferenceSample {
    schemaName: string,
    schemaVersion: number,
    generatedAt: string,
    source: string,
    specPath: string,
    sampleCharacterIds: string[],
    notes: string[],
    characters: Character[],
}

class DokkanFyiClient {
    private readonly pageCache = new Map<number, Promise<CachedFyiPage>>();

    async fetchCharacterPage(characterId: number): Promise<CachedFyiPage> {
        const cached = this.pageCache.get(characterId);
        if (cached) {
            return cached;
        }

        const pagePromise = this.fetchCharacterPageUncached(characterId);
        this.pageCache.set(characterId, pagePromise);
        return pagePromise;
    }

    private async fetchCharacterPageUncached(characterId: number): Promise<CachedFyiPage> {
        const response = await fetch(`${DOKKAN_FYI_BASE_URL}/characters/${characterId}`, {
            headers: browserHeaders(),
        });

        if (!response.ok) {
            throw new Error(`Could not fetch dokkan.fyi character page ${characterId}: ${response.status}`);
        }

        const html = await response.text();
        const payload = extractPagePayload(html);
        const version = payload.version ?? "";

        if (shouldFetchDeferredTransformationPath(payload)) {
            payload.props.transformationPath = await this.fetchTransformationPath(characterId, version);
        } else if (!payload.props.transformationPath) {
            payload.props.transformationPath = [];
        }

        return {
            payload,
            version,
        };
    }

    private async fetchTransformationPath(characterId: number, version: string): Promise<FyiTransformationPathEntry[]> {
        const response = await fetch(`${DOKKAN_FYI_BASE_URL}/characters/${characterId}`, {
            headers: {
                ...browserHeaders(),
                "Accept": "application/json",
                "Referer": `${DOKKAN_FYI_BASE_URL}/characters/${characterId}`,
                "X-Inertia": "true",
                "X-Requested-With": "XMLHttpRequest",
                "X-Inertia-Version": version,
                "X-Inertia-Partial-Component": "Character/CharacterShow",
                "X-Inertia-Partial-Data": "transformationPath",
            },
        });

        if (!response.ok) {
            throw new Error(`Could not fetch dokkan.fyi transformation path ${characterId}: ${response.status}`);
        }

        const payload = await response.json() as FyiPagePayload;
        return payload.props.transformationPath ?? [];
    }
}

export async function getDokkanFyiData(characterIds?: number[]): Promise<Character[]> {
    const ids = characterIds?.length ? characterIds : defaultDokkanFyiCharacterIds();
    const client = new DokkanFyiClient();
    const characters: Character[] = [];

    for (const characterId of ids) {
        console.log(`[FYI] ${characterId}`);
        const page = await client.fetchCharacterPage(characterId);
        characters.push(await mapDokkanFyiCharacter(page, client));
    }

    return characters;
}

export async function runDokkanFyiExperiment(characterIds?: number[]): Promise<{
    characters: Character[],
    coverageReport: DokkanFyiCoverageReport,
}> {
    const characters = await getDokkanFyiData(characterIds);
    const coverageReport = buildCoverageReport(characters);
    return { characters, coverageReport };
}

export async function writeDokkanFyiExperiment(characterIds?: number[]): Promise<{
    charactersPath: string,
    coveragePath: string,
}> {
    const { characters, coverageReport } = await runDokkanFyiExperiment(characterIds);
    const outputDir = resolve(__dirname, "data/fyi-experiment/latest");

    await mkdir(outputDir, { recursive: true });

    const charactersPath = resolve(outputDir, "characters.json");
    const coveragePath = resolve(outputDir, "coverage-report.json");

    await writeFormattedJson(charactersPath, characters);
    await writeFormattedJson(coveragePath, coverageReport);

    return {
        charactersPath,
        coveragePath,
    };
}

export function buildDokkanFyiContractReferenceSample(
    characters: Character[],
): DokkanFyiContractReferenceSample {
    return {
        schemaName: "dokkan-fyi-character-contract",
        schemaVersion: 1,
        generatedAt: new Date().toISOString(),
        source: "dokkan.fyi",
        specPath: "docs/specs/dokkan-fyi-character-contract.md",
        sampleCharacterIds: characters.map(character => character.id),
        notes: [
            "Reference snapshot for the planned Dokkan.fyi app contract.",
            "This file is intentionally small and curated for human review.",
            "Legacy compatibility fields may still be present while the Android app migrates.",
        ],
        characters,
    };
}

export async function writeDokkanFyiContractReferenceSample(characterIds?: number[]): Promise<string> {
    const ids = characterIds?.length ? characterIds : DEFAULT_DOKKAN_FYI_CONTRACT_SAMPLE_CHARACTER_IDS;
    const characters = await getDokkanFyiData(ids);
    const sample = buildDokkanFyiContractReferenceSample(characters);
    const outputDir = resolve(__dirname, "docs/specs/examples");
    const outputPath = resolve(outputDir, "dokkan-fyi-character-sample.json");

    await mkdir(outputDir, { recursive: true });
    await writeFormattedJson(outputPath, sample);

    return outputPath;
}

async function mapDokkanFyiCharacter(
    page: CachedFyiPage,
    client: DokkanFyiClient,
): Promise<Character> {
    const character = page.payload.props.character;
    const currentState = selectCurrentState(character);
    const standby = standbyDetailsFromFyi(character.standby_skill);
    const transformations = await buildTransformations(character, page.payload.props.transformationPath ?? [], client);
    const enrichedTransformations = await attachStandbyMetadataToTransformations(
        character,
        standby,
        transformations,
        client,
    );
    const obtainability = obtainabilityDetailsFromFyi(character);
    const reversibleExchange = reversibleExchangeDetailsFromFyi(character, enrichedTransformations);
    const exclusiveSkillOrbs = exclusiveSkillOrbsFromFyi(character.skill_orbs);
    const activeSkill = character.active_skills?.[0];
    const passive = passiveDetailsFromSkill(currentState.passiveSkill);
    const currentSuperAttacks = currentState.currentSuperAttacks;
    const normalSuperAttack = matchingFyiSuperAttack(currentSuperAttacks, "normal");
    const ultraSuperAttack = matchingFyiSuperAttack(currentSuperAttacks, "ultra");
    const extraSuperAttack = matchingFyiSuperAttack(currentSuperAttacks, "extra");

    return {
        name: cleanInlineText(character.name),
        title: cleanInlineText(currentState.leaderSkill?.name),
        maxLevel: currentState.maxLevel,
        maxSALevel: currentState.maxSuperAttackLevel,
        rarity: rarityFromText(character.rarity_text),
        releaseDate: releaseDate(character.release_dates?.initial),
        ezaReleaseDate: releaseDate(character.release_dates?.eza),
        sezaReleaseDate: releaseDate(character.release_dates?.seza),
        summonable: summonableLabel(character),
        isSummonable: isSummonable(character),
        isFreeToPlay: obtainability.isFreeToPlay,
        obtainability,
        characterClass: classFromAwakeningType(character.awakening_type_text),
        type: typeFromText(character.type_text),
        cost: toNumber(character.cost),
        id: character.id.toString(),
        legacyId: character.thumbnail_id?.toString(),
        portraitURL: portraitUrl(character.thumbnail_id),
        portraitFilename: `portrait_${character.id}`,
        portraitSpec: portraitSpecFromCharacter(character),
        leaderSkill: formatSkillDescription(currentState.leaderSkill),
        leaderSkillBoost: parseLeaderSkillDetails(formatSkillDescription(currentState.leaderSkill))?.displayBoost,
        leaderSkillDetails: parseLeaderSkillDetails(formatSkillDescription(currentState.leaderSkill)),
        superAttack: formatSuperAttackEffect(normalSuperAttack),
        ultraSuperAttack: formatSuperAttackEffect(ultraSuperAttack),
        exSuperAttack: formatSuperAttackEffect(extraSuperAttack),
        superAttackDetails: mapSuperAttackDetails(normalSuperAttack),
        ultraSuperAttackDetails: mapSuperAttackDetails(ultraSuperAttack),
        exSuperAttackDetails: mapSuperAttackDetails(extraSuperAttack),
        unitSuperAttacks: unitSuperAttacksFromFyi(currentSuperAttacks),
        passive: passive?.text ?? "",
        passiveDetails: passive,
        activeSkill: formatActiveSkill(activeSkill),
        activeSkillCondition: cleanMultilineText(activeSkill?.condition),
        transformationCondition: "",
        domain: "",
        links: (character.link_skills ?? []).map(linkSkill => cleanInlineText(linkSkill.name)).filter(Boolean),
        categories: (character.categories ?? []).map(category => cleanInlineText(category.name)).filter(Boolean),
        kiMeter: kiMeterText(character.ki_multipliers),
        artURL: cardArtUrl(character.thumbnail_id),
        artFilename: `art_${character.id}`,
        baseHP: currentBaseStat(character.stats.hp),
        maxLevelHP: currentMaxStat(character.stats.hp, currentState.latestType),
        freeDupeHP: currentMaxStat(character.stats.hp, currentState.latestType),
        rainbowHP: currentMaxStat(character.stats.hp, currentState.latestType),
        baseAttack: currentBaseStat(character.stats.atk),
        maxLevelAttack: currentMaxStat(character.stats.atk, currentState.latestType),
        freeDupeAttack: currentMaxStat(character.stats.atk, currentState.latestType),
        rainbowAttack: currentMaxStat(character.stats.atk, currentState.latestType),
        baseDefence: currentBaseStat(character.stats.def),
        maxDefence: currentMaxStat(character.stats.def, currentState.latestType),
        freeDupeDefence: currentMaxStat(character.stats.def, currentState.latestType),
        rainbowDefence: currentMaxStat(character.stats.def, currentState.latestType),
        kiMultiplier: kiMultiplierText(character.ki_multipliers),
        extraInfo: kiMultiplierExtraInfo(character.ki_multipliers),
        standbySkill: standby?.legacyText ?? "",
        finishingMove: standby?.finishSkills.map(finishSkill => finishSkill.legacyText ?? "") ?? [],
        standby,
        finishSkills: standby?.finishSkills ?? [],
        reversibleExchange,
        exclusiveSkillOrbs,
        transformations: enrichedTransformations,
    };
}

async function buildTransformations(
    rootCharacter: FyiCharacter,
    initialEntries: FyiTransformationPathEntry[],
    client: DokkanFyiClient,
): Promise<Transformation[]> {
    const visited = new Set<number>();
    const queue: TransformationBuildEntry[] = initialEntries.map(entry => ({
        entry,
        sourceCharacterId: rootCharacter.id,
    }));
    const transformations: Transformation[] = [];

    while (queue.length > 0) {
        const current = queue.shift()!;
        const targetCharacterId = current.entry.character.id;
        if (visited.has(targetCharacterId)) {
            continue;
        }

        visited.add(targetCharacterId);

        const targetPage = await client.fetchCharacterPage(targetCharacterId);
        transformations.push(mapDokkanFyiTransformation(rootCharacter.id, targetPage.payload.props.character, current.entry));

        for (const nestedEntry of targetPage.payload.props.transformationPath ?? []) {
            queue.push({
                entry: nestedEntry,
                sourceCharacterId: current.sourceCharacterId,
            });
        }
    }

    return transformations;
}

async function attachStandbyMetadataToTransformations(
    rootCharacter: FyiCharacter,
    standby: StandbySkillDetails | undefined,
    transformations: Transformation[],
    client: DokkanFyiClient,
): Promise<Transformation[]> {
    if (!standby) {
        return transformations;
    }

    const nextTransformations = [...transformations];

    if (standby.targetCharacterId) {
        const standbyTransformation = await ensureTransformation(
            nextTransformations,
            standby.targetCharacterId,
            rootCharacter.id,
            {
                character: {
                    id: toNumber(standby.targetCharacterId),
                    canonical_id: 0,
                    character_id: 0,
                    name: "",
                    rarity: 0,
                    rarity_text: "",
                    type: 0,
                    type_text: "",
                    awakening_type: 0,
                    awakening_type_text: "",
                    stats: {
                        hp: {},
                        atk: {},
                        def: {},
                    },
                    max_level: 0,
                    cost: 0,
                    thumbnail_id: 0,
                    has_images: true,
                    max_super_attack_level: 0,
                    base_character_id: toNumber(standby.targetCharacterId),
                },
                description: standby.condition,
                source: "Standby Skill",
            },
            client,
        );

        standbyTransformation.finishSkills = standby.finishSkills;
        standbyTransformation.finishingMove = standby.finishSkills
            .map(finishSkill => finishSkill.legacyText)
            .filter((value): value is string => Boolean(value));
        standbyTransformation.transformationSource = "standby";
        standbyTransformation.transformationSourceLabel = standbyTransformation.transformationSourceLabel || "Standby Skill";
    }

    for (const finishSkill of standby.finishSkills) {
        if (!finishSkill.targetTransformationId) {
            continue;
        }

        const finishTransformation = await ensureTransformation(
            nextTransformations,
            finishSkill.targetTransformationId,
            rootCharacter.id,
            {
                character: {
                    id: toNumber(finishSkill.targetTransformationId),
                    canonical_id: 0,
                    character_id: 0,
                    name: "",
                    rarity: 0,
                    rarity_text: "",
                    type: 0,
                    type_text: "",
                    awakening_type: 0,
                    awakening_type_text: "",
                    stats: {
                        hp: {},
                        atk: {},
                        def: {},
                    },
                    max_level: 0,
                    cost: 0,
                    thumbnail_id: 0,
                    has_images: true,
                    max_super_attack_level: 0,
                    base_character_id: toNumber(finishSkill.targetTransformationId),
                },
                description: finishSkill.condition,
                source: "Finish Effect",
            },
            client,
        );

        finishTransformation.transformationSource = "finish-skill";
        finishTransformation.transformationSourceLabel = finishTransformation.transformationSourceLabel || "Finish Effect";
        if (!finishTransformation.transformationCondition) {
            finishTransformation.transformationCondition = finishSkill.condition;
        }
    }

    return nextTransformations;
}

async function ensureTransformation(
    transformations: Transformation[],
    targetCharacterId: string,
    baseCharacterId: number,
    fallbackEntry: FyiTransformationPathEntry,
    client: DokkanFyiClient,
): Promise<Transformation> {
    const existing = transformations.find(transformation => transformation.id === targetCharacterId);
    if (existing) {
        return existing;
    }

    const targetPage = await client.fetchCharacterPage(toNumber(targetCharacterId));
    const transformation = mapDokkanFyiTransformation(
        baseCharacterId,
        targetPage.payload.props.character,
        fallbackEntry,
    );
    transformations.push(transformation);
    return transformation;
}

function mapDokkanFyiTransformation(
    baseCharacterId: number,
    character: FyiCharacter,
    entry: FyiTransformationPathEntry,
): Transformation {
    const currentState = selectCurrentState(character);
    const passive = passiveDetailsFromSkill(currentState.passiveSkill);
    const currentSuperAttacks = currentState.currentSuperAttacks;
    const normalSuperAttack = matchingFyiSuperAttack(currentSuperAttacks, "normal");
    const ultraSuperAttack = matchingFyiSuperAttack(currentSuperAttacks, "ultra");
    const extraSuperAttack = matchingFyiSuperAttack(currentSuperAttacks, "extra");
    const activeSkill = character.active_skills?.[0];
    const standby = standbyDetailsFromFyi(character.standby_skill);
    const obtainability = obtainabilityDetailsFromFyi(character);

    return {
        id: character.id.toString(),
        baseCharacterId: baseCharacterId.toString(),
        legacyId: character.thumbnail_id?.toString(),
        name: cleanInlineText(character.name),
        releaseDate: releaseDate(character.release_dates?.initial),
        ezaReleaseDate: releaseDate(character.release_dates?.eza),
        sezaReleaseDate: releaseDate(character.release_dates?.seza),
        summonable: summonableLabel(character),
        isSummonable: isSummonable(character),
        isFreeToPlay: obtainability.isFreeToPlay,
        obtainability,
        characterClass: classFromAwakeningType(character.awakening_type_text),
        type: typeFromText(character.type_text),
        superAttack: formatSuperAttackEffect(normalSuperAttack),
        ultraSuperAttack: formatSuperAttackEffect(ultraSuperAttack),
        exSuperAttack: formatSuperAttackEffect(extraSuperAttack),
        superAttackDetails: mapSuperAttackDetails(normalSuperAttack),
        ultraSuperAttackDetails: mapSuperAttackDetails(ultraSuperAttack),
        exSuperAttackDetails: mapSuperAttackDetails(extraSuperAttack),
        passive: passive?.text ?? "",
        passiveDetails: passive,
        activeSkill: formatActiveSkill(activeSkill),
        activeSkillCondition: cleanMultilineText(activeSkill?.condition),
        transformationCondition: cleanMultilineText(entry.description),
        domain: "",
        links: (character.link_skills ?? []).map(linkSkill => cleanInlineText(linkSkill.name)).filter(Boolean),
        portraitURL: portraitUrl(character.thumbnail_id),
        portraitFilename: `portrait_${character.id}`,
        portraitSpec: portraitSpecFromCharacter(character),
        artURL: cardArtUrl(character.thumbnail_id),
        artFilename: `art_${character.id}`,
        extraInfo: kiMultiplierExtraInfo(character.ki_multipliers),
        standbySkill: standby?.legacyText ?? "",
        finishingMove: standby?.finishSkills.map(finishSkill => finishSkill.legacyText ?? "").filter(Boolean) ?? [],
        standby,
        finishSkills: standby?.finishSkills ?? [],
        reversibleExchange: reversibleExchangeDetailsFromFyi(character),
        transformationSource: normalizeTransformationSource(entry.source, entry.description),
        transformationSourceLabel: cleanInlineText(entry.source),
    };
}

export function selectCurrentState(character: FyiCharacter): CurrentState {
    const latestType = character.release_dates?.latest_type ?? "initial";
    const useExtremeState = latestType !== "initial" && Boolean(character.extreme_z_awakening);

    return {
        latestType,
        maxLevel: useExtremeState
            ? toNumber(character.extreme_z_awakening?.max_level ?? character.max_level)
            : toNumber(character.max_level),
        maxSuperAttackLevel: useExtremeState
            ? toNumber(character.extreme_z_awakening?.max_super_attack_level ?? character.max_super_attack_level)
            : toNumber(character.max_super_attack_level),
        leaderSkill: useExtremeState
            ? (character.extreme_z_awakening?.leader_skill ?? character.leader_skill)
            : character.leader_skill,
        passiveSkill: useExtremeState
            ? (character.extreme_z_awakening?.passive_skill ?? character.passive_skill)
            : character.passive_skill,
        currentSuperAttacks: preferredSuperAttacks(character.super_attacks ?? [], useExtremeState),
    };
}

export function preferredSuperAttacks(
    superAttacks: FyiSuperAttack[],
    useExtremeState: boolean,
): FyiSuperAttack[] {
    const grouped = new Map<string, FyiSuperAttack[]>();

    for (const superAttack of superAttacks) {
        const key = `${superAttackKind(superAttack)}:${cleanInlineText(superAttack.name)}:${toNumber(superAttack.ki)}`;
        const current = grouped.get(key);
        if (current) {
            current.push(superAttack);
        } else {
            grouped.set(key, [superAttack]);
        }
    }

    return Array.from(grouped.values())
        .map(group => selectPreferredAttack(group, useExtremeState))
        .filter((superAttack): superAttack is FyiSuperAttack => Boolean(superAttack));
}

function selectPreferredAttack(group: FyiSuperAttack[], useExtremeState: boolean): FyiSuperAttack | undefined {
    const sorted = [...group].sort((left, right) => toNumber(right.level) - toNumber(left.level));
    if (!useExtremeState) {
        return sorted.find(superAttack => toNumber(superAttack.level) === 0) ?? sorted[0];
    }

    return sorted.find(superAttack => toNumber(superAttack.level) > 0) ?? sorted[0];
}

function matchingFyiSuperAttack(
    superAttacks: FyiSuperAttack[],
    kind: "normal" | "ultra" | "extra",
): FyiSuperAttack | undefined {
    return superAttacks.find(superAttack => superAttackKind(superAttack) === kind);
}

function superAttackKind(superAttack: FyiSuperAttack): "normal" | "ultra" | "extra" | "unit" {
    const style = cleanInlineText(superAttack.style).toLowerCase();
    const ki = toNumber(superAttack.ki);

    if (style.includes("unit") || style.includes("condition")) {
        return "unit";
    }

    if (style.includes("ex") || style.includes("extra")) {
        return "extra";
    }

    if (style.includes("ultra") || ki >= 18) {
        return "ultra";
    }

    return "normal";
}

function mapSuperAttackDetails(superAttack: FyiSuperAttack | undefined): SuperAttackDetails | undefined {
    if (!superAttack) {
        return undefined;
    }

    return {
        name: cleanInlineText(superAttack.name),
        effect: cleanMultilineText(superAttack.description),
        type: attackType(superAttack.category?.name),
        ki: toNumber(superAttack.ki),
        style: cleanInlineText(superAttack.style),
        condition: cleanMultilineText(superAttack.condition),
    };
}

function unitSuperAttacksFromFyi(superAttacks: FyiSuperAttack[]): UnitSuperAttack[] {
    return superAttacks
        .filter(superAttack => superAttackKind(superAttack) === "unit")
        .map(superAttack => ({
            name: cleanInlineText(superAttack.name),
            effect: cleanMultilineText(superAttack.description),
            type: attackType(superAttack.category?.name),
            ki: toNumber(superAttack.ki),
            style: cleanInlineText(superAttack.style),
            unitSuperAttack: formatSuperAttack(superAttack),
            unitSuperAttackCondition: cleanMultilineText(superAttack.condition),
        }));
}

function passiveDetailsFromSkill(skill: FyiSkill | undefined | null): PassiveDetails | undefined {
    if (!skill) {
        return undefined;
    }

    const text = cleanMultilineText(skill.description);
    const lines = text
        ? text.split("\n").map(line => line.trim()).filter(Boolean)
        : [];

    return {
        name: cleanInlineText(skill.name),
        text,
        lines,
        sections: lines.length ? splitPassiveSections(lines) : undefined,
    };
}

function buildCoverageReport(characters: Character[]): DokkanFyiCoverageReport {
    const rows = characters.map(character => {
        const notes: string[] = [];
        if (character.standby && character.standby.finishSkills.length === 0) {
            notes.push("Standby path found, but no explicit finish-skill payload was mapped.");
        }
        if ((character.transformations?.length ?? 0) > 0 && character.transformations?.every(transformation => !transformation.transformationCondition)) {
            notes.push("Transformation targets exist, but none exposed an explicit condition.");
        }

        const row: DokkanFyiCoverageRow = {
            id: character.id,
            name: character.name,
            latestType: character.sezaReleaseDate
                ? "seza"
                : character.ezaReleaseDate
                    ? "eza"
                    : "initial",
            hasActiveSkill: Boolean(character.activeSkill),
            hasStandbySkill: Boolean(character.standbySkill),
            hasReversibleExchange: Boolean(character.transformations?.some(transformation =>
                transformation.transformationCondition?.toLowerCase().includes("reversible exchange"),
            )),
            hasTransformationPath: (character.transformations?.length ?? 0) > 0,
            mappedTransformationCount: character.transformations?.length ?? 0,
            supportsExSuperAttack: Boolean(character.exSuperAttack),
            supportsUnitSuperAttack: (character.unitSuperAttacks?.length ?? 0) > 0,
            supportsFinishMove: Boolean(
                (character.finishSkills?.length ?? 0) > 0
                || character.transformations?.some(transformation => (transformation.finishSkills?.length ?? 0) > 0),
            ),
            notes,
        };

        return row;
    });

    return {
        generatedAt: new Date().toISOString(),
        source: "dokkan.fyi",
        characterIds: characters.map(character => character.id),
        summary: {
            totalCharacters: rows.length,
            activeSkillCount: rows.filter(row => row.hasActiveSkill).length,
            standbySkillCount: rows.filter(row => row.hasStandbySkill).length,
            reversibleExchangeCount: rows.filter(row => row.hasReversibleExchange).length,
            transformationSourceCount: rows.filter(row => row.hasTransformationPath).length,
            exSuperAttackCount: rows.filter(row => row.supportsExSuperAttack).length,
            unitSuperAttackCount: rows.filter(row => row.supportsUnitSuperAttack).length,
            finishMoveCount: rows.filter(row => row.supportsFinishMove).length,
        },
        rows,
    };
}

export function standbyDetailsFromFyi(skill: FyiStandbySkill | undefined | null): StandbySkillDetails | undefined {
    if (!skill) {
        return undefined;
    }

    const name = cleanInlineText(skill.name);
    const description = cleanMultilineText(skill.description);
    const condition = cleanMultilineText(skill.condition);
    const finishSkills = finishSkillsFromFyi(skill.finish_skills);

    return {
        id: skill.id?.toString(),
        name,
        description,
        condition,
        targetCharacterId: transformationTargetIdFromEffects(skill.effects),
        finishSkills,
        legacyText: [name, description].filter(Boolean).join(": "),
    };
}

export function finishSkillsFromFyi(skills: FyiFinishSkill[] | undefined | null): FinishSkill[] {
    return (skills ?? []).map(skill => {
        const name = cleanInlineText(skill.name);
        const description = cleanMultilineText(skill.description);
        const condition = cleanMultilineText(skill.condition);

        return {
            id: skill.id?.toString(),
            name,
            description,
            condition,
            targetTransformationId: transformationTargetIdFromEffects(skill.effects),
            effectKind: finishSkillEffectKind(skill),
            legacyText: formatFinishSkillLegacyText(name, description, condition),
        };
    });
}

export function normalizeTransformationSource(
    rawSource: string | null | undefined,
    description?: string | null,
): TransformationSource {
    const source = cleanInlineText(rawSource).toLowerCase();
    const detail = cleanInlineText(description).toLowerCase();

    if (source.includes("standby")) {
        return "standby";
    }

    if (source.includes("finish")) {
        return "finish-skill";
    }

    if (source.includes("active")) {
        return "active-skill";
    }

    if (source.includes("reversible exchange")) {
        return "reversible-exchange";
    }

    if (source.includes("passive") && detail.includes("reversible exchange")) {
        return "reversible-exchange";
    }

    if (source.includes("passive")) {
        return "passive-skill";
    }

    if (detail.includes("reversible exchange")) {
        return "reversible-exchange";
    }

    if (source) {
        return "transformation-path";
    }

    return detail ? "transformation-path" : "unknown";
}

function transformationTargetIdFromEffects(effects: FyiEffect[] | undefined): string | undefined {
    const targetId = effects
        ?.map(effect => effect.transformation?.character?.id)
        .find((value): value is number => typeof value === "number" && value > 0);

    return targetId?.toString();
}

export function obtainabilityDetailsFromFyi(character: FyiCharacter): CharacterObtainabilityDetails {
    const type = obtainabilityType(character);

    return {
        type,
        isFreeToPlay: type !== "summonable" && type !== "unknown",
        hasDirectAcquisitionDetails: false,
    };
}

export function reversibleExchangeDetailsFromFyi(
    character: FyiCharacter,
    transformations: Transformation[] = [],
): ReversibleExchangeDetails | undefined {
    if (!character.reversible_exchange_character_id) {
        return undefined;
    }

    const targetCharacterId = character.reversible_exchange_character_id.toString();
    const transformation = transformations.find(item => item.id === targetCharacterId);
    const condition = transformation?.transformationCondition
        ?? cleanMultilineText(character.active_skills?.[0]?.condition)
        ?? "";

    return {
        targetCharacterId,
        targetCharacterName: cleanInlineText(character.reversible_exchange_character?.name),
        condition,
        legacyText: condition,
    };
}

export function exclusiveSkillOrbsFromFyi(orbs: FyiSkillOrb[] | undefined | null): CharacterExclusiveSkillOrb[] {
    return (orbs ?? []).map(orb => ({
        id: orb.id.toString(),
        name: cleanInlineText(orb.name),
        description: cleanMultilineText(orb.description),
        grade: cleanInlineText(orb.grade),
        reusable: Boolean(orb.is_reusable),
        iconImageId: cleanInlineText(orb.img_id),
        iconURL: skillOrbIconUrl(orb.img_id),
        backgroundURL: skillOrbBackgroundUrl(orb.grade),
        skills: (orb.skills ?? []).map(skill => ({
            id: skill.id?.toString(),
            attribute: cleanInlineText(skill.attribute),
            level: skill.level ?? undefined,
            hiddenPotentialSkillId: skill.hidden_potential_skill_id ?? undefined,
        })),
        acquisition: skillOrbAcquisitionFromFyi(orb),
    }));
}

function finishSkillEffectKind(skill: FyiFinishSkill): FinishSkillEffectKind {
    const hasTransformationTarget = Boolean(transformationTargetIdFromEffects(skill.effects));
    const description = cleanInlineText(skill.description).toLowerCase();
    const mentionsDamage = description.includes("damage");
    const mentionsBuff = /(ki \+\d|atk|def|guards|evad|reduction|effective against)/.test(description);

    if (hasTransformationTarget && (mentionsDamage || mentionsBuff)) {
        return "mixed";
    }

    if (hasTransformationTarget) {
        return "transform";
    }

    if (mentionsDamage && mentionsBuff) {
        return "mixed";
    }

    if (mentionsDamage) {
        return "damage";
    }

    if (mentionsBuff) {
        return "buff";
    }

    return "unknown";
}

function formatFinishSkillLegacyText(name: string, description: string, condition: string): string {
    return [name, description, condition ? `Condition: ${condition}` : ""]
        .filter(Boolean)
        .join("\n");
}

function skillOrbAcquisitionFromFyi(orb: FyiSkillOrb): CharacterExclusiveSkillOrbAcquisition[] {
    const acquisition: CharacterExclusiveSkillOrbAcquisition[] = [];

    if (orb.mission_reward) {
        acquisition.push({
            sourceType: "mission-reward",
            sourceName: "Mission Reward",
            missionId: orb.mission_reward.mission_id?.toString(),
            missionCategoryId: orb.mission_reward.mission_category_id?.toString(),
            bannerImageUrl: cleanInlineText(orb.mission_reward.mission_category?.img),
            quantity: orb.mission_reward.quantity ?? undefined,
        });
    }

    for (const shopItem of orb.shop_items ?? []) {
        acquisition.push({
            sourceType: "shop-item",
            sourceName: "Shop Item",
            shopItemId: shopItem.id?.toString(),
            price: shopItem.price ?? undefined,
            discountedPrice: shopItem.discounted_price ?? undefined,
            treasureItemId: shopItem.treasure_item_id?.toString(),
            treasureItemName: cleanInlineText(shopItem.treasure_item?.name),
            treasureItemDescription: cleanMultilineText(shopItem.treasure_item?.description),
            treasureItemImageSuffix: shopItem.treasure_item?.image_suffix ?? undefined,
            startsAt: cleanInlineText(shopItem.starts_at),
            endsAt: cleanInlineText(shopItem.ends_at),
            isIndefinite: shopItem.is_indefinite ?? undefined,
        });
    }

    return acquisition;
}

function obtainabilityType(character: FyiCharacter): CharacterObtainability {
    if (character.is_stage_drop_reward) {
        return "stage-reward";
    }

    if (character.is_world_tournament_reward) {
        return "world-tournament-reward";
    }

    if (character.is_freely_obtainable) {
        return "freely-obtainable";
    }

    return "summonable";
}

function skillOrbIconUrl(imgId: string | null | undefined): string | undefined {
    const normalized = cleanInlineText(imgId);
    if (!normalized) {
        return undefined;
    }

    return `${DOKKAN_FYI_CDN_URL}/assets/en/item/equ_item_${normalized}.png`;
}

function skillOrbBackgroundUrl(grade: string | null | undefined): string | undefined {
    const normalized = cleanInlineText(grade).toLowerCase();
    if (!normalized) {
        return undefined;
    }

    if (!["bronze", "silver", "gold"].includes(normalized)) {
        return undefined;
    }

    return `${DOKKAN_FYI_CDN_URL}/assets/en/layout/en/image/equipment/equipment_thumb_bg/equ_base_${normalized}.png`;
}

function extractPagePayload(html: string): FyiPagePayload {
    const match = html.match(/<script data-page="app" type="application\/json">([\s\S]*?)<\/script>/);
    if (!match?.[1]) {
        throw new Error("Could not find dokkan.fyi page payload.");
    }

    return JSON.parse(match[1]) as FyiPagePayload;
}

function shouldFetchDeferredTransformationPath(payload: FyiPagePayload): boolean {
    return Boolean(payload.deferredProps?.default?.includes("transformationPath"));
}

function browserHeaders(): Record<string, string> {
    return {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9",
        "Cache-Control": "no-cache",
        "Pragma": "no-cache",
    };
}

function defaultDokkanFyiCharacterIds(): number[] {
    const ids = (process.env.DOKKAN_FYI_CHARACTER_IDS ?? "")
        .split(",")
        .map(value => parseInt(value.trim(), 10))
        .filter(Number.isFinite);

    return ids.length ? ids : DEFAULT_DOKKAN_FYI_EXPERIMENT_CHARACTER_IDS;
}

function rarityFromText(value: string | undefined): Rarities {
    const normalized = cleanInlineText(value).toUpperCase();
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
        default:
            return Rarities.N;
    }
}

function typeFromText(value: string | undefined): Types {
    const normalized = cleanInlineText(value).toUpperCase();
    switch (normalized) {
        case "PHY":
            return Types.PHY;
        case "STR":
            return Types.STR;
        case "INT":
            return Types.INT;
        case "TEQ":
            return Types.TEQ;
        default:
            return Types.AGL;
    }
}

function classFromAwakeningType(value: string | undefined): Classes {
    return cleanInlineText(value).toLowerCase() === "extreme"
        ? Classes.Extreme
        : Classes.Super;
}

function portraitUrl(thumbnailId: number): string {
    return `${DOKKAN_FYI_CDN_URL}/assets/en/character/thumb/card_${thumbnailId}_thumb/card_${thumbnailId}_thumb.png`;
}

function cardArtUrl(thumbnailId: number): string {
    return `${DOKKAN_FYI_CDN_URL}/assets/en/character/card/${thumbnailId}/card_${thumbnailId}_cutin.png`;
}

function portraitSpecFromCharacter(character: FyiCharacter | FyiCharacterSummary): PortraitSpec {
    return {
        iconId: character.thumbnail_id,
        frameColorId: typeFrameColorId(typeFromText(character.type_text)),
        rarity: rarityFromText(character.rarity_text),
        elementCode: typeElementCode(typeFromText(character.type_text)),
    };
}

function typeFrameColorId(type: Types): number {
    switch (type) {
        case Types.AGL:
            return 0;
        case Types.TEQ:
            return 1;
        case Types.INT:
            return 2;
        case Types.STR:
            return 3;
        case Types.PHY:
            return 4;
        default:
            return 0;
    }
}

function typeElementCode(type: Types): string {
    switch (type) {
        case Types.AGL:
            return "10";
        case Types.TEQ:
            return "11";
        case Types.INT:
            return "12";
        case Types.STR:
            return "13";
        case Types.PHY:
            return "14";
        default:
            return "10";
    }
}

function attackType(value: string | undefined | null): AttackTypes {
    const normalized = cleanInlineText(value).toLowerCase();
    if (normalized.includes("ki blast")) {
        return AttackTypes.KiBlast;
    }
    if (normalized.includes("unarmed")) {
        return AttackTypes.Unarmed;
    }
    if (normalized.includes("physical") || normalized.includes("armed")) {
        return AttackTypes.Armed;
    }
    return AttackTypes.Other;
}

function summonableLabel(character: FyiCharacter): string | undefined {
    if (character.is_stage_drop_reward) {
        return "Stage Reward";
    }
    if (character.is_world_tournament_reward) {
        return "World Tournament Reward";
    }
    if (character.is_freely_obtainable) {
        return "Freely Obtainable";
    }
    return "Summonable";
}

function isSummonable(character: FyiCharacter): boolean {
    return !character.is_freely_obtainable && !character.is_stage_drop_reward && !character.is_world_tournament_reward;
}

function currentBaseStat(value: FyiStatRange | undefined): number {
    return toNumber(value?.base);
}

function currentMaxStat(value: FyiStatRange | undefined, latestType: string): number {
    if (!value) {
        return 0;
    }

    if (latestType !== "initial" && value.eza !== undefined && value.eza !== null) {
        return toNumber(value.eza);
    }

    return toNumber(value.max);
}

function kiMeterText(kiMultipliers: Record<string, number> | undefined): string[] {
    if (!kiMultipliers) {
        return [];
    }

    return Object.entries(kiMultipliers)
        .sort((left, right) => parseInt(left[0], 10) - parseInt(right[0], 10))
        .map(([ki, percent]) => `${ki} Ki: ${percent}%`);
}

function kiMultiplierText(kiMultipliers: Record<string, number> | undefined): string {
    if (!kiMultipliers) {
        return "";
    }

    return Object.entries(kiMultipliers)
        .sort((left, right) => parseInt(left[0], 10) - parseInt(right[0], 10))
        .map(([ki, percent]) => `${ki} Ki ${percent}%`)
        .join("; ");
}

function kiMultiplierExtraInfo(kiMultipliers: Record<string, number> | undefined): CharacterExtraInfo | undefined {
    if (!kiMultipliers) {
        return undefined;
    }

    return {
        kiMultiplierText: kiMultiplierText(kiMultipliers),
        kiMultiplierSteps: Object.entries(kiMultipliers)
            .sort((left, right) => parseInt(left[0], 10) - parseInt(right[0], 10))
            .map(([ki, percent]) => ({
                ki: parseInt(ki, 10),
                percent: toNumber(percent),
            })),
    };
}

function formatSkillDescription(skill: FyiSkill | undefined | null): string {
    if (!skill) {
        return "";
    }

    return cleanMultilineText(skill.description);
}

function formatActiveSkill(skill: FyiActiveSkill | undefined): string {
    if (!skill) {
        return "";
    }

    const name = cleanInlineText(skill.name);
    const description = cleanMultilineText(skill.description);
    return [name, description].filter(Boolean).join(": ");
}

function formatStandbySkill(skill: FyiStandbySkill | undefined | null): string {
    if (!skill) {
        return "";
    }

    const name = cleanInlineText(skill.name);
    const description = cleanMultilineText(skill.description);
    return [name, description].filter(Boolean).join(": ");
}

function formatSuperAttack(superAttack: FyiSuperAttack | undefined): string {
    if (!superAttack) {
        return "";
    }

    const name = cleanInlineText(superAttack.name);
    const description = cleanMultilineText(superAttack.description);
    return [name, description].filter(Boolean).join(": ");
}

function formatSuperAttackEffect(superAttack: FyiSuperAttack | undefined): string {
    return cleanMultilineText(superAttack?.description);
}

function releaseDate(value: string | null | undefined): string | undefined {
    if (!value) {
        return undefined;
    }

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
        return undefined;
    }

    return parsed.toISOString();
}

function cleanMultilineText(value: string | null | undefined): string {
    if (!value) {
        return "";
    }

    return value
        .replace(/\{[^}]+\}/g, "")
        .replace(/\r/g, "")
        .split("\n")
        .map(line => line.trim().replace(/^\*\s*/, "").replace(/\s*\*$/, "").trim())
        .filter(Boolean)
        .join("\n")
        .trim();
}

function cleanInlineText(value: string | null | undefined): string {
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
