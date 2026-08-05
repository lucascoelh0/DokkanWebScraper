export type Db16ResidualSide = "database" | "current";
export type Db16ResidualReason = "logical_context_mismatch" | "polarity_mismatch" | "turn_one_exact_boundary_candidate_unproven" | "comparator_mismatch" | "threshold_mismatch" | "current_turn_one_lower_bound_without_database_atom_unproven" | "absent_in_other";

export interface Db16ResidualAttribution {
    stateKey: string,
    databaseRuleKey: string,
    currentRuleKey: string,
    side: Db16ResidualSide,
    structuralSignature: string,
    reason: Db16ResidualReason,
    candidateSignatures: string[],
}

export interface DatabaseTeamAnalysisDb16Dataset {
    schemaVersion: 1,
    contract: "dokkan-team-analysis-rule-residual-attribution-experiment",
    contractVersion: "0.15.0",
    generatedAt: string,
    sourceDb15: { fileName: "team-analysis-db15-rule-condition-parity.json.gz", sha256: string, contractVersion: "0.14.0" },
    sourceSnapshotVersion: string,
    sourceDatabaseSha256: string,
    sourceCurrentTeamAnalysis: { sha256: string, parserVersion: string },
    comparisonUniverse: "runtime-types-43-51-55-plus-current-exact-turn",
    semanticPromotionCount: 0,
    residualAttributions: Db16ResidualAttribution[],
}

export interface DatabaseTeamAnalysisDb16Coverage {
    schemaVersion: 1,
    residualRulePairCount: number,
    residualAttributionCount: number,
    databaseResidualCount: number,
    currentResidualCount: number,
    countsBySideAndReason: Record<Db16ResidualSide, Record<Db16ResidualReason, number>>,
    turnOneExactBoundaryCandidateRulePairCount: number,
    currentTurnOneLowerBoundCandidateRulePairCount: number,
    unprovenCandidateAttributionCount: number,
    semanticPromotionCount: 0,
}

export interface DatabaseTeamAnalysisDb16ArtifactManifest {
    schemaVersion: 1,
    contractVersion: "0.15.0",
    generatedAt: string,
    fileName: "team-analysis-db16-residual-attribution.json.gz",
    compression: "gzip",
    sha256: string,
    sizeBytes: number,
    uncompressedSizeBytes: number,
    residualAttributionCount: number,
    unprovenCandidateAttributionCount: number,
    semanticPromotionCount: 0,
    sourceDatabaseSha256: string,
    sourceDb15Sha256: string,
    currentTeamAnalysisSha256: string,
    coverageFile: "team-analysis-db16-coverage.json",
    reportFile: "team-analysis-db16-report.md",
    goldenValidationFile: "team-analysis-db16-golden-validation.json",
}
