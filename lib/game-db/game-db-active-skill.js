"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mapActiveSkillSets = exports.buildGameDbActiveSkillActivationContract = exports.activeSkillActivationCondition = void 0;
const game_db_source_1 = require("./game-db-source");
function normalizeText(value) {
    return (value ?? "").replace(/\r\n/g, "\n").trim();
}
function compareDbIds(left, right) {
    const normalizedLeft = (0, game_db_source_1.normalizeDbId)(left) ?? "";
    const normalizedRight = (0, game_db_source_1.normalizeDbId)(right) ?? "";
    if (/^\d+$/.test(normalizedLeft) && /^\d+$/.test(normalizedRight)) {
        const numericLeft = BigInt(normalizedLeft);
        const numericRight = BigInt(normalizedRight);
        return numericLeft < numericRight ? -1 : numericLeft > numericRight ? 1 : 0;
    }
    return normalizedLeft < normalizedRight ? -1 : normalizedLeft > normalizedRight ? 1 : 0;
}
function rawOperand(value) {
    const trimmed = value?.trim() ?? "";
    return trimmed.length > 0 ? value ?? null : null;
}
function parseCompiledCausality(raw) {
    const trimmed = raw?.trim() ?? "";
    if (!trimmed)
        return undefined;
    try {
        const compiled = JSON.parse(trimmed)?.compiled;
        return isCompiledCausality(compiled) ? compiled : undefined;
    }
    catch {
        return undefined;
    }
}
function isCompiledCausality(value) {
    if (typeof value === "number" && Number.isSafeInteger(value) && value > 0)
        return true;
    return Array.isArray(value)
        && (value[0] === "&" || value[0] === "|")
        && value.length >= 2
        && value.slice(1).every(isCompiledCausality);
}
function causalityExpression(causalityId, row, categoryById) {
    const causalityType = (0, game_db_source_1.parseDbInt)(row?.causality_type) ?? 0;
    const values = [
        (0, game_db_source_1.parseDbInt)(row?.cau_val1) ?? 0,
        (0, game_db_source_1.parseDbInt)(row?.cau_val2) ?? 0,
        (0, game_db_source_1.parseDbInt)(row?.cau_val3) ?? 0,
    ];
    const provenance = {
        table: "skill_causalities",
        rowId: causalityId,
        causalityType,
        values,
    };
    const predicate = (value) => ({
        op: "predicate",
        predicate: {
            ...value,
            evidenceStatus: "supported",
            provenance,
        },
    });
    const unknown = () => ({
        op: "predicate",
        predicate: {
            kind: "unknown",
            evidenceStatus: "unknown",
            provenance,
        },
    });
    if (causalityType === 1 && values[0] > 0) {
        return predicate({ kind: "hp_percent", comparator: "gte", value: values[0] });
    }
    if (causalityType === 2 && values[0] > 0) {
        return predicate({ kind: "hp_percent", comparator: "lte", value: values[0] });
    }
    if (causalityType === 5 && values[0] >= 0) {
        return predicate({
            kind: "battle_turn",
            comparator: "gte",
            value: values[0] + 1,
        });
    }
    if (causalityType === 16 && values[0] === 2) {
        return predicate({ kind: "enemy_count", comparator: "eq", count: 1 });
    }
    if (causalityType === 18 && values[0] > 0) {
        return predicate({ kind: "enemy_hp_percent", comparator: "lte", value: values[0] });
    }
    if (causalityType === 34 && values[2] > 0) {
        const categoryId = String(values[1]);
        const category = normalizeText(categoryById.get(categoryId)?.name);
        if (category) {
            if (values[0] === 0) {
                return predicate({
                    kind: "team_category_count",
                    comparator: "gte",
                    count: values[2],
                    categories: [category],
                    selfInclusion: "included",
                });
            }
            if (values[0] === 1) {
                return predicate({ kind: "enemy_category", categories: [category] });
            }
            if (values[0] === 2) {
                return predicate({
                    kind: "rotation_category_count",
                    comparator: "gte",
                    count: values[2],
                    categories: [category],
                    selfInclusion: "included",
                });
            }
        }
    }
    if (causalityType === 37 && values[0] > 0 && values[1] >= 0) {
        return {
            op: "all",
            children: [
                predicate({ kind: "hp_percent", comparator: "lte", value: values[0] }),
                predicate({ kind: "battle_turn", comparator: "gte", value: values[1] + 1 }),
            ],
        };
    }
    if (causalityType === 44 && values[1] > 0) {
        const kind = values[0] === 1
            ? "super_attacks_performed"
            : values[0] === 2
                ? "attacks_performed"
                : values[0] === 3
                    ? "attacks_received"
                    : values[0] === 5
                        ? "attacks_evaded"
                        : undefined;
        return kind
            ? predicate({ kind, comparator: "gte", value: values[1] })
            : unknown();
    }
    if (causalityType === 46 && values[2] > 0) {
        const characterClass = values[1] === 32 ? "Super" : values[1] === 64 ? "Extreme" : undefined;
        if (characterClass && values[0] === 0) {
            return predicate({
                kind: "team_class_count",
                comparator: "gte",
                count: values[2],
                classes: [characterClass],
                selfInclusion: "included",
            });
        }
        if (characterClass && values[0] === 2) {
            return predicate({
                kind: "rotation_class_count",
                comparator: "gte",
                count: values[2],
                classes: [characterClass],
                selfInclusion: "included",
            });
        }
    }
    if (causalityType === 47 && values.every(value => value === 0)) {
        return predicate({ kind: "revive_triggered" });
    }
    if (causalityType === 55 && values[0] >= 0 && values[1] === 0 && values[2] === 0) {
        return values[0] === 1
            ? predicate({ kind: "next_attacking_turn" })
            : predicate({ kind: "turn_from_entry", comparator: "gte", value: values[0] + 1 });
    }
    if (causalityType === 58 && values.every(value => value === 0)) {
        return predicate({ kind: "runtime_gate" });
    }
    if (causalityType === 66 && values[0] === 1 && values[1] === 0 && values[2] === 0) {
        return predicate({ kind: "runtime_gate" });
    }
    if (causalityType === 67 && values[2] === 0) {
        const characterClass = values[1] === 32 ? "Super" : values[1] === 64 ? "Extreme" : undefined;
        if (values[0] === 2 && characterClass) {
            return predicate({
                kind: "all_team_class",
                comparator: "eq",
                count: 7,
                classes: [characterClass],
                selfInclusion: "included",
            });
        }
        if (values[0] === 0) {
            const category = normalizeText(categoryById.get(String(values[1]))?.name);
            if (category) {
                return predicate({
                    kind: "all_team_category",
                    comparator: "eq",
                    count: 7,
                    categories: [category],
                    selfInclusion: "included",
                });
            }
        }
    }
    return unknown();
}
function activeSkillActivationCondition(activeSkillSet, skillCausalityById, categoryById) {
    const compiled = parseCompiledCausality(activeSkillSet.causality_conditions);
    if (!compiled)
        return undefined;
    const causalityIds = [];
    const expression = (node) => {
        if (typeof node === "number") {
            const causalityId = String(node);
            causalityIds.push(causalityId);
            return causalityExpression(causalityId, skillCausalityById.get(causalityId), categoryById);
        }
        return {
            op: node[0] === "&" ? "all" : "any",
            children: node.slice(1).map(expression),
        };
    };
    const mapped = expression(compiled);
    const evidenceStatuses = collectEvidenceStatuses(mapped);
    const status = evidenceStatuses.includes("unknown")
        ? "unknown"
        : evidenceStatuses.includes("partial")
            ? "partial"
            : "supported";
    return {
        status,
        expression: mapped,
        provenance: {
            activeSkillSet: { table: "active_skill_sets", rowId: (0, game_db_source_1.normalizeDbId)(activeSkillSet.id) ?? "" },
            causalities: [...new Set(causalityIds)].map(rowId => ({ table: "skill_causalities", rowId })),
        },
    };
}
exports.activeSkillActivationCondition = activeSkillActivationCondition;
function collectEvidenceStatuses(expression) {
    return expression.op === "predicate"
        ? [expression.predicate.evidenceStatus]
        : expression.children.flatMap(collectEvidenceStatuses);
}
function activationExpressionIdentity(expression) {
    if (expression.op === "predicate") {
        const { provenance: _provenance, ...predicate } = expression.predicate;
        return JSON.stringify({ op: expression.op, predicate });
    }
    return JSON.stringify({
        op: expression.op,
        children: expression.children.map(activationExpressionIdentity),
    });
}
/**
 * Builds a first-party Active Skill activation contract keyed by the exact DB
 * card/form id consumed by Team Analysis. Cards with multiple semantically
 * different activation trees are omitted so the consumer fails closed rather
 * than guessing which Active Skill a passive clause refers to.
 */
function buildGameDbActiveSkillActivationContract(tables) {
    const activeSkillSetById = new Map((tables.active_skill_sets ?? []).flatMap(row => {
        const id = (0, game_db_source_1.normalizeDbId)(row.id);
        return id ? [[id, row]] : [];
    }));
    const skillCausalityById = new Map((tables.skill_causalities ?? []).flatMap(row => {
        const id = (0, game_db_source_1.normalizeDbId)(row.id);
        return id ? [[id, row]] : [];
    }));
    const categoryById = new Map((tables.card_categories ?? []).flatMap(row => {
        const id = (0, game_db_source_1.normalizeDbId)(row.id);
        return id ? [[id, row]] : [];
    }));
    const relationsByCardId = new Map();
    for (const relation of tables.card_active_skills ?? []) {
        const cardId = (0, game_db_source_1.normalizeDbId)(relation.card_id);
        if (!cardId)
            continue;
        const relations = relationsByCardId.get(cardId) ?? [];
        relations.push(relation);
        relationsByCardId.set(cardId, relations);
    }
    const contract = new Map();
    for (const [cardId, relations] of relationsByCardId) {
        const activeSkillSetIds = [...new Set([...relations]
                .sort((left, right) => compareDbIds(left.id, right.id))
                .flatMap(relation => {
                const setId = (0, game_db_source_1.normalizeDbId)(relation.active_skill_set_id);
                return setId ? [setId] : [];
            }))];
        const conditions = activeSkillSetIds.flatMap(setId => {
            const set = activeSkillSetById.get(setId);
            const condition = set
                ? activeSkillActivationCondition(set, skillCausalityById, categoryById)
                : undefined;
            return condition ? [condition] : [];
        });
        if (conditions.length === 0 || conditions.length !== activeSkillSetIds.length)
            continue;
        const identities = new Set(conditions.map(condition => activationExpressionIdentity(condition.expression)));
        if (identities.size === 1) {
            contract.set(cardId, conditions[0]);
        }
    }
    return contract;
}
exports.buildGameDbActiveSkillActivationContract = buildGameDbActiveSkillActivationContract;
function mapActiveSkillEffects(rows) {
    const seenIds = new Set();
    return [...rows].sort((left, right) => compareDbIds(left.id, right.id)).flatMap(row => {
        const id = (0, game_db_source_1.normalizeDbId)(row.id);
        const activeSkillSetId = (0, game_db_source_1.normalizeDbId)(row.active_skill_set_id);
        if (!id || !activeSkillSetId) {
            throw new Error("active_skills contains an effect without an id or active_skill_set_id");
        }
        if (seenIds.has(id)) {
            return [];
        }
        seenIds.add(id);
        return [{
                id,
                activeSkillSetId,
                targetType: (0, game_db_source_1.parseDbInt)(row.target_type),
                subTargetTypeSetId: (0, game_db_source_1.normalizeDbId)(row.sub_target_type_set_id),
                calcOption: (0, game_db_source_1.parseDbInt)(row.calc_option),
                efficacyType: (0, game_db_source_1.parseDbInt)(row.efficacy_type),
                values: [rawOperand(row.eff_val1), rawOperand(row.eff_val2), rawOperand(row.eff_val3)],
                efficacyValues: (0, game_db_source_1.parseDbJsonArray)(row.efficacy_values),
                thumbEffectId: (0, game_db_source_1.normalizeDbId)(row.thumb_effect_id),
                effectSeId: (0, game_db_source_1.normalizeDbId)(row.effect_se_id),
                provenance: {
                    table: "active_skills",
                    rowId: id,
                },
            }];
    });
}
function mapActiveSkillSets(rows, activeSkillSetById, activeSkillEffectsBySetId, ultimateSpecialById = new Map(), skillCausalityById = new Map(), categoryById = new Map()) {
    const seenSetIds = new Set();
    return [...rows].sort((left, right) => compareDbIds(left.id, right.id)).flatMap(row => {
        const relationId = (0, game_db_source_1.normalizeDbId)(row.id);
        const activeSkillSetId = (0, game_db_source_1.normalizeDbId)(row.active_skill_set_id);
        if (!relationId || !activeSkillSetId) {
            throw new Error("card_active_skills contains a relation without an id or active_skill_set_id");
        }
        if (seenSetIds.has(activeSkillSetId)) {
            return [];
        }
        seenSetIds.add(activeSkillSetId);
        const activeSkillSet = activeSkillSetById.get(activeSkillSetId);
        if (!activeSkillSet) {
            throw new Error(`card_active_skills row ${relationId} references missing active_skill_sets row ${activeSkillSetId}`);
        }
        const ultimateSpecialId = (0, game_db_source_1.normalizeDbId)(activeSkillSet.ultimate_special_id);
        const ultimateSpecial = ultimateSpecialId
            ? ultimateSpecialById.get(ultimateSpecialId)
            : undefined;
        const attackMultiplierPercent = (0, game_db_source_1.parseDbInt)(ultimateSpecial?.increase_rate);
        const activationCondition = activeSkillActivationCondition(activeSkillSet, skillCausalityById, categoryById);
        return [{
                id: activeSkillSetId,
                name: normalizeText(activeSkillSet.name),
                effectDescription: normalizeText(activeSkillSet.effect_description),
                conditionDescription: normalizeText(activeSkillSet.condition_description),
                turn: (0, game_db_source_1.parseDbInt)(activeSkillSet.turn),
                execLimit: (0, game_db_source_1.parseDbInt)(activeSkillSet.exec_limit),
                ...(activationCondition ? { activationCondition } : {}),
                ultimateSpecialId,
                ultimateAttack: ultimateSpecialId && ultimateSpecial && attackMultiplierPercent !== undefined
                    && attackMultiplierPercent > 0
                    ? {
                        id: ultimateSpecialId,
                        name: normalizeText(ultimateSpecial.name),
                        description: normalizeText(ultimateSpecial.description),
                        attackMultiplierPercent,
                        isMultiTarget: (0, game_db_source_1.parseDbInt)(ultimateSpecial.aim_target) === 1,
                        provenance: {
                            table: "ultimate_specials",
                            rowId: ultimateSpecialId,
                        },
                    }
                    : undefined,
                specialViewId: (0, game_db_source_1.normalizeDbId)(activeSkillSet.special_view_id),
                effects: mapActiveSkillEffects(activeSkillEffectsBySetId.get(activeSkillSetId) ?? []),
                provenance: {
                    relation: {
                        table: "card_active_skills",
                        rowId: relationId,
                    },
                    set: {
                        table: "active_skill_sets",
                        rowId: activeSkillSetId,
                    },
                },
            }];
    });
}
exports.mapActiveSkillSets = mapActiveSkillSets;
//# sourceMappingURL=game-db-active-skill.js.map