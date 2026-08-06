import { existsSync } from "fs";
import { readFile } from "fs/promises";
import { resolve } from "path";
import { DatabaseTeamAnalysisDb25Coverage, DatabaseTeamAnalysisDb25Dataset, Db25AttackContextTest } from "./team-analysis-db25-contract";
interface Fixture { name: string, stateKey: string, ruleKey: string, causalityId: string, causalityType: 40 | 56, test: Db25AttackContextTest }
export interface Db25GoldenValidation { schemaVersion: 1, fixtureCount: number, passed: number, failures: Array<{ fixture: string, issue: string }> }
export async function validateDatabaseTeamAnalysisDb25Goldens(dataset: DatabaseTeamAnalysisDb25Dataset, coverage: DatabaseTeamAnalysisDb25Coverage): Promise<Db25GoldenValidation> {
    const path = existsSync(resolve(__dirname, "team-analysis-db25-golden-fixtures.json")) ? resolve(__dirname, "team-analysis-db25-golden-fixtures.json") : resolve(__dirname, "..", "..", "database-experiment", "team-analysis-db25-golden-fixtures.json");
    const fixtures = JSON.parse(await readFile(path, "utf8")) as Fixture[], failures: Array<{ fixture: string, issue: string }> = [];
    for (const fixture of fixtures) { const value = dataset.resolutions.find(row => row.stateKey === fixture.stateKey && row.ruleKey === fixture.ruleKey && row.causalityId === fixture.causalityId); const issues: string[] = []; if (!value) issues.push("resolution missing"); else { if (value.causalityType !== fixture.causalityType || value.canonicalProjection.test !== fixture.test) issues.push("native predicate differs"); if (value.semanticStatus !== "partial" || value.semanticPromotion !== false || value.canonicalProjection.attackKind !== "unknown" || value.canonicalProjection.eventDirection !== "unknown") issues.push("conservative boundary differs"); if ([value.raw.cauVal1, value.raw.cauVal2, value.raw.cauVal3].some(raw => Number(raw) !== 0)) issues.push("raw payload differs"); } if (issues.length > 0) failures.push({ fixture: fixture.name, issue: issues.join(", ") }); }
    if (coverage.occurrenceCountsByType["40"] !== 132 || coverage.occurrenceCountsByType["56"] !== 20 || coverage.rawZeroPayloadCount !== coverage.resolutionCount || !coverage.dynamicExperimentRequired) failures.push({ fixture: "coverage", issue: "snapshot accounting or dynamic boundary differs" });
    return { schemaVersion: 1, fixtureCount: fixtures.length + 1, passed: fixtures.length + 1 - failures.length, failures };
}
