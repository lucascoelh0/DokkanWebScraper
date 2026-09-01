export interface StageDetailAsset {
    remoteUrl?: string,
    localPath?: string,
    objectKey?: string,
    sourcePath?: string,
}

export interface StageDetailImages {
    header?: StageDetailAsset,
    banner?: StageDetailAsset,
    button?: StageDetailAsset,
}

export interface StageDetailSkill {
    id?: string,
    source?: "enemy-skill" | "enemy-round-skill",
    semanticStatus?: "structured-raw" | "partial",
    type?: number,
    values: Array<number | null>,
    target?: number,
    calculation?: number,
    turns?: number,
    chance?: number,
    executionTiming?: number,
    onceOnly?: boolean,
    causalityConditions?: unknown,
    rawEfficacyValues?: unknown,
    name?: string,
    description?: string,
    relatedCardCategoryIds?: string[],
    relatedLinkSkillIds?: string[],
    relatedOptimalAwakeningCategoryIds?: string[],
    relatedPassiveSkillSetIds?: string[],
    cutInPhrase?: string,
    cutInVoiceAssetId?: string,
}

export interface StageDetailEnemyStats {
    status: "official" | "unavailable-in-game-db" | "raw-z-battle-base",
    source: "dokkan-fyi" | "game-db" | "game-db-z-battle",
    hp?: number,
    atk?: number,
    def?: number,
    unknowns?: string[],
}

export interface StageDetailRoundSkillSet {
    id: string,
    effectDescription?: string,
    cancelDescription?: string,
    skills: StageDetailSkill[],
}

export interface StageDetailEnemy {
    id: string,
    battle: number,
    tile: number,
    characterId: string,
    masterCharacterId?: string,
    cardId?: string,
    name: string,
    rarity?: string,
    type?: string,
    thumbnailId?: string,
    portrait?: StageDetailAsset,
    rarityRaw?: number,
    elementRaw?: number,
    hp?: number,
    atk?: number,
    def?: number,
    stats?: StageDetailEnemyStats,
    skills: StageDetailSkill[],
    roundSkillSet?: StageDetailRoundSkillSet,
    turnAttacks?: number,
}

export interface StageDetailBossDrop {
    sourceRowId: string,
    itemType: string,
    itemId: string,
    dropTypeRaw: string,
    cardExpInitial?: number,
    quantityStatus: "unknown",
    chanceStatus: "unknown",
}

export interface StageDetailCategoryBonus {
    sourceRowId: string,
    typeRaw: string,
    cardCategoryId: string,
    rarityTableId: string,
    rarityValues: Record<string, number>,
    semanticStatus: "partial",
    groupName?: string,
    groupDescription?: string,
}

export interface StageDetailItem {
    itemId: string,
    itemType: string,
    quantity?: number,
    cardExpInitial?: number,
}

export interface StageDetailDropPreview {
    sourceRowId: string,
    difficultyValues: number[],
    items: StageDetailItem[],
}

export interface StageDetailChapter {
    id: string,
    name: string,
    opensAt?: string,
}

export interface StageDetailStory {
    id: string,
    name: string,
    priority: number,
    banner?: StageDetailAsset,
}

export interface StageDetailSupportMemoryLink {
    memoryId: string,
    missionIds: string[],
    relation: "direct-stage-condition" | "transitive-mission-condition" | "mission-owner",
}

export interface StageDetailSupportMemoryRelation extends StageDetailSupportMemoryLink {
    targetKind: "quest-level" | "area" | "z-battle",
    targetId: string,
}

export interface StageDetail {
    id: string,
    stageKind?: "quest-level",
    difficultyRaw?: number,
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
    areaCategoryRaw?: number,
    chapter?: StageDetailChapter,
    story?: StageDetailStory,
    startDate?: string,
    areaFirstReleasedAt?: string,
    images: StageDetailImages,
    enemies: StageDetailEnemy[],
    bossDrops?: StageDetailBossDrop[],
    dropPreviews?: StageDetailDropPreview[],
    categoryBonuses?: StageDetailCategoryBonus[],
    supportMemories?: StageDetailSupportMemoryLink[],
    rules?: {
        boostable: boolean,
        sugorokuAuto: boolean,
        battleAuto: boolean,
        cpuOnly: boolean,
        maxVisits?: number,
        resetIntervalDays?: number,
        canIgnoreDifficultyOrder: boolean,
        areaListButtonVisible: boolean,
        questEnemyInfoDisplayTypeRaw: number,
    },
    rewards?: {
        questAnyClearStones?: number,
        questAllClearStones?: number,
        areaAllClearStones?: number,
    },
    mapPresentation?: {
        sugorokuBgmId?: string,
        battleBgmId?: string,
        bossBgmId?: string,
        battleBackgroundId?: string,
        startScriptId?: string,
        finishScriptId?: string,
        diceId?: string,
        puzzleColorId?: string,
        puzzleColorWeights?: Record<"blue" | "green" | "purple" | "red" | "yellow" | "rainbow", number>,
    },
}

export interface StageDetailZBattleEnemyRange {
    id: string,
    ordinal: number,
    startLevel: number,
    endLevel?: number,
    stats: StageDetailEnemyStats,
    escalationTypeIds: {
        hp: string,
        atk: string,
        def: string,
        specialAttack: string,
        card: string,
        performance: string,
        skill: string,
    },
}

export interface StageDetailZBattle {
    id: string,
    typeRaw: string,
    title?: string,
    subtitle?: string,
    startDate?: string,
    endDate?: string,
    enableBattleAuto: boolean,
    effectEscalationTypeId: string,
    priority: number,
    banner?: StageDetailAsset,
    listButton?: StageDetailAsset,
    enemyResourceId?: string,
    eventKeyStartsAt?: string,
    eventKeyEndsAt?: string,
    relatedZBattleStageId?: string,
    unlockConditions?: unknown,
    enemyRanges: StageDetailZBattleEnemyRange[],
    statusCurves: Array<{ escalationTypeId: string, points: Array<{ level: number, value: number }> }>,
    cardEscalations: Array<{
        escalationTypeId: string,
        level: number,
        cardId: string,
        cardName?: string,
    }>,
    skillEscalations: Array<{
        escalationTypeId: string,
        level: number,
        enemySkillId: string,
        name?: string,
        description?: string,
        effectTypeRaw?: number,
        effectValues?: Array<number | null>,
    }>,
    powerupThreshold?: { hp: number, atk: number, def: number, specialAtk: number },
    checkpoints?: Array<{
        id: string,
        level: number,
        stamina: number,
        requiredKeys: number,
        normalRewardTableGroupId: string,
        mainRewardId?: string,
        repeatRewards: StageDetailItem[],
    }>,
    firstRewards?: Array<{
        id: string,
        level: number,
        rewardSetId: string,
        mainRewardId?: string,
        rewards: StageDetailItem[],
    }>,
}

export interface StageDetailsDataset {
    schemaVersion?: number,
    generatedAt: string,
    source: "dokkan.fyi" | "dokkan-game-db",
    sourceSnapshotVersion?: string,
    sourceDatabaseSha256?: string,
    count: number,
    entries: StageDetail[],
    zBattles?: StageDetailZBattle[],
    supportMemoryRelations?: StageDetailSupportMemoryRelation[],
}
