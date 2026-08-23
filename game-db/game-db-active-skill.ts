import {
    ActiveSkillActivationConditionDetails,
    ActiveSkillActivationConditionExpression,
    ActiveSkillActivationConditionPredicate,
} from "../character";
import { createHash } from "crypto";
import { GameDbActiveSkillEffect, GameDbActiveSkillSet } from "./game-db-contract";
import { GameDbRow, normalizeDbId, parseDbInt, parseDbJsonArray } from "./game-db-source";

function normalizeText(value?: string): string {
    return (value ?? "").replace(/\r\n/g, "\n").trim();
}

const ULTIMATE_GOHAN_ACTIVE_SKILL_SET_ID = "174";
const ULTIMATE_GOHAN_ROTATION_CAUSALITY_ID = "2025";
const ULTIMATE_GOHAN_CATEGORY_ID = "88";
const ULTIMATE_GOHAN_ROTATION_CAUSALITY_TYPE = 34;
const ULTIMATE_GOHAN_ROTATION_CAUSALITY_VALUES = [2, 88, 3] as const;
const ULTIMATE_GOHAN_COMPILED_CAUSALITY = '["|",["&",2024,2025],["&",2026,2027]]';
const ULTIMATE_GOHAN_CONDITION_DESCRIPTION_SHA256 =
    "f5908df2ce2b82d561577ce8d3bb5b9a5a731d4dbf9ff43a7cebe3b1292fe452";

function sha256Text(value: string): string {
    return createHash("sha256").update(value).digest("hex");
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

type CompiledCausality = number | ["&" | "|", ...CompiledCausality[]];

function parseCompiledCausality(raw?: string): CompiledCausality | undefined {
    const trimmed = raw?.trim() ?? "";
    if (!trimmed) return undefined;
    try {
        const compiled = JSON.parse(trimmed)?.compiled;
        return isCompiledCausality(compiled) ? compiled : undefined;
    } catch {
        return undefined;
    }
}

function isCompiledCausality(value: unknown): value is CompiledCausality {
    if (typeof value === "number" && Number.isSafeInteger(value) && value > 0) return true;
    return Array.isArray(value)
        && (value[0] === "&" || value[0] === "|")
        && value.length >= 2
        && value.slice(1).every(isCompiledCausality);
}

function causalityPredicate(
    causalityId: string,
    row: GameDbRow | undefined,
    categoryById: Map<string, GameDbRow>,
    directlySupportedCausalityIds: ReadonlySet<string>,
): ActiveSkillActivationConditionPredicate {
    const causalityType = parseDbInt(row?.causality_type) ?? 0;
    const values: [number, number, number] = [
        parseDbInt(row?.cau_val1) ?? 0,
        parseDbInt(row?.cau_val2) ?? 0,
        parseDbInt(row?.cau_val3) ?? 0,
    ];
    const provenance = {
        table: "skill_causalities" as const,
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

function directlySupportedSetScopedCausalities(
    activeSkillSet: GameDbRow,
    compiled: CompiledCausality,
    skillCausalityById: Map<string, GameDbRow>,
    categoryById: Map<string, GameDbRow>,
): ReadonlySet<string> {
    const activeSkillSetId = normalizeDbId(activeSkillSet.id);
    const rotationCausality = skillCausalityById.get(ULTIMATE_GOHAN_ROTATION_CAUSALITY_ID);
    const rotationCausalityValues = [
        parseDbInt(rotationCausality?.cau_val1),
        parseDbInt(rotationCausality?.cau_val2),
        parseDbInt(rotationCausality?.cau_val3),
    ];
    const categoryName = normalizeText(categoryById.get(ULTIMATE_GOHAN_CATEGORY_ID)?.name);
    const conditionDescriptionHash = sha256Text(normalizeText(activeSkillSet.condition_description));
    return activeSkillSetId === ULTIMATE_GOHAN_ACTIVE_SKILL_SET_ID
        && JSON.stringify(compiled) === ULTIMATE_GOHAN_COMPILED_CAUSALITY
        && normalizeDbId(rotationCausality?.id) === ULTIMATE_GOHAN_ROTATION_CAUSALITY_ID
        && parseDbInt(rotationCausality?.causality_type) === ULTIMATE_GOHAN_ROTATION_CAUSALITY_TYPE
        && rotationCausalityValues.every((value, index) =>
            value === ULTIMATE_GOHAN_ROTATION_CAUSALITY_VALUES[index])
        && categoryName === "Super Heroes"
        && conditionDescriptionHash === ULTIMATE_GOHAN_CONDITION_DESCRIPTION_SHA256
        ? new Set([ULTIMATE_GOHAN_ROTATION_CAUSALITY_ID])
        : new Set();
}

function activeSkillActivationCondition(
    activeSkillSet: GameDbRow,
    skillCausalityById: Map<string, GameDbRow>,
    categoryById: Map<string, GameDbRow>,
): ActiveSkillActivationConditionDetails | undefined {
    const compiled = parseCompiledCausality(activeSkillSet.causality_conditions);
    if (!compiled) return undefined;
    const causalityIds: string[] = [];
    const directlySupportedCausalityIds = directlySupportedSetScopedCausalities(
        activeSkillSet,
        compiled,
        skillCausalityById,
        categoryById,
    );

    const expression = (node: CompiledCausality): ActiveSkillActivationConditionExpression => {
        if (typeof node === "number") {
            const causalityId = String(node);
            causalityIds.push(causalityId);
            return {
                op: "predicate",
                predicate: causalityPredicate(
                    causalityId,
                    skillCausalityById.get(causalityId),
                    categoryById,
                    directlySupportedCausalityIds,
                ),
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
            activeSkillSet: { table: "active_skill_sets", rowId: normalizeDbId(activeSkillSet.id) ?? "" },
            causalities: [...new Set(causalityIds)].map(rowId => ({ table: "skill_causalities", rowId })),
        },
    };
}

function collectEvidenceStatuses(
    expression: ActiveSkillActivationConditionExpression,
): Array<ActiveSkillActivationConditionPredicate["evidenceStatus"]> {
    return expression.op === "predicate"
        ? [expression.predicate.evidenceStatus]
        : expression.children.flatMap(collectEvidenceStatuses);
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
    ultimateSpecialById: Map<string, GameDbRow> = new Map(),
    skillCausalityById: Map<string, GameDbRow> = new Map(),
    categoryById: Map<string, GameDbRow> = new Map(),
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

        const ultimateSpecialId = normalizeDbId(activeSkillSet.ultimate_special_id);
        const ultimateSpecial = ultimateSpecialId
            ? ultimateSpecialById.get(ultimateSpecialId)
            : undefined;
        const attackMultiplierPercent = parseDbInt(ultimateSpecial?.increase_rate);
        const activationCondition = activeSkillActivationCondition(
            activeSkillSet,
            skillCausalityById,
            categoryById,
        );

        return [{
            id: activeSkillSetId,
            name: normalizeText(activeSkillSet.name),
            effectDescription: normalizeText(activeSkillSet.effect_description),
            conditionDescription: normalizeText(activeSkillSet.condition_description),
            turn: parseDbInt(activeSkillSet.turn),
            execLimit: parseDbInt(activeSkillSet.exec_limit),
            ...(activationCondition ? { activationCondition } : {}),
            ultimateSpecialId,
            ultimateAttack: ultimateSpecialId && ultimateSpecial && attackMultiplierPercent !== undefined
                && attackMultiplierPercent > 0
                ? {
                    id: ultimateSpecialId,
                    name: normalizeText(ultimateSpecial.name),
                    description: normalizeText(ultimateSpecial.description),
                    attackMultiplierPercent,
                    isMultiTarget: parseDbInt(ultimateSpecial.aim_target) === 1,
                    provenance: {
                        table: "ultimate_specials",
                        rowId: ultimateSpecialId,
                    },
                }
                : undefined,
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
