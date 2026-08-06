import { SqliteScalar } from "./contract";
import { Db3Status } from "./team-analysis-db3-contract";

export interface Db30NativeCodeRegion { role: string, symbol: string, vma: number, sizeBytes: number, codeSha256: string, observation: string }
export interface Db30NativeRemovalEvidence {
    schemaVersion: 1, sourceSha256: string, efficacyType: 110, auditScope: string,
    valueBindings: Array<{ column: string, callChangeParamOffset: number, runtimeRole: string }>, codeRegions: Db30NativeCodeRegion[],
    abilityEfficacyInfoVtable: { symbol: string, vma: number, sizeBytes: number, slots: Array<{ offset: number, symbol: string }> },
    abilityStatusEfficacyVtable: { symbol: string, vma: number, sizeBytes: number, targetTypeSlotOffset: number, targetTypeSymbol: string },
    runtimeBehavior: { removalMatchFields: string[], statusLookupCategoryOneSkillTypes: number[], statusLookupCategoryOtherwise: number, alternateDeckIndexWhenSourceTargetType: number, primaryDeckIndexCallChangeParamOffset: number, alternateDeckIndexCallChangeParamOffset: number, targetStatusWriteOffset: number, sourceStatusWriteOffset: number, writtenStatusRaw: number },
    conclusions: string[], unknowns: string[],
}
export interface Db30RemovalResolution {
    stateKey: string, ruleKey: string, passiveSkillId: string, efficacyType: 110, operation: "remove_efficacy_and_inactivate_status", semanticStatus: "partial",
    selector: {
        skillType: { raw: SqliteScalar, runtimeUnsignedInteger?: number, semanticName: "unknown" },
        skillId: { raw: SqliteScalar, runtimeSignedInteger?: number },
        removalCategory: { raw: SqliteScalar, runtimeUnsignedInteger?: number, semanticName: "unknown" },
        selectedDeckIndex: { primarySource: "call_change_param_offset_0", alternateSource: "call_change_param_offset_72", alternateWhenSourceTargetTypeRaw: 16, sourceTargetTypeSemanticName: "unknown" },
        exactRemovalMatchFields: ["category", "deck_index", "skill_type", "skill_id"],
    },
    targetJoin: { status: "partial", kind: "candidate_passive_skill_id", table: "passive_skills", rowId: string, boundary: "skill_type_2_enum_name_unproven" } | { status: "unknown", kind: "unknown_skill_type", rawSkillType: SqliteScalar, rawSkillId: SqliteScalar },
    statusMutation: { targetStatus: { mutation: "inactivated", when: "lookup_returns_status" }, sourceStatus: { mutation: "inactivated", when: "always_after_lookup" }, rawWriteOffset: 20, rawWrittenValue: 0, enumNameStatus: "unknown", lookupCategory: { raw: 0 | 1, source: "skill_type_membership_10_13_18" } },
    activation: { executionTimingType: SqliteScalar, executionGameType: SqliteScalar, targetType: SqliteScalar, calculationOption: SqliteScalar, turn: SqliteScalar, isOnce: SqliteScalar, probability: SqliteScalar, causalityConditions: SqliteScalar, conditionStatus: Db3Status, timingStatus: "unknown", calculationBucket: "unknown", recurrence: "unknown" },
    provenance: { database: { table: "passive_skills", rowId: string, columns: string[], targetRow?: { table: "passive_skills", rowId: string } }, runtime: { fileName: "libcocos2dcpp.so", sha256: string, evidenceFile: "native-efficacy-removal-semantics.json", evidenceSha256: string, codeRegions: Db30NativeCodeRegion[] } },
}
export interface DatabaseTeamAnalysisDb30Dataset { schemaVersion: 1, contract: "dokkan-team-analysis-efficacy-removal-native-semantics-experiment", contractVersion: "0.29.0", generatedAt: string, sourceSnapshotVersion: string, sourceDatabaseSha256: string, sourceDb8: { fileName: string, sha256: string, contractVersion: "0.7.0" }, sourceDb9: { fileName: string, sha256: string, contractVersion: "0.8.0" }, sourceDb11: { fileName: string, sha256: string, contractVersion: "0.10.0" }, nativeRuntime: { fileName: "libcocos2dcpp.so", sha256: string, sizeBytes: number }, nativeEvidence: { fileName: "native-efficacy-removal-semantics.json", sha256: string }, inheritedSemanticPromotionCount: 3, semanticPromotionCount: 1, resolutions: Db30RemovalResolution[] }
export interface DatabaseTeamAnalysisDb30Coverage { schemaVersion: 1, sourceGapRuleCount: number, resolutionCount: number, affectedStateCount: number, uniquePassiveSkillCount: number, candidatePassiveTargetJoinCount: number, unknownTargetJoinCount: number, partialResolutionCount: number, skillTypeCounts: Record<string, number>, removalCategoryCounts: Record<string, number>, executionTimingTypeCounts: Record<string, number>, calculationOptionCounts: Record<string, number>, inheritedSemanticPromotionCount: 3, semanticPromotionCount: 1 }
export interface DatabaseTeamAnalysisDb30ArtifactManifest { schemaVersion: 1, contractVersion: "0.29.0", generatedAt: string, fileName: "team-analysis-db30-efficacy-removal.json.gz", compression: "gzip", sha256: string, sizeBytes: number, uncompressedSizeBytes: number, resolutionCount: number, affectedStateCount: number, inheritedSemanticPromotionCount: 3, semanticPromotionCount: 1, sourceDatabaseSha256: string, sourceDb8Sha256: string, sourceDb9Sha256: string, sourceDb11Sha256: string, nativeRuntimeSha256: string, nativeEvidenceSha256: string, coverageFile: "team-analysis-db30-coverage.json", reportFile: "team-analysis-db30-report.md", goldenValidationFile: "team-analysis-db30-golden-validation.json" }
