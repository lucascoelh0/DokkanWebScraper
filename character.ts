export interface Character {
    name: string,
    title: string,
    maxLevel: number,
    maxSALevel: number,
    rarity: Rarities,
    releaseDate?: string,
    ezaReleaseDate?: string,
    sezaReleaseDate?: string,
    summonable?: string,
    isSummonable?: boolean,
    characterClass: Classes,
    type: Types,
    cost: number,
    id: string,
    legacyId?: string,
    portraitURL: string,
    portraitFilename: string,
    leaderSkill: string,
    ezaLeaderSkill?: string,
    superAttack: string,
    ezaSuperAttack?: string,
    ultraSuperAttack?: string,
    ezaUltraSuperAttack?: string,
    exSuperAttack?: string,
    ezaExSuperAttack?: string,
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
    finishingMove?: string[],
    transformations?: Transformation[],
    awakeningCards?: AwakeningReference[],
    previousAwakenings?: AwakeningReference[],
    nextAwakenings?: AwakeningReference[],
    dokkanFrontierPassives?: DokkanFrontierPassive[],
    dokkanFrontierGroupPassive?: string,
    dokkanFrontierCharacterPassive?: string,
}

export interface UnitSuperAttack {
    unitSuperAttack: string | undefined;
    unitSuperAttackCondition: string | undefined;
}

export interface AwakeningReference {
    id: string,
    legacyId?: string,
    name: string,
    rarity: Rarities,
    characterClass: Classes,
    type: Types,
    releaseDate?: string,
    portraitURL: string,
    artURL: string,
}

export interface DokkanFrontierPassive {
    title?: string,
    originBattleId?: number,
    passive: string,
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
    N = "N",
    R = "R",
    SR = "SR",
    SSR = "SSR",
    UR = "UR",
    LR = "LR"
}

export interface Transformation {
    id: string,
    baseCharacterId: string,
    legacyId?: string,
    name: string,
    releaseDate?: string,
    ezaReleaseDate?: string,
    sezaReleaseDate?: string,
    summonable?: string,
    isSummonable?: boolean,
    characterClass: Classes,
    type: Types,
    superAttack: string,
    ezaSuperAttack?: string,
    ultraSuperAttack?: string,
    ezaUltraSuperAttack?: string,
    exSuperAttack?: string,
    ezaExSuperAttack?: string,
    passive: string,
    ezaPassive?: string,
    sezaPassive?: string,
    activeSkill?: string,
    activeSkillCondition?: string,
    transformationCondition?: string,
    domain: string,
    links:string[],
    portraitURL: string,
    portraitFilename: string,
    artURL: string,
    artFilename: string,
    standbySkill?: string,
    finishingMove: string[],
    dokkanFrontierPassives?: DokkanFrontierPassive[],
    dokkanFrontierGroupPassive?: string,
    dokkanFrontierCharacterPassive?: string,
}
