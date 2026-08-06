import { SqliteScalar } from "./contract";

export type Db25AttackContextTest = "additional_param_byte_1_bit_0_set" | "additional_param_byte_1_equals_zero";
export interface Db25NativeAttackContextEvidence {
    schemaVersion: 1, sourceSha256: string, auditScope: string,
    additionalParam: { copySymbol: string, copyVma: number, copySizeBytes: number, copyCodeSha256: string, observedByteOffset: 1, observation: string },
    handlers: Array<{ causalityType: 40 | 56, symbol: string, vma: number, sizeBytes: number, codeSha256: string, predicate: Db25AttackContextTest, snapshotPayloadPath: string, parameterReads: string[], ignoredParameters: string[], unknowns: string[] }>,
    conclusions: string[], dynamicExperiment: { required: true, captureAt: string, capture: string[], cases: string[], successCriterion: string },
}
export interface Db25AttackContextResolution {
    stateKey: string, ruleKey: string, passiveSkillId: string, causalityId: string, causalityType: 40 | 56,
    semanticStatus: "partial", semanticPromotion: false,
    previousProjection: { status: "overclaimed" | "unknown", kind: "super_attacks_performed" | "unknown", evidence: "first-party-row-join" | "unknown" },
    canonicalProjection: {
        kind: "native_attack_context_predicate", scope: "current_causality_evaluation", test: Db25AttackContextTest,
        attackKind: "unknown", eventDirection: "unknown", eventScope: "unknown",
    },
    raw: { cauVal1: SqliteScalar, cauVal2: SqliteScalar, cauVal3: SqliteScalar },
    provenance: {
        database: { table: "skill_causalities", rowId: string, columns: ["causality_type", "cau_val1", "cau_val2", "cau_val3"] },
        runtime: { fileName: "libcocos2dcpp.so", sha256: string, evidenceFile: "native-attack-context-semantics.json", evidenceSha256: string, handlerSymbol: string, handlerVma: number, handlerSizeBytes: number, handlerCodeSha256: string },
    },
}
export interface DatabaseTeamAnalysisDb25Dataset {
    schemaVersion: 1, contract: "dokkan-team-analysis-native-attack-context-correction-experiment", contractVersion: "0.24.0", generatedAt: string,
    sourceSnapshotVersion: string, sourceDatabaseSha256: string,
    sourceDb8: { fileName: "team-analysis-db8-evidence-experiment.json.gz", sha256: string, contractVersion: "0.7.0" },
    sourceDb9: { fileName: "team-analysis-db9-runtime-evidence.json.gz", sha256: string, contractVersion: "0.8.0" },
    sourceDb11: { fileName: "team-analysis-db11-experiment.json.gz", sha256: string, contractVersion: "0.10.0" },
    nativeRuntime: { fileName: "libcocos2dcpp.so", sha256: string, sizeBytes: number },
    nativeEvidence: { fileName: "native-attack-context-semantics.json", sha256: string },
    inheritedSemanticPromotionCount: 3, semanticPromotionCount: 0, resolutions: Db25AttackContextResolution[],
}
export interface DatabaseTeamAnalysisDb25Coverage {
    schemaVersion: 1, resolutionCount: number, affectedStateCount: number,
    occurrenceCountsByType: { "40": number, "56": number }, affectedStateCountsByType: { "40": number, "56": number },
    overclaimCorrectionCount: number, newPartialNativePredicateCount: number, rawZeroPayloadCount: number,
    semanticPromotionCount: 0, dynamicExperimentRequired: true,
}
export interface DatabaseTeamAnalysisDb25ArtifactManifest {
    schemaVersion: 1, contractVersion: "0.24.0", generatedAt: string, fileName: "team-analysis-db25-attack-context.json.gz", compression: "gzip",
    sha256: string, sizeBytes: number, uncompressedSizeBytes: number, resolutionCount: number, affectedStateCount: number,
    overclaimCorrectionCount: number, inheritedSemanticPromotionCount: 3, semanticPromotionCount: 0, sourceDatabaseSha256: string, sourceDb8Sha256: string, sourceDb9Sha256: string,
    sourceDb11Sha256: string, nativeRuntimeSha256: string, nativeEvidenceSha256: string,
    coverageFile: "team-analysis-db25-coverage.json", reportFile: "team-analysis-db25-report.md", goldenValidationFile: "team-analysis-db25-golden-validation.json",
}
