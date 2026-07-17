export type DokkanInfoItemCategorySlug =
    | "actitems"
    | "keys"
    | "potentialitems"
    | "specialitems"
    | "stickers"
    | "supportitems"
    | "trainingfields"
    | "trainingitems"
    | "treasureitems";

export type DokkanInfoItemType =
    | "ActItem"
    | "KeyItem"
    | "PotentialItem"
    | "SpecialItem"
    | "StickerItem"
    | "SupportItem"
    | "TrainingField"
    | "TrainingItem"
    | "TreasureItem";

export interface DokkanInfoItemAsset {
    remoteUrl: string,
    localPath?: string,
}

export interface DokkanInfoItem {
    key: string,
    id: string,
    itemType: DokkanInfoItemType,
    category: DokkanInfoItemCategorySlug,
    name: string,
    description?: string,
    value?: number,
    sourcePath: string,
    icon?: DokkanInfoItemAsset,
    background?: DokkanInfoItemAsset,
}

export interface DokkanInfoItemCategory {
    slug: DokkanInfoItemCategorySlug,
    itemType: DokkanInfoItemType,
    name: string,
    sourcePath: string,
    count: number,
    items: DokkanInfoItem[],
}

export interface DokkanInfoItemCatalogDataset {
    generatedAt: string,
    source: "dokkaninfo",
    categoryCount: number,
    itemCount: number,
    failedCategorySlugs: DokkanInfoItemCategorySlug[],
    categories: DokkanInfoItemCategory[],
}

export interface DokkanInfoItemCatalogManifest {
    schemaVersion: number,
    datasetVersion: string,
    generatedAt: string,
    fileName: string,
    compression: "none",
    sha256: string,
    sizeBytes: number,
    itemCount: number,
    categoryCount: number,
}
