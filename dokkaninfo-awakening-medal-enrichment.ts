import { execFile } from "child_process";
import { access, mkdir, writeFile } from "fs/promises";
import { JSDOM } from "jsdom";
import { dirname, relative, resolve } from "path";
import { promisify } from "util";
import { writeFormattedJson } from "./format-json";
import {
    AwakeningMedalDokkanInfoAssetRef,
    AwakeningMedalDokkanInfoEnrichmentDataset,
    AwakeningMedalDokkanInfoEnrichmentEntry,
} from "./awakening-medal-dokkaninfo-enrichment";

const DOKKAN_INFO_BASE_URL = "https://dokkaninfo.com";
const DOKKAN_INFO_AWAKENING_ITEMS_URL = `${DOKKAN_INFO_BASE_URL}/items/awakeningitems`;
const AWAKENING_MEDAL_OUTPUT_DIR = "data/awakening-medals/latest";
const AWAKENING_MEDAL_ASSET_DIR = "data/awakening-medals/assets/dokkaninfo";
const AWAKENING_MEDAL_DOWNLOAD_CONCURRENCY = 12;
const execFileAsync = promisify(execFile);

interface DokkanInfoAwakeningItemsComponentProps {
    awakeningItemsRarities: DokkanInfoAwakeningItemRarityGroup[],
    language: string,
    version: string,
    versionLanguage: string,
}

interface DokkanInfoAwakeningItemRarityGroup {
    rarity?: number | string | null,
    awakeningItem?: DokkanInfoAwakeningItemRow[] | null,
}

interface DokkanInfoAwakeningItemRow {
    id?: number | string | null,
    name?: string | null,
    description?: string | null,
    zeni?: number | string | null,
    rarity?: number | string | null,
    selling_exchange_point?: number | string | null,
    event_jumpable?: number | string | null,
    created_at?: string | null,
    updated_at?: string | null,
    width?: number | string | null,
    height?: number | string | null,
}

export async function getDokkanInfoAwakeningMedalEnrichment(): Promise<AwakeningMedalDokkanInfoEnrichmentDataset> {
    const html = await fetchDokkanInfoHtml(DOKKAN_INFO_AWAKENING_ITEMS_URL, "awakening medals");
    const props = parseAwakeningItemsComponentProps(html);
    const requestedIds = requestedAwakeningMedalIds();
    const requestedLimit = requestedAwakeningMedalLimit();

    const entries = props.awakeningItemsRarities
        .flatMap(group => buildEntriesForRarityGroup(group, props))
        .filter(entry => !requestedIds || requestedIds.includes(entry.id))
        .slice(0, requestedLimit ?? Number.MAX_SAFE_INTEGER)
        .sort((left, right) => left.name.localeCompare(right.name) || left.id.localeCompare(right.id));

    return {
        generatedAt: new Date().toISOString(),
        source: "dokkaninfo",
        count: entries.length,
        entries,
    };
}

export async function writeDokkanInfoAwakeningMedalEnrichment(
    dataset?: AwakeningMedalDokkanInfoEnrichmentDataset,
): Promise<string> {
    const resolvedDataset = dataset ?? await getDokkanInfoAwakeningMedalEnrichment();
    const outputDir = resolve(__dirname, AWAKENING_MEDAL_OUTPUT_DIR);
    const outputPath = resolve(outputDir, "awakening-medal-dokkaninfo-enrichment.json");

    await mkdir(outputDir, { recursive: true });
    await downloadAwakeningMedalAssets(resolvedDataset.entries);
    await writeFormattedJson(outputPath, resolvedDataset);

    return outputPath;
}

export function parseAwakeningItemsComponentProps(html: string): DokkanInfoAwakeningItemsComponentProps {
    const document = new JSDOM(html).window.document;
    const element = document.querySelector("awakening-items");
    if (!element) {
        throw new Error("Could not locate awakening-items component in DokkanInfo HTML.");
    }

    const rawGroups = element.getAttribute("v-bind:awakening_items_rarities");
    if (!rawGroups) {
        throw new Error("Could not locate awakening item rarity payload in DokkanInfo HTML.");
    }

    return {
        awakeningItemsRarities: JSON.parse(rawGroups) as DokkanInfoAwakeningItemRarityGroup[],
        language: cleanInlineText(element.getAttribute("language")) || "English",
        version: cleanInlineText(element.getAttribute("version")) || "global",
        versionLanguage: cleanInlineText(element.getAttribute("version_language")) || "/en/",
    };
}

function buildEntriesForRarityGroup(
    group: DokkanInfoAwakeningItemRarityGroup,
    props: DokkanInfoAwakeningItemsComponentProps,
): AwakeningMedalDokkanInfoEnrichmentEntry[] {
    const rarityBucket = toOptionalNumber(group.rarity) ?? 0;

    return (group.awakeningItem ?? [])
        .map(item => buildEntry(item, rarityBucket, props))
        .filter((entry): entry is AwakeningMedalDokkanInfoEnrichmentEntry => Boolean(entry));
}

function buildEntry(
    item: DokkanInfoAwakeningItemRow,
    rarityBucket: number,
    props: DokkanInfoAwakeningItemsComponentProps,
): AwakeningMedalDokkanInfoEnrichmentEntry | undefined {
    const id = toOptionalNumber(item.id)?.toString();
    const name = cleanInlineText(item.name);
    if (!id || !name) {
        return undefined;
    }

    const paddedId = id.padStart(5, "0");
    const description = cleanMultilineText(item.description) || undefined;

    return {
        id,
        itemKey: `AwakeningMedal:${id}`,
        name,
        detailUrl: `${DOKKAN_INFO_AWAKENING_ITEMS_URL}/${id}`,
        description,
        rarityBucket,
        zeni: toOptionalNumber(item.zeni),
        tradePoints: toOptionalNumber(item.selling_exchange_point),
        eventJumpable: toOptionalNumber(item.event_jumpable) === 1,
        isCharacterSpecific: (description ?? "").toLowerCase().includes("character-specific"),
        width: toOptionalNumber(item.width),
        height: toOptionalNumber(item.height),
        createdAt: cleanInlineText(item.created_at) || undefined,
        updatedAt: cleanInlineText(item.updated_at) || undefined,
        thumbnailAsset: buildThumbnailAsset(props, paddedId),
    };
}

async function downloadAwakeningMedalAssets(
    entries: AwakeningMedalDokkanInfoEnrichmentEntry[],
): Promise<void> {
    await mapWithConcurrency(entries, AWAKENING_MEDAL_DOWNLOAD_CONCURRENCY, async entry => {
        if (!entry.thumbnailAsset) {
            return;
        }

        const medalDir = resolve(__dirname, AWAKENING_MEDAL_ASSET_DIR, entry.id);
        await mkdir(medalDir, { recursive: true });
        entry.thumbnailAsset.localPath = await downloadAsset(
            entry.thumbnailAsset.remoteUrl,
            resolve(medalDir, "thumb.png"),
            entry.detailUrl,
        );
    });
}

function buildThumbnailAsset(
    props: DokkanInfoAwakeningItemsComponentProps,
    paddedId: string,
): AwakeningMedalDokkanInfoAssetRef {
    const languageSegment = sanitizeVersionLanguageSegment(props.versionLanguage);
    const remoteUrl = new URL([
        "assets",
        props.version,
        languageSegment,
        "item",
        "awaken",
        languageSegment,
        "thumb",
        `thumb_awaken_items_${paddedId}`,
        `thumb_awaken_items_${paddedId}.png`,
    ].join("/"), `${DOKKAN_INFO_BASE_URL}/`).toString();

    return { remoteUrl };
}

async function downloadAsset(
    remoteUrl: string,
    absolutePath: string,
    refererUrl: string,
): Promise<string> {
    await mkdir(dirname(absolutePath), { recursive: true });
    if (await fileExists(absolutePath)) {
        return toProjectRelativePath(absolutePath);
    }

    const response = await fetch(remoteUrl, {
        headers: browserHeaders(refererUrl),
    });

    if (!response.ok) {
        await downloadBinaryWithCurl(remoteUrl, absolutePath, refererUrl);
        return toProjectRelativePath(absolutePath);
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    await writeFile(absolutePath, buffer);

    return toProjectRelativePath(absolutePath);
}

async function downloadBinaryWithCurl(
    remoteUrl: string,
    absolutePath: string,
    refererUrl: string,
): Promise<void> {
    try {
        await execFileAsync("curl.exe", [
            "--fail",
            "-L",
            "-A",
            browserHeaders(refererUrl)["User-Agent"],
            "-H",
            `Referer: ${refererUrl}`,
            "-H",
            "Accept: */*",
            "-H",
            "Accept-Language: en-US,en;q=0.9",
            "-o",
            absolutePath,
            remoteUrl,
        ]);
    } catch (error) {
        throw new Error(summarizeCurlError(error, remoteUrl));
    }
}

async function fetchDokkanInfoHtml(url: string, label: string, retries = 3): Promise<string> {
    const response = await fetch(url, {
        headers: browserHeaders(url),
    });

    if (response.ok) {
        return response.text();
    }

    if (response.status === 403) {
        return fetchDokkanInfoHtmlWithCurl(url);
    }

    if (retries > 1 && shouldRetryStatus(response.status)) {
        await delay(400);
        return fetchDokkanInfoHtml(url, label, retries - 1);
    }

    throw new Error(`Could not fetch dokkaninfo ${label}: ${response.status}`);
}

async function fetchDokkanInfoHtmlWithCurl(url: string): Promise<string> {
    const { stdout } = await execFileAsync("curl.exe", [
        "--fail",
        "-L",
        "-A",
        browserHeaders(url)["User-Agent"],
        "-H",
        `Referer: ${url}`,
        "-H",
        "Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "-H",
        "Accept-Language: en-US,en;q=0.9",
        url,
    ], {
        maxBuffer: 50 * 1024 * 1024,
    });

    return stdout;
}

function sanitizeVersionLanguageSegment(value: string): string {
    return cleanInlineText(value).replace(/^\/+|\/+$/g, "");
}

function browserHeaders(refererUrl: string): Record<string, string> {
    return {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9",
        "Cache-Control": "no-cache",
        "Pragma": "no-cache",
        "Referer": refererUrl,
    };
}

function toOptionalNumber(value: number | string | null | undefined): number | undefined {
    if (typeof value === "number" && Number.isFinite(value)) {
        return value;
    }

    const normalized = cleanInlineText(typeof value === "string" ? value : undefined);
    if (!normalized) {
        return undefined;
    }

    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : undefined;
}

function cleanInlineText(value: string | null | undefined): string {
    return cleanMultilineText(value).replace(/\s*\n\s*/g, " ").trim();
}

function cleanMultilineText(value: string | null | undefined): string {
    return (value ?? "")
        .replace(/&#039;/g, "'")
        .replace(/&quot;/g, "\"")
        .replace(/&amp;/g, "&")
        .replace(/\u00A0/g, " ")
        .split(/\r?\n/)
        .map(line => line.replace(/\s+/g, " ").trim())
        .filter(Boolean)
        .join("\n")
        .trim();
}

function toProjectRelativePath(absolutePath: string): string {
    return relative(resolve(__dirname), absolutePath).replace(/\\/g, "/");
}

async function fileExists(absolutePath: string): Promise<boolean> {
    try {
        await access(absolutePath);
        return true;
    } catch (error) {
        return false;
    }
}

function shouldRetryStatus(status: number): boolean {
    return status === 429 || status >= 500;
}

function summarizeCurlError(error: unknown, remoteUrl: string): string {
    const message = error instanceof Error ? error.message : String(error);
    const statusMatch = message.match(/curl:\s+\((\d+)\)/i);

    if (statusMatch?.[1] === "22") {
        return `curl returned HTTP error for ${remoteUrl}`;
    }

    return `curl failed for ${remoteUrl}`;
}

function requestedAwakeningMedalIds(): string[] | undefined {
    const ids = cleanInlineText(process.env.DOKKANINFO_AWAKENING_MEDAL_IDS)
        .split(",")
        .map(value => cleanInlineText(value))
        .filter(Boolean);

    return ids.length ? ids : undefined;
}

function requestedAwakeningMedalLimit(): number | undefined {
    const value = parseInt(process.env.DOKKANINFO_AWAKENING_MEDAL_LIMIT ?? "", 10);
    return Number.isFinite(value) && value > 0 ? value : undefined;
}

async function mapWithConcurrency<T>(
    values: T[],
    concurrency: number,
    mapper: (value: T) => Promise<void>,
): Promise<void> {
    const workerCount = Math.max(1, Math.min(concurrency, values.length));
    let index = 0;

    await Promise.all(Array.from({ length: workerCount }, async () => {
        while (index < values.length) {
            const currentIndex = index;
            index += 1;
            await mapper(values[currentIndex]);
        }
    }));
}

function delay(ms: number): Promise<void> {
    return new Promise(resolveDelay => setTimeout(resolveDelay, ms));
}
