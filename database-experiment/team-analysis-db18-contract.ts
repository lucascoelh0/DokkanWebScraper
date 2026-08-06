import { Db15RuleParityStatus, Db15RuleParityView } from "./team-analysis-db15-contract";
import { Db17ConclusionKind } from "./team-analysis-db17-contract";

export type Db18ApplicationKind = "remove_current_turn_one_tautology" | "normalize_database_lte_one_to_eq_one";
export interface Db18LifecycleCompatibilityApplication {
    kind: Db18ApplicationKind,
    sourceSignature: string,
    compatibilitySignature?: string,
    conclusion: Db17ConclusionKind,
    precondition: "appearance_gate_true_and_normal_runtime_lifecycle",
    structuralPrecondition: "non_negated_conjunctive_atom" | "same_context_and_polarity",
    sourceDb16Reason: "current_turn_one_lower_bound_without_database_atom_unproven" | "turn_one_exact_boundary_candidate_unproven",
}
export interface Db18AffectedRuleParity {
    stateKey: string,
    databaseRuleKey: string,
    currentRuleKey: string,
    applications: Db18LifecycleCompatibilityApplication[],
    beforeLifecycleCompatibility: Db15RuleParityView,
    withLifecycleCompatibility: Db15RuleParityView,
}
export interface DatabaseTeamAnalysisDb18Dataset {
    schemaVersion: 1, contract: "dokkan-team-analysis-lifecycle-compatibility-parity-experiment", contractVersion: "0.17.1", generatedAt: string,
    sourceDb15: { fileName: "team-analysis-db15-rule-condition-parity.json.gz", sha256: string, contractVersion: "0.14.0" },
    sourceDb16: { fileName: "team-analysis-db16-residual-attribution.json.gz", sha256: string, contractVersion: "0.15.0" },
    sourceDb17: { fileName: "team-analysis-db17-appearance-turn-evidence.json.gz", sha256: string, contractVersion: "0.16.0" },
    sourceSnapshotVersion: string, sourceDatabaseSha256: string, sourceCurrentTeamAnalysis: { sha256: string, parserVersion: string }, comparisonUniverse: "runtime-types-43-51-55-plus-current-exact-turn",
    compatibilityPrecondition: "appearance_gate_true_and_normal_runtime_lifecycle", inheritedSemanticPromotionCount: 3, semanticPromotionCount: 0,
    affectedRuleParity: Db18AffectedRuleParity[],
}
export interface DatabaseTeamAnalysisDb18Coverage {
    schemaVersion: 1, comparableRulePairCount: number, affectedRulePairCount: number,
    beforePairCounts: Record<Db15RuleParityStatus, number>, lifecycleCompatibilityPairCounts: Record<Db15RuleParityStatus, number>, exactPairDelta: number,
    removedCurrentTautologyOccurrenceCount: number, normalizedTurnOneBoundaryOccurrenceCount: number, resolvedDb16AttributionCount: number,
    beforeDatabaseOnlySignatureOccurrenceCount: number, lifecycleDatabaseOnlySignatureOccurrenceCount: number, beforeCurrentOnlySignatureOccurrenceCount: number, lifecycleCurrentOnlySignatureOccurrenceCount: number,
    remainingResidualRulePairCount: number, inheritedSemanticPromotionCount: 3, semanticPromotionCount: 0,
}
export interface DatabaseTeamAnalysisDb18ArtifactManifest {
    schemaVersion: 1, contractVersion: "0.17.1", generatedAt: string, fileName: "team-analysis-db18-lifecycle-compatibility-parity.json.gz", compression: "gzip", sha256: string, sizeBytes: number, uncompressedSizeBytes: number,
    affectedRulePairCount: number, exactPairDelta: number, resolvedDb16AttributionCount: number, inheritedSemanticPromotionCount: 3, semanticPromotionCount: 0,
    sourceDatabaseSha256: string, sourceDb15Sha256: string, sourceDb16Sha256: string, sourceDb17Sha256: string, currentTeamAnalysisSha256: string,
    coverageFile: "team-analysis-db18-coverage.json", reportFile: "team-analysis-db18-report.md", goldenValidationFile: "team-analysis-db18-golden-validation.json",
}
