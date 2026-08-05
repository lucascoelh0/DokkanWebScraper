export type Db17ConclusionKind = "appearance_turn_minimum_one" | "gte_one_tautology" | "lte_one_equals_eq_one";
export interface Db17Conclusion { kind: Db17ConclusionKind, status: "confirmed_normal_lifecycle", precondition: "appearance_gate_true_and_normal_runtime_lifecycle", evidenceRoles: string[], limitation: string }
export interface DatabaseTeamAnalysisDb17Dataset {
    schemaVersion: 1, contract: "dokkan-team-analysis-appearance-turn-lifecycle-evidence", contractVersion: "0.16.0", generatedAt: string,
    sourceDb16: { fileName: "team-analysis-db16-residual-attribution.json.gz", sha256: string, contractVersion: "0.15.0" },
    sourceNativeRuntime: { fileName: string, sha256: string, sizeBytes: number }, lifecycleEvidence: { fileName: "native-appearance-turn-lifecycle.json", sha256: string, schemaVersion: 1 },
    sourceSnapshotVersion: string, sourceDatabaseSha256: string, sourceCurrentTeamAnalysis: { sha256: string, parserVersion: string }, semanticPromotionCount: 3,
    conclusions: Db17Conclusion[], affectedUnprovenAttributionCount: number, affectedRulePairCount: number,
}
export interface DatabaseTeamAnalysisDb17Coverage { schemaVersion: 1, verifiedSymbolCount: number, conclusionCount: number, affectedTurnOneExactBoundaryAttributionCount: number, affectedCurrentLowerBoundAttributionCount: number, affectedRulePairCount: number, semanticPromotionCount: 3 }
export interface DatabaseTeamAnalysisDb17ArtifactManifest { schemaVersion: 1, contractVersion: "0.16.0", generatedAt: string, fileName: "team-analysis-db17-appearance-turn-evidence.json.gz", compression: "gzip", sha256: string, sizeBytes: number, uncompressedSizeBytes: number, conclusionCount: number, affectedRulePairCount: number, semanticPromotionCount: 3, sourceDatabaseSha256: string, sourceDb16Sha256: string, nativeRuntimeSha256: string, lifecycleEvidenceSha256: string, coverageFile: "team-analysis-db17-coverage.json", reportFile: "team-analysis-db17-report.md", goldenValidationFile: "team-analysis-db17-golden-validation.json" }
