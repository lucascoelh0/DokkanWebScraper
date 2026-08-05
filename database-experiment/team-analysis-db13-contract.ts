export type Db13RuleAlignmentKind = "exact_effect_set_unique" | "unique_effect_signature_anchor";

export interface Db13RuleAlignment {
    stateKey: string,
    databaseRuleKey: string,
    currentRuleKey: string,
    kind: Db13RuleAlignmentKind,
    sharedEffectSignatures: string[],
    databaseEffectSignatures: string[],
    currentEffectSignatures: string[],
    databaseSource: {
        passiveSkillRelationId: string,
        passiveSkillId: string,
        efficacyType: unknown,
    },
}

export interface Db13ExactTurnRuleAssessment {
    stateKey: string,
    value: number,
    databaseRuleKey: string,
    databaseLogicalContext: string,
    currentExactRuleKeys: string[],
    alignedCurrentRuleKeys: string[],
    alignmentKinds: Db13RuleAlignmentKind[],
    status: "rule_aligned_unique_effect_shape" | "rule_alignment_ambiguous" | "rule_unaligned",
}

export interface Db13AmbiguousEffectSignature {
    stateKey: string,
    effectSignature: string,
    databaseRuleKeys: string[],
    currentRuleKeys: string[],
}

export interface DatabaseTeamAnalysisDb13Dataset {
    schemaVersion: 1,
    contract: "dokkan-team-analysis-rule-alignment-experiment",
    contractVersion: "0.12.0",
    generatedAt: string,
    sourceDb11: { fileName: "team-analysis-db11-experiment.json.gz", sha256: string, contractVersion: "0.10.0" },
    sourceDb12: { fileName: "team-analysis-db12-divergence-attribution.json.gz", sha256: string, contractVersion: "0.11.0" },
    sourceCurrentTeamAnalysis: { sha256: string, parserVersion: string },
    sourceSnapshotVersion: string,
    sourceDatabaseSha256: string,
    effectFingerprintVersion: "db3-normalized-effect-shape-v1",
    semanticPromotionCount: 0,
    matchedStateCount: number,
    ruleAlignments: Db13RuleAlignment[],
    ambiguousEffectSignatures: Db13AmbiguousEffectSignature[],
    exactTurnRuleAssessments: Db13ExactTurnRuleAssessment[],
}

export interface DatabaseTeamAnalysisDb13Coverage {
    schemaVersion: 1,
    matchedStateCount: number,
    databaseRuleWithComparableEffectsCount: number,
    currentRuleWithComparableEffectsCount: number,
    alignedDatabaseRuleCount: number,
    alignedCurrentRuleCount: number,
    unalignedDatabaseRuleCount: number,
    unalignedCurrentRuleCount: number,
    ruleAlignmentCount: number,
    ruleAlignmentCountsByKind: Record<Db13RuleAlignmentKind, number>,
    ruleAlignmentStateCount: number,
    ambiguousEffectSignatureCount: number,
    exactTurnCandidateCount: number,
    exactTurnRuleAlignedCount: number,
    exactTurnRuleAmbiguousCount: number,
    exactTurnRuleUnalignedCount: number,
    semanticPromotionCount: 0,
}

export interface DatabaseTeamAnalysisDb13ArtifactManifest {
    schemaVersion: 1,
    contractVersion: "0.12.0",
    generatedAt: string,
    fileName: "team-analysis-db13-rule-alignment.json.gz",
    compression: "gzip",
    sha256: string,
    sizeBytes: number,
    uncompressedSizeBytes: number,
    matchedStateCount: number,
    ruleAlignmentCount: number,
    exactTurnRuleAlignedCount: number,
    semanticPromotionCount: 0,
    sourceDatabaseSha256: string,
    sourceDb11Sha256: string,
    sourceDb12Sha256: string,
    currentTeamAnalysisSha256: string,
    coverageFile: "team-analysis-db13-coverage.json",
    reportFile: "team-analysis-db13-report.md",
    goldenValidationFile: "team-analysis-db13-golden-validation.json",
}
