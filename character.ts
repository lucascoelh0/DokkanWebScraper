export interface Character {
    name: string,
    title: string,
    maxLevel: number,
    maxSALevel: number,
    rarity: Rarities,
    characterClass: Classes,
    type: Types,
    cost: number,
    id: string,
    imageURL: string,
    leaderSkill: string,
    ezaLeaderSkill?: string,
    superAttack: string,
    ezaSuperAttack?: string,
    ultraSuperAttack?: string,
    ezaUltraSuperAttack?: string,
    passive: string,
    ezaPassive?: string,
    activeSkill?: string,
    activeSkillCondition?: string,
    ezaActiveSkill?: string,
    ezaActiveSkillCondition?: string,
    transformationCondition?: string,
    links: string[],
    categories: string[],
    kiMeter: string[],
    artURL: string,
    baseHP: number,
    maxLevelHP: number,
    freeDupeHP: number,
    rainbowHP: number,
    baseAttack: number,
    maxLevelAttack: number,
    freeDupeAttack: number,
    rainbowAttack: number,
    baseDefence: number,
    maxDefence: number,
    freeDupeDefence: number,
    rainbowDefence: number,
    kiMultiplier: string,
    transformations?: Transformation[]
}

export enum Classes {
    Super = "Super",
    Extreme = "Extreme"
}

export enum Types {
    PHY = "PHY",
    STR = "STR",
    AGL = "AGL",
    TEQ = "TEQ",
    INT = "INT"
}

export enum Rarities {
    UR = "UR",
    LR = "LR"
}

export interface Transformation {
    id: string,
    baseCharacterId: string,
    name: string,
    characterClass: Classes,
    type: Types,
    superAttack: string,
    eZASuperAttack?: string,
    ultraSuperAttack?: string,
    eZAUltraSuperAttack?: string,
    passive: string,
    eZAPassive?: string,
    activeSkill?: string,
    activeSkillCondition?: string,
    links:string[],
    imageURL: string,
    artURL: string,
}