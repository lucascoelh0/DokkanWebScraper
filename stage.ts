export interface StageImages {
    headerPath?: string,
    headerUrl?: string,
    bannerPath?: string,
    bannerUrl?: string,
    buttonPath?: string,
    buttonUrl?: string,
}

export interface StageDifficulty {
    id: string,
    difficulty: string,
    stamina: number,
    requiredKeys: number,
    rankExp: number,
    zeni: number,
    linkSkillLevelUpRate: number,
    questId: string,
}

export interface StageQuest {
    id: string,
    name: string,
    maxAttempts?: number,
    attemptsResetDays?: number,
    boostable: boolean,
    startDate?: string,
    areaId: string,
    stages: StageDifficulty[],
}

export interface StageArea {
    id: string,
    name: string,
    type: string,
    chapter?: number,
    images: StageImages,
    quests: StageQuest[],
}

export interface StageChapter {
    id: string,
    name: string,
    areas: StageArea[],
}

export interface StageTab {
    id: string,
    name: string,
    limited: boolean,
}

export interface QuestStoryStagesDataset {
    generatedAt: string,
    source: string,
    chapterCount: number,
    areaCount: number,
    questCount: number,
    stageCount: number,
    chapters: StageChapter[],
}

export interface EventStagesDataset {
    generatedAt: string,
    source: string,
    areaCount: number,
    questCount: number,
    stageCount: number,
    tabs: StageTab[],
    areas: StageArea[],
}
