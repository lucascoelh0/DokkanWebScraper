import { Classes, Rarities, Types } from "./character";

export type MissionCatalogGroupKind =
    | "panel-campaign"
    | "panel-board"
    | "event-category";

export type MissionCatalogMissionKind =
    | "panel"
    | "event";

export interface MissionCatalogDataset {
    generatedAt: string,
    source: "dokkan.fyi",
    groupCount: number,
    missionCount: number,
    rewardCount: number,
    characterRefCount: number,
    groups: MissionCatalogGroup[],
    missions: MissionCatalogMission[],
}

export interface MissionCatalogGroup {
    key: string,
    kind: MissionCatalogGroupKind,
    id: string,
    title: string,
    parentGroupKey?: string,
    imageUrl?: string,
    endsAt?: string,
    isIndefinite?: boolean,
    priority?: number,
    categoryIds?: string[],
    missionsCount?: number,
    completedCount?: number,
    previewRewards?: MissionCatalogReward[],
}

export interface MissionCatalogMission {
    key: string,
    kind: MissionCatalogMissionKind,
    id: string,
    groupKey: string,
    type?: string,
    title: string,
    description: string,
    priority?: number,
    startsAt?: string,
    endsAt?: string,
    categoryId?: string,
    completed?: boolean,
    rewards: MissionCatalogReward[],
    characters: MissionCatalogCharacterRef[],
}

export interface MissionCatalogReward {
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
    skills: MissionCatalogRewardSkill[],
}

export interface MissionCatalogRewardSkill {
    id?: string,
    attribute?: string,
    level?: number,
    hiddenPotentialSkillId?: number,
}

export interface MissionCatalogCharacterRef {
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
