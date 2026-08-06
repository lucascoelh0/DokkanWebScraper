import { SqliteScalar } from "./contract";
import { Db3Status } from "./team-analysis-db3-contract";

export type Db24CounterFieldName = "resistDamageRate" | "increaseDamagePercent" | "battleScriptNo";
export interface Db24NativeCodeRegion { role: string, symbol: string, vma: number, sizeBytes: number, codeSha256: string, observation: string }
export interface Db24NativeCounterEvidence {
    schemaVersion: 1, sourceSha256: string, efficacyType: 120, auditScope: string,
    sqliteColumnBindings: Array<{ column: "eff_value1" | "eff_value2" | "eff_value3", literalVma: number, passiveSkillOffset: number, nativeField: Db24CounterFieldName }>,
    codeRegions: Db24NativeCodeRegion[], conclusions: string[], unknowns: string[],
}
export interface Db24CounterField {
    sqliteColumn: "eff_value1" | "eff_value2" | "eff_value3", nativeField: Db24CounterFieldName,
    raw: SqliteScalar, runtimeInteger?: number, status: "supported" | "unknown",
}
export interface Db24CounterResolution {
    stateKey: string, ruleKey: string, passiveSkillId: string, efficacyType: 120,
    operation: "counter_behavior_registration", semanticStatus: "partial",
    payload: { resistDamageRate: Db24CounterField, increaseDamagePercent: Db24CounterField, battleScriptNo: Db24CounterField },
    activation: {
        executionTimingType: SqliteScalar, executionGameType: SqliteScalar, targetType: SqliteScalar,
        calculationOption: SqliteScalar, turn: SqliteScalar, isOnce: SqliteScalar, probability: SqliteScalar,
        causalityConditions: SqliteScalar, conditionStatus: Db3Status, timingStatus: "unknown",
        calculationBucket: "unknown", duration: "unknown", recurrence: "unknown",
    },
    provenance: {
        database: { table: "passive_skills", rowId: string, columns: string[] },
        runtime: { fileName: "libcocos2dcpp.so", sha256: string, evidenceFile: "native-counter-behavior-semantics.json", evidenceSha256: string, codeRegions: Db24NativeCodeRegion[] },
    },
}
export interface DatabaseTeamAnalysisDb24Dataset {
    schemaVersion: 1, contract: "dokkan-team-analysis-counter-behavior-native-semantics-experiment", contractVersion: "0.23.0", generatedAt: string,
    sourceSnapshotVersion: string, sourceDatabaseSha256: string,
    sourceDb8: { fileName: "team-analysis-db8-evidence-experiment.json.gz", sha256: string, contractVersion: "0.7.0" },
    sourceDb9: { fileName: "team-analysis-db9-runtime-evidence.json.gz", sha256: string, contractVersion: "0.8.0" },
    sourceDb11: { fileName: "team-analysis-db11-experiment.json.gz", sha256: string, contractVersion: "0.10.0" },
    nativeRuntime: { fileName: "libcocos2dcpp.so", sha256: string, sizeBytes: number },
    nativeEvidence: { fileName: "native-counter-behavior-semantics.json", sha256: string },
    inheritedSemanticPromotionCount: 3, semanticPromotionCount: 1, counterBehaviorResolutions: Db24CounterResolution[],
}
export interface DatabaseTeamAnalysisDb24Coverage {
    schemaVersion: 1, sourceGapRuleCount: number, resolutionCount: number, affectedStateCount: number,
    supportedPayloadFieldCount: number, unknownPayloadFieldCount: number, partialActivationCount: number,
    conditionStatusCounts: Record<Db3Status, number>, executionTimingTypeCounts: Record<string, number>, probabilityCounts: Record<string, number>,
    inheritedSemanticPromotionCount: 3, semanticPromotionCount: 1,
}
export interface DatabaseTeamAnalysisDb24ArtifactManifest {
    schemaVersion: 1, contractVersion: "0.23.0", generatedAt: string, fileName: "team-analysis-db24-counter-behavior.json.gz", compression: "gzip",
    sha256: string, sizeBytes: number, uncompressedSizeBytes: number, resolutionCount: number, affectedStateCount: number,
    inheritedSemanticPromotionCount: 3, semanticPromotionCount: 1, sourceDatabaseSha256: string, sourceDb8Sha256: string, sourceDb9Sha256: string,
    sourceDb11Sha256: string, nativeRuntimeSha256: string, nativeEvidenceSha256: string,
    coverageFile: "team-analysis-db24-coverage.json", reportFile: "team-analysis-db24-report.md", goldenValidationFile: "team-analysis-db24-golden-validation.json",
}
