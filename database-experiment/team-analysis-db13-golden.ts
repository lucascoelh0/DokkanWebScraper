import { existsSync } from "fs";
import { readFile } from "fs/promises";
import { resolve } from "path";
import { DatabaseTeamAnalysisDb13Coverage, DatabaseTeamAnalysisDb13Dataset } from "./team-analysis-db13-contract";

interface CandidateFixture { stateKey: string, value: number, databaseRuleKey: string }
interface Fixtures { schemaVersion: number, expectedCounts: { ruleAlignments: number, exactEffectSets: number, uniqueEffectAnchors: number, alignedExactTurnCandidates: number, unalignedExactTurnCandidates: number }, aligned: CandidateFixture, unaligned: CandidateFixture }
export async function validateDatabaseTeamAnalysisDb13Goldens(dataset: DatabaseTeamAnalysisDb13Dataset, coverage: DatabaseTeamAnalysisDb13Coverage): Promise<{ fixtureCount: number, passed: number, failures: Array<{ fixture: string, issue: string }> }> {
    const path = existsSync(resolve(__dirname, "team-analysis-db13-golden-fixtures.json")) ? resolve(__dirname, "team-analysis-db13-golden-fixtures.json") : resolve(__dirname, "..", "..", "database-experiment", "team-analysis-db13-golden-fixtures.json");
    const fixtures = JSON.parse(await readFile(path, "utf8")) as Fixtures; if (fixtures.schemaVersion !== 1) throw new Error("Unsupported DB13 golden contract");
    const failures: Array<{ fixture: string, issue: string }> = []; const check = (fixture: string, valid: boolean, issue: string) => { if (!valid) failures.push({ fixture, issue }); };
    check("rule alignment count", coverage.ruleAlignmentCount === fixtures.expectedCounts.ruleAlignments, `expected ${fixtures.expectedCounts.ruleAlignments}, got ${coverage.ruleAlignmentCount}`);
    check("exact effect sets", coverage.ruleAlignmentCountsByKind.exact_effect_set_unique === fixtures.expectedCounts.exactEffectSets, `expected ${fixtures.expectedCounts.exactEffectSets}, got ${coverage.ruleAlignmentCountsByKind.exact_effect_set_unique}`);
    check("unique effect anchors", coverage.ruleAlignmentCountsByKind.unique_effect_signature_anchor === fixtures.expectedCounts.uniqueEffectAnchors, `expected ${fixtures.expectedCounts.uniqueEffectAnchors}, got ${coverage.ruleAlignmentCountsByKind.unique_effect_signature_anchor}`);
    check("aligned exact turns", coverage.exactTurnRuleAlignedCount === fixtures.expectedCounts.alignedExactTurnCandidates, `expected ${fixtures.expectedCounts.alignedExactTurnCandidates}, got ${coverage.exactTurnRuleAlignedCount}`);
    check("unaligned exact turns", coverage.exactTurnRuleUnalignedCount === fixtures.expectedCounts.unalignedExactTurnCandidates, `expected ${fixtures.expectedCounts.unalignedExactTurnCandidates}, got ${coverage.exactTurnRuleUnalignedCount}`);
    const find = (fixture: CandidateFixture) => dataset.exactTurnRuleAssessments.find(value => value.stateKey === fixture.stateKey && value.value === fixture.value && value.databaseRuleKey === fixture.databaseRuleKey);
    check("aligned example", find(fixtures.aligned)?.status === "rule_aligned_unique_effect_shape", "aligned Catopesra candidate missing"); check("unaligned example", find(fixtures.unaligned)?.status === "rule_unaligned", "unaligned Catopesra candidate missing");
    check("no semantic promotion", dataset.semanticPromotionCount === 0 && coverage.semanticPromotionCount === 0, "DB13 must remain diagnostic-only");
    const fixtureCount = 8; return { fixtureCount, passed: fixtureCount - failures.length, failures };
}
