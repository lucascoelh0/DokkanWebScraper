import { SqliteScalar } from "./contract";
import { Db35TargetSemantic } from "./team-analysis-db35-contract";
import { Db36Filter } from "./team-analysis-db36-contract";
import { Db37DurationProjection, Db37OnceOnlyProjection } from "./team-analysis-db37-contract";
import { Db47RuleTiming } from "./team-analysis-db47-contract";

export interface Db48CodeRegion { role: string; symbol: string; vma: number; sizeBytes: number; codeSha256: string }
export interface Db48Relocation { offset: number; type: number; symbol: string; symbolValue: number; addend: number }
export interface Db48NativeEvidence {
    schemaVersion: 1; sourceSha256: string; auditScope: string; sqliteBinding: Record<string, unknown>;
    dispatch: Record<string, unknown>; handlerBehavior: Record<string, unknown>; storageAndGetter: Record<string, unknown>;
    aggregateBehavior: Record<string, unknown>; consumerBehavior: Record<string, unknown>;
    directCalls: Array<{ role: string; callVma: number; callHex: string; branchKind: "b" | "bl"; pltVma: number; pltHex: string; relocation: Db48Relocation }>;
    efficacyInfoVtable: { symbol: string; vma: number; sizeBytes: number; rawSha256: string; slots: Array<{ role: string; vptrSlotOffset: number; relocation: Db48Relocation }> };
    codeRegions: Db48CodeRegion[]; unknowns: string[];
}

export interface Db48DamageRateInput {
    status: "supported" | "unknown"; sourceColumn: "eff_value1"; rawRemainingDamageRatePercentPoints: SqliteScalar;
    runtimeRemainingDamageRateFloat32: number | null; reductionContributionPercentPoints: number | null;
    conversion: "double_to_float32_then_widened_to_double" | "unknown";
}

export interface Db48RuleProjection {
    stateKey: string; ruleKey: string; passiveSkillId: string; efficacyType: 13; sourceEffectCount: number;
    damageRateInput: Db48DamageRateInput;
    ignoredHandlerParameters: { status: "preserved_not_read_by_type_13_handler"; rawEffValue2: SqliteScalar; rawEffValue3: SqliteScalar; rawCalculationOption: SqliteScalar };
    rawProbability: SqliteScalar; rawExecutionTimingType: SqliteScalar;
    aggregate: { status: "supported"; initialRemainingRatePercentPoints: 100; contributionFormula: "100_minus_each_stored_remaining_rate"; combination: "subtract_each_contribution_from_100_in_efficacy_info_order"; clamp: [0, 100]; filterKeys: ["deck_index", "skill_category_type"] };
    target: { status: "supported"; candidate: Db35TargetSemantic; subTarget: { status: "supported"; rawSetId: SqliteScalar; composition: "and"; emptySetBehavior: "identity"; filters: Db36Filter[] } };
    executionTiming: Db47RuleTiming["executionTiming"];
    lifecycle: { duration: Db37DurationProjection; onceOnly: Db37OnceOnlyProjection; probabilityApplication: "unknown"; recurrence: "partial"; resetAndExpiry: "unknown" };
    consumers: {
        playerSource: { status: "supported"; bucket: "player_source_intermediary_damage_after_defense_and_optional_guard"; formula: "trunc_toward_zero(pre_minus_((100_minus_rate)_times_pre_div_100))"; laterModifiersRemain: true };
        enemySource: { status: "supported"; bucket: "enemy_source_intermediary_damage_before_counter_resist_defense_and_guard"; formula: "pre_minus_trunc_toward_zero(((100_minus_rate)_times_pre_div_100))"; laterModifiersRemain: true };
        attackKind: { status: "unknown"; value: "unknown" }; finalHpApplication: { status: "unknown"; value: "unknown" };
    };
    simulationStatus: "partial" | "unknown";
    legacyProjectorComparison: { kind: string | null; value: number | null; unit: string | null; status: "representation_matches_native_projection" | "representation_conflict" | "not_comparable"; authoritative: false };
    independentDimensions: { condition: "independent"; operation: "native_damage_rate_fold_not_skill_calc_option"; target: "inherited_db35_db36"; timing: "inherited_db47_independent"; duration: "inherited_db37_independent"; probability: "unknown"; recurrence: "partial"; reset: "unknown"; stacking: "aggregate_order_proved_lifecycle_unknown" };
    provenance: {
        database: { table: "passive_skills"; rowId: string; columns: ["efficacy_type", "eff_value1", "eff_value2", "eff_value3", "calc_option", "probability", "exec_timing_type", "target_type", "sub_target_type_set_id", "turn", "is_once"] };
        runtime: { fileName: "libcocos2dcpp.so"; sha256: string; evidenceFile: "native-damage-mitigation-semantics.json"; evidenceSha256: string; proofRoles: string[] };
        inherited: { db11Sha256: string; db35Sha256: string; db36Sha256: string; db37Sha256: string; db47Sha256: string };
    };
}

export interface DatabaseTeamAnalysisDb48Dataset {
    schemaVersion: 1; contract: "dokkan-team-analysis-damage-mitigation-native-semantics-experiment"; contractVersion: "0.47.0"; generatedAt: string; sourceSnapshotVersion: string; sourceDatabaseSha256: string;
    sourceDb11: { fileName: "team-analysis-db11-experiment.json.gz"; sha256: string; contractVersion: "0.10.0" };
    sourceDb35: { fileName: "team-analysis-db35-target-dispatch.json.gz"; sha256: string; contractVersion: "0.34.0" };
    sourceDb36: { fileName: "team-analysis-db36-sub-target-semantics.json.gz"; sha256: string; contractVersion: "0.35.0" };
    sourceDb37: { fileName: "team-analysis-db37-passive-lifecycle.json.gz"; sha256: string; contractVersion: "0.36.0" };
    sourceDb47: { fileName: "team-analysis-db47-puzzle-move-end-timing.json.gz"; sha256: string; contractVersion: "0.46.0" };
    nativeRuntime: { fileName: "libcocos2dcpp.so"; sha256: string; sizeBytes: number }; nativeEvidence: { fileName: "native-damage-mitigation-semantics.json"; sha256: string };
    inheritedSemanticPromotionCount: 61; semanticPromotionCount: 8; sqliteEfficacyType13RowCount: number; ruleProjections: Db48RuleProjection[];
}

export interface DatabaseTeamAnalysisDb48Coverage {
    schemaVersion: 1; sqliteRowCount: number; projectedUniqueSqliteRowCount: number; unprojectedSqliteRowCount: number; ruleCount: number; sourceEffectCount: number; passiveSkillCount: number; affectedStateCount: number;
    supportedInputRuleCount: number; supportedTargetRuleCount: number; supportedTimingRuleCount: number; unknownTimingRuleCount: number; onceOnlyEnabledRuleCount: number;
    legacyRepresentationMatchCount: number; legacyRepresentationConflictCount: number; simulationPartialRuleCount: number; simulationUnknownRuleCount: number;
    ruleCountsByTiming: Record<string, number>; ruleCountsByTarget: Record<string, number>; ruleCountsByCalculationOption: Record<string, number>; inheritedSemanticPromotionCount: 61; semanticPromotionCount: 8;
}

export interface DatabaseTeamAnalysisDb48Manifest { schemaVersion: 1; contractVersion: "0.47.0"; generatedAt: string; fileName: "team-analysis-db48-damage-mitigation.json.gz"; compression: "gzip"; sha256: string; sizeBytes: number; uncompressedSizeBytes: number; ruleCount: number; sqliteRowCount: number; affectedStateCount: number; inheritedSemanticPromotionCount: 61; semanticPromotionCount: 8; sourceDatabaseSha256: string; sourceDb47Sha256: string; nativeRuntimeSha256: string; nativeEvidenceSha256: string; coverageFile: "team-analysis-db48-coverage.json"; reportFile: "team-analysis-db48-report.md"; validationFile: "team-analysis-db48-validation.json"; goldenValidationFile: "team-analysis-db48-golden-validation.json" }
