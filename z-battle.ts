import { Classes, Rarities, Types } from "./character";

export interface ZBattleDataset {
    generatedAt: string,
    source: string,
    count: number,
    battles: ZBattle[],
}

export interface ZBattle {
    id: string,
    name: string,
    nickname: string,
    sourceUrl: string,
    hasSuperStage: boolean,
    phases: ZBattlePhase[],
}

export interface ZBattlePhase {
    id: string,
    kind: "normal" | "super",
    type: string,
    images: ZBattleImages,
    enemies: ZBattleEnemyProfile[],
    beneficialItems: ZBattleBeneficialItem[],
    ezaCharacters: ZBattleCharacterRef[],
    levels: ZBattleLevel[],
    rewardCheckpoints: ZBattleRewardCheckpoint[],
    missionCategories: ZBattleMissionCategory[],
}

export interface ZBattleImages {
    bannerPath?: string,
    bannerUrl?: string,
    buttonPath?: string,
    buttonUrl?: string,
}

export interface ZBattleCharacterRef {
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
    leaderSkillName?: string,
    latestReleaseType?: string,
    hasEza?: boolean,
    hasSeza?: boolean,
    isReversiblyExchanged?: boolean,
    isFreelyObtainable?: boolean,
}

export interface ZBattleEnemyProfile {
    id: string,
    baseHp?: number,
    baseAttack?: number,
    baseDefence?: number,
    cardEscalations: ZBattleCardEscalation[],
    skillEscalations: ZBattleSkillEscalation[],
    hpEscalations: ZBattleValueEscalation[],
    attackEscalations: ZBattleValueEscalation[],
    defenceEscalations: ZBattleValueEscalation[],
}

export interface ZBattleCardEscalation {
    id?: string,
    level: number,
    card?: ZBattleCharacterRef,
}

export interface ZBattleSkillEscalation {
    id?: string,
    level: number,
    skill?: ZBattleEnemySkill,
}

export interface ZBattleValueEscalation {
    id?: string,
    level: number,
    value: number,
}

export interface ZBattleLevel {
    level: number,
    enemyCard?: ZBattleCharacterRef,
    hp?: number,
    attack?: number,
    defence?: number,
    skills: ZBattleEnemySkill[],
    firstRewards: ZBattleRewardItem[],
}

export interface ZBattleEnemySkill {
    id?: string,
    effectType?: number,
    name: string,
    description: string,
    values: number[],
    target?: number,
    calculation?: number,
    turns?: number,
    chance?: number,
    transformationDescription?: string,
    scriptName?: string,
}

export interface ZBattleRewardCheckpoint {
    id?: string,
    level: number,
    rewards: ZBattleRewardItem[],
}

export interface ZBattleRewardItem {
    id?: string,
    itemType: string,
    itemId?: string,
    quantity: number,
    name?: string,
    description?: string,
    rewardType?: string,
    amount?: number,
    rarity?: number,
    zeni?: number,
}

export interface ZBattleBeneficialItem {
    efficacyType?: number,
    label: string,
    categories: ZBattleNamedRef[],
    linkSkills: ZBattleNamedRef[],
}

export interface ZBattleNamedRef {
    id?: string,
    name: string,
}

export interface ZBattleMissionCategory {
    id: string,
    type: string,
    endsAt?: string,
    isIndefinite: boolean,
    priority?: number,
    imageUrl?: string,
    missionsCount?: number,
    completedCount?: number,
    rewards: ZBattleRewardItem[],
}
