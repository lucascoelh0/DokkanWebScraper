"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.renderDatabaseTeamAnalysisDb6Report = exports.compareDatabaseTeamAnalysisDb6 = void 0;
const team_analysis_db3_parity_1 = require("./team-analysis-db3-parity");
const HISTORY_KINDS = new Set(["super_attacks_performed", "attacks_performed", "attacks_received", "guard_activated", "attacks_evaded"]);
function object(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value) ? value : undefined;
}
function historySignature(base, event) {
    if (typeof event.eventType !== "string" || typeof event.actor !== "string" || typeof event.attackKind !== "string"
        || event.mode !== "accumulated_count" || typeof event.countScope !== "string" || typeof event.relativeTiming !== "string")
        return undefined;
    return JSON.stringify({
        predicate: JSON.parse(base),
        combatEvent: {
            eventType: event.eventType,
            actor: event.actor,
            attackKind: event.attackKind,
            mode: event.mode,
            countScope: event.countScope,
            relativeTiming: event.relativeTiming,
        },
    });
}
function walkDatabase(expression, visit) {
    if (expression.op === "predicate")
        visit(expression.predicate.kind, expression.predicate.sourceCausalityType === 44 && expression.predicate.combatEvent
            ? historySignature((0, team_analysis_db3_parity_1.databasePredicateSignature)(expression), expression.predicate.combatEvent)
            : (0, team_analysis_db3_parity_1.databasePredicateSignature)(expression), expression.predicate.sourceCausalityType === 44);
    else if (expression.op === "all" || expression.op === "any")
        expression.children.forEach(child => walkDatabase(child, visit));
    else if (expression.op === "not")
        walkDatabase(expression.child, visit);
}
function walkCurrent(value, visit) {
    const expression = object(value);
    if (!expression)
        return;
    if (expression.op === "predicate") {
        const predicate = object(expression.predicate);
        const event = object(predicate?.combatEvent);
        if (predicate && typeof predicate.kind === "string") {
            const base = (0, team_analysis_db3_parity_1.currentTeamAnalysisPredicateSignature)(predicate);
            const history = HISTORY_KINDS.has(predicate.kind) && event ? historySignature(base, event) : undefined;
            visit(predicate.kind, history ?? base, history !== undefined);
        }
    }
    else if ((expression.op === "all" || expression.op === "any") && Array.isArray(expression.children)) {
        expression.children.forEach(child => walkCurrent(child, visit));
    }
    else if (expression.op === "not")
        walkCurrent(expression.child, visit);
}
function difference(left, right) {
    return [...left].filter(value => !right.has(value)).sort();
}
function compareDatabaseTeamAnalysisDb6(database, current, siteAudit, db4Parity) {
    const aliases = new Map(siteAudit.formProjectionAliases.map(alias => [alias.databaseCardId, alias.projectedCardId]));
    const projectedKey = (state) => `${state.characterId}:${aliases.get(state.formId) ?? state.formId}:${state.releaseState}`;
    const currentByKey = new Map(current.states.map(state => [state.stateKey, state]));
    const databaseAll = new Set();
    const currentAll = new Set();
    const databaseHistory = new Set();
    const currentHistory = new Set();
    const kinds = new Map();
    const examples = [];
    let matchedStateCount = 0;
    for (const state of database.states) {
        const stateKey = projectedKey(state);
        const currentState = currentByKey.get(stateKey);
        if (!currentState)
            continue;
        matchedStateCount += 1;
        const databaseStateHistory = new Set();
        const currentStateHistory = new Set();
        for (const rule of state.passive?.rules ?? [])
            walkDatabase(rule.condition, (kind, signature, history) => {
                databaseAll.add(`${stateKey}|${signature}`);
                if (!history)
                    return;
                databaseHistory.add(`${stateKey}|${signature}`);
                databaseStateHistory.add(signature);
                const bucket = kinds.get(kind) ?? { database: new Set(), current: new Set() };
                bucket.database.add(stateKey);
                kinds.set(kind, bucket);
            });
        for (const rule of currentState.passive?.rules ?? [])
            walkCurrent(rule.condition, (kind, signature, history) => {
                currentAll.add(`${stateKey}|${signature}`);
                if (!history)
                    return;
                currentHistory.add(`${stateKey}|${signature}`);
                currentStateHistory.add(signature);
                const bucket = kinds.get(kind) ?? { database: new Set(), current: new Set() };
                bucket.current.add(stateKey);
                kinds.set(kind, bucket);
            });
        const databaseOnlyHistory = difference(databaseStateHistory, currentStateHistory);
        const currentOnlyHistory = difference(currentStateHistory, databaseStateHistory);
        if (databaseOnlyHistory.length || currentOnlyHistory.length)
            examples.push({ stateKey, databaseOnlyHistory, currentOnlyHistory });
    }
    const exactMatched = [...databaseAll].filter(value => currentAll.has(value)).length;
    return {
        schemaVersion: 1,
        matchedStateCount,
        exactPredicateSignatures: { database: databaseAll.size, current: currentAll.size, matched: exactMatched },
        baselineExactPredicateMatches: db4Parity.exactPredicateSignatures.matched,
        exactPredicateMatchDelta: exactMatched - db4Parity.exactPredicateSignatures.matched,
        combatHistorySignatures: {
            database: databaseHistory.size,
            current: currentHistory.size,
            matched: [...databaseHistory].filter(value => currentHistory.has(value)).length,
        },
        combatHistoryParityByKind: Object.fromEntries([...kinds.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([kind, value]) => [kind, {
                databaseStates: value.database.size,
                currentStates: value.current.size,
                matchedStates: [...value.database].filter(stateKey => value.current.has(stateKey)).length,
            }])),
        examples: examples.sort((left, right) => (right.databaseOnlyHistory.length + right.currentOnlyHistory.length) - (left.databaseOnlyHistory.length + left.currentOnlyHistory.length)
            || left.stateKey.localeCompare(right.stateKey, "en", { numeric: true })).slice(0, 60),
    };
}
exports.compareDatabaseTeamAnalysisDb6 = compareDatabaseTeamAnalysisDb6;
function percent(value, total) {
    return total === 0 ? "0.0%" : `${(value * 100 / total).toFixed(1)}%`;
}
function renderDatabaseTeamAnalysisDb6Report(coverage, parity, parserVersion) {
    const eventRows = Object.entries(coverage.combatHistoryEventCounts).map(([kind, count]) => {
        const comparison = parity.combatHistoryParityByKind[kind] ?? { databaseStates: 0, currentStates: 0, matchedStates: 0 };
        return `| ${kind} | ${count} | ${comparison.databaseStates} | ${comparison.currentStates} | ${comparison.matchedStates} |`;
    }).join("\n");
    const tupleRows = Object.entries(coverage.rawTimingCalculationTupleCounts).map(([tuple, count]) => `| ${tuple} | ${count} |`).join("\n");
    const examples = parity.examples.slice(0, 15).map(value => `- \`${value.stateKey}\`: DB-only [${value.databaseOnlyHistory.join("; ") || "none"}]; current-only [${value.currentOnlyHistory.join("; ") || "none"}].`).join("\n");
    return `# Database Team Analysis experiment — DB6\n\n` +
        `Compared with current parser \`${parserVersion}\`. DB6 preserves DB5 and maps only the proven event/count portion of first-party causality 44.\n\n` +
        `## Outcome\n\n` +
        `- States: **${coverage.stateCount}**; matched current states: **${parity.matchedStateCount}**.\n` +
        `- Type-44 history predicates: **${coverage.combatHistoryPredicateCount}** rule occurrences over **${coverage.uniqueCombatHistoryCausalityCount}** unique causalities.\n` +
        `- Exact history signatures DB/current/matched: **${parity.combatHistorySignatures.database}/${parity.combatHistorySignatures.current}/${parity.combatHistorySignatures.matched}** (${percent(parity.combatHistorySignatures.matched, parity.combatHistorySignatures.database)} of DB signatures).\n` +
        `- All exact predicate signatures DB/current/matched: **${parity.exactPredicateSignatures.database}/${parity.exactPredicateSignatures.current}/${parity.exactPredicateSignatures.matched}**; delta **${parity.exactPredicateMatchDelta >= 0 ? "+" : ""}${parity.exactPredicateMatchDelta}** from DB4's ${parity.baselineExactPredicateMatches}.\n` +
        `- Recurrence unknown: **${coverage.recurrenceUnknownCount}**; calculation bucket unknown: **${coverage.calculationBucketUnknownCount}**. These fields keep affected rules partial even when the event/count predicate is supported.\n\n` +
        `## Event coverage\n\n| Event | Rule occurrences | DB states | Current states | Matched states |\n| --- | ---: | ---: | ---: | ---: |\n${eventRows}\n\n` +
        `## Raw timing/calculation tuples\n\n| execution_timing_type / calculation_option | Rows |\n| --- | ---: |\n${tupleRows}\n\n` +
        `The raw tuples are provenance, not mapped enums. First-party evidence does not prove a calculation bucket from these numeric values.\n\n` +
        `## Confirmed semantics\n\n` +
        `Causality 44 is self battle-history count: event 1=Super Attack performed, 2=attack performed, 3=attack received, 4=guard activated, 5=attack evaded; \`cau_val2\` is the minimum count. All snapshot rows have \`cau_val3=0\`; its meaning is not assumed.\n\n` +
        `The same tuple can back one-time “after N” and recurring “every N” behavior. DB6 therefore never turns type 44 into scaling, never infers recurrence, and never derives a calculation bucket from execution timing or calculation option. No passive text is parsed.\n\n` +
        `## Important parity conflicts\n\n${examples || "None."}\n\n` +
        `## Gate assessment\n\n` +
        `DB6 improves structured condition coverage but remains NO-GO for full Team Analysis replacement. Production equivalence still needs recurrence/application semantics, calculation buckets, unresolved name tokens and the remaining partial causality families.\n`;
}
exports.renderDatabaseTeamAnalysisDb6Report = renderDatabaseTeamAnalysisDb6Report;
//# sourceMappingURL=team-analysis-db6-parity.js.map