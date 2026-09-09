import { deepStrictEqual, throws, strictEqual } from "assert";
import { describe, it } from "mocha";
import { kiMultipliersFromCard } from "./game-db-ki-multipliers";

function row(values: number[]) {
    return Object.fromEntries(["eball_mod_min", "eball_mod_num100", "eball_mod_mid",
        "eball_mod_mid_num", "eball_mod_max", "eball_mod_max_num"].map((key, i) => [key, String(values[i])]));
}

describe("first-party Ki reference anchors", () => {
    it("maps Frieza's four anchors without confusing num100 with minimum", () => {
        deepStrictEqual(kiMultipliersFromCard(row([50, 4, 140, 12, 200, 24])), {
            schemaVersion: 1, points: [{ ki: 0, percent: 50 }, { ki: 4, percent: 100 },
                { ki: 12, percent: 140 }, { ki: 24, percent: 200 }],
        });
    });
    it("omits a missing middle anchor, not the 100 percent anchor", () => {
        deepStrictEqual(kiMultipliersFromCard(row([40, 4, 0, 0, 135, 12]))?.points,
            [{ ki: 0, percent: 40 }, { ki: 4, percent: 100 }, { ki: 12, percent: 135 }]);
    });
    it("preserves old exports with no Ki fields", () => {
        strictEqual(kiMultipliersFromCard({ id: "1" }), undefined);
    });
    it("does not invent a curve for audited degenerate or contradictory source rows", () => {
        strictEqual(kiMultipliersFromCard(row([1, 1, 0, 0, 1, 1])), undefined);
        strictEqual(kiMultipliersFromCard(row([40, 3, 150, 12, 200, 12])), undefined);
    });
    it("rejects partial, nonintegral, duplicate, out-of-range and unpaired anchors", () => {
        throws(() => kiMultipliersFromCard({ eball_mod_min: "40" }));
        for (const values of [[40, 4, 140, 4, 200, 24], [40, 4.5, 0, 0, 135, 12],
            [40, 4, 140, 0, 200, 24], [40, 4, 0, 0, 200, 25], [40, 0, 0, 0, 135, 12]]) {
            throws(() => kiMultipliersFromCard(row(values)));
        }
    });
});
