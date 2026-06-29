import { Classes, Rarities, Types } from "./character";

export interface CategoryDataset {
    generatedAt: string,
    source: string,
    count: number,
    categories: CategoryEntry[],
}

export interface CategoryEntry {
    id: string,
    name: string,
    leaders: CategoryCharacterRef[],
    support: CategoryCharacterRef[],
    supportMemories: CategorySupportMemoryRef[],
    members?: CategoryCharacterRef[],
}

export interface CategoryCharacterRef {
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
    leaderSkillId?: string,
    leaderSkillName?: string,
    leaderSkillDescription?: string,
}

export interface CategorySupportMemoryRef {
    id: string,
    name: string,
    description: string,
    supportFilmId?: string,
    cost?: number,
    unlockQuantity?: number,
}
