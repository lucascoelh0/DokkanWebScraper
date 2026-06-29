import { Classes, Rarities, Types } from "./character";

export interface PanelMissionDataset {
    generatedAt: string,
    source: string,
    campaignCount: number,
    boardCount: number,
    missionCount: number,
    campaigns: PanelMissionCampaign[],
}

export interface PanelMissionCampaign {
    id: string,
    name: string,
    endsAt?: string,
    isIndefinite: boolean,
    imageUrl?: string,
    categoryIds: string[],
    boards: PanelMissionBoard[],
}

export interface PanelMissionBoard {
    id: string,
    type: string,
    endsAt?: string,
    isIndefinite?: boolean,
    priority?: number,
    imageUrl?: string,
    missionsCount?: number,
    completedCount?: number,
    missions: PanelMissionEntry[],
}

export interface PanelMissionEntry {
    id: string,
    type: string,
    name: string,
    description: string,
    priority?: number,
    startsAt?: string,
    endsAt?: string,
    categoryId?: string,
    completed?: boolean,
    rewards: PanelMissionReward[],
    characters: PanelMissionCharacterRef[],
}

export interface PanelMissionReward {
    id?: string,
    missionId?: string,
    itemId?: string,
    itemType: string,
    quantity: number,
    name?: string,
    description?: string,
    rarity?: number,
    zeni?: number,
    tradePoints?: number,
    rewardType?: string,
    amount?: number,
}

export interface PanelMissionCharacterRef {
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
