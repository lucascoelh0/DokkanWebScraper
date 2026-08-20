import { GameDbActiveSkillEffect, GameDbActiveSkillSet } from "./game-db-contract";
import { GameDbRow, normalizeDbId, parseDbInt, parseDbJsonArray } from "./game-db-source";

function normalizeText(value?: string): string {
    return (value ?? "").replace(/\r\n/g, "\n").trim();
}

function compareDbIds(left?: string, right?: string): number {
    const normalizedLeft = normalizeDbId(left) ?? "";
    const normalizedRight = normalizeDbId(right) ?? "";
    if (/^\d+$/.test(normalizedLeft) && /^\d+$/.test(normalizedRight)) {
        const numericLeft = BigInt(normalizedLeft);
        const numericRight = BigInt(normalizedRight);
        return numericLeft < numericRight ? -1 : numericLeft > numericRight ? 1 : 0;
    }

    return normalizedLeft < normalizedRight ? -1 : normalizedLeft > normalizedRight ? 1 : 0;
}

function rawOperand(value?: string): string | null {
    const trimmed = value?.trim() ?? "";
    return trimmed.length > 0 ? value ?? null : null;
}

function mapActiveSkillEffects(rows: GameDbRow[]): GameDbActiveSkillEffect[] {
    const seenIds = new Set<string>();
    return [...rows].sort((left, right) => compareDbIds(left.id, right.id)).flatMap(row => {
        const id = normalizeDbId(row.id);
        const activeSkillSetId = normalizeDbId(row.active_skill_set_id);
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
            targetType: parseDbInt(row.target_type),
            subTargetTypeSetId: normalizeDbId(row.sub_target_type_set_id),
            calcOption: parseDbInt(row.calc_option),
            efficacyType: parseDbInt(row.efficacy_type),
            values: [rawOperand(row.eff_val1), rawOperand(row.eff_val2), rawOperand(row.eff_val3)],
            efficacyValues: parseDbJsonArray(row.efficacy_values),
            thumbEffectId: normalizeDbId(row.thumb_effect_id),
            effectSeId: normalizeDbId(row.effect_se_id),
            provenance: {
                table: "active_skills",
                rowId: id,
            },
        }];
    });
}

export function mapActiveSkillSets(
    rows: GameDbRow[],
    activeSkillSetById: Map<string, GameDbRow>,
    activeSkillEffectsBySetId: Map<string, GameDbRow[]>,
): GameDbActiveSkillSet[] {
    const seenSetIds = new Set<string>();
    return [...rows].sort((left, right) => compareDbIds(left.id, right.id)).flatMap(row => {
        const relationId = normalizeDbId(row.id);
        const activeSkillSetId = normalizeDbId(row.active_skill_set_id);
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

        return [{
            id: activeSkillSetId,
            name: normalizeText(activeSkillSet.name),
            effectDescription: normalizeText(activeSkillSet.effect_description),
            conditionDescription: normalizeText(activeSkillSet.condition_description),
            turn: parseDbInt(activeSkillSet.turn),
            execLimit: parseDbInt(activeSkillSet.exec_limit),
            ultimateSpecialId: normalizeDbId(activeSkillSet.ultimate_special_id),
            specialViewId: normalizeDbId(activeSkillSet.special_view_id),
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
