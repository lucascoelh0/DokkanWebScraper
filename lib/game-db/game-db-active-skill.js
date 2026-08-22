"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mapActiveSkillSets = void 0;
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
function mapActiveSkillSets(rows, activeSkillSetById, activeSkillEffectsBySetId, ultimateSpecialById = new Map()) {
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
        return [{
                id: activeSkillSetId,
                name: normalizeText(activeSkillSet.name),
                effectDescription: normalizeText(activeSkillSet.effect_description),
                conditionDescription: normalizeText(activeSkillSet.condition_description),
                turn: (0, game_db_source_1.parseDbInt)(activeSkillSet.turn),
                execLimit: (0, game_db_source_1.parseDbInt)(activeSkillSet.exec_limit),
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