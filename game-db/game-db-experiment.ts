import { mkdir, readFile } from "fs/promises";
import { resolve } from "path";
import { Classes, Rarities, Types } from "../character";
import {
    GameDbAwakeningRoute,
    GameDbCharacterReleaseState,
    GameDbCharacterReleaseStateName,
    GameDbCharacterSnapshot,
    GameDbComparisonCardReport,
    GameDbComparisonCheck,
    GameDbComparisonReport,
    GameDbExperimentReport,
    GameDbFinishSkillSet,
    GameDbFormRelation,
    GameDbFormRelationKind,
    GameDbGrowthStep,
    GameDbLeaderSkillEffect,
    GameDbLeaderSkillSet,
    GameDbPassiveSkill,
    GameDbPassiveSkillSet,
    GameDbReference,
    GameDbStandbySkillSet,
    GameDbSuperAttack,
} from "./game-db-contract";
import { mapActiveSkillSets } from "./game-db-active-skill";
import { mapSuperAttacks } from "./game-db-super-attack";
import { CORE_GAME_DB_TABLES, SUPER_ATTACK_EFFECT_GAME_DB_TABLES } from "./game-db-table-inventory";
import {
    GameDbRow,
    normalizeDbId,
    parseDbDate,
    parseDbInt,
    parseDbJsonArray,
    readGameDbTable,
    resolveGameDbSourceConfig,
} from "./game-db-source";
import { writeFormattedJson } from "../format-json";
import { readSourceSettings } from "./game-db-source-settings";

export { readSourceSettings } from "./game-db-source-settings";

export const DEFAULT_GOLDEN_CARD_IDS = [
    "1032521",
    "1029471",
    "1025731",
    "1033061",
    "1029441",
    "1022781",
];

export const REQUIRED_GAME_DB_TABLES = [...CORE_GAME_DB_TABLES];

export function parseCardIds(value?: string): string[] {
    if (!value) {
        return [...DEFAULT_GOLDEN_CARD_IDS];
    }

    const ids = value
        .split(",")
        .map(part => part.trim())
        .filter(part => part.length > 0);

    return ids.length > 0 ? ids : [...DEFAULT_GOLDEN_CARD_IDS];
}

function mapRarity(value: string): Rarities {
    switch (parseDbInt(value)) {
        case 0:
            return Rarities.N;
        case 1:
            return Rarities.R;
        case 2:
            return Rarities.SR;
        case 3:
            return Rarities.SSR;
        case 4:
            return Rarities.UR;
        case 5:
            return Rarities.LR;
        default:
            throw new Error(`Unknown rarity value: ${value}`);
    }
}

function mapType(value: string): Types {
    switch ((parseDbInt(value) ?? 0) % 10) {
        case 0:
            return Types.AGL;
        case 1:
            return Types.TEQ;
        case 2:
            return Types.INT;
        case 3:
            return Types.STR;
        case 4:
            return Types.PHY;
        default:
            throw new Error(`Unknown element/type value: ${value}`);
    }
}

function mapCharacterClass(value: string): Classes | "None" {
    const normalized = value.trim();
    if (normalized.length <= 1) {
        return "None";
    }

    if (normalized.startsWith("1")) {
        return Classes.Super;
    }

    if (normalized.startsWith("2")) {
        return Classes.Extreme;
    }

    throw new Error(`Unknown class element value: ${value}`);
}

function normalizeText(value?: string): string {
    return (value ?? "").replace(/\r\n/g, "\n").trim();
}

function buildLookup(rows: GameDbRow[], idField = "id"): Map<string, GameDbRow> {
    const lookup = new Map<string, GameDbRow>();
    for (const row of rows) {
        const id = normalizeDbId(row[idField]);
        if (id) {
            lookup.set(id, row);
        }
    }
    return lookup;
}

function groupBy(rows: GameDbRow[], key: string): Map<string, GameDbRow[]> {
    const grouped = new Map<string, GameDbRow[]>();
    for (const row of rows) {
        const id = normalizeDbId(row[key]);
        if (!id) {
            continue;
        }

        const existingRows = grouped.get(id);
        if (existingRows) {
            existingRows.push(row);
        } else {
            grouped.set(id, [row]);
        }
    }
    return grouped;
}

function sortByOptionalNumber<T>(items: T[], selector: (item: T) => number | undefined): T[] {
    return [...items].sort((left, right) => (selector(left) ?? Number.MAX_SAFE_INTEGER) - (selector(right) ?? Number.MAX_SAFE_INTEGER));
}

function mapLeaderSkillEffects(rows: GameDbRow[]): GameDbLeaderSkillEffect[] {
    return rows.map(row => ({
        id: normalizeDbId(row.id) ?? row.id,
        efficacyType: parseDbInt(row.efficacy_type),
        targetType: parseDbInt(row.target_type),
        subTargetTypeSetId: normalizeDbId(row.sub_target_type_set_id),
        calcOption: parseDbInt(row.calc_option),
        values: parseDbJsonArray(row.efficacy_values),
        rawCondition: normalizeText(row.causality_conditions),
    }));
}

function mapPassiveSkills(rows: GameDbRow[], passiveSkillById: Map<string, GameDbRow>): GameDbPassiveSkill[] {
    return rows
        .map(row => {
            const passiveSkillId = normalizeDbId(row.passive_skill_id);
            if (!passiveSkillId) {
                return undefined;
            }

            const passiveSkill = passiveSkillById.get(passiveSkillId);
            return {
                id: passiveSkillId,
                name: normalizeText(passiveSkill?.name ?? passiveSkillId),
            };
        })
        .filter((skill): skill is GameDbPassiveSkill => Boolean(skill));
}

function mapReferences(rows: GameDbRow[], relationField: string, lookup: Map<string, GameDbRow>): GameDbReference[] {
    return sortByOptionalNumber(rows, row => parseDbInt(row.num)).flatMap(row => {
        const targetId = normalizeDbId(row[relationField]);
        if (!targetId) {
            return [];
        }

        const target = lookup.get(targetId);
        return [{
            id: targetId,
            name: normalizeText(target?.name ?? targetId),
            order: parseDbInt(row.num),
        }];
    });
}

function mapGrowthSteps(rows: GameDbRow[]): GameDbGrowthStep[] {
    return sortByOptionalNumber(rows, row => parseDbInt(row.step)).map(row => ({
        id: normalizeDbId(row.id) ?? row.id,
        step: parseDbInt(row.step) ?? 0,
        maxLevel: parseDbInt(row.lv_max),
        maxSaLevel: parseDbInt(row.skill_lv_max),
        passiveSkillSetId: normalizeDbId(row.passive_skill_set_id),
        leaderSkillSetId: normalizeDbId(row.leader_skill_set_id),
    }));
}

function mapLeaderSkillSet(
    leaderSkillSetId: string | undefined,
    leaderSkillSetById: Map<string, GameDbRow>,
    leaderSkillsBySetId: Map<string, GameDbRow[]>,
): GameDbLeaderSkillSet | undefined {
    if (!leaderSkillSetId) {
        return undefined;
    }

    const row = leaderSkillSetById.get(leaderSkillSetId);
    if (!row) {
        return undefined;
    }

    return {
        id: leaderSkillSetId,
        name: normalizeText(row.name),
        description: normalizeText(row.description),
        effects: mapLeaderSkillEffects(leaderSkillsBySetId.get(leaderSkillSetId) ?? []),
    };
}

function mapPassiveSkillSet(
    passiveSkillSetId: string | undefined,
    passiveSkillSetById: Map<string, GameDbRow>,
    passiveRelationsBySetId: Map<string, GameDbRow[]>,
    passiveSkillById: Map<string, GameDbRow>,
): GameDbPassiveSkillSet | undefined {
    if (!passiveSkillSetId) {
        return undefined;
    }

    const row = passiveSkillSetById.get(passiveSkillSetId);
    if (!row) {
        return undefined;
    }

    return {
        id: passiveSkillSetId,
        name: normalizeText(row.name),
        itemizedDescription: normalizeText(row.itemized_description) || undefined,
        groupItemizedDescription: normalizeText(row.sougou_only_itemized_description) || undefined,
        characterItemizedDescription: normalizeText(row.kobetu_only_itemized_description) || undefined,
        passiveSkills: mapPassiveSkills(passiveRelationsBySetId.get(passiveSkillSetId) ?? [], passiveSkillById),
    };
}

function canonicalJsonIdentity(raw: string | undefined): string {
    if (!raw?.trim()) {
        return "";
    }

    function canonicalize(value: unknown): unknown {
        if (Array.isArray(value)) {
            return value.map(canonicalize);
        }
        if (value !== null && typeof value === "object") {
            return Object.fromEntries(Object.entries(value as Record<string, unknown>)
                .sort(([left], [right]) => left.localeCompare(right))
                .map(([key, nested]) => [key, canonicalize(nested)]));
        }
        return value;
    }

    try {
        return JSON.stringify(canonicalize(JSON.parse(raw)));
    } catch {
        return `opaque:${raw.trim()}`;
    }
}

function superAttackReleaseSlotKey(attack: GameDbSuperAttack): string {
    return [
        attack.variant,
        attack.requiredKi ?? "",
        attack.cardCostumeConditionId ?? "",
        canonicalJsonIdentity(attack.causalityConditionsRaw),
    ].join("|");
}

export function selectSuperAttacksAtMaxLevel(
    superAttacks: GameDbSuperAttack[],
    maxSaLevel: number,
): GameDbSuperAttack[] {
    const maximumZeroBasedLevel = Math.max(maxSaLevel - 1, 0);
    const selectedBySlot = new Map<string, GameDbSuperAttack>();

    for (const attack of superAttacks) {
        const levelStart = attack.levelStart ?? 0;
        if (levelStart > maximumZeroBasedLevel) {
            continue;
        }

        const slotKey = superAttackReleaseSlotKey(attack);
        const selected = selectedBySlot.get(slotKey);
        if (!selected || (selected.levelStart ?? 0) <= levelStart) {
            selectedBySlot.set(slotKey, attack);
        }
    }

    return [...selectedBySlot.values()].sort((left, right) => {
        const priorityDifference = (left.detailViewPriority ?? 0) - (right.detailViewPriority ?? 0);
        if (priorityDifference !== 0) {
            return priorityDifference;
        }

        const variantOrder = { super: 0, ultra: 1, unit: 2, extra: 3, unknown: 4 } as const;
        const variantDifference = variantOrder[left.variant] - variantOrder[right.variant];
        if (variantDifference !== 0) {
            return variantDifference;
        }

        return Number(left.cardSpecialId) - Number(right.cardSpecialId);
    });
}

function releaseGrowthStepNumbers(rarity: Rarities): { eza?: number, seza?: number } {
    if (rarity === Rarities.LR) {
        return { eza: 3, seza: 4 };
    }

    if (rarity === Rarities.UR) {
        return { eza: 7, seza: 8 };
    }

    return {};
}

function buildReleaseState(args: {
    releaseState: GameDbCharacterReleaseStateName,
    maxLevel: number,
    maxSaLevel: number,
    leaderSkillSetId?: string,
    passiveSkillSetId?: string,
    allSuperAttacks: GameDbSuperAttack[],
    growthStep?: GameDbGrowthStep,
    leaderSkillSetById: Map<string, GameDbRow>,
    leaderSkillsBySetId: Map<string, GameDbRow[]>,
    passiveSkillSetById: Map<string, GameDbRow>,
    passiveRelationsBySetId: Map<string, GameDbRow[]>,
    passiveSkillById: Map<string, GameDbRow>,
}): GameDbCharacterReleaseState {
    return {
        releaseState: args.releaseState,
        maxLevel: args.maxLevel,
        maxSaLevel: args.maxSaLevel,
        leaderSkill: mapLeaderSkillSet(args.leaderSkillSetId, args.leaderSkillSetById, args.leaderSkillsBySetId),
        passiveSkillSet: mapPassiveSkillSet(
            args.passiveSkillSetId,
            args.passiveSkillSetById,
            args.passiveRelationsBySetId,
            args.passiveSkillById,
        ),
        superAttacks: selectSuperAttacksAtMaxLevel(args.allSuperAttacks, args.maxSaLevel),
        growthStep: args.growthStep,
    };
}

function mapAwakeningRoutes(rows: GameDbRow[], direction: "incoming" | "outgoing"): GameDbAwakeningRoute[] {
    return sortByOptionalNumber(rows, row => parseDbInt(row.priority)).map(row => ({
        id: normalizeDbId(row.id) ?? row.id,
        type: normalizeText(row.type),
        fromCardId: normalizeDbId(row.card_id) ?? "",
        toCardId: normalizeDbId(row.awaked_card_id) ?? "",
        awakeningSetId: normalizeDbId(row.card_awakening_set_id),
        optimalAwakeningStep: parseDbInt(row.optimal_awakening_step),
        optimalAwakeningType: normalizeText(row.optimal_awakening_type),
        description: normalizeText(row.description),
        priority: parseDbInt(row.priority),
        openAt: parseDbDate(row.open_at),
    })).filter(route => direction === "incoming" ? route.toCardId.length > 0 : route.fromCardId.length > 0);
}

function mapAwakeningKind(routeType: string): GameDbFormRelationKind {
    if (routeType === "CardAwakeningRoute::Zet") {
        return "awakening-z";
    }

    if (routeType === "CardAwakeningRoute::Dokkan") {
        return "awakening-dokkan";
    }

    return "awakening-other";
}

function mapActiveFormRelations(
    activeSkillSetIds: string[],
    activeSkillEffectsBySetId: Map<string, GameDbRow[]>,
    activeSkillSetById: Map<string, GameDbRow>,
    cardId: string,
): GameDbFormRelation[] {
    return activeSkillSetIds.flatMap(activeSkillSetId => {
        const activeSkillSet = activeSkillSetById.get(activeSkillSetId);
        return (activeSkillEffectsBySetId.get(activeSkillSetId) ?? []).flatMap(effectRow => {
            const efficacyType = parseDbInt(effectRow.efficacy_type);
            const targetCardId = normalizeDbId(effectRow.eff_val1);

            if (!targetCardId) {
                return [];
            }

            let kind: GameDbFormRelationKind | undefined;
            if (efficacyType === 103) {
                kind = "active-transformation";
            } else if (efficacyType === 79) {
                kind = "active-giant-rage";
            }

            if (!kind) {
                return [];
            }

            return [{
                sourceCardId: cardId,
                targetCardId,
                kind,
                sourceSkillSetId: activeSkillSetId,
                sourceSkillId: normalizeDbId(effectRow.id),
                sourceName: normalizeText(activeSkillSet?.name),
                description: normalizeText(activeSkillSet?.effect_description),
            }];
        });
    });
}

function mapStandbySkillSets(
    rows: GameDbRow[],
    standbySkillSetById: Map<string, GameDbRow>,
    finishRelationsByStandbyId: Map<string, GameDbRow[]>,
): GameDbStandbySkillSet[] {
    return rows.flatMap(row => {
        const standbySkillSetId = normalizeDbId(row.standby_skill_set_id);
        if (!standbySkillSetId) {
            return [];
        }

        const standbySkillSet = standbySkillSetById.get(standbySkillSetId);
        if (!standbySkillSet) {
            return [];
        }

        const linkedFinishSkillSetIds = (finishRelationsByStandbyId.get(standbySkillSetId) ?? [])
            .map(relation => normalizeDbId(relation.finish_skill_set_id))
            .filter((value): value is string => Boolean(value));

        return [{
            id: standbySkillSetId,
            name: normalizeText(standbySkillSet.name),
            effectDescription: normalizeText(standbySkillSet.effect_description),
            conditionDescription: normalizeText(standbySkillSet.condition_description),
            execLimit: parseDbInt(standbySkillSet.exec_limit),
            linkedFinishSkillSetIds,
        }];
    });
}

function mapFinishSkillSets(
    finishSkillSetIds: string[],
    finishSkillSetById: Map<string, GameDbRow>,
    standbyRelationsByFinishId: Map<string, GameDbRow[]>,
): GameDbFinishSkillSet[] {
    return finishSkillSetIds.flatMap(finishSkillSetId => {
        const finishSkillSet = finishSkillSetById.get(finishSkillSetId);
        if (!finishSkillSet) {
            return [];
        }

        const linkedStandbySkillSetIds = (standbyRelationsByFinishId.get(finishSkillSetId) ?? [])
            .map(relation => normalizeDbId(relation.standby_skill_set_id))
            .filter((value): value is string => Boolean(value));

        return [{
            id: finishSkillSetId,
            name: normalizeText(finishSkillSet.name),
            effectDescription: normalizeText(finishSkillSet.effect_description),
            conditionDescription: normalizeText(finishSkillSet.condition_description),
            execTimingType: parseDbInt(finishSkillSet.exec_timing_type),
            execLimit: parseDbInt(finishSkillSet.exec_limit),
            linkedStandbySkillSetIds,
        }];
    });
}

function mapStandbyFormRelations(
    standbySkillSets: GameDbStandbySkillSet[],
    standbySkillRowsBySetId: Map<string, GameDbRow[]>,
    cardId: string,
): GameDbFormRelation[] {
    return standbySkillSets.flatMap(standbySkillSet => {
        return (standbySkillRowsBySetId.get(standbySkillSet.id) ?? []).flatMap(row => {
            if (parseDbInt(row.efficacy_type) !== 103) {
                return [];
            }

            const targetCardId = normalizeDbId(String(parseDbJsonArray(row.efficacy_values)[0] ?? ""));
            if (!targetCardId) {
                return [];
            }

            return [{
                sourceCardId: cardId,
                targetCardId,
                kind: "standby-transformation",
                sourceSkillSetId: standbySkillSet.id,
                sourceSkillId: normalizeDbId(row.id),
                sourceName: standbySkillSet.name,
                description: standbySkillSet.effectDescription,
            }];
        });
    });
}

function mapFinishFormRelations(
    finishSkillSets: GameDbFinishSkillSet[],
    finishSkillRowsBySetId: Map<string, GameDbRow[]>,
    cardId: string,
): GameDbFormRelation[] {
    return finishSkillSets.flatMap(finishSkillSet => {
        return (finishSkillRowsBySetId.get(finishSkillSet.id) ?? []).flatMap(row => {
            if (parseDbInt(row.efficacy_type) !== 103) {
                return [];
            }

            const targetCardId = normalizeDbId(String(parseDbJsonArray(row.efficacy_values)[0] ?? ""));
            if (!targetCardId) {
                return [];
            }

            return [{
                sourceCardId: cardId,
                targetCardId,
                kind: "finish-transformation",
                sourceSkillSetId: finishSkillSet.id,
                sourceSkillId: normalizeDbId(row.id),
                sourceName: finishSkillSet.name,
                description: finishSkillSet.effectDescription,
            }];
        });
    });
}

function mapPassiveFormRelations(
    passiveSkillSet: GameDbPassiveSkillSet | undefined,
    passiveRelationRows: GameDbRow[],
    passiveSkillById: Map<string, GameDbRow>,
    cardId: string,
): GameDbFormRelation[] {
    if (!passiveSkillSet) {
        return [];
    }

    return passiveRelationRows.flatMap(relationRow => {
        const passiveSkillId = normalizeDbId(relationRow.passive_skill_id);
        if (!passiveSkillId) {
            return [];
        }

        const passiveSkillRow = passiveSkillById.get(passiveSkillId);
        if (!passiveSkillRow) {
            return [];
        }

        const efficacyType = parseDbInt(passiveSkillRow.efficacy_type);
        const targetCardId = normalizeDbId(passiveSkillRow.eff_value1);

        if (!targetCardId) {
            return [];
        }

        let kind: GameDbFormRelationKind | undefined;
        if (efficacyType === 103) {
            kind = "passive-transformation";
        } else if (efficacyType === 79) {
            kind = "passive-giant-rage";
        } else if (efficacyType === 131) {
            kind = "passive-reversible-exchange";
        }

        if (!kind) {
            return [];
        }

        return [{
            sourceCardId: cardId,
            targetCardId,
            kind,
            sourceSkillSetId: passiveSkillSet.id,
            sourceSkillId: passiveSkillId,
            sourceName: normalizeText(passiveSkillRow.name),
            description: passiveSkillSet.itemizedDescription ?? passiveSkillSet.name,
        }];
    });
}

function compareFormRelations(left: GameDbFormRelation, right: GameDbFormRelation): number {
    const kindOrder: Record<GameDbFormRelationKind, number> = {
        "awakening-z": 0,
        "awakening-dokkan": 1,
        "awakening-other": 2,
        "passive-transformation": 3,
        "passive-giant-rage": 4,
        "passive-reversible-exchange": 5,
        "active-transformation": 6,
        "active-giant-rage": 7,
        "standby-transformation": 8,
        "finish-transformation": 9,
    };

    const leftPriority = kindOrder[left.kind] ?? Number.MAX_SAFE_INTEGER;
    const rightPriority = kindOrder[right.kind] ?? Number.MAX_SAFE_INTEGER;
    if (leftPriority !== rightPriority) {
        return leftPriority - rightPriority;
    }

    return [
        left.targetCardId,
        left.sourceSkillSetId ?? "",
        left.sourceSkillId ?? "",
    ].join(":").localeCompare([
        right.targetCardId,
        right.sourceSkillSetId ?? "",
        right.sourceSkillId ?? "",
    ].join(":"));
}

function dedupeFormRelations(relations: GameDbFormRelation[]): GameDbFormRelation[] {
    const dedupedRelations = new Map<string, GameDbFormRelation>();
    for (const relation of relations) {
        const key = [
            relation.sourceCardId,
            relation.targetCardId,
            relation.kind,
            relation.sourceSkillSetId ?? "",
            relation.sourceSkillId ?? "",
        ].join(":");

        if (!dedupedRelations.has(key)) {
            dedupedRelations.set(key, relation);
        }
    }

    return [...dedupedRelations.values()];
}

function isMeaningfulFormRelation(relation: GameDbFormRelation): boolean {
    if (!relation.targetCardId) {
        return false;
    }

    if (relation.sourceCardId === relation.targetCardId) {
        return false;
    }

    if (relation.kind === "awakening-other" && relation.sourceName === "CardAwakeningRoute::Optimal") {
        return false;
    }

    return true;
}

export function finalizeFormRelations(
    relations: GameDbFormRelation[],
    cardById: Map<string, GameDbRow>,
): GameDbFormRelation[] {
    return dedupeFormRelations(relations)
        .filter(isMeaningfulFormRelation)
        .map(relation => ({
            ...relation,
            targetName: normalizeText(cardById.get(relation.targetCardId)?.name) || relation.targetName,
        }))
        .sort(compareFormRelations);
}

function isAwakeningFormRelation(relation: GameDbFormRelation): boolean {
    return relation.kind.startsWith("awakening-");
}

function hasDbTransformationLikeRelation(character: GameDbCharacterSnapshot): boolean {
    return character.formRelations.some(relation => !isAwakeningFormRelation(relation));
}

function hasDbReversibleExchange(character: GameDbCharacterSnapshot): boolean {
    return character.formRelations.some(relation => relation.kind === "passive-reversible-exchange");
}

export function buildGameDbCharacterSnapshots(cardIds: string[], tables: Record<string, GameDbRow[]>): GameDbCharacterSnapshot[] {
    const cardById = buildLookup(tables.cards);
    const leaderSkillSetById = buildLookup(tables.leader_skill_sets);
    const passiveSkillSetById = buildLookup(tables.passive_skill_sets);
    const passiveSkillById = buildLookup(tables.passive_skills);
    const specialSetById = buildLookup(tables.special_sets);
    const activeSkillSetById = buildLookup(tables.active_skill_sets);
    const ultimateSpecialById = buildLookup(tables.ultimate_specials);
    const linkById = buildLookup(tables.link_skills);
    const categoryById = buildLookup(tables.card_categories);
    const standbySkillSetById = buildLookup(tables.standby_skill_sets);
    const finishSkillSetById = buildLookup(tables.finish_skill_sets);

    const leaderSkillsBySetId = groupBy(tables.leader_skills, "leader_skill_set_id");
    const passiveRelationsBySetId = groupBy(tables.passive_skill_set_relations, "passive_skill_set_id");
    const activeSkillRelationsByCardId = groupBy(tables.card_active_skills, "card_id");
    const activeSkillEffectsBySetId = groupBy(tables.active_skills, "active_skill_set_id");
    const cardSpecialsByCardId = groupBy(tables.card_specials, "card_id");
    const specialEffectRows = tables.specials ?? [];
    for (const row of specialEffectRows) {
        if (!normalizeDbId(row.id) || !normalizeDbId(row.special_set_id)) {
            throw new Error("specials contains an effect without an id or special_set_id");
        }
    }
    const specialEffectsBySetId = groupBy(specialEffectRows, "special_set_id");
    const categoriesByCardId = groupBy(tables.card_card_categories, "card_id");
    const standbyRelationsByCardId = groupBy(tables.card_standby_skill_set_relations, "card_id");
    const finishRelationsByCardId = groupBy(tables.card_finish_skill_set_relations, "card_id");
    const finishRelationsByStandbyId = groupBy(tables.standby_skill_set_finish_skill_set_relations, "standby_skill_set_id");
    const standbyRelationsByFinishId = groupBy(tables.standby_skill_set_finish_skill_set_relations, "finish_skill_set_id");
    const standbySkillRowsBySetId = groupBy(tables.standby_skills, "standby_skill_set_id");
    const finishSkillRowsBySetId = groupBy(tables.finish_skills, "finish_skill_set_id");
    const optimalAwakeningsByGrowType = groupBy(tables.optimal_awakening_growths, "optimal_awakening_grow_type");

    const outgoingAwakeningsByCardId = groupBy(tables.card_awakening_routes, "card_id");
    const incomingAwakeningsByCardId = groupBy(tables.card_awakening_routes, "awaked_card_id");

    return cardIds.map(cardId => {
        const card = cardById.get(cardId);
        if (!card) {
            throw new Error(`Card ${cardId} was not found in cards.csv`);
        }

        const leaderSkillSetId = normalizeDbId(card.leader_skill_set_id);
        const passiveSkillSetId = normalizeDbId(card.passive_skill_set_id);
        const optimalAwakeningGrowType = normalizeDbId(card.optimal_awakening_grow_type);
        const growthRows = optimalAwakeningGrowType ? (optimalAwakeningsByGrowType.get(optimalAwakeningGrowType) ?? []) : [];
        const growthSteps = mapGrowthSteps(growthRows);
        const rarity = mapRarity(card.rarity);
        const baseMaxLevel = parseDbInt(card.lv_max) ?? 0;
        const baseMaxSaLevel = parseDbInt(card.skill_lv_max) ?? 0;
        const allSuperAttacks = mapSuperAttacks(
            cardId,
            cardSpecialsByCardId.get(cardId) ?? [],
            specialSetById,
            specialEffectsBySetId,
        );
        const initialReleaseState = buildReleaseState({
            releaseState: "initial",
            maxLevel: baseMaxLevel,
            maxSaLevel: baseMaxSaLevel,
            leaderSkillSetId,
            passiveSkillSetId,
            allSuperAttacks,
            leaderSkillSetById,
            leaderSkillsBySetId,
            passiveSkillSetById,
            passiveRelationsBySetId,
            passiveSkillById,
        });
        const releaseSteps = releaseGrowthStepNumbers(rarity);
        const ezaGrowthStep = growthSteps.find(step => step.step === releaseSteps.eza);
        const sezaGrowthStep = growthSteps.find(step => step.step === releaseSteps.seza);
        const ezaReleaseState = ezaGrowthStep
            ? buildReleaseState({
                releaseState: "eza",
                maxLevel: ezaGrowthStep.maxLevel ?? baseMaxLevel,
                maxSaLevel: ezaGrowthStep.maxSaLevel ?? baseMaxSaLevel,
                leaderSkillSetId: ezaGrowthStep.leaderSkillSetId ?? initialReleaseState.leaderSkill?.id,
                passiveSkillSetId: ezaGrowthStep.passiveSkillSetId ?? initialReleaseState.passiveSkillSet?.id,
                allSuperAttacks,
                growthStep: ezaGrowthStep,
                leaderSkillSetById,
                leaderSkillsBySetId,
                passiveSkillSetById,
                passiveRelationsBySetId,
                passiveSkillById,
            })
            : undefined;
        const sezaReleaseState = sezaGrowthStep
            ? buildReleaseState({
                releaseState: "seza",
                maxLevel: sezaGrowthStep.maxLevel ?? ezaReleaseState?.maxLevel ?? baseMaxLevel,
                maxSaLevel: sezaGrowthStep.maxSaLevel ?? ezaReleaseState?.maxSaLevel ?? baseMaxSaLevel,
                leaderSkillSetId: sezaGrowthStep.leaderSkillSetId
                    ?? ezaReleaseState?.leaderSkill?.id
                    ?? initialReleaseState.leaderSkill?.id,
                passiveSkillSetId: sezaGrowthStep.passiveSkillSetId
                    ?? ezaReleaseState?.passiveSkillSet?.id
                    ?? initialReleaseState.passiveSkillSet?.id,
                allSuperAttacks,
                growthStep: sezaGrowthStep,
                leaderSkillSetById,
                leaderSkillsBySetId,
                passiveSkillSetById,
                passiveRelationsBySetId,
                passiveSkillById,
            })
            : undefined;
        const leaderSkill = initialReleaseState.leaderSkill;
        const passiveSkillSet = initialReleaseState.passiveSkillSet;
        const passiveRelationRows = passiveRelationsBySetId.get(passiveSkillSetId ?? "") ?? [];

        const links = [
            "link_skill1_id",
            "link_skill2_id",
            "link_skill3_id",
            "link_skill4_id",
            "link_skill5_id",
            "link_skill6_id",
            "link_skill7_id",
        ].flatMap((linkField, index) => {
            const linkId = normalizeDbId(card[linkField]);
            if (!linkId) {
                return [];
            }

            const link = linkById.get(linkId);
            return [{
                id: linkId,
                name: normalizeText(link?.name ?? linkId),
                order: index + 1,
            }];
        });

        const categories = mapReferences(categoriesByCardId.get(cardId) ?? [], "card_category_id", categoryById);

        const outgoingAwakenings = mapAwakeningRoutes(outgoingAwakeningsByCardId.get(cardId) ?? [], "outgoing");
        const incomingAwakenings = mapAwakeningRoutes(incomingAwakeningsByCardId.get(cardId) ?? [], "incoming");

        const standbySkillSets = mapStandbySkillSets(
            standbyRelationsByCardId.get(cardId) ?? [],
            standbySkillSetById,
            finishRelationsByStandbyId,
        );

        const directFinishSkillSetIds = (finishRelationsByCardId.get(cardId) ?? [])
            .map(row => normalizeDbId(row.finish_skill_set_id))
            .filter((value): value is string => Boolean(value));
        const linkedFinishSkillSetIds = standbySkillSets.flatMap(standbySkillSet => standbySkillSet.linkedFinishSkillSetIds);
        const finishSkillSetIds = [...new Set([...directFinishSkillSetIds, ...linkedFinishSkillSetIds])];
        const finishSkillSets = mapFinishSkillSets(finishSkillSetIds, finishSkillSetById, standbyRelationsByFinishId);
        const activeSkillSetIds = (activeSkillRelationsByCardId.get(cardId) ?? [])
            .map(row => normalizeDbId(row.active_skill_set_id))
            .filter((value): value is string => Boolean(value));

        const formRelations = finalizeFormRelations([
            ...outgoingAwakenings.map(route => ({
                sourceCardId: cardId,
                targetCardId: route.toCardId,
                kind: mapAwakeningKind(route.type),
                sourceName: route.type,
                description: route.description,
            })),
            ...mapPassiveFormRelations(passiveSkillSet, passiveRelationRows, passiveSkillById, cardId),
            ...mapActiveFormRelations(activeSkillSetIds, activeSkillEffectsBySetId, activeSkillSetById, cardId),
            ...mapStandbyFormRelations(standbySkillSets, standbySkillRowsBySetId, cardId),
            ...mapFinishFormRelations(finishSkillSets, finishSkillRowsBySetId, cardId),
        ], cardById);

        const hasEza = Boolean(ezaReleaseState);
        const hasSeza = Boolean(sezaReleaseState);

        return {
            id: cardId,
            source: "game-db",
            characterId: normalizeDbId(card.character_id) ?? "",
            cardUniqueInfoId: normalizeDbId(card.card_unique_info_id) ?? "",
            resourceId: normalizeDbId(card.resource_id),
            name: normalizeText(card.name),
            rarity,
            type: mapType(card.element),
            characterClass: mapCharacterClass(card.element),
            cost: parseDbInt(card.cost) ?? 0,
            releaseDate: parseDbDate(card.open_at),
            baseMaxLevel,
            baseMaxSaLevel,
            stats: {
                hpInitial: parseDbInt(card.hp_init) ?? 0,
                hpMax: parseDbInt(card.hp_max) ?? 0,
                atkInitial: parseDbInt(card.atk_init) ?? 0,
                atkMax: parseDbInt(card.atk_max) ?? 0,
                defInitial: parseDbInt(card.def_init) ?? 0,
                defMax: parseDbInt(card.def_max) ?? 0,
            },
            links,
            categories,
            leaderSkill,
            passiveSkillSet,
            superAttacks: allSuperAttacks,
            activeSkillSets: mapActiveSkillSets(
                activeSkillRelationsByCardId.get(cardId) ?? [],
                activeSkillSetById,
                activeSkillEffectsBySetId,
                ultimateSpecialById,
            ),
            standbySkillSets,
            finishSkillSets,
            formRelations,
            growthSteps,
            releaseStates: {
                initial: initialReleaseState,
                ...(ezaReleaseState ? { eza: ezaReleaseState } : {}),
                ...(sezaReleaseState ? { seza: sezaReleaseState } : {}),
            },
            hasEza,
            hasSeza,
            awakeningRoutes: {
                incoming: incomingAwakenings,
                outgoing: outgoingAwakenings,
            },
            raw: {
                element: card.element,
                leaderSkillSetId,
                passiveSkillSetId,
                optimalAwakeningGrowType,
                potentialBoardId: normalizeDbId(card.potential_board_id),
            },
        };
    });
}

export function buildGameDbComparisonReport(dbCharacters: GameDbCharacterSnapshot[], fyiCharacters: any[] | undefined): GameDbComparisonReport {
    const generatedAt = new Date().toISOString();
    if (!fyiCharacters || fyiCharacters.length === 0) {
        return {
            generatedAt,
            comparedCardCount: 0,
            fyiSampleFound: false,
            cards: [],
        };
    }

    const fyiById = new Map<string, any>(fyiCharacters.map(character => [String(character.id), character]));

    const cards: GameDbComparisonCardReport[] = dbCharacters.map(dbCharacter => {
        const fyiCharacter = fyiById.get(dbCharacter.id);
        const checks: GameDbComparisonCheck[] = [];
        const dbHasTransformationLikeRelation = hasDbTransformationLikeRelation(dbCharacter);
        const dbHasReversibleExchange = hasDbReversibleExchange(dbCharacter);
        const fyiTransformationCount = Array.isArray(fyiCharacter?.transformations) ? fyiCharacter.transformations.length : 0;
        const fyiHasReversibleExchange = Boolean(fyiCharacter?.reversibleExchange);
        const fyiHasTransformationLikeRelation = fyiTransformationCount > 0 || fyiHasReversibleExchange;

        const pushCheck = (field: string, dbValue: unknown, fyiValue: unknown) => {
            checks.push({
                field,
                matches: dbValue === fyiValue,
                dbValue,
                fyiValue,
            });
        };

        if (fyiCharacter) {
            pushCheck("name", dbCharacter.name, fyiCharacter.name);
            pushCheck("rarity", dbCharacter.rarity, fyiCharacter.rarity);
            pushCheck("type", dbCharacter.type, fyiCharacter.type);
            pushCheck("characterClass", dbCharacter.characterClass, fyiCharacter.characterClass);
            pushCheck("cost", dbCharacter.cost, fyiCharacter.cost);
            pushCheck("linkCount", dbCharacter.links.length, Array.isArray(fyiCharacter.links) ? fyiCharacter.links.length : 0);
            pushCheck("categoryCount", dbCharacter.categories.length, Array.isArray(fyiCharacter.categories) ? fyiCharacter.categories.length : 0);
            pushCheck("hasLeaderSkill", Boolean(dbCharacter.leaderSkill), Boolean(fyiCharacter.leaderSkill));
            pushCheck("hasActiveSkill", dbCharacter.activeSkillSets.length > 0, Boolean(fyiCharacter.activeSkill));
            pushCheck("hasStandby", dbCharacter.standbySkillSets.length > 0, Boolean(fyiCharacter.standby));
            pushCheck("hasFinish", dbCharacter.finishSkillSets.length > 0, Array.isArray(fyiCharacter.finishSkills) && fyiCharacter.finishSkills.length > 0);
            pushCheck("hasTransformationLikeRelation", dbHasTransformationLikeRelation, fyiHasTransformationLikeRelation);
            pushCheck("hasReversibleExchange", dbHasReversibleExchange, fyiHasReversibleExchange);
        }

        return {
            id: dbCharacter.id,
            fyiFound: Boolean(fyiCharacter),
            dbSummary: {
                name: dbCharacter.name,
                rarity: dbCharacter.rarity,
                type: dbCharacter.type,
                characterClass: dbCharacter.characterClass,
                linkCount: dbCharacter.links.length,
                categoryCount: dbCharacter.categories.length,
                hasLeaderSkill: Boolean(dbCharacter.leaderSkill),
                hasActiveSkill: dbCharacter.activeSkillSets.length > 0,
                hasStandby: dbCharacter.standbySkillSets.length > 0,
                hasFinish: dbCharacter.finishSkillSets.length > 0,
                formRelationCount: dbCharacter.formRelations.length,
                formRelationKinds: [...new Set(dbCharacter.formRelations.map(relation => relation.kind))],
                hasTransformationLikeRelation: dbHasTransformationLikeRelation,
                hasReversibleExchange: dbHasReversibleExchange,
                hasEza: dbCharacter.hasEza,
                hasSeza: dbCharacter.hasSeza,
            },
            fyiSummary: fyiCharacter ? {
                name: String(fyiCharacter.name ?? ""),
                rarity: String(fyiCharacter.rarity ?? ""),
                type: String(fyiCharacter.type ?? ""),
                characterClass: String(fyiCharacter.characterClass ?? ""),
                linkCount: Array.isArray(fyiCharacter.links) ? fyiCharacter.links.length : 0,
                categoryCount: Array.isArray(fyiCharacter.categories) ? fyiCharacter.categories.length : 0,
                hasLeaderSkill: Boolean(fyiCharacter.leaderSkill),
                hasActiveSkill: Boolean(fyiCharacter.activeSkill),
                hasStandby: Boolean(fyiCharacter.standby),
                hasFinish: Array.isArray(fyiCharacter.finishSkills) && fyiCharacter.finishSkills.length > 0,
                transformationCount: fyiTransformationCount,
                hasTransformationLikeRelation: fyiHasTransformationLikeRelation,
                hasReversibleExchange: fyiHasReversibleExchange,
            } : undefined,
            checks,
        };
    });

    return {
        generatedAt,
        comparedCardCount: cards.filter(card => card.fyiFound).length,
        fyiSampleFound: true,
        cards,
    };
}

export async function maybeReadFyiExperimentCharacters(): Promise<any[] | undefined> {
    const fyiExperimentPath = resolve(__dirname, "data", "fyi-experiment", "latest", "characters.json");

    try {
        const rawCharacters = await readFile(fyiExperimentPath, { encoding: "utf8" });
        const parsedCharacters = JSON.parse(rawCharacters);
        return Array.isArray(parsedCharacters) ? parsedCharacters : undefined;
    } catch {
        return undefined;
    }
}

export async function loadRequiredGameDbTables(
    sourceConfig: ReturnType<typeof resolveGameDbSourceConfig>,
): Promise<Record<string, GameDbRow[]>> {
    const tableEntries = await Promise.all(
        REQUIRED_GAME_DB_TABLES.map(async tableName => [tableName, await readGameDbTable(sourceConfig, tableName)] as const),
    );

    const optionalEntries = await Promise.all(
        SUPER_ATTACK_EFFECT_GAME_DB_TABLES.map(async tableName => {
            try {
                return [tableName, await readGameDbTable(sourceConfig, tableName)] as const;
            } catch (error: any) {
                if (error?.code === "ENOENT") {
                    return [tableName, []] as const;
                }
                throw error;
            }
        }),
    );

    return Object.fromEntries([...tableEntries, ...optionalEntries]) as Record<string, GameDbRow[]>;
}

async function main() {
    const { projectGameDbCharactersToDokkanpanion } = await import("./game-db-app-projection");
    const sourceConfig = resolveGameDbSourceConfig();
    const cardIds = parseCardIds(process.env.DOKKAN_GAME_DB_CARD_IDS);
    const tables = await loadRequiredGameDbTables(sourceConfig);
    const characters = buildGameDbCharacterSnapshots(cardIds, tables);
    const dokkanpanionProjection = projectGameDbCharactersToDokkanpanion(characters);
    const fyiCharacters = await maybeReadFyiExperimentCharacters();
    const comparisonReport = buildGameDbComparisonReport(characters, fyiCharacters);
    const generatedAt = new Date().toISOString();

    const report: GameDbExperimentReport = {
        source: "game-db",
        sourceRoot: sourceConfig.sourceRoot,
        dataDir: sourceConfig.dataDir,
        generatedAt,
        cardIds,
        count: characters.length,
        tables: REQUIRED_GAME_DB_TABLES,
        sourceSettings: await readSourceSettings(sourceConfig.settingsPath),
    };

    const outputDir = resolve(__dirname, "data", "game-db-experiment", "latest");
    await mkdir(outputDir, { recursive: true });
    await writeFormattedJson(resolve(outputDir, "characters.json"), characters);
    await writeFormattedJson(resolve(outputDir, "dokkanpanion-projection.json"), dokkanpanionProjection);
    await writeFormattedJson(resolve(outputDir, "report.json"), report);
    await writeFormattedJson(resolve(outputDir, "comparison-report.json"), comparisonReport);

    console.log(`Wrote ${characters.length} game-db experiment character(s) to ${outputDir}`);
}

if (require.main === module) {
    main().catch(error => {
        console.error(error);
        process.exitCode = 1;
    });
}

