"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = require("assert");
const mocha_1 = require("mocha");
const game_db_super_attack_1 = require("./game-db-super-attack");
(0, mocha_1.describe)("mapSuperAttacks", function () {
    (0, mocha_1.it)("preserves first-party inputs without computing an unproven multiplier", () => {
        const specialSets = new Map([["20", {
                    id: "20",
                    name: "Demon Death Ball",
                    description: "Causes mega-colossal damage.",
                    increase_rate: "250",
                    lv_bonus: "10",
                }]]);
        const [attack] = (0, game_db_super_attack_1.mapSuperAttacks)("1031501", [{
                id: "100",
                card_id: "1031501",
                special_set_id: "20",
                priority: "1",
                style: "Hyper",
                lv_start: "1",
                eball_num_start: "18",
                view_id: "300",
                card_costume_condition_id: "0",
                special_bonus_id1: "8",
                special_bonus_lv1: "15",
                bonus_view_id1: "9",
                special_bonus_id2: "0",
                special_bonus_lv2: "0",
                bonus_view_id2: "0",
                causality_conditions: "[{\"raw\":true}]",
                special_asset_id: "400",
                detail_view_priority: "2",
            }], specialSets);
        (0, assert_1.deepEqual)(attack, {
            cardSpecialId: "100",
            specialSetId: "20",
            name: "Demon Death Ball",
            description: "Causes mega-colossal damage.",
            style: "Hyper",
            variant: "ultra",
            levelStart: 1,
            requiredKi: 18,
            viewId: "300",
            increaseRate: 250,
            levelBonus: 10,
            cardCostumeConditionId: "0",
            causalityConditionsRaw: "[{\"raw\":true}]",
            specialAssetId: "400",
            detailViewPriority: 2,
            specialBonuses: [
                { slot: 1, id: "8", level: 15, viewId: "9" },
                { slot: 2, id: "0", level: 0, viewId: "0" },
            ],
            provenance: {
                cardSpecial: { table: "card_specials", rowId: "100" },
                specialSet: { table: "special_sets", rowId: "20" },
            },
        });
        (0, assert_1.deepEqual)("multiplier" in attack, false);
    });
    (0, mocha_1.it)("maps only confirmed style labels and orders priority ties by row id", () => {
        const specialSets = new Map([
            ["2", { id: "2", name: "Unknown" }],
            ["3", { id: "3", name: "Unit" }],
        ]);
        const attacks = (0, game_db_super_attack_1.mapSuperAttacks)("1", [
            { id: "11", special_set_id: "2", priority: "1", style: "FutureStyle" },
            { id: "10", special_set_id: "3", priority: "1", style: "Condition" },
        ], specialSets);
        (0, assert_1.deepEqual)(attacks.map(attack => [attack.cardSpecialId, attack.variant]), [
            ["10", "unit"],
            ["11", "unknown"],
        ]);
    });
    (0, mocha_1.it)("fails closed when the first-party special-set join is missing", () => {
        (0, assert_1.throws)(() => (0, game_db_super_attack_1.mapSuperAttacks)("1", [{ id: "10", special_set_id: "404" }], new Map()), /row 10 references missing special_sets row 404/);
    });
    (0, mocha_1.it)("fails closed when duplicate card-special rows would repeat an attack", () => {
        (0, assert_1.throws)(() => (0, game_db_super_attack_1.mapSuperAttacks)("1", [
            { id: "10", special_set_id: "2" },
            { id: "10", special_set_id: "2" },
        ], new Map([["2", { id: "2", name: "Attack" }]])), /card_specials contains duplicate row id 10/);
    });
});
//# sourceMappingURL=game-db-super-attack.spec.js.map