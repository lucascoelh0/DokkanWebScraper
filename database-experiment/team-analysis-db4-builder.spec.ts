import { deepEqual, equal } from "assert";
import { describe, it } from "mocha";
import { buildDatabaseTeamAnalysisDb4Dataset } from "./team-analysis-db4-builder";

function sourced(table: string, row: Record<string, any>) {
    return { values: row, provenance: { table, rowId: String(row.id), columns: Object.keys(row) } };
}

function db3Rule(key: string, skillId: string, effect: Record<string, any> = {}) {
    return {
        ruleKey: key,
        condition: { op: "unknown", raw: [] }, conditionStatus: "unknown",
        effects: [{
            kind: "atk", value: 10, unit: "percent", evidence: "first-party-row-join",
            target: { scope: "self", selfInclusion: "included", classes: [], types: [], categories: [], categoryIds: [], excludedCategories: [], excludedCategoryIds: [], subTargets: [], unknownSubTargets: [] },
            ...effect,
        }],
        effectStatus: "supported", status: "partial",
        source: {
            passiveSkillSetId: "10", passiveSkillRelationId: `r${skillId}`, passiveSkillId: skillId,
            efficacyType: 1, targetType: 1, executionTimingType: 1, calculationOption: 2, causalityIds: [], causalities: [],
            provenance: {
                passiveSkillRelation: { table: "passive_skill_set_relations", rowId: `r${skillId}` },
                passiveSkill: { table: "passive_skills", rowId: skillId }, causalities: [],
            },
        },
        unknowns: [],
    };
}

function db2Rule(key: string, skillId: string, compiled: unknown, causalities: Array<Record<string, any>>, overrides: Record<string, any> = {}) {
    return {
        ruleKey: key, passiveSkillSetId: "10", passiveSkillId: skillId,
        condition: {
            raw: JSON.stringify({ compiled }), compiled,
            referencedCausalityIds: causalities.map(row => String(row.id)),
            causalities: causalities.map(row => sourced("skill_causalities", row)), mappingStatus: "structured-uninterpreted",
        },
        rawEnums: { efficacyType: 1, targetType: 1, executionTimingType: 1, calculationOption: 2, ...overrides },
    };
}

function dataset(db2Rules: any[], db3Rules: any[], tables: any = { card_categories: [] }) {
    return buildDatabaseTeamAnalysisDb4Dataset({
        db2: { states: [{ stateKey: "1:1:initial", passive: { rules: db2Rules } }] } as any,
        db3: {
            generatedAt: "2026-08-05T00:00:00.000Z", sourceSnapshotVersion: "fixture", sourceSha256: "a".repeat(64),
            states: [{
                stateKey: "1:1:initial", characterId: "1", formId: "1", releaseState: "initial", sourceReleaseState: "initial", displayName: "Fixture",
                passive: { rawText: "", rules: db3Rules, status: "partial", source: { passiveSkillSetId: "10", provenance: { table: "passive_skill_sets", rowId: "10" } } },
            }],
        } as any,
        tables,
    });
}

describe("database Team Analysis DB4 projector", function () {
    it("maps recursively nested AND and OR while retaining typed leaves", () => {
        const causalities = [
            { id: 21, causality_type: 1, cau_val1: 50, cau_val2: 0, cau_val3: 0 },
            { id: 9, causality_type: 16, cau_val1: 2, cau_val2: 0, cau_val3: 0 },
            { id: 141, causality_type: 40, cau_val1: 0, cau_val2: 0, cau_val3: 0 },
        ];
        const result = dataset(
            [db2Rule("10:r1:1", "1", ["&", 21, ["|", 9, 141]], causalities)],
            [db3Rule("10:r1:1", "1")],
        );
        const condition = result.states[0].passive!.rules[0].condition;
        equal(condition.op, "all");
        if (condition.op === "all") {
            equal(condition.children[1].op, "any");
            if (condition.children[1].op === "any") deepEqual(condition.children[1].children.map(child => child.op), ["predicate", "predicate"]);
        }
        equal(result.states[0].passive!.rules[0].conditionStatus, "supported");
    });

    it("upgrades direct type 40 efficacy 98 to per-Super scaling", () => {
        const causality = [{ id: 141, causality_type: 40, cau_val1: 0, cau_val2: 0, cau_val3: 0 }];
        const rule = db3Rule("10:r2:2", "2", { scaling: { kind: "unknown", rawTimingType: 5 }, stackCap: 100 });
        rule.source.efficacyType = 98; rule.source.executionTimingType = 5;
        const result = dataset(
            [db2Rule("10:r2:2", "2", 141, causality, { efficacyType: 98, executionTimingType: 5 })],
            [rule],
        );
        const upgraded = result.states[0].passive!.rules[0];
        equal(upgraded.condition.op, "always");
        deepEqual(upgraded.effects[0].scaling, { kind: "per_combat_event", event: "super_attack_performed", eventsPerIncrement: 1 });
        equal(upgraded.status, "supported");
    });

    it("aggregates only complete contiguous type 42 threshold siblings", () => {
        const make = (threshold: number, auxiliary = 0) => {
            const id = 200 + threshold; const key = `10:r${id}:${id}`;
            const causality = [{ id, causality_type: 42, cau_val1: 32, cau_val2: threshold, cau_val3: auxiliary }];
            const db3 = db3Rule(key, String(id));
            db3.condition = { op: "predicate", predicate: { kind: "ki_spheres_obtained", scope: "self", comparator: "gte", count: threshold, kiSphereTypes: ["rainbow"], sourceCausalityId: String(id), sourceCausalityType: 42, evidence: "first-party-row-join" } } as any;
            db3.conditionStatus = "supported"; db3.status = "supported";
            return { db2: db2Rule(key, String(id), id, causality), db3 };
        };
        const contiguous = [make(1), make(2), make(3)];
        const projected = dataset(contiguous.map(value => value.db2), contiguous.map(value => value.db3));
        equal(projected.states[0].passive!.thresholdSeries.length, 1);
        deepEqual(projected.states[0].passive!.thresholdSeries[0].effect.scaling.thresholdValues, [1, 2, 3]);
        const gap = [make(1), make(3)];
        equal(dataset(gap.map(value => value.db2), gap.map(value => value.db3)).states[0].passive!.thresholdSeries.length, 0);
        const competingTuple = [make(1, 0), make(2, 1)];
        equal(dataset(competingTuple.map(value => value.db2), competingTuple.map(value => value.db3)).states[0].passive!.thresholdSeries.length, 0);
    });

    it("keeps a type 34 enemy-scope series partial even with a joined category", () => {
        const make = (threshold: number) => {
            const id = 300 + threshold; const key = `10:r${id}:${id}`;
            const causality = [{ id, causality_type: 34, cau_val1: 1, cau_val2: 4, cau_val3: threshold }];
            return { db2: db2Rule(key, String(id), id, causality), db3: db3Rule(key, String(id)) };
        };
        const rows = [make(1), make(2)];
        const result = dataset(rows.map(value => value.db2), rows.map(value => value.db3), { card_categories: [{ id: 4, name: "Peppy Gals" }] });
        const series = result.states[0].passive!.thresholdSeries[0];
        equal(series.status, "partial");
        equal(series.effect.scaling.qualifyingUnit?.scope, "enemy");
        deepEqual(series.unknowns, ["enemy_or_unknown_category_scope_semantics_unknown"]);
    });
});
