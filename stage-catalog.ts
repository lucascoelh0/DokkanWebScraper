export type StageCatalogGroupKind =
    | "quest-story-chapter"
    | "quest-story-area"
    | "event-area"
    | "z-battle";

export type StageCatalogEntryKind =
    | "quest-stage"
    | "event-stage"
    | "z-battle-level"
    | "z-battle-checkpoint";

export interface StageCatalogDataset {
    generatedAt: string,
    source: "dokkan.fyi",
    groupCount: number,
    entryCount: number,
    groups: StageCatalogGroup[],
    entries: StageCatalogEntry[],
}

export interface StageCatalogGroup {
    key: string,
    kind: StageCatalogGroupKind,
    id: string,
    title: string,
    parentGroupKey?: string,
    sourcePath?: string,
    imageUrl?: string,
    areaType?: string,
    chapter?: number,
    zBattleId?: string,
    hasSuperStage?: boolean,
}

export interface StageCatalogEntry {
    key: string,
    kind: StageCatalogEntryKind,
    groupKey: string,
    id: string,
    title: string,
    subtitle?: string,
    sourcePath?: string,
    imageUrl?: string,
    chapterId?: string,
    areaId?: string,
    questId?: string,
    zBattleId?: string,
    zBattlePhaseId?: string,
    zBattlePhaseKind?: "normal" | "super",
    level?: number,
    checkpointLevel?: number,
    difficulty?: string,
    stamina?: number,
    requiredKeys?: number,
    rankExp?: number,
    zeni?: number,
    linkSkillLevelUpRate?: number,
}
