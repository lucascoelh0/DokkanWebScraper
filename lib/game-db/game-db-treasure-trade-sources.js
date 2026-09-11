"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildTreasureTradeSources = void 0;
const obj = (v) => {
    if (!v || typeof v !== "object" || Array.isArray(v))
        throw Error("Invalid shop object");
    return v;
};
const keys = (v, allowed) => {
    if (Object.keys(v).some(k => !allowed.includes(k)))
        throw Error("Unexpected shop field");
};
const positive = (v) => {
    if (typeof v !== "number" || !Number.isSafeInteger(v) || v <= 0 || v > 2147483647)
        throw Error("Invalid shop integer");
    return v;
};
/** Only verified single-treasure bundles. Never infer sales or discard bundle companions. */
function buildTreasureTradeSources(input, treasures) {
    const root = obj(input);
    keys(root, ["source", "capturedAt", "offers"]);
    if (root.source !== "authorized_manual_shop_read" || typeof root.capturedAt !== "string" ||
        !/(Z|[+-]\d\d:\d\d)$/.test(root.capturedAt) || !Number.isFinite(Date.parse(root.capturedAt)))
        throw Error("Invalid shop provenance");
    if (!Array.isArray(root.offers) || root.offers.length > 10000)
        throw Error("Invalid shop offers");
    const known = new Set(treasures.map(t => t.id)), seen = new Set();
    const offers = [];
    for (const value of root.offers) {
        const row = obj(value);
        keys(row, ["id", "currency_id", "currency_type", "price", "discount_price", "is_sale", "start_at", "end_at", "shop_items"]);
        const id = String(positive(row.id));
        if (seen.has(id))
            throw Error("Duplicate shop offer");
        seen.add(id);
        if (!Array.isArray(row.shop_items) || row.shop_items.length < 1 || row.shop_items.length > 100)
            throw Error("Invalid shop bundle");
        const rewards = row.shop_items.map(obj);
        for (const r of rewards) {
            keys(r, ["item_id", "item_type", "quantity"]);
            positive(r.item_id);
            positive(r.quantity);
        }
        if (!rewards.some(r => r.item_type === "TreasureItem"))
            continue;
        if (rewards.length !== 1 || row.currency_type !== "TreasureItem")
            throw Error("Unverified treasure bundle");
        const treasureId = String(positive(rewards[0].item_id)), currencyId = String(positive(row.currency_id));
        if (!known.has(treasureId) || !known.has(currencyId) || treasureId === currencyId)
            throw Error("Invalid treasure trade join");
        const price = positive(row.price), start = positive(row.start_at), end = positive(row.end_at);
        if (row.is_sale !== false || positive(row.discount_price) !== price || end <= start)
            throw Error("Unverified price or interval");
        offers.push({ id, treasureId, currencyId, price, quantity: positive(rewards[0].quantity),
            startsAt: new Date(start * 1000).toISOString(), endsAt: end === 2145916800 ? null : new Date(end * 1000).toISOString() });
    }
    return { capturedAt: new Date(root.capturedAt).toISOString(), offers: offers.sort((a, b) => Number(a.id) - Number(b.id)) };
}
exports.buildTreasureTradeSources = buildTreasureTradeSources;
//# sourceMappingURL=game-db-treasure-trade-sources.js.map