import { Classes, Rarities, Types } from "./character";

export interface AwakeningPathDataset {
    generatedAt: string,
    source: "dokkan.fyi",
    count: number,
    paths: CharacterAwakeningPath[],
}

export interface CharacterAwakeningPath {
    characterId: string,
    canonicalId?: string,
    baseCharacterId?: string,
    name: string,
    rarity?: Rarities,
    type?: Types,
    characterClass?: Classes,
    hasEza?: boolean,
    hasSeza?: boolean,
    steps: AwakeningPathStep[],
}

export interface AwakeningPathStep {
    id: string,
    type?: string,
    ezaType?: number,
    ezaStep?: number,
    characterId?: string,
    character?: AwakeningPathCharacterRef,
    awakenedCharacterId?: string,
    awakenedCharacter?: AwakeningPathCharacterRef,
    requirements: AwakeningPathRequirement[],
}

export interface AwakeningPathRequirement {
    id: string,
    awakeningMedalId?: string,
    quantity: number,
    order?: number,
    awakeningMedal?: AwakeningMedalRef,
}

export interface AwakeningMedalRef {
    id: string,
    name: string,
    description?: string,
    rarity?: number,
    zeni?: number,
    tradePoints?: number,
}

export interface AwakeningPathCharacterRef {
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
    isFreelyObtainable?: boolean,
}

export interface AwakeningMedalDataset {
    generatedAt: string,
    source: "dokkan.fyi",
    count: number,
    medals: AwakeningMedal[],
}

export interface AwakeningMedal {
    id: string,
    name: string,
    description?: string,
    rarity?: number,
    zeni?: number,
    tradePoints?: number,
    usages: AwakeningMedalUsage[],
    stages: AwakeningMedalStageSource[],
    zBattle?: AwakeningMedalZBattleSource,
    babaShopSales: AwakeningMedalBabaShopSale[],
    worldTournaments: AwakeningMedalWorldTournamentSource[],
}

export interface AwakeningMedalUsage {
    id: string,
    itemId?: string,
    quantity: number,
    order?: number,
    awakenings: AwakeningMedalAwakeningUsage[],
}

export interface AwakeningMedalAwakeningUsage {
    id: string,
    characterId?: string,
    character?: AwakeningPathCharacterRef,
    awakenedCharacterId?: string,
    type?: string,
    ezaType?: number,
    ezaStep?: number,
}

export interface AwakeningMedalStageSource {
    id: string,
    difficulty?: string,
    stamina?: number,
    requiredKeys?: number,
    rankExp?: number,
    zeni?: number,
    linkSkillLevelUpRate?: number,
    questId?: string,
    quest?: {
        id: string,
        name: string,
        maxAttempts?: number,
        attemptsResetDays?: number,
        isBoostable?: boolean,
        startDate?: string,
        areaId?: string,
        area?: {
            id: string,
            name: string,
            type?: string,
            chapterId?: string,
            images?: {
                header?: string,
                banner?: string,
                button?: string,
            },
        },
    },
}

export interface AwakeningMedalZBattleSource {
    id: string,
    name?: string,
    type?: string,
    chapterId?: string,
    images?: {
        header?: string,
        banner?: string,
        button?: string,
    },
}

export interface AwakeningMedalBabaShopSale {
    id: string,
    discountedPrice?: number,
    isSale?: boolean,
    isPremium?: boolean,
    buyable?: boolean,
    buyableNum?: number,
    currencyId?: string,
    currencyType?: string,
    price?: number,
    itemId?: string,
    itemType?: string,
    itemQuantity?: number,
    startAt?: string,
    endAt?: string,
    isDisplayRemainingTime?: boolean,
}

export interface AwakeningMedalWorldTournamentSource {
    id: string,
    budokaiRankingGiftSetId?: string,
    description?: string,
    itemType?: string,
    itemId?: string,
    quantity?: number,
    cardExpInit?: number,
    budokaiRankingGiftSet?: {
        id: string,
        budokaiId?: string,
        order?: number,
        ranking?: string,
    },
}
