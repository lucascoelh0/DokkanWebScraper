import { createHash } from "crypto";
import {
    Classes,
    ActiveSkillDetails,
    CharacterObtainabilityDetails,
    CreatedDomainDetails,
    FinishSkill,
    FinishSkillEffectKind,
    EffectStructuralEvidence,
    EffectStructuralMarkerKind,
    EffectStructuralSource,
    LeaderSkillDetails,
    PassiveConditionEvidence,
    PassiveDetails,
    PassiveModeDetails,
    PassiveSection,
    PassiveEnemyStatus,
    PortraitSpec,
    Rarities,
    ReversibleExchangeDetails,
    StandbySkillDetails,
    TransformationSource,
    Types,
} from "../character";
import {
    GameDbCharacterReleaseState,
    GameDbCharacterSnapshot,
    GameDbFinishSkillSet,
    GameDbFormRelation,
    GameDbPassiveSkillSet,
    GameDbSuperAttack,
} from "./game-db-contract";
import { cardArtUrlFromCardId, portraitOutputUrl, portraitSpecFromElement, portraitSpecFromTypeAndClass } from "./portrait-asset-contract";
import { cleanMultilineText, parseLeaderSkillDetails, splitPassiveSections } from "../scraper";

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
    condition?: string,
    variant: GameDbSuperAttack["variant"],
    requiredKi?: number,
    type?: GameDbSuperAttack["attackType"],
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
    ezaReleaseDate?: string,
    sezaReleaseDate?: string,
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
    ezaLeaderSkill?: string,
    leaderSkillBoost?: number,
    ezaLeaderSkillBoost?: number,
    leaderSkillDetails?: LeaderSkillDetails,
    ezaLeaderSkillDetails?: LeaderSkillDetails,
    passive: string,
    passiveDetails?: PassiveDetails,
    ezaPassive?: string,
    ezaPassiveDetails?: PassiveDetails,
    sezaPassive?: string,
    sezaPassiveDetails?: PassiveDetails,
    superAttackDetails?: GameDbProjectionSuperAttackDetails[],
    ezaSuperAttackDetails?: GameDbProjectionSuperAttackDetails[],
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

export interface GameDbAppProjectionOptions {
    sourceVersion?: string,
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

type GameDbPassiveStructuralField = Extract<
    EffectStructuralEvidence["provenance"],
    { source: "first_party_game_db" }
>["payloadField"];

type GameDbPassiveEvidenceField = Extract<
    PassiveConditionEvidence["provenance"],
    { source: "first_party_game_db" }
>["payloadField"];

type GameDbPassiveDescriptionField = Exclude<GameDbPassiveStructuralField, "special_sets.description">;

interface StructuralSourceLine {
    rawText: string,
    start: number,
    end: number,
    normalizedLineIndex?: number,
}

function sha256Text(value: string): string {
    return createHash("sha256").update(value, "utf8").digest("hex");
}

function structuralMarkerKind(sourceToken: string): EffectStructuralMarkerKind {
    if (sourceToken === "once" || sourceToken === "forever") return sourceToken;
    if (sourceToken === "up_g") return "value_up";
    if (sourceToken === "down_r" || sourceToken === "down_y") return "value_down";
    return "unknown";
}

function passiveEnemyStatusFromMarker(sourceToken: string): PassiveEnemyStatus | undefined {
    if (sourceToken === "atk_down") return "atk_down";
    if (sourceToken === "def_down") return "def_down";
    if (sourceToken === "stun") return "stunned";
    if (sourceToken === "astute") return "super_attack_sealed";
    return undefined;
}

function passiveEvidenceConnector(
    statusSource: string,
    markerCount: number,
): "and" | "or" | undefined {
    if (markerCount < 2) return undefined;
    const normalizedSource = statusSource.replace(/\s+/g, " ");
    const firstMarkerIndex = normalizedSource.search(/\{passiveImg:[^}]+\}/);
    const lastMarkerIndex = normalizedSource.lastIndexOf("{passiveImg:");
    const lastMarkerEnd = lastMarkerIndex >= 0 ? normalizedSource.indexOf("}", lastMarkerIndex) + 1 : -1;
    if (firstMarkerIndex < 0 || lastMarkerEnd <= firstMarkerIndex) return undefined;
    const markerList = normalizedSource.slice(firstMarkerIndex, lastMarkerEnd)
        .replace(/\{passiveImg:[^}]+\}/g, "#");
    const hasAnd = /\band\b/i.test(markerList);
    const hasOr = /\bor\b/i.test(markerList);
    return hasAnd === hasOr ? undefined : hasAnd ? "and" : "or";
}

function structuralSourceLines(rawText: string): StructuralSourceLine[] {
    const lines: StructuralSourceLine[] = [];
    let start = 0;
    let normalizedLineIndex = 0;
    while (start <= rawText.length) {
        const newline = rawText.slice(start).search(/\r\n|\n|\r/);
        const end = newline < 0 ? rawText.length : start + newline;
        const rawTextLine = rawText.slice(start, end);
        const normalizedLine = cleanMultilineText(rawTextLine);
        lines.push({
            rawText: rawTextLine,
            start,
            end,
            ...(normalizedLine ? { normalizedLineIndex: normalizedLineIndex++ } : {}),
        });
        if (newline < 0) break;
        start = end + (rawText.slice(end, end + 2) === "\r\n" ? 2 : 1);
    }
    return lines;
}

function gameDbPassiveConditionEvidence(
    rawText: string,
    normalizedText: string,
    context: {
        characterId: string,
        releaseState: GameDbCharacterReleaseState["releaseState"],
        sourceVersion: string,
        payloadField: GameDbPassiveEvidenceField,
        passiveSkillId: string,
    },
): PassiveConditionEvidence[] {
    const passiveTextSha256 = sha256Text(normalizedText);
    const stateKey = `${context.characterId}:${context.characterId}:${context.releaseState}`;
    const lines = structuralSourceLines(rawText);
    const evidence: PassiveConditionEvidence[] = [];

    for (let lineOffset = 0; lineOffset < lines.length; lineOffset += 1) {
        const line = lines[lineOffset];
        const bulletPrefix = /^(\s*-\s*)/.exec(line.rawText)?.[1];
        const headerStart = /^\s*\*/.test(line.rawText);
        if (!bulletPrefix && !headerStart) continue;

        let endLineOffset = lineOffset;
        let anchorEnd = line.end;
        if (bulletPrefix) {
            while (endLineOffset + 1 < lines.length) {
                const nextLine = lines[endLineOffset + 1];
                if (/^\s*(?:-|\*)/.test(nextLine.rawText)) break;
                endLineOffset += 1;
                anchorEnd = nextLine.end;
            }
        } else {
            while (!/\*\s*$/.test(lines[endLineOffset].rawText) && endLineOffset + 1 < lines.length) {
                const nextLine = lines[endLineOffset + 1];
                if (/^\s*-/.test(nextLine.rawText)) break;
                endLineOffset += 1;
                anchorEnd = nextLine.end;
            }
        }
        const anchorStart = line.start + (bulletPrefix?.length ?? 0);
        const structuralText = rawText.slice(anchorStart, anchorEnd).trimEnd();
        const semanticStructuralText = structuralText.replace(/\s+/g, " ");
        if (!/following status:/i.test(semanticStructuralText)) {
            lineOffset = endLineOffset;
            continue;
        }
        const statusOffset = semanticStructuralText.toLowerCase().indexOf("following status:");
        const statusSource = semanticStructuralText.slice(statusOffset + "following status:".length);
        const markerMatches = [...statusSource.matchAll(/\{passiveImg:([^}]+)\}/g)];
        if (markerMatches.length === 0) {
            lineOffset = endLineOffset;
            continue;
        }

        const normalizedAnchorText = cleanMultilineText(structuralText)
            .replace(/^\s*-\s*/, "")
            .replace(/\s*\n\s*/g, " ")
            .replace(/\s+/g, " ")
            .trim();
        const coveredLines = lines.slice(lineOffset, endLineOffset + 1)
            .filter(item => item.normalizedLineIndex !== undefined);
        if (!normalizedAnchorText || coveredLines.length === 0) continue;

        const statuses = markerMatches.map((match, order) => {
            const sourceToken = match[1];
            const status = passiveEnemyStatusFromMarker(sourceToken);
            return {
                order,
                sourceToken,
                ...(status ? { status } : {}),
                resolution: status ? "supported" as const : "unresolved" as const,
            };
        });
        const connector = passiveEvidenceConnector(statusSource, markerMatches.length);
        const resolution = statuses.some(status => status.resolution === "unresolved")
            || (statuses.length > 1 && !connector)
            ? "partial" as const
            : "supported" as const;

        evidence.push({
            kind: "enemy_status",
            stateKey,
            characterId: context.characterId,
            formId: context.characterId,
            releaseState: context.releaseState,
            passiveSkillId: context.passiveSkillId,
            passiveTextSha256,
            anchor: {
                lineIndex: coveredLines[0].normalizedLineIndex!,
                ...(coveredLines.length > 1
                    ? { endLineIndex: coveredLines[coveredLines.length - 1].normalizedLineIndex! }
                    : {}),
                normalizedText: normalizedAnchorText,
                structuralText,
            },
            statuses,
            ...(connector ? { connector } : {}),
            resolution,
            provenance: {
                source: "first_party_game_db",
                sourceVersion: context.sourceVersion,
                payloadField: context.payloadField,
                markerSyntax: "passiveImg",
            },
        });
        lineOffset = endLineOffset;
    }

    return evidence;
}

function gameDbPassiveStructuralSource(
    rawText: string,
    normalizedText: string,
    context: {
        characterId: string,
        releaseState: GameDbCharacterReleaseState["releaseState"],
        sourceVersion: string,
        payloadField: GameDbPassiveStructuralField,
        passiveSkillId: string,
    },
): EffectStructuralSource | undefined {
    const rawTextSha256 = sha256Text(rawText);
    const normalizedTextSha256 = sha256Text(normalizedText);
    const stateKey = `${context.characterId}:${context.characterId}:${context.releaseState}`;
    const lines = structuralSourceLines(rawText);
    const evidence: EffectStructuralEvidence[] = [];

    for (let lineOffset = 0; lineOffset < lines.length; lineOffset += 1) {
        const line = lines[lineOffset];
        const bullet = line.rawText.match(/^(\s*-\s*)(.*)$/);
        if (!bullet) continue;
        const markerMatches = [...bullet[2].matchAll(/\{passiveImg:([^}]+)\}/g)];
        if (markerMatches.length === 0) continue;

        let endLineOffset = lineOffset;
        let anchorEnd = line.end;
        while (endLineOffset + 1 < lines.length) {
            const nextLine = lines[endLineOffset + 1];
            if (/^\s*(?:-|\*)/.test(nextLine.rawText)) break;
            endLineOffset += 1;
            anchorEnd = nextLine.end;
        }
        const anchorStart = line.start + bullet[1].length;
        const structuralText = rawText.slice(anchorStart, anchorEnd).trimEnd();
        const anchorMarkerMatches = [...structuralText.matchAll(/\{passiveImg:([^}]+)\}/g)];
        const normalizedAnchorText = cleanMultilineText(structuralText)
            .replace(/^\s*-\s*/, "")
            .replace(/\s*\n\s*/g, " ")
            .replace(/\s+/g, " ")
            .trim();
        const coveredLines = lines.slice(lineOffset, endLineOffset + 1)
            .filter(item => item.normalizedLineIndex !== undefined);
        if (!normalizedAnchorText || coveredLines.length === 0) continue;

        const markers = anchorMarkerMatches.map((match, order) => {
            const sourceToken = match[1];
            const markerKind = structuralMarkerKind(sourceToken);
            const start = anchorStart + (match.index ?? 0);
            return {
                order,
                sourceToken,
                markerKind,
                resolution: markerKind === "unknown" ? "unresolved" as const : "supported" as const,
                sourceSpan: { start, end: start + match[0].length },
            };
        });
        const resolution = markers.every(marker => marker.resolution === "supported")
            ? "supported" as const
            : markers.every(marker => marker.resolution === "unresolved")
                ? "unresolved" as const
                : "partial" as const;

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
                lineIndex: coveredLines[0].normalizedLineIndex!,
                ...(coveredLines.length > 1
                    ? { endLineIndex: coveredLines[coveredLines.length - 1].normalizedLineIndex! }
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

function passiveDescriptionDetails(
    passiveSkillSet: GameDbPassiveSkillSet | undefined,
    rawText: string | undefined,
    payloadField: GameDbPassiveDescriptionField,
    context?: {
        characterId: string,
        releaseState: GameDbCharacterReleaseState["releaseState"],
        sourceVersion: string,
    },
): Omit<PassiveModeDetails, "mode" | "availability" | "label"> | undefined {
    const text = cleanMultilineText(rawText);
    if (!text) return undefined;

    const lines = linesFromText(text);
    const structuralSource = context && passiveSkillSet
        ? gameDbPassiveStructuralSource(rawText ?? "", text, {
            ...context,
            payloadField,
            passiveSkillId: passiveSkillSet.id,
        })
        : undefined;
    const conditionEvidence = context && passiveSkillSet
        ? gameDbPassiveConditionEvidence(rawText ?? "", text, {
            ...context,
            payloadField,
            passiveSkillId: passiveSkillSet.id,
        })
        : [];

    return {
        text,
        lines,
        sections: lines ? splitGameDbPassiveSections(rawText ?? "", lines) : undefined,
        ...(conditionEvidence.length > 0 ? { conditionEvidence } : {}),
        ...(structuralSource ? { structuralSource } : {}),
        sourceSkillId: passiveSkillSet?.id,
    };
}

function splitGameDbPassiveSections(rawText: string, normalizedLines: string[]): PassiveSection[] {
    const sections: PassiveSection[] = [];
    let current: PassiveSection | undefined;
    let foundStructuralHeader = false;
    const pushCurrent = () => {
        if (current && (current.label || current.lines.length > 0)) sections.push(current);
        current = undefined;
    };

    for (const rawLine of rawText.split(/\r?\n/)) {
        const trimmed = rawLine.trim();
        if (!trimmed) continue;
        const structuralHeader = trimmed.match(/^\*([^*]+)\*$/);
        if (structuralHeader) {
            pushCurrent();
            current = {
                label: cleanMultilineText(structuralHeader[1]) || undefined,
                lines: [],
            };
            foundStructuralHeader = true;
            continue;
        }

        const bullet = trimmed.match(/^-\s*(.*)$/);
        if (bullet) {
            if (!current) current = { lines: [] };
            const line = cleanMultilineText(bullet[1]);
            if (line) current.lines.push(line);
            continue;
        }

        const continuation = cleanMultilineText(trimmed);
        if (!continuation) continue;
        if (!current) current = { lines: [] };
        if (current.lines.length === 0) {
            current.lines.push(continuation);
        } else {
            current.lines[current.lines.length - 1] =
                `${current.lines[current.lines.length - 1]} ${continuation}`.trim();
        }
    }
    pushCurrent();
    return foundStructuralHeader ? sections : splitPassiveSections(normalizedLines);
}

function passiveDetailsFromSkillSet(
    passiveSkillSet: GameDbPassiveSkillSet | undefined,
    context?: {
        characterId: string,
        releaseState: GameDbCharacterReleaseState["releaseState"],
        sourceVersion: string,
    },
): PassiveDetails | undefined {
    const basic = passiveDescriptionDetails(
        passiveSkillSet,
        passiveSkillSet?.itemizedDescription,
        "passive_skill_sets.itemized_description",
        context,
    );
    if (!basic) return undefined;

    const standard = passiveDescriptionDetails(
        passiveSkillSet,
        passiveSkillSet?.groupItemizedDescription,
        "passive_skill_sets.group_itemized_description",
        context,
    );
    const survival = passiveDescriptionDetails(
        passiveSkillSet,
        passiveSkillSet?.characterItemizedDescription,
        "passive_skill_sets.character_itemized_description",
        context,
    );
    const modes: PassiveModeDetails[] = [];
    if (standard) {
        modes.push({
            mode: "standard" as const,
            availability: "normal" as const,
            label: "Standard",
            ...standard,
        });
    }
    if (survival) {
        modes.push({
            mode: "survival" as const,
            availability: "dokkan_frontier" as const,
            label: "Survival",
            ...survival,
        });
    }

    return {
        name: passiveSkillSet?.name,
        ...basic,
        ...(modes.length > 0 ? { modes } : {}),
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

function displayAttackIncreaseAdjustment(attack: GameDbSuperAttack): number {
    const candidates = attack.effects.filter(effect => {
        const atkValue = Number(effect.values[0]);
        const defValue = Number(effect.values[1]);
        const rawCondition = effect.causalityConditionsRaw?.trim();
        return effect.type === "Special::NormalEfficacySpecial"
            && effect.efficacyType === 3
            && effect.targetType === 2
            && effect.calcOption === 2
            && effect.probability === 100
            && Number.isSafeInteger(effect.turn) && (effect.turn as number) > 0
            && Number.isSafeInteger(atkValue) && atkValue > 0 && atkValue <= 100
            && atkValue === defValue
            && (!rawCondition || rawCondition === "[]");
    });
    return candidates.length === 1 ? Number(candidates[0].values[0]) : 0;
}

function mapSuperAttackDetails(
    superAttacks: GameDbSuperAttack[],
    maxSaLevel: number,
    includeAttackIncrease = true,
): GameDbProjectionSuperAttackDetails[] {
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
                level1Percent: level1Percent as number,
                maxLevelPercent: maxLevelPercent as number,
                maxLevel,
            }
            : undefined;

        return {
            id: attack.cardSpecialId,
            name: attack.name,
            description: cleanMultilineText(attack.description),
            condition: cleanMultilineText(attack.conditionDescription),
            variant: attack.variant,
            requiredKi: attack.requiredKi,
            type: attack.attackType,
            ...(attackIncrease ? { attackIncrease } : {}),
        };
    });
}

function fallbackInitialReleaseState(character: GameDbCharacterSnapshot): GameDbCharacterReleaseState {
    return character.releaseStates?.initial ?? {
        releaseState: "initial",
        releaseDate: character.releaseDate,
        maxLevel: character.baseMaxLevel,
        maxSaLevel: character.baseMaxSaLevel,
        leaderSkill: character.leaderSkill,
        passiveSkillSet: character.passiveSkillSet,
        superAttacks: character.superAttacks,
    };
}

export function projectGameDbCharacterToDokkanpanion(
    character: GameDbCharacterSnapshot,
    options: GameDbAppProjectionOptions = {},
): GameDbDokkanpanionProjection {
    const initialReleaseState = fallbackInitialReleaseState(character);
    const ezaReleaseState = character.releaseStates?.eza;
    const sezaReleaseState = character.releaseStates?.seza;
    const leaderSkill = initialReleaseState.leaderSkill?.description ?? "";
    const ezaLeaderSkill = ezaReleaseState?.leaderSkill?.description;
    const leaderSkillDetails = parseLeaderSkillDetails(leaderSkill);
    const ezaLeaderSkillDetails = ezaLeaderSkill ? parseLeaderSkillDetails(ezaLeaderSkill) : undefined;
    const passiveContext = options.sourceVersion
        ? { characterId: character.id, sourceVersion: options.sourceVersion }
        : undefined;
    const passiveDetails = passiveDetailsFromSkillSet(
        initialReleaseState.passiveSkillSet,
        passiveContext ? { ...passiveContext, releaseState: "initial" } : undefined,
    );
    const ezaPassiveDetails = passiveDetailsFromSkillSet(
        ezaReleaseState?.passiveSkillSet,
        passiveContext ? { ...passiveContext, releaseState: "eza" } : undefined,
    );
    const sezaPassiveDetails = passiveDetailsFromSkillSet(
        sezaReleaseState?.passiveSkillSet,
        passiveContext ? { ...passiveContext, releaseState: "seza" } : undefined,
    );
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
        ezaReleaseDate: ezaReleaseState?.releaseDate,
        sezaReleaseDate: sezaReleaseState?.releaseDate,
        rarity: character.rarity,
        type: character.type,
        characterClass: character.characterClass,
        cost: character.cost,
        portraitURL: portraitOutputUrl(portraitFilename),
        portraitFilename,
        portraitSpec,
        artURL: cardArtUrlFromCardId(character.id),
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
        superAttackDetails: mapSuperAttackDetails(
            initialReleaseState.superAttacks,
            initialReleaseState.maxSaLevel,
            Boolean(character.releaseStates) || character.growthSteps.length === 0,
        ),
        ezaSuperAttackDetails: ezaReleaseState
            ? mapSuperAttackDetails(ezaReleaseState.superAttacks, ezaReleaseState.maxSaLevel)
            : undefined,
        activeSkill: activeSkillText(character),
        activeSkillCondition: activeSkillCondition(character),
        activeSkillDetails: activeSkillDetails(character),
        createdDomain,
        domain: createdDomain
            ? [createdDomain.field.name, createdDomain.field.description].filter(Boolean).join(": ")
            : "",
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

export function projectGameDbCharactersToDokkanpanion(
    characters: GameDbCharacterSnapshot[],
    options: GameDbAppProjectionOptions = {},
): GameDbDokkanpanionProjection[] {
    return characters.map(character => projectGameDbCharacterToDokkanpanion(character, options));
}

