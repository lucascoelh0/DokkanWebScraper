import { SqliteScalar } from "./contract";
import { Db31RuleProjection } from "./team-analysis-db31-contract";
import { Db33ExecutionTiming, Db33RuleTiming } from "./team-analysis-db33-contract";
import { Db35TargetSemantic } from "./team-analysis-db35-contract";
import { Db36Filter } from "./team-analysis-db36-contract";
import { Db37DurationProjection, Db37OnceOnlyProjection } from "./team-analysis-db37-contract";

export interface Db45CodeRegion { role: string; symbol: string; vma: number; sizeBytes: number; codeSha256: string }
export interface Db45NativeEvidence {
    schemaVersion: 1; sourceSha256: string; auditScope: string; sqliteBinding: Record<string, unknown>; dispatch: Record<string, unknown>; handler: Record<string, unknown>; aggregate: Record<string, unknown>; playerDamageConsumer: Record<string, unknown>; timing5: Record<string, unknown>; vtable: Record<string, unknown>; branches: Array<Record<string, unknown>>; codeRegions: Db45CodeRegion[]; unknowns: string[];
}

export interface Db45RuleTiming extends Omit<Db33RuleTiming, "executionTiming" | "provenance"> {
    executionTiming: Db33ExecutionTiming | { status: "supported"; event: "player_attack_post_damage_setup"; sequence: "after_damage_calculation_enemy_after_hp_update_and_attack_recording_before_enemy_round_timing_5_and_setup_return" };
    provenance: { database: { table: "passive_skills"; rowId: string; column: "exec_timing_type" }; runtime?: { fileName: "libcocos2dcpp.so"; sha256: string; evidenceFile: string; evidenceSha256: string; proofRoles: string[] } };
}

export interface Db45AbsorbDamageProjection {
    stateKey: string; ruleKey: string; passiveSkillId: string; efficacyType: 28; sourceEffectCount: number;
    modifier: { status: "supported" | "unknown"; sourceColumn: "eff_value1"; rawPercentagePoints: SqliteScalar; runtimeFloat32PercentagePoints: number | null; unit: "percentage_points_of_displayed_player_attack_damage" | "unknown" };
    ignoredNumericParameters: { status: "not_read_by_handler_or_consumer"; rawEffValue2: SqliteScalar; rawEffValue3: SqliteScalar };
    calculationOperation: { status: "preserved_not_applied"; rawCalcOption: SqliteScalar; db31Operation: Db31RuleProjection["operation"]; boundary: "handler_aggregate_and_damage_consumer_do_not_read_calc_option" };
    executionTiming: Db45RuleTiming["executionTiming"];
    rawProbability: SqliteScalar;
    target: { status: "supported"; candidate: Db35TargetSemantic; aggregateFilter: "matching_deck_index_and_skill_category"; subTarget: { status: "supported"; rawSetId: SqliteScalar; composition: "and"; emptySetBehavior: "identity"; filters: Db36Filter[] } };
    calculationBucket: { status: "supported"; value: "action_bank_player_damage_to_hp_factor" };
    stacking: { status: "supported"; value: "float32_add_in_stored_record_order_for_matching_deck_and_category" };
    arithmetic: { status: "supported"; sourceDamage: "displayed_and_mission_counted_player_attack_damage"; formula: "truncate_toward_zero((float64(float32_sum) / 100.0) * signed_int32_damage)"; controllerArgument: "negated_truncated_result"; hpFactorRawType: 2; hpFactorValue: "truncated_result"; finalHpApplication: "unknown" };
    registrationGate: { status: "partial"; callChangeParamOffset: 4; requiredValue: 0; semanticName: "unknown" };
    lifecycle: { duration: Db37DurationProjection; onceOnly: Db37OnceOnlyProjection; recurrence: "partial"; resetAndExpiry: "unknown" };
    simulationStatus: "partial" | "unknown";
    legacyComparison: { currentKind: string | null; status: "representation_gain_legacy_unknown" | "not_comparable"; confirmedConflict: false };
    independentDimensions: { condition: "independent"; operation: "preserved_not_applied"; target: "inherited_db35_db36_and_runtime_filter"; timing: "independent"; bucket: "supported_consumer_path"; duration: "inherited_db37"; recurrence: "partial"; expiry: "unknown"; probability: "raw_unknown_order" };
    provenance: { database: { table: "passive_skills"; rowId: string; columns: string[] }; runtime: { fileName: "libcocos2dcpp.so"; sha256: string; evidenceFile: "native-player-attack-post-damage-hp-factor-semantics.json"; evidenceSha256: string; proofRoles: string[] }; inherited: Record<string, string> };
}

export interface DatabaseTeamAnalysisDb45Dataset {
    schemaVersion: 1; contract: "dokkan-team-analysis-player-attack-post-damage-and-hp-factor-native-semantics-experiment"; contractVersion: "0.44.0"; generatedAt: string; sourceSnapshotVersion: string; sourceDatabaseSha256: string;
    sources: Record<string, { fileName: string; sha256: string; contractVersion: string }>;
    nativeRuntime: { fileName: "libcocos2dcpp.so"; sha256: string; sizeBytes: number }; nativeEvidence: { fileName: "native-player-attack-post-damage-hp-factor-semantics.json"; sha256: string };
    inheritedSemanticPromotionCount: 53; semanticPromotionCount: 5; timingRuleProjections: Db45RuleTiming[]; absorbDamageProjections: Db45AbsorbDamageProjection[];
}

export interface DatabaseTeamAnalysisDb45Coverage {
    schemaVersion: 1; timingRuleCount: number; timingEffectCount: number; supportedTimingRuleCountBefore: number; supportedTimingRuleCountAfter: number; newlySupportedTimingRuleCount: number; newlySupportedTimingEffectCount: number; newlySupportedTimingPassiveSkillCount: number; newlySupportedTimingStateCount: number; unknownTimingRuleCount: number; rawTimingCounts: Record<string, number>;
    absorbRuleCount: number; absorbEffectCount: number; absorbStateCount: number; absorbPassiveSkillCount: number; supportedModifierCount: number; supportedTimingCount: number; unknownTimingCount: number; supportedTargetCount: number; emptySubTargetIdentityCount: number; supportedBucketCount: number; supportedStackingCount: number; preservedNotAppliedOperationCount: number; positiveCorpusModifierCount: number; zeroIgnoredNumericParameterCount: number; partialSimulationCount: number; unknownSimulationCount: number; legacyRepresentationGainCount: number; confirmedLegacyConflictCount: 0; absorbCountsByTiming: Record<string, number>; absorbCountsByCalcOption: Record<string, number>; absorbCountsByProbability: Record<string, number>; absorbCountsByModifier: Record<string, number>; inheritedSemanticPromotionCount: 53; semanticPromotionCount: 5;
}

export interface DatabaseTeamAnalysisDb45ArtifactManifest {
    schemaVersion: 1; contractVersion: "0.44.0"; generatedAt: string; fileName: "team-analysis-db45-player-attack-post-damage-hp-factor.json.gz"; compression: "gzip"; sha256: string; sizeBytes: number; uncompressedSizeBytes: number; timingRuleCount: number; newlySupportedTimingRuleCount: number; absorbRuleCount: number; absorbStateCount: number; inheritedSemanticPromotionCount: 53; semanticPromotionCount: 5; sourceDatabaseSha256: string; sourceArtifactSha256: Record<"db8" | "db9" | "db11" | "db31" | "db33" | "db35" | "db36" | "db37", string>; nativeRuntimeSha256: string; nativeEvidenceSha256: string; coverageFile: "team-analysis-db45-coverage.json"; reportFile: "team-analysis-db45-report.md"; validationFile: "team-analysis-db45-validation.json"; goldenValidationFile: "team-analysis-db45-golden-validation.json";
}
