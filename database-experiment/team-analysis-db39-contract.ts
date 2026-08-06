import { SqliteScalar } from "./contract";
import { Db31RuleProjection } from "./team-analysis-db31-contract";

export type Db39Stat = "attack" | "defense";
export type Db39Bucket = "former_passive_stat" | "latter_passive_stat" | "unknown";

export interface Db39StatModifier {
    status: "supported" | "unknown";
    stat: Db39Stat;
    sourceColumn: "eff_value1" | "eff_value2";
    rawModifierPerCount: SqliteScalar;
    runtimeModifierFloat32: number | null;
    scaledModifierFormula: "float32_modifier_widened_to_double_times_signed_int32_obtained_count" | "unknown";
}

export interface Db39RuleProjection {
    stateKey: string;
    ruleKey: string;
    passiveSkillId: string;
    sourceEffectCount: number;
    rawExecutionTimingType: SqliteScalar;
    rawCalculationOption: SqliteScalar;
    rawTargetType: SqliteScalar;
    attack: Db39StatModifier;
    defense: Db39StatModifier;
    countInput: {
        status: "partial";
        source: "InGameCharaData.getObtainedBallTypeNumbers";
        rawBallType: 11;
        rawBitpattern: 0;
        absentMapEntryValue: 0;
        semanticName: "unknown";
    };
    calculationBucket: { status: "supported", value: Exclude<Db39Bucket, "unknown"> } | { status: "unknown", value: "unknown" };
    calculationOperation: Db31RuleProjection["operation"];
    operandUnit: { status: "partial", value: "stat_points_per_raw_ball_type_11_count" | "percent_points_of_current_stat_per_raw_ball_type_11_count" | "unknown", boundary: "raw_ball_type_11_semantic_name_unknown" };
    simulationStatus: "partial" | "unknown";
    legacyComparison: { currentKind: string | null, status: "representation_gain_legacy_unknown" | "not_comparable", confirmedConflict: false };
    independentDimensions: { condition: "independent", target: "inherited_db36", timing: "independent", calculationOperation: "inherited_db31", calculationBucket: "inherited_db34", duration: "inherited_db37", onceOnly: "inherited_db37", recurrence: "partial", reset: "unknown" };
    provenance: {
        database: { table: "passive_skills", rowId: string, columns: ["efficacy_type", "eff_value1", "eff_value2", "eff_value3", "calc_option", "exec_timing_type", "target_type"] };
        runtime: { fileName: "libcocos2dcpp.so", sha256: string, evidenceFile: "native-energy-ball-proportional-stat-semantics.json", evidenceSha256: string, proofRoles: string[] };
        inherited: { db31RuleKey: string, db31Sha256: string, db34Sha256: string, db37RuleKey: string, db37Sha256: string };
        legacy?: { db11RuleKey: string, db11Sha256: string };
    };
}

export interface Db39NativeEvidence {
    schemaVersion: 1;
    sourceSha256: string;
    efficacyType: 61;
    auditScope: string;
    sqliteBinding: Record<string, unknown>;
    dispatch: Record<string, unknown>;
    emittedFields: Record<string, unknown>;
    proportionalFlag: Record<string, unknown>;
    countConsumer: Record<string, unknown>;
    inheritedBuckets: Record<string, unknown>;
    codeRegions: Array<{ role: string, symbol: string, vma: number, sizeBytes: number, codeSha256: string }>;
    vtableRelocations: Array<{ vtableSymbol: string, vtableVma: number, relocationOffset: number, symbol: string }>;
    unknowns: string[];
}

export interface DatabaseTeamAnalysisDb39Dataset {
    schemaVersion: 1;
    contract: "dokkan-team-analysis-energy-ball-proportional-stat-native-semantics-experiment";
    contractVersion: "0.38.0";
    generatedAt: string;
    sourceSnapshotVersion: string;
    sourceDatabaseSha256: string;
    sourceDb11: { fileName: "team-analysis-db11-experiment.json.gz", sha256: string, contractVersion: "0.10.0" };
    sourceDb31: { fileName: "team-analysis-db31-skill-calc-option.json.gz", sha256: string, contractVersion: "0.30.0" };
    sourceDb34: { fileName: "team-analysis-db34-basic-stat-buckets.json.gz", sha256: string, contractVersion: "0.33.0" };
    sourceDb37: { fileName: "team-analysis-db37-passive-lifecycle.json.gz", sha256: string, contractVersion: "0.36.0" };
    nativeRuntime: { fileName: "libcocos2dcpp.so", sha256: string, sizeBytes: number };
    nativeEvidence: { fileName: "native-energy-ball-proportional-stat-semantics.json", sha256: string };
    inheritedSemanticPromotionCount: 39;
    semanticPromotionCount: 6;
    ruleProjections: Db39RuleProjection[];
}

export interface DatabaseTeamAnalysisDb39Coverage {
    schemaVersion: 1;
    ruleCount: number;
    sourceEffectCount: number;
    statApplicationCount: number;
    affectedStateCount: number;
    passiveSkillCount: number;
    supportedModifierRuleCount: number;
    supportedBucketRuleCount: number;
    countSemanticPartialRuleCount: number;
    simulationPartialRuleCount: number;
    simulationUnknownRuleCount: number;
    legacyRepresentationGainRuleCount: number;
    confirmedLegacyConflictCount: 0;
    ruleCountsByTiming: Record<string, number>;
    ruleCountsByCalculationOption: Record<string, number>;
    ruleCountsByTarget: Record<string, number>;
    statApplicationsByStatAndBucket: Record<string, number>;
    inheritedSemanticPromotionCount: 39;
    semanticPromotionCount: 6;
}

export interface DatabaseTeamAnalysisDb39ArtifactManifest {
    schemaVersion: 1;
    contractVersion: "0.38.0";
    generatedAt: string;
    fileName: "team-analysis-db39-energy-ball-proportional-stats.json.gz";
    compression: "gzip";
    sha256: string;
    sizeBytes: number;
    uncompressedSizeBytes: number;
    ruleCount: number;
    statApplicationCount: number;
    affectedStateCount: number;
    inheritedSemanticPromotionCount: 39;
    semanticPromotionCount: 6;
    sourceDatabaseSha256: string;
    sourceDb11Sha256: string;
    sourceDb31Sha256: string;
    sourceDb34Sha256: string;
    sourceDb37Sha256: string;
    nativeRuntimeSha256: string;
    nativeEvidenceSha256: string;
    coverageFile: "team-analysis-db39-coverage.json";
    reportFile: "team-analysis-db39-report.md";
    validationFile: "team-analysis-db39-validation.json";
    goldenValidationFile: "team-analysis-db39-golden-validation.json";
}
