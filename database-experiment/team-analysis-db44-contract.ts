import { SqliteScalar } from "./contract";
import { Db31RuleProjection } from "./team-analysis-db31-contract";
import { Db35TargetSemantic } from "./team-analysis-db35-contract";
import { Db36Filter } from "./team-analysis-db36-contract";
import { Db37DurationProjection, Db37OnceOnlyProjection } from "./team-analysis-db37-contract";
import { Db39Bucket } from "./team-analysis-db39-contract";

export type Db44EfficacyType = 59 | 60;
export type Db44Stat = "attack" | "defense";

export interface Db44CodeRegion { role: string; symbol: string; vma: number; sizeBytes: number; codeSha256: string }
export interface Db44NativeEvidence {
    schemaVersion: 1;
    sourceSha256: string;
    efficacyTypes: [59, 60];
    auditScope: string;
    sqliteBinding: Record<string, unknown>;
    dispatch: Record<string, unknown>;
    handlerBehavior: Record<string, unknown>;
    pureHandlerBehavior: Record<string, unknown>;
    sharedConsumerEvidence: Record<string, unknown>;
    branchSites: Array<Record<string, unknown>>;
    codeRegions: Db44CodeRegion[];
    unknowns: string[];
}

export interface Db44StatModifier {
    status: "supported" | "unknown";
    stat: Db44Stat | "unknown";
    sourceColumn: "eff_value1";
    rawModifierPerCount: SqliteScalar;
    runtimeModifierFloat32: number | null;
    scaledModifierFormula: "float32_modifier_widened_to_double_times_signed_int32_obtained_count" | "unknown";
}

export interface Db44RuleProjection {
    stateKey: string;
    ruleKey: string;
    passiveSkillId: string;
    efficacyType: Db44EfficacyType;
    sourceEffectCount: number;
    statModifier: Db44StatModifier;
    ignoredBehavioralParameters: { status: "not_read_by_handler"; rawEffValue2: SqliteScalar; rawEffValue3: SqliteScalar };
    countInput: { status: "partial"; source: "InGameCharaData.getObtainedBallTypeNumbers"; rawBallType: 11; rawBitpattern: 0; absentMapEntryValue: 0; semanticName: "unknown" };
    rawExecutionTimingType: SqliteScalar;
    rawCalculationOption: SqliteScalar;
    rawTargetType: SqliteScalar;
    calculationBucket: { status: "supported"; value: Exclude<Db39Bucket, "unknown"> } | { status: "unknown"; value: "unknown" };
    calculationOperation: Db31RuleProjection["operation"];
    operandUnit: { status: "partial"; value: "stat_points_per_raw_ball_type_11_count" | "percent_points_of_current_stat_per_raw_ball_type_11_count" | "unknown"; boundary: "raw_ball_type_11_semantic_name_unknown" };
    target: { status: "supported"; candidate: Db35TargetSemantic; subTarget: { status: "supported"; rawSetId: SqliteScalar; composition: "and"; emptySetBehavior: "identity"; filters: Db36Filter[] } };
    lifecycle: { duration: Db37DurationProjection; onceOnly: Db37OnceOnlyProjection; recurrence: "partial"; resetAndExpiry: "unknown" };
    simulationStatus: "partial" | "unknown";
    legacyComparison: { currentKind: string | null; status: "representation_gain_legacy_unknown" | "not_comparable"; confirmedConflict: false };
    independentDimensions: { condition: "independent"; target: "inherited_db35_db36"; timing: "independent"; calculationOperation: "inherited_db31"; calculationBucket: "inherited_db34"; duration: "inherited_db37"; onceOnly: "inherited_db37"; recurrence: "partial"; reset: "unknown"; stacking: "unknown" };
    provenance: {
        database: { table: "passive_skills"; rowId: string; columns: ["efficacy_type", "eff_value1", "eff_value2", "eff_value3", "calc_option", "exec_timing_type", "target_type", "sub_target_type_set_id", "turn", "is_once"] };
        runtime: { fileName: "libcocos2dcpp.so"; sha256: string; evidenceFile: "native-single-stat-energy-ball-proportional-semantics.json"; evidenceSha256: string; proofRoles: string[] };
        inherited: { db8Sha256: string; db9Sha256: string; db11Sha256: string; db31Sha256: string; db34Sha256: string; db35Sha256: string; db36Sha256: string; db37Sha256: string; db39Sha256: string; db39NativeEvidenceSha256: string };
    };
}

export interface DatabaseTeamAnalysisDb44Dataset {
    schemaVersion: 1;
    contract: "dokkan-team-analysis-single-stat-energy-ball-proportional-native-semantics-experiment";
    contractVersion: "0.43.0";
    generatedAt: string;
    sourceSnapshotVersion: string;
    sourceDatabaseSha256: string;
    sourceDb8: { fileName: "team-analysis-db8-evidence-experiment.json.gz"; sha256: string; contractVersion: "0.7.0" };
    sourceDb9: { fileName: "team-analysis-db9-runtime-evidence.json.gz"; sha256: string; contractVersion: "0.8.0" };
    sourceDb11: { fileName: "team-analysis-db11-experiment.json.gz"; sha256: string; contractVersion: "0.10.0" };
    sourceDb31: { fileName: "team-analysis-db31-skill-calc-option.json.gz"; sha256: string; contractVersion: "0.30.0" };
    sourceDb34: { fileName: "team-analysis-db34-basic-stat-buckets.json.gz"; sha256: string; contractVersion: "0.33.0" };
    sourceDb35: { fileName: "team-analysis-db35-target-dispatch.json.gz"; sha256: string; contractVersion: "0.34.0" };
    sourceDb36: { fileName: "team-analysis-db36-sub-target-semantics.json.gz"; sha256: string; contractVersion: "0.35.0" };
    sourceDb37: { fileName: "team-analysis-db37-passive-lifecycle.json.gz"; sha256: string; contractVersion: "0.36.0" };
    sourceDb39: { fileName: "team-analysis-db39-energy-ball-proportional-stats.json.gz"; sha256: string; contractVersion: "0.38.0"; nativeEvidenceSha256: string };
    nativeRuntime: { fileName: "libcocos2dcpp.so"; sha256: string; sizeBytes: number };
    nativeEvidence: { fileName: "native-single-stat-energy-ball-proportional-semantics.json"; sha256: string };
    inheritedSemanticPromotionCount: 51;
    semanticPromotionCount: 2;
    ruleProjections: Db44RuleProjection[];
}

export interface DatabaseTeamAnalysisDb44Coverage {
    schemaVersion: 1;
    ruleCount: number;
    sourceEffectCount: number;
    statApplicationCount: number;
    affectedStateCount: number;
    passiveSkillCount: number;
    supportedModifierRuleCount: number;
    supportedBucketRuleCount: number;
    supportedTargetRuleCount: number;
    emptySubTargetIdentityRuleCount: number;
    zeroIgnoredBehavioralParameterRuleCount: number;
    countSemanticPartialRuleCount: number;
    simulationPartialRuleCount: number;
    simulationUnknownRuleCount: number;
    legacyRepresentationGainRuleCount: number;
    confirmedLegacyConflictCount: 0;
    ruleCountsByEfficacyType: Record<string, number>;
    ruleCountsByStat: Record<string, number>;
    ruleCountsByTiming: Record<string, number>;
    ruleCountsByCalculationOption: Record<string, number>;
    ruleCountsByTurn: Record<string, number>;
    ruleCountsByOnceOnly: Record<string, number>;
    statApplicationsByStatAndBucket: Record<string, number>;
    inheritedSemanticPromotionCount: 51;
    semanticPromotionCount: 2;
}

export interface DatabaseTeamAnalysisDb44ArtifactManifest {
    schemaVersion: 1; contractVersion: "0.43.0"; generatedAt: string; fileName: "team-analysis-db44-single-stat-energy-ball-proportional.json.gz"; compression: "gzip"; sha256: string; sizeBytes: number; uncompressedSizeBytes: number;
    ruleCount: number; statApplicationCount: number; affectedStateCount: number; inheritedSemanticPromotionCount: 51; semanticPromotionCount: 2; sourceDatabaseSha256: string;
    sourceDb8Sha256: string; sourceDb9Sha256: string; sourceDb11Sha256: string; sourceDb31Sha256: string; sourceDb34Sha256: string; sourceDb35Sha256: string; sourceDb36Sha256: string; sourceDb37Sha256: string; sourceDb39Sha256: string; nativeRuntimeSha256: string; nativeEvidenceSha256: string;
    coverageFile: "team-analysis-db44-coverage.json"; reportFile: "team-analysis-db44-report.md"; validationFile: "team-analysis-db44-validation.json"; goldenValidationFile: "team-analysis-db44-golden-validation.json";
}
