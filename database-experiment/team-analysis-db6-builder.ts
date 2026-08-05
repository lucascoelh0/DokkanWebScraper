import { SqliteScalar } from "./contract";
import { Db3Status } from "./team-analysis-db3-contract";
import { Db4PassiveRule } from "./team-analysis-db4-contract";
import { DatabaseTeamAnalysisDb5Dataset } from "./team-analysis-db5-contract";
import { DatabasePassiveRule, DatabaseTeamAnalysisExperimentDataset } from "./team-analysis-contract";
import {
    DatabaseTeamAnalysisDb6Coverage,
    DatabaseTeamAnalysisDb6Dataset,
    Db6CombatHistoryKind,
    Db6ConditionExpression,
    Db6PassiveRule,
} from "./team-analysis-db6-contract";

function object(value: unknown): Record<string, unknown> | undefined {
    return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}

function integer(value: unknown): number | null {
    const parsed = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : NaN;
    return Number.isSafeInteger(parsed) ? parsed : null;
}

const HISTORY_EVENTS: Record<number, {
    kind: Db6CombatHistoryKind,
    eventType: "attack_performed" | "attack_landed" | "guard_activated" | "attack_evaded",
    actor: "self" | "enemy",
    attackKind: "super_attack" | "unknown",
}> = {
    1: { kind: "super_attacks_performed", eventType: "attack_performed", actor: "self", attackKind: "super_attack" },
    2: { kind: "attacks_performed", eventType: "attack_performed", actor: "self", attackKind: "unknown" },
    3: { kind: "attacks_received", eventType: "attack_landed", actor: "enemy", attackKind: "unknown" },
    4: { kind: "guard_activated", eventType: "guard_activated", actor: "self", attackKind: "unknown" },
    5: { kind: "attacks_evaded", eventType: "attack_evaded", actor: "enemy", attackKind: "unknown" },
};

function mapCondition(expression: Db6ConditionExpression): { condition: Db6ConditionExpression, mapped: Array<{ id: string, event: Db6CombatHistoryKind, count: number, auxiliary: SqliteScalar }> } {
    if (expression.op === "all" || expression.op === "any") {
        const children = expression.children.map(mapCondition);
        return { condition: { ...expression, children: children.map(value => value.condition) }, mapped: children.flatMap(value => value.mapped) };
    }
    if (expression.op === "not") {
        const child = mapCondition(expression.child);
        return { condition: { ...expression, child: child.condition }, mapped: child.mapped };
    }
    if (expression.op !== "unknown" || integer(expression.causalityType) !== 44) return { condition: expression, mapped: [] };
    const raw = object(expression.raw);
    const rawEvent = integer(raw?.cau_val1);
    const count = integer(raw?.cau_val2);
    const auxiliary = (raw?.cau_val3 as SqliteScalar | undefined) ?? null;
    const event = rawEvent === null ? undefined : HISTORY_EVENTS[rawEvent];
    const causalityId = expression.causalityId ?? (raw?.id === undefined ? undefined : String(raw.id));
    if (!event || count === null || count < 1 || integer(auxiliary) !== 0 || !causalityId) return { condition: expression, mapped: [] };
    return {
        condition: { op: "predicate", predicate: {
            kind: event.kind,
            scope: "self",
            comparator: "gte",
            value: count,
            eventMode: "accumulated_count",
            combatEvent: {
                eventType: event.eventType,
                actor: event.actor,
                attackKind: event.attackKind,
                mode: "accumulated_count",
                countScope: "battle",
                relativeTiming: "after_event",
                evidence: "first-party-row-join",
            },
            sourceCausalityId: causalityId,
            sourceCausalityType: 44,
            evidence: "first-party-row-join",
        } },
        mapped: [{ id: causalityId, event: event.kind, count, auxiliary }],
    };
}

function conditionStatus(expression: Db6ConditionExpression): Db3Status {
    if (expression.op === "always" || expression.op === "predicate") return "supported";
    if (expression.op === "unknown") return "unknown";
    if (expression.op === "not") return conditionStatus(expression.child);
    const statuses = expression.children.map(conditionStatus);
    return statuses.every(value => value === "supported") ? "supported" : statuses.every(value => value === "unknown") ? "unknown" : "partial";
}

function upgradeRule(rule: Db4PassiveRule, db2Rule: DatabasePassiveRule | undefined): Db6PassiveRule {
    const mapped = mapCondition(rule.condition as Db6ConditionExpression);
    const mappedIds = new Set(mapped.mapped.map(value => value.id));
    const status = conditionStatus(mapped.condition);
    const combatHistoryTriggers = mapped.mapped.map(value => ({
        causalityId: value.id,
        event: value.event,
        minimumCount: value.count,
        recurrence: "unknown" as const,
        calculationBucket: "unknown" as const,
        rawExecutionTimingType: rule.source.executionTimingType as SqliteScalar,
        rawCalculationOption: rule.source.calculationOption as SqliteScalar,
        rawTurn: db2Rule?.skill.values.turn ?? null,
        rawIsOnce: db2Rule?.skill.values.is_once ?? null,
        rawAuxiliary: value.auxiliary,
        provenance: { table: "skill_causalities" as const, rowId: value.id },
    }));
    return {
        ...rule,
        condition: mapped.condition,
        conditionStatus: status,
        status: combatHistoryTriggers.length > 0 ? "partial" : rule.status,
        source: { ...rule.source, causalities: rule.source.causalities.map(value =>
            mappedIds.has(value.id) ? { ...value, mappingStatus: "supported" as const } : value) },
        combatHistoryTriggers,
        unknowns: combatHistoryTriggers.length > 0
            ? [...new Set([...(status === "supported" ? rule.unknowns.filter(value => value !== "condition_semantics_incomplete") : rule.unknowns), "combat_history_recurrence_unknown", "calculation_bucket_unknown"])]
            : rule.unknowns,
    };
}

export function buildDatabaseTeamAnalysisDb6Dataset(options: { db5: DatabaseTeamAnalysisDb5Dataset, db2: DatabaseTeamAnalysisExperimentDataset }): DatabaseTeamAnalysisDb6Dataset {
    const db2States = new Map(options.db2.states.map(state => [state.stateKey, state]));
    const db5 = options.db5;
    return {
        schemaVersion: 1,
        contract: "dokkan-team-analysis-database-experiment",
        contractVersion: "0.5.0",
        generatedAt: db5.generatedAt,
        sourceDb5ContractVersion: "0.4.0",
        sourceSnapshotVersion: db5.sourceSnapshotVersion,
        sourceSha256: db5.sourceSha256,
        states: db5.states.map(state => {
            if (!state.passive) {
                const { passive: _passive, ...withoutPassive } = state;
                return withoutPassive;
            }
            const db2Rules = new Map((db2States.get(state.stateKey)?.passive?.rules ?? []).map(rule => [rule.ruleKey, rule]));
            const rules = state.passive.rules.map(rule => upgradeRule(rule, db2Rules.get(rule.ruleKey)));
            const statuses = rules.map(value => value.status);
            const status: Db3Status = statuses.every(value => value === "supported") ? "supported"
                : statuses.every(value => value === "unknown") ? "unknown" : "partial";
            return { ...state, passive: { ...state.passive, rules, status } };
        }),
    };
}

function walk(expression: Db6ConditionExpression, visit: (value: Db6ConditionExpression) => void): void {
    visit(expression);
    if (expression.op === "all" || expression.op === "any") expression.children.forEach(value => walk(value, visit));
    if (expression.op === "not") walk(expression.child, visit);
}

export function buildDatabaseTeamAnalysisDb6Coverage(dataset: DatabaseTeamAnalysisDb6Dataset): DatabaseTeamAnalysisDb6Coverage {
    const rules = dataset.states.flatMap(state => state.passive?.rules ?? []);
    const statusCounts = (values: Db3Status[]): Record<Db3Status, number> => ({
        supported: values.filter(value => value === "supported").length,
        partial: values.filter(value => value === "partial").length,
        unknown: values.filter(value => value === "unknown").length,
    });
    const predicates: Array<{ kind: string, id: string }> = [];
    for (const rule of rules) walk(rule.condition, node => {
        if (node.op === "predicate" && node.predicate.sourceCausalityType === 44 && node.predicate.sourceCausalityId) {
            predicates.push({ kind: node.predicate.kind, id: node.predicate.sourceCausalityId });
        }
    });
    const triggers = rules.flatMap(value => value.combatHistoryTriggers);
    const combatHistoryEventCounts: Record<string, number> = {};
    const rawTimingCalculationTupleCounts: Record<string, number> = {};
    for (const trigger of triggers) {
        combatHistoryEventCounts[trigger.event] = (combatHistoryEventCounts[trigger.event] ?? 0) + 1;
        const tuple = `${trigger.rawExecutionTimingType}/${trigger.rawCalculationOption}`;
        rawTimingCalculationTupleCounts[tuple] = (rawTimingCalculationTupleCounts[tuple] ?? 0) + 1;
    }
    return {
        schemaVersion: 1,
        stateCount: dataset.states.length,
        ruleCount: rules.length,
        ruleStatusCounts: statusCounts(rules.map(value => value.status)),
        conditionStatusCounts: statusCounts(rules.map(value => value.conditionStatus)),
        combatHistoryPredicateCount: predicates.length,
        uniqueCombatHistoryCausalityCount: new Set(predicates.map(value => value.id)).size,
        combatHistoryEventCounts: Object.fromEntries(Object.entries(combatHistoryEventCounts).sort(([left], [right]) => left.localeCompare(right))),
        recurrenceUnknownCount: triggers.filter(value => value.recurrence === "unknown").length,
        calculationBucketUnknownCount: triggers.filter(value => value.calculationBucket === "unknown").length,
        rawTimingCalculationTupleCounts: Object.fromEntries(Object.entries(rawTimingCalculationTupleCounts).sort(([left], [right]) => left.localeCompare(right, "en", { numeric: true }))),
    };
}
