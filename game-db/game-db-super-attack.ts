import { GameDbSuperAttack } from "./game-db-contract";
import { GameDbRow, normalizeDbId, parseDbInt } from "./game-db-source";

function normalizeText(value?: string): string {
    return (value ?? "").replace(/\r\n/g, "\n").trim();
}

function compareIds(left: string, right: string): number {
    if (/^\d+$/.test(left) && /^\d+$/.test(right)) {
        const numericLeft = BigInt(left);
        const numericRight = BigInt(right);
        return numericLeft < numericRight ? -1 : numericLeft > numericRight ? 1 : 0;
    }
    return left < right ? -1 : left > right ? 1 : 0;
}

function variantFromStyle(style: string): GameDbSuperAttack["variant"] {
    switch (style) {
        case "Normal": return "super";
        case "Hyper": return "ultra";
        case "Condition": return "unit";
        case "Extra": return "extra";
        default: return "unknown";
    }
}

function specialBonus(row: GameDbRow, slot: 1 | 2): GameDbSuperAttack["specialBonuses"][number] | undefined {
    const id = normalizeDbId(row[`special_bonus_id${slot}`]);
    const level = parseDbInt(row[`special_bonus_lv${slot}`]);
    const viewId = normalizeDbId(row[`bonus_view_id${slot}`]);
    return id !== undefined || level !== undefined || viewId !== undefined
        ? { slot, id, level, viewId }
        : undefined;
}

export function mapSuperAttacks(
    cardId: string,
    rows: GameDbRow[],
    specialSetById: Map<string, GameDbRow>,
): GameDbSuperAttack[] {
    const seenCardSpecialIds = new Set<string>();
    return [...rows].sort((left, right) => {
        const priorityDifference = (parseDbInt(left.priority) ?? Number.MAX_SAFE_INTEGER)
            - (parseDbInt(right.priority) ?? Number.MAX_SAFE_INTEGER);
        if (priorityDifference !== 0) {
            return priorityDifference;
        }
        return compareIds(normalizeDbId(left.id) ?? "", normalizeDbId(right.id) ?? "");
    }).map(row => {
        const cardSpecialId = normalizeDbId(row.id);
        const specialSetId = normalizeDbId(row.special_set_id);
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
            levelStart: parseDbInt(row.lv_start),
            requiredKi: parseDbInt(row.eball_num_start),
            viewId: normalizeDbId(row.view_id),
            increaseRate: parseDbInt(specialSet.increase_rate),
            levelBonus: parseDbInt(specialSet.lv_bonus),
            cardCostumeConditionId: normalizeDbId(row.card_costume_condition_id),
            causalityConditionsRaw: row.causality_conditions,
            specialAssetId: normalizeDbId(row.special_asset_id),
            detailViewPriority: parseDbInt(row.detail_view_priority),
            specialBonuses: ([specialBonus(row, 1), specialBonus(row, 2)]
                .filter((bonus): bonus is GameDbSuperAttack["specialBonuses"][number] => bonus !== undefined)),
            provenance: {
                cardSpecial: { table: "card_specials", rowId: cardSpecialId },
                specialSet: { table: "special_sets", rowId: specialSetId },
            },
        };
    });
}
