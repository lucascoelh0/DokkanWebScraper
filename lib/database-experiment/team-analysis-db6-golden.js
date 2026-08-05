"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateDatabaseTeamAnalysisDb6Goldens = void 0;
const fs_1 = require("fs");
const promises_1 = require("fs/promises");
const path_1 = require("path");
async function validateDatabaseTeamAnalysisDb6Goldens(dataset) {
    const fixturePath = (0, fs_1.existsSync)((0, path_1.resolve)(__dirname, "team-analysis-db6-golden-fixtures.json"))
        ? (0, path_1.resolve)(__dirname, "team-analysis-db6-golden-fixtures.json")
        : (0, path_1.resolve)(__dirname, "..", "..", "database-experiment", "team-analysis-db6-golden-fixtures.json");
    const parsed = JSON.parse(await (0, promises_1.readFile)(fixturePath, "utf8"));
    if (parsed.schemaVersion !== 1 || !Array.isArray(parsed.fixtures))
        throw new Error("Unsupported DB6 golden fixture contract");
    const failures = [];
    const check = (fixture, field, actual, expected) => {
        if (JSON.stringify(actual) !== JSON.stringify(expected))
            failures.push({ fixture, issue: `${field}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}` });
    };
    const findPredicate = (condition, causalityId) => {
        if (condition.op === "predicate" && condition.predicate.sourceCausalityId === causalityId)
            return condition;
        if (condition.op === "all" || condition.op === "any") {
            for (const child of condition.children) {
                const found = findPredicate(child, causalityId);
                if (found)
                    return found;
            }
        }
        return condition.op === "not" ? findPredicate(condition.child, causalityId) : undefined;
    };
    for (const fixture of parsed.fixtures) {
        const state = dataset.states.find(value => value.stateKey === fixture.stateKey);
        const rule = state?.passive?.rules.find(value => value.ruleKey === fixture.ruleKey);
        const trigger = rule?.combatHistoryTriggers.find(value => value.causalityId === fixture.causalityId);
        const predicate = rule ? findPredicate(rule.condition, fixture.causalityId) : undefined;
        if (!rule || !trigger || !predicate) {
            failures.push({ fixture: fixture.name, issue: "missing exact state/rule/causality predicate join" });
            continue;
        }
        check(fixture.name, "kind", predicate.predicate.kind, fixture.kind);
        check(fixture.name, "count", predicate.predicate.value, fixture.count);
        check(fixture.name, "eventMode", predicate.predicate.eventMode, "accumulated_count");
        check(fixture.name, "conditionStatus", rule.conditionStatus, "supported");
        check(fixture.name, "ruleStatus", rule.status, "partial");
        check(fixture.name, "recurrence", trigger.recurrence, "unknown");
        check(fixture.name, "calculationBucket", trigger.calculationBucket, "unknown");
        check(fixture.name, "rawTiming", trigger.rawExecutionTimingType, fixture.rawTiming);
        check(fixture.name, "rawCalculation", trigger.rawCalculationOption, fixture.rawCalculation);
        check(fixture.name, "rawTurn", trigger.rawTurn, fixture.rawTurn);
        check(fixture.name, "rawIsOnce", trigger.rawIsOnce, fixture.rawIsOnce);
        check(fixture.name, "sourceMapping", rule.source.causalities.find(value => value.id === fixture.causalityId)?.mappingStatus, "supported");
    }
    return { fixtureCount: parsed.fixtures.length, passed: parsed.fixtures.length - failures.length, failures };
}
exports.validateDatabaseTeamAnalysisDb6Goldens = validateDatabaseTeamAnalysisDb6Goldens;
//# sourceMappingURL=team-analysis-db6-golden.js.map