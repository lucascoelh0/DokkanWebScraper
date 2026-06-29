import { Classes, Rarities, Types } from "./character";

export interface TeamContextDataset {
    generatedAt: string,
    source: "dokkan.fyi",
    categoryCount: number,
    characterCount: number,
    supportMemoryCount: number,
    leaderCount: number,
    supportUnitCount: number,
    categories: TeamContextCategoryEntry[],
    characters: TeamContextCharacterEntry[],
    supportMemories: TeamContextSupportMemoryEntry[],
}

export interface TeamContextCategoryEntry {
    id: string,
    name: string,
    leaders: TeamContextCharacterRef[],
    supportUnits: TeamContextCharacterRef[],
    supportMemories: TeamContextSupportMemoryRef[],
}

export interface TeamContextCharacterEntry {
    id: string,
    name: string,
    title?: string,
    categories: TeamContextCategoryRef[],
    leaderOfCategories: TeamContextCategoryRef[],
    supportOfCategories: TeamContextCategoryRef[],
    applicableSupportMemories: TeamContextSupportMemoryRef[],
}

export interface TeamContextSupportMemoryEntry {
    id: string,
    name: string,
    description: string,
    filmId?: string,
    filmName?: string,
    cost?: number,
    unlockQuantity?: number,
    lastsEntireBattle?: boolean,
    maxLevel: number,
    categories: TeamContextCategoryRef[],
    applicableCharacterIds: string[],
}

export interface TeamContextCategoryRef {
    id: string,
    name: string,
}

export interface TeamContextCharacterRef {
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

export interface TeamContextSupportMemoryRef {
    id: string,
    name: string,
    description: string,
    filmId?: string,
    filmName?: string,
    cost?: number,
    unlockQuantity?: number,
    lastsEntireBattle?: boolean,
    maxLevel?: number,
}
