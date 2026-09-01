import { Classes, PortraitSpec, Rarities, Types } from "./character";

export interface DokkanFrontierSeriesDataset {
    generatedAt: string,
    source: "dokkan.fyi",
    count: number,
    series: DokkanFrontierSeriesSummary[],
}

export interface DokkanFrontierChaptersDataset {
    generatedAt: string,
    source: "dokkan.fyi",
    chapterCount: number,
    pageCount: number,
    nodeCount: number,
    missionCount: number,
    chapters: DokkanFrontierChapter[],
}

export interface DokkanFrontierSeriesSummary {
    id: string,
    name: string,
    bannerImagePath?: string,
    priority?: number,
    chapterCount: number,
    chapters: DokkanFrontierChapterSummary[],
}

export interface DokkanFrontierChapterSummary {
    id: string,
    name: string,
    bannerImagePath?: string,
    priority?: number,
}

export interface DokkanFrontierChapter {
    id: string,
    seriesId: string,
    seriesName: string,
    name: string,
    bannerImagePath?: string,
    priority?: number,
    pages: DokkanFrontierPage[],
    groupExchange: DokkanFrontierGroupExchangeStep[],
    chapterMissions: DokkanFrontierMission[],
}

export interface DokkanFrontierPage {
    id: string,
    pageNumber?: number,
    backgroundImagePath?: string,
    nodes: DokkanFrontierNode[],
}

export interface DokkanFrontierNode {
    id: string,
    stamina?: number,
    userExp?: number,
    zeni?: number,
    autoEnabled?: boolean,
    linkSkillLevelUpRate?: number,
    isSpecialNode?: boolean,
    unlockMissions: DokkanFrontierUnlockMission[],
    requiredCharacters: DokkanFrontierCharacterRef[],
    intensityEffects: DokkanFrontierIntensityEffect[],
    rounds: DokkanFrontierEnemyRound[],
    missions: DokkanFrontierMission[],
}

export interface DokkanFrontierUnlockMission {
    id: string,
    description: string,
}

export interface DokkanFrontierIntensityEffect {
    level?: number,
    skill?: DokkanFrontierNamedEffect,
}

export interface DokkanFrontierNamedEffect {
    id?: string,
    name?: string,
    description?: string,
    efficacyType?: number,
    effectValue1?: number,
}

export interface DokkanFrontierEnemyRound {
    roundNumber?: number,
    enemies: DokkanFrontierEnemy[],
}

export interface DokkanFrontierEnemy {
    character?: DokkanFrontierCharacterRef,
    skills: DokkanFrontierSkill[],
}

export interface DokkanFrontierSkill {
    id?: string,
    name?: string,
    description?: string,
}

export interface DokkanFrontierMission {
    id: string,
    type?: string,
    name: string,
    description: string,
    priority?: number,
    startsAt?: string,
    endsAt?: string,
    categoryId?: string,
    rewards: DokkanFrontierReward[],
    characters: DokkanFrontierCharacterRef[],
}

export interface DokkanFrontierReward {
    id?: string,
    missionId?: string,
    itemId?: string,
    itemType?: string,
    quantity: number,
    name?: string,
    description?: string,
    rarity?: number,
    zeni?: number,
    tradePoints?: number,
    rewardType?: string,
    amount?: number,
    cardId?: string,
    step?: number,
    cardSkinTitle?: string,
    cardSkinCharacterName?: string,
    portraitSpec?: PortraitSpec,
    linkTo?: string,
    bgmId?: string,
}

export interface DokkanFrontierGroupExchangeStep {
    charge?: number,
    description: string,
}

export interface DokkanFrontierCharacterRef {
    id: string,
    canonicalId?: string,
    baseCharacterId?: string,
    characterId?: string,
    name: string,
    rarity?: Rarities,
    type?: Types,
    characterClass?: Classes,
    thumbnailId?: string,
    portraitUrl?: string,
    latestReleaseType?: string,
    hasEza?: boolean,
    hasSeza?: boolean,
    isReversiblyExchanged?: boolean,
    isFreelyObtainable?: boolean,
}
