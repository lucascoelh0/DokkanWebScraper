import { SqliteScalar } from "./contract";
import {
    DatabaseTeamAnalysisDb3State,
    Db3ConditionExpression,
    Db3PassiveEffect,
    Db3PassiveRule,
    Db3Status,
} from "./team-analysis-db3-contract";

export type Db4PassiveRule = Omit<Db3PassiveRule, "condition" | "conditionStatus" | "status"> & {
    condition: Db3ConditionExpression,
    conditionStatus: Db3Status,
    status: Db3Status,
};

export type Db4ProjectedEffect = Omit<Db3PassiveEffect, "scaling"> & {
    scaling: {
        kind: "per_ki_sphere_threshold_series" | "per_qualifying_unit_threshold_series",
        contributionPerIncrement: 1,
        maxIncrements: number,
        thresholdValues: number[],
        kiSphereTypes?: Array<"AGL" | "TEQ" | "INT" | "STR" | "PHY" | "rainbow" | "any" | "non_rainbow">,
        qualifyingUnit?: {
            scope: "team" | "rotation" | "enemy" | "unknown",
            selectorKind: "category" | "name_selector_unknown" | "class_type_mask_unknown",
            selectorId?: string,
            selectorName?: string,
            rawSelector: SqliteScalar,
            evidence: "first-party-row-join" | "unknown",
        },
    },
};

export interface Db4ThresholdSeriesProjection {
    projectionKey: string,
    status: Db3Status,
    absorbedCondition: "contiguous_minimum_threshold_series",
    effect: Db4ProjectedEffect,
    source: {
        causalityType: SqliteScalar,
        rawScope: SqliteScalar,
        rawSelector: SqliteScalar,
        rawAuxiliary: SqliteScalar,
        sourceRuleKeys: string[],
        passiveSkillRelationIds: string[],
        passiveSkillIds: string[],
        causalityIds: string[],
        provenance: Array<{ table: string, rowId: string }>,
    },
    proof: {
        directSingleCausalityRules: true,
        identicalEffectTargetTimingAndCalculation: true,
        startsAtOne: true,
        contiguousWithoutDuplicates: true,
        noCompetingSameEffectThresholdRows: true,
    },
    unknowns: string[],
}

export type DatabaseTeamAnalysisDb4State = Omit<DatabaseTeamAnalysisDb3State, "passive"> & {
    passive?: Omit<NonNullable<DatabaseTeamAnalysisDb3State["passive"]>, "rules" | "status"> & {
        rules: Db4PassiveRule[],
        thresholdSeries: Db4ThresholdSeriesProjection[],
        status: Db3Status,
    },
};

export interface DatabaseTeamAnalysisDb4Dataset {
    schemaVersion: 1,
    contract: "dokkan-team-analysis-database-experiment",
    contractVersion: "0.3.0",
    generatedAt: string,
    sourceDb3ContractVersion: "0.2.0",
    sourceSnapshotVersion: string,
    sourceSha256: string,
    states: DatabaseTeamAnalysisDb4State[],
}

export interface DatabaseTeamAnalysisDb4Coverage {
    schemaVersion: 1,
    stateCount: number,
    ruleCount: number,
    conditionStatusCounts: Record<Db3Status, number>,
    compositeConditionCounts: { all: number, any: number, unknownOperator: number },
    mappedCausalityTypeCounts: Record<string, number>,
    unknownCausalityTypeCounts: Record<string, number>,
    thresholdSeriesCount: number,
    thresholdSeriesStatusCounts: Record<Db3Status, number>,
    thresholdSeriesByCausalityType: Record<string, number>,
    thresholdSeriesByEffectKind: Record<string, number>,
    absorbedSourceRuleCount: number,
}

export interface DatabaseTeamAnalysisDb4Parity {
    schemaVersion: 1,
    matchedStateCount: number,
    baselineExactEffectSignatures: number,
    normalizedExactEffectSignatures: number,
    exactEffectSignatureDelta: number,
    exactPredicateSignatures: { database: number, current: number, matched: number },
    baselineExactPredicateMatches: number,
    exactPredicateMatchDelta: number,
    predicateKindParity: Record<string, { databaseStates: number, currentStates: number, matchedStates: number }>,
    projectionCount: number,
    currentExactComparableProjectionCount: 0,
    projectionCurrentExactMatchCount: 0,
    currentShapeComparableProjectionCount: number,
    projectionCurrentShapeMatchCount: number,
    projectionShapeMatchesByEffectKind: Record<string, { projections: number, shapeMatched: number }>,
    examples: Array<{
        stateKey: string,
        projectionKey: string,
        effectKind: string,
        thresholdCount: number,
        matchedCurrentShape: boolean,
    }>,
}

export interface DatabaseTeamAnalysisDb4ArtifactManifest {
    schemaVersion: 1,
    contractVersion: "0.3.0",
    generatedAt: string,
    fileName: "team-analysis-db4-experiment.json.gz",
    compression: "gzip",
    sha256: string,
    sizeBytes: number,
    uncompressedSizeBytes: number,
    stateCount: number,
    sourceSha256: string,
    currentTeamAnalysisSha256: string,
    coverageFile: "team-analysis-db4-coverage.json",
    parityFile: "team-analysis-db4-parity.json",
    reportFile: "team-analysis-db4-report.md",
    goldenValidationFile: "team-analysis-db4-golden-validation.json",
}
