export interface AwakeningMedalDokkanInfoEnrichmentDataset {
    generatedAt: string,
    source: "dokkaninfo",
    count: number,
    entries: AwakeningMedalDokkanInfoEnrichmentEntry[],
}

export interface AwakeningMedalDokkanInfoEnrichmentEntry {
    id: string,
    itemKey: string,
    name: string,
    detailUrl: string,
    description?: string,
    rarityBucket: number,
    zeni?: number,
    tradePoints?: number,
    eventJumpable: boolean,
    isCharacterSpecific: boolean,
    width?: number,
    height?: number,
    createdAt?: string,
    updatedAt?: string,
    thumbnailAsset?: AwakeningMedalDokkanInfoAssetRef,
}

export interface AwakeningMedalDokkanInfoAssetRef {
    remoteUrl: string,
    localPath?: string,
}
