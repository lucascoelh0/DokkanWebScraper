import type {
    Character,
    SuperAttackDetails,
    UnitSuperAttack,
} from "../character";
import type {
    GameDbDokkanpanionProjection,
    GameDbProjectionSuperAttackDetails,
} from "./game-db-app-projection";

export interface GameDbCharacterReleaseOverlayPatch {
    cardId: string,
    fields: string[],
}

export interface GameDbCharacterReleaseOverlayResult {
    characters: Character[],
    patches: GameDbCharacterReleaseOverlayPatch[],
    checks: {
        characterCountPreserved: true,
        characterOrderPreserved: true,
        untargetedCharactersUnchanged: true,
        everyTargetFoundInBaseline: true,
        everyTargetFoundInGameDb: true,
    },
}

function cloneCharacters(characters: Character[]): Character[] {
    return JSON.parse(JSON.stringify(characters)) as Character[];
}

function attackStyle(variant: GameDbProjectionSuperAttackDetails["variant"]): string | undefined {
    switch (variant) {
        case "super": return "Normal";
        case "ultra": return "Ultra";
        case "extra": return "Extra";
        case "unit": return "Unit";
        default: return undefined;
    }
}

export function toSuperAttackDetails(
    attack: GameDbProjectionSuperAttackDetails,
    fallback?: SuperAttackDetails,
): SuperAttackDetails {
    return {
        name: attack.name,
        effect: attack.description,
        type: attack.type ?? fallback?.type,
        ki: attack.requiredKi,
        style: attackStyle(attack.variant) ?? fallback?.style,
        condition: attack.condition,
        sourceAttackId: attack.id,
        attackIncrease: attack.attackIncrease,
    };
}

export function toUnitSuperAttack(
    attack: GameDbProjectionSuperAttackDetails,
    fallback?: UnitSuperAttack,
): UnitSuperAttack {
    return {
        name: attack.name,
        effect: attack.description,
        type: attack.type ?? fallback?.type,
        ki: attack.requiredKi,
        style: attackStyle(attack.variant) ?? fallback?.style,
        unitSuperAttack: [attack.name, attack.description].filter(Boolean).join(": "),
        unitSuperAttackCondition: attack.condition,
        sourceAttackId: attack.id,
        attackIncrease: attack.attackIncrease,
    };
}

function applyEzaSuperAttacks(
    character: Character,
    attacks: GameDbProjectionSuperAttackDetails[],
    changedFields: Set<string>,
): void {
    for (const attack of attacks) {
        if (!attack.type) {
            throw new Error(`game DB EZA Super Attack ${attack.id} has no first-party attack type`);
        }
    }
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
        character.ezaUnitSuperAttacks = unitAttacks.map((attack, index) =>
            toUnitSuperAttack(attack, character.unitSuperAttacks?.[index]));
        changedFields.add("ezaUnitSuperAttacks");
    }
}

function applyActiveSkillActivationConditions(
    character: Character,
    projection: GameDbDokkanpanionProjection,
    changedFields: Set<string>,
): void {
    const conditions = projection.activeSkillDetails
        ?.filter(detail => detail.activationCondition)
        .map(detail => ({ id: detail.id, activationCondition: detail.activationCondition }))
        ?? [];
    if (conditions.length === 0) return;
    const details = character.activeSkillDetails;
    if (!details?.length) {
        throw new Error(`target ${character.id} has typed Active Skill conditions but no baseline Active Skill details`);
    }
    for (const source of conditions) {
        const matches = details.filter(detail => detail.id === source.id);
        if (matches.length !== 1) {
            throw new Error(
                `target ${character.id} Active Skill ${source.id} matched ${matches.length} baseline detail rows`,
            );
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

function applyProjection(
    character: Character,
    projection: GameDbDokkanpanionProjection,
): string[] {
    const changedFields = new Set<string>();

    applyActiveSkillActivationConditions(character, projection, changedFields);

    if (projection.ezaReleaseDate) {
        character.ezaReleaseDate = projection.ezaReleaseDate;
        changedFields.add("ezaReleaseDate");
    }

    if (projection.sezaReleaseDate) {
        character.sezaReleaseDate = projection.sezaReleaseDate;
        changedFields.add("sezaReleaseDate");
    }

    if (projection.ezaLeaderSkill) {
        character.ezaLeaderSkill = projection.ezaLeaderSkill;
        character.ezaLeaderSkillDetails = projection.ezaLeaderSkillDetails;
        changedFields.add("ezaLeaderSkill");
        if (projection.ezaLeaderSkillDetails) changedFields.add("ezaLeaderSkillDetails");
    }

    if (projection.ezaPassive) {
        character.ezaPassive = projection.ezaPassive;
        character.ezaPassiveDetails = projection.ezaPassiveDetails;
        changedFields.add("ezaPassive");
        if (projection.ezaPassiveDetails) changedFields.add("ezaPassiveDetails");
    }

    if (projection.sezaPassive) {
        character.sezaPassive = projection.sezaPassive;
        character.sezaPassiveDetails = projection.sezaPassiveDetails;
        changedFields.add("sezaPassive");
        if (projection.sezaPassiveDetails) changedFields.add("sezaPassiveDetails");
    }

    if (projection.ezaSuperAttackDetails?.length) {
        applyEzaSuperAttacks(character, projection.ezaSuperAttackDetails, changedFields);
    }

    return [...changedFields].sort();
}

export function overlayGameDbCharacterReleaseStates(
    baselineCharacters: Character[],
    projections: GameDbDokkanpanionProjection[],
    targetCardIds: string[],
): GameDbCharacterReleaseOverlayResult {
    const targetIds = new Set(targetCardIds);
    if (targetIds.size !== targetCardIds.length || targetIds.size === 0) {
        throw new Error("release-state overlay requires unique target card IDs");
    }

    const baselineById = new Map<string, number>();
    baselineCharacters.forEach((character, index) => {
        if (baselineById.has(character.id)) throw new Error(`duplicate baseline character ${character.id}`);
        baselineById.set(character.id, index);
    });
    const projectionById = new Map<string, GameDbDokkanpanionProjection>();
    for (const projection of projections) {
        if (projectionById.has(projection.id)) throw new Error(`duplicate game DB projection ${projection.id}`);
        projectionById.set(projection.id, projection);
    }

    for (const cardId of targetIds) {
        if (!baselineById.has(cardId)) throw new Error(`target ${cardId} is missing from the baseline catalog`);
        if (!projectionById.has(cardId)) throw new Error(`target ${cardId} is missing from the game DB projection`);
    }

    const baselineBytes = baselineCharacters.map(character => JSON.stringify(character));
    const characters = cloneCharacters(baselineCharacters);
    const patches: GameDbCharacterReleaseOverlayPatch[] = [];

    for (const cardId of targetIds) {
        const index = baselineById.get(cardId) as number;
        const fields = applyProjection(characters[index], projectionById.get(cardId) as GameDbDokkanpanionProjection);
        if (fields.length === 0) throw new Error(`target ${cardId} has no selected first-party game DB fields`);
        patches.push({ cardId, fields });
    }

    const characterOrderPreserved = characters.every((character, index) => character.id === baselineCharacters[index].id);
    const untargetedCharactersUnchanged = characters.every((character, index) =>
        targetIds.has(character.id) || JSON.stringify(character) === baselineBytes[index]);
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
