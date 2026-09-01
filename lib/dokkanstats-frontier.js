"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.frontierMissionCategoryIds = exports.parseDokkanStatsMissionCategory = exports.parseDokkanStatsCardSkins = exports.buildDokkanStatsFrontierDataset = exports.writeDokkanStatsFrontierDataset = exports.getDokkanStatsFrontierDataset = void 0;
const promises_1 = require("fs/promises");
const path_1 = require("path");
const jsdom_1 = require("jsdom");
const format_json_1 = require("./format-json");
const dokkaninfo_special_events_common_1 = require("./dokkaninfo-special-events-common");
const BASE_URL = "https://dokkanstats.com";
const ENV_PREFIX = "DOKKANSTATS_FRONTIER";
const CACHE_DIR = "data/dokkanstats-frontier/cache";
const OUTPUT_PATH = "data/dokkanstats-frontier/latest/frontier.json";
async function getDokkanStatsFrontierDataset(chapters) {
    const input = chapters ?? await readFrontierChapters();
    const categoryIds = frontierMissionCategoryIds(input);
    const cardSkins = await getCardSkins();
    const missionCategories = [];
    const wait = (0, dokkaninfo_special_events_common_1.requestedDelayMs)(ENV_PREFIX, 500);
    for (const [index, categoryId] of categoryIds.entries()) {
        if (index > 0)
            await (0, dokkaninfo_special_events_common_1.delay)(wait);
        missionCategories.push(await getMissionCategory(categoryId));
    }
    return buildDokkanStatsFrontierDataset(cardSkins, missionCategories);
}
exports.getDokkanStatsFrontierDataset = getDokkanStatsFrontierDataset;
async function writeDokkanStatsFrontierDataset(dataset) {
    const value = dataset ?? await getDokkanStatsFrontierDataset();
    const outputPath = (0, path_1.resolve)(process.cwd(), OUTPUT_PATH);
    await (0, promises_1.mkdir)((0, path_1.resolve)(outputPath, ".."), { recursive: true });
    await (0, format_json_1.writeFormattedJson)(outputPath, value);
    return { outputPath, dataset: value };
}
exports.writeDokkanStatsFrontierDataset = writeDokkanStatsFrontierDataset;
function buildDokkanStatsFrontierDataset(cardSkins, missionCategories, generatedAt = new Date().toISOString()) {
    assertUnique(cardSkins, value => value.id, "DokkanStats card skin");
    assertUnique(missionCategories, value => value.categoryId, "DokkanStats mission category");
    return {
        schemaVersion: 1,
        contract: "dokkanstats-frontier-enrichment",
        contractVersion: "1.0.0",
        generatedAt,
        source: "dokkanstats.com",
        cardSkinCount: cardSkins.length,
        missionCategoryCount: missionCategories.length,
        missionCount: missionCategories.reduce((sum, value) => sum + value.missionCount, 0),
        cardSkins: [...cardSkins].sort((left, right) => compareIds(left.id, right.id)),
        missionCategories: [...missionCategories].sort((left, right) => compareIds(left.categoryId, right.categoryId)),
    };
}
exports.buildDokkanStatsFrontierDataset = buildDokkanStatsFrontierDataset;
function parseDokkanStatsCardSkins(html) {
    const document = documentFromHtml(html, "DokkanStats card skins");
    const script = Array.from(document.scripts)
        .map(value => value.textContent ?? "")
        .find(value => value.includes("window.__ITEMS_DATA__"));
    if (!script)
        throw new Error("DokkanStats card skins payload is missing.");
    const category = extractJsonValue(script, "const category = ", ";\nconst skinCardMap", "card skin category");
    if (category !== "card-skins")
        throw new Error(`Unexpected DokkanStats item category: ${category}`);
    const items = extractJsonValue(script, "const items = ", ";\nconst category", "card skin items");
    const skinCards = extractJsonValue(script, "const skinCardMap = ", ";\nconst equipCardMap", "card skin character map");
    const mapped = items.map(item => {
        const cardId = requiredId(item.card_id, `DokkanStats card skin ${item.id} card ID`);
        const card = skinCards[cardId];
        if (!card)
            throw new Error(`DokkanStats card skin ${item.id} has no English card mapping for ${cardId}.`);
        const characterName = requiredText(card[4], `DokkanStats card skin ${item.id} character name`);
        const cardTitle = requiredText(card[5], `DokkanStats card skin ${item.id} card title`);
        return {
            id: requiredId(item.id, "DokkanStats card skin ID"),
            cardId,
            step: requiredPositiveInt(item.step, `DokkanStats card skin ${item.id} step`),
            rawName: optionalText(item.name),
            displayName: `${cardTitle} ${characterName}`,
            cardTitle,
            characterName,
            type: optionalText(card[1]),
            characterClass: optionalText(card[2]),
            rarity: optionalText(card[3]),
            description: optionalText(item.description),
            linkTo: optionalText(item.link_to),
            bgmId: item.bgm_id === null || item.bgm_id === undefined ? undefined : requiredId(item.bgm_id, `DokkanStats card skin ${item.id} BGM ID`),
            sourceUrl: `${BASE_URL}/en/items/card-skins/${item.id}/`,
        };
    });
    assertUnique(mapped, value => value.id, "DokkanStats card skin");
    return mapped.sort((left, right) => compareIds(left.id, right.id));
}
exports.parseDokkanStatsCardSkins = parseDokkanStatsCardSkins;
function parseDokkanStatsMissionCategory(html, categoryId) {
    requiredId(categoryId, "DokkanStats mission category ID");
    const document = documentFromHtml(html, `DokkanStats mission category ${categoryId}`);
    const countText = cleanText(document.querySelector(".detail-count")?.textContent)
        || cleanText(document.body?.textContent);
    const advertisedCount = Number(countText.match(/\b(\d+)\s+missions\b/i)?.[1]);
    if (!Number.isInteger(advertisedCount))
        throw new Error(`DokkanStats mission category ${categoryId} count is missing.`);
    const missions = Array.from(document.querySelectorAll(".mission-card-square")).map((card, index) => ({
        sequence: index + 1,
        name: requiredText(card.querySelector(".mission-name")?.textContent, `DokkanStats mission ${categoryId}/${index + 1} name`),
        description: requiredText(card.querySelector(".mission-desc-short")?.textContent, `DokkanStats mission ${categoryId}/${index + 1} description`),
        rewards: Array.from(card.querySelectorAll(".reward-icon-wrapper .drop-icon-wrapper")).map((reward, rewardIndex) => {
            const title = optionalText(reward.getAttribute("title"));
            const titleParts = title?.match(/^(.*?)\s+ID:\s*(\d+)$/i);
            const image = reward.querySelector("img");
            const amount = optionalText(reward.querySelector(".drop-amount")?.textContent);
            return {
                label: optionalText(titleParts?.[1]) ?? optionalText(image?.getAttribute("alt")) ?? `Reward ${rewardIndex + 1}`,
                itemId: titleParts?.[2],
                quantity: amount
                    ? requiredPositiveInt(amount.replace(/^x/i, ""), `DokkanStats mission ${categoryId}/${index + 1} reward ${rewardIndex + 1} quantity`)
                    : 1,
                imageUrl: absoluteOptionalUrl(image?.getAttribute("src")),
            };
        }),
        startsAt: missionDate(card, false),
        endsAt: missionDate(card, true),
    }));
    if (missions.length !== advertisedCount) {
        throw new Error(`DokkanStats mission category ${categoryId} advertised ${advertisedCount} missions but exposed ${missions.length}.`);
    }
    return {
        categoryId,
        sourceUrl: `${BASE_URL}/en/missions/${categoryId}/`,
        advertisedCount,
        missionCount: missions.length,
        missions,
    };
}
exports.parseDokkanStatsMissionCategory = parseDokkanStatsMissionCategory;
function frontierMissionCategoryIds(dataset) {
    const missions = [
        ...dataset.chapters.flatMap(value => value.chapterMissions),
        ...dataset.chapters.flatMap(value => value.pages).flatMap(value => value.nodes).flatMap(value => value.missions),
    ];
    const ids = missions.map(value => value.categoryId).filter((value) => Boolean(value));
    ids.forEach(value => requiredId(value, "Frontier mission category ID"));
    return [...new Set(ids)].sort(compareIds);
}
exports.frontierMissionCategoryIds = frontierMissionCategoryIds;
async function getCardSkins() {
    const path = "card-skins.json";
    const cached = await (0, dokkaninfo_special_events_common_1.readSpecialCache)(CACHE_DIR, ENV_PREFIX, path);
    if (cached)
        return cached;
    const value = parseDokkanStatsCardSkins(await fetchHtml(`${BASE_URL}/en/items/card-skins/`, "card skins"));
    await (0, dokkaninfo_special_events_common_1.writeSpecialCache)(CACHE_DIR, path, value);
    return value;
}
async function getMissionCategory(categoryId) {
    const path = `missions/${categoryId}.json`;
    const cached = await (0, dokkaninfo_special_events_common_1.readSpecialCache)(CACHE_DIR, ENV_PREFIX, path);
    if (cached)
        return cached;
    const value = parseDokkanStatsMissionCategory(await fetchHtml(`${BASE_URL}/en/missions/${categoryId}/`, `mission category ${categoryId}`), categoryId);
    await (0, dokkaninfo_special_events_common_1.writeSpecialCache)(CACHE_DIR, path, value);
    return value;
}
async function fetchHtml(url, label) {
    const response = await fetch(url, { headers: browserHeaders(), redirect: "error" });
    if (!response.ok)
        throw new Error(`Could not fetch DokkanStats ${label}: ${response.status}`);
    const html = await response.text();
    if (html.length < 1000)
        throw new Error(`DokkanStats ${label} returned an unexpectedly small page.`);
    return html;
}
async function readFrontierChapters() {
    return JSON.parse(await (0, promises_1.readFile)((0, path_1.resolve)(process.cwd(), "data/dokkan-frontier/latest/dokkan-frontier-chapters.json"), "utf8"));
}
function documentFromHtml(html, label) {
    const document = new jsdom_1.JSDOM(html).window.document;
    const body = cleanText(document.body?.textContent);
    if (!body || /Sorry, you have been blocked/i.test(body))
        throw new Error(`${label} is unavailable or blocked.`);
    return document;
}
function extractJsonValue(script, prefix, suffix, label) {
    const start = script.indexOf(prefix);
    if (start < 0)
        throw new Error(`DokkanStats ${label} prefix is missing.`);
    const valueStart = start + prefix.length;
    const end = script.indexOf(suffix, valueStart);
    if (end < 0)
        throw new Error(`DokkanStats ${label} suffix is missing.`);
    try {
        return JSON.parse(script.slice(valueStart, end));
    }
    catch {
        throw new Error(`DokkanStats ${label} is invalid JSON.`);
    }
}
function missionDate(card, end) {
    const item = Array.from(card.querySelectorAll(".mission-dates .date-item"))
        .find(value => value.classList.contains("date-item-end") === end);
    if (!item || /No Expiry/i.test(cleanText(item.textContent)))
        return undefined;
    const value = item.querySelector(".date-value");
    if (!value)
        return undefined;
    const date = cleanText(Array.from(value.childNodes).find(node => node.nodeType === 3)?.textContent);
    const time = cleanText(value.querySelector(".date-time")?.textContent);
    return [date, time].filter(Boolean).join(" ") || undefined;
}
function absoluteOptionalUrl(value) {
    const normalized = optionalText(value);
    return normalized ? new URL(normalized, BASE_URL).toString() : undefined;
}
function browserHeaders() {
    return {
        "User-Agent": "DokkanpanionDataPipeline/1.0 (+authorized DokkanStats enrichment)",
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9",
    };
}
function cleanText(value) {
    return String(value ?? "").replace(/\s+/g, " ").trim();
}
function optionalText(value) {
    return cleanText(value) || undefined;
}
function requiredText(value, label) {
    const normalized = cleanText(value);
    if (!normalized)
        throw new Error(`${label} is missing.`);
    return normalized;
}
function requiredId(value, label) {
    const normalized = cleanText(value);
    if (!/^\d+$/.test(normalized))
        throw new Error(`${label} is missing or invalid.`);
    return normalized;
}
function requiredPositiveInt(value, label) {
    const parsed = Number(cleanText(value).replace(/,/g, ""));
    if (!Number.isInteger(parsed) || parsed <= 0)
        throw new Error(`${label} is missing or invalid.`);
    return parsed;
}
function compareIds(left, right) {
    return left.localeCompare(right, "en", { numeric: true });
}
function assertUnique(values, key, label) {
    const seen = new Set();
    values.forEach(value => {
        const id = key(value);
        if (seen.has(id))
            throw new Error(`${label} ${id} is duplicated.`);
        seen.add(id);
    });
}
//# sourceMappingURL=dokkanstats-frontier.js.map