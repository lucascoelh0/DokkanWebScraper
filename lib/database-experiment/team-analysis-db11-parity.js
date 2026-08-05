"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.compareDatabaseTeamAnalysisDb11 = void 0;
function object(value) { return value !== null && typeof value === "object" && !Array.isArray(value) ? value : undefined; }
function signature(value) { return JSON.stringify(Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined).sort(([left], [right]) => left.localeCompare(right)))); }
function descend(context, combinator) {
    return { combinators: context.combinators[context.combinators.length - 1] === combinator ? context.combinators : [...context.combinators, combinator], negated: context.negated };
}
function isRuntimePredicate(value) {
    const type = value.sourceCausalityType;
    return type === 43 || type === 51 || type === 55;
}
function databaseSignature(predicate, context) {
    const logicalContext = context.combinators.join(">") || "direct";
    const normalized = predicate.kind === "attacks_evaded" ? signature({ kind: predicate.kind, scope: predicate.scope, eventMode: predicate.eventMode, logicalContext, negated: context.negated })
        : signature({ kind: predicate.kind, scope: predicate.scope, comparator: predicate.comparator, value: predicate.value, logicalContext, negated: context.negated });
    return { type: predicate.sourceCausalityType, kind: predicate.kind, signature: normalized };
}
function currentSignature(predicate, context) {
    const logicalContext = context.combinators.join(">") || "direct";
    if (predicate.kind === "attacks_evaded" && predicate.scope === "self" && object(predicate.combatEvent)?.mode === "current_event")
        return { type: 43, kind: "attacks_evaded", signature: signature({ kind: "attacks_evaded", scope: "self", eventMode: "current_event", logicalContext, negated: context.negated }) };
    if (predicate.kind !== "turn_from_entry" || predicate.scope !== "self" || !Number.isSafeInteger(predicate.value))
        return undefined;
    if (predicate.comparator === "lte")
        return { type: 51, kind: "turn_from_entry", signature: signature({ kind: "turn_from_entry", scope: "self", comparator: "lte", value: predicate.value, logicalContext, negated: context.negated }) };
    if (predicate.comparator === "gte")
        return { type: 55, kind: "turn_from_entry", signature: signature({ kind: "turn_from_entry", scope: "self", comparator: "gte", value: predicate.value, logicalContext, negated: context.negated }) };
    return undefined;
}
function walkCurrent(value, context, visit) {
    const expression = object(value);
    if (!expression)
        return;
    if (expression.op === "predicate") {
        const predicate = object(expression.predicate);
        const normalized = predicate ? currentSignature(predicate, context) : undefined;
        if (normalized)
            visit(normalized);
    }
    else if ((expression.op === "all" || expression.op === "any") && Array.isArray(expression.children))
        expression.children.forEach(child => walkCurrent(child, descend(context, expression.op), visit));
    else if (expression.op === "not")
        walkCurrent(expression.child, { combinators: context.combinators, negated: !context.negated }, visit);
}
function walkDatabase(value, context, visit) {
    if (value.op === "predicate" && isRuntimePredicate(value.predicate))
        visit(databaseSignature(value.predicate, context));
    else if (value.op === "all" || value.op === "any")
        value.children.forEach(child => walkDatabase(child, descend(context, value.op), visit));
    else if (value.op === "not")
        walkDatabase(value.child, { combinators: context.combinators, negated: !context.negated }, visit);
}
function difference(left, right) { return [...left].filter(value => !right.has(value)).sort(); }
function compareDatabaseTeamAnalysisDb11(database, current, siteAudit) {
    const aliases = new Map(siteAudit.formProjectionAliases.map(alias => [alias.databaseCardId, alias.projectedCardId]));
    const projectedKey = (state) => `${state.characterId}:${aliases.get(state.formId) ?? state.formId}:${state.releaseState}`;
    const currentByKey = new Map(current.states.map(state => [state.stateKey, state]));
    const databaseAll = new Set();
    const currentAll = new Set();
    const typeSets = new Map([43, 51, 55].map(type => [type, { projectedOccurrences: 0, projectedInMatchedStates: 0, database: new Set(), current: new Set() }]));
    const kindSets = new Map();
    const examples = [];
    let matchedStateCount = 0;
    for (const state of database.states) {
        for (const runtime of state.passive?.rules.flatMap(rule => rule.runtimeConditions) ?? [])
            typeSets.get(runtime.causalityType).projectedOccurrences += 1;
        const stateKey = projectedKey(state);
        const currentState = currentByKey.get(stateKey);
        if (!currentState)
            continue;
        matchedStateCount += 1;
        const databaseState = new Set();
        const currentStateSet = new Set();
        for (const runtime of state.passive?.rules.flatMap(rule => rule.runtimeConditions) ?? []) {
            typeSets.get(runtime.causalityType).projectedInMatchedStates += 1;
            const kind = kindSets.get(runtime.predicate.kind) ?? { database: new Set(), current: new Set() };
            kind.database.add(stateKey);
            kindSets.set(runtime.predicate.kind, kind);
        }
        for (const rule of state.passive?.rules ?? [])
            walkDatabase(rule.condition, { combinators: [], negated: false }, value => {
                const key = `${stateKey}|${value.signature}`;
                databaseAll.add(key);
                databaseState.add(value.signature);
                typeSets.get(value.type).database.add(key);
            });
        for (const rule of currentState.passive?.rules ?? [])
            walkCurrent(rule.condition, { combinators: [], negated: false }, value => {
                const key = `${stateKey}|${value.signature}`;
                currentAll.add(key);
                currentStateSet.add(value.signature);
                typeSets.get(value.type).current.add(key);
                const kind = kindSets.get(value.kind) ?? { database: new Set(), current: new Set() };
                kind.current.add(stateKey);
                kindSets.set(value.kind, kind);
            });
        const databaseOnly = difference(databaseState, currentStateSet);
        const currentOnly = difference(currentStateSet, databaseState);
        if (databaseOnly.length || currentOnly.length)
            examples.push({ stateKey, databaseOnly, currentOnly });
    }
    return {
        schemaVersion: 1, matchedStateCount, promotedStructuralSignatures: { database: databaseAll.size, current: currentAll.size, matched: [...databaseAll].filter(value => currentAll.has(value)).length },
        parityByKind: Object.fromEntries([...kindSets.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([kind, sets]) => [kind, { databaseStates: sets.database.size, currentStates: sets.current.size, matchedStates: [...sets.database].filter(value => sets.current.has(value)).length }])),
        occurrenceCountsByType: Object.fromEntries([...typeSets.entries()].map(([type, sets]) => [String(type), {
                projected: sets.projectedOccurrences, projectedInMatchedStates: sets.projectedInMatchedStates, databaseStateSignatures: sets.database.size,
                currentStateSignatures: sets.current.size, matchedStateSignatures: [...sets.database].filter(value => sets.current.has(value)).length,
            }])),
        examples: examples.sort((left, right) => right.databaseOnly.length + right.currentOnly.length - left.databaseOnly.length - left.currentOnly.length || left.stateKey.localeCompare(right.stateKey, "en", { numeric: true })).slice(0, 60),
    };
}
exports.compareDatabaseTeamAnalysisDb11 = compareDatabaseTeamAnalysisDb11;
//# sourceMappingURL=team-analysis-db11-parity.js.map