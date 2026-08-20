"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mapSuperAttacks = void 0;
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
function mapSuperAttacks(cardId, rows, specialSetById) {
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
        return {
            cardSpecialId,
            specialSetId,
            name: normalizeText(specialSet.name),
            description: normalizeText(specialSet.description),
            style,
            variant: variantFromStyle(style),
            levelStart: (0, game_db_source_1.parseDbInt)(row.lv_start),
            requiredKi: (0, game_db_source_1.parseDbInt)(row.eball_num_start),
            viewId: (0, game_db_source_1.normalizeDbId)(row.view_id),
            increaseRate: (0, game_db_source_1.parseDbInt)(specialSet.increase_rate),
            levelBonus: (0, game_db_source_1.parseDbInt)(specialSet.lv_bonus),
            cardCostumeConditionId: (0, game_db_source_1.normalizeDbId)(row.card_costume_condition_id),
            causalityConditionsRaw: row.causality_conditions,
            specialAssetId: (0, game_db_source_1.normalizeDbId)(row.special_asset_id),
            detailViewPriority: (0, game_db_source_1.parseDbInt)(row.detail_view_priority),
            specialBonuses: ([specialBonus(row, 1), specialBonus(row, 2)]
                .filter((bonus) => bonus !== undefined)),
            provenance: {
                cardSpecial: { table: "card_specials", rowId: cardSpecialId },
                specialSet: { table: "special_sets", rowId: specialSetId },
            },
        };
    });
}
exports.mapSuperAttacks = mapSuperAttacks;
//# sourceMappingURL=game-db-super-attack.js.map