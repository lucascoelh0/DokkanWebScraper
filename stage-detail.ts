export interface StageDetailAsset {
    remoteUrl: string,
    localPath?: string,
    objectKey?: string,
}

export interface StageDetailImages {
    header?: StageDetailAsset,
    banner?: StageDetailAsset,
    button?: StageDetailAsset,
}

export interface StageDetailSkill {
    type?: number,
    values: Array<number | null>,
    target?: number,
    calculation?: number,
    turns?: number,
    chance?: number,
    name?: string,
    description?: string,
}

export interface StageDetailEnemy {
    id: string,
    battle: number,
    tile: number,
    characterId: string,
    name: string,
    rarity?: string,
    type?: string,
    thumbnailId?: string,
    portrait?: StageDetailAsset,
    hp: number,
    atk: number,
    def: number,
    skills: StageDetailSkill[],
    turnAttacks?: number,
}

export interface StageDetail {
    id: string,
    difficulty: string,
    stamina: number,
    requiredKeys: number,
    rankExp: number,
    zeni: number,
    linkSkillLevelUpRate: number,
    questId: string,
    questName: string,
    areaId: string,
    areaName: string,
    areaType: string,
    startDate?: string,
    images: StageDetailImages,
    enemies: StageDetailEnemy[],
}

export interface StageDetailsDataset {
    generatedAt: string,
    source: "dokkan.fyi",
    count: number,
    entries: StageDetail[],
}
