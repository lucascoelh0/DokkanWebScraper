import { strict as assert } from "assert";
import { createHash } from "crypto";
import { gunzipSync } from "zlib";
import { buildTreasureExchanges, ExchangeSource } from "./game-db-treasure-exchanges";

const source: ExchangeSource = {
    snapshotVersion: "1788329250", databaseSha256: "a".repeat(64), assetBaseUrl: "https://assets.example.com/game-assets",
    cards: [{ id: "100", name: "Goku" }, { id: "101", name: "Vegeta" }],
    awakeningItems: [{ id: "1", name: "Gregory" }],
    treasureItems: [{ id: "5", name: "Gem", image_suffix_number: "5" }],
};
const reward = { item_id: 100, item_type: "Card", quantity: 1 };
const offer = { id: 10, currency_id: 5, currency_type: "TreasureItem", price: 100, discount_price: 100,
    is_sale: false, start_at: 1780000000, end_at: 2145916800, shop_items: [reward] };
function input(offers: unknown[] = [offer]) {
    return { source: "authorized_manual_shop_read", capturedAt: "2026-09-11T17:25:25+00:00", offers };
}
describe("Treasure Exchange offline projection", () => {
    it("binds manifest to exact compressed bytes and emits deterministic normalized dates", () => {
        const a = buildTreasureExchanges(input(), source), b = buildTreasureExchanges(input(), source);
        assert.deepEqual(a.gzip, b.gzip);
        assert.equal(a.manifest.payload.sha256, createHash("sha256").update(a.gzip).digest("hex"));
        assert.equal(gunzipSync(a.gzip).length, a.manifest.payload.expandedSizeBytes);
        assert.equal(a.catalog.capturedAt, "2026-09-11T17:25:25.000Z");
        assert.equal(a.catalog.offers[0].endsAt, null);
    });
    it("preserves the entire mixed card and medal bundle", () => {
        const built = buildTreasureExchanges(input([{ ...offer, shop_items: [reward, { item_id: 1, item_type: "AwakeningItem", quantity: 50 }] }]), source);
        assert.equal(built.catalog.offers[0].rewards.length, 2);
        assert.equal(built.catalog.offers[0].rewards[1].name, "Gregory");
        assert.equal(built.report.bundleOffers, 1);
    });
    it("reports non-card offers outside this delivery without creating partial rewards", () => {
        const built = buildTreasureExchanges(input([{ ...offer, shop_items: [{ item_id: 1, item_type: "AwakeningItem", quantity: 10 }] }]), source);
        assert.equal(built.report.omittedNonCardOffers, 1);
        assert.equal(built.catalog.offers.length, 0);
    });
    it("retains exact card IDs and independent offers", () => {
        const built = buildTreasureExchanges(input([offer, { ...offer, id: 11 }]), source);
        assert.equal(built.catalog.offers.length, 2);
        assert.equal(built.catalog.offers[0].rewards[0].itemId, "100");
    });
    it("rejects private fields instead of propagating them", () => {
        assert.throws(() => buildTreasureExchanges(input([{ ...offer, buyable_num: 4 }]), source));
        assert.throws(() => buildTreasureExchanges({ ...input(), access_token: "synthetic" }, source));
    });
    it("rejects ambiguous price semantics", () => {
        assert.throws(() => buildTreasureExchanges(input([{ ...offer, is_sale: true, discount_price: 50 }]), source));
        assert.throws(() => buildTreasureExchanges(input([{ ...offer, discount_price: 50 }]), source));
    });
    it("rejects missing reward/currency metadata and unsupported mixed bundles", () => {
        assert.throws(() => buildTreasureExchanges(input(), { ...source, cards: [] }));
        assert.throws(() => buildTreasureExchanges(input(), { ...source, treasureItems: [] }));
        assert.throws(() => buildTreasureExchanges(input([{ ...offer, shop_items: [reward, { item_id: 1, item_type: "Unknown", quantity: 1 }] }]), source));
    });
    it("rejects duplicates, invalid dates, fractional or overflowing quantities", () => {
        assert.throws(() => buildTreasureExchanges(input([offer, offer]), source));
        assert.throws(() => buildTreasureExchanges(input([{ ...offer, end_at: offer.start_at }]), source));
        for (const quantity of [0, -1, 0.5, Number.MAX_SAFE_INTEGER]) {
            assert.throws(() => buildTreasureExchanges(input([{ ...offer, shop_items: [{ ...reward, quantity }] }]), source));
        }
    });
    it("rejects credential-bearing asset URLs and missing provenance", () => {
        assert.throws(() => buildTreasureExchanges(input(), { ...source, assetBaseUrl: "https://user:pass@example.com" }));
        assert.throws(() => buildTreasureExchanges(input(), { ...source, databaseSha256: "" }));
    });
    it("bounds currency, offer and reward collection sizes", () => {
        assert.throws(() => buildTreasureExchanges(input(Array(10001).fill(offer)), source));
        assert.throws(() => buildTreasureExchanges(input([{ ...offer, shop_items: Array(101).fill(reward) }]), source));
        const treasureItems = Array.from({ length: 1001 }, (_, i) => ({ id: String(i + 1), name: "Gem", image_suffix_number: String(i + 1) }));
        const offers = treasureItems.map((row, i) => ({ ...offer, id: i + 1, currency_id: Number(row.id) }));
        assert.throws(() => buildTreasureExchanges(input(offers), { ...source, treasureItems }), /Too many currencies/);
    });
});
