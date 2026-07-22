export interface DokkanInfoEventRewardDataset {
    generatedAt: string,
    source: "dokkaninfo",
    eventCount: number,
    rewardCount: number,
    failedEventIds?: string[],
    events: DokkanInfoEventRewardEvent[],
}

export interface DokkanInfoEventRewardEvent {
    id: string,
    type: string,
    name: string,
    sourcePath: string,
    startAt?: string,
    endAt?: string,
    imagePath?: string,
    stages?: DokkanInfoEventStage[],
    missions?: DokkanInfoEventMissionReference[],
    rewards: DokkanInfoEventReward[];
}

export interface DokkanInfoEventStage {
    id: string,
    title: string,
    level?: number,
    difficulty?: string,
    sourcePath: string,
}

export interface DokkanInfoEventMissionReference {
    id: string,
    stageIds: string[],
}

export interface DokkanInfoEventReward {
    key: string,
    itemId: string,
    itemType: string,
    quantity: number,
    name?: string,
    description?: string,
    rarity?: number,
    zeni?: number,
    tradePoints?: number,
    rewardType?: string,
    amount?: number,
    eventId: string,
    eventType: string,
    eventName: string,
    eventPath: string,
    stageId?: string,
    stagePath?: string,
}
