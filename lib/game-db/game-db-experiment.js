"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadRequiredGameDbTables = exports.maybeReadFyiExperimentCharacters = exports.buildGameDbComparisonReport = exports.buildGameDbCharacterSnapshots = exports.finalizeFormRelations = exports.selectSuperAttacksAtMaxLevel = exports.parseCardIds = exports.REQUIRED_GAME_DB_TABLES = exports.DEFAULT_GOLDEN_CARD_IDS = exports.readSourceSettings = void 0;
const promises_1 = require("fs/promises");
const path_1 = require("path");
const character_1 = require("../character");
const game_db_active_skill_1 = require("./game-db-active-skill");
const game_db_super_attack_1 = require("./game-db-super-attack");
const game_db_table_inventory_1 = require("./game-db-table-inventory");
const game_db_source_1 = require("./game-db-source");
const format_json_1 = require("../format-json");
const game_db_source_settings_1 = require("./game-db-source-settings");
var game_db_source_settings_2 = require("./game-db-source-settings");
Object.defineProperty(exports, "readSourceSettings", { enumerable: true, get: function () { return game_db_source_settings_2.readSourceSettings; } });
exports.DEFAULT_GOLDEN_CARD_IDS = [
    "1032521",
    "1029471",
    "1025731",
    "1033061",
    "1029441",
    "1022781",
];
exports.REQUIRED_GAME_DB_TABLES = [...game_db_table_inventory_1.CORE_GAME_DB_TABLES];
function parseCardIds(value) {
    if (!value) {
        return [...exports.DEFAULT_GOLDEN_CARD_IDS];
    }
    const ids = value
        .split(",")
        .map(part => part.trim())
        .filter(part => part.length > 0);
    return ids.length > 0 ? ids : [...exports.DEFAULT_GOLDEN_CARD_IDS];
}
exports.parseCardIds = parseCardIds;
function mapRarity(value) {
    switch ((0, game_db_source_1.parseDbInt)(value)) {
        case 0:
            return character_1.Rarities.N;
        case 1:
            return character_1.Rarities.R;
        case 2:
            return character_1.Rarities.SR;
        case 3:
            return character_1.Rarities.SSR;
        case 4:
            return character_1.Rarities.UR;
        case 5:
            return character_1.Rarities.LR;
        default:
            throw new Error(`Unknown rarity value: ${value}`);
    }
}
function mapType(value) {
    switch (((0, game_db_source_1.parseDbInt)(value) ?? 0) % 10) {
        case 0:
            return character_1.Types.AGL;
        case 1:
            return character_1.Types.TEQ;
        case 2:
            return character_1.Types.INT;
        case 3:
            return character_1.Types.STR;
        case 4:
            return character_1.Types.PHY;
        default:
            throw new Error(`Unknown element/type value: ${value}`);
    }
}
function mapCharacterClass(value) {
    const normalized = value.trim();
    if (normalized.length <= 1) {
        return "None";
    }
    if (normalized.startsWith("1")) {
        return character_1.Classes.Super;
    }
    if (normalized.startsWith("2")) {
        return character_1.Classes.Extreme;
    }
    throw new Error(`Unknown class element value: ${value}`);
}
function normalizeText(value) {
    return (value ?? "").replace(/\r\n/g, "\n").trim();
}
function buildLookup(rows, idField = "id") {
    const lookup = new Map();
    for (const row of rows) {
        const id = (0, game_db_source_1.normalizeDbId)(row[idField]);
        if (id) {
            lookup.set(id, row);
        }
    }
    return lookup;
}
function groupBy(rows, key) {
    const grouped = new Map();
    for (const row of rows) {
        const id = (0, game_db_source_1.normalizeDbId)(row[key]);
        if (!id) {
            continue;
        }
        const existingRows = grouped.get(id);
        if (existingRows) {
            existingRows.push(row);
        }
        else {
            grouped.set(id, [row]);
        }
    }
    return grouped;
}
function sortByOptionalNumber(items, selector) {
    return [...items].sort((left, right) => (selector(left) ?? Number.MAX_SAFE_INTEGER) - (selector(right) ?? Number.MAX_SAFE_INTEGER));
}
function mapLeaderSkillEffects(rows) {
    return rows.map(row => ({
        id: (0, game_db_source_1.normalizeDbId)(row.id) ?? row.id,
        efficacyType: (0, game_db_source_1.parseDbInt)(row.efficacy_type),
        targetType: (0, game_db_source_1.parseDbInt)(row.target_type),
        subTargetTypeSetId: (0, game_db_source_1.normalizeDbId)(row.sub_target_type_set_id),
        calcOption: (0, game_db_source_1.parseDbInt)(row.calc_option),
        values: (0, game_db_source_1.parseDbJsonArray)(row.efficacy_values),
        rawCondition: normalizeText(row.causality_conditions),
    }));
}
function mapPassiveSkills(rows, passiveSkillById) {
    return rows
        .map(row => {
        const passiveSkillId = (0, game_db_source_1.normalizeDbId)(row.passive_skill_id);
        if (!passiveSkillId) {
            return undefined;
        }
        const passiveSkill = passiveSkillById.get(passiveSkillId);
        return {
            id: passiveSkillId,
            name: normalizeText(passiveSkill?.name ?? passiveSkillId),
        };
    })
        .filter((skill) => Boolean(skill));
}
function mapReferences(rows, relationField, lookup) {
    return sortByOptionalNumber(rows, row => (0, game_db_source_1.parseDbInt)(row.num)).flatMap(row => {
        const targetId = (0, game_db_source_1.normalizeDbId)(row[relationField]);
        if (!targetId) {
            return [];
        }
        const target = lookup.get(targetId);
        return [{
                id: targetId,
                name: normalizeText(target?.name ?? targetId),
                order: (0, game_db_source_1.parseDbInt)(row.num),
            }];
    });
}
function mapGrowthSteps(rows) {
    return sortByOptionalNumber(rows, row => (0, game_db_source_1.parseDbInt)(row.step)).map(row => ({
        id: (0, game_db_source_1.normalizeDbId)(row.id) ?? row.id,
        step: (0, game_db_source_1.parseDbInt)(row.step) ?? 0,
        maxLevel: (0, game_db_source_1.parseDbInt)(row.lv_max),
        maxSaLevel: (0, game_db_source_1.parseDbInt)(row.skill_lv_max),
        passiveSkillSetId: (0, game_db_source_1.normalizeDbId)(row.passive_skill_set_id),
        leaderSkillSetId: (0, game_db_source_1.normalizeDbId)(row.leader_skill_set_id),
    }));
}
function mapLeaderSkillSet(leaderSkillSetId, leaderSkillSetById, leaderSkillsBySetId) {
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
function mapPassiveSkillSet(passiveSkillSetId, passiveSkillSetById, passiveRelationsBySetId, passiveSkillById) {
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
function canonicalJsonIdentity(raw) {
    if (!raw?.trim()) {
        return "";
    }
    function canonicalize(value) {
        if (Array.isArray(value)) {
            return value.map(canonicalize);
        }
        if (value !== null && typeof value === "object") {
            return Object.fromEntries(Object.entries(value)
                .sort(([left], [right]) => left.localeCompare(right))
                .map(([key, nested]) => [key, canonicalize(nested)]));
        }
        return value;
    }
    try {
        return JSON.stringify(canonicalize(JSON.parse(raw)));
    }
    catch {
        return `opaque:${raw.trim()}`;
    }
}
function superAttackReleaseSlotKey(attack) {
    return [
        attack.variant,
        attack.requiredKi ?? "",
        attack.cardCostumeConditionId ?? "",
        canonicalJsonIdentity(attack.causalityConditionsRaw),
    ].join("|");
}
function selectSuperAttacksAtMaxLevel(superAttacks, maxSaLevel) {
    const maximumZeroBasedLevel = Math.max(maxSaLevel - 1, 0);
    const selectedBySlot = new Map();
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
        const variantOrder = { super: 0, ultra: 1, unit: 2, extra: 3, unknown: 4 };
        const variantDifference = variantOrder[left.variant] - variantOrder[right.variant];
        if (variantDifference !== 0) {
            return variantDifference;
        }
        return Number(left.cardSpecialId) - Number(right.cardSpecialId);
    });
}
exports.selectSuperAttacksAtMaxLevel = selectSuperAttacksAtMaxLevel;
function releaseGrowthStepNumbers(rarity) {
    if (rarity === character_1.Rarities.LR) {
        return { eza: 3, seza: 4 };
    }
    if (rarity === character_1.Rarities.UR) {
        return { eza: 7, seza: 8 };
    }
    return {};
}
function buildReleaseState(args) {
    return {
        releaseState: args.releaseState,
        releaseDate: args.releaseDate,
        maxLevel: args.maxLevel,
        maxSaLevel: args.maxSaLevel,
        leaderSkill: mapLeaderSkillSet(args.leaderSkillSetId, args.leaderSkillSetById, args.leaderSkillsBySetId),
        passiveSkillSet: mapPassiveSkillSet(args.passiveSkillSetId, args.passiveSkillSetById, args.passiveRelationsBySetId, args.passiveSkillById),
        superAttacks: selectSuperAttacksAtMaxLevel(args.allSuperAttacks, args.maxSaLevel),
        growthStep: args.growthStep,
    };
}
function optimalAwakeningReleaseDate(cardId, routes, releaseState, expectedStep) {
    if (expectedStep === undefined)
        return undefined;
    const expectedType = releaseState === "eza" ? "1" : "2";
    const matches = routes.filter(route => route.type === "CardAwakeningRoute::Optimal"
        && route.fromCardId === cardId
        && route.toCardId === cardId
        && route.optimalAwakeningType === expectedType
        && route.optimalAwakeningStep === expectedStep);
    if (matches.length > 1) {
        throw new Error(`Card ${cardId} has ambiguous ${releaseState.toUpperCase()} awakening release routes`);
    }
    return matches[0]?.openAt;
}
function mapAwakeningRoutes(rows, direction) {
    return sortByOptionalNumber(rows, row => (0, game_db_source_1.parseDbInt)(row.priority)).map(row => ({
        id: (0, game_db_source_1.normalizeDbId)(row.id) ?? row.id,
        type: normalizeText(row.type),
        fromCardId: (0, game_db_source_1.normalizeDbId)(row.card_id) ?? "",
        toCardId: (0, game_db_source_1.normalizeDbId)(row.awaked_card_id) ?? "",
        awakeningSetId: (0, game_db_source_1.normalizeDbId)(row.card_awakening_set_id),
        optimalAwakeningStep: (0, game_db_source_1.parseDbInt)(row.optimal_awakening_step),
        optimalAwakeningType: normalizeText(row.optimal_awakening_type),
        description: normalizeText(row.description),
        priority: (0, game_db_source_1.parseDbInt)(row.priority),
        openAt: (0, game_db_source_1.parseDbDate)(row.open_at),
    })).filter(route => direction === "incoming" ? route.toCardId.length > 0 : route.fromCardId.length > 0);
}
function mapAwakeningKind(routeType) {
    if (routeType === "CardAwakeningRoute::Zet") {
        return "awakening-z";
    }
    if (routeType === "CardAwakeningRoute::Dokkan") {
        return "awakening-dokkan";
    }
    return "awakening-other";
}
function mapActiveFormRelations(activeSkillSetIds, activeSkillEffectsBySetId, activeSkillSetById, cardId) {
    return activeSkillSetIds.flatMap(activeSkillSetId => {
        const activeSkillSet = activeSkillSetById.get(activeSkillSetId);
        return (activeSkillEffectsBySetId.get(activeSkillSetId) ?? []).flatMap(effectRow => {
            const efficacyType = (0, game_db_source_1.parseDbInt)(effectRow.efficacy_type);
            const targetCardId = (0, game_db_source_1.normalizeDbId)(effectRow.eff_val1);
            if (!targetCardId) {
                return [];
            }
            let kind;
            if (efficacyType === 103) {
                kind = "active-transformation";
            }
            else if (efficacyType === 79) {
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
                    sourceSkillId: (0, game_db_source_1.normalizeDbId)(effectRow.id),
                    sourceName: normalizeText(activeSkillSet?.name),
                    description: normalizeText(activeSkillSet?.effect_description),
                }];
        });
    });
}
function mapStandbySkillSets(rows, standbySkillSetById, finishRelationsByStandbyId) {
    return rows.flatMap(row => {
        const standbySkillSetId = (0, game_db_source_1.normalizeDbId)(row.standby_skill_set_id);
        if (!standbySkillSetId) {
            return [];
        }
        const standbySkillSet = standbySkillSetById.get(standbySkillSetId);
        if (!standbySkillSet) {
            return [];
        }
        const linkedFinishSkillSetIds = (finishRelationsByStandbyId.get(standbySkillSetId) ?? [])
            .map(relation => (0, game_db_source_1.normalizeDbId)(relation.finish_skill_set_id))
            .filter((value) => Boolean(value));
        return [{
                id: standbySkillSetId,
                name: normalizeText(standbySkillSet.name),
                effectDescription: normalizeText(standbySkillSet.effect_description),
                conditionDescription: normalizeText(standbySkillSet.condition_description),
                execLimit: (0, game_db_source_1.parseDbInt)(standbySkillSet.exec_limit),
                linkedFinishSkillSetIds,
            }];
    });
}
function mapFinishSkillSets(finishSkillSetIds, finishSkillSetById, standbyRelationsByFinishId) {
    return finishSkillSetIds.flatMap(finishSkillSetId => {
        const finishSkillSet = finishSkillSetById.get(finishSkillSetId);
        if (!finishSkillSet) {
            return [];
        }
        const linkedStandbySkillSetIds = (standbyRelationsByFinishId.get(finishSkillSetId) ?? [])
            .map(relation => (0, game_db_source_1.normalizeDbId)(relation.standby_skill_set_id))
            .filter((value) => Boolean(value));
        return [{
                id: finishSkillSetId,
                name: normalizeText(finishSkillSet.name),
                effectDescription: normalizeText(finishSkillSet.effect_description),
                conditionDescription: normalizeText(finishSkillSet.condition_description),
                execTimingType: (0, game_db_source_1.parseDbInt)(finishSkillSet.exec_timing_type),
                execLimit: (0, game_db_source_1.parseDbInt)(finishSkillSet.exec_limit),
                linkedStandbySkillSetIds,
            }];
    });
}
function mapStandbyFormRelations(standbySkillSets, standbySkillRowsBySetId, cardId) {
    return standbySkillSets.flatMap(standbySkillSet => {
        return (standbySkillRowsBySetId.get(standbySkillSet.id) ?? []).flatMap(row => {
            if ((0, game_db_source_1.parseDbInt)(row.efficacy_type) !== 103) {
                return [];
            }
            const targetCardId = (0, game_db_source_1.normalizeDbId)(String((0, game_db_source_1.parseDbJsonArray)(row.efficacy_values)[0] ?? ""));
            if (!targetCardId) {
                return [];
            }
            return [{
                    sourceCardId: cardId,
                    targetCardId,
                    kind: "standby-transformation",
                    sourceSkillSetId: standbySkillSet.id,
                    sourceSkillId: (0, game_db_source_1.normalizeDbId)(row.id),
                    sourceName: standbySkillSet.name,
                    description: standbySkillSet.effectDescription,
                }];
        });
    });
}
function mapFinishFormRelations(finishSkillSets, finishSkillRowsBySetId, cardId) {
    return finishSkillSets.flatMap(finishSkillSet => {
        return (finishSkillRowsBySetId.get(finishSkillSet.id) ?? []).flatMap(row => {
            if ((0, game_db_source_1.parseDbInt)(row.efficacy_type) !== 103) {
                return [];
            }
            const targetCardId = (0, game_db_source_1.normalizeDbId)(String((0, game_db_source_1.parseDbJsonArray)(row.efficacy_values)[0] ?? ""));
            if (!targetCardId) {
                return [];
            }
            return [{
                    sourceCardId: cardId,
                    targetCardId,
                    kind: "finish-transformation",
                    sourceSkillSetId: finishSkillSet.id,
                    sourceSkillId: (0, game_db_source_1.normalizeDbId)(row.id),
                    sourceName: finishSkillSet.name,
                    description: finishSkillSet.effectDescription,
                }];
        });
    });
}
function mapPassiveFormRelations(passiveSkillSet, passiveRelationRows, passiveSkillById, cardId) {
    if (!passiveSkillSet) {
        return [];
    }
    return passiveRelationRows.flatMap(relationRow => {
        const passiveSkillId = (0, game_db_source_1.normalizeDbId)(relationRow.passive_skill_id);
        if (!passiveSkillId) {
            return [];
        }
        const passiveSkillRow = passiveSkillById.get(passiveSkillId);
        if (!passiveSkillRow) {
            return [];
        }
        const efficacyType = (0, game_db_source_1.parseDbInt)(passiveSkillRow.efficacy_type);
        const targetCardId = (0, game_db_source_1.normalizeDbId)(passiveSkillRow.eff_value1);
        if (!targetCardId) {
            return [];
        }
        let kind;
        if (efficacyType === 103) {
            kind = "passive-transformation";
        }
        else if (efficacyType === 79) {
            kind = "passive-giant-rage";
        }
        else if (efficacyType === 131) {
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
function compareFormRelations(left, right) {
    const kindOrder = {
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
function dedupeFormRelations(relations) {
    const dedupedRelations = new Map();
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
function isMeaningfulFormRelation(relation) {
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
function finalizeFormRelations(relations, cardById) {
    return dedupeFormRelations(relations)
        .filter(isMeaningfulFormRelation)
        .map(relation => ({
        ...relation,
        targetName: normalizeText(cardById.get(relation.targetCardId)?.name) || relation.targetName,
    }))
        .sort(compareFormRelations);
}
exports.finalizeFormRelations = finalizeFormRelations;
function isAwakeningFormRelation(relation) {
    return relation.kind.startsWith("awakening-");
}
function hasDbTransformationLikeRelation(character) {
    return character.formRelations.some(relation => !isAwakeningFormRelation(relation));
}
function hasDbReversibleExchange(character) {
    return character.formRelations.some(relation => relation.kind === "passive-reversible-exchange");
}
const CANONICAL_GAMEPLAY_CARD_FIELDS = [
    "card_unique_info_id",
    "name",
    "character_id",
    "cost",
    "rarity",
    "hp_init",
    "hp_max",
    "atk_init",
    "atk_max",
    "def_init",
    "def_max",
    "element",
    "lv_max",
    "skill_lv_max",
    "grow_type",
    "optimal_awakening_grow_type",
    "passive_skill_set_id",
    "leader_skill_set_id",
    "link_skill1_id",
    "link_skill2_id",
    "link_skill3_id",
    "link_skill4_id",
    "link_skill5_id",
    "link_skill6_id",
    "link_skill7_id",
    "eball_mod_min",
    "eball_mod_num100",
    "eball_mod_mid",
    "eball_mod_mid_num",
    "eball_mod_max",
    "eball_mod_max_num",
    "awakening_number",
    "potential_board_id",
];
function canonicalGameplayCardKey(card) {
    // card_unique_info_id is a character identity and can span unrelated cards.
    // Alternative-art rows are narrower: their gameplay-bearing card fields are
    // identical even though id, open_at and presentation metadata differ.
    if (!(0, game_db_source_1.normalizeDbId)(card.card_unique_info_id)) {
        return undefined;
    }
    return CANONICAL_GAMEPLAY_CARD_FIELDS
        .map(field => `${field}=${normalizeText(card[field])}`)
        .join("\u001f");
}
function buildCanonicalInitialReleaseDates(cards) {
    const releaseDateByGameplayKey = new Map();
    for (const card of cards) {
        const gameplayKey = canonicalGameplayCardKey(card);
        const releaseDate = (0, game_db_source_1.parseDbDate)(card.open_at);
        if (!gameplayKey || !releaseDate) {
            continue;
        }
        const existingReleaseDate = releaseDateByGameplayKey.get(gameplayKey);
        if (!existingReleaseDate || releaseDate < existingReleaseDate) {
            releaseDateByGameplayKey.set(gameplayKey, releaseDate);
        }
    }
    return releaseDateByGameplayKey;
}
function buildGameDbCharacterSnapshots(cardIds, tables) {
    const cardById = buildLookup(tables.cards);
    const canonicalInitialReleaseDateByGameplayKey = buildCanonicalInitialReleaseDates(tables.cards);
    const leaderSkillSetById = buildLookup(tables.leader_skill_sets);
    const passiveSkillSetById = buildLookup(tables.passive_skill_sets);
    const passiveSkillById = buildLookup(tables.passive_skills);
    const specialSetById = buildLookup(tables.special_sets);
    const hasSpecialViews = (tables.special_views?.length ?? 0) > 0;
    const hasSpecialCategories = (tables.special_categories?.length ?? 0) > 0;
    if (hasSpecialViews !== hasSpecialCategories) {
        throw new Error("Incomplete Super Attack category table inventory");
    }
    const specialViewById = hasSpecialViews ? buildLookup(tables.special_views) : undefined;
    const specialCategoryById = hasSpecialCategories ? buildLookup(tables.special_categories) : undefined;
    const activeSkillSetById = buildLookup(tables.active_skill_sets);
    const ultimateSpecialById = buildLookup(tables.ultimate_specials);
    const linkById = buildLookup(tables.link_skills);
    const categoryById = buildLookup(tables.card_categories);
    const skillCausalityById = buildLookup(tables.skill_causalities);
    const standbySkillSetById = buildLookup(tables.standby_skill_sets);
    const finishSkillSetById = buildLookup(tables.finish_skill_sets);
    const leaderSkillsBySetId = groupBy(tables.leader_skills, "leader_skill_set_id");
    const passiveRelationsBySetId = groupBy(tables.passive_skill_set_relations, "passive_skill_set_id");
    const activeSkillRelationsByCardId = groupBy(tables.card_active_skills, "card_id");
    const activeSkillEffectsBySetId = groupBy(tables.active_skills, "active_skill_set_id");
    const cardSpecialsByCardId = groupBy(tables.card_specials, "card_id");
    const specialEffectRows = tables.specials ?? [];
    for (const row of specialEffectRows) {
        if (!(0, game_db_source_1.normalizeDbId)(row.id) || !(0, game_db_source_1.normalizeDbId)(row.special_set_id)) {
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
        const leaderSkillSetId = (0, game_db_source_1.normalizeDbId)(card.leader_skill_set_id);
        const passiveSkillSetId = (0, game_db_source_1.normalizeDbId)(card.passive_skill_set_id);
        const optimalAwakeningGrowType = (0, game_db_source_1.normalizeDbId)(card.optimal_awakening_grow_type);
        const growthRows = optimalAwakeningGrowType ? (optimalAwakeningsByGrowType.get(optimalAwakeningGrowType) ?? []) : [];
        const growthSteps = mapGrowthSteps(growthRows);
        const rarity = mapRarity(card.rarity);
        const baseMaxLevel = (0, game_db_source_1.parseDbInt)(card.lv_max) ?? 0;
        const baseMaxSaLevel = (0, game_db_source_1.parseDbInt)(card.skill_lv_max) ?? 0;
        const cardUniqueInfoId = (0, game_db_source_1.normalizeDbId)(card.card_unique_info_id) ?? "";
        const gameplayCardKey = canonicalGameplayCardKey(card);
        const initialReleaseDate = (gameplayCardKey
            ? canonicalInitialReleaseDateByGameplayKey.get(gameplayCardKey)
            : undefined)
            ?? (0, game_db_source_1.parseDbDate)(card.open_at);
        const outgoingAwakenings = mapAwakeningRoutes(outgoingAwakeningsByCardId.get(cardId) ?? [], "outgoing");
        const incomingAwakenings = mapAwakeningRoutes(incomingAwakeningsByCardId.get(cardId) ?? [], "incoming");
        const allSuperAttacks = (0, game_db_super_attack_1.mapSuperAttacks)(cardId, cardSpecialsByCardId.get(cardId) ?? [], specialSetById, specialEffectsBySetId, specialViewById, specialCategoryById);
        const initialReleaseState = buildReleaseState({
            releaseState: "initial",
            releaseDate: initialReleaseDate,
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
                releaseDate: optimalAwakeningReleaseDate(cardId, outgoingAwakenings, "eza", releaseSteps.eza),
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
                releaseDate: optimalAwakeningReleaseDate(cardId, outgoingAwakenings, "seza", releaseSteps.seza),
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
            const linkId = (0, game_db_source_1.normalizeDbId)(card[linkField]);
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
        const standbySkillSets = mapStandbySkillSets(standbyRelationsByCardId.get(cardId) ?? [], standbySkillSetById, finishRelationsByStandbyId);
        const directFinishSkillSetIds = (finishRelationsByCardId.get(cardId) ?? [])
            .map(row => (0, game_db_source_1.normalizeDbId)(row.finish_skill_set_id))
            .filter((value) => Boolean(value));
        const linkedFinishSkillSetIds = standbySkillSets.flatMap(standbySkillSet => standbySkillSet.linkedFinishSkillSetIds);
        const finishSkillSetIds = [...new Set([...directFinishSkillSetIds, ...linkedFinishSkillSetIds])];
        const finishSkillSets = mapFinishSkillSets(finishSkillSetIds, finishSkillSetById, standbyRelationsByFinishId);
        const activeSkillSetIds = (activeSkillRelationsByCardId.get(cardId) ?? [])
            .map(row => (0, game_db_source_1.normalizeDbId)(row.active_skill_set_id))
            .filter((value) => Boolean(value));
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
            characterId: (0, game_db_source_1.normalizeDbId)(card.character_id) ?? "",
            cardUniqueInfoId,
            resourceId: (0, game_db_source_1.normalizeDbId)(card.resource_id),
            name: normalizeText(card.name),
            rarity,
            type: mapType(card.element),
            characterClass: mapCharacterClass(card.element),
            cost: (0, game_db_source_1.parseDbInt)(card.cost) ?? 0,
            releaseDate: initialReleaseDate,
            baseMaxLevel,
            baseMaxSaLevel,
            stats: {
                hpInitial: (0, game_db_source_1.parseDbInt)(card.hp_init) ?? 0,
                hpMax: (0, game_db_source_1.parseDbInt)(card.hp_max) ?? 0,
                atkInitial: (0, game_db_source_1.parseDbInt)(card.atk_init) ?? 0,
                atkMax: (0, game_db_source_1.parseDbInt)(card.atk_max) ?? 0,
                defInitial: (0, game_db_source_1.parseDbInt)(card.def_init) ?? 0,
                defMax: (0, game_db_source_1.parseDbInt)(card.def_max) ?? 0,
            },
            links,
            categories,
            leaderSkill,
            passiveSkillSet,
            superAttacks: allSuperAttacks,
            activeSkillSets: (0, game_db_active_skill_1.mapActiveSkillSets)(activeSkillRelationsByCardId.get(cardId) ?? [], activeSkillSetById, activeSkillEffectsBySetId, ultimateSpecialById, skillCausalityById, categoryById),
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
                potentialBoardId: (0, game_db_source_1.normalizeDbId)(card.potential_board_id),
            },
        };
    });
}
exports.buildGameDbCharacterSnapshots = buildGameDbCharacterSnapshots;
function buildGameDbComparisonReport(dbCharacters, fyiCharacters) {
    const generatedAt = new Date().toISOString();
    if (!fyiCharacters || fyiCharacters.length === 0) {
        return {
            generatedAt,
            comparedCardCount: 0,
            fyiSampleFound: false,
            cards: [],
        };
    }
    const fyiById = new Map(fyiCharacters.map(character => [String(character.id), character]));
    const cards = dbCharacters.map(dbCharacter => {
        const fyiCharacter = fyiById.get(dbCharacter.id);
        const checks = [];
        const dbHasTransformationLikeRelation = hasDbTransformationLikeRelation(dbCharacter);
        const dbHasReversibleExchange = hasDbReversibleExchange(dbCharacter);
        const fyiTransformationCount = Array.isArray(fyiCharacter?.transformations) ? fyiCharacter.transformations.length : 0;
        const fyiHasReversibleExchange = Boolean(fyiCharacter?.reversibleExchange);
        const fyiHasTransformationLikeRelation = fyiTransformationCount > 0 || fyiHasReversibleExchange;
        const pushCheck = (field, dbValue, fyiValue) => {
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
exports.buildGameDbComparisonReport = buildGameDbComparisonReport;
async function maybeReadFyiExperimentCharacters() {
    const fyiExperimentPath = (0, path_1.resolve)(__dirname, "data", "fyi-experiment", "latest", "characters.json");
    try {
        const rawCharacters = await (0, promises_1.readFile)(fyiExperimentPath, { encoding: "utf8" });
        const parsedCharacters = JSON.parse(rawCharacters);
        return Array.isArray(parsedCharacters) ? parsedCharacters : undefined;
    }
    catch {
        return undefined;
    }
}
exports.maybeReadFyiExperimentCharacters = maybeReadFyiExperimentCharacters;
async function loadRequiredGameDbTables(sourceConfig) {
    const tableEntries = await Promise.all(exports.REQUIRED_GAME_DB_TABLES.map(async (tableName) => [tableName, await (0, game_db_source_1.readGameDbTable)(sourceConfig, tableName)]));
    const optionalEntries = await Promise.all([...game_db_table_inventory_1.SUPER_ATTACK_EFFECT_GAME_DB_TABLES, ...game_db_table_inventory_1.SUPER_ATTACK_CATEGORY_GAME_DB_TABLES].map(async (tableName) => {
        try {
            return [tableName, await (0, game_db_source_1.readGameDbTable)(sourceConfig, tableName)];
        }
        catch (error) {
            if (error?.code === "ENOENT") {
                return [tableName, []];
            }
            throw error;
        }
    }));
    return Object.fromEntries([...tableEntries, ...optionalEntries]);
}
exports.loadRequiredGameDbTables = loadRequiredGameDbTables;
async function main() {
    const { projectGameDbCharactersToDokkanpanion } = await Promise.resolve().then(() => require("./game-db-app-projection"));
    const sourceConfig = (0, game_db_source_1.resolveGameDbSourceConfig)();
    const cardIds = parseCardIds(process.env.DOKKAN_GAME_DB_CARD_IDS);
    const tables = await loadRequiredGameDbTables(sourceConfig);
    const characters = buildGameDbCharacterSnapshots(cardIds, tables);
    const dokkanpanionProjection = projectGameDbCharactersToDokkanpanion(characters);
    const fyiCharacters = await maybeReadFyiExperimentCharacters();
    const comparisonReport = buildGameDbComparisonReport(characters, fyiCharacters);
    const generatedAt = new Date().toISOString();
    const report = {
        source: "game-db",
        sourceRoot: sourceConfig.sourceRoot,
        dataDir: sourceConfig.dataDir,
        generatedAt,
        cardIds,
        count: characters.length,
        tables: exports.REQUIRED_GAME_DB_TABLES,
        sourceSettings: await (0, game_db_source_settings_1.readSourceSettings)(sourceConfig.settingsPath),
    };
    const outputDir = (0, path_1.resolve)(__dirname, "data", "game-db-experiment", "latest");
    await (0, promises_1.mkdir)(outputDir, { recursive: true });
    await (0, format_json_1.writeFormattedJson)((0, path_1.resolve)(outputDir, "characters.json"), characters);
    await (0, format_json_1.writeFormattedJson)((0, path_1.resolve)(outputDir, "dokkanpanion-projection.json"), dokkanpanionProjection);
    await (0, format_json_1.writeFormattedJson)((0, path_1.resolve)(outputDir, "report.json"), report);
    await (0, format_json_1.writeFormattedJson)((0, path_1.resolve)(outputDir, "comparison-report.json"), comparisonReport);
    console.log(`Wrote ${characters.length} game-db experiment character(s) to ${outputDir}`);
}
if (require.main === module) {
    main().catch(error => {
        console.error(error);
        process.exitCode = 1;
    });
}
//# sourceMappingURL=game-db-experiment.js.map