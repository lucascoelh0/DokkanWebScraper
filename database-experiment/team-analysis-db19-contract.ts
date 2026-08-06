export type Db19ResidualSide = "database" | "current";
export type Db19ResidualReason = "occurrence_count_mismatch" | "logical_context_mismatch" | "polarity_mismatch" | "comparator_mismatch" | "threshold_mismatch" | "absent_in_other";

export interface Db19ResidualAttribution {
    stateKey: string,
    databaseRuleKey: string,
    currentRuleKey: string,
    side: Db19ResidualSide,
    structuralSignature: string,
    reason: Db19ResidualReason,
    candidateSignatures: string[],
}

export interface Db19ResidualPattern {
    patternKey: string,
    side: Db19ResidualSide,
    reason: Db19ResidualReason,
    kind: string,
    comparatorOrEventMode: string,
    logicalContext: string,
    negated: boolean,
    occurrenceCount: number,
    rulePairCount: number,
    sampleRulePairKeys: string[],
}

export interface DatabaseTeamAnalysisDb19Dataset {
    schemaVersion: 1,
    contract: "dokkan-team-analysis-post-lifecycle-residual-attribution",
    contractVersion: "0.18.0",
    generatedAt: string,
    sourceDb15: { fileName: "team-analysis-db15-rule-condition-parity.json.gz", sha256: string, contractVersion: "0.14.0" },
    sourceDb18: { fileName: "team-analysis-db18-lifecycle-compatibility-parity.json.gz", sha256: string, contractVersion: "0.17.1" },
    sourceSnapshotVersion: string,
    sourceDatabaseSha256: string,
    sourceCurrentTeamAnalysis: { sha256: string, parserVersion: string },
    comparisonUniverse: "runtime-types-43-51-55-plus-current-exact-turn",
    inheritedSemanticPromotionCount: 3,
    semanticPromotionCount: 0,
    residualAttributions: Db19ResidualAttribution[],
    residualPatterns: Db19ResidualPattern[],
}

export interface DatabaseTeamAnalysisDb19Coverage {
    schemaVersion: 1,
    comparableRulePairCount: number,
    residualRulePairCount: number,
    residualAttributionCount: number,
    databaseResidualCount: number,
    currentResidualCount: number,
    countsBySideAndReason: Record<Db19ResidualSide, Record<Db19ResidualReason, number>>,
    residualPatternCount: number,
    topPatternKey: string,
    topPatternOccurrenceCount: number,
    inheritedSemanticPromotionCount: 3,
    semanticPromotionCount: 0,
}

export interface DatabaseTeamAnalysisDb19ArtifactManifest {
    schemaVersion: 1,
    contractVersion: "0.18.0",
    generatedAt: string,
    fileName: "team-analysis-db19-post-lifecycle-residuals.json.gz",
    compression: "gzip",
    sha256: string,
    sizeBytes: number,
    uncompressedSizeBytes: number,
    residualAttributionCount: number,
    residualPatternCount: number,
    inheritedSemanticPromotionCount: 3,
    semanticPromotionCount: 0,
    sourceDatabaseSha256: string,
    sourceDb15Sha256: string,
    sourceDb18Sha256: string,
    currentTeamAnalysisSha256: string,
    coverageFile: "team-analysis-db19-coverage.json",
    reportFile: "team-analysis-db19-report.md",
    goldenValidationFile: "team-analysis-db19-golden-validation.json",
}
