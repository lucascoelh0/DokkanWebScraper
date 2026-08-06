import { SqliteScalar } from "./contract";

export type Db20CorrelationStatus = "exact_numeric_match" | "numeric_mismatch" | "non_numeric_turn" | "passive_skill_missing" | "database_rule_missing";

export interface Db20PassiveTurnCorrelation {
    stateKey: string,
    databaseRuleKey: string,
    currentRuleKey: string,
    currentStructuralSignature: string,
    currentTurnFromEntryUpperBound: number,
    passiveSkillId: string | null,
    raw: {
        turn: SqliteScalar,
        isOnce: SqliteScalar,
        executionTimingType: SqliteScalar,
        efficacyType: SqliteScalar,
    },
    correlationStatus: Db20CorrelationStatus,
    semanticStatus: "unknown",
    provenance: {
        table: "passive_skills",
        rowId: string | null,
        columns: ["turn", "is_once", "exec_timing_type", "efficacy_type"],
    },
}

export interface DatabaseTeamAnalysisDb20Dataset {
    schemaVersion: 1,
    contract: "dokkan-team-analysis-passive-turn-correlation",
    contractVersion: "0.19.0",
    generatedAt: string,
    sourceDb11: { fileName: "team-analysis-db11-experiment.json.gz", sha256: string, contractVersion: "0.10.0" },
    sourceDb19: { fileName: "team-analysis-db19-post-lifecycle-residuals.json.gz", sha256: string, contractVersion: "0.18.0" },
    sourceSnapshotVersion: string,
    sourceDatabaseSha256: string,
    sourceCurrentTeamAnalysis: { sha256: string, parserVersion: string },
    candidateDefinition: "current-only-absent-turn-from-entry-lte-all",
    inheritedSemanticPromotionCount: 3,
    semanticPromotionCount: 0,
    passiveTurnSemanticStatus: "unknown",
    correlations: Db20PassiveTurnCorrelation[],
}

export interface DatabaseTeamAnalysisDb20Coverage {
    schemaVersion: 1,
    candidateCount: number,
    candidateRulePairCount: number,
    correlationCounts: Record<Db20CorrelationStatus, number>,
    exactNumericMatchCount: number,
    exactNumericMatchRate: number,
    uniquePassiveSkillCount: number,
    rawValueDistributions: {
        turn: Record<string, number>,
        isOnce: Record<string, number>,
        executionTimingType: Record<string, number>,
        efficacyType: Record<string, number>,
    },
    inheritedSemanticPromotionCount: 3,
    semanticPromotionCount: 0,
    passiveTurnSemanticStatus: "unknown",
}

export interface DatabaseTeamAnalysisDb20ArtifactManifest {
    schemaVersion: 1,
    contractVersion: "0.19.0",
    generatedAt: string,
    fileName: "team-analysis-db20-passive-turn-correlation.json.gz",
    compression: "gzip",
    sha256: string,
    sizeBytes: number,
    uncompressedSizeBytes: number,
    candidateCount: number,
    exactNumericMatchCount: number,
    inheritedSemanticPromotionCount: 3,
    semanticPromotionCount: 0,
    sourceDatabaseSha256: string,
    sourceDb11Sha256: string,
    sourceDb19Sha256: string,
    currentTeamAnalysisSha256: string,
    coverageFile: "team-analysis-db20-coverage.json",
    reportFile: "team-analysis-db20-report.md",
    goldenValidationFile: "team-analysis-db20-golden-validation.json",
}
