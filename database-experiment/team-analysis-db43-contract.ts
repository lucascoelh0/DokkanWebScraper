import { SqliteScalar } from "./contract";
import { Db3Status } from "./team-analysis-db3-contract";
import { Db31Operation } from "./team-analysis-db31-contract";
import { Db33ExecutionTiming } from "./team-analysis-db33-contract";
import { Db35TargetSemantic } from "./team-analysis-db35-contract";
import { Db37DurationProjection, Db37OnceOnlyProjection } from "./team-analysis-db37-contract";

export interface Db43CodeRegion { role: string; symbol: string; vma: number; sizeBytes: number; codeSha256: string }
export interface Db43NativeEvidence {
    schemaVersion: 1; sourceSha256: string; efficacyType: 24; auditScope: string;
    dispatch: Record<string, unknown>; sqliteBinding: Record<string, unknown>; handlerOperation: Record<string, unknown>; guardDecision: Record<string, unknown>;
    consumerCallSites: Array<Record<string, unknown>>; codeRegions: Db43CodeRegion[]; unknowns: string[];
}
export interface Db43Resolution {
    stateKey: string; ruleKey: string; passiveSkillId: string; efficacyType: 24; semanticStatus: "partial";
    effect: {
        status: "supported"; kind: "disable_normal_element_affinity_guard"; unit: "boolean_presence";
        nativeFormula: string; nativeInputs: ["attacker_element_type", "defender_element_type", "defender_has_efficacy_24", "independent_raw_attacker_override", "defender_has_efficacy_78", "independent_player_mode_override"]; normalAffinityGuardWhenPresent: "disabled_unless_independent_efficacy_78_override";
        behavioralParameters: { status: "not_read_by_guard_decision"; rawEffValue1: SqliteScalar; rawEffValue2: SqliteScalar; rawEffValue3: SqliteScalar };
        rawCalculationOption: SqliteScalar; declaredCalculationOperation: Db31Operation; calculationOperationApplication: "not_applied_by_no_value_handler_or_guard_presence_consumer";
    };
    target: { status: "supported"; rawTargetType: SqliteScalar; candidate: Db35TargetSemantic; subTarget: { status: "supported"; rawSetId: SqliteScalar; composition: "and"; emptySetBehavior: "identity"; filters: [] } };
    executionTiming: { raw: SqliteScalar; value: Db33ExecutionTiming };
    lifecycle: { duration: Db37DurationProjection; onceOnly: Db37OnceOnlyProjection; recurrence: "partial"; resetAndExpiry: "unknown" };
    calculation: { consumerPhase: "guard_resolution_before_element_coefficient"; calculationBucket: "unknown"; stackingInGuardDecision: "boolean_presence"; crossStatusStacking: "unknown"; finalDamageFormula: "unknown" };
    conditionStatus: Db3Status;
    raw: { execGameType: SqliteScalar; probability: SqliteScalar; causalityConditions: SqliteScalar };
    legacyComparison: { currentState: "present" | "missing"; directRuleIdentity: "absent"; comparableGuardEffect: "none"; classification: "representation_gain_or_snapshot_difference_not_semantic_conflict" };
    provenance: {
        database: { table: "passive_skills"; rowId: string; columns: string[] };
        runtime: { fileName: "libcocos2dcpp.so"; sha256: string; evidenceFile: "native-guard-disable-semantics.json"; evidenceSha256: string; codeRegions: Db43CodeRegion[] };
        inherited: { db8Sha256: string; db9Sha256: string; db11Sha256: string; db33Sha256: string; db35Sha256: string; db36Sha256: string; db37Sha256: string; currentTeamAnalysisSha256: string };
    };
}
export interface DatabaseTeamAnalysisDb43Dataset {
    schemaVersion: 1; contract: "dokkan-team-analysis-guard-disable-native-semantics-experiment"; contractVersion: "0.42.0"; generatedAt: string; sourceSnapshotVersion: string; sourceDatabaseSha256: string;
    sourceDb8: { fileName: "team-analysis-db8-evidence-experiment.json.gz"; sha256: string; contractVersion: "0.7.0" };
    sourceDb9: { fileName: "team-analysis-db9-runtime-evidence.json.gz"; sha256: string; contractVersion: "0.8.0" };
    sourceDb11: { fileName: "team-analysis-db11-experiment.json.gz"; sha256: string; contractVersion: "0.10.0" };
    sourceDb33: { fileName: "team-analysis-db33-player-attack-setup-timing.json.gz"; sha256: string; contractVersion: "0.32.0" };
    sourceDb35: { fileName: "team-analysis-db35-target-dispatch.json.gz"; sha256: string; contractVersion: "0.34.0" };
    sourceDb36: { fileName: "team-analysis-db36-sub-target-semantics.json.gz"; sha256: string; contractVersion: "0.35.0" };
    sourceDb37: { fileName: "team-analysis-db37-passive-lifecycle.json.gz"; sha256: string; contractVersion: "0.36.0" };
    currentTeamAnalysis: { fileName: "team-analysis.json.gz"; sha256: string };
    nativeRuntime: { fileName: "libcocos2dcpp.so"; sha256: string; sizeBytes: number };
    nativeEvidence: { fileName: "native-guard-disable-semantics.json"; sha256: string };
    inheritedSemanticPromotionCount: 50; semanticPromotionCount: 1; resolutions: Db43Resolution[];
}
export interface DatabaseTeamAnalysisDb43Coverage {
    schemaVersion: 1; sourceGapRuleCount: 34; resolutionCount: number; affectedStateCount: number; affectedPassiveSkillCount: number; supportedEffectCount: number; partialResolutionCount: number;
    zeroBehavioralValueRuleCount: number; supportedTargetCount: number; emptySubTargetIdentityCount: number; supportedTimingCount: number; unknownTimingCount: number;
    calculationOptionCounts: Record<string, number>; turnCounts: Record<string, number>; onceOnlyCounts: Record<string, number>;
    currentStatePresentCount: number; currentStateMissingCount: number; directlyComparableRuleCount: 0; confirmedLegacyConflictCount: 0; representationGainRuleCount: number;
    inheritedSemanticPromotionCount: 50; semanticPromotionCount: 1;
}
export interface DatabaseTeamAnalysisDb43ArtifactManifest {
    schemaVersion: 1; contractVersion: "0.42.0"; generatedAt: string; fileName: "team-analysis-db43-guard-disable.json.gz"; compression: "gzip"; sha256: string; sizeBytes: number; uncompressedSizeBytes: number;
    resolutionCount: number; affectedStateCount: number; inheritedSemanticPromotionCount: 50; semanticPromotionCount: 1; sourceDatabaseSha256: string;
    sourceDb8Sha256: string; sourceDb9Sha256: string; sourceDb11Sha256: string; sourceDb33Sha256: string; sourceDb35Sha256: string; sourceDb36Sha256: string; sourceDb37Sha256: string; currentTeamAnalysisSha256: string; nativeRuntimeSha256: string; nativeEvidenceSha256: string;
    coverageFile: "team-analysis-db43-coverage.json"; reportFile: "team-analysis-db43-report.md"; validationFile: "team-analysis-db43-validation.json"; goldenValidationFile: "team-analysis-db43-golden-validation.json";
}
