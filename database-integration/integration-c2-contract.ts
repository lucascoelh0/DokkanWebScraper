import { IntegrationBucketValue, IntegrationC1Rule, IntegrationOperationValue, IntegrationStructuralIdentity, IntegrationValueUnit } from "./integration-c1-contract";

export interface IntegrationC2Target {
    scope: "self" | "team_allies" | "enemy" | "all_enemies" | "super_class_allies" | "extreme_class_allies" | "super_class_enemies" | "extreme_class_enemies" | "team_allies_excluding_self";
    selfInclusion: "included" | "excluded" | "not_applicable";
    subTarget?: { composition: "and"; emptySetBehavior: "identity"; filters: Array<{ selector: "card_category_id" | "card_unique_info_set_id"; inclusion: "include" | "exclude"; selectorId: string; memberCardUniqueInfoIds?: string[] }> };
}
export interface IntegrationC2Timing { event: string; sequence: string }

export interface IntegrationC2Rule {
    identity: IntegrationStructuralIdentity;
    supported: {
        target: IntegrationC2Target;
        operation: IntegrationOperationValue;
        valueUnit: IntegrationValueUnit;
        calculationBucket: IntegrationBucketValue;
        timing?: IntegrationC2Timing;
    };
}
export interface IntegrationC2Dataset {
    schemaVersion: 1;
    contract: "dokkan-team-analysis-database-first-supported-sidecar";
    contractVersion: "1.0.0";
    generatedAt: string;
    sourceSnapshotVersion: string;
    sourceDatabaseSha256: string;
    nativeRuntimeSha256: string;
    projectionPolicy: "status_exactly_supported";
    auditSidecar: { fileName: "team-analysis-database-first-sidecar-c1.json.gz"; sha256: string; contractVersion: "1.0.0" };
    rules: IntegrationC2Rule[];
}
export interface IntegrationC2Coverage {
    schemaVersion: 1;
    sourceRuleCount: number;
    projectedRuleCount: number;
    omittedRuleCount: number;
    stateCount: number;
    passiveSkillCount: number;
    includedDimensionCounts: { target: number; operation: number; valueUnit: number; calculationBucket: number; timing: number };
    omittedDimensionCounts: { condition: number; timing: number; lifecycle: number; probability: number; attackKind: number; finalHpApplication: number };
    forbiddenFieldCount: number;
}
export interface IntegrationC2Validation { schemaVersion: 1; valid: boolean; sourceRuleCount: number; projectedRuleCount: number; exactProjectionCount: number; failures: string[] }
export interface IntegrationC2Manifest {
    schemaVersion: 1;
    contractVersion: "1.0.0";
    generatedAt: string;
    fileName: "team-analysis-database-first-supported-c2.json.gz";
    compression: "gzip";
    sha256: string;
    sizeBytes: number;
    uncompressedSizeBytes: number;
    ruleCount: number;
    stateCount: number;
    sourceSnapshotVersion: string;
    sourceAuditSidecarSha256: string;
    coverageFile: "team-analysis-database-first-supported-c2-coverage.json";
    validationFile: "team-analysis-database-first-supported-c2-validation.json";
}
export type IntegrationC2SourceRule = IntegrationC1Rule;
