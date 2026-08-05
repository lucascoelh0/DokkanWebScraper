import { existsSync } from "fs";
import { readFile } from "fs/promises";
import { resolve } from "path";
import { DatabaseTeamAnalysisDb12Coverage, DatabaseTeamAnalysisDb12Dataset } from "./team-analysis-db12-contract";

interface Fixtures {
    schemaVersion: number,
    expectedCounts: { databaseOnlySignatures: number, currentOnlySignatures: number, exactStructuralMatches: number, exactTurnEncodingCandidates: number },
    exactTurnCandidate: { stateKey: string, value: number },
    databaseOnlyStateKey: string,
    currentOnlyStateKey: string,
}

export async function validateDatabaseTeamAnalysisDb12Goldens(dataset: DatabaseTeamAnalysisDb12Dataset, coverage: DatabaseTeamAnalysisDb12Coverage): Promise<{ fixtureCount: number, passed: number, failures: Array<{ fixture: string, issue: string }> }> {
    const path = existsSync(resolve(__dirname, "team-analysis-db12-golden-fixtures.json")) ? resolve(__dirname, "team-analysis-db12-golden-fixtures.json") : resolve(__dirname, "..", "..", "database-experiment", "team-analysis-db12-golden-fixtures.json");
    const fixtures = JSON.parse(await readFile(path, "utf8")) as Fixtures; if (fixtures.schemaVersion !== 1) throw new Error("Unsupported DB12 golden contract");
    const failures: Array<{ fixture: string, issue: string }> = []; const check = (fixture: string, valid: boolean, issue: string) => { if (!valid) failures.push({ fixture, issue }); };
    check("database-only signature count", coverage.databaseOnlySignatureCount === fixtures.expectedCounts.databaseOnlySignatures, `expected ${fixtures.expectedCounts.databaseOnlySignatures}, got ${coverage.databaseOnlySignatureCount}`);
    check("current-only signature count", coverage.currentOnlySignatureCount === fixtures.expectedCounts.currentOnlySignatures, `expected ${fixtures.expectedCounts.currentOnlySignatures}, got ${coverage.currentOnlySignatureCount}`);
    check("exact structural match count", coverage.exactStructuralMatchCount === fixtures.expectedCounts.exactStructuralMatches, `expected ${fixtures.expectedCounts.exactStructuralMatches}, got ${coverage.exactStructuralMatchCount}`);
    check("exact-turn candidate", dataset.exactTurnEncodingCandidates.some(value => value.stateKey === fixtures.exactTurnCandidate.stateKey && value.value === fixtures.exactTurnCandidate.value && value.status === "candidate_not_rule_aligned" && value.databaseLowerSignature.includes('"comparator":"gte"') && value.databaseUpperSignature.includes('"comparator":"lte"') && value.currentExactSignatures.some(signature => signature.includes('"comparator":"eq"'))), "bounded conjunction or current exact atom missing");
    check("exact-turn candidate count", coverage.exactTurnEncodingCandidateCount === fixtures.expectedCounts.exactTurnEncodingCandidates, `expected ${fixtures.expectedCounts.exactTurnEncodingCandidates}, got ${coverage.exactTurnEncodingCandidateCount}`);
    check("database-only state", dataset.databaseOnlyStateKeys.includes(fixtures.databaseOnlyStateKey), `${fixtures.databaseOnlyStateKey} missing`);
    check("current-only state", dataset.currentOnlyStateKeys.includes(fixtures.currentOnlyStateKey), `${fixtures.currentOnlyStateKey} missing`);
    check("no semantic promotion", dataset.semanticPromotionCount === 0 && coverage.semanticPromotionCount === 0, "DB12 must remain diagnostic-only");
    const fixtureCount = 8; return { fixtureCount, passed: fixtureCount - failures.length, failures };
}
