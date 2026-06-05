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
    portraitSpec?: PortraitSpec,
    leaderSkill: string,
    ezaLeaderSkill?: string,
    leaderSkillBoost?: number,
    leaderSkillDetails?: LeaderSkillDetails,
    ezaLeaderSkillDetails?: LeaderSkillDetails,
    superAttack: string,
    ezaSuperAttack?: string,
    ultraSuperAttack?: string,
    ezaUltraSuperAttack?: string,
    exSuperAttack?: string,
    ezaExSuperAttack?: string,
    unitSuperAttacks?: UnitSuperAttack[]; 
    passive: string,
    passiveDetails?: PassiveDetails,
    ezaPassive?: string,
    ezaPassiveDetails?: PassiveDetails,
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
    extraInfo?: CharacterExtraInfo,
    superAttackDetails?: SuperAttackDetails,
    ezaSuperAttackDetails?: SuperAttackDetails,
    ultraSuperAttackDetails?: SuperAttackDetails,
    ezaUltraSuperAttackDetails?: SuperAttackDetails,
    exSuperAttackDetails?: SuperAttackDetails,
    ezaExSuperAttackDetails?: SuperAttackDetails,
    standbySkill: string,
    finishingMove?: string[],
    transformations?: Transformation[],
    awakeningCards?: AwakeningReference[],
    previousAwakenings?: AwakeningReference[],
    nextAwakenings?: AwakeningReference[],
    equipment?: CharacterEquipmentReference[],
    dokkanFrontierPassives?: DokkanFrontierPassive[],
    dokkanFrontierGroupPassive?: string,
    dokkanFrontierCharacterPassive?: string,
}

export interface Equipment {
    id: string,
    officialId?: number,
    name: string,
    description: string,
    grade?: string,
    hp?: number,
    attack?: number,
    defence?: number,
    sellingExchangePoint?: number,
    count?: number,
    equipmentSkillLimitationSetId?: number,
    iconImageId?: number,
    isEternal?: boolean,
    iconURL?: string,
    iconFilename?: string,
    backgroundURL?: string,
    backgroundFilename?: string,
    restrictions?: EquipmentRestriction[],
    sourcePages?: EquipmentSourcePage[],
}

export interface CharacterEquipmentReference {
    id: string,
    officialId?: number,
    name: string,
    description: string,
    grade?: string,
    hp?: number,
    attack?: number,
    defence?: number,
    sellingExchangePoint?: number,
    count?: number,
    equipmentSkillLimitationSetId?: number,
    iconImageId?: number,
    isEternal?: boolean,
    iconURL?: string,
    iconFilename?: string,
    restrictions?: EquipmentRestriction[],
}

export interface EquipmentRestriction {
    type: 'card' | 'category' | 'character' | 'type' | 'class' | 'other',
    rawDescription?: string,
    cardIds?: string[],
    cardTitles?: string[],
    cardNames?: string[],
    categoryIds?: string[],
    categoryNames?: string[],
    characterIds?: string[],
    characterNames?: string[],
    classes?: Classes[],
    types?: Types[],
}

export interface EquipmentSourcePage {
    type: 'card' | 'category' | 'character' | 'type' | 'class' | 'other',
    id?: string,
    name?: string,
    url: string,
}

export interface UnitSuperAttack {
    name?: string;
    effect?: string;
    type?: AttackTypes;
    ki?: number;
    style?: string;
    unitSuperAttack: string | undefined;
    unitSuperAttackCondition: string | undefined;
}

export interface PortraitSpec {
    iconId: number,
    frameColorId: number,
    rarity: Rarities,
    elementCode: string,
}

export interface PassiveDetails {
    name?: string,
    text?: string,
    lines?: string[],
}

export interface SuperAttackDetails {
    name?: string,
    effect?: string,
    type?: AttackTypes,
    ki?: number,
    style?: string,
    condition?: string,
    extras?: string[],
}

export interface CharacterExtraInfo {
    kiMultiplierText?: string,
    kiMultiplierSteps?: KiMultiplierStep[],
}

export interface LeaderSkillDetails {
    rawText: string,
    displayBoost: number,
    clauses: LeaderSkillClause[],
}

export interface LeaderSkillClause {
    rawText: string,
    stackGroup: 'primary' | 'secondary' | 'additional',
    targetMode: 'base' | 'also-belong',
    categories?: string[],
    types?: string[],
    classes?: string[],
    teamConditions?: LeaderSkillTeamCondition[],
    ki?: number,
    hp: number,
    atk: number,
    def: number,
    boostForm: 'percentage' | 'flat',
}

export interface LeaderSkillTeamCondition {
    rawText: string,
    kind: 'requires-classes' | 'requires-types',
    classes?: string[],
    types?: string[],
    classFilter?: string,
    requiresAll?: boolean,
    requiredCount?: number,
}

export interface KiMultiplierStep {
    ki?: number,
    percent: number,
    label?: string,
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
    portraitSpec?: PortraitSpec,
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

export enum AttackTypes {
    Armed = "Armed",
    Unarmed = "Unarmed",
    KiBlast = "Ki Blast",
    Other = "Other",
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
    superAttackDetails?: SuperAttackDetails,
    ezaSuperAttackDetails?: SuperAttackDetails,
    ultraSuperAttackDetails?: SuperAttackDetails,
    ezaUltraSuperAttackDetails?: SuperAttackDetails,
    exSuperAttackDetails?: SuperAttackDetails,
    ezaExSuperAttackDetails?: SuperAttackDetails,
    passive: string,
    passiveDetails?: PassiveDetails,
    ezaPassive?: string,
    ezaPassiveDetails?: PassiveDetails,
    sezaPassive?: string,
    activeSkill?: string,
    activeSkillCondition?: string,
    transformationCondition?: string,
    domain: string,
    links:string[],
    portraitURL: string,
    portraitFilename: string,
    portraitSpec?: PortraitSpec,
    artURL: string,
    artFilename: string,
    extraInfo?: CharacterExtraInfo,
    standbySkill?: string,
    finishingMove: string[],
    dokkanFrontierPassives?: DokkanFrontierPassive[],
    dokkanFrontierGroupPassive?: string,
    dokkanFrontierCharacterPassive?: string,
}
