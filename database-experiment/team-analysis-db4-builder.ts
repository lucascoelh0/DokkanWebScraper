import { DatabaseExperimentTables } from "./builder";
import { SourcedRow, SqliteScalar } from "./contract";
import { DatabasePassiveRule, DatabaseTeamAnalysisExperimentDataset } from "./team-analysis-contract";
import { createDatabaseTeamAnalysisDb3CausalityMapper } from "./team-analysis-db3-builder";
import {
    DatabaseTeamAnalysisDb3Dataset,
    Db3ConditionExpression,
    Db3PassiveEffect,
    Db3Predicate,
    Db3Status,
} from "./team-analysis-db3-contract";
import {
    DatabaseTeamAnalysisDb4Coverage,
    DatabaseTeamAnalysisDb4Dataset,
    Db4PassiveRule,
    Db4ProjectedEffect,
    Db4ThresholdSeriesProjection,
} from "./team-analysis-db4-contract";

function rowValue(row: SourcedRow, column: string): SqliteScalar {
    return row.values[column] ?? null;
}

function integer(value: SqliteScalar | undefined): number | null {
    const parsed = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : NaN;
    return Number.isSafeInteger(parsed) ? parsed : null;
}

function identifier(value: SqliteScalar | undefined): string | undefined {
    return value === null || value === undefined || value === "" ? undefined : String(value);
}

function statusOfCondition(expression: Db3ConditionExpression): Db3Status {
    if (expression.op === "always" || expression.op === "predicate") return "supported";
    if (expression.op === "unknown") return "unknown";
    if (expression.op === "not") return statusOfCondition(expression.child);
    const statuses = expression.children.map(statusOfCondition);
    if (statuses.every(status => status === "supported")) return "supported";
    if (statuses.every(status => status === "unknown")) return "unknown";
    return "partial";
}

function combineStatus(condition: Db3Status, effect: Db3Status): Db3Status {
    if (condition === "supported" && effect === "supported") return "supported";
    if (condition === "unknown" && effect === "unknown") return "unknown";
    return "partial";
}

function sourcedPredicate(source: SourcedRow, values: Omit<Db3Predicate, "sourceCausalityId" | "sourceCausalityType" | "evidence">): Db3ConditionExpression {
    return { op: "predicate", predicate: {
        ...values,
        sourceCausalityId: source.provenance.rowId,
        sourceCausalityType: rowValue(source, "causality_type"),
        evidence: "first-party-row-join",
    } };
}

function categoryLookup(tables: DatabaseExperimentTables): Map<string, string> {
    return new Map(tables.card_categories.flatMap(row => {
        const rowId = identifier(row.id);
        return rowId ? [[rowId, String(row.name ?? "").trim()] as const] : [];
    }));
}

function db4LeafMapper(tables: DatabaseExperimentTables): (source: SourcedRow) => Db3ConditionExpression {
    const db3Map = createDatabaseTeamAnalysisDb3CausalityMapper(tables);
    const categories = categoryLookup(tables);
    return source => {
        const type = integer(rowValue(source, "causality_type"));
        if (type === 40) return sourcedPredicate(source, {
            kind: "super_attacks_performed", scope: "self", eventMode: "current_event",
        });
        if (type === 34) {
            const rawScope = integer(rowValue(source, "cau_val1"));
            const categoryId = identifier(rowValue(source, "cau_val2"));
            const count = integer(rowValue(source, "cau_val3"));
            const category = categoryId ? categories.get(categoryId) : undefined;
            if ((rawScope === 0 || rawScope === 2) && categoryId && category && count !== null && count >= 1) {
                return sourcedPredicate(source, {
                    kind: rawScope === 0 ? "team_category_count" : "rotation_category_count",
                    scope: rawScope === 0 ? "team" : "rotation",
                    comparator: "gte",
                    count,
                    categoryIds: [categoryId],
                    categories: [category],
                });
            }
        }
        return db3Map(source);
    };
}

function mapCompiled(
    value: unknown,
    causalities: Map<string, SourcedRow>,
    mapLeaf: (source: SourcedRow) => Db3ConditionExpression,
): Db3ConditionExpression {
    if (typeof value === "number") {
        const source = causalities.get(String(value));
        return source ? mapLeaf(source) : { op: "unknown", causalityId: String(value), raw: value };
    }
    if (Array.isArray(value) && value.length > 1) {
        const [operator, ...children] = value;
        if (operator === "&") return { op: "all", children: children.map(child => mapCompiled(child, causalities, mapLeaf)) };
        if (operator === "|") return { op: "any", children: children.map(child => mapCompiled(child, causalities, mapLeaf)) };
    }
    return { op: "unknown", raw: value };
}

function mapRuleCondition(db2: DatabasePassiveRule, db3: Db4PassiveRule, mapLeaf: (source: SourcedRow) => Db3ConditionExpression): Db3ConditionExpression {
    if (db2.condition.mappingStatus === "unconditional") return { op: "always" };
    if (db2.condition.compiled === undefined) return { op: "unknown", raw: db2.condition.raw };
    if (typeof db2.condition.compiled === "number" && db3.condition.op !== "unknown") return db3.condition;
    const causalities = new Map(db2.condition.causalities.map(row => [row.provenance.rowId, row]));
    return mapCompiled(db2.condition.compiled, causalities, mapLeaf);
}

function upgradeRule(db2: DatabasePassiveRule, db3: Db4PassiveRule, mapLeaf: (source: SourcedRow) => Db3ConditionExpression): Db4PassiveRule {
    let condition = mapRuleCondition(db2, db3, mapLeaf);
    let effects = db3.effects;
    let effectStatus = db3.effectStatus;
    const directType = typeof db2.condition.compiled === "number" && db2.condition.causalities.length === 1
        ? integer(rowValue(db2.condition.causalities[0], "causality_type")) : null;
    if (integer(db2.rawEnums.efficacyType) === 98 && integer(db2.rawEnums.executionTimingType) === 5 && directType === 40) {
        condition = { op: "always" };
        effects = db3.effects.map(effect => effect.scaling?.kind === "unknown" ? {
            ...effect,
            scaling: { kind: "per_combat_event" as const, event: "super_attack_performed" as const, eventsPerIncrement: 1 as const },
        } : effect);
        effectStatus = effects.every(effect => effect.kind !== "unknown" && effect.evidence !== "unknown" && effect.unit !== "unknown") ? "supported" : db3.effectStatus;
    }
    const conditionStatus = statusOfCondition(condition);
    return { ...db3, condition, effects, effectStatus, conditionStatus, status: combineStatus(conditionStatus, effectStatus) };
}

function semanticTarget(effect: Db3PassiveEffect) {
    return {
        scope: effect.target.scope,
        selfInclusion: effect.target.selfInclusion,
        classes: effect.target.classes,
        types: effect.target.types,
        categoryIds: effect.target.categoryIds,
        excludedCategoryIds: effect.target.excludedCategoryIds,
        unknownSubTargets: effect.target.unknownSubTargets.map(row => [row.targetValueType, row.targetValue]),
    };
}

function semanticEffect(effect: Db3PassiveEffect) {
    return {
        kind: effect.kind,
        target: semanticTarget(effect),
        value: effect.value,
        unit: effect.unit,
        activationChancePercent: effect.activationChancePercent,
        additionalToSuperChancePercent: effect.additionalToSuperChancePercent,
        stackCap: effect.stackCap,
        kiSphereChange: effect.kiSphereChange,
        evidence: effect.evidence,
    };
}

interface ThresholdCandidate {
    rule: Db4PassiveRule,
    db2: DatabasePassiveRule,
    effect: Db3PassiveEffect,
    causality: SourcedRow,
    causalityType: number,
    threshold: number,
    rawScope: SqliteScalar,
    rawSelector: SqliteScalar,
    rawAuxiliary: SqliteScalar,
    groupKey: string,
}

function thresholdCandidate(rule: Db4PassiveRule, db2: DatabasePassiveRule): ThresholdCandidate | undefined {
    if (rule.effectStatus !== "supported" || rule.effects.length !== 1 || rule.effects[0].scaling || rule.effects[0].target.unknownSubTargets.length > 0) return undefined;
    if (typeof db2.condition.compiled !== "number" || db2.condition.causalities.length !== 1) return undefined;
    const causality = db2.condition.causalities[0];
    const causalityType = integer(rowValue(causality, "causality_type"));
    if (causalityType !== 34 && causalityType !== 41 && causalityType !== 42 && causalityType !== 46) return undefined;
    const threshold = integer(rowValue(causality, causalityType === 42 ? "cau_val2" : "cau_val3"));
    if (threshold === null) return undefined;
    const rawScope = causalityType === 42 ? null : rowValue(causality, "cau_val1");
    const rawSelector = rowValue(causality, causalityType === 42 ? "cau_val1" : "cau_val2");
    const rawAuxiliary = causalityType === 42 ? rowValue(causality, "cau_val3") : null;
    const effect = rule.effects[0];
    const groupKey = JSON.stringify({
        causalityType, rawScope, rawSelector, rawAuxiliary,
        efficacyType: rule.source.efficacyType,
        targetType: rule.source.targetType,
        executionTimingType: rule.source.executionTimingType,
        calculationOption: rule.source.calculationOption,
        effect: semanticEffect(effect),
    });
    return { rule, db2, effect, causality, causalityType, threshold, rawScope, rawSelector, rawAuxiliary, groupKey };
}

function sphereTypes(rule: Db4PassiveRule): Db4ProjectedEffect["scaling"]["kiSphereTypes"] {
    return rule.condition.op === "predicate" && rule.condition.predicate.kind === "ki_spheres_obtained"
        ? rule.condition.predicate.kiSphereTypes : undefined;
}

function scope(raw: SqliteScalar): "team" | "rotation" | "enemy" | "unknown" {
    const value = integer(raw);
    return value === 0 ? "team" : value === 1 ? "enemy" : value === 2 ? "rotation" : "unknown";
}

function buildThresholdSeries(rules: Db4PassiveRule[], db2Rules: Map<string, DatabasePassiveRule>, tables: DatabaseExperimentTables): Db4ThresholdSeriesProjection[] {
    const categories = categoryLookup(tables);
    const candidates = rules.flatMap(rule => {
        const db2 = db2Rules.get(rule.ruleKey);
        const candidate = db2 ? thresholdCandidate(rule, db2) : undefined;
        return candidate ? [candidate] : [];
    });
    const groups = new Map<string, ThresholdCandidate[]>();
    for (const candidate of candidates) {
        const group = groups.get(candidate.groupKey) ?? [];
        group.push(candidate); groups.set(candidate.groupKey, group);
    }
    return [...groups.values()].flatMap(group => {
        if (group.length < 2) return [];
        const sorted = group.slice().sort((left, right) => left.threshold - right.threshold || left.rule.ruleKey.localeCompare(right.rule.ruleKey, "en", { numeric: true }));
        const thresholds = sorted.map(candidate => candidate.threshold);
        if (new Set(thresholds).size !== thresholds.length || thresholds.some((value, index) => value !== index + 1)) return [];
        const first = sorted[0];
        const { scaling: _discarded, ...effect } = first.effect;
        let status: Db3Status = "supported";
        const unknowns: string[] = [];
        let projectedScaling: Db4ProjectedEffect["scaling"];
        if (first.causalityType === 42) {
            const kiSphereTypes = sphereTypes(first.rule);
            if (!kiSphereTypes?.length) return [];
            projectedScaling = {
                kind: "per_ki_sphere_threshold_series", contributionPerIncrement: 1, maxIncrements: thresholds.length,
                thresholdValues: thresholds, kiSphereTypes,
            };
        } else {
            const rawSelectorId = identifier(first.rawSelector);
            const selectorKind = first.causalityType === 34 ? "category"
                : first.causalityType === 41 ? "name_selector_unknown" : "class_type_mask_unknown";
            const selectorName = first.causalityType === 34 && rawSelectorId ? categories.get(rawSelectorId) : undefined;
            const projectedScope = scope(first.rawScope);
            const evidence = selectorKind === "category" && selectorName && (projectedScope === "team" || projectedScope === "rotation")
                ? "first-party-row-join" as const : "unknown" as const;
            if (evidence === "unknown") {
                status = "partial";
                unknowns.push(first.causalityType === 34 ? "enemy_or_unknown_category_scope_semantics_unknown"
                    : first.causalityType === 41 ? "name_selector_domain_unknown" : "class_type_mask_unknown");
            }
            projectedScaling = {
                kind: "per_qualifying_unit_threshold_series", contributionPerIncrement: 1, maxIncrements: thresholds.length,
                thresholdValues: thresholds,
                qualifyingUnit: {
                    scope: projectedScope, selectorKind, selectorId: rawSelectorId, selectorName,
                    rawSelector: first.rawSelector, evidence,
                },
            };
        }
        return [{
            projectionKey: `threshold-series:${first.rule.ruleKey}:${thresholds.length}`,
            status,
            absorbedCondition: "contiguous_minimum_threshold_series" as const,
            effect: { ...effect, scaling: projectedScaling },
            source: {
                causalityType: first.causalityType,
                rawScope: first.rawScope,
                rawSelector: first.rawSelector,
                rawAuxiliary: first.rawAuxiliary,
                sourceRuleKeys: sorted.map(candidate => candidate.rule.ruleKey),
                passiveSkillRelationIds: sorted.map(candidate => candidate.rule.source.passiveSkillRelationId),
                passiveSkillIds: sorted.map(candidate => candidate.rule.source.passiveSkillId),
                causalityIds: sorted.flatMap(candidate => candidate.rule.source.causalityIds),
                provenance: sorted.flatMap(candidate => [
                    candidate.rule.source.provenance.passiveSkillRelation,
                    candidate.rule.source.provenance.passiveSkill,
                    ...candidate.rule.source.provenance.causalities,
                ]),
            },
            proof: {
                directSingleCausalityRules: true as const,
                identicalEffectTargetTimingAndCalculation: true as const,
                startsAtOne: true as const,
                contiguousWithoutDuplicates: true as const,
                noCompetingSameEffectThresholdRows: true as const,
            },
            unknowns,
        }];
    }).sort((left, right) => left.projectionKey.localeCompare(right.projectionKey, "en", { numeric: true }));
}

export function buildDatabaseTeamAnalysisDb4Dataset(options: {
    db2: DatabaseTeamAnalysisExperimentDataset,
    db3: DatabaseTeamAnalysisDb3Dataset,
    tables: DatabaseExperimentTables,
}): DatabaseTeamAnalysisDb4Dataset {
    const db2States = new Map(options.db2.states.map(state => [state.stateKey, state]));
    const mapLeaf = db4LeafMapper(options.tables);
    return {
        schemaVersion: 1,
        contract: "dokkan-team-analysis-database-experiment",
        contractVersion: "0.3.0",
        generatedAt: options.db3.generatedAt,
        sourceDb3ContractVersion: "0.2.0",
        sourceSnapshotVersion: options.db3.sourceSnapshotVersion,
        sourceSha256: options.db3.sourceSha256,
        states: options.db3.states.map(state => {
            if (!state.passive) {
                const { passive: _passive, ...withoutPassive } = state;
                return withoutPassive;
            }
            const db2State = db2States.get(state.stateKey);
            const db2Rules = new Map((db2State?.passive?.rules ?? []).map(rule => [rule.ruleKey, rule]));
            const rules: Db4PassiveRule[] = state.passive.rules.map(rule => {
                const db2 = db2Rules.get(rule.ruleKey);
                return db2 ? upgradeRule(db2, rule, mapLeaf) : rule;
            });
            const thresholdSeries = buildThresholdSeries(rules, db2Rules, options.tables);
            const statuses = [...rules.map(rule => rule.status), ...thresholdSeries.map(series => series.status)];
            const status: Db3Status = statuses.every(value => value === "supported") ? "supported"
                : statuses.every(value => value === "unknown") ? "unknown" : "partial";
            return { ...state, passive: { ...state.passive, rules, thresholdSeries, status } };
        }),
    };
}

function walkCondition(expression: Db3ConditionExpression, visit: (node: Db3ConditionExpression) => void) {
    visit(expression);
    if (expression.op === "all" || expression.op === "any") expression.children.forEach(child => walkCondition(child, visit));
    if (expression.op === "not") walkCondition(expression.child, visit);
}

export function buildDatabaseTeamAnalysisDb4Coverage(dataset: DatabaseTeamAnalysisDb4Dataset): DatabaseTeamAnalysisDb4Coverage {
    const rules = dataset.states.flatMap(state => state.passive?.rules ?? []);
    const series = dataset.states.flatMap(state => state.passive?.thresholdSeries ?? []);
    const statusCounts = (statuses: Db3Status[]) => ({
        supported: statuses.filter(status => status === "supported").length,
        partial: statuses.filter(status => status === "partial").length,
        unknown: statuses.filter(status => status === "unknown").length,
    });
    const compositeConditionCounts = { all: 0, any: 0, unknownOperator: 0 };
    const mappedCausalityTypeCounts: Record<string, number> = {};
    const unknownCausalityTypeCounts: Record<string, number> = {};
    for (const rule of rules) walkCondition(rule.condition, node => {
        if (node.op === "all") compositeConditionCounts.all += 1;
        else if (node.op === "any") compositeConditionCounts.any += 1;
        else if (node.op === "unknown" && Array.isArray(node.raw)) compositeConditionCounts.unknownOperator += 1;
        if (node.op === "predicate" && node.predicate.sourceCausalityType !== undefined) {
            const type = String(node.predicate.sourceCausalityType);
            mappedCausalityTypeCounts[type] = (mappedCausalityTypeCounts[type] ?? 0) + 1;
        } else if (node.op === "unknown" && node.causalityType !== undefined) {
            const type = String(node.causalityType);
            unknownCausalityTypeCounts[type] = (unknownCausalityTypeCounts[type] ?? 0) + 1;
        }
    });
    const thresholdSeriesByCausalityType: Record<string, number> = {};
    const thresholdSeriesByEffectKind: Record<string, number> = {};
    for (const projection of series) {
        const type = String(projection.source.causalityType);
        thresholdSeriesByCausalityType[type] = (thresholdSeriesByCausalityType[type] ?? 0) + 1;
        thresholdSeriesByEffectKind[projection.effect.kind] = (thresholdSeriesByEffectKind[projection.effect.kind] ?? 0) + 1;
    }
    return {
        schemaVersion: 1,
        stateCount: dataset.states.length,
        ruleCount: rules.length,
        conditionStatusCounts: statusCounts(rules.map(rule => rule.conditionStatus)),
        compositeConditionCounts,
        mappedCausalityTypeCounts,
        unknownCausalityTypeCounts,
        thresholdSeriesCount: series.length,
        thresholdSeriesStatusCounts: statusCounts(series.map(value => value.status)),
        thresholdSeriesByCausalityType,
        thresholdSeriesByEffectKind,
        absorbedSourceRuleCount: new Set(series.flatMap(value => value.source.sourceRuleKeys)).size,
    };
}
