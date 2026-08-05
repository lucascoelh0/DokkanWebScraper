import { SqliteScalar } from "./contract";
import { Db3Status } from "./team-analysis-db3-contract";
import { Db6Predicate } from "./team-analysis-db6-contract";
import { DatabaseTeamAnalysisDb7State, Db7ConditionExpression, Db7PassiveRule, Db7Predicate } from "./team-analysis-db7-contract";

export type Db11RuntimePredicate =
    | {
        kind: "attacks_evaded", scope: "self", eventMode: "current_event",
        sourceCausalityId: string, sourceCausalityType: 43, evidence: "first-party-native-runtime",
    }
    | {
        kind: "turn_from_entry", scope: "self", comparator: "lte" | "gte", value: number,
        nativeComparator: "lte" | "gt", nativeThreshold: number, appearanceGate: "appearance_initialized",
        sourceCausalityId: string, sourceCausalityType: 51 | 55, evidence: "first-party-native-runtime",
    };

export type Db11ConditionExpression =
    | Exclude<Db7ConditionExpression, { op: "all" | "any" | "not" | "predicate" }>
    | { op: "all", children: Db11ConditionExpression[] }
    | { op: "any", children: Db11ConditionExpression[] }
    | { op: "not", child: Db11ConditionExpression }
    | { op: "predicate", predicate: Db6Predicate | Db7Predicate | Db11RuntimePredicate };

export interface Db11RuntimeConditionProjection {
    causalityId: string,
    causalityType: 43 | 51 | 55,
    predicate: Db11RuntimePredicate,
    raw: { cauVal1: SqliteScalar, cauVal2: SqliteScalar, cauVal3: SqliteScalar },
    provenance: {
        database: { table: "skill_causalities", rowId: string, columns: ["causality_type", "cau_val1", "cau_val2", "cau_val3"] },
        runtime: { fileName: "libcocos2dcpp.so", symbol: string, vma: number, sizeBytes: number, codeSha256: string },
    },
}

export type Db11PassiveRule = Omit<Db7PassiveRule, "condition" | "conditionStatus" | "status"> & {
    condition: Db11ConditionExpression,
    conditionStatus: Db3Status,
    status: Db3Status,
    runtimeConditions: Db11RuntimeConditionProjection[],
};

export type DatabaseTeamAnalysisDb11State = Omit<DatabaseTeamAnalysisDb7State, "passive"> & {
    passive?: Omit<NonNullable<DatabaseTeamAnalysisDb7State["passive"]>, "rules" | "status"> & {
        rules: Db11PassiveRule[],
        status: Db3Status,
    },
};

export interface DatabaseTeamAnalysisDb11Dataset {
    schemaVersion: 1,
    contract: "dokkan-team-analysis-database-experiment",
    contractVersion: "0.10.0",
    generatedAt: string,
    sourceDb7: { fileName: "team-analysis-db7-experiment.json.gz", sha256: string, contractVersion: "0.6.0" },
    sourceDb10: { fileName: "team-analysis-db10-semantic-evidence.json.gz", sha256: string, contractVersion: "0.9.0" },
    sourceSnapshotVersion: string,
    sourceSha256: string,
    states: DatabaseTeamAnalysisDb11State[],
}

export interface DatabaseTeamAnalysisDb11Coverage {
    schemaVersion: 1,
    stateCount: number,
    passiveStateCount: number,
    ruleCount: number,
    runtimePredicateCount: number,
    uniqueRuntimeCausalityCount: number,
    runtimePredicateCountsByType: Record<string, number>,
    unprojectedSupportedTypeOccurrencesByType: Record<string, number>,
    affectedStateCountsByType: Record<string, number>,
    conditionStatusCountsBefore: Record<Db3Status, number>,
    conditionStatusCountsAfter: Record<Db3Status, number>,
    ruleStatusCountsBefore: Record<Db3Status, number>,
    ruleStatusCountsAfter: Record<Db3Status, number>,
    supportedConditionDelta: number,
    supportedRuleDelta: number,
    partialType3OccurrenceCount: number,
    semanticPromotionCount: 3,
}

export interface DatabaseTeamAnalysisDb11Parity {
    schemaVersion: 1,
    matchedStateCount: number,
    promotedStructuralSignatures: { database: number, current: number, matched: number },
    parityByKind: Record<string, { databaseStates: number, currentStates: number, matchedStates: number }>,
    occurrenceCountsByType: Record<string, { projected: number, projectedInMatchedStates: number, databaseStateSignatures: number, currentStateSignatures: number, matchedStateSignatures: number }>,
    examples: Array<{ stateKey: string, databaseOnly: string[], currentOnly: string[] }>,
}

export interface DatabaseTeamAnalysisDb11ArtifactManifest {
    schemaVersion: 1,
    contractVersion: "0.10.0",
    generatedAt: string,
    fileName: "team-analysis-db11-experiment.json.gz",
    compression: "gzip",
    sha256: string,
    sizeBytes: number,
    uncompressedSizeBytes: number,
    stateCount: number,
    runtimePredicateCount: number,
    semanticPromotionCount: 3,
    sourceDatabaseSha256: string,
    sourceDb7Sha256: string,
    sourceDb10Sha256: string,
    currentTeamAnalysisSha256: string,
    coverageFile: "team-analysis-db11-coverage.json",
    parityFile: "team-analysis-db11-parity.json",
    reportFile: "team-analysis-db11-report.md",
    goldenValidationFile: "team-analysis-db11-golden-validation.json",
}
