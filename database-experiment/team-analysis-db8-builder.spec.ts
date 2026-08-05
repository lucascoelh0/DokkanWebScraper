import { deepStrictEqual, equal } from "assert";
import { describe, it } from "mocha";
import { buildDatabaseTeamAnalysisDb8Coverage, buildDatabaseTeamAnalysisDb8Dataset } from "./team-analysis-db8-builder";

function fixture() {
    const condition = { op: "unknown", causalityId: "1380", causalityType: 51, raw: { id: 1380, causality_type: 51, cau_val1: 4, cau_val2: 0, cau_val3: 0 } };
    const rule = { ruleKey: "1:r:9", condition, conditionStatus: "unknown", effects: [{ kind: "unknown", target: { unknownSubTargets: [] }, evidence: "unknown" }], effectStatus: "unknown", status: "unknown",
        combatHistoryTriggers: [{ causalityId: "44", event: "attacks_received", minimumCount: 2, recurrence: "unknown", calculationBucket: "unknown", rawExecutionTimingType: 7, rawCalculationOption: 2, rawTurn: 99, rawIsOnce: 0, rawAuxiliary: 0, provenance: { table: "skill_causalities", rowId: "44" } }],
        selectorConditions: [
            { causalityId: "41", causalityType: 41, scope: "team", minimumCount: 1, selector: { kind: "name_token", token: 13, localizedName: null }, status: "partial", rawScope: 0, rawSelector: 13, rawCount: 1, provenance: { table: "skill_causalities", rowId: "41" }, unknowns: ["name_token_dictionary_unavailable"] },
            { causalityId: "46", causalityType: 46, scope: "team", minimumCount: 1, selector: { kind: "unknown_mask", rawMask: 1, unknownMask: 1 }, status: "unknown", rawScope: 0, rawSelector: 1, rawCount: 1, provenance: { table: "skill_causalities", rowId: "46" }, unknowns: ["class_type_mask_identity_unknown"] },
        ], source: { passiveSkillId: "9", efficacyType: 110, causalityIds: ["41", "44", "46", "1380"], causalities: [{ id: "41", type: 41, mappingStatus: "partial" }, { id: "44", type: 44, mappingStatus: "supported" }, { id: "46", type: 46, mappingStatus: "unknown" }, { id: "1380", type: 51, mappingStatus: "unknown" }] }, unknowns: ["condition_semantics_incomplete", "effect_semantics_incomplete"] };
    const subTargetRule = { ...rule, ruleKey: "1:r:10", condition: { op: "always" }, conditionStatus: "supported", combatHistoryTriggers: [], selectorConditions: [],
        effects: [{ kind: "atk", target: { unknownSubTargets: [{ targetValueType: 99, targetValue: 1, provenance: { table: "sub_target_types", rowId: "1" } }] }, evidence: "first-party-row-join", unit: "percent", value: 10 }], effectStatus: "supported", status: "supported",
        source: { passiveSkillId: "10", efficacyType: 3, causalityIds: [], causalities: [] }, unknowns: [] };
    const db7 = { generatedAt: "2026-08-05T00:00:00.000Z", sourceSnapshotVersion: "fixture", sourceSha256: "a".repeat(64), states: [{ stateKey: "1:1:initial", passive: { rules: [rule, subTargetRule] } }] } as any;
    const tables = { passive_skills: [
        { id: 9, efficacy_type: 110, exec_timing_type: 4, target_type: 1, calc_option: 2, eff_value1: 10, eff_value2: 0, eff_value3: 0, passive_skill_effect_id: null },
        { id: 10, efficacy_type: 3, exec_timing_type: 1, target_type: 2, calc_option: 2, eff_value1: 10, eff_value2: 10, eff_value3: 0, passive_skill_effect_id: null },
    ], passive_skill_effects: [], skill_causalities: [{ id: 44, causality_type: 44, cau_val1: 3, cau_val2: 2, cau_val3: 0 }] } as any;
    return { db7, tables };
}

describe("database Team Analysis DB8 evidence gaps", function () {
    it("catalogs raw unknowns without semantic promotion", () => {
        const dataset = buildDatabaseTeamAnalysisDb8Dataset(fixture());
        const type51 = dataset.causalityGaps.find(value => value.causalityType === 51)!;
        equal(dataset.semanticPromotionCount, 0); equal(type51.causalityType, 51);
        deepStrictEqual(type51.rawValueDomains.cauVal1, [4]);
        equal(dataset.causalityGaps.find(value => value.causalityType === 41)?.samples[0].provenance.table, "skill_causalities");
        deepStrictEqual(dataset.causalityGaps.find(value => value.causalityType === 46)?.rawValueDomains.cauVal2, [1]);
        const efficacy110 = dataset.efficacyGaps.find(value => value.efficacyType === 110)!;
        equal(efficacy110.efficacyType, 110); equal(efficacy110.scriptNameStatus, "absent");
        equal(dataset.efficacyGaps.find(value => value.efficacyType === 3)?.requiredEvidence.includes("first_party_named_sub_target_enum_or_join"), true);
        equal(dataset.combatHistoryGaps[0].causalityId, "44"); deepStrictEqual(dataset.combatHistoryGaps[0].rawCausality, { cauVal1: 3, cauVal2: 2, cauVal3: 0 });
        equal(dataset.combatHistoryGaps[0].provenance.rowId, "44"); equal(dataset.combatHistoryGaps[0].rawPassive.turn, 99);
        equal(buildDatabaseTeamAnalysisDb8Coverage(dataset).causalityGapAffectedStateCount, 1);
        equal(buildDatabaseTeamAnalysisDb8Coverage(dataset).combatHistoryGapCount, 1);
    });

    it("is deterministic for identical rows", () => {
        const input = fixture();
        deepStrictEqual(buildDatabaseTeamAnalysisDb8Dataset(input), buildDatabaseTeamAnalysisDb8Dataset(input));
    });

    it("does not reopen a legacy source status after the final AST is supported", () => {
        const input = fixture();
        input.db7.states[0].passive.rules.push({ ruleKey: "1:r:34", condition: { op: "predicate", predicate: { kind: "team_category_count", scope: "team", comparator: "gte", count: 1, sourceCausalityId: "76", sourceCausalityType: 34, evidence: "first-party-row-join" } },
            conditionStatus: "supported", effects: [{ kind: "atk", target: { unknownSubTargets: [] }, evidence: "first-party-row-join", unit: "percent", value: 10 }], effectStatus: "supported", status: "supported", combatHistoryTriggers: [], selectorConditions: [],
            source: { passiveSkillId: "10", efficacyType: 3, causalityIds: ["76"], causalities: [{ id: "76", type: 34, mappingStatus: "unknown" }] }, unknowns: [] });
        const dataset = buildDatabaseTeamAnalysisDb8Dataset(input);
        equal(dataset.causalityGaps.some(value => Number(value.causalityType) === 34), false);
    });
});
