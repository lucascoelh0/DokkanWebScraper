import { EvidenceKind, ReleaseState, SourcedRow, SqliteScalar } from "./contract";

export type DatabasePassiveMappingStatus = "supported" | "partial" | "unknown";

export type DatabasePassiveEffectKind =
    | "ki"
    | "hp"
    | "atk"
    | "def"
    | "damage_reduction"
    | "guard"
    | "evade_chance"
    | "critical_chance"
    | "additional_attack"
    | "additional_super_attack"
    | "effective_against_all_types"
    | "super_attack_seal"
    | "stun_chance"
    | "enemy_atk_down"
    | "enemy_def_down"
    | "ki_sphere_change"
    | "scouter"
    | "unknown";

export type DatabasePassiveTargetScope =
    | "self"
    | "team_allies"
    | "class_allies"
    | "enemy"
    | "all_enemies"
    | "unknown";

export interface DatabaseMappedEnum<T extends string> {
    raw: SqliteScalar,
    value: T | "unknown",
    evidence: EvidenceKind,
}

export interface DatabasePassiveTarget {
    targetType: DatabaseMappedEnum<DatabasePassiveTargetScope>,
    selfInclusion: "included" | "excluded" | "unknown",
    classes: Array<"Super" | "Extreme">,
    types: Array<"AGL" | "TEQ" | "INT" | "STR" | "PHY">,
    subTargetTypeSetId?: string,
    subTargetRows: SourcedRow[],
}

export interface DatabasePassiveEffect {
    kind: DatabaseMappedEnum<DatabasePassiveEffectKind>,
    target: DatabasePassiveTarget,
    value?: number,
    unit?: "percent" | "flat" | "ki" | "boolean" | "unknown",
    activationChancePercent?: number,
    additionalToSuperChancePercent?: number,
    kiSphereChange?: {
        source: DatabaseMappedEnum<"AGL" | "TEQ" | "INT" | "STR" | "PHY" | "rainbow">,
        destination: DatabaseMappedEnum<"AGL" | "TEQ" | "INT" | "STR" | "PHY" | "rainbow">,
    },
    valueEvidence: EvidenceKind,
}

export interface DatabasePassiveRule {
    ruleKey: string,
    passiveSkillSetId: string,
    passiveSkillId: string,
    relation: SourcedRow,
    skill: SourcedRow,
    visualEffect?: SourcedRow,
    target: DatabasePassiveTarget,
    effects: DatabasePassiveEffect[],
    effectMappingStatus: DatabasePassiveMappingStatus,
    condition: {
        raw: SqliteScalar,
        compiled: unknown,
        referencedCausalityIds: string[],
        causalities: SourcedRow[],
        mappingStatus: "unconditional" | "structured-uninterpreted" | "invalid-json",
    },
    rawEnums: {
        efficacyType: SqliteScalar,
        targetType: SqliteScalar,
        executionTimingType: SqliteScalar,
        calculationOption: SqliteScalar,
    },
    unknowns: string[],
}

export interface DatabaseTeamAnalysisState {
    stateKey: string,
    characterId: string,
    formId: string,
    releaseState: Exclude<ReleaseState, "unknown">,
    sourceReleaseState: Exclude<ReleaseState, "unknown">,
    sourceStateKey: string,
    displayName: string,
    selectionEvidence: "first-party-catalog" | "audited-compatibility" | "first-party-form-relation",
    passive?: {
        set: SourcedRow,
        rawText: string,
        rules: DatabasePassiveRule[],
        mappingStatus: DatabasePassiveMappingStatus,
    },
}

export interface DatabaseTeamAnalysisExperimentDataset {
    schemaVersion: 1,
    contract: "dokkan-team-analysis-database-experiment",
    contractVersion: "0.1.0",
    generatedAt: string,
    sourceCharacterContractVersion: string,
    sourceSnapshotVersion: string,
    sourceSha256: string,
    selection: {
        primaryRule: "first-party-terminal-catalog-plus-explicit-audited-omissions",
        releaseRule: "latest-released-state-per-form-with-initial-compatibility-label-for-nested-forms",
        auditedCompatibilityCardIds: string[],
    },
    states: DatabaseTeamAnalysisState[],
}

export interface DatabaseTeamAnalysisCoverage {
    schemaVersion: 1,
    stateCount: number,
    primaryCharacterCount: number,
    formStateCount: number,
    releaseStateCounts: Record<"initial" | "eza" | "seza", number>,
    passiveStateCount: number,
    passiveRuleCount: number,
    mappedRuleCount: number,
    partialRuleCount: number,
    unknownRuleCount: number,
    effectCounts: Record<DatabasePassiveEffectKind, number>,
    efficacyEnum: {
        confirmed: SqliteScalar[],
        unknown: SqliteScalar[],
        rowCounts: Record<string, number>,
    },
    targetEnum: {
        confirmed: SqliteScalar[],
        unknown: SqliteScalar[],
        rowCounts: Record<string, number>,
    },
    conditionalRuleCount: number,
    interpretedConditionCount: 0,
    danglingCausalityJoinCount: number,
    danglingSubTargetJoinCount: number,
}

export interface DatabaseTeamAnalysisParity {
    schemaVersion: 1,
    currentStateCount: number,
    databaseStateCount: number,
    exactMatchedStateCount: number,
    auditedAliasMatchedStateCount: number,
    currentStateKeysMissingInDatabase: string[],
    databaseStateKeysMissingInCurrent: string[],
    passiveStateCounts: { current: number, database: number, matched: number },
    effectKindParity: Record<string, {
        currentStateCount: number,
        databaseStateCount: number,
        matchedStateCount: number,
        currentOnlyStateCount: number,
        databaseOnlyStateCount: number,
    }>,
    importantConflicts: Array<{
        stateKey: string,
        databaseStateKey?: string,
        currentOnlyEffectKinds: string[],
        databaseOnlyEffectKinds: string[],
    }>,
}

export interface DatabaseTeamAnalysisArtifactManifest {
    schemaVersion: 1,
    contractVersion: "0.1.0",
    generatedAt: string,
    fileName: "team-analysis-db-experiment.json.gz",
    compression: "gzip",
    sha256: string,
    sizeBytes: number,
    uncompressedSizeBytes: number,
    stateCount: number,
    sourceSha256: string,
    currentTeamAnalysisSha256: string,
    coverageFile: "team-analysis-db-coverage.json",
    parityFile: "team-analysis-db-parity.json",
    reportFile: "team-analysis-db-report.md",
    goldenValidationFile: "team-analysis-db-golden-validation.json",
}
