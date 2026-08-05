import { Db11RuntimeConditionProjection } from "./team-analysis-db11-contract";
import { Db13RuleAlignmentKind } from "./team-analysis-db13-contract";

export interface Db14ExactTurnCompatibilityAlias {
    stateKey: string,
    databaseRuleKey: string,
    currentRuleKey: string,
    value: number,
    compatibilityPredicate: { kind: "turn_from_entry", scope: "self", comparator: "eq", value: number },
    compatibilityLogicalContext: string,
    compatibilityNegated: boolean,
    compatibilitySignature: string,
    nativeBounds: {
        conjunctionGroup: string,
        negated: boolean,
        lower: Db11RuntimeConditionProjection,
        upper: Db11RuntimeConditionProjection,
    },
    ruleAlignment: {
        kind: Db13RuleAlignmentKind,
        sharedEffectSignatures: string[],
    },
    status: "supported_compatibility_alias",
}

export interface DatabaseTeamAnalysisDb14Dataset {
    schemaVersion: 1,
    contract: "dokkan-team-analysis-exact-turn-compatibility-experiment",
    contractVersion: "0.13.0",
    generatedAt: string,
    sourceDb11: { fileName: "team-analysis-db11-experiment.json.gz", sha256: string, contractVersion: "0.10.0" },
    sourceDb12: { fileName: "team-analysis-db12-divergence-attribution.json.gz", sha256: string, contractVersion: "0.11.0" },
    sourceDb13: { fileName: "team-analysis-db13-rule-alignment.json.gz", sha256: string, contractVersion: "0.12.1" },
    sourceCurrentTeamAnalysis: { sha256: string, parserVersion: string },
    sourceSnapshotVersion: string,
    sourceDatabaseSha256: string,
    semanticPromotionCount: 0,
    exactTurnCompatibilityAliases: Db14ExactTurnCompatibilityAlias[],
}

export interface DatabaseTeamAnalysisDb14Coverage {
    schemaVersion: 1,
    sourceExactTurnCandidateCount: number,
    sourceRuleAlignedCount: number,
    sourceRuleAmbiguousCount: number,
    sourceRuleUnalignedCount: number,
    compatibilityAliasCount: number,
    compatibilityAliasStateCount: number,
    compatibilityAliasDatabaseRuleCount: number,
    compatibilityAliasCurrentRuleCount: number,
    compatibilityAliasValues: number[],
    currentExactSignatureMatchCount: number,
    skippedAmbiguousCount: number,
    skippedUnalignedCount: number,
    semanticPromotionCount: 0,
}

export interface DatabaseTeamAnalysisDb14ArtifactManifest {
    schemaVersion: 1,
    contractVersion: "0.13.0",
    generatedAt: string,
    fileName: "team-analysis-db14-exact-turn-compatibility.json.gz",
    compression: "gzip",
    sha256: string,
    sizeBytes: number,
    uncompressedSizeBytes: number,
    compatibilityAliasCount: number,
    semanticPromotionCount: 0,
    sourceDatabaseSha256: string,
    sourceDb11Sha256: string,
    sourceDb12Sha256: string,
    sourceDb13Sha256: string,
    currentTeamAnalysisSha256: string,
    coverageFile: "team-analysis-db14-coverage.json",
    reportFile: "team-analysis-db14-report.md",
    goldenValidationFile: "team-analysis-db14-golden-validation.json",
}
