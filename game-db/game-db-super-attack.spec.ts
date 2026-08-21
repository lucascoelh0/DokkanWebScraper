import { deepEqual, throws } from "assert";
import { describe, it } from "mocha";
import { mapSuperAttacks } from "./game-db-super-attack";
import { GameDbRow } from "./game-db-source";

describe("mapSuperAttacks", function () {
    it("preserves first-party inputs without computing an unproven multiplier", () => {
        const specialSets = new Map<string, GameDbRow>([["20", {
            id: "20",
            name: "Demon Death Ball",
            description: "Causes mega-colossal damage.",
            increase_rate: "250",
            lv_bonus: "10",
        }]]);

        const [attack] = mapSuperAttacks("1031501", [{
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
        }], specialSets, new Map([["20", [{
            id: "1007731",
            special_set_id: "20",
            type: "Special::ExtraEfficacySpecial",
            efficacy_type: "111",
            target_type: "3",
            calc_option: "0",
            turn: "1",
            prob: "100",
            causality_conditions: "{\"compiled\":1}",
            eff_value1: "0",
            eff_value2: "0",
            eff_value3: "0",
        }]]]));

        deepEqual(attack, {
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
            effects: [{
                id: "1007731",
                specialSetId: "20",
                type: "Special::ExtraEfficacySpecial",
                efficacyType: 111,
                targetType: 3,
                calcOption: 0,
                turn: 1,
                probability: 100,
                causalityConditionsRaw: "{\"compiled\":1}",
                values: ["0", "0", "0"],
                provenance: { table: "specials", rowId: "1007731" },
            }],
            provenance: {
                cardSpecial: { table: "card_specials", rowId: "100" },
                specialSet: { table: "special_sets", rowId: "20" },
            },
        });
        deepEqual("multiplier" in attack, false);
    });

    it("maps only confirmed style labels and orders priority ties by row id", () => {
        const specialSets = new Map<string, GameDbRow>([
            ["2", { id: "2", name: "Unknown" }],
            ["3", { id: "3", name: "Unit" }],
        ]);
        const attacks = mapSuperAttacks("1", [
            { id: "11", special_set_id: "2", priority: "1", style: "FutureStyle" },
            { id: "10", special_set_id: "3", priority: "1", style: "Condition" },
        ], specialSets);

        deepEqual(attacks.map(attack => [attack.cardSpecialId, attack.variant]), [
            ["10", "unit"],
            ["11", "unknown"],
        ]);
    });

    it("fails closed when the first-party special-set join is missing", () => {
        throws(
            () => mapSuperAttacks("1", [{ id: "10", special_set_id: "404" }], new Map()),
            /row 10 references missing special_sets row 404/,
        );
    });

    it("fails closed when duplicate card-special rows would repeat an attack", () => {
        throws(
            () => mapSuperAttacks("1", [
                { id: "10", special_set_id: "2" },
                { id: "10", special_set_id: "2" },
            ], new Map([["2", { id: "2", name: "Attack" }]])),
            /card_specials contains duplicate row id 10/,
        );
    });

    it("orders raw effects without assigning unproven behavior", () => {
        const [attack] = mapSuperAttacks(
            "1",
            [{ id: "10", special_set_id: "2" }],
            new Map([["2", { id: "2", name: "Attack" }]]),
            new Map([["2", [
                { id: "11", special_set_id: "2", efficacy_type: "111", eff_value1: "" },
                { id: "2", special_set_id: "2", efficacy_type: "1", eff_value1: "12.5", eff_value2: "opaque" },
            ]]]),
        );

        deepEqual(attack.effects.map(effect => ({
            id: effect.id,
            efficacyType: effect.efficacyType,
            values: effect.values,
        })), [
            { id: "2", efficacyType: 1, values: ["12.5", "opaque", null] },
            { id: "11", efficacyType: 111, values: [null, null, null] },
        ]);
        deepEqual("kind" in attack.effects[1], false);
        deepEqual("multiplier" in attack, false);
    });

    it("fails closed when duplicate raw effect ids would make selection ambiguous", () => {
        throws(
            () => mapSuperAttacks(
                "1",
                [{ id: "10", special_set_id: "2" }],
                new Map([["2", { id: "2", name: "Attack" }]]),
                new Map([["2", [
                    { id: "11", special_set_id: "2", efficacy_type: "111" },
                    { id: "11", special_set_id: "2", efficacy_type: "1" },
                ]]]),
            ),
            /specials contains duplicate row id 11/,
        );
    });

    it("fails closed instead of hiding a malformed or mis-grouped raw effect", () => {
        throws(
            () => mapSuperAttacks(
                "1",
                [{ id: "10", special_set_id: "2" }],
                new Map([["2", { id: "2", name: "Attack" }]]),
                new Map([["2", [{ special_set_id: "2" }]]]),
            ),
            /specials contains an effect without an id or special_set_id/,
        );
        throws(
            () => mapSuperAttacks(
                "1",
                [{ id: "10", special_set_id: "2" }],
                new Map([["2", { id: "2", name: "Attack" }]]),
                new Map([["2", [{ id: "20", special_set_id: "3" }]]]),
            ),
            /specials row 20 belongs to special_set_id 3, expected 2/,
        );
    });
});
