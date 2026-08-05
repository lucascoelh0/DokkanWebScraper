import { equal } from "assert";
import { describe, it } from "mocha";
import { buildDatabaseTeamAnalysisDb6Dataset } from "./team-analysis-db6-builder";

function dataset(raw: Record<string, unknown>) {
    const rule = {
        ruleKey: "1:r:1", condition: { op: "unknown", causalityId: String(raw.id), causalityType: 44, raw }, conditionStatus: "unknown",
        effects: [], effectStatus: "supported", status: "partial",
        source: {
            passiveSkillSetId: "1", passiveSkillRelationId: "r", passiveSkillId: "1", efficacyType: 1, targetType: 1,
            executionTimingType: 7, calculationOption: 2, causalityIds: [String(raw.id)], causalities: [{ id: String(raw.id), type: 44, mappingStatus: "unknown" }],
            provenance: { passiveSkillRelation: { table: "passive_skill_set_relations", rowId: "r" }, passiveSkill: { table: "passive_skills", rowId: "1" }, causalities: [{ table: "skill_causalities", rowId: String(raw.id) }] },
        }, unknowns: ["condition_semantics_incomplete"],
    };
    const db5 = {
        generatedAt: "2026-08-05T00:00:00.000Z", sourceSnapshotVersion: "fixture", sourceSha256: "a".repeat(64),
        states: [{ stateKey: "1:1:initial", characterId: "1", formId: "1", releaseState: "initial", sourceReleaseState: "initial", displayName: "Fixture", passive: { rawText: "", rules: [rule], status: "partial", source: { passiveSkillSetId: "1", provenance: { table: "passive_skill_sets", rowId: "1" } }, thresholdSeries: [], countedScaling: [] } }],
    } as any;
    const db2 = { states: [{ stateKey: "1:1:initial", passive: { rules: [{
        ruleKey: "1:r:1", skill: { values: { turn: 9, is_once: 0 } },
    }] } }] } as any;
    return buildDatabaseTeamAnalysisDb6Dataset({ db5, db2 });
}

describe("database Team Analysis DB6 history projector", function () {
    it("maps only the proven event/count portion and keeps recurrence and bucket unknown", () => {
        const result = dataset({ id: 9, causality_type: 44, cau_val1: 5, cau_val2: 6, cau_val3: 0 });
        const rule = result.states[0].passive!.rules[0];
        equal(rule.condition.op, "predicate");
        if (rule.condition.op === "predicate") {
            equal(rule.condition.predicate.kind, "attacks_evaded");
            equal(rule.condition.predicate.value, 6);
            equal(rule.condition.predicate.eventMode, "accumulated_count");
        }
        equal(rule.conditionStatus, "supported");
        equal(rule.status, "partial");
        equal(rule.combatHistoryTriggers[0].recurrence, "unknown");
        equal(rule.combatHistoryTriggers[0].calculationBucket, "unknown");
        equal(rule.combatHistoryTriggers[0].rawTurn, 9);
        equal(rule.combatHistoryTriggers[0].rawIsOnce, 0);
    });

    it("leaves future nonzero auxiliary values and unknown events uninterpreted", () => {
        for (const raw of [
            { id: 10, causality_type: 44, cau_val1: 3, cau_val2: 2, cau_val3: 1 },
            { id: 11, causality_type: 44, cau_val1: 6, cau_val2: 2, cau_val3: 0 },
        ]) {
            const rule = dataset(raw).states[0].passive!.rules[0];
            equal(rule.condition.op, "unknown");
            equal(rule.combatHistoryTriggers.length, 0);
            equal(rule.source.causalities[0].mappingStatus, "unknown");
        }
    });
});
