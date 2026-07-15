import { execFile } from "child_process";
import { access, mkdir, readFile, writeFile } from "fs/promises";
import { JSDOM } from "jsdom";
import { dirname, relative, resolve } from "path";
import { promisify } from "util";
import { writeFormattedJson } from "./format-json";
import {
    SupportMemoryDokkanInfoAnimationAssetSet,
    SupportMemoryDokkanInfoAssetRef,
    SupportMemoryDokkanInfoAssetQuantityRef,
    SupportMemoryDokkanInfoEnrichmentDataset,
    SupportMemoryDokkanInfoEnrichmentEntry,
    SupportMemoryDokkanInfoEnhancementItem,
    SupportMemoryDokkanInfoLevelDescription,
    SupportMemoryDokkanInfoRequiredFilmRef,
} from "./support-memory-dokkaninfo-enrichment";

const DOKKAN_INFO_BASE_URL = "https://dokkaninfo.com";
const DOKKAN_INFO_GLOBAL_BASE_URL = "https://glben.dokkaninfo.com";
const DOKKAN_INFO_SUPPORT_MEMORIES_URL = `${DOKKAN_INFO_BASE_URL}/items/supportmemories`;
const SUPPORT_MEMORY_OUTPUT_DIR = "data/support-memories/latest";
const SUPPORT_MEMORY_ASSET_DIR = "data/support-memories/assets/dokkaninfo";
const SUPPORT_MEMORY_DOWNLOAD_CONCURRENCY = 8;
const execFileAsync = promisify(execFile);

export async function getDokkanInfoSupportMemoryEnrichment(): Promise<SupportMemoryDokkanInfoEnrichmentDataset> {
    const html = await fetchDokkanInfoHtml(DOKKAN_INFO_SUPPORT_MEMORIES_URL, "support memories");
    const requestedIds = requestedSupportMemoryIds();
    const requestedLimit = requestedSupportMemoryLimit();
    const entries = parseDokkanInfoSupportMemoryList(html)
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

export async function writeDokkanInfoSupportMemoryEnrichment(
    dataset?: SupportMemoryDokkanInfoEnrichmentDataset,
): Promise<string> {
    const resolvedDataset = dataset ?? await getDokkanInfoSupportMemoryEnrichment();
    const outputDir = resolve(__dirname, SUPPORT_MEMORY_OUTPUT_DIR);
    const outputPath = resolve(outputDir, "support-memory-dokkaninfo-enrichment.json");

    await mkdir(outputDir, { recursive: true });
    await downloadSupportMemoryAssets(resolvedDataset.entries);
    await writeFormattedJson(outputPath, resolvedDataset);

    return outputPath;
}

export function parseDokkanInfoSupportMemoryList(html: string): SupportMemoryDokkanInfoEnrichmentEntry[] {
    const rowPattern = /<a href="https:\/\/dokkaninfo\.com\/items\/supportmemories\/(\d+)" class="row[\s\S]*?<\/a>/g;
    const rows = Array.from(html.matchAll(rowPattern));

    return rows.map(match => parseDokkanInfoSupportMemoryRow(match[1], match[0]));
}

export function parseDokkanInfoSupportMemoryRow(
    id: string,
    rowHtml: string,
): SupportMemoryDokkanInfoEnrichmentEntry {
    const document = new JSDOM(`<body>${rowHtml.trim()}</body>`).window.document;
    const anchor = document.querySelector("a");
    if (!anchor) {
        throw new Error(`Could not parse support memory row ${id}.`);
    }

    const detailUrl = cleanInlineText(anchor.getAttribute("href")) || `${DOKKAN_INFO_BASE_URL}/items/supportmemories/${id}`;
    const columns = Array.from(anchor.children) as Element[];

    const largeCol = columns[0];
    const nameCol = columns[1];
    const descriptionCol = columns[2];
    const completeCol = columns[3];
    const filmCol = columns[4];
    const enhancementCol = columns[5];

    return {
        id,
        name: cleanInlineText(nameCol?.textContent),
        detailUrl,
        levelDescriptions: parseLevelDescriptions(descriptionCol),
        largeAsset: parseImageAsset(largeCol?.querySelector("img")),
        completeAsset: parseQuantityAsset(completeCol),
        requiredFilm: parseRequiredFilmAsset(filmCol),
        enhancementItems: parseEnhancementItems(enhancementCol),
        animation: buildAnimationAssetSet(id),
    };
}

export function extractLwfTextureFileNames(buffer: Buffer): string[] {
    const text = buffer.toString("latin1");
    const matches = Array.from(text.matchAll(/[A-Za-z0-9_%./-]+\.png/g))
        .map(match => cleanInlineText(match[0]))
        .filter(Boolean);

    return Array.from(new Set(matches))
        .filter(name => name !== "_empty")
        .sort((left, right) => left.localeCompare(right));
}

async function downloadSupportMemoryAssets(entries: SupportMemoryDokkanInfoEnrichmentEntry[]): Promise<void> {
    await mapWithConcurrency(entries, SUPPORT_MEMORY_DOWNLOAD_CONCURRENCY, async entry => {
        const memoryDir = resolve(__dirname, SUPPORT_MEMORY_ASSET_DIR, entry.id);
        await mkdir(memoryDir, { recursive: true });

        if (entry.largeAsset) {
            entry.largeAsset.localPath = await downloadAsset(entry.largeAsset.remoteUrl, resolve(memoryDir, "large.png"), entry.detailUrl);
        }

        if (entry.completeAsset) {
            entry.completeAsset.localPath = await downloadAsset(entry.completeAsset.remoteUrl, resolve(memoryDir, "complete.png"), entry.detailUrl);
        }

        if (entry.requiredFilm) {
            entry.requiredFilm.localPath = await downloadAsset(entry.requiredFilm.remoteUrl, resolve(memoryDir, "film.png"), entry.detailUrl);
        }

        if (entry.enhancementItems.length > 0) {
            const enhancementDir = resolve(memoryDir, "enhancements");
            await mkdir(enhancementDir, { recursive: true });

            for (const item of entry.enhancementItems) {
                item.asset.localPath = await downloadAsset(
                    item.asset.remoteUrl,
                    resolve(enhancementDir, `${item.id}.png`),
                    entry.detailUrl,
                );
            }
        }

        if (entry.animation) {
            try {
                await downloadAnimationAssets(entry, entry.animation);
            } catch (error) {
                console.warn(`Could not mirror support memory animation ${entry.id}: ${(error as Error).message}`);
                entry.animation.status = "unavailable";
                entry.animation.failureReason = (error as Error).message;
                entry.animation.localDirectory = undefined;
                entry.animation.lwf.localPath = undefined;
                entry.animation.textures = [];
            }
        }
    });
}

async function downloadAnimationAssets(
    entry: SupportMemoryDokkanInfoEnrichmentEntry,
    animation: SupportMemoryDokkanInfoAnimationAssetSet,
): Promise<void> {
    const animationDir = resolve(__dirname, SUPPORT_MEMORY_ASSET_DIR, entry.id, "animation");
    await mkdir(animationDir, { recursive: true });

    const lwfAbsolutePath = resolve(animationDir, `support_memory_${entry.id}.lwf`);
    animation.lwf.localPath = await downloadAsset(animation.lwf.remoteUrl, lwfAbsolutePath, entry.detailUrl, true);

    const lwfBuffer = await readFile(lwfAbsolutePath);
    const textureFileNames = resolveAnimationTextureFileNames(entry.id, extractLwfTextureFileNames(lwfBuffer));
    animation.textures = [];
    const failedTextures: string[] = [];

    for (const textureFileName of textureFileNames) {
        const remoteUrl = `${animation.remoteBaseUrl}${textureFileName}`;
        try {
            const localPath = await downloadAsset(
                remoteUrl,
                resolve(animationDir, textureFileName),
                entry.detailUrl,
                true,
            );
            animation.textures.push({
                remoteUrl,
                localPath,
            });
        } catch (error) {
            failedTextures.push(`${textureFileName}: ${(error as Error).message}`);
        }
    }

    animation.status = failedTextures.length > 0 ? "partial" : "mirrored";
    animation.failureReason = failedTextures.length > 0
        ? `Could not mirror ${failedTextures.length} texture(s): ${failedTextures.join("; ")}`
        : undefined;
    animation.localDirectory = toProjectRelativePath(animationDir);
}

function resolveAnimationTextureFileNames(memoryId: string, fileNames: string[]): string[] {
    const externalTextures = fileNames.filter(name => name.startsWith(`support_memory_${memoryId}_`));
    return externalTextures.length ? externalTextures : fileNames;
}

async function downloadAsset(
    remoteUrl: string,
    absolutePath: string,
    refererUrl: string,
    useCurl = false,
): Promise<string> {
    await mkdir(dirname(absolutePath), { recursive: true });
    if (await fileExists(absolutePath)) {
        return toProjectRelativePath(absolutePath);
    }

    if (useCurl) {
        await downloadBinaryWithCurl(remoteUrl, absolutePath, refererUrl);
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

function parseLevelDescriptions(container: Element | undefined): SupportMemoryDokkanInfoLevelDescription[] {
    if (!container) {
        return [];
    }

    return Array.from(container.querySelectorAll(".row .col-sm"))
        .map(column => {
            const text = cleanInlineText(column.textContent);
            const levelMatch = text.match(/^Level\s+(\d+):\s*(.+)$/i);
            if (!levelMatch) {
                return undefined;
            }

            return {
                level: parseInt(levelMatch[1], 10),
                description: cleanInlineText(levelMatch[2]),
            };
        })
        .filter((value): value is SupportMemoryDokkanInfoLevelDescription => Boolean(value))
        .sort((left, right) => left.level - right.level);
}

function parseQuantityAsset(container: Element | undefined): SupportMemoryDokkanInfoAssetQuantityRef | undefined {
    if (!container) {
        return undefined;
    }

    const image = container.querySelector("img");
    const asset = parseImageAsset(image);
    if (!asset) {
        return undefined;
    }

    return {
        ...asset,
        quantity: parseTrailingQuantity(container.textContent),
    };
}

function parseRequiredFilmAsset(container: Element | undefined): SupportMemoryDokkanInfoRequiredFilmRef | undefined {
    const asset = parseQuantityAsset(container);
    if (!asset) {
        return undefined;
    }

    return {
        ...asset,
        filmCode: parseSupportFilmCode(container?.querySelector("img")?.getAttribute("alt")),
    };
}

function parseEnhancementItems(container: Element | undefined): SupportMemoryDokkanInfoEnhancementItem[] {
    if (!container) {
        return [];
    }

    const items = Array.from(container.querySelectorAll(".row .col"))
        .map(column => {
            const image = column.querySelector("img");
            const id = cleanInlineText(image?.getAttribute("alt"));
            const asset = parseImageAsset(image);
            if (!id || !asset) {
                return undefined;
            }

            return {
                id,
                quantity: parseTrailingQuantity(column.textContent),
                asset,
            };
        })
        .filter(Boolean);

    return items as SupportMemoryDokkanInfoEnhancementItem[];
}

function parseImageAsset(image: Element | null | undefined): SupportMemoryDokkanInfoAssetRef | undefined {
    const source = cleanInlineText(image?.getAttribute("src"));
    if (!source) {
        return undefined;
    }

    return {
        remoteUrl: absolutizeDokkanInfoUrl(source),
    };
}

function buildAnimationAssetSet(id: string): SupportMemoryDokkanInfoAnimationAssetSet {
    const remoteBaseUrl = `${DOKKAN_INFO_GLOBAL_BASE_URL}/assets/global/en/ingame/battle/effect/support_memory_${id}/en/`;
    return {
        sourceType: "lwf",
        status: "pending",
        remoteBaseUrl,
        lwf: {
            remoteUrl: `${remoteBaseUrl}support_memory_${id}.lwf`,
        },
        textures: [],
    };
}

function parseSupportFilmCode(value: string | null | undefined): string | undefined {
    const normalized = cleanInlineText(value);
    const match = normalized.match(/^support_memory_film_(.+)$/i);
    return match?.[1];
}

function parseTrailingQuantity(value: string | null | undefined): number | undefined {
    const match = cleanInlineText(value).match(/x(\d+)\s*$/i);
    return match ? parseInt(match[1], 10) : undefined;
}

function absolutizeDokkanInfoUrl(value: string): string {
    return value.startsWith("http")
        ? value
        : new URL(value, DOKKAN_INFO_BASE_URL).toString();
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

function requestedSupportMemoryIds(): string[] | undefined {
    const ids = cleanInlineText(process.env.DOKKANINFO_SUPPORT_MEMORY_IDS)
        .split(",")
        .map(value => cleanInlineText(value))
        .filter(Boolean);

    return ids.length ? ids : undefined;
}

function requestedSupportMemoryLimit(): number | undefined {
    const value = parseInt(process.env.DOKKANINFO_SUPPORT_MEMORY_LIMIT ?? "", 10);
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
