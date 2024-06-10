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
    portraitURL: string,
    portraitFilename: string,
    leaderSkill: string,
    ezaLeaderSkill?: string,
    superAttack: string,
    ezaSuperAttack?: string,
    ultraSuperAttack?: string,
    ezaUltraSuperAttack?: string,
    unitSuperAttacks?: UnitSuperAttack[]; 
    passive: string,
    ezaPassive?: string,
    sezaPassive?: string,
    activeSkill?: string,
    activeSkillCondition?: string,
    ezaActiveSkill?: string,
    ezaActiveSkillCondition?: string,
    transformationCondition?: string,
    domain: string,
    links: string[],
    categories: string[],
    kiMeter: string[],
    artURL: string,
    artFilename: string,
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
    standbySkill: string,
    transformations?: Transformation[],
}

export interface UnitSuperAttack {
    unitSuperAttack: string | undefined;
    unitSuperAttackCondition: string | undefined;
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
    ezaSuperAttack?: string,
    ultraSuperAttack?: string,
    ezaUltraSuperAttack?: string,
    passive: string,
    ezaPassive?: string,
    sezaPassive?: string,
    activeSkill?: string,
    activeSkillCondition?: string,
    domain: string,
    links:string[],
    portraitURL: string,
    portraitFilename: string,
    artURL: string,
    artFilename: string,
    finishingMove: string[],
}