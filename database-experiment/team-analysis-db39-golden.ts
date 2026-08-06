import { readFile } from "fs/promises";
import { resolve } from "path";
import { db39OperandUnit, projectDb39Bucket, projectDb39Modifier, scaleDb39Modifier } from "./team-analysis-db39-builder";
import { DatabaseTeamAnalysisDb39Coverage, DatabaseTeamAnalysisDb39Dataset } from "./team-analysis-db39-contract";
export async function validateDatabaseTeamAnalysisDb39Goldens(dataset: DatabaseTeamAnalysisDb39Dataset, coverage: DatabaseTeamAnalysisDb39Coverage) {
    const fixtures = JSON.parse(await readFile(resolve(__dirname, "team-analysis-db39-golden-fixtures.json"), "utf8")) as any[], failures: string[] = [];
    for (const fixture of fixtures) {
        if (fixture.kind === "scale" && scaleDb39Modifier(fixture.modifier, fixture.count) !== fixture.result) failures.push(fixture.id);
        if (fixture.kind === "modifier") { const projected = projectDb39Modifier(fixture.stat, fixture.value); if (projected.status !== fixture.status || projected.runtimeModifierFloat32 !== fixture.float32) failures.push(fixture.id); }
        if (fixture.kind === "bucket" && JSON.stringify(projectDb39Bucket(fixture.timing)) !== JSON.stringify(fixture.result)) failures.push(fixture.id);
        if (fixture.kind === "unit") { const projected = db39OperandUnit(fixture.operation); if (projected.value !== fixture.value || projected.status !== "partial") failures.push(fixture.id); }
    }
    if (coverage.ruleCount !== 89 || coverage.sourceEffectCount !== 89 || coverage.statApplicationCount !== 178 || coverage.affectedStateCount !== 56 || coverage.passiveSkillCount !== 87 || coverage.supportedModifierRuleCount !== 89 || coverage.supportedBucketRuleCount !== 89 || coverage.countSemanticPartialRuleCount !== 89 || coverage.simulationPartialRuleCount !== 89 || coverage.simulationUnknownRuleCount !== 0 || coverage.legacyRepresentationGainRuleCount !== 89 || coverage.confirmedLegacyConflictCount !== 0) failures.push("snapshot population");
    if (JSON.stringify(coverage.ruleCountsByTiming) !== JSON.stringify({ "1": 87, "4": 2 }) || JSON.stringify(coverage.ruleCountsByCalculationOption) !== JSON.stringify({ "0": 2, "2": 87 }) || JSON.stringify(coverage.ruleCountsByTarget) !== JSON.stringify({ "1": 88, "2": 1 }) || JSON.stringify(coverage.statApplicationsByStatAndBucket) !== JSON.stringify({ "attack|former_passive_stat": 87, "attack|latter_passive_stat": 2, "defense|former_passive_stat": 87, "defense|latter_passive_stat": 2 })) failures.push("snapshot distributions");
    if (dataset.ruleProjections.some(rule => rule.countInput.semanticName !== "unknown" || rule.operandUnit.status !== "partial" || rule.independentDimensions.timing !== "independent" || rule.independentDimensions.recurrence !== "partial" || rule.independentDimensions.reset !== "unknown")) failures.push("conservative boundary");
    return { schemaVersion: 1 as const, fixtureCount: fixtures.length + 3, passed: fixtures.length + 3 - failures.length, failures };
}
