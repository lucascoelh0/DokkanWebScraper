"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.projectGameDbCharactersToDokkanpanion = exports.projectGameDbCharacterToDokkanpanion = void 0;
const character_1 = require("../character");
const portrait_asset_contract_1 = require("./portrait-asset-contract");
const scraper_1 = require("../scraper");
function unknownObtainability() {
    return {
        type: "unknown",
        isFreeToPlay: false,
        hasDirectAcquisitionDetails: false,
    };
}
function typeDigit(type) {
    switch (type) {
        case character_1.Types.AGL:
            return 0;
        case character_1.Types.TEQ:
            return 1;
        case character_1.Types.INT:
            return 2;
        case character_1.Types.STR:
            return 3;
        case character_1.Types.PHY:
            return 4;
        default:
            return 0;
    }
}
function portraitSpecForCharacter(character) {
    if (character.raw.element) {
        return (0, portrait_asset_contract_1.portraitSpecFromElement)(character.id, character.rarity, character.raw.element);
    }
    return (0, portrait_asset_contract_1.portraitSpecFromTypeAndClass)(character.id, character.rarity, typeDigit(character.type), character.characterClass === "None" ? "None" : character.characterClass);
}
function linesFromText(text) {
    const lines = text
        .split("\n")
        .map(line => line.trim())
        .filter(Boolean);
    return lines.length > 0 ? lines : undefined;
}
function passiveDetailsFromSnapshot(character) {
    const text = character.passiveSkillSet?.itemizedDescription
        ?? character.passiveSkillSet?.groupItemizedDescription
        ?? character.passiveSkillSet?.characterItemizedDescription
        ?? "";
    if (!text) {
        return undefined;
    }
    return {
        name: character.passiveSkillSet?.name,
        text,
        lines: linesFromText(text),
    };
}
function activeSkillText(character) {
    const primarySet = character.activeSkillSets[0];
    if (!primarySet) {
        return "";
    }
    return [primarySet.name, primarySet.effectDescription].filter(Boolean).join(": ");
}
function activeSkillCondition(character) {
    return character.activeSkillSets[0]?.conditionDescription ?? "";
}
function createdDomainDetails(character) {
    const createdDomain = character.activeSkillSets.find(activeSkillSet => activeSkillSet.createdDomain)?.createdDomain;
    if (!createdDomain) {
        return undefined;
    }
    return {
        semanticStatus: createdDomain.semanticStatus,
        sourceSnapshotId: createdDomain.sourceSnapshotId,
        activeSkillSetId: createdDomain.activeSkillSetId,
        field: { ...createdDomain.field },
        provenance: {
            activeSkillSet: { ...createdDomain.provenance.activeSkillSet },
            relation: { ...createdDomain.provenance.relation },
            field: { ...createdDomain.provenance.field },
        },
    };
}
function transformationSourceFromRelation(relation) {
    switch (relation.kind) {
        case "active-transformation":
        case "active-giant-rage":
            return "active-skill";
        case "standby-transformation":
            return "standby";
        case "finish-transformation":
            return "finish-skill";
        case "passive-reversible-exchange":
            return "reversible-exchange";
        case "passive-transformation":
        case "passive-giant-rage":
            return "passive-skill";
        default:
            return "unknown";
    }
}
function finishSkillEffectKind(finishSkillSet, targetTransformationId) {
    const description = `${finishSkillSet.effectDescription} ${finishSkillSet.conditionDescription}`.toLowerCase();
    const hasTransformationTarget = Boolean(targetTransformationId);
    const mentionsDamage = description.includes("damage");
    const mentionsBuff = /(ki \+\d|atk|def|guards|evad|reduction|effective against)/.test(description);
    if (hasTransformationTarget && (mentionsDamage || mentionsBuff)) {
        return "mixed";
    }
    if (hasTransformationTarget) {
        return "transform";
    }
    if (mentionsDamage && mentionsBuff) {
        return "mixed";
    }
    if (mentionsDamage) {
        return "damage";
    }
    if (mentionsBuff) {
        return "buff";
    }
    return "unknown";
}
function mapFinishSkills(character) {
    return character.finishSkillSets.map(finishSkillSet => {
        const targetRelation = character.formRelations.find(relation => relation.kind === "finish-transformation"
            && relation.sourceSkillSetId === finishSkillSet.id);
        return {
            id: finishSkillSet.id,
            name: finishSkillSet.name,
            description: finishSkillSet.effectDescription,
            condition: finishSkillSet.conditionDescription,
            targetTransformationId: targetRelation?.targetCardId,
            effectKind: finishSkillEffectKind(finishSkillSet, targetRelation?.targetCardId),
            legacyText: [
                finishSkillSet.name,
                finishSkillSet.effectDescription,
                finishSkillSet.conditionDescription ? `Condition: ${finishSkillSet.conditionDescription}` : "",
            ].filter(Boolean).join("\n"),
        };
    });
}
function mapStandby(character, finishSkills) {
    const standbySkillSet = character.standbySkillSets[0];
    if (!standbySkillSet) {
        return undefined;
    }
    const targetRelation = character.formRelations.find(relation => relation.kind === "standby-transformation"
        && relation.sourceSkillSetId === standbySkillSet.id);
    return {
        id: standbySkillSet.id,
        name: standbySkillSet.name,
        description: standbySkillSet.effectDescription,
        condition: standbySkillSet.conditionDescription,
        targetCharacterId: targetRelation?.targetCardId,
        finishSkills,
        legacyText: [standbySkillSet.name, standbySkillSet.effectDescription].filter(Boolean).join(": "),
    };
}
function mapReversibleExchange(character) {
    const relation = character.formRelations.find(item => item.kind === "passive-reversible-exchange");
    if (!relation) {
        return undefined;
    }
    return {
        targetCharacterId: relation.targetCardId,
        targetCharacterName: relation.targetName,
        condition: relation.description ?? "",
        legacyText: relation.description ?? "",
    };
}
function mapTransformations(character) {
    return character.formRelations.map(relation => ({
        id: relation.targetCardId,
        name: relation.targetName,
        source: transformationSourceFromRelation(relation),
        condition: relation.description ?? "",
        sourceLabel: relation.sourceName,
    }));
}
function mapSuperAttackDetails(character) {
    return character.superAttacks.map(attack => {
        const level1Percent = attack.increaseRate;
        const levelBonus = attack.levelBonus;
        // A card with awakening-growth steps has more than one exact SA-level
        // cap. Until the DB state-to-card-special selector is audited, choosing
        // one of those caps here would attach a real curve to the wrong state.
        const maxLevel = character.growthSteps.length === 0
            ? character.baseMaxSaLevel
            : undefined;
        const maxLevelPercent = level1Percent !== undefined && levelBonus !== undefined
            && maxLevel !== undefined
            ? level1Percent + Math.max(maxLevel - 1, 0) * levelBonus
            : undefined;
        const attackIncrease = Number.isSafeInteger(level1Percent)
            && Number.isSafeInteger(levelBonus)
            && Number.isSafeInteger(maxLevel)
            && maxLevel !== undefined
            && maxLevel >= 1
            && Number.isSafeInteger(maxLevelPercent)
            ? {
                level1Percent: level1Percent,
                maxLevelPercent: maxLevelPercent,
                maxLevel,
            }
            : undefined;
        return {
            id: attack.cardSpecialId,
            name: attack.name,
            description: attack.description,
            variant: attack.variant,
            requiredKi: attack.requiredKi,
            ...(attackIncrease ? { attackIncrease } : {}),
        };
    });
}
function projectGameDbCharacterToDokkanpanion(character) {
    const leaderSkill = character.leaderSkill?.description ?? "";
    const leaderSkillDetails = (0, scraper_1.parseLeaderSkillDetails)(leaderSkill);
    const passiveDetails = passiveDetailsFromSnapshot(character);
    const passive = passiveDetails?.text ?? "";
    const finishSkills = mapFinishSkills(character);
    const standby = mapStandby(character, finishSkills);
    const reversibleExchange = mapReversibleExchange(character);
    const createdDomain = createdDomainDetails(character);
    const obtainability = unknownObtainability();
    const portraitFilename = `portrait_${character.id}`;
    const portraitSpec = portraitSpecForCharacter(character);
    return {
        id: character.id,
        source: "game-db-projection",
        name: character.name,
        title: character.leaderSkill?.name ?? "",
        releaseDate: character.releaseDate,
        rarity: character.rarity,
        type: character.type,
        characterClass: character.characterClass,
        cost: character.cost,
        portraitURL: (0, portrait_asset_contract_1.portraitOutputUrl)(portraitFilename),
        portraitFilename,
        portraitSpec,
        artURL: (0, portrait_asset_contract_1.cardArtUrlFromCardId)(character.id),
        artFilename: `art_${character.id}`,
        maxLevel: character.baseMaxLevel,
        maxSALevel: character.baseMaxSaLevel,
        leaderSkill,
        leaderSkillBoost: leaderSkillDetails?.displayBoost,
        leaderSkillDetails,
        passive,
        passiveDetails,
        superAttackDetails: mapSuperAttackDetails(character),
        activeSkill: activeSkillText(character),
        activeSkillCondition: activeSkillCondition(character),
        createdDomain,
        domain: createdDomain?.field.name ?? "",
        standbySkill: standby?.legacyText ?? "",
        standby,
        finishSkills,
        reversibleExchange,
        obtainability,
        isFreeToPlay: obtainability.isFreeToPlay,
        links: character.links.map(link => link.name),
        categories: character.categories.map(category => category.name),
        baseHP: character.stats.hpInitial,
        maxLevelHP: character.stats.hpMax,
        baseAttack: character.stats.atkInitial,
        maxLevelAttack: character.stats.atkMax,
        baseDefence: character.stats.defInitial,
        maxDefence: character.stats.defMax,
        hasEza: character.hasEza,
        hasSeza: character.hasSeza,
        transformations: mapTransformations(character),
    };
}
exports.projectGameDbCharacterToDokkanpanion = projectGameDbCharacterToDokkanpanion;
function projectGameDbCharactersToDokkanpanion(characters) {
    return characters.map(projectGameDbCharacterToDokkanpanion);
}
exports.projectGameDbCharactersToDokkanpanion = projectGameDbCharactersToDokkanpanion;
//# sourceMappingURL=game-db-app-projection.js.map