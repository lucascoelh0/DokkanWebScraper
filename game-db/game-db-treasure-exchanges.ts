import { createHash } from "crypto";
import { gzipSync } from "zlib";
import { GameDbRow } from "./game-db-source";

export const EXCHANGE_CONTRACT = "dokkan-treasure-exchanges";
export const EXCHANGE_VERSION = "1.0.0";
export interface ExchangeReward { itemType: "Card" | "AwakeningItem"; itemId: string; name: string; quantity: number }
export interface ExchangeOffer { id: string; currencyId: string; price: number; startsAt: string | null; endsAt: string | null; rewards: ExchangeReward[] }
export interface ExchangeCurrency { id: string; name: string; iconAssetPath: string | null }
export interface ExchangeCatalog {
    schemaVersion: 1; contract: typeof EXCHANGE_CONTRACT; contractVersion: typeof EXCHANGE_VERSION;
    datasetVersion: string; generatedAt: string; capturedAt: string; source: "official-shop-snapshot";
    sourceSnapshotVersion: string; sourceDatabaseSha256: string; assetBaseUrl: string;
    currencies: ExchangeCurrency[]; offers: ExchangeOffer[];
}
export interface ExchangeSource {
    snapshotVersion: string; databaseSha256: string; assetBaseUrl: string;
    cards: GameDbRow[]; awakeningItems: GameDbRow[]; treasureItems: GameDbRow[];
}

function object(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== "object" || Array.isArray(value)) throw Error("Expected object");
    return value as Record<string, unknown>;
}
function keys(value: Record<string, unknown>, allowed: string[]) {
    if (Object.keys(value).some(k => !allowed.includes(k))) throw Error("Unexpected source field");
}
function positive(value: unknown): number {
    if (typeof value !== "number" || !Number.isSafeInteger(value) || value <= 0 || value > 2147483647) throw Error("Invalid positive integer");
    return value;
}
function id(value: unknown): string { return String(positive(value)); }
function name(row: GameDbRow | undefined): string {
    if (!row || typeof row.name !== "string" || !row.name.trim() || row.name.length > 512) throw Error("Missing official name");
    return row.name.trim();
}
function index(rows: GameDbRow[]) {
    const result = new Map<string, GameDbRow>();
    for (const row of rows) {
        const key = id(Number(row.id));
        if (result.has(key)) throw Error("Duplicate official ID");
        result.set(key, row);
    }
    return result;
}
function timestamp(value: unknown): string {
    const seconds = positive(value);
    return new Date(seconds * 1000).toISOString();
}

/** Offline only. Input is the allowlisted public projection, never a raw HAR. */
export function buildTreasureExchanges(input: unknown, source: ExchangeSource) {
    const raw = object(input);
    keys(raw, ["capturedAt", "source", "offers"]);
    if (raw.source !== "authorized_manual_shop_read" || typeof raw.capturedAt !== "string" ||
        !/(Z|[+-]\d\d:\d\d)$/.test(raw.capturedAt) || !Number.isFinite(Date.parse(raw.capturedAt))) throw Error("Invalid capture provenance");
    if (!/^\d+$/.test(source.snapshotVersion) || !/^[a-f0-9]{64}$/.test(source.databaseSha256)) throw Error("Invalid DB provenance");
    const base = new URL(source.assetBaseUrl);
    if (base.protocol !== "https:" || base.username || base.password || base.search || base.hash) throw Error("Invalid asset origin");
    if (!Array.isArray(raw.offers) || raw.offers.length > 10000) throw Error("Invalid offers");
    const cards = index(source.cards), medals = index(source.awakeningItems), treasures = index(source.treasureItems);
    const seen = new Set<string>(), currencies = new Map<string, ExchangeCurrency>();
    const offers: ExchangeOffer[] = [];
    let omittedNonCardOffers = 0;
    for (const value of raw.offers) {
        const offer = object(value);
        keys(offer, ["id", "currency_id", "currency_type", "price", "discount_price", "is_sale", "start_at", "end_at", "shop_items"]);
        const offerId = id(offer.id);
        if (seen.has(offerId)) throw Error("Duplicate offer ID");
        seen.add(offerId);
        if (!Array.isArray(offer.shop_items) || !offer.shop_items.length || offer.shop_items.length > 100) throw Error("Invalid bundle");
        const rewardObjects = offer.shop_items.map(object);
        for (const reward of rewardObjects) {
            keys(reward, ["item_id", "item_type", "quantity"]);
            id(reward.item_id); positive(reward.quantity);
        }
        if (!rewardObjects.some(r => r.item_type === "Card")) { omittedNonCardOffers++; continue; }
        if (offer.currency_type !== "TreasureItem") throw Error("Unsupported currency type");
        const currencyId = id(offer.currency_id);
        const currency = treasures.get(currencyId);
        const currencyName = name(currency);
        const suffix = id(Number(currency.image_suffix_number)).padStart(5, "0");
        currencies.set(currencyId, { id: currencyId, name: currencyName,
            iconAssetPath: `item/other/en/thumb/thumb_trade_jewel_${suffix}/thumb_trade_jewel_${suffix}.png` });
        if (currencies.size > 1000) throw Error("Too many currencies");
        const price = positive(offer.price);
        // No sale sample has been independently verified: reject rather than infer price semantics.
        if (offer.is_sale !== false || positive(offer.discount_price) !== price) throw Error("Unverified sale semantics");
        const start = timestamp(offer.start_at), end = timestamp(offer.end_at);
        if (Date.parse(end) <= Date.parse(start)) throw Error("Invalid interval");
        const rewards = rewardObjects.map((reward): ExchangeReward => {
            const type = reward.item_type;
            if (type !== "Card" && type !== "AwakeningItem") throw Error("Unsupported mixed card bundle");
            const rewardId = id(reward.item_id);
            return { itemType: type, itemId: rewardId,
                name: name((type === "Card" ? cards : medals).get(rewardId)), quantity: positive(reward.quantity) };
        });
        offers.push({ id: offerId, currencyId, price, startsAt: start,
            // This exact far-future value is also used by the game's generic shop definitions.
            // Represent it as unspecified, never as a promise of availability until 2038.
            endsAt: offer.end_at === 2145916800 ? null : end, rewards });
    }
    offers.sort((a, b) => Number(a.id) - Number(b.id));
    const capturedAt = new Date(raw.capturedAt).toISOString();
    const content: Omit<ExchangeCatalog, "datasetVersion"> = {
        schemaVersion: 1 as const, contract: EXCHANGE_CONTRACT, contractVersion: EXCHANGE_VERSION,
        generatedAt: capturedAt, capturedAt, source: "official-shop-snapshot" as const,
        sourceSnapshotVersion: source.snapshotVersion, sourceDatabaseSha256: source.databaseSha256,
        assetBaseUrl: source.assetBaseUrl.replace(/\/$/, ""),
        currencies: [...currencies.values()].sort((a, b) => Number(a.id) - Number(b.id)), offers,
    };
    const datasetVersion = `${source.snapshotVersion}-${createHash("sha256").update(JSON.stringify(content)).digest("hex").slice(0, 16)}`;
    const catalog: ExchangeCatalog = { ...content, datasetVersion };
    const expanded = Buffer.from(JSON.stringify(catalog) + "\n");
    const gzip = gzipSync(expanded, { level: 9 });
    if (expanded.length > 8 * 1024 * 1024 || gzip.length > 2 * 1024 * 1024) throw Error("Catalog exceeds budget");
    const sha256 = createHash("sha256").update(gzip).digest("hex");
    const manifest = {
        schemaVersion: 1, contract: EXCHANGE_CONTRACT, contractVersion: EXCHANGE_VERSION, datasetVersion,
        sourceSnapshotVersion: source.snapshotVersion, sourceDatabaseSha256: source.databaseSha256,
        payload: { objectKey: `treasure-exchanges/objects/${sha256}.json.gz`, sha256,
            sizeBytes: gzip.length, expandedSizeBytes: expanded.length },
    };
    return { catalog, manifest, gzip, report: { inputOffers: raw.offers.length, cardOffers: offers.length,
        currencies: currencies.size, bundleOffers: offers.filter(o => o.rewards.length > 1).length,
        omittedNonCardOffers, distinctCards: new Set(offers.flatMap(o => o.rewards.filter(r => r.itemType === "Card").map(r => r.itemId))).size } };
}
