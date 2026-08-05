import { SiteAuditFixtures } from "./parity";
import { CurrentTeamAnalysisDataset } from "./team-analysis-parity";
import {
    DatabaseTeamAnalysisDb3Coverage,
    DatabaseTeamAnalysisDb3Dataset,
    DatabaseTeamAnalysisDb3Parity,
    Db3ConditionExpression,
    Db3PassiveEffect,
} from "./team-analysis-db3-contract";

type JsonObject = Record<string, unknown>;

function object(value: unknown): JsonObject | undefined {
    return value !== null && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : undefined;
}

function sortedStrings(value: unknown): string[] | undefined {
    if (!Array.isArray(value)) return undefined;
    return value.map(String).sort();
}

function compact(value: JsonObject): JsonObject {
    return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined && (!Array.isArray(item) || item.length > 0)));
}

function signature(value: JsonObject): string {
    return JSON.stringify(Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right))));
}

export function databasePredicateSignature(expression: Extract<Db3ConditionExpression, { op: "predicate" }>): string {
    const predicate = expression.predicate;
    return signature(compact({
        kind: predicate.kind,
        scope: predicate.scope,
        comparator: predicate.comparator,
        value: predicate.value,
        maxValue: predicate.maxValue,
        count: predicate.count,
        categories: predicate.categories?.slice().sort(),
        classes: predicate.classes?.slice().sort(),
        kiSphereTypes: predicate.kiSphereTypes?.slice().sort(),
        enemyStatuses: predicate.enemyStatuses?.slice().sort(),
        eventMode: predicate.eventMode,
    }));
}

export function currentTeamAnalysisPredicateSignature(predicate: Record<string, unknown>): string {
    const slots = Array.isArray(predicate.slots) ? predicate.slots : undefined;
    return signature(compact({
        kind: predicate.kind,
        scope: predicate.scope,
        comparator: predicate.comparator,
        value: slots?.length === 1 ? slots[0] : predicate.value,
        maxValue: predicate.maxValue,
        count: predicate.count,
        categories: sortedStrings(predicate.categories),
        classes: sortedStrings(predicate.classes),
        kiSphereTypes: sortedStrings(predicate.kiSphereTypes),
        enemyStatuses: sortedStrings(predicate.enemyStatuses),
        eventMode: object(predicate.combatEvent)?.mode,
    }));
}

function walkDbCondition(expression: Db3ConditionExpression, predicates: Array<{ kind: string, signature: string }>): void {
    if (expression.op === "predicate") predicates.push({ kind: expression.predicate.kind, signature: databasePredicateSignature(expression) });
    else if (expression.op === "all" || expression.op === "any") expression.children.forEach(child => walkDbCondition(child, predicates));
    else if (expression.op === "not") walkDbCondition(expression.child, predicates);
}

function walkCurrentCondition(value: unknown, predicates: Array<{ kind: string, signature: string }>): void {
    const expression = object(value);
    if (!expression) return;
    if (expression.op === "predicate") {
        const predicate = object(expression.predicate);
        if (predicate && typeof predicate.kind === "string") predicates.push({ kind: predicate.kind, signature: currentTeamAnalysisPredicateSignature(predicate) });
    } else if ((expression.op === "all" || expression.op === "any") && Array.isArray(expression.children)) {
        expression.children.forEach(child => walkCurrentCondition(child, predicates));
    } else if (expression.op === "not") walkCurrentCondition(expression.child, predicates);
}

export function databaseEffectSignature(effect: Db3PassiveEffect): string {
    const scaling = effect.scaling?.kind === "per_ki_sphere" ? {
        kind: effect.scaling.kind,
        kiSphereTypes: effect.scaling.selector.semantic === "any" ? ["any"]
            : effect.scaling.selector.semantic === "non_rainbow" ? ["non_rainbow"] : effect.scaling.selector.types.slice().sort(),
        spheresPerIncrement: effect.scaling.spheresPerIncrement,
    } : effect.scaling?.kind === "per_combat_event" ? {
        kind: effect.scaling.kind,
        event: effect.scaling.event,
        eventsPerIncrement: effect.scaling.eventsPerIncrement,
    } : effect.scaling?.kind === "per_turn" ? effect.scaling : undefined;
    const sphereChange = effect.kiSphereChange ? {
        sourceSelection: effect.kiSphereChange.sourceSelection,
        sourceTypes: effect.kiSphereChange.sourceTypes.slice().sort(),
        destinationType: effect.kiSphereChange.destinationType,
    } : undefined;
    return signature(compact({
        kind: effect.kind,
        scope: effect.target.scope === "category_class_allies" ? "category_allies" : effect.target.scope,
        categories: effect.target.categories.slice().sort(),
        excludedCategories: effect.target.excludedCategories.slice().sort(),
        classes: effect.target.classes.slice().sort(),
        types: effect.target.types.slice().sort(),
        value: effect.value,
        unit: effect.unit,
        stackCap: effect.stackCap,
        scaling,
        kiSphereChange: sphereChange,
    }));
}

export function currentTeamAnalysisEffectSignature(value: Record<string, unknown>): string {
    const target = object(value.target);
    const scaling = object(value.scaling);
    const events = Array.isArray(scaling?.events) ? scaling!.events.map(object).filter((item): item is JsonObject => Boolean(item)) : [];
    const normalizedScaling = scaling?.kind === "per_ki_sphere" ? {
        kind: scaling.kind,
        kiSphereTypes: sortedStrings(scaling.kiSphereTypes),
        spheresPerIncrement: scaling.spheresPerIncrement,
    } : scaling?.kind === "per_combat_event" ? {
        kind: scaling.kind,
        event: events.length === 1 ? events[0].eventType : undefined,
        eventsPerIncrement: scaling.eventsPerIncrement,
    } : undefined;
    const sphereChange = object(value.kiSphereChange);
    return signature(compact({
        kind: value.kind,
        scope: target?.scope,
        categories: sortedStrings(value.categories),
        classes: sortedStrings(value.classes),
        types: sortedStrings(value.types),
        value: value.value,
        unit: value.unit,
        stackCap: value.stackCap,
        scaling: normalizedScaling,
        kiSphereChange: sphereChange ? {
            sourceSelection: sphereChange.sourceSelection,
            sourceTypes: sortedStrings(sphereChange.sourceTypes),
            destinationType: sphereChange.destinationType,
        } : undefined,
    }));
}

function difference(left: string[], right: string[]): string[] {
    const other = new Set(right);
    return [...new Set(left.filter(value => !other.has(value)))].sort();
}

export function compareDatabaseTeamAnalysisDb3(
    database: DatabaseTeamAnalysisDb3Dataset,
    current: CurrentTeamAnalysisDataset,
    siteAudit: SiteAuditFixtures,
): DatabaseTeamAnalysisDb3Parity {
    const aliases = new Map(siteAudit.formProjectionAliases.map(alias => [alias.databaseCardId, alias.projectedCardId]));
    const projectedKey = (state: DatabaseTeamAnalysisDb3Dataset["states"][number]) => `${state.characterId}:${aliases.get(state.formId) ?? state.formId}:${state.releaseState}`;
    const databaseByKey = new Map(database.states.map(state => [projectedKey(state), state]));
    const pairs = current.states.flatMap(currentState => {
        const databaseState = databaseByKey.get(currentState.stateKey);
        return databaseState ? [{ currentState, databaseState }] : [];
    });
    const byKind = new Map<string, { database: Set<string>, current: Set<string> }>();
    const effectByKind = new Map<string, { database: Set<string>, current: Set<string> }>();
    const dbAllPredicates = new Set<string>(); const currentAllPredicates = new Set<string>();
    const dbAllEffects = new Set<string>(); const currentAllEffects = new Set<string>();
    const examples: DatabaseTeamAnalysisDb3Parity["examples"] = [];
    for (const { currentState, databaseState } of pairs) {
        const dbPredicates: Array<{ kind: string, signature: string }> = [];
        databaseState.passive?.rules.forEach(rule => walkDbCondition(rule.condition, dbPredicates));
        const currentPredicates: Array<{ kind: string, signature: string }> = [];
        currentState.passive?.rules?.forEach(rule => walkCurrentCondition(rule.condition, currentPredicates));
        const dbEffects = databaseState.passive?.rules.flatMap(rule => rule.effects).filter(effect => effect.kind !== "unknown") ?? [];
        const currentEffects = currentState.passive?.rules?.flatMap(rule => rule.effects ?? []).filter(effect => effect.kind && effect.kind !== "unknown") ?? [];
        dbPredicates.forEach(item => {
            dbAllPredicates.add(`${currentState.stateKey}|${item.signature}`);
            const entry = byKind.get(item.kind) ?? { database: new Set(), current: new Set() };
            entry.database.add(currentState.stateKey); byKind.set(item.kind, entry);
        });
        currentPredicates.forEach(item => {
            currentAllPredicates.add(`${currentState.stateKey}|${item.signature}`);
            const entry = byKind.get(item.kind) ?? { database: new Set(), current: new Set() };
            entry.current.add(currentState.stateKey); byKind.set(item.kind, entry);
        });
        const dbEffectSignatures = dbEffects.map(databaseEffectSignature);
        const currentEffectSignatures = currentEffects.map(currentTeamAnalysisEffectSignature);
        dbEffects.forEach((effect, index) => {
            dbAllEffects.add(`${currentState.stateKey}|${dbEffectSignatures[index]}`);
            const entry = effectByKind.get(effect.kind) ?? { database: new Set(), current: new Set() };
            entry.database.add(currentState.stateKey); effectByKind.set(effect.kind, entry);
        });
        currentEffects.forEach((effect, index) => {
            currentAllEffects.add(`${currentState.stateKey}|${currentEffectSignatures[index]}`);
            const kind = String(effect.kind);
            const entry = effectByKind.get(kind) ?? { database: new Set(), current: new Set() };
            entry.current.add(currentState.stateKey); effectByKind.set(kind, entry);
        });
        const databaseOnlyPredicates = difference(dbPredicates.map(item => item.signature), currentPredicates.map(item => item.signature));
        const currentOnlyPredicates = difference(currentPredicates.map(item => item.signature), dbPredicates.map(item => item.signature));
        const databaseOnlyEffects = difference(dbEffectSignatures, currentEffectSignatures);
        const currentOnlyEffects = difference(currentEffectSignatures, dbEffectSignatures);
        if (databaseOnlyPredicates.length || currentOnlyPredicates.length || databaseOnlyEffects.length || currentOnlyEffects.length) {
            examples.push({ stateKey: currentState.stateKey, databaseOnlyPredicates, currentOnlyPredicates, databaseOnlyEffects, currentOnlyEffects });
        }
    }
    const parity = (values: Map<string, { database: Set<string>, current: Set<string> }>) => Object.fromEntries([...values.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([kind, states]) => [kind, {
        databaseStates: states.database.size,
        currentStates: states.current.size,
        matchedStates: [...states.database].filter(key => states.current.has(key)).length,
    }]));
    return {
        schemaVersion: 1,
        matchedStateCount: pairs.length,
        predicateKindParity: parity(byKind),
        exactPredicateSignatureCount: { database: dbAllPredicates.size, current: currentAllPredicates.size, matched: [...dbAllPredicates].filter(value => currentAllPredicates.has(value)).length },
        exactEffectSignatureCount: { database: dbAllEffects.size, current: currentAllEffects.size, matched: [...dbAllEffects].filter(value => currentAllEffects.has(value)).length },
        effectKindParity: parity(effectByKind),
        examples: examples.sort((left, right) =>
            (right.databaseOnlyPredicates.length + right.currentOnlyPredicates.length + right.databaseOnlyEffects.length + right.currentOnlyEffects.length)
            - (left.databaseOnlyPredicates.length + left.currentOnlyPredicates.length + left.databaseOnlyEffects.length + left.currentOnlyEffects.length)
            || left.stateKey.localeCompare(right.stateKey, "en", { numeric: true })).slice(0, 40),
    };
}

function percent(value: number, total: number): string {
    return total === 0 ? "0.0%" : `${(value * 100 / total).toFixed(1)}%`;
}

export function renderDatabaseTeamAnalysisDb3Report(
    parity: DatabaseTeamAnalysisDb3Parity,
    coverage: DatabaseTeamAnalysisDb3Coverage,
    parserVersion: string,
): string {
    const predicateRows = Object.entries(parity.predicateKindParity).map(([kind, counts]) => `| ${kind} | ${counts.databaseStates} | ${counts.currentStates} | ${counts.matchedStates} |`).join("\n");
    const effectRows = Object.entries(parity.effectKindParity).map(([kind, counts]) => `| ${kind} | ${counts.databaseStates} | ${counts.currentStates} | ${counts.matchedStates} |`).join("\n");
    const sample = (values: string[]) => values.slice(0, 2).map(value => `\`${value}\``).join("; ") || "none";
    const examples = parity.examples.slice(0, 8).map(example =>
        `- \`${example.stateKey}\` — DB-only predicates (${example.databaseOnlyPredicates.length}): ${sample(example.databaseOnlyPredicates)}; current-only predicates (${example.currentOnlyPredicates.length}): ${sample(example.currentOnlyPredicates)}; DB-only effects (${example.databaseOnlyEffects.length}): ${sample(example.databaseOnlyEffects)}; current-only effects (${example.currentOnlyEffects.length}): ${sample(example.currentOnlyEffects)}.`,
    ).join("\n");
    const mappedEfficacies = Object.keys(coverage.mappedEfficacyRowCounts).sort((left, right) => Number(left) - Number(right));
    const unknownEfficacies = Object.keys(coverage.unknownEfficacyRowCounts).sort((left, right) => Number(left) - Number(right));
    const mappedCausalities = Object.keys(coverage.mappedCausalityTypeCounts).sort((left, right) => Number(left) - Number(right));
    const unknownCausalities = Object.keys(coverage.unknownCausalityTypeCounts).sort((left, right) => Number(left) - Number(right));
    return `# Database Team Analysis experiment — DB3\n\n` +
        `Compared with current parser \`${parserVersion}\`. Numeric values are normalized only where joined first-party evidence confirms their meaning.\n\n` +
        `## Outcome\n\n` +
        `- Matched states: **${parity.matchedStateCount}**.\n` +
        `- Rules supported/partial/unknown: **${coverage.ruleStatusCounts.supported}/${coverage.ruleStatusCounts.partial}/${coverage.ruleStatusCounts.unknown}**.\n` +
        `- Causality leaves mapped: **${coverage.mappedCausalityLeafCount}/${coverage.causalityLeafCount} (${percent(coverage.mappedCausalityLeafCount, coverage.causalityLeafCount)})**; unknown: **${coverage.unknownCausalityLeafCount}**.\n` +
        `- Conditional rules: **${coverage.conditionalRuleCount}**; compiled operator expressions retained unknown: **${coverage.unknownCompiledOperatorCount}**.\n` +
        `- Sub-target rows mapped: **${coverage.mappedSubTargetRowCount}/${coverage.subTargetRowCount} (${percent(coverage.mappedSubTargetRowCount, coverage.subTargetRowCount)})**.\n` +
        `- Exact predicate signatures DB/current/matched: **${parity.exactPredicateSignatureCount.database}/${parity.exactPredicateSignatureCount.current}/${parity.exactPredicateSignatureCount.matched}**.\n` +
        `- Exact effect signatures DB/current/matched: **${parity.exactEffectSignatureCount.database}/${parity.exactEffectSignatureCount.current}/${parity.exactEffectSignatureCount.matched}**.\n\n` +
        `## Predicate presence by matched state\n\n| Predicate | DB states | Current states | Both |\n| --- | ---: | ---: | ---: |\n${predicateRows}\n\n` +
        `## Effect presence by matched state\n\n| Effect | DB states | Current states | Both |\n| --- | ---: | ---: | ---: |\n${effectRows}\n\n` +
        `## Confirmed in DB3\n\n` +
        `- Efficacies 67 (Ki Sphere conversion), 68 (per-sphere scaling), 96 (Ki per sphere), and 98 (capped event/turn scaling).\n` +
        `- Causalities 1, 2, 5, 15, 16, 19, 24, 25, 30, 38, and 42 for the audited tuple shapes.\n` +
        `- Sphere mask bits: 1=AGL, 2=TEQ, 4=INT, 8=STR, 16=PHY, 32=Rainbow; 31=non-Rainbow, 63=any.\n\n` +
        `Mapped efficacy types with at least one supported row: ${mappedEfficacies.join(", ") || "none"}. Mapped causality types: ${mappedCausalities.join(", ") || "none"}.\n\n` +
        `## Explicitly unknown\n\n` +
        `- Causalities 33, 34, 44, and 46: field generalization is not proven.\n` +
        `- Compiled causality operators \`&\`, \`|\`, and \`!\`: raw symbols are retained, but boolean semantics are not asserted.\n` +
        `- Sub-target value types other than 1 (included category) and 2 (excluded category).\n` +
        `- Sphere masks containing bits outside the confirmed low six bits.\n\n` +
        `Efficacy types with at least one unknown row: ${unknownEfficacies.join(", ") || "none"}. Unknown causality types: ${unknownCausalities.join(", ") || "none"}.\n\n` +
        `## Largest concrete conflicts\n\n${examples || "No conflicts in matched states."}\n\n` +
        `The signature comparison is intentionally strict and is diagnostic rather than a compatibility claim: the site parser can split one mechanic into multiple text clauses, while one database row can encode multiple effects.\n`;
}
