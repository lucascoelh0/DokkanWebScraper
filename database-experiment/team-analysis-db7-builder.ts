import { SqliteScalar } from "./contract";
import { Db3Status } from "./team-analysis-db3-contract";
import { DatabaseTeamAnalysisDb6Dataset, Db6PassiveRule } from "./team-analysis-db6-contract";
import { DatabaseTeamAnalysisDb7Coverage, DatabaseTeamAnalysisDb7Dataset, Db7ConditionExpression, Db7PassiveRule, Db7SelectorCondition } from "./team-analysis-db7-contract";

function object(value: unknown): Record<string, unknown> | undefined {
    return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}

function integer(value: unknown): number | null {
    const parsed = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : NaN;
    return Number.isSafeInteger(parsed) ? parsed : null;
}

function scope(raw: unknown): "team" | "enemy" | "rotation" | undefined {
    const value = integer(raw);
    return value === 0 ? "team" : value === 1 ? "enemy" : value === 2 ? "rotation" : undefined;
}

function knownMask(raw: SqliteScalar): Extract<Db7SelectorCondition["selector"], { kind: "class" | "type" }> | undefined {
    const mask = integer(raw);
    if (mask === 4) return { kind: "type", types: ["INT"], rawMask: raw };
    if (mask === 8) return { kind: "type", types: ["STR"], rawMask: raw };
    if (mask === 16) return { kind: "type", types: ["PHY"], rawMask: raw };
    if (mask === 32) return { kind: "class", classes: ["Super"], rawMask: raw };
    if (mask === 64) return { kind: "class", classes: ["Extreme"], rawMask: raw };
    return undefined;
}

function selectorCondition(expression: Extract<Db7ConditionExpression, { op: "unknown" }>): { condition: Db7ConditionExpression, metadata?: Db7SelectorCondition } {
    const type = integer(expression.causalityType);
    if (type !== 41 && type !== 46) return { condition: expression };
    const raw = object(expression.raw);
    const rawScope = (raw?.cau_val1 as SqliteScalar | undefined) ?? null;
    const rawSelector = (raw?.cau_val2 as SqliteScalar | undefined) ?? null;
    const rawCount = (raw?.cau_val3 as SqliteScalar | undefined) ?? null;
    const mappedScope = scope(rawScope);
    const count = integer(rawCount);
    const causalityId = expression.causalityId ?? (raw?.id === undefined ? undefined : String(raw.id));
    if (!mappedScope || count === null || count < 1 || !causalityId) return { condition: expression };
    if (type === 41) {
        const token = integer(rawSelector);
        if (token === null) {
            return { condition: expression, metadata: {
                causalityId, causalityType: 41, scope: mappedScope, minimumCount: count,
                selector: { kind: "unknown_name_token", rawToken: rawSelector, unknownToken: null }, status: "unknown",
                rawScope, rawSelector, rawCount, provenance: { table: "skill_causalities", rowId: causalityId },
                unknowns: ["name_token_invalid"],
            } };
        }
        const selector = { kind: "name_token" as const, token: rawSelector, localizedName: null };
        return {
            condition: { op: "predicate", predicate: {
                kind: "qualifying_unit_count", scope: mappedScope, comparator: "gte", value: count,
                selector, semanticStatus: "partial", sourceCausalityId: causalityId, sourceCausalityType: 41, evidence: "unknown",
            } },
            metadata: {
                causalityId, causalityType: 41, scope: mappedScope, minimumCount: count, selector, status: "partial",
                rawScope, rawSelector, rawCount, provenance: { table: "skill_causalities", rowId: causalityId },
                unknowns: ["name_token_dictionary_unavailable"],
            },
        };
    }
    const selector = knownMask(rawSelector);
    if (!selector) {
        const mask = integer(rawSelector);
        return { condition: expression, metadata: {
            causalityId, causalityType: 46, scope: mappedScope, minimumCount: count,
            selector: { kind: "unknown_mask", rawMask: rawSelector, unknownMask: mask }, status: "unknown",
            rawScope, rawSelector, rawCount, provenance: { table: "skill_causalities", rowId: causalityId },
            unknowns: ["class_type_mask_identity_unknown"],
        } };
    }
    return {
        condition: { op: "predicate", predicate: {
            kind: "qualifying_unit_count", scope: mappedScope, comparator: "gte", value: count,
            selector, semanticStatus: "supported", sourceCausalityId: causalityId, sourceCausalityType: 46, evidence: "first-party-row-join",
        } },
        metadata: {
            causalityId, causalityType: 46, scope: mappedScope, minimumCount: count, selector, status: "supported",
            rawScope, rawSelector, rawCount, provenance: { table: "skill_causalities", rowId: causalityId }, unknowns: [],
        },
    };
}

function mapCondition(expression: Db7ConditionExpression): { condition: Db7ConditionExpression, metadata: Db7SelectorCondition[] } {
    if (expression.op === "all" || expression.op === "any") {
        const children = expression.children.map(mapCondition);
        return { condition: { ...expression, children: children.map(value => value.condition) }, metadata: children.flatMap(value => value.metadata) };
    }
    if (expression.op === "not") {
        const child = mapCondition(expression.child);
        return { condition: { ...expression, child: child.condition }, metadata: child.metadata };
    }
    if (expression.op !== "unknown") return { condition: expression, metadata: [] };
    const mapped = selectorCondition(expression);
    return { condition: mapped.condition, metadata: mapped.metadata ? [mapped.metadata] : [] };
}

function conditionStatus(expression: Db7ConditionExpression): Db3Status {
    if (expression.op === "always") return "supported";
    if (expression.op === "unknown") return "unknown";
    if (expression.op === "predicate") return expression.predicate.kind === "qualifying_unit_count" ? expression.predicate.semanticStatus : "supported";
    if (expression.op === "not") return conditionStatus(expression.child);
    const statuses = expression.children.map(conditionStatus);
    return statuses.every(value => value === "supported") ? "supported" : statuses.every(value => value === "unknown") ? "unknown" : "partial";
}

function combineStatus(condition: Db3Status, effect: Db3Status): Db3Status {
    if (condition === "supported" && effect === "supported") return "supported";
    if (condition === "unknown" && effect === "unknown") return "unknown";
    return "partial";
}

function upgradeRule(rule: Db6PassiveRule): Db7PassiveRule {
    const mapped = mapCondition(rule.condition as Db7ConditionExpression);
    const byId = new Map(mapped.metadata.map(value => [value.causalityId, value.status]));
    const mappedStatus = conditionStatus(mapped.condition);
    const hasUnresolvedTrigger = rule.combatHistoryTriggers.length > 0;
    const status = hasUnresolvedTrigger ? "partial" : combineStatus(mappedStatus, rule.effectStatus);
    const selectorUnknowns = mapped.metadata.flatMap(value => value.unknowns);
    return {
        ...rule,
        condition: mapped.condition,
        conditionStatus: mappedStatus,
        status,
        source: { ...rule.source, causalities: rule.source.causalities.map(value => {
            const selectorStatus = byId.get(value.id);
            return selectorStatus ? { ...value, mappingStatus: selectorStatus } : value;
        }) },
        selectorConditions: mapped.metadata,
        unknowns: [...new Set([
            ...(mappedStatus === "supported" ? rule.unknowns.filter(value => value !== "condition_semantics_incomplete") : rule.unknowns),
            ...selectorUnknowns,
        ])],
    };
}

export function buildDatabaseTeamAnalysisDb7Dataset(db6: DatabaseTeamAnalysisDb6Dataset): DatabaseTeamAnalysisDb7Dataset {
    return {
        schemaVersion: 1, contract: "dokkan-team-analysis-database-experiment", contractVersion: "0.6.0",
        generatedAt: db6.generatedAt, sourceDb6ContractVersion: "0.5.0", sourceSnapshotVersion: db6.sourceSnapshotVersion, sourceSha256: db6.sourceSha256,
        states: db6.states.map(state => {
            if (!state.passive) { const { passive: _passive, ...withoutPassive } = state; return withoutPassive; }
            const rules = state.passive.rules.map(upgradeRule);
            const statuses = rules.map(value => value.status);
            const status: Db3Status = statuses.every(value => value === "supported") ? "supported" : statuses.every(value => value === "unknown") ? "unknown" : "partial";
            return { ...state, passive: { ...state.passive, rules, status } };
        }),
    };
}

export function buildDatabaseTeamAnalysisDb7Coverage(dataset: DatabaseTeamAnalysisDb7Dataset): DatabaseTeamAnalysisDb7Coverage {
    const rules = dataset.states.flatMap(state => state.passive?.rules ?? []);
    const selectors = rules.flatMap(rule => rule.selectorConditions);
    const statuses = (values: Db3Status[]): Record<Db3Status, number> => ({ supported: values.filter(value => value === "supported").length, partial: values.filter(value => value === "partial").length, unknown: values.filter(value => value === "unknown").length });
    const byType: Record<string, number> = {}; const uniqueByType = new Map<string, Set<string>>(); const masks: Record<string, number> = {};
    for (const selector of selectors) {
        const type = String(selector.causalityType); byType[type] = (byType[type] ?? 0) + 1;
        const unique = uniqueByType.get(type) ?? new Set<string>(); unique.add(selector.causalityId); uniqueByType.set(type, unique);
        if (selector.causalityType === 46) { const mask = String(selector.rawSelector); masks[mask] = (masks[mask] ?? 0) + 1; }
    }
    const type41 = selectors.filter(value => value.causalityType === 41);
    const type46 = selectors.filter(value => value.causalityType === 46);
    return {
        schemaVersion: 1, stateCount: dataset.states.length, ruleCount: rules.length,
        conditionStatusCounts: statuses(rules.map(value => value.conditionStatus)), selectorConditionCount: selectors.length,
        selectorStatusCounts: statuses(selectors.map(value => value.status)),
        selectorCountsByCausalityType: Object.fromEntries(Object.entries(byType).sort(([left], [right]) => Number(left) - Number(right))),
        uniqueSelectorCausalityCounts: Object.fromEntries([...uniqueByType.entries()].sort(([left], [right]) => Number(left) - Number(right)).map(([type, values]) => [type, values.size])),
        type41: { occurrenceCount: type41.length, uniqueTokenCount: new Set(type41.map(value => String(value.rawSelector))).size, dictionaryStatus: "unavailable" },
        type46: { supportedOccurrenceCount: type46.filter(value => value.status === "supported").length, unknownOccurrenceCount: type46.filter(value => value.status === "unknown").length, maskCounts: Object.fromEntries(Object.entries(masks).sort(([left], [right]) => Number(left) - Number(right))) },
    };
}
