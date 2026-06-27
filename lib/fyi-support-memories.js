"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.supportMemoryEffectsFromFyi = exports.enhancementChainFromFyi = exports.supportFilmFromFyi = exports.mapSupportMemoryFromFyi = exports.buildSupportMemoryDataset = exports.writeDokkanFyiSupportMemories = exports.getDokkanFyiSupportMemories = void 0;
const promises_1 = require("fs/promises");
const path_1 = require("path");
const format_json_1 = require("./format-json");
const DOKKAN_FYI_BASE_URL = "https://dokkan.fyi";
async function getDokkanFyiSupportMemories() {
    const payload = await fetchSupportMemoriesPayload();
    const supportMemories = payload.props.supportMemories
        .map(mapSupportMemoryFromFyi)
        .sort((left, right) => left.name.localeCompare(right.name) || left.id.localeCompare(right.id));
    return buildSupportMemoryDataset(supportMemories);
}
exports.getDokkanFyiSupportMemories = getDokkanFyiSupportMemories;
async function writeDokkanFyiSupportMemories() {
    const dataset = await getDokkanFyiSupportMemories();
    const outputDir = (0, path_1.resolve)(__dirname, "data/support-memories/latest");
    const outputPath = (0, path_1.resolve)(outputDir, "support-memories.json");
    await (0, promises_1.mkdir)(outputDir, { recursive: true });
    await (0, format_json_1.writeFormattedJson)(outputPath, dataset);
    return outputPath;
}
exports.writeDokkanFyiSupportMemories = writeDokkanFyiSupportMemories;
function buildSupportMemoryDataset(supportMemories) {
    const filmsById = new Map();
    for (const supportMemory of supportMemories) {
        if (!supportMemory.film?.id) {
            continue;
        }
        filmsById.set(supportMemory.film.id, supportMemory.film);
    }
    return {
        generatedAt: new Date().toISOString(),
        source: "dokkan.fyi",
        count: supportMemories.length,
        films: Array.from(filmsById.values()).sort((left, right) => left.name.localeCompare(right.name) || left.id.localeCompare(right.id)),
        supportMemories,
    };
}
exports.buildSupportMemoryDataset = buildSupportMemoryDataset;
function mapSupportMemoryFromFyi(memory) {
    const film = supportFilmFromFyi(memory.support_film);
    const enhancementChain = enhancementChainFromFyi(memory.root_enhancement_levels);
    const effects = supportMemoryEffectsFromFyi(memory.support_memory_skills ?? memory.effects);
    return {
        id: memory.id.toString(),
        name: cleanInlineText(memory.name),
        description: cleanMultilineText(memory.description),
        filmId: memory.support_film_id?.toString(),
        film,
        cost: toOptionalNumber(memory.cost),
        unlockQuantity: toOptionalNumber(memory.unlock_quantity),
        lastsEntireBattle: Boolean(memory.lasts_entire_battle),
        releaseDate: releaseDate(memory.released_at),
        maxLevel: maxSupportMemoryLevel(enhancementChain),
        enhancementChain,
        effects,
    };
}
exports.mapSupportMemoryFromFyi = mapSupportMemoryFromFyi;
function supportFilmFromFyi(film) {
    if (!film?.id) {
        return undefined;
    }
    return {
        id: film.id.toString(),
        name: cleanInlineText(film.name),
        description: cleanMultilineText(film.description),
    };
}
exports.supportFilmFromFyi = supportFilmFromFyi;
function enhancementChainFromFyi(levels) {
    return (levels ?? [])
        .map(level => ({
        id: level.id?.toString(),
        level: toNumber(level.level),
        supportMemoryId: toNumber(level.support_memory_id).toString(),
        enhancedSupportMemoryId: toNumber(level.enhanced_support_memory_id).toString(),
        rootSupportMemoryId: toNumber(level.root_support_memory_id).toString(),
    }))
        .filter(step => step.level > 0 && step.supportMemoryId !== "0" && step.enhancedSupportMemoryId !== "0");
}
exports.enhancementChainFromFyi = enhancementChainFromFyi;
function supportMemoryEffectsFromFyi(effects) {
    return (effects ?? []).map(effect => ({
        id: effect.id?.toString(),
        effectType: toOptionalNumber(effect.type),
        values: (effect.values ?? [])
            .map(value => toOptionalNumber(value))
            .filter((value) => value !== undefined),
        target: toOptionalNumber(effect.target),
        calculation: toOptionalNumber(effect.calculation),
        turns: toOptionalNumber(effect.turns),
        chance: toOptionalNumber(effect.chance),
        transformationDescription: cleanMultilineText(effect.transformation?.description),
        scriptName: cleanInlineText(effect.script_name),
    }));
}
exports.supportMemoryEffectsFromFyi = supportMemoryEffectsFromFyi;
async function fetchSupportMemoriesPayload() {
    const response = await fetch(`${DOKKAN_FYI_BASE_URL}/support-memories`, {
        headers: browserHeaders(),
    });
    if (!response.ok) {
        throw new Error(`Could not fetch dokkan.fyi support memories: ${response.status}`);
    }
    const html = await response.text();
    const payload = extractPagePayload(html);
    if (!Array.isArray(payload.props.supportMemories)) {
        throw new Error("dokkan.fyi support memories payload did not include supportMemories.");
    }
    return payload;
}
function extractPagePayload(html) {
    const match = html.match(/<script data-page="app" type="application\/json">([\s\S]*?)<\/script>/);
    if (!match?.[1]) {
        throw new Error("Could not find dokkan.fyi support memories page payload.");
    }
    return JSON.parse(match[1]);
}
function browserHeaders() {
    return {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9",
        "Cache-Control": "no-cache",
        "Pragma": "no-cache",
    };
}
function maxSupportMemoryLevel(enhancementChain) {
    const maxEnhancedLevel = enhancementChain.reduce((maxLevel, step) => Math.max(maxLevel, step.level), 1);
    return Math.max(1, maxEnhancedLevel);
}
function releaseDate(value) {
    const normalized = cleanInlineText(value);
    if (!normalized) {
        return undefined;
    }
    const parsed = new Date(normalized);
    if (Number.isNaN(parsed.getTime())) {
        return undefined;
    }
    return parsed.toISOString();
}
function cleanMultilineText(value) {
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
function cleanInlineText(value) {
    return cleanMultilineText(value).replace(/\s*\n\s*/g, " ").trim();
}
function toNumber(value) {
    if (typeof value === "number") {
        return Number.isFinite(value) ? value : 0;
    }
    if (typeof value === "string") {
        const parsed = parseInt(value, 10);
        return Number.isFinite(parsed) ? parsed : 0;
    }
    return 0;
}
function toOptionalNumber(value) {
    const parsed = toNumber(value);
    return parsed === 0 && value !== 0 && value !== "0" ? undefined : parsed;
}
//# sourceMappingURL=fyi-support-memories.js.map