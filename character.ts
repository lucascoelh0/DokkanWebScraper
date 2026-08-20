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
    isFreeToPlay?: boolean,
    obtainability?: CharacterObtainabilityDetails,
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
    sezaPassiveDetails?: PassiveDetails,
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
    standby?: StandbySkillDetails,
    finishSkills?: FinishSkill[],
    reversibleExchange?: ReversibleExchangeDetails,
    exclusiveSkillOrbs?: CharacterExclusiveSkillOrb[],
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

export interface CharacterExclusiveSkillOrb {
    id: string,
    name: string,
    description: string,
    grade?: string,
    reusable?: boolean,
    iconImageId?: string,
    iconURL?: string,
    backgroundURL?: string,
    skills: CharacterExclusiveSkillOrbSkill[],
    acquisition?: CharacterExclusiveSkillOrbAcquisition[],
}

export interface CharacterExclusiveSkillOrbSkill {
    id?: string,
    attribute?: string,
    level?: number,
    hiddenPotentialSkillId?: number | null,
}

export interface CharacterExclusiveSkillOrbAcquisition {
    sourceType: "mission-reward" | "shop-item" | "unknown",
    sourceName?: string,
    missionId?: string,
    missionCategoryId?: string,
    bannerImageUrl?: string,
    quantity?: number,
    shopItemId?: string,
    price?: number,
    discountedPrice?: number,
    treasureItemId?: string,
    treasureItemName?: string,
    treasureItemDescription?: string,
    treasureItemImageSuffix?: number,
    startsAt?: string,
    endsAt?: string,
    isIndefinite?: boolean,
    note?: string,
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
    structuralSource?: EffectStructuralSource;
    sourceAttackId?: string;
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
    sections?: PassiveSection[],
    conditionEvidence?: PassiveConditionEvidence[],
    structuralSource?: EffectStructuralSource,
    sourceSkillId?: string,
}

export type EffectStructuralChannel = "passive" | "super_attack";
export type EffectStructuralMarkerKind =
    | "once"
    | "forever"
    | "value_up"
    | "value_down"
    | "unknown";
export type EffectStructuralAttackVariant = "normal" | "ultra" | "extra" | "unit";

export interface EffectStructuralSource {
    rawText: string,
    rawTextSha256: string,
    normalizedTextSha256: string,
    evidence: EffectStructuralEvidence[],
}

export interface EffectStructuralEvidence {
    kind: "effect_markers",
    id: string,
    stateKey: string,
    characterId: string,
    formId: string,
    releaseState: "initial" | "eza" | "seza",
    channel: EffectStructuralChannel,
    passiveSkillId?: string,
    superAttackId?: string,
    attackVariant?: EffectStructuralAttackVariant,
    rawTextSha256: string,
    normalizedTextSha256: string,
    anchor: EffectStructuralEvidenceAnchor,
    markers: EffectStructuralMarker[],
    resolution: PassiveEvidenceResolution,
    corroboration?: EffectStructuralCorroboration[],
    semanticConflicts?: EffectStructuralSemanticConflict[],
    provenance: EffectStructuralEvidenceProvenance,
}

export interface EffectStructuralSemanticConflict {
    field: "activationLimit" | "duration" | "applicationTrigger" | "stacking" | "cap",
    structuralValue: string,
    competingValue: string,
    competingSource: "explicit_text" | "first_party_game_db" | "documented_domain_rule",
}

export interface EffectStructuralEvidenceAnchor {
    lineIndex: number,
    endLineIndex?: number,
    normalizedText: string,
    structuralText: string,
    sourceSpan: EffectStructuralSourceSpan,
}

export interface EffectStructuralSourceSpan {
    start: number,
    end: number,
}

export interface EffectStructuralMarker {
    order: number,
    sourceToken: string,
    markerKind: EffectStructuralMarkerKind,
    resolution: "supported" | "unresolved",
    sourceSpan: EffectStructuralSourceSpan,
}

export interface EffectStructuralCorroboration {
    source: "first_party_game_db",
    resolution: "corroborating" | "divergent" | "unresolved",
    passiveSkillSetId?: string,
    passiveSkillIds?: string[],
    fields?: Record<string, string | number | boolean>,
    sourceVersion: string,
    reason: string,
}

export interface EffectStructuralEvidenceProvenance {
    source: "dokkan_fyi_payload",
    sourceVersion: string,
    payloadField:
        | "props.character.passive_skill.description"
        | "props.character.extreme_z_awakening.passive_skill.description"
        | "props.character.super_attacks[].description",
    markerSyntax: "passiveImg",
}

export interface PassiveSection {
    label?: string,
    lines: string[],
}

export type PassiveEvidenceResolution = "supported" | "partial" | "unresolved";
export type PassiveEvidenceConnector = "and" | "or";
export type PassiveEnemyStatus = "atk_down" | "def_down" | "stunned" | "super_attack_sealed";

export interface PassiveConditionEvidence {
    kind: "enemy_status",
    stateKey: string,
    characterId: string,
    formId: string,
    releaseState: "initial" | "eza" | "seza",
    passiveSkillId?: string,
    passiveTextSha256: string,
    anchor: PassiveConditionEvidenceAnchor,
    statuses: PassiveEnemyStatusEvidenceItem[],
    connector?: PassiveEvidenceConnector,
    resolution: PassiveEvidenceResolution,
    provenance: PassiveEvidenceProvenance,
}

export interface PassiveConditionEvidenceAnchor {
    lineIndex: number,
    endLineIndex?: number,
    normalizedText: string,
    structuralText: string,
}

export interface PassiveEnemyStatusEvidenceItem {
    order: number,
    sourceToken: string,
    status?: PassiveEnemyStatus,
    resolution: "supported" | "unresolved",
}

export interface PassiveEvidenceProvenance {
    source: "dokkan_fyi_payload",
    sourceVersion: string,
    payloadField:
        | "props.character.passive_skill.description"
        | "props.character.extreme_z_awakening.passive_skill.description",
    markerSyntax: "passiveImg",
}

export interface SuperAttackDetails {
    name?: string,
    effect?: string,
    type?: AttackTypes,
    ki?: number,
    style?: string,
    condition?: string,
    extras?: string[],
    structuralSource?: EffectStructuralSource,
    sourceAttackId?: string,
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

export type TransformationSource =
    | "transformation-path"
    | "active-skill"
    | "standby"
    | "reversible-exchange"
    | "finish-skill"
    | "passive-skill"
    | "unknown";

export type FinishSkillEffectKind =
    | "damage"
    | "buff"
    | "transform"
    | "mixed"
    | "unknown";

export interface FinishSkill {
    id?: string,
    name: string,
    description: string,
    condition: string,
    targetTransformationId?: string,
    effectKind?: FinishSkillEffectKind,
    legacyText?: string,
}

export interface StandbySkillDetails {
    id?: string,
    name: string,
    description: string,
    condition: string,
    targetCharacterId?: string,
    finishSkills: FinishSkill[],
    legacyText?: string,
}

export type CharacterObtainability =
    | "summonable"
    | "freely-obtainable"
    | "stage-reward"
    | "world-tournament-reward"
    | "unknown";

export interface CharacterObtainabilityDetails {
    type: CharacterObtainability,
    isFreeToPlay: boolean,
    hasDirectAcquisitionDetails?: boolean,
}

export interface ReversibleExchangeDetails {
    targetCharacterId: string,
    targetCharacterName?: string,
    condition: string,
    legacyText?: string,
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
    isFreeToPlay?: boolean,
    obtainability?: CharacterObtainabilityDetails,
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
    sezaPassiveDetails?: PassiveDetails,
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
    standby?: StandbySkillDetails,
    finishSkills?: FinishSkill[],
    reversibleExchange?: ReversibleExchangeDetails,
    transformationSource?: TransformationSource,
    transformationSourceLabel?: string,
    dokkanFrontierPassives?: DokkanFrontierPassive[],
    dokkanFrontierGroupPassive?: string,
    dokkanFrontierCharacterPassive?: string,
}
