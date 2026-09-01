import { AcquisitionNavigationTarget } from "./acquisition-navigation";
import { AcquisitionSourceKind, AcquisitionStageReference } from "./acquisition";
import { AcquisitionSourceGroupKind } from "./acquisition-source-index";
import { SupportMemory } from "./support-memory";
import {
    SupportMemoryDokkanInfoAnimationAssetSet,
    SupportMemoryDokkanInfoAssetQuantityRef,
    SupportMemoryDokkanInfoAssetRef,
    SupportMemoryDokkanInfoEnhancementItem,
    SupportMemoryDokkanInfoLevelDescription,
    SupportMemoryDokkanInfoRequiredFilmRef,
} from "./support-memory-dokkaninfo-enrichment";

export interface SupportMemoryDetailsDataset {
    generatedAt: string,
    source: "dokkan.fyi" | "dokkan-game-db",
    count: number,
    entries: SupportMemoryDetailsEntry[],
}

export interface SupportMemoryDetailsEntry extends SupportMemory {
    filmName?: string,
    categoryIds: string[],
    categoryNames: string[],
    categoryTargetSource?: "game-db-structural",
    applicableCharacterIds: string[],
    applicableCharacterSource?: "game-db-structural",
    presentationSource?: "game-assets",
    unlockMethod: SupportMemoryUnlockMethod,
    unlockAcquisition?: SupportMemoryAcquisitionSummary,
    filmAcquisition?: SupportMemoryAcquisitionSummary,
    dokkanInfo?: SupportMemoryDokkanInfoPresentation,
}

export interface SupportMemoryDokkanInfoPresentation {
    detailUrl: string,
    levelDescriptions: SupportMemoryDokkanInfoLevelDescription[],
    largeAsset?: SupportMemoryDokkanInfoAssetRef,
    completeAsset?: SupportMemoryDokkanInfoAssetQuantityRef,
    requiredFilm?: SupportMemoryDokkanInfoRequiredFilmRef,
    enhancementItems: SupportMemoryDokkanInfoEnhancementItem[],
    animation?: SupportMemoryDokkanInfoAnimationAssetSet,
}

export type SupportMemoryUnlockMethod =
    | "direct-item"
    | "mission-fallback"
    | "film-only"
    | "unknown";

export interface SupportMemoryAcquisitionSummary {
    itemKey: string,
    itemType: string,
    itemId: string,
    sourceModel: "acquisition-item" | "mission-fallback",
    requiredQuantity?: number,
    groupCount: number,
    sourceCount: number,
    groups: SupportMemoryAcquisitionGroupEntry[],
    sources: SupportMemoryAcquisitionSourceEntry[],
}

export interface SupportMemoryAcquisitionGroupEntry {
    groupKey: string,
    groupKind: AcquisitionSourceGroupKind,
    title: string,
    groupTitle?: string,
    subtitle?: string,
    imageUrl?: string,
    sourcePath?: string,
    sourceCount: number,
    totalQuantity?: number,
    maxQuantity?: number,
    satisfiesRequiredQuantity?: boolean,
    navigationTarget?: AcquisitionNavigationTarget,
    sourceKeys: string[],
}

export interface SupportMemoryAcquisitionSourceEntry {
    sourceKey: string,
    sourceKind: AcquisitionSourceKind,
    groupKey: string,
    groupKind: AcquisitionSourceGroupKind,
    title: string,
    subtitle?: string,
    description?: string,
    quantity?: number,
    imageUrl?: string,
    sourcePath?: string,
    startsAt?: string,
    endsAt?: string,
    navigationTarget?: AcquisitionNavigationTarget,
    stageReferences?: AcquisitionStageReference[],
    officialStageRelations?: SupportMemoryOfficialStageRelation[],
}

export interface SupportMemoryOfficialStageRelation {
    targetKind: "quest-level" | "area" | "z-battle",
    targetId: string,
    relation: "direct-stage-condition" | "transitive-mission-condition" | "mission-owner",
}
