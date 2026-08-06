import { existsSync } from "fs";
import { readFile } from "fs/promises";
import { resolve } from "path";
import { DatabaseTeamAnalysisDb24Coverage, DatabaseTeamAnalysisDb24Dataset } from "./team-analysis-db24-contract";
interface Fixture { name: string, stateKey: string, ruleKey: string, passiveSkillId: string, resistDamageRate: number, increaseDamagePercent: number, battleScriptNo: number, probability: number }
export interface Db24GoldenValidation { schemaVersion: 1, fixtureCount: number, passed: number, failures: Array<{ fixture: string, issue: string }> }
export async function validateDatabaseTeamAnalysisDb24Goldens(dataset: DatabaseTeamAnalysisDb24Dataset, coverage: DatabaseTeamAnalysisDb24Coverage): Promise<Db24GoldenValidation> {
    const path = existsSync(resolve(__dirname, "team-analysis-db24-golden-fixtures.json")) ? resolve(__dirname, "team-analysis-db24-golden-fixtures.json") : resolve(__dirname, "..", "..", "database-experiment", "team-analysis-db24-golden-fixtures.json");
    const fixtures = JSON.parse(await readFile(path, "utf8")) as Fixture[]; const failures: Array<{ fixture: string, issue: string }> = [];
    for (const fixture of fixtures) {
        const value = dataset.counterBehaviorResolutions.find(row => row.stateKey === fixture.stateKey && row.ruleKey === fixture.ruleKey); const issues: string[] = [];
        if (!value) issues.push("resolution missing"); else {
            if (value.passiveSkillId !== fixture.passiveSkillId) issues.push("passive skill differs");
            if (JSON.stringify([value.payload.resistDamageRate.runtimeInteger, value.payload.increaseDamagePercent.runtimeInteger, value.payload.battleScriptNo.runtimeInteger]) !== JSON.stringify([fixture.resistDamageRate, fixture.increaseDamagePercent, fixture.battleScriptNo])) issues.push("payload differs");
            if (value.activation.probability !== fixture.probability) issues.push("probability differs");
            if (JSON.stringify([value.semanticStatus, value.activation.timingStatus, value.activation.calculationBucket, value.activation.duration, value.activation.recurrence]) !== JSON.stringify(["partial", "unknown", "unknown", "unknown", "unknown"])) issues.push("boundary differs");
        }
        if (issues.length > 0) failures.push({ fixture: fixture.name, issue: issues.join(", ") });
    }
    if (coverage.resolutionCount !== coverage.sourceGapRuleCount || coverage.unknownPayloadFieldCount !== 0) failures.push({ fixture: "coverage", issue: "source accounting or payload coverage differs" });
    return { schemaVersion: 1, fixtureCount: fixtures.length + 1, passed: fixtures.length + 1 - failures.length, failures };
}
