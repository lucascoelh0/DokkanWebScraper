"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.materializeGameDbCharacter = exports.materializeGameDbCharacterDetail = void 0;
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
function compactAttackFields(attacks) {
    const mapped = mapAttackFields(attacks);
    return {
        ...(mapped.superAttackDetails ? {
            superAttack: mapped.superAttack,
            superAttackDetails: mapped.superAttackDetails,
        } : {}),
        ...(mapped.ultraSuperAttackDetails ? {
            ultraSuperAttack: mapped.ultraSuperAttack,
            ultraSuperAttackDetails: mapped.ultraSuperAttackDetails,
        } : {}),
        ...(mapped.exSuperAttackDetails ? {
            exSuperAttack: mapped.exSuperAttack,
            exSuperAttackDetails: mapped.exSuperAttackDetails,
        } : {}),
        ...(mapped.unitSuperAttacks ? { unitSuperAttacks: mapped.unitSuperAttacks } : {}),
    };
}
function nonBlank(value) {
    return value?.trim() ? value : undefined;
}
function knownCharacterClass(value) {
    return value === "Super" || value === "Extreme" ? value : undefined;
}
function materializeGameDbTransformationDetail(baseCharacterId, relation, projection) {
    const attacks = compactAttackFields(projection.superAttackDetails);
    const ezaAttacks = mapEzaAttackFields(projection.ezaSuperAttackDetails);
    const characterClass = knownCharacterClass(projection.characterClass);
    const obtainability = projection.obtainability.type === "unknown" ? undefined : projection.obtainability;
    const activeSkill = nonBlank(projection.activeSkill);
    const activeSkillCondition = nonBlank(projection.activeSkillCondition);
    const domain = nonBlank(projection.domain);
    const standbySkill = nonBlank(projection.standbySkill);
    const passive = nonBlank(projection.passive);
    const finishingMove = projection.finishSkills.map(skill => skill.legacyText ?? skill.description);
    return {
        id: projection.id,
        baseCharacterId,
        name: projection.name,
        type: projection.type,
        links: projection.links,
        portraitSpec: projection.portraitSpec,
        ...(projection.releaseDate ? { releaseDate: projection.releaseDate } : {}),
        ...(projection.ezaReleaseDate ? { ezaReleaseDate: projection.ezaReleaseDate } : {}),
        ...(projection.sezaReleaseDate ? { sezaReleaseDate: projection.sezaReleaseDate } : {}),
        ...(characterClass ? { characterClass } : {}),
        ...(obtainability ? {
            obtainability,
            isFreeToPlay: projection.isFreeToPlay,
        } : {}),
        ...attacks,
        ...ezaAttacks,
        ...(passive ? { passive } : {}),
        ...(projection.passiveDetails ? {
            passiveDetails: (0, game_db_transformation_passive_details_1.rebindTransformationPassiveDetails)(projection.passiveDetails, baseCharacterId, projection.id),
        } : {}),
        ...(projection.ezaPassive ? { ezaPassive: projection.ezaPassive } : {}),
        ...(projection.ezaPassiveDetails ? {
            ezaPassiveDetails: (0, game_db_transformation_passive_details_1.rebindTransformationPassiveDetails)(projection.ezaPassiveDetails, baseCharacterId, projection.id),
        } : {}),
        ...(projection.sezaPassive ? { sezaPassive: projection.sezaPassive } : {}),
        ...(projection.sezaPassiveDetails ? {
            sezaPassiveDetails: (0, game_db_transformation_passive_details_1.rebindTransformationPassiveDetails)(projection.sezaPassiveDetails, baseCharacterId, projection.id),
        } : {}),
        ...(activeSkill ? { activeSkill } : {}),
        ...(activeSkillCondition ? { activeSkillCondition } : {}),
        ...(projection.activeSkillDetails?.length ? { activeSkillDetails: projection.activeSkillDetails } : {}),
        ...(domain ? { domain } : {}),
        ...(projection.createdDomain ? { createdDomain: projection.createdDomain } : {}),
        ...(standbySkill ? { standbySkill } : {}),
        ...(projection.standby ? { standby: projection.standby } : {}),
        ...(projection.finishSkills.length ? {
            finishSkills: projection.finishSkills,
            finishingMove,
        } : {}),
        ...(projection.reversibleExchange ? { reversibleExchange: projection.reversibleExchange } : {}),
        transformationCondition: relation.condition,
        transformationSource: relation.source,
        ...(relation.sourceLabel ? { transformationSourceLabel: relation.sourceLabel } : {}),
    };
}
/**
 * Materializes an exact first-party card for optional detail consumption.
 * Awakening edges are navigation, not in-battle transformations, so relations
 * that the semantic projection deliberately labels `unknown` stay out of the
 * Character transformation list and remain owned by the awakening graph.
 */
function materializeGameDbCharacterDetail(projection, projectionById) {
    const attacks = compactAttackFields(projection.superAttackDetails);
    const ezaAttacks = mapEzaAttackFields(projection.ezaSuperAttackDetails);
    const characterClass = knownCharacterClass(projection.characterClass);
    const obtainability = projection.obtainability.type === "unknown" ? undefined : projection.obtainability;
    const title = nonBlank(projection.title);
    const leaderSkill = nonBlank(projection.leaderSkill);
    const ezaLeaderSkill = nonBlank(projection.ezaLeaderSkill);
    const passive = nonBlank(projection.passive);
    const activeSkill = nonBlank(projection.activeSkill);
    const activeSkillCondition = nonBlank(projection.activeSkillCondition);
    const domain = nonBlank(projection.domain);
    const standbySkill = nonBlank(projection.standbySkill);
    const transformationRelations = projection.transformations.filter(relation => relation.source !== "unknown");
    const transformations = transformationRelations.map(relation => {
        const relatedProjection = projectionById.get(relation.id);
        if (!relatedProjection) {
            throw new Error(`missing game DB projection for related detail form ${relation.id}`);
        }
        return materializeGameDbTransformationDetail(projection.id, relation, relatedProjection);
    });
    return {
        id: projection.id,
        name: projection.name,
        rarity: projection.rarity,
        type: projection.type,
        cost: projection.cost,
        maxLevel: projection.maxLevel,
        maxSALevel: projection.maxSALevel,
        links: projection.links,
        categories: projection.categories,
        baseHP: projection.baseHP,
        maxLevelHP: projection.maxLevelHP,
        baseAttack: projection.baseAttack,
        maxLevelAttack: projection.maxLevelAttack,
        baseDefence: projection.baseDefence,
        maxDefence: projection.maxDefence,
        portraitSpec: projection.portraitSpec,
        ...(title ? { title } : {}),
        ...(projection.releaseDate ? { releaseDate: projection.releaseDate } : {}),
        ...(projection.ezaReleaseDate ? { ezaReleaseDate: projection.ezaReleaseDate } : {}),
        ...(projection.sezaReleaseDate ? { sezaReleaseDate: projection.sezaReleaseDate } : {}),
        ...(characterClass ? { characterClass } : {}),
        ...(obtainability ? {
            obtainability,
            isFreeToPlay: projection.isFreeToPlay,
        } : {}),
        ...(leaderSkill ? { leaderSkill } : {}),
        ...(ezaLeaderSkill ? { ezaLeaderSkill } : {}),
        ...(projection.leaderSkillBoost !== undefined ? { leaderSkillBoost: projection.leaderSkillBoost } : {}),
        ...(projection.leaderSkillDetails ? { leaderSkillDetails: projection.leaderSkillDetails } : {}),
        ...(projection.ezaLeaderSkillDetails ? { ezaLeaderSkillDetails: projection.ezaLeaderSkillDetails } : {}),
        ...attacks,
        ...ezaAttacks,
        ...(passive ? { passive } : {}),
        ...(projection.passiveDetails ? { passiveDetails: projection.passiveDetails } : {}),
        ...(projection.ezaPassive ? { ezaPassive: projection.ezaPassive } : {}),
        ...(projection.ezaPassiveDetails ? { ezaPassiveDetails: projection.ezaPassiveDetails } : {}),
        ...(projection.sezaPassive ? { sezaPassive: projection.sezaPassive } : {}),
        ...(projection.sezaPassiveDetails ? { sezaPassiveDetails: projection.sezaPassiveDetails } : {}),
        ...(activeSkill ? { activeSkill } : {}),
        ...(activeSkillCondition ? { activeSkillCondition } : {}),
        ...(projection.activeSkillDetails?.length ? { activeSkillDetails: projection.activeSkillDetails } : {}),
        ...(projection.createdDomain ? { createdDomain: projection.createdDomain } : {}),
        ...(domain ? { domain } : {}),
        ...(standbySkill ? { standbySkill } : {}),
        ...(projection.standby ? { standby: projection.standby } : {}),
        ...(projection.finishSkills.length ? {
            finishSkills: projection.finishSkills,
            finishingMove: projection.finishSkills.map(skill => skill.legacyText ?? skill.description),
        } : {}),
        ...(projection.reversibleExchange ? { reversibleExchange: projection.reversibleExchange } : {}),
        ...(transformations.length ? { transformations } : {}),
    };
}
exports.materializeGameDbCharacterDetail = materializeGameDbCharacterDetail;
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