import { deepEqual, equal } from "assert";
import { describe, it } from "mocha";
import { buildDatabaseTeamAnalysisDataset, mapDatabasePassiveEffects, mapDatabasePassiveRule } from "./team-analysis-builder";

function sourced(table: string, row: Record<string, any>) {
    return { values: row, provenance: { table, rowId: String(row.id), columns: Object.keys(row) } };
}

function rule(skill: Record<string, any>) {
    return mapDatabasePassiveRule("10", {
        relation: sourced("passive_skill_set_relations", { id: 1, passive_skill_set_id: 10, passive_skill_id: skill.id }),
        skill: sourced("passive_skills", skill),
        causalities: [],
    })!;
}

describe("database Team Analysis projector", function () {
    it("maps composite stats and enemy targets without reading text", () => {
        const self = mapDatabasePassiveEffects({ efficacy_type: 3, target_type: 1, calc_option: 2, probability: 100, eff_value1: 120, eff_value2: 80 });
        deepEqual(self.map(effect => [effect.kind.value, effect.value, effect.unit]), [["atk", 120, "percent"], ["def", 80, "percent"]]);
        const enemy = mapDatabasePassiveEffects({ efficacy_type: 3, target_type: 4, calc_option: 3, probability: 30, eff_value1: 20, eff_value2: 10 });
        deepEqual(enemy.map(effect => [effect.kind.value, effect.target.targetType.value]), [["enemy_atk_down", "all_enemies"], ["enemy_def_down", "all_enemies"]]);
    });

    it("normalizes the proven damage-reduction remaining factor", () => {
        const effects = mapDatabasePassiveEffects({ efficacy_type: 13, target_type: 1, calc_option: 2, probability: 100, eff_value1: 70 });
        deepEqual(effects.map(effect => [effect.kind.value, effect.value, effect.unit]), [["damage_reduction", 30, "percent"]]);
    });

    it("preserves both additional attempts and their distinct probabilities", () => {
        const effects = mapDatabasePassiveEffects({ efficacy_type: 81, target_type: 1, probability: 100, eff_value2: 50, eff_value3: 7 });
        deepEqual(effects.map(effect => [effect.kind.value, effect.activationChancePercent, effect.additionalToSuperChancePercent]), [
            ["additional_attack", 100, 7],
            ["additional_attack", 50, 7],
        ]);
    });

    it("keeps unconfirmed efficacy and causalities explicitly unknown", () => {
        const mapped = rule({ id: 20, efficacy_type: 999, target_type: 1, calc_option: 0, causality_conditions: "{\"compiled\":42}" });
        equal(mapped.effects[0].kind.value, "unknown");
        equal(mapped.effectMappingStatus, "unknown");
        equal(mapped.condition.mappingStatus, "structured-uninterpreted");
        deepEqual(mapped.condition.referencedCausalityIds, ["42"]);
        deepEqual(mapped.unknowns, ["efficacy_type:999"]);
    });

    it("uses the latest source state while keeping nested-form compatibility keys stable", () => {
        const state = (stateKey: string, releaseState: string) => ({ stateKey, releaseState, release: { availableAtSnapshot: true }, attacks: [] });
        const base = {
            cardId: "100", catalog: { isProjectedPrimary: true }, localizedText: { name: "Base" },
            skillStates: [state("100:initial", "initial"), state("100:growth-8", "seza")],
            formRelations: [{ targetCardId: "400" }],
        };
        const form = {
            cardId: "400", catalog: { isProjectedPrimary: false }, localizedText: { name: "Form" },
            skillStates: [state("400:initial", "initial"), state("400:growth-7", "eza")], formRelations: [],
        };
        const dataset = buildDatabaseTeamAnalysisDataset({
            characterDataset: { contractVersion: "1.1.0", sourceSnapshotVersion: "fixture", sourceSha256: "a".repeat(64), cards: [base, form] } as any,
            tables: { sub_target_types: [] } as any,
            generatedAt: "2026-08-05T00:00:00.000Z",
            auditedCompatibilityCardIds: [],
        });
        deepEqual(dataset.states.map(value => [value.stateKey, value.sourceStateKey, value.sourceReleaseState]), [
            ["100:100:seza", "100:growth-8", "seza"],
            ["100:400:initial", "400:growth-7", "eza"],
        ]);
    });
});
