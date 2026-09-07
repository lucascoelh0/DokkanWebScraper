"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = require("assert");
const mocha_1 = require("mocha");
const awakening_route_portrait_assets_1 = require("./awakening-route-portrait-assets");
(0, mocha_1.describe)("Awakening Route portrait assets", () => {
    (0, mocha_1.it)("derives fallback by the Android exact base/transformation ID join and deduplicates icon IDs", () => {
        const scope = (0, awakening_route_portrait_assets_1.deriveAwakeningRouteFallbackScope)([
            { id: "100", portraitSpec: { iconId: 100 } },
            { id: "101", portraitSpec: { iconId: 100 } },
            { id: "200", portraitSpec: { iconId: 200 } },
            { id: "300", portraitSpec: { iconId: 300 } },
        ], [{
                id: "100",
                transformations: [{ id: "200" }],
            }]);
        (0, assert_1.equal)(scope.routeFormCount, 4);
        (0, assert_1.equal)(scope.charactersResolvedFormCount, 2);
        (0, assert_1.equal)(scope.fallbackFormCount, 2);
        (0, assert_1.deepEqual)(scope.requiredThumbIds, ["100", "300"]);
        (0, assert_1.equal)(scope.fallbackFormsByThumbId.get("100"), 1);
        (0, assert_1.equal)(scope.fallbackFormsByThumbId.get("300"), 1);
    });
    (0, mocha_1.it)("rejects duplicate route identities and unnormalized fallback icons", () => {
        (0, assert_1.throws)(() => (0, awakening_route_portrait_assets_1.deriveAwakeningRouteFallbackScope)([
            { id: "100", portraitSpec: { iconId: 100 } },
            { id: "100", portraitSpec: { iconId: 100 } },
        ], []), /Duplicate Awakening Route card/);
        (0, assert_1.throws)(() => (0, awakening_route_portrait_assets_1.deriveAwakeningRouteFallbackScope)([
            { id: "101", portraitSpec: { iconId: 101 } },
        ], []), /unnormalized icon ID/);
    });
});
//# sourceMappingURL=awakening-route-portrait-assets.spec.js.map