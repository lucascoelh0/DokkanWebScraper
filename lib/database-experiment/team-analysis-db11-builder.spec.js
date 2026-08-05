"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = require("assert");
const mocha_1 = require("mocha");
const team_analysis_db11_builder_1 = require("./team-analysis-db11-builder");
const team_analysis_db11_parity_1 = require("./team-analysis-db11-parity");
function fixture() {
    const unknown = (id, type, v1) => ({ op: "unknown", causalityId: String(id), causalityType: type, raw: { id, causality_type: type, cau_val1: v1, cau_val2: 0, cau_val3: 0 } });
    const rule = { ruleKey: "rule", condition: { op: "all", children: [unknown(3, 43, 0), unknown(4, 51, 2), unknown(5, 55, 2), unknown(6, 3, 50)] }, conditionStatus: "unknown", effectStatus: "supported", status: "partial", effects: [], combatHistoryTriggers: [], selectorConditions: [], unknowns: ["condition_semantics_incomplete"], source: { causalities: [3, 4, 5, 6].map(id => ({ id: String(id), type: id === 3 ? 43 : id === 4 ? 51 : id === 5 ? 55 : 3, mappingStatus: "unknown" })) } };
    const db7 = { contractVersion: "0.6.0", generatedAt: "x", sourceSnapshotVersion: "snapshot", sourceSha256: "db", states: [{ stateKey: "state", characterId: "1", formId: "1", releaseState: "initial", passive: { rules: [rule], status: "partial" } }] };
    const runtime = (causalityType, status, comparator, occurrenceCount) => ({
        causalityType, status, comparator, occurrenceCount,
        operation: causalityType === 43 ? "dodge_success" : causalityType === 3 ? "runtime_gauge_ratio_threshold" : "turns_from_appearance",
        parameterReads: causalityType === 43 ? [] : ["cau_val1"], ignoredParameters: causalityType === 43 ? ["cau_val1", "cau_val2", "cau_val3"] : ["cau_val2", "cau_val3"],
        gate: causalityType === 51 || causalityType === 55 ? "appearance_initialized" : null, unknowns: status === "partial" ? ["metric"] : [], causalityIds: [String(causalityType === 43 ? 3 : causalityType === 51 ? 4 : causalityType === 55 ? 5 : 6)],
        provenance: { runtime: { fileName: "libcocos2dcpp.so", symbol: `type${causalityType}`, vma: causalityType, sizeBytes: 4, codeSha256: "a".repeat(64) } },
    });
    const db10 = { contractVersion: "0.9.0", generatedAt: "x", sourceSnapshotVersion: "snapshot", sourceDatabaseSha256: "db", semanticPromotionCount: 3, promotedOccurrenceCount: 3, causalityResolutions: [runtime(3, "partial", "gte", 1), runtime(43, "supported", "eq_true", 1), runtime(51, "supported", "lte", 1), runtime(55, "supported", "gt", 1)] };
    return { db7, db10 };
}
(0, mocha_1.describe)("database Team Analysis DB11 runtime predicate integration", function () {
    (0, mocha_1.it)("projects only the three DB10-supported predicates and preserves type 3 unknown", () => {
        const { db7, db10 } = fixture();
        const dataset = (0, team_analysis_db11_builder_1.buildDatabaseTeamAnalysisDb11Dataset)({ db7, db7Sha256: "db7", db10, db10Sha256: "db10" });
        const rule = dataset.states[0].passive.rules[0];
        (0, assert_1.deepEqual)(rule.runtimeConditions.map(value => [value.causalityType, value.predicate.kind]), [[43, "attacks_evaded"], [51, "turn_from_entry"], [55, "turn_from_entry"]]);
        const turns = rule.runtimeConditions.map(value => value.predicate).filter((value) => value.kind === "turn_from_entry").map(value => [value.comparator, value.value]);
        (0, assert_1.deepEqual)(turns, [["lte", 2], ["gte", 3]]);
        (0, assert_1.equal)(rule.conditionStatus, "partial");
        (0, assert_1.equal)(JSON.stringify(rule.condition).includes('"causalityType":3'), true);
        const coverage = (0, team_analysis_db11_builder_1.buildDatabaseTeamAnalysisDb11Coverage)(dataset, db7, db10);
        (0, assert_1.equal)(coverage.runtimePredicateCount, 3);
        (0, assert_1.equal)(coverage.partialType3OccurrenceCount, 1);
    });
    (0, mocha_1.it)("matches normalized runtime predicates against current Team Analysis", () => {
        const { db7, db10 } = fixture();
        const dataset = (0, team_analysis_db11_builder_1.buildDatabaseTeamAnalysisDb11Dataset)({ db7, db7Sha256: "db7", db10, db10Sha256: "db10" });
        const current = { states: [{ stateKey: "1:1:initial", passive: { rules: [{ condition: { op: "all", children: [
                                        { op: "predicate", predicate: { kind: "attacks_evaded", scope: "self", combatEvent: { mode: "current_event" } } },
                                        { op: "predicate", predicate: { kind: "turn_from_entry", scope: "self", comparator: "lte", value: 2 } },
                                        { op: "predicate", predicate: { kind: "turn_from_entry", scope: "self", comparator: "gte", value: 3 } },
                                    ] } }] } }] };
        const parity = (0, team_analysis_db11_parity_1.compareDatabaseTeamAnalysisDb11)(dataset, current, { formProjectionAliases: [] });
        (0, assert_1.deepEqual)(parity.promotedStructuralSignatures, { database: 3, current: 3, matched: 3 });
    });
    (0, mocha_1.it)("rejects a DB10 projection from a different source snapshot", () => {
        const { db7, db10 } = fixture();
        db10.sourceSnapshotVersion = "other";
        (0, assert_1.throws)(() => (0, team_analysis_db11_builder_1.buildDatabaseTeamAnalysisDb11Dataset)({ db7, db7Sha256: "db7", db10, db10Sha256: "db10" }), /source lineage mismatch/);
    });
    (0, mocha_1.it)("rejects a supported type whose native semantic shape changed", () => {
        const { db7, db10 } = fixture();
        db10.causalityResolutions.find((value) => value.causalityType === 55).comparator = "gte";
        (0, assert_1.throws)(() => (0, team_analysis_db11_builder_1.buildDatabaseTeamAnalysisDb11Dataset)({ db7, db7Sha256: "db7", db10, db10Sha256: "db10" }), /semantic shape/);
    });
    (0, mocha_1.it)("keeps invalid turn thresholds unknown", () => {
        const { db7, db10 } = fixture();
        db7.states[0].passive.rules[0].condition.children[1].raw.cau_val1 = "not-an-integer";
        const dataset = (0, team_analysis_db11_builder_1.buildDatabaseTeamAnalysisDb11Dataset)({ db7, db7Sha256: "db7", db10, db10Sha256: "db10" });
        const rule = dataset.states[0].passive.rules[0];
        (0, assert_1.equal)(rule.runtimeConditions.some(value => value.causalityType === 51), false);
        (0, assert_1.equal)(JSON.stringify(rule.condition).includes('"causalityType":51'), true);
        (0, assert_1.equal)((0, team_analysis_db11_builder_1.buildDatabaseTeamAnalysisDb11Coverage)(dataset, db7, db10).unprojectedSupportedTypeOccurrencesByType["51"], 1);
    });
    (0, mocha_1.it)("does not match the same atom under opposite NOT polarity", () => {
        const { db7, db10 } = fixture();
        const dataset = (0, team_analysis_db11_builder_1.buildDatabaseTeamAnalysisDb11Dataset)({ db7, db7Sha256: "db7", db10, db10Sha256: "db10" });
        const current = { states: [{ stateKey: "1:1:initial", passive: { rules: [{ condition: { op: "all", children: [
                                        { op: "not", child: { op: "predicate", predicate: { kind: "attacks_evaded", scope: "self", combatEvent: { mode: "current_event" } } } },
                                        { op: "predicate", predicate: { kind: "turn_from_entry", scope: "self", comparator: "lte", value: 2 } },
                                        { op: "predicate", predicate: { kind: "turn_from_entry", scope: "self", comparator: "gte", value: 3 } },
                                    ] } }] } }] };
        const parity = (0, team_analysis_db11_parity_1.compareDatabaseTeamAnalysisDb11)(dataset, current, { formProjectionAliases: [] });
        (0, assert_1.deepEqual)(parity.promotedStructuralSignatures, { database: 3, current: 3, matched: 2 });
    });
});
//# sourceMappingURL=team-analysis-db11-builder.spec.js.map