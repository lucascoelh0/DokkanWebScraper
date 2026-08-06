import { SqliteScalar } from "./contract";
import { Db31RuleProjection } from "./team-analysis-db31-contract";
import { Db33ExecutionTiming } from "./team-analysis-db33-contract";

export type Db34Stat = "attack" | "defense";
export type Db34Bucket = "former_passive_stat" | "latter_passive_stat";
export interface Db34CodeRegion { role: string, symbol: string, vma: number, sizeBytes: number, codeSha256: string }
export interface Db34CallSite { timing: number, callVma: number, instructionHex: string }
export interface Db34NativeEvidence {
    schemaVersion: 1, sourceSha256: string, auditScope: string,
    sqliteBindings: Array<{ column: string, literalVma: number, passiveSkillOffset: number, callChangeParamOffset?: number, runtimeRole: string }>,
    efficacyDispatch: { tableVma: number, slots: Array<{ raw: 1 | 2 | 3, handlerRole: string, statApplications: Array<{ stat: Db34Stat, column: "eff_value1" | "eff_value2", callChangeParamOffset: 40 | 48 }> }> },
    doubleCalculationDispatch: { tableVma: number, dispatcherRole: string, operationRoles: string[], materialization: string },
    bucketGroups: Array<{ bucket: Db34Bucket, timingValues: number[], timingPairLiteralVma: number, timingPairLiteralHex: string, attackSummaryRole: string, attackIntegrationCallSites: Db34CallSite[], defenseIntegrationCallSites: Db34CallSite[] }>,
    accumulator: { role: string, coefTypes: Array<{ raw: 0 | 1, stat: Db34Stat, modifierGetterVtableOffset: number }>, calcOptionGetterVtableOffset: number, behavior: Record<string, string>, result: string, iterationOrder: string, rounding: string },
    abilityEfficacyInfoVtable: { symbol: string, vma: number, sizeBytes: number, slots: Array<{ offset: number, symbol: string }> },
    codeRegions: Db34CodeRegion[], conclusions: string[], unknowns: string[],
}
export interface Db34StatApplication {
    stateKey: string, ruleKey: string, passiveSkillId: string, efficacyType: 1 | 2 | 3,
    stat: Db34Stat, sourceColumn: "eff_value1" | "eff_value2", rawModifier: SqliteScalar, runtimeModifierFloat32: number,
    rawExecutionTimingType: SqliteScalar, calculationBucket: { status: "supported", value: Db34Bucket } | { status: "unknown", value: "unknown" },
    calculationOperation: Db31RuleProjection["operation"], operandUnit: { status: "supported", value: "stat_points" | "percent_points_of_current_stat" },
    executionTiming: Db33ExecutionTiming, semanticStatus: "partial",
    independentDimensions: { target: "unknown", duration: "unknown", recurrence: "unknown", expiry: "unknown", reset: "unknown", crossBucketOrder: "unknown" },
    provenance: {
        database: { table: "passive_skills", rowId: string, columns: ["efficacy_type", "exec_timing_type", "calc_option", "eff_value1" | "eff_value2"] },
        runtime: { fileName: "libcocos2dcpp.so", sha256: string, evidenceFile: "native-basic-stat-bucket-semantics.json", evidenceSha256: string, proofRoles: string[] },
    },
}
export interface Db34LegacyCandidateConflict { stateKey: string, databaseRuleKey: string, currentRuleKey: string, passiveSkillId: string, rawExecutionTimingType: SqliteScalar, firstPartyBucket: "latter_passive_stat", legacyBucket: "passive_start_of_turn", status: "candidate", boundary: "db13_unique_effect_set_alignment_is_diagnostic_not_identity_proof" }
export interface DatabaseTeamAnalysisDb34Dataset {
    schemaVersion: 1, contract: "dokkan-team-analysis-basic-stat-calculation-bucket-experiment", contractVersion: "0.33.0", generatedAt: string, sourceSnapshotVersion: string, sourceDatabaseSha256: string,
    sourceDb11: { fileName: "team-analysis-db11-experiment.json.gz", sha256: string, contractVersion: "0.10.0" },
    sourceDb13: { fileName: "team-analysis-db13-rule-alignment.json.gz", sha256: string, contractVersion: "0.12.1" },
    sourceDb31: { fileName: "team-analysis-db31-skill-calc-option.json.gz", sha256: string, contractVersion: "0.30.0" },
    sourceDb33: { fileName: "team-analysis-db33-player-attack-setup-timing.json.gz", sha256: string, contractVersion: "0.32.0" },
    currentTeamAnalysis: { fileName: "team-analysis.json.gz", sha256: string }, nativeRuntime: { fileName: "libcocos2dcpp.so", sha256: string, sizeBytes: number }, nativeEvidence: { fileName: "native-basic-stat-bucket-semantics.json", sha256: string },
    inheritedSemanticPromotionCount: 10, semanticPromotionCount: 5, sourcePopulation: { ruleCount: number, effectCount: number }, statApplications: Db34StatApplication[],
    legacyComparison: { alignedBasicStatRuleCount: number, crossTab: Record<string, number>, confirmedConflictCount: 0, candidateConflicts: Db34LegacyCandidateConflict[], boundary: "db13_alignment_only_no_legacy_bucket_equivalence" },
}
export interface DatabaseTeamAnalysisDb34Coverage {
    schemaVersion: 1, sourceRuleCount: number, sourceEffectCount: number, basicStatRuleCount: number, statApplicationCount: number, affectedPassiveSkillCount: number, affectedStateCount: number,
    supportedBucketRuleCount: number, supportedBucketApplicationCount: number, unknownBucketRuleCount: number, unknownBucketApplicationCount: number, ruleCountsByBucket: Record<string, number>, applicationCountsByBucket: Record<string, number>, applicationCountsByStatAndBucket: Record<string, number>, applicationCountsByOperation: Record<string, number>, applicationCountsByOperandUnit: Record<string, number>, rawTimingCounts: Record<string, number>,
    alignedBasicStatRuleCount: number, confirmedLegacyConflictCount: 0, candidateLegacyConflictCount: number, inheritedSemanticPromotionCount: 10, semanticPromotionCount: 5,
}
export interface DatabaseTeamAnalysisDb34ArtifactManifest {
    schemaVersion: 1, contractVersion: "0.33.0", generatedAt: string, fileName: "team-analysis-db34-basic-stat-buckets.json.gz", compression: "gzip", sha256: string, sizeBytes: number, uncompressedSizeBytes: number,
    basicStatRuleCount: number, statApplicationCount: number, affectedStateCount: number, inheritedSemanticPromotionCount: 10, semanticPromotionCount: 5,
    sourceDatabaseSha256: string, sourceDb11Sha256: string, sourceDb13Sha256: string, sourceDb31Sha256: string, sourceDb33Sha256: string, currentTeamAnalysisSha256: string, nativeRuntimeSha256: string, nativeEvidenceSha256: string,
    coverageFile: "team-analysis-db34-coverage.json", reportFile: "team-analysis-db34-report.md", validationFile: "team-analysis-db34-validation.json", goldenValidationFile: "team-analysis-db34-golden-validation.json",
}
