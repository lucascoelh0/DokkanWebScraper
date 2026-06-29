export type AcquisitionSourceKind =
    | "event-mission"
    | "frontier-chapter-mission"
    | "frontier-node-mission"
    | "z-battle-level"
    | "z-battle-checkpoint"
    | "awakening-medal-stage"
    | "awakening-medal-z-battle"
    | "awakening-medal-baba-shop"
    | "awakening-medal-world-tournament";

export interface AcquisitionDataset {
    generatedAt: string,
    source: "dokkan.fyi",
    itemCount: number,
    sourceCount: number,
    items: AcquisitionItem[],
}

export interface AcquisitionItem {
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
    sources: AcquisitionSource[],
}

export interface AcquisitionSource {
    key: string,
    kind: AcquisitionSourceKind,
    title: string,
    subtitle?: string,
    description?: string,
    quantity?: number,
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
}
