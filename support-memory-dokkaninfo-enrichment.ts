export interface SupportMemoryDokkanInfoEnrichmentDataset {
    generatedAt: string,
    source: "dokkaninfo",
    count: number,
    entries: SupportMemoryDokkanInfoEnrichmentEntry[],
}

export interface SupportMemoryDokkanInfoEnrichmentEntry {
    id: string,
    name: string,
    detailUrl: string,
    levelDescriptions: SupportMemoryDokkanInfoLevelDescription[],
    largeAsset?: SupportMemoryDokkanInfoAssetRef,
    completeAsset?: SupportMemoryDokkanInfoAssetQuantityRef,
    requiredFilm?: SupportMemoryDokkanInfoRequiredFilmRef,
    enhancementItems: SupportMemoryDokkanInfoEnhancementItem[],
    animation?: SupportMemoryDokkanInfoAnimationAssetSet,
}

export interface SupportMemoryDokkanInfoLevelDescription {
    level: number,
    description: string,
}

export interface SupportMemoryDokkanInfoAssetRef {
    remoteUrl: string,
    localPath?: string,
}

export interface SupportMemoryDokkanInfoAssetQuantityRef extends SupportMemoryDokkanInfoAssetRef {
    quantity?: number,
}

export interface SupportMemoryDokkanInfoRequiredFilmRef extends SupportMemoryDokkanInfoAssetQuantityRef {
    filmCode?: string,
}

export interface SupportMemoryDokkanInfoEnhancementItem {
    id: string,
    quantity?: number,
    asset: SupportMemoryDokkanInfoAssetRef,
}

export interface SupportMemoryDokkanInfoAnimationAssetSet {
    sourceType: "lwf",
    status: SupportMemoryDokkanInfoAnimationStatus,
    remoteBaseUrl: string,
    localDirectory?: string,
    failureReason?: string,
    lwf: SupportMemoryDokkanInfoAssetRef,
    textures: SupportMemoryDokkanInfoAssetRef[],
}

export type SupportMemoryDokkanInfoAnimationStatus =
    | "pending"
    | "mirrored"
    | "partial"
    | "unavailable";
