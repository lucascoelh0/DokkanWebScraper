import { existsSync } from "fs";
import { readFile } from "fs/promises";
import { resolve } from "path";
import { DatabaseTeamAnalysisDb29Coverage, DatabaseTeamAnalysisDb29Dataset } from "./team-analysis-db29-contract";
import { Db3Status } from "./team-analysis-db3-contract";

interface Fixture { name: string, stateKey: string, ruleKey: string, passiveSkillId: string, conditionStatus: Db3Status, executionTimingType: number, targetType: number, calculationOption: number, isOnce: number, probability: number }
export interface Db29GoldenValidation { schemaVersion: 1, fixtureCount: number, passed: number, failures: Array<{ fixture: string, issue: string }> }

export async function validateDatabaseTeamAnalysisDb29Goldens(dataset: DatabaseTeamAnalysisDb29Dataset, coverage: DatabaseTeamAnalysisDb29Coverage): Promise<Db29GoldenValidation> {
    const path = existsSync(resolve(__dirname, "team-analysis-db29-golden-fixtures.json")) ? resolve(__dirname, "team-analysis-db29-golden-fixtures.json") : resolve(__dirname, "..", "..", "database-experiment", "team-analysis-db29-golden-fixtures.json");
    const fixtures = JSON.parse(await readFile(path, "utf8")) as Fixture[], failures: Array<{ fixture: string, issue: string }> = [];
    for (const fixture of fixtures) {
        const value = dataset.resolutions.find(row => row.stateKey === fixture.stateKey && row.ruleKey === fixture.ruleKey), issues: string[] = [];
        if (!value) issues.push("resolution missing"); else {
            if (value.passiveSkillId !== fixture.passiveSkillId) issues.push("passive skill differs");
            const actual = [value.activation.conditionStatus, value.activation.executionTimingType, value.effect.target.structuredTargetType.raw, value.activation.calculationOption, value.activation.isOnce, value.activation.probability];
            const expected = [fixture.conditionStatus, fixture.executionTimingType, fixture.targetType, fixture.calculationOption, fixture.isOnce, fixture.probability];
            if (JSON.stringify(actual) !== JSON.stringify(expected)) issues.push("raw activation tuple differs");
            if (value.operation !== "attack_break_marker" || value.effect.status !== "supported" || value.effect.behavioralParameters.kind !== "none" || value.effect.target.structuredTargetType.status !== "unknown") issues.push("semantic projection differs");
            if (JSON.stringify([value.semanticStatus, value.activation.timingStatus, value.activation.calculationBucket, value.lifecycle.duration, value.lifecycle.recurrence]) !== JSON.stringify(["partial", "unknown", "unknown", "unknown", "unknown"])) issues.push("uncertainty boundary differs");
        }
        if (issues.length > 0) failures.push({ fixture: fixture.name, issue: issues.join(", ") });
    }
    const expectedCoverage = { sourceGapRuleCount: 36, resolutionCount: 36, affectedStateCount: 29, uniquePassiveSkillCount: 35, supportedEffectCount: 36, partialResolutionCount: 36, zeroRawValueRuleCount: 36 };
    for (const [key, expected] of Object.entries(expectedCoverage)) if (coverage[key as keyof typeof coverage] !== expected) failures.push({ fixture: "coverage", issue: `${key} differs` });
    return { schemaVersion: 1, fixtureCount: fixtures.length + 1, passed: fixtures.length + 1 - failures.length, failures };
}
