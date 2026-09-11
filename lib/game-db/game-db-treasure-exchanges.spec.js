"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = require("assert");
const crypto_1 = require("crypto");
const zlib_1 = require("zlib");
const game_db_treasure_exchanges_1 = require("./game-db-treasure-exchanges");
const source = {
    snapshotVersion: "1788329250", databaseSha256: "a".repeat(64), assetBaseUrl: "https://assets.example.com/game-assets",
    cards: [{ id: "100", name: "Goku" }, { id: "101", name: "Vegeta" }],
    awakeningItems: [{ id: "1", name: "Gregory" }],
    treasureItems: [{ id: "5", name: "Gem", image_suffix_number: "5" }],
};
const reward = { item_id: 100, item_type: "Card", quantity: 1 };
const offer = { id: 10, currency_id: 5, currency_type: "TreasureItem", price: 100, discount_price: 100,
    is_sale: false, start_at: 1780000000, end_at: 2145916800, shop_items: [reward] };
function input(offers = [offer]) {
    return { source: "authorized_manual_shop_read", capturedAt: "2026-09-11T17:25:25+00:00", offers };
}
describe("Treasure Exchange offline projection", () => {
    it("binds manifest to exact compressed bytes and emits deterministic normalized dates", () => {
        const a = (0, game_db_treasure_exchanges_1.buildTreasureExchanges)(input(), source), b = (0, game_db_treasure_exchanges_1.buildTreasureExchanges)(input(), source);
        assert_1.strict.deepEqual(a.gzip, b.gzip);
        assert_1.strict.equal(a.manifest.payload.sha256, (0, crypto_1.createHash)("sha256").update(a.gzip).digest("hex"));
        assert_1.strict.equal((0, zlib_1.gunzipSync)(a.gzip).length, a.manifest.payload.expandedSizeBytes);
        assert_1.strict.equal(a.catalog.capturedAt, "2026-09-11T17:25:25.000Z");
        assert_1.strict.equal(a.catalog.offers[0].endsAt, null);
    });
    it("preserves the entire mixed card and medal bundle", () => {
        const built = (0, game_db_treasure_exchanges_1.buildTreasureExchanges)(input([{ ...offer, shop_items: [reward, { item_id: 1, item_type: "AwakeningItem", quantity: 50 }] }]), source);
        assert_1.strict.equal(built.catalog.offers[0].rewards.length, 2);
        assert_1.strict.equal(built.catalog.offers[0].rewards[1].name, "Gregory");
        assert_1.strict.equal(built.report.bundleOffers, 1);
    });
    it("reports non-card offers outside this delivery without creating partial rewards", () => {
        const built = (0, game_db_treasure_exchanges_1.buildTreasureExchanges)(input([{ ...offer, shop_items: [{ item_id: 1, item_type: "AwakeningItem", quantity: 10 }] }]), source);
        assert_1.strict.equal(built.report.omittedNonCardOffers, 1);
        assert_1.strict.equal(built.catalog.offers.length, 0);
    });
    it("retains exact card IDs and independent offers", () => {
        const built = (0, game_db_treasure_exchanges_1.buildTreasureExchanges)(input([offer, { ...offer, id: 11 }]), source);
        assert_1.strict.equal(built.catalog.offers.length, 2);
        assert_1.strict.equal(built.catalog.offers[0].rewards[0].itemId, "100");
    });
    it("rejects private fields instead of propagating them", () => {
        assert_1.strict.throws(() => (0, game_db_treasure_exchanges_1.buildTreasureExchanges)(input([{ ...offer, buyable_num: 4 }]), source));
        assert_1.strict.throws(() => (0, game_db_treasure_exchanges_1.buildTreasureExchanges)({ ...input(), access_token: "synthetic" }, source));
    });
    it("rejects ambiguous price semantics", () => {
        assert_1.strict.throws(() => (0, game_db_treasure_exchanges_1.buildTreasureExchanges)(input([{ ...offer, is_sale: true, discount_price: 50 }]), source));
        assert_1.strict.throws(() => (0, game_db_treasure_exchanges_1.buildTreasureExchanges)(input([{ ...offer, discount_price: 50 }]), source));
    });
    it("rejects missing reward/currency metadata and unsupported mixed bundles", () => {
        assert_1.strict.throws(() => (0, game_db_treasure_exchanges_1.buildTreasureExchanges)(input(), { ...source, cards: [] }));
        assert_1.strict.throws(() => (0, game_db_treasure_exchanges_1.buildTreasureExchanges)(input(), { ...source, treasureItems: [] }));
        assert_1.strict.throws(() => (0, game_db_treasure_exchanges_1.buildTreasureExchanges)(input([{ ...offer, shop_items: [reward, { item_id: 1, item_type: "Unknown", quantity: 1 }] }]), source));
    });
    it("rejects duplicates, invalid dates, fractional or overflowing quantities", () => {
        assert_1.strict.throws(() => (0, game_db_treasure_exchanges_1.buildTreasureExchanges)(input([offer, offer]), source));
        assert_1.strict.throws(() => (0, game_db_treasure_exchanges_1.buildTreasureExchanges)(input([{ ...offer, end_at: offer.start_at }]), source));
        for (const quantity of [0, -1, 0.5, Number.MAX_SAFE_INTEGER]) {
            assert_1.strict.throws(() => (0, game_db_treasure_exchanges_1.buildTreasureExchanges)(input([{ ...offer, shop_items: [{ ...reward, quantity }] }]), source));
        }
    });
    it("rejects credential-bearing asset URLs and missing provenance", () => {
        assert_1.strict.throws(() => (0, game_db_treasure_exchanges_1.buildTreasureExchanges)(input(), { ...source, assetBaseUrl: "https://user:pass@example.com" }));
        assert_1.strict.throws(() => (0, game_db_treasure_exchanges_1.buildTreasureExchanges)(input(), { ...source, databaseSha256: "" }));
    });
    it("bounds currency, offer and reward collection sizes", () => {
        assert_1.strict.throws(() => (0, game_db_treasure_exchanges_1.buildTreasureExchanges)(input(Array(10001).fill(offer)), source));
        assert_1.strict.throws(() => (0, game_db_treasure_exchanges_1.buildTreasureExchanges)(input([{ ...offer, shop_items: Array(101).fill(reward) }]), source));
        const treasureItems = Array.from({ length: 1001 }, (_, i) => ({ id: String(i + 1), name: "Gem", image_suffix_number: String(i + 1) }));
        const offers = treasureItems.map((row, i) => ({ ...offer, id: i + 1, currency_id: Number(row.id) }));
        assert_1.strict.throws(() => (0, game_db_treasure_exchanges_1.buildTreasureExchanges)(input(offers), { ...source, treasureItems }), /Too many currencies/);
    });
});
//# sourceMappingURL=game-db-treasure-exchanges.spec.js.map