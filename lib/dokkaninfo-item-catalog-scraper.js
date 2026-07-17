"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseDokkanInfoItemCategory = exports.buildDokkanInfoItemCatalogManifest = exports.writeDokkanInfoItemCatalog = exports.getDokkanInfoItemCatalog = exports.DEFAULT_ITEM_CATEGORIES = void 0;
const crypto_1 = require("crypto");
const child_process_1 = require("child_process");
const promises_1 = require("fs/promises");
const jsdom_1 = require("jsdom");
const path_1 = require("path");
const util_1 = require("util");
const scraper_1 = require("./scraper");
const format_json_1 = require("./format-json");
const DOKKAN_INFO_BASE_URL = "https://dokkaninfo.com";
const OUTPUT_DIR = "data/dokkaninfo-items/latest";
const ITEM_CATALOG_FILE_NAME = "item-catalog.json";
const ITEM_CATALOG_MANIFEST_FILE_NAME = "item-catalog-manifest.json";
const CACHE_DIR = "data/dokkaninfo-items/cache";
const ASSET_DIR = "data/dokkaninfo-items/assets";
const DEFAULT_CACHE_TTL_HOURS = 24;
const DEFAULT_REQUEST_CONCURRENCY = 4;
const DEFAULT_ASSET_CONCURRENCY = 12;
const execFileAsync = (0, util_1.promisify)(child_process_1.execFile);
exports.DEFAULT_ITEM_CATEGORIES = [
    { slug: "actitems", itemType: "ActItem", name: "Act Items" },
    { slug: "keys", itemType: "KeyItem", name: "Keys" },
    { slug: "potentialitems", itemType: "PotentialItem", name: "Potential Items" },
    { slug: "specialitems", itemType: "SpecialItem", name: "Special Items" },
    { slug: "stickers", itemType: "StickerItem", name: "Stickers" },
    { slug: "supportitems", itemType: "SupportItem", name: "Support Items" },
    { slug: "trainingfields", itemType: "TrainingField", name: "Training Fields" },
    { slug: "trainingitems", itemType: "TrainingItem", name: "Training Items" },
    { slug: "treasureitems", itemType: "TreasureItem", name: "Treasure Items" },
];
async function getDokkanInfoItemCatalog() {
    const categories = requestedCategories();
    const failedCategorySlugs = [];
    const parsedCategories = await mapWithConcurrency(categories, requestedConcurrency(), async (config) => {
        try {
            const html = await fetchCategoryHtml(config);
            return parseDokkanInfoItemCategory(html, config);
        }
        catch (error) {
            failedCategorySlugs.push(config.slug);
            console.error(`[DOKKANINFO-ITEMS] Failed ${config.slug}: ${errorMessage(error)}`);
            return undefined;
        }
    });
    const resolvedCategories = parsedCategories
        .filter((category) => Boolean(category))
        .sort((left, right) => left.slug.localeCompare(right.slug));
    if (downloadAssetsEnabled()) {
        await downloadCategoryAssets(resolvedCategories);
    }
    const sortedFailedCategorySlugs = Array.from(new Set(failedCategorySlugs)).sort();
    return {
        generatedAt: new Date().toISOString(),
        source: "dokkaninfo",
        categoryCount: resolvedCategories.length,
        itemCount: resolvedCategories.reduce((sum, category) => sum + category.count, 0),
        failedCategorySlugs: sortedFailedCategorySlugs,
        categories: resolvedCategories,
    };
}
exports.getDokkanInfoItemCatalog = getDokkanInfoItemCatalog;
async function writeDokkanInfoItemCatalog(dataset) {
    const resolvedDataset = dataset ?? await getDokkanInfoItemCatalog();
    const outputDir = (0, path_1.resolve)(__dirname, OUTPUT_DIR);
    const outputPath = (0, path_1.resolve)(outputDir, ITEM_CATALOG_FILE_NAME);
    const manifestPath = (0, path_1.resolve)(outputDir, ITEM_CATALOG_MANIFEST_FILE_NAME);
    await (0, promises_1.mkdir)(outputDir, { recursive: true });
    await (0, format_json_1.writeFormattedJson)(outputPath, resolvedDataset);
    const catalogBuffer = await (0, promises_1.readFile)(outputPath);
    const manifest = buildDokkanInfoItemCatalogManifest(resolvedDataset, catalogBuffer);
    await (0, promises_1.writeFile)(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
    return outputPath;
}
exports.writeDokkanInfoItemCatalog = writeDokkanInfoItemCatalog;
function buildDokkanInfoItemCatalogManifest(dataset, catalogBuffer) {
    return {
        schemaVersion: 1,
        datasetVersion: dataset.generatedAt,
        generatedAt: dataset.generatedAt,
        fileName: ITEM_CATALOG_FILE_NAME,
        compression: "none",
        sha256: (0, crypto_1.createHash)("sha256").update(catalogBuffer).digest("hex"),
        sizeBytes: catalogBuffer.byteLength,
        itemCount: dataset.itemCount,
        categoryCount: dataset.categoryCount,
    };
}
exports.buildDokkanInfoItemCatalogManifest = buildDokkanInfoItemCatalogManifest;
function parseDokkanInfoItemCategory(html, config) {
    const document = new jsdom_1.JSDOM(html).window.document;
    const roots = findItemRoots(document, config);
    const items = roots
        .map(root => parseItemRoot(root, config))
        .filter((item) => Boolean(item));
    const uniqueItems = Array.from(new Map(items.map(item => [item.key, item])).values())
        .sort((left, right) => left.name.localeCompare(right.name) || left.id.localeCompare(right.id));
    const limit = requestedLimit();
    const limitedItems = uniqueItems.slice(0, limit ?? Number.MAX_SAFE_INTEGER);
    return {
        slug: config.slug,
        itemType: config.itemType,
        name: config.name,
        sourcePath: `${DOKKAN_INFO_BASE_URL}/items/${config.slug}`,
        count: limitedItems.length,
        items: limitedItems,
    };
}
exports.parseDokkanInfoItemCategory = parseDokkanInfoItemCategory;
function findItemRoots(document, config) {
    const roots = new Set();
    for (const image of Array.from(document.querySelectorAll("img"))) {
        if (!isPrimaryItemImage(image, config)) {
            continue;
        }
        const root = image.closest("a[href*='/items/trainingfields/']")
            ?? image.closest(".row.align-items-center")
            ?? image.closest(".col-md.bg-main")
            ?? image.parentElement;
        if (root) {
            roots.add(root);
        }
    }
    return Array.from(roots);
}
function parseItemRoot(root, config) {
    const image = Array.from(root.querySelectorAll("img")).find(candidate => isPrimaryItemImage(candidate, config));
    if (!image) {
        return undefined;
    }
    const sourcePath = root.closest("a[href]")?.getAttribute("href")
        ? absoluteUrl(root.closest("a[href]")?.getAttribute("href"))
        : `${DOKKAN_INFO_BASE_URL}/items/${config.slug}`;
    const id = itemIdFromRoot(root, image, config);
    const name = itemNameFromRoot(root);
    if (!id || !name) {
        return undefined;
    }
    const icon = assetFromImage(image);
    const backgroundImage = Array.from(root.querySelectorAll("img"))
        .find(candidate => candidate !== image && isBackgroundImage(candidate));
    const description = itemDescriptionFromRoot(root, name);
    const value = itemValueFromRoot(root, config);
    return {
        key: `${config.itemType}:${id}`,
        id,
        itemType: config.itemType,
        category: config.slug,
        name,
        description,
        value,
        sourcePath,
        icon,
        background: backgroundImage ? assetFromImage(backgroundImage) : undefined,
    };
}
function isPrimaryItemImage(image, config) {
    const src = image.getAttribute("src") ?? "";
    const normalized = src.toLocaleLowerCase();
    if (!normalized || normalized.includes("logo") || normalized.includes("venatus")) {
        return false;
    }
    if (normalized.includes("thumb_bg") || normalized.includes("sticker_thumb_bg") || normalized.includes("training_thumb_bg")) {
        return false;
    }
    const categoryMarkers = {
        actitems: ["/item/act/"],
        keys: ["/item/eventkagi/"],
        potentialitems: ["/item/other/"],
        specialitems: ["/item/other/"],
        stickers: ["/item/sticker/"],
        supportitems: ["/item/support/"],
        trainingfields: ["/item/training_field/"],
        trainingitems: ["/item/training_item/"],
        treasureitems: ["/item/other/"],
    };
    return categoryMarkers[config.slug].some(marker => normalized.includes(marker));
}
function isBackgroundImage(image) {
    const src = (image.getAttribute("src") ?? "").toLocaleLowerCase();
    return src.includes("thumb_bg") || src.includes("sticker_thumb_bg") || src.includes("training_thumb_bg");
}
function itemIdFromRoot(root, image, config) {
    const hrefMatch = root.closest("a[href]")?.getAttribute("href")?.match(/\/trainingfields\/(\d+)/i);
    if (hrefMatch) {
        return hrefMatch[1];
    }
    const alt = cleanInlineText(image.getAttribute("alt"));
    if (alt && /^\d+$/.test(alt)) {
        return String(parseInt(alt, 10));
    }
    const src = image.getAttribute("src") ?? "";
    const matches = Array.from(src.matchAll(/(?:^|[_-])(\d+)(?:\.[a-z]+|\/|$)/gi));
    const last = matches.at(-1)?.[1];
    if (!last) {
        return undefined;
    }
    return String(parseInt(last, 10));
}
function itemNameFromRoot(root) {
    const nameElement = root.querySelector(".font-size-1_5")
        ?? root.querySelector("b")
        ?? root.querySelector(".font-size-1_2");
    return cleanInlineText(nameElement?.textContent) || undefined;
}
function itemDescriptionFromRoot(root, name) {
    const candidates = Array.from(root.querySelectorAll(".font-size-1_2, .font-size-1, .font-size-1_5"))
        .map(element => cleanMultilineText(element.textContent))
        .filter(text => Boolean(text) && text !== name);
    return candidates.find(text => !/^\d[\d,]*$/.test(text)) || undefined;
}
function itemValueFromRoot(root, config) {
    if (config.slug !== "trainingitems" && config.slug !== "trainingfields") {
        return undefined;
    }
    const candidates = Array.from(root.querySelectorAll(".font-size-1_2, .font-size-1, .font-size-1_5"))
        .map(element => cleanInlineText(element.textContent))
        .map(text => text.replace(/,/g, ""))
        .map(text => /^\d+$/.test(text) ? Number(text) : undefined)
        .filter((value) => value !== undefined);
    return candidates.at(-1);
}
function assetFromImage(image) {
    return { remoteUrl: absoluteUrl(image.getAttribute("src") ?? "") };
}
async function fetchCategoryHtml(config) {
    const cachePath = (0, path_1.resolve)(__dirname, CACHE_DIR, `${config.slug}.html`);
    if (!refreshEnabled()) {
        const cached = await readCache(cachePath);
        if (cached) {
            return cached;
        }
    }
    const document = await (0, scraper_1.fetchFromWeb)(`${DOKKAN_INFO_BASE_URL}/items/${config.slug}`);
    const html = document.documentElement.outerHTML;
    await (0, promises_1.mkdir)((0, path_1.dirname)(cachePath), { recursive: true });
    await (0, promises_1.writeFile)(cachePath, html, "utf8");
    return html;
}
async function downloadCategoryAssets(categories) {
    const items = categories.flatMap(category => category.items);
    await mapWithConcurrency(items, requestedAssetConcurrency(), async (item) => {
        const itemDir = (0, path_1.resolve)(__dirname, ASSET_DIR, item.category, item.id);
        if (item.icon) {
            item.icon.localPath = await downloadAsset(item.icon.remoteUrl, (0, path_1.resolve)(itemDir, "icon.png"), item.sourcePath);
        }
        if (item.background) {
            item.background.localPath = await downloadAsset(item.background.remoteUrl, (0, path_1.resolve)(itemDir, "background.png"), item.sourcePath);
        }
    });
}
async function downloadAsset(remoteUrl, absolutePath, refererUrl) {
    await (0, promises_1.mkdir)((0, path_1.dirname)(absolutePath), { recursive: true });
    if (await fileExists(absolutePath)) {
        return projectRelativePath(absolutePath);
    }
    const response = await fetch(remoteUrl, { headers: browserHeaders(refererUrl) });
    if (response.ok) {
        await (0, promises_1.writeFile)(absolutePath, Buffer.from(await response.arrayBuffer()));
        return projectRelativePath(absolutePath);
    }
    try {
        await execFileAsync("curl.exe", [
            "--fail", "-L", "-A", browserHeaders(refererUrl)["User-Agent"],
            "-H", `Referer: ${refererUrl}`, "-H", "Accept: */*", "-o", absolutePath, remoteUrl,
        ]);
        return projectRelativePath(absolutePath);
    }
    catch (error) {
        throw new Error(`Could not download item asset ${remoteUrl}: ${errorMessage(error)}`);
    }
}
async function readCache(cachePath) {
    try {
        const stats = await Promise.resolve().then(() => require("fs/promises")).then(fs => fs.stat(cachePath));
        if (Date.now() - stats.mtimeMs > cacheTtlMs()) {
            return undefined;
        }
        return await (0, promises_1.readFile)(cachePath, "utf8");
    }
    catch {
        return undefined;
    }
}
function requestedCategories() {
    const raw = process.env.DOKKANINFO_ITEM_CATEGORIES;
    if (!raw) {
        return exports.DEFAULT_ITEM_CATEGORIES;
    }
    const requested = new Set(raw.split(",").map(value => value.trim()).filter(Boolean));
    return exports.DEFAULT_ITEM_CATEGORIES.filter(category => requested.has(category.slug));
}
function requestedLimit() {
    const value = Number.parseInt(process.env.DOKKANINFO_ITEM_LIMIT ?? "", 10);
    return Number.isFinite(value) && value > 0 ? value : undefined;
}
function requestedConcurrency() {
    return positiveEnvNumber("DOKKANINFO_ITEM_CONCURRENCY", DEFAULT_REQUEST_CONCURRENCY);
}
function requestedAssetConcurrency() {
    return positiveEnvNumber("DOKKANINFO_ITEM_ASSET_CONCURRENCY", DEFAULT_ASSET_CONCURRENCY);
}
function downloadAssetsEnabled() {
    return (process.env.DOKKANINFO_ITEM_DOWNLOAD_ASSETS ?? "true").toLocaleLowerCase() !== "false";
}
function refreshEnabled() {
    return process.env.DOKKANINFO_ITEM_REFRESH === "true";
}
function cacheTtlMs() {
    const hours = Number.parseFloat(process.env.DOKKANINFO_ITEM_CACHE_TTL_HOURS ?? `${DEFAULT_CACHE_TTL_HOURS}`);
    return (Number.isFinite(hours) ? Math.max(0, hours) : DEFAULT_CACHE_TTL_HOURS) * 60 * 60 * 1000;
}
function positiveEnvNumber(name, fallback) {
    const value = Number.parseInt(process.env[name] ?? "", 10);
    return Number.isFinite(value) && value > 0 ? value : fallback;
}
function cleanInlineText(value) {
    return (value ?? "").replace(/\s+/g, " ").trim();
}
function cleanMultilineText(value) {
    return (value ?? "").replace(/\r/g, "").split("\n").map(line => line.trim()).filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
}
function absoluteUrl(path) {
    return new URL(path, `${DOKKAN_INFO_BASE_URL}/`).toString();
}
function projectRelativePath(path) {
    return path.replace(`${(0, path_1.resolve)(__dirname)}\\`, "").replace(/\\/g, "/");
}
function browserHeaders(referer) {
    return {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0 Safari/537.36",
        Referer: referer,
        Accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
    };
}
async function fileExists(path) {
    try {
        await (0, promises_1.access)(path);
        return true;
    }
    catch {
        return false;
    }
}
async function mapWithConcurrency(values, concurrency, mapper) {
    const results = new Array(values.length);
    let nextIndex = 0;
    async function worker() {
        while (true) {
            const index = nextIndex++;
            if (index >= values.length) {
                return;
            }
            results[index] = await mapper(values[index], index);
        }
    }
    await Promise.all(Array.from({ length: Math.min(concurrency, Math.max(values.length, 1)) }, () => worker()));
    return results;
}
function errorMessage(error) {
    return error instanceof Error ? error.message : String(error);
}
//# sourceMappingURL=dokkaninfo-item-catalog-scraper.js.map