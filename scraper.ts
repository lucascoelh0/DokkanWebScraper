import axios, { AxiosError } from 'axios';

import { JSDOM } from 'jsdom';
import { Character, Rarities, Classes, Types, Transformation } from "./character";

export async function getDokkanData(rarity: string) {
    const baseUrl = 'https://dbz-dokkanbattle.fandom.com/wiki/Category:';
    let currentPageUrl = baseUrl + rarity;
    const allCharacterData: any[] = [];

    while (currentPageUrl) {
        const document: Document = await fetchFromWeb(currentPageUrl);
        const links: string[] = extractLinks(document);
        const linkToRemove = 'https://dbz-dokkanbattle.fandom.com/wiki/Category:Dokkan_Fest_Exclusive';

        // Filter out the specific link
        const filteredLinks: string[] = links.filter(link => link !== linkToRemove);

        const charactersData = await Promise.all(filteredLinks.map(async link => {
            const characterDocument: Document = await fetchFromWeb(link);
            return extractCharacterData(characterDocument);
        }));

        allCharacterData.push(...charactersData);

        // Try to find the next link. If it doesn't exist, the loop will stop.
        const nextPageLink = document.querySelector('.category-page__pagination-next');
        currentPageUrl = nextPageLink ? nextPageLink.getAttribute('href') : null;
    }

    return allCharacterData;
}

async function fetchPage(url: string, retries = 3): Promise<string | undefined> {
    const http = require("http")
    const instance = axios.create({
        baseURL: url,
        timeout: 60000,
        httpAgent: new http.Agent({ keepAlive: true }),

    });

    while (retries) {
        try {
            const response = await instance.get(url);
            return response.data;
        } catch (error) {
            if (error.code === 'ETIMEDOUT') {
                console.log(`Timeout error, ${retries} retries left.`);
                retries--;

                if (!retries) throw error; // If no retries left, throw the error.

            } else {
                console.error('Error occurred:', error.message);
                throw error; // If error is not ETIMEDOUT, throw it.
            }
        }
    }
}

export async function fetchFromWeb(url: string) {
    const HTMLData = await fetchPage(url);
    const dom = new JSDOM(HTMLData);
    return dom.window.document;
}

function extractLinks(document: Document) {
    const URIs: HTMLAnchorElement[] = Array.from(
        document.querySelectorAll('.category-page__member-link'),
    );
    return URIs.map(link => 'https://dbz-dokkanbattle.fandom.com'.concat(link.href))
}

export function extractCharacterData(characterDocument: Document) {
    function cleanText(text: string): string {
        return text
            .replace(/\[\d+\]/g, '') // Removes [1], [2], etc.
            .replace(/, plus an additional HP,/g, '; plus an additional HP,'); // Adjusts leader skill text
    }

    function cleanStringFields(obj: any) {
        for (const key in obj) {
            if (typeof obj[key] === 'string') {
                obj[key] = cleanText(obj[key]);
            }
        }
        return obj;
    }

    function cleanObject(obj: any): any {
        for (const propName in obj) {
            if (obj[propName] === undefined || obj[propName] === '' || 
                Array.isArray(obj[propName]) && obj[propName].length === 0) {
                delete obj[propName];
            }
        }
        return obj;
    }

    function getUnitSuperAttacks() {
        // Get all Unit Super Attacks
        const unitSuperAttacks = Array.from(characterDocument.querySelectorAll('[data-image-name="Unit SA.png"]'))
            .map(element => element.closest('tr')?.nextElementSibling?.textContent.trim() ?? undefined);

        // Get all Activation Conditions
        const activationConditions = Array.from(characterDocument.querySelectorAll('[data-image-name="Activation Condition.png"]'))
            .map(element => element.closest('tr')?.nextElementSibling?.textContent.trim() ?? undefined);

        // Combine the Unit Super Attacks with their respective Activation Conditions
        return unitSuperAttacks.map((attack, index) => {
            return {
                unitSuperAttack: attack,
                unitSuperAttackCondition: activationConditions[index]
            };
        });
    }

    const hasSuperEZA = characterDocument.querySelector('li.wds-tabs__tab[data-hash="Super_Z-Awakened"]') !== null;
    const transformedCharacterData: Transformation[] = extractTransformedCharacterData(characterDocument).filter(transformation => transformation.id !== "11066");
    const leaderSkillElement = characterDocument.querySelector('[data-image-name="Leader Skill.png"]')?.closest('tr')?.nextElementSibling;
    const ezaLeaderSkillElement = characterDocument.querySelector('.ezatabber > div > div:nth-child(3) > table > tbody > tr:nth-child(2) > td') ?? undefined;
    const passiveSkillElement = characterDocument.querySelector('[data-image-name="Passive skill.png"]')?.closest('tr')?.nextElementSibling ?? undefined;
    const conditionRow = characterDocument.querySelector('tr a[href="/wiki/Transformation"] img[alt$="Condition"]')?.closest('tr');
    const conditionDetails = conditionRow?.nextElementSibling?.querySelector('td > center')?.textContent ?? undefined;
    const standbySkillElement = characterDocument.querySelector('[data-image-name="Standby skill.png"]');
    let standbyDescription = getTextWithType(standbySkillElement?.closest('tr')?.nextElementSibling, dokkanTypeMap);
    const nextRowDescription = getTextWithType(standbySkillElement?.closest('tr')?.nextElementSibling?.nextElementSibling, dokkanTypeMap);
    if (nextRowDescription) {
        standbyDescription = standbyDescription ? `${standbyDescription}; ${nextRowDescription}` : nextRowDescription;
    }

    let ezaPassiveSkill;
    let sezaPassiveSkill;
    if (hasSuperEZA) {
        const passiveTabsContainer = characterDocument.querySelector('tr td[colspan="2"] .eventstabber .tabber.wds-tabber');
        const tabsContent = passiveTabsContainer.querySelectorAll('.wds-tab__content');

        if (tabsContent[0]) {
            ezaPassiveSkill = tabsContent[0].querySelector('center')?.textContent.trim() || 'Error';
        }

        if (tabsContent[1]) {
            sezaPassiveSkill = tabsContent[1].querySelector('center')?.textContent.trim() || 'Error';
        }
    } else {
        let ezaPassiveSkillElement = characterDocument.querySelectorAll('table.ezawidth')[1]?.querySelector('[data-image-name="Passive skill.png"]')?.closest('tr')?.nextElementSibling ?? undefined;
        ezaPassiveSkill = ezaPassiveSkillElement != undefined ? getTextWithType(ezaPassiveSkillElement, dokkanTypeMap) : undefined
    }

    const idElement = characterDocument.querySelector('.mw-parser-output table > tbody > tr:nth-child(3) > td:nth-child(6) > center');
    const id = idElement ? idElement.textContent.trim() : 'Error';

    const characterData: Character = {
        name: characterDocument.querySelector('.mw-parser-output')?.querySelector('table > tbody > tr > td:nth-child(2)')?.innerHTML.split('<br>')[1].split('</b>')[0].replaceAll('&amp;', '&') ?? 'Error',
        title: characterDocument.querySelector('.mw-parser-output')?.querySelector('table > tbody > tr > td:nth-child(2)')?.innerHTML.split('<br>')[0].split('<b>')[1] ?? 'Error',
        maxLevel: parseInt((characterDocument.querySelector('.mw-parser-output')?.querySelector('table > tbody > tr:nth-child(3) > td')?.textContent?.split('/')[1] || characterDocument.querySelector('.mw-parser-output')?.querySelector('table > tbody > tr:nth-child(3) > td')?.textContent?.split('/')[0]) ?? 'Error'),
        maxSALevel: parseInt((characterDocument.querySelector('.mw-parser-output')?.querySelector('table > tbody > tr:nth-child(3) > td:nth-child(2) > center')?.innerHTML.split('>/')[1]) ?? ' Error'),
        rarity: Rarities[characterDocument.querySelector('.mw-parser-output')?.querySelector('table > tbody > tr:nth-child(3) > td:nth-child(3) > center')?.querySelector('a')?.getAttribute('title')?.split('Category:')[1] ?? 'Error'],
        characterClass: Classes[characterDocument.querySelector('.mw-parser-output')?.querySelector('table > tbody > tr:nth-child(3) > td:nth-child(4) > center:nth-child(1) > a:nth-child(1)')?.getAttribute('title')?.split(' ')[0].split('Category:')[1] ?? 'Error'],
        type: Types[characterDocument.querySelector('.mw-parser-output')?.querySelector('table > tbody > tr:nth-child(3) > td:nth-child(4) > center:nth-child(1) > a:nth-child(1)')?.getAttribute('title')?.split(' ')[1] ?? 'Error'],
        cost: parseInt((characterDocument.querySelector('.mw-parser-output')?.querySelector('table > tbody > tr:nth-child(3) > td:nth-child(5) > center:nth-child(1)')?.textContent) ?? 'Error'),
        id: id,
        portraitURL: (characterDocument.querySelector('.mw-parser-output')?.querySelector('table > tbody > tr > td > div > img')?.getAttribute('src') || characterDocument.querySelector('.mw-parser-output')?.querySelector('table > tbody > tr > td > a')?.getAttribute('href')) ?? 'Error',
        portraitFilename: "",
        leaderSkill: getTextWithType(leaderSkillElement, dokkanTypeMap),
        ezaLeaderSkill: ezaLeaderSkillElement != undefined ? getTextWithType(ezaLeaderSkillElement, dokkanTypeMap) : undefined,
        superAttack: characterDocument.querySelector('[data-image-name="Super atk.png"]')?.closest('tr')?.nextElementSibling?.textContent ?? 'Error',
        ezaSuperAttack: characterDocument.querySelectorAll('table.ezawidth')[1]?.querySelector('[data-image-name="Super atk.png"]')?.closest('tr')?.nextElementSibling?.textContent ?? undefined,
        ultraSuperAttack: characterDocument.querySelector('[data-image-name="Ultra Super atk.png"]')?.closest('tr')?.nextElementSibling?.textContent ?? undefined,
        ezaUltraSuperAttack: characterDocument.querySelectorAll('table.ezawidth')[1]?.querySelector('[data-image-name="Ultra Super atk.png"]')?.closest('tr')?.nextElementSibling?.textContent ?? undefined,
        unitSuperAttacks: getUnitSuperAttacks(),
        passive: passiveSkillElement != undefined ? getTextWithType(passiveSkillElement, dokkanTypeMap) : undefined,
        ezaPassive: ezaPassiveSkill ?? undefined,
        sezaPassive: sezaPassiveSkill ?? undefined,
        activeSkill: (characterDocument.querySelector('[data-image-name="Active skill.png"]')?.closest('tr')?.nextElementSibling?.textContent || characterDocument.querySelector('[data-image-name="Active skill.png"]')?.closest('tr')?.nextElementSibling?.nextElementSibling?.textContent) ?? undefined,
        activeSkillCondition: characterDocument.querySelector('[data-image-name="Active skill.png"]')?.closest('tr')?.nextElementSibling?.nextElementSibling?.nextElementSibling?.querySelector('td > center')?.textContent ?? undefined,
        ezaActiveSkill: characterDocument.querySelectorAll('table.ezawidth')[1]?.querySelector('[data-image-name="Active skill.png"]')?.closest('tr')?.nextElementSibling?.textContent ?? undefined,
        ezaActiveSkillCondition: characterDocument.querySelectorAll('table.ezawidth')[1]?.querySelector('[data-image-name="Active skill.png"]')?.closest('tr')?.nextElementSibling?.nextElementSibling?.nextElementSibling?.querySelector('td > center')?.textContent ?? undefined,
        transformationCondition: conditionDetails,
        domain: characterDocument.querySelector('[data-image-name="Domain text.png"]')?.closest('tr')?.nextElementSibling?.textContent ?? undefined,
        links: Array.from(characterDocument.querySelector('[data-image-name="Link skill.png"]')?.closest('tr')?.nextElementSibling?.querySelectorAll('span > a') ?? []).map(link => link.textContent ?? 'Error'),
        categories: Array.from(characterDocument.querySelector('[data-image-name="Category.png"]')?.closest('tr')?.nextElementSibling?.querySelectorAll('a') ?? []).map(link => link.textContent ?? 'Error'),
        kiMeter: Array.from(characterDocument.querySelector('[data-image-name="Ki meter.png"]')?.closest('tbody')?.querySelectorAll('img') ?? []).map(kiMeter => kiMeter.getAttribute('alt')?.split('.png')[0] ?? 'Error').slice(1),
        artURL: (characterDocument.querySelector('.lefttablecard')?.querySelector('table > tbody > tr > td > center > span > a')?.getAttribute('href') || characterDocument.querySelector('.lefttablecard')?.querySelector('table:nth-child(1) > tbody > tr > td > center > span > div > img')?.getAttribute('src') || characterDocument.querySelector('.wds-tab__content')?.querySelector('table > tbody > tr > td > center > span > div > img')?.getAttribute('src') || characterDocument.querySelector('.ts-container')?.querySelector('div:nth-child(2) > a')?.getAttribute('href')) ?? 'Error',
        artFilename: "",
        baseHP: parseInt(characterDocument.querySelector('.righttablecard > table:nth-child(3) > tbody:nth-child(1) > tr:nth-child(2) > td:nth-child(2) > center:nth-child(1)')?.textContent ?? 'Error'),
        maxLevelHP: parseInt(characterDocument.querySelector('.righttablecard > table:nth-child(3) > tbody:nth-child(1) > tr:nth-child(2) > td:nth-child(3) > center:nth-child(1)')?.textContent ?? 'Error'),
        freeDupeHP: parseInt(characterDocument.querySelector('.righttablecard > table:nth-child(3) > tbody:nth-child(1) > tr:nth-child(2) > td:nth-child(4) > center:nth-child(1)')?.textContent ?? 'Error'),
        rainbowHP: parseInt(characterDocument.querySelector('.righttablecard > table:nth-child(3) > tbody:nth-child(1) > tr:nth-child(2) > td:nth-child(5) > center:nth-child(1)')?.textContent ?? 'Error'),
        baseAttack: parseInt(characterDocument.querySelector('.righttablecard > table:nth-child(3) > tbody:nth-child(1) > tr:nth-child(3) > td:nth-child(2) > center:nth-child(1)')?.textContent ?? 'Error'),
        maxLevelAttack: parseInt(characterDocument.querySelector('.righttablecard > table:nth-child(3) > tbody:nth-child(1) > tr:nth-child(3) > td:nth-child(3) > center:nth-child(1)')?.textContent ?? 'Error'),
        freeDupeAttack: parseInt(characterDocument.querySelector('.righttablecard > table:nth-child(3) > tbody:nth-child(1) > tr:nth-child(3) > td:nth-child(4) > center:nth-child(1)')?.textContent ?? 'Error'),
        rainbowAttack: parseInt(characterDocument.querySelector('.righttablecard > table:nth-child(3) > tbody:nth-child(1) > tr:nth-child(3) > td:nth-child(5) > center:nth-child(1)')?.textContent ?? 'Error'),
        baseDefence: parseInt(characterDocument.querySelector('.righttablecard > table:nth-child(3) > tbody:nth-child(1) > tr:nth-child(4) > td:nth-child(2) > center:nth-child(1)')?.textContent ?? 'Error'),
        maxDefence: parseInt(characterDocument.querySelector('.righttablecard > table:nth-child(3) > tbody:nth-child(1) > tr:nth-child(4) > td:nth-child(3) > center:nth-child(1)')?.textContent ?? 'Error'),
        freeDupeDefence: parseInt(characterDocument.querySelector('.righttablecard > table:nth-child(3) > tbody:nth-child(1) > tr:nth-child(4) > td:nth-child(4) > center:nth-child(1)')?.textContent ?? 'Error'),
        rainbowDefence: parseInt(characterDocument.querySelector('.righttablecard > table:nth-child(3) > tbody:nth-child(1) > tr:nth-child(4) > td:nth-child(5) > center:nth-child(1)')?.textContent ?? 'Error'),
        kiMultiplier: (characterDocument.querySelector('.righttablecard > table:nth-child(6) > tbody:nth-child(1) > tr:nth-child(2) > td:nth-child(1)')?.innerHTML.split('► ')[1].split('<br>')[0].concat('; ', characterDocument.querySelector('.righttablecard > table:nth-child(6) > tbody:nth-child(1) > tr:nth-child(2) > td:nth-child(1)')?.innerHTML.split('<br>► ')[1] ?? '').replace('<a href="/wiki/Super_Attack_Multipliers" title="Super Attack Multipliers">SA Multiplier</a>', 'SA Multiplier') ?? characterDocument.querySelector('.righttablecard')?.nextElementSibling?.querySelector('tr:nth-child(2) > td')?.textContent?.split('► ')[1]) ?? 'Error',
        standbySkill: standbyDescription.includes('Error') ? "" : standbyDescription,
        transformations: id != "1885" ? transformedCharacterData : undefined,
    }

    characterData.portraitFilename = `portrait_${characterData.id}`;
    characterData.artFilename = `art_${characterData.id}`;

    if (id != "1885") {
        characterData.transformations.forEach(function (value) {
            value.baseCharacterId = characterData.id;
        })
    }

    for (const key in characterData) {
        if (typeof characterData[key] === 'string') {
            characterData[key] = cleanText(characterData[key]);
        }
    }

    // Clean the unitSuperAttacks fields
    if (Array.isArray(characterData.unitSuperAttacks)) {
        characterData.unitSuperAttacks = characterData.unitSuperAttacks.map(cleanStringFields);
    }

    // Clean the transformations fields
    if (Array.isArray(characterData.transformations)) {
        characterData.transformations = characterData.transformations.map(cleanStringFields);
    }

    if (characterData.transformations) {
        characterData.transformations = characterData.transformations.map(transformation => cleanObject(transformation));
    }

    const cleanedCharacterData = cleanObject(characterData);

    return cleanedCharacterData;
}

function extractTransformedCharacterData(characterDocument: Document): Transformation[] {
    const transformedArray: Transformation[] = []
    const transformCount = characterDocument.querySelectorAll('.mw-parser-output > div:nth-child(2) > div > ul > li').length

    // index = 1 to skip the untransformed state which should have been extracted separately outside of this function
    for (let index = 1; index < transformCount; index++) {
        const passiveSkillElement = characterDocument.querySelector(`.mw-parser-output > div:nth-child(2) > div:nth-child(${index + 2})`)?.querySelector('[data-image-name="Passive skill.png"]')?.closest('tr')?.nextElementSibling ?? undefined;
        const ezaPassiveSkillElement = characterDocument.querySelector(`.mw-parser-output > div:nth-child(2) > div:nth-child(${index + 2})`)?.querySelector('.righttablecard > table > tbody > tr > td > div > div > div:nth-child(3)')?.querySelector('[data-image-name="Passive skill.png"]')?.closest('tr')?.nextElementSibling ?? undefined;
        const finishMoves: string[] = [];

        // Find all table rows that have a finishing move.
        const finishMoveRows = characterDocument?.querySelectorAll('td > a > img[alt^="Finish attack"]') ?? undefined;

        finishMoveRows?.forEach(row => {
            const descRow = row.closest('tr')?.nextElementSibling;
            const conditionRow = descRow?.nextElementSibling;

            if (descRow && conditionRow) {
                const desc = descRow.textContent?.trim() || '';
                const condition = conditionRow.textContent?.trim() || '';
                finishMoves.push(`${desc}; ${condition}`);
            }
        });

        const transformationData: Transformation = {
            baseCharacterId: "",
            name: characterDocument.querySelector(`.mw-parser-output > div:nth-child(2) > div:nth-child(${index + 2}) > table > tbody > tr > td:nth-child(2)`)?.innerHTML.split('<br>')[1].split('</b>')[0].replaceAll('&amp;', '&') ?? 'Error',
            id: characterDocument.querySelector(`.mw-parser-output > div:nth-child(2) > div:nth-child(${index + 2}) > table > tbody > tr:nth-child(3) > td:nth-child(6)`)?.textContent ?? 'Error',
            characterClass: Classes[characterDocument.querySelector(`.mw-parser-output > div:nth-child(2) > div:nth-child(${index + 2}) > table > tbody > tr:nth-child(3) > td:nth-child(4) > center > a`)?.getAttribute('title')?.split(' ')[0].split('Category:')[1] ?? 'Error'],
            type: Types[characterDocument.querySelector(`.mw-parser-output > div:nth-child(2) > div:nth-child(${index + 2}) > table > tbody > tr:nth-child(3) > td:nth-child(4) > center > a`)?.getAttribute('title')?.split(' ')[1] ?? 'Error'],
            superAttack: characterDocument.querySelector(`.mw-parser-output > div:nth-child(2) > div:nth-child(${index + 2})`)?.querySelector('[data-image-name="Super atk.png"]')?.closest('tr')?.nextElementSibling?.textContent ?? 'Error',
            ezaSuperAttack: characterDocument.querySelector(`.mw-parser-output > div:nth-child(2) > div:nth-child(${index + 2})`)?.querySelector('.righttablecard > table > tbody > tr > td > div > div > div:nth-child(3)')?.querySelector('[data-image-name="Super atk.png"]')?.closest('tr')?.nextElementSibling?.textContent ?? undefined,
            ultraSuperAttack: characterDocument.querySelector(`.mw-parser-output > div:nth-child(2) > div:nth-child(${index + 2})`)?.querySelector('[data-image-name="Ultra Super atk.png"]')?.closest('tr')?.nextElementSibling?.textContent ?? undefined,
            ezaUltraSuperAttack: characterDocument.querySelector(`.mw-parser-output > div:nth-child(2) > div:nth-child(${index + 2})`)?.querySelector('.righttablecard > table > tbody > tr > td > div > div > div:nth-child(3)')?.querySelector('[data-image-name="Ultra Super atk.png"]')?.closest('tr')?.nextElementSibling?.textContent ?? undefined,
            passive: passiveSkillElement != undefined ? getTextWithType(passiveSkillElement, dokkanTypeMap) : undefined,
            ezaPassive: ezaPassiveSkillElement != undefined ? getTextWithType(ezaPassiveSkillElement, dokkanTypeMap) : undefined,
            activeSkill: characterDocument.querySelector(`.mw-parser-output > div:nth-child(2) > div:nth-child(${index + 2})`)?.querySelector('[data-image-name="Active skill.png"]')?.closest('tr')?.nextElementSibling?.textContent ?? undefined,
            activeSkillCondition: characterDocument.querySelector(`.mw-parser-output > div:nth-child(2) > div:nth-child(${index + 2})`)?.querySelector('[data-image-name="Activation Condition.png"]')?.closest('tr')?.nextElementSibling?.textContent ?? undefined,
            links: Array.from(characterDocument.querySelector(`.mw-parser-output > div:nth-child(2) > div:nth-child(${index + 2})`)?.querySelector('[data-image-name="Link skill.png"]')?.closest('tr')?.nextElementSibling?.querySelectorAll('span > a') ?? []).map(link => link.textContent ?? 'Error'),
            domain: characterDocument.querySelector(`.mw-parser-output > div:nth-child(2) > div:nth-child(${index + 2})`)?.querySelector('[data-image-name="Domain text.png"]')?.closest('tr')?.nextElementSibling?.textContent ?? undefined,
            portraitURL: characterDocument.querySelector(`.mw-parser-output > div:nth-child(2) > div:nth-child(${index + 2}) > table > tbody > tr > td > div > img`)?.getAttribute('src') ?? characterDocument.querySelector(`.mw-parser-output > div:nth-child(2) > div:nth-child(${index + 2}) > table > tbody > tr > td > a`)?.getAttribute('href'),
            portraitFilename: "",
            artURL: (characterDocument.querySelector(`.mw-parser-output > div:nth-child(2) > div:nth-child(${index + 2}`)?.querySelector(`.lefttablecard > table:nth-child(1) > tbody > tr > td > center > span > a`)?.getAttribute('href') || characterDocument.querySelector(`.mw-parser-output > div:nth-child(2) > div:nth-child(${index + 2})`)?.querySelector(`.lefttablecard > table:nth-child(1) > tbody > tr > td > center > span > div > img`)?.getAttribute('src')) ?? 'Error',
            artFilename: "",
            finishingMove: finishMoves,
        }
        transformationData.portraitFilename = `portrait_${transformationData.id}`
        transformationData.artFilename = `art_${transformationData.id}`
        transformedArray.push(transformationData)
    }
    return transformedArray
}

const dokkanTypeMap: { [key: string]: string } = {
    "AGL icon": "AGL",
    "TEQ icon": "TEQ",
    "INT icon": "INT",
    "STR icon": "STR",
    "PHY icon": "PHY",
    "SAGL icon": "Super AGL",
    "STEQ icon": "Super TEQ",
    "SINT icon": "Super INT",
    "SSTR icon": "Super STR",
    "SPHY icon": "Super PHY",
    "EAGL icon": "Extreme AGL",
    "ETEQ icon": "Extreme TEQ",
    "EINT icon": "Extreme INT",
    "ESTR icon": "Extreme STR",
    "EPHY icon": "Extreme PHY",
    "Rainbow icon": "Rainbow",
};

function getTextWithType(leaderSkillElement: Element | null, typeMap: { [key: string]: string }): string {
    if (!leaderSkillElement) return 'Error';

    // Clone the element so any modifications won't affect the original.
    const clonedElement = leaderSkillElement.cloneNode(true) as Element;

    // Convert <br> tags to spaces to avoid words getting concatenated when extracting text.
    clonedElement.querySelectorAll('br').forEach(br => {
        const space = clonedElement.ownerDocument!.createTextNode(' ');
        br.parentNode?.replaceChild(space, br);
    });

    // Convert img tags to the corresponding type text using the provided map.
    clonedElement.querySelectorAll('img').forEach(img => {
        const altText = img.getAttribute('alt');
        if (altText && typeMap[altText]) {
            const textNode = clonedElement.ownerDocument!.createTextNode(typeMap[altText]);
            img.parentNode?.replaceChild(textNode, img);
        } else {
            img.remove();
        }
    });

    // Extract the text content.
    return clonedElement.textContent?.trim() || 'Error';
}
