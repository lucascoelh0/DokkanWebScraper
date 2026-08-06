import { SqliteScalar } from "./contract";
import { Db3Status } from "./team-analysis-db3-contract";

export interface Db29NativeCodeRegion { role: string, symbol: string, vma: number, sizeBytes: number, codeSha256: string, observation: string }
export interface Db29NativeAttackBreakEvidence {
    schemaVersion: 1, sourceSha256: string, efficacyType: 111, auditScope: string, conditionMasksRaw: [number, number], codeRegions: Db29NativeCodeRegion[],
    abilityEfficacyInfoVtable: { symbol: "_ZTV19AbilityEfficacyInfo", vma: number, sizeBytes: number, deckIndexSlotOffset: number, deckIndexSymbol: string, efficacyTypeSlotOffset: number, efficacyTypeSymbol: string },
    consumer: { target: "enemy_index", targetSource: string, multiplicity: string, selectionOrder: string, eligibility: Array<{ actionOffset: number, predicate: string, semanticName: "unknown" }>, removedOnRawConditionMask: number },
    conclusions: string[], unknowns: string[],
}

export interface Db29AttackBreakResolution {
    stateKey: string, ruleKey: string, passiveSkillId: string, efficacyType: 111, operation: "attack_break_marker", semanticStatus: "partial",
    effect: {
        status: "supported",
        target: { kind: "enemy_index", runtimeSource: "call_change_param_offset_0", efficacyInfoField: "deck_index", structuredTargetType: { raw: SqliteScalar, status: "unknown" } },
        behavioralParameters: { kind: "none", status: "supported", rawEffValue1: SqliteScalar, rawEffValue2: SqliteScalar, rawEffValue3: SqliteScalar },
        multiplicity: { markerUnit: 1, countSource: "matching_efficacy_111_entries_for_enemy_index", result: "up_to_n_eligible_current_enemy_actions", selectionOrder: "current_action_order_first_n", eligibility: [{ actionOffset: 8, predicate: "int32_nonzero", semanticName: "unknown" }, { actionOffset: 44, predicate: "byte_bit_0_clear", semanticName: "unknown" }] },
    },
    nativeGate: { checker: "AbilityEfficacyBadConditionFunc::checkEnableCondition", conditionMasksRaw: [16777216, 33554432], semanticNames: ["unknown", "unknown"] },
    lifecycle: { removalObservedOnRawConditionMask: 16777216, removedEntryPredicate: "unknown", duration: "unknown", recurrence: "unknown" },
    activation: { executionTimingType: SqliteScalar, executionGameType: SqliteScalar, calculationOption: SqliteScalar, turn: SqliteScalar, isOnce: SqliteScalar, probability: SqliteScalar, causalityConditions: SqliteScalar, conditionStatus: Db3Status, timingStatus: "unknown", calculationBucket: "unknown" },
    provenance: { database: { table: "passive_skills", rowId: string, columns: string[] }, runtime: { fileName: "libcocos2dcpp.so", sha256: string, evidenceFile: "native-attack-break-semantics.json", evidenceSha256: string, codeRegions: Db29NativeCodeRegion[] } },
}

export interface DatabaseTeamAnalysisDb29Dataset { schemaVersion: 1, contract: "dokkan-team-analysis-attack-break-native-semantics-experiment", contractVersion: "0.28.0", generatedAt: string, sourceSnapshotVersion: string, sourceDatabaseSha256: string, sourceDb8: { fileName: "team-analysis-db8-evidence-experiment.json.gz", sha256: string, contractVersion: "0.7.0" }, sourceDb9: { fileName: "team-analysis-db9-runtime-evidence.json.gz", sha256: string, contractVersion: "0.8.0" }, sourceDb11: { fileName: "team-analysis-db11-experiment.json.gz", sha256: string, contractVersion: "0.10.0" }, nativeRuntime: { fileName: "libcocos2dcpp.so", sha256: string, sizeBytes: number }, nativeEvidence: { fileName: "native-attack-break-semantics.json", sha256: string }, inheritedSemanticPromotionCount: 3, semanticPromotionCount: 1, resolutions: Db29AttackBreakResolution[] }
export interface DatabaseTeamAnalysisDb29Coverage { schemaVersion: 1, sourceGapRuleCount: number, resolutionCount: number, affectedStateCount: number, uniquePassiveSkillCount: number, supportedEffectCount: number, partialResolutionCount: number, zeroRawValueRuleCount: number, conditionStatusCounts: Record<Db3Status, number>, executionTimingTypeCounts: Record<string, number>, targetTypeCounts: Record<string, number>, calculationOptionCounts: Record<string, number>, isOnceCounts: Record<string, number>, probabilityCounts: Record<string, number>, inheritedSemanticPromotionCount: 3, semanticPromotionCount: 1 }
export interface DatabaseTeamAnalysisDb29ArtifactManifest { schemaVersion: 1, contractVersion: "0.28.0", generatedAt: string, fileName: "team-analysis-db29-attack-break.json.gz", compression: "gzip", sha256: string, sizeBytes: number, uncompressedSizeBytes: number, resolutionCount: number, affectedStateCount: number, inheritedSemanticPromotionCount: 3, semanticPromotionCount: 1, sourceDatabaseSha256: string, sourceDb8Sha256: string, sourceDb9Sha256: string, sourceDb11Sha256: string, nativeRuntimeSha256: string, nativeEvidenceSha256: string, coverageFile: "team-analysis-db29-coverage.json", reportFile: "team-analysis-db29-report.md", goldenValidationFile: "team-analysis-db29-golden-validation.json" }
