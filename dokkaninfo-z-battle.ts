export type DokkanInfoZBattleStatsStatus = "available" | "not-provided" | "fetch-failed";

export interface DokkanInfoZBattleDataset {
    schemaVersion: "1.0.0",
    generatedAt: string,
    source: "dokkaninfo",
    sourcePath: string,
    eventCount: number,
    rangeCount: number,
    levelCount: number,
    failedEventIds?: string[],
    failedStatsIds?: string[],
    events: DokkanInfoZBattleEvent[],
}

export interface DokkanInfoZBattleEvent {
    id: string,
    type: string,
    displayName: string,
    sourcePath: string,
    statsPath: string,
    escalationTypeId?: string,
    announcementId?: string,
    priority?: number,
    images: {
        bannerPath?: string,
        buttonPath?: string,
    },
    availability: {
        startsAt?: string,
        endsAt?: string,
        eventKeyStartsAt?: string,
        eventKeyEndsAt?: string,
    },
    enableBattleAuto?: boolean,
    cpuFriendListId?: string,
    relatedZBattleStageId?: string,
    unlockConditionsRawJson?: string,
    weaknesses: DokkanInfoZBattleWeakness[],
    conditions: DokkanInfoZBattleCondition[],
    ranges: DokkanInfoZBattleRange[],
    statsDataStatus: DokkanInfoZBattleStatsStatus,
    levels: DokkanInfoZBattleLevel[],
}

export interface DokkanInfoZBattleWeakness {
    kind: "category",
    id?: string,
    name: string,
    startsAtLevel?: number,
}

export interface DokkanInfoZBattleCondition {
    text: string,
    startsAtLevel?: number,
}

export interface DokkanInfoZBattleRange {
    label: string,
    startLevel: number,
    endLevel: number | null,
    enemy?: DokkanInfoZBattleCardReference,
    skillIcons: DokkanInfoZBattleSkillIcon[],
    damageReductionPercent?: number,
    medalRewards: DokkanInfoZBattleReward[],
    orbRewards: DokkanInfoZBattleReward[],
    cardRewards: DokkanInfoZBattleReward[],
    replayRewards: DokkanInfoZBattleReward[],
    stoneRewards: DokkanInfoZBattleReward[],
}

export interface DokkanInfoZBattleLevel {
    level: number,
    enemyCardId?: string,
    hp?: number,
    atk?: number,
    def?: number,
}

export interface DokkanInfoZBattleCardReference {
    id: string,
    name?: string,
    element?: string,
    iconId?: string,
    resourceId?: string,
    portraitPath?: string,
}

export interface DokkanInfoZBattleSkillIcon {
    id?: string,
    path: string,
}

export interface DokkanInfoZBattleReward {
    itemType: string,
    itemId?: string,
    quantity: number,
    name?: string,
    rewardType?: string,
    card?: DokkanInfoZBattleCardReference,
}
