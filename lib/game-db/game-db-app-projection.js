"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.projectGameDbCharactersToDokkanpanion = exports.projectGameDbCharacterToDokkanpanion = void 0;
const crypto_1 = require("crypto");
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
function sha256Text(value) {
    return (0, crypto_1.createHash)("sha256").update(value, "utf8").digest("hex");
}
function structuralMarkerKind(sourceToken) {
    if (sourceToken === "once" || sourceToken === "forever")
        return sourceToken;
    if (sourceToken === "up_g")
        return "value_up";
    if (sourceToken === "down_r" || sourceToken === "down_y")
        return "value_down";
    return "unknown";
}
function structuralSourceLines(rawText) {
    const lines = [];
    let start = 0;
    let normalizedLineIndex = 0;
    while (start <= rawText.length) {
        const newline = rawText.slice(start).search(/\r\n|\n|\r/);
        const end = newline < 0 ? rawText.length : start + newline;
        const rawTextLine = rawText.slice(start, end);
        const normalizedLine = (0, scraper_1.cleanMultilineText)(rawTextLine);
        lines.push({
            rawText: rawTextLine,
            start,
            end,
            ...(normalizedLine ? { normalizedLineIndex: normalizedLineIndex++ } : {}),
        });
        if (newline < 0)
            break;
        start = end + (rawText.slice(end, end + 2) === "\r\n" ? 2 : 1);
    }
    return lines;
}
function gameDbPassiveStructuralSource(rawText, normalizedText, context) {
    const rawTextSha256 = sha256Text(rawText);
    const normalizedTextSha256 = sha256Text(normalizedText);
    const stateKey = `${context.characterId}:${context.characterId}:${context.releaseState}`;
    const lines = structuralSourceLines(rawText);
    const evidence = [];
    for (let lineOffset = 0; lineOffset < lines.length; lineOffset += 1) {
        const line = lines[lineOffset];
        const bullet = line.rawText.match(/^(\s*-\s*)(.*)$/);
        if (!bullet)
            continue;
        const markerMatches = [...bullet[2].matchAll(/\{passiveImg:([^}]+)\}/g)];
        if (markerMatches.length === 0)
            continue;
        let endLineOffset = lineOffset;
        let anchorEnd = line.end;
        while (endLineOffset + 1 < lines.length) {
            const nextLine = lines[endLineOffset + 1];
            if (/^\s*(?:-|\*)\s*/.test(nextLine.rawText))
                break;
            endLineOffset += 1;
            anchorEnd = nextLine.end;
        }
        const anchorStart = line.start + bullet[1].length;
        const structuralText = rawText.slice(anchorStart, anchorEnd).trimEnd();
        const anchorMarkerMatches = [...structuralText.matchAll(/\{passiveImg:([^}]+)\}/g)];
        const normalizedAnchorText = (0, scraper_1.cleanMultilineText)(structuralText)
            .replace(/^\s*-\s*/, "")
            .replace(/\s*\n\s*/g, " ")
            .replace(/\s+/g, " ")
            .trim();
        const coveredLines = lines.slice(lineOffset, endLineOffset + 1)
            .filter(item => item.normalizedLineIndex !== undefined);
        if (!normalizedAnchorText || coveredLines.length === 0)
            continue;
        const markers = anchorMarkerMatches.map((match, order) => {
            const sourceToken = match[1];
            const markerKind = structuralMarkerKind(sourceToken);
            const start = anchorStart + (match.index ?? 0);
            return {
                order,
                sourceToken,
                markerKind,
                resolution: markerKind === "unknown" ? "unresolved" : "supported",
                sourceSpan: { start, end: start + match[0].length },
            };
        });
        const resolution = markers.every(marker => marker.resolution === "supported")
            ? "supported"
            : markers.every(marker => marker.resolution === "unresolved")
                ? "unresolved"
                : "partial";
        evidence.push({
            kind: "effect_markers",
            id: `${stateKey}:passive:${context.passiveSkillId}:${anchorStart}`,
            stateKey,
            characterId: context.characterId,
            formId: context.characterId,
            releaseState: context.releaseState,
            channel: "passive",
            passiveSkillId: context.passiveSkillId,
            rawTextSha256,
            normalizedTextSha256,
            anchor: {
                lineIndex: coveredLines[0].normalizedLineIndex,
                ...(coveredLines.length > 1
                    ? { endLineIndex: coveredLines[coveredLines.length - 1].normalizedLineIndex }
                    : {}),
                normalizedText: normalizedAnchorText,
                structuralText,
                sourceSpan: { start: anchorStart, end: anchorEnd },
            },
            markers,
            resolution,
            provenance: {
                source: "first_party_game_db",
                sourceVersion: context.sourceVersion,
                payloadField: context.payloadField,
                markerSyntax: "passiveImg",
            },
        });
    }
    return evidence.length > 0 ? { rawText, rawTextSha256, normalizedTextSha256, evidence } : undefined;
}
function passiveDescription(passiveSkillSet) {
    if (passiveSkillSet?.itemizedDescription) {
        return { rawText: passiveSkillSet.itemizedDescription, payloadField: "passive_skill_sets.itemized_description" };
    }
    if (passiveSkillSet?.groupItemizedDescription) {
        return { rawText: passiveSkillSet.groupItemizedDescription, payloadField: "passive_skill_sets.group_itemized_description" };
    }
    return {
        rawText: passiveSkillSet?.characterItemizedDescription ?? "",
        payloadField: "passive_skill_sets.character_itemized_description",
    };
}
function passiveDetailsFromSkillSet(passiveSkillSet, context) {
    const { rawText, payloadField } = passiveDescription(passiveSkillSet);
    const text = (0, scraper_1.cleanMultilineText)(rawText);
    if (!text) {
        return undefined;
    }
    const lines = linesFromText(text);
    const structuralSource = context && passiveSkillSet
        ? gameDbPassiveStructuralSource(rawText, text, {
            ...context,
            payloadField,
            passiveSkillId: passiveSkillSet.id,
        })
        : undefined;
    return {
        name: passiveSkillSet?.name,
        text,
        lines,
        sections: lines ? (0, scraper_1.splitPassiveSections)(lines) : undefined,
        ...(structuralSource ? { structuralSource } : {}),
        sourceSkillId: passiveSkillSet?.id,
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
function activeSkillDetails(character) {
    const details = character.activeSkillSets.map(activeSkillSet => ({
        id: activeSkillSet.id,
        name: activeSkillSet.name,
        description: activeSkillSet.effectDescription,
        condition: activeSkillSet.conditionDescription || undefined,
        turn: activeSkillSet.turn,
        executionLimit: activeSkillSet.execLimit,
        ...(activeSkillSet.activationCondition
            ? { activationCondition: activeSkillSet.activationCondition }
            : {}),
        ultimateSpecialId: activeSkillSet.ultimateSpecialId,
        ultimateAttack: activeSkillSet.ultimateAttack
            ? { ...activeSkillSet.ultimateAttack, provenance: { ...activeSkillSet.ultimateAttack.provenance } }
            : undefined,
        effects: activeSkillSet.effects.map(effect => ({
            id: effect.id,
            efficacyType: effect.efficacyType,
            targetType: effect.targetType,
            subTargetTypeSetId: effect.subTargetTypeSetId,
            calculationOption: effect.calcOption,
            valuesJson: effect.values === undefined ? undefined : JSON.stringify(effect.values),
            efficacyValuesJson: effect.efficacyValues === undefined
                ? undefined
                : JSON.stringify(effect.efficacyValues),
            provenance: { ...effect.provenance },
        })),
        source: {
            kind: "game_db",
            relation: { ...activeSkillSet.provenance.relation },
            set: { ...activeSkillSet.provenance.set },
        },
    }));
    return details.length > 0 ? details : undefined;
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
function displayAttackIncreaseAdjustment(attack) {
    const candidates = attack.effects.filter(effect => {
        const atkValue = Number(effect.values[0]);
        const defValue = Number(effect.values[1]);
        const rawCondition = effect.causalityConditionsRaw?.trim();
        return effect.type === "Special::NormalEfficacySpecial"
            && effect.efficacyType === 3
            && effect.targetType === 2
            && effect.calcOption === 2
            && effect.probability === 100
            && Number.isSafeInteger(effect.turn) && effect.turn > 0
            && Number.isSafeInteger(atkValue) && atkValue > 0 && atkValue <= 100
            && atkValue === defValue
            && (!rawCondition || rawCondition === "[]");
    });
    return candidates.length === 1 ? Number(candidates[0].values[0]) : 0;
}
function mapSuperAttackDetails(superAttacks, maxSaLevel, includeAttackIncrease = true) {
    return superAttacks.map(attack => {
        const rawLevel1Percent = attack.increaseRate;
        const displayAdjustment = displayAttackIncreaseAdjustment(attack);
        const level1Percent = rawLevel1Percent === undefined
            ? undefined
            : rawLevel1Percent + displayAdjustment;
        const levelBonus = attack.levelBonus;
        const maxLevel = includeAttackIncrease ? maxSaLevel : undefined;
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
            description: (0, scraper_1.cleanMultilineText)(attack.description),
            condition: (0, scraper_1.cleanMultilineText)(attack.conditionDescription),
            variant: attack.variant,
            requiredKi: attack.requiredKi,
            ...(attackIncrease ? { attackIncrease } : {}),
        };
    });
}
function fallbackInitialReleaseState(character) {
    return character.releaseStates?.initial ?? {
        releaseState: "initial",
        maxLevel: character.baseMaxLevel,
        maxSaLevel: character.baseMaxSaLevel,
        leaderSkill: character.leaderSkill,
        passiveSkillSet: character.passiveSkillSet,
        superAttacks: character.superAttacks,
    };
}
function projectGameDbCharacterToDokkanpanion(character, options = {}) {
    const initialReleaseState = fallbackInitialReleaseState(character);
    const ezaReleaseState = character.releaseStates?.eza;
    const sezaReleaseState = character.releaseStates?.seza;
    const leaderSkill = initialReleaseState.leaderSkill?.description ?? "";
    const ezaLeaderSkill = ezaReleaseState?.leaderSkill?.description;
    const leaderSkillDetails = (0, scraper_1.parseLeaderSkillDetails)(leaderSkill);
    const ezaLeaderSkillDetails = ezaLeaderSkill ? (0, scraper_1.parseLeaderSkillDetails)(ezaLeaderSkill) : undefined;
    const passiveContext = options.sourceVersion
        ? { characterId: character.id, sourceVersion: options.sourceVersion }
        : undefined;
    const passiveDetails = passiveDetailsFromSkillSet(initialReleaseState.passiveSkillSet, passiveContext ? { ...passiveContext, releaseState: "initial" } : undefined);
    const ezaPassiveDetails = passiveDetailsFromSkillSet(ezaReleaseState?.passiveSkillSet, passiveContext ? { ...passiveContext, releaseState: "eza" } : undefined);
    const sezaPassiveDetails = passiveDetailsFromSkillSet(sezaReleaseState?.passiveSkillSet, passiveContext ? { ...passiveContext, releaseState: "seza" } : undefined);
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
        title: initialReleaseState.leaderSkill?.name ?? "",
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
        maxLevel: initialReleaseState.maxLevel,
        maxSALevel: initialReleaseState.maxSaLevel,
        leaderSkill,
        ezaLeaderSkill,
        leaderSkillBoost: leaderSkillDetails?.displayBoost,
        ezaLeaderSkillBoost: ezaLeaderSkillDetails?.displayBoost,
        leaderSkillDetails,
        ezaLeaderSkillDetails,
        passive,
        passiveDetails,
        ezaPassive: ezaPassiveDetails?.text,
        ezaPassiveDetails,
        sezaPassive: sezaPassiveDetails?.text,
        sezaPassiveDetails,
        superAttackDetails: mapSuperAttackDetails(initialReleaseState.superAttacks, initialReleaseState.maxSaLevel, Boolean(character.releaseStates) || character.growthSteps.length === 0),
        ezaSuperAttackDetails: ezaReleaseState
            ? mapSuperAttackDetails(ezaReleaseState.superAttacks, ezaReleaseState.maxSaLevel)
            : undefined,
        activeSkill: activeSkillText(character),
        activeSkillCondition: activeSkillCondition(character),
        activeSkillDetails: activeSkillDetails(character),
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
function projectGameDbCharactersToDokkanpanion(characters, options = {}) {
    return characters.map(character => projectGameDbCharacterToDokkanpanion(character, options));
}
exports.projectGameDbCharactersToDokkanpanion = projectGameDbCharactersToDokkanpanion;
//# sourceMappingURL=game-db-app-projection.js.map