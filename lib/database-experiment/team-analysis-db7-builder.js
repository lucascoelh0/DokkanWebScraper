"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildDatabaseTeamAnalysisDb7Coverage = exports.buildDatabaseTeamAnalysisDb7Dataset = void 0;
function object(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value) ? value : undefined;
}
function integer(value) {
    const parsed = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : NaN;
    return Number.isSafeInteger(parsed) ? parsed : null;
}
function scope(raw) {
    const value = integer(raw);
    return value === 0 ? "team" : value === 1 ? "enemy" : value === 2 ? "rotation" : undefined;
}
function knownMask(raw) {
    const mask = integer(raw);
    if (mask === 4)
        return { kind: "type", types: ["INT"], rawMask: raw };
    if (mask === 8)
        return { kind: "type", types: ["STR"], rawMask: raw };
    if (mask === 16)
        return { kind: "type", types: ["PHY"], rawMask: raw };
    if (mask === 32)
        return { kind: "class", classes: ["Super"], rawMask: raw };
    if (mask === 64)
        return { kind: "class", classes: ["Extreme"], rawMask: raw };
    return undefined;
}
function selectorCondition(expression) {
    const type = integer(expression.causalityType);
    if (type !== 41 && type !== 46)
        return { condition: expression };
    const raw = object(expression.raw);
    const rawScope = raw?.cau_val1 ?? null;
    const rawSelector = raw?.cau_val2 ?? null;
    const rawCount = raw?.cau_val3 ?? null;
    const mappedScope = scope(rawScope);
    const count = integer(rawCount);
    const causalityId = expression.causalityId ?? (raw?.id === undefined ? undefined : String(raw.id));
    if (!mappedScope || count === null || count < 1 || !causalityId)
        return { condition: expression };
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
        const selector = { kind: "name_token", token: rawSelector, localizedName: null };
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
function mapCondition(expression) {
    if (expression.op === "all" || expression.op === "any") {
        const children = expression.children.map(mapCondition);
        return { condition: { ...expression, children: children.map(value => value.condition) }, metadata: children.flatMap(value => value.metadata) };
    }
    if (expression.op === "not") {
        const child = mapCondition(expression.child);
        return { condition: { ...expression, child: child.condition }, metadata: child.metadata };
    }
    if (expression.op !== "unknown")
        return { condition: expression, metadata: [] };
    const mapped = selectorCondition(expression);
    return { condition: mapped.condition, metadata: mapped.metadata ? [mapped.metadata] : [] };
}
function conditionStatus(expression) {
    if (expression.op === "always")
        return "supported";
    if (expression.op === "unknown")
        return "unknown";
    if (expression.op === "predicate")
        return expression.predicate.kind === "qualifying_unit_count" ? expression.predicate.semanticStatus : "supported";
    if (expression.op === "not")
        return conditionStatus(expression.child);
    const statuses = expression.children.map(conditionStatus);
    return statuses.every(value => value === "supported") ? "supported" : statuses.every(value => value === "unknown") ? "unknown" : "partial";
}
function combineStatus(condition, effect) {
    if (condition === "supported" && effect === "supported")
        return "supported";
    if (condition === "unknown" && effect === "unknown")
        return "unknown";
    return "partial";
}
function upgradeRule(rule) {
    const mapped = mapCondition(rule.condition);
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
function buildDatabaseTeamAnalysisDb7Dataset(db6) {
    return {
        schemaVersion: 1, contract: "dokkan-team-analysis-database-experiment", contractVersion: "0.6.0",
        generatedAt: db6.generatedAt, sourceDb6ContractVersion: "0.5.0", sourceSnapshotVersion: db6.sourceSnapshotVersion, sourceSha256: db6.sourceSha256,
        states: db6.states.map(state => {
            if (!state.passive) {
                const { passive: _passive, ...withoutPassive } = state;
                return withoutPassive;
            }
            const rules = state.passive.rules.map(upgradeRule);
            const statuses = rules.map(value => value.status);
            const status = statuses.every(value => value === "supported") ? "supported" : statuses.every(value => value === "unknown") ? "unknown" : "partial";
            return { ...state, passive: { ...state.passive, rules, status } };
        }),
    };
}
exports.buildDatabaseTeamAnalysisDb7Dataset = buildDatabaseTeamAnalysisDb7Dataset;
function buildDatabaseTeamAnalysisDb7Coverage(dataset) {
    const rules = dataset.states.flatMap(state => state.passive?.rules ?? []);
    const selectors = rules.flatMap(rule => rule.selectorConditions);
    const statuses = (values) => ({ supported: values.filter(value => value === "supported").length, partial: values.filter(value => value === "partial").length, unknown: values.filter(value => value === "unknown").length });
    const byType = {};
    const uniqueByType = new Map();
    const masks = {};
    for (const selector of selectors) {
        const type = String(selector.causalityType);
        byType[type] = (byType[type] ?? 0) + 1;
        const unique = uniqueByType.get(type) ?? new Set();
        unique.add(selector.causalityId);
        uniqueByType.set(type, unique);
        if (selector.causalityType === 46) {
            const mask = String(selector.rawSelector);
            masks[mask] = (masks[mask] ?? 0) + 1;
        }
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
exports.buildDatabaseTeamAnalysisDb7Coverage = buildDatabaseTeamAnalysisDb7Coverage;
//# sourceMappingURL=team-analysis-db7-builder.js.map