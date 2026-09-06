"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateAwakeningMedalCatalog = exports.buildAwakeningMedalDelivery = exports.buildAwakeningMedalCatalog = exports.AWAKENING_MEDAL_CONTRACT_VERSION = exports.AWAKENING_MEDAL_CONTRACT = void 0;
const crypto_1 = require("crypto");
const zlib_1 = require("zlib");
const game_db_source_1 = require("./game-db-source");
exports.AWAKENING_MEDAL_CONTRACT = "dokkan-awakening-medal-catalog";
exports.AWAKENING_MEDAL_CONTRACT_VERSION = "1.0.0";
const RARITIES = ["bronze", "silver", "gold", "rainbow", "super"];
const RARITY_BY_RAW = {
    0: "bronze",
    1: "silver",
    2: "gold",
    3: "rainbow",
    4: "super",
};
function buildAwakeningMedalCatalog(options) {
    requireIsoDate(options.generatedAt);
    requireNonEmpty(options.sourceSnapshotVersion, "source snapshot version");
    if (!/^[a-f0-9]{64}$/.test(options.sourceDatabaseSha256)) {
        throw new Error("Awakening Medal source database SHA-256 is invalid");
    }
    if (!/^https:\/\/[^\s]+$/.test(options.assetBaseUrl)) {
        throw new Error("Awakening Medal asset base URL must be HTTPS");
    }
    const seen = new Set();
    const items = options.rows.map((row, index) => {
        const id = (0, game_db_source_1.normalizeDbId)(row.id);
        if (!id || !/^[1-9]\d*$/.test(id))
            throw new Error(`awakening_items[${index}].id must be a canonical positive numeric ID`);
        if (seen.has(id))
            throw new Error(`Duplicate Awakening Medal ID ${id}`);
        seen.add(id);
        const rarityRaw = requireInteger(row.rarity, `awakening_items[${index}].rarity`, 0, 4);
        const rarity = RARITY_BY_RAW[rarityRaw];
        return {
            id,
            name: requireNonEmpty(row.name, `awakening_items[${index}].name`),
            description: requireNonEmpty(row.description, `awakening_items[${index}].description`),
            rarity,
            rarityRaw,
            zeni: requireInteger(row.zeni, `awakening_items[${index}].zeni`, 0),
            sellingExchangePoint: requireInteger(row.selling_exchange_point, `awakening_items[${index}].selling_exchange_point`, 0),
            eventJumpable: requireBooleanInteger(row.event_jumpable, `awakening_items[${index}].event_jumpable`),
            iconAssetPath: `item/awaken/en/thumb/thumb_awaken_items_${id.padStart(5, "0")}/thumb_awaken_items_${id.padStart(5, "0")}.png`,
        };
    }).sort((left, right) => Number(left.id) - Number(right.id));
    if (items.length === 0)
        throw new Error("Awakening Medal catalog must not be empty");
    const countsByRarity = Object.fromEntries(RARITIES.map(rarity => [
        rarity,
        items.filter(item => item.rarity === rarity).length,
    ]));
    const identity = JSON.stringify({
        sourceSnapshotVersion: options.sourceSnapshotVersion,
        sourceDatabaseSha256: options.sourceDatabaseSha256,
        assetBaseUrl: options.assetBaseUrl.replace(/\/+$/, ""),
        items,
    });
    const datasetVersion = `${options.sourceSnapshotVersion}-${(0, crypto_1.createHash)("sha256").update(identity).digest("hex").slice(0, 12)}`;
    const catalog = {
        schemaVersion: 1,
        contract: exports.AWAKENING_MEDAL_CONTRACT,
        contractVersion: exports.AWAKENING_MEDAL_CONTRACT_VERSION,
        datasetVersion,
        generatedAt: options.generatedAt,
        source: "dokkan-game-db",
        sourceSnapshotVersion: options.sourceSnapshotVersion,
        sourceDatabaseSha256: options.sourceDatabaseSha256,
        assetBaseUrl: options.assetBaseUrl.replace(/\/+$/, ""),
        count: items.length,
        countsByRarity,
        items,
    };
    validateAwakeningMedalCatalog(catalog);
    return catalog;
}
exports.buildAwakeningMedalCatalog = buildAwakeningMedalCatalog;
function buildAwakeningMedalDelivery(catalog, compressionLevel = 9) {
    validateAwakeningMedalCatalog(catalog);
    if (!Number.isSafeInteger(compressionLevel) || compressionLevel < 1 || compressionLevel > 9) {
        throw new Error("Awakening Medal compression level must be an integer from 1 to 9");
    }
    const bytes = Buffer.from(JSON.stringify(catalog), "utf8");
    const gzip = (0, zlib_1.gzipSync)(bytes, { level: compressionLevel });
    const sha256 = (0, crypto_1.createHash)("sha256").update(gzip).digest("hex");
    return {
        catalog,
        bytes,
        gzip,
        manifest: {
            schemaVersion: 1,
            contract: exports.AWAKENING_MEDAL_CONTRACT,
            contractVersion: exports.AWAKENING_MEDAL_CONTRACT_VERSION,
            datasetVersion: catalog.datasetVersion,
            generatedAt: catalog.generatedAt,
            source: "dokkan-game-db",
            sourceSnapshotVersion: catalog.sourceSnapshotVersion,
            sourceDatabaseSha256: catalog.sourceDatabaseSha256,
            count: catalog.count,
            countsByRarity: catalog.countsByRarity,
            payload: {
                objectKey: `awakening-medals/objects/${sha256}.json.gz`,
                sha256,
                sizeBytes: gzip.byteLength,
                expandedSizeBytes: bytes.byteLength,
                contentType: "application/json",
                contentEncoding: "gzip",
            },
        },
    };
}
exports.buildAwakeningMedalDelivery = buildAwakeningMedalDelivery;
function validateAwakeningMedalCatalog(catalog) {
    if (catalog.schemaVersion !== 1 || catalog.contract !== exports.AWAKENING_MEDAL_CONTRACT
        || catalog.contractVersion !== exports.AWAKENING_MEDAL_CONTRACT_VERSION || catalog.source !== "dokkan-game-db") {
        throw new Error("Awakening Medal catalog contract is unsupported");
    }
    requireIsoDate(catalog.generatedAt);
    if (catalog.count !== catalog.items.length)
        throw new Error("Awakening Medal catalog count mismatch");
    const ids = new Set();
    let previousId = -1;
    for (const item of catalog.items) {
        if (!/^[1-9]\d*$/.test(item.id) || ids.has(item.id))
            throw new Error(`Invalid or duplicate Awakening Medal ID ${item.id}`);
        ids.add(item.id);
        const numericId = Number(item.id);
        if (numericId <= previousId)
            throw new Error("Awakening Medal items must be sorted by numeric ID");
        previousId = numericId;
        if (RARITY_BY_RAW[item.rarityRaw] !== item.rarity)
            throw new Error(`Awakening Medal ${item.id} rarity mismatch`);
        const expected = `item/awaken/en/thumb/thumb_awaken_items_${item.id.padStart(5, "0")}/thumb_awaken_items_${item.id.padStart(5, "0")}.png`;
        if (item.iconAssetPath !== expected)
            throw new Error(`Awakening Medal ${item.id} icon path mismatch`);
    }
    for (const rarity of RARITIES) {
        if (catalog.countsByRarity[rarity] !== catalog.items.filter(item => item.rarity === rarity).length) {
            throw new Error(`Awakening Medal ${rarity} count mismatch`);
        }
    }
}
exports.validateAwakeningMedalCatalog = validateAwakeningMedalCatalog;
function requireNonEmpty(value, label) {
    const normalized = typeof value === "string" ? value.trim() : String(value ?? "").trim();
    if (!normalized)
        throw new Error(`${label} must be non-empty`);
    return normalized;
}
function requireInteger(value, label, minimum, maximum = Number.MAX_SAFE_INTEGER) {
    const parsed = typeof value === "number" ? value : Number(value);
    if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum)
        throw new Error(`${label} must be an integer from ${minimum} to ${maximum}`);
    return parsed;
}
function requireBooleanInteger(value, label) {
    const parsed = requireInteger(value, label, 0, 1);
    return parsed === 1;
}
function requireIsoDate(value) {
    if (!value || Number.isNaN(Date.parse(value)))
        throw new Error("Awakening Medal generatedAt is invalid");
}
//# sourceMappingURL=game-db-awakening-medal-catalog.js.map