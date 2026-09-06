import { createHash } from "crypto";
import { gzipSync } from "zlib";
import { GameDbRow, normalizeDbId } from "./game-db-source";

export const AWAKENING_MEDAL_CONTRACT = "dokkan-awakening-medal-catalog";
export const AWAKENING_MEDAL_CONTRACT_VERSION = "1.0.0";

export type AwakeningMedalRarity = "bronze" | "silver" | "gold" | "rainbow" | "super";

export interface AwakeningMedalCatalogItem {
    id: string,
    name: string,
    description: string,
    rarity: AwakeningMedalRarity,
    rarityRaw: number,
    zeni: number,
    sellingExchangePoint: number,
    eventJumpable: boolean,
    iconAssetPath: string,
}

export interface AwakeningMedalCatalog {
    schemaVersion: 1,
    contract: typeof AWAKENING_MEDAL_CONTRACT,
    contractVersion: typeof AWAKENING_MEDAL_CONTRACT_VERSION,
    datasetVersion: string,
    generatedAt: string,
    source: "dokkan-game-db",
    sourceSnapshotVersion: string,
    sourceDatabaseSha256: string,
    assetBaseUrl: string,
    count: number,
    countsByRarity: Record<AwakeningMedalRarity, number>,
    items: AwakeningMedalCatalogItem[],
}

export interface AwakeningMedalManifest {
    schemaVersion: 1,
    contract: typeof AWAKENING_MEDAL_CONTRACT,
    contractVersion: typeof AWAKENING_MEDAL_CONTRACT_VERSION,
    datasetVersion: string,
    generatedAt: string,
    source: "dokkan-game-db",
    sourceSnapshotVersion: string,
    sourceDatabaseSha256: string,
    count: number,
    countsByRarity: Record<AwakeningMedalRarity, number>,
    payload: {
        objectKey: string,
        sha256: string,
        sizeBytes: number,
        expandedSizeBytes: number,
        contentType: "application/json",
        contentEncoding: "gzip",
    },
}

export interface AwakeningMedalDelivery {
    catalog: AwakeningMedalCatalog,
    bytes: Buffer,
    gzip: Buffer,
    manifest: AwakeningMedalManifest,
}

const RARITIES: AwakeningMedalRarity[] = ["bronze", "silver", "gold", "rainbow", "super"];
const RARITY_BY_RAW: Record<number, AwakeningMedalRarity> = {
    0: "bronze",
    1: "silver",
    2: "gold",
    3: "rainbow",
    4: "super",
};

export function buildAwakeningMedalCatalog(options: {
    rows: GameDbRow[],
    generatedAt: string,
    sourceSnapshotVersion: string,
    sourceDatabaseSha256: string,
    assetBaseUrl: string,
}): AwakeningMedalCatalog {
    requireIsoDate(options.generatedAt);
    requireNonEmpty(options.sourceSnapshotVersion, "source snapshot version");
    if (!/^[a-f0-9]{64}$/.test(options.sourceDatabaseSha256)) {
        throw new Error("Awakening Medal source database SHA-256 is invalid");
    }
    if (!/^https:\/\/[^\s]+$/.test(options.assetBaseUrl)) {
        throw new Error("Awakening Medal asset base URL must be HTTPS");
    }

    const seen = new Set<string>();
    const items = options.rows.map((row, index) => {
        const id = normalizeDbId(row.id);
        if (!id || !/^[1-9]\d*$/.test(id)) throw new Error(`awakening_items[${index}].id must be a canonical positive numeric ID`);
        if (seen.has(id)) throw new Error(`Duplicate Awakening Medal ID ${id}`);
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
            sellingExchangePoint: requireInteger(
                row.selling_exchange_point,
                `awakening_items[${index}].selling_exchange_point`,
                0,
            ),
            eventJumpable: requireBooleanInteger(row.event_jumpable, `awakening_items[${index}].event_jumpable`),
            iconAssetPath: `item/awaken/en/thumb/thumb_awaken_items_${id.padStart(5, "0")}/thumb_awaken_items_${id.padStart(5, "0")}.png`,
        };
    }).sort((left, right) => Number(left.id) - Number(right.id));

    if (items.length === 0) throw new Error("Awakening Medal catalog must not be empty");
    const countsByRarity = Object.fromEntries(RARITIES.map(rarity => [
        rarity,
        items.filter(item => item.rarity === rarity).length,
    ])) as Record<AwakeningMedalRarity, number>;
    const identity = JSON.stringify({
        sourceSnapshotVersion: options.sourceSnapshotVersion,
        sourceDatabaseSha256: options.sourceDatabaseSha256,
        assetBaseUrl: options.assetBaseUrl.replace(/\/+$/, ""),
        items,
    });
    const datasetVersion = `${options.sourceSnapshotVersion}-${createHash("sha256").update(identity).digest("hex").slice(0, 12)}`;
    const catalog: AwakeningMedalCatalog = {
        schemaVersion: 1,
        contract: AWAKENING_MEDAL_CONTRACT,
        contractVersion: AWAKENING_MEDAL_CONTRACT_VERSION,
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

export function buildAwakeningMedalDelivery(catalog: AwakeningMedalCatalog, compressionLevel = 9): AwakeningMedalDelivery {
    validateAwakeningMedalCatalog(catalog);
    if (!Number.isSafeInteger(compressionLevel) || compressionLevel < 1 || compressionLevel > 9) {
        throw new Error("Awakening Medal compression level must be an integer from 1 to 9");
    }
    const bytes = Buffer.from(JSON.stringify(catalog), "utf8");
    const gzip = gzipSync(bytes, { level: compressionLevel });
    const sha256 = createHash("sha256").update(gzip).digest("hex");
    return {
        catalog,
        bytes,
        gzip,
        manifest: {
            schemaVersion: 1,
            contract: AWAKENING_MEDAL_CONTRACT,
            contractVersion: AWAKENING_MEDAL_CONTRACT_VERSION,
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

export function validateAwakeningMedalCatalog(catalog: AwakeningMedalCatalog): void {
    if (catalog.schemaVersion !== 1 || catalog.contract !== AWAKENING_MEDAL_CONTRACT
        || catalog.contractVersion !== AWAKENING_MEDAL_CONTRACT_VERSION || catalog.source !== "dokkan-game-db") {
        throw new Error("Awakening Medal catalog contract is unsupported");
    }
    requireIsoDate(catalog.generatedAt);
    if (catalog.count !== catalog.items.length) throw new Error("Awakening Medal catalog count mismatch");
    const ids = new Set<string>();
    let previousId = -1;
    for (const item of catalog.items) {
        if (!/^[1-9]\d*$/.test(item.id) || ids.has(item.id)) throw new Error(`Invalid or duplicate Awakening Medal ID ${item.id}`);
        ids.add(item.id);
        const numericId = Number(item.id);
        if (numericId <= previousId) throw new Error("Awakening Medal items must be sorted by numeric ID");
        previousId = numericId;
        if (RARITY_BY_RAW[item.rarityRaw] !== item.rarity) throw new Error(`Awakening Medal ${item.id} rarity mismatch`);
        const expected = `item/awaken/en/thumb/thumb_awaken_items_${item.id.padStart(5, "0")}/thumb_awaken_items_${item.id.padStart(5, "0")}.png`;
        if (item.iconAssetPath !== expected) throw new Error(`Awakening Medal ${item.id} icon path mismatch`);
    }
    for (const rarity of RARITIES) {
        if (catalog.countsByRarity[rarity] !== catalog.items.filter(item => item.rarity === rarity).length) {
            throw new Error(`Awakening Medal ${rarity} count mismatch`);
        }
    }
}

function requireNonEmpty(value: unknown, label: string): string {
    const normalized = typeof value === "string" ? value.trim() : String(value ?? "").trim();
    if (!normalized) throw new Error(`${label} must be non-empty`);
    return normalized;
}

function requireInteger(value: unknown, label: string, minimum: number, maximum = Number.MAX_SAFE_INTEGER): number {
    const parsed = typeof value === "number" ? value : Number(value);
    if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum) throw new Error(`${label} must be an integer from ${minimum} to ${maximum}`);
    return parsed;
}

function requireBooleanInteger(value: unknown, label: string): boolean {
    const parsed = requireInteger(value, label, 0, 1);
    return parsed === 1;
}

function requireIsoDate(value: string): void {
    if (!value || Number.isNaN(Date.parse(value))) throw new Error("Awakening Medal generatedAt is invalid");
}
