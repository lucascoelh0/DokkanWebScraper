import { SqliteScalar } from "./contract";

export type Db8GapStatus = "partial" | "unknown";

export interface Db8GapSample {
    stateKey: string,
    ruleKey: string,
    sourceRowId: string,
    provenance: { table: "skill_causalities" | "passive_skills", rowId: string },
}

export interface Db8CausalityGap {
    causalityType: SqliteScalar,
    occurrenceCount: number,
    affectedStateCount: number,
    affectedStateKeys: string[],
    uniqueCausalityCount: number,
    causalityIds: string[],
    statusCounts: { partial: number, unknown: number },
    rawValueDomains: { cauVal1: SqliteScalar[], cauVal2: SqliteScalar[], cauVal3: SqliteScalar[] },
    reasonCodes: string[],
    requiredEvidence: string[],
    samples: Db8GapSample[],
}

export interface Db8EfficacyGap {
    efficacyType: SqliteScalar,
    ruleCount: number,
    affectedStateCount: number,
    affectedStateKeys: string[],
    passiveSkillIds: string[],
    statusCounts: { partial: number, unknown: number },
    rawValueDomains: Record<string, SqliteScalar[]>,
    linkedScriptNames: string[],
    scriptNameStatus: "absent" | "opaque",
    reasonCodes: string[],
    requiredEvidence: string[],
    samples: Db8GapSample[],
}

export interface Db8CombatHistoryGap {
    stateKey: string,
    ruleKey: string,
    causalityId: string,
    event: string,
    minimumCount: number,
    recurrence: "unknown",
    calculationBucket: "unknown",
    rawCausality: { cauVal1: SqliteScalar, cauVal2: SqliteScalar, cauVal3: SqliteScalar },
    rawPassive: { executionTimingType: SqliteScalar, calculationOption: SqliteScalar, turn: SqliteScalar, isOnce: SqliteScalar },
    provenance: { table: "skill_causalities", rowId: string },
    requiredEvidence: string[],
}

export interface DatabaseTeamAnalysisDb8Dataset {
    schemaVersion: 1,
    contract: "dokkan-team-analysis-database-evidence-gap-experiment",
    contractVersion: "0.7.0",
    generatedAt: string,
    sourceDb7ContractVersion: "0.6.0",
    sourceSnapshotVersion: string,
    sourceSha256: string,
    sourceStateCount: number,
    semanticPromotionCount: 0,
    causalityGaps: Db8CausalityGap[],
    efficacyGaps: Db8EfficacyGap[],
    combatHistoryGaps: Db8CombatHistoryGap[],
    crossCuttingGaps: {
        nameTokenDictionaryOccurrenceCount: number,
        unknownClassTypeMaskOccurrenceCount: number,
        combatHistoryRecurrenceUnknownCount: number,
        calculationBucketUnknownCount: number,
    },
}

export interface DatabaseTeamAnalysisDb8Coverage {
    schemaVersion: 1,
    semanticPromotionCount: 0,
    causalityGapTypeCount: number,
    causalityGapOccurrenceCount: number,
    causalityGapAffectedStateCount: number,
    efficacyGapTypeCount: number,
    efficacyGapRuleCount: number,
    efficacyGapAffectedStateCount: number,
    combatHistoryGapCount: number,
    combatHistoryGapAffectedStateCount: number,
    causalityOccurrencesByType: Record<string, number>,
    efficacyRulesByType: Record<string, number>,
}

export interface DatabaseTeamAnalysisDb8ArtifactManifest {
    schemaVersion: 1,
    contractVersion: "0.7.0",
    generatedAt: string,
    fileName: "team-analysis-db8-evidence-experiment.json.gz",
    compression: "gzip",
    sha256: string,
    sizeBytes: number,
    uncompressedSizeBytes: number,
    sourceStateCount: number,
    semanticPromotionCount: 0,
    sourceSha256: string,
    sourceDb7Sha256: string,
    coverageFile: "team-analysis-db8-coverage.json",
    reportFile: "team-analysis-db8-report.md",
    goldenValidationFile: "team-analysis-db8-golden-validation.json",
}
