"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.withoutUndefined = exports.compareIds = exports.delay = exports.mapWithConcurrency = exports.requestedDelayMs = exports.requestedConcurrency = exports.writeSpecialCache = exports.readSpecialCache = exports.stripDokkanInfoTitle = exports.assertUsablePage = exports.parseJsonAttribute = exports.absoluteOptionalUrl = exports.absoluteUrl = exports.toId = exports.requiredNumber = exports.optionalNumber = exports.optionalText = exports.cleanText = exports.DOKKAN_INFO_BASE_URL = void 0;
const promises_1 = require("fs/promises");
const path_1 = require("path");
exports.DOKKAN_INFO_BASE_URL = "https://dokkaninfo.com";
const CACHE_SCHEMA_VERSION = "1.0.0";
function cleanText(value) {
    return String(value ?? "").replace(/\s+/g, " ").trim();
}
exports.cleanText = cleanText;
function optionalText(value) {
    return cleanText(value) || undefined;
}
exports.optionalText = optionalText;
function optionalNumber(value) {
    const match = cleanText(String(value ?? "")).match(/-?[\d,.]+/);
    if (!match)
        return undefined;
    const parsed = Number(match[0].replace(/,/g, ""));
    return Number.isFinite(parsed) ? parsed : undefined;
}
exports.optionalNumber = optionalNumber;
function requiredNumber(value, label) {
    const parsed = optionalNumber(value);
    if (parsed === undefined)
        throw new Error(`${label} is missing or invalid.`);
    return parsed;
}
exports.requiredNumber = requiredNumber;
function toId(value, label) {
    const normalized = cleanText(String(value ?? ""));
    if (!/^\d+$/.test(normalized))
        throw new Error(`${label} is missing or invalid.`);
    return normalized;
}
exports.toId = toId;
function absoluteUrl(value) {
    if (!value)
        return exports.DOKKAN_INFO_BASE_URL;
    const url = new URL(value, exports.DOKKAN_INFO_BASE_URL);
    url.pathname = url.pathname.replace(/\/{2,}/g, "/");
    return url.toString();
}
exports.absoluteUrl = absoluteUrl;
function absoluteOptionalUrl(value) {
    return value ? absoluteUrl(value) : undefined;
}
exports.absoluteOptionalUrl = absoluteOptionalUrl;
function parseJsonAttribute(value, label) {
    if (!value)
        throw new Error(`${label} is missing.`);
    try {
        return JSON.parse(value);
    }
    catch {
        throw new Error(`${label} is invalid JSON.`);
    }
}
exports.parseJsonAttribute = parseJsonAttribute;
function assertUsablePage(document, label) {
    const text = cleanText(document.body?.textContent);
    if (/Sorry, you have been blocked/i.test(text))
        throw new Error(`DokkanInfo blocked ${label}.`);
    if (/General server error/i.test(text))
        throw new Error(`DokkanInfo returned an error for ${label}.`);
}
exports.assertUsablePage = assertUsablePage;
function stripDokkanInfoTitle(document) {
    return cleanText(document.title).replace(/\s*\|\s*Dokkan Info!?$/i, "");
}
exports.stripDokkanInfoTitle = stripDokkanInfoTitle;
async function readSpecialCache(cacheDir, envPrefix, relativePath) {
    if (refreshRequested(envPrefix))
        return undefined;
    try {
        const cached = JSON.parse(await (0, promises_1.readFile)((0, path_1.resolve)(__dirname, cacheDir, relativePath), "utf8"));
        const ageMs = Date.now() - Date.parse(cached.fetchedAt);
        if (cached.schemaVersion !== CACHE_SCHEMA_VERSION || !Number.isFinite(ageMs) || ageMs > cacheTtlHours(envPrefix) * 3600000)
            return undefined;
        return cached.value;
    }
    catch (error) {
        if (error.code === "ENOENT")
            return undefined;
        return undefined;
    }
}
exports.readSpecialCache = readSpecialCache;
async function writeSpecialCache(cacheDir, relativePath, value) {
    const path = (0, path_1.resolve)(__dirname, cacheDir, relativePath);
    await (0, promises_1.mkdir)((0, path_1.resolve)(path, ".."), { recursive: true });
    const temporary = `${path}.${process.pid}.${Date.now()}.tmp`;
    await (0, promises_1.writeFile)(temporary, JSON.stringify({ schemaVersion: CACHE_SCHEMA_VERSION, fetchedAt: new Date().toISOString(), value }));
    await (0, promises_1.rename)(temporary, path);
}
exports.writeSpecialCache = writeSpecialCache;
function requestedConcurrency(envPrefix, fallback = 3) {
    const value = Number(process.env[`${envPrefix}_CONCURRENCY`]);
    return Number.isInteger(value) && value > 0 ? value : fallback;
}
exports.requestedConcurrency = requestedConcurrency;
function requestedDelayMs(envPrefix, fallback = 150) {
    const value = Number(process.env[`${envPrefix}_DELAY_MS`]);
    return Number.isFinite(value) && value >= 0 ? value : fallback;
}
exports.requestedDelayMs = requestedDelayMs;
async function mapWithConcurrency(values, concurrency, mapper) {
    const results = new Array(values.length);
    let next = 0;
    async function worker() {
        while (next < values.length) {
            const index = next++;
            results[index] = await mapper(values[index], index);
        }
    }
    await Promise.all(Array.from({ length: Math.min(concurrency, values.length) }, worker));
    return results;
}
exports.mapWithConcurrency = mapWithConcurrency;
function delay(milliseconds) {
    return milliseconds > 0 ? new Promise(resolveDelay => setTimeout(resolveDelay, milliseconds)) : Promise.resolve();
}
exports.delay = delay;
function compareIds(left, right) {
    return left.localeCompare(right, "en", { numeric: true });
}
exports.compareIds = compareIds;
function withoutUndefined(value) {
    return Object.fromEntries(Object.entries(value).filter(([, field]) => field !== undefined));
}
exports.withoutUndefined = withoutUndefined;
function refreshRequested(envPrefix) {
    return /^(?:1|true|yes)$/i.test(process.env[`${envPrefix}_REFRESH`] ?? "");
}
function cacheTtlHours(envPrefix) {
    const value = Number(process.env[`${envPrefix}_CACHE_TTL_HOURS`]);
    return Number.isFinite(value) && value >= 0 ? value : 168;
}
//# sourceMappingURL=dokkaninfo-special-events-common.js.map