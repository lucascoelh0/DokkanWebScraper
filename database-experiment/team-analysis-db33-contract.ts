import { SqliteScalar } from "./contract";
import { Db31RuleProjection } from "./team-analysis-db31-contract";

export interface Db33CodeRegion { role: string, symbol: string, vma: number, sizeBytes: number, codeSha256: string }
export interface Db33NativeEvidence {
    schemaVersion: 1,
    sourceSha256: string,
    auditScope: string,
    sqliteField: { table: "passive_skills", column: "exec_timing_type" },
    filter: { symbol: string, timingArgumentRegister: "w3", getterVirtualCallVma: number, equalityCompareVma: number },
    supportedValue: { raw: 4, event: "player_attack_setup", sequence: string, callSites: Array<{ literalVma: number, callVma: number, skillCategoryRaw: number, skillTypeRaw: number, outputConsumptionVma: number, literalInstructionHex: string, callInstructionHex: string }> },
    setupCallers: Array<{ callVma: number, ownerSymbol: string }>,
    sequenceProof: { ownerSymbol: string, setupCallVma: number, setupResultConsumerCallVma: number, setupResultConsumerSymbol: string },
    passiveStatusFilterProof: {
        referenceScan: { algorithm: "aarch64_bl_imm26_target_scan", alignmentBytes: 4, publicCreatorVma: number, publicCreatorPltVma: number, directCallVmas: number[], pltCallVmas: number[] },
        publicCreator: { symbol: string, categoryArgumentRegister: "w2", virtualForwardVma: number, abilityManagerVtableSymbol: string, vtableRelocationOffset: number, forwardedCategoryRegister: "w2" },
        allPublicCreatorCallSites: Array<{ categoryLiteralVma: number, callVma: number, ownerSymbol: string, categoryRaw: 0, literalInstructionHex: string }>,
        sharedCreator: { symbol: string, categoryArgumentRegister: "w2", categoryStoreVma: number, createCategoryOffset: number, skillTypeRaw: 2, skillTypeLiteralVma: number, skillTypeStoreVma: number, createSkillTypeOffset: number },
        baseStatus: { symbol: string, createCategoryOffset: number, statusCategoryOffset: number, categoryCopyVma: number, createSkillTypeOffset: number, statusSkillTypeOffset: number, skillTypeCopyVma: number },
        passiveVtable: { symbol: string, vma: number, sizeBytes: number, rawSha256: string, timingGetterRelocationOffset: number, categoryGetterRelocationOffset: number, skillTypeGetterRelocationOffset: number },
        abilityManagerVtable: { symbol: string, vma: number, sizeBytes: number, rawSha256: string, sharedCreatorRelocationOffset: number },
        filterComparisons: { timingVma: number, skillTypeVma: number, categoryVma: number },
        matchingSetupCall: { callVma: number, categoryRaw: 0, skillTypeRaw: 2 },
    },
    codeRegions: Db33CodeRegion[],
    unknowns: string[],
}
export type Db33ExecutionTiming =
    | { status: "supported", event: "turn_start", sequence: "after_character_appearance_and_reversible_fix_before_support_memory_and_potential_skills" }
    | { status: "supported", event: "player_attack_setup", sequence: "inside_player_attack_damage_and_action_bank_setup_before_setup_result_consumer" }
    | { status: "unknown", event: "unknown" };
export interface Db33RuleTiming {
    stateKey: string,
    ruleKey: string,
    passiveSkillId: string,
    rawExecutionTimingType: SqliteScalar,
    effectCount: number,
    calculationOperation: Db31RuleProjection["operation"],
    executionTiming: Db33ExecutionTiming,
    independentDimensions: { calculationBucket: "unknown", unit: "unknown", target: "unknown", duration: "unknown", recurrence: "unknown", stacking: "unknown", isOnceInteraction: "unknown", turnFieldInteraction: "unknown" },
    provenance: { database: { table: "passive_skills", rowId: string, column: "exec_timing_type" }, runtime?: { fileName: "libcocos2dcpp.so", sha256: string, evidenceFile: "native-execution-timing-semantics.json" | "native-execution-timing-value-4-semantics.json", evidenceSha256: string, proofRoles: string[] } },
}
export interface DatabaseTeamAnalysisDb33Dataset {
    schemaVersion: 1,
    contract: "dokkan-team-analysis-player-attack-setup-timing-experiment",
    contractVersion: "0.32.0",
    generatedAt: string,
    sourceSnapshotVersion: string,
    sourceDatabaseSha256: string,
    sourceDb32: { fileName: "team-analysis-db32-execution-timing.json.gz", sha256: string, contractVersion: "0.31.0" },
    currentTeamAnalysis: { fileName: "team-analysis.json.gz", sha256: string },
    nativeRuntime: { fileName: "libcocos2dcpp.so", sha256: string, sizeBytes: number },
    nativeEvidence: { fileName: "native-execution-timing-value-4-semantics.json", sha256: string },
    inheritedSemanticPromotionCount: 9,
    semanticPromotionCount: 1,
    ruleTimings: Db33RuleTiming[],
    legacyComparison: { explicitWhenAttackingEffectCount: number, directlyComparableRuleCount: 0, confirmedConflictCount: 0, boundary: "aggregate_only_no_first_party_rule_identity_and_no_label_equivalence" },
}
export interface DatabaseTeamAnalysisDb33Coverage {
    schemaVersion: 1, ruleCount: number, effectCount: number, passiveSkillCount: number, affectedStateCount: number,
    supportedRuleCount: number, supportedEffectCount: number, supportedPassiveSkillCount: number, supportedStateCount: number,
    newlySupportedRuleCount: number, newlySupportedEffectCount: number, newlySupportedPassiveSkillCount: number, newlySupportedStateCount: number,
    unknownRuleCount: number, rawTimingCounts: Record<string, number>, explicitLegacyWhenAttackingEffectCount: number,
    inheritedSemanticPromotionCount: 9, semanticPromotionCount: 1,
}
export interface DatabaseTeamAnalysisDb33ArtifactManifest {
    schemaVersion: 1, contractVersion: "0.32.0", generatedAt: string, fileName: "team-analysis-db33-player-attack-setup-timing.json.gz", compression: "gzip", sha256: string, sizeBytes: number, uncompressedSizeBytes: number,
    ruleCount: number, supportedRuleCount: number, newlySupportedRuleCount: number, affectedStateCount: number,
    inheritedSemanticPromotionCount: 9, semanticPromotionCount: 1, sourceDatabaseSha256: string, sourceDb32Sha256: string,
    currentTeamAnalysisSha256: string, nativeRuntimeSha256: string, nativeEvidenceSha256: string,
    coverageFile: "team-analysis-db33-coverage.json", reportFile: "team-analysis-db33-report.md", validationFile: "team-analysis-db33-validation.json", goldenValidationFile: "team-analysis-db33-golden-validation.json",
}
