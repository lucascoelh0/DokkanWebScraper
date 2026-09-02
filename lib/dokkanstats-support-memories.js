"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseDokkanStatsSupportMemoryDetail = exports.parseDokkanStatsSupportMemoryCatalog = exports.buildDokkanStatsSupportMemoryDataset = exports.writeDokkanStatsSupportMemoryDataset = exports.getDokkanStatsSupportMemoryDataset = void 0;
const promises_1 = require("fs/promises");
const path_1 = require("path");
const jsdom_1 = require("jsdom");
const format_json_1 = require("./format-json");
const dokkaninfo_special_events_common_1 = require("./dokkaninfo-special-events-common");
const BASE_URL = "https://dokkanstats.com";
const ASSET_BASE_URL = "https://assets.dokkanstats.com/assets/global/en/";
const ENV_PREFIX = "DOKKANSTATS_SUPPORT_MEMORIES";
const CACHE_DIR = "data/dokkanstats-support-memories/cache";
const OUTPUT_PATH = "data/dokkanstats-support-memories/latest/support-memories.json";
async function getDokkanStatsSupportMemoryDataset() {
    const catalog = await getCatalog();
    const entries = [];
    const wait = (0, dokkaninfo_special_events_common_1.requestedDelayMs)(ENV_PREFIX, 500);
    for (const [index, catalogEntry] of [...catalog.values()].entries()) {
        if (index > 0)
            await (0, dokkaninfo_special_events_common_1.delay)(wait);
        entries.push(await getDetail(catalogEntry));
    }
    return buildDokkanStatsSupportMemoryDataset(entries);
}
exports.getDokkanStatsSupportMemoryDataset = getDokkanStatsSupportMemoryDataset;
async function writeDokkanStatsSupportMemoryDataset(dataset) {
    const value = dataset ?? await getDokkanStatsSupportMemoryDataset();
    const outputPath = (0, path_1.resolve)(process.cwd(), OUTPUT_PATH);
    await (0, promises_1.mkdir)((0, path_1.resolve)(outputPath, ".."), { recursive: true });
    await (0, format_json_1.writeFormattedJson)(outputPath, value);
    return { outputPath, dataset: value };
}
exports.writeDokkanStatsSupportMemoryDataset = writeDokkanStatsSupportMemoryDataset;
function buildDokkanStatsSupportMemoryDataset(entries, generatedAt = new Date().toISOString()) {
    assertUnique(entries, value => value.id, "DokkanStats Support Memory");
    const sorted = [...entries].sort((left, right) => compareIds(left.id, right.id));
    for (const entry of sorted) {
        if (entry.levels.length !== entry.maxLevel) {
            throw new Error(`DokkanStats Support Memory ${entry.id} level count does not match maxLevel.`);
        }
        assertUnique(entry.levels, value => value.memoryId, `DokkanStats Support Memory ${entry.id} level`);
        assertUnique(entry.acquisitionSources, value => value.key, `DokkanStats Support Memory ${entry.id} acquisition source`);
    }
    const sources = sorted.flatMap(value => value.acquisitionSources);
    return {
        schemaVersion: 1,
        contract: "dokkanstats-support-memory-enrichment",
        contractVersion: "1.0.0",
        generatedAt,
        source: "dokkanstats.com",
        rootMemoryCount: sorted.length,
        memoryLevelCount: sorted.reduce((sum, value) => sum + value.levels.length, 0),
        acquisitionMemoryCount: sorted.filter(value => value.acquisitionSources.length > 0).length,
        acquisitionSourceCount: sources.length,
        missionSourceCount: sources.filter(value => value.kind === "mission").length,
        stageDropSourceCount: sources.filter(value => value.kind === "stage-drop").length,
        entries: sorted,
    };
}
exports.buildDokkanStatsSupportMemoryDataset = buildDokkanStatsSupportMemoryDataset;
function parseDokkanStatsSupportMemoryCatalog(html) {
    const script = payloadScript(html, "DokkanStats Support Memory catalog");
    const category = extractJsonValue(script, "const category = ", ";\nconst skinCardMap", "Support Memory category");
    if (category !== "support-memories")
        throw new Error(`Unexpected DokkanStats item category: ${category}`);
    const items = extractJsonValue(script, "const items = ", ";\nconst category", "Support Memory items");
    assertUnique(items, value => requiredId(value.id, "DokkanStats Support Memory item ID"), "DokkanStats Support Memory item");
    const roots = items.filter(value => value.is_base === true).map(mapCatalogEntry);
    const allIds = new Set(items.map(value => requiredId(value.id, "DokkanStats Support Memory item ID")));
    const projectedIds = roots.flatMap(value => value.levels.map(level => level.memoryId));
    assertUnique(projectedIds, value => value, "DokkanStats Support Memory projected level");
    if (projectedIds.length !== items.length || projectedIds.some(id => !allIds.has(id))) {
        throw new Error("DokkanStats Support Memory roots and enhanced levels do not cover the catalog exactly.");
    }
    return new Map(roots.sort((left, right) => compareIds(left.id, right.id)).map(value => [value.id, value]));
}
exports.parseDokkanStatsSupportMemoryCatalog = parseDokkanStatsSupportMemoryCatalog;
function parseDokkanStatsSupportMemoryDetail(html, catalogEntry) {
    const script = payloadScript(html, `DokkanStats Support Memory ${catalogEntry.id}`);
    const item = extractJsonValue(script, "const item = ", ";\nconst category", `Support Memory ${catalogEntry.id} item`);
    const category = extractJsonValue(script, "const category = ", ";\nconst sources", `Support Memory ${catalogEntry.id} category`);
    if (category !== "support-memories")
        throw new Error(`Unexpected DokkanStats item category: ${category}`);
    const detailEntry = mapCatalogEntry(item);
    if (JSON.stringify(withoutAcquisition(detailEntry)) !== JSON.stringify(withoutAcquisition(catalogEntry))) {
        throw new Error(`DokkanStats Support Memory ${catalogEntry.id} detail does not match the catalog.`);
    }
    const rawSources = extractJsonValue(script, "const sources = ", ";\nconst usage", `Support Memory ${catalogEntry.id} acquisition sources`);
    if (rawSources !== null && !Array.isArray(rawSources)) {
        throw new Error(`DokkanStats Support Memory ${catalogEntry.id} acquisition sources are invalid.`);
    }
    const acquisitionSources = (rawSources ?? []).map((source, index) => mapAcquisitionSource(source, catalogEntry.id, index));
    assertUnique(acquisitionSources, value => value.key, `DokkanStats Support Memory ${catalogEntry.id} acquisition source`);
    return { ...catalogEntry, acquisitionSources };
}
exports.parseDokkanStatsSupportMemoryDetail = parseDokkanStatsSupportMemoryDetail;
function mapCatalogEntry(item) {
    const id = requiredId(item.id, "DokkanStats Support Memory ID");
    if (item.is_base !== true)
        throw new Error(`DokkanStats Support Memory ${id} is not a root memory.`);
    const rootLevel = {
        level: 1,
        memoryId: id,
        name: requiredText(item.name, `DokkanStats Support Memory ${id} name`),
        description: optionalMultilineText(item.description),
        cost: optionalNonNegativeInt(item.cost, `DokkanStats Support Memory ${id} cost`),
    };
    const enhanced = (item.enhanced_versions ?? []).map(value => ({
        level: requiredPositiveInt(value.level, `DokkanStats Support Memory ${id} enhanced level`),
        memoryId: requiredId(value.id, `DokkanStats Support Memory ${id} enhanced ID`),
        name: requiredText(value.name, `DokkanStats Support Memory ${id} enhanced name`),
        description: optionalMultilineText(value.description),
        cost: optionalNonNegativeInt(value.cost, `DokkanStats Support Memory ${id} enhanced cost`),
    })).sort((left, right) => left.level - right.level);
    const levels = [rootLevel, ...enhanced];
    levels.forEach((value, index) => {
        if (value.level !== index + 1)
            throw new Error(`DokkanStats Support Memory ${id} has a non-contiguous enhancement chain.`);
    });
    return {
        id,
        name: rootLevel.name,
        description: rootLevel.description,
        supportFilmId: optionalId(item.support_film_id, `DokkanStats Support Memory ${id} film ID`),
        cost: rootLevel.cost,
        unlockQuantity: optionalPositiveInt(item.unlock_quantity, `DokkanStats Support Memory ${id} unlock quantity`),
        maxExecCount: optionalPositiveInt(item.max_exec_count, `DokkanStats Support Memory ${id} max execution count`),
        priority: optionalNonNegativeInt(item.priority, `DokkanStats Support Memory ${id} priority`),
        scriptName: optionalText(item.script_name),
        opensAt: optionalText(item.open_at),
        closesAt: optionalText(item.close_at),
        maxLevel: levels.length,
        levels,
        acquisitionSources: [],
        sourceUrl: `${BASE_URL}/en/items/support-memories/${id}/`,
    };
}
function mapAcquisitionSource(source, memoryId, index) {
    if (!source || typeof source !== "object") {
        throw new Error(`DokkanStats Support Memory ${memoryId} acquisition source ${index + 1} is invalid.`);
    }
    if (source.kind === "mission") {
        const missionId = requiredId(source.mission_id, `DokkanStats Support Memory ${memoryId} mission ID`);
        const categoryId = requiredId(source.category_id, `DokkanStats Support Memory ${memoryId} mission category ID`);
        return {
            key: `mission:${missionId}`,
            kind: "mission",
            missionId,
            title: requiredText(source.mission, `DokkanStats Support Memory ${memoryId} mission title`),
            categoryId,
            categoryTitle: optionalText(source.category),
            categoryType: optionalText(source.category_type),
            quantity: requiredPositiveInt(source.quantity, `DokkanStats Support Memory ${memoryId} mission quantity`),
            imageUrl: assetOptionalUrl(source.image),
            areaId: optionalId(source.area_id, `DokkanStats Support Memory ${memoryId} mission area ID`),
            zBattleStageId: optionalId(source.z_battle_stage_id, `DokkanStats Support Memory ${memoryId} mission Z-Battle ID`),
            startsAt: optionalText(source.sort_at),
            endsAt: optionalText(source.end_at),
            sourceUrl: absoluteOptionalUrl(source.url),
        };
    }
    if (source.kind === "stage_drop") {
        const mapId = requiredId(source.smap_id, `DokkanStats Support Memory ${memoryId} stage map ID`);
        return {
            key: `stage-drop:${mapId}:${requiredNonNegativeInt(source.drop_type, `DokkanStats Support Memory ${memoryId} drop type`)}`,
            kind: "stage-drop",
            areaId: requiredId(source.area_id, `DokkanStats Support Memory ${memoryId} stage area ID`),
            areaTitle: requiredText(source.area, `DokkanStats Support Memory ${memoryId} stage area title`),
            questId: requiredId(source.quest_id, `DokkanStats Support Memory ${memoryId} stage quest ID`),
            questTitle: requiredText(source.quest, `DokkanStats Support Memory ${memoryId} stage quest title`),
            difficulty: requiredNonNegativeInt(source.difficulty, `DokkanStats Support Memory ${memoryId} stage difficulty`),
            mapId,
            dropType: requiredNonNegativeInt(source.drop_type, `DokkanStats Support Memory ${memoryId} drop type`),
            route: optionalText(source.route),
            imageUrl: assetOptionalUrl(source.image),
            startsAt: optionalText(source.sort_at),
            endsAt: optionalText(source.end_at),
            sourceUrl: absoluteOptionalUrl(source.url),
        };
    }
    throw new Error(`DokkanStats Support Memory ${memoryId} has unsupported acquisition source kind: ${String(source.kind)}`);
}
async function getCatalog() {
    const path = "catalog.json";
    const cached = await (0, dokkaninfo_special_events_common_1.readSpecialCache)(CACHE_DIR, ENV_PREFIX, path);
    if (cached)
        return new Map(cached.map(value => [value.id, value]));
    const value = parseDokkanStatsSupportMemoryCatalog(await fetchHtml(`${BASE_URL}/en/items/support-memories/`, "Support Memory catalog"));
    await (0, dokkaninfo_special_events_common_1.writeSpecialCache)(CACHE_DIR, path, [...value.values()]);
    return value;
}
async function getDetail(catalogEntry) {
    const path = `details/${catalogEntry.id}.json`;
    const cached = await (0, dokkaninfo_special_events_common_1.readSpecialCache)(CACHE_DIR, ENV_PREFIX, path);
    if (cached) {
        if (JSON.stringify(withoutAcquisition(cached)) !== JSON.stringify(withoutAcquisition(catalogEntry))) {
            throw new Error(`Cached DokkanStats Support Memory ${catalogEntry.id} does not match the catalog.`);
        }
        return cached;
    }
    const value = parseDokkanStatsSupportMemoryDetail(await fetchHtml(catalogEntry.sourceUrl, `Support Memory ${catalogEntry.id}`), catalogEntry);
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
function payloadScript(html, label) {
    const document = new jsdom_1.JSDOM(html).window.document;
    const body = cleanText(document.body?.textContent);
    if (!body || /Sorry, you have been blocked/i.test(body))
        throw new Error(`${label} is unavailable or blocked.`);
    const script = Array.from(document.scripts).map(value => value.textContent ?? "")
        .find(value => value.includes("window.__ITEMS_DATA__") || value.includes("window.__ITEM__"));
    if (!script)
        throw new Error(`${label} payload is missing.`);
    return script;
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
function withoutAcquisition(entry) {
    const { acquisitionSources: _sources, ...identity } = entry;
    return identity;
}
function absoluteOptionalUrl(value) {
    const normalized = optionalText(value);
    return normalized ? new URL(normalized, `${BASE_URL}/`).toString() : undefined;
}
function assetOptionalUrl(value) {
    const normalized = optionalText(value);
    return normalized ? new URL(normalized, ASSET_BASE_URL).toString() : undefined;
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
function optionalMultilineText(value) {
    const normalized = String(value ?? "").replace(/\r\n/g, "\n").replace(/[ \t]+\n/g, "\n").trim();
    return normalized || undefined;
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
function optionalId(value, label) {
    if (value === null || value === undefined || cleanText(value) === "")
        return undefined;
    return requiredId(value, label);
}
function requiredPositiveInt(value, label) {
    const parsed = Number(cleanText(value).replace(/,/g, ""));
    if (!Number.isInteger(parsed) || parsed <= 0)
        throw new Error(`${label} is missing or invalid.`);
    return parsed;
}
function optionalPositiveInt(value, label) {
    if (value === null || value === undefined || cleanText(value) === "")
        return undefined;
    return requiredPositiveInt(value, label);
}
function requiredNonNegativeInt(value, label) {
    const parsed = Number(cleanText(value).replace(/,/g, ""));
    if (!Number.isInteger(parsed) || parsed < 0)
        throw new Error(`${label} is missing or invalid.`);
    return parsed;
}
function optionalNonNegativeInt(value, label) {
    if (value === null || value === undefined || cleanText(value) === "")
        return undefined;
    return requiredNonNegativeInt(value, label);
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
//# sourceMappingURL=dokkanstats-support-memories.js.map