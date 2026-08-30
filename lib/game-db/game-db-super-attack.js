"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mapSuperAttacks = void 0;
const character_1 = require("../character");
const game_db_source_1 = require("./game-db-source");
function normalizeText(value) {
    return (value ?? "").replace(/\r\n/g, "\n").trim();
}
function compareIds(left, right) {
    if (/^\d+$/.test(left) && /^\d+$/.test(right)) {
        const numericLeft = BigInt(left);
        const numericRight = BigInt(right);
        return numericLeft < numericRight ? -1 : numericLeft > numericRight ? 1 : 0;
    }
    return left < right ? -1 : left > right ? 1 : 0;
}
function variantFromStyle(style) {
    switch (style) {
        case "Normal": return "super";
        case "Hyper": return "ultra";
        case "Condition": return "unit";
        case "Extra": return "extra";
        default: return "unknown";
    }
}
function specialBonus(row, slot) {
    const id = (0, game_db_source_1.normalizeDbId)(row[`special_bonus_id${slot}`]);
    const level = (0, game_db_source_1.parseDbInt)(row[`special_bonus_lv${slot}`]);
    const viewId = (0, game_db_source_1.normalizeDbId)(row[`bonus_view_id${slot}`]);
    return id !== undefined || level !== undefined || viewId !== undefined
        ? { slot, id, level, viewId }
        : undefined;
}
function rawOperand(value) {
    const trimmed = value?.trim() ?? "";
    return trimmed.length > 0 ? value ?? null : null;
}
function rawOptionalText(value) {
    const trimmed = value?.trim() ?? "";
    return trimmed.length > 0 ? value : undefined;
}
function resolveAttackType(cardId, cardSpecialId, viewId, specialViewById, specialCategoryById) {
    if (!specialViewById || !specialCategoryById)
        return {};
    if (!viewId)
        throw new Error(`card_specials row ${cardSpecialId} for card ${cardId} has no view_id`);
    const view = specialViewById.get(viewId);
    if (!view)
        throw new Error(`card_specials row ${cardSpecialId} references missing special_views row ${viewId}`);
    const categoryId = (0, game_db_source_1.normalizeDbId)(view.special_category_id);
    if (!categoryId) {
        return {
            attackType: character_1.AttackTypes.Other,
            attackTypeProvenance: {
                specialView: { table: "special_views", rowId: viewId },
            },
        };
    }
    const category = specialCategoryById.get(categoryId);
    if (!category) {
        throw new Error(`special_views row ${viewId} references missing special_categories row ${categoryId}`);
    }
    const rawAttribute = (0, game_db_source_1.parseDbInt)(category.raw_attribute);
    const attackType = rawAttribute === 1
        ? character_1.AttackTypes.KiBlast
        : rawAttribute === 2
            ? character_1.AttackTypes.Unarmed
            : rawAttribute === 4
                ? character_1.AttackTypes.Armed
                : undefined;
    if (!attackType) {
        throw new Error(`special_categories row ${categoryId} has unsupported raw_attribute ${category.raw_attribute}`);
    }
    return {
        attackType,
        attackTypeProvenance: {
            specialView: { table: "special_views", rowId: viewId },
            specialCategory: {
                table: "special_categories",
                rowId: categoryId,
                rawAttribute,
            },
        },
    };
}
function auditedSemantics(type, efficacyType) {
    if (type !== "Special::ExtraEfficacySpecial" || efficacyType !== 111) {
        return undefined;
    }
    return {
        kind: "action_break",
        status: "partial",
        actionSelection: "one_eligible_current_enemy_action_per_marker",
        evidence: {
            fileName: "native-special-action-break-semantics.json",
            nativeRuntimeSha256: "7d6c2c1e095fc20a71ec4764e88a17b4d4b82f3f12952b9ba8c6eb0405a7215a",
        },
    };
}
function mapSuperAttackEffects(rows, expectedSpecialSetId) {
    const seenIds = new Set();
    return [...rows].sort((left, right) => compareIds((0, game_db_source_1.normalizeDbId)(left.id) ?? "", (0, game_db_source_1.normalizeDbId)(right.id) ?? "")).map(row => {
        const id = (0, game_db_source_1.normalizeDbId)(row.id);
        const specialSetId = (0, game_db_source_1.normalizeDbId)(row.special_set_id);
        if (!id || !specialSetId) {
            throw new Error("specials contains an effect without an id or special_set_id");
        }
        if (specialSetId !== expectedSpecialSetId) {
            throw new Error(`specials row ${id} belongs to special_set_id ${specialSetId}, expected ${expectedSpecialSetId}`);
        }
        if (seenIds.has(id)) {
            throw new Error(`specials contains duplicate row id ${id}`);
        }
        seenIds.add(id);
        const type = rawOptionalText(row.type);
        const efficacyType = (0, game_db_source_1.parseDbInt)(row.efficacy_type);
        const semantic = auditedSemantics(type, efficacyType);
        return {
            id,
            specialSetId,
            type,
            efficacyType,
            targetType: (0, game_db_source_1.parseDbInt)(row.target_type),
            calcOption: (0, game_db_source_1.parseDbInt)(row.calc_option),
            turn: (0, game_db_source_1.parseDbInt)(row.turn),
            probability: (0, game_db_source_1.parseDbInt)(row.prob),
            causalityConditionsRaw: row.causality_conditions,
            values: [rawOperand(row.eff_value1), rawOperand(row.eff_value2), rawOperand(row.eff_value3)],
            ...(semantic ? { semantic } : {}),
            provenance: {
                table: "specials",
                rowId: id,
            },
        };
    });
}
function mapSuperAttacks(cardId, rows, specialSetById, specialEffectsBySetId = new Map(), specialViewById, specialCategoryById) {
    const seenCardSpecialIds = new Set();
    return [...rows].sort((left, right) => {
        const priorityDifference = ((0, game_db_source_1.parseDbInt)(left.priority) ?? Number.MAX_SAFE_INTEGER)
            - ((0, game_db_source_1.parseDbInt)(right.priority) ?? Number.MAX_SAFE_INTEGER);
        if (priorityDifference !== 0) {
            return priorityDifference;
        }
        return compareIds((0, game_db_source_1.normalizeDbId)(left.id) ?? "", (0, game_db_source_1.normalizeDbId)(right.id) ?? "");
    }).map(row => {
        const cardSpecialId = (0, game_db_source_1.normalizeDbId)(row.id);
        const specialSetId = (0, game_db_source_1.normalizeDbId)(row.special_set_id);
        if (!cardSpecialId || !specialSetId) {
            throw new Error(`card_specials for card ${cardId} contains a row without id or special_set_id`);
        }
        if (seenCardSpecialIds.has(cardSpecialId)) {
            throw new Error(`card_specials contains duplicate row id ${cardSpecialId}`);
        }
        seenCardSpecialIds.add(cardSpecialId);
        const specialSet = specialSetById.get(specialSetId);
        if (!specialSet) {
            throw new Error(`card_specials row ${cardSpecialId} references missing special_sets row ${specialSetId}`);
        }
        const style = normalizeText(row.style);
        const viewId = (0, game_db_source_1.normalizeDbId)(row.view_id);
        return {
            cardSpecialId,
            specialSetId,
            name: normalizeText(specialSet.name),
            description: normalizeText(specialSet.description),
            ...(normalizeText(specialSet.causality_description)
                ? { conditionDescription: normalizeText(specialSet.causality_description) }
                : {}),
            style,
            variant: variantFromStyle(style),
            levelStart: (0, game_db_source_1.parseDbInt)(row.lv_start),
            requiredKi: (0, game_db_source_1.parseDbInt)(row.eball_num_start),
            viewId,
            ...resolveAttackType(cardId, cardSpecialId, viewId, specialViewById, specialCategoryById),
            increaseRate: (0, game_db_source_1.parseDbInt)(specialSet.increase_rate),
            levelBonus: (0, game_db_source_1.parseDbInt)(specialSet.lv_bonus),
            cardCostumeConditionId: (0, game_db_source_1.normalizeDbId)(row.card_costume_condition_id),
            causalityConditionsRaw: row.causality_conditions,
            specialAssetId: (0, game_db_source_1.normalizeDbId)(row.special_asset_id),
            detailViewPriority: (0, game_db_source_1.parseDbInt)(row.detail_view_priority),
            specialBonuses: ([specialBonus(row, 1), specialBonus(row, 2)]
                .filter((bonus) => bonus !== undefined)),
            effects: mapSuperAttackEffects(specialEffectsBySetId.get(specialSetId) ?? [], specialSetId),
            provenance: {
                cardSpecial: { table: "card_specials", rowId: cardSpecialId },
                specialSet: { table: "special_sets", rowId: specialSetId },
            },
        };
    });
}
exports.mapSuperAttacks = mapSuperAttacks;
//# sourceMappingURL=game-db-super-attack.js.map