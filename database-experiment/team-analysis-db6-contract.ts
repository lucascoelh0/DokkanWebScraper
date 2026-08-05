import { EvidenceKind, SqliteScalar } from "./contract";
import { Db3Comparator, Db3Predicate, Db3PredicateKind, Db3Status } from "./team-analysis-db3-contract";
import { Db4PassiveRule } from "./team-analysis-db4-contract";
import { DatabaseTeamAnalysisDb5State } from "./team-analysis-db5-contract";

export type Db6CombatHistoryKind = "super_attacks_performed" | "attacks_performed" | "attacks_received" | "guard_activated" | "attacks_evaded";
export type Db6PredicateKind = Db3PredicateKind | Db6CombatHistoryKind;

export type Db6Predicate = Omit<Db3Predicate, "kind"> & {
    kind: Db6PredicateKind,
    comparator?: Db3Comparator,
    combatEvent?: {
        eventType: "attack_performed" | "attack_landed" | "guard_activated" | "attack_evaded",
        actor: "self" | "enemy",
        attackKind: "super_attack" | "unknown",
        mode: "accumulated_count",
        countScope: "battle",
        relativeTiming: "after_event",
        evidence: EvidenceKind,
    },
};

export type Db6ConditionExpression =
    | { op: "always" }
    | { op: "all", children: Db6ConditionExpression[] }
    | { op: "any", children: Db6ConditionExpression[] }
    | { op: "not", child: Db6ConditionExpression }
    | { op: "predicate", predicate: Db6Predicate }
    | { op: "unknown", causalityId?: string, causalityType?: SqliteScalar, raw: unknown };

export type Db6PassiveRule = Omit<Db4PassiveRule, "condition" | "conditionStatus" | "status" | "source"> & {
    condition: Db6ConditionExpression,
    conditionStatus: Db3Status,
    status: Db3Status,
    source: Omit<Db4PassiveRule["source"], "causalities"> & {
        causalities: Array<{ id: string, type: SqliteScalar, mappingStatus: "supported" | "unknown" }>,
    },
    combatHistoryTriggers: Array<{
        causalityId: string,
        event: Db6CombatHistoryKind,
        minimumCount: number,
        recurrence: "unknown",
        calculationBucket: "unknown",
        rawExecutionTimingType: SqliteScalar,
        rawCalculationOption: SqliteScalar,
        rawTurn: SqliteScalar,
        rawIsOnce: SqliteScalar,
        rawAuxiliary: SqliteScalar,
        provenance: { table: "skill_causalities", rowId: string },
    }>,
};

export type DatabaseTeamAnalysisDb6State = Omit<DatabaseTeamAnalysisDb5State, "passive"> & {
    passive?: Omit<NonNullable<DatabaseTeamAnalysisDb5State["passive"]>, "rules" | "status"> & {
        rules: Db6PassiveRule[],
        status: Db3Status,
    },
};

export interface DatabaseTeamAnalysisDb6Dataset {
    schemaVersion: 1,
    contract: "dokkan-team-analysis-database-experiment",
    contractVersion: "0.5.0",
    generatedAt: string,
    sourceDb5ContractVersion: "0.4.0",
    sourceSnapshotVersion: string,
    sourceSha256: string,
    states: DatabaseTeamAnalysisDb6State[],
}

export interface DatabaseTeamAnalysisDb6Coverage {
    schemaVersion: 1,
    stateCount: number,
    ruleCount: number,
    ruleStatusCounts: Record<Db3Status, number>,
    conditionStatusCounts: Record<Db3Status, number>,
    combatHistoryPredicateCount: number,
    uniqueCombatHistoryCausalityCount: number,
    combatHistoryEventCounts: Record<string, number>,
    recurrenceUnknownCount: number,
    calculationBucketUnknownCount: number,
    rawTimingCalculationTupleCounts: Record<string, number>,
}

export interface DatabaseTeamAnalysisDb6Parity {
    schemaVersion: 1,
    matchedStateCount: number,
    exactPredicateSignatures: { database: number, current: number, matched: number },
    baselineExactPredicateMatches: number,
    exactPredicateMatchDelta: number,
    combatHistorySignatures: { database: number, current: number, matched: number },
    combatHistoryParityByKind: Record<string, { databaseStates: number, currentStates: number, matchedStates: number }>,
    examples: Array<{
        stateKey: string,
        databaseOnlyHistory: string[],
        currentOnlyHistory: string[],
    }>,
}

export interface DatabaseTeamAnalysisDb6ArtifactManifest {
    schemaVersion: 1,
    contractVersion: "0.5.0",
    generatedAt: string,
    fileName: "team-analysis-db6-experiment.json.gz",
    compression: "gzip",
    sha256: string,
    sizeBytes: number,
    uncompressedSizeBytes: number,
    stateCount: number,
    sourceSha256: string,
    currentTeamAnalysisSha256: string,
    coverageFile: "team-analysis-db6-coverage.json",
    parityFile: "team-analysis-db6-parity.json",
    reportFile: "team-analysis-db6-report.md",
    goldenValidationFile: "team-analysis-db6-golden-validation.json",
}
