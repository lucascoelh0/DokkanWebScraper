import { DokkanInfoQuestEnemy } from "./dokkaninfo-db-story";

export interface DokkanInfoFrontierDataset {
    schemaVersion: "1.0.0",
    generatedAt: string,
    source: "dokkaninfo",
    sourcePath: string,
    seriesCount: number,
    episodeCount: number,
    battleCount: number,
    enemyCount: number,
    failedSeriesIds?: string[],
    failedEpisodeIds?: string[],
    failedBattleIds?: string[],
    series: DokkanInfoFrontierSeries[],
}

export interface DokkanInfoFrontierSeries {
    id: string,
    name: string,
    sourcePath: string,
    bannerPath?: string,
    episodes: DokkanInfoFrontierEpisode[],
}

export interface DokkanInfoFrontierEpisode {
    id: string,
    seriesId: string,
    title: string,
    sourcePath: string,
    bannerPath?: string,
    battles: DokkanInfoFrontierBattle[],
}

export interface DokkanInfoFrontierBattle {
    id: string,
    pageId: string,
    number: string,
    title: string,
    stamina?: number,
    userExp?: number,
    zeni?: number,
    linkLevelRate?: number,
    displayEnemyPortraitPath?: string,
    clearRewards: DokkanInfoSpecialReward[],
    sourcePath: string,
    bonusPassiveCards: DokkanInfoSpecialCardReference[],
    enemyDataStatus: "available" | "not-provided" | "fetch-failed",
    enemies: DokkanInfoQuestEnemy[],
}

export interface DokkanInfoBurstModeDataset {
    schemaVersion: "1.0.0",
    generatedAt: string,
    source: "dokkaninfo",
    sourcePath: string,
    modeCount: number,
    modifierGroupCount: number,
    modifierOptionCount: number,
    failedModeIds?: string[],
    modes: DokkanInfoBurstMode[],
}

export interface DokkanInfoBurstMode {
    id: string,
    title: string,
    sourcePath: string,
    areaId: string,
    sugorokuMapId: string,
    scheduleId: string,
    startAt: number,
    endAt: number,
    bannerPath?: string,
    modifierGroups: DokkanInfoBurstModifierGroup[],
}

export interface DokkanInfoBurstModifierGroup {
    groupIndex: number,
    options: DokkanInfoBurstModifierOption[],
}

export interface DokkanInfoBurstModifierOption {
    optionIndex: number,
    label: string,
    points: number,
    selectedInSource: boolean,
}

export interface DokkanInfoUltimateClashDataset {
    schemaVersion: "1.0.0",
    generatedAt: string,
    source: "dokkaninfo",
    sourcePath: string,
    clashCount: number,
    levelCount: number,
    enemyCount: number,
    missionCount: number,
    failedClashIds?: string[],
    clashes: DokkanInfoUltimateClash[],
}

export interface DokkanInfoUltimateClash {
    id: string,
    title: string,
    sourcePath: string,
    startAt: number,
    endAt: number,
    cardCountLimit: number,
    announcementId?: string,
    bannerFileName?: string,
    missionRewardBannerFileName?: string,
    bannerPath?: string,
    missionRewardBannerPath?: string,
    levels: DokkanInfoUltimateClashLevel[],
    missions: DokkanInfoUltimateClashMission[],
}

export interface DokkanInfoUltimateClashLevel {
    level: number,
    headerImagePath?: string,
    enemies: DokkanInfoUltimateClashEnemy[],
}

export interface DokkanInfoUltimateClashEnemy {
    sequence: number,
    displayLabelKind?: "number" | "boss",
    displayLabelRaw?: string,
    displayLabelImagePath?: string,
    card: DokkanInfoSpecialCardReference,
    healthBars?: number,
    hp?: number,
    atk?: number,
    def?: number,
    damageReductionPercent?: number,
    superAttackStats: DokkanInfoLabelledValue[],
    mechanics: DokkanInfoUltimateClashMechanic[],
    rewards: DokkanInfoVisualReward[],
}

export interface DokkanInfoUltimateClashMechanic {
    sequence: number,
    text?: string,
    values?: string,
    icons: DokkanInfoVisualAsset[],
}

export interface DokkanInfoUltimateClashMission {
    id: string,
    type: string,
    name: string,
    description: string,
    priority: number,
    targetValue: number,
    conditions: Record<string, unknown>,
    rewards: DokkanInfoSpecialReward[],
}

export interface DokkanInfoSpecialCardReference {
    id: string,
    name?: string,
    elementRaw?: string,
    rarityRaw?: number,
    iconId?: string,
    resourceId?: string,
    sourcePath?: string,
    portraitPath?: string,
}

export interface DokkanInfoSpecialReward {
    id?: string,
    itemId?: string,
    itemType: string,
    quantity: number,
    description?: string,
    giftDescription?: string,
}

export interface DokkanInfoVisualReward {
    quantity?: number,
    label?: string,
    imagePath: string,
}

export interface DokkanInfoVisualAsset {
    alt?: string,
    path: string,
}

export interface DokkanInfoLabelledValue {
    label: string,
    value?: string,
}
