"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.overlayGameDbCharacterReleaseStates = exports.toUnitSuperAttack = exports.toSuperAttackDetails = void 0;
function cloneCharacters(characters) {
    return JSON.parse(JSON.stringify(characters));
}
function attackStyle(variant) {
    switch (variant) {
        case "super": return "Normal";
        case "ultra": return "Ultra";
        case "extra": return "Extra";
        case "unit": return "Unit";
        default: return undefined;
    }
}
function toSuperAttackDetails(attack, fallback) {
    return {
        name: attack.name,
        effect: attack.description,
        type: fallback?.type,
        ki: attack.requiredKi,
        style: attackStyle(attack.variant) ?? fallback?.style,
        condition: attack.condition,
        sourceAttackId: attack.id,
        attackIncrease: attack.attackIncrease,
    };
}
exports.toSuperAttackDetails = toSuperAttackDetails;
function toUnitSuperAttack(attack, fallback) {
    return {
        name: attack.name,
        effect: attack.description,
        type: fallback?.type,
        ki: attack.requiredKi,
        style: attackStyle(attack.variant) ?? fallback?.style,
        unitSuperAttack: [attack.name, attack.description].filter(Boolean).join(": "),
        unitSuperAttackCondition: attack.condition,
        sourceAttackId: attack.id,
        attackIncrease: attack.attackIncrease,
    };
}
exports.toUnitSuperAttack = toUnitSuperAttack;
function applyEzaSuperAttacks(character, attacks, changedFields) {
    const normal = attacks.find(attack => attack.variant === "super");
    if (normal) {
        character.ezaSuperAttack = normal.description;
        character.ezaSuperAttackDetails = toSuperAttackDetails(normal, character.superAttackDetails);
        changedFields.add("ezaSuperAttack");
        changedFields.add("ezaSuperAttackDetails");
    }
    const ultra = attacks.find(attack => attack.variant === "ultra");
    if (ultra) {
        character.ezaUltraSuperAttack = ultra.description;
        character.ezaUltraSuperAttackDetails = toSuperAttackDetails(ultra, character.ultraSuperAttackDetails);
        changedFields.add("ezaUltraSuperAttack");
        changedFields.add("ezaUltraSuperAttackDetails");
    }
    const extra = attacks.find(attack => attack.variant === "extra");
    if (extra) {
        character.ezaExSuperAttack = extra.description;
        character.ezaExSuperAttackDetails = toSuperAttackDetails(extra, character.exSuperAttackDetails);
        changedFields.add("ezaExSuperAttack");
        changedFields.add("ezaExSuperAttackDetails");
    }
    const unitAttacks = attacks.filter(attack => attack.variant === "unit");
    if (unitAttacks.length > 0) {
        character.ezaUnitSuperAttacks = unitAttacks.map((attack, index) => toUnitSuperAttack(attack, character.unitSuperAttacks?.[index]));
        changedFields.add("ezaUnitSuperAttacks");
    }
}
function applyActiveSkillActivationConditions(character, projection, changedFields) {
    const conditions = projection.activeSkillDetails
        ?.filter(detail => detail.activationCondition)
        .map(detail => ({ id: detail.id, activationCondition: detail.activationCondition }))
        ?? [];
    if (conditions.length === 0)
        return;
    const details = character.activeSkillDetails;
    if (!details?.length) {
        throw new Error(`target ${character.id} has typed Active Skill conditions but no baseline Active Skill details`);
    }
    for (const source of conditions) {
        const matches = details.filter(detail => detail.id === source.id);
        if (matches.length !== 1) {
            throw new Error(`target ${character.id} Active Skill ${source.id} matched ${matches.length} baseline detail rows`);
        }
        const target = matches[0];
        if (target.activationCondition
            && JSON.stringify(target.activationCondition) !== JSON.stringify(source.activationCondition)) {
            throw new Error(`target ${character.id} Active Skill ${source.id} activation condition diverges`);
        }
        if (!target.activationCondition) {
            target.activationCondition = JSON.parse(JSON.stringify(source.activationCondition));
            changedFields.add("activeSkillDetails");
        }
    }
}
function applyProjection(character, projection) {
    const changedFields = new Set();
    applyActiveSkillActivationConditions(character, projection, changedFields);
    if (projection.ezaLeaderSkill) {
        character.ezaLeaderSkill = projection.ezaLeaderSkill;
        character.ezaLeaderSkillDetails = projection.ezaLeaderSkillDetails;
        changedFields.add("ezaLeaderSkill");
        if (projection.ezaLeaderSkillDetails)
            changedFields.add("ezaLeaderSkillDetails");
    }
    if (projection.ezaPassive) {
        character.ezaPassive = projection.ezaPassive;
        character.ezaPassiveDetails = projection.ezaPassiveDetails;
        changedFields.add("ezaPassive");
        if (projection.ezaPassiveDetails)
            changedFields.add("ezaPassiveDetails");
    }
    if (projection.sezaPassive) {
        character.sezaPassive = projection.sezaPassive;
        character.sezaPassiveDetails = projection.sezaPassiveDetails;
        changedFields.add("sezaPassive");
        if (projection.sezaPassiveDetails)
            changedFields.add("sezaPassiveDetails");
    }
    if (projection.ezaSuperAttackDetails?.length) {
        applyEzaSuperAttacks(character, projection.ezaSuperAttackDetails, changedFields);
    }
    return [...changedFields].sort();
}
function overlayGameDbCharacterReleaseStates(baselineCharacters, projections, targetCardIds) {
    const targetIds = new Set(targetCardIds);
    if (targetIds.size !== targetCardIds.length || targetIds.size === 0) {
        throw new Error("release-state overlay requires unique target card IDs");
    }
    const baselineById = new Map();
    baselineCharacters.forEach((character, index) => {
        if (baselineById.has(character.id))
            throw new Error(`duplicate baseline character ${character.id}`);
        baselineById.set(character.id, index);
    });
    const projectionById = new Map();
    for (const projection of projections) {
        if (projectionById.has(projection.id))
            throw new Error(`duplicate game DB projection ${projection.id}`);
        projectionById.set(projection.id, projection);
    }
    for (const cardId of targetIds) {
        if (!baselineById.has(cardId))
            throw new Error(`target ${cardId} is missing from the baseline catalog`);
        if (!projectionById.has(cardId))
            throw new Error(`target ${cardId} is missing from the game DB projection`);
    }
    const baselineBytes = baselineCharacters.map(character => JSON.stringify(character));
    const characters = cloneCharacters(baselineCharacters);
    const patches = [];
    for (const cardId of targetIds) {
        const index = baselineById.get(cardId);
        const fields = applyProjection(characters[index], projectionById.get(cardId));
        if (fields.length === 0)
            throw new Error(`target ${cardId} has no selected first-party game DB fields`);
        patches.push({ cardId, fields });
    }
    const characterOrderPreserved = characters.every((character, index) => character.id === baselineCharacters[index].id);
    const untargetedCharactersUnchanged = characters.every((character, index) => targetIds.has(character.id) || JSON.stringify(character) === baselineBytes[index]);
    if (!characterOrderPreserved || !untargetedCharactersUnchanged || characters.length !== baselineCharacters.length) {
        throw new Error("release-state overlay changed data outside its target scope");
    }
    return {
        characters,
        patches: patches.sort((left, right) => left.cardId.localeCompare(right.cardId, undefined, { numeric: true })),
        checks: {
            characterCountPreserved: true,
            characterOrderPreserved: true,
            untargetedCharactersUnchanged: true,
            everyTargetFoundInBaseline: true,
            everyTargetFoundInGameDb: true,
        },
    };
}
exports.overlayGameDbCharacterReleaseStates = overlayGameDbCharacterReleaseStates;
//# sourceMappingURL=game-db-character-release-overlay.js.map