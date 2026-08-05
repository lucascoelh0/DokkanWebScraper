"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = require("assert");
const mocha_1 = require("mocha");
const builder_1 = require("./builder");
function fixtureTables() {
    const tables = Object.fromEntries(Object.keys(builder_1.CONSUMED_TABLE_COLUMNS).map(table => [table, []]));
    tables.cards = [
        { id: 1000000, name: "Base", character_id: 1, card_unique_info_id: 10, rarity: 4, element: 3, hp_init: 1000, hp_max: 2000, atk_init: 500, atk_max: 1500, def_init: 400, def_max: 1200, lv_max: 120, skill_lv_max: 10, optimal_awakening_grow_type: 7, passive_skill_set_id: 20, leader_skill_set_id: 30, link_skill1_id: 40, collectable_type: 1, is_selling_only: 0, open_at: "2020-01-01 00:00:00" },
        { id: 4000000, name: "Form", character_id: 2, card_unique_info_id: 11, rarity: 4, element: 13, hp_init: 1000, hp_max: 2000, atk_init: 500, atk_max: 1500, def_init: 400, def_max: 1200, lv_max: 120, skill_lv_max: 10, passive_skill_set_id: 21, leader_skill_set_id: 31, collectable_type: 1, is_selling_only: 0, open_at: "2020-01-01 00:00:00" },
    ];
    tables.characters = [{ id: 1, name: "Base character" }, { id: 2, name: "Form character" }];
    tables.card_unique_infos = [{ id: 10, name: "Identity A" }, { id: 11, name: "Identity B" }];
    tables.link_skills = [{ id: 40, name: "Prepared for Battle" }];
    tables.card_categories = [{ id: 50, name: "Transformation Boost" }];
    tables.card_card_categories = [{ id: 1, card_id: 1000000, card_category_id: 50, num: 1 }];
    tables.leader_skill_sets = [{ id: 30, name: "Leader", description: "Structured leader" }, { id: 300, name: "Growth Leader", description: "Growth structured leader" }];
    tables.leader_skills = [{ id: 1, leader_skill_set_id: 300, efficacy_type: 82, efficacy_values: "[31,170,0]", sub_target_type_set_id: 90 }];
    tables.sub_target_types = [{ id: 1, sub_target_type_set_id: 90, target_value_type: 1, target_value: 50 }];
    tables.passive_skill_sets = [{ id: 20, name: "Passive", itemized_description: "Passive text" }, { id: 200, name: "Growth Passive", itemized_description: "Growth text" }];
    tables.passive_skill_set_relations = [{ id: 1, passive_skill_set_id: 20, passive_skill_id: 60 }, { id: 2, passive_skill_set_id: 200, passive_skill_id: 61 }];
    tables.passive_skills = [
        { id: 60, name: "Exchange", efficacy_type: 131, eff_value1: 4000000, passive_skill_effect_id: 70, causality_conditions: "{\"compiled\":80}" },
        { id: 61, name: "Unknown", efficacy_type: 999, eff_value1: 4000000 },
    ];
    tables.passive_skill_effects = [{ id: 70, script_name: "effect" }];
    tables.skill_causalities = [{ id: 80, causality_type: 9, cau_val1: 1 }];
    tables.optimal_awakening_growths = [{ id: 1, optimal_awakening_grow_type: 7, step: 8, lv_max: 140, skill_lv_max: 15, passive_skill_set_id: 200, leader_skill_set_id: 300 }];
    tables.card_awakening_routes = [{ id: 1, type: "CardAwakeningRoute::Optimal", card_id: 1000000, awaked_card_id: 1000000, optimal_awakening_step: 8, optimal_awakening_type: 2, open_at: "2024-01-01 00:00:00" }];
    tables.collection_cards = [{ id: 1, collection_unique_id: 1, card_id: 1000000, priority: 1 }];
    tables.collection_uniques = [{ id: 1, name: "Base identity", card_id: 1000000 }];
    tables.card_specials = [
        { id: 101, card_id: 1000000, special_set_id: 201, style: "Normal", lv_start: 0 },
        { id: 102, card_id: 1000000, special_set_id: 202, style: "Hyper", lv_start: 0 },
        { id: 103, card_id: 1000000, special_set_id: 203, style: "Condition", lv_start: 0 },
        { id: 104, card_id: 1000000, special_set_id: 204, style: "Extra", lv_start: 0 },
    ];
    tables.special_sets = [201, 202, 203, 204].map(value => ({ id: value, name: `Attack ${value}`, description: `Effect ${value}` }));
    tables.specials = [{ id: 1, special_set_id: 201, efficacy_type: 1 }];
    tables.extra_special_options = [{ id: 1, card_special_id: 104, probability: 50, extra_special_type: 2 }];
    tables.card_active_skills = [{ id: 1, card_id: 1000000, active_skill_set_id: 500 }];
    tables.active_skill_sets = [{ id: 500, name: "Active", effect_description: "Transform" }];
    tables.active_skills = [{ id: 501, active_skill_set_id: 500, efficacy_type: 103, eff_val1: 4000000 }];
    return tables;
}
(0, mocha_1.describe)("database experiment builder", function () {
    (0, mocha_1.it)("joins structured rows, preserves unknowns and is deterministic", () => {
        const options = { tables: fixtureTables(), generatedAt: "2026-08-05T00:00:00.000Z", sourceSnapshotVersion: "fixture", sourceSha256: "a".repeat(64), releasedAtOrBefore: "2026-08-05 23:59:59" };
        const first = (0, builder_1.buildDatabaseExperimentDataset)(options);
        const second = (0, builder_1.buildDatabaseExperimentDataset)(options);
        (0, assert_1.deepEqual)(first, second);
        (0, assert_1.equal)(new Set(first.cards.map(card => card.cardId)).size, first.cards.length);
        const base = first.cards.find(card => card.cardId === "1000000");
        (0, assert_1.ok)(base);
        (0, assert_1.equal)(base.characterClass.value, "unawakened");
        (0, assert_1.equal)(base.skillStates[1].releaseState, "seza");
        (0, assert_1.equal)(base.skillStates[1].release.availableAt, "2024-01-01 00:00:00");
        (0, assert_1.equal)(base.catalog.isProjectedPrimary, true);
        (0, assert_1.deepEqual)(base.skillStates[1].leaderSkill?.structuredPercentValues, [170]);
        (0, assert_1.equal)(base.skillStates[0].passiveSkill?.relations[0].causalities[0].values.id, 80);
        (0, assert_1.deepEqual)(base.skillStates[1].attacks.map(attack => attack.variant.value), ["super", "ultra", "unit", "ex"]);
        (0, assert_1.ok)(base.formRelations.some(relation => relation.kind.value === "reversible-exchange"));
        (0, assert_1.ok)(base.formRelations.some(relation => relation.kind.value === "transformation"));
        (0, assert_1.equal)(first.cards.find(card => card.cardId === "4000000")?.grouping.hardDuplicateGroupId, base.grouping.hardDuplicateGroupId);
        const coverage = (0, builder_1.buildCoverage)(first);
        (0, assert_1.equal)(coverage.confirmedEzaStateCount, 0);
        (0, assert_1.equal)(coverage.confirmedSezaStateCount, 1);
        (0, assert_1.equal)(coverage.unknownReleaseStateCount, 0);
    });
});
//# sourceMappingURL=builder.spec.js.map