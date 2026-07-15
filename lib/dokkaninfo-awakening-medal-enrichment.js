"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseAwakeningItemsComponentProps = exports.writeDokkanInfoAwakeningMedalEnrichment = exports.getDokkanInfoAwakeningMedalEnrichment = void 0;
const child_process_1 = require("child_process");
const promises_1 = require("fs/promises");
const jsdom_1 = require("jsdom");
const path_1 = require("path");
const util_1 = require("util");
const format_json_1 = require("./format-json");
const DOKKAN_INFO_BASE_URL = "https://dokkaninfo.com";
const DOKKAN_INFO_AWAKENING_ITEMS_URL = `${DOKKAN_INFO_BASE_URL}/items/awakeningitems`;
const AWAKENING_MEDAL_OUTPUT_DIR = "data/awakening-medals/latest";
const AWAKENING_MEDAL_ASSET_DIR = "data/awakening-medals/assets/dokkaninfo";
const AWAKENING_MEDAL_DOWNLOAD_CONCURRENCY = 12;
const execFileAsync = (0, util_1.promisify)(child_process_1.execFile);
async function getDokkanInfoAwakeningMedalEnrichment() {
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
exports.getDokkanInfoAwakeningMedalEnrichment = getDokkanInfoAwakeningMedalEnrichment;
async function writeDokkanInfoAwakeningMedalEnrichment(dataset) {
    const resolvedDataset = dataset ?? await getDokkanInfoAwakeningMedalEnrichment();
    const outputDir = (0, path_1.resolve)(__dirname, AWAKENING_MEDAL_OUTPUT_DIR);
    const outputPath = (0, path_1.resolve)(outputDir, "awakening-medal-dokkaninfo-enrichment.json");
    await (0, promises_1.mkdir)(outputDir, { recursive: true });
    await downloadAwakeningMedalAssets(resolvedDataset.entries);
    await (0, format_json_1.writeFormattedJson)(outputPath, resolvedDataset);
    return outputPath;
}
exports.writeDokkanInfoAwakeningMedalEnrichment = writeDokkanInfoAwakeningMedalEnrichment;
function parseAwakeningItemsComponentProps(html) {
    const document = new jsdom_1.JSDOM(html).window.document;
    const element = document.querySelector("awakening-items");
    if (!element) {
        throw new Error("Could not locate awakening-items component in DokkanInfo HTML.");
    }
    const rawGroups = element.getAttribute("v-bind:awakening_items_rarities");
    if (!rawGroups) {
        throw new Error("Could not locate awakening item rarity payload in DokkanInfo HTML.");
    }
    return {
        awakeningItemsRarities: JSON.parse(rawGroups),
        language: cleanInlineText(element.getAttribute("language")) || "English",
        version: cleanInlineText(element.getAttribute("version")) || "global",
        versionLanguage: cleanInlineText(element.getAttribute("version_language")) || "/en/",
    };
}
exports.parseAwakeningItemsComponentProps = parseAwakeningItemsComponentProps;
function buildEntriesForRarityGroup(group, props) {
    const rarityBucket = toOptionalNumber(group.rarity) ?? 0;
    return (group.awakeningItem ?? [])
        .map(item => buildEntry(item, rarityBucket, props))
        .filter((entry) => Boolean(entry));
}
function buildEntry(item, rarityBucket, props) {
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
async function downloadAwakeningMedalAssets(entries) {
    await mapWithConcurrency(entries, AWAKENING_MEDAL_DOWNLOAD_CONCURRENCY, async (entry) => {
        if (!entry.thumbnailAsset) {
            return;
        }
        const medalDir = (0, path_1.resolve)(__dirname, AWAKENING_MEDAL_ASSET_DIR, entry.id);
        await (0, promises_1.mkdir)(medalDir, { recursive: true });
        entry.thumbnailAsset.localPath = await downloadAsset(entry.thumbnailAsset.remoteUrl, (0, path_1.resolve)(medalDir, "thumb.png"), entry.detailUrl);
    });
}
function buildThumbnailAsset(props, paddedId) {
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
async function downloadAsset(remoteUrl, absolutePath, refererUrl) {
    await (0, promises_1.mkdir)((0, path_1.dirname)(absolutePath), { recursive: true });
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
function sanitizeVersionLanguageSegment(value) {
    return cleanInlineText(value).replace(/^\/+|\/+$/g, "");
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
function toOptionalNumber(value) {
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
function requestedAwakeningMedalIds() {
    const ids = cleanInlineText(process.env.DOKKANINFO_AWAKENING_MEDAL_IDS)
        .split(",")
        .map(value => cleanInlineText(value))
        .filter(Boolean);
    return ids.length ? ids : undefined;
}
function requestedAwakeningMedalLimit() {
    const value = parseInt(process.env.DOKKANINFO_AWAKENING_MEDAL_LIMIT ?? "", 10);
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
//# sourceMappingURL=dokkaninfo-awakening-medal-enrichment.js.map