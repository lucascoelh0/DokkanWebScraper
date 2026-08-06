export type Db21UnresolvedSemantic = "runtime_consumer" | "start_point" | "unit" | "end_inclusivity" | "efficacy_dependencies" | "is_once_interaction";
export interface Db21Conclusion { semantic: Db21UnresolvedSemantic, status: "unknown", evidenceRoles: string[], limitation: string }
export interface DatabaseTeamAnalysisDb21Dataset {
    schemaVersion: 1, contract: "dokkan-team-analysis-passive-turn-native-linkage-audit", contractVersion: "0.20.0", generatedAt: string,
    sourceDb20: { fileName: "team-analysis-db20-passive-turn-correlation.json.gz", sha256: string, contractVersion: "0.19.0" },
    sourceNativeRuntime: { fileName: string, sha256: string, sizeBytes: number },
    nativeLinkageEvidence: { fileName: "native-passive-turn-linkage-audit.json", sha256: string, schemaVersion: 1 },
    sourceSnapshotVersion: string, sourceDatabaseSha256: string, sourceCurrentTeamAnalysis: { sha256: string, parserVersion: string },
    auditedCandidateCount: number, exactNumericMatchCount: number, numericMismatchCount: number,
    inheritedSemanticPromotionCount: 3, semanticPromotionCount: 0, linkageStatus: "unresolved_after_bounded_audit", conclusions: Db21Conclusion[],
}
export interface DatabaseTeamAnalysisDb21Coverage { schemaVersion: 1, verifiedSymbolCount: number, auditedCandidateCount: number, exactNumericMatchCount: number, numericMismatchCount: number, unresolvedSemanticCount: number, inheritedSemanticPromotionCount: 3, semanticPromotionCount: 0, linkageStatus: "unresolved_after_bounded_audit" }
export interface DatabaseTeamAnalysisDb21ArtifactManifest { schemaVersion: 1, contractVersion: "0.20.0", generatedAt: string, fileName: "team-analysis-db21-passive-turn-native-audit.json.gz", compression: "gzip", sha256: string, sizeBytes: number, uncompressedSizeBytes: number, verifiedSymbolCount: number, unresolvedSemanticCount: number, inheritedSemanticPromotionCount: 3, semanticPromotionCount: 0, sourceDatabaseSha256: string, sourceDb20Sha256: string, nativeRuntimeSha256: string, nativeLinkageEvidenceSha256: string, coverageFile: "team-analysis-db21-coverage.json", reportFile: "team-analysis-db21-report.md", goldenValidationFile: "team-analysis-db21-golden-validation.json" }
