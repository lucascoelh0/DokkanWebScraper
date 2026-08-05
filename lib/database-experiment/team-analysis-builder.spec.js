"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = require("assert");
const mocha_1 = require("mocha");
const team_analysis_builder_1 = require("./team-analysis-builder");
function sourced(table, row) {
    return { values: row, provenance: { table, rowId: String(row.id), columns: Object.keys(row) } };
}
function rule(skill) {
    return (0, team_analysis_builder_1.mapDatabasePassiveRule)("10", {
        relation: sourced("passive_skill_set_relations", { id: 1, passive_skill_set_id: 10, passive_skill_id: skill.id }),
        skill: sourced("passive_skills", skill),
        causalities: [],
    });
}
(0, mocha_1.describe)("database Team Analysis projector", function () {
    (0, mocha_1.it)("maps composite stats and enemy targets without reading text", () => {
        const self = (0, team_analysis_builder_1.mapDatabasePassiveEffects)({ efficacy_type: 3, target_type: 1, calc_option: 2, probability: 100, eff_value1: 120, eff_value2: 80 });
        (0, assert_1.deepEqual)(self.map(effect => [effect.kind.value, effect.value, effect.unit]), [["atk", 120, "percent"], ["def", 80, "percent"]]);
        const enemy = (0, team_analysis_builder_1.mapDatabasePassiveEffects)({ efficacy_type: 3, target_type: 4, calc_option: 3, probability: 30, eff_value1: 20, eff_value2: 10 });
        (0, assert_1.deepEqual)(enemy.map(effect => [effect.kind.value, effect.target.targetType.value]), [["enemy_atk_down", "all_enemies"], ["enemy_def_down", "all_enemies"]]);
    });
    (0, mocha_1.it)("normalizes the proven damage-reduction remaining factor", () => {
        const effects = (0, team_analysis_builder_1.mapDatabasePassiveEffects)({ efficacy_type: 13, target_type: 1, calc_option: 2, probability: 100, eff_value1: 70 });
        (0, assert_1.deepEqual)(effects.map(effect => [effect.kind.value, effect.value, effect.unit]), [["damage_reduction", 30, "percent"]]);
    });
    (0, mocha_1.it)("preserves both additional attempts and their distinct probabilities", () => {
        const effects = (0, team_analysis_builder_1.mapDatabasePassiveEffects)({ efficacy_type: 81, target_type: 1, probability: 100, eff_value2: 50, eff_value3: 7 });
        (0, assert_1.deepEqual)(effects.map(effect => [effect.kind.value, effect.activationChancePercent, effect.additionalToSuperChancePercent]), [
            ["additional_attack", 100, 7],
            ["additional_attack", 50, 7],
        ]);
    });
    (0, mocha_1.it)("keeps unconfirmed efficacy and causalities explicitly unknown", () => {
        const mapped = rule({ id: 20, efficacy_type: 999, target_type: 1, calc_option: 0, causality_conditions: "{\"compiled\":42}" });
        (0, assert_1.equal)(mapped.effects[0].kind.value, "unknown");
        (0, assert_1.equal)(mapped.effectMappingStatus, "unknown");
        (0, assert_1.equal)(mapped.condition.mappingStatus, "structured-uninterpreted");
        (0, assert_1.deepEqual)(mapped.condition.referencedCausalityIds, ["42"]);
        (0, assert_1.deepEqual)(mapped.unknowns, ["efficacy_type:999"]);
    });
    (0, mocha_1.it)("uses the latest source state while keeping nested-form compatibility keys stable", () => {
        const state = (stateKey, releaseState) => ({ stateKey, releaseState, release: { availableAtSnapshot: true }, attacks: [] });
        const base = {
            cardId: "100", catalog: { isProjectedPrimary: true }, localizedText: { name: "Base" },
            skillStates: [state("100:initial", "initial"), state("100:growth-8", "seza")],
            formRelations: [{ targetCardId: "400" }],
        };
        const form = {
            cardId: "400", catalog: { isProjectedPrimary: false }, localizedText: { name: "Form" },
            skillStates: [state("400:initial", "initial"), state("400:growth-7", "eza")], formRelations: [],
        };
        const dataset = (0, team_analysis_builder_1.buildDatabaseTeamAnalysisDataset)({
            characterDataset: { contractVersion: "1.1.0", sourceSnapshotVersion: "fixture", sourceSha256: "a".repeat(64), cards: [base, form] },
            tables: { sub_target_types: [] },
            generatedAt: "2026-08-05T00:00:00.000Z",
            auditedCompatibilityCardIds: [],
        });
        (0, assert_1.deepEqual)(dataset.states.map(value => [value.stateKey, value.sourceStateKey, value.sourceReleaseState]), [
            ["100:100:seza", "100:growth-8", "seza"],
            ["100:400:initial", "400:growth-7", "eza"],
        ]);
    });
});
//# sourceMappingURL=team-analysis-builder.spec.js.map