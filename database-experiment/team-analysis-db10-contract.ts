import { SqliteScalar } from "./contract";
import { Db8GapSample } from "./team-analysis-db8-contract";

export type Db10ParameterColumn = "cau_val1" | "cau_val2" | "cau_val3";
export type Db10Comparator = "gte" | "lte" | "gt" | "eq_true";
export type Db10SemanticStatus = "supported" | "partial";

export interface Db10NativeSemanticHandler {
    causalityType: number,
    symbol: string,
    vma: number,
    sizeBytes: number,
    codeSha256: string,
    status: Db10SemanticStatus,
    operation: "runtime_gauge_ratio_threshold" | "dodge_success" | "turns_from_appearance",
    comparator: Db10Comparator,
    parameterReads: Db10ParameterColumn[],
    ignoredParameters: Db10ParameterColumn[],
    valueExpression: string,
    gate: "appearance_initialized" | null,
    unknowns: string[],
}

export interface Db10NativeSemanticsLayout {
    schemaVersion: 1,
    sourceSha256: string,
    payloadLayout: {
        containerOffset: 8,
        elementSizeBytes: 4,
        indexColumns: ["cau_val1", "cau_val2", "cau_val3"],
        constructorSymbol: string,
        constructorVma: number,
        constructorSizeBytes: number,
        constructorCodeSha256: string,
        rowConstructorSymbol: string,
        rowConstructorVma: number,
        rowConstructorSizeBytes: number,
        rowConstructorCodeSha256: string,
    },
    handlers: Db10NativeSemanticHandler[],
}

export interface Db10CausalityResolution {
    causalityType: number,
    status: Db10SemanticStatus,
    operation: Db10NativeSemanticHandler["operation"],
    comparator: Db10Comparator,
    thresholdSource?: "cau_val1",
    valueExpression: string,
    gate: Db10NativeSemanticHandler["gate"],
    parameterReads: Db10ParameterColumn[],
    ignoredParameters: Db10ParameterColumn[],
    unknowns: string[],
    occurrenceCount: number,
    affectedStateCount: number,
    affectedStateKeys: string[],
    causalityIds: string[],
    rawValueDomains: { cauVal1: SqliteScalar[], cauVal2: SqliteScalar[], cauVal3: SqliteScalar[] },
    samples: Db8GapSample[],
    provenance: {
        database: { table: "skill_causalities", columns: ["causality_type", "cau_val1", "cau_val2", "cau_val3"] },
        runtime: { fileName: "libcocos2dcpp.so", symbol: string, vma: number, sizeBytes: number, codeSha256: string },
    },
}

export interface DatabaseTeamAnalysisDb10Dataset {
    schemaVersion: 1,
    contract: "dokkan-team-analysis-native-semantic-evidence-experiment",
    contractVersion: "0.9.0",
    generatedAt: string,
    sourceSnapshotVersion: string,
    sourceDatabaseSha256: string,
    sourceDb8: { fileName: "team-analysis-db8-evidence-experiment.json.gz", sha256: string, contractVersion: "0.7.0" },
    sourceDb9: { fileName: "team-analysis-db9-runtime-evidence.json.gz", sha256: string, contractVersion: "0.8.0" },
    nativeRuntime: { fileName: "libcocos2dcpp.so", sha256: string },
    nativeSemanticsLayout: { fileName: "native-runtime-semantics.json", sha256: string },
    semanticPromotionCount: 3,
    promotedOccurrenceCount: number,
    partialResolutionCount: 1,
    partialResolutionOccurrenceCount: number,
    causalityResolutions: Db10CausalityResolution[],
}

export interface DatabaseTeamAnalysisDb10Coverage {
    schemaVersion: 1,
    sourceGapTypeCount: number,
    sourceGapOccurrenceCount: number,
    auditedTypeCount: number,
    supportedTypeCount: number,
    partialTypeCount: number,
    promotedOccurrenceCount: number,
    partialResolutionOccurrenceCount: number,
    remainingUnresolvedTypeCount: number,
    remainingUnresolvedOccurrenceCount: number,
    promotedAffectedStateCount: number,
    semanticPromotionCount: 3,
    efficacyPromotionCount: 0,
}

export interface DatabaseTeamAnalysisDb10ArtifactManifest {
    schemaVersion: 1,
    contractVersion: "0.9.0",
    generatedAt: string,
    fileName: "team-analysis-db10-semantic-evidence.json.gz",
    compression: "gzip",
    sha256: string,
    sizeBytes: number,
    uncompressedSizeBytes: number,
    semanticPromotionCount: 3,
    promotedOccurrenceCount: number,
    sourceDatabaseSha256: string,
    sourceDb8Sha256: string,
    sourceDb9Sha256: string,
    nativeRuntimeSha256: string,
    nativeSemanticsLayoutSha256: string,
    coverageFile: "team-analysis-db10-coverage.json",
    reportFile: "team-analysis-db10-report.md",
    goldenValidationFile: "team-analysis-db10-golden-validation.json",
}
