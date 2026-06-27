export interface SupportMemoryDataset {
    generatedAt: string,
    source: string,
    count: number,
    films: SupportMemoryFilm[],
    supportMemories: SupportMemory[],
}

export interface SupportMemory {
    id: string,
    name: string,
    description: string,
    filmId?: string,
    film?: SupportMemoryFilm,
    cost?: number,
    unlockQuantity?: number,
    lastsEntireBattle?: boolean,
    releaseDate?: string,
    maxLevel: number,
    enhancementChain: SupportMemoryEnhancementStep[],
    effects: SupportMemoryEffect[],
}

export interface SupportMemoryFilm {
    id: string,
    name: string,
    description?: string,
}

export interface SupportMemoryEnhancementStep {
    id?: string,
    level: number,
    supportMemoryId: string,
    enhancedSupportMemoryId: string,
    rootSupportMemoryId: string,
}

export interface SupportMemoryEffect {
    id?: string,
    effectType?: number,
    values: number[],
    target?: number,
    calculation?: number,
    turns?: number,
    chance?: number,
    transformationDescription?: string,
    scriptName?: string,
}
