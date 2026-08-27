import axios from 'axios';
import { createHash } from 'crypto';
import { execFile } from 'child_process';
import { JSDOM } from 'jsdom';
import { promisify } from 'util';
import { AttackTypes, AwakeningReference, Character, CharacterEquipmentReference, CharacterExtraInfo, Classes, DokkanFrontierPassive, Equipment, EquipmentRestriction, EquipmentSourcePage, LeaderSkillClause, LeaderSkillDetails, LeaderSkillTeamCondition, PassiveDetails, PassiveSection, PortraitSpec, Rarities, SuperAttackDetails, Transformation, Types, UnitSuperAttack } from "./character";

const DOKKAN_INFO_BASE_URL = 'https://dokkaninfo.com';
const DOKKAN_INFO_CARD_LIST_URL = `${DOKKAN_INFO_BASE_URL}/cards?sort=open_at`;
const DOKKAN_INFO_EQUIPMENT_BASE_URL = `${DOKKAN_INFO_BASE_URL}/items/equipment`;
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
    character_id?: number;
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
    awakening_element_type?: number;
    bg_element?: string;
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
    equipment?: DokkanInfoEquipment[];
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
    awakening_cards?: DokkanInfoCardSummary[];
    finish_skills?: DokkanInfoNamedDescription[];
    dokkan_fields?: DokkanInfoNamedDescription[];
    originPassiveSkills?: DokkanInfoFrontierPassive[];
    links?: DokkanInfoNamedDescription[];
    equipmentCategories?: DokkanInfoNamedDescription[];
    cardEquipment?: Record<string, DokkanInfoEquipment>;
    characterEquipment?: Record<string, DokkanInfoEquipment>;
    categories?: DokkanInfoNamedDescription[];
    summonable?: string;
    eza_data?: DokkanInfoEzaData;
}

interface DokkanInfoEquipment {
    id?: number;
    name?: string;
    description?: string;
    grade?: string;
    selling_exchange_point?: number;
    hp?: number;
    attack?: number;
    defense?: number;
    equipment_skill_limitation_set_id?: number;
    icon_image_id?: number;
    is_eternal?: number;
    count?: number;
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
    rawAttribute?: DokkanInfoRawAttribute;
    extras?: DokkanInfoNamedDescription[];
}

interface DokkanInfoFrontierPassive {
    title?: string;
    origin_battle_id?: number;
    passive_skill?: string;
}

interface DokkanInfoRawAttribute {
    id?: number;
    raw_attribute?: number;
    name?: string;
}

type DokkanListValue<T> = T[] | Record<string, T> | undefined;

type LeaderSkillBoostForm = 'percentage' | 'flat';

interface LeaderSkillBoostValues {
    hp: number;
    atk: number;
    def: number;
    boostForm: LeaderSkillBoostForm;
}

let cachedCardList: DokkanInfoCardSummary[] | undefined;
let preferCurl = false;

export async function getDokkanData(): Promise<Character[]> {
    const cards = await fetchDokkanInfoCardList();
    const selectedCards = selectedCardIds()
        ? cardsFromRequestedIds(cards)
        : filterBaseAwakeningDuplicates(cards.filter(isUsableCard))
            .sort((a, b) => (b.open_at ?? 0) - (a.open_at ?? 0));

    const limitedCards = applyDebugLimit(selectedCards);
    const concurrency = parseInt(process.env.DOKKAN_SCRAPER_CONCURRENCY ?? '', 10) || DEFAULT_CONCURRENCY;

    const results = await mapWithConcurrency(limitedCards, concurrency, async (card, index) => {
        console.log(`[CARDS] ${index + 1}/${limitedCards.length}: ${card.id} ${card.name}`);
        const detail = await fetchDokkanInfoCardData(card);
        if (isSellingOnlyCard(detail)) {
            console.log(`[CARDS] Skipping selling-only card ${card.id} ${card.name}`);
            return undefined;
        }

        return mapDokkanInfoCard(detail);
    });

    return results.filter((card): card is Character => Boolean(card));
}

export async function getEquipmentData(): Promise<Equipment[]> {
    const equipment = new Map<string, Equipment>();
    const concurrency = parseInt(process.env.DOKKAN_SCRAPER_CONCURRENCY ?? '', 10) || DEFAULT_CONCURRENCY;

    await addRenderedEquipmentPage(equipment, `${DOKKAN_INFO_EQUIPMENT_BASE_URL}/other`, {
        type: 'other',
        name: 'Other',
        url: `${DOKKAN_INFO_EQUIPMENT_BASE_URL}/other`,
    });

    await scrapeEquipmentSection(equipment, 'categories', 'category', concurrency);
    await scrapeEquipmentSection(equipment, 'characters', 'character', concurrency);
    await scrapeEquipmentSection(equipment, 'types', 'type', concurrency);
    await scrapeCardSpecificEquipment(equipment, concurrency);

    return Array.from(equipment.values())
        .map(cleanObject)
        .sort((a, b) => (a.officialId ?? Number.MAX_SAFE_INTEGER) - (b.officialId ?? Number.MAX_SAFE_INTEGER)
            || a.name.localeCompare(b.name)
            || a.id.localeCompare(b.id));
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
    const transformationCards = arrayFromDokkanList(data.transformations as DokkanListValue<DokkanInfoCardSummary>)
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

async function scrapeEquipmentSection(
    equipment: Map<string, Equipment>,
    section: 'categories' | 'characters' | 'types',
    restrictionType: EquipmentSourcePage['type'],
    concurrency: number,
): Promise<void> {
    const indexDocument = await fetchFromWeb(`${DOKKAN_INFO_EQUIPMENT_BASE_URL}/${section}`);
    const links = equipmentIndexLinks(indexDocument, section, restrictionType);
    const limitedLinks = applyEquipmentDebugLimit(links);

    await mapWithConcurrency(limitedLinks, concurrency, async (source, index) => {
        console.log(`[EQUIPMENT:${section}] ${index + 1}/${limitedLinks.length}: ${source.id ?? ''} ${source.name ?? ''}`);
        await addRenderedEquipmentPage(equipment, source.url, source);
    });
}

async function scrapeCardSpecificEquipment(equipment: Map<string, Equipment>, concurrency: number): Promise<void> {
    const indexDocument = await fetchFromWeb(`${DOKKAN_INFO_EQUIPMENT_BASE_URL}/cards`);
    const links = applyEquipmentDebugLimit(equipmentIndexLinks(indexDocument, 'cards', 'card'));

    await mapWithConcurrency(links, concurrency, async (source, index) => {
        console.log(`[EQUIPMENT:cards] ${index + 1}/${links.length}: ${source.id ?? ''}`);
        const document = await fetchFromWeb(source.url);
        const cardJson = document.querySelector('card-icon')?.getAttribute('v-bind:card');
        if (!cardJson) {
            return;
        }

        const card = JSON.parse(cardJson) as DokkanInfoCardSummary;
        const cardSource = {
            ...source,
            id: card.id?.toString() ?? source.id,
            name: cleanText(card.name) || source.name,
        };

        for (const item of card.equipment ?? []) {
            const restrictions = equipmentRestrictions(item.description, cardSource, card);
            addEquipment(equipment, equipmentFromDokkanInfo(item, cardSource, restrictions));
        }
    });
}

async function addRenderedEquipmentPage(equipment: Map<string, Equipment>, url: string, source: EquipmentSourcePage): Promise<void> {
    const document = await fetchFromWeb(url);
    const titleName = equipmentSourceName(document.querySelector('title')?.textContent ?? '');
    const sourceFromTitle = {
        ...source,
        name: equipmentSourceName(source.name) || titleName,
    };

    for (const item of renderedEquipmentItems(document, sourceFromTitle)) {
        addEquipment(equipment, item);
    }
}

function equipmentSourceName(value: string | undefined): string {
    return cleanText(value)
        .replace(/^Equipment\s*-\s*/i, '')
        .replace(/\s*\|\s*Dokkan Info!?\s*$/i, '')
        .trim();
}

function equipmentIndexLinks(document: Document, section: string, restrictionType: EquipmentSourcePage['type']): EquipmentSourcePage[] {
    return Array.from(document.querySelectorAll(`a[href^="/items/equipment/${section}/"]`))
        .map(anchor => {
            const href = anchor.getAttribute('href') ?? '';
            const id = href.split('/').pop();
            const imageAlt = anchor.querySelector('img')?.getAttribute('alt');
            const text = cleanText(anchor.textContent);
            const name = cleanText(imageAlt && !imageAlt.startsWith('cha_type_icon_') ? imageAlt : text);
            return {
                type: id === 'super' || id === 'extreme' ? 'class' : restrictionType,
                id,
                name,
                url: `${DOKKAN_INFO_BASE_URL}${href}`,
            } as EquipmentSourcePage;
        })
        .filter(source => source.id && source.url)
        .filter((source, index, sources) => sources.findIndex(item => item.url === source.url) === index);
}

function renderedEquipmentItems(document: Document, source: EquipmentSourcePage): Equipment[] {
    const containers = new Set<Element>();

    for (const icon of Array.from(document.querySelectorAll('img[src*="/item/equipment/equ_item_"]'))) {
        const container = closestEquipmentContainer(icon);
        if (container) {
            containers.add(container);
        }
    }

    return Array.from(containers).map(container => {
        const name = cleanText(container.querySelector('b')?.textContent);
        const icon = container.querySelector('img[src*="/item/equipment/equ_item_"]');
        const background = container.querySelector('img[src*="equipment_thumb_bg"]');
        const description = cleanText(Array.from(container.querySelectorAll('.row.border-radius-10-top .col'))
            .map(element => cleanText(element.textContent))
            .filter(text => text && text !== name && !text.includes('equ_base_') && !text.includes('equ_item_'))
            .pop());
        const iconImageId = numericIdFromPath(icon?.getAttribute('src') ?? '');
        const grade = gradeFromBackground(background?.getAttribute('alt') ?? background?.getAttribute('src') ?? '');

        return equipmentFromRenderedHtml({
            name,
            description,
            grade,
            icon_image_id: iconImageId,
            hp: statFromDescription(description, 'HP'),
            attack: statFromDescription(description, 'ATK'),
            defense: statFromDescription(description, 'DEF'),
        }, source);
    }).filter(item => item.name);
}

function closestEquipmentContainer(icon: Element): Element | undefined {
    let current: Element | null = icon;
    while (current) {
        if (current.classList.contains('bg-main') && current.querySelector('b') && current.querySelector('img[src*="/item/equipment/equ_item_"]')) {
            return current;
        }

        current = current.parentElement;
    }

    return undefined;
}

function equipmentFromRenderedHtml(item: DokkanInfoEquipment, source: EquipmentSourcePage): Equipment {
    return equipmentFromDokkanInfo(item, source, equipmentRestrictions(item.description, source));
}

function equipmentFromDokkanInfo(item: DokkanInfoEquipment, source: EquipmentSourcePage, restrictions: EquipmentRestriction[]): Equipment {
    const officialId = item.id;
    const iconImageId = item.icon_image_id;
    const grade = cleanText(item.grade);
    const id = officialId ? officialId.toString() : syntheticEquipmentId(item, source);

    return cleanObject({
        id,
        officialId,
        name: cleanText(item.name),
        description: cleanText(item.description),
        grade,
        hp: toNumber(item.hp),
        attack: toNumber(item.attack),
        defence: toNumber(item.defense),
        sellingExchangePoint: item.selling_exchange_point,
        count: item.count,
        equipmentSkillLimitationSetId: item.equipment_skill_limitation_set_id,
        iconImageId,
        isEternal: item.is_eternal === undefined ? undefined : item.is_eternal === 1,
        iconURL: iconImageId ? equipmentIconUrl(iconImageId) : undefined,
        iconFilename: iconImageId ? `equipment_${id}` : undefined,
        backgroundURL: grade ? equipmentBackgroundUrl(grade) : undefined,
        backgroundFilename: grade ? `equipment_background_${grade}` : undefined,
        restrictions,
        sourcePages: [source],
    }) as Equipment;
}

function addEquipment(equipment: Map<string, Equipment>, item: Equipment): void {
    const current = equipment.get(item.id);
    if (!current) {
        equipment.set(item.id, item);
        return;
    }

    current.restrictions = uniqueByJson([...(current.restrictions ?? []), ...(item.restrictions ?? [])]);
    current.sourcePages = uniqueByJson([...(current.sourcePages ?? []), ...(item.sourcePages ?? [])]);
}

function equipmentRestrictions(description: string | undefined, source: EquipmentSourcePage, card?: DokkanInfoCardSummary): EquipmentRestriction[] {
    const rawDescription = cleanText(description);
    const restriction: EquipmentRestriction = {
        type: source.type,
        rawDescription,
    };

    if (source.type === 'card') {
        restriction.cardIds = [card?.id?.toString() ?? source.id].filter(Boolean) as string[];
        const cardTarget = cardTargetFromDescription(rawDescription);
        restriction.cardTitles = cardTarget.title ? [cardTarget.title] : undefined;
        restriction.cardNames = [cardTarget.name || card?.name || source.name].map(cleanText).filter(Boolean);
    }

    if (source.type === 'category') {
        restriction.categoryIds = source.id ? [source.id] : undefined;
        restriction.categoryNames = quotedNames(rawDescription).length ? quotedNames(rawDescription) : source.name ? [source.name] : undefined;
    }

    if (source.type === 'character') {
        restriction.characterIds = source.id ? [source.id] : undefined;
        restriction.characterNames = quotedNames(rawDescription).length ? quotedNames(rawDescription) : source.name ? [source.name] : undefined;
    }

    if (source.type === 'type') {
        const element = elementRestriction(source.id);
        restriction.classes = element.classes;
        restriction.types = element.types;
    }

    if (source.type === 'class') {
        restriction.classes = source.id === 'extreme' ? [Classes.Extreme] : [Classes.Super];
    }

    return [cleanObject(restriction)];
}

function characterEquipmentReferences(data: DokkanInfoCardData): CharacterEquipmentReference[] {
    const references = [
        ...equipmentValues(data.cardEquipment).map(item => equipmentFromDokkanInfo(item, {
            type: 'card',
            id: data.card.id.toString(),
            name: cleanText(data.card.name),
            url: `${DOKKAN_INFO_EQUIPMENT_BASE_URL}/cards/${data.card.id}`,
        }, equipmentRestrictions(item.description, {
            type: 'card',
            id: data.card.id.toString(),
            name: cleanText(data.card.name),
            url: `${DOKKAN_INFO_EQUIPMENT_BASE_URL}/cards/${data.card.id}`,
        }, data.card))),
        ...equipmentValues(data.characterEquipment).map(item => equipmentFromDokkanInfo(item, {
            type: 'character',
            id: data.card.character_id?.toString(),
            name: cleanText(data.card.name),
            url: `${DOKKAN_INFO_EQUIPMENT_BASE_URL}/characters/${data.card.character_id ?? ''}`,
        }, equipmentRestrictions(item.description, {
            type: 'character',
            id: data.card.character_id?.toString(),
            name: cleanText(data.card.name),
            url: `${DOKKAN_INFO_EQUIPMENT_BASE_URL}/characters/${data.card.character_id ?? ''}`,
        }))),
    ];

    return uniqueByJson(references.map(item => cleanObject({
        id: item.id,
        officialId: item.officialId,
        name: item.name,
        description: item.description,
        grade: item.grade,
        hp: item.hp,
        attack: item.attack,
        defence: item.defence,
        sellingExchangePoint: item.sellingExchangePoint,
        count: item.count,
        equipmentSkillLimitationSetId: item.equipmentSkillLimitationSetId,
        iconImageId: item.iconImageId,
        isEternal: item.isEternal,
        iconURL: item.iconURL,
        iconFilename: item.iconFilename,
        restrictions: item.restrictions,
    }) as CharacterEquipmentReference));
}

function equipmentValues(value: Record<string, DokkanInfoEquipment> | undefined): DokkanInfoEquipment[] {
    return Object.values(value ?? {});
}

function applyEquipmentDebugLimit<T>(items: T[]): T[] {
    const limit = parseInt(process.env.DOKKAN_SCRAPER_EQUIPMENT_LIMIT ?? '', 10);
    return limit > 0 ? items.slice(0, limit) : items;
}

function syntheticEquipmentId(item: DokkanInfoEquipment, source: EquipmentSourcePage): string {
    const signature = [
        cleanText(item.name),
        cleanText(item.description),
        cleanText(item.grade),
        item.icon_image_id ?? '',
        source.type,
        source.id ?? '',
    ].join('|');

    return `synthetic:${createHash('sha1').update(signature).digest('hex').slice(0, 12)}`;
}

function cardTargetFromDescription(description: string): { title?: string, name?: string } {
    const match = description.match(/Can be equipped to\s+\[([^\]]+)\]\s*([^.]*)\./i);
    return {
        title: cleanText(match?.[1]),
        name: cleanText(match?.[2]),
    };
}

function quotedNames(description: string): string[] {
    return Array.from(new Set(Array.from(description.matchAll(/"([^"]+)"/g)).map(match => cleanText(match[1])).filter(Boolean)));
}

function elementRestriction(element: string | undefined): { classes?: Classes[], types?: Types[] } {
    if (!element || !/^\d+$/.test(element)) {
        return {};
    }

    const classIndex = Math.floor(parseInt(element, 10) / 10) % 10;
    const classes = classIndex === 1 ? [Classes.Super] : classIndex === 2 ? [Classes.Extreme] : undefined;
    return {
        classes,
        types: [typeFromElement(element)],
    };
}

function statFromDescription(description: string, stat: 'HP' | 'ATK' | 'DEF'): number | undefined {
    const match = description.match(new RegExp(`(?:character's|character\\u2019s) ${stat} \\+(\\d+)`, 'i'))
        ?? description.match(new RegExp(`${stat} \\+(\\d+)(?!\\s*Lv\\.)`, 'i'));
    return match ? parseInt(match[1], 10) : undefined;
}

function numericIdFromPath(path: string): number | undefined {
    const match = path.match(/(\d+)(?=\.png$)/);
    return match ? parseInt(match[1], 10) : undefined;
}

function gradeFromBackground(value: string): string {
    const match = value.match(/equ_base_([a-z]+)(?:_\d+)?/i);
    return cleanText(match?.[1]);
}

function equipmentIconUrl(iconImageId: number): string {
    return `${DOKKAN_INFO_ASSET_BASE_URL}/item/equipment/equ_item_${iconImageId.toString().padStart(5, '0')}.png`;
}

function equipmentBackgroundUrl(grade: string): string {
    const backgroundName = grade === 'gold' ? 'equ_base_gold_2' : `equ_base_${grade}`;
    return `${DOKKAN_INFO_ASSET_BASE_URL}/layout/en/image/item/equipment/equipment_thumb_bg/${backgroundName}.png`;
}

function uniqueByJson<T>(values: T[]): T[] {
    const seen = new Set<string>();
    return values.filter(value => {
        const key = JSON.stringify(value);
        if (seen.has(key)) {
            return false;
        }

        seen.add(key);
        return true;
    });
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
    const passive = passiveDetails(data.passive_skill);
    const ezaPassive = passiveDetails(data.eza_data?.passive_skill);
    const normalSuperAttack = superAttackDetails(superAttacks, 'normal');
    const ezaNormalSuperAttack = superAttackDetails(ezaSuperAttacks, 'normal');
    const ultraSuperAttack = superAttackDetails(superAttacks, 'ultra');
    const ezaUltraSuperAttack = superAttackDetails(ezaSuperAttacks, 'ultra');
    const extraSuperAttack = superAttackDetails(superAttacks, 'extra');
    const ezaExtraSuperAttack = superAttackDetails(ezaSuperAttacks, 'extra');
    const extraInfo = characterExtraInfo(card);
    const awakeningCards = arrayFromDokkanList(data.awakening_cards);
    const portraitFilename = `portrait_${id}`;
    const leaderSkill = cleanMultilineText(data.leader_skill?.description);
    const ezaLeaderSkill = cleanMultilineText(data.eza_data?.leader_skill?.description);
    const leaderSkillDetails = parseLeaderSkillDetails(leaderSkill);
    const ezaLeaderSkillDetails = parseLeaderSkillDetails(ezaLeaderSkill);

    const characterData: Character = {
        name: cleanInlineText(card.name),
        title: cleanInlineText(data.leader_skill?.name),
        maxLevel: toNumber(card.lv_max),
        maxSALevel: toNumber(card.skill_lv_max),
        rarity: rarityFromNumber(card.rarity),
        releaseDate: releaseDate(card.open_at),
        ezaReleaseDate: releaseDate(card.eza_open_at ?? data.eza_open_date?.open_at),
        sezaReleaseDate: releaseDate(card.seza_open_at ?? data.seza_open_date?.open_at),
        summonable: cleanInlineText(data.summonable),
        isSummonable: data.summonable === 'Summonable',
        characterClass: classFromCard(card),
        type: typeFromElement(card.element),
        cost: toNumber(card.cost),
        id,
        legacyId,
        portraitURL: portraitOutputUrl(portraitFilename),
        portraitFilename,
        portraitSpec: portraitSpec(card),
        leaderSkill,
        ezaLeaderSkill,
        leaderSkillBoost: ezaLeaderSkillDetails?.displayBoost ?? leaderSkillDetails?.displayBoost,
        leaderSkillDetails,
        ezaLeaderSkillDetails,
        superAttack: normalSuperAttack?.effect ?? '',
        ezaSuperAttack: ezaNormalSuperAttack?.effect,
        ultraSuperAttack: ultraSuperAttack?.effect,
        ezaUltraSuperAttack: ezaUltraSuperAttack?.effect,
        exSuperAttack: extraSuperAttack?.effect,
        ezaExSuperAttack: ezaExtraSuperAttack?.effect,
        superAttackDetails: normalSuperAttack,
        ezaSuperAttackDetails: ezaNormalSuperAttack,
        ultraSuperAttackDetails: ultraSuperAttack,
        ezaUltraSuperAttackDetails: ezaUltraSuperAttack,
        exSuperAttackDetails: extraSuperAttack,
        ezaExSuperAttackDetails: ezaExtraSuperAttack,
        unitSuperAttacks: unitSuperAttacks(superAttacks),
        passive: passive?.text ?? '',
        passiveDetails: passive,
        ezaPassive: ezaPassive?.text,
        ezaPassiveDetails: ezaPassive,
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
        kiMultiplier: extraInfo.kiMultiplierText ?? '',
        extraInfo,
        standbySkill: cleanMultilineText(data.stand_by_skill?.description ?? data.stand_by_skill?.name),
        finishingMove: finishSkillTexts(data.finish_skills),
        transformations: transformations(data, id),
        awakeningCards: awakeningReferences(awakeningCards),
        previousAwakenings: awakeningReferences(awakeningCards.filter(awakeningCard => awakeningCard.rarity < card.rarity)),
        nextAwakenings: awakeningReferences(awakeningCards.filter(awakeningCard => awakeningCard.rarity > card.rarity)),
        equipment: characterEquipmentReferences(data),
        dokkanFrontierPassives: dokkanFrontierPassives(data.originPassiveSkills),
        dokkanFrontierGroupPassive: cleanMultilineText(data.passive_skill?.sougou_only_itemized_description),
        dokkanFrontierCharacterPassive: cleanMultilineText(data.passive_skill?.kobetu_only_itemized_description),
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

function isSellingOnlyCard(data: DokkanInfoCardData): boolean {
    return isSellingOnlyLeaderSkill(data.leader_skill?.description);
}

export function isSellingOnlyLeaderSkill(leaderSkill: string | undefined): boolean {
    return cleanInlineText(leaderSkill).toLowerCase() === 'a character for selling';
}

export function filterBaseAwakeningDuplicates(cards: DokkanInfoCardSummary[]): DokkanInfoCardSummary[] {
    const bestCardIds = new Set(
        Array.from(cards.reduce((groups, card) => {
            const groupId = zAwakeningGroupId(card);
            const currentBest = groups.get(groupId);

            if (!currentBest || compareBaseAwakeningStage(card, currentBest) < 0) {
                groups.set(groupId, card);
            }

            return groups;
        }, new Map<number, DokkanInfoCardSummary>()).values()).map(card => card.id),
    );

    return cards.filter(card => bestCardIds.has(card.id));
}

export function filterZAwakeningStagesFromTransformations(
    baseCard: DokkanInfoCardSummary,
    transformations: DokkanInfoCardSummary[],
): DokkanInfoCardSummary[] {
    return transformations.filter(transformation => zAwakeningGroupId(transformation) !== zAwakeningGroupId(baseCard));
}

export function hasBattleTransformationCondition(
    transformation: DokkanInfoCardData['transformation'],
): boolean {
    const values = Array.isArray(transformation)
        ? transformation
        : transformation && (
            'name' in transformation
            || 'description' in transformation
            || 'effect_description' in transformation
            || 'condition_description' in transformation
            || 'causality_description' in transformation
            || 'conditions' in transformation
        )
            ? [transformation]
            : arrayFromDokkanList(transformation as DokkanListValue<DokkanInfoNamedDescription>);

    return values.some(value => cleanMultilineText(
        value?.condition_description
        ?? value?.causality_description
        ?? value?.conditions
        ?? value?.description
        ?? value?.effect_description
        ?? value?.name,
    ).length > 0);
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

function zAwakeningGroupId(card: DokkanInfoCardSummary): number {
    return card.asset_id ?? normalizeAssetId(card.id);
}

function compareBaseAwakeningStage(a: DokkanInfoCardSummary, b: DokkanInfoCardSummary): number {
    return toNumber(a.rarity) - toNumber(b.rarity)
        || toNumber(a.lv_max) - toNumber(b.lv_max)
        || toNumber(a.skill_lv_max) - toNumber(b.skill_lv_max)
        || toNumber(a.id) - toNumber(b.id);
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

function cardThumbUrl(iconId: number): string {
    return `${DOKKAN_INFO_ASSET_BASE_URL}/character/thumb/card_${iconId}_thumb/card_${iconId}_thumb.png`;
}

function portraitOutputUrl(portraitFilename: string): string {
    return `images/${portraitFilename}.png`;
}

function portraitSpec(card: DokkanInfoCardSummary): PortraitSpec {
    const iconId = card.icon_id ?? card.asset_id ?? normalizeAssetId(card.id);
    const frameColorId = parseInt(card.bg_element ?? `${parseInt(card.element, 10) % 10}`, 10);

    return {
        iconId,
        frameColorId,
        rarity: rarityFromNumber(card.rarity),
        elementCode: card.element.padStart(2, '0'),
    };
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

function classFromCard(card: DokkanInfoCardSummary): Classes {
    const classIndex = Math.floor(parseInt(card.element, 10) / 10) % 10;
    if (classIndex === 1) {
        return Classes.Super;
    }

    if (classIndex === 2) {
        return Classes.Extreme;
    }

    if (card.awakening_element_type === 2) {
        return Classes.Extreme;
    }

    return Classes.Super;
}

function superAttackText(superAttacks: DokkanInfoSuperAttack[], kind: 'normal' | 'ultra' | 'extra'): string {
    return superAttackDetails(superAttacks, kind).effect ?? '';
}

function unitSuperAttacks(superAttacks: DokkanInfoSuperAttack[]): UnitSuperAttack[] {
    return arrayFromDokkanList(superAttacks)
        .filter(superAttack => {
            const style = (superAttack.style ?? '').toLowerCase();
            return style.includes('unit') || style.includes('condition');
        })
        .map(superAttack => ({
            name: cleanInlineText(superAttack.attack?.name),
            effect: cleanMultilineText(superAttack.attack?.description),
            type: attackType(superAttack.rawAttribute?.name),
            ki: superAttack.eball_num_start,
            style: cleanInlineText(superAttack.style),
            unitSuperAttack: cleanInlineText(formatNamedDescription(superAttack.attack)),
            unitSuperAttackCondition: cleanMultilineText(superAttack.causality_description ?? superAttack.causality_conditions),
        }))
        .filter(superAttack => superAttack.unitSuperAttack || superAttack.unitSuperAttackCondition);
}

function formatNamedDescription(value: DokkanInfoNamedDescription | undefined): string {
    if (!value) {
        return '';
    }

    const name = cleanInlineText(value.name);
    const description = cleanMultilineText(value.itemized_description ?? value.effect_description ?? value.description);
    return [name, description].filter(Boolean).join(': ');
}

function activeSkillText(value: DokkanInfoNamedDescription | undefined): string {
    return formatNamedDescription(value);
}

function activeSkillCondition(value: DokkanInfoNamedDescription | undefined): string {
    return cleanMultilineText(value?.condition_description ?? value?.causality_description ?? value?.conditions);
}

function namedDescriptionsText(value: DokkanInfoNamedDescription | DokkanInfoNamedDescription[] | Record<string, DokkanInfoNamedDescription> | undefined): string {
    const values = Array.isArray(value) ? value : value && 'name' in value ? [value] : arrayFromDokkanList(value as DokkanListValue<DokkanInfoNamedDescription>);
    return values.map(formatNamedDescription).filter(Boolean).join('; ');
}

function finishSkillTexts(values: DokkanListValue<DokkanInfoNamedDescription>): string[] {
    return arrayFromDokkanList(values).map(formatNamedDescription).filter(Boolean);
}

function passiveDetails(value: DokkanInfoPassiveSkill | undefined): PassiveDetails | undefined {
    if (!value) {
        return undefined;
    }

    const text = cleanMultilineText(value.itemized_description ?? value.description);
    const lines = text ? text.split('\n').map(line => line.trim()).filter(Boolean) : undefined;
    return cleanObject({
        name: cleanInlineText(value.name),
        text,
        lines,
        sections: lines ? splitPassiveSections(lines) : undefined,
    });
}

export function splitPassiveSections(lines: string[]): PassiveSection[] {
    const sections: PassiveSection[] = [];
    let currentSection: PassiveSection | undefined;

    const pushCurrentSection = () => {
        if (!currentSection) {
            return;
        }

        const normalizedLabel = cleanInlineText(currentSection.label).replace(/:$/, '');
        const normalizedLines = currentSection.lines
            .map(line => cleanInlineText(line))
            .filter(Boolean);
        if (normalizedLabel || normalizedLines.length > 0) {
            sections.push({
                label: normalizedLabel || undefined,
                lines: normalizedLines,
            });
        }
        currentSection = undefined;
    };

    for (const rawLine of lines) {
        const line = normalizePassiveParserLine(rawLine);
        if (!line) {
            continue;
        }

        if (line.startsWith('- ')) {
            if (!currentSection) {
                currentSection = { lines: [] };
            }
            currentSection.lines.push(line.slice(2).trim());
            continue;
        }

        if (shouldAppendToPreviousPassiveLine(currentSection, line)) {
            const lastIndex = currentSection.lines.length - 1;
            currentSection.lines[lastIndex] = `${currentSection.lines[lastIndex]} ${line}`.trim();
            continue;
        }

        if (shouldAppendToCurrentPassiveHeader(currentSection, line)) {
            currentSection.label = `${currentSection.label} ${normalizePassiveHeaderContinuation(currentSection.label, line)}`.trim();
            continue;
        }

        if (isPassiveSectionHeader(line)) {
            pushCurrentSection();
            currentSection = {
                label: line,
                lines: [],
            };
            continue;
        }

        if (!currentSection) {
            currentSection = {
                lines: [line],
            };
            continue;
        }

        if (currentSection.label && currentSection.lines.length === 0) {
            currentSection.label = `${currentSection.label} ${line}`.trim();
            continue;
        }

        if (currentSection.lines.length > 0) {
            const lastIndex = currentSection.lines.length - 1;
            currentSection.lines[lastIndex] = `${currentSection.lines[lastIndex]} ${line}`.trim();
            continue;
        }

        currentSection.lines.push(line);
    }

    pushCurrentSection();
    return sections;
}

function normalizePassiveParserLine(rawLine: string): string {
    return cleanInlineText(rawLine)
        .replace(/^\*\s*/, "")
        .replace(/\s*\*$/, "")
        .trim();
}

function shouldAppendToCurrentPassiveHeader(
    currentSection: PassiveSection | undefined,
    line: string,
): boolean {
    if (!currentSection?.label || currentSection.lines.length > 0) {
        return false;
    }

    return /^Activates the Entrance Animation\b/i.test(currentSection.label);
}

function shouldAppendToPreviousPassiveLine(
    currentSection: PassiveSection | undefined,
    line: string,
): boolean {
    if (!currentSection || currentSection.lines.length === 0) {
        return false;
    }

    return /^[a-z]/.test(line);
}

function normalizePassiveHeaderContinuation(currentLabel: string, line: string): string {
    if (
        /^Activates the Entrance Animation\b/i.test(currentLabel) &&
        /^(When|Upon)\b/.test(line)
    ) {
        return line.replace(/^[A-Z]/, letter => letter.toLowerCase());
    }

    return line;
}

function isPassiveSectionHeader(line: string): boolean {
    return PASSIVE_SECTION_HEADER_PATTERNS.some(pattern => pattern.test(line));
}

const PASSIVE_SECTION_HEADER_PATTERNS = [
    /^Activates the Entrance Animation\b/i,
    /^Basic effect\(s\)$/i,
    /^When the Finish Effect is not activated\b/i,
    /^Per\b/i,
    /^For \d+ turns? from (?:the )?character's entry turn\b/i,
    /^For \d+ turns? from start of turn\b/i,
    /^For \d+ turns?\b/i,
    /^When attacking with \d+ Ki\b/i,
    /^When attacking with \d+ or more Ki\b/i,
    /^When attacking with \d+ or less Ki\b/i,
    /^When attacking\b/i,
    /^When activating the Active Skill\b/i,
    /^For every \d+ Ki when attacking\b/i,
    /^For every attack performed\b/i,
    /^For every attack received\b/i,
    /^For every Super Attack performed\b/i,
    /^For every .* Ki Spheres? obtained\b/i,
    /^For each .* Ki Spheres? obtained\b/i,
    /^Starting from the \d+(?:st|nd|rd|th) turn\b/i,
    /^Starting from the character's next attacking turn\b/i,
    /^As the \d+(?:st|nd|rd) attacker in a turn\b/i,
    /^As the \d+(?:st|nd|rd|th) or \d+(?:st|nd|rd|th) attacker in a turn\b/i,
    /^When there is another\b/i,
    /^After the character performs\b/i,
    /^After receiving\b/i,
    /^After the enemy launches a Super Attack\b/i,
    /^When receiving an attack\b/i,
    /^When receiving a Super Attack\b/i,
    /^When HP is \d+%/i,
    /^When all allies attacking in the same turn are\b/i,
    /^When there are no\b/i,
    /^When the Domain\b/i,
    /^With a Rainbow Ki Sphere obtained\b/i,
    /^The less HP remaining\b/i,
    /^The more HP remaining\b/i,
];

function superAttackDetails(superAttacks: DokkanListValue<DokkanInfoSuperAttack>, kind: 'normal' | 'ultra' | 'extra'): SuperAttackDetails | undefined {
    const attack = matchingSuperAttack(superAttacks, kind);
    if (!attack) {
        return undefined;
    }

    return cleanObject({
        name: cleanInlineText(attack.attack?.name),
        effect: cleanMultilineText(attack.attack?.description),
        type: attackType(attack.rawAttribute?.name),
        ki: attack.eball_num_start,
        style: cleanInlineText(attack.style),
        condition: cleanMultilineText(attack.attack?.causality_description ?? attack.causality_description ?? attack.causality_conditions),
        extras: arrayFromDokkanList(attack.extras).map(extra => formatNamedDescription(extra)).filter(Boolean),
    });
}

function matchingSuperAttack(superAttacks: DokkanListValue<DokkanInfoSuperAttack>, kind: 'normal' | 'ultra' | 'extra'): DokkanInfoSuperAttack | undefined {
    return arrayFromDokkanList(superAttacks).find(superAttack => {
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
}

function attackType(value: string | undefined): AttackTypes {
    const normalized = cleanInlineText(value).toLowerCase();

    if (normalized.includes('ki blast')) {
        return AttackTypes.KiBlast;
    }

    if (normalized.includes('unarmed')) {
        return AttackTypes.Unarmed;
    }

    if (normalized.includes('armed') || normalized.includes('physical')) {
        return AttackTypes.Armed;
    }

    return AttackTypes.Other;
}

export function parseLeaderSkillDetails(leaderSkill: string | undefined): LeaderSkillDetails | undefined {
    const normalizedLeaderSkill = cleanMultilineText(leaderSkill);
    if (!normalizedLeaderSkill) {
        return undefined;
    }

    const clauses = splitLeaderSkillClauses(normalizedLeaderSkill)
        .map(parseLeaderSkillClause)
        .filter((clause): clause is LeaderSkillClause => Boolean(clause));
    const displayBoost = calculateLeaderSkillDisplayBoost(clauses);

    return {
        rawText: normalizedLeaderSkill,
        displayBoost,
        clauses,
    };
}

interface RawLeaderSkillClause {
    rawText: string;
    stackGroup: LeaderSkillClause['stackGroup'];
    targetMode: LeaderSkillClause['targetMode'];
}

function splitLeaderSkillClauses(leaderSkill: string): RawLeaderSkillClause[] {
    const normalized = cleanInlineText(leaderSkill);
    const additionalSections = normalized.split(/(?:,|;)?\s*plus an additional\s+/i);
    const baseSection = additionalSections.shift() ?? '';
    const clauses: RawLeaderSkillClause[] = splitAlternativeClauses(baseSection, 'primary', 'base');

    for (const additionalSection of additionalSections) {
        clauses.push(...splitAlternativeClauses(
            additionalSection,
            'additional',
            /\balso belong\b/i.test(additionalSection) ? 'also-belong' : 'base',
        ));
    }

    return clauses;
}

function splitAlternativeClauses(
    text: string,
    initialStackGroup: LeaderSkillClause['stackGroup'],
    targetMode: LeaderSkillClause['targetMode'],
): RawLeaderSkillClause[] {
    const parts = text
        .split(/\s*;\s*or\s+|\s*;\s*(?=(?:"|Super|Extreme|AGL|TEQ|INT|STR|PHY|Type|All Type|All Types))|\s+or\s+(?=(?:Super|Extreme|AGL|TEQ|INT|STR|PHY|Type|All Type|All Types))/i)
        .map(part => cleanInlineText(part))
        .filter(Boolean);

    return parts.map((rawText, index) => ({
        rawText,
        stackGroup: index === 0 ? initialStackGroup : 'secondary',
        targetMode,
    }));
}

function parseLeaderSkillClause(clause: RawLeaderSkillClause): LeaderSkillClause | undefined {
    if (!clause.rawText) {
        return undefined;
    }

    const teamConditions = extractLeaderSkillTeamConditions(clause.rawText);
    const targetSegment = stripLeaderSkillTeamConditions(clause.rawText);
    const boost = parseLeaderSkillBoostValues(clause.rawText);
    const categories = extractLeaderSkillCategories(targetSegment);
    const types = extractLeaderSkillTypes(targetSegment);
    const classes = extractLeaderSkillClasses(targetSegment);
    const ki = extractLeaderSkillKi(targetSegment);

    return cleanObject({
        rawText: clause.rawText,
        stackGroup: clause.stackGroup,
        targetMode: clause.targetMode,
        categories,
        types,
        classes,
        teamConditions,
        ki,
        hp: boost.hp,
        atk: boost.atk,
        def: boost.def,
        boostForm: boost.boostForm,
    }) as LeaderSkillClause;
}

function parseLeaderSkillBoostValues(segment: string): LeaderSkillBoostValues {
    const boostForm: LeaderSkillBoostForm = segment.includes('%') ? 'percentage' : 'flat';
    return boostForm === 'percentage'
        ? parsePercentageLeaderSkillSummary(segment)
        : parseFlatLeaderSkillSummary(segment);
}

function parsePercentageLeaderSkillSummary(segment: string): LeaderSkillBoostValues {
    const separatedBoostPattern1 = /(HP|ATK|DEF) & (HP|ATK|DEF) \+\s*(\d+)% and (HP|ATK|DEF) \+\s*(\d+)%/i;
    const separatedBoostPattern2 = /HP \+\s*(\d+)% and ATK & DEF \+\s*(\d+)%/i;
    const combinedBoostPattern = /HP, ATK (?:&|and) DEF \+\s*(\d+)%/i;
    const separateStatBoostPattern = /(HP|DEF) & (DEF|HP) \+\s*(\d+)%, (ATK) \+\s*(\d+)%/i;

    const separatedBoostMatch1 = segment.match(separatedBoostPattern1);
    const separatedBoostMatch2 = segment.match(separatedBoostPattern2);
    const combinedBoostMatch = segment.match(combinedBoostPattern);
    const separateStatBoostMatch = segment.match(separateStatBoostPattern);
    const combinedBoost = parseFloat(combinedBoostMatch?.[1] ?? '0');

    let hp = combinedBoost;
    let atk = combinedBoost;
    let def = combinedBoost;

    if (separateStatBoostMatch) {
        const firstType = separateStatBoostMatch[1];
        const secondType = separateStatBoostMatch[2];
        const sharedBoost = parseFloat(separateStatBoostMatch[3] ?? '0');
        const attackBoost = parseFloat(separateStatBoostMatch[5] ?? '0');

        hp = firstType === 'HP' || secondType === 'HP' ? sharedBoost : 0;
        def = firstType === 'DEF' || secondType === 'DEF' ? sharedBoost : 0;
        atk = attackBoost;
    } else if (separatedBoostMatch1) {
        const firstType = separatedBoostMatch1[1];
        const secondType = separatedBoostMatch1[2];
        const sharedBoost = parseFloat(separatedBoostMatch1[3] ?? '0');
        const thirdType = separatedBoostMatch1[4];
        const thirdBoost = parseFloat(separatedBoostMatch1[5] ?? '0');

        hp = firstType === 'HP' || secondType === 'HP'
            ? sharedBoost
            : thirdType === 'HP' ? thirdBoost : combinedBoost;
        atk = firstType === 'ATK' || secondType === 'ATK'
            ? sharedBoost
            : thirdType === 'ATK' ? thirdBoost : combinedBoost;
        def = firstType === 'DEF' || secondType === 'DEF'
            ? sharedBoost
            : thirdType === 'DEF' ? thirdBoost : combinedBoost;
    } else if (separatedBoostMatch2) {
        hp = parseFloat(separatedBoostMatch2[1] ?? '0');
        atk = parseFloat(separatedBoostMatch2[2] ?? '0');
        def = atk;
    }

    // Keep single-stat and pair-stat leader skills accurate as well. The
    // combined patterns above cover the common 3-stat forms, but skills such
    // as "ATK +15%" or "ATK & DEF +30%" otherwise look like zero boosts.
    const pairStatMatches = Array.from(
        segment.matchAll(/\b(HP|ATK|DEF)\s*&\s*(HP|ATK|DEF)\s*\+\s*(\d+)%/gi),
    );
    for (const match of pairStatMatches) {
        const value = parseFloat(match[3] ?? '0');
        for (const stat of [match[1], match[2]]) {
            if (stat?.toUpperCase() === 'HP') hp = value;
            if (stat?.toUpperCase() === 'ATK') atk = value;
            if (stat?.toUpperCase() === 'DEF') def = value;
        }
    }

    const singleStatMatches = Array.from(
        segment.matchAll(/\b(HP|ATK|DEF)\s*\+\s*(\d+)%/gi),
    );
    for (const match of singleStatMatches) {
        const value = parseFloat(match[2] ?? '0');
        if (match[1]?.toUpperCase() === 'HP') hp = value;
        if (match[1]?.toUpperCase() === 'ATK') atk = value;
        if (match[1]?.toUpperCase() === 'DEF') def = value;
    }

    return {
        hp,
        atk,
        def,
        boostForm: 'percentage',
    };
}

function parseFlatLeaderSkillSummary(segment: string): LeaderSkillBoostValues {
    const flatBoostPattern = /(HP|ATK|DEF) \+\s*(\d+)/gi;
    const matches = Array.from(segment.matchAll(flatBoostPattern));

    const flatBoostMap = new Map(matches.map(match => [match[1], parseFloat(match[2] ?? '0')]));

    return {
        hp: flatBoostMap.get('HP') ?? 0,
        atk: flatBoostMap.get('ATK') ?? 0,
        def: flatBoostMap.get('DEF') ?? 0,
        boostForm: 'flat',
    };
}

function extractLeaderSkillCategories(segment: string): string[] | undefined {
    const categories = Array.from(segment.matchAll(/"([^"]+)"/g))
        .map(match => cleanInlineText(match[1]))
        .filter(Boolean);

    return categories.length ? Array.from(new Set(categories)) : undefined;
}

function extractLeaderSkillTypes(segment: string): string[] | undefined {
    if (!/\bTypes?\b/i.test(segment)) {
        return undefined;
    }

    if (/\bAll Types?\b/i.test(segment)) {
        return ['All'];
    }

    const explicitTypes = Array.from(segment.matchAll(/\b(AGL|TEQ|INT|STR|PHY)\b/gi))
        .map(match => match[1].toUpperCase());

    if (explicitTypes.length) {
        return Array.from(new Set(explicitTypes));
    }

    return ['All'];
}

function extractLeaderSkillClasses(segment: string): string[] | undefined {
    const classes = Array.from(segment.matchAll(/\b(Super|Extreme)\b(?=\s+(?:Class|AGL|TEQ|INT|STR|PHY|Type|Types))/gi))
        .map(match => match[1][0].toUpperCase() + match[1].slice(1).toLowerCase());

    return classes.length ? Array.from(new Set(classes)) : undefined;
}

function stripLeaderSkillTeamConditions(segment: string): string {
    return cleanInlineText(segment.replace(/\s+when team includes .*/i, ''));
}

function extractLeaderSkillTeamConditions(segment: string): LeaderSkillTeamCondition[] | undefined {
    const normalized = cleanInlineText(segment);
    const conditions: LeaderSkillTeamCondition[] = [];

    const classConditionMatch = normalized.match(/\bwhen team includes (Super|Extreme) ?& ?(Super|Extreme) Classes\b/i);
    if (classConditionMatch) {
        conditions.push(cleanObject({
            rawText: classConditionMatch[0],
            kind: 'requires-classes',
            classes: [toTitleCase(classConditionMatch[1]), toTitleCase(classConditionMatch[2])],
            requiresAll: true,
            requiredCount: 2,
        }) as LeaderSkillTeamCondition);
    }

    const allFiveTypesMatch = normalized.match(/\bwhen team includes all five (?:(Super|Extreme) )?Types\b/i);
    if (allFiveTypesMatch) {
        conditions.push(cleanObject({
            rawText: allFiveTypesMatch[0],
            kind: 'requires-types',
            types: ['AGL', 'TEQ', 'INT', 'STR', 'PHY'],
            classFilter: allFiveTypesMatch[1] ? toTitleCase(allFiveTypesMatch[1]) : undefined,
            requiresAll: true,
            requiredCount: 5,
        }) as LeaderSkillTeamCondition);
    }

    return conditions.length ? conditions : undefined;
}

function toTitleCase(value: string): string {
    return value[0].toUpperCase() + value.slice(1).toLowerCase();
}

function extractLeaderSkillKi(segment: string): number | undefined {
    const kiBoost = segment.match(/Ki \+\s*(\d+)/i)?.[1];
    return kiBoost ? parseInt(kiBoost, 10) : undefined;
}

function calculateLeaderSkillDisplayBoost(
    parsedLeaderSkills: Pick<LeaderSkillClause, 'stackGroup' | 'hp' | 'atk' | 'def' | 'boostForm'>[],
): number {
    type PercentagePath = { hp: number, atk: number, def: number };
    const displayBoost = (path: PercentagePath): number => {
        // Community leader labels describe the ATK/DEF ceiling, not an
        // average across HP, ATK and DEF. HP is only a fallback when the whole
        // path has no combat-stat boost.
        const positiveCombatStats = [path.atk, path.def].filter(value => value > 0);
        return positiveCombatStats.length > 0
            ? Math.max(...positiveCombatStats)
            : Math.max(path.hp, 0);
    };

    // Clauses retain their source order. A primary/secondary clause starts an
    // alternative path, while an explicitly additional clause extends only the
    // path immediately before it. This preserves fallback leaders such as
    // `170 + 30; Super Class 150` and split leaders such as
    // `Peppy Gals 200; Turtle School 170 + 30` without numeric exceptions.
    let currentPath: PercentagePath | undefined;
    let maximumPathBoost = 0;

    for (const leaderSkill of parsedLeaderSkills) {
        if (leaderSkill.stackGroup === 'additional') {
            if (leaderSkill.boostForm === 'percentage' && currentPath) {
                currentPath = {
                    hp: currentPath.hp + leaderSkill.hp,
                    atk: currentPath.atk + leaderSkill.atk,
                    def: currentPath.def + leaderSkill.def,
                };
            }
        } else {
            // A flat/non-percentage alternative still closes the previous
            // percentage path. Otherwise a later additional clause could be
            // attached to an unrelated earlier alternative.
            currentPath = leaderSkill.boostForm === 'percentage'
                ? { hp: leaderSkill.hp, atk: leaderSkill.atk, def: leaderSkill.def }
                : undefined;
        }

        maximumPathBoost = Math.max(
            maximumPathBoost,
            currentPath ? displayBoost(currentPath) : 0,
        );
    }

    return maximumPathBoost;
}

function characterExtraInfo(card: DokkanInfoCardSummary): CharacterExtraInfo {
    return cleanObject({
        kiMultiplierText: kiMultiplier(card),
        kiMultiplierSteps: kiMultiplierSteps(card),
    });
}

function transformations(data: DokkanInfoCardData, baseCharacterId: string): Transformation[] {
    const currentCardId = data.card.id;
    const links = uniqueCleanNames(data.links);
    const detailsById = new Map(arrayFromDokkanList(data.transformation_details as DokkanListValue<DokkanInfoCardData>).map(detail => [detail.card.id, detail]));
    const transformedCards = filterZAwakeningStagesFromTransformations(
        data.card,
        arrayFromDokkanList(data.transformations as DokkanListValue<DokkanInfoCardSummary>),
    )
        .filter(transformation => transformation.id !== currentCardId)
        .filter((transformation, index, allTransformations) => allTransformations.findIndex(item => item.id === transformation.id) === index);

    if (transformedCards.length === 0) {
        return [];
    }

    return transformedCards.map(transformation => {
        const detail = detailsById.get(transformation.id);
        const detailCard = detail?.card ?? transformation;
        const assetId = detailCard.asset_id ?? detailCard.icon_id ?? normalizeAssetId(detailCard.id);
        const id = detailCard.id.toString();
        const legacyId = toLegacyId(assetId);
        const superAttacks = detail?.super_attacks ?? [];
        const detailLinks = uniqueCleanNames(detail?.links);
        const passive = passiveDetails(detail?.passive_skill);
        const normalSuperAttack = superAttackDetails(superAttacks, 'normal');
        const ultraSuperAttack = superAttackDetails(superAttacks, 'ultra');
        const extraSuperAttack = superAttackDetails(superAttacks, 'extra');
        const extraInfo = characterExtraInfo(detailCard);
        const portraitFilename = `portrait_${id}`;

        return cleanObject({
            id,
            baseCharacterId,
            legacyId,
            name: cleanInlineText(detailCard.name),
            releaseDate: releaseDate(detailCard.open_at),
            ezaReleaseDate: releaseDate(detailCard.eza_open_at),
            sezaReleaseDate: releaseDate(detailCard.seza_open_at),
            summonable: cleanInlineText(detail?.summonable),
            isSummonable: detail?.summonable === 'Summonable',
            characterClass: classFromCard(detailCard),
            type: typeFromElement(detailCard.element),
            superAttack: normalSuperAttack?.effect ?? '',
            ultraSuperAttack: ultraSuperAttack?.effect,
            exSuperAttack: extraSuperAttack?.effect,
            superAttackDetails: normalSuperAttack,
            ultraSuperAttackDetails: ultraSuperAttack,
            exSuperAttackDetails: extraSuperAttack,
            passive: passive?.text ?? '',
            passiveDetails: passive,
            activeSkill: activeSkillText(detail?.active_skill),
            activeSkillCondition: activeSkillCondition(detail?.active_skill),
            transformationCondition: namedDescriptionsText(detail?.transformation),
            domain: namedDescriptionsText(detail?.dokkan_fields),
            links: detailLinks.length ? detailLinks : links,
            portraitURL: portraitOutputUrl(portraitFilename),
            portraitFilename,
            portraitSpec: portraitSpec(detailCard),
            artURL: cardImageUrl(assetId, `${assetId}.png`),
            artFilename: `art_${id}`,
            extraInfo,
            standbySkill: cleanMultilineText(detail?.stand_by_skill?.description ?? detail?.stand_by_skill?.name),
            finishingMove: finishSkillTexts(detail?.finish_skills),
            dokkanFrontierPassives: dokkanFrontierPassives(detail?.originPassiveSkills),
            dokkanFrontierGroupPassive: cleanMultilineText(detail?.passive_skill?.sougou_only_itemized_description),
            dokkanFrontierCharacterPassive: cleanMultilineText(detail?.passive_skill?.kobetu_only_itemized_description),
        }) as Transformation;
    });
}

function awakeningReferences(cards: DokkanListValue<DokkanInfoCardSummary>): AwakeningReference[] {
    return arrayFromDokkanList(cards).map(card => {
        const assetId = card.asset_id ?? card.icon_id ?? normalizeAssetId(card.id);

        return {
            id: card.id.toString(),
            legacyId: toLegacyId(assetId),
            name: cleanText(card.name),
            rarity: rarityFromNumber(card.rarity),
            characterClass: classFromCard(card),
            type: typeFromElement(card.element),
            releaseDate: releaseDate(card.open_at),
            portraitURL: portraitOutputUrl(`portrait_${card.id}`),
            portraitSpec: portraitSpec(card),
            artURL: cardImageUrl(assetId, `${assetId}.png`),
        };
    });
}

function dokkanFrontierPassives(values: DokkanInfoFrontierPassive[] | undefined): DokkanFrontierPassive[] {
    return arrayFromDokkanList(values)
        .map(value => ({
            title: cleanInlineText(value.title),
            originBattleId: value.origin_battle_id,
            passive: cleanMultilineText(value.passive_skill),
        }))
        .filter(value => value.passive);
}

function uniqueCleanNames(values: DokkanListValue<DokkanInfoNamedDescription>): string[] {
    return Array.from(new Set(arrayFromDokkanList(values)
        .map(value => cleanInlineText(value.name ?? value.description))
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

function kiMultiplierSteps(card: DokkanInfoCardSummary) {
    return [
        card.eball_mod_num100 !== undefined ? { ki: toNumber(card.eball_mod_num100), percent: toNumber(card.eball_mod_min), label: 'minimum' } : undefined,
        card.eball_mod_mid_num ? { ki: toNumber(card.eball_mod_mid_num), percent: toNumber(card.eball_mod_mid), label: 'mid' } : undefined,
        card.eball_mod_max_num ? { ki: toNumber(card.eball_mod_max_num), percent: toNumber(card.eball_mod_max), label: 'max' } : undefined,
    ].filter(Boolean);
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

function cleanInlineText(value: string | undefined | null): string {
    return normalizeTextArtifacts(value ?? '')
        .replace(/&#039;/g, "'")
        .replace(/&quot;/g, '"')
        .replace(/&amp;/g, '&')
        .replace(/\{[^}]+}/g, '')
        .replace(/\*([^*]+)\*/g, '$1')
        .replace(/\r?\n/g, ' ')
        .replace(/\s+/g, ' ')
        .replace(/\s+([,.;:])/g, '$1')
        .trim();
}

export function cleanMultilineText(value: string | undefined | null): string {
    return normalizeTextArtifacts(value ?? '')
        .replace(/&#039;/g, "'")
        .replace(/&quot;/g, '"')
        .replace(/&amp;/g, '&')
        .replace(/\{[^}]+}/g, '')
        .replace(/\*([\s\S]*?)\*/g, '$1')
        .replace(/\r\n/g, '\n')
        .split('\n')
        .map(line => line.replace(/\*([^*]+)\*/g, '$1').replace(/\s+/g, ' ').trim())
        .filter(Boolean)
        .join('\n')
        .trim();
}

function cleanText(value: string | undefined | null): string {
    return cleanInlineText(value);
}

function normalizeTextArtifacts(value: string): string {
    return value
        .replace(/â€™|â€˜/g, "'")
        .replace(/[‘’]/g, "'")
        .replace(/â€œ|â€/g, '"')
        .replace(/[“”]/g, '"')
        .replace(/â€“|â€”/g, '-')
        .replace(/[–—]/g, '-')
        .replace(/\u00A0/g, ' ');
}

function arrayFromDokkanList<T>(value: DokkanListValue<T>): T[] {
    if (!value) {
        return [];
    }

    return Array.isArray(value) ? value : Object.values(value);
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
