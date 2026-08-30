"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.materializeGameDbCharacter = void 0;
const game_db_character_release_overlay_1 = require("./game-db-character-release-overlay");
const game_db_transformation_passive_details_1 = require("./game-db-transformation-passive-details");
function materializedSuperAttackDetails(attack) {
    const details = (0, game_db_character_release_overlay_1.toSuperAttackDetails)(attack);
    if (!details.type) {
        throw new Error(`game DB Super Attack ${attack.id} has no first-party attack type`);
    }
    return details;
}
function materializedUnitSuperAttack(attack) {
    const details = (0, game_db_character_release_overlay_1.toUnitSuperAttack)(attack);
    if (!details.type) {
        throw new Error(`game DB Unit Super Attack ${attack.id} has no first-party attack type`);
    }
    return details;
}
function mapAttackFields(attacks) {
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
function mapEzaAttackFields(attacks) {
    if (!attacks?.length)
        return {};
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
function assertPlayableClass(projection) {
    if (projection.characterClass !== "Super" && projection.characterClass !== "Extreme") {
        throw new Error(`game DB character ${projection.id} has no playable class`);
    }
}
function materializeTransformation(baseCharacterId, relation, projection, portrait) {
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
        passiveDetails: (0, game_db_transformation_passive_details_1.rebindTransformationPassiveDetails)(projection.passiveDetails, baseCharacterId, projection.id),
        ezaPassive: projection.ezaPassive,
        ezaPassiveDetails: (0, game_db_transformation_passive_details_1.rebindTransformationPassiveDetails)(projection.ezaPassiveDetails, baseCharacterId, projection.id),
        sezaPassive: projection.sezaPassive,
        sezaPassiveDetails: (0, game_db_transformation_passive_details_1.rebindTransformationPassiveDetails)(projection.sezaPassiveDetails, baseCharacterId, projection.id),
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
function materializeGameDbCharacter(projection, projectionById, portraitById) {
    assertPlayableClass(projection);
    const portrait = portraitById.get(projection.id);
    if (!portrait)
        throw new Error(`missing materialized portrait for ${projection.id}`);
    const attacks = mapAttackFields(projection.superAttackDetails);
    const ezaAttacks = mapEzaAttackFields(projection.ezaSuperAttackDetails);
    const transformations = projection.transformations.map(relation => {
        const relatedProjection = projectionById.get(relation.id);
        const relatedPortrait = portraitById.get(relation.id);
        if (!relatedProjection)
            throw new Error(`missing game DB projection for related form ${relation.id}`);
        if (!relatedPortrait)
            throw new Error(`missing materialized portrait for related form ${relation.id}`);
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
exports.materializeGameDbCharacter = materializeGameDbCharacter;
//# sourceMappingURL=game-db-character-materializer.js.map