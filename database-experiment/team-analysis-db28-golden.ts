import { existsSync } from "fs";
import { readFile } from "fs/promises";
import { resolve } from "path";
import { DatabaseTeamAnalysisDb28Coverage, DatabaseTeamAnalysisDb28Dataset } from "./team-analysis-db28-contract";

interface Fixture { name: string, stateKey: string, ruleKey: string, causalityId: string, causalityType: 47 | 54, scope: string, expected: boolean }
export interface Db28GoldenValidation { schemaVersion: 1, fixtureCount: number, passed: number, failures: Array<{ fixture: string, issue: string }> }

export async function validateDatabaseTeamAnalysisDb28Goldens(dataset: DatabaseTeamAnalysisDb28Dataset, coverage: DatabaseTeamAnalysisDb28Coverage): Promise<Db28GoldenValidation> {
    const path = existsSync(resolve(__dirname, "team-analysis-db28-golden-fixtures.json")) ? resolve(__dirname, "team-analysis-db28-golden-fixtures.json") : resolve(__dirname, "..", "..", "database-experiment", "team-analysis-db28-golden-fixtures.json");
    const fixtures = JSON.parse(await readFile(path, "utf8")) as Fixture[], failures: Array<{ fixture: string, issue: string }> = [];
    for (const fixture of fixtures) {
        const value = dataset.resolutions.find(row => row.stateKey === fixture.stateKey && row.ruleKey === fixture.ruleKey && row.causalityId === fixture.causalityId), issues: string[] = [];
        if (!value) issues.push("resolution missing");
        else {
            const expected = value.predicate.scope === "party_pure_and_back_current_records" ? value.predicate.expected : true;
            if (value.causalityType !== fixture.causalityType || value.predicate.scope !== fixture.scope || expected !== fixture.expected) issues.push("predicate differs");
            if (value.predicate.status !== "supported" || value.semanticStatus !== "partial" || value.history.window !== "unknown" || value.activation.timing !== "unknown") issues.push("boundary differs");
        }
        if (issues.length) failures.push({ fixture: fixture.name, issue: issues.join(", ") });
    }
    if (coverage.sourceGapOccurrenceCount !== 70 || coverage.resolutionCount !== 70 || coverage.affectedStateCount !== 20 || coverage.occurrenceCountsByType["47"] !== 28 || coverage.occurrenceCountsByType["54"] !== 42 || coverage.affectedStateCountsByType["47"] !== 15 || coverage.affectedStateCountsByType["54"] !== 15 || coverage.uniqueCausalityCountsByType["47"] !== 6 || coverage.uniqueCausalityCountsByType["54"] !== 3 || coverage.supportedPredicateCount !== 70 || coverage.nonzeroPolarityCount !== 0) failures.push({ fixture: "coverage", issue: "snapshot accounting differs" });
    return { schemaVersion: 1, fixtureCount: fixtures.length + 1, passed: fixtures.length + 1 - failures.length, failures };
}
