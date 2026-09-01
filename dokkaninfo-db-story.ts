import { DokkanInfoEventMissionReference, DokkanInfoEventReward } from "./dokkaninfo-event-reward";

export type DokkanInfoEnemyDataStatus = "available" | "not-provided" | "fetch-failed";
export type DokkanInfoQuestEventType = "dbstories" | "story";

export interface DokkanInfoDbStoryDataset {
    schemaVersion: "1.0.0",
    generatedAt: string,
    source: "dokkaninfo",
    eventType: DokkanInfoQuestEventType,
    sourcePath: string,
    storyCount: number,
    stageCount: number,
    enemyCount: number,
    stagesWithoutEnemyData: number,
    failedStoryIds?: string[],
    failedStageIds?: string[],
    stories: DokkanInfoDbStory[],
}

export interface DokkanInfoDbStory {
    id: string,
    type: DokkanInfoQuestEventType,
    name: string,
    sourcePath: string,
    imagePath?: string,
    missions: DokkanInfoEventMissionReference[],
    rewards: DokkanInfoEventReward[],
    stages: DokkanInfoDbStoryStage[],
}

export interface DokkanInfoDbStoryStage {
    id: string,
    title: string,
    level?: number,
    difficulty?: string,
    stamina?: number,
    userExp?: number,
    zeni?: number,
    linkLevelRate?: number,
    sourcePath: string,
    enemyDataStatus: DokkanInfoEnemyDataStatus,
    enemies: DokkanInfoQuestEnemy[],
}

export interface DokkanInfoQuestEnemy {
    source: "dokkaninfo",
    sequence: number,
    group: number,
    name?: string,
    cardReferenceId?: string,
    cardReferencePath?: string,
    portraitPath?: string,
    typeCode?: string,
    typeIconPath?: string,
    stats: DokkanInfoQuestEnemyStats,
    superAttack?: DokkanInfoQuestEnemySuperAttack,
    skills?: DokkanInfoQuestEnemySkills,
}

export interface DokkanInfoQuestEnemyStats {
    hp?: number,
    atk?: number,
    def?: number,
    damageReductionPercent?: number,
    maxAttacksPerTurn?: number,
}

export interface DokkanInfoQuestEnemySuperAttack {
    name: string,
    description?: string,
    typeCode?: string,
    damage?: number,
    chancePercent?: number,
    maxPerTurn?: number,
    cooldown?: number,
}

export interface DokkanInfoQuestEnemySkills {
    text?: string,
    icons: DokkanInfoQuestEnemySkillIcon[],
}

export interface DokkanInfoQuestEnemySkillIcon {
    alt?: string,
    path: string,
}
