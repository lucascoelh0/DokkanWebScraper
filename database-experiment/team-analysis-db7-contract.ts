import { SqliteScalar } from "./contract";
import { Db3Status } from "./team-analysis-db3-contract";
import { DatabaseTeamAnalysisDb6State, Db6ConditionExpression, Db6PassiveRule, Db6Predicate } from "./team-analysis-db6-contract";

export type Db7Selector =
    | { kind: "class", classes: Array<"Super" | "Extreme">, rawMask: SqliteScalar }
    | { kind: "type", types: Array<"INT" | "STR" | "PHY">, rawMask: SqliteScalar }
    | { kind: "name_token", token: SqliteScalar, localizedName: null };

export type Db7UnknownSelector =
    | { kind: "unknown_mask", rawMask: SqliteScalar, unknownMask: number | null }
    | { kind: "unknown_name_token", rawToken: SqliteScalar, unknownToken: number | null };

export type Db7Predicate = Omit<Db6Predicate, "kind"> & {
    kind: "qualifying_unit_count",
    selector: Db7Selector,
    semanticStatus: "supported" | "partial",
};

export type Db7ConditionExpression =
    | Exclude<Db6ConditionExpression, { op: "all" | "any" | "not" | "predicate" }>
    | { op: "all", children: Db7ConditionExpression[] }
    | { op: "any", children: Db7ConditionExpression[] }
    | { op: "not", child: Db7ConditionExpression }
    | { op: "predicate", predicate: Db6Predicate | Db7Predicate };

export interface Db7SelectorCondition {
    causalityId: string,
    causalityType: 41 | 46,
    scope: "team" | "enemy" | "rotation",
    minimumCount: number,
    selector: Db7Selector | Db7UnknownSelector,
    status: Db3Status,
    rawScope: SqliteScalar,
    rawSelector: SqliteScalar,
    rawCount: SqliteScalar,
    provenance: { table: "skill_causalities", rowId: string },
    unknowns: string[],
}

export type Db7PassiveRule = Omit<Db6PassiveRule, "condition" | "conditionStatus" | "status" | "source"> & {
    condition: Db7ConditionExpression,
    conditionStatus: Db3Status,
    status: Db3Status,
    source: Omit<Db6PassiveRule["source"], "causalities"> & {
        causalities: Array<{ id: string, type: SqliteScalar, mappingStatus: "supported" | "partial" | "unknown" }>,
    },
    selectorConditions: Db7SelectorCondition[],
};

export type DatabaseTeamAnalysisDb7State = Omit<DatabaseTeamAnalysisDb6State, "passive"> & {
    passive?: Omit<NonNullable<DatabaseTeamAnalysisDb6State["passive"]>, "rules" | "status"> & {
        rules: Db7PassiveRule[],
        status: Db3Status,
    },
};

export interface DatabaseTeamAnalysisDb7Dataset {
    schemaVersion: 1,
    contract: "dokkan-team-analysis-database-experiment",
    contractVersion: "0.6.0",
    generatedAt: string,
    sourceDb6ContractVersion: "0.5.0",
    sourceSnapshotVersion: string,
    sourceSha256: string,
    states: DatabaseTeamAnalysisDb7State[],
}

export interface DatabaseTeamAnalysisDb7Coverage {
    schemaVersion: 1,
    stateCount: number,
    ruleCount: number,
    conditionStatusCounts: Record<Db3Status, number>,
    selectorConditionCount: number,
    selectorStatusCounts: Record<Db3Status, number>,
    selectorCountsByCausalityType: Record<string, number>,
    uniqueSelectorCausalityCounts: Record<string, number>,
    type41: { occurrenceCount: number, uniqueTokenCount: number, dictionaryStatus: "unavailable" },
    type46: { supportedOccurrenceCount: number, unknownOccurrenceCount: number, maskCounts: Record<string, number> },
}

export interface DatabaseTeamAnalysisDb7Parity {
    schemaVersion: 1,
    matchedStateCount: number,
    supportedSelectorSignatures: { database: number, current: number, matched: number },
    parityBySelectorKind: Record<string, { databaseStates: number, currentStates: number, matchedStates: number }>,
    partialNameTokenOccurrenceCount: number,
    partialNameTokenComparableCount: 0,
    examples: Array<{ stateKey: string, databaseOnlySelectors: string[], currentOnlySelectors: string[] }>,
}

export interface DatabaseTeamAnalysisDb7ArtifactManifest {
    schemaVersion: 1,
    contractVersion: "0.6.0",
    generatedAt: string,
    fileName: "team-analysis-db7-experiment.json.gz",
    compression: "gzip",
    sha256: string,
    sizeBytes: number,
    uncompressedSizeBytes: number,
    stateCount: number,
    sourceSha256: string,
    currentTeamAnalysisSha256: string,
    coverageFile: "team-analysis-db7-coverage.json",
    parityFile: "team-analysis-db7-parity.json",
    reportFile: "team-analysis-db7-report.md",
    goldenValidationFile: "team-analysis-db7-golden-validation.json",
}
