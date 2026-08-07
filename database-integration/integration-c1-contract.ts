import { Db35TargetScope } from "../database-experiment/team-analysis-db35-contract";
import { Db36Filter } from "../database-experiment/team-analysis-db36-contract";

export type IntegrationDimensionStatus = "supported" | "partial" | "unknown";
export type IntegrationSourceGate = "DB48" | "DB49" | "DB50";
export type IntegrationReleaseState = "initial" | "eza" | "seza";
export type IntegrationDimension<T> =
    | { status: "supported"; value: T }
    | { status: "partial"; missing: string[] }
    | { status: "unknown"; missing: string[] };

export interface IntegrationStructuralIdentity {
    snapshotVersion: string;
    cardId: string;
    stateKey: string;
    formId: string;
    releaseState: IntegrationReleaseState;
    passiveSkillId: string;
    ruleKey: string;
    efficacyType: 13 | 78 | 120;
    effectOrdinal: 0;
    effectKey: string;
}
export interface IntegrationTargetValue {
    raw: number;
    scope: Db35TargetScope;
    selfInclusion: "included" | "excluded" | "not_applicable";
    subTarget?: { rawSetId: unknown; composition: "and"; emptySetBehavior: "identity"; filters: Db36Filter[] };
}
export type IntegrationOperationValue =
    | { kind: "damage_mitigation"; aggregation: "subtract_reduction_contributions_then_clamp_0_100"; filterKeys: ["deck_index", "skill_category_type"] }
    | { kind: "force_guard"; normalGuardFormula: string; guardCoefficient: 0.5 }
    | { kind: "counter_resistance"; selection: "highest_resist_damage_rate_first_wins_ties"; preference: "efficacy_128_dodge_then_efficacy_120_normal"; formula: "pre_minus_trunc_toward_zero(pre_times_resist_damage_rate_div_100)" };
export type IntegrationValueUnit =
    | { kind: "remaining_damage_rate"; unit: "percent_points"; runtimeFloat32: number; reductionContributionPercentPoints: number }
    | { kind: "boolean_presence"; value: true }
    | { kind: "counter_resist_damage_rate"; unit: "percent_points"; runtimeInteger: number; rateAbove99SetsFlag: true };
export interface IntegrationTimingValue { raw: number; event: string; sequence: string }
export interface IntegrationBucketValue { paths: Array<{ channel: "player_source" | "enemy_source"; bucket: string; formula: string }> }
export interface IntegrationRuleDimensions {
    condition: IntegrationDimension<never>;
    timing: IntegrationDimension<IntegrationTimingValue>;
    target: IntegrationDimension<IntegrationTargetValue>;
    operation: IntegrationDimension<IntegrationOperationValue>;
    valueUnit: IntegrationDimension<IntegrationValueUnit>;
    lifecycle: IntegrationDimension<never>;
    probability: IntegrationDimension<never>;
    calculationBucket: IntegrationDimension<IntegrationBucketValue>;
    attackKind: IntegrationDimension<never>;
    finalHpApplication: IntegrationDimension<never>;
}
export interface IntegrationRuleProvenance {
    sourceGate: IntegrationSourceGate;
    sourceArtifact: { fileName: string; sha256: string; contractVersion: string };
    sourceProjectionSha256: string;
    database: unknown;
    runtime: unknown;
    inherited: unknown;
}
export interface IntegrationC1Rule {
    identity: IntegrationStructuralIdentity;
    dimensions: IntegrationRuleDimensions;
    audit: { raw: Record<string, unknown>; provenance: IntegrationRuleProvenance };
}
export interface IntegrationC1Dataset {
    schemaVersion: 1;
    contract: "dokkan-team-analysis-database-first-sidecar-audit";
    contractVersion: "1.0.0";
    generatedAt: string;
    sourceSnapshotVersion: string;
    sourceDatabaseSha256: string;
    nativeRuntimeSha256: string;
    sources: Array<{ gate: IntegrationSourceGate; fileName: string; sha256: string; contractVersion: string; recordCount: number }>;
    rules: IntegrationC1Rule[];
}
export interface IntegrationC1Coverage {
    schemaVersion: 1;
    ruleCount: number;
    stateCount: number;
    passiveSkillCount: number;
    countsByGate: Record<IntegrationSourceGate, number>;
    dimensionStatusCounts: Record<keyof IntegrationRuleDimensions, Record<IntegrationDimensionStatus, number>>;
    duplicateIdentityCount: number;
}
export interface IntegrationC1Validation { schemaVersion: 1; valid: boolean; ruleCount: number; sourceProjectionHashMatchCount: number; losslessRawTupleCount: number; failures: string[] }
export interface IntegrationC1Manifest {
    schemaVersion: 1;
    contractVersion: "1.0.0";
    generatedAt: string;
    fileName: "team-analysis-database-first-sidecar-c1.json.gz";
    compression: "gzip";
    sha256: string;
    sizeBytes: number;
    uncompressedSizeBytes: number;
    ruleCount: number;
    stateCount: number;
    sourceSnapshotVersion: string;
    sourceDatabaseSha256: string;
    nativeRuntimeSha256: string;
    sourceArtifacts: Array<{ gate: IntegrationSourceGate; sha256: string }>;
    coverageFile: "team-analysis-database-first-sidecar-c1-coverage.json";
    validationFile: "team-analysis-database-first-sidecar-c1-validation.json";
}
