import { Classes, Rarities, Types } from "./character";

export interface EventMissionDataset {
    generatedAt: string,
    source: "dokkan.fyi",
    count: number,
    missionCount: number,
    failedCategoryIds?: string[],
    categories: EventMissionCategory[],
}

export interface EventMissionCategory {
    id: string,
    type?: string,
    endsAt?: string,
    isIndefinite?: boolean,
    priority?: number,
    imageUrl?: string,
    missionsCount?: number,
    completedCount?: number,
    previewRewards: EventMissionReward[],
    missions: EventMissionEntry[],
}

export interface EventMissionEntry {
    id: string,
    type?: string,
    name: string,
    description: string,
    priority?: number,
    startsAt?: string,
    endsAt?: string,
    categoryId?: string,
    completed?: boolean,
    rewards: EventMissionReward[],
    characters: EventMissionCharacterRef[],
}

export interface EventMissionReward {
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
    grade?: string,
    isReusable?: boolean,
    imageId?: string,
    skills: EventMissionRewardSkill[],
}

export interface EventMissionRewardSkill {
    id?: string,
    attribute?: string,
    level?: number,
    hiddenPotentialSkillId?: number,
}

export interface EventMissionCharacterRef {
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
