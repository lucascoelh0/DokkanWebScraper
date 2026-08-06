import { existsSync } from "fs";
import { readFile } from "fs/promises";
import { resolve } from "path";
import { DatabaseTeamAnalysisDb22Coverage, DatabaseTeamAnalysisDb22Dataset } from "./team-analysis-db22-contract";

export async function validateDatabaseTeamAnalysisDb22Goldens(dataset: DatabaseTeamAnalysisDb22Dataset, coverage: DatabaseTeamAnalysisDb22Coverage) {
    const path = existsSync(resolve(__dirname, "team-analysis-db22-golden-fixtures.json")) ? resolve(__dirname, "team-analysis-db22-golden-fixtures.json") : resolve(__dirname, "..", "..", "database-experiment", "team-analysis-db22-golden-fixtures.json");
    const f = JSON.parse(await readFile(path, "utf8")); const failures: Array<{ fixture: string, issue: string }> = [];
    const check = (fixture: string, valid: boolean) => { if (!valid) failures.push({ fixture, issue: "value differs" }); };
    check("pairs", coverage.comparableRulePairCount === f.expectedComparablePairs && coverage.affectedRulePairCount === f.expectedAffectedPairs && coverage.parityChangedRulePairCount === f.expectedParityChangedPairs);
    check("raw projection", coverage.rawCurrentProjectionValidatedRulePairCount === f.expectedComparablePairs);
    check("tautologies", coverage.removedTurnOneTautologyOccurrenceCount === f.expectedRemovedTautologies && coverage.additionalRemovedTautologyOccurrenceCountOverDb18 === f.expectedAdditionalRemovedOverDb18);
    check("before counts", JSON.stringify(coverage.beforePairCounts) === JSON.stringify(f.expectedBeforeCounts));
    check("after counts", JSON.stringify(coverage.normalizedPairCounts) === JSON.stringify(f.expectedAfterCounts));
    check("residuals", coverage.normalizedDatabaseOnlySignatureOccurrenceCount === f.expectedDatabaseResiduals && coverage.normalizedCurrentOnlySignatureOccurrenceCount === f.expectedCurrentResiduals);
    check("applications", dataset.affectedRuleParity.every(value => value.removedTurnOneTautologyCount > 0 && value.structuralNormalization === "recursive_boolean_identity_after_confirmed_tautology" && value.provenance.currentTeamAnalysisRuleId === value.currentRuleKey));
    check("no promotion", dataset.inheritedSemanticPromotionCount === 3 && dataset.semanticPromotionCount === 0);
    return { fixtureCount: 8, passed: 8 - failures.length, failures };
}
