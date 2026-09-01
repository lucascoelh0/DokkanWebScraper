import { mkdir, readFile, rename, writeFile } from "fs/promises";
import { resolve } from "path";

export const DOKKAN_INFO_BASE_URL = "https://dokkaninfo.com";
const CACHE_SCHEMA_VERSION = "1.0.0";

interface CachedValue<T> {
    schemaVersion: string,
    fetchedAt: string,
    value: T,
}

export function cleanText(value: string | null | undefined): string {
    return String(value ?? "").replace(/\s+/g, " ").trim();
}

export function optionalText(value: string | null | undefined): string | undefined {
    return cleanText(value) || undefined;
}

export function optionalNumber(value: string | number | null | undefined): number | undefined {
    const match = cleanText(String(value ?? "")).match(/-?[\d,.]+/);
    if (!match) return undefined;
    const parsed = Number(match[0].replace(/,/g, ""));
    return Number.isFinite(parsed) ? parsed : undefined;
}

export function requiredNumber(value: string | number | null | undefined, label: string): number {
    const parsed = optionalNumber(value);
    if (parsed === undefined) throw new Error(`${label} is missing or invalid.`);
    return parsed;
}

export function toId(value: string | number | null | undefined, label: string): string {
    const normalized = cleanText(String(value ?? ""));
    if (!/^\d+$/.test(normalized)) throw new Error(`${label} is missing or invalid.`);
    return normalized;
}

export function absoluteUrl(value: string | null | undefined): string {
    if (!value) return DOKKAN_INFO_BASE_URL;
    const url = new URL(value, DOKKAN_INFO_BASE_URL);
    url.pathname = url.pathname.replace(/\/{2,}/g, "/");
    return url.toString();
}

export function absoluteOptionalUrl(value: string | null | undefined): string | undefined {
    return value ? absoluteUrl(value) : undefined;
}

export function parseJsonAttribute<T>(value: string | null | undefined, label: string): T {
    if (!value) throw new Error(`${label} is missing.`);
    try {
        return JSON.parse(value) as T;
    } catch {
        throw new Error(`${label} is invalid JSON.`);
    }
}

export function assertUsablePage(document: Document, label: string): void {
    const text = cleanText(document.body?.textContent);
    if (/Sorry, you have been blocked/i.test(text)) throw new Error(`DokkanInfo blocked ${label}.`);
    if (/General server error/i.test(text)) throw new Error(`DokkanInfo returned an error for ${label}.`);
}

export function stripDokkanInfoTitle(document: Document): string {
    return cleanText(document.title).replace(/\s*\|\s*Dokkan Info!?$/i, "");
}

export async function readSpecialCache<T>(cacheDir: string, envPrefix: string, relativePath: string): Promise<T | undefined> {
    if (refreshRequested(envPrefix)) return undefined;
    try {
        const cached = JSON.parse(await readFile(resolve(__dirname, cacheDir, relativePath), "utf8")) as CachedValue<T>;
        const ageMs = Date.now() - Date.parse(cached.fetchedAt);
        if (cached.schemaVersion !== CACHE_SCHEMA_VERSION || !Number.isFinite(ageMs) || ageMs > cacheTtlHours(envPrefix) * 3_600_000) return undefined;
        return cached.value;
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
        return undefined;
    }
}

export async function writeSpecialCache<T>(cacheDir: string, relativePath: string, value: T): Promise<void> {
    const path = resolve(__dirname, cacheDir, relativePath);
    await mkdir(resolve(path, ".."), { recursive: true });
    const temporary = `${path}.${process.pid}.${Date.now()}.tmp`;
    await writeFile(temporary, JSON.stringify({ schemaVersion: CACHE_SCHEMA_VERSION, fetchedAt: new Date().toISOString(), value }));
    await rename(temporary, path);
}

export function requestedConcurrency(envPrefix: string, fallback = 3): number {
    const value = Number(process.env[`${envPrefix}_CONCURRENCY`]);
    return Number.isInteger(value) && value > 0 ? value : fallback;
}

export function requestedDelayMs(envPrefix: string, fallback = 150): number {
    const value = Number(process.env[`${envPrefix}_DELAY_MS`]);
    return Number.isFinite(value) && value >= 0 ? value : fallback;
}

export async function mapWithConcurrency<T, R>(values: T[], concurrency: number, mapper: (value: T, index: number) => Promise<R>): Promise<R[]> {
    const results = new Array<R>(values.length);
    let next = 0;
    async function worker(): Promise<void> {
        while (next < values.length) {
            const index = next++;
            results[index] = await mapper(values[index], index);
        }
    }
    await Promise.all(Array.from({ length: Math.min(concurrency, values.length) }, worker));
    return results;
}

export function delay(milliseconds: number): Promise<void> {
    return milliseconds > 0 ? new Promise(resolveDelay => setTimeout(resolveDelay, milliseconds)) : Promise.resolve();
}

export function compareIds(left: string, right: string): number {
    return left.localeCompare(right, "en", { numeric: true });
}

export function withoutUndefined<T extends object>(value: T): T {
    return Object.fromEntries(Object.entries(value).filter(([, field]) => field !== undefined)) as T;
}

function refreshRequested(envPrefix: string): boolean {
    return /^(?:1|true|yes)$/i.test(process.env[`${envPrefix}_REFRESH`] ?? "");
}

function cacheTtlHours(envPrefix: string): number {
    const value = Number(process.env[`${envPrefix}_CACHE_TTL_HOURS`]);
    return Number.isFinite(value) && value >= 0 ? value : 168;
}
