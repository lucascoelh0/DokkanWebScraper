import { AcquisitionSourceKind, AcquisitionStageReference } from "./acquisition";

export type AcquisitionSourceGroupKind =
    | "event-mission-category"
    | "frontier-chapter"
    | "frontier-node"
    | "z-battle"
    | "awakening-stage-quest"
    | "awakening-stage-area"
    | "awakening-baba-shop"
    | "awakening-world-tournament"
    | "dokkaninfo-event"
    | "standalone";

export interface AcquisitionSourceIndexDataset {
    generatedAt: string,
    source: "dokkan.fyi",
    sourceCount: number,
    rewardCount: number,
    sources: AcquisitionSourceEntry[],
}

export interface AcquisitionSourceEntry {
    key: string,
    kind: AcquisitionSourceKind,
    groupKey: string,
    groupKind: AcquisitionSourceGroupKind,
    title: string,
    subtitle?: string,
    description?: string,
    imageUrl?: string,
    sourcePath?: string,
    startsAt?: string,
    endsAt?: string,
    missionCategoryId?: string,
    missionId?: string,
    missionType?: string,
    frontierSeriesId?: string,
    frontierChapterId?: string,
    frontierPageId?: string,
    frontierNodeId?: string,
    zBattleId?: string,
    zBattlePhaseId?: string,
    level?: number,
    checkpointLevel?: number,
    areaId?: string,
    questId?: string,
    stageId?: string,
    difficulty?: string,
    saleId?: string,
    currencyType?: string,
    currencyId?: string,
    price?: number,
    buyableNum?: number,
    ranking?: string,
    tournamentId?: string,
    eventType?: string,
    eventId?: string,
    eventStageId?: string,
    stageReferences?: AcquisitionStageReference[],
    rewardCount: number,
    rewards: AcquisitionSourceRewardRef[],
}

export interface AcquisitionSourceRewardRef {
    key: string,
    itemType: string,
    itemId: string,
    name?: string,
    description?: string,
    rarity?: number,
    zeni?: number,
    tradePoints?: number,
    cardId?: string,
    step?: number,
    linkTo?: string,
    bgmId?: string,
    quantity?: number,
}
