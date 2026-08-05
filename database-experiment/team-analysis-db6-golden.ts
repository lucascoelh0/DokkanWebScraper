import { existsSync } from "fs";
import { readFile } from "fs/promises";
import { resolve } from "path";
import { DatabaseTeamAnalysisDb6Dataset } from "./team-analysis-db6-contract";
import { Db6ConditionExpression } from "./team-analysis-db6-contract";

interface Fixture {
    name: string,
    stateKey: string,
    ruleKey: string,
    causalityId: string,
    kind: string,
    count: number,
    rawTiming: number,
    rawCalculation: number,
    rawTurn: number,
    rawIsOnce: number,
}

export async function validateDatabaseTeamAnalysisDb6Goldens(dataset: DatabaseTeamAnalysisDb6Dataset): Promise<{
    fixtureCount: number,
    passed: number,
    failures: Array<{ fixture: string, issue: string }>,
}> {
    const fixturePath = existsSync(resolve(__dirname, "team-analysis-db6-golden-fixtures.json"))
        ? resolve(__dirname, "team-analysis-db6-golden-fixtures.json")
        : resolve(__dirname, "..", "..", "database-experiment", "team-analysis-db6-golden-fixtures.json");
    const parsed = JSON.parse(await readFile(fixturePath, "utf8")) as { schemaVersion: number, fixtures: Fixture[] };
    if (parsed.schemaVersion !== 1 || !Array.isArray(parsed.fixtures)) throw new Error("Unsupported DB6 golden fixture contract");
    const failures: Array<{ fixture: string, issue: string }> = [];
    const check = (fixture: string, field: string, actual: unknown, expected: unknown) => {
        if (JSON.stringify(actual) !== JSON.stringify(expected)) failures.push({ fixture, issue: `${field}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}` });
    };
    const findPredicate = (condition: Db6ConditionExpression, causalityId: string): Extract<Db6ConditionExpression, { op: "predicate" }> | undefined => {
        if (condition.op === "predicate" && condition.predicate.sourceCausalityId === causalityId) return condition;
        if (condition.op === "all" || condition.op === "any") {
            for (const child of condition.children) {
                const found = findPredicate(child, causalityId);
                if (found) return found;
            }
        }
        return condition.op === "not" ? findPredicate(condition.child, causalityId) : undefined;
    };
    for (const fixture of parsed.fixtures) {
        const state = dataset.states.find(value => value.stateKey === fixture.stateKey);
        const rule = state?.passive?.rules.find(value => value.ruleKey === fixture.ruleKey);
        const trigger = rule?.combatHistoryTriggers.find(value => value.causalityId === fixture.causalityId);
        const predicate = rule ? findPredicate(rule.condition, fixture.causalityId) : undefined;
        if (!rule || !trigger || !predicate) { failures.push({ fixture: fixture.name, issue: "missing exact state/rule/causality predicate join" }); continue; }
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
