import { readFile } from "fs/promises";
import { resolve } from "path";
import { projectDb37Duration, projectDb37OnceOnly } from "./team-analysis-db37-builder";
import { DatabaseTeamAnalysisDb37Coverage, DatabaseTeamAnalysisDb37Dataset } from "./team-analysis-db37-contract";

export async function validateDatabaseTeamAnalysisDb37Goldens(dataset: DatabaseTeamAnalysisDb37Dataset, coverage: DatabaseTeamAnalysisDb37Coverage) {
    const fixtures = JSON.parse(await readFile(resolve(__dirname, "team-analysis-db37-golden-fixtures.json"), "utf8")) as any[];
    const failures: string[] = [];
    for (const fixture of fixtures) {
        const once = projectDb37OnceOnly(fixture.isOnce), duration = projectDb37Duration(fixture.turn);
        if (once.status !== fixture.onceStatus || once.enabled !== fixture.enabled || duration.status !== fixture.durationStatus) failures.push(fixture.id);
    }
    if (coverage.ruleCount !== 14301 || coverage.effectCount !== 18078 || coverage.affectedStateCount !== 1571 || coverage.passiveSkillCount !== 13991 || coverage.fieldSupportedRuleCount !== 14301 || coverage.simulationPartialRuleCount !== 14301 || coverage.simulationUnknownRuleCount !== 0 || coverage.onceOnlyEnabledRuleCount !== 1049 || coverage.onceOnlyEnabledEffectCount !== 1204 || coverage.onceOnlyEnabledStateCount !== 397) failures.push("snapshot population");
    if (JSON.stringify(coverage.ruleCountsByRawIsOnce) !== JSON.stringify({ "0": 13252, "1": 1049 }) || JSON.stringify(coverage.effectCountsByRawIsOnce) !== JSON.stringify({ "0": 16874, "1": 1204 })) failures.push("snapshot once distribution");
    if (dataset.ruleLifecycles.some(rule => rule.independentDimensions.condition !== "independent" || rule.independentDimensions.target !== "inherited_db36" || rule.independentDimensions.timing !== "independent" || rule.independentDimensions.operation !== "independent" || rule.independentDimensions.unit !== "independent" || rule.independentDimensions.calculationBucket !== "independent" || rule.independentDimensions.recurrence !== "partial" || rule.independentDimensions.stacking !== "unknown" || rule.onceOnly.execCountReset.trigger !== "unknown")) failures.push("semantic boundary");
    return { schemaVersion: 1 as const, fixtureCount: fixtures.length + 3, passed: fixtures.length + 3 - failures.length, failures };
}
