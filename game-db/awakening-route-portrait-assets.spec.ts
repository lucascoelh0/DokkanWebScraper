import { deepEqual, equal, throws } from "assert";
import { describe, it } from "mocha";
import { deriveAwakeningRouteFallbackScope } from "./awakening-route-portrait-assets";

describe("Awakening Route portrait assets", () => {
    it("derives fallback by the Android exact base/transformation ID join and deduplicates icon IDs", () => {
        const scope = deriveAwakeningRouteFallbackScope([
            { id: "100", portraitSpec: { iconId: 100 } },
            { id: "101", portraitSpec: { iconId: 100 } },
            { id: "200", portraitSpec: { iconId: 200 } },
            { id: "300", portraitSpec: { iconId: 300 } },
        ], [{
            id: "100",
            transformations: [{ id: "200" }],
        }]);
        equal(scope.routeFormCount, 4);
        equal(scope.charactersResolvedFormCount, 2);
        equal(scope.fallbackFormCount, 2);
        deepEqual(scope.requiredThumbIds, ["100", "300"]);
        equal(scope.fallbackFormsByThumbId.get("100"), 1);
        equal(scope.fallbackFormsByThumbId.get("300"), 1);
    });

    it("rejects duplicate route identities and unnormalized fallback icons", () => {
        throws(() => deriveAwakeningRouteFallbackScope([
            { id: "100", portraitSpec: { iconId: 100 } },
            { id: "100", portraitSpec: { iconId: 100 } },
        ], []), /Duplicate Awakening Route card/);
        throws(() => deriveAwakeningRouteFallbackScope([
            { id: "101", portraitSpec: { iconId: 101 } },
        ], []), /unnormalized icon ID/);
    });
});
