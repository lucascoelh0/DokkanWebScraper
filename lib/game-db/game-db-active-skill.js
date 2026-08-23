"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mapActiveSkillSets = void 0;
const crypto_1 = require("crypto");
const game_db_source_1 = require("./game-db-source");
function normalizeText(value) {
    return (value ?? "").replace(/\r\n/g, "\n").trim();
}
const ULTIMATE_GOHAN_ACTIVE_SKILL_SET_ID = "174";
const ULTIMATE_GOHAN_ROTATION_CAUSALITY_ID = "2025";
const ULTIMATE_GOHAN_CATEGORY_ID = "88";
const ULTIMATE_GOHAN_ROTATION_CAUSALITY_TYPE = 34;
const ULTIMATE_GOHAN_ROTATION_CAUSALITY_VALUES = [2, 88, 3];
const ULTIMATE_GOHAN_COMPILED_CAUSALITY = '["|",["&",2024,2025],["&",2026,2027]]';
const ULTIMATE_GOHAN_CONDITION_DESCRIPTION_SHA256 = "f5908df2ce2b82d561577ce8d3bb5b9a5a731d4dbf9ff43a7cebe3b1292fe452";
function sha256Text(value) {
    return (0, crypto_1.createHash)("sha256").update(value).digest("hex");
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
function causalityPredicate(causalityId, row, categoryById, directlySupportedCausalityIds) {
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
    if (causalityType === 5) {
        return {
            kind: "battle_turn",
            comparator: "gte",
            value: values[0] + 1,
            evidenceStatus: "supported",
            provenance,
        };
    }
    if (causalityType === 34 && values[0] === 2 && values[2] > 0) {
        const categoryId = String(values[1]);
        const category = normalizeText(categoryById.get(categoryId)?.name);
        if (category) {
            return {
                kind: "rotation_category_count",
                comparator: "gte",
                count: values[2],
                categories: [category],
                selfInclusion: "included",
                evidenceStatus: directlySupportedCausalityIds.has(causalityId) ? "supported" : "partial",
                provenance,
            };
        }
    }
    if (causalityType === 16 && values[0] === 2) {
        return {
            kind: "enemy_count",
            comparator: "eq",
            count: 1,
            evidenceStatus: "partial",
            provenance,
        };
    }
    return {
        kind: "unknown",
        evidenceStatus: "unknown",
        provenance,
    };
}
function directlySupportedSetScopedCausalities(activeSkillSet, compiled, skillCausalityById, categoryById) {
    const activeSkillSetId = (0, game_db_source_1.normalizeDbId)(activeSkillSet.id);
    const rotationCausality = skillCausalityById.get(ULTIMATE_GOHAN_ROTATION_CAUSALITY_ID);
    const rotationCausalityValues = [
        (0, game_db_source_1.parseDbInt)(rotationCausality?.cau_val1),
        (0, game_db_source_1.parseDbInt)(rotationCausality?.cau_val2),
        (0, game_db_source_1.parseDbInt)(rotationCausality?.cau_val3),
    ];
    const categoryName = normalizeText(categoryById.get(ULTIMATE_GOHAN_CATEGORY_ID)?.name);
    const conditionDescriptionHash = sha256Text(normalizeText(activeSkillSet.condition_description));
    return activeSkillSetId === ULTIMATE_GOHAN_ACTIVE_SKILL_SET_ID
        && JSON.stringify(compiled) === ULTIMATE_GOHAN_COMPILED_CAUSALITY
        && (0, game_db_source_1.normalizeDbId)(rotationCausality?.id) === ULTIMATE_GOHAN_ROTATION_CAUSALITY_ID
        && (0, game_db_source_1.parseDbInt)(rotationCausality?.causality_type) === ULTIMATE_GOHAN_ROTATION_CAUSALITY_TYPE
        && rotationCausalityValues.every((value, index) => value === ULTIMATE_GOHAN_ROTATION_CAUSALITY_VALUES[index])
        && categoryName === "Super Heroes"
        && conditionDescriptionHash === ULTIMATE_GOHAN_CONDITION_DESCRIPTION_SHA256
        ? new Set([ULTIMATE_GOHAN_ROTATION_CAUSALITY_ID])
        : new Set();
}
function activeSkillActivationCondition(activeSkillSet, skillCausalityById, categoryById) {
    const compiled = parseCompiledCausality(activeSkillSet.causality_conditions);
    if (!compiled)
        return undefined;
    const causalityIds = [];
    const directlySupportedCausalityIds = directlySupportedSetScopedCausalities(activeSkillSet, compiled, skillCausalityById, categoryById);
    const expression = (node) => {
        if (typeof node === "number") {
            const causalityId = String(node);
            causalityIds.push(causalityId);
            return {
                op: "predicate",
                predicate: causalityPredicate(causalityId, skillCausalityById.get(causalityId), categoryById, directlySupportedCausalityIds),
            };
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
function collectEvidenceStatuses(expression) {
    return expression.op === "predicate"
        ? [expression.predicate.evidenceStatus]
        : expression.children.flatMap(collectEvidenceStatuses);
}
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