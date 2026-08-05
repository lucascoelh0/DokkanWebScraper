import { existsSync } from "fs";
import { readFile } from "fs/promises";
import { resolve } from "path";
import { DatabaseTeamAnalysisDb14Coverage, DatabaseTeamAnalysisDb14Dataset } from "./team-analysis-db14-contract";

interface Fixtures { schemaVersion: number, expectedAliasCount: number, expectedValues: number[], sample: { stateKey: string, value: number, databaseRuleKey: string, currentRuleKey: string, lowerCausalityId: string, upperCausalityId: string } }
export async function validateDatabaseTeamAnalysisDb14Goldens(dataset: DatabaseTeamAnalysisDb14Dataset, coverage: DatabaseTeamAnalysisDb14Coverage): Promise<{ fixtureCount: number, passed: number, failures: Array<{ fixture: string, issue: string }> }> {
    const path = existsSync(resolve(__dirname, "team-analysis-db14-golden-fixtures.json")) ? resolve(__dirname, "team-analysis-db14-golden-fixtures.json") : resolve(__dirname, "..", "..", "database-experiment", "team-analysis-db14-golden-fixtures.json"); const fixtures = JSON.parse(await readFile(path, "utf8")) as Fixtures; if (fixtures.schemaVersion !== 1) throw new Error("Unsupported DB14 golden contract");
    const failures: Array<{ fixture: string, issue: string }> = []; const check = (fixture: string, valid: boolean, issue: string) => { if (!valid) failures.push({ fixture, issue }); };
    check("alias count", coverage.compatibilityAliasCount === fixtures.expectedAliasCount, `expected ${fixtures.expectedAliasCount}, got ${coverage.compatibilityAliasCount}`); check("alias values", JSON.stringify(coverage.compatibilityAliasValues) === JSON.stringify(fixtures.expectedValues), `expected ${fixtures.expectedValues}, got ${coverage.compatibilityAliasValues}`);
    const sample = dataset.exactTurnCompatibilityAliases.find(value => value.stateKey === fixtures.sample.stateKey && value.value === fixtures.sample.value && value.databaseRuleKey === fixtures.sample.databaseRuleKey && value.currentRuleKey === fixtures.sample.currentRuleKey);
    check("sample alias", Boolean(sample), "sample alias missing"); check("sample native bounds", sample?.nativeBounds.lower.causalityId === fixtures.sample.lowerCausalityId && sample?.nativeBounds.upper.causalityId === fixtures.sample.upperCausalityId, "sample native bound IDs differ");
    check("current signature matches", coverage.currentExactSignatureMatchCount === coverage.compatibilityAliasCount, "not every alias matches a current exact signature"); check("unaligned skipped", coverage.skippedUnalignedCount === 9, `expected 9, got ${coverage.skippedUnalignedCount}`); check("ambiguous skipped", coverage.skippedAmbiguousCount === 0, `expected 0, got ${coverage.skippedAmbiguousCount}`); check("no semantic promotion", dataset.semanticPromotionCount === 0 && coverage.semanticPromotionCount === 0, "DB14 must remain compatibility-only");
    const fixtureCount = 8; return { fixtureCount, passed: fixtureCount - failures.length, failures };
}
