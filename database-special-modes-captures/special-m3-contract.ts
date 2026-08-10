export interface SpecialM3SourceLockEntry { key: "e1" | "e2" | "e4" | "s2"; payloadPath: string; payloadSizeBytes: number; payloadSha256: string; manifestPath: string; manifestSizeBytes: number; manifestSha256: string; validationPath: string; validationSizeBytes: number; validationSha256: string; contractName: string; contractVersion: string }
export interface SpecialM3SourceLock { schemaVersion: 1; contract: "dokkan-special-modes-database-source-lock"; contractVersion: "0.4.1"; artifacts: SpecialM3SourceLockEntry[]; database: { fileName: "dokkan-global-current.db"; sizeBytes: 95428608; sha256: "3654eb7db9e18dfe4c238abd02bcc06a688ffa6f30aa1ad93fd108dcfeb78265" } }
export interface SpecialM3Lineage { key: string; sourceKind: "validated_artifact" | "sqlite_snapshot"; contract: string; contractVersion: string; payloadSizeBytes: number; payloadSha256: string; manifestSha256: string | null; validationSha256: string | null }
export interface SpecialM3Join { key: string; left: string; right: string; joinKey: string | null; status: "supported" | "partial" | "unknown" | "unjoinable" | "coverage_gap"; matchedCount: number; unmatchedCount: number; boundary: string }
export interface SpecialM3Dataset {
    schemaVersion: 1;
    contract: "dokkan-special-modes-database-structural-joins";
    contractVersion: "0.4.1";
    generatedAt: string;
    generatedAtPolicy: "inherits_capture_timestamp";
    collectionMode: "validated_local_artifacts_no_network";
    defaultEnabled: false;
    productionMutation: false;
    identityPolicy: "numeric_structural_ids_only_no_text_names_or_namespace_overlap";
    m1ArtifactSha256: string;
    m1ArtifactSizeBytes: number;
    m2ArtifactSha256: string;
    m2ArtifactSizeBytes: number;
    sourceLineage: SpecialM3Lineage[];
    pettan: { capturedPackIds: number[]; capturedMapIds: number[]; databasePackCount: number; databaseMapCount: number; databaseArenaCount: number; databaseStageCount: number; joins: SpecialM3Join[] };
    burst: { capturedQuestId: number; capturedGenkaiBattleId: number; capturedScheduleId: number; capturedGimmickSubCategoryIds: number[]; joinedQuest: null | { questId: number; areaId: number; levelIds: number[] }; candidateTableCounts: Record<"genkai_gimmick_sub_categories" | "score_benefits" | "special_bonuses", number>; sqliteEvidence: { matchedGimmickSubCategoryIds: number[]; matchedCategoryTypeCount: number; invalidSubcategoryEdgeCount: number; scoreBenefitConditionKeyTypes: Array<{ key: string; type: string }>; rootForeignKeyStatus: "absent"; formulaStatus: "unknown" }; joins: SpecialM3Join[] };
}
export interface SpecialM3Validation { schemaVersion: 1; valid: boolean; sourceCount: number; supportedJoinCount: number; partialJoinCount: number; unjoinableJoinCount: number; coverageGapCount: number; databaseSdMapCount: number; databaseSdArenaCount: number; databaseSdStageCount: number; failures: string[] }
