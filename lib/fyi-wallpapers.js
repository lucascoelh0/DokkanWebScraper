"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mapWallpaperScheduleFromFyi = exports.mapWallpaperFromFyi = exports.buildWallpaperDataset = exports.writeDokkanFyiWallpapers = exports.getDokkanFyiWallpapers = void 0;
const promises_1 = require("fs/promises");
const path_1 = require("path");
const format_json_1 = require("./format-json");
const DOKKAN_FYI_BASE_URL = "https://dokkan.fyi";
class DokkanFyiWallpaperClient {
    async fetchWallpapers(limit) {
        const firstPage = await this.fetchWallpaperPage(1);
        const wallpapers = [...(firstPage.props.wallpapers?.data ?? [])];
        const lastPage = toOptionalNumber(firstPage.props.wallpapers?.meta?.last_page) ?? 1;
        for (let page = 2; page <= lastPage; page++) {
            const nextPage = await this.fetchWallpaperPage(page);
            wallpapers.push(...(nextPage.props.wallpapers?.data ?? []));
            if (limit && wallpapers.length >= limit) {
                break;
            }
        }
        return limit ? wallpapers.slice(0, limit) : wallpapers;
    }
    async fetchWallpaperPage(page) {
        const query = new URLSearchParams({ page: page.toString() });
        const response = await fetch(`${DOKKAN_FYI_BASE_URL}/wallpapers?${query.toString()}`, {
            headers: browserHeaders(),
        });
        if (!response.ok) {
            throw new Error(`Could not fetch dokkan.fyi wallpapers page ${page}: ${response.status}`);
        }
        const html = await response.text();
        return extractPagePayload(html);
    }
}
async function getDokkanFyiWallpapers() {
    const client = new DokkanFyiWallpaperClient();
    const wallpapers = await client.fetchWallpapers(requestedWallpaperLimit());
    return buildWallpaperDataset(wallpapers.map(mapWallpaperFromFyi));
}
exports.getDokkanFyiWallpapers = getDokkanFyiWallpapers;
async function writeDokkanFyiWallpapers() {
    const dataset = await getDokkanFyiWallpapers();
    const outputDir = (0, path_1.resolve)(__dirname, "data/wallpapers/latest");
    const outputPath = (0, path_1.resolve)(outputDir, "wallpapers.json");
    await (0, promises_1.mkdir)(outputDir, { recursive: true });
    await (0, format_json_1.writeFormattedJson)(outputPath, dataset);
    return outputPath;
}
exports.writeDokkanFyiWallpapers = writeDokkanFyiWallpapers;
function buildWallpaperDataset(wallpapers) {
    return {
        generatedAt: new Date().toISOString(),
        source: "dokkan.fyi",
        count: wallpapers.length,
        wallpapers: [...wallpapers].sort((left, right) => left.name.localeCompare(right.name) || left.id.localeCompare(right.id)),
    };
}
exports.buildWallpaperDataset = buildWallpaperDataset;
function mapWallpaperFromFyi(wallpaper) {
    return {
        id: wallpaper.id.toString(),
        name: cleanInlineText(wallpaper.name),
        description: cleanMultilineText(wallpaper.description),
        schedules: (wallpaper.schedules ?? []).map(mapWallpaperScheduleFromFyi),
    };
}
exports.mapWallpaperFromFyi = mapWallpaperFromFyi;
function mapWallpaperScheduleFromFyi(schedule) {
    return {
        id: schedule.id.toString(),
        startsAt: releaseDate(schedule.starts_at),
        endsAt: releaseDate(schedule.ends_at),
    };
}
exports.mapWallpaperScheduleFromFyi = mapWallpaperScheduleFromFyi;
function requestedWallpaperLimit() {
    const value = parseInt(process.env.DOKKAN_FYI_WALLPAPER_LIMIT ?? "", 10);
    return Number.isFinite(value) && value > 0 ? value : undefined;
}
function extractPagePayload(html) {
    const match = html.match(/<script data-page="app" type="application\/json">([\s\S]*?)<\/script>/);
    if (!match?.[1]) {
        throw new Error("Could not find dokkan.fyi page payload.");
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
    if (value === null || value === undefined || value === "") {
        return "";
    }
    const normalized = typeof value === "string"
        ? value
        : value.toString();
    return normalized
        .replace(/\{[^}]+\}/g, "")
        .replace(/\r/g, "")
        .replace(/&#039;/g, "'")
        .replace(/&quot;/g, "\"")
        .replace(/&amp;/g, "&")
        .split("\n")
        .map(line => line.trim())
        .filter(Boolean)
        .join("\n")
        .trim();
}
function cleanInlineText(value) {
    return cleanMultilineText(value).replace(/\s*\n\s*/g, " ").trim();
}
function toOptionalNumber(value) {
    if (typeof value === "number") {
        return Number.isFinite(value) ? value : undefined;
    }
    if (typeof value === "string") {
        const parsed = parseInt(value, 10);
        return Number.isFinite(parsed) ? parsed : undefined;
    }
    return undefined;
}
//# sourceMappingURL=fyi-wallpapers.js.map