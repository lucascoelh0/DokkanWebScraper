import { deepEqual, equal } from "assert";
import { describe, it } from "mocha";
import { mapDatabasePassiveRule } from "./team-analysis-builder";
import { decodeSphereMask, mapDatabaseTeamAnalysisDb3Rule } from "./team-analysis-db3-builder";

function sourced(table: string, row: Record<string, any>) {
    return { values: row, provenance: { table, rowId: String(row.id), columns: Object.keys(row) } };
}

function mapRule(skill: Record<string, any>, causalities: Array<Record<string, any>> = [], subTargets: Array<Record<string, any>> = []) {
    const db2 = mapDatabasePassiveRule("10", {
        relation: sourced("passive_skill_set_relations", { id: 1, passive_skill_set_id: 10, passive_skill_id: skill.id }),
        skill: sourced("passive_skills", skill),
        causalities: causalities.map(row => sourced("skill_causalities", row)),
    }, subTargets.map(row => sourced("sub_target_types", row)))!;
    return mapDatabaseTeamAnalysisDb3Rule(db2, { card_categories: [] } as any);
}

describe("database Team Analysis DB3 projector", function () {
    it("decodes only the confirmed low six Ki Sphere bits", () => {
        deepEqual(decodeSphereMask(31), { rawMask: 31, types: ["AGL", "TEQ", "INT", "STR", "PHY"], semantic: "non_rainbow", unknownMask: 0, evidence: "first-party-row-join" });
        deepEqual(decodeSphereMask(63).semantic, "any");
        equal(decodeSphereMask(64).semantic, "unknown");
        equal(decodeSphereMask(64).unknownMask, 64);
    });

    it("maps efficacy 68 selector 3 to both ATK and DEF per sphere", () => {
        const rule = mapRule({ id: 1, efficacy_type: 68, target_type: 1, calc_option: 2, eff_value1: 63, eff_value2: 3, eff_value3: 12 });
        deepEqual(rule.effects.map(effect => [effect.kind, effect.value, effect.unit, effect.scaling?.kind]), [
            ["atk", 12, "percent", "per_ki_sphere"],
            ["def", 12, "percent", "per_ki_sphere"],
        ]);
        equal(rule.effectStatus, "supported");
    });

    it("normalizes the proven turn offset but leaves compiled operators unknown", () => {
        const single = mapRule(
            { id: 2, efficacy_type: 3, target_type: 1, calc_option: 2, eff_value1: 10, eff_value2: 10, causality_conditions: "{\"compiled\":1281}" },
            [{ id: 1281, causality_type: 5, cau_val1: 3, cau_val2: 0, cau_val3: 0 }],
        );
        equal(single.condition.op, "predicate");
        if (single.condition.op === "predicate") deepEqual([single.condition.predicate.kind, single.condition.predicate.value], ["battle_turn", 4]);
        const composite = mapRule(
            { id: 3, efficacy_type: 3, target_type: 1, calc_option: 2, eff_value1: 10, eff_value2: 10, causality_conditions: "{\"compiled\":[\"&\",1281,21]}" },
            [
                { id: 1281, causality_type: 5, cau_val1: 3, cau_val2: 0, cau_val3: 0 },
                { id: 21, causality_type: 1, cau_val1: 50, cau_val2: 0, cau_val3: 0 },
            ],
        );
        equal(composite.condition.op, "unknown");
        equal(composite.conditionStatus, "unknown");
        equal(composite.source.compiledConditionOperator, "&");
    });

    it("uses attack received as the proven efficacy 98 scaling event", () => {
        const rule = mapRule(
            { id: 4, efficacy_type: 98, exec_timing_type: 7, target_type: 1, calc_option: 2, eff_value1: 20, eff_value2: 100, eff_value3: 0, causality_conditions: "{\"compiled\":24}" },
            [{ id: 24, causality_type: 24, cau_val1: 0, cau_val2: 0, cau_val3: 0 }],
        );
        equal(rule.condition.op, "always");
        deepEqual(rule.effects.map(effect => [effect.kind, effect.value, effect.stackCap, effect.scaling]), [[
            "atk", 20, 100, { kind: "per_combat_event", event: "attack_received", eventsPerIncrement: 1 },
        ]]);
    });

    it("does not promote invalid or composite conditions to always", () => {
        const invalid = mapRule({ id: 5, efficacy_type: 98, exec_timing_type: 7, target_type: 1, calc_option: 2, eff_value1: 20, eff_value2: 100, eff_value3: 0, causality_conditions: "not-json" });
        equal(invalid.condition.op, "unknown");
        equal(invalid.conditionStatus, "unknown");
        const composite = mapRule(
            { id: 6, efficacy_type: 98, exec_timing_type: 7, target_type: 1, calc_option: 2, eff_value1: 20, eff_value2: 100, eff_value3: 0, causality_conditions: "{\"compiled\":[\"|\",24,13]}" },
            [
                { id: 24, causality_type: 24, cau_val1: 0, cau_val2: 0, cau_val3: 0 },
                { id: 13, causality_type: 25, cau_val1: 0, cau_val2: 0, cau_val3: 0 },
            ],
        );
        equal(composite.condition.op, "unknown");
        equal(composite.conditionStatus, "unknown");
    });

    it("keeps snapshot-specific Super timing and malformed numerics unknown", () => {
        const superTiming = mapRule(
            { id: 7, efficacy_type: 98, exec_timing_type: 5, target_type: 1, calc_option: 0, eff_value1: 1, eff_value2: 3, eff_value3: 5, causality_conditions: "{\"compiled\":435}" },
            [{ id: 435, causality_type: 40, cau_val1: 0, cau_val2: 0, cau_val3: 0 }],
        );
        equal(superTiming.effects[0].scaling?.kind, "unknown");
        equal(superTiming.effectStatus, "unknown");
        const missing = mapRule({ id: 8, efficacy_type: 96, target_type: 1, calc_option: 0, eff_value1: 63, eff_value2: null });
        equal(missing.effects[0].kind, "unknown");
        const fractionalMask = mapRule({ id: 9, efficacy_type: 96, target_type: 1, calc_option: 0, eff_value1: 1.5, eff_value2: 1 });
        equal(fractionalMask.effects[0].kind, "unknown");
    });

    it("downgrades a known effect when its sub-target semantics are unknown", () => {
        const rule = mapRule(
            { id: 10, efficacy_type: 3, target_type: 2, sub_target_type_set_id: 9, calc_option: 2, eff_value1: 10, eff_value2: 10 },
            [],
            [{ id: 90, sub_target_type_set_id: 9, target_value_type: 99, target_value: 123 }],
        );
        equal(rule.effects[0].kind, "atk");
        equal(rule.effectStatus, "partial");
        equal(rule.status, "partial");
    });
});
