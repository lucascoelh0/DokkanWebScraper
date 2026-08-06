import { SqliteScalar } from "./contract";

export type Db38OutputField = "modifier_attack" | "modifier_defense" | "critical_probability" | "dodge_probability" | "resist_damage_rate" | "modifier_battle_gauge" | "unknown";

export interface Db38IncrementalProjection {
    status: "supported" | "unknown";
    rawIncrement: SqliteScalar;
    rawCap: SqliteScalar;
    rawOutputSelector: SqliteScalar;
    truncatedIncrement: number | null;
    truncatedCap: number | null;
    outputField: Db38OutputField;
    emittedValue: "aggregate" | "positive_aggregate_to_max_100_minus_aggregate_0_negative_aggregate_to_negated" | "unknown";
    accumulation: { status: "supported" | "unknown", initial: "zero" | "unknown", currentIncrementContribution: "appended_before_fold_when_local_gate_bit0_is_clear" | "unknown", historyIterationOrder: "vector_begin_to_end_stored_order" | "unknown", storedEntryStrideBytes: 40 | null, storedIncrementOffsetBytes: 0 | null, storedHistoryFold: "stored_positive_min_sum_cap_else_max_sum_cap" | "unknown", arithmetic: "signed_int32_add_wrap_modulo_2_32" | "unknown", replacement: "remove_matching_info_then_emit_aggregate" | "unknown" };
    recurrence: { status: "partial", historyAppendPath: "native_local_helper", appendCondition: "local_gate_bit0_clear", appendTriggerSemantics: "unknown", reset: "unknown" };
}

export interface Db38RuleProjection {
    stateKey: string;
    ruleKey: string;
    passiveSkillId: string;
    effectCount: number;
    simulationStatus: "partial" | "unknown";
    rawCalculationOption: SqliteScalar;
    rawExecutionTimingType: SqliteScalar;
    incremental: Db38IncrementalProjection;
    legacyComparison: { currentKind: string | null, status: "confirmed_conflict" | "representation_match_not_authority" | "not_comparable", note: string };
    independentDimensions: { condition: "independent", target: "inherited_db36", timing: "independent", calculationOperation: "independent", unit: "output_field_dependent", calculationBucket: "partial", duration: "inherited_db37", onceOnly: "inherited_db37", recurrence: "partial", reset: "unknown" };
    provenance: { database: { table: "passive_skills", rowId: string, columns: ["efficacy_type", "eff_value1", "eff_value2", "eff_value3", "calc_option", "exec_timing_type"] }, runtime: { fileName: "libcocos2dcpp.so", sha256: string, evidenceFile: "native-incremental-status-semantics.json", evidenceSha256: string, proofRoles: string[] }, legacy?: { sourceDb11RuleKey: string, sourceDb11Sha256: string } };
}

export interface Db38NativeEvidence { schemaVersion: 1, sourceSha256: string, efficacyType: 98, auditScope: string, sqliteBinding: Record<string, unknown>, dispatch: Record<string, unknown>, accumulation: Record<string, unknown>, outputSelectors: Array<{ raw: number, outputField: Db38OutputField, generatorSymbol: string, consumerSymbol: string }>, independentDimensions: string[], codeRegions: Array<{ role: string, symbol: string, vma: number, sizeBytes: number, codeSha256: string }>, unknowns: string[] }

export interface DatabaseTeamAnalysisDb38Dataset {
    schemaVersion: 1;
    contract: "dokkan-team-analysis-incremental-status-native-semantics-experiment";
    contractVersion: "0.37.0";
    generatedAt: string;
    sourceSnapshotVersion: string;
    sourceDatabaseSha256: string;
    sourceDb37: { fileName: "team-analysis-db37-passive-lifecycle.json.gz", sha256: string, contractVersion: "0.36.0" };
    sourceDb11: { fileName: "team-analysis-db11-experiment.json.gz", sha256: string, contractVersion: "0.10.0" };
    nativeRuntime: { fileName: "libcocos2dcpp.so", sha256: string, sizeBytes: number };
    nativeEvidence: { fileName: "native-incremental-status-semantics.json", sha256: string };
    inheritedSemanticPromotionCount: 31;
    semanticPromotionCount: 8;
    ruleIncrements: Db38RuleProjection[];
}

export interface DatabaseTeamAnalysisDb38Coverage { schemaVersion: 1, ruleCount: number, effectCount: number, affectedStateCount: number, passiveSkillCount: number, supportedFieldRuleCount: number, simulationPartialRuleCount: number, simulationUnknownRuleCount: number, confirmedLegacyConflictCount: number, conflictStateCount: number, ruleCountsByOutputSelector: Record<string, number>, stateCountsByOutputSelector: Record<string, number>, ruleCountsByTiming: Record<string, number>, ruleCountsByCalculationOption: Record<string, number>, inheritedSemanticPromotionCount: 31, semanticPromotionCount: 8 }

export interface DatabaseTeamAnalysisDb38ArtifactManifest { schemaVersion: 1, contractVersion: "0.37.0", generatedAt: string, fileName: "team-analysis-db38-incremental-status.json.gz", compression: "gzip", sha256: string, sizeBytes: number, uncompressedSizeBytes: number, ruleCount: number, affectedStateCount: number, confirmedLegacyConflictCount: number, inheritedSemanticPromotionCount: 31, semanticPromotionCount: 8, sourceDatabaseSha256: string, sourceDb37Sha256: string, sourceDb11Sha256: string, nativeRuntimeSha256: string, nativeEvidenceSha256: string, coverageFile: "team-analysis-db38-coverage.json", reportFile: "team-analysis-db38-report.md", validationFile: "team-analysis-db38-validation.json", goldenValidationFile: "team-analysis-db38-golden-validation.json" }
