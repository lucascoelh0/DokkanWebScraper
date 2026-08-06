import { existsSync } from "fs";
import { readFile } from "fs/promises";
import { resolve } from "path";
import { projectDb44Modifier } from "./team-analysis-db44-builder";
import { DatabaseTeamAnalysisDb44Coverage, DatabaseTeamAnalysisDb44Dataset } from "./team-analysis-db44-contract";
import { hasDb44ConservativeBoundaries } from "./team-analysis-db44-validator";

export interface Db44GoldenValidation { schemaVersion: 1; fixtureCount: number; passed: number; failures: Array<{ fixture: string; issue: string }> }
export async function validateDatabaseTeamAnalysisDb44Goldens(dataset: DatabaseTeamAnalysisDb44Dataset, coverage: DatabaseTeamAnalysisDb44Coverage): Promise<Db44GoldenValidation> {
    const path = existsSync(resolve(__dirname, "team-analysis-db44-golden-fixtures.json")) ? resolve(__dirname, "team-analysis-db44-golden-fixtures.json") : resolve(__dirname, "..", "..", "database-experiment", "team-analysis-db44-golden-fixtures.json"), fixtures = JSON.parse(await readFile(path, "utf8")) as any[], failures: Array<{ fixture: string; issue: string }> = [];
    for (const fixture of fixtures) {
        if (fixture.kind === "modifier") { const projected = projectDb44Modifier(fixture.efficacyType, fixture.value); if (JSON.stringify([projected.status, projected.stat, projected.runtimeModifierFloat32, projected.sourceColumn]) !== JSON.stringify([fixture.status, fixture.stat, fixture.float32, "eff_value1"])) failures.push({ fixture: fixture.name, issue: "synthetic modifier differs" }); continue; }
        const projected = dataset.ruleProjections.find(value => value.stateKey === fixture.stateKey && value.ruleKey === fixture.ruleKey); if (!projected) { failures.push({ fixture: fixture.name, issue: "rule missing" }); continue; }
        const actual = [projected.passiveSkillId, projected.efficacyType, projected.statModifier.stat, projected.statModifier.runtimeModifierFloat32, projected.calculationOperation.value, projected.calculationBucket.value], expected = [fixture.passiveSkillId, fixture.efficacyType, fixture.stat, fixture.modifier, fixture.operation, fixture.bucket];
        if (JSON.stringify(actual) !== JSON.stringify(expected)) failures.push({ fixture: fixture.name, issue: "projection tuple differs" });
        if (projected.statModifier.sourceColumn !== "eff_value1" || projected.ignoredBehavioralParameters.status !== "not_read_by_handler" || !hasDb44ConservativeBoundaries(projected) || projected.operandUnit.status !== "partial") failures.push({ fixture: fixture.name, issue: "conservative boundary differs" });
    }
    const expected: Partial<DatabaseTeamAnalysisDb44Coverage> = { ruleCount: 33, sourceEffectCount: 33, statApplicationCount: 33, affectedStateCount: 25, passiveSkillCount: 31, supportedModifierRuleCount: 33, supportedBucketRuleCount: 33, supportedTargetRuleCount: 33, emptySubTargetIdentityRuleCount: 33, zeroIgnoredBehavioralParameterRuleCount: 33, countSemanticPartialRuleCount: 33, simulationPartialRuleCount: 33, simulationUnknownRuleCount: 0, legacyRepresentationGainRuleCount: 33, confirmedLegacyConflictCount: 0 };
    for (const [key, value] of Object.entries(expected)) if (coverage[key as keyof DatabaseTeamAnalysisDb44Coverage] !== value) failures.push({ fixture: "coverage", issue: `${key} differs` });
    const distributions = { ruleCountsByEfficacyType: { "59": 22, "60": 11 }, ruleCountsByStat: { attack: 22, defense: 11 }, ruleCountsByTiming: { "1": 32, "4": 1 }, ruleCountsByCalculationOption: { "0": 4, "2": 28, "3": 1 }, ruleCountsByTurn: { "1": 28, "3": 1, "1000": 2, "2000": 2 }, ruleCountsByOnceOnly: { "0": 28, "1": 5 }, statApplicationsByStatAndBucket: { "attack|former_passive_stat": 21, "attack|latter_passive_stat": 1, "defense|former_passive_stat": 11 } };
    for (const [key, value] of Object.entries(distributions)) if (JSON.stringify(coverage[key as keyof DatabaseTeamAnalysisDb44Coverage]) !== JSON.stringify(value)) failures.push({ fixture: "coverage distributions", issue: `${key} differs` });
    if (dataset.ruleProjections.some(value => value.target.candidate.scope !== "self" || value.target.subTarget.filters.length !== 0 || !hasDb44ConservativeBoundaries(value))) failures.push({ fixture: "semantic boundaries", issue: "independent dimension was over-promoted" });
    return { schemaVersion: 1, fixtureCount: fixtures.length + 3, passed: fixtures.length + 3 - failures.length, failures };
}
