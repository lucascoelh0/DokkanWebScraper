import { deepEqual, throws } from "assert";
import { describe, it } from "mocha";
import { mapActiveSkillSets } from "./game-db-active-skill";
import { GameDbRow } from "./game-db-source";

describe("mapActiveSkillSets", function () {
    it("preserves first-party active skill rows without assigning unproven semantics", () => {
        const activeSkillSetById = new Map<string, GameDbRow>([[
            "42",
            {
                id: "42",
                name: "Ace-in-the-Hole Kamehameha",
                effect_description: "Causes ultimate damage.",
                condition_description: "Can be activated once only.",
                turn: "4",
                exec_limit: "1",
                ultimate_special_id: "9001",
                special_view_id: "7001",
            },
        ]]);
        const effectsBySetId = new Map<string, GameDbRow[]>([[
            "42",
            [
                {
                    id: "101",
                    active_skill_set_id: "42",
                    target_type: "1",
                    sub_target_type_set_id: "",
                    calc_option: "2",
                    efficacy_type: "7",
                    eff_val1: "600",
                    eff_val2: "0",
                    eff_val3: "0",
                    efficacy_values: "[600,0,0]",
                    thumb_effect_id: "12",
                    effect_se_id: "34",
                },
                {
                    id: "102",
                    active_skill_set_id: "42",
                    target_type: "2",
                    calc_option: "0",
                    efficacy_type: "103",
                    eff_val1: "4031501",
                    eff_val2: "0",
                    eff_val3: "0",
                },
            ],
        ]]);

        const mapped = mapActiveSkillSets(
            [
                { id: "9", card_id: "1031501", active_skill_set_id: "42" },
                { id: "8", card_id: "1031501", active_skill_set_id: "42" },
            ],
            activeSkillSetById,
            effectsBySetId,
        );

        deepEqual(mapped, [{
            id: "42",
            name: "Ace-in-the-Hole Kamehameha",
            effectDescription: "Causes ultimate damage.",
            conditionDescription: "Can be activated once only.",
            turn: 4,
            execLimit: 1,
            ultimateSpecialId: "9001",
            specialViewId: "7001",
            effects: [
                {
                    id: "101",
                    activeSkillSetId: "42",
                    targetType: 1,
                    subTargetTypeSetId: undefined,
                    calcOption: 2,
                    efficacyType: 7,
                    values: ["600", "0", "0"],
                    efficacyValues: [600, 0, 0],
                    thumbEffectId: "12",
                    effectSeId: "34",
                    provenance: { table: "active_skills", rowId: "101" },
                },
                {
                    id: "102",
                    activeSkillSetId: "42",
                    targetType: 2,
                    subTargetTypeSetId: undefined,
                    calcOption: 0,
                    efficacyType: 103,
                    values: ["4031501", "0", "0"],
                    efficacyValues: [],
                    thumbEffectId: undefined,
                    effectSeId: undefined,
                    provenance: { table: "active_skills", rowId: "102" },
                },
            ],
            provenance: {
                relation: { table: "card_active_skills", rowId: "8" },
                set: { table: "active_skill_sets", rowId: "42" },
            },
        }]);
    });

    it("keeps three positional raw operands and orders effects by their first-party id", () => {
        const activeSkillSetById = new Map<string, GameDbRow>([[
            "42",
            { id: "42", name: "Skill" },
        ]]);
        const duplicate = {
            id: "11",
            active_skill_set_id: "42",
            eff_val1: "",
            eff_val2: "12.5",
            eff_val3: "opaque",
        };

        const [mapped] = mapActiveSkillSets(
            [{ id: "1", card_id: "100", active_skill_set_id: "42" }],
            activeSkillSetById,
            new Map([["42", [duplicate, {
                id: "2",
                active_skill_set_id: "42",
                eff_val1: "001",
                eff_val2: "",
                eff_val3: "-7",
            }, duplicate]]]),
        );

        deepEqual(mapped.effects.map(effect => ({ id: effect.id, values: effect.values })), [
            { id: "2", values: ["001", null, "-7"] },
            { id: "11", values: [null, "12.5", "opaque"] },
        ]);
    });

    it("fails closed when a card relation cannot resolve its active skill set", () => {
        throws(
            () => mapActiveSkillSets(
                [{ id: "17", card_id: "100", active_skill_set_id: "404" }],
                new Map(),
                new Map(),
            ),
            /row 17 references missing active_skill_sets row 404/,
        );
    });

    it("fails closed instead of hiding a malformed active skill effect", () => {
        throws(
            () => mapActiveSkillSets(
                [{ id: "1", card_id: "100", active_skill_set_id: "42" }],
                new Map([["42", { id: "42", name: "Skill" }]]),
                new Map([["42", [{ active_skill_set_id: "42", eff_val1: "1" }]]]),
            ),
            /active_skills contains an effect without an id or active_skill_set_id/,
        );
    });
});
