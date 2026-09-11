"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = require("assert");
const game_db_treasure_trade_sources_1 = require("./game-db-treasure-trade-sources");
const fixture = () => ({ source: "authorized_manual_shop_read", capturedAt: "2026-09-11T14:00:00Z", offers: [
        { id: 1, currency_id: 2, currency_type: "TreasureItem", price: 30, discount_price: 30, is_sale: false,
            start_at: 1700000000, end_at: 2145916800, shop_items: [{ item_id: 1, item_type: "TreasureItem", quantity: 1 }] },
    ] });
const build = (input = fixture()) => (0, game_db_treasure_trade_sources_1.buildTreasureTradeSources)(input, [{ id: "1" }, { id: "2" }]);
describe("treasure trade sources", () => {
    it("keeps cost, reward and capture identity separate without inferring availability", () => {
        const result = build();
        assert_1.strict.equal(result.offers[0].price, 30);
        assert_1.strict.equal(result.offers[0].quantity, 1);
        assert_1.strict.equal(result.offers[0].endsAt, null);
        assert_1.strict.equal(result.capturedAt, "2026-09-11T14:00:00.000Z");
        assert_1.strict.deepEqual(result, build());
    });
    it("rejects ambiguous sales, bundles, joins and dates", () => {
        for (const change of [
            (r) => r.price = 0, (r) => r.discount_price = 1, (r) => r.is_sale = true,
            (r) => r.currency_id = 99, (r) => r.end_at = r.start_at,
            (r) => r.shop_items.push({ item_id: 2, item_type: "Card", quantity: 1 }),
        ]) {
            const input = fixture();
            change(input.offers[0]);
            assert_1.strict.throws(() => build(input));
        }
    });
    it("rejects duplicate IDs and private fields", () => {
        const input = fixture();
        input.offers.push(input.offers[0]);
        assert_1.strict.throws(() => build(input));
        assert_1.strict.throws(() => build({ ...fixture(), token: "not-allowed" }));
    });
    it("does not confuse a card with the same numeric ID", () => {
        const input = fixture();
        input.offers[0].shop_items[0].item_type = "Card";
        assert_1.strict.equal(build(input).offers.length, 0);
    });
});
//# sourceMappingURL=game-db-treasure-trade-sources.spec.js.map