import { SqliteScalar } from "./contract";
import { Db3PassiveEffect, Db3Status } from "./team-analysis-db3-contract";
import { DatabaseTeamAnalysisDb4State, Db4ThresholdSeriesProjection } from "./team-analysis-db4-contract";

export type Db5CountedSubject =
    | {
        kind: "ki_sphere",
        kiSphereTypes: Array<"AGL" | "TEQ" | "INT" | "STR" | "PHY" | "rainbow" | "any" | "non_rainbow">,
        status: "supported",
        evidence: "first-party-row-join",
    }
    | {
        kind: "category",
        scope: "team" | "rotation" | "enemy" | "unknown",
        categoryId?: string,
        categoryName?: string,
        rawSelector: SqliteScalar,
        status: Db3Status,
        evidence: "first-party-row-join" | "unknown",
    }
    | {
        kind: "name_match_token",
        scope: "team" | "rotation" | "enemy" | "unknown",
        token: SqliteScalar,
        localizedName: null,
        matchSemantics: "name_includes",
        status: "partial",
        evidence: "audited-first-party-semantics",
    }
    | {
        kind: "class_type_mask",
        scope: "team" | "rotation" | "enemy" | "unknown",
        rawMask: SqliteScalar,
        classes: Array<"Super" | "Extreme">,
        types: Array<"INT" | "STR" | "PHY">,
        unknownMask: number | null,
        status: Db3Status,
        evidence: "audited-first-party-bitfield" | "unknown",
    };

export type Db5CountedScalingEffect = Omit<Db3PassiveEffect, "scaling"> & {
    scaling: {
        kind: "per_counted_subject",
        contributionPerSubject: 1,
        subject: Db5CountedSubject,
        observedThresholdValues: number[],
        observedSeriesLength: number,
        observedMaximumContribution?: number,
        semanticCap: {
            status: "unknown",
            value: null,
            reason: "series_boundary_is_not_a_proven_semantic_cap",
        },
    },
};

export type Db5CountedScalingProjection = Omit<Db4ThresholdSeriesProjection, "effect" | "status" | "unknowns"> & {
    status: Db3Status,
    effect: Db5CountedScalingEffect,
    sourceDb4ProjectionKey: string,
    unknowns: string[],
};

export type DatabaseTeamAnalysisDb5State = Omit<DatabaseTeamAnalysisDb4State, "passive"> & {
    passive?: NonNullable<DatabaseTeamAnalysisDb4State["passive"]> & {
        countedScaling: Db5CountedScalingProjection[],
    },
};

export interface DatabaseTeamAnalysisDb5Dataset {
    schemaVersion: 1,
    contract: "dokkan-team-analysis-database-experiment",
    contractVersion: "0.4.0",
    generatedAt: string,
    sourceDb4ContractVersion: "0.3.0",
    sourceSnapshotVersion: string,
    sourceSha256: string,
    states: DatabaseTeamAnalysisDb5State[],
}

export interface DatabaseTeamAnalysisDb5Coverage {
    schemaVersion: 1,
    stateCount: number,
    projectionCount: number,
    projectionStatusCounts: Record<Db3Status, number>,
    selectorKindCounts: Record<string, number>,
    selectorStatusCounts: Record<Db3Status, number>,
    classTypeMaskCounts: {
        fullyDecoded: number,
        partiallyDecoded: number,
        unknown: number,
    },
    observedSeriesLengthCounts: Record<string, number>,
    projectionsWithObservedMaximumContribution: number,
    projectionsWithProvenSemanticCap: 0,
}

export type Db5CapComparison = "exact_observed_contribution" | "candidate_observed_plus_structured_base" | "mismatch" | "no_structured_cap" | "no_base_effect_shape";

export interface DatabaseTeamAnalysisDb5Parity {
    schemaVersion: 1,
    matchedStateCount: number,
    projectionCount: number,
    currentBaseEffectShapeMatchCount: number,
    currentUnknownConditionShapeMatchCount: number,
    currentStructuredSelectorMatchCount: number,
    capComparisonCounts: Record<Db5CapComparison, number>,
    selectorParityByKind: Record<string, { projections: number, baseEffectShapeMatched: number, structuredSelectorMatched: number }>,
    examples: Array<{
        stateKey: string,
        projectionKey: string,
        selectorKind: string,
        effectKind: string,
        observedSeriesLength: number,
        observedMaximumContribution?: number,
        currentStackCaps: number[],
        baseEffectShapeMatched: boolean,
        currentCondition: "structured_selector_match" | "unknown" | "other_or_missing",
        capComparison: Db5CapComparison,
    }>,
}

export interface DatabaseTeamAnalysisDb5ArtifactManifest {
    schemaVersion: 1,
    contractVersion: "0.4.0",
    generatedAt: string,
    fileName: "team-analysis-db5-experiment.json.gz",
    compression: "gzip",
    sha256: string,
    sizeBytes: number,
    uncompressedSizeBytes: number,
    stateCount: number,
    sourceSha256: string,
    currentTeamAnalysisSha256: string,
    coverageFile: "team-analysis-db5-coverage.json",
    parityFile: "team-analysis-db5-parity.json",
    reportFile: "team-analysis-db5-report.md",
    goldenValidationFile: "team-analysis-db5-golden-validation.json",
}
