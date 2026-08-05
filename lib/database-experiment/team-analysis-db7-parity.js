"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.renderDatabaseTeamAnalysisDb7Report = exports.compareDatabaseTeamAnalysisDb7 = void 0;
function object(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value) ? value : undefined;
}
function strings(value) {
    return Array.isArray(value) ? value.filter((item) => typeof item === "string").slice().sort() : [];
}
function signature(scope, selectorKind, selectorValue, count) {
    return JSON.stringify({ scope, selectorKind, selectorValue, comparator: "gte", minimumCount: count });
}
function databaseSignature(value) {
    if (value.status !== "supported")
        return undefined;
    if (value.selector.kind === "class" && value.selector.classes.length === 1)
        return { kind: "class", signature: signature(value.scope, "class", value.selector.classes[0], value.minimumCount) };
    if (value.selector.kind === "type" && value.selector.types.length === 1)
        return { kind: "type", signature: signature(value.scope, "type", value.selector.types[0], value.minimumCount) };
    return undefined;
}
function currentSignature(predicate) {
    const kind = predicate.kind;
    const selectorKind = kind === "ally_class_present" || kind === "enemy_class" ? "class"
        : kind === "ally_type_present" || kind === "enemy_type" ? "type" : undefined;
    if (!selectorKind || typeof predicate.scope !== "string")
        return undefined;
    const values = strings(selectorKind === "class" ? predicate.classes : predicate.types);
    if (values.length !== 1)
        return undefined;
    const rawCount = typeof predicate.count === "number" ? predicate.count : typeof predicate.value === "number" ? predicate.value : 1;
    const comparator = predicate.comparator ?? "gte";
    if (!Number.isSafeInteger(rawCount) || rawCount < 1 || comparator !== "gte")
        return undefined;
    return { kind: selectorKind, signature: signature(predicate.scope, selectorKind, values[0], rawCount) };
}
function walkCurrent(value, visit) {
    const expression = object(value);
    if (!expression)
        return;
    if (expression.op === "predicate") {
        const predicate = object(expression.predicate);
        const normalized = predicate ? currentSignature(predicate) : undefined;
        if (normalized)
            visit(normalized);
    }
    else if ((expression.op === "all" || expression.op === "any") && Array.isArray(expression.children))
        expression.children.forEach(child => walkCurrent(child, visit));
    else if (expression.op === "not")
        walkCurrent(expression.child, visit);
}
function difference(left, right) {
    return [...left].filter(value => !right.has(value)).sort();
}
function compareDatabaseTeamAnalysisDb7(database, current, siteAudit) {
    const aliases = new Map(siteAudit.formProjectionAliases.map(alias => [alias.databaseCardId, alias.projectedCardId]));
    const projectedKey = (state) => `${state.characterId}:${aliases.get(state.formId) ?? state.formId}:${state.releaseState}`;
    const currentByKey = new Map(current.states.map(state => [state.stateKey, state]));
    const databaseAll = new Set();
    const currentAll = new Set();
    const kinds = new Map();
    const examples = [];
    let matchedStateCount = 0;
    let partialNameTokenOccurrenceCount = 0;
    for (const state of database.states) {
        const stateKey = projectedKey(state);
        const currentState = currentByKey.get(stateKey);
        if (!currentState)
            continue;
        matchedStateCount += 1;
        const databaseState = new Set();
        const currentStateSet = new Set();
        for (const selector of state.passive?.rules.flatMap(rule => rule.selectorConditions) ?? []) {
            if (selector.causalityType === 41)
                partialNameTokenOccurrenceCount += 1;
            const normalized = databaseSignature(selector);
            if (!normalized)
                continue;
            databaseAll.add(`${stateKey}|${normalized.signature}`);
            databaseState.add(normalized.signature);
            const bucket = kinds.get(normalized.kind) ?? { database: new Set(), current: new Set() };
            bucket.database.add(stateKey);
            kinds.set(normalized.kind, bucket);
        }
        for (const rule of currentState.passive?.rules ?? [])
            walkCurrent(rule.condition, normalized => {
                currentAll.add(`${stateKey}|${normalized.signature}`);
                currentStateSet.add(normalized.signature);
                const bucket = kinds.get(normalized.kind) ?? { database: new Set(), current: new Set() };
                bucket.current.add(stateKey);
                kinds.set(normalized.kind, bucket);
            });
        const databaseOnlySelectors = difference(databaseState, currentStateSet);
        const currentOnlySelectors = difference(currentStateSet, databaseState);
        if (databaseOnlySelectors.length || currentOnlySelectors.length)
            examples.push({ stateKey, databaseOnlySelectors, currentOnlySelectors });
    }
    return {
        schemaVersion: 1, matchedStateCount,
        supportedSelectorSignatures: { database: databaseAll.size, current: currentAll.size, matched: [...databaseAll].filter(value => currentAll.has(value)).length },
        parityBySelectorKind: Object.fromEntries([...kinds.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([kind, value]) => [kind, { databaseStates: value.database.size, currentStates: value.current.size, matchedStates: [...value.database].filter(key => value.current.has(key)).length }])),
        partialNameTokenOccurrenceCount, partialNameTokenComparableCount: 0,
        examples: examples.sort((left, right) => (right.databaseOnlySelectors.length + right.currentOnlySelectors.length) - (left.databaseOnlySelectors.length + left.currentOnlySelectors.length) || left.stateKey.localeCompare(right.stateKey, "en", { numeric: true })).slice(0, 60),
    };
}
exports.compareDatabaseTeamAnalysisDb7 = compareDatabaseTeamAnalysisDb7;
function renderDatabaseTeamAnalysisDb7Report(coverage, parity, parserVersion) {
    const kindRows = Object.entries(parity.parityBySelectorKind).map(([kind, value]) => `| ${kind} | ${value.databaseStates} | ${value.currentStates} | ${value.matchedStates} |`).join("\n");
    const maskRows = Object.entries(coverage.type46.maskCounts).map(([mask, count]) => `| ${mask} | ${count} | ${["4", "8", "16", "32", "64"].includes(mask) ? "confirmed" : "unknown"} |`).join("\n");
    const examples = parity.examples.slice(0, 12).map(value => `- \`${value.stateKey}\`: DB-only [${value.databaseOnlySelectors.join("; ") || "none"}]; current-only [${value.currentOnlySelectors.join("; ") || "none"}].`).join("\n");
    return `# Database Team Analysis experiment — DB7\n\nCompared with current parser \`${parserVersion}\`. DB7 preserves DB6 and normalizes only selector conditions backed by first-party evidence.\n\n` +
        `## Outcome\n\n- Selector occurrences: **${coverage.selectorConditionCount}**; supported/partial/unknown: **${coverage.selectorStatusCounts.supported}/${coverage.selectorStatusCounts.partial}/${coverage.selectorStatusCounts.unknown}**.\n` +
        `- Type 41: **${coverage.type41.occurrenceCount}** occurrences, **${coverage.type41.uniqueTokenCount}** unique opaque tokens; dictionary **unavailable**.\n` +
        `- Type 46: **${coverage.type46.supportedOccurrenceCount}** supported occurrences and **${coverage.type46.unknownOccurrenceCount}** unknown-mask occurrences.\n` +
        `- Supported selector signatures DB/current/matched: **${parity.supportedSelectorSignatures.database}/${parity.supportedSelectorSignatures.current}/${parity.supportedSelectorSignatures.matched}**. Name tokens have **0** exact-comparable signatures by design.\n` +
        `- Conditions supported/partial/unknown: **${coverage.conditionStatusCounts.supported}/${coverage.conditionStatusCounts.partial}/${coverage.conditionStatusCounts.unknown}**.\n\n` +
        `## Selector parity\n\n| Selector | DB states | Current states | Matched states |\n| --- | ---: | ---: | ---: |\n${kindRows}\n\n` +
        `## Type-46 masks\n\n| Mask | Occurrences | Mapping |\n| ---: | ---: | --- |\n${maskRows}\n\n` +
        `Confirmed masks are 4=INT, 8=STR, 16=PHY, 32=Super Class and 64=Extreme Class. Bits 1/2 cannot be assigned AGL versus TEQ independently. High bits 131072..2097152 are only proven collectively as the five Extreme Types, so individual identities remain unknown.\n\n` +
        `## Type-41 dictionary result\n\nNo joinable dictionary exists in this SQLite schema: \`skill_causalities\` has no foreign key or token-reference table, and candidate character IDs contradict audited tokens. DB7 retains token, scope, minimum count and provenance, but assigns no localized name and keeps the condition partial. No current text is used to backfill it.\n\n` +
        `## Important parity conflicts\n\n${examples || "None."}\n\n` +
        `## Gate assessment\n\nDB7 removes the supported low-bit type-46 selector family from the unknown pool. Full Team Analysis remains NO-GO because type-41 evaluation, AGL/TEQ/high masks, recurrence and calculation buckets remain unresolved.\n`;
}
exports.renderDatabaseTeamAnalysisDb7Report = renderDatabaseTeamAnalysisDb7Report;
//# sourceMappingURL=team-analysis-db7-parity.js.map