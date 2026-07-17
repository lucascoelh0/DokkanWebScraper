"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractLwfTextureFileNames = exports.parseDokkanInfoSupportMemoryRow = exports.parseDokkanInfoSupportMemoryList = exports.writeDokkanInfoSupportMemoryEnrichment = exports.getDokkanInfoSupportMemoryEnrichment = void 0;
const child_process_1 = require("child_process");
const promises_1 = require("fs/promises");
const jsdom_1 = require("jsdom");
const path_1 = require("path");
const util_1 = require("util");
const format_json_1 = require("./format-json");
const support_memory_dokkaninfo_enrichment_1 = require("./support-memory-dokkaninfo-enrichment");
const DOKKAN_INFO_BASE_URL = "https://dokkaninfo.com";
const DOKKAN_INFO_GLOBAL_BASE_URL = "https://glben.dokkaninfo.com";
const DOKKAN_INFO_SUPPORT_MEMORIES_URL = `${DOKKAN_INFO_BASE_URL}/items/supportmemories`;
const SUPPORT_MEMORY_OUTPUT_DIR = "data/support-memories/latest";
const SUPPORT_MEMORY_ASSET_DIR = "data/support-memories/assets/dokkaninfo";
const SUPPORT_MEMORY_DOWNLOAD_CONCURRENCY = 8;
const execFileAsync = (0, util_1.promisify)(child_process_1.execFile);
async function getDokkanInfoSupportMemoryEnrichment() {
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
exports.getDokkanInfoSupportMemoryEnrichment = getDokkanInfoSupportMemoryEnrichment;
async function writeDokkanInfoSupportMemoryEnrichment(dataset) {
    const resolvedDataset = dataset ?? await getDokkanInfoSupportMemoryEnrichment();
    const outputDir = (0, path_1.resolve)(__dirname, SUPPORT_MEMORY_OUTPUT_DIR);
    const outputPath = (0, path_1.resolve)(outputDir, "support-memory-dokkaninfo-enrichment.json");
    await (0, promises_1.mkdir)(outputDir, { recursive: true });
    await downloadSupportMemoryAssets(resolvedDataset.entries);
    await (0, format_json_1.writeFormattedJson)(outputPath, resolvedDataset);
    return outputPath;
}
exports.writeDokkanInfoSupportMemoryEnrichment = writeDokkanInfoSupportMemoryEnrichment;
function parseDokkanInfoSupportMemoryList(html) {
    const rowPattern = /<a href="https:\/\/dokkaninfo\.com\/items\/supportmemories\/(\d+)" class="row[\s\S]*?<\/a>/g;
    const rows = Array.from(html.matchAll(rowPattern));
    return rows.map(match => parseDokkanInfoSupportMemoryRow(match[1], match[0]));
}
exports.parseDokkanInfoSupportMemoryList = parseDokkanInfoSupportMemoryList;
function parseDokkanInfoSupportMemoryRow(id, rowHtml) {
    const document = new jsdom_1.JSDOM(`<body>${rowHtml.trim()}</body>`).window.document;
    const anchor = document.querySelector("a");
    if (!anchor) {
        throw new Error(`Could not parse support memory row ${id}.`);
    }
    const detailUrl = cleanInlineText(anchor.getAttribute("href")) || `${DOKKAN_INFO_BASE_URL}/items/supportmemories/${id}`;
    const columns = Array.from(anchor.children);
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
exports.parseDokkanInfoSupportMemoryRow = parseDokkanInfoSupportMemoryRow;
function extractLwfTextureFileNames(buffer) {
    const text = buffer.toString("latin1");
    const matches = Array.from(text.matchAll(/[A-Za-z0-9_%./-]+\.png/g))
        .map(match => cleanInlineText(match[0]))
        .filter(Boolean);
    return Array.from(new Set(matches))
        .filter(name => name !== "_empty")
        .sort((left, right) => left.localeCompare(right));
}
exports.extractLwfTextureFileNames = extractLwfTextureFileNames;
async function downloadSupportMemoryAssets(entries) {
    await mapWithConcurrency(entries, SUPPORT_MEMORY_DOWNLOAD_CONCURRENCY, async (entry) => {
        const memoryDir = (0, path_1.resolve)(__dirname, SUPPORT_MEMORY_ASSET_DIR, entry.id);
        await (0, promises_1.mkdir)(memoryDir, { recursive: true });
        if (entry.largeAsset) {
            entry.largeAsset.localPath = await downloadAsset(entry.largeAsset.remoteUrl, (0, path_1.resolve)(memoryDir, "large.png"), entry.detailUrl);
        }
        if (entry.completeAsset) {
            entry.completeAsset.localPath = await downloadAsset(entry.completeAsset.remoteUrl, (0, path_1.resolve)(memoryDir, "complete.png"), entry.detailUrl);
        }
        if (entry.requiredFilm) {
            entry.requiredFilm.localPath = await downloadAsset(entry.requiredFilm.remoteUrl, (0, path_1.resolve)(memoryDir, "film.png"), entry.detailUrl);
        }
        if (entry.enhancementItems.length > 0) {
            const enhancementDir = (0, path_1.resolve)(memoryDir, "enhancements");
            await (0, promises_1.mkdir)(enhancementDir, { recursive: true });
            for (const item of entry.enhancementItems) {
                item.asset.localPath = await downloadAsset(item.asset.remoteUrl, (0, path_1.resolve)(enhancementDir, `${item.id}.png`), entry.detailUrl);
            }
        }
        if (entry.animation) {
            try {
                await downloadAnimationAssets(entry, entry.animation);
            }
            catch (error) {
                console.warn(`Could not mirror support memory animation ${entry.id}: ${error.message}`);
                entry.animation.status = "unavailable";
                entry.animation.failureReason = error.message;
                entry.animation.localDirectory = undefined;
                entry.animation.lwf.localPath = undefined;
                entry.animation.textures = [];
            }
        }
    });
}
async function downloadAnimationAssets(entry, animation) {
    const animationDir = (0, path_1.resolve)(__dirname, SUPPORT_MEMORY_ASSET_DIR, entry.id, "animation");
    await (0, promises_1.mkdir)(animationDir, { recursive: true });
    const lwfAbsolutePath = (0, path_1.resolve)(animationDir, `support_memory_${entry.id}.lwf`);
    animation.lwf.localPath = await downloadAsset(animation.lwf.remoteUrl, lwfAbsolutePath, entry.detailUrl, true);
    const lwfBuffer = await (0, promises_1.readFile)(lwfAbsolutePath);
    const textureFileNames = resolveAnimationTextureFileNames(entry.id, extractLwfTextureFileNames(lwfBuffer));
    animation.textures = [];
    const failedTextures = [];
    for (const textureFileName of textureFileNames) {
        const remoteUrl = `${animation.remoteBaseUrl}${textureFileName}`;
        try {
            const localPath = await downloadAsset(remoteUrl, (0, path_1.resolve)(animationDir, textureFileName), entry.detailUrl, true);
            animation.textures.push({
                remoteUrl,
                localPath,
            });
        }
        catch (error) {
            failedTextures.push(`${textureFileName}: ${error.message}`);
        }
    }
    animation.status = failedTextures.length > 0 ? "partial" : "mirrored";
    animation.failureReason = failedTextures.length > 0
        ? `Could not mirror ${failedTextures.length} texture(s): ${failedTextures.join("; ")}`
        : undefined;
    animation.localDirectory = toProjectRelativePath(animationDir);
}
function resolveAnimationTextureFileNames(memoryId, fileNames) {
    const externalTextures = fileNames.filter(name => name.startsWith(`support_memory_${memoryId}_`));
    return externalTextures.length ? externalTextures : fileNames;
}
async function downloadAsset(remoteUrl, absolutePath, refererUrl, useCurl = false) {
    await (0, promises_1.mkdir)((0, path_1.dirname)(absolutePath), { recursive: true });
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
    await (0, promises_1.writeFile)(absolutePath, buffer);
    return toProjectRelativePath(absolutePath);
}
async function downloadBinaryWithCurl(remoteUrl, absolutePath, refererUrl) {
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
    }
    catch (error) {
        throw new Error(summarizeCurlError(error, remoteUrl));
    }
}
async function fetchDokkanInfoHtml(url, label, retries = 3) {
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
async function fetchDokkanInfoHtmlWithCurl(url) {
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
function parseLevelDescriptions(container) {
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
        .filter((value) => Boolean(value))
        .sort((left, right) => left.level - right.level);
}
function parseQuantityAsset(container) {
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
function parseRequiredFilmAsset(container) {
    const asset = parseQuantityAsset(container);
    if (!asset) {
        return undefined;
    }
    return {
        ...asset,
        filmCode: parseSupportFilmCode(container?.querySelector("img")?.getAttribute("alt")),
    };
}
function parseEnhancementItems(container) {
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
            itemType: "SupportMemoryEnhancementItem",
            itemKey: (0, support_memory_dokkaninfo_enrichment_1.supportMemoryEnhancementItemKey)(id),
            id,
            quantity: parseTrailingQuantity(column.textContent),
            asset,
        };
    })
        .filter(Boolean);
    return items;
}
function parseImageAsset(image) {
    const source = cleanInlineText(image?.getAttribute("src"));
    if (!source) {
        return undefined;
    }
    return {
        remoteUrl: absolutizeDokkanInfoUrl(source),
    };
}
function buildAnimationAssetSet(id) {
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
function parseSupportFilmCode(value) {
    const normalized = cleanInlineText(value);
    const match = normalized.match(/^support_memory_film_(.+)$/i);
    return match?.[1];
}
function parseTrailingQuantity(value) {
    const match = cleanInlineText(value).match(/x(\d+)\s*$/i);
    return match ? parseInt(match[1], 10) : undefined;
}
function absolutizeDokkanInfoUrl(value) {
    return value.startsWith("http")
        ? value
        : new URL(value, DOKKAN_INFO_BASE_URL).toString();
}
function browserHeaders(refererUrl) {
    return {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9",
        "Cache-Control": "no-cache",
        "Pragma": "no-cache",
        "Referer": refererUrl,
    };
}
function cleanInlineText(value) {
    return cleanMultilineText(value).replace(/\s*\n\s*/g, " ").trim();
}
function cleanMultilineText(value) {
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
function toProjectRelativePath(absolutePath) {
    return (0, path_1.relative)((0, path_1.resolve)(__dirname), absolutePath).replace(/\\/g, "/");
}
async function fileExists(absolutePath) {
    try {
        await (0, promises_1.access)(absolutePath);
        return true;
    }
    catch (error) {
        return false;
    }
}
function shouldRetryStatus(status) {
    return status === 429 || status >= 500;
}
function summarizeCurlError(error, remoteUrl) {
    const message = error instanceof Error ? error.message : String(error);
    const statusMatch = message.match(/curl:\s+\((\d+)\)/i);
    if (statusMatch?.[1] === "22") {
        return `curl returned HTTP error for ${remoteUrl}`;
    }
    return `curl failed for ${remoteUrl}`;
}
function requestedSupportMemoryIds() {
    const ids = cleanInlineText(process.env.DOKKANINFO_SUPPORT_MEMORY_IDS)
        .split(",")
        .map(value => cleanInlineText(value))
        .filter(Boolean);
    return ids.length ? ids : undefined;
}
function requestedSupportMemoryLimit() {
    const value = parseInt(process.env.DOKKANINFO_SUPPORT_MEMORY_LIMIT ?? "", 10);
    return Number.isFinite(value) && value > 0 ? value : undefined;
}
async function mapWithConcurrency(values, concurrency, mapper) {
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
function delay(ms) {
    return new Promise(resolveDelay => setTimeout(resolveDelay, ms));
}
//# sourceMappingURL=dokkaninfo-support-memory-enrichment.js.map