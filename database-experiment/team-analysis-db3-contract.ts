import { EvidenceKind, SqliteScalar } from "./contract";
import { DatabasePassiveEffectKind, DatabasePassiveTargetScope } from "./team-analysis-contract";

export type Db3Status = "supported" | "partial" | "unknown";
export type Db3Comparator = "eq" | "lt" | "lte" | "gte" | "between";
export type Db3PredicateKind =
    | "hp_percent"
    | "battle_turn"
    | "battle_slot"
    | "enemy_count"
    | "enemy_status"
    | "ki_spheres_obtained"
    | "team_category_count"
    | "rotation_category_count"
    | "team_class_count"
    | "rotation_class_count"
    | "attack_landed"
    | "attacks_received"
    | "super_attacks_performed"
    | "final_blow_delivered"
    | "guard_activated"
    | "unknown";

export interface Db3Predicate {
    kind: Db3PredicateKind,
    scope: "self" | "team" | "rotation" | "enemy" | "battle" | "unknown",
    comparator?: Db3Comparator,
    value?: number,
    maxValue?: number,
    count?: number,
    categories?: string[],
    categoryIds?: string[],
    classes?: Array<"Super" | "Extreme">,
    kiSphereTypes?: Array<"AGL" | "TEQ" | "INT" | "STR" | "PHY" | "rainbow" | "any" | "non_rainbow">,
    enemyStatuses?: Array<"atk_down" | "def_down" | "stunned" | "super_attack_sealed">,
    eventMode?: "current_event" | "accumulated_count",
    sourceCausalityId?: string,
    sourceCausalityType?: SqliteScalar,
    evidence: EvidenceKind,
}

export type Db3ConditionExpression =
    | { op: "always" }
    | { op: "all", children: Db3ConditionExpression[] }
    | { op: "any", children: Db3ConditionExpression[] }
    | { op: "not", child: Db3ConditionExpression }
    | { op: "predicate", predicate: Db3Predicate }
    | { op: "unknown", causalityId?: string, causalityType?: SqliteScalar, raw: unknown };

export interface Db3PassiveTarget {
    scope: DatabasePassiveTargetScope | "category_allies" | "category_class_allies" | "class_type_allies",
    selfInclusion: "included" | "excluded" | "unknown",
    classes: Array<"Super" | "Extreme">,
    types: Array<"AGL" | "TEQ" | "INT" | "STR" | "PHY">,
    categories: string[],
    categoryIds: string[],
    excludedCategories: string[],
    excludedCategoryIds: string[],
    subTargets: Array<{
        targetValueType: SqliteScalar,
        targetValue: SqliteScalar,
        category?: string,
        mappingStatus: "included_category" | "excluded_category" | "unknown",
        provenance: { table: string, rowId: string },
    }>,
    unknownSubTargets: Array<{
        targetValueType: SqliteScalar,
        targetValue: SqliteScalar,
        provenance: { table: string, rowId: string },
    }>,
}

export interface Db3KiSphereSelector {
    rawMask: SqliteScalar,
    types: Array<"AGL" | "TEQ" | "INT" | "STR" | "PHY" | "rainbow">,
    semantic: "any" | "non_rainbow" | "listed" | "unknown",
    unknownMask: number,
    evidence: EvidenceKind,
}

export interface Db3PassiveEffect {
    kind: DatabasePassiveEffectKind,
    target: Db3PassiveTarget,
    value?: number,
    unit?: "percent" | "flat" | "ki" | "boolean" | "unknown",
    activationChancePercent?: number,
    additionalToSuperChancePercent?: number,
    stackCap?: number,
    scaling?:
        | { kind: "per_ki_sphere", selector: Db3KiSphereSelector, spheresPerIncrement: 1 }
        | { kind: "per_combat_event", event: "attack_performed" | "super_attack_performed" | "attack_received" | "attack_evaded" | "final_blow_delivered" | "unknown", eventsPerIncrement: 1 }
        | { kind: "per_turn", turnsPerIncrement: 1 }
        | { kind: "unknown", rawTimingType: SqliteScalar },
    kiSphereChange?: {
        sourceSelection: "listed_types" | "random_type" | "unknown",
        sourceTypes: Array<"AGL" | "TEQ" | "INT" | "STR" | "PHY" | "rainbow">,
        destinationType: "AGL" | "TEQ" | "INT" | "STR" | "PHY" | "rainbow" | "unknown",
        unknownSourceMask?: number,
    },
    evidence: EvidenceKind,
}

export interface Db3PassiveRule {
    ruleKey: string,
    condition: Db3ConditionExpression,
    conditionStatus: Db3Status,
    effects: Db3PassiveEffect[],
    effectStatus: Db3Status,
    status: Db3Status,
    source: {
        passiveSkillSetId: string,
        passiveSkillRelationId: string,
        passiveSkillId: string,
        efficacyType: SqliteScalar,
        targetType: SqliteScalar,
        executionTimingType: SqliteScalar,
        calculationOption: SqliteScalar,
        causalityIds: string[],
        causalities: Array<{ id: string, type: SqliteScalar, mappingStatus: "supported" | "unknown" }>,
        compiledConditionOperator?: SqliteScalar,
        provenance: {
            passiveSkillRelation: { table: string, rowId: string },
            passiveSkill: { table: string, rowId: string },
            causalities: Array<{ table: string, rowId: string }>,
        },
    },
    unknowns: string[],
}

export interface DatabaseTeamAnalysisDb3State {
    stateKey: string,
    characterId: string,
    formId: string,
    releaseState: "initial" | "eza" | "seza",
    sourceReleaseState: "initial" | "eza" | "seza",
    displayName: string,
    passive?: {
        name?: string,
        rawText: string,
        rules: Db3PassiveRule[],
        status: Db3Status,
        source: {
            passiveSkillSetId: string,
            provenance: { table: string, rowId: string },
        },
    },
}

export interface DatabaseTeamAnalysisDb3Dataset {
    schemaVersion: 1,
    contract: "dokkan-team-analysis-database-experiment",
    contractVersion: "0.2.0",
    generatedAt: string,
    sourceDb2ContractVersion: "0.1.0",
    sourceSnapshotVersion: string,
    sourceSha256: string,
    states: DatabaseTeamAnalysisDb3State[],
}

export interface DatabaseTeamAnalysisDb3Coverage {
    schemaVersion: 1,
    stateCount: number,
    passiveStateCount: number,
    ruleCount: number,
    ruleStatusCounts: Record<Db3Status, number>,
    effectStatusCounts: Record<Db3Status, number>,
    conditionStatusCounts: Record<Db3Status, number>,
    effectCounts: Record<string, number>,
    mappedEfficacyRowCounts: Record<string, number>,
    unknownEfficacyRowCounts: Record<string, number>,
    causalityLeafCount: number,
    mappedCausalityLeafCount: number,
    unknownCausalityLeafCount: number,
    mappedCausalityTypeCounts: Record<string, number>,
    unknownCausalityTypeCounts: Record<string, number>,
    conditionalRuleCount: number,
    unknownCompiledOperatorCount: number,
    conditionPredicateCounts: Record<string, number>,
    subTargetRowCount: number,
    mappedSubTargetRowCount: number,
    unknownSubTargetRowCount: number,
    danglingJoinCount: number,
}

export interface DatabaseTeamAnalysisDb3Parity {
    schemaVersion: 1,
    matchedStateCount: number,
    predicateKindParity: Record<string, { databaseStates: number, currentStates: number, matchedStates: number }>,
    exactPredicateSignatureCount: { database: number, current: number, matched: number },
    exactEffectSignatureCount: { database: number, current: number, matched: number },
    effectKindParity: Record<string, { databaseStates: number, currentStates: number, matchedStates: number }>,
    examples: Array<{
        stateKey: string,
        databaseOnlyPredicates: string[],
        currentOnlyPredicates: string[],
        databaseOnlyEffects: string[],
        currentOnlyEffects: string[],
    }>,
}

export interface DatabaseTeamAnalysisDb3ArtifactManifest {
    schemaVersion: 1,
    contractVersion: "0.2.0",
    generatedAt: string,
    fileName: "team-analysis-db3-experiment.json.gz",
    compression: "gzip",
    sha256: string,
    sizeBytes: number,
    uncompressedSizeBytes: number,
    stateCount: number,
    sourceSha256: string,
    currentTeamAnalysisSha256: string,
    coverageFile: "team-analysis-db3-coverage.json",
    parityFile: "team-analysis-db3-parity.json",
    reportFile: "team-analysis-db3-report.md",
    goldenValidationFile: "team-analysis-db3-golden-validation.json",
}
