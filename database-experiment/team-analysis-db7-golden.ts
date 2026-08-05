import { existsSync } from "fs";
import { readFile } from "fs/promises";
import { resolve } from "path";
import { DatabaseTeamAnalysisDb7Dataset } from "./team-analysis-db7-contract";

interface Fixture { name: string, stateKey: string, ruleKey: string, causalityId: string, status: string, selectorKind: string, scope: string, minimumCount: number, selectorValue?: string, rawSelector: number, unknown?: string }

export async function validateDatabaseTeamAnalysisDb7Goldens(dataset: DatabaseTeamAnalysisDb7Dataset): Promise<{ fixtureCount: number, passed: number, failures: Array<{ fixture: string, issue: string }> }> {
    const fixturePath = existsSync(resolve(__dirname, "team-analysis-db7-golden-fixtures.json")) ? resolve(__dirname, "team-analysis-db7-golden-fixtures.json") : resolve(__dirname, "..", "..", "database-experiment", "team-analysis-db7-golden-fixtures.json");
    const parsed = JSON.parse(await readFile(fixturePath, "utf8")) as { schemaVersion: number, fixtures: Fixture[] };
    if (parsed.schemaVersion !== 1 || !Array.isArray(parsed.fixtures)) throw new Error("Unsupported DB7 golden fixture contract");
    const failures: Array<{ fixture: string, issue: string }> = [];
    const check = (fixture: string, field: string, actual: unknown, expected: unknown) => { if (JSON.stringify(actual) !== JSON.stringify(expected)) failures.push({ fixture, issue: `${field}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}` }); };
    for (const fixture of parsed.fixtures) {
        const rule = dataset.states.find(value => value.stateKey === fixture.stateKey)?.passive?.rules.find(value => value.ruleKey === fixture.ruleKey);
        const selector = rule?.selectorConditions.find(value => value.causalityId === fixture.causalityId);
        if (!rule || !selector) { failures.push({ fixture: fixture.name, issue: "missing exact state/rule/selector join" }); continue; }
        check(fixture.name, "status", selector.status, fixture.status); check(fixture.name, "selectorKind", selector.selector.kind, fixture.selectorKind);
        check(fixture.name, "scope", selector.scope, fixture.scope); check(fixture.name, "minimumCount", selector.minimumCount, fixture.minimumCount); check(fixture.name, "rawSelector", selector.rawSelector, fixture.rawSelector);
        const selectorValue = selector.selector.kind === "class" ? selector.selector.classes[0] : selector.selector.kind === "type" ? selector.selector.types[0] : undefined;
        if (fixture.selectorValue) check(fixture.name, "selectorValue", selectorValue, fixture.selectorValue);
        if (fixture.unknown) check(fixture.name, "unknown", selector.unknowns.includes(fixture.unknown), true);
        check(fixture.name, "sourceMapping", rule.source.causalities.find(value => value.id === fixture.causalityId)?.mappingStatus, fixture.status);
    }
    return { fixtureCount: parsed.fixtures.length, passed: parsed.fixtures.length - failures.length, failures };
}
