import { Classes, Rarities, Types } from "../character";

export type GameDbCharacterClass = Classes | "None";

export interface GameDbReference {
    id: string,
    name: string,
    order?: number,
}

export interface GameDbLeaderSkillEffect {
    id: string,
    efficacyType?: number,
    targetType?: number,
    subTargetTypeSetId?: string,
    calcOption?: number,
    values: Array<number | string | null>,
    rawCondition?: string,
}

export interface GameDbLeaderSkillSet {
    id: string,
    name: string,
    description: string,
    effects: GameDbLeaderSkillEffect[],
}

export interface GameDbPassiveSkill {
    id: string,
    name: string,
}

export interface GameDbPassiveSkillSet {
    id: string,
    name: string,
    itemizedDescription?: string,
    groupItemizedDescription?: string,
    characterItemizedDescription?: string,
    passiveSkills: GameDbPassiveSkill[],
}

export interface GameDbSuperAttack {
    cardSpecialId: string,
    specialSetId: string,
    name: string,
    description: string,
    style?: string,
    levelStart?: number,
    requiredKi?: number,
    viewId?: string,
}

export interface GameDbActiveSkillSet {
    id: string,
    name: string,
    effectDescription: string,
    conditionDescription: string,
    turn?: number,
    execLimit?: number,
    ultimateSpecialId?: string,
    specialViewId?: string,
    effects: GameDbActiveSkillEffect[],
    provenance: {
        relation: {
            table: "card_active_skills",
            rowId: string,
        },
        set: {
            table: "active_skill_sets",
            rowId: string,
        },
    },
}

export interface GameDbActiveSkillEffect {
    id: string,
    activeSkillSetId: string,
    targetType?: number,
    subTargetTypeSetId?: string,
    calcOption?: number,
    efficacyType?: number,
    values: Array<number | string | null>,
    efficacyValues: Array<number | string | null>,
    thumbEffectId?: string,
    effectSeId?: string,
    provenance: {
        table: "active_skills",
        rowId: string,
    },
}

export interface GameDbStandbySkillSet {
    id: string,
    name: string,
    effectDescription: string,
    conditionDescription: string,
    execLimit?: number,
    linkedFinishSkillSetIds: string[],
}

export interface GameDbFinishSkillSet {
    id: string,
    name: string,
    effectDescription: string,
    conditionDescription: string,
    execTimingType?: number,
    execLimit?: number,
    linkedStandbySkillSetIds: string[],
}

export interface GameDbAwakeningRoute {
    id: string,
    type: string,
    fromCardId: string,
    toCardId: string,
    awakeningSetId?: string,
    optimalAwakeningStep?: number,
    optimalAwakeningType?: string,
    description?: string,
    priority?: number,
    openAt?: string,
}

export type GameDbFormRelationKind =
    | "awakening-z"
    | "awakening-dokkan"
    | "awakening-other"
    | "passive-transformation"
    | "passive-giant-rage"
    | "passive-reversible-exchange"
    | "active-transformation"
    | "active-giant-rage"
    | "standby-transformation"
    | "finish-transformation";

export interface GameDbFormRelation {
    sourceCardId: string,
    targetCardId: string,
    targetName?: string,
    kind: GameDbFormRelationKind,
    sourceSkillSetId?: string,
    sourceSkillId?: string,
    sourceName?: string,
    description?: string,
}

export interface GameDbGrowthStep {
    id: string,
    step: number,
    maxLevel?: number,
    maxSaLevel?: number,
    passiveSkillSetId?: string,
    leaderSkillSetId?: string,
}

export interface GameDbCharacterSnapshot {
    id: string,
    source: "game-db",
    characterId: string,
    cardUniqueInfoId: string,
    resourceId?: string,
    name: string,
    rarity: Rarities,
    type: Types,
    characterClass: GameDbCharacterClass,
    cost: number,
    releaseDate?: string,
    baseMaxLevel: number,
    baseMaxSaLevel: number,
    stats: {
        hpInitial: number,
        hpMax: number,
        atkInitial: number,
        atkMax: number,
        defInitial: number,
        defMax: number,
    },
    links: GameDbReference[],
    categories: GameDbReference[],
    leaderSkill?: GameDbLeaderSkillSet,
    passiveSkillSet?: GameDbPassiveSkillSet,
    superAttacks: GameDbSuperAttack[],
    activeSkillSets: GameDbActiveSkillSet[],
    standbySkillSets: GameDbStandbySkillSet[],
    finishSkillSets: GameDbFinishSkillSet[],
    formRelations: GameDbFormRelation[],
    growthSteps: GameDbGrowthStep[],
    hasEza: boolean,
    hasSeza: boolean,
    awakeningRoutes: {
        incoming: GameDbAwakeningRoute[],
        outgoing: GameDbAwakeningRoute[],
    },
    raw: {
        element?: string,
        leaderSkillSetId?: string,
        passiveSkillSetId?: string,
        optimalAwakeningGrowType?: string,
        potentialBoardId?: string,
    },
}

export interface GameDbExperimentReport {
    source: "game-db",
    sourceRoot: string,
    dataDir: string,
    generatedAt: string,
    cardIds: string[],
    count: number,
    tables: string[],
    sourceSettings?: {
        glbAssetVersion?: number,
        glbDbVersion?: number,
        glbApkVersion?: string,
    },
}

export interface GameDbComparisonCheck {
    field: string,
    matches: boolean,
    dbValue: unknown,
    fyiValue: unknown,
}

export interface GameDbComparisonCardReport {
    id: string,
    fyiFound: boolean,
    dbSummary: {
        name: string,
        rarity: string,
        type: string,
        characterClass: string,
        linkCount: number,
        categoryCount: number,
        hasLeaderSkill: boolean,
        hasActiveSkill: boolean,
        hasStandby: boolean,
        hasFinish: boolean,
        formRelationCount: number,
        formRelationKinds: GameDbFormRelationKind[],
        hasTransformationLikeRelation: boolean,
        hasReversibleExchange: boolean,
        hasEza: boolean,
        hasSeza: boolean,
    },
    fyiSummary?: {
        name: string,
        rarity: string,
        type: string,
        characterClass: string,
        linkCount: number,
        categoryCount: number,
        hasLeaderSkill: boolean,
        hasActiveSkill: boolean,
        hasStandby: boolean,
        hasFinish: boolean,
        transformationCount: number,
        hasTransformationLikeRelation: boolean,
        hasReversibleExchange: boolean,
    },
    checks: GameDbComparisonCheck[],
}

export interface GameDbComparisonReport {
    generatedAt: string,
    comparedCardCount: number,
    fyiSampleFound: boolean,
    cards: GameDbComparisonCardReport[],
}

