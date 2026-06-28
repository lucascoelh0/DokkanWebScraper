import { mkdir } from "fs/promises";
import { resolve } from "path";
import { writeFormattedJson } from "./format-json";
import { WallpaperDataset, WallpaperEntry, WallpaperSchedule } from "./wallpaper";

const DOKKAN_FYI_BASE_URL = "https://dokkan.fyi";

interface FyiPaginated<T> {
    data: T[],
    meta?: {
        last_page?: number | null,
    },
}

interface FyiWallpapersPagePayload {
    component: string,
    props: {
        wallpapers: FyiPaginated<FyiWallpaper>,
    },
}

interface FyiWallpaper {
    id: number,
    name?: string | null,
    description?: string | null,
    schedules?: FyiWallpaperSchedule[] | null,
}

interface FyiWallpaperSchedule {
    id: number,
    starts_at?: string | null,
    ends_at?: string | null,
}

class DokkanFyiWallpaperClient {
    async fetchWallpapers(limit?: number): Promise<FyiWallpaper[]> {
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

    private async fetchWallpaperPage(page: number): Promise<FyiWallpapersPagePayload> {
        const query = new URLSearchParams({ page: page.toString() });
        const response = await fetch(`${DOKKAN_FYI_BASE_URL}/wallpapers?${query.toString()}`, {
            headers: browserHeaders(),
        });

        if (!response.ok) {
            throw new Error(`Could not fetch dokkan.fyi wallpapers page ${page}: ${response.status}`);
        }

        const html = await response.text();
        return extractPagePayload<FyiWallpapersPagePayload>(html);
    }
}

export async function getDokkanFyiWallpapers(): Promise<WallpaperDataset> {
    const client = new DokkanFyiWallpaperClient();
    const wallpapers = await client.fetchWallpapers(requestedWallpaperLimit());
    return buildWallpaperDataset(wallpapers.map(mapWallpaperFromFyi));
}

export async function writeDokkanFyiWallpapers(): Promise<string> {
    const dataset = await getDokkanFyiWallpapers();
    const outputDir = resolve(__dirname, "data/wallpapers/latest");
    const outputPath = resolve(outputDir, "wallpapers.json");

    await mkdir(outputDir, { recursive: true });
    await writeFormattedJson(outputPath, dataset);

    return outputPath;
}

export function buildWallpaperDataset(wallpapers: WallpaperEntry[]): WallpaperDataset {
    return {
        generatedAt: new Date().toISOString(),
        source: "dokkan.fyi",
        count: wallpapers.length,
        wallpapers: [...wallpapers].sort((left, right) => left.name.localeCompare(right.name) || left.id.localeCompare(right.id)),
    };
}

export function mapWallpaperFromFyi(wallpaper: FyiWallpaper): WallpaperEntry {
    return {
        id: wallpaper.id.toString(),
        name: cleanInlineText(wallpaper.name),
        description: cleanMultilineText(wallpaper.description),
        schedules: (wallpaper.schedules ?? []).map(mapWallpaperScheduleFromFyi),
    };
}

export function mapWallpaperScheduleFromFyi(schedule: FyiWallpaperSchedule): WallpaperSchedule {
    return {
        id: schedule.id.toString(),
        startsAt: releaseDate(schedule.starts_at),
        endsAt: releaseDate(schedule.ends_at),
    };
}

function requestedWallpaperLimit(): number | undefined {
    const value = parseInt(process.env.DOKKAN_FYI_WALLPAPER_LIMIT ?? "", 10);
    return Number.isFinite(value) && value > 0 ? value : undefined;
}

function extractPagePayload<T>(html: string): T {
    const match = html.match(/<script data-page="app" type="application\/json">([\s\S]*?)<\/script>/);
    if (!match?.[1]) {
        throw new Error("Could not find dokkan.fyi page payload.");
    }

    return JSON.parse(match[1]) as T;
}

function browserHeaders(): Record<string, string> {
    return {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9",
        "Cache-Control": "no-cache",
        "Pragma": "no-cache",
    };
}

function releaseDate(value: string | null | undefined): string | undefined {
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

function cleanMultilineText(value: string | number | null | undefined): string {
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

function cleanInlineText(value: string | number | null | undefined): string {
    return cleanMultilineText(value).replace(/\s*\n\s*/g, " ").trim();
}

function toOptionalNumber(value: number | string | null | undefined): number | undefined {
    if (typeof value === "number") {
        return Number.isFinite(value) ? value : undefined;
    }

    if (typeof value === "string") {
        const parsed = parseInt(value, 10);
        return Number.isFinite(parsed) ? parsed : undefined;
    }

    return undefined;
}
