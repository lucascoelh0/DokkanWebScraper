import { existsSync } from "fs";
import { readFile } from "fs/promises";
import { resolve } from "path";
import { DatabaseTeamAnalysisDb4Dataset } from "./team-analysis-db4-contract";

interface RuleFixture {
    name: string,
    stateKey: string,
    ruleKey: string,
    conditionOp: string,
    firstChildOp?: string,
    conditionStatus: string,
    effectKind?: string,
    scalingKind?: string,
    scalingEvent?: string,
    effectStatus?: string,
}

interface SeriesFixture {
    name: string,
    stateKey: string,
    projectionKey: string,
    status: string,
    causalityType: number,
    effectKind: string,
    scalingKind: string,
    maxIncrements: number,
    selectorKind?: string,
    selectorName?: string,
    kiSphereTypes?: string[],
    unknown?: string,
}

export async function validateDatabaseTeamAnalysisDb4Goldens(dataset: DatabaseTeamAnalysisDb4Dataset): Promise<{
    fixtureCount: number,
    passed: number,
    failures: Array<{ fixture: string, issue: string }>,
}> {
    const fixturePath = existsSync(resolve(__dirname, "team-analysis-db4-golden-fixtures.json"))
        ? resolve(__dirname, "team-analysis-db4-golden-fixtures.json")
        : resolve(__dirname, "..", "..", "database-experiment", "team-analysis-db4-golden-fixtures.json");
    const parsed = JSON.parse(await readFile(fixturePath, "utf8")) as { schemaVersion: number, rules: RuleFixture[], series: SeriesFixture[] };
    if (parsed.schemaVersion !== 1 || !Array.isArray(parsed.rules) || !Array.isArray(parsed.series)) throw new Error("Unsupported DB4 golden fixture contract");
    const failures: Array<{ fixture: string, issue: string }> = [];
    const check = (fixture: string, field: string, actual: unknown, expected: unknown) => {
        if (JSON.stringify(actual) !== JSON.stringify(expected)) failures.push({ fixture, issue: `${field}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}` });
    };
    for (const fixture of parsed.rules) {
        const state = dataset.states.find(value => value.stateKey === fixture.stateKey);
        const rule = state?.passive?.rules.find(value => value.ruleKey === fixture.ruleKey);
        if (!rule) { failures.push({ fixture: fixture.name, issue: "missing exact state/rule join" }); continue; }
        check(fixture.name, "conditionOp", rule.condition.op, fixture.conditionOp);
        if (fixture.firstChildOp) check(fixture.name, "firstChildOp", rule.condition.op === "all" || rule.condition.op === "any" ? rule.condition.children[0]?.op : undefined, fixture.firstChildOp);
        check(fixture.name, "conditionStatus", rule.conditionStatus, fixture.conditionStatus);
        if (fixture.effectKind) check(fixture.name, "effectKind", rule.effects[0]?.kind, fixture.effectKind);
        if (fixture.scalingKind) check(fixture.name, "scalingKind", rule.effects[0]?.scaling?.kind, fixture.scalingKind);
        if (fixture.scalingEvent) check(fixture.name, "scalingEvent", rule.effects[0]?.scaling?.kind === "per_combat_event" ? rule.effects[0].scaling.event : undefined, fixture.scalingEvent);
        if (fixture.effectStatus) check(fixture.name, "effectStatus", rule.effectStatus, fixture.effectStatus);
    }
    for (const fixture of parsed.series) {
        const state = dataset.states.find(value => value.stateKey === fixture.stateKey);
        const series = state?.passive?.thresholdSeries.find(value => value.projectionKey === fixture.projectionKey);
        if (!series) { failures.push({ fixture: fixture.name, issue: "missing exact state/projection join" }); continue; }
        check(fixture.name, "status", series.status, fixture.status);
        check(fixture.name, "causalityType", series.source.causalityType, fixture.causalityType);
        check(fixture.name, "effectKind", series.effect.kind, fixture.effectKind);
        check(fixture.name, "scalingKind", series.effect.scaling.kind, fixture.scalingKind);
        check(fixture.name, "maxIncrements", series.effect.scaling.maxIncrements, fixture.maxIncrements);
        if (fixture.selectorKind) check(fixture.name, "selectorKind", series.effect.scaling.qualifyingUnit?.selectorKind, fixture.selectorKind);
        if (fixture.selectorName) check(fixture.name, "selectorName", series.effect.scaling.qualifyingUnit?.selectorName, fixture.selectorName);
        if (fixture.kiSphereTypes) check(fixture.name, "kiSphereTypes", series.effect.scaling.kiSphereTypes, fixture.kiSphereTypes);
        if (fixture.unknown) check(fixture.name, "unknown", series.unknowns.includes(fixture.unknown), true);
    }
    const fixtureCount = parsed.rules.length + parsed.series.length;
    return { fixtureCount, passed: fixtureCount - failures.length, failures };
}
