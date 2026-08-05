import { existsSync } from "fs";
import { readFile } from "fs/promises";
import { resolve } from "path";
import { DatabaseTeamAnalysisDb11Dataset, Db11ConditionExpression } from "./team-analysis-db11-contract";

interface ProjectionFixture { name: string, stateKey: string, causalityId: string, causalityType: 43 | 51 | 55, kind: string, eventMode?: string, comparator?: string, value?: number, nativeComparator?: string, nativeThreshold?: number }
function containsUnknown(expression: Db11ConditionExpression, id: string, type: number): boolean {
    if (expression.op === "unknown") return expression.causalityId === id && Number(expression.causalityType) === type;
    if (expression.op === "all" || expression.op === "any") return expression.children.some(child => containsUnknown(child, id, type));
    return expression.op === "not" ? containsUnknown(expression.child, id, type) : false;
}
export async function validateDatabaseTeamAnalysisDb11Goldens(dataset: DatabaseTeamAnalysisDb11Dataset): Promise<{ fixtureCount: number, passed: number, failures: Array<{ fixture: string, issue: string }> }> {
    const path = existsSync(resolve(__dirname, "team-analysis-db11-golden-fixtures.json")) ? resolve(__dirname, "team-analysis-db11-golden-fixtures.json") : resolve(__dirname, "..", "..", "database-experiment", "team-analysis-db11-golden-fixtures.json");
    const parsed = JSON.parse(await readFile(path, "utf8")) as { schemaVersion: number, projections: ProjectionFixture[], unknown: { name: string, stateKey: string, causalityId: string, causalityType: number } };
    if (parsed.schemaVersion !== 1) throw new Error("Unsupported DB11 golden contract");
    const failures: Array<{ fixture: string, issue: string }> = []; const fail = (fixture: string, issue: string) => failures.push({ fixture, issue });
    for (const fixture of parsed.projections) {
        const state = dataset.states.find(value => value.stateKey === fixture.stateKey); const value = state?.passive?.rules.flatMap(rule => rule.runtimeConditions).find(candidate => candidate.causalityId === fixture.causalityId && candidate.causalityType === fixture.causalityType);
        if (!value) { fail(fixture.name, "projection missing"); continue; }
        const predicate = value.predicate as any;
        for (const key of ["kind", "eventMode", "comparator", "value", "nativeComparator", "nativeThreshold"] as const) if (fixture[key] !== undefined && predicate[key] !== fixture[key]) fail(fixture.name, `expected ${key}=${fixture[key]}, got ${predicate[key]}`);
        if (value.provenance.database.rowId !== fixture.causalityId || value.provenance.runtime.codeSha256.length !== 64) fail(fixture.name, "provenance mismatch");
    }
    const unknownState = dataset.states.find(value => value.stateKey === parsed.unknown.stateKey); const remainsUnknown = unknownState?.passive?.rules.some(rule => containsUnknown(rule.condition, parsed.unknown.causalityId, parsed.unknown.causalityType)) ?? false;
    if (!remainsUnknown) fail(parsed.unknown.name, "type 3 was removed or promoted");
    const runtimeCount = dataset.states.reduce((sum, state) => sum + (state.passive?.rules.reduce((ruleSum, rule) => ruleSum + rule.runtimeConditions.length, 0) ?? 0), 0);
    if (runtimeCount !== 901) fail("promotion count", `expected 901 runtime predicates, got ${runtimeCount}`);
    const fixtureCount = parsed.projections.length + 2; return { fixtureCount, passed: fixtureCount - failures.length, failures };
}
