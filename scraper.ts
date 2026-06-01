import axios from 'axios';
import { execFile } from 'child_process';
import { JSDOM } from 'jsdom';
import { promisify } from 'util';
import { Character, Classes, Rarities, Transformation, Types, UnitSuperAttack } from "./character";

const DOKKAN_INFO_BASE_URL = 'https://dokkaninfo.com';
const DOKKAN_INFO_CARD_LIST_URL = `${DOKKAN_INFO_BASE_URL}/cards?sort=open_at`;
const DOKKAN_INFO_ASSET_BASE_URL = `${DOKKAN_INFO_BASE_URL}/assets/global/en`;
const DEFAULT_CONCURRENCY = 4;
const execFileAsync = promisify(execFile);

const browserHeaders = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache',
};

interface DokkanInfoCardSummary {
    id: number;
    name: string;
    rarity: number;
    lv_max: number;
    skill_lv_max?: number;
    cost?: number;
    hp_init?: number;
    hp_max?: number;
    hp_hipo?: number;
    atk_init?: number;
    atk_max?: number;
    atk_hipo?: number;
    def_init?: number;
    def_max?: number;
    def_hipo?: number;
    element: string;
    icon_id?: number;
    asset_id?: number;
    open_at?: number;
    eza_open_at?: number | false | null;
    seza_open_at?: number | false | null;
    optimal_awakening_step?: number;
    eball_mod_min?: number;
    eball_mod_num100?: number;
    eball_mod_mid?: number;
    eball_mod_mid_num?: number;
    eball_mod_max?: number;
    eball_mod_max_num?: number;
    eza?: number;
    seza?: number;
    awoken_max?: number;
}

interface DokkanInfoCardData {
    max_eza_step?: number;
    card: DokkanInfoCardSummary;
    eza_open_date?: DokkanInfoOpenDate;
    seza_open_date?: DokkanInfoOpenDate;
    hp_hipo?: number;
    atk_hipo?: number;
    def_hipo?: number;
    leader_skill?: DokkanInfoNamedDescription;
    passive_skill?: DokkanInfoPassiveSkill;
    super_attacks?: DokkanInfoSuperAttack[];
    active_skill?: DokkanInfoNamedDescription;
    stand_by_skill?: DokkanInfoNamedDescription;
    transformation?: DokkanInfoNamedDescription | DokkanInfoNamedDescription[];
    transformations?: DokkanInfoCardSummary[];
    transformation_details?: DokkanInfoCardData[];
    finish_skills?: DokkanInfoNamedDescription[];
    dokkan_fields?: DokkanInfoNamedDescription[];
    links?: DokkanInfoNamedDescription[];
    equipmentCategories?: DokkanInfoNamedDescription[];
    categories?: DokkanInfoNamedDescription[];
    eza_data?: DokkanInfoEzaData;
}

interface DokkanInfoEzaData {
    lv_max?: number;
    skill_lv_max?: number;
    leader_skill?: DokkanInfoNamedDescription;
    passive_skill?: DokkanInfoPassiveSkill;
    super_attacks?: DokkanInfoSuperAttack[];
    active_skill?: DokkanInfoNamedDescription;
    transformation?: DokkanInfoNamedDescription | DokkanInfoNamedDescription[];
}

interface DokkanInfoNamedDescription {
    id?: number;
    name?: string;
    description?: string;
    effect_description?: string;
    condition_description?: string;
    itemized_description?: string;
    causality_description?: string;
    conditions?: string;
}

interface DokkanInfoOpenDate {
    open_at?: number;
}

interface DokkanInfoPassiveSkill extends DokkanInfoNamedDescription {
    sougou_only_itemized_description?: string;
    kobetu_only_itemized_description?: string;
}

interface DokkanInfoSuperAttack {
    style?: string;
    eball_num_start?: number;
    causality_conditions?: string;
    causality_description?: string;
    attack?: DokkanInfoNamedDescription;
}

let cachedCardList: DokkanInfoCardSummary[] | undefined;
let preferCurl = false;

export async function getDokkanData(): Promise<Character[]> {
    const cards = await fetchDokkanInfoCardList();
    const selectedCards = selectedCardIds()
        ? cardsFromRequestedIds(cards)
        : cards
            .filter(isUsableCard)
            .sort((a, b) => (b.open_at ?? 0) - (a.open_at ?? 0));

    const limitedCards = applyDebugLimit(selectedCards);
    const concurrency = parseInt(process.env.DOKKAN_SCRAPER_CONCURRENCY ?? '', 10) || DEFAULT_CONCURRENCY;

    return mapWithConcurrency(limitedCards, concurrency, async (card, index) => {
        console.log(`[CARDS] ${index + 1}/${limitedCards.length}: ${card.id} ${card.name}`);
        const detail = await fetchDokkanInfoCardData(card);
        return mapDokkanInfoCard(detail);
    });
}

async function fetchDokkanInfoCardList(): Promise<DokkanInfoCardSummary[]> {
    if (cachedCardList) {
        return cachedCardList;
    }

    const document = await fetchFromWeb(DOKKAN_INFO_CARD_LIST_URL);
    const cardsJson = getRequiredJsonAttribute(document, 'cards', 'v-bind:cardsjson');
    cachedCardList = JSON.parse(cardsJson);
    return cachedCardList;
}

async function fetchDokkanInfoCardData(card: DokkanInfoCardSummary): Promise<DokkanInfoCardData> {
    const idsToTry = Array.from(new Set([card.id, card.icon_id, card.asset_id].filter(Boolean))) as number[];
    let lastError: Error | undefined;

    for (const id of idsToTry) {
        try {
            const document = await fetchFromWeb(`${DOKKAN_INFO_BASE_URL}/cards/${id}`);
            const dataJson = getRequiredJsonAttribute(document, 'card-info', 'v-bind:datajson');
            const data = JSON.parse(dataJson) as DokkanInfoCardData;
            mergeListOnlyCardFields(data.card, card);
            data.eza_data = await fetchDokkanInfoEzaData(data);
            data.transformation_details = await fetchDokkanInfoTransformationDetails(data);
            return data;
        } catch (error) {
            lastError = error as Error;
        }
    }

    throw lastError ?? new Error(`Could not fetch card detail for ${card.id}`);
}

function mergeListOnlyCardFields(detailCard: DokkanInfoCardSummary, listCard: DokkanInfoCardSummary): void {
    detailCard.id = listCard.id;
    detailCard.name = listCard.name || detailCard.name;
    detailCard.rarity = listCard.rarity;
    detailCard.lv_max = listCard.lv_max || detailCard.lv_max;
    detailCard.skill_lv_max = listCard.skill_lv_max ?? detailCard.skill_lv_max;
    detailCard.cost = listCard.cost ?? detailCard.cost;
    detailCard.hp_init = listCard.hp_init ?? detailCard.hp_init;
    detailCard.hp_max = listCard.hp_max ?? detailCard.hp_max;
    detailCard.hp_hipo = listCard.hp_hipo ?? detailCard.hp_hipo;
    detailCard.atk_init = listCard.atk_init ?? detailCard.atk_init;
    detailCard.atk_max = listCard.atk_max ?? detailCard.atk_max;
    detailCard.atk_hipo = listCard.atk_hipo ?? detailCard.atk_hipo;
    detailCard.def_init = listCard.def_init ?? detailCard.def_init;
    detailCard.def_max = listCard.def_max ?? detailCard.def_max;
    detailCard.def_hipo = listCard.def_hipo ?? detailCard.def_hipo;
    detailCard.element = listCard.element || detailCard.element;
    detailCard.open_at = listCard.open_at ?? detailCard.open_at;
    detailCard.eza_open_at = detailCard.eza_open_at ?? listCard.eza_open_at;
    detailCard.seza_open_at = detailCard.seza_open_at ?? listCard.seza_open_at;
    detailCard.eza = detailCard.eza ?? listCard.eza;
    detailCard.seza = detailCard.seza ?? listCard.seza;
}

async function fetchDokkanInfoEzaData(data: DokkanInfoCardData): Promise<DokkanInfoEzaData | undefined> {
    const step = data.max_eza_step ?? data.card.optimal_awakening_step;
    if (!step) {
        return undefined;
    }

    try {
        const json = await fetchPage(`${DOKKAN_INFO_BASE_URL}/api/cards/${data.card.id}/eza?eza=true&step=${step}`);
        const parsed = JSON.parse(json);
        return parsed.message ? undefined : parsed;
    } catch (error) {
        return undefined;
    }
}

async function fetchDokkanInfoTransformationDetails(data: DokkanInfoCardData): Promise<DokkanInfoCardData[]> {
    const transformationCards = (data.transformations ?? [])
        .filter(transformation => transformation.id !== data.card.id)
        .filter((transformation, index, transformations) => transformations.findIndex(item => item.id === transformation.id) === index);

    const ezaStep = data.max_eza_step ?? data.card.optimal_awakening_step;
    const details: DokkanInfoCardData[] = [];

    for (const transformation of transformationCards) {
        const detail = await fetchDokkanInfoTransformationData(transformation.id, ezaStep);
        if (detail) {
            detail.card.asset_id = detail.card.asset_id ?? detail.card.icon_id ?? normalizeAssetId(detail.card.id);
            details.push(detail);
        }
    }

    return details;
}

async function fetchDokkanInfoTransformationData(transformationId: number, ezaStep?: number): Promise<DokkanInfoCardData | undefined> {
    const baseUrl = `${DOKKAN_INFO_BASE_URL}/api/cards/${transformationId}/transformation`;
    const urls = ezaStep
        ? [baseUrl, `${baseUrl}?eza=true&step=${ezaStep}`]
        : [baseUrl];

    for (const url of urls) {
        try {
            const json = await fetchPage(url);
            const parsed = JSON.parse(json);
            if (!parsed.message) {
                return parsed;
            }
        } catch (error) {
            continue;
        }
    }

    return undefined;
}

async function fetchPage(url: string, retries = 3): Promise<string> {
    while (retries > 0) {
        try {
            if (preferCurl) {
                return await fetchPageWithCurl(url);
            }

            const html = await fetchPageWithAxios(url);
            return html;
        } catch (error) {
            try {
                preferCurl = true;
                return await fetchPageWithCurl(url);
            } catch (curlError) {
                retries--;
                if (retries <= 0) {
                    throw curlError;
                }
            }

            await delay(1000);
        }
    }

    throw new Error(`Could not fetch ${url}`);
}

async function fetchPageWithAxios(url: string): Promise<string> {
    const response = await axios.get(url, {
        headers: browserHeaders,
        timeout: 60000,
        responseType: 'text',
    });

    return validateHtml(url, response.data);
}

async function fetchPageWithCurl(url: string): Promise<string> {
    const curlCommand = process.platform === 'win32' ? 'curl.exe' : 'curl';
    const { stdout } = await execFileAsync(curlCommand, [
        '-L',
        '--max-time',
        '60',
        '-sS',
        url,
        '-H',
        `User-Agent: ${browserHeaders['User-Agent']}`,
        '-H',
        `Accept: ${browserHeaders['Accept']}`,
        '-H',
        `Accept-Language: ${browserHeaders['Accept-Language']}`,
        '-H',
        `Cache-Control: ${browserHeaders['Cache-Control']}`,
        '-H',
        `Pragma: ${browserHeaders['Pragma']}`,
    ], {
        maxBuffer: 64 * 1024 * 1024,
    });

    return validateHtml(url, stdout);
}

function validateHtml(url: string, html: string): string {
    if (typeof html === 'string' && html.includes('Sorry, you have been blocked')) {
        throw new Error(`DokkanInfo blocked the request to ${url}.`);
    }

    return html;
}

export async function fetchFromWeb(url: string): Promise<Document> {
    const html = await fetchPage(url);
    const dom = new JSDOM(html);
    return dom.window.document;
}

export function extractCharacterData(characterDocument: Document): Character {
    const dataJson = getRequiredJsonAttribute(characterDocument, 'card-info', 'v-bind:datajson');
    return mapDokkanInfoCard(JSON.parse(dataJson));
}

function mapDokkanInfoCard(data: DokkanInfoCardData): Character {
    const card = data.card;
    const assetId = card.asset_id ?? card.icon_id ?? normalizeAssetId(card.id);
    const id = card.id.toString();
    const legacyId = toLegacyId(assetId);
    const hipoHp = data.hp_hipo ?? card.hp_hipo ?? 0;
    const hipoAtk = data.atk_hipo ?? card.atk_hipo ?? 0;
    const hipoDef = data.def_hipo ?? card.def_hipo ?? 0;
    const superAttacks = data.super_attacks ?? [];
    const ezaSuperAttacks = data.eza_data?.super_attacks ?? [];

    const characterData: Character = {
        name: cleanText(card.name),
        title: cleanText(data.leader_skill?.name),
        maxLevel: toNumber(card.lv_max),
        maxSALevel: toNumber(card.skill_lv_max),
        rarity: rarityFromNumber(card.rarity),
        releaseDate: releaseDate(card.open_at),
        ezaReleaseDate: releaseDate(card.eza_open_at ?? data.eza_open_date?.open_at),
        sezaReleaseDate: releaseDate(card.seza_open_at ?? data.seza_open_date?.open_at),
        characterClass: classFromElement(card.element),
        type: typeFromElement(card.element),
        cost: toNumber(card.cost),
        id,
        legacyId,
        portraitURL: cardImageUrl(assetId, `card_${assetId}_character.png`),
        portraitFilename: `portrait_${id}`,
        leaderSkill: cleanText(data.leader_skill?.description),
        ezaLeaderSkill: cleanText(data.eza_data?.leader_skill?.description),
        superAttack: superAttackText(superAttacks, 'normal'),
        ezaSuperAttack: superAttackText(ezaSuperAttacks, 'normal'),
        ultraSuperAttack: superAttackText(superAttacks, 'ultra'),
        ezaUltraSuperAttack: superAttackText(ezaSuperAttacks, 'ultra'),
        exSuperAttack: superAttackText(superAttacks, 'extra'),
        ezaExSuperAttack: superAttackText(ezaSuperAttacks, 'extra'),
        unitSuperAttacks: unitSuperAttacks(superAttacks),
        passive: cleanText(data.passive_skill?.itemized_description ?? data.passive_skill?.description),
        ezaPassive: cleanText(data.eza_data?.passive_skill?.itemized_description ?? data.eza_data?.passive_skill?.description),
        activeSkill: activeSkillText(data.active_skill),
        activeSkillCondition: activeSkillCondition(data.active_skill),
        ezaActiveSkill: activeSkillText(data.eza_data?.active_skill),
        ezaActiveSkillCondition: activeSkillCondition(data.eza_data?.active_skill),
        transformationCondition: namedDescriptionsText(data.transformation),
        domain: namedDescriptionsText(data.dokkan_fields),
        links: uniqueCleanNames(data.links),
        categories: uniqueCleanNames(data.equipmentCategories ?? data.categories),
        kiMeter: kiMeter(card),
        artURL: cardImageUrl(assetId, `${assetId}.png`),
        artFilename: `art_${id}`,
        baseHP: toNumber(card.hp_init),
        maxLevelHP: toNumber(card.hp_max),
        freeDupeHP: freeDupeStat(card.hp_max, hipoHp),
        rainbowHP: rainbowStat(card.hp_max, hipoHp),
        baseAttack: toNumber(card.atk_init),
        maxLevelAttack: toNumber(card.atk_max),
        freeDupeAttack: freeDupeStat(card.atk_max, hipoAtk),
        rainbowAttack: rainbowStat(card.atk_max, hipoAtk),
        baseDefence: toNumber(card.def_init),
        maxDefence: toNumber(card.def_max),
        freeDupeDefence: freeDupeStat(card.def_max, hipoDef),
        rainbowDefence: rainbowStat(card.def_max, hipoDef),
        kiMultiplier: kiMultiplier(card),
        standbySkill: cleanText(data.stand_by_skill?.description ?? data.stand_by_skill?.name),
        finishingMove: finishSkillTexts(data.finish_skills),
        transformations: transformations(data, id),
    };

    return cleanObject(characterData);
}

function getRequiredJsonAttribute(document: Document, selector: string, attribute: string): string {
    const value = document.querySelector(selector)?.getAttribute(attribute);
    if (!value) {
        throw new Error(`Could not find ${attribute} on <${selector}>.`);
    }

    return value;
}

function isUsableCard(card: DokkanInfoCardSummary): boolean {
    const nowSeconds = Math.floor(Date.now() / 1000);
    return card.rarity >= 0
        && card.rarity <= 5
        && card.id <= 3000000
        && (card.hp_init ?? 0) > 300
        && (card.open_at ?? 0) <= nowSeconds;
}

function selectedCardIds(): number[] | undefined {
    const ids = (process.env.DOKKAN_SCRAPER_CARD_IDS ?? '')
        .split(',')
        .map(id => parseInt(id.trim(), 10))
        .filter(Number.isFinite);

    return ids.length ? ids : undefined;
}

function cardsFromRequestedIds(cards: DokkanInfoCardSummary[]): DokkanInfoCardSummary[] {
    const cardsById = new Map(cards.map(card => [card.id, card]));
    return selectedCardIds().map(id => cardsById.get(id) ?? {
        id,
        name: '',
        rarity: 0,
        lv_max: 0,
        element: '00',
    });
}

function applyDebugLimit(cards: DokkanInfoCardSummary[]): DokkanInfoCardSummary[] {
    const limit = parseInt(process.env.DOKKAN_SCRAPER_LIMIT ?? '', 10);
    return limit > 0 ? cards.slice(0, limit) : cards;
}

function normalizeAssetId(cardId: number): number {
    return Math.floor(cardId / 10) * 10;
}

function toLegacyId(assetId: number): string {
    const asset = assetId.toString();
    if (asset.length < 7) {
        return asset;
    }

    return `${asset[0]}${asset.slice(3, -1)}`;
}

function cardImageUrl(assetId: number, filename: string): string {
    return `${DOKKAN_INFO_ASSET_BASE_URL}/character/card/${assetId}/${filename}`;
}

function rarityFromNumber(rarity: number): Rarities {
    const rarityMap = [Rarities.N, Rarities.R, Rarities.SR, Rarities.SSR, Rarities.UR, Rarities.LR];
    return rarityMap[rarity] ?? Rarities.N;
}

function typeFromElement(element: string): Types {
    const typeIndex = parseInt(element, 10) % 10;
    const typeMap = [Types.AGL, Types.TEQ, Types.INT, Types.STR, Types.PHY];
    return typeMap[typeIndex] ?? Types.AGL;
}

function classFromElement(element: string): Classes {
    const classIndex = Math.floor(parseInt(element, 10) / 10) % 10;
    return classIndex === 2 ? Classes.Extreme : Classes.Super;
}

function superAttackText(superAttacks: DokkanInfoSuperAttack[], kind: 'normal' | 'ultra' | 'extra'): string {
    const attack = superAttacks.find(superAttack => {
        const style = (superAttack.style ?? '').toLowerCase();
        const ki = superAttack.eball_num_start ?? 0;
        if (kind === 'extra') {
            return style.includes('extra');
        }

        if (kind === 'ultra') {
            return style.includes('hyper') || style.includes('ultra') || (!style.includes('extra') && !style.includes('condition') && ki >= 18);
        }

        return style.includes('normal') || (!style.includes('hyper') && !style.includes('ultra') && !style.includes('extra') && !style.includes('condition') && ki < 18);
    });

    return cleanText(formatNamedDescription(attack?.attack));
}

function unitSuperAttacks(superAttacks: DokkanInfoSuperAttack[]): UnitSuperAttack[] {
    return superAttacks
        .filter(superAttack => {
            const style = (superAttack.style ?? '').toLowerCase();
            return style.includes('unit') || style.includes('condition');
        })
        .map(superAttack => ({
            unitSuperAttack: cleanText(formatNamedDescription(superAttack.attack)),
            unitSuperAttackCondition: cleanText(superAttack.causality_description ?? superAttack.causality_conditions),
        }))
        .filter(superAttack => superAttack.unitSuperAttack || superAttack.unitSuperAttackCondition);
}

function formatNamedDescription(value: DokkanInfoNamedDescription | undefined): string {
    if (!value) {
        return '';
    }

    const name = cleanText(value.name);
    const description = cleanText(value.itemized_description ?? value.effect_description ?? value.description);
    return [name, description].filter(Boolean).join(': ');
}

function activeSkillText(value: DokkanInfoNamedDescription | undefined): string {
    return formatNamedDescription(value);
}

function activeSkillCondition(value: DokkanInfoNamedDescription | undefined): string {
    return cleanText(value?.condition_description ?? value?.causality_description ?? value?.conditions);
}

function namedDescriptionsText(value: DokkanInfoNamedDescription | DokkanInfoNamedDescription[] | undefined): string {
    const values = Array.isArray(value) ? value : value ? [value] : [];
    return values.map(formatNamedDescription).filter(Boolean).join('; ');
}

function finishSkillTexts(values: DokkanInfoNamedDescription[] | undefined): string[] {
    return (values ?? []).map(formatNamedDescription).filter(Boolean);
}

function transformations(data: DokkanInfoCardData, baseCharacterId: string): Transformation[] {
    const currentCardId = data.card.id;
    const links = uniqueCleanNames(data.links);
    const detailsById = new Map((data.transformation_details ?? []).map(detail => [detail.card.id, detail]));
    const transformedCards = (data.transformations ?? [])
        .filter(transformation => transformation.id !== currentCardId)
        .filter((transformation, index, allTransformations) => allTransformations.findIndex(item => item.id === transformation.id) === index);

    return transformedCards.map(transformation => {
        const detail = detailsById.get(transformation.id);
        const detailCard = detail?.card ?? transformation;
        const assetId = detailCard.asset_id ?? detailCard.icon_id ?? normalizeAssetId(detailCard.id);
        const id = detailCard.id.toString();
        const legacyId = toLegacyId(assetId);
        const superAttacks = detail?.super_attacks ?? [];
        const detailLinks = uniqueCleanNames(detail?.links);

        return cleanObject({
            id,
            baseCharacterId,
            legacyId,
            name: cleanText(detailCard.name),
            releaseDate: releaseDate(detailCard.open_at),
            ezaReleaseDate: releaseDate(detailCard.eza_open_at),
            sezaReleaseDate: releaseDate(detailCard.seza_open_at),
            characterClass: classFromElement(detailCard.element),
            type: typeFromElement(detailCard.element),
            superAttack: superAttackText(superAttacks, 'normal'),
            ultraSuperAttack: superAttackText(superAttacks, 'ultra'),
            exSuperAttack: superAttackText(superAttacks, 'extra'),
            passive: cleanText(detail?.passive_skill?.itemized_description ?? detail?.passive_skill?.description),
            activeSkill: activeSkillText(detail?.active_skill),
            activeSkillCondition: activeSkillCondition(detail?.active_skill),
            transformationCondition: namedDescriptionsText(detail?.transformation),
            domain: namedDescriptionsText(detail?.dokkan_fields),
            links: detailLinks.length ? detailLinks : links,
            portraitURL: cardImageUrl(assetId, `card_${assetId}_character.png`),
            portraitFilename: `portrait_${id}`,
            artURL: cardImageUrl(assetId, `${assetId}.png`),
            artFilename: `art_${id}`,
            standbySkill: cleanText(detail?.stand_by_skill?.description ?? detail?.stand_by_skill?.name),
            finishingMove: finishSkillTexts(detail?.finish_skills),
        }) as Transformation;
    });
}

function uniqueCleanNames(values: DokkanInfoNamedDescription[] | undefined): string[] {
    return Array.from(new Set((values ?? [])
        .map(value => cleanText(value.name ?? value.description))
        .filter(Boolean)));
}

function kiMeter(card: DokkanInfoCardSummary): string[] {
    const kiValues = [
        card.eball_mod_num100 ? `${card.eball_mod_num100} Ki: 100%` : '',
        card.eball_mod_mid_num ? `${card.eball_mod_mid_num} Ki: ${card.eball_mod_mid}%` : '',
        card.eball_mod_max_num ? `${card.eball_mod_max_num} Ki: ${card.eball_mod_max}%` : '',
    ];

    return kiValues.filter(Boolean);
}

function kiMultiplier(card: DokkanInfoCardSummary): string {
    const values = [
        card.eball_mod_min !== undefined ? `Minimum ${card.eball_mod_min}%` : '',
        card.eball_mod_num100 !== undefined ? `${card.eball_mod_num100} Ki 100%` : '',
        card.eball_mod_mid_num ? `${card.eball_mod_mid_num} Ki ${card.eball_mod_mid}%` : '',
        card.eball_mod_max_num ? `${card.eball_mod_max_num} Ki ${card.eball_mod_max}%` : '',
    ];

    return values.filter(Boolean).join('; ');
}

function freeDupeStat(maxStat: number | undefined, hipoStat: number): number {
    return toNumber(maxStat) + Math.min(2000, Math.max(0, hipoStat));
}

function rainbowStat(maxStat: number | undefined, hipoStat: number): number {
    return toNumber(maxStat) + Math.max(0, hipoStat);
}

function releaseDate(value: number | false | null | undefined): string {
    if (!value) {
        return '';
    }

    return new Date(value * 1000).toISOString();
}

function toNumber(value: number | undefined): number {
    return Number.isFinite(value) ? Number(value) : 0;
}

function cleanText(value: string | undefined | null): string {
    return (value ?? '')
        .replace(/&#039;/g, "'")
        .replace(/&quot;/g, '"')
        .replace(/&amp;/g, '&')
        .replace(/\{[^}]+}/g, '')
        .replace(/\*([^*]+)\*/g, '$1:')
        .replace(/\r?\n\s*-\s*/g, '; ')
        .replace(/^\s*-\s*/g, '')
        .replace(/\r?\n/g, ' ')
        .replace(/\s+/g, ' ')
        .replace(/\s+([,.;:])/g, '$1')
        .replace(/:\s*;/g, ':')
        .replace(/^;\s*/, '')
        .trim();
}

function cleanObject<T>(obj: T): T {
    const mutableObject = obj as any;

    for (const propName in mutableObject) {
        const value = mutableObject[propName];
        if (value === undefined
            || value === ''
            || (Array.isArray(value) && value.length === 0)) {
            delete mutableObject[propName];
        }
    }

    return obj;
}

async function mapWithConcurrency<T, U>(
    items: T[],
    concurrency: number,
    mapper: (item: T, index: number) => Promise<U>,
): Promise<U[]> {
    const results: U[] = new Array(items.length);
    let nextIndex = 0;

    async function worker() {
        while (nextIndex < items.length) {
            const currentIndex = nextIndex++;
            results[currentIndex] = await mapper(items[currentIndex], currentIndex);
        }
    }

    await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
    return results;
}

function delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}
