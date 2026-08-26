import {
    TransformationActivationCondition,
    TransformationActivationConditionDetails,
    TransformationActivationDbReference,
    TransformationActivationPath,
    TransformationActivationSourceReleaseState,
} from "../character";
import {
    buildTransformationActivationContractKey,
    TeamAnalysisTransformationActivationContract,
} from "../team-analysis";
import { compileSkillCausalityCondition } from "./game-db-active-skill";
import { GameDbRow, normalizeDbId, parseDbInt, parseDbJsonArray } from "./game-db-source";

export type GameDbTransformationActivationContract = TeamAnalysisTransformationActivationContract;

function lookup(rows: GameDbRow[] | undefined): Map<string, GameDbRow> {
    return new Map((rows ?? []).flatMap(row => {
        const id = normalizeDbId(row.id);
        return id ? [[id, row] as const] : [];
    }));
}

function grouped(rows: GameDbRow[] | undefined, field: string): Map<string, GameDbRow[]> {
    const result = new Map<string, GameDbRow[]>();
    for (const row of rows ?? []) {
        const id = normalizeDbId(row[field]);
        if (!id) continue;
        result.set(id, [...(result.get(id) ?? []), row]);
    }
    return result;
}

function compareIds(left?: string, right?: string): number {
    const a = normalizeDbId(left) ?? "";
    const b = normalizeDbId(right) ?? "";
    if (/^\d+$/.test(a) && /^\d+$/.test(b)) {
        const aNumber = BigInt(a);
        const bNumber = BigInt(b);
        return aNumber < bNumber ? -1 : aNumber > bNumber ? 1 : 0;
    }
    return a.localeCompare(b);
}

interface ReleaseBinding {
    state: TransformationActivationSourceReleaseState,
    passiveSkillSetId?: string,
    provenance: TransformationActivationDbReference[],
}

function releaseBindings(
    card: GameDbRow,
    growthRows: GameDbRow[],
): ReleaseBinding[] {
    const cardId = normalizeDbId(card.id);
    if (!cardId) return [];
    const cardReference: TransformationActivationDbReference = { table: "cards", rowId: cardId };
    const initialPassiveSkillSetId = normalizeDbId(card.passive_skill_set_id);
    const bindings: ReleaseBinding[] = [{
        state: "initial",
        passiveSkillSetId: initialPassiveSkillSetId,
        provenance: [cardReference],
    }];
    const rarity = parseDbInt(card.rarity);
    const releaseSteps = rarity === 5
        ? { eza: 3, seza: 4 }
        : rarity === 4
            ? { eza: 7, seza: 8 }
            : {};
    let inheritedPassiveSkillSetId = initialPassiveSkillSetId;
    for (const state of ["eza", "seza"] as const) {
        const stepNumber = releaseSteps[state];
        if (stepNumber === undefined) continue;
        const growth = growthRows.find(row => parseDbInt(row.step) === stepNumber);
        if (!growth) continue;
        inheritedPassiveSkillSetId = normalizeDbId(growth.passive_skill_set_id)
            ?? inheritedPassiveSkillSetId;
        const growthId = normalizeDbId(growth.id);
        bindings.push({
            state,
            passiveSkillSetId: inheritedPassiveSkillSetId,
            provenance: [
                cardReference,
                ...(growthId
                    ? [{ table: "optimal_awakening_growths", rowId: growthId } as const]
                    : []),
            ],
        });
    }
    return bindings;
}

function conditionFromCompiled(
    raw: string | undefined,
    skillCausalityById: Map<string, GameDbRow>,
    categoryById: Map<string, GameDbRow>,
    emptyMeansAlways: boolean,
): { condition: TransformationActivationCondition, causalities: TransformationActivationDbReference[] } {
    if (!raw?.trim()) {
        return {
            condition: emptyMeansAlways
                ? { status: "supported", expression: { op: "always" } }
                : { status: "unknown", expression: { op: "unknown" } },
            causalities: [],
        };
    }
    const compiled = compileSkillCausalityCondition(raw, skillCausalityById, categoryById);
    if (!compiled) {
        return {
            condition: { status: "unknown", expression: { op: "unknown" } },
            causalities: [],
        };
    }
    return {
        condition: { status: compiled.status, expression: compiled.expression },
        causalities: compiled.causalityRowIds.map(rowId => ({ table: "skill_causalities", rowId })),
    };
}

function uniqueReferences(
    references: TransformationActivationDbReference[],
): TransformationActivationDbReference[] {
    const seen = new Set<string>();
    return references.filter(reference => {
        const key = `${reference.table}:${reference.rowId}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

function pathIdentity(path: TransformationActivationPath): string {
    return [
        path.channel,
        path.provenance.map(reference => `${reference.table}:${reference.rowId}`).join("|"),
    ].join(":");
}

function contractStatus(paths: TransformationActivationPath[]): TransformationActivationConditionDetails["status"] {
    if (paths.every(path => path.condition.status === "unknown")) return "unknown";
    if (paths.every(path =>
        path.stateBindingStatus === "supported" && path.condition.status === "supported")) {
        return "supported";
    }
    return "partial";
}

function allConditions(
    conditions: TransformationActivationCondition[],
): TransformationActivationCondition {
    const status = conditions.some(condition => condition.status === "unknown")
        ? "unknown"
        : conditions.some(condition => condition.status === "partial")
            ? "partial"
            : "supported";
    return {
        status,
        expression: {
            op: "all",
            children: conditions.map(condition => condition.expression),
        },
    };
}

function addPath(
    pathsByKey: Map<string, TransformationActivationPath[]>,
    sourceCardId: string,
    targetFormId: string,
    path: TransformationActivationPath,
): void {
    const key = buildTransformationActivationContractKey(sourceCardId, targetFormId);
    pathsByKey.set(key, [...(pathsByKey.get(key) ?? []), path]);
}

interface DirectTransformationEdge {
    sourceCardId: string,
    targetFormId: string,
    paths: TransformationActivationPath[],
}

function appendTransitiveTransformationPaths(
    pathsByKey: Map<string, TransformationActivationPath[]>,
): void {
    const adjacency = new Map<string, DirectTransformationEdge[]>();
    for (const [key, paths] of pathsByKey) {
        const separator = key.indexOf("->");
        if (separator < 1) continue;
        const sourceCardId = key.slice(0, separator);
        const targetFormId = key.slice(separator + 2);
        adjacency.set(sourceCardId, [
            ...(adjacency.get(sourceCardId) ?? []),
            { sourceCardId, targetFormId, paths },
        ]);
    }
    for (const edges of adjacency.values()) {
        edges.sort((left, right) => compareIds(left.targetFormId, right.targetFormId));
    }

    for (const sourceCardId of [...adjacency.keys()].sort(compareIds)) {
        const walk = (
            currentCardId: string,
            visited: Set<string>,
            selectedPaths: TransformationActivationPath[],
        ): void => {
            for (const edge of adjacency.get(currentCardId) ?? []) {
                if (visited.has(edge.targetFormId)) continue;
                for (const edgePath of edge.paths) {
                    const route = [...selectedPaths, edgePath];
                    if (route.length > 1) {
                        addPath(pathsByKey, sourceCardId, edge.targetFormId, {
                            channel: "transformation_chain",
                            // Each passive step can be exact for its own source
                            // card, but the DB has no single row binding every
                            // intermediate state back to the root release state.
                            stateBindingStatus: "partial",
                            sourceReleaseStates: route[0].sourceReleaseStates,
                            condition: allConditions(route.map(path => path.condition)),
                            provenance: uniqueReferences(route.flatMap(path => path.provenance)),
                        });
                    }
                    walk(
                        edge.targetFormId,
                        new Set([...visited, edge.targetFormId]),
                        route,
                    );
                }
            }
        };
        walk(sourceCardId, new Set([sourceCardId]), []);
    }
}

/**
 * Builds transformation reachability only from official ID joins. Text fields
 * are intentionally ignored: conditions come solely from compiled causality
 * trees, while passive rows with an empty tree use the DB's unconditional
 * passive-effect semantics.
 */
export function buildGameDbTransformationActivationContract(
    tables: Record<string, GameDbRow[]>,
): GameDbTransformationActivationContract {
    const cardById = lookup(tables.cards);
    const passiveSkillSetById = lookup(tables.passive_skill_sets);
    const passiveSkillById = lookup(tables.passive_skills);
    const activeSkillSetById = lookup(tables.active_skill_sets);
    const standbySkillSetById = lookup(tables.standby_skill_sets);
    const finishSkillSetById = lookup(tables.finish_skill_sets);
    const skillCausalityById = lookup(tables.skill_causalities);
    const categoryById = lookup(tables.card_categories);
    const growthByType = grouped(tables.optimal_awakening_growths, "optimal_awakening_grow_type");
    const passiveRelationsBySet = grouped(tables.passive_skill_set_relations, "passive_skill_set_id");
    const activeEffectsBySet = grouped(tables.active_skills, "active_skill_set_id");
    const standbyEffectsBySet = grouped(tables.standby_skills, "standby_skill_set_id");
    const finishEffectsBySet = grouped(tables.finish_skills, "finish_skill_set_id");
    const finishRelationsByStandbySet = grouped(
        tables.standby_skill_set_finish_skill_set_relations,
        "standby_skill_set_id",
    );
    const pathsByKey = new Map<string, TransformationActivationPath[]>();

    for (const [sourceCardId, card] of [...cardById].sort(([left], [right]) => compareIds(left, right))) {
        const growthType = normalizeDbId(card.optimal_awakening_grow_type);
        const bindings = releaseBindings(card, growthType ? growthByType.get(growthType) ?? [] : []);
        const bindingsByPassiveSet = new Map<string, ReleaseBinding[]>();
        for (const binding of bindings) {
            if (!binding.passiveSkillSetId) continue;
            bindingsByPassiveSet.set(binding.passiveSkillSetId, [
                ...(bindingsByPassiveSet.get(binding.passiveSkillSetId) ?? []),
                binding,
            ]);
        }

        for (const [passiveSkillSetId, setBindings] of bindingsByPassiveSet) {
            for (const relation of [...(passiveRelationsBySet.get(passiveSkillSetId) ?? [])]
                .sort((left, right) => compareIds(left.id, right.id))) {
                const relationId = normalizeDbId(relation.id);
                const passiveSkillId = normalizeDbId(relation.passive_skill_id);
                const passiveSkill = passiveSkillId ? passiveSkillById.get(passiveSkillId) : undefined;
                const efficacyType = parseDbInt(passiveSkill?.efficacy_type);
                const targetFormId = normalizeDbId(passiveSkill?.eff_value1);
                const channel = efficacyType === 103
                    ? "passive_transformation" as const
                    : efficacyType === 79
                        ? "passive_giant_rage" as const
                        : efficacyType === 131
                            ? "passive_reversible_exchange" as const
                            : undefined;
                if (!channel || !targetFormId || !passiveSkillId || !relationId) continue;
                const compiled = conditionFromCompiled(
                    passiveSkill?.causality_conditions,
                    skillCausalityById,
                    categoryById,
                    true,
                );
                addPath(pathsByKey, sourceCardId, targetFormId, {
                    channel,
                    stateBindingStatus: "supported",
                    sourceReleaseStates: setBindings.map(binding => binding.state),
                    condition: compiled.condition,
                    provenance: uniqueReferences([
                        ...setBindings.flatMap(binding => binding.provenance),
                        { table: "passive_skill_sets", rowId: passiveSkillSetId },
                        { table: "passive_skill_set_relations", rowId: relationId },
                        { table: "passive_skills", rowId: passiveSkillId },
                        ...compiled.causalities,
                    ]),
                });
            }
        }
    }

    for (const relation of [...(tables.card_active_skills ?? [])]
        .sort((left, right) => compareIds(left.id, right.id))) {
        const relationId = normalizeDbId(relation.id);
        const sourceCardId = normalizeDbId(relation.card_id);
        const skillSetId = normalizeDbId(relation.active_skill_set_id);
        const card = sourceCardId ? cardById.get(sourceCardId) : undefined;
        const skillSet = skillSetId ? activeSkillSetById.get(skillSetId) : undefined;
        if (!relationId || !sourceCardId || !skillSetId || !card || !skillSet) continue;
        const growthType = normalizeDbId(card.optimal_awakening_grow_type);
        const sourceReleaseStates = releaseBindings(card, growthType ? growthByType.get(growthType) ?? [] : [])
            .map(binding => binding.state);
        const compiled = conditionFromCompiled(
            skillSet.causality_conditions,
            skillCausalityById,
            categoryById,
            false,
        );
        for (const effect of [...(activeEffectsBySet.get(skillSetId) ?? [])]
            .sort((left, right) => compareIds(left.id, right.id))) {
            const effectId = normalizeDbId(effect.id);
            const efficacyType = parseDbInt(effect.efficacy_type);
            const targetFormId = normalizeDbId(effect.eff_val1);
            const channel = efficacyType === 103
                ? "active_skill_transformation" as const
                : efficacyType === 79
                    ? "active_skill_giant_rage" as const
                    : undefined;
            if (!channel || !effectId || !targetFormId) continue;
            addPath(pathsByKey, sourceCardId, targetFormId, {
                channel,
                stateBindingStatus: "partial",
                sourceReleaseStates,
                condition: compiled.condition,
                provenance: uniqueReferences([
                    { table: "cards", rowId: sourceCardId },
                    { table: "card_active_skills", rowId: relationId },
                    { table: "active_skill_sets", rowId: skillSetId },
                    { table: "active_skills", rowId: effectId },
                    ...compiled.causalities,
                ]),
            });
        }
    }

    const appendSetPaths = (
        relationRows: GameDbRow[],
        relationSetField: string,
        relationTable: "card_standby_skill_set_relations" | "card_finish_skill_set_relations",
        skillSetById: Map<string, GameDbRow>,
        skillSetTable: "standby_skill_sets" | "finish_skill_sets",
        effectRowsBySet: Map<string, GameDbRow[]>,
        effectTable: "standby_skills" | "finish_skills",
        channel: "standby_transformation" | "finish_transformation",
    ): void => {
        for (const relation of [...relationRows].sort((left, right) => compareIds(left.id, right.id))) {
            const relationId = normalizeDbId(relation.id);
            const sourceCardId = normalizeDbId(relation.card_id);
            const skillSetId = normalizeDbId(relation[relationSetField]);
            const card = sourceCardId ? cardById.get(sourceCardId) : undefined;
            const skillSet = skillSetId ? skillSetById.get(skillSetId) : undefined;
            if (!relationId || !sourceCardId || !skillSetId || !card || !skillSet) continue;
            const growthType = normalizeDbId(card.optimal_awakening_grow_type);
            const sourceReleaseStates = releaseBindings(card, growthType ? growthByType.get(growthType) ?? [] : [])
                .map(binding => binding.state);
            const compiled = conditionFromCompiled(
                skillSet.causality_conditions,
                skillCausalityById,
                categoryById,
                false,
            );
            for (const effect of [...(effectRowsBySet.get(skillSetId) ?? [])]
                .sort((left, right) => compareIds(left.id, right.id))) {
                if (parseDbInt(effect.efficacy_type) !== 103) continue;
                const effectId = normalizeDbId(effect.id);
                const firstValue = parseDbJsonArray(effect.efficacy_values)[0];
                const targetFormId = normalizeDbId(firstValue === undefined || firstValue === null
                    ? undefined
                    : String(firstValue));
                if (!effectId || !targetFormId) continue;
                addPath(pathsByKey, sourceCardId, targetFormId, {
                    channel,
                    stateBindingStatus: "partial",
                    sourceReleaseStates,
                    condition: compiled.condition,
                    provenance: uniqueReferences([
                        { table: "cards", rowId: sourceCardId },
                        { table: relationTable, rowId: relationId },
                        { table: skillSetTable, rowId: skillSetId },
                        { table: effectTable, rowId: effectId },
                        ...compiled.causalities,
                    ]),
                });
            }
        }
    };

    appendSetPaths(
        tables.card_standby_skill_set_relations ?? [],
        "standby_skill_set_id",
        "card_standby_skill_set_relations",
        standbySkillSetById,
        "standby_skill_sets",
        standbyEffectsBySet,
        "standby_skills",
        "standby_transformation",
    );
    appendSetPaths(
        tables.card_finish_skill_set_relations ?? [],
        "finish_skill_set_id",
        "card_finish_skill_set_relations",
        finishSkillSetById,
        "finish_skill_sets",
        finishEffectsBySet,
        "finish_skills",
        "finish_transformation",
    );

    // Finish transformations reached through a Standby set require both
    // official causality trees. The relation chain is preserved so this route
    // remains distinct from any direct card -> Finish relation.
    for (const cardStandbyRelation of [...(tables.card_standby_skill_set_relations ?? [])]
        .sort((left, right) => compareIds(left.id, right.id))) {
        const cardStandbyRelationId = normalizeDbId(cardStandbyRelation.id);
        const sourceCardId = normalizeDbId(cardStandbyRelation.card_id);
        const standbySkillSetId = normalizeDbId(cardStandbyRelation.standby_skill_set_id);
        const sourceCard = sourceCardId ? cardById.get(sourceCardId) : undefined;
        const standbySkillSet = standbySkillSetId ? standbySkillSetById.get(standbySkillSetId) : undefined;
        if (!cardStandbyRelationId || !sourceCardId || !standbySkillSetId || !sourceCard || !standbySkillSet) {
            continue;
        }
        const growthType = normalizeDbId(sourceCard.optimal_awakening_grow_type);
        const sourceReleaseStates = releaseBindings(
            sourceCard,
            growthType ? growthByType.get(growthType) ?? [] : [],
        ).map(binding => binding.state);
        const standbyCondition = conditionFromCompiled(
            standbySkillSet.causality_conditions,
            skillCausalityById,
            categoryById,
            false,
        );
        for (const finishRelation of [...(finishRelationsByStandbySet.get(standbySkillSetId) ?? [])]
            .sort((left, right) => compareIds(left.id, right.id))) {
            const finishRelationId = normalizeDbId(finishRelation.id);
            const finishSkillSetId = normalizeDbId(finishRelation.finish_skill_set_id);
            const finishSkillSet = finishSkillSetId ? finishSkillSetById.get(finishSkillSetId) : undefined;
            if (!finishRelationId || !finishSkillSetId || !finishSkillSet) continue;
            const finishCondition = conditionFromCompiled(
                finishSkillSet.causality_conditions,
                skillCausalityById,
                categoryById,
                false,
            );
            for (const effect of [...(finishEffectsBySet.get(finishSkillSetId) ?? [])]
                .sort((left, right) => compareIds(left.id, right.id))) {
                if (parseDbInt(effect.efficacy_type) !== 103) continue;
                const effectId = normalizeDbId(effect.id);
                const firstValue = parseDbJsonArray(effect.efficacy_values)[0];
                const targetFormId = normalizeDbId(firstValue === undefined || firstValue === null
                    ? undefined
                    : String(firstValue));
                if (!effectId || !targetFormId) continue;
                addPath(pathsByKey, sourceCardId, targetFormId, {
                    channel: "finish_transformation",
                    stateBindingStatus: "partial",
                    sourceReleaseStates,
                    condition: allConditions([standbyCondition.condition, finishCondition.condition]),
                    provenance: uniqueReferences([
                        { table: "cards", rowId: sourceCardId },
                        { table: "card_standby_skill_set_relations", rowId: cardStandbyRelationId },
                        { table: "standby_skill_sets", rowId: standbySkillSetId },
                        { table: "standby_skill_set_finish_skill_set_relations", rowId: finishRelationId },
                        { table: "finish_skill_sets", rowId: finishSkillSetId },
                        { table: "finish_skills", rowId: effectId },
                        ...standbyCondition.causalities,
                        ...finishCondition.causalities,
                    ]),
                });
            }
        }
    }

    appendTransitiveTransformationPaths(pathsByKey);

    return new Map([...pathsByKey].map(([key, paths]) => {
        const uniquePaths = new Map(paths.map(path => [pathIdentity(path), path] as const));
        const orderedPaths = [...uniquePaths.values()]
            .sort((left, right) => pathIdentity(left).localeCompare(pathIdentity(right)));
        return [key, { status: contractStatus(orderedPaths), paths: orderedPaths }] as const;
    }));
}
