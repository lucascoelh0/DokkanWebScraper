"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = require("assert");
const mocha_1 = require("mocha");
const game_db_active_skill_1 = require("./game-db-active-skill");
(0, mocha_1.describe)("mapActiveSkillSets", function () {
    (0, mocha_1.it)("maps a turn-only first-party Active Skill condition as supported", () => {
        const [mapped] = (0, game_db_active_skill_1.mapActiveSkillSets)([{ id: "378", card_id: "1034341", active_skill_set_id: "378" }], new Map([[
                "378",
                { id: "378", name: "Special Beast Cannon", causality_conditions: '{"compiled":3139}' },
            ]]), new Map(), new Map(), new Map([[
                "3139",
                { id: "3139", causality_type: "5", cau_val1: "3", cau_val2: "0", cau_val3: "0" },
            ]]));
        (0, assert_1.deepEqual)(mapped.activationCondition, {
            status: "supported",
            expression: {
                op: "predicate",
                predicate: {
                    kind: "battle_turn",
                    comparator: "gte",
                    value: 4,
                    evidenceStatus: "supported",
                    provenance: {
                        table: "skill_causalities",
                        rowId: "3139",
                        causalityType: 5,
                        values: [3, 0, 0],
                    },
                },
            },
            provenance: {
                activeSkillSet: { table: "active_skill_sets", rowId: "378" },
                causalities: [{ table: "skill_causalities", rowId: "3139" }],
            },
        });
    });
    (0, mocha_1.it)("preserves the official OR-of-AND activation condition without flattening it", () => {
        const [mapped] = (0, game_db_active_skill_1.mapActiveSkillSets)([{ id: "174", card_id: "1025561", active_skill_set_id: "174" }], new Map([[
                "174",
                {
                    id: "174",
                    name: "Beastly Awakening",
                    condition_description: [
                        'Can be activated when there are 3 "Super Heroes" ',
                        "Category allies attacking in the same turn ",
                        "starting from the 3rd turn from the start of battle, ",
                        "or when facing only 1 enemy starting from the ",
                        "6th turn from the start of battle (once only)",
                    ].join("\n"),
                    causality_conditions: '{"compiled":["|",["&",2024,2025],["&",2026,2027]]}',
                },
            ]]), new Map(), new Map(), new Map([
            ["2024", { id: "2024", causality_type: "5", cau_val1: "2", cau_val2: "0", cau_val3: "0" }],
            ["2025", { id: "2025", causality_type: "34", cau_val1: "2", cau_val2: "88", cau_val3: "3" }],
            ["2026", { id: "2026", causality_type: "5", cau_val1: "5", cau_val2: "0", cau_val3: "0" }],
            ["2027", { id: "2027", causality_type: "16", cau_val1: "2", cau_val2: "0", cau_val3: "0" }],
        ]), new Map([["88", { id: "88", name: "Super Heroes" }]]));
        (0, assert_1.deepEqual)(mapped.activationCondition?.status, "partial");
        (0, assert_1.deepEqual)(mapped.activationCondition?.expression, {
            op: "any",
            children: [
                {
                    op: "all",
                    children: [
                        {
                            op: "predicate",
                            predicate: {
                                kind: "battle_turn",
                                comparator: "gte",
                                value: 3,
                                evidenceStatus: "supported",
                                provenance: {
                                    table: "skill_causalities",
                                    rowId: "2024",
                                    causalityType: 5,
                                    values: [2, 0, 0],
                                },
                            },
                        },
                        {
                            op: "predicate",
                            predicate: {
                                kind: "rotation_category_count",
                                comparator: "gte",
                                count: 3,
                                categories: ["Super Heroes"],
                                selfInclusion: "included",
                                evidenceStatus: "supported",
                                provenance: {
                                    table: "skill_causalities",
                                    rowId: "2025",
                                    causalityType: 34,
                                    values: [2, 88, 3],
                                },
                            },
                        },
                    ],
                },
                {
                    op: "all",
                    children: [
                        {
                            op: "predicate",
                            predicate: {
                                kind: "battle_turn",
                                comparator: "gte",
                                value: 6,
                                evidenceStatus: "supported",
                                provenance: {
                                    table: "skill_causalities",
                                    rowId: "2026",
                                    causalityType: 5,
                                    values: [5, 0, 0],
                                },
                            },
                        },
                        {
                            op: "predicate",
                            predicate: {
                                kind: "enemy_count",
                                comparator: "eq",
                                count: 1,
                                evidenceStatus: "partial",
                                provenance: {
                                    table: "skill_causalities",
                                    rowId: "2027",
                                    causalityType: 16,
                                    values: [2, 0, 0],
                                },
                            },
                        },
                    ],
                },
            ],
        });
    });
    (0, mocha_1.it)("does not generalize the audited rotation causality when first-party evidence drifts", () => {
        const [mapped] = (0, game_db_active_skill_1.mapActiveSkillSets)([{ id: "174", card_id: "1025561", active_skill_set_id: "174" }], new Map([[
                "174",
                {
                    id: "174",
                    name: "Beastly Awakening",
                    condition_description: "A different, unaudited description",
                    causality_conditions: '{"compiled":["|",["&",2024,2025],["&",2026,2027]]}',
                },
            ]]), new Map(), new Map(), new Map([
            ["2024", { id: "2024", causality_type: "5", cau_val1: "2", cau_val2: "0", cau_val3: "0" }],
            ["2025", { id: "2025", causality_type: "34", cau_val1: "2", cau_val2: "88", cau_val3: "3" }],
            ["2026", { id: "2026", causality_type: "5", cau_val1: "5", cau_val2: "0", cau_val3: "0" }],
            ["2027", { id: "2027", causality_type: "16", cau_val1: "2", cau_val2: "0", cau_val3: "0" }],
        ]), new Map([["88", { id: "88", name: "Super Heroes" }]]));
        const expression = mapped.activationCondition?.expression;
        if (!expression || expression.op !== "any")
            throw new Error("expected an any expression");
        const teamRoute = expression.children[0];
        if (teamRoute.op !== "all")
            throw new Error("expected the first route to be all");
        const category = teamRoute.children[1];
        if (category.op !== "predicate")
            throw new Error("expected the category predicate");
        (0, assert_1.deepEqual)(category.predicate.evidenceStatus, "partial");
    });
    (0, mocha_1.it)("requires the exact audited type-34 operands before marking the leaf supported", () => {
        const conditionDescription = [
            'Can be activated when there are 3 "Super Heroes" ',
            "Category allies attacking in the same turn ",
            "starting from the 3rd turn from the start of battle, ",
            "or when facing only 1 enemy starting from the ",
            "6th turn from the start of battle (once only)",
        ].join("\n");
        const drifts = [
            { cau_val1: "1", cau_val2: "88", cau_val3: "3" },
            { cau_val1: "2", cau_val2: "89", cau_val3: "3" },
            { cau_val1: "2", cau_val2: "88", cau_val3: "4" },
        ];
        for (const drift of drifts) {
            const [mapped] = (0, game_db_active_skill_1.mapActiveSkillSets)([{ id: "174", card_id: "1025561", active_skill_set_id: "174" }], new Map([[
                    "174",
                    {
                        id: "174",
                        name: "Beastly Awakening",
                        condition_description: conditionDescription,
                        causality_conditions: '{"compiled":["|",["&",2024,2025],["&",2026,2027]]}',
                    },
                ]]), new Map(), new Map(), new Map([
                ["2024", { id: "2024", causality_type: "5", cau_val1: "2", cau_val2: "0", cau_val3: "0" }],
                ["2025", { id: "2025", causality_type: "34", ...drift }],
                ["2026", { id: "2026", causality_type: "5", cau_val1: "5", cau_val2: "0", cau_val3: "0" }],
                ["2027", { id: "2027", causality_type: "16", cau_val1: "2", cau_val2: "0", cau_val3: "0" }],
            ]), new Map([
                ["88", { id: "88", name: "Super Heroes" }],
                ["89", { id: "89", name: "Other Category" }],
            ]));
            const expression = mapped.activationCondition?.expression;
            if (!expression || expression.op !== "any")
                throw new Error("expected an any expression");
            const teamRoute = expression.children[0];
            if (teamRoute.op !== "all")
                throw new Error("expected the first route to be all");
            const category = teamRoute.children[1];
            if (category.op !== "predicate")
                throw new Error("expected the category predicate");
            (0, assert_1.deepEqual)(category.predicate.evidenceStatus === "supported", false);
        }
    });
    (0, mocha_1.it)("pins first-party ultimate attack semantics against real FYI cards", () => {
        // Evidence snapshot (Global DB 1782367825):
        // - card 1024991 -> active set 156 -> ultimate 36; ultimate_specials(36) = 600, aim_target 0
        // - card 1020341 -> active set 83 -> ultimate 12; ultimate_specials(12) = 440, aim_target 1
        // FYI caches for the same cards expose 600/false and 440/true respectively.
        const mapped = (0, game_db_active_skill_1.mapActiveSkillSets)([
            { id: "115", card_id: "1020341", active_skill_set_id: "83" },
            { id: "227", card_id: "1024991", active_skill_set_id: "156" },
        ], new Map([
            ["83", { id: "83", name: "Final Explosion", ultimate_special_id: "12" }],
            ["156", { id: "156", name: "Ace-in-the-Hole Kamehameha", ultimate_special_id: "36" }],
        ]), new Map(), new Map([
            ["12", { id: "12", increase_rate: "440", aim_target: "1" }],
            ["36", { id: "36", increase_rate: "600", aim_target: "0" }],
        ]));
        (0, assert_1.deepEqual)(mapped.map(skill => ({
            id: skill.id,
            ultimateSpecialId: skill.ultimateSpecialId,
            attackMultiplierPercent: skill.ultimateAttack?.attackMultiplierPercent,
            isMultiTarget: skill.ultimateAttack?.isMultiTarget,
        })), [
            {
                id: "83",
                ultimateSpecialId: "12",
                attackMultiplierPercent: 440,
                isMultiTarget: true,
            },
            {
                id: "156",
                ultimateSpecialId: "36",
                attackMultiplierPercent: 600,
                isMultiTarget: false,
            },
        ]);
    });
    (0, mocha_1.it)("preserves first-party active skill rows without assigning unproven semantics", () => {
        const activeSkillSetById = new Map([[
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
        const effectsBySetId = new Map([[
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
        const mapped = (0, game_db_active_skill_1.mapActiveSkillSets)([
            { id: "9", card_id: "1031501", active_skill_set_id: "42" },
            { id: "8", card_id: "1031501", active_skill_set_id: "42" },
        ], activeSkillSetById, effectsBySetId, new Map([["9001", {
                    id: "9001",
                    name: "Ultimate attack",
                    description: "Ultimate damage +50%",
                    increase_rate: "600",
                    aim_target: "0",
                }]]));
        (0, assert_1.deepEqual)(mapped, [{
                id: "42",
                name: "Ace-in-the-Hole Kamehameha",
                effectDescription: "Causes ultimate damage.",
                conditionDescription: "Can be activated once only.",
                turn: 4,
                execLimit: 1,
                ultimateSpecialId: "9001",
                ultimateAttack: {
                    id: "9001",
                    name: "Ultimate attack",
                    description: "Ultimate damage +50%",
                    attackMultiplierPercent: 600,
                    isMultiTarget: false,
                    provenance: { table: "ultimate_specials", rowId: "9001" },
                },
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
    (0, mocha_1.it)("keeps three positional raw operands and orders effects by their first-party id", () => {
        const activeSkillSetById = new Map([[
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
        const [mapped] = (0, game_db_active_skill_1.mapActiveSkillSets)([{ id: "1", card_id: "100", active_skill_set_id: "42" }], activeSkillSetById, new Map([["42", [duplicate, {
                        id: "2",
                        active_skill_set_id: "42",
                        eff_val1: "001",
                        eff_val2: "",
                        eff_val3: "-7",
                    }, duplicate]]]));
        (0, assert_1.deepEqual)(mapped.effects.map(effect => ({ id: effect.id, values: effect.values })), [
            { id: "2", values: ["001", null, "-7"] },
            { id: "11", values: [null, "12.5", "opaque"] },
        ]);
    });
    (0, mocha_1.it)("fails closed when a card relation cannot resolve its active skill set", () => {
        (0, assert_1.throws)(() => (0, game_db_active_skill_1.mapActiveSkillSets)([{ id: "17", card_id: "100", active_skill_set_id: "404" }], new Map(), new Map()), /row 17 references missing active_skill_sets row 404/);
    });
    (0, mocha_1.it)("fails closed instead of hiding a malformed active skill effect", () => {
        (0, assert_1.throws)(() => (0, game_db_active_skill_1.mapActiveSkillSets)([{ id: "1", card_id: "100", active_skill_set_id: "42" }], new Map([["42", { id: "42", name: "Skill" }]]), new Map([["42", [{ active_skill_set_id: "42", eff_val1: "1" }]]])), /active_skills contains an effect without an id or active_skill_set_id/);
    });
});
//# sourceMappingURL=game-db-active-skill.spec.js.map