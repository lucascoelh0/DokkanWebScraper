import { SqliteScalar } from "./contract";

export type Db28CausalityColumn = "cau_val1" | "cau_val2" | "cau_val3";
export interface Db28NativeCodeRegion { symbol: string, vma: number, sizeBytes: number, codeSha256: string, observation?: string }
export interface Db28NativeRevivalEvidence {
    schemaVersion: 1, sourceSha256: string, auditScope: string,
    skillCausalityPayload: { containerOffset: 8, elementSizeBytes: 4, indexColumns: ["cau_val1", "cau_val2", "cau_val3"], constructorSymbol: string, constructorVma: number, constructorSizeBytes: number, constructorCodeSha256: string, rowConstructorSymbol: string, rowConstructorVma: number, rowConstructorSizeBytes: number, rowConstructorCodeSha256: string },
    abilityStatusVtable: { symbol: "_ZTV22AbilityStatusCausality", vma: number, sizeBytes: number, deckIndexSlotOffset: number, deckIndexSymbol: string },
    inGameDataVtable: { symbol: "_ZTV10InGameData", vma: number, sizeBytes: number, pureCurrentSlotOffset: number, pureCurrentSymbol: string, backCurrentSlotOffset: number, backCurrentSymbol: string },
    counter: { inGameCharaDataOffset: number, widthBits: 32, incrementWriter: Db28NativeCodeRegion & { observation: string }, availabilityReader: Db28NativeCodeRegion & { observation: string }, resetWriter: Db28NativeCodeRegion & { observation: string } },
    handlers: Array<{ causalityType: 47 | 54, symbol: string, vma: number, sizeBytes: number, codeSha256: string, scope: string, predicate: string, parameterReads: Db28CausalityColumn[], ignoredParameters: Db28CausalityColumn[], cauVal1Polarity?: string }>,
    conclusions: string[], unknowns: string[],
}

export type Db28RevivalCounterPredicate =
    | { status: "supported", event: "revival_skill_activated", metric: "activation_count", scope: "ability_owner_pure_current_record", deckIndexSource: "ability_status", comparator: "gt", value: 0 }
    | { status: "supported", event: "revival_skill_activated", metric: "activation_count", scope: "party_pure_and_back_current_records", deckIndices: { from: 0, to: 6, inclusive: true }, aggregate: "any_gt_zero", expected: boolean, rawPolarity: SqliteScalar };

export interface Db28RevivalCounterResolution {
    stateKey: string, ruleKey: string, passiveSkillId: string, causalityId: string, causalityType: 47 | 54, semanticStatus: "partial", predicate: Db28RevivalCounterPredicate,
    history: { resetFunction: "InGameData::resetActivateRevivalSkillCount", resetTrigger: "unknown", window: "unknown" },
    raw: { cauVal1: SqliteScalar, cauVal2: SqliteScalar, cauVal3: SqliteScalar },
    activation: { timing: "unknown", recurrence: "unknown", calculationBucket: "unknown" },
    provenance: { database: { table: "skill_causalities", rowId: string, columns: ["causality_type", "cau_val1", "cau_val2", "cau_val3"] }, runtime: { fileName: "libcocos2dcpp.so", sha256: string, evidenceFile: "native-revival-counter-semantics.json", evidenceSha256: string, handlerSymbol: string, handlerVma: number, handlerSizeBytes: number, handlerCodeSha256: string, counterOffset: number } },
}

export interface DatabaseTeamAnalysisDb28Dataset { schemaVersion: 1, contract: "dokkan-team-analysis-revival-counter-native-semantics-experiment", contractVersion: "0.27.0", generatedAt: string, sourceSnapshotVersion: string, sourceDatabaseSha256: string, sourceDb8: { fileName: "team-analysis-db8-evidence-experiment.json.gz", sha256: string, contractVersion: "0.7.0" }, sourceDb9: { fileName: "team-analysis-db9-runtime-evidence.json.gz", sha256: string, contractVersion: "0.8.0" }, sourceDb11: { fileName: "team-analysis-db11-experiment.json.gz", sha256: string, contractVersion: "0.10.0" }, nativeRuntime: { fileName: "libcocos2dcpp.so", sha256: string, sizeBytes: number }, nativeEvidence: { fileName: "native-revival-counter-semantics.json", sha256: string }, inheritedSemanticPromotionCount: 3, semanticPromotionCount: 2, resolutions: Db28RevivalCounterResolution[] }
export interface DatabaseTeamAnalysisDb28Coverage { schemaVersion: 1, sourceGapOccurrenceCount: number, resolutionCount: number, affectedStateCount: number, occurrenceCountsByType: Record<string, number>, affectedStateCountsByType: Record<string, number>, uniqueCausalityCountsByType: Record<string, number>, supportedPredicateCount: number, partialResolutionCount: number, nonzeroPolarityCount: number, inheritedSemanticPromotionCount: 3, semanticPromotionCount: 2 }
export interface DatabaseTeamAnalysisDb28ArtifactManifest { schemaVersion: 1, contractVersion: "0.27.0", generatedAt: string, fileName: "team-analysis-db28-revival-counter.json.gz", compression: "gzip", sha256: string, sizeBytes: number, uncompressedSizeBytes: number, resolutionCount: number, affectedStateCount: number, inheritedSemanticPromotionCount: 3, semanticPromotionCount: 2, sourceDatabaseSha256: string, sourceDb8Sha256: string, sourceDb9Sha256: string, sourceDb11Sha256: string, nativeRuntimeSha256: string, nativeEvidenceSha256: string, coverageFile: "team-analysis-db28-coverage.json", reportFile: "team-analysis-db28-report.md", goldenValidationFile: "team-analysis-db28-golden-validation.json" }
