import { equal } from "assert";
import { describe, it } from "mocha";
import { buildDatabaseTeamAnalysisDb7Dataset } from "./team-analysis-db7-builder";

function dataset(type: number, selector: unknown) {
    const condition = { op: "unknown", causalityId: "9", causalityType: type, raw: { id: 9, causality_type: type, cau_val1: 0, cau_val2: selector, cau_val3: 2 } };
    const rule = { ruleKey: "1:r:1", condition, conditionStatus: "unknown", effects: [], effectStatus: "supported", status: "partial", combatHistoryTriggers: [], source: { causalityIds: ["9"], causalities: [{ id: "9", type, mappingStatus: "unknown" }] }, unknowns: ["condition_semantics_incomplete"] };
    return buildDatabaseTeamAnalysisDb7Dataset({ generatedAt: "2026-08-05T00:00:00.000Z", sourceSnapshotVersion: "fixture", sourceSha256: "a".repeat(64), states: [{ stateKey: "1:1:initial", characterId: "1", formId: "1", releaseState: "initial", passive: { rules: [rule], status: "partial" } }] } as any);
}

describe("database Team Analysis DB7 selector projector", function () {
    it("maps only the five independently confirmed type-46 bits", () => {
        for (const [mask, value] of [[4, "INT"], [8, "STR"], [16, "PHY"], [32, "Super"], [64, "Extreme"]] as const) {
            const rule = dataset(46, mask).states[0].passive!.rules[0]; const selector = rule.selectorConditions[0];
            equal(selector.status, "supported"); equal(rule.condition.op, "predicate");
            const actual = selector.selector.kind === "class" ? selector.selector.classes[0] : selector.selector.kind === "type" ? selector.selector.types[0] : undefined;
            equal(actual, value); equal(rule.source.causalities[0].mappingStatus, "supported");
        }
    });

    it("keeps type-41 tokens partial without localized names", () => {
        const rule = dataset(41, 13).states[0].passive!.rules[0]; const selector = rule.selectorConditions[0];
        equal(selector.status, "partial"); equal(selector.selector.kind, "name_token");
        if (selector.selector.kind === "name_token") equal(selector.selector.localizedName, null);
        equal(rule.conditionStatus, "partial"); equal(rule.source.causalities[0].mappingStatus, "partial");
    });

    it("keeps malformed type-41 tokens unknown", () => {
        for (const token of [null, "", 1.5]) {
            const rule = dataset(41, token).states[0].passive!.rules[0];
            equal(rule.condition.op, "unknown"); equal(rule.conditionStatus, "unknown");
            equal(rule.selectorConditions[0].status, "unknown");
            equal(rule.selectorConditions[0].selector.kind, "unknown_name_token");
            equal(rule.source.causalities[0].mappingStatus, "unknown");
            equal(rule.unknowns.includes("name_token_invalid"), true);
        }
    });

    it("does not assign bits 1/2 or high Extreme-Type bits", () => {
        for (const mask of [1, 2, 131072, 2097152]) {
            const rule = dataset(46, mask).states[0].passive!.rules[0];
            equal(rule.condition.op, "unknown"); equal(rule.selectorConditions[0].status, "unknown");
            equal(rule.source.causalities[0].mappingStatus, "unknown");
        }
    });
});
