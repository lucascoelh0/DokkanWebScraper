import type {
    Character,
    PassiveDetails,
    PortraitLayers,
    Transformation,
} from "../character";
import type {
    GameDbDokkanpanionProjection,
    GameDbProjectionSuperAttackDetails,
    GameDbProjectionTransformation,
} from "./game-db-app-projection";
import {
    toSuperAttackDetails,
    toUnitSuperAttack,
} from "./game-db-character-release-overlay";

export interface MaterializedPortraitAsset {
    portraitURL: string,
    portraitFilename: string,
    portraitLayers?: PortraitLayers,
}

interface AttackFields {
    superAttack: string,
    superAttackDetails?: ReturnType<typeof toSuperAttackDetails>,
    ultraSuperAttack?: string,
    ultraSuperAttackDetails?: ReturnType<typeof toSuperAttackDetails>,
    exSuperAttack?: string,
    exSuperAttackDetails?: ReturnType<typeof toSuperAttackDetails>,
    unitSuperAttacks?: ReturnType<typeof toUnitSuperAttack>[],
}

interface EzaAttackFields {
    ezaSuperAttack?: string,
    ezaSuperAttackDetails?: ReturnType<typeof toSuperAttackDetails>,
    ezaUltraSuperAttack?: string,
    ezaUltraSuperAttackDetails?: ReturnType<typeof toSuperAttackDetails>,
    ezaExSuperAttack?: string,
    ezaExSuperAttackDetails?: ReturnType<typeof toSuperAttackDetails>,
    ezaUnitSuperAttacks?: ReturnType<typeof toUnitSuperAttack>[],
}

function materializedSuperAttackDetails(attack: GameDbProjectionSuperAttackDetails) {
    const details = toSuperAttackDetails(attack);
    if (!details.type) {
        throw new Error(`game DB Super Attack ${attack.id} has no first-party attack type`);
    }
    return details;
}

function materializedUnitSuperAttack(attack: GameDbProjectionSuperAttackDetails) {
    const details = toUnitSuperAttack(attack);
    if (!details.type) {
        throw new Error(`game DB Unit Super Attack ${attack.id} has no first-party attack type`);
    }
    return details;
}

function mapAttackFields(attacks: GameDbProjectionSuperAttackDetails[] | undefined): AttackFields {
    for (const attack of attacks ?? []) {
        if (!attack.type) {
            throw new Error(`game DB Super Attack ${attack.id} has no first-party attack type`);
        }
    }
    const normal = attacks?.find(attack => attack.variant === "super");
    const ultra = attacks?.find(attack => attack.variant === "ultra");
    const extra = attacks?.find(attack => attack.variant === "extra");
    const units = attacks?.filter(attack => attack.variant === "unit") ?? [];
    return {
        superAttack: normal?.description ?? "",
        ...(normal ? { superAttackDetails: materializedSuperAttackDetails(normal) } : {}),
        ...(ultra ? {
            ultraSuperAttack: ultra.description,
            ultraSuperAttackDetails: materializedSuperAttackDetails(ultra),
        } : {}),
        ...(extra ? {
            exSuperAttack: extra.description,
            exSuperAttackDetails: materializedSuperAttackDetails(extra),
        } : {}),
        ...(units.length > 0 ? { unitSuperAttacks: units.map(materializedUnitSuperAttack) } : {}),
    };
}

function mapEzaAttackFields(attacks: GameDbProjectionSuperAttackDetails[] | undefined): EzaAttackFields {
    if (!attacks?.length) return {};
    const mapped = mapAttackFields(attacks);
    return {
        ...(mapped.superAttackDetails ? {
            ezaSuperAttack: mapped.superAttack,
            ezaSuperAttackDetails: mapped.superAttackDetails,
        } : {}),
        ...(mapped.ultraSuperAttackDetails ? {
            ezaUltraSuperAttack: mapped.ultraSuperAttack,
            ezaUltraSuperAttackDetails: mapped.ultraSuperAttackDetails,
        } : {}),
        ...(mapped.exSuperAttackDetails ? {
            ezaExSuperAttack: mapped.exSuperAttack,
            ezaExSuperAttackDetails: mapped.exSuperAttackDetails,
        } : {}),
        ...(mapped.unitSuperAttacks ? { ezaUnitSuperAttacks: mapped.unitSuperAttacks } : {}),
    };
}

function assertPlayableClass(
    projection: GameDbDokkanpanionProjection,
): asserts projection is GameDbDokkanpanionProjection & { characterClass: Character["characterClass"] } {
    if (projection.characterClass !== "Super" && projection.characterClass !== "Extreme") {
        throw new Error(`game DB character ${projection.id} has no playable class`);
    }
}

function rebindTransformationPassiveDetails(
    details: PassiveDetails | undefined,
    baseCharacterId: string,
    formId: string,
): PassiveDetails | undefined {
    if (!details) return undefined;
    const rebound = JSON.parse(JSON.stringify(details)) as PassiveDetails;
    for (const evidence of rebound.structuralSource?.evidence ?? []) {
        const expectedStateKey = `${formId}:${formId}:${evidence.releaseState}`;
        const expectedEvidenceId = [
            expectedStateKey,
            evidence.channel,
            evidence.passiveSkillId ?? "unknown",
            evidence.anchor.sourceSpan.start,
        ].join(":");
        if (evidence.characterId !== formId || evidence.formId !== formId
            || evidence.stateKey !== expectedStateKey || evidence.id !== expectedEvidenceId
            || evidence.channel !== "passive") {
            throw new Error(`related form ${formId} has mismatched structural passive evidence`);
        }
        evidence.characterId = baseCharacterId;
        evidence.stateKey = `${baseCharacterId}:${evidence.formId}:${evidence.releaseState}`;
        evidence.id = [
            evidence.stateKey,
            evidence.channel,
            evidence.passiveSkillId ?? "unknown",
            evidence.anchor.sourceSpan.start,
        ].join(":");
    }
    for (const evidence of rebound.conditionEvidence ?? []) {
        const expectedStateKey = `${formId}:${formId}:${evidence.releaseState}`;
        if (evidence.characterId !== formId || evidence.formId !== formId
            || evidence.stateKey !== expectedStateKey) {
            throw new Error(`related form ${formId} has mismatched passive condition evidence`);
        }
        evidence.characterId = baseCharacterId;
        evidence.stateKey = `${baseCharacterId}:${evidence.formId}:${evidence.releaseState}`;
    }
    return rebound;
}

function materializeTransformation(
    baseCharacterId: string,
    relation: GameDbProjectionTransformation,
    projection: GameDbDokkanpanionProjection,
    portrait: MaterializedPortraitAsset,
): Transformation {
    assertPlayableClass(projection);
    const attacks = mapAttackFields(projection.superAttackDetails);
    const ezaAttacks = mapEzaAttackFields(projection.ezaSuperAttackDetails);
    return {
        id: projection.id,
        baseCharacterId,
        name: projection.name,
        releaseDate: projection.releaseDate,
        ezaReleaseDate: projection.ezaReleaseDate,
        sezaReleaseDate: projection.sezaReleaseDate,
        isFreeToPlay: projection.isFreeToPlay,
        obtainability: projection.obtainability,
        characterClass: projection.characterClass,
        type: projection.type,
        ...attacks,
        ...ezaAttacks,
        passive: projection.passive,
        passiveDetails: rebindTransformationPassiveDetails(projection.passiveDetails, baseCharacterId, projection.id),
        ezaPassive: projection.ezaPassive,
        ezaPassiveDetails: rebindTransformationPassiveDetails(projection.ezaPassiveDetails, baseCharacterId, projection.id),
        sezaPassive: projection.sezaPassive,
        sezaPassiveDetails: rebindTransformationPassiveDetails(projection.sezaPassiveDetails, baseCharacterId, projection.id),
        activeSkill: projection.activeSkill,
        activeSkillCondition: projection.activeSkillCondition,
        activeSkillDetails: projection.activeSkillDetails,
        transformationCondition: relation.condition,
        domain: projection.domain,
        links: projection.links,
        portraitURL: portrait.portraitURL,
        portraitFilename: portrait.portraitFilename,
        portraitLayers: portrait.portraitLayers,
        portraitSpec: projection.portraitSpec,
        artURL: projection.artURL,
        artFilename: projection.artFilename,
        standbySkill: projection.standbySkill,
        standby: projection.standby,
        finishSkills: projection.finishSkills,
        finishingMove: projection.finishSkills.map(skill => skill.legacyText ?? skill.description),
        reversibleExchange: projection.reversibleExchange,
        transformationSource: relation.source,
        transformationSourceLabel: relation.sourceLabel,
    };
}

export function materializeGameDbCharacter(
    projection: GameDbDokkanpanionProjection,
    projectionById: ReadonlyMap<string, GameDbDokkanpanionProjection>,
    portraitById: ReadonlyMap<string, MaterializedPortraitAsset>,
): Character {
    assertPlayableClass(projection);
    const portrait = portraitById.get(projection.id);
    if (!portrait) throw new Error(`missing materialized portrait for ${projection.id}`);
    const attacks = mapAttackFields(projection.superAttackDetails);
    const ezaAttacks = mapEzaAttackFields(projection.ezaSuperAttackDetails);
    const transformations = projection.transformations.map(relation => {
        const relatedProjection = projectionById.get(relation.id);
        const relatedPortrait = portraitById.get(relation.id);
        if (!relatedProjection) throw new Error(`missing game DB projection for related form ${relation.id}`);
        if (!relatedPortrait) throw new Error(`missing materialized portrait for related form ${relation.id}`);
        return materializeTransformation(projection.id, relation, relatedProjection, relatedPortrait);
    });

    return {
        name: projection.name,
        title: projection.title,
        maxLevel: projection.maxLevel,
        maxSALevel: projection.maxSALevel,
        rarity: projection.rarity,
        releaseDate: projection.releaseDate,
        ezaReleaseDate: projection.ezaReleaseDate,
        sezaReleaseDate: projection.sezaReleaseDate,
        isFreeToPlay: projection.isFreeToPlay,
        obtainability: projection.obtainability,
        characterClass: projection.characterClass,
        type: projection.type,
        cost: projection.cost,
        id: projection.id,
        portraitURL: portrait.portraitURL,
        portraitFilename: portrait.portraitFilename,
        portraitLayers: portrait.portraitLayers,
        portraitSpec: projection.portraitSpec,
        leaderSkill: projection.leaderSkill,
        ezaLeaderSkill: projection.ezaLeaderSkill,
        leaderSkillBoost: projection.leaderSkillBoost,
        leaderSkillDetails: projection.leaderSkillDetails,
        ezaLeaderSkillDetails: projection.ezaLeaderSkillDetails,
        ...attacks,
        ...ezaAttacks,
        passive: projection.passive,
        passiveDetails: projection.passiveDetails,
        ezaPassive: projection.ezaPassive,
        ezaPassiveDetails: projection.ezaPassiveDetails,
        sezaPassive: projection.sezaPassive,
        sezaPassiveDetails: projection.sezaPassiveDetails,
        activeSkill: projection.activeSkill,
        activeSkillCondition: projection.activeSkillCondition,
        activeSkillDetails: projection.activeSkillDetails,
        createdDomain: projection.createdDomain,
        domain: projection.domain,
        links: projection.links,
        categories: projection.categories,
        kiMeter: [],
        artURL: projection.artURL,
        artFilename: projection.artFilename,
        baseHP: projection.baseHP,
        maxLevelHP: projection.maxLevelHP,
        freeDupeHP: 0,
        rainbowHP: 0,
        baseAttack: projection.baseAttack,
        maxLevelAttack: projection.maxLevelAttack,
        freeDupeAttack: 0,
        rainbowAttack: 0,
        baseDefence: projection.baseDefence,
        maxDefence: projection.maxDefence,
        freeDupeDefence: 0,
        rainbowDefence: 0,
        kiMultiplier: "",
        standbySkill: projection.standbySkill,
        finishingMove: projection.finishSkills.map(skill => skill.legacyText ?? skill.description),
        standby: projection.standby,
        finishSkills: projection.finishSkills,
        reversibleExchange: projection.reversibleExchange,
        transformations,
    };
}
