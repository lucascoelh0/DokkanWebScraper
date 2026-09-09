"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = require("assert");
const mocha_1 = require("mocha");
const game_db_ki_multipliers_1 = require("./game-db-ki-multipliers");
function row(values) {
    return Object.fromEntries(["eball_mod_min", "eball_mod_num100", "eball_mod_mid",
        "eball_mod_mid_num", "eball_mod_max", "eball_mod_max_num"].map((key, i) => [key, String(values[i])]));
}
(0, mocha_1.describe)("first-party Ki reference anchors", () => {
    (0, mocha_1.it)("maps Frieza's four anchors without confusing num100 with minimum", () => {
        (0, assert_1.deepStrictEqual)((0, game_db_ki_multipliers_1.kiMultipliersFromCard)(row([50, 4, 140, 12, 200, 24])), {
            schemaVersion: 1, points: [{ ki: 0, percent: 50 }, { ki: 4, percent: 100 },
                { ki: 12, percent: 140 }, { ki: 24, percent: 200 }],
        });
    });
    (0, mocha_1.it)("omits a missing middle anchor, not the 100 percent anchor", () => {
        (0, assert_1.deepStrictEqual)((0, game_db_ki_multipliers_1.kiMultipliersFromCard)(row([40, 4, 0, 0, 135, 12]))?.points, [{ ki: 0, percent: 40 }, { ki: 4, percent: 100 }, { ki: 12, percent: 135 }]);
    });
    (0, mocha_1.it)("preserves old exports with no Ki fields", () => {
        (0, assert_1.strictEqual)((0, game_db_ki_multipliers_1.kiMultipliersFromCard)({ id: "1" }), undefined);
    });
    (0, mocha_1.it)("does not invent a curve for audited degenerate or contradictory source rows", () => {
        (0, assert_1.strictEqual)((0, game_db_ki_multipliers_1.kiMultipliersFromCard)(row([1, 1, 0, 0, 1, 1])), undefined);
        (0, assert_1.strictEqual)((0, game_db_ki_multipliers_1.kiMultipliersFromCard)(row([40, 3, 150, 12, 200, 12])), undefined);
    });
    (0, mocha_1.it)("rejects partial, nonintegral, duplicate, out-of-range and unpaired anchors", () => {
        (0, assert_1.throws)(() => (0, game_db_ki_multipliers_1.kiMultipliersFromCard)({ eball_mod_min: "40" }));
        for (const values of [[40, 4, 140, 4, 200, 24], [40, 4.5, 0, 0, 135, 12],
            [40, 4, 140, 0, 200, 24], [40, 4, 0, 0, 200, 25], [40, 0, 0, 0, 135, 12]]) {
            (0, assert_1.throws)(() => (0, game_db_ki_multipliers_1.kiMultipliersFromCard)(row(values)));
        }
    });
});
//# sourceMappingURL=game-db-ki-multipliers.spec.js.map