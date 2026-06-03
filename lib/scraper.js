"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseLeaderSkillDetails = exports.extractCharacterData = exports.fetchFromWeb = exports.getEquipmentData = exports.getDokkanData = void 0;
const axios_1 = require("axios");
const crypto_1 = require("crypto");
const child_process_1 = require("child_process");
const jsdom_1 = require("jsdom");
const util_1 = require("util");
const character_1 = require("./character");
const DOKKAN_INFO_BASE_URL = 'https://dokkaninfo.com';
const DOKKAN_INFO_CARD_LIST_URL = `${DOKKAN_INFO_BASE_URL}/cards?sort=open_at`;
const DOKKAN_INFO_EQUIPMENT_BASE_URL = `${DOKKAN_INFO_BASE_URL}/items/equipment`;
const DOKKAN_INFO_ASSET_BASE_URL = `${DOKKAN_INFO_BASE_URL}/assets/global/en`;
const DEFAULT_CONCURRENCY = 4;
const execFileAsync = (0, util_1.promisify)(child_process_1.execFile);
const browserHeaders = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache',
};
let cachedCardList;
let preferCurl = false;
async function getDokkanData() {
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
exports.getDokkanData = getDokkanData;
async function getEquipmentData() {
    const equipment = new Map();
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
exports.getEquipmentData = getEquipmentData;
async function fetchDokkanInfoCardList() {
    if (cachedCardList) {
        return cachedCardList;
    }
    const document = await fetchFromWeb(DOKKAN_INFO_CARD_LIST_URL);
    const cardsJson = getRequiredJsonAttribute(document, 'cards', 'v-bind:cardsjson');
    cachedCardList = JSON.parse(cardsJson);
    return cachedCardList;
}
async function fetchDokkanInfoCardData(card) {
    const idsToTry = Array.from(new Set([card.id, card.icon_id, card.asset_id].filter(Boolean)));
    let lastError;
    for (const id of idsToTry) {
        try {
            const document = await fetchFromWeb(`${DOKKAN_INFO_BASE_URL}/cards/${id}`);
            const dataJson = getRequiredJsonAttribute(document, 'card-info', 'v-bind:datajson');
            const data = JSON.parse(dataJson);
            mergeListOnlyCardFields(data.card, card);
            data.eza_data = await fetchDokkanInfoEzaData(data);
            data.transformation_details = await fetchDokkanInfoTransformationDetails(data);
            return data;
        }
        catch (error) {
            lastError = error;
        }
    }
    throw lastError ?? new Error(`Could not fetch card detail for ${card.id}`);
}
function mergeListOnlyCardFields(detailCard, listCard) {
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
async function fetchDokkanInfoEzaData(data) {
    const step = data.max_eza_step ?? data.card.optimal_awakening_step;
    if (!step) {
        return undefined;
    }
    try {
        const json = await fetchPage(`${DOKKAN_INFO_BASE_URL}/api/cards/${data.card.id}/eza?eza=true&step=${step}`);
        const parsed = JSON.parse(json);
        return parsed.message ? undefined : parsed;
    }
    catch (error) {
        return undefined;
    }
}
async function fetchDokkanInfoTransformationDetails(data) {
    const transformationCards = arrayFromDokkanList(data.transformations)
        .filter(transformation => transformation.id !== data.card.id)
        .filter((transformation, index, transformations) => transformations.findIndex(item => item.id === transformation.id) === index);
    const ezaStep = data.max_eza_step ?? data.card.optimal_awakening_step;
    const details = [];
    for (const transformation of transformationCards) {
        const detail = await fetchDokkanInfoTransformationData(transformation.id, ezaStep);
        if (detail) {
            detail.card.asset_id = detail.card.asset_id ?? detail.card.icon_id ?? normalizeAssetId(detail.card.id);
            details.push(detail);
        }
    }
    return details;
}
async function fetchDokkanInfoTransformationData(transformationId, ezaStep) {
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
        }
        catch (error) {
            continue;
        }
    }
    return undefined;
}
async function scrapeEquipmentSection(equipment, section, restrictionType, concurrency) {
    const indexDocument = await fetchFromWeb(`${DOKKAN_INFO_EQUIPMENT_BASE_URL}/${section}`);
    const links = equipmentIndexLinks(indexDocument, section, restrictionType);
    const limitedLinks = applyEquipmentDebugLimit(links);
    await mapWithConcurrency(limitedLinks, concurrency, async (source, index) => {
        console.log(`[EQUIPMENT:${section}] ${index + 1}/${limitedLinks.length}: ${source.id ?? ''} ${source.name ?? ''}`);
        await addRenderedEquipmentPage(equipment, source.url, source);
    });
}
async function scrapeCardSpecificEquipment(equipment, concurrency) {
    const indexDocument = await fetchFromWeb(`${DOKKAN_INFO_EQUIPMENT_BASE_URL}/cards`);
    const links = applyEquipmentDebugLimit(equipmentIndexLinks(indexDocument, 'cards', 'card'));
    await mapWithConcurrency(links, concurrency, async (source, index) => {
        console.log(`[EQUIPMENT:cards] ${index + 1}/${links.length}: ${source.id ?? ''}`);
        const document = await fetchFromWeb(source.url);
        const cardJson = document.querySelector('card-icon')?.getAttribute('v-bind:card');
        if (!cardJson) {
            return;
        }
        const card = JSON.parse(cardJson);
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
async function addRenderedEquipmentPage(equipment, url, source) {
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
function equipmentSourceName(value) {
    return cleanText(value)
        .replace(/^Equipment\s*-\s*/i, '')
        .replace(/\s*\|\s*Dokkan Info!?\s*$/i, '')
        .trim();
}
function equipmentIndexLinks(document, section, restrictionType) {
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
        };
    })
        .filter(source => source.id && source.url)
        .filter((source, index, sources) => sources.findIndex(item => item.url === source.url) === index);
}
function renderedEquipmentItems(document, source) {
    const containers = new Set();
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
function closestEquipmentContainer(icon) {
    let current = icon;
    while (current) {
        if (current.classList.contains('bg-main') && current.querySelector('b') && current.querySelector('img[src*="/item/equipment/equ_item_"]')) {
            return current;
        }
        current = current.parentElement;
    }
    return undefined;
}
function equipmentFromRenderedHtml(item, source) {
    return equipmentFromDokkanInfo(item, source, equipmentRestrictions(item.description, source));
}
function equipmentFromDokkanInfo(item, source, restrictions) {
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
    });
}
function addEquipment(equipment, item) {
    const current = equipment.get(item.id);
    if (!current) {
        equipment.set(item.id, item);
        return;
    }
    current.restrictions = uniqueByJson([...(current.restrictions ?? []), ...(item.restrictions ?? [])]);
    current.sourcePages = uniqueByJson([...(current.sourcePages ?? []), ...(item.sourcePages ?? [])]);
}
function equipmentRestrictions(description, source, card) {
    const rawDescription = cleanText(description);
    const restriction = {
        type: source.type,
        rawDescription,
    };
    if (source.type === 'card') {
        restriction.cardIds = [card?.id?.toString() ?? source.id].filter(Boolean);
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
        restriction.classes = source.id === 'extreme' ? [character_1.Classes.Extreme] : [character_1.Classes.Super];
    }
    return [cleanObject(restriction)];
}
function characterEquipmentReferences(data) {
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
    })));
}
function equipmentValues(value) {
    return Object.values(value ?? {});
}
function applyEquipmentDebugLimit(items) {
    const limit = parseInt(process.env.DOKKAN_SCRAPER_EQUIPMENT_LIMIT ?? '', 10);
    return limit > 0 ? items.slice(0, limit) : items;
}
function syntheticEquipmentId(item, source) {
    const signature = [
        cleanText(item.name),
        cleanText(item.description),
        cleanText(item.grade),
        item.icon_image_id ?? '',
        source.type,
        source.id ?? '',
    ].join('|');
    return `synthetic:${(0, crypto_1.createHash)('sha1').update(signature).digest('hex').slice(0, 12)}`;
}
function cardTargetFromDescription(description) {
    const match = description.match(/Can be equipped to\s+\[([^\]]+)\]\s*([^.]*)\./i);
    return {
        title: cleanText(match?.[1]),
        name: cleanText(match?.[2]),
    };
}
function quotedNames(description) {
    return Array.from(new Set(Array.from(description.matchAll(/"([^"]+)"/g)).map(match => cleanText(match[1])).filter(Boolean)));
}
function elementRestriction(element) {
    if (!element || !/^\d+$/.test(element)) {
        return {};
    }
    const classIndex = Math.floor(parseInt(element, 10) / 10) % 10;
    const classes = classIndex === 1 ? [character_1.Classes.Super] : classIndex === 2 ? [character_1.Classes.Extreme] : undefined;
    return {
        classes,
        types: [typeFromElement(element)],
    };
}
function statFromDescription(description, stat) {
    const match = description.match(new RegExp(`(?:character's|character\\u2019s) ${stat} \\+(\\d+)`, 'i'))
        ?? description.match(new RegExp(`${stat} \\+(\\d+)(?!\\s*Lv\\.)`, 'i'));
    return match ? parseInt(match[1], 10) : undefined;
}
function numericIdFromPath(path) {
    const match = path.match(/(\d+)(?=\.png$)/);
    return match ? parseInt(match[1], 10) : undefined;
}
function gradeFromBackground(value) {
    const match = value.match(/equ_base_([a-z]+)(?:_\d+)?/i);
    return cleanText(match?.[1]);
}
function equipmentIconUrl(iconImageId) {
    return `${DOKKAN_INFO_ASSET_BASE_URL}/item/equipment/equ_item_${iconImageId.toString().padStart(5, '0')}.png`;
}
function equipmentBackgroundUrl(grade) {
    const backgroundName = grade === 'gold' ? 'equ_base_gold_2' : `equ_base_${grade}`;
    return `${DOKKAN_INFO_ASSET_BASE_URL}/layout/en/image/item/equipment/equipment_thumb_bg/${backgroundName}.png`;
}
function uniqueByJson(values) {
    const seen = new Set();
    return values.filter(value => {
        const key = JSON.stringify(value);
        if (seen.has(key)) {
            return false;
        }
        seen.add(key);
        return true;
    });
}
async function fetchPage(url, retries = 3) {
    while (retries > 0) {
        try {
            if (preferCurl) {
                return await fetchPageWithCurl(url);
            }
            const html = await fetchPageWithAxios(url);
            return html;
        }
        catch (error) {
            try {
                preferCurl = true;
                return await fetchPageWithCurl(url);
            }
            catch (curlError) {
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
async function fetchPageWithAxios(url) {
    const response = await axios_1.default.get(url, {
        headers: browserHeaders,
        timeout: 60000,
        responseType: 'text',
    });
    return validateHtml(url, response.data);
}
async function fetchPageWithCurl(url) {
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
function validateHtml(url, html) {
    if (typeof html === 'string' && html.includes('Sorry, you have been blocked')) {
        throw new Error(`DokkanInfo blocked the request to ${url}.`);
    }
    return html;
}
async function fetchFromWeb(url) {
    const html = await fetchPage(url);
    const dom = new jsdom_1.JSDOM(html);
    return dom.window.document;
}
exports.fetchFromWeb = fetchFromWeb;
function extractCharacterData(characterDocument) {
    const dataJson = getRequiredJsonAttribute(characterDocument, 'card-info', 'v-bind:datajson');
    return mapDokkanInfoCard(JSON.parse(dataJson));
}
exports.extractCharacterData = extractCharacterData;
function mapDokkanInfoCard(data) {
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
    const characterData = {
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
function getRequiredJsonAttribute(document, selector, attribute) {
    const value = document.querySelector(selector)?.getAttribute(attribute);
    if (!value) {
        throw new Error(`Could not find ${attribute} on <${selector}>.`);
    }
    return value;
}
function isUsableCard(card) {
    const nowSeconds = Math.floor(Date.now() / 1000);
    return card.rarity >= 0
        && card.rarity <= 5
        && card.id <= 3000000
        && (card.hp_init ?? 0) > 300
        && (card.open_at ?? 0) <= nowSeconds;
}
function selectedCardIds() {
    const ids = (process.env.DOKKAN_SCRAPER_CARD_IDS ?? '')
        .split(',')
        .map(id => parseInt(id.trim(), 10))
        .filter(Number.isFinite);
    return ids.length ? ids : undefined;
}
function cardsFromRequestedIds(cards) {
    const cardsById = new Map(cards.map(card => [card.id, card]));
    return selectedCardIds().map(id => cardsById.get(id) ?? {
        id,
        name: '',
        rarity: 0,
        lv_max: 0,
        element: '00',
    });
}
function applyDebugLimit(cards) {
    const limit = parseInt(process.env.DOKKAN_SCRAPER_LIMIT ?? '', 10);
    return limit > 0 ? cards.slice(0, limit) : cards;
}
function normalizeAssetId(cardId) {
    return Math.floor(cardId / 10) * 10;
}
function toLegacyId(assetId) {
    const asset = assetId.toString();
    if (asset.length < 7) {
        return asset;
    }
    return `${asset[0]}${asset.slice(3, -1)}`;
}
function cardImageUrl(assetId, filename) {
    return `${DOKKAN_INFO_ASSET_BASE_URL}/character/card/${assetId}/${filename}`;
}
function cardThumbUrl(iconId) {
    return `${DOKKAN_INFO_ASSET_BASE_URL}/character/thumb/card_${iconId}_thumb/card_${iconId}_thumb.png`;
}
function portraitOutputUrl(portraitFilename) {
    return `images/${portraitFilename}.png`;
}
function portraitSpec(card) {
    const iconId = card.icon_id ?? card.asset_id ?? normalizeAssetId(card.id);
    const frameColorId = parseInt(card.bg_element ?? `${parseInt(card.element, 10) % 10}`, 10);
    return {
        iconId,
        frameColorId,
        rarity: rarityFromNumber(card.rarity),
        elementCode: card.element.padStart(2, '0'),
    };
}
function rarityFromNumber(rarity) {
    const rarityMap = [character_1.Rarities.N, character_1.Rarities.R, character_1.Rarities.SR, character_1.Rarities.SSR, character_1.Rarities.UR, character_1.Rarities.LR];
    return rarityMap[rarity] ?? character_1.Rarities.N;
}
function typeFromElement(element) {
    const typeIndex = parseInt(element, 10) % 10;
    const typeMap = [character_1.Types.AGL, character_1.Types.TEQ, character_1.Types.INT, character_1.Types.STR, character_1.Types.PHY];
    return typeMap[typeIndex] ?? character_1.Types.AGL;
}
function classFromElement(element) {
    const classIndex = Math.floor(parseInt(element, 10) / 10) % 10;
    return classIndex === 2 ? character_1.Classes.Extreme : character_1.Classes.Super;
}
function classFromCard(card) {
    const classIndex = Math.floor(parseInt(card.element, 10) / 10) % 10;
    if (classIndex === 1) {
        return character_1.Classes.Super;
    }
    if (classIndex === 2) {
        return character_1.Classes.Extreme;
    }
    if (card.awakening_element_type === 2) {
        return character_1.Classes.Extreme;
    }
    return character_1.Classes.Super;
}
function superAttackText(superAttacks, kind) {
    return superAttackDetails(superAttacks, kind).effect ?? '';
}
function unitSuperAttacks(superAttacks) {
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
function formatNamedDescription(value) {
    if (!value) {
        return '';
    }
    const name = cleanInlineText(value.name);
    const description = cleanMultilineText(value.itemized_description ?? value.effect_description ?? value.description);
    return [name, description].filter(Boolean).join(': ');
}
function activeSkillText(value) {
    return formatNamedDescription(value);
}
function activeSkillCondition(value) {
    return cleanMultilineText(value?.condition_description ?? value?.causality_description ?? value?.conditions);
}
function namedDescriptionsText(value) {
    const values = Array.isArray(value) ? value : value && 'name' in value ? [value] : arrayFromDokkanList(value);
    return values.map(formatNamedDescription).filter(Boolean).join('; ');
}
function finishSkillTexts(values) {
    return arrayFromDokkanList(values).map(formatNamedDescription).filter(Boolean);
}
function passiveDetails(value) {
    if (!value) {
        return undefined;
    }
    const text = cleanMultilineText(value.itemized_description ?? value.description);
    return cleanObject({
        name: cleanInlineText(value.name),
        text,
        lines: text ? text.split('\n').map(line => line.trim()).filter(Boolean) : undefined,
    });
}
function superAttackDetails(superAttacks, kind) {
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
function matchingSuperAttack(superAttacks, kind) {
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
function attackType(value) {
    const normalized = cleanInlineText(value).toLowerCase();
    if (normalized.includes('ki blast')) {
        return character_1.AttackTypes.KiBlast;
    }
    if (normalized.includes('unarmed')) {
        return character_1.AttackTypes.Unarmed;
    }
    if (normalized.includes('armed') || normalized.includes('physical')) {
        return character_1.AttackTypes.Armed;
    }
    return character_1.AttackTypes.Other;
}
function parseLeaderSkillDetails(leaderSkill) {
    const normalizedLeaderSkill = cleanMultilineText(leaderSkill);
    if (!normalizedLeaderSkill) {
        return undefined;
    }
    const clauses = splitLeaderSkillClauses(normalizedLeaderSkill)
        .map(parseLeaderSkillClause)
        .filter((clause) => Boolean(clause));
    const displayBoost = calculateLeaderSkillDisplayBoost(clauses);
    return {
        rawText: normalizedLeaderSkill,
        displayBoost,
        clauses,
    };
}
exports.parseLeaderSkillDetails = parseLeaderSkillDetails;
function splitLeaderSkillClauses(leaderSkill) {
    const normalized = cleanInlineText(leaderSkill);
    const additionalSections = normalized.split(/(?:,|;)?\s*plus an additional\s+/i);
    const baseSection = additionalSections.shift() ?? '';
    const clauses = splitAlternativeClauses(baseSection, 'primary', 'base');
    for (const additionalSection of additionalSections) {
        clauses.push(...splitAlternativeClauses(additionalSection, 'additional', /\balso belong\b/i.test(additionalSection) ? 'also-belong' : 'base'));
    }
    return clauses;
}
function splitAlternativeClauses(text, initialStackGroup, targetMode) {
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
function parseLeaderSkillClause(clause) {
    if (!clause.rawText) {
        return undefined;
    }
    const boost = parseLeaderSkillBoostValues(clause.rawText);
    const categories = extractLeaderSkillCategories(clause.rawText);
    const types = extractLeaderSkillTypes(clause.rawText);
    const classes = extractLeaderSkillClasses(clause.rawText);
    const ki = extractLeaderSkillKi(clause.rawText);
    return cleanObject({
        rawText: clause.rawText,
        stackGroup: clause.stackGroup,
        targetMode: clause.targetMode,
        categories,
        types,
        classes,
        ki,
        hp: boost.hp,
        atk: boost.atk,
        def: boost.def,
        boostForm: boost.boostForm,
    });
}
function parseLeaderSkillBoostValues(segment) {
    const boostForm = segment.includes('%') ? 'percentage' : 'flat';
    return boostForm === 'percentage'
        ? parsePercentageLeaderSkillSummary(segment)
        : parseFlatLeaderSkillSummary(segment);
}
function parsePercentageLeaderSkillSummary(segment) {
    const separatedBoostPattern1 = /(HP|ATK|DEF) & (HP|ATK|DEF) \+(\d+)% and (HP|ATK|DEF) \+(\d+)%/i;
    const separatedBoostPattern2 = /HP \+(\d+)% and ATK & DEF \+(\d+)%/i;
    const combinedBoostPattern = /HP, ATK (?:&|and) DEF \+(\d+)%/i;
    const separateStatBoostPattern = /(HP|DEF) & (DEF|HP) \+(\d+)%, (ATK) \+(\d+)%/i;
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
    }
    else if (separatedBoostMatch1) {
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
    }
    else if (separatedBoostMatch2) {
        hp = parseFloat(separatedBoostMatch2[1] ?? '0');
        atk = parseFloat(separatedBoostMatch2[2] ?? '0');
        def = atk;
    }
    return {
        hp,
        atk,
        def,
        boostForm: 'percentage',
    };
}
function parseFlatLeaderSkillSummary(segment) {
    const flatBoostPattern = /(HP|ATK|DEF) \+(\d+)/gi;
    const matches = Array.from(segment.matchAll(flatBoostPattern));
    const flatBoostMap = new Map(matches.map(match => [match[1], parseFloat(match[2] ?? '0')]));
    return {
        hp: flatBoostMap.get('HP') ?? 0,
        atk: flatBoostMap.get('ATK') ?? 0,
        def: flatBoostMap.get('DEF') ?? 0,
        boostForm: 'flat',
    };
}
function extractLeaderSkillCategories(segment) {
    const categories = Array.from(segment.matchAll(/"([^"]+)"/g))
        .map(match => cleanInlineText(match[1]))
        .filter(Boolean);
    return categories.length ? Array.from(new Set(categories)) : undefined;
}
function extractLeaderSkillTypes(segment) {
    if (!/\bType\b/i.test(segment)) {
        return undefined;
    }
    if (/\bAll Type\b|\bAll Types\b/i.test(segment)) {
        return ['All'];
    }
    const explicitTypes = Array.from(segment.matchAll(/\b(AGL|TEQ|INT|STR|PHY)\b/gi))
        .map(match => match[1].toUpperCase());
    if (explicitTypes.length) {
        return Array.from(new Set(explicitTypes));
    }
    return ['All'];
}
function extractLeaderSkillClasses(segment) {
    const classes = Array.from(segment.matchAll(/\b(Super|Extreme)\b(?=\s+(?:Class|AGL|TEQ|INT|STR|PHY|Type|Types))/gi))
        .map(match => match[1][0].toUpperCase() + match[1].slice(1).toLowerCase());
    return classes.length ? Array.from(new Set(classes)) : undefined;
}
function extractLeaderSkillKi(segment) {
    const kiBoost = segment.match(/Ki \+(\d+)/i)?.[1];
    return kiBoost ? parseInt(kiBoost, 10) : undefined;
}
function calculateLeaderSkillDisplayBoost(parsedLeaderSkills) {
    let totalBoost = 0;
    let endLoop = false;
    parsedLeaderSkills.forEach(leaderSkill => {
        if (endLoop) {
            return;
        }
        const boost = leaderSkill.boostForm === 'percentage'
            ? (leaderSkill.hp + leaderSkill.atk + leaderSkill.def) / 3
            : leaderSkill.atk;
        if (boost < 40 && totalBoost > 0 && totalBoost < 200) {
            totalBoost += boost;
            endLoop = true;
        }
        else if (totalBoost === 0 && boost > totalBoost) {
            totalBoost = boost;
        }
        else if (totalBoost !== 200 && totalBoost > 170 && totalBoost < 230 && boost <= 50) {
            totalBoost += boost;
        }
    });
    return totalBoost;
}
function characterExtraInfo(card) {
    return cleanObject({
        kiMultiplierText: kiMultiplier(card),
        kiMultiplierSteps: kiMultiplierSteps(card),
    });
}
function transformations(data, baseCharacterId) {
    const currentCardId = data.card.id;
    const links = uniqueCleanNames(data.links);
    const detailsById = new Map(arrayFromDokkanList(data.transformation_details).map(detail => [detail.card.id, detail]));
    const transformedCards = arrayFromDokkanList(data.transformations)
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
        });
    });
}
function awakeningReferences(cards) {
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
function dokkanFrontierPassives(values) {
    return arrayFromDokkanList(values)
        .map(value => ({
        title: cleanInlineText(value.title),
        originBattleId: value.origin_battle_id,
        passive: cleanMultilineText(value.passive_skill),
    }))
        .filter(value => value.passive);
}
function uniqueCleanNames(values) {
    return Array.from(new Set(arrayFromDokkanList(values)
        .map(value => cleanInlineText(value.name ?? value.description))
        .filter(Boolean)));
}
function kiMeter(card) {
    const kiValues = [
        card.eball_mod_num100 ? `${card.eball_mod_num100} Ki: 100%` : '',
        card.eball_mod_mid_num ? `${card.eball_mod_mid_num} Ki: ${card.eball_mod_mid}%` : '',
        card.eball_mod_max_num ? `${card.eball_mod_max_num} Ki: ${card.eball_mod_max}%` : '',
    ];
    return kiValues.filter(Boolean);
}
function kiMultiplier(card) {
    const values = [
        card.eball_mod_min !== undefined ? `Minimum ${card.eball_mod_min}%` : '',
        card.eball_mod_num100 !== undefined ? `${card.eball_mod_num100} Ki 100%` : '',
        card.eball_mod_mid_num ? `${card.eball_mod_mid_num} Ki ${card.eball_mod_mid}%` : '',
        card.eball_mod_max_num ? `${card.eball_mod_max_num} Ki ${card.eball_mod_max}%` : '',
    ];
    return values.filter(Boolean).join('; ');
}
function kiMultiplierSteps(card) {
    return [
        card.eball_mod_num100 !== undefined ? { ki: toNumber(card.eball_mod_num100), percent: toNumber(card.eball_mod_min), label: 'minimum' } : undefined,
        card.eball_mod_mid_num ? { ki: toNumber(card.eball_mod_mid_num), percent: toNumber(card.eball_mod_mid), label: 'mid' } : undefined,
        card.eball_mod_max_num ? { ki: toNumber(card.eball_mod_max_num), percent: toNumber(card.eball_mod_max), label: 'max' } : undefined,
    ].filter(Boolean);
}
function freeDupeStat(maxStat, hipoStat) {
    return toNumber(maxStat) + Math.min(2000, Math.max(0, hipoStat));
}
function rainbowStat(maxStat, hipoStat) {
    return toNumber(maxStat) + Math.max(0, hipoStat);
}
function releaseDate(value) {
    if (!value) {
        return '';
    }
    return new Date(value * 1000).toISOString();
}
function toNumber(value) {
    return Number.isFinite(value) ? Number(value) : 0;
}
function cleanInlineText(value) {
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
function cleanMultilineText(value) {
    return normalizeTextArtifacts(value ?? '')
        .replace(/&#039;/g, "'")
        .replace(/&quot;/g, '"')
        .replace(/&amp;/g, '&')
        .replace(/\{[^}]+}/g, '')
        .replace(/\r\n/g, '\n')
        .split('\n')
        .map(line => line.replace(/\*([^*]+)\*/g, '$1').replace(/\s+/g, ' ').trim())
        .filter(Boolean)
        .join('\n')
        .trim();
}
function cleanText(value) {
    return cleanInlineText(value);
}
function normalizeTextArtifacts(value) {
    return value
        .replace(/â€™|â€˜/g, "'")
        .replace(/[‘’]/g, "'")
        .replace(/â€œ|â€/g, '"')
        .replace(/[“”]/g, '"')
        .replace(/â€“|â€”/g, '-')
        .replace(/[–—]/g, '-')
        .replace(/\u00A0/g, ' ');
}
function arrayFromDokkanList(value) {
    if (!value) {
        return [];
    }
    return Array.isArray(value) ? value : Object.values(value);
}
function cleanObject(obj) {
    const mutableObject = obj;
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
async function mapWithConcurrency(items, concurrency, mapper) {
    const results = new Array(items.length);
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
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
//# sourceMappingURL=scraper.js.map