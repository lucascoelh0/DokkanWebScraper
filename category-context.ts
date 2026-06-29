export interface CategoryContextDataset {
    generatedAt: string,
    source: "dokkan.fyi",
    categoryCount: number,
    supportMemoryCount: number,
    characterCount: number,
    categories: CategoryContextEntry[],
    supportMemories: SupportMemoryContextEntry[],
    characters: CharacterCategoryContextEntry[],
}

export interface CategoryContextEntry {
    id: string,
    name: string,
    leaderIds: string[],
    supportIds: string[],
    supportMemoryIds: string[],
}

export interface SupportMemoryContextEntry {
    id: string,
    name: string,
    categoryIds: string[],
    categoryNames: string[],
    applicableCharacterIds: string[],
}

export interface CharacterCategoryContextEntry {
    id: string,
    name: string,
    title?: string,
    categoryIds: string[],
    categoryNames: string[],
    leaderOfCategoryIds: string[],
    supportOfCategoryIds: string[],
    applicableSupportMemoryIds: string[],
}
