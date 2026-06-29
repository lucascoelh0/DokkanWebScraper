import { AcquisitionSourceKind } from "./acquisition";

export type AcquisitionNavigationTargetKind =
    | "mission-catalog-mission"
    | "mission-catalog-group"
    | "stage-catalog-entry"
    | "stage-catalog-group"
    | "awakening-baba-shop-sale"
    | "awakening-world-tournament";

export interface AcquisitionNavigationDataset {
    generatedAt: string,
    source: "dokkan.fyi",
    sourceCount: number,
    entries: AcquisitionNavigationEntry[],
}

export interface AcquisitionNavigationEntry {
    sourceKey: string,
    sourceKind: AcquisitionSourceKind,
    title: string,
    subtitle?: string,
    target: AcquisitionNavigationTarget,
}

export interface AcquisitionNavigationTarget {
    kind: AcquisitionNavigationTargetKind,
    sourcePath?: string,
    missionKey?: string,
    missionGroupKey?: string,
    stageEntryKey?: string,
    stageGroupKey?: string,
    zBattleId?: string,
    zBattlePhaseId?: string,
    level?: number,
    checkpointLevel?: number,
    areaId?: string,
    questId?: string,
    saleId?: string,
    tournamentId?: string,
}
