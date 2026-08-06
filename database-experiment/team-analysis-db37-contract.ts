import { SqliteScalar } from "./contract";

export interface Db37OnceOnlyProjection {
    status: "supported" | "unknown";
    rawIsOnce: SqliteScalar;
    normalizedIsOnce: 0 | 1 | null;
    enabled: boolean | null;
    viabilityPredicate: "no_additional_is_once_gate" | "exec_count_less_than_1" | "unknown";
    successfulExecutionMutation: "increment_exec_count" | "independent" | "unknown";
    execCountReset: { operation: "set_zero" | "unknown", trigger: "unknown" };
}

export interface Db37DurationProjection {
    status: "supported" | "partial" | "unknown";
    rawTurn: SqliteScalar;
    initialCurrentTurn: number | null;
    maximumTurn: number | null;
    successfulExecutionMutation: "current_turn_equals_maximum_turn" | "unknown";
    endTurnMutation: "decrement_one_then_deactivate_at_nonpositive_when_update_eligible" | "sentinel_minus_one_not_decremented_when_update_eligible" | "unknown";
    endTurnPredicate: "current_turn_less_than_1" | "unknown";
}

export interface Db37RuleLifecycle {
    stateKey: string;
    ruleKey: string;
    passiveSkillId: string;
    effectCount: number;
    simulationStatus: "partial" | "unknown";
    onceOnly: Db37OnceOnlyProjection;
    duration: Db37DurationProjection;
    executedThisTurn: { status: "supported", successfulExecutionMutation: "set_true", endTurnMutation: "set_false", independentFromExecCount: true };
    independentDimensions: { condition: "independent", target: "inherited_db36", timing: "independent", operation: "independent", unit: "independent", calculationBucket: "independent", recurrence: "partial", stacking: "unknown" };
    provenance: {
        database: { table: "passive_skills", rowId: string, columns: ["turn", "is_once"] };
        runtime: { fileName: "libcocos2dcpp.so", sha256: string, evidenceFile: "native-passive-lifecycle-semantics.json", evidenceSha256: string, proofRoles: string[] };
    };
}

export interface Db37NativeEvidence {
    schemaVersion: 1;
    sourceSha256: string;
    auditScope: string;
    sqliteBinding: Record<string, unknown>;
    runtimeStorage: Record<string, unknown>;
    onceOnly: Record<string, unknown>;
    duration: Record<string, unknown>;
    executedThisTurn: Record<string, unknown>;
    resetBoundary: Record<string, unknown>;
    vtable: { symbol: string, vma: number, sizeBytes: number, rawSha256: string, relocations: Array<{ offset: number, symbol: string }> };
    codeRegions: Array<{ role: string, symbol: string, vma: number, sizeBytes: number, codeSha256: string }>;
    unknowns: string[];
}

export interface DatabaseTeamAnalysisDb37Dataset {
    schemaVersion: 1;
    contract: "dokkan-team-analysis-passive-lifecycle-native-semantics-experiment";
    contractVersion: "0.36.0";
    generatedAt: string;
    sourceSnapshotVersion: string;
    sourceDatabaseSha256: string;
    sourceDb36: { fileName: "team-analysis-db36-sub-target-semantics.json.gz", sha256: string, contractVersion: "0.35.0" };
    sourceDb20: { fileName: "team-analysis-db20-passive-turn-correlation.json.gz", sha256: string, contractVersion: "0.19.0" };
    nativeRuntime: { fileName: "libcocos2dcpp.so", sha256: string, sizeBytes: number };
    nativeEvidence: { fileName: "native-passive-lifecycle-semantics.json", sha256: string };
    inheritedSemanticPromotionCount: 29;
    semanticPromotionCount: 2;
    legacyComparison: { alignedAppearanceTurnCandidates: number, numericallyEqual: number, numericallyDifferent: number, semanticAgreementCount: 0, confirmedBehaviorConflictCount: 0, classification: "independent_runtime_dimensions_not_directly_comparable" };
    ruleLifecycles: Db37RuleLifecycle[];
}

export interface DatabaseTeamAnalysisDb37Coverage {
    schemaVersion: 1;
    ruleCount: number;
    effectCount: number;
    affectedStateCount: number;
    passiveSkillCount: number;
    fieldSupportedRuleCount: number;
    simulationPartialRuleCount: number;
    simulationUnknownRuleCount: number;
    onceOnlyEnabledRuleCount: number;
    onceOnlyEnabledEffectCount: number;
    onceOnlyEnabledStateCount: number;
    ruleCountsByRawIsOnce: Record<string, number>;
    effectCountsByRawIsOnce: Record<string, number>;
    ruleCountsByRawTurn: Record<string, number>;
    effectCountsByRawTurn: Record<string, number>;
    inheritedSemanticPromotionCount: 29;
    semanticPromotionCount: 2;
}

export interface DatabaseTeamAnalysisDb37ArtifactManifest {
    schemaVersion: 1;
    contractVersion: "0.36.0";
    generatedAt: string;
    fileName: "team-analysis-db37-passive-lifecycle.json.gz";
    compression: "gzip";
    sha256: string;
    sizeBytes: number;
    uncompressedSizeBytes: number;
    ruleCount: number;
    onceOnlyEnabledRuleCount: number;
    affectedStateCount: number;
    inheritedSemanticPromotionCount: 29;
    semanticPromotionCount: 2;
    sourceDatabaseSha256: string;
    sourceDb36Sha256: string;
    sourceDb20Sha256: string;
    nativeRuntimeSha256: string;
    nativeEvidenceSha256: string;
    coverageFile: "team-analysis-db37-coverage.json";
    reportFile: "team-analysis-db37-report.md";
    validationFile: "team-analysis-db37-validation.json";
    goldenValidationFile: "team-analysis-db37-golden-validation.json";
}
