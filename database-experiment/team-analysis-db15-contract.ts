import { Db13RuleAlignmentKind } from "./team-analysis-db13-contract";

export type Db15RuleParityStatus = "exact" | "partial" | "divergent";

export interface Db15RuleParityView {
    databaseSignatures: string[],
    currentSignatures: string[],
    matchedSignatures: string[],
    databaseOnlySignatures: string[],
    currentOnlySignatures: string[],
    status: Db15RuleParityStatus,
}

export interface Db15AppliedCompatibilityAlias {
    value: number,
    negated: boolean,
    nativeLowerSignature: string,
    nativeUpperSignature: string,
    compatibilitySignature: string,
}

export interface Db15RuleConditionParity {
    stateKey: string,
    databaseRuleKey: string,
    currentRuleKey: string,
    ruleAlignmentKind: Db13RuleAlignmentKind,
    appliedCompatibilityAliases: Db15AppliedCompatibilityAlias[],
    baseline: Db15RuleParityView,
    withCompatibilityAliases: Db15RuleParityView,
}

export interface DatabaseTeamAnalysisDb15Dataset {
    schemaVersion: 1,
    contract: "dokkan-team-analysis-rule-condition-parity-experiment",
    contractVersion: "0.14.0",
    generatedAt: string,
    sourceDb11: { fileName: "team-analysis-db11-experiment.json.gz", sha256: string, contractVersion: "0.10.0" },
    sourceDb13: { fileName: "team-analysis-db13-rule-alignment.json.gz", sha256: string, contractVersion: "0.12.1" },
    sourceDb14: { fileName: "team-analysis-db14-exact-turn-compatibility.json.gz", sha256: string, contractVersion: "0.13.0" },
    sourceCurrentTeamAnalysis: { sha256: string, parserVersion: string },
    sourceSnapshotVersion: string,
    sourceDatabaseSha256: string,
    comparisonUniverse: "runtime-types-43-51-55-plus-current-exact-turn",
    semanticPromotionCount: 0,
    alignedRulePairCount: number,
    ruleConditionParity: Db15RuleConditionParity[],
}

export interface DatabaseTeamAnalysisDb15Coverage {
    schemaVersion: 1,
    alignedRulePairCount: number,
    comparableRulePairCount: number,
    noComparableConditionRulePairCount: number,
    baselinePairCounts: Record<Db15RuleParityStatus, number>,
    compatibilityPairCounts: Record<Db15RuleParityStatus, number>,
    exactPairDelta: number,
    baselineMatchedSignatureOccurrenceCount: number,
    compatibilityMatchedSignatureOccurrenceCount: number,
    baselineDatabaseOnlySignatureOccurrenceCount: number,
    compatibilityDatabaseOnlySignatureOccurrenceCount: number,
    baselineCurrentOnlySignatureOccurrenceCount: number,
    compatibilityCurrentOnlySignatureOccurrenceCount: number,
    appliedCompatibilityAliasCount: number,
    resolvedNativeSignatureOccurrenceCount: number,
    matchedCurrentExactSignatureOccurrenceCount: number,
    semanticPromotionCount: 0,
}

export interface DatabaseTeamAnalysisDb15ArtifactManifest {
    schemaVersion: 1,
    contractVersion: "0.14.0",
    generatedAt: string,
    fileName: "team-analysis-db15-rule-condition-parity.json.gz",
    compression: "gzip",
    sha256: string,
    sizeBytes: number,
    uncompressedSizeBytes: number,
    comparableRulePairCount: number,
    appliedCompatibilityAliasCount: number,
    semanticPromotionCount: 0,
    sourceDatabaseSha256: string,
    sourceDb11Sha256: string,
    sourceDb13Sha256: string,
    sourceDb14Sha256: string,
    currentTeamAnalysisSha256: string,
    coverageFile: "team-analysis-db15-coverage.json",
    reportFile: "team-analysis-db15-report.md",
    goldenValidationFile: "team-analysis-db15-golden-validation.json",
}
