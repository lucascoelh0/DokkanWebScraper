import {
    CharacterExclusiveSkillOrb,
    CharacterExclusiveSkillOrbAcquisition,
    Classes,
    Equipment,
    Rarities,
    Types,
} from "./character";
import { AcquisitionNavigationTarget } from "./acquisition-navigation";

export interface ExclusiveSkillOrbDetailsDataset {
    generatedAt: string,
    source: "dokkan.fyi",
    scannedCharacterCount: number,
    ownerCharacterCount: number,
    count: number,
    failedCharacterIds?: number[],
    entries: ExclusiveSkillOrbDetailsEntry[],
}

export interface ExclusiveSkillOrbDetailsEntry extends CharacterExclusiveSkillOrb {
    ownerCount: number,
    owners: ExclusiveSkillOrbOwnerRef[],
    acquisitionModel: "acquisition-item" | "character-hint" | "unknown",
    acquisitionSummary?: ExclusiveSkillOrbAcquisitionSummary,
    dokkanInfo?: Equipment,
    presentationAssets?: ExclusiveSkillOrbPresentationAssets,
}

export interface ExclusiveSkillOrbPresentationAssets {
    icon?: ExclusiveSkillOrbAssetRef,
    background?: ExclusiveSkillOrbAssetRef,
}

export interface ExclusiveSkillOrbAssetRef {
    remoteUrl: string,
    localPath?: string,
}

export interface ExclusiveSkillOrbOwnerRef {
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
    isFreeToPlay?: boolean,
}

export interface ExclusiveSkillOrbAcquisitionSummary {
    itemKey?: string,
    itemType: string,
    itemId: string,
    sourceModel: "acquisition-item" | "character-hint",
    groupCount: number,
    sourceCount: number,
    groups: ExclusiveSkillOrbAcquisitionGroupEntry[],
    sources: ExclusiveSkillOrbAcquisitionSourceEntry[],
}

export interface ExclusiveSkillOrbAcquisitionGroupEntry {
    groupKey: string,
    groupKind: string,
    title: string,
    groupTitle?: string,
    subtitle?: string,
    imageUrl?: string,
    sourcePath?: string,
    sourceCount: number,
    totalQuantity?: number,
    maxQuantity?: number,
    navigationTarget?: AcquisitionNavigationTarget,
    treasureItemId?: string,
    treasureItemName?: string,
    treasureItemDescription?: string,
    treasureItemImageSuffix?: number,
    priceMin?: number,
    priceMax?: number,
    discountedPriceMin?: number,
    discountedPriceMax?: number,
    sourceKeys: string[],
}

export interface ExclusiveSkillOrbAcquisitionSourceEntry extends CharacterExclusiveSkillOrbAcquisition {
    sourceKey: string,
    groupKey: string,
    groupKind: string,
    title: string,
    subtitle?: string,
    description?: string,
    imageUrl?: string,
    sourcePath?: string,
    navigationTarget?: AcquisitionNavigationTarget,
    missionType?: string,
    eventType?: string,
    eventId?: string,
    eventStageId?: string,
    stageId?: string,
}
