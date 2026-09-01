"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildPettanBattleDataset = exports.mapPettanBattleSeries = exports.mapPettanBattleIndex = exports.writePettanBattleCatalog = exports.getPettanBattleCatalog = void 0;
const crypto_1 = require("crypto");
const fs_1 = require("fs");
const promises_1 = require("fs/promises");
const path_1 = require("path");
const events_sqlite_adapter_1 = require("./database-events/events-sqlite-adapter");
const format_json_1 = require("./format-json");
const scraper_1 = require("./scraper");
const DOKKAN_INFO_BASE_URL = "https://dokkaninfo.com";
const INDEX_URL = `${DOKKAN_INFO_BASE_URL}/events/sdbattle`;
const DEFAULT_DATABASE = "D:/Dokkan/database/decrypted/dokkan-global-current.db";
const CACHE_DIR = "data/pettan-battle/cache";
const OUTPUT_DIR = "data/pettan-battle/latest";
const OUTPUT_FILE = "pettan-battle.json";
const CACHE_SCHEMA_VERSION = "2.0.0";
const DEFAULT_CACHE_TTL_HOURS = 168;
const DEFAULT_CONCURRENCY = 3;
const DEFAULT_DELAY_MS = 150;
async function getPettanBattleCatalog(options = {}) {
    const databasePath = (0, path_1.resolve)(options.databasePath ?? process.env.PETTAN_BATTLE_DATABASE ?? DEFAULT_DATABASE);
    const before = await fingerprint(databasePath);
    const official = await (0, events_sqlite_adapter_1.runEventsSqliteBridge)("pettan", databasePath);
    const summaries = await fetchPettanIndex();
    let completed = 0;
    const visualSeries = await mapWithConcurrency(summaries, requestedConcurrency(), async (summary) => {
        await delay(requestedDelayMs());
        const stickers = await fetchPettanSeries(summary);
        completed += 1;
        console.log(`[PETTAN-BATTLE] Series ${completed}/${summaries.length}: ${summary.id} (${stickers.length} stickers)`);
        return { summary, stickers };
    });
    const after = await fingerprint(databasePath);
    if (before.sha256 !== after.sha256 || before.sizeBytes !== after.sizeBytes) {
        throw new Error("Pettan Battle source database changed during collection.");
    }
    return buildPettanBattleDataset(official.stickers, visualSeries, {
        fileName: (0, path_1.basename)(databasePath),
        ...before,
    });
}
exports.getPettanBattleCatalog = getPettanBattleCatalog;
async function writePettanBattleCatalog(dataset) {
    const outputDirectory = (0, path_1.resolve)(__dirname, OUTPUT_DIR);
    const outputPath = (0, path_1.resolve)(outputDirectory, OUTPUT_FILE);
    await (0, promises_1.mkdir)(outputDirectory, { recursive: true });
    await (0, format_json_1.writeFormattedJson)(outputPath, dataset ?? await getPettanBattleCatalog());
    return outputPath;
}
exports.writePettanBattleCatalog = writePettanBattleCatalog;
function mapPettanBattleIndex(document) {
    assertUsablePage(document);
    const summaries = Array.from(document.querySelectorAll('a[href*="/events/sdbattle/"]'))
        .map((anchor) => {
        const sourcePath = absoluteUrl(anchor.getAttribute("href"));
        const id = sourcePath.match(/\/events\/sdbattle\/(\d+)$/)?.[1];
        if (!id)
            return undefined;
        const name = cleanText(anchor.querySelector(".sd-series-text")?.textContent) || `Series ${id}`;
        const advertisedStickerCount = requiredNumber(anchor.querySelector(".sd-total")?.textContent, `Pettan series ${id} sticker count`);
        return {
            id,
            name,
            sourcePath,
            binderImagePath: absoluteOptionalUrl(anchor.querySelector(".sd-binder img")?.getAttribute("src")),
            advertisedStickerCount,
        };
    })
        .filter((summary) => Boolean(summary));
    const unique = [...new Map(summaries.map(summary => [summary.id, summary])).values()]
        .sort((left, right) => Number(left.id) - Number(right.id));
    if (!unique.length)
        throw new Error("DokkanInfo Pettan Battle index exposed no series.");
    return unique;
}
exports.mapPettanBattleIndex = mapPettanBattleIndex;
function mapPettanBattleSeries(document, summary) {
    assertUsablePage(document);
    const stickers = Array.from(document.querySelectorAll(".col-lg"))
        .filter(container => Boolean(container.querySelector(".sd-number") && container.querySelector(".flip-card")))
        .map(container => mapPettanSticker(container, summary));
    const unique = [...new Map(stickers.map(sticker => [sticker.cardId, sticker])).values()]
        .sort((left, right) => left.number - right.number || compareIds(left.cardId, right.cardId));
    if (unique.length !== summary.advertisedStickerCount) {
        throw new Error(`DokkanInfo Pettan series ${summary.id} advertised ${summary.advertisedStickerCount} stickers but exposed ${unique.length}.`);
    }
    return unique;
}
exports.mapPettanBattleSeries = mapPettanBattleSeries;
function buildPettanBattleDataset(officialRows, visualSeries, sourceDatabase) {
    const official = officialRows.map(normalizeOfficialSticker)
        .sort((left, right) => left.series - right.series || left.number - right.number || compareIds(left.id, right.id));
    const visuals = visualSeries.flatMap(value => value.stickers);
    const officialById = new Map(official.map(sticker => [sticker.id, sticker]));
    const visualById = new Map(visuals.map(sticker => [sticker.cardId, sticker]));
    const mismatches = [];
    const observedPrintedTypeLabels = new Set();
    const stickers = official.map(sticker => {
        const visual = visualById.get(sticker.cardId);
        if (!visual)
            return sticker;
        compareField(mismatches, sticker.id, "series", sticker.series, visual.series);
        compareField(mismatches, sticker.id, "number", sticker.number, visual.number);
        compareField(mismatches, sticker.id, "attack/displayedPower", sticker.attack, visual.displayedPower);
        compareField(mismatches, sticker.id, "rarityRaw", sticker.rarityRaw, visual.rarityFrameRaw);
        compareField(mismatches, sticker.id, "description", normalizedText(sticker.description), normalizedText(visual.description));
        compareField(mismatches, sticker.id, "availableDate", sticker.availableAt.slice(0, 10), normalizeVisualDate(visual.availableDate));
        compareField(mismatches, sticker.id, "cardName", normalizedText(sticker.cardName), normalizedText(visual.cardName));
        compareField(mismatches, sticker.id, "leaderSkillName", normalizedText(sticker.leaderSkillName), normalizedText(visual.leaderSkillName));
        observedPrintedTypeLabels.add(`${sticker.elementRaw}\u0000${sticker.cardElementRaw}\u0000${visual.printedTypeLabel}`);
        return {
            ...sticker,
            visualSourcePath: visual.sourcePath,
            visual: {
                displayedPower: visual.displayedPower,
                printedTypeLabel: visual.printedTypeLabel,
                rarityFrameRaw: visual.rarityFrameRaw,
                front: visual.front,
                back: visual.back,
            },
        };
    });
    const officialOnlyStickerIds = official.filter(sticker => !visualById.has(sticker.id)).map(sticker => sticker.id);
    const visualOnlyStickerIds = visuals.filter(sticker => !officialById.has(sticker.cardId)).map(sticker => sticker.cardId).sort(compareIds);
    const summariesById = new Map(visualSeries.map(value => [value.summary.id, value.summary]));
    const grouped = new Map();
    for (const sticker of stickers)
        grouped.set(sticker.series, [...(grouped.get(sticker.series) ?? []), sticker]);
    const series = [...grouped.entries()]
        .sort(([left], [right]) => left - right)
        .map(([id, values]) => {
        const summary = summariesById.get(String(id));
        if (summary)
            compareField(mismatches, `series:${id}`, "advertisedStickerCount", values.length, summary.advertisedStickerCount);
        return {
            id: String(id),
            name: summary?.name ?? `Series ${id}`,
            sourcePath: summary?.sourcePath ?? `${INDEX_URL}/${id}`,
            binderImagePath: summary?.binderImagePath,
            stickerCount: values.length,
            stickers: values,
        };
    });
    return {
        schemaVersion: "1.0.0",
        generatedAt: new Date().toISOString(),
        sources: {
            catalog: "game-db",
            visuals: "dokkaninfo",
            visualIndexPath: INDEX_URL,
        },
        sourceDatabase: { ...sourceDatabase, readOnly: true },
        seriesCount: series.length,
        stickerCount: official.length,
        visualStickerCount: visuals.length,
        joinedStickerCount: official.length - officialOnlyStickerIds.length,
        audit: {
            officialOnlyStickerIds,
            visualOnlyStickerIds,
            mismatchCount: mismatches.length,
            mismatches,
            observedPrintedTypeLabels: [...observedPrintedTypeLabels]
                .map(value => {
                const [elementRaw, cardElementRaw, printedTypeLabel] = value.split("\u0000");
                return { elementRaw: Number(elementRaw), cardElementRaw: Number(cardElementRaw), printedTypeLabel };
            })
                .sort((left, right) => left.elementRaw - right.elementRaw
                || left.cardElementRaw - right.cardElementRaw
                || left.printedTypeLabel.localeCompare(right.printedTypeLabel)),
        },
        series,
    };
}
exports.buildPettanBattleDataset = buildPettanBattleDataset;
function mapPettanSticker(container, summary) {
    const imagePaths = Array.from(container.querySelectorAll("img"))
        .map(image => absoluteOptionalUrl(image.getAttribute("src")))
        .filter((path) => Boolean(path));
    const cardId = imagePaths.map(path => path.match(/\/sd_card\/(\d+)\//)?.[1]).find(Boolean);
    if (!cardId)
        throw new Error(`DokkanInfo Pettan series ${summary.id} exposed a sticker without card identity.`);
    const path = (pattern, label) => {
        const value = imagePaths.find(candidate => pattern.test(candidate));
        if (!value)
            throw new Error(`DokkanInfo Pettan sticker ${cardId} omitted ${label}.`);
        return value;
    };
    const optionalPath = (pattern) => imagePaths.find(candidate => pattern.test(candidate));
    const rarityFramePath = path(/\/sd_card_frame\/sd_card_frame_rarity_\d+\.png$/, "rarity frame");
    const rarityFrameRaw = requiredNumber(rarityFramePath.match(/rarity_(\d+)\.png$/)?.[1], `Pettan sticker ${cardId} rarity`);
    return {
        cardId,
        series: requiredNumber(container.querySelector(".sd-series")?.textContent, `Pettan sticker ${cardId} series`),
        number: requiredNumber(container.querySelector(".sd-number")?.textContent, `Pettan sticker ${cardId} number`),
        displayedPower: requiredNumber(container.querySelector(".icon-power-front")?.textContent, `Pettan sticker ${cardId} power`),
        printedTypeLabel: requiredText(container.querySelector(".icon-type-back")?.textContent, `Pettan sticker ${cardId} printed type label`),
        description: requiredText(container.querySelector(".icon-character-details")?.textContent, `Pettan sticker ${cardId} description`),
        availableDate: requiredText(container.querySelector(".icon-open-date")?.textContent, `Pettan sticker ${cardId} date`),
        cardName: requiredText(container.querySelector(".sd-card-name")?.textContent, `Pettan sticker ${cardId} card name`),
        leaderSkillName: requiredText(container.querySelector(".sd-leader-skill-name")?.textContent, `Pettan sticker ${cardId} leader name`),
        rarityFrameRaw,
        sourcePath: summary.sourcePath,
        front: {
            backgroundPath: path(new RegExp(`/sd_card/${cardId}/sd_card_${cardId}_bg\\.png$`), "front background"),
            characterPath: path(new RegExp(`/sd_card/${cardId}/sd_card_${cardId}\\.png$`), "front character"),
            effectPath: optionalPath(new RegExp(`/sd_card/${cardId}/sd_card_${cardId}_effect\\.png$`)),
            typeFramePath: path(/\/sd_card_frame\/sd_card_frame_type_\d+\.png$/, "type frame"),
            rarityFramePath,
        },
        back: {
            backgroundPath: path(/\/sd_battle\/sdb_seal_back_bg\.png$/, "back background"),
            facePath: path(new RegExp(`/sd_card/${cardId}/sd_card_${cardId}_face\\.png$`), "back face"),
            framePath: path(/\/sd_battle\/sdb_seal_back_face_frame\.png$/, "back frame"),
        },
    };
}
function normalizeOfficialSticker(row) {
    return {
        id: String(row.id),
        cardId: String(row.card_id),
        series: Number(row.series),
        number: Number(row.number),
        attack: Number(row.attack),
        hp: Number(row.hp),
        elementRaw: Number(row.element),
        cardElementRaw: Number(row.card_element),
        rarityRaw: Number(row.rarity),
        description: normalizedText(row.description),
        availableAt: normalizeOfficialDate(row.open_at),
        cardName: normalizedText(row.card_name),
        leaderSkillName: optionalText(row.leader_skill_name),
    };
}
async function fetchPettanIndex() {
    const cached = await readCache("index.json");
    if (cached)
        return cached;
    const value = mapPettanBattleIndex(await (0, scraper_1.fetchFromWeb)(INDEX_URL));
    await writeCache("index.json", value);
    return value;
}
async function fetchPettanSeries(summary) {
    const cached = await readCache(`series/${summary.id}.json`);
    if (cached)
        return cached;
    const value = mapPettanBattleSeries(await (0, scraper_1.fetchFromWeb)(summary.sourcePath), summary);
    await writeCache(`series/${summary.id}.json`, value);
    return value;
}
async function readCache(relativePath) {
    if (refreshRequested())
        return undefined;
    try {
        const value = JSON.parse(await (0, promises_1.readFile)((0, path_1.resolve)(__dirname, CACHE_DIR, relativePath), "utf8"));
        const ageMs = Date.now() - Date.parse(value.fetchedAt);
        if (value.schemaVersion !== CACHE_SCHEMA_VERSION || !Number.isFinite(ageMs) || ageMs > cacheTtlHours() * 3600000)
            return undefined;
        return value.value;
    }
    catch (error) {
        if (error.code === "ENOENT")
            return undefined;
        throw error;
    }
}
async function writeCache(relativePath, value) {
    const path = (0, path_1.resolve)(__dirname, CACHE_DIR, relativePath);
    await (0, promises_1.mkdir)((0, path_1.resolve)(path, ".."), { recursive: true });
    const temporary = `${path}.${process.pid}.${Date.now()}.tmp`;
    await (0, promises_1.writeFile)(temporary, JSON.stringify({ schemaVersion: CACHE_SCHEMA_VERSION, fetchedAt: new Date().toISOString(), value }));
    await (0, promises_1.rename)(temporary, path);
}
async function fingerprint(path) {
    const metadata = await (0, promises_1.stat)(path);
    const hash = (0, crypto_1.createHash)("sha256");
    await new Promise((done, reject) => {
        const stream = (0, fs_1.createReadStream)(path);
        stream.on("data", chunk => hash.update(chunk));
        stream.on("error", reject);
        stream.on("end", done);
    });
    return { sha256: hash.digest("hex"), sizeBytes: metadata.size };
}
async function mapWithConcurrency(values, concurrency, mapper) {
    const results = new Array(values.length);
    let next = 0;
    async function worker() {
        while (next < values.length) {
            const index = next++;
            results[index] = await mapper(values[index]);
        }
    }
    await Promise.all(Array.from({ length: Math.min(concurrency, values.length) }, worker));
    return results;
}
function compareField(mismatches, stickerId, field, official, visual) {
    const left = official ?? "";
    const right = visual ?? "";
    if (left !== right)
        mismatches.push({ stickerId, field, official: left, visual: right });
}
function normalizeOfficialDate(value) {
    const parsed = new Date(`${value.replace(" ", "T")}Z`);
    if (!Number.isFinite(parsed.getTime()))
        throw new Error(`Invalid Pettan Battle official date: ${value}`);
    return parsed.toISOString();
}
function normalizeVisualDate(value) {
    const match = value.match(/(\d{4})\/(\d{2})\/(\d{2})/);
    if (!match)
        return value;
    return `${match[1]}-${match[2]}-${match[3]}`;
}
function normalizedText(value) {
    return cleanText(value);
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
function requiredNumber(value, label) {
    const match = cleanText(value).match(/[\d,]+/);
    if (!match)
        throw new Error(`${label} is missing.`);
    const parsed = Number(match[0].replace(/,/g, ""));
    if (!Number.isFinite(parsed))
        throw new Error(`${label} is invalid.`);
    return parsed;
}
function cleanText(value) {
    return String(value ?? "").replace(/\s+/g, " ").trim();
}
function absoluteUrl(value) {
    return absoluteOptionalUrl(value) ?? INDEX_URL;
}
function absoluteOptionalUrl(value) {
    if (!value)
        return undefined;
    const url = new URL(value, DOKKAN_INFO_BASE_URL);
    url.pathname = url.pathname.replace(/\/{2,}/g, "/");
    return url.toString();
}
function assertUsablePage(document) {
    const text = cleanText(document.body?.textContent);
    if (/Sorry, you have been blocked/i.test(text))
        throw new Error("DokkanInfo blocked the Pettan Battle request.");
    if (/General server error/i.test(text))
        throw new Error("DokkanInfo returned a Pettan Battle server error page.");
}
function refreshRequested() {
    return /^(?:1|true|yes)$/i.test(process.env.PETTAN_BATTLE_REFRESH ?? "");
}
function requestedConcurrency() {
    return positiveInteger(process.env.PETTAN_BATTLE_CONCURRENCY, DEFAULT_CONCURRENCY);
}
function requestedDelayMs() {
    return nonNegativeNumber(process.env.PETTAN_BATTLE_DELAY_MS, DEFAULT_DELAY_MS);
}
function cacheTtlHours() {
    return nonNegativeNumber(process.env.PETTAN_BATTLE_CACHE_TTL_HOURS, DEFAULT_CACHE_TTL_HOURS);
}
function positiveInteger(value, fallback) {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}
function nonNegativeNumber(value, fallback) {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}
function compareIds(left, right) {
    return left.localeCompare(right, "en", { numeric: true });
}
function delay(milliseconds) {
    return milliseconds > 0 ? new Promise(resolveDelay => setTimeout(resolveDelay, milliseconds)) : Promise.resolve();
}
//# sourceMappingURL=pettan-battle-catalog.js.map