import {
    Classes,
    ActiveSkillDetails,
    CharacterObtainabilityDetails,
    CreatedDomainDetails,
    FinishSkill,
    FinishSkillEffectKind,
    LeaderSkillDetails,
    PassiveDetails,
    PortraitSpec,
    Rarities,
    ReversibleExchangeDetails,
    StandbySkillDetails,
    TransformationSource,
    Types,
} from "../character";
import {
    GameDbCharacterSnapshot,
    GameDbFinishSkillSet,
    GameDbFormRelation,
} from "./game-db-contract";
import { cardArtUrlFromCardId, portraitOutputUrl, portraitSpecFromElement, portraitSpecFromTypeAndClass } from "./portrait-asset-contract";
import { parseLeaderSkillDetails } from "../scraper";

export interface GameDbProjectionTransformation {
    id: string,
    name?: string,
    source: TransformationSource,
    condition: string,
    sourceLabel?: string,
}

export interface GameDbProjectionSuperAttackDetails {
    id: string,
    name: string,
    description: string,
    variant: GameDbCharacterSnapshot["superAttacks"][number]["variant"],
    requiredKi?: number,
    attackIncrease?: {
        level1Percent: number,
        maxLevelPercent: number,
        maxLevel: number,
    },
}

export interface GameDbDokkanpanionProjection {
    id: string,
    source: "game-db-projection",
    name: string,
    title: string,
    releaseDate?: string,
    rarity: GameDbCharacterSnapshot["rarity"],
    type: GameDbCharacterSnapshot["type"],
    characterClass: GameDbCharacterSnapshot["characterClass"],
    cost: number,
    portraitURL: string,
    portraitFilename: string,
    portraitSpec: PortraitSpec,
    artURL: string,
    artFilename: string,
    maxLevel: number,
    maxSALevel: number,
    leaderSkill: string,
    leaderSkillBoost?: number,
    leaderSkillDetails?: LeaderSkillDetails,
    passive: string,
    passiveDetails?: PassiveDetails,
    superAttackDetails?: GameDbProjectionSuperAttackDetails[],
    activeSkill: string,
    activeSkillCondition: string,
    activeSkillDetails?: ActiveSkillDetails[],
    createdDomain?: CreatedDomainDetails,
    domain: string,
    standbySkill: string,
    standby?: StandbySkillDetails,
    finishSkills: FinishSkill[],
    reversibleExchange?: ReversibleExchangeDetails,
    obtainability: CharacterObtainabilityDetails,
    isFreeToPlay: boolean,
    links: string[],
    categories: string[],
    baseHP: number,
    maxLevelHP: number,
    baseAttack: number,
    maxLevelAttack: number,
    baseDefence: number,
    maxDefence: number,
    hasEza: boolean,
    hasSeza: boolean,
    transformations: GameDbProjectionTransformation[],
}

function unknownObtainability(): CharacterObtainabilityDetails {
    return {
        type: "unknown",
        isFreeToPlay: false,
        hasDirectAcquisitionDetails: false,
    };
}

function typeDigit(type: Types): number {
    switch (type) {
        case Types.AGL:
            return 0;
        case Types.TEQ:
            return 1;
        case Types.INT:
            return 2;
        case Types.STR:
            return 3;
        case Types.PHY:
            return 4;
        default:
            return 0;
    }
}

function portraitSpecForCharacter(character: GameDbCharacterSnapshot): PortraitSpec {
    if (character.raw.element) {
        return portraitSpecFromElement(character.id, character.rarity as Rarities, character.raw.element);
    }

    return portraitSpecFromTypeAndClass(
        character.id,
        character.rarity as Rarities,
        typeDigit(character.type as Types),
        character.characterClass === "None" ? "None" : character.characterClass as Classes,
    );
}

function linesFromText(text: string): string[] | undefined {
    const lines = text
        .split("\n")
        .map(line => line.trim())
        .filter(Boolean);

    return lines.length > 0 ? lines : undefined;
}

function passiveDetailsFromSnapshot(character: GameDbCharacterSnapshot): PassiveDetails | undefined {
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

function activeSkillText(character: GameDbCharacterSnapshot): string {
    const primarySet = character.activeSkillSets[0];
    if (!primarySet) {
        return "";
    }

    return [primarySet.name, primarySet.effectDescription].filter(Boolean).join(": ");
}

function activeSkillCondition(character: GameDbCharacterSnapshot): string {
    return character.activeSkillSets[0]?.conditionDescription ?? "";
}

function activeSkillDetails(character: GameDbCharacterSnapshot): ActiveSkillDetails[] | undefined {
    const details = character.activeSkillSets.map(activeSkillSet => ({
        id: activeSkillSet.id,
        name: activeSkillSet.name,
        description: activeSkillSet.effectDescription,
        condition: activeSkillSet.conditionDescription || undefined,
        turn: activeSkillSet.turn,
        executionLimit: activeSkillSet.execLimit,
        ultimateSpecialId: activeSkillSet.ultimateSpecialId,
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
            kind: "game_db" as const,
            relation: { ...activeSkillSet.provenance.relation },
            set: { ...activeSkillSet.provenance.set },
        },
    }));

    return details.length > 0 ? details : undefined;
}

function createdDomainDetails(character: GameDbCharacterSnapshot): CreatedDomainDetails | undefined {
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

function transformationSourceFromRelation(relation: GameDbFormRelation): TransformationSource {
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

function finishSkillEffectKind(finishSkillSet: GameDbFinishSkillSet, targetTransformationId?: string): FinishSkillEffectKind {
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

function mapFinishSkills(character: GameDbCharacterSnapshot): FinishSkill[] {
    return character.finishSkillSets.map(finishSkillSet => {
        const targetRelation = character.formRelations.find(relation =>
            relation.kind === "finish-transformation"
            && relation.sourceSkillSetId === finishSkillSet.id,
        );

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

function mapStandby(character: GameDbCharacterSnapshot, finishSkills: FinishSkill[]): StandbySkillDetails | undefined {
    const standbySkillSet = character.standbySkillSets[0];
    if (!standbySkillSet) {
        return undefined;
    }

    const targetRelation = character.formRelations.find(relation =>
        relation.kind === "standby-transformation"
        && relation.sourceSkillSetId === standbySkillSet.id,
    );

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

function mapReversibleExchange(character: GameDbCharacterSnapshot): ReversibleExchangeDetails | undefined {
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

function mapTransformations(character: GameDbCharacterSnapshot): GameDbProjectionTransformation[] {
    return character.formRelations.map(relation => ({
        id: relation.targetCardId,
        name: relation.targetName,
        source: transformationSourceFromRelation(relation),
        condition: relation.description ?? "",
        sourceLabel: relation.sourceName,
    }));
}

function mapSuperAttackDetails(character: GameDbCharacterSnapshot): GameDbProjectionSuperAttackDetails[] {
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
                level1Percent: level1Percent as number,
                maxLevelPercent: maxLevelPercent as number,
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

export function projectGameDbCharacterToDokkanpanion(character: GameDbCharacterSnapshot): GameDbDokkanpanionProjection {
    const leaderSkill = character.leaderSkill?.description ?? "";
    const leaderSkillDetails = parseLeaderSkillDetails(leaderSkill);
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
        portraitURL: portraitOutputUrl(portraitFilename),
        portraitFilename,
        portraitSpec,
        artURL: cardArtUrlFromCardId(character.id),
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

export function projectGameDbCharactersToDokkanpanion(characters: GameDbCharacterSnapshot[]): GameDbDokkanpanionProjection[] {
    return characters.map(projectGameDbCharacterToDokkanpanion);
}

